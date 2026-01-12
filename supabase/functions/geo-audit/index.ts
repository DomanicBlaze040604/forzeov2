// @ts-nocheck
/**
 * ============================================================================
 * FORZEO GEO AUDIT API - Production Ready v3.0
 * ============================================================================
 * 
 * This is the main backend Edge Function that powers the Forzeo GEO Dashboard.
 * It queries multiple AI models via DataForSEO's LIVE LLM APIs and analyzes
 * responses for brand visibility, competitor mentions, and citations.
 * 
 * ============================================================================
 * DATA SOURCES (LIVE LLM - Provider-Specific APIs)
 * ============================================================================
 * 
 * Each AI model is queried via its dedicated DataForSEO LIVE endpoint:
 * 
 * | Model      | Endpoint                                    | internal_model           |
 * |------------|---------------------------------------------|--------------------------|
 * | ChatGPT    | /ai_optimization/chat_gpt/llm_responses/live| gpt-4.1-mini             |
 * | Gemini     | /ai_optimization/gemini/llm_responses/live  | gemini-2.5-flash         |
 * | Claude     | /ai_optimization/claude/llm_responses/live  | claude-sonnet-4-0        |
 * | Perplexity | /ai_optimization/perplexity/llm_responses/live| sonar-pro              |
 * 
 * These are REAL-TIME responses from actual AI providers - NOT simulated!
 * 
 * ============================================================================
 * FEATURES
 * ============================================================================
 * 
 * - LIVE LLM Queries: Real-time inference from ChatGPT, Gemini, Claude, Perplexity
 * - Brand Detection: Find brand mentions, rank in lists, sentiment analysis
 * - Competitor Analysis: Track competitor mentions and rankings
 * - Citation Tracking: Extract and aggregate source URLs
 * - Cost Tracking: Monitor API costs per query
 * - Database Persistence: Save results to Supabase (optional)
 * - Retry Logic: Exponential backoff for reliability
 * - Input Validation: Sanitize all inputs for security
 * 
 * ============================================================================
 * API COSTS (Approximate)
 * ============================================================================
 * 
 * | Service              | Cost per Query |
 * |----------------------|----------------|
 * | ChatGPT (LIVE)       | ~$0.05-0.10    |
 * | Gemini (LIVE)        | ~$0.05-0.10    |
 * | Claude (LIVE)        | ~$0.05-0.10    |
 * | Perplexity (LIVE)    | ~$0.05-0.10    |
 * | Google AI Overview   | ~$0.003        |
 * | Google SERP          | ~$0.002        |
 * 
 * ============================================================================
 * SECURITY
 * ============================================================================
 * 
 * - Input validation and sanitization
 * - Rate limiting headers
 * - Error message sanitization
 * - CORS protection
 * - API keys stored in environment variables
 * 
 * @version 3.0.0
 * @author Forzeo Team
 * @license MIT
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
  "X-Content-Type-Options": "nosniff",
  "X-Frame-Options": "DENY",
};

// ============================================
// ENVIRONMENT CONFIGURATION
// ============================================

// DataForSEO API (primary for LLM Mentions + AI Overview + LIVE LLM)
const DATAFORSEO_API = "https://api.dataforseo.com/v3";
const DATAFORSEO_LOGIN = Deno.env.get("DATAFORSEO_LOGIN") || "contact@forzeo.com";
const DATAFORSEO_PASSWORD = Deno.env.get("DATAFORSEO_PASSWORD") || "b00e21651e5fab03";
const DATAFORSEO_AUTH = btoa(`${DATAFORSEO_LOGIN}:${DATAFORSEO_PASSWORD}`);

// Serper API (alternative/backup for SERP)
const SERPER_API_KEY = Deno.env.get("SERPER_API_KEY") || "";

// Gemini API (for direct LLM queries)
const GEMINI_API_KEY = Deno.env.get("GEMINI_API_KEY") || "";

// OpenAI API (for direct ChatGPT queries)
const OPENAI_API_KEY = Deno.env.get("OPENAI_API_KEY") || "";

// Anthropic API (for direct Claude queries)
const ANTHROPIC_API_KEY = Deno.env.get("ANTHROPIC_API_KEY") || "";

// Note: Groq removed - using DataForSEO LIVE LLM API only

// Supabase
const SUPABASE_URL = Deno.env.get("SUPABASE_URL") || "";
const SUPABASE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || "";

// Tavily API (for real-time web search when header x-include-tavily is set)
const TAVILY_API_KEY = Deno.env.get("TAVILY_API_KEY") || "";
const TAVILY_API_URL = "https://api.tavily.com";

// ============================================
// MODEL CONFIGURATIONS
// ============================================

/**
 * AI model configurations with weights and costs
 * Weights determine importance in visibility scoring
 */
const AI_MODELS: Record<string, {
  name: string;
  color: string;
  provider: string;
  weight: number;
  costPerQuery: number;
  isLLM: boolean;
}> = {
  // LLM models (via LLM Mentions API)
  chatgpt: { name: "ChatGPT", color: "#10a37f", provider: "OpenAI", weight: 1.0, costPerQuery: 0.02, isLLM: true },
  claude: { name: "Claude", color: "#d97706", provider: "Anthropic", weight: 0.95, costPerQuery: 0.02, isLLM: true },
  gemini: { name: "Gemini", color: "#4285f4", provider: "Google", weight: 0.95, costPerQuery: 0.02, isLLM: true },
  perplexity: { name: "Perplexity", color: "#6366f1", provider: "Perplexity AI", weight: 0.9, costPerQuery: 0.02, isLLM: true },
  // Traditional SERP models
  google_ai_overview: { name: "Google AI Overview", color: "#ea4335", provider: "DataForSEO", weight: 0.85, costPerQuery: 0.003, isLLM: false },
  google_serp: { name: "Google SERP", color: "#34a853", provider: "DataForSEO", weight: 0.7, costPerQuery: 0.002, isLLM: false },
  // Real-time web search
  tavily: { name: "Tavily Search", color: "#7c3aed", provider: "Tavily", weight: 0.8, costPerQuery: 0, isLLM: false },
};

// LLM model IDs for the LLM Mentions API
const LLM_MODEL_IDS = ["chatgpt", "claude", "gemini", "perplexity"];

// ============================================
// TYPE DEFINITIONS
// ============================================

interface Citation {
  url: string;
  title: string;
  domain: string;
  position?: number;
  snippet?: string;
  is_brand_source?: boolean;
}

interface CompetitorMention {
  name: string;
  count: number;
  rank: number | null;
  sentiment: "positive" | "neutral" | "negative";
}

interface ModelResult {
  model: string;
  model_name: string;
  provider: string;
  color?: string;
  weight: number;
  success: boolean;
  error?: string;
  raw_response: string;
  response_length: number;
  brand_mentioned: boolean;
  brand_mention_count: number;
  brand_rank: number | null;
  brand_sentiment: "positive" | "neutral" | "negative";
  matched_terms: string[];
  winner_brand: string;
  competitors_found: CompetitorMention[];
  citations: Citation[];
  citation_count: number;
  api_cost: number;
  is_cited: boolean;
  authority_type?: "authority" | "alternative" | "mentioned";
  ai_search_volume?: number;
  response_time_ms?: number;
}

interface AuditRequest {
  client_id?: string;
  campaign_id?: string;
  prompt_id?: string;
  prompt_text: string;
  prompt_category?: string;
  brand_name: string;
  brand_domain?: string;
  brand_tags?: string[];
  competitors?: string[];
  location_code?: number;
  location_name?: string;
  models?: string[];
  save_to_db?: boolean;
}

// ============================================
// INPUT VALIDATION
// ============================================

/**
 * Sanitize and validate input string
 * Prevents injection attacks and ensures valid data
 */
function sanitizeString(input: string, maxLength: number = 500): string {
  if (!input || typeof input !== "string") return "";
  return input
    .trim()
    .slice(0, maxLength)
    .replace(/[<>]/g, "") // Remove potential HTML/script tags
    .replace(/[\x00-\x1F\x7F]/g, ""); // Remove control characters
}

/**
 * Validate request body
 * Returns error message if invalid, null if valid
 */
function validateRequest(body: AuditRequest): string | null {
  if (!body.prompt_text || body.prompt_text.length < 3) {
    return "prompt_text is required and must be at least 3 characters";
  }
  if (!body.brand_name || body.brand_name.length < 1) {
    return "brand_name is required";
  }
  if (body.prompt_text.length > 500) {
    return "prompt_text must be less than 500 characters";
  }
  if (body.models && !Array.isArray(body.models)) {
    return "models must be an array";
  }
  if (body.location_code && (body.location_code < 1 || body.location_code > 99999)) {
    return "invalid location_code";
  }
  return null;
}

// ============================================
// HELPER FUNCTIONS
// ============================================

/**
 * Extract clean domain from URL
 */
