// @ts-nocheck
/**
 * GA4 Sync Edge Function
 * Pulls LLM-referral traffic data from the Google Analytics Data API v1
 * and upserts it into the ga4_sync_logs table.
 *
 * Triggered by:
 *  - Manual "Refresh Sync" button (via ga4-proxy → refresh_sync action)
 *  - Supabase Cron Job (daily at midnight UTC)
 *
 * Body: { client_id?: string }
 * If client_id is omitted, syncs all clients with a connected GA4 integration.
 */

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
    "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const SUPABASE_URL = Deno.env.get("SUPABASE_URL") || "";
const SUPABASE_SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || "";
const GOOGLE_CLIENT_ID = Deno.env.get("GOOGLE_CLIENT_ID") || "";
const GOOGLE_CLIENT_SECRET = Deno.env.get("GOOGLE_CLIENT_SECRET") || "";

// LLM referral domain → display name mapping (from PRD §3.3)
const LLM_SOURCES: { name: string; domains: string[] }[] = [
    {
        name: "ChatGPT",
        domains: ["chat.openai.com", "openai.com", "chatgpt.com"],
    },
    {
        name: "Perplexity",
        domains: ["perplexity.ai"],
    },
    {
        name: "Gemini",
        domains: ["gemini.google.com"],
    },
    {
        name: "Claude",
        domains: ["claude.ai", "anthropic.com"],
    },
];

// Build the GA4 Data API regex from the domain list
const LLM_DOMAIN_REGEX = LLM_SOURCES.flatMap((s) => s.domains)
    .map((d) => d.replace(".", "\\."))
    .join("|");

serve(async (req: Request) => {
    if (req.method === "OPTIONS") {
        return new Response("ok", { headers: corsHeaders });
    }

    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);

    try {
        const body = await req.json().catch(() => ({}));
        const requestedClientId: string | null = body.client_id || null;

        // Fetch integrations to sync
        let query = supabase
            .from("ga4_integrations")
            .select("*")
            .eq("status", "connected");

        if (requestedClientId) {
            query = query.eq("client_id", requestedClientId);
        }

        const { data: integrations, error: fetchErr } = await query;
        if (fetchErr) return json({ error: fetchErr.message }, 500);
        if (!integrations || integrations.length === 0) {
            return json({ synced: 0, message: "No connected integrations found." });
        }

        const results: { client_id: string; success: boolean; rows: number; error?: string }[] = [];

        for (const integration of integrations) {
            try {
                const accessToken = await refreshTokenIfNeeded(supabase, integration);
                if (!accessToken) {
                    await supabase
                        .from("ga4_integrations")
                        .update({ status: "error", error_message: "Token refresh failed" })
                        .eq("id", integration.id);
                    results.push({ client_id: integration.client_id, success: false, rows: 0, error: "Token refresh failed" });
                    continue;
                }

                // Pull last 90 days of LLM referral data from GA4
                const gaRows = await fetchGA4TrafficData(accessToken, integration.ga4_property_id);

                // Map GA4 session source → display name and upsert
                let rowsUpserted = 0;
                for (const row of gaRows) {
                    const sourceName = resolveSourceName(row.sessionSource);
                    if (!sourceName) continue; // shouldn't happen, but guard against it

                    const { error: upsertErr } = await supabase
                        .from("ga4_sync_logs")
                        .upsert(
                            {
                                client_id: integration.client_id,
                                sync_date: row.date,
                                source: sourceName,
                                sessions: row.sessions,
                                conversions: row.conversions,
                                active_users: row.activeUsers,
                                engagement_rate: row.engagementRate,
                                avg_session_duration: row.avgSessionDuration,
                            },
                            { onConflict: "client_id,sync_date,source" }
                        );

                    if (!upsertErr) rowsUpserted++;
                }

                // Update last_synced_at
                await supabase
                    .from("ga4_integrations")
                    .update({ last_synced_at: new Date().toISOString(), status: "connected", error_message: null })
                    .eq("id", integration.id);

                results.push({ client_id: integration.client_id, success: true, rows: rowsUpserted });
            } catch (err) {
                console.error(`[ga4-sync] Error syncing client ${integration.client_id}:`, err);
                await supabase
                    .from("ga4_integrations")
                    .update({ status: "error", error_message: String(err) })
                    .eq("id", integration.id);
                results.push({ client_id: integration.client_id, success: false, rows: 0, error: String(err) });
            }
        }

        const totalSynced = results.reduce((sum, r) => sum + r.rows, 0);

        // Add diagnostic info if sync returned nothing
        let diagnostics = null;
        if (totalSynced === 0 && integrations.length === 1) {
            try {
                const accessToken = await refreshTokenIfNeeded(supabase, integrations[0]);
                diagnostics = {
                    ...(await getIntegrationDiagnostics(accessToken, integrations[0].ga4_property_id)),
                    queried_property_id: integrations[0].ga4_property_id
                };
            } catch (e) {
                console.error("Diagnostic probe failed:", e);
            }
        }

        return json({
            synced: totalSynced,
            clients: integrations.length,
            results,
            diagnostics
        });
    } catch (err) {
        console.error("[ga4-sync] Fatal error:", err);
        return json({ error: String(err) }, 500);
    }
});

