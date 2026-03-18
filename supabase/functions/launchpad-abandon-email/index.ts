import { serve } from "https://deno.land/std@0.168.0/http/server.ts"

const RESEND_API_KEY = Deno.env.get("RESEND_API_KEY")!
const RESEND_FROM_EMAIL = Deno.env.get("RESEND_FROM_EMAIL") || "Forzeo <hello@forzeo.com>"
const DASHBOARD_URL = Deno.env.get("DASHBOARD_URL") || "https://app.forzeo.com"

const CORS_HEADERS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization",
}

interface AbandonPayload {
  userEmail: string
  userName?: string
  brandName?: string
  completedTasks: string[]
  remainingTasks: string[]
}

const TASK_LABELS: Record<string, string> = {
  schema_done: "Schema.org Verification",
  robots_done: "Robots.txt Optimization",
  llms_done: "Generate llms.txt",
  ga4_done: "GA4 Connection",
  call_booked: "Book Onboarding Call",
}

function buildEmailHtml(payload: AbandonPayload): string {
  const { userEmail, userName, brandName, completedTasks, remainingTasks } = payload
  const greeting = userName ? `Hi ${userName}` : "Hi there"
  const brand = brandName ? ` for <strong>${brandName}</strong>` : ""
  const completedCount = completedTasks.length
  const totalCount = completedTasks.length + remainingTasks.length

  const remainingListItems = remainingTasks
    .map(key => `
      <tr>
        <td style="padding: 12px 16px; border-bottom: 1px solid #f1f5f9;">
          <table width="100%" cellpadding="0" cellspacing="0">
            <tr>
              <td width="24">
                <div style="width:20px;height:20px;border-radius:50%;border:2px solid #cbd5e1;display:inline-block;vertical-align:middle;"></div>
              </td>
              <td style="padding-left:10px;">
                <span style="font-size:14px;font-weight:600;color:#0f172a;">${TASK_LABELS[key] ?? key}</span>
              </td>
            </tr>
          </table>
        </td>
      </tr>`)
    .join("")

  const completedListItems = completedTasks
    .map(key => `
      <tr>
        <td style="padding: 10px 16px; border-bottom: 1px solid #f0fdf4;">
          <table width="100%" cellpadding="0" cellspacing="0">
            <tr>
              <td width="24">
                <div style="width:20px;height:20px;border-radius:50%;background:#22c55e;display:inline-block;vertical-align:middle;text-align:center;line-height:20px;">
                  <span style="color:white;font-size:12px;font-weight:bold;">✓</span>
                </div>
              </td>
              <td style="padding-left:10px;">
                <span style="font-size:13px;color:#16a34a;text-decoration:line-through;">${TASK_LABELS[key] ?? key}</span>
              </td>
            </tr>
          </table>
        </td>
      </tr>`)
    .join("")

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>Complete Your Forzeo Technical Setup</title>
</head>
<body style="margin:0;padding:0;background:#f8fafc;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;">

  <!-- Wrapper -->
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#f8fafc;padding:40px 16px;">
    <tr>
      <td align="center">
        <table width="100%" style="max-width:560px;" cellpadding="0" cellspacing="0">

          <!-- Header -->
          <tr>
            <td style="background:linear-gradient(135deg,#050a30 0%,#032078 100%);border-radius:16px 16px 0 0;padding:32px 32px 28px;text-align:center;">
              <img src="${DASHBOARD_URL}/forzeo-logo.svg" alt="Forzeo" height="36" style="margin-bottom:16px;" />
              <div style="display:inline-flex;align-items:center;gap:8px;background:rgba(255,255,255,0.1);border:1px solid rgba(48,209,255,0.3);border-radius:999px;padding:6px 14px;">
                <span style="width:8px;height:8px;border-radius:50%;background:#30d1ff;display:inline-block;"></span>
                <span style="color:#30d1ff;font-size:12px;font-weight:600;letter-spacing:0.05em;">AUDIT IN PROGRESS</span>
              </div>
            </td>
          </tr>

          <!-- Body -->
          <tr>
            <td style="background:#ffffff;padding:32px;">

              <p style="font-size:20px;font-weight:700;color:#0f172a;margin:0 0 8px;">${greeting},</p>
              <p style="font-size:15px;color:#475569;line-height:1.6;margin:0 0 24px;">
                Your AI Visibility Audit${brand} is still running. But we noticed you left your
                <strong style="color:#0f172a;">Technical Setup Checklist</strong> incomplete —
                which means your results may not be as accurate as they could be.
              </p>

              <!-- Progress bar -->
              <div style="background:#f1f5f9;border-radius:8px;height:8px;margin-bottom:8px;overflow:hidden;">
                <div style="background:linear-gradient(90deg,#0372ff,#30d1ff);height:8px;width:${Math.round((completedCount/totalCount)*100)}%;border-radius:8px;"></div>
              </div>
              <p style="font-size:12px;color:#94a3b8;margin:0 0 24px;text-align:right;">${completedCount} of ${totalCount} tasks complete</p>

              <!-- Remaining tasks -->
              ${remainingTasks.length > 0 ? `
              <p style="font-size:13px;font-weight:700;color:#0f172a;text-transform:uppercase;letter-spacing:0.06em;margin:0 0 8px;">Still to do</p>
              <table width="100%" cellpadding="0" cellspacing="0" style="border:1px solid #e2e8f0;border-radius:10px;overflow:hidden;margin-bottom:20px;">
                ${remainingListItems}
              </table>
              ` : ""}

              <!-- Completed tasks -->
              ${completedTasks.length > 0 ? `
              <p style="font-size:13px;font-weight:700;color:#16a34a;text-transform:uppercase;letter-spacing:0.06em;margin:0 0 8px;">Already done ✓</p>
              <table width="100%" cellpadding="0" cellspacing="0" style="border:1px solid #dcfce7;border-radius:10px;overflow:hidden;background:#f0fdf4;margin-bottom:24px;">
                ${completedListItems}
              </table>
              ` : ""}

              <!-- Urgency callout -->
              <div style="background:#fffbeb;border:1px solid #fde68a;border-radius:10px;padding:16px;margin-bottom:28px;">
                <p style="font-size:13px;color:#92400e;margin:0;line-height:1.6;">
                  <strong>⚠ Why this matters:</strong> Without these setups, AI models like ChatGPT
                  and Perplexity may miss or misrepresent your brand. Completing them now ensures
                  your first audit captures your full AI visibility picture.
                </p>
              </div>

              <!-- CTA -->
              <div style="text-align:center;margin-bottom:24px;">
                <a href="${DASHBOARD_URL}"
                   style="display:inline-block;background:#0372ff;color:#ffffff;font-size:15px;font-weight:700;
                          padding:14px 36px;border-radius:10px;text-decoration:none;letter-spacing:0.01em;">
                  Complete My Setup →
                </a>
              </div>

              <p style="font-size:13px;color:#94a3b8;text-align:center;margin:0;">
                Takes less than 5 minutes. Your audit results improve immediately.
              </p>
            </td>
          </tr>

          <!-- Footer -->
          <tr>
            <td style="background:#f8fafc;border-radius:0 0 16px 16px;padding:20px 32px;border-top:1px solid #e2e8f0;text-align:center;">
              <p style="font-size:12px;color:#94a3b8;margin:0 0 4px;">
                © 2026 Forzeo Analytics · <a href="mailto:contact@forzeo.com" style="color:#0372ff;text-decoration:none;">contact@forzeo.com</a>
              </p>
              <p style="font-size:11px;color:#cbd5e1;margin:0;">
                You're receiving this because you recently signed up for Forzeo.
              </p>
            </td>
          </tr>

        </table>
      </td>
    </tr>
  </table>
</body>
</html>`
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: CORS_HEADERS })
  }

  try {
    const payload: AbandonPayload = await req.json()
    const { userEmail, userName, brandName, completedTasks, remainingTasks } = payload

    if (!userEmail) {
      return new Response(JSON.stringify({ error: "userEmail is required" }), {
        status: 400,
        headers: { ...CORS_HEADERS, "Content-Type": "application/json" },
      })
    }

    // Only send if there are remaining tasks
    if (remainingTasks.length === 0) {
      return new Response(JSON.stringify({ skipped: true, reason: "All tasks already complete" }), {
        headers: { ...CORS_HEADERS, "Content-Type": "application/json" },
      })
    }

    console.log(`[Launchpad Abandon] Sending to ${userEmail}, ${remainingTasks.length} tasks remaining`)

    const emailRes = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${RESEND_API_KEY}`,
      },
      body: JSON.stringify({
        from: RESEND_FROM_EMAIL,
        to: [userEmail],
        subject: `⚡ Complete your Forzeo setup${brandName ? ` for ${brandName}` : ""} — audit in progress`,
        html: buildEmailHtml(payload),
      }),
    })

    if (!emailRes.ok) {
      const errText = await emailRes.text()
      console.error("[Launchpad Abandon] Resend error:", errText)
      return new Response(JSON.stringify({ error: errText }), {
        status: 502,
        headers: { ...CORS_HEADERS, "Content-Type": "application/json" },
      })
    }

    const result = await emailRes.json()
    console.log("[Launchpad Abandon] Email sent:", result.id)

    return new Response(JSON.stringify({ success: true, emailId: result.id }), {
      headers: { ...CORS_HEADERS, "Content-Type": "application/json" },
    })
  } catch (err) {
    console.error("[Launchpad Abandon] Error:", err)
    return new Response(JSON.stringify({ error: String(err) }), {
      status: 500,
      headers: { ...CORS_HEADERS, "Content-Type": "application/json" },
    })
  }
})
