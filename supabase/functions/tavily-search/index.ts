// @ts-nocheck
/**
 * ============================================================================
 * TAVILY SEARCH EDGE FUNCTION
 * ============================================================================
 * 
 * Integrates Tavily API for AI visibility source analysis.
 * Uses /search endpoint with advanced settings for Forzeo recommendations.
 * 
 * Endpoints used:
 * - POST /search - Core visibility search
 * - POST /extract - Deep evidence extraction (optional)
 * 
 * @version 1.0.0
 */

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

// ============================================
// CORS CONFIGURATION
// ============================================

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

// ============================================
// ENVIRONMENT CONFIGURATION
// ============================================

const TAVILY_API_KEY = Deno.env.get("TAVILY_API_KEY") || "";
const TAVILY_API_URL = "https://api.tavily.com";

// Supabase
const SUPABASE_URL = Deno.env.get("SUPABASE_URL") || "";
const SUPABASE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || "";

// ============================================
// TYPE DEFINITIONS
// ============================================

interface TavilySource {
  url: string;
  title: string;
  content: string;
  score: number;
  domain: string;
  published_date?: string;
}

interface TavilySearchResult {
  success: boolean;
  query: string;
  answer?: string;
  sources: TavilySource[];
  raw_content?: unknown;
  error?: string;
  response_time_ms?: number;
}

interface TavilySearchRequest {
  client_id?: string;
  prompt_id?: string;
  prompt_text: string;
  brand_name?: string;
  competitors?: string[];
  search_depth?: "basic" | "advanced";
  max_results?: number;
  include_answer?: boolean;
  save_to_db?: boolean;
}

// ============================================
// AI VISIBILITY ANALYST PROMPT
// ============================================

const VISIBILITY_ANALYST_PROMPT = `You are an AI visibility analyst.

Given the extracted sources below, identify:
1. Why certain brands appear in AI answers for this query
2. What content patterns and source types dominate
3. What a missing brand should do to influence future AI answers

Base all recommendations strictly on the provided sources.
Do not speculate.
Cite patterns, not opinions.`;

// ============================================
// HELPER FUNCTIONS
// ============================================

function extractDomain(url: string): string {
  try {
    return new URL(url).hostname.replace(/^www\./, "");
  } catch {
    return "";
  }
}

// ============================================
// TAVILY API FUNCTIONS
// ============================================

/**
 * Core Tavily search endpoint
 * Advanced depth for editorial + comparison bias
 */
async function tavilySearch(
  query: string,
  options: {
    searchDepth?: "basic" | "advanced";
    maxResults?: number;
    includeAnswer?: boolean;
  } = {}
): Promise<TavilySearchResult> {
  const startTime = Date.now();
  const { searchDepth = "advanced", maxResults = 20, includeAnswer = true } = options;

  if (!TAVILY_API_KEY) {
    return {
      success: false,
      query,
      sources: [],
      error: "Tavily API key not configured",
    };
  }

  console.log(`[Tavily] Searching: "${query.substring(0, 50)}..." (depth: ${searchDepth})`);

  try {
    const response = await fetch(`${TAVILY_API_URL}/search`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${TAVILY_API_KEY}`,
      },
      body: JSON.stringify({
        query,
        search_depth: searchDepth,
        include_answer: includeAnswer,
        include_raw_content: false,
        max_results: maxResults,
      }),
    });

    const responseTime = Date.now() - startTime;

    if (!response.ok) {
      const errorText = await response.text();
      console.error(`[Tavily] HTTP ${response.status}: ${errorText.substring(0, 200)}`);
      return {
        success: false,
        query,
        sources: [],
        error: `HTTP ${response.status}: ${response.statusText}`,
        response_time_ms: responseTime,
      };
    }

    const data = await response.json();
    console.log(`[Tavily] Got ${data.results?.length || 0} results in ${responseTime}ms`);

    // Map results to our source format
    const sources: TavilySource[] = (data.results || []).map((r: {
      url: string;
      title: string;
      content: string;
      score?: number;
      published_date?: string;
    }) => ({
      url: r.url,
      title: r.title,
      content: r.content,
      score: r.score || 0,
      domain: extractDomain(r.url),
      published_date: r.published_date,
    }));

    return {
      success: true,
      query,
      answer: data.answer || undefined,
      sources,
      raw_content: data,
      response_time_ms: responseTime,
    };
  } catch (err) {
    const responseTime = Date.now() - startTime;
    console.error(`[Tavily] Exception: ${err}`);
    return {
      success: false,
      query,
      sources: [],
      error: String(err),
      response_time_ms: responseTime,
    };
  }
}

/**
 * Tavily extract endpoint for deeper evidence
 * Use for top domains only
 */
async function tavilyExtract(urls: string[]): Promise<{
  success: boolean;
  extractions: Array<{ url: string; content: string; title?: string }>;
  error?: string;
}> {
  if (!TAVILY_API_KEY || urls.length === 0) {
    return { success: false, extractions: [], error: "No API key or URLs" };
  }

  console.log(`[Tavily Extract] Extracting from ${urls.length} URLs`);

  try {
    const response = await fetch(`${TAVILY_API_URL}/extract`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${TAVILY_API_KEY}`,
      },
      body: JSON.stringify({
        urls: urls.slice(0, 5), // Limit to 5 URLs
        include_images: false,
      }),
    });

    if (!response.ok) {
      return { success: false, extractions: [], error: `HTTP ${response.status}` };
    }

    const data = await response.json();
    return {
      success: true,
      extractions: data.results || [],
    };
  } catch (err) {
    console.error(`[Tavily Extract] Exception: ${err}`);
    return { success: false, extractions: [], error: String(err) };
  }
}

