// @ts-nocheck
/**
 * Google Search Console Proxy Edge Function
 * Handles OAuth, site listing, and search analytics data fetching + caching.
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
const GOOGLE_CLIENT_ID = Deno.env.get("GOOGLE_CLIENT_ID") || "";
const GOOGLE_CLIENT_SECRET = Deno.env.get("GOOGLE_CLIENT_SECRET") || "";

function json(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

async function refreshAccessToken(refreshToken: string): Promise<{ access_token: string; expiry: Date }> {
  const res = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      client_id: GOOGLE_CLIENT_ID,
      client_secret: GOOGLE_CLIENT_SECRET,
      refresh_token: refreshToken,
      grant_type: "refresh_token",
    }),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error_description || "Token refresh failed");
  return {
    access_token: data.access_token,
    expiry: new Date(Date.now() + (data.expires_in - 60) * 1000),
  };
}

async function getValidToken(sb: any, clientId: string, integration: any): Promise<string> {
  const expiry = integration.token_expiry ? new Date(integration.token_expiry) : new Date(0);
  if (expiry > new Date() && integration.access_token) return integration.access_token;

  // Refresh
  const { access_token, expiry: newExpiry } = await refreshAccessToken(integration.refresh_token);
  await sb.from("gsc_integrations").update({
    access_token,
    token_expiry: newExpiry.toISOString(),
  }).eq("client_id", clientId);

  return access_token;
}

serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const authHeader = req.headers.get("Authorization") || "";
    const userToken = authHeader.replace("Bearer ", "");
    const sb = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);

    // Validate user
    const { data: { user }, error: authErr } = await createClient(SUPABASE_URL, SUPABASE_ANON_KEY)
      .auth.getUser(userToken);
    if (authErr || !user) return json({ error: "Unauthorized" }, 401);

    const body = await req.json();
    const { action, client_id } = body;
    if (!action || !client_id) return json({ error: "action and client_id required" }, 400);

    // ── exchange_code ──────────────────────────────────────────────────────────
    if (action === "exchange_code") {
      const { code, redirect_uri } = body;
      const tokenRes = await fetch("https://oauth2.googleapis.com/token", {
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
        body: new URLSearchParams({
          code,
          client_id: GOOGLE_CLIENT_ID,
          client_secret: GOOGLE_CLIENT_SECRET,
          redirect_uri,
          grant_type: "authorization_code",
        }),
      });
      const tokens = await tokenRes.json();
      if (!tokenRes.ok) return json({ error: tokens.error_description || "Token exchange failed" }, 400);

      // Get user email
      const profileRes = await fetch("https://www.googleapis.com/oauth2/v2/userinfo", {
        headers: { Authorization: `Bearer ${tokens.access_token}` },
      });
      const profile = await profileRes.json();
      const expiry = new Date(Date.now() + (tokens.expires_in - 60) * 1000);

      await sb.from("gsc_integrations").upsert({
        client_id,
        user_id: user.id,
        connected_email: profile.email,
        access_token: tokens.access_token,
        refresh_token: tokens.refresh_token,
        token_expiry: expiry.toISOString(),
        status: "pending",
        error_message: null,
      }, { onConflict: "client_id" });

      return json({ success: true, email: profile.email });
    }

    // Load integration for remaining actions
    const { data: integration } = await sb.from("gsc_integrations")
      .select("*").eq("client_id", client_id).maybeSingle();
    if (!integration) return json({ error: "Not connected" }, 404);

    // ── list_sites ─────────────────────────────────────────────────────────────
    if (action === "list_sites") {
      const token = await getValidToken(sb, client_id, integration);
      const res = await fetch("https://www.googleapis.com/webmasters/v3/sites", {
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await res.json();
      if (!res.ok) return json({ error: data.error?.message || "Failed to list sites" }, 400);
      return json({ sites: data.siteEntry || [] });
    }

    // ── select_site ────────────────────────────────────────────────────────────
    if (action === "select_site") {
      const { site_url, site_name } = body;
      await sb.from("gsc_integrations").update({
        site_url, site_name, status: "connected", error_message: null,
      }).eq("client_id", client_id);
      return json({ success: true });
    }

    // ── sync ───────────────────────────────────────────────────────────────────
    if (action === "sync") {
      if (!integration.site_url) return json({ error: "No site selected" }, 400);
      const token = await getValidToken(sb, client_id, integration);

      const endDate = new Date();
      const startDate = new Date();
      startDate.setDate(startDate.getDate() - 90); // last 90 days

      const fmt = (d: Date) => d.toISOString().split("T")[0];

      // Fetch top queries
      const queryRes = await fetch(
        `https://www.googleapis.com/webmasters/v3/sites/${encodeURIComponent(integration.site_url)}/searchAnalytics/query`,
        {
          method: "POST",
          headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
          body: JSON.stringify({
            startDate: fmt(startDate),
            endDate: fmt(endDate),
            dimensions: ["query", "date"],
            rowLimit: 5000,
          }),
        }
      );
      const queryData = await queryRes.json();

      // Fetch top pages
      const pageRes = await fetch(
        `https://www.googleapis.com/webmasters/v3/sites/${encodeURIComponent(integration.site_url)}/searchAnalytics/query`,
        {
          method: "POST",
          headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
          body: JSON.stringify({
            startDate: fmt(startDate),
            endDate: fmt(endDate),
            dimensions: ["page", "date"],
            rowLimit: 2000,
          }),
        }
      );
      const pageData = await pageRes.json();

      // Fetch by country
      const countryRes = await fetch(
        `https://www.googleapis.com/webmasters/v3/sites/${encodeURIComponent(integration.site_url)}/searchAnalytics/query`,
        {
          method: "POST",
          headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
          body: JSON.stringify({
            startDate: fmt(startDate),
            endDate: fmt(endDate),
            dimensions: ["country", "date"],
            rowLimit: 500,
          }),
        }
      );
      const countryData = await countryRes.json();

      // Upsert all rows
      const rows: any[] = [];

      for (const row of queryData.rows || []) {
        rows.push({
          client_id,
          date: row.keys[1],
          query: row.keys[0],
          page: null,
          country: null,
          device: null,
          clicks: row.clicks,
          impressions: row.impressions,
          ctr: row.ctr,
          position: row.position,
        });
      }
      for (const row of pageData.rows || []) {
        rows.push({
          client_id,
          date: row.keys[1],
          query: null,
          page: row.keys[0],
          country: null,
          device: null,
          clicks: row.clicks,
          impressions: row.impressions,
          ctr: row.ctr,
          position: row.position,
        });
      }
      for (const row of countryData.rows || []) {
        rows.push({
          client_id,
          date: row.keys[1],
          query: null,
          page: null,
          country: row.keys[0],
          device: null,
          clicks: row.clicks,
          impressions: row.impressions,
          ctr: row.ctr,
          position: row.position,
        });
      }

      // Batch upsert
      if (rows.length > 0) {
        const batchSize = 500;
        for (let i = 0; i < rows.length; i += batchSize) {
          await sb.from("gsc_search_data").upsert(rows.slice(i, i + batchSize), {
            onConflict: "client_id,date,query,page,country,device",
            ignoreDuplicates: false,
          });
        }
      }

      await sb.from("gsc_integrations").update({ last_synced_at: new Date().toISOString() })
        .eq("client_id", client_id);

      return json({
        success: true,
        rows_synced: rows.length,
        queries: queryData.rows?.length || 0,
        pages: pageData.rows?.length || 0,
      });
    }

    // ── get_data ───────────────────────────────────────────────────────────────
    if (action === "get_data") {
      const { days = 28 } = body;
      const since = new Date();
      since.setDate(since.getDate() - days);

      const { data: rows } = await sb.from("gsc_search_data")
        .select("*")
        .eq("client_id", client_id)
        .gte("date", since.toISOString().split("T")[0])
        .order("date", { ascending: false })
        .limit(10000);

      return json({ rows: rows || [] });
    }

    // ── disconnect ─────────────────────────────────────────────────────────────
    if (action === "disconnect") {
      await sb.from("gsc_integrations").update({
        status: "disconnected", access_token: null, refresh_token: null,
        site_url: null, site_name: null,
      }).eq("client_id", client_id);
      await sb.from("gsc_search_data").delete().eq("client_id", client_id);
      return json({ success: true });
    }

    return json({ error: "Unknown action" }, 400);
  } catch (err) {
    console.error("[gsc-proxy]", err);
    return json({ error: String(err) }, 500);
  }
});
