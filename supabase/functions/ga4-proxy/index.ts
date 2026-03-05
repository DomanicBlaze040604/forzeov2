// @ts-nocheck
/**
 * GA4 Proxy Edge Function
 * Handles OAuth token exchange, property listing, and disconnect for the
 * Forzeo GA4 Traffic Connector feature.
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
const GOOGLE_REDIRECT_URI = Deno.env.get("GOOGLE_REDIRECT_URI") || "";

serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const authHeader = req.headers.get("Authorization") || "";
    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);
    const userToken = authHeader.replace("Bearer ", "");

    // Validate user token
    const { data: { user }, error: authErr } = await createClient(SUPABASE_URL, Deno.env.get("SUPABASE_ANON_KEY") || "")
      .auth.getUser(userToken);

    if (authErr || !user) {
      return json({ error: "Unauthorized" }, 401);
    }

    const body = await req.json();
    const { action, client_id } = body;

    if (!action) return json({ error: "action is required" }, 400);
    if (!client_id) return json({ error: "client_id is required" }, 400);

    // ── ACTION: exchange_code ────────────────────────────────────────
    if (action === "exchange_code") {
      const { code, redirect_uri } = body;
      if (!code) return json({ error: "code is required" }, 400);

      // Use redirect_uri from body if provided, otherwise fallback to env var
      const effectiveRedirectUri = redirect_uri || GOOGLE_REDIRECT_URI;

      const tokenRes = await fetch("https://oauth2.googleapis.com/token", {
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
        body: new URLSearchParams({
          code,
          client_id: GOOGLE_CLIENT_ID,
          client_secret: GOOGLE_CLIENT_SECRET,
          redirect_uri: effectiveRedirectUri,
          grant_type: "authorization_code",
        }),
      });

      const tokenData = await tokenRes.json();
      if (tokenData.error) {
        return json({ error: `Google OAuth error: ${tokenData.error_description || tokenData.error}` }, 400);
      }

      const { access_token, refresh_token, expires_in } = tokenData;

      const profileRes = await fetch("https://www.googleapis.com/oauth2/v2/userinfo", {
        headers: { Authorization: `Bearer ${access_token}` },
      });
      const profile = await profileRes.json();
      const connected_email = profile.email || null;

      const expiresAt = new Date(Date.now() + (expires_in || 3600) * 1000).toISOString();

      const { error: dbErr } = await supabase
        .from("ga4_integrations")
        .upsert({
          client_id,
          user_id: user.id,
          access_token,
          refresh_token,
          token_expires_at: expiresAt,
          connected_email,
          status: "pending",
          error_message: null,
        }, { onConflict: "client_id" });

      if (dbErr) return json({ error: dbErr.message }, 500);
      return json({ success: true, connected_email });
    }

    // ── HELPER: get valid token ──────────────────────────────────────
    async function getValidToken(clientId: string): Promise<string | null> {
      const { data: integration } = await supabase
        .from("ga4_integrations")
        .select("access_token, refresh_token, token_expires_at")
        .eq("client_id", clientId)
        .single();

      if (!integration) return null;

      const expiresAt = integration.token_expires_at ? new Date(integration.token_expires_at) : null;
      const needsRefresh = !expiresAt || expiresAt.getTime() < Date.now() + 60_000;

      if (needsRefresh && integration.refresh_token) {
        const refreshRes = await fetch("https://oauth2.googleapis.com/token", {
          method: "POST",
          headers: { "Content-Type": "application/x-www-form-urlencoded" },
          body: new URLSearchParams({
            refresh_token: integration.refresh_token,
            client_id: GOOGLE_CLIENT_ID,
            client_secret: GOOGLE_CLIENT_SECRET,
            grant_type: "refresh_token",
          }),
        });
        const refreshData = await refreshRes.json();
        if (refreshData.access_token) {
          const newExpiry = new Date(Date.now() + (refreshData.expires_in || 3600) * 1000).toISOString();
          await supabase
            .from("ga4_integrations")
            .update({ access_token: refreshData.access_token, token_expires_at: newExpiry })
            .eq("client_id", clientId);
          return refreshData.access_token;
        }
        return null;
      }
      return integration.access_token;
    }

    // ── ACTION: list_properties ──────────────────────────────────────
    if (action === "list_properties") {
      const accessToken = await getValidToken(client_id);
      if (!accessToken) return json({ error: "No valid access token. Please reconnect." }, 401);

      const propRes = await fetch("https://analyticsadmin.googleapis.com/v1beta/accountSummaries", {
        headers: { Authorization: `Bearer ${accessToken}` },
      });
      const propData = await propRes.json();
      if (!propRes.ok) return json({ error: propData.error?.message || "Failed to fetch properties" }, 400);

      const properties = [];
      for (const account of propData.accountSummaries || []) {
        for (const prop of account.propertySummaries || []) {
          properties.push({ id: prop.property, displayName: prop.displayName, accountName: account.displayName });
        }
      }
      return json({ properties });
    }

    // ── ACTION: list_streams ─────────────────────────────────────────
    if (action === "list_streams") {
      const { property_id } = body;
      if (!property_id) return json({ error: "property_id is required" }, 400);

      const accessToken = await getValidToken(client_id);
      if (!accessToken) return json({ error: "No valid access token. Please reconnect." }, 401);

      const streamsRes = await fetch(`https://analyticsadmin.googleapis.com/v1beta/${property_id}/dataStreams`, {
        headers: { Authorization: `Bearer ${accessToken}` }
      });
      const streamsData = await streamsRes.json();
      if (!streamsRes.ok) return json({ error: streamsData.error?.message || "Failed to fetch streams" }, 400);

      const streams = (streamsData.dataStreams || [])
        .filter((s: any) => s.type === "WEB_DATA_STREAM")
        .map((s: any) => ({
          id: s.name,
          displayName: s.displayName || s.webStreamData?.defaultUri || s.name,
          uri: s.webStreamData?.defaultUri,
        }));
      return json({ streams });
    }

    // ── ACTION: save_property ────────────────────────────────────────
    if (action === "save_property") {
      const { property_id, property_name, stream_id, stream_name } = body;
      const { error: dbErr } = await supabase
        .from("ga4_integrations")
        .update({
          ga4_property_id: property_id,
          ga4_property_name: property_name,
          ga4_stream_id: stream_id,
          ga4_stream_name: stream_name,
          status: "connected",
        })
        .eq("client_id", client_id)
        .eq("user_id", user.id);

      if (dbErr) return json({ error: dbErr.message }, 500);
      return json({ success: true });
    }

    // ── ACTION: disconnect ───────────────────────────────────────────
    if (action === "disconnect") {
      const { error: dbErr } = await supabase
        .from("ga4_integrations")
        .delete()
        .eq("client_id", client_id)
        .eq("user_id", user.id);
      if (dbErr) return json({ error: dbErr.message }, 500);
      return json({ success: true });
    }

    // ── ACTION: refresh_sync ─────────────────────────────────────────
    if (action === "refresh_sync") {
      const syncRes = await fetch(`${SUPABASE_URL}/functions/v1/ga4-sync`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${SUPABASE_SERVICE_KEY}`,
        },
        body: JSON.stringify({ client_id }),
      });
      const syncData = await syncRes.json();
      return json(syncData, syncRes.status);
    }

    return json({ error: `Unknown action: ${action}` }, 400);
  } catch (err) {
    console.error("[ga4-proxy] Error:", err);
    return json({ error: String(err) }, 500);
  }
});

function json(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}