/**
 * Analyze sources for brand visibility insights
 */
function analyzeSources(
  sources: TavilySource[],
  brandName: string,
  competitors: string[] = []
): {
  brandMentioned: boolean;
  brandMentionCount: number;
  competitorMentions: Record<string, number>;
  topDomains: Array<{ domain: string; count: number }>;
  sourceTypes: Record<string, number>;
  insights: string[];
} {
  let brandMentionCount = 0;
  const competitorMentions: Record<string, number> = {};
  const domainCounts: Record<string, number> = {};
  const sourceTypes: Record<string, number> = {
    editorial: 0,
    ugc: 0,
    corporate: 0,
    reference: 0,
    other: 0,
  };

  const brandLower = brandName.toLowerCase();
  competitors.forEach(c => { competitorMentions[c] = 0; });

  for (const source of sources) {
    const content = (source.content + " " + source.title).toLowerCase();
    const domain = source.domain.toLowerCase();

    // Count brand mentions
    const brandRegex = new RegExp(brandLower.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'gi');
    const brandMatches = content.match(brandRegex);
    if (brandMatches) brandMentionCount += brandMatches.length;

    // Count competitor mentions
    for (const comp of competitors) {
      const compRegex = new RegExp(comp.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'gi');
      const compMatches = content.match(compRegex);
      if (compMatches) competitorMentions[comp] = (competitorMentions[comp] || 0) + compMatches.length;
    }

    // Count domains
    domainCounts[source.domain] = (domainCounts[source.domain] || 0) + 1;

    // Classify source type
    if (domain.includes("reddit") || domain.includes("quora") || domain.includes("youtube")) {
      sourceTypes.ugc++;
    } else if (domain.includes("forbes") || domain.includes("techcrunch") || domain.includes("wired") || domain.includes("business")) {
      sourceTypes.editorial++;
    } else if (domain.includes("wikipedia")) {
      sourceTypes.reference++;
    } else if (domain.includes(".gov") || domain.includes(".edu")) {
      sourceTypes.reference++;
    } else {
      sourceTypes.other++;
    }
  }

  // Generate insights
  const insights: string[] = [];
  const topSourceType = Object.entries(sourceTypes).sort((a, b) => b[1] - a[1])[0];
  if (topSourceType && topSourceType[1] > 0) {
    insights.push(`${topSourceType[0].charAt(0).toUpperCase() + topSourceType[0].slice(1)} sources dominate (${topSourceType[1]}/${sources.length})`);
  }

  if (brandMentionCount === 0 && competitors.length > 0) {
    const topComp = Object.entries(competitorMentions).sort((a, b) => b[1] - a[1])[0];
    if (topComp && topComp[1] > 0) {
      insights.push(`${topComp[0]} appears ${topComp[1]} times - study their content strategy`);
    }
  }

  // Top domains
  const topDomains = Object.entries(domainCounts)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 10)
    .map(([domain, count]) => ({ domain, count }));

  return {
    brandMentioned: brandMentionCount > 0,
    brandMentionCount,
    competitorMentions,
    topDomains,
    sourceTypes,
    insights,
  };
}

// ============================================
// MAIN HANDLER
// ============================================

serve(async (req: Request) => {
  // Handle CORS preflight
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  if (req.method !== "POST") {
    return new Response(JSON.stringify({ error: "Method not allowed" }), {
      status: 405,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  try {
    const body: TavilySearchRequest = await req.json();

    // Validate request
    if (!body.prompt_text || body.prompt_text.length < 3) {
      return new Response(JSON.stringify({ error: "prompt_text is required" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    console.log(`[Tavily Search] Processing: "${body.prompt_text.substring(0, 50)}..."`);

    // Execute Tavily search
    const searchResult = await tavilySearch(body.prompt_text, {
      searchDepth: body.search_depth || "advanced",
      maxResults: body.max_results || 20,
      includeAnswer: body.include_answer !== false,
    });

    if (!searchResult.success) {
      return new Response(JSON.stringify({
        success: false,
        error: searchResult.error,
      }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Analyze sources for visibility insights
    const analysis = analyzeSources(
      searchResult.sources,
      body.brand_name || "",
      body.competitors || []
    );

    // Prepare response
    const result = {
      success: true,
      query: body.prompt_text,
      answer: searchResult.answer,
      sources: searchResult.sources,
      analysis: {
        brand_mentioned: analysis.brandMentioned,
        brand_mention_count: analysis.brandMentionCount,
        competitor_mentions: analysis.competitorMentions,
        top_domains: analysis.topDomains,
        source_types: analysis.sourceTypes,
        insights: analysis.insights,
      },
      response_time_ms: searchResult.response_time_ms,
      timestamp: new Date().toISOString(),
    };

    // Save to database if requested
    if (body.save_to_db && SUPABASE_URL && SUPABASE_KEY) {
      try {
        const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);
        await supabase.from("tavily_results").insert({
          client_id: body.client_id || null,
          prompt_id: body.prompt_id || null,
          prompt_text: body.prompt_text,
          query: body.prompt_text,
          answer: searchResult.answer,
          sources: searchResult.sources,
          raw_content: searchResult.raw_content,
        });
        console.log("[Tavily] Saved results to database");
      } catch (dbErr) {
        console.error("[Tavily] Database save error:", dbErr);
      }
    }

    return new Response(JSON.stringify(result), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });

  } catch (err) {
    console.error("[Tavily Search] Error:", err);
    return new Response(JSON.stringify({
      success: false,
      error: String(err),
    }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