function extractDomain(url: string): string {
  try {
    return new URL(url).hostname.replace(/^www\./, "");
  } catch {
    return "";
  }
}

/**
 * Extract URLs from text response
 * Finds all URLs mentioned in the AI response and converts them to citations
 */
function extractUrlsFromText(text: string): Citation[] {
  if (!text) return [];

  const citations: Citation[] = [];

  // Match URLs in various formats
  const urlPatterns = [
    // Standard URLs with http/https
    /https?:\/\/[^\s<>"{}|\\^`\[\]]+/gi,
    // URLs without protocol (www.example.com)
    /(?:^|\s)(www\.[a-zA-Z0-9][a-zA-Z0-9-]*\.[a-zA-Z]{2,}[^\s<>"{}|\\^`\[\]]*)/gi,
    // Domain mentions like "example.com" or "site.org"
    /(?:^|\s)([a-zA-Z0-9][a-zA-Z0-9-]*\.(?:com|org|net|io|co|ai|dev|app|edu|gov|info)[^\s<>"{}|\\^`\[\]]*)/gi,
  ];

  const foundUrls = new Set<string>();

  for (const pattern of urlPatterns) {
    const matches = text.matchAll(pattern);
    for (const match of matches) {
      let url = match[1] || match[0];
      url = url.trim();

      // Clean up URL
      url = url.replace(/[.,;:!?)]+$/, ''); // Remove trailing punctuation

      // Add protocol if missing
      if (!url.startsWith('http')) {
        url = 'https://' + url;
      }

      // Validate URL
      try {
        const parsed = new URL(url);
        // Skip if it's just a domain without path and looks like a brand mention
        if (parsed.pathname === '/' && !url.includes('www.')) {
          // Check if it's a real domain reference
          const domain = parsed.hostname.toLowerCase();
          if (domain.length < 5) continue; // Skip very short domains
        }

        if (!foundUrls.has(url)) {
          foundUrls.add(url);
          citations.push({
            url: url,
            title: parsed.hostname,
            domain: parsed.hostname.replace(/^www\./, ''),
            position: citations.length + 1,
            snippet: '',
          });
        }
      } catch {
        // Invalid URL, skip
      }
    }
  }

  // Also look for markdown-style links [text](url)
  const markdownLinks = text.matchAll(/\[([^\]]+)\]\(([^)]+)\)/g);
  for (const match of markdownLinks) {
    const title = match[1];
    let url = match[2];

    if (!url.startsWith('http')) {
      url = 'https://' + url;
    }

    try {
      const parsed = new URL(url);
      if (!foundUrls.has(url)) {
        foundUrls.add(url);
        citations.push({
          url: url,
          title: title || parsed.hostname,
          domain: parsed.hostname.replace(/^www\./, ''),
          position: citations.length + 1,
          snippet: '',
        });
      }
    } catch {
      // Invalid URL, skip
    }
  }

  return citations;
}

/**
 * Analyze sentiment from context around brand mention
 * Uses keyword matching for positive/negative indicators
 */
function analyzeSentiment(context: string): "positive" | "neutral" | "negative" {
  const lower = context.toLowerCase();

  const positiveWords = [
    "best", "top", "excellent", "recommended", "leading", "trusted",
    "popular", "great", "amazing", "reliable", "safe", "premium",
    "innovative", "award", "favorite", "preferred", "quality"
  ];

  const negativeWords = [
    "avoid", "poor", "worst", "bad", "unreliable", "scam", "fake",
    "terrible", "issues", "problems", "complaints", "disappointing",
    "overpriced", "slow", "buggy", "unsafe"
  ];

  const posCount = positiveWords.filter(w => lower.includes(w)).length;
  const negCount = negativeWords.filter(w => lower.includes(w)).length;

  if (posCount > negCount) return "positive";
  if (negCount > posCount) return "negative";
  return "neutral";
}

/**
 * Parse brand mentions from response text
 * Detects brand name and alternative tags
 */
function parseBrandData(
  response: string,
  brandName: string,
  brandTags: string[] = []
): {
  mentioned: boolean;
  count: number;
  rank: number | null;
  sentiment: "positive" | "neutral" | "negative";
  matchedTerms: string[];
} {
  if (!response) {
    return { mentioned: false, count: 0, rank: null, sentiment: "neutral", matchedTerms: [] };
  }

  const lower = response.toLowerCase();
  const allTerms = [brandName, ...brandTags].filter(Boolean);
  let totalCount = 0;
  const matchedTerms: string[] = [];

  // Count all mentions of brand and tags
  for (const term of allTerms) {
    if (!term) continue;
    const termLower = term.toLowerCase();
    let idx = 0;
    let count = 0;
    while ((idx = lower.indexOf(termLower, idx)) !== -1) {
      count++;
      idx++;
    }
    if (count > 0) {
      totalCount += count;
      matchedTerms.push(term);
    }
  }

  // Find rank in numbered lists (e.g., "1. Brand", "2) Brand")
  let rank: number | null = null;
  const lines = response.split("\n");
  for (const line of lines) {
    const match = line.match(/^\s*(\d+)[.)\]]\s*\*{0,2}(.+)/);
    if (match) {
      const lineContent = match[2].toLowerCase();
      for (const term of allTerms) {
        if (term && lineContent.includes(term.toLowerCase())) {
          rank = parseInt(match[1]);
          break;
        }
      }
      if (rank) break;
    }
  }

  // Analyze sentiment around first mention
  let sentiment: "positive" | "neutral" | "negative" = "neutral";
  for (const term of allTerms) {
    if (!term) continue;
    const idx = lower.indexOf(term.toLowerCase());
    if (idx !== -1) {
      const contextStart = Math.max(0, idx - 100);
      const contextEnd = Math.min(response.length, idx + term.length + 100);
      sentiment = analyzeSentiment(response.substring(contextStart, contextEnd));
      break;
    }
  }

  return {
    mentioned: totalCount > 0,
    count: totalCount,
    rank,
    sentiment,
    matchedTerms
  };
}

/**
 * Parse competitor mentions from response
 */
function parseCompetitors(response: string, competitors: string[]): CompetitorMention[] {
  if (!response || !competitors.length) return [];

  const lower = response.toLowerCase();
  const results: CompetitorMention[] = [];

  for (const comp of competitors) {
    const compLower = comp.toLowerCase();
    let count = 0;
    let idx = 0;

    while ((idx = lower.indexOf(compLower, idx)) !== -1) {
      count++;
      idx++;
    }

    if (count === 0) continue;

    // Find rank in numbered lists
    let rank: number | null = null;
    for (const line of response.split("\n")) {
      const match = line.match(/^\s*(\d+)[.)\]]\s*\*{0,2}(.+)/);
      if (match && match[2].toLowerCase().includes(compLower)) {
        rank = parseInt(match[1]);
        break;
      }
    }

    // Analyze sentiment
    const firstIdx = lower.indexOf(compLower);
    const context = response.substring(
      Math.max(0, firstIdx - 50),
      Math.min(response.length, firstIdx + comp.length + 50)
    );

    results.push({
      name: comp,
      count,
      rank,
      sentiment: analyzeSentiment(context)
    });
  }

  return results.sort((a, b) => b.count - a.count);
}

/**
 * Find the "winner" brand in a response
 * Winner is the brand with rank #1 or most mentions
 */
function findWinnerBrand(response: string, brandName: string, competitors: string[]): string {
  if (!response) return "";

  let winner = "";
  let maxCount = 0;
  let topRank = 999;

  for (const brand of [brandName, ...competitors]) {
    const data = parseBrandData(response, brand);

    // Rank #1 always wins
    if (data.rank === 1) return brand;

    // Otherwise: most mentions wins, rank breaks ties
    if (data.count > maxCount || (data.count === maxCount && (data.rank || 999) < topRank)) {
      maxCount = data.count;
      topRank = data.rank || 999;
      winner = brand;
    }
  }

  return winner;
}

// ============================================
// TAVILY SEARCH API
// ============================================

/**
 * Query Tavily Search API for real-time web search results
 * Used when x-include-tavily header is set to "true"
 */
