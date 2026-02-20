import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from "https://esm.sh/@supabase/supabase-js@2"

const RESEND_API_KEY = Deno.env.get("RESEND_API_KEY")!
const ADMIN_EMAILS = ["ammar@forzeo.com", "sachinjain@forzeo.com"]

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
}

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders })
  }

  try {
    const { run_id } = await req.json()

    if (!run_id) {
      return new Response(
        JSON.stringify({ error: "run_id is required" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      )
    }

    console.log(`[Notification] Processing notification for run: ${run_id}`)

    // Initialize Supabase client
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    const supabase = createClient(supabaseUrl, supabaseServiceKey)

    // Fetch run details from database
    const { data: run, error: runError } = await supabase
      .from('schedule_runs')
      .select('*, prompt_schedules(name)')
      .eq('id', run_id)
      .single()

    if (runError || !run) {
      console.error("[Notification] Run not found:", runError)
      return new Response(
        JSON.stringify({ error: "Run not found" }),
        { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      )
    }

    // Skip if notification already sent
    if (run.notification_sent_at) {
      console.log("[Notification] Notification already sent, skipping")
      return new Response(
        JSON.stringify({ success: true, message: "Notification already sent" }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      )
    }

    // Calculate execution summary
    const summary = {
      scheduleName: run.prompt_schedules?.name || 'Unnamed Schedule',
      totalBrands: run.total_brands || 1,
      completedBrands: run.completed_brands || 0,
      failedBrands: run.failed_brands || 0,
      totalPrompts: run.total_prompts || 0,
      promptsCompleted: run.prompts_completed || 0,
      status: run.status,
      executionTime: run.started_at && run.completed_at
        ? Math.floor((new Date(run.completed_at).getTime() - new Date(run.started_at).getTime()) / 60000)
        : 0, // minutes
      totalCost: run.total_cost || 0,
    }

    // Calculate failure rate
    const failureRate = summary.totalBrands > 0
      ? (summary.failedBrands / summary.totalBrands) * 100
      : 0

    const isExceptionalFailure = failureRate > 30

    // Determine notification type
    const notificationType =
      run.status === 'completed' ? 'schedule_completed' :
      run.status === 'skipped' ? 'schedule_skipped' :
      isExceptionalFailure ? 'schedule_exceptional_failure' :
      run.status.includes('error') ? 'schedule_failed' :
      'schedule_partial_failure'

    console.log(`[Notification] Type: ${notificationType}, Failure Rate: ${failureRate.toFixed(1)}%`)

    // ========================================================================
    // 1. SEND EMAIL VIA RESEND API
    // ========================================================================

    // Always send email for failures, conditional for success
    if (run.status.includes('error') || isExceptionalFailure || run.status === 'completed') {
      try {
        const emailSubject = isExceptionalFailure
          ? `⚠️ EXCEPTIONAL FAILURE: ${summary.scheduleName}`
          : run.status === 'completed'
          ? `✅ Schedule Completed: ${summary.scheduleName}`
          : `❌ Schedule Failed: ${summary.scheduleName}`

        const emailHtml = isExceptionalFailure || run.status.includes('error')
          ? `
            <div style="font-family: sans-serif; max-width: 600px; margin: 0 auto;">
              <h2 style="color: #ef4444;">${isExceptionalFailure ? 'Exceptional Failure Detected' : 'Schedule Execution Failed'}</h2>

              <div style="background: #fef2f2; border-left: 4px solid #ef4444; padding: 16px; margin: 20px 0;">
                <p style="margin: 0; color: #991b1b; font-weight: bold;">
                  ${isExceptionalFailure ? `High failure rate: ${failureRate.toFixed(1)}% of brands failed` : 'Execution encountered critical errors'}
                </p>
              </div>

              <table style="width: 100%; border-collapse: collapse; margin: 20px 0;">
                <tr style="background: #f9fafb;">
                  <td style="padding: 12px; border-bottom: 1px solid #e5e7eb; font-weight: bold;">Schedule</td>
                  <td style="padding: 12px; border-bottom: 1px solid #e5e7eb;">${summary.scheduleName}</td>
                </tr>
                <tr>
                  <td style="padding: 12px; border-bottom: 1px solid #e5e7eb; font-weight: bold;">Status</td>
                  <td style="padding: 12px; border-bottom: 1px solid #e5e7eb;">
                    <span style="background: #fee2e2; color: #991b1b; padding: 4px 8px; border-radius: 4px; font-size: 12px;">
                      ${summary.status.toUpperCase()}
                    </span>
                  </td>
                </tr>
                <tr style="background: #f9fafb;">
                  <td style="padding: 12px; border-bottom: 1px solid #e5e7eb; font-weight: bold;">Brands</td>
                  <td style="padding: 12px; border-bottom: 1px solid #e5e7eb;">
                    ${summary.completedBrands}/${summary.totalBrands} completed
                    <span style="color: #dc2626; margin-left: 8px;">(${summary.failedBrands} failed)</span>
                  </td>
                </tr>
                <tr>
                  <td style="padding: 12px; border-bottom: 1px solid #e5e7eb; font-weight: bold;">Prompts</td>
                  <td style="padding: 12px; border-bottom: 1px solid #e5e7eb;">${summary.promptsCompleted}/${summary.totalPrompts} completed</td>
                </tr>
                <tr style="background: #f9fafb;">
                  <td style="padding: 12px; border-bottom: 1px solid #e5e7eb; font-weight: bold;">Failure Rate</td>
                  <td style="padding: 12px; border-bottom: 1px solid #e5e7eb;">
                    <span style="color: ${failureRate > 50 ? '#991b1b' : '#dc2626'}; font-weight: bold;">
                      ${failureRate.toFixed(1)}%
                    </span>
                  </td>
                </tr>
                <tr>
                  <td style="padding: 12px; border-bottom: 1px solid #e5e7eb; font-weight: bold;">Execution Time</td>
                  <td style="padding: 12px; border-bottom: 1px solid #e5e7eb;">${summary.executionTime} minutes</td>
                </tr>
                <tr style="background: #f9fafb;">
                  <td style="padding: 12px; font-weight: bold;">Total Cost</td>
                  <td style="padding: 12px;">$${summary.totalCost.toFixed(4)}</td>
                </tr>
              </table>

              <div style="margin: 30px 0; text-align: center;">
                <a href="https://bvmwnxargzlfheiwyget.supabase.co/project/default/editor"
                   style="background: #ef4444; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; display: inline-block;">
                  View Details in Dashboard
                </a>
              </div>

              <div style="margin-top: 30px; padding-top: 20px; border-top: 1px solid #e5e7eb; color: #6b7280; font-size: 12px;">
                <p>Run ID: ${run_id}</p>
                <p>This is an automated notification from Forzeo Auto Scheduler</p>
              </div>
            </div>
          `
          : `
            <div style="font-family: sans-serif; max-width: 600px; margin: 0 auto;">
              <h2 style="color: #10b981;">✅ Schedule Execution Completed</h2>

              <div style="background: #f0fdf4; border-left: 4px solid #10b981; padding: 16px; margin: 20px 0;">
                <p style="margin: 0; color: #047857; font-weight: bold;">
                  All prompts executed successfully across ${summary.totalBrands} brands
                </p>
              </div>

              <table style="width: 100%; border-collapse: collapse; margin: 20px 0;">
                <tr style="background: #f9fafb;">
                  <td style="padding: 12px; border-bottom: 1px solid #e5e7eb; font-weight: bold;">Schedule</td>
                  <td style="padding: 12px; border-bottom: 1px solid #e5e7eb;">${summary.scheduleName}</td>
                </tr>
                <tr>
                  <td style="padding: 12px; border-bottom: 1px solid #e5e7eb; font-weight: bold;">Brands Processed</td>
                  <td style="padding: 12px; border-bottom: 1px solid #e5e7eb;">${summary.totalBrands}</td>
                </tr>
                <tr style="background: #f9fafb;">
                  <td style="padding: 12px; border-bottom: 1px solid #e5e7eb; font-weight: bold;">Prompts Executed</td>
                  <td style="padding: 12px; border-bottom: 1px solid #e5e7eb;">${summary.totalPrompts}</td>
                </tr>
                <tr>
                  <td style="padding: 12px; border-bottom: 1px solid #e5e7eb; font-weight: bold;">Execution Time</td>
                  <td style="padding: 12px; border-bottom: 1px solid #e5e7eb;">
                    ${summary.executionTime} minutes
                    ${summary.totalPrompts > 0 ? `<span style="color: #6b7280; margin-left: 8px;">(~${(summary.executionTime / summary.totalPrompts).toFixed(1)} min/prompt)</span>` : ''}
                  </td>
                </tr>
                <tr style="background: #f9fafb;">
                  <td style="padding: 12px; border-bottom: 1px solid #e5e7eb; font-weight: bold;">Performance</td>
                  <td style="padding: 12px; border-bottom: 1px solid #e5e7eb;">
                    ${summary.totalPrompts > 0 && summary.executionTime > 0 ? (summary.totalPrompts / summary.executionTime).toFixed(1) : 'N/A'} prompts/min
                  </td>
                </tr>
                <tr>
                  <td style="padding: 12px; font-weight: bold;">Total Cost</td>
                  <td style="padding: 12px;">$${summary.totalCost.toFixed(4)}</td>
                </tr>
              </table>

              <div style="margin: 30px 0; text-align: center;">
                <a href="https://bvmwnxargzlfheiwyget.supabase.co/project/default/editor"
                   style="background: #10b981; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; display: inline-block;">
                  View Results in Dashboard
                </a>
              </div>

              <div style="margin-top: 30px; padding-top: 20px; border-top: 1px solid #e5e7eb; color: #6b7280; font-size: 12px;">
                <p>Run ID: ${run_id}</p>
                <p>This is an automated notification from Forzeo Auto Scheduler</p>
              </div>
            </div>
          `

        const emailRes = await fetch("https://api.resend.com/emails", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "Authorization": `Bearer ${RESEND_API_KEY}`,
          },
          body: JSON.stringify({
            from: "Forzeo Alerts <onboarding@resend.dev>",
            to: ADMIN_EMAILS,
            subject: emailSubject,
            html: emailHtml,
          }),
        })

        if (!emailRes.ok) {
          const err = await emailRes.text()
          console.error("[Notification] Resend error:", err)
        } else {
          console.log("[Notification] Email sent successfully to:", ADMIN_EMAILS.join(', '))
        }
      } catch (emailError) {
        console.error("[Notification] Failed to send email:", emailError)
        // Don't fail the entire notification if email fails
      }
    }

    // ========================================================================
    // 2. CREATE IN-APP NOTIFICATIONS FOR ALL ADMINS
    // ========================================================================

    try {
      // Get all admin users
      const { data: admins } = await supabase
        .from("profiles")
        .select("id")
        .eq("role", "admin")

      if (admins && admins.length > 0) {
        // Create notification for each admin
        const notifications = admins.map(admin => ({
          user_id: admin.id,
          type: notificationType,
          title: isExceptionalFailure
            ? `⚠️ Exceptional Failure: ${summary.scheduleName}`
            : run.status === 'completed'
            ? `✅ Schedule Completed: ${summary.scheduleName}`
            : run.status === 'skipped'
            ? `⏭️ Schedule Skipped: ${summary.scheduleName}`
            : `❌ Schedule Failed: ${summary.scheduleName}`,
          message: run.status === 'skipped'
            ? `Schedule was skipped due to conditional rules`
            : `${summary.completedBrands}/${summary.totalBrands} brands, ${summary.promptsCompleted}/${summary.totalPrompts} prompts. Time: ${summary.executionTime} min. Cost: $${summary.totalCost.toFixed(4)}`,
          metadata: {
            run_id,
            schedule_name: summary.scheduleName,
            total_brands: summary.totalBrands,
            completed_brands: summary.completedBrands,
            failed_brands: summary.failedBrands,
            total_prompts: summary.totalPrompts,
            prompts_completed: summary.promptsCompleted,
            execution_time_minutes: summary.executionTime,
            total_cost: summary.totalCost,
            status: run.status,
            failure_rate: failureRate,
            skip_reason: run.metadata?.skip_reason || null,
          },
        }))

        const { error: insertError } = await supabase
          .from("notifications")
          .insert(notifications)

        if (insertError) {
          console.error("[Notification] Failed to insert in-app notifications:", insertError)
        } else {
          console.log(`[Notification] Created ${notifications.length} in-app notifications`)
        }
      }
    } catch (notifError) {
      console.error("[Notification] Failed to create in-app notifications:", notifError)
      // Don't fail the entire notification if in-app notifications fail
    }

    // ========================================================================
    // 3. MARK NOTIFICATION AS SENT
    // ========================================================================

    await supabase
      .from('schedule_runs')
      .update({ notification_sent_at: new Date().toISOString() })
      .eq('id', run_id)

    console.log(`[Notification] Successfully processed notification for run: ${run_id}`)

    return new Response(
      JSON.stringify({ success: true, notification_type: notificationType }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    )
  } catch (error) {
    console.error("[Notification] Error:", error)
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    )
  }
})
