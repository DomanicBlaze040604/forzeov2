import { serve } from "https://deno.land/std@0.168.0/http/server.ts"

const RESEND_API_KEY = Deno.env.get("RESEND_API_KEY")!
const RESEND_FROM_EMAIL = Deno.env.get("RESEND_FROM_EMAIL") || "Forzeo Alerts <alerts@forzeo.com>"
const ADMIN_EMAILS = ["ammar@forzeo.com", "sachinjain@forzeo.com"]

serve(async (req) => {
    // Handle CORS
    if (req.method === "OPTIONS") {
        return new Response(null, {
            headers: {
                "Access-Control-Allow-Origin": "*",
                "Access-Control-Allow-Methods": "POST, OPTIONS",
                "Access-Control-Allow-Headers": "Content-Type, Authorization",
            },
        })
    }

    try {
        const { record } = await req.json()

        // Extract new user info from the profiles INSERT trigger
        const newUserEmail = record.email
        const newUserId = record.id
        const newUserName = record.full_name || "N/A"
        const signupTime = record.created_at

        console.log(`[Admin Notify] New signup: ${newUserEmail} (${newUserName})`)

        // 1. Send email via Resend
        try {
            const emailRes = await fetch("https://api.resend.com/emails", {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                    "Authorization": `Bearer ${RESEND_API_KEY}`,
                },
                body: JSON.stringify({
                    from: RESEND_FROM_EMAIL,
                    to: ADMIN_EMAILS,
                    subject: `🎉 New User Signup: ${newUserEmail}`,
                    html: `
            <h2>New User Signup</h2>
            <p><strong>Name:</strong> ${newUserName}</p>
            <p><strong>Email:</strong> ${newUserEmail}</p>
            <p><strong>User ID:</strong> ${newUserId}</p>
            <p><strong>Signup Time:</strong> ${new Date(signupTime).toLocaleString()}</p>
            <hr style="margin: 20px 0; border: none; border-top: 1px solid #eee;" />
            <p><a href="https://bvmwnxargzlfheiwyget.supabase.co/project/default/editor" style="background: #3b82f6; color: white; padding: 10px 20px; text-decoration: none; border-radius: 6px; display: inline-block;">View in Supabase Dashboard</a></p>
          `,
                }),
            })

            if (!emailRes.ok) {
                const err = await emailRes.text()
                console.error("[Admin Notify] Resend error:", err)
            } else {
                console.log("[Admin Notify] Email sent successfully")
            }
        } catch (emailError) {
            console.error("[Admin Notify] Failed to send email:", emailError)
        }

        // 2. Insert in-app notification
        const supabaseUrl = Deno.env.get("SUPABASE_URL")!
        const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!

        const { createClient } = await import("https://esm.sh/@supabase/supabase-js@2")
        const supabase = createClient(supabaseUrl, supabaseServiceKey)

        // Get all admin users
        const { data: admins } = await supabase
            .from("profiles")
            .select("id")
            .eq("role", "admin")

        if (admins && admins.length > 0) {
            // Insert notification for each admin
            const notifications = admins.map(admin => ({
                user_id: admin.id,
                type: "signup",
                title: "New User Signup",
                message: `${newUserName} (${newUserEmail}) just signed up!`,
                metadata: {
                    new_user_email: newUserEmail,
                    new_user_name: newUserName,
                    new_user_id: newUserId,
                    signup_time: signupTime,
                },
            }))

            const { error: insertError } = await supabase
                .from("notifications")
                .insert(notifications)

            if (insertError) {
                console.error("[Admin Notify] Failed to insert notifications:", insertError)
            } else {
                console.log(`[Admin Notify] Created ${notifications.length} in-app notifications`)
            }
        }

        return new Response(JSON.stringify({ success: true }), {
            headers: { "Content-Type": "application/json" },
        })
    } catch (error) {
        console.error("[Admin Notify] Error:", error)
        return new Response(JSON.stringify({ error: error.message }), {
            status: 500,
            headers: { "Content-Type": "application/json" },
        })
    }
})