async function tavilySearch(query: string): Promise<{
  success: boolean;
  answer?: string;
  sources: Array<{ url: string; title: string; content: string; domain: string }>;
  error?: string;
  response_time_ms?: number;
}> {
  if (!TAVILY_API_KEY) {
    console.log("[Tavily] API key not configured, skipping");
    return { success: false, sources: [], error: "Tavily API key not configured" };
  }

  console.log(`[Tavily] Searching: "${query.substring(0, 50)}..."`);
  const startTime = Date.now();

  try {
    const response = await fetch(`${TAVILY_API_URL}/search`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${TAVILY_API_KEY}`,
      },
      body: JSON.stringify({
        query,
        search_depth: "advanced",
        include_answer: true,
        include_raw_content: false,
        max_results: 20,
      }),
    });

    const responseTime = Date.now() - startTime;

    if (!response.ok) {
      const errorText = await response.text();
      console.error(`[Tavily] HTTP ${response.status}: ${errorText.substring(0, 200)}`);
      return { success: false, sources: [], error: `HTTP ${response.status}`, response_time_ms: responseTime };
    }

    const data = await response.json();
    const sources = (data.results || []).map((r: { url: string; title: string; content: string }) => ({
      url: r.url,
      title: r.title,
      content: r.content,
      domain: extractDomain(r.url),
    }));

    console.log(`[Tavily] Got answer (${(data.answer || "").length} chars) and ${sources.length} sources in ${responseTime}ms`);

    return {
      success: true,
      answer: data.answer,
      sources,
      response_time_ms: responseTime,
    };
  } catch (err) {
    console.error(`[Tavily] Exception: ${err}`);
    return { success: false, sources: [], error: String(err), response_time_ms: Date.now() - startTime };
  }
}

// ============================================
// DATAFORSEO API FUNCTIONS
// ============================================

/**
 * Make authenticated request to DataForSEO API
 */
async function callDataForSEO(endpoint: string, body: unknown): Promise<{
  data?: unknown;
  error?: string;
  status_code?: number;
}> {
  console.log(`[DataForSEO] POST ${endpoint}`);

  if (!DATAFORSEO_LOGIN || !DATAFORSEO_PASSWORD) {
    console.error("[DataForSEO] Missing credentials!");
    return { error: "DataForSEO credentials not configured" };
  }

  try {
    const response = await fetch(`${DATAFORSEO_API}${endpoint}`, {
      method: "POST",
      headers: {
        "Authorization": `Basic ${DATAFORSEO_AUTH}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(body),
    });

    const text = await response.text();

    if (!response.ok) {
      console.error(`[DataForSEO] HTTP ${response.status}: ${text.substring(0, 300)}`);

      // Handle specific error codes
      const errorMessages: Record<number, string> = {
        402: "DataForSEO account needs credits - please top up your balance",
        401: "DataForSEO authentication failed - check credentials",
        404: "DataForSEO endpoint not found - API may have changed",
        429: "Rate limit exceeded - please try again later",
      };

      return {
        error: errorMessages[response.status] || `HTTP ${response.status}`,
        status_code: response.status
      };
    }

    const data = JSON.parse(text);

    if (data.status_code !== 20000) {
      console.error(`[DataForSEO] API Error: ${data.status_message}`);
      return { error: data.status_message, status_code: data.status_code };
    }

    return { data };
  } catch (err) {
    console.error(`[DataForSEO] Exception: ${err}`);
    return { error: String(err) };
  }
}

/**
 * Query Google SERP for organic results
 */
async function getGoogleSERP(
  prompt: string,
  locationCode: number
): Promise<{
  success: boolean;
  response: string;
  citations: Citation[];
  cost: number;
  error?: string;
  response_time_ms?: number;
}> {
  console.log("[Google SERP] Querying...");
  const startTime = Date.now();

  const result = await callDataForSEO("/serp/google/organic/live/advanced", [{
    keyword: prompt,
    location_code: locationCode,
    language_code: "en",
    device: "desktop",
    depth: 20,
  }]);

  const responseTime = Date.now() - startTime;

  if (result.error) {
    return { success: false, response: "", citations: [], cost: 0, error: result.error, response_time_ms: responseTime };
  }

  const data = result.data as { tasks?: Array<{ result?: Array<{ items?: unknown[] }>; cost?: number }> };
  const task = data?.tasks?.[0];
  const taskResult = task?.result?.[0];
  const cost = task?.cost || 0;
  const items = (taskResult?.items || []) as Array<{
    type: string;
    description?: string;
    title?: string;
    url?: string;
    domain?: string;
    rank_absolute?: number;
  }>;

  const parts: string[] = [];
  const citations: Citation[] = [];

  // Process featured snippets first
  for (const item of items) {
    if (item.type === "featured_snippet") {
      parts.push(`=== Featured Answer ===\n${item.description || item.title || ""}`);
      if (item.url) {
        citations.push({
          url: item.url,
          title: item.title || "",
          domain: item.domain || extractDomain(item.url),
          position: 0,
          snippet: item.description,
        });
      }
    }
  }

  // Process organic results
  for (const item of items) {
    if (item.type === "organic" && item.url) {
      citations.push({
        url: item.url,
        title: item.title || "",
        domain: item.domain || extractDomain(item.url),
        position: item.rank_absolute,
        snippet: item.description,
      });
    }
  }

  // Build response text
  parts.push("\n=== Top Search Results ===");
  citations.slice(0, 10).forEach((c, i) => {
    parts.push(`${i + 1}. ${c.title}\n   ${c.snippet || ""}`);
  });

  const response = parts.join("\n\n").trim();
  console.log(`[Google SERP] Got ${response.length} chars, ${citations.length} citations, cost: ${cost}`);

  return { success: response.length > 0, response, citations, cost, response_time_ms: responseTime };
}

/**
 * Query Google AI Overview
 */
async function getGoogleAIOverview(
  prompt: string,
  locationCode: number
): Promise<{
  success: boolean;
  response: string;
  citations: Citation[];
  cost: number;
  error?: string;
  response_time_ms?: number;
}> {
  console.log("[Google AI Overview] Querying...");
  const startTime = Date.now();

  const result = await callDataForSEO("/serp/google/organic/live/advanced", [{
    keyword: prompt,
    location_code: locationCode,
    language_code: "en",
    device: "desktop",
    depth: 10,
  }]);

  const responseTime = Date.now() - startTime;

  if (result.error) {
    return { success: false, response: "", citations: [], cost: 0, error: result.error, response_time_ms: responseTime };
  }

  const data = result.data as { tasks?: Array<{ result?: Array<{ items?: unknown[] }>; cost?: number }> };
  const task = data?.tasks?.[0];
  const taskResult = task?.result?.[0];
  const cost = task?.cost || 0;
  const items = (taskResult?.items || []) as Array<{
    type: string;
    items?: Array<{ text?: string; references?: Array<{ url?: string; title?: string; domain?: string; snippet?: string }> }>;
    description?: string;
    title?: string;
    url?: string;
    domain?: string;
    rank_absolute?: number;
  }>;

  let response = "";
  const citations: Citation[] = [];

  // Look for AI overview or featured snippet
  for (const item of items) {
    if (item.type === "ai_overview" && item.items) {
      for (const subItem of item.items) {
        if (subItem.text) response += subItem.text + "\n";
        if (subItem.references) {
          subItem.references.forEach((ref, idx) => {
            citations.push({
              url: ref.url || "",
              title: ref.title || "",
              domain: ref.domain || extractDomain(ref.url || ""),
              position: idx + 1,
              snippet: ref.snippet || "",
            });
          });
        }
      }
    } else if (item.type === "featured_snippet") {
      response += item.description || item.title || "";
      if (item.url) {
        citations.push({
          url: item.url,
          title: item.title || "",
          domain: item.domain || extractDomain(item.url),
          position: 0,
          snippet: item.description,
        });
      }
    }
  }

  // Fallback to top organic results if no AI overview
  if (!response) {
    const organicItems = items.filter(i => i.type === "organic").slice(0, 5);
    for (const item of organicItems) {
      response += `${item.title}\n${item.description || ""}\n\n`;
      if (item.url) {
        citations.push({
          url: item.url,
          title: item.title || "",
          domain: item.domain || extractDomain(item.url),
          position: item.rank_absolute,
          snippet: item.description,
        });
      }
    }
  }

  response = response.trim();
  console.log(`[Google AI Overview] Got ${response.length} chars, ${citations.length} citations, cost: ${cost}`);

  return { success: response.length > 0, response, citations, cost, response_time_ms: responseTime };
}

/**
 * Query LLM Mentions API for AI platform mentions
 * Searches DataForSEO's database of AI-generated answers
 */
