// @ts-nocheck
/**
 * SEO Tools Edge Function
 * Handles: core_web_vitals, sitemap_audit, meta_audit, content_score, internal_links
 */

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { DOMParser } from "https://deno.land/x/deno_dom@v0.1.38/deno-dom-wasm.ts";

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
const CRUX_API_KEY = Deno.env.get("GOOGLE_CRUX_API_KEY") || Deno.env.get("GOOGLE_API_KEY") || "";

function json(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

function normalizeUrl(urlStr: string): string {
  if (urlStr.startsWith("sc-domain:")) {
    return `https://${urlStr.replace("sc-domain:", "")}`;
  }
  if (!urlStr.startsWith("http")) {
    return `https://${urlStr}`;
  }
  return urlStr;
}

async function getGSCToken(sb: any, clientId: string): Promise<string | null> {
  const { data: integration } = await sb.from("gsc_integrations")
    .select("*").eq("client_id", clientId).maybeSingle();
  if (!integration?.refresh_token) return null;

  const expiry = integration.token_expiry ? new Date(integration.token_expiry) : new Date(0);
  if (expiry > new Date() && integration.access_token) return integration.access_token;

  // Refresh token
  const res = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      client_id: GOOGLE_CLIENT_ID,
      client_secret: GOOGLE_CLIENT_SECRET,
      refresh_token: integration.refresh_token,
      grant_type: "refresh_token",
    }),
  });
  const data = await res.json();
  if (!res.ok) return null;

  await sb.from("gsc_integrations").update({
    access_token: data.access_token,
    token_expiry: new Date(Date.now() + (data.expires_in - 60) * 1000).toISOString(),
  }).eq("client_id", clientId);

  return data.access_token;
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

    // ── core_web_vitals ─────────────────────────────────────────────────────
    if (action === "core_web_vitals") {
      const { site_url } = body;
      if (!site_url) return json({ error: "site_url required" }, 400);

      // Use Chrome UX Report API
      const origin = new URL(normalizeUrl(site_url)).origin;
      const cruxUrl = `https://chromeuxreport.googleapis.com/v1/records:queryRecord${CRUX_API_KEY ? `?key=${CRUX_API_KEY}` : ""}`;

      const cruxRes = await fetch(cruxUrl, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ origin, formFactor: "PHONE" }),
      });

      let cwv = { lcp: null, fid: null, inp: null, cls: null, ttfb: null };

      if (cruxRes.ok) {
        const cruxData = await cruxRes.json();
        const metrics = cruxData?.record?.metrics || {};

        if (metrics.largest_contentful_paint) {
          cwv.lcp = metrics.largest_contentful_paint.percentiles?.p75 || null;
        }
        if (metrics.first_input_delay) {
          cwv.fid = metrics.first_input_delay.percentiles?.p75 || null;
        }
        if (metrics.interaction_to_next_paint) {
          cwv.inp = metrics.interaction_to_next_paint.percentiles?.p75 || null;
        }
        if (metrics.cumulative_layout_shift) {
          cwv.cls = metrics.cumulative_layout_shift.percentiles?.p75 || null;
        }
        if (metrics.experimental_time_to_first_byte) {
          cwv.ttfb = metrics.experimental_time_to_first_byte.percentiles?.p75 || null;
        }
      } else {
        const errData = await cruxRes.json().catch(() => ({}));
        if (errData?.error?.status !== "NOT_FOUND") {
          throw new Error(`CrUX API Error (Mobile): ${errData?.error?.message || "Unknown error"}`);
        }
      }

      // Also try desktop
      const cruxDesktop = await fetch(cruxUrl, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ origin, formFactor: "DESKTOP" }),
      });

      let cwvDesktop = { lcp: null, fid: null, inp: null, cls: null, ttfb: null };
      if (cruxDesktop.ok) {
        const dd = await cruxDesktop.json();
        const dm = dd?.record?.metrics || {};
        cwvDesktop.lcp = dm.largest_contentful_paint?.percentiles?.p75 || null;
        cwvDesktop.fid = dm.first_input_delay?.percentiles?.p75 || null;
        cwvDesktop.inp = dm.interaction_to_next_paint?.percentiles?.p75 || null;
        cwvDesktop.cls = dm.cumulative_layout_shift?.percentiles?.p75 || null;
        cwvDesktop.ttfb = dm.experimental_time_to_first_byte?.percentiles?.p75 || null;
      } else {
        const errData = await cruxDesktop.json().catch(() => ({}));
        if (errData?.error?.status !== "NOT_FOUND") {
          throw new Error(`CrUX API Error (Desktop): ${errData?.error?.message || "Unknown error"}`);
        }
      }

      // Cache result
      await sb.from("seo_site_audit").upsert({
        client_id,
        audit_type: "core_web_vitals",
        data: { mobile: cwv, desktop: cwvDesktop },
        fetched_at: new Date().toISOString(),
      }, { onConflict: "client_id,audit_type" });

      return json({ mobile: cwv, desktop: cwvDesktop });
    }

    // ── sitemap_audit ───────────────────────────────────────────────────────
    if (action === "sitemap_audit") {
      const { site_url } = body;
      if (!site_url) return json({ error: "site_url required" }, 400);

      const origin = normalizeUrl(site_url).replace(/\/$/, "");
      const sitemapUrl = `${origin}/sitemap.xml`;

      let result = {
        url: sitemapUrl,
        isValid: false,
        urlCount: 0,
        lastModified: null as string | null,
        errors: [] as string[],
        sampleUrls: [] as string[],
      };

      try {
        const res = await fetch(sitemapUrl, {
          headers: { "User-Agent": "ForzeoSEOBot/1.0" },
        });

        if (!res.ok) {
          result.errors.push(`Sitemap returned HTTP ${res.status}`);
        } else {
          const text = await res.text();
          result.lastModified = res.headers.get("Last-Modified") || null;

          if (text.includes("<sitemapindex")) {
            // Sitemap index — parse child sitemaps
            const locMatches = text.match(/<loc>([^<]+)<\/loc>/g) || [];
            const childUrls = locMatches.map(m => m.replace(/<\/?loc>/g, ""));
            let totalUrls = 0;

            for (const childUrl of childUrls.slice(0, 5)) {
              try {
                const childRes = await fetch(childUrl, {
                  headers: { "User-Agent": "ForzeoSEOBot/1.0" },
                });
                if (childRes.ok) {
                  const childText = await childRes.text();
                  const childLocs = childText.match(/<loc>([^<]+)<\/loc>/g) || [];
                  totalUrls += childLocs.length;
                  if (result.sampleUrls.length < 10) {
                    result.sampleUrls.push(...childLocs.slice(0, 5).map(m => m.replace(/<\/?loc>/g, "")));
                  }
                }
              } catch { /* skip child */ }
            }
            result.urlCount = totalUrls;
            result.isValid = true;
          } else if (text.includes("<urlset")) {
            const locMatches = text.match(/<loc>([^<]+)<\/loc>/g) || [];
            result.urlCount = locMatches.length;
            result.sampleUrls = locMatches.slice(0, 10).map(m => m.replace(/<\/?loc>/g, ""));
            result.isValid = true;
          } else {
            result.errors.push("Not a valid XML sitemap");
          }

          if (result.urlCount === 0 && result.isValid) {
            result.errors.push("Sitemap is empty — no URLs found");
          }
        }
      } catch (err) {
        result.errors.push(`Failed to fetch: ${err}`);
      }

      await sb.from("seo_site_audit").upsert({
        client_id,
        audit_type: "sitemap",
        data: result,
        fetched_at: new Date().toISOString(),
      }, { onConflict: "client_id,audit_type" });

      return json(result);
    }

    // ── meta_audit ──────────────────────────────────────────────────────────
    if (action === "meta_audit") {
      const { urls } = body; // Array of URLs to audit
      if (!urls || !Array.isArray(urls) || urls.length === 0) {
        return json({ error: "urls array required" }, 400);
      }

      const results = [];
      const titleSet = new Map<string, string[]>();

      for (const rawUrl of urls.slice(0, 50)) {
        const url = normalizeUrl(rawUrl);
        try {
          const res = await fetch(url, {
            headers: { "User-Agent": "ForzeoSEOBot/1.0" },
            redirect: "follow",
          });

          if (!res.ok) {
            results.push({
              url, title: null, titleLength: 0,
              description: null, descriptionLength: 0,
              h1: null, h1Count: 0, issues: ["fetch_error"],
            });
            continue;
          }

          const html = await res.text();
          const doc = new DOMParser().parseFromString(html, "text/html");
          if (!doc) {
            results.push({
              url, title: null, titleLength: 0,
              description: null, descriptionLength: 0,
              h1: null, h1Count: 0, issues: ["parse_error"],
            });
            continue;
          }

          const titleEl = doc.querySelector("title");
          const title = titleEl?.textContent?.trim() || null;
          const titleLength = title?.length || 0;

          const metaDesc = doc.querySelector('meta[name="description"]');
          const description = metaDesc?.getAttribute("content")?.trim() || null;
          const descriptionLength = description?.length || 0;

          const h1s = doc.querySelectorAll("h1");
          const h1 = h1s.length > 0 ? (h1s[0] as any)?.textContent?.trim() || null : null;
          const h1Count = h1s.length;

          const issues: string[] = [];
          if (!title) issues.push("missing_title");
          else if (titleLength > 60) issues.push("title_too_long");
          else if (titleLength < 15) issues.push("title_too_short");

          if (!description) issues.push("missing_description");
          else if (descriptionLength > 160) issues.push("desc_too_long");
          else if (descriptionLength < 50) issues.push("desc_too_short");

          if (h1Count === 0) issues.push("missing_h1");
          else if (h1Count > 1) issues.push("multiple_h1");

          // Track duplicates
          if (title) {
            if (!titleSet.has(title)) titleSet.set(title, []);
            titleSet.get(title)!.push(url);
          }

          results.push({ url, title, titleLength, description, descriptionLength, h1, h1Count, issues });
        } catch {
          results.push({
            url, title: null, titleLength: 0,
            description: null, descriptionLength: 0,
            h1: null, h1Count: 0, issues: ["fetch_error"],
          });
        }
      }

      // Mark duplicate titles
      for (const [title, urls] of titleSet.entries()) {
        if (urls.length > 1) {
          for (const r of results) {
            if (r.title === title && !r.issues.includes("duplicate_title")) {
              r.issues.push("duplicate_title");
            }
          }
        }
      }

      await sb.from("seo_site_audit").upsert({
        client_id,
        audit_type: "meta_audit",
        data: { results, fetchedAt: new Date().toISOString() },
        fetched_at: new Date().toISOString(),
      }, { onConflict: "client_id,audit_type" });

      return json({ results });
    }

    // ── index_coverage (uses GSC URL Inspection API) ────────────────────────
    if (action === "index_coverage") {
      const { urls, site_url } = body;
      if (!urls || !site_url) return json({ error: "urls and site_url required" }, 400);

      const token = await getGSCToken(sb, client_id);
      if (!token) return json({ error: "GSC not connected" }, 400);

      const results = [];
      for (const url of urls.slice(0, 30)) {
        try {
          const inspRes = await fetch(
            "https://searchconsole.googleapis.com/v1/urlInspection/index:inspect",
            {
              method: "POST",
              headers: {
                Authorization: `Bearer ${token}`,
                "Content-Type": "application/json",
              },
              body: JSON.stringify({
                inspectionUrl: url,
                siteUrl: site_url,
              }),
            }
          );
          const inspData = await inspRes.json();
          const result = inspData?.inspectionResult?.indexStatusResult;

          let status = "excluded";
          if (result?.coverageState === "Submitted and indexed") status = "submitted_indexed";
          else if (result?.coverageState?.includes("not indexed")) status = "crawled_not_indexed";
          else if (result?.verdict === "ERROR") status = "error";

          results.push({
            url,
            status,
            reason: result?.coverageState || "Unknown",
            lastCrawled: result?.lastCrawlTime || null,
          });
        } catch (err) {
          results.push({ url, status: "error", reason: String(err) });
        }
      }

      const summary = {
        indexed: results.filter(r => r.status === "submitted_indexed").length,
        excluded: results.filter(r => r.status === "excluded" || r.status === "crawled_not_indexed").length,
        error: results.filter(r => r.status === "error").length,
        total: results.length,
        items: results,
      };

      await sb.from("seo_site_audit").upsert({
        client_id,
        audit_type: "index_coverage",
        data: summary,
        fetched_at: new Date().toISOString(),
      }, { onConflict: "client_id,audit_type" });

      return json(summary);
    }

    // ── save_audit ──────────────────────────────────────────────────────────
    if (action === "save_audit") {
      const { audit_type, data: auditData } = body;
      if (!audit_type || !auditData) return json({ error: "audit_type and data required" }, 400);

      await sb.from("seo_site_audit").upsert({
        client_id,
        audit_type,
        data: auditData,
        fetched_at: new Date().toISOString(),
      }, { onConflict: "client_id,audit_type" });

      return json({ success: true });
    }

    // ── get_cached_audit ────────────────────────────────────────────────────
    if (action === "get_cached_audit") {
      const { audit_type } = body;
      const { data } = await sb.from("seo_site_audit")
        .select("*")
        .eq("client_id", client_id)
        .eq("audit_type", audit_type)
        .maybeSingle();
      return json(data || { data: null });
    }

    // ── get_all_audits ──────────────────────────────────────────────────────
    if (action === "get_all_audits") {
      const { data } = await sb.from("seo_site_audit")
        .select("*")
        .eq("client_id", client_id);
      return json({ audits: data || [] });
    }

    return json({ error: "Unknown action" }, 400);
  } catch (err) {
    console.error("[seo-tools]", err);
    return json({ error: String(err) }, 500);
  }
});