// ── Token refresh helper ────────────────────────────────────────────────────
async function refreshTokenIfNeeded(supabase: any, integration: any): Promise<string | null> {
    const expiresAt = integration.token_expires_at ? new Date(integration.token_expires_at) : null;
    const needsRefresh = !expiresAt || expiresAt.getTime() < Date.now() + 60_000;

    if (!needsRefresh) return integration.access_token;
    if (!integration.refresh_token) return null;

    try {
        const res = await fetch("https://oauth2.googleapis.com/token", {
            method: "POST",
            headers: { "Content-Type": "application/x-www-form-urlencoded" },
            body: new URLSearchParams({
                refresh_token: integration.refresh_token,
                client_id: GOOGLE_CLIENT_ID,
                client_secret: GOOGLE_CLIENT_SECRET,
                grant_type: "refresh_token",
            }),
        });

        const data = await res.json();
        if (!data.access_token) return null;

        const newExpiry = new Date(Date.now() + (data.expires_in || 3600) * 1000).toISOString();
        await supabase
            .from("ga4_integrations")
            .update({ access_token: data.access_token, token_expires_at: newExpiry })
            .eq("id", integration.id);

        return data.access_token;
    } catch {
        return null;
    }
}

// ── GA4 Data API call ───────────────────────────────────────────────────────
interface GA4Row {
    date: string;        // YYYY-MM-DD
    sessionSource: string;
    sessions: number;
    conversions: number;
    activeUsers: number;
    engagementRate: number;
    avgSessionDuration: number;
}

async function fetchGA4TrafficData(accessToken: string, propertyId: string): Promise<GA4Row[]> {
    const endDate = new Date();
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - 90);

    const formatDate = (d: Date) => d.toISOString().split("T")[0];

    // GA4 Data API request body — matches PRD §3 spec exactly
    const requestBody = {
        dimensions: [
            { name: "date" },
            { name: "sessionSource" },
        ],
        metrics: [
            { name: "sessions" },
            { name: "keyEvents" },
            { name: "activeUsers" },
            { name: "engagementRate" },
            { name: "averageSessionDuration" },
        ],
        dateRanges: [{ startDate: formatDate(startDate), endDate: formatDate(endDate) }],
        dimensionFilter: {
            filter: {
                fieldName: "sessionSource",
                stringFilter: {
                    matchType: "PARTIAL_REGEXP",
                    value: `(${LLM_DOMAIN_REGEX})`,
                },
            },
        },
        limit: 10000,
    };

    const res = await fetch(
        `https://analyticsdata.googleapis.com/v1beta/${propertyId}:runReport`,
        {
            method: "POST",
            headers: {
                Authorization: `Bearer ${accessToken}`,
                "Content-Type": "application/json",
            },
            body: JSON.stringify(requestBody),
        }
    );

    if (!res.ok) {
        const errBody = await res.json().catch(() => ({}));
        throw new Error(`GA4 API error: ${errBody.error?.message || res.statusText}`);
    }

    const data = await res.json();
    if (!data.rows || data.rows.length === 0) return [];

    const rows: GA4Row[] = [];

    for (const row of data.rows) {
        const rawDate = row.dimensionValues?.[0]?.value || "";   // "20260301"
        const rawSource = row.dimensionValues?.[1]?.value || ""; // "chat.openai.com"

        const sessions = parseInt(row.metricValues?.[0]?.value || "0", 10);
        const conversions = parseInt(row.metricValues?.[1]?.value || "0", 10);
        const activeUsers = parseInt(row.metricValues?.[2]?.value || "0", 10);
        const engagementRate = parseFloat(row.metricValues?.[3]?.value || "0");
        const avgDuration = parseFloat(row.metricValues?.[4]?.value || "0");

        // Convert GA4 date format "20260301" → "2026-03-01"
        const date = rawDate.length === 8
            ? `${rawDate.slice(0, 4)}-${rawDate.slice(4, 6)}-${rawDate.slice(6, 8)}`
            : rawDate;

        if (sessions > 0) {
            rows.push({
                date,
                sessionSource: rawSource,
                sessions,
                conversions,
                activeUsers,
                engagementRate,
                avgSessionDuration: avgDuration
            });
        }
    }

    return rows;
}

// ── Map GA4 session source domain → display name ────────────────────────────
function resolveSourceName(sessionSource: string): string | null {
    const lower = sessionSource.toLowerCase();
    for (const { name, domains } of LLM_SOURCES) {
        if (domains.some((d) => lower.includes(d))) return name;
    }
    // Fallback: match partial domain names
    if (lower.includes("openai") || lower.includes("chatgpt")) return "ChatGPT";
    if (lower.includes("perplexity")) return "Perplexity";
    if (lower.includes("gemini") || lower.includes("bard")) return "Gemini";
    if (lower.includes("claude") || lower.includes("anthropic")) return "Claude";
    return null;
}

function json(data: unknown, status = 200) {
    return new Response(JSON.stringify(data), {
        status,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
}

// ── Diagnostic helper: Pull top 5 sources regardless of LLM ──────────────────
async function getIntegrationDiagnostics(accessToken: string, propertyId: string) {
    const res = await fetch(
        `https://analyticsdata.googleapis.com/v1beta/${propertyId}:runReport`,
        {
            method: "POST",
            headers: {
                Authorization: `Bearer ${accessToken}`,
                "Content-Type": "application/json",
            },
            body: JSON.stringify({
                dimensions: [{ name: "sessionSource" }],
                metrics: [{ name: "sessions" }],
                dateRanges: [{ startDate: "30daysAgo", endDate: "today" }],
                limit: 5,
                orderBys: [{ metric: { metricName: "sessions" }, desc: true }]
            }),
        }
    );

    if (!res.ok) return { error: "Could not pull diagnostics" };
    const data = await res.json();
    return {
        top_sources: data.rows?.map(r => ({
            source: r.dimensionValues?.[0]?.value,
            sessions: r.metricValues?.[0]?.value
        })) || [],
        row_count: data.rowCount || 0
    };
}