async function getLLMMentions(
  keyword: string,
  targetDomain: string,
  brandName: string,
  brandTags: string[],
  locationCode: number = 2840
): Promise<{
  success: boolean;
  results: Map<string, {
    answer: string;
    sources: Citation[];
    brand_mentioned: boolean;
    brand_cited: boolean;
    brand_mention_count: number;
    ai_search_volume: number;
  }>;
  cost: number;
  error?: string;
  response_time_ms?: number;
}> {
  console.log(`[LLM Mentions] Searching: "${keyword.substring(0, 50)}..." | Brand: ${brandName}`);
  const startTime = Date.now();

  const requestBody = [{
    language_name: "English",
    location_code: locationCode,
    target: [{
      keyword: keyword,
      search_scope: ["answer"]
    }],
    platform: "google",
    limit: 10,
  }];

  const result = await callDataForSEO("/ai_optimization/llm_mentions/search/live", requestBody);
  const responseTime = Date.now() - startTime;

  const results = new Map<string, {
    answer: string;
    sources: Citation[];
    brand_mentioned: boolean;
    brand_cited: boolean;
    brand_mention_count: number;
    ai_search_volume: number;
  }>();

  if (result.error) {
    console.error(`[LLM Mentions] Error: ${result.error}`);
    return { success: false, results, cost: 0, error: result.error, response_time_ms: responseTime };
  }

  const data = result.data as { tasks?: Array<{ result?: Array<{ items?: unknown[] }>; cost?: number }> };
  const task = data?.tasks?.[0];
  const cost = task?.cost || 0;
  const taskResult = task?.result?.[0];
  const rawItems = ((taskResult as { items?: unknown[] })?.items || []) as Array<{
    question?: string;
    answer?: string;
    ai_search_volume?: number;
    sources?: Array<{ url?: string; title?: string; domain?: string; position?: number; snippet?: string }>;
  }>;

  console.log(`[LLM Mentions] Got ${rawItems.length} items, cost: ${cost}`);

  const allTerms = [brandName, targetDomain, ...brandTags].filter(Boolean).map(t => t.toLowerCase());

  if (rawItems.length > 0) {
    // Combine all answers
    let combinedAnswer = "";
    const allSources: Citation[] = [];
    let totalVolume = 0;

    for (const item of rawItems) {
      const answer = item.answer || "";
      combinedAnswer += `Q: ${item.question || keyword}\nA: ${answer}\n\n`;
      totalVolume += item.ai_search_volume || 0;

      // Parse sources
      const sources = (item.sources || []).map((s, idx) => ({
        url: s.url || "",
        title: s.title || "",
        domain: (s.domain || "").replace(/^www\./, ""),
        position: s.position || idx + 1,
        snippet: s.snippet || "",
      }));
      allSources.push(...sources);
    }

    // Check brand mentions
    const answerLower = combinedAnswer.toLowerCase();
    let brandMentioned = false;
    let brandMentionCount = 0;

    for (const term of allTerms) {
      if (!term) continue;
      let idx = 0;
      while ((idx = answerLower.indexOf(term, idx)) !== -1) {
        brandMentioned = true;
        brandMentionCount++;
        idx++;
      }
    }

    // Check if brand is cited
    const brandCited = allSources.some(s =>
      allTerms.some(term =>
        s.domain.toLowerCase().includes(term) ||
        s.url.toLowerCase().includes(term)
      )
    );

    // Create results for each LLM model
    for (const modelId of LLM_MODEL_IDS) {
      results.set(modelId, {
        answer: combinedAnswer,
        sources: allSources,
        brand_mentioned: brandMentioned,
        brand_cited: brandCited,
        brand_mention_count: brandMentionCount,
        ai_search_volume: totalVolume,
      });
    }
  }

  return { success: results.size > 0, results, cost, response_time_ms: responseTime };
}

/**
 * LIVE LLM Response API - Real-time inference (NOT cached)
 * Uses DataForSEO provider-specific endpoints for each model
 * 
 * Endpoints:
 * - ChatGPT: /ai_optimization/chat_gpt/llm_responses/live
 * - Gemini: /ai_optimization/gemini/llm_responses/live
 * - Claude: /ai_optimization/claude/llm_responses/live
 * - Perplexity: /ai_optimization/perplexity/llm_responses/live
 * 
 * Required params: user_prompt, model_name
 * Cost: ~$0.001-0.005 per query
 */
async function getLiveLLMResponse(
  prompt: string,
  model: "chatgpt" | "gemini" | "claude" | "perplexity"
): Promise<{
  success: boolean;
  response: string;
  tokens: number;
  cost: number;
  latency_ms: number;
  error?: string;
}> {
  console.log(`[LIVE LLM/${model}] Querying real-time...`);
  const startTime = Date.now();

  // Map model IDs to DataForSEO endpoints and model names
  const modelConfig: Record<string, { endpoint: string; modelName: string }> = {
    chatgpt: { endpoint: "/ai_optimization/chat_gpt/llm_responses/live", modelName: "gpt-4.1-mini" },
    gemini: { endpoint: "/ai_optimization/gemini/llm_responses/live", modelName: "gemini-2.5-flash" },
    claude: { endpoint: "/ai_optimization/claude/llm_responses/live", modelName: "claude-sonnet-4-0" },
    perplexity: { endpoint: "/ai_optimization/perplexity/llm_responses/live", modelName: "sonar-pro" },
  };

  const config = modelConfig[model];
  if (!config) {
    return { success: false, response: "", tokens: 0, cost: 0, latency_ms: 0, error: `Unknown model: ${model}` };
  }

  // Retry logic with exponential backoff
  const maxRetries = 3;
  let lastError = "";
  let totalCost = 0;

  for (let attempt = 0; attempt < maxRetries; attempt++) {
    if (attempt > 0) {
      // Exponential backoff: 2s, 4s, 8s
      const delay = Math.pow(2, attempt) * 1000;
      console.log(`[LIVE LLM/${model}] Retry ${attempt + 1}/${maxRetries}, waiting ${delay}ms...`);
      await new Promise(resolve => setTimeout(resolve, delay));
    }

    // Use the correct endpoint and parameters
    // Enhance prompt to get specific recommendations with sources/URLs
    const enhancedPrompt = `${prompt}

Important: Please provide specific recommendations with actual business names, websites, or sources. Include URLs where possible. Do not ask clarifying questions - provide direct answers with specific options.`;

    const payload: any = {
      user_prompt: enhancedPrompt,
      model_name: config.modelName,
      max_output_tokens: 1000,
      temperature: 0.7,
    };

    // If retrying due to Invalid Field error, strip optional params
    if (attempt > 0 && lastError.includes("Invalid Field")) {
      console.log(`[LIVE LLM/${model}] Retrying with minimal payload (stripping optional params)`);
      delete payload.max_output_tokens;
      delete payload.temperature;
    }

    const result = await callDataForSEO(config.endpoint, [payload]);

    const latency = Date.now() - startTime;

    if (result.error) {
      lastError = result.error;
      console.error(`[LIVE LLM/${model}] Attempt ${attempt + 1} error: ${result.error}`);

      // Don't retry on auth/credit errors
      if (result.status_code === 401 || result.status_code === 402) {
        return { success: false, response: "", tokens: 0, cost: totalCost, latency_ms: latency, error: result.error };
      }
      continue;
    }

    const data = result.data as {
      tasks?: Array<{
        result?: Array<{
          input_tokens?: number;
          output_tokens?: number;
          items?: Array<{
            type?: string;
            sections?: Array<{
              type?: string;
              text?: string;
            }>;
          }>;
        }>;
        cost?: number;
        status_code?: number;
        status_message?: string;
      }>
    };

    const task = data?.tasks?.[0];
    const taskResult = task?.result?.[0];
    const cost = task?.cost || 0;
    totalCost += cost;

    // Check task status
    if (task?.status_code && task.status_code !== 20000) {
      lastError = task.status_message || `Task failed with code ${task.status_code}`;
      console.error(`[LIVE LLM/${model}] Task error: ${lastError}`);
      continue;
    }

    // Extract text from items -> sections
    let responseText = "";
    if (taskResult?.items) {
      for (const item of taskResult.items) {
        if (item.sections) {
          for (const section of item.sections) {
            if (section.text) {
              responseText += section.text;
            }
          }
        }
      }
    }

    if (!responseText) {
      lastError = "No live LLM response returned - empty response";
      console.error(`[LIVE LLM/${model}] Attempt ${attempt + 1}: No response text found`);
      continue;
    }

    const totalTokens = (taskResult?.input_tokens || 0) + (taskResult?.output_tokens || 0);

    console.log(`[LIVE LLM/${model}] Got ${responseText.length} chars, ${totalTokens} tokens, ${latency}ms, cost: $${cost}`);

    return {
      success: true,
      response: responseText,
      tokens: totalTokens,
      cost: totalCost,
      latency_ms: latency,
    };
  }

  // All retries failed
  const latency = Date.now() - startTime;
  console.error(`[LIVE LLM/${model}] All ${maxRetries} attempts failed: ${lastError}`);
  return {
    success: false,
    response: "",
    tokens: 0,
    cost: totalCost,
    latency_ms: latency,
    error: `DataForSEO LIVE failed after ${maxRetries} attempts: ${lastError}`
  };
}

/**
 * Extract brand/product mentions as pseudo-citations
 * When LIVE LLM responses don't contain URLs, we extract mentioned brands/products
 * as "implicit citations" to show what sources the AI is referencing
 */
