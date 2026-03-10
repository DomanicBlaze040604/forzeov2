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
import postgres from "https://deno.land/x/postgresjs@v3.4.5/mod.js";

const corsHeaders = {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
    "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const SUPABASE_URL = Deno.env.get("SUPABASE_URL") || "";
const SUPABASE_SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || "";
const GOOGLE_CLIENT_ID = Deno.env.get("GOOGLE_CLIENT_ID") || "";
const GOOGLE_CLIENT_SECRET = Deno.env.get("GOOGLE_CLIENT_SECRET") || "";

// LLM referral domain → display name mapping
const LLM_SOURCES: { name: string; domains: string[]; keywords: string[] }[] = [
    {
        name: "ChatGPT",
        domains: ["chat.openai.com", "openai.com", "chatgpt.com", "searchgpt.com"],
        keywords: ["chatgpt", "openai", "searchgpt"],
    },
    {
        name: "Perplexity",
        domains: ["perplexity.ai"],
        keywords: ["perplexity"],
    },
    {
        name: "Gemini",
        domains: ["gemini.google.com", "bard.google.com"],
        keywords: ["gemini.google"],
    },
    {
        name: "Claude",
        domains: ["claude.ai", "anthropic.com"],
        keywords: ["claude.ai", "anthropic"],
    },
    {
        name: "Copilot",
        domains: ["copilot.microsoft.com", "copilot.com"],
        keywords: ["copilot"],
    },
    {
        name: "Meta AI",
        domains: ["meta.ai"],
        keywords: ["meta.ai"],
    },
];

serve(async (req: Request) => {
    if (req.method === "OPTIONS") {
        return new Response("ok", { headers: corsHeaders });
    }

    // Service role client — bypasses RLS completely
    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY, {
        auth: { autoRefreshToken: false, persistSession: false },
    });

    // Direct Postgres connection — bypasses PostgREST schema cache entirely
    const dbUrl = Deno.env.get("SUPABASE_DB_URL");
    let sql: any = null;
    if (dbUrl) {
        sql = postgres(dbUrl);
        // Ensure table exists with all required columns (safe, non-destructive)
        try {
            await sql`
                CREATE TABLE IF NOT EXISTS public.ga4_sync_logs (
                    id               UUID DEFAULT gen_random_uuid() PRIMARY KEY,
                    client_id        UUID NOT NULL,
                    sync_date        DATE NOT NULL,
                    source           TEXT NOT NULL,
                    sessions         INTEGER NOT NULL DEFAULT 0,
                    created_at       TIMESTAMPTZ DEFAULT NOW(),
                    CONSTRAINT ga4_sync_logs_unique UNIQUE (client_id, sync_date, source)
                );
            `;
            // Add any columns that might be missing from a partial earlier creation
            await sql`ALTER TABLE public.ga4_sync_logs ADD COLUMN IF NOT EXISTS conversions INTEGER NOT NULL DEFAULT 0`.catch(() => {});
            await sql`ALTER TABLE public.ga4_sync_logs ADD COLUMN IF NOT EXISTS active_users INTEGER NOT NULL DEFAULT 0`.catch(() => {});
            await sql`ALTER TABLE public.ga4_sync_logs ADD COLUMN IF NOT EXISTS engagement_rate NUMERIC(10, 4) DEFAULT 0`.catch(() => {});
            await sql`ALTER TABLE public.ga4_sync_logs ADD COLUMN IF NOT EXISTS avg_session_duration NUMERIC(10, 2) DEFAULT 0`.catch(() => {});
            await sql`CREATE INDEX IF NOT EXISTS idx_ga4_sync_logs_client ON public.ga4_sync_logs(client_id)`.catch(() => {});
            await sql`CREATE INDEX IF NOT EXISTS idx_ga4_sync_logs_date ON public.ga4_sync_logs(sync_date)`.catch(() => {});
            await sql`ALTER TABLE public.ga4_sync_logs ENABLE ROW LEVEL SECURITY`.catch(() => {});
            await sql`
                DO $$ BEGIN
                    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='ga4_sync_logs' AND policyname='ga4_sync_logs_open')
                    THEN CREATE POLICY ga4_sync_logs_open ON public.ga4_sync_logs FOR ALL USING (true) WITH CHECK (true);
                    END IF;
                END $$;
            `.catch(() => {});
            await sql`NOTIFY pgrst, 'reload schema'`;
            console.log("[ga4-sync] Table schema verified, direct Postgres ready");
        } catch (e) {
            console.error("[ga4-sync] Table setup error:", e);
        }
    }

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

        const results: any[] = [];

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

                // Fetch ALL sources from GA4 and filter server-side (most reliable approach)
                const gaRows = await fetchGA4TrafficUnfiltered(accessToken, integration.ga4_property_id);

                console.log(`[ga4-sync] Got ${gaRows.length} total GA4 rows for client ${integration.client_id}`);

                if (gaRows.length === 0) {
                    results.push({
                        client_id: integration.client_id,
                        success: true,
                        rows: 0,
                        method: "unfiltered",
                        ga4_rows_found: 0,
                    });
                    continue;
                }

                // Log sample rows for debugging
                const sampleRows = gaRows.slice(0, 3).map(r => ({
                    date: r.date,
                    source: r.sessionSource,
                    medium: r.sessionMedium,
                    resolved: resolveSourceName(r.sessionSource),
                    sessions: r.sessions,
                }));
                console.log(`[ga4-sync] Sample rows:`, JSON.stringify(sampleRows));

                // Aggregate rows by (date, source) — LLM sources + channel aggregates
                let rowsWritten = 0;
                const writeErrors: string[] = [];

                type AggRow = {
                    client_id: string;
                    sync_date: string;
                    source: string;
                    sessions: number;
                    conversions: number;
                    active_users: number;
                    weighted_engagement: number;
                    weighted_duration: number;
                    weight: number;
                };

                const aggregated: Record<string, AggRow> = {};

                const ensure = (key: string, date: string, source: string): AggRow => {
                    if (!aggregated[key]) {
                        aggregated[key] = {
                            client_id: integration.client_id,
                            sync_date: date,
                            source,
                            sessions: 0,
                            conversions: 0,
                            active_users: 0,
                            weighted_engagement: 0,
                            weighted_duration: 0,
                            weight: 0,
                        };
                    }
                    return aggregated[key];
                };

                const addTo = (agg: AggRow, row: GA4Row) => {
                    agg.sessions += row.sessions;
                    agg.conversions += row.conversions;
                    agg.active_users += row.activeUsers;
                    agg.weighted_engagement += row.engagementRate * row.sessions;
                    agg.weighted_duration += row.avgSessionDuration * row.sessions;
                    agg.weight += row.sessions;
                };

                for (const row of gaRows) {
                    const llmName = resolveSourceName(row.sessionSource);
                    const isDirect = row.sessionSource.toLowerCase() === "(direct)";
                    const isReferral = row.sessionMedium.toLowerCase() === "referral" && !llmName;

                    // LLM source rows (existing behavior)
                    if (llmName) {
                        addTo(ensure(`${row.date}|${llmName}`, row.date, llmName), row);
                    }

                    // Channel aggregates
                    addTo(ensure(`${row.date}|Total`, row.date, "Total"), row);
                    if (isDirect) addTo(ensure(`${row.date}|Direct`, row.date, "Direct"), row);
                    if (isReferral) addTo(ensure(`${row.date}|Referral`, row.date, "Referral"), row);
                }

                const batchRows = Object.values(aggregated).map(a => ({
                    client_id: a.client_id,
                    sync_date: a.sync_date,
                    source: a.source,
                    sessions: a.sessions,
                    conversions: a.conversions,
                    active_users: a.active_users,
                    engagement_rate: a.weight > 0 ? a.weighted_engagement / a.weight : 0,
                    avg_session_duration: a.weight > 0 ? a.weighted_duration / a.weight : 0,
                }));
                console.log(`[ga4-sync] Aggregated into ${batchRows.length} rows (LLM + channel aggregates)`);

                // Write directly to Postgres (bypasses PostgREST schema cache)
                if (!sql) {
                    writeErrors.push("No direct DB connection available (SUPABASE_DB_URL not set)");
                } else {
                    try {
                        // Delete existing rows for this client
                        await sql`DELETE FROM public.ga4_sync_logs WHERE client_id = ${integration.client_id}`;
                        console.log(`[ga4-sync] Deleted old rows for client ${integration.client_id}`);

                        // Insert all rows using direct SQL
                        for (const row of batchRows) {
                            try {
                                await sql`
                                    INSERT INTO public.ga4_sync_logs
                                        (client_id, sync_date, source, sessions, conversions, active_users, engagement_rate, avg_session_duration)
                                    VALUES
                                        (${row.client_id}, ${row.sync_date}, ${row.source}, ${row.sessions}, ${row.conversions}, ${row.active_users}, ${row.engagement_rate}, ${row.avg_session_duration})
                                    ON CONFLICT (client_id, sync_date, source) DO UPDATE SET
                                        sessions = EXCLUDED.sessions,
                                        conversions = EXCLUDED.conversions,
                                        active_users = EXCLUDED.active_users,
                                        engagement_rate = EXCLUDED.engagement_rate,
                                        avg_session_duration = EXCLUDED.avg_session_duration
                                `;
                                rowsWritten++;
                            } catch (rowErr) {
                                if (writeErrors.length < 5) {
                                    writeErrors.push(`Row ${row.sync_date}/${row.source}: ${String(rowErr)}`);
                                }
                            }
                        }
                        console.log(`[ga4-sync] Wrote ${rowsWritten}/${batchRows.length} rows via direct Postgres`);
                    } catch (dbErr) {
                        writeErrors.push(`Direct DB error: ${String(dbErr)}`);
                        console.error(`[ga4-sync] Direct DB error:`, dbErr);
                    }
                }

                // Update last_synced_at
                await supabase
                    .from("ga4_integrations")
                    .update({ last_synced_at: new Date().toISOString(), status: "connected", error_message: null })
                    .eq("id", integration.id);

                results.push({
                    client_id: integration.client_id,
                    success: rowsWritten > 0,
                    rows: rowsWritten,
                    method: "unfiltered",
                    ga4_rows_found: gaRows.length,
                    aggregated_rows: batchRows.length,
                    sample_rows: sampleRows,
                    write_errors: writeErrors.length > 0 ? writeErrors : undefined,
                });
            } catch (err) {
                console.error(`[ga4-sync] Error syncing client ${integration.client_id}:`, err);
                await supabase
                    .from("ga4_integrations")
                    .update({ status: "error", error_message: String(err) })
                    .eq("id", integration.id);
                results.push({ client_id: integration.client_id, success: false, rows: 0, error: String(err) });
            }
        }

        const totalSynced = results.reduce((sum: number, r: any) => sum + (r.rows || 0), 0);

        // Add diagnostic info if sync returned nothing
        let diagnostics = null;
        if (totalSynced === 0 && integrations.length === 1) {
            try {
                const accessToken = await refreshTokenIfNeeded(supabase, integrations[0]);
                diagnostics = await getIntegrationDiagnostics(accessToken, integrations[0].ga4_property_id);
            } catch (e) {
                console.error("Diagnostic probe failed:", e);
            }
        }

        return json({
            synced: totalSynced,
            clients: integrations.length,
            results,
            diagnostics,
        });
    } catch (err) {
        console.error("[ga4-sync] Fatal error:", err);
        return json({ error: String(err) }, 500);
    } finally {
        // Always close the direct Postgres connection to prevent leaks
        if (sql) {
            try { await sql.end(); } catch (_) { /* ignore */ }
        }
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

// ── GA4 Data API types ──────────────────────────────────────────────────────
interface GA4Row {
    date: string;        // YYYY-MM-DD
    sessionSource: string;
    sessionMedium: string;
    sessions: number;
    conversions: number;
    activeUsers: number;
    engagementRate: number;
    avgSessionDuration: number;
}

// ── Fetch all sources from GA4, filter LLM sources server-side ──────────────
async function fetchGA4TrafficUnfiltered(accessToken: string, propertyId: string): Promise<GA4Row[]> {
    const endDate = new Date();
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - 90);
    const fmt = (d: Date) => d.toISOString().split("T")[0];

    const requestBody = {
        dimensions: [
            { name: "date" },
            { name: "sessionSource" },
            { name: "sessionMedium" },
        ],
        metrics: [
            { name: "sessions" },
            { name: "keyEvents" },
            { name: "activeUsers" },
            { name: "engagementRate" },
            { name: "averageSessionDuration" },
        ],
        dateRanges: [{ startDate: fmt(startDate), endDate: fmt(endDate) }],
        orderBys: [{ metric: { metricName: "sessions" }, desc: true }],
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
        const errMsg = errBody.error?.message || res.statusText;
        console.error(`[ga4-sync] GA4 API error (${res.status}):`, errMsg);
        throw new Error(`GA4 API error: ${errMsg}`);
    }

    const data = await res.json();
    if (!data.rows || data.rows.length === 0) {
        console.log(`[ga4-sync] GA4 API returned 0 rows`);
        return [];
    }

    console.log(`[ga4-sync] GA4 API returned ${data.rows.length} total rows (rowCount: ${data.rowCount || data.rows.length})`);

    const rows: GA4Row[] = [];

    for (const row of data.rows) {
        const rawDate = row.dimensionValues?.[0]?.value || "";
        const rawSource = row.dimensionValues?.[1]?.value || "";
        const rawMedium = row.dimensionValues?.[2]?.value || "";

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
                sessionMedium: rawMedium,
                sessions,
                conversions,
                activeUsers,
                engagementRate,
                avgSessionDuration: avgDuration,
            });
        }
    }

    console.log(`[ga4-sync] Parsed ${rows.length} total GA4 rows (all sources)`);
    return rows;
}

