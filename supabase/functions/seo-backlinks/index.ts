// @ts-nocheck
/**
 * SEO Backlinks Edge Function
 * Handles: backlink_profile, backlink_list, toxic_check
 * Uses DataForSEO Backlinks API
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
const DATAFORSEO_API = "https://api.dataforseo.com/v3";
const DATAFORSEO_LOGIN = Deno.env.get("DATAFORSEO_LOGIN") || "";
const DATAFORSEO_PASSWORD = Deno.env.get("DATAFORSEO_PASSWORD") || "";
const DATAFORSEO_AUTH = btoa(`${DATAFORSEO_LOGIN}:${DATAFORSEO_PASSWORD}`);

function json(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

async function callDFS(endpoint: string, payload: unknown[]) {
  if (!DATAFORSEO_LOGIN || !DATAFORSEO_PASSWORD) {
    throw new Error("DataForSEO credentials not configured");
  }
  const res = await fetch(`${DATAFORSEO_API}${endpoint}`, {
    method: "POST",
    headers: {
      Authorization: `Basic ${DATAFORSEO_AUTH}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(payload),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data?.status_message || `HTTP ${res.status}`);
  return data;
}

serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const sb = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);

    const body = await req.json();
    const { action, client_id } = body;
    if (!action || !client_id) return json({ error: "action and client_id required" }, 400);

    // ── backlink_profile ────────────────────────────────────────────────────
    if (action === "backlink_profile") {
      const { target_domain } = body;
      if (!target_domain) return json({ error: "target_domain required" }, 400);

      const domain = new URL(target_domain).hostname;

      // Get summary
      const summaryRes = await callDFS("/backlinks/summary/live", [{
        target: domain,
        internal_list_limit: 0,
        include_subdomains: true,
      }]);

      const summary = summaryRes?.tasks?.[0]?.result?.[0] || {};

      // Get referring domains for authority distribution
      const refDomainsRes = await callDFS("/backlinks/referring_domains/live", [{
        target: domain,
        include_subdomains: true,
        limit: 100,
        order_by: ["rank,desc"],
      }]);

      const refDomains = refDomainsRes?.tasks?.[0]?.result?.[0]?.items || [];

      // Calculate authority distribution
      const authDist = [
        { range: "0-10", count: 0 }, { range: "11-20", count: 0 },
        { range: "21-30", count: 0 }, { range: "31-40", count: 0 },
        { range: "41-50", count: 0 }, { range: "51-60", count: 0 },
        { range: "61-70", count: 0 }, { range: "71-80", count: 0 },
        { range: "81-90", count: 0 }, { range: "91-100", count: 0 },
      ];

      for (const rd of refDomains) {
        const rank = rd.rank || 0;
        const idx = Math.min(9, Math.floor(rank / 10));
        authDist[idx].count++;
      }

      // Get top anchors
      const anchorsRes = await callDFS("/backlinks/anchors/live", [{
        target: domain,
        include_subdomains: true,
        limit: 20,
        order_by: ["backlinks,desc"],
      }]);

      const anchors = (anchorsRes?.tasks?.[0]?.result?.[0]?.items || []).map((a: any) => ({
        anchor: a.anchor || "(empty)",
        count: a.backlinks || 0,
      }));

      const profile = {
        totalBacklinks: summary.backlinks || 0,
        referringDomains: summary.referring_domains || 0,
        domainAuthority: summary.rank || 0,
        newBacklinks30d: summary.new_backlinks_30d || summary.backlinks_spam_score || 0,
        lostBacklinks30d: summary.lost_backlinks_30d || 0,
        followLinks: summary.dofollow || 0,
        nofollowLinks: (summary.backlinks || 0) - (summary.dofollow || 0),
        topAnchors: anchors,
        authorityDistribution: authDist,
        fetchedAt: new Date().toISOString(),
      };

      // Cache
      await sb.from("seo_site_audit").upsert({
        client_id,
        audit_type: "backlink_profile",
        data: profile,
        fetched_at: new Date().toISOString(),
      }, { onConflict: "client_id,audit_type" });

      return json(profile);
    }

    // ── backlink_list ───────────────────────────────────────────────────────
    if (action === "backlink_list") {
      const { target_domain, limit = 100 } = body;
      if (!target_domain) return json({ error: "target_domain required" }, 400);

      const domain = new URL(target_domain).hostname;

      const result = await callDFS("/backlinks/backlinks/live", [{
        target: domain,
        include_subdomains: true,
        limit: Math.min(limit, 200),
        order_by: ["rank,desc"],
        mode: "as_is",
      }]);

      const items = (result?.tasks?.[0]?.result?.[0]?.items || []).map((item: any) => ({
        sourceUrl: item.url_from || "",
        sourceDomain: item.domain_from || "",
        targetUrl: item.url_to || "",
        anchorText: item.anchor || "",
        domainRating: item.domain_from_rank || 0,
        isFollow: item.dofollow ?? true,
        firstSeen: item.first_seen || "",
        lastSeen: item.last_seen || "",
      }));

      return json({ backlinks: items, total: result?.tasks?.[0]?.result?.[0]?.total_count || 0 });
    }

    // ── toxic_check ─────────────────────────────────────────────────────────
    if (action === "toxic_check") {
      const { target_domain } = body;
      if (!target_domain) return json({ error: "target_domain required" }, 400);

      const domain = new URL(target_domain).hostname;

      const result = await callDFS("/backlinks/referring_domains/live", [{
        target: domain,
        include_subdomains: true,
        limit: 200,
        order_by: ["backlinks,desc"],
      }]);

      const items = result?.tasks?.[0]?.result?.[0]?.items || [];

      const toxicDomains = items
        .map((item: any) => {
          const rank = item.rank || 0;
          const backlinks = item.backlinks || 0;
          const reasons: string[] = [];
          let toxicScore = 0;

          // Low authority (< 10)
          if (rank < 10) { toxicScore += 30; reasons.push("Very low domain authority"); }
          else if (rank < 20) { toxicScore += 15; reasons.push("Low domain authority"); }

          // Excessive outgoing links ratio
          if (item.external_links_count > 1000 && backlinks < 10) {
            toxicScore += 25;
            reasons.push("Potential link farm (high outgoing links)");
          }

          // Spam indicators
          if (item.is_free_host) { toxicScore += 20; reasons.push("Free hosting platform"); }

          // Generic penalty for very high backlink count from single domain
          if (backlinks > 50) { toxicScore += 10; reasons.push("Excessive links from single domain"); }

          return {
            domain: item.domain || "",
            domainRating: rank,
            backlinks,
            toxicScore: Math.min(100, toxicScore),
            reasons,
            isFollow: item.dofollow ?? true,
          };
        })
        .filter((d: any) => d.toxicScore >= 30)
        .sort((a: any, b: any) => b.toxicScore - a.toxicScore);

      return json({ toxicDomains, total: toxicDomains.length });
    }

    // ── get_cached_backlinks ────────────────────────────────────────────────
    if (action === "get_cached") {
      const { data } = await sb.from("seo_site_audit")
        .select("*")
        .eq("client_id", client_id)
        .eq("audit_type", "backlink_profile")
        .maybeSingle();
      return json(data?.data || null);
    }

    return json({ error: "Unknown action" }, 400);
  } catch (err) {
    console.error("[seo-backlinks]", err);
    return json({ error: String(err) }, 500);
  }
});