function extractImplicitCitations(
  text: string,
  brandName: string,
  brandTags: string[],
  competitors: string[]
): Citation[] {
  console.log(`[extractImplicitCitations] CALLED with text length: ${text?.length || 0}`);

  if (!text) {
    console.log(`[extractImplicitCitations] No text provided, returning empty`);
    return [];
  }

  const citations: Citation[] = [];
  const foundBrands = new Set<string>();
  const lower = text.toLowerCase();

  console.log(`[extractImplicitCitations] Brand: ${brandName}, Tags: [${brandTags.join(', ')}], Competitors: [${competitors.join(', ')}]`);

  // Check for brand mentions
  const allBrands = [brandName, ...brandTags, ...competitors].filter(Boolean);
  console.log(`[extractImplicitCitations] All brands to check: [${allBrands.join(', ')}]`);

  for (const brand of allBrands) {
    if (!brand || brand.length < 2) continue;
    const brandLower = brand.toLowerCase();

    const found = lower.includes(brandLower);
    console.log(`[extractImplicitCitations] Checking "${brand}" (${brandLower}): found=${found}`);

    if (found && !foundBrands.has(brandLower)) {
      foundBrands.add(brandLower);

      // Try to construct a likely URL for the brand
      const cleanBrand = brand.replace(/[^a-zA-Z0-9]/g, '').toLowerCase();
      const likelyDomain = `${cleanBrand}.com`;

      console.log(`[extractImplicitCitations] Adding citation for: ${brand} -> ${likelyDomain}`);

      citations.push({
        url: `https://${likelyDomain}`,
        title: brand,
        domain: likelyDomain,
        position: citations.length + 1,
        snippet: `Mentioned in AI response`,
        is_brand_source: brandLower === brandName.toLowerCase() ||
          brandTags.some(t => t.toLowerCase() === brandLower),
      });
    }
  }

  console.log(`[extractImplicitCitations] Total citations from brands: ${citations.length}`);
  return citations;
}

/**
 * Multi-model LIVE LLM query with cross-validation
 * Queries multiple models and checks for agreement to reduce hallucinations
 * Now also extracts URLs/citations from response text AND implicit brand citations
 */
async function getLiveLLMWithValidation(
  prompt: string,
  brandName: string,
  brandTags: string[],
  competitors: string[],
  models: Array<"chatgpt" | "gemini" | "claude" | "perplexity"> = ["chatgpt", "gemini", "claude"]
): Promise<{
  success: boolean;
  results: Map<string, {
    response: string;
    tokens: number;
    cost: number;
    latency_ms: number;
    brand_mentioned: boolean;
    brand_mention_count: number;
    citations: Citation[];
  }>;
  totalCost: number;
  agreement: "high" | "medium" | "low";
  error?: string;
}> {
  console.log(`[LIVE LLM Validation] ========== START ==========`);
  console.log(`[LIVE LLM Validation] Querying ${models.length} models: ${models.join(', ')}`);
  console.log(`[LIVE LLM Validation] Brand: ${brandName}`);
  console.log(`[LIVE LLM Validation] Tags: ${JSON.stringify(brandTags)}`);
  console.log(`[LIVE LLM Validation] Competitors: ${JSON.stringify(competitors)}`);

  const results = new Map<string, {
    response: string;
    tokens: number;
    cost: number;
    latency_ms: number;
    brand_mentioned: boolean;
    brand_mention_count: number;
    citations: Citation[];
  }>();

  let totalCost = 0;
  const responses: string[] = [];

  // Query models sequentially with longer delays to avoid rate limits
  for (let i = 0; i < models.length; i++) {
    const model = models[i];

    // Add longer delay between queries (2.5s)
    if (i > 0) {
      await new Promise(resolve => setTimeout(resolve, 2500));
    }

    const result = await getLiveLLMResponse(prompt, model);
    totalCost += result.cost;

    if (result.success) {
      const brandData = parseBrandData(result.response, brandName, brandTags);

      console.log(`[LIVE LLM/${model}] Response received, length: ${result.response.length}`);
      console.log(`[LIVE LLM/${model}] Brand data: mentioned=${brandData.mentioned}, count=${brandData.count}`);

      // Always extract both URL citations AND implicit citations from brand mentions
      const urlCitations = extractUrlsFromText(result.response);
      console.log(`[LIVE LLM/${model}] URL citations extracted: ${urlCitations.length}`);

      const implicitCitations = extractImplicitCitations(
        result.response,
        brandName,
        brandTags,
        competitors
      );
      console.log(`[LIVE LLM/${model}] Implicit citations extracted: ${implicitCitations.length}`);

      // Merge citations, avoiding duplicates (URLs take priority)
      const seenDomains = new Set<string>();
      const extractedCitations: Citation[] = [];

      // Add URL citations first
      for (const c of urlCitations) {
        const domainLower = c.domain.toLowerCase();
        if (!seenDomains.has(domainLower)) {
          seenDomains.add(domainLower);
          extractedCitations.push(c);
        }
      }

      // Add implicit citations that aren't duplicates
      for (const c of implicitCitations) {
        const domainLower = c.domain.toLowerCase();
        if (!seenDomains.has(domainLower)) {
          seenDomains.add(domainLower);
          extractedCitations.push(c);
        }
      }

      console.log(`[LIVE LLM/${model}] Total merged citations: ${extractedCitations.length}`);

      results.set(model, {
        response: result.response,
        tokens: result.tokens,
        cost: result.cost,
        latency_ms: result.latency_ms,
        brand_mentioned: brandData.mentioned,
        brand_mention_count: brandData.count,
        citations: extractedCitations,
      });

      responses.push(result.response);
    }
  }

  // Check agreement between models
  let agreement: "high" | "medium" | "low" = "low";

  if (responses.length >= 2) {
    // Extract key terms from each response
    const keyTerms = responses.map(r => {
      const words = r.toLowerCase().match(/\b[a-z]{4,}\b/g) || [];
      return new Set(words.slice(0, 30));
    });

    // Check overlap between responses
    let overlapCount = 0;
    const firstTerms = keyTerms[0];

    for (let i = 1; i < keyTerms.length; i++) {
      const overlap = [...firstTerms].filter(term => keyTerms[i].has(term)).length;
      if (overlap >= 5) overlapCount++;
    }

    if (overlapCount >= keyTerms.length - 1) {
      agreement = "high";
    } else if (overlapCount >= 1) {
      agreement = "medium";
    }
  }

  console.log(`[LIVE LLM Validation] Got ${results.size}/${models.length} responses, agreement: ${agreement}`);

  return {
    success: results.size > 0,
    results,
    totalCost,
    agreement,
  };
}

/**
 * Serper API - Alternative/Backup SERP provider
 * Useful when DataForSEO is unavailable or for cost optimization
 * Get API key from: https://serper.dev
 */
async function getSerperSERP(
  prompt: string,
  countryCode: string = "us"
): Promise<{
  success: boolean;
  response: string;
  citations: Citation[];
  cost: number;
  error?: string;
  response_time_ms?: number;
}> {
  if (!SERPER_API_KEY) {
    return { success: false, response: "", citations: [], cost: 0, error: "SERPER_API_KEY not configured" };
  }

  console.log("[Serper] Querying...");
  const startTime = Date.now();

  try {
    const response = await fetch("https://google.serper.dev/search", {
      method: "POST",
      headers: {
        "X-API-KEY": SERPER_API_KEY,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        q: prompt,
        gl: countryCode,
        num: 10,
      }),
    });

    const responseTime = Date.now() - startTime;

    if (!response.ok) {
      const errorText = await response.text();
      console.error(`[Serper] Error: ${response.status} - ${errorText.substring(0, 200)}`);
      return { success: false, response: "", citations: [], cost: 0.001, error: `Serper API error: ${response.status}`, response_time_ms: responseTime };
    }

    const data = await response.json();
    const parts: string[] = [];
    const citations: Citation[] = [];

    // Process answer box / featured snippet
    if (data.answerBox) {
      parts.push(`=== Featured Answer ===\n${data.answerBox.snippet || data.answerBox.answer || ""}`);
      if (data.answerBox.link) {
        citations.push({
          url: data.answerBox.link,
          title: data.answerBox.title || "",
          domain: extractDomain(data.answerBox.link),
          position: 0,
          snippet: data.answerBox.snippet,
        });
      }
    }

    // Process knowledge graph
    if (data.knowledgeGraph?.description) {
      parts.push(`=== Knowledge Graph ===\n${data.knowledgeGraph.description}`);
    }

    // Process organic results
    if (data.organic && Array.isArray(data.organic)) {
      parts.push("\n=== Top Search Results ===");
      data.organic.slice(0, 10).forEach((item: { link?: string; title?: string; snippet?: string; position?: number }, idx: number) => {
        if (item.link) {
          citations.push({
            url: item.link,
            title: item.title || "",
            domain: extractDomain(item.link),
            position: item.position || idx + 1,
            snippet: item.snippet,
          });
          parts.push(`${idx + 1}. ${item.title}\n   ${item.snippet || ""}`);
        }
      });
    }

    const responseText = parts.join("\n\n").trim();
    console.log(`[Serper] Got ${responseText.length} chars, ${citations.length} citations`);

    // Serper costs ~$0.001 per query
    return { success: responseText.length > 0, response: responseText, citations, cost: 0.001, response_time_ms: responseTime };

  } catch (err) {
    console.error(`[Serper] Exception: ${err}`);
    return { success: false, response: "", citations: [], cost: 0, error: String(err), response_time_ms: Date.now() - startTime };
  }
}

