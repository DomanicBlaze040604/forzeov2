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
    const sb = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);

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

    // ── list_tracked_keywords ───────────────────────────────────────────────
    if (action === "list_tracked_keywords") {
      const { data: rows } = await sb.from("seo_tracked_keywords")
        .select("*")
        .eq("client_id", client_id)
        .order("created_at", { ascending: true });
      return json({ keywords: rows || [] });
    }

    // ── add_keywords ────────────────────────────────────────────────────────
    if (action === "add_keywords") {
      const { keywords, tags = [] } = body;
      if (!keywords?.length) return json({ error: "keywords required" }, 400);
      const rows = keywords.map((k: string) => ({ client_id, keyword: k.toLowerCase().trim(), tags }));
      const { error } = await sb.from("seo_tracked_keywords").upsert(rows, { onConflict: "client_id,keyword" });
      if (error) return json({ error: error.message }, 400);
      return json({ added: rows.length });
    }

    // ── remove_keyword ──────────────────────────────────────────────────────
    if (action === "remove_keyword") {
      const { keyword } = body;
      if (!keyword) return json({ error: "keyword required" }, 400);
      await sb.from("seo_tracked_keywords").delete().eq("client_id", client_id).eq("keyword", keyword);
      await sb.from("seo_rank_tracking").delete().eq("client_id", client_id).eq("keyword", keyword);
      return json({ removed: true });
    }

    // ── rank_check ──────────────────────────────────────────────────────────
    if (action === "rank_check") {
      const {
        keywords,
        site_url,
        competitor_domains = [],
        location_code = 2840,
        language_code = "en",
      } = body;
      if (!keywords?.length || !site_url) return json({ error: "keywords and site_url required" }, 400);

      const hostname = (() => {
        try { return new URL(site_url.startsWith("http") ? site_url : `https://${site_url}`).hostname; }
        catch { return site_url; }
      })();
      const competitorHostnames = competitor_domains.map((d: string) => {
        try { return new URL(d.startsWith("http") ? d : `https://${d}`).hostname; }
        catch { return d; }
      });

      const results: any[] = [];
      const now = new Date().toISOString().split("T")[0];

      for (const keyword of keywords.slice(0, 50)) {
        try {
          const serpResult = await callDFS("/serp/google/organic/live/regular", [{
            keyword,
            location_code,
            language_code,
            device: "desktop",
            depth: 100,
          }]);

          const taskResult = serpResult?.tasks?.[0]?.result?.[0];
          const items = taskResult?.items || [];
          const organicItems = items.filter((i: any) => i.type === "organic");

          // Our position
          const match = organicItems.find((i: any) => i.domain?.includes(hostname) || i.url?.includes(hostname));

          // Competitor positions
          const competitorPositions = competitorHostnames.map((ch: string, idx: number) => {
            const compMatch = organicItems.find((i: any) => i.domain?.includes(ch) || i.url?.includes(ch));
            return {
              domain: competitor_domains[idx],
              position: compMatch?.rank_absolute || null,
              url: compMatch?.url || null,
              title: compMatch?.title || null,
            };
          });

          // SERP features
          const features: string[] = [];
          for (const item of items) {
            if (item.type === "featured_snippet" && !features.includes("featured_snippet")) features.push("featured_snippet");
            if (item.type === "people_also_ask" && !features.includes("people_also_ask")) features.push("people_also_ask");
            if (item.type === "local_pack" && !features.includes("local_pack")) features.push("local_pack");
            if (item.type === "knowledge_graph" && !features.includes("knowledge_graph")) features.push("knowledge_graph");
            if (item.type === "video" && !features.includes("video")) features.push("video");
            if (item.type === "images" && !features.includes("images")) features.push("images");
            if (item.type === "shopping" && !features.includes("shopping")) features.push("shopping");
          }

          const row = {
            keyword,
            position: match?.rank_absolute || null,
            url: match?.url || null,
            title: match?.title || null,
            searchVolume: taskResult?.search_volume || 0,
            competitors: competitorPositions,
            serpFeatures: features,
          };
          results.push(row);

          // Upsert to DB (always save, even position=null so we know it's not ranking)
          await sb.from("seo_rank_tracking").upsert({
            client_id,
            keyword,
            date: now,
            position: row.position,
            url: row.url,
            title: row.title,
            search_volume: row.searchVolume,
            competitors: row.competitors,
            serp_features: row.serpFeatures,
          }, { onConflict: "client_id,keyword,date" });

        } catch (e) {
          results.push({ keyword, position: null, url: null, title: null, searchVolume: 0, competitors: [], serpFeatures: [] });
        }
      }

      return json({ results, checked_at: now });
    }

    // ── get_rank_history ────────────────────────────────────────────────────
    if (action === "get_rank_history") {
      const { keyword } = body;
      const query = sb.from("seo_rank_tracking")
        .select("keyword,date,position,url,competitors,serp_features,search_volume")
        .eq("client_id", client_id)
        .order("date", { ascending: true })
        .limit(5000);
      if (keyword) query.eq("keyword", keyword);
      const { data: rows } = await query;
      return json({ rows: rows || [] });
    }

    // ── get_latest_positions ────────────────────────────────────────────────
    // Returns the most recent row per keyword (today or last checked)
    if (action === "get_latest_positions") {
      // Get distinct latest date per keyword
      const { data: rows } = await sb.from("seo_rank_tracking")
        .select("*")
        .eq("client_id", client_id)
        .order("date", { ascending: false })
        .limit(1000);

      if (!rows) return json({ positions: [] });

      // Keep only latest row per keyword
      const seen = new Set<string>();
      const latest = rows.filter(r => {
        if (seen.has(r.keyword)) return false;
        seen.add(r.keyword);
        return true;
      });

      // Also get yesterday's row for delta
      const yesterday = new Date();
      yesterday.setDate(yesterday.getDate() - 1);
      const yd = yesterday.toISOString().split("T")[0];

      const { data: prevRows } = await sb.from("seo_rank_tracking")
        .select("keyword,position,date")
        .eq("client_id", client_id)
        .lte("date", yd)
        .order("date", { ascending: false })
        .limit(1000);

      const prevMap: Record<string, number | null> = {};
      const seenPrev = new Set<string>();
      for (const r of (prevRows || [])) {
        if (!seenPrev.has(r.keyword)) {
          prevMap[r.keyword] = r.position;
          seenPrev.add(r.keyword);
        }
      }

      const positions = latest.map(r => ({
        ...r,
        previous_position: prevMap[r.keyword] ?? null,
        change: (prevMap[r.keyword] != null && r.position != null)
          ? prevMap[r.keyword]! - r.position  // positive = improved (moved up)
          : null,
      }));

      return json({ positions });
    }

    // ── save_tracked_keywords (legacy) ──────────────────────────────────────
    if (action === "save_tracked_keywords") {
      const { keywords } = body;
      if (!keywords?.length) return json({ error: "keywords required" }, 400);
      const rows = keywords.map((k: string) => ({ client_id, keyword: k.toLowerCase().trim(), tags: [] }));
      await sb.from("seo_tracked_keywords").upsert(rows, { onConflict: "client_id,keyword" });
      return json({ success: true });
    }

    return json({ error: "Unknown action" }, 400);
  } catch (err) {
    console.error("[seo-competitive]", err);
    return json({ error: String(err) }, 500);
  }
});
