import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from "https://esm.sh/@supabase/supabase-js@2"

const RESEND_API_KEY = Deno.env.get("RESEND_API_KEY")!
const RESEND_FROM_EMAIL = Deno.env.get("RESEND_FROM_EMAIL") || "Forzeo Reports <reports@forzeo.com>"

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders })
  }

  try {
    const { client_id, report_type = "weekly_summary", recipient_emails } = await req.json()

    if (!client_id || !recipient_emails || recipient_emails.length === 0) {
      return new Response(
        JSON.stringify({ error: "client_id and recipient_emails are required" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      )
    }

    console.log(`[SendReport] Generating ${report_type} for client ${client_id}`)

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    const supabase = createClient(supabaseUrl, supabaseServiceKey)

    // Fetch client info
    const { data: client, error: clientError } = await supabase
      .from("clients")
      .select("name, brand_name, brand_domain, competitors")
      .eq("id", client_id)
      .single()

    if (clientError || !client) {
      return new Response(
        JSON.stringify({ error: "Client not found" }),
        { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      )
    }

    // Determine date range
    const now = new Date()
    const rangeStart = new Date(now)
    if (report_type === "monthly_summary") {
      rangeStart.setDate(rangeStart.getDate() - 30)
    } else {
      rangeStart.setDate(rangeStart.getDate() - 7)
    }

    // Fetch recent audit results
    const { data: auditResults } = await supabase
      .from("audit_results")
      .select("prompt_id, prompt_text, created_at, model_results, summary")
      .eq("client_id", client_id)
      .gte("created_at", rangeStart.toISOString())
      .order("created_at", { ascending: false })
      .limit(200)

    const results = auditResults || []

    // Compute stats
    let totalAudits = results.length
    let brandMentions = 0
    let totalModelResults = 0
    let citationCount = 0
    const sourceDomains = new Map<string, number>()

    for (const r of results) {
      const mrs = r.model_results || []
      for (const mr of mrs) {
        totalModelResults++
        if (mr.brand_mentioned) brandMentions++
        for (const c of (mr.citations || [])) {
          citationCount++
          const domain = c.domain || ""
          if (domain) sourceDomains.set(domain, (sourceDomains.get(domain) || 0) + 1)
        }
      }
    }

    const sovPct = totalModelResults > 0 ? Math.round((brandMentions / totalModelResults) * 100) : 0

    // Top 5 sources
    const topSources = Array.from(sourceDomains.entries())
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5)

    // Top 5 prompts by visibility
    const promptVisibility = results.map(r => {
      const mrs = r.model_results || []
      const visible = mrs.filter((mr: any) => mr.brand_mentioned).length
      return { text: r.prompt_text, visible, total: mrs.length }
    }).sort((a, b) => b.visible - a.visible).slice(0, 5)

    const periodLabel = report_type === "monthly_summary" ? "Monthly" : "Weekly"
    const dateRange = `${rangeStart.toLocaleDateString()} — ${now.toLocaleDateString()}`

    // Generate HTML email
    const emailHtml = `
      <div style="font-family: 'Inter', system-ui, sans-serif; max-width: 640px; margin: 0 auto; background: #ffffff;">
        <div style="background: linear-gradient(135deg, #1e3a5f 0%, #2563eb 100%); padding: 32px; border-radius: 12px 12px 0 0;">
          <h1 style="color: white; margin: 0; font-size: 24px; font-weight: 700;">Forzeo GEO Report</h1>
          <p style="color: rgba(255,255,255,0.8); margin: 8px 0 0; font-size: 14px;">${periodLabel} Summary — ${client.brand_name || client.name}</p>
          <p style="color: rgba(255,255,255,0.6); margin: 4px 0 0; font-size: 12px;">${dateRange}</p>
        </div>

        <div style="padding: 24px;">
          <!-- KPI Cards -->
          <div style="display: flex; gap: 12px; margin-bottom: 24px;">
            <div style="flex: 1; background: #f0f9ff; border: 1px solid #bae6fd; border-radius: 8px; padding: 16px; text-align: center;">
              <div style="font-size: 28px; font-weight: 700; color: #0369a1;">${sovPct}%</div>
              <div style="font-size: 11px; color: #6b7280; text-transform: uppercase; letter-spacing: 0.05em;">Share of Voice</div>
            </div>
            <div style="flex: 1; background: #f0fdf4; border: 1px solid #bbf7d0; border-radius: 8px; padding: 16px; text-align: center;">
              <div style="font-size: 28px; font-weight: 700; color: #15803d;">${citationCount}</div>
              <div style="font-size: 11px; color: #6b7280; text-transform: uppercase; letter-spacing: 0.05em;">Citations</div>
            </div>
            <div style="flex: 1; background: #faf5ff; border: 1px solid #e9d5ff; border-radius: 8px; padding: 16px; text-align: center;">
              <div style="font-size: 28px; font-weight: 700; color: #7e22ce;">${totalAudits}</div>
              <div style="font-size: 11px; color: #6b7280; text-transform: uppercase; letter-spacing: 0.05em;">Audits Run</div>
            </div>
          </div>

          <!-- Top Prompts -->
          <h3 style="font-size: 14px; font-weight: 600; color: #111827; margin: 24px 0 12px; text-transform: uppercase; letter-spacing: 0.05em;">Top Prompts by Visibility</h3>
          <table style="width: 100%; border-collapse: collapse;">
            <thead>
              <tr style="background: #f9fafb;">
                <th style="text-align: left; padding: 8px 12px; font-size: 11px; color: #6b7280; border-bottom: 1px solid #e5e7eb;">Prompt</th>
                <th style="text-align: right; padding: 8px 12px; font-size: 11px; color: #6b7280; border-bottom: 1px solid #e5e7eb;">Visibility</th>
              </tr>
            </thead>
            <tbody>
              ${promptVisibility.map((p, i) => `
                <tr style="background: ${i % 2 === 0 ? '#ffffff' : '#f9fafb'};">
                  <td style="padding: 10px 12px; font-size: 13px; color: #374151; border-bottom: 1px solid #f3f4f6; max-width: 400px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;">${p.text.substring(0, 80)}${p.text.length > 80 ? '...' : ''}</td>
                  <td style="padding: 10px 12px; font-size: 13px; color: ${p.visible > 0 ? '#059669' : '#9ca3af'}; font-weight: 600; text-align: right; border-bottom: 1px solid #f3f4f6;">${p.visible}/${p.total}</td>
                </tr>
              `).join('')}
              ${promptVisibility.length === 0 ? '<tr><td colspan="2" style="padding: 16px; text-align: center; color: #9ca3af; font-style: italic;">No audit data for this period</td></tr>' : ''}
            </tbody>
          </table>

          <!-- Top Sources -->
          <h3 style="font-size: 14px; font-weight: 600; color: #111827; margin: 24px 0 12px; text-transform: uppercase; letter-spacing: 0.05em;">Top Citation Sources</h3>
          <table style="width: 100%; border-collapse: collapse;">
            <thead>
              <tr style="background: #f9fafb;">
                <th style="text-align: left; padding: 8px 12px; font-size: 11px; color: #6b7280; border-bottom: 1px solid #e5e7eb;">Domain</th>
                <th style="text-align: right; padding: 8px 12px; font-size: 11px; color: #6b7280; border-bottom: 1px solid #e5e7eb;">Citations</th>
              </tr>
            </thead>
            <tbody>
              ${topSources.map(([domain, count], i) => `
                <tr style="background: ${i % 2 === 0 ? '#ffffff' : '#f9fafb'};">
                  <td style="padding: 10px 12px; font-size: 13px; color: #374151; border-bottom: 1px solid #f3f4f6;">
                    <img src="https://www.google.com/s2/favicons?domain=${domain}&sz=16" alt="" style="width: 14px; height: 14px; vertical-align: middle; margin-right: 6px; border-radius: 2px;" />${domain}
                  </td>
                  <td style="padding: 10px 12px; font-size: 13px; color: #3b82f6; font-weight: 600; text-align: right; border-bottom: 1px solid #f3f4f6;">${count}</td>
                </tr>
              `).join('')}
              ${topSources.length === 0 ? '<tr><td colspan="2" style="padding: 16px; text-align: center; color: #9ca3af; font-style: italic;">No citation data for this period</td></tr>' : ''}
            </tbody>
          </table>

          <div style="margin-top: 32px; padding-top: 20px; border-top: 1px solid #e5e7eb; color: #9ca3af; font-size: 11px; text-align: center;">
            <p>This report was automatically generated by Forzeo GEO.</p>
            <p>To manage report subscriptions, visit your dashboard settings.</p>
          </div>
        </div>
      </div>
    `

    // Send via Resend
    if (!RESEND_API_KEY) {
      console.error("[SendReport] RESEND_API_KEY not set")
      return new Response(
        JSON.stringify({ error: "Email service not configured" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      )
    }

    const emailRes = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${RESEND_API_KEY}`,
      },
      body: JSON.stringify({
        from: RESEND_FROM_EMAIL,
        to: recipient_emails,
        subject: `${periodLabel} GEO Report: ${client.brand_name || client.name} — ${dateRange}`,
        html: emailHtml,
      }),
    })

    if (!emailRes.ok) {
      const err = await emailRes.text()
      console.error(`[SendReport] Resend error (${emailRes.status}):`, err)
      return new Response(
        JSON.stringify({ error: "Failed to send email", details: err }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      )
    }

    const emailData = await emailRes.json()
    console.log(`[SendReport] Email sent (id: ${emailData.id}) to: ${recipient_emails.join(', ')}`)

    return new Response(
      JSON.stringify({
        success: true,
        email_id: emailData.id,
        stats: { sov: sovPct, citations: citationCount, audits: totalAudits, sources: topSources.length },
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    )
  } catch (error) {
    console.error("[SendReport] Error:", error)
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    )
  }
})
