// @ts-nocheck
/**
 * AI Search Volume Edge Function
 *
 * Fetches estimated AI search volume from DataForSEO's
 * ai_optimization/ai_keyword_data/keywords_search_volume/live endpoint.
 *
 * Accepts: { keywords: string[], location_code: number, language_name: string }
 * Returns: { results: Array<{ keyword: string, ai_search_volume: number | null }> }
 */

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const DATAFORSEO_LOGIN = Deno.env.get("DATAFORSEO_LOGIN") || "";
const DATAFORSEO_PASSWORD = Deno.env.get("DATAFORSEO_PASSWORD") || "";
const DATAFORSEO_AUTH = btoa(`${DATAFORSEO_LOGIN}:${DATAFORSEO_PASSWORD}`);

serve(async (req) => {
  // Handle CORS preflight
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const { keywords, location_code = 2840, language_name = "English" } = await req.json();

    if (!keywords || !Array.isArray(keywords) || keywords.length === 0) {
      return new Response(
        JSON.stringify({ error: "keywords array is required" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if (!DATAFORSEO_LOGIN || !DATAFORSEO_PASSWORD) {
      return new Response(
        JSON.stringify({ error: "DataForSEO credentials not configured" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Lowercase all keywords (API requirement)
    const cleanedKeywords = keywords
      .slice(0, 1000) // Max 1000 per request
      .map((k: string) => k.toLowerCase().trim())
      .filter((k: string) => k.length > 0);

    if (cleanedKeywords.length === 0) {
      return new Response(
        JSON.stringify({ results: [] }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Call DataForSEO AI Keyword Search Volume API
    const response = await fetch(
      "https://api.dataforseo.com/v3/ai_optimization/ai_keyword_data/keywords_search_volume/live",
      {
        method: "POST",
        headers: {
          "Authorization": `Basic ${DATAFORSEO_AUTH}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify([
          {
            keywords: cleanedKeywords,
            location_code: location_code,
            language_name: language_name,
          },
        ]),
      }
    );

    if (!response.ok) {
      const errorText = await response.text();
      console.error("DataForSEO API error:", response.status, errorText);
      return new Response(
        JSON.stringify({ error: `DataForSEO API error: ${response.status}` }),
        { status: 502, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const data = await response.json();

    // Parse results from DataForSEO response structure:
    // data.tasks[].result[].items[] -> { keyword, ai_search_volume }
    const results: Array<{ keyword: string; ai_search_volume: number | null }> = [];

    if (data?.tasks) {
      for (const task of data.tasks) {
        if (task?.result) {
          for (const result of task.result) {
            if (result?.items) {
              for (const item of result.items) {
                results.push({
                  keyword: item.keyword || "",
                  ai_search_volume: item.ai_search_volume ?? null,
                });
              }
            }
          }
        }

        // Log cost for monitoring
        if (task?.cost) {
          console.log(`[AI Search Volume] Cost: $${task.cost} for ${cleanedKeywords.length} keywords`);
        }
      }
    }

    return new Response(
      JSON.stringify({ results }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (err) {
    console.error("AI Search Volume error:", err);
    return new Response(
      JSON.stringify({ error: err.message || "Internal error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
