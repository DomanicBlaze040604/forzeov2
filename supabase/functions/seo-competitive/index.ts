// @ts-nocheck
/**
 * SEO Competitive Intelligence Edge Function
 * Handles: keyword_gap, serp_features, rank_check
 * Uses DataForSEO API
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
    const authHeader = req.headers.get("Authorization") || "";
    const userToken = authHeader.replace("Bearer ", "");
    const sb = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);

    const { data: { user }, error: authErr } = await createClient(SUPABASE_URL, SUPABASE_ANON_KEY)
      .auth.getUser(userToken);
    if (authErr || !user) return json({ error: "Unauthorized" }, 401);

    const body = await req.json();
    const { action, client_id } = body;
    if (!action || !client_id) return json({ error: "action and client_id required" }, 400);

    // ── keyword_gap ─────────────────────────────────────────────────────────
    if (action === "keyword_gap") {
      const { your_domain, competitor_domains, location_code = 2840, language_code = "en" } = body;
      if (!your_domain || !competitor_domains?.length) {
        return json({ error: "your_domain and competitor_domains required" }, 400);
      }

      const targets = {};
      targets[your_domain] = { target: your_domain };
      competitor_domains.slice(0, 3).forEach((d: string, i: number) => {
        targets[d] = { target: d };
      });

      const result = await callDFS("/dataforseo_labs/google/domain_intersection/live", [{
        targets,
        location_code,
        language_code,
        limit: 100,
        order_by: ["first_domain_serp_element.keyword_data.keyword_info.search_volume,desc"],
        filters: [
          ["first_domain_serp_element.serp_element.rank_absolute", ">", 10],
          "or",
          ["first_domain_serp_element.serp_element.rank_absolute", "=", null]
        ],
      }]);

      const items = result?.tasks?.[0]?.result?.[0]?.items || [];
      const gaps = items.map((item: any) => {
        const kw = item.keyword_data?.keyword || "";
        const sv = item.keyword_data?.keyword_info?.search_volume || 0;
        const diff = item.keyword_data?.keyword_info?.keyword_difficulty || 0;
        const yourRank = item.first_domain_serp_element?.serp_element?.rank_absolute || null;

        // Find best competitor rank
        let bestCompRank = 999;
        let bestCompDomain = "";
        for (const cd of competitor_domains) {
          const k = `intersection_result.${cd}.serp_element.rank_absolute`;
          // Items have intersection results
          for (const [key, val] of Object.entries(item)) {
            if (key.includes("domain_serp_element") && key !== "first_domain_serp_element") {
              const rank = (val as any)?.serp_element?.rank_absolute;
              if (rank && rank < bestCompRank) {
                bestCompRank = rank;
                bestCompDomain = cd;
              }
            }
          }
        }

        let category: "missing" | "weak" | "strong" = "missing";
        if (yourRank === null) category = "missing";
        else if (yourRank > 20) category = "weak";
        else category = "strong";

        return {
          keyword: kw,
          searchVolume: sv,
          difficulty: diff,
          yourPosition: yourRank,
          competitorPosition: bestCompRank < 999 ? bestCompRank : null,
          competitorDomain: bestCompDomain,
          category,
        };
      });

      return json({ gaps, total: gaps.length });
    }

    // ── serp_features ───────────────────────────────────────────────────────
    if (action === "serp_features") {
      const { keywords, location_code = 2840, language_code = "en" } = body;
      if (!keywords?.length) return json({ error: "keywords array required" }, 400);

      const results = [];
      // Batch queries (max 10 at a time)
      for (const keyword of keywords.slice(0, 20)) {
        try {
          const serpResult = await callDFS("/serp/google/organic/live/regular", [{
            keyword,
            location_code,
            language_code,
            device: "desktop",
            depth: 10,
          }]);

          const items = serpResult?.tasks?.[0]?.result?.[0]?.items || [];
          const features = new Set<string>();

          for (const item of items) {
            if (item.type === "featured_snippet") features.add("featured_snippet");
            if (item.type === "people_also_ask") features.add("people_also_ask");
            if (item.type === "local_pack") features.add("local_pack");
            if (item.type === "knowledge_graph") features.add("knowledge_graph");
            if (item.type === "video") features.add("video");
            if (item.type === "images") features.add("images");
            if (item.type === "shopping") features.add("shopping");
            if (item.type === "top_stories") features.add("top_stories");
            if (item.type === "twitter") features.add("twitter");
            if (item.type === "related_searches") features.add("related_searches");
          }

          const organicItems = items.filter((i: any) => i.type === "organic");
          const yourItem = organicItems.find((i: any) =>
            body.site_url && i.url?.includes(new URL(body.site_url).hostname)
          );

          results.push({
            query: keyword,
            features: Array.from(features),
            yourUrl: yourItem?.url || null,
            position: yourItem?.rank_absolute || null,
            hasFeature: features.size > 0,
          });
        } catch (e) {
          results.push({
            query: keyword,
            features: [],
            yourUrl: null,
            position: null,
            hasFeature: false,
          });
        }
      }

      return json({ results });
    }

    // ── rank_check ──────────────────────────────────────────────────────────
    if (action === "rank_check") {
      const { keywords, site_url, location_code = 2840, language_code = "en" } = body;
      if (!keywords?.length || !site_url) return json({ error: "keywords and site_url required" }, 400);

      const hostname = new URL(site_url).hostname;
      const results = [];

      for (const keyword of keywords.slice(0, 30)) {
        try {
          const serpResult = await callDFS("/serp/google/organic/live/regular", [{
            keyword,
            location_code,
            language_code,
            device: "desktop",
            depth: 100,
          }]);

          const items = serpResult?.tasks?.[0]?.result?.[0]?.items || [];
          const organicItems = items.filter((i: any) => i.type === "organic");
          const match = organicItems.find((i: any) => i.url?.includes(hostname));

          results.push({
            keyword,
            position: match?.rank_absolute || null,
            url: match?.url || null,
            title: match?.title || null,
            searchVolume: serpResult?.tasks?.[0]?.result?.[0]?.search_volume || 0,
          });
        } catch {
          results.push({ keyword, position: null, url: null, title: null, searchVolume: 0 });
        }
      }

      // Save to rank tracking table
      const now = new Date().toISOString().split("T")[0];
      for (const r of results) {
        if (r.position !== null) {
          await sb.from("seo_rank_tracking").upsert({
            client_id,
            keyword: r.keyword,
            date: now,
            position: r.position,
            url: r.url,
            search_volume: r.searchVolume,
          }, { onConflict: "client_id,keyword,date" });
        }
      }

      return json({ results });
    }

    // ── get_rank_history ────────────────────────────────────────────────────
    if (action === "get_rank_history") {
      const { data: rows } = await sb.from("seo_rank_tracking")
        .select("*")
        .eq("client_id", client_id)
        .order("date", { ascending: true })
        .limit(5000);
      return json({ rows: rows || [] });
    }

    // ── save_tracked_keywords ───────────────────────────────────────────────
    if (action === "save_tracked_keywords") {
      const { keywords } = body;
      if (!keywords?.length) return json({ error: "keywords required" }, 400);

      for (const kw of keywords) {
        await sb.from("seo_rank_tracking").upsert({
          client_id,
          keyword: kw,
          date: new Date().toISOString().split("T")[0],
          position: null,
          url: null,
        }, { onConflict: "client_id,keyword,date" });
      }
      return json({ success: true });
    }

    return json({ error: "Unknown action" }, 400);
  } catch (err) {
    console.error("[seo-competitive]", err);
    return json({ error: String(err) }, 500);
  }
});