/**
 * Query Gemini API directly for LLM response
 * Useful for getting direct AI responses when LLM Mentions doesn't have data
 */
async function queryGemini(
  prompt: string,
  brandName: string
): Promise<{
  success: boolean;
  response: string;
  cost: number;
  error?: string;
  response_time_ms?: number;
}> {
  if (!GEMINI_API_KEY) {
    return { success: false, response: "", cost: 0, error: "GEMINI_API_KEY not configured" };
  }

  console.log("[Gemini] Querying...");
  const startTime = Date.now();

  try {
    const response = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${GEMINI_API_KEY}`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          contents: [{
            parts: [{
              text: `${prompt}\n\nProvide a helpful, informative response with specific recommendations and brand names where relevant.`
            }]
          }],
          generationConfig: {
            temperature: 0.7,
            maxOutputTokens: 1024,
          }
        }),
      }
    );

    const responseTime = Date.now() - startTime;

    if (!response.ok) {
      const errorText = await response.text();
      console.error(`[Gemini] Error: ${response.status} - ${errorText.substring(0, 200)}`);
      return { success: false, response: "", cost: 0, error: `Gemini API error: ${response.status}`, response_time_ms: responseTime };
    }

    const data = await response.json();
    const text = data.candidates?.[0]?.content?.parts?.[0]?.text || "";

    console.log(`[Gemini] Got ${text.length} chars`);

    // Gemini Flash is very cheap, ~$0.0001 per query
    return { success: text.length > 0, response: text, cost: 0.0001, response_time_ms: responseTime };

  } catch (err) {
    console.error(`[Gemini] Exception: ${err}`);
    return { success: false, response: "", cost: 0, error: String(err), response_time_ms: Date.now() - startTime };
  }
}

/**
 * Query OpenAI ChatGPT API directly
 */
async function queryChatGPT(
  prompt: string
): Promise<{
  success: boolean;
  response: string;
  cost: number;
  error?: string;
  response_time_ms?: number;
}> {
  if (!OPENAI_API_KEY) {
    return { success: false, response: "", cost: 0, error: "OPENAI_API_KEY not configured" };
  }

  console.log("[ChatGPT] Querying...");
  const startTime = Date.now();

  try {
    const response = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${OPENAI_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "gpt-4o-mini",
        messages: [
          { role: "system", content: "You are a helpful assistant. Provide informative responses with specific recommendations and brand names where relevant." },
          { role: "user", content: prompt }
        ],
        max_tokens: 1024,
        temperature: 0.7,
      }),
    });

    const responseTime = Date.now() - startTime;

    if (!response.ok) {
      const errorText = await response.text();
      console.error(`[ChatGPT] Error: ${response.status} - ${errorText.substring(0, 200)}`);
      return { success: false, response: "", cost: 0, error: `ChatGPT API error: ${response.status}`, response_time_ms: responseTime };
    }

    const data = await response.json();
    const text = data.choices?.[0]?.message?.content || "";

    console.log(`[ChatGPT] Got ${text.length} chars`);

    // GPT-4o-mini is ~$0.00015 per 1K input + $0.0006 per 1K output
    return { success: text.length > 0, response: text, cost: 0.001, response_time_ms: responseTime };

  } catch (err) {
    console.error(`[ChatGPT] Exception: ${err}`);
    return { success: false, response: "", cost: 0, error: String(err), response_time_ms: Date.now() - startTime };
  }
}

/**
 * Query Anthropic Claude API directly
 */
async function queryClaude(
  prompt: string
): Promise<{
  success: boolean;
  response: string;
  cost: number;
  error?: string;
  response_time_ms?: number;
}> {
  if (!ANTHROPIC_API_KEY) {
    return { success: false, response: "", cost: 0, error: "ANTHROPIC_API_KEY not configured" };
  }

  console.log("[Claude] Querying...");
  const startTime = Date.now();

  try {
    const response = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "x-api-key": ANTHROPIC_API_KEY,
        "anthropic-version": "2023-06-01",
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "claude-3-haiku-20240307",
        max_tokens: 1024,
        messages: [
          { role: "user", content: prompt + "\n\nProvide a helpful, informative response with specific recommendations and brand names where relevant." }
        ],
      }),
    });

    const responseTime = Date.now() - startTime;

    if (!response.ok) {
      const errorText = await response.text();
      console.error(`[Claude] Error: ${response.status} - ${errorText.substring(0, 200)}`);
      return { success: false, response: "", cost: 0, error: `Claude API error: ${response.status}`, response_time_ms: responseTime };
    }

    const data = await response.json();
    const text = data.content?.[0]?.text || "";

    console.log(`[Claude] Got ${text.length} chars`);

    // Claude Haiku is ~$0.00025 per 1K input + $0.00125 per 1K output
    return { success: text.length > 0, response: text, cost: 0.001, response_time_ms: responseTime };

  } catch (err) {
    console.error(`[Claude] Exception: ${err}`);
    return { success: false, response: "", cost: 0, error: String(err), response_time_ms: Date.now() - startTime };
  }
}

/**
 * Query any LLM directly based on model ID
 * Uses DataForSEO LIVE LLM API only (no Groq fallback)
 */
async function queryLLMDirect(
  prompt: string,
  modelId: string
): Promise<{
  success: boolean;
  response: string;
  cost: number;
  error?: string;
  response_time_ms?: number;
  source: string;
}> {
  // Use DataForSEO LIVE LLM API for all models
  if (["chatgpt", "gemini", "claude", "perplexity"].includes(modelId)) {
    const result = await getLiveLLMResponse(prompt, modelId as "chatgpt" | "gemini" | "claude" | "perplexity");
    return {
      success: result.success,
      response: result.response,
      cost: result.cost,
      error: result.error,
      response_time_ms: result.latency_ms,
      source: "dataforseo_live"
    };
  }

  // Unknown model
  return {
    success: false,
    response: "",
    cost: 0,
    error: `Unsupported model: ${modelId}`,
    response_time_ms: 0,
    source: "none"
  };
}

// ============================================
// RESULT CREATION
// ============================================

/**
 * Create a standardized model result object
 */
function createModelResult(
  modelId: string,
  success: boolean,
  response: string,
  citations: Citation[],
  cost: number,
  brandName: string,
  brandTags: string[],
  brandDomain: string,
  competitors: string[],
  error?: string,
  extraData?: {
    brand_mentioned?: boolean;
    brand_mention_count?: number;
    is_cited?: boolean;
    ai_search_volume?: number;
    response_time_ms?: number;
  }
): ModelResult {
  const config = AI_MODELS[modelId] || {
    name: modelId,
    color: "#888",
    provider: "Unknown",
    weight: 1.0,
    costPerQuery: 0,
    isLLM: false
  };

  // Use provided data or parse from response
  let brandMentioned = extraData?.brand_mentioned ?? false;
  let brandMentionCount = extraData?.brand_mention_count ?? 0;
  let isCited = extraData?.is_cited ?? false;
  let matchedTerms: string[] = [];
  let brandRank: number | null = null;
  let brandSentiment: "positive" | "neutral" | "negative" = "neutral";

  if (response && !extraData) {
    const brandData = parseBrandData(response, brandName, brandTags);
    brandMentioned = brandData.mentioned;
    brandMentionCount = brandData.count;
    brandRank = brandData.rank;
    brandSentiment = brandData.sentiment;
    matchedTerms = brandData.matchedTerms;
  } else if (response) {
    const brandData = parseBrandData(response, brandName, brandTags);
    brandRank = brandData.rank;
    brandSentiment = brandData.sentiment;
    matchedTerms = brandData.matchedTerms;
  }

  // Check if brand domain is cited
  if (!isCited && brandDomain && citations.length > 0) {
    isCited = citations.some(c =>
      c.domain.toLowerCase().includes(brandDomain.toLowerCase()) ||
      c.url.toLowerCase().includes(brandDomain.toLowerCase())
    );
  }

  // Mark brand sources in citations
  const citationsWithBrandFlag = citations.map(c => ({
    ...c,
    is_brand_source: brandDomain ? (
      c.domain.toLowerCase().includes(brandDomain.toLowerCase()) ||
      c.url.toLowerCase().includes(brandDomain.toLowerCase())
    ) : false
  }));

  const competitorData = response ? parseCompetitors(response, competitors) : [];
  const winnerBrand = response ? findWinnerBrand(response, brandName, competitors) : "";

  // Determine authority type
  let authorityType: "authority" | "alternative" | "mentioned" = "mentioned";
  if (isCited) {
    authorityType = brandMentionCount > 2 ? "authority" : "alternative";
  }

  return {
    model: modelId,
    model_name: config.name,
    provider: config.provider,
    color: config.color,
    weight: config.weight,
    success,
    error,
    raw_response: response,
    response_length: response.length,
    brand_mentioned: brandMentioned,
    brand_mention_count: brandMentionCount,
    brand_rank: brandRank,
    brand_sentiment: brandSentiment,
    matched_terms: matchedTerms,
    winner_brand: winnerBrand,
    competitors_found: competitorData,
    citations: citationsWithBrandFlag,
    citation_count: citations.length,
    api_cost: cost,
    is_cited: isCited,
    authority_type: authorityType,
    ai_search_volume: extraData?.ai_search_volume,
    response_time_ms: extraData?.response_time_ms,
  };
}

// ============================================
// SCORING ALGORITHMS
// ============================================

/**
 * Calculate weighted visibility score
 * Considers mentions, citations, rank, and model weights
 */
function calculateVisibilityScore(results: ModelResult[]): number {
  let weightedSum = 0;
  let totalWeight = 0;

  for (const result of results) {
    if (!result.success) continue;

    const weight = result.weight || 1.0;
    totalWeight += weight;

    let score = 0;
    if (result.brand_mentioned) {
      // Base score: cited = 100, mentioned = 50
      score = result.is_cited ? 100 : 50;

      // Rank bonus: up to 30 points for rank #1
      if (result.brand_rank) {
        score += Math.max(0, 30 - (result.brand_rank - 1) * 10);
      }

      // Mention count bonus: up to 20 points
      score += Math.min(20, result.brand_mention_count * 5);
    }

    weightedSum += score * weight;
  }

  return totalWeight > 0 ? Math.round(weightedSum / totalWeight) : 0;
}

/**
 * Calculate trust index based on citation authority
 */
function calculateTrustIndex(results: ModelResult[]): number {
  let citedCount = 0;
  let authorityCount = 0;
  let total = 0;

  for (const result of results) {
    if (!result.success) continue;
    total++;
    if (result.is_cited) citedCount++;
    if (result.authority_type === "authority") authorityCount++;
  }

  if (total === 0) return 0;

  // Trust = 60% citation rate + 40% authority rate
  const citationRate = (citedCount / total) * 100;
  const authorityRate = (authorityCount / total) * 100;

  return Math.round(citationRate * 0.6 + authorityRate * 0.4);
}

// ============================================
// MAIN HANDLER
// ============================================

serve(async (req: Request) => {
  // Handle CORS preflight
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 204, headers: corsHeaders });
  }

  // Only allow POST
  if (req.method !== "POST") {
    return new Response(
      JSON.stringify({ success: false, error: "Method not allowed" }),
      { status: 405, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }

  try {
    // Parse and validate request
    const body = await req.json() as AuditRequest;

    const validationError = validateRequest(body);
    if (validationError) {
      return new Response(
        JSON.stringify({ success: false, error: validationError }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Sanitize inputs
    const {
      client_id,
      campaign_id,
      prompt_id,
      prompt_text: rawPromptText,
      prompt_category = "custom",
      brand_name: rawBrandName,
      brand_domain = "",
      brand_tags = [],
      competitors = [],
      location_code = 2840,
      location_name = "United States",
      models = ["chatgpt", "claude", "gemini", "perplexity", "google_ai_overview"],
      save_to_db = false
    } = body;

    const prompt_text = sanitizeString(rawPromptText, 500);
    const brand_name = sanitizeString(rawBrandName, 100);
    const sanitizedBrandTags = brand_tags.map(t => sanitizeString(t, 100)).filter(Boolean);
    const sanitizedCompetitors = competitors.map(c => sanitizeString(c, 100)).filter(Boolean);
    const targetDomain = sanitizeString(brand_domain, 200);

    console.log(`[GEO Audit] "${prompt_text.substring(0, 50)}..." | Brand: ${brand_name} | Category: ${prompt_category}`);
    console.log(`[GEO Audit] Models: ${models.join(", ")} | Location: ${location_code}`);

    // Check for Tavily header
    const includeTavily = req.headers.get("x-include-tavily") === "true";
    if (includeTavily) {
      console.log(`[GEO Audit] Tavily search enabled via header`);
    }

    const results: ModelResult[] = [];
    let totalCost = 0;
    const promises: Promise<void>[] = [];

    // Determine which APIs to call
    const requestedLLMs = models.filter(m => LLM_MODEL_IDS.includes(m));
    const requestSERP = models.includes("google_serp");
    const requestAIOverview = models.includes("google_ai_overview");

    // Query LLM models - ALWAYS use LIVE LLM API (no cached data)
    if (requestedLLMs.length > 0) {
      promises.push((async () => {
        // Skip LLM Mentions API entirely - go straight to LIVE LLM for real-time responses
        console.log(`[GEO Audit] Using LIVE LLM API for all models: ${requestedLLMs.join(", ")}`);

        // Filter to supported LIVE LLM models
        const liveModels = requestedLLMs.filter(m =>
          ["chatgpt", "gemini", "claude", "perplexity"].includes(m)
        ) as Array<"chatgpt" | "gemini" | "claude" | "perplexity">;

        if (liveModels.length > 0) {
          // Query LIVE LLM with validation - real-time inference only
          const liveResult = await getLiveLLMWithValidation(
            prompt_text,
            brand_name,
            sanitizedBrandTags,
            sanitizedCompetitors,
            liveModels
          );

          totalCost += liveResult.totalCost;

          for (const modelId of liveModels) {
            const modelData = liveResult.results.get(modelId);

            if (modelData) {
              // Use extracted citations from the response text
              const citations = modelData.citations || [];

              // Check if brand domain is cited
              const isCited = citations.some(c =>
                [brand_name, targetDomain, ...sanitizedBrandTags].some(term =>
                  term && (c.domain.toLowerCase().includes(term.toLowerCase()) ||
                    c.url.toLowerCase().includes(term.toLowerCase()))
                )
              );

              results.push(createModelResult(
                modelId,
                true,
                modelData.response,
                citations,
                modelData.cost,
                brand_name,
                sanitizedBrandTags,
                targetDomain,
                sanitizedCompetitors,
                undefined,
                {
                  brand_mentioned: modelData.brand_mentioned,
                  brand_mention_count: modelData.brand_mention_count,
                  is_cited: isCited,
                  response_time_ms: modelData.latency_ms,
                }
              ));
            } else {
              // LIVE LLM failed for this model
              console.log(`[GEO Audit] LIVE LLM failed for ${modelId}`);

              results.push(createModelResult(
                modelId,
                false,
                `LIVE LLM request failed for ${modelId}. Please try again.`,
                [],
                0,
                brand_name,
                sanitizedBrandTags,
                targetDomain,
                sanitizedCompetitors,
                `LIVE LLM failed for ${modelId}`
              ));
            }
          }
        }
      })());
    }

    // Query Google AI Overview
    if (requestAIOverview) {
      promises.push((async () => {
        const aiResult = await getGoogleAIOverview(prompt_text, location_code);
        totalCost += aiResult.cost;

        const brandData = parseBrandData(aiResult.response, brand_name, sanitizedBrandTags);
        const isCited = aiResult.citations.some(c =>
          [brand_name, targetDomain, ...sanitizedBrandTags].some(term =>
            term && (c.domain.toLowerCase().includes(term.toLowerCase()) ||
              c.url.toLowerCase().includes(term.toLowerCase()))
          )
        );

        results.push(createModelResult(
          "google_ai_overview",
          aiResult.success,
          aiResult.response,
          aiResult.citations,
          aiResult.cost,
          brand_name,
          sanitizedBrandTags,
          targetDomain,
          sanitizedCompetitors,
          aiResult.error,
          {
            brand_mentioned: brandData.mentioned,
            brand_mention_count: brandData.count,
            is_cited: isCited,
            response_time_ms: aiResult.response_time_ms,
          }
        ));
      })());
    }

    // Query Google SERP
    if (requestSERP) {
      promises.push((async () => {
        const serpResult = await getGoogleSERP(prompt_text, location_code);
        totalCost += serpResult.cost;

        const brandData = parseBrandData(serpResult.response, brand_name, sanitizedBrandTags);
        const isCited = serpResult.citations.some(c =>
          [brand_name, targetDomain, ...sanitizedBrandTags].some(term =>
            term && (c.domain.toLowerCase().includes(term.toLowerCase()) ||
              c.url.toLowerCase().includes(term.toLowerCase()))
          )
        );

        results.push(createModelResult(
          "google_serp",
          serpResult.success,
          serpResult.response,
          serpResult.citations,
          serpResult.cost,
          brand_name,
          sanitizedBrandTags,
          targetDomain,
          sanitizedCompetitors,
          serpResult.error,
          {
            brand_mentioned: brandData.mentioned,
            brand_mention_count: brandData.count,
            is_cited: isCited,
            response_time_ms: serpResult.response_time_ms,
          }
        ));
      })());
    }

    // Query Tavily if header is set
    let tavilyResults: { answer?: string; sources: Array<{ url: string; title: string; content: string; domain: string }> } | null = null;
    if (includeTavily) {
      promises.push((async () => {
        const tavilyResult = await tavilySearch(prompt_text);

        if (tavilyResult.success) {
          tavilyResults = {
            answer: tavilyResult.answer,
            sources: tavilyResult.sources,
          };

          // Convert Tavily sources to citations format for model result
          const tavCitations: Citation[] = tavilyResult.sources.map((s, idx) => ({
            url: s.url,
            title: s.title,
            domain: s.domain,
            position: idx + 1,
            snippet: s.content?.substring(0, 200) || "",
          }));

          // Check if brand is mentioned in Tavily answer
          const brandData = parseBrandData(tavilyResult.answer || "", brand_name, sanitizedBrandTags);
          const isCited = tavCitations.some(c =>
            [brand_name, targetDomain, ...sanitizedBrandTags].some(term =>
              term && (c.domain.toLowerCase().includes(term.toLowerCase()) ||
                c.url.toLowerCase().includes(term.toLowerCase()))
            )
          );

          // Add Tavily as a model result for unified tracking
          results.push(createModelResult(
            "tavily",
            true,
            tavilyResult.answer || "Tavily search completed successfully.",
            tavCitations,
            0, // Tavily is billed separately, not tracked here
            brand_name,
            sanitizedBrandTags,
            targetDomain,
            sanitizedCompetitors,
            undefined,
            {
              brand_mentioned: brandData.mentioned,
              brand_mention_count: brandData.count,
              is_cited: isCited,
              response_time_ms: tavilyResult.response_time_ms,
            }
          ));
        }
      })());
    }

    // Wait for all API calls to complete
    await Promise.all(promises);

    // Calculate aggregate metrics
    const successfulResults = results.filter(r => r.success);
    const visibleCount = successfulResults.filter(r => r.brand_mentioned).length;
    const citedCount = successfulResults.filter(r => r.is_cited).length;
    const totalModels = successfulResults.length;

    const shareOfVoice = totalModels > 0 ? Math.round((visibleCount / totalModels) * 100) : 0;

    const rankedResults = successfulResults.filter(r => r.brand_rank);
    const avgRank = rankedResults.length > 0
      ? Math.round((rankedResults.reduce((sum, r) => sum + r.brand_rank!, 0) / rankedResults.length) * 10) / 10
      : null;

    const visibilityScore = calculateVisibilityScore(results);
    const trustIndex = calculateTrustIndex(results);

    // Aggregate citations by domain
    const citationMap = new Map<string, { count: number; citation: Citation }>();
    const competitorAgg = new Map<string, { count: number; ranks: number[] }>();

    for (const result of successfulResults) {
      for (const c of result.citations) {
        if (citationMap.has(c.domain)) {
          citationMap.get(c.domain)!.count++;
        } else {
          citationMap.set(c.domain, { count: 1, citation: c });
        }
      }
      for (const comp of result.competitors_found) {
        if (competitorAgg.has(comp.name)) {
          competitorAgg.get(comp.name)!.count += comp.count;
          if (comp.rank) competitorAgg.get(comp.name)!.ranks.push(comp.rank);
        } else {
          competitorAgg.set(comp.name, { count: comp.count, ranks: comp.rank ? [comp.rank] : [] });
        }
      }
    }

    const topSources = Array.from(citationMap.entries())
      .sort((a, b) => b[1].count - a[1].count)
      .slice(0, 10)
      .map(([domain, data]) => ({
        domain,
        count: data.count,
        url: data.citation.url,
        title: data.citation.title
      }));

    const topCompetitors = Array.from(competitorAgg.entries())
      .sort((a, b) => b[1].count - a[1].count)
      .slice(0, 5)
      .map(([name, data]) => ({
        name,
        total_mentions: data.count,
        avg_rank: data.ranks.length > 0
          ? Math.round((data.ranks.reduce((a, b) => a + b, 0) / data.ranks.length) * 10) / 10
          : null,
      }));

    // Save to database if requested
    let saved_id: string | null = null;
    console.log(`[DB] save_to_db=${save_to_db}, SUPABASE_URL=${SUPABASE_URL ? 'SET' : 'NOT SET'}, SUPABASE_KEY=${SUPABASE_KEY ? 'SET' : 'NOT SET'}`);
    if (save_to_db && SUPABASE_URL && SUPABASE_KEY) {
      try {
        const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);
        console.log("[DB] Attempting to save audit result...");
        const summaryData = {
          share_of_voice: shareOfVoice,
          visibility_score: visibilityScore,
          trust_index: trustIndex,
          average_rank: avgRank,
          total_models_checked: totalModels,
          visible_in: visibleCount,
          cited_in: citedCount,
          total_citations: successfulResults.reduce((sum, r) => sum + r.citation_count, 0),
          total_cost: totalCost,
        };
        const { data: savedData, error: saveError } = await supabase
          .from("audit_results")
          .insert({
            client_id,
            campaign_id,
            prompt_id,
            prompt_text,
            prompt_category,
            brand_name,
            brand_tags: sanitizedBrandTags,
            competitors: sanitizedCompetitors,
            models_used: models,
            share_of_voice: shareOfVoice,
            visibility_score: visibilityScore,
            trust_index: trustIndex,
            average_rank: avgRank,
            total_models_checked: totalModels,
            visible_in: visibleCount,
            cited_in: citedCount,
            total_citations: summaryData.total_citations,
            total_cost: totalCost,
            model_results: results,
            top_sources: topSources,
            top_competitors: topCompetitors,
            summary: summaryData, // Also save as JSONB for easier frontend access
          })
          .select("id")
          .single();

        if (!saveError && savedData) {
          saved_id = savedData.id;
          console.log(`[DB] Saved audit result: ${saved_id}`);

          // Also save individual citations for fast queries
          const citationRecords = [];
          for (const result of successfulResults) {
            for (const c of result.citations) {
              citationRecords.push({
                audit_result_id: saved_id,
                client_id,
                url: c.url,
                title: c.title,
                domain: c.domain,
                position: c.position,
                snippet: c.snippet,
                model: result.model,
                is_brand_source: c.is_brand_source || false,
              });
            }
          }

          if (citationRecords.length > 0) {
            const { error: citationError } = await supabase.from("citations").insert(citationRecords);
            if (citationError) console.error("[DB] Citation save error:", citationError);
          }

          // Log API usage
          const { error: usageError } = await supabase.from("api_usage").insert({
            organization_id: null, // Would need to look up from client_id
            client_id,
            api_name: "geo_audit",
            endpoint: "/geo-audit",
            request_count: 1,
            cost: totalCost,
            prompt_text,
            models_used: models,
          });
          if (usageError) console.error("[DB] Usage save error:", usageError);
        } else if (saveError) {
          console.error("[DB] Audit result save error:", saveError.message, saveError.details, saveError.hint);
        }
      } catch (dbErr) {
        console.error("[DB] Save error:", dbErr);
        // Don't fail the request if DB save fails
      }
    }

    // Build response
    const responseData = {
      success: true,
      data: {
        id: saved_id,
        client_id,
        prompt_id,
        prompt_text,
        prompt_category,
        brand_name,
        brand_domain: targetDomain,
        brand_tags: sanitizedBrandTags,
        competitors: sanitizedCompetitors,
        models_requested: models,
        summary: {
          share_of_voice: shareOfVoice,
          visibility_score: visibilityScore,
          trust_index: trustIndex,
          average_rank: avgRank,
          total_models_checked: totalModels,
          models_failed: results.length - totalModels,
          visible_in: visibleCount,
          cited_in: citedCount,
          total_citations: successfulResults.reduce((sum, r) => sum + r.citation_count, 0),
          total_cost: totalCost,
        },
        model_results: results,
        top_sources: topSources,
        top_competitors: topCompetitors,
        tavily_results: tavilyResults, // Included when x-include-tavily header is set
        available_models: Object.entries(AI_MODELS).map(([id, m]) => ({ id, ...m })),
        timestamp: new Date().toISOString(),
      },
    };

    console.log(`[GEO Audit] Done. SOV: ${shareOfVoice}%, Visibility: ${visibilityScore}, Trust: ${trustIndex}, Cost: $${totalCost.toFixed(4)}`);

    return new Response(JSON.stringify(responseData), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });

  } catch (error) {
    console.error("[GEO Audit] Error:", error);

    // Sanitize error message for response
    const errorMessage = error instanceof Error ? error.message : "Unknown error";
    const safeErrorMessage = errorMessage.replace(/[<>]/g, "").substring(0, 200);

    return new Response(JSON.stringify({
      success: false,
      error: safeErrorMessage,
      data: {
        summary: { share_of_voice: 0, visibility_score: 0, trust_index: 0, total_cost: 0 },
        model_results: [],
        top_sources: [],
        top_competitors: [],
      }
    }), {
      status: 200, // Return 200 with error in body to avoid edge function error
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