// ── Map GA4 session source domain → display name ────────────────────────────
function resolveSourceName(sessionSource: string): string | null {
    const lower = sessionSource.toLowerCase();
    for (const { name, domains, keywords } of LLM_SOURCES) {
        if (domains.some((d) => lower.includes(d))) return name;
        if (keywords.some((k) => lower.includes(k))) return name;
    }
    // Fallback: match broad partial names
    if (lower.includes("openai") || lower.includes("chatgpt")) return "ChatGPT";
    if (lower.includes("perplexity")) return "Perplexity";
    if (lower.includes("gemini") || lower.includes("bard")) return "Gemini";
    if (lower.includes("claude") || lower.includes("anthropic")) return "Claude";
    if (lower.includes("copilot")) return "Copilot";
    return null;
}

function json(data: unknown, status = 200) {
    return new Response(JSON.stringify(data), {
        status,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
}

// ── Enhanced diagnostics ────────────────────────────────────────────────────
async function getIntegrationDiagnostics(accessToken: string, propertyId: string) {
    try {
        const topSourcesRes = await fetch(
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
                    dateRanges: [{ startDate: "90daysAgo", endDate: "today" }],
                    limit: 50,
                    orderBys: [{ metric: { metricName: "sessions" }, desc: true }]
                }),
            }
        );

        if (!topSourcesRes.ok) return { error: "Could not pull diagnostics" };
        const topSourcesData = await topSourcesRes.json();

        const allSources = topSourcesData.rows?.map((r: any) => ({
            source: r.dimensionValues?.[0]?.value,
            sessions: r.metricValues?.[0]?.value
        })) || [];

        const llmSources = allSources.filter((s: any) => resolveSourceName(s.source || "") !== null);

        return {
            queried_property_id: propertyId,
            top_sources: allSources.slice(0, 10),
            llm_sources_found: llmSources,
            total_source_count: topSourcesData.rowCount || 0,
            hint: llmSources.length === 0
                ? "No LLM referral sources found in top 50 sources."
                : `Found ${llmSources.length} LLM source(s). If these didn't sync, there may be a database issue.`,
        };
    } catch (e) {
        console.error("[ga4-sync] Diagnostic probe failed:", e);
        return { error: "Could not pull diagnostics", detail: String(e) };
    }
}
