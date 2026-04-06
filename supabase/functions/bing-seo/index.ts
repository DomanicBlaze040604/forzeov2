// @ts-nocheck
/**
 * Bing Webmaster Tools Proxy Edge Function
 * API key-based. Fetches top queries, top pages, crawl stats, and index stats.
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
const SUPABASE_ANON_KEY = Deno.env.get("SUPABASE_ANON_KEY") || "";
const BING_BASE = "https://ssl.bing.com/webmaster/api.svc/json";

function json(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

async function bingFetch(endpoint: string, apiKey: string, params: Record<string, string> = {}) {
  const url = new URL(`${BING_BASE}/${endpoint}`);
  url.searchParams.set("apikey", apiKey);
  Object.entries(params).forEach(([k, v]) => url.searchParams.set(k, v));
  const res = await fetch(url.toString(), {
    headers: { "Accept": "application/json" },
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data?.ErrorMessage || `HTTP ${res.status}`);
  return data;
}

serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const authHeader = req.headers.get("Authorization") || "";
    const userToken = authHeader.replace("Bearer ", "");
    const sb = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);

    const { data: { user }, error: authErr } = await createClient(SUPABASE_URL, SUPABASE_ANON_KEY)
      .auth.getUser(userToken);
    if (authErr || !user) return json({ error: "Unauthorized" }, 401);

    const body = await req.json();
    const { action, client_id } = body;
    if (!action || !client_id) return json({ error: "action and client_id required" }, 400);

    // ── connect ────────────────────────────────────────────────────────────────
    if (action === "connect") {
      const { api_key, site_url } = body;
      if (!api_key || !site_url) return json({ error: "api_key and site_url required" }, 400);

      // Verify API key works
      try {
        await bingFetch("GetUserSites", api_key);
      } catch (err) {
        return json({ error: `Invalid API key: ${err}` }, 400);
      }

      await sb.from("bing_integrations").upsert({
        client_id, api_key, site_url,
        status: "connected", error_message: null,
      }, { onConflict: "client_id" });

      return json({ success: true });
    }

    // Load integration
    const { data: integration } = await sb.from("bing_integrations")
      .select("*").eq("client_id", client_id).maybeSingle();
    if (!integration) return json({ error: "Not connected" }, 404);

    const { api_key, site_url } = integration;

    // ── sync ───────────────────────────────────────────────────────────────────
    if (action === "sync") {
      const endDate = new Date();
      const startDate = new Date();
      startDate.setDate(startDate.getDate() - 90);

      const fmt = (d: Date) => `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;

      const parseBingDate = (dateStr: string) => {
        if (!dateStr) return fmt(endDate);
        const match = dateStr.match(/\/Date\((\d+)([+-]\d+)?\)\//);
        if (match) {
          return new Date(parseInt(match[1], 10)).toISOString().split("T")[0];
        }
        return dateStr.split("T")[0];
      };

      const rows: any[] = [];

      // Top queries
      try {
        const queriesData = await bingFetch("GetQueryStats", api_key, {
          siteUrl: site_url,
        });
        const items = queriesData?.d || [];
        for (const item of items) {
          const date = parseBingDate(item.Date);
          rows.push({
            client_id, date,
            query: item.Query,
            page: null,
            clicks: item.Clicks || 0,
            impressions: item.Impressions || 0,
            ctr: item.Impressions > 0 ? (item.Clicks / item.Impressions) : 0,
            position: item.AvgClickPosition || item.AvgImpressionPosition || 0,
          });
        }
      } catch (e) { console.warn("[bing-seo] GetQueryStats:", e); }

      // Top pages
      try {
        const pagesData = await bingFetch("GetPageStats", api_key, {
          siteUrl: site_url,
        });
        const items = pagesData?.d || [];
        for (const item of items) {
          const date = parseBingDate(item.Date);
          rows.push({
            client_id, date,
            query: null,
            page: item.Query || item.Url, // fallback
            clicks: item.Clicks || 0,
            impressions: item.Impressions || 0,
            ctr: item.Impressions > 0 ? (item.Clicks / item.Impressions) : 0,
            position: item.AvgClickPosition || item.AvgImpressionPosition || 0,
          });
        }
      } catch (e) { console.warn("[bing-seo] GetPageStats:", e); }

      if (rows.length > 0) {
        const batchSize = 500;
        for (let i = 0; i < rows.length; i += batchSize) {
          await sb.from("bing_search_data").upsert(rows.slice(i, i + batchSize), {
            onConflict: "client_id,date,query,page",
            ignoreDuplicates: false,
          });
        }
      }

      await sb.from("bing_integrations").update({ last_synced_at: new Date().toISOString() })
        .eq("client_id", client_id);

      return json({ success: true, rows_synced: rows.length });
    }

    // ── get_data ───────────────────────────────────────────────────────────────
    if (action === "get_data") {
      const { days = 28 } = body;
      const since = new Date();
      since.setDate(since.getDate() - days);

      const { data: rows } = await sb.from("bing_search_data")
        .select("*")
        .eq("client_id", client_id)
        .gte("date", since.toISOString().split("T")[0])
        .order("date", { ascending: false })
        .limit(5000);

      return json({ rows: rows || [] });
    }

    // ── disconnect ─────────────────────────────────────────────────────────────
    if (action === "disconnect") {
      await sb.from("bing_integrations").update({
        status: "disconnected", api_key: null,
      }).eq("client_id", client_id);
      await sb.from("bing_search_data").delete().eq("client_id", client_id);
      return json({ success: true });
    }

    return json({ error: "Unknown action" }, 400);
  } catch (err) {
    console.error("[bing-seo]", err);
    return json({ error: String(err) }, 500);
  }
});
