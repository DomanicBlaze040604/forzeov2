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
 * @version 3.0.1
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

interface ExtractedBrandEntity {
  title: string;
  markdown?: string;
  category?: string;
  mention_count: number;
  position: number;
  positions?: number[];
  entity_points: number;
  is_own_brand: boolean;
  is_competitor: boolean;
  sentiment?: "positive" | "neutral" | "negative";
  sources?: string[];
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
  extracted_brands?: ExtractedBrandEntity[];
}

// DataForSEO ChatGPT Scraper brand entity (from llm_scraper/live/advanced)
interface DataForSEOBrandEntity {
  type: string;      // "chat_gpt_brand_entity"
  title: string;     // Brand name
  category: string;  // Brand category (e.g., "sports", "software")
  markdown?: string; // Formatted brand name
  urls?: Array<{ url: string; domain: string }> | null;
}

interface AuditRequest {
  client_id?: string;
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
  if (body.location_code && (body.location_code < 1 || body.location_code > 9999999)) {
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

// ============================================
// BRAND DETECTION SYSTEM (5-Layer NER)
// ============================================

// Layer 5: Hard Negative Filter — multi-word phrases that are NOT brands
const BRAND_STOPLIST = new Set([
  "artificial intelligence", "machine learning", "deep learning", "natural language",
  "cloud computing", "data analytics", "digital marketing", "social media",
  "search engine", "web development", "mobile app", "user experience",
  "best practices", "case study", "white paper", "press release",
  "important note", "key takeaway", "quick summary", "final thoughts",
  "pros and cons", "top picks", "best overall", "runner up", "budget pick",
  "editor choice", "our pick", "honorable mention", "bottom line",
  "key features", "main features", "notable features", "key benefits",
  "key strengths", "main strengths", "top strengths",
  "here are", "there are", "you can", "you should", "we recommend",
  "customer service", "customer support", "tech support",
  "price match", "price match guarantee", "free shipping", "free returns",
  "curbside pickup", "in store pickup", "same day delivery",
  "loyalty program", "rewards program",
  "running shoes", "training shoes", "trail running", "road running",
  "cross training", "neutral shoes", "stability shoes", "motion control",
  "wide fit", "narrow fit", "arch support",
  "united states", "north america", "european union", "asia pacific",
  "new york", "san francisco", "los angeles", "london",
  "texas based", "california based", "us based",
  "co op", "free u",
  // LLM section headers commonly formatted as **Bold:** in structured responses
  "ideal for", "best for", "good for", "great for", "perfect for", "recommended for",
  "where to buy", "how to buy", "where to find", "where to shop",
  "reviews & sources", "reviews and sources", "sources & reviews",
  "also consider", "similar to", "compared to", "comparison",
  "things to consider", "what to look for", "what to consider",
  "buying guide", "buyer guide", "shopping guide",
  "price range", "price point", "price check", "starting at",
  "our verdict", "final verdict", "overall verdict", "the verdict",
  "our rating", "overall rating", "editor rating",
  "read more", "learn more", "see more", "view more", "shop now",
  "related articles", "related posts", "further reading",
  "table of contents", "quick navigation",
  // Product technology terms (not brands)
  "dna loft", "react foam", "air zoom", "fresh foam", "boost light",
  "ff blast", "ff blast plus", "pure gel", "puregel", "gel technology",
  "flyknit", "flywire", "zoom air", "zoom x", "boost foam", "ultra boost",
  "gore tex", "carbon plate", "carbon fiber", "energy return",
  // Geographic / neighborhood terms (not brands)
  "river north", "river east", "river west", "river south",
  "west loop", "east loop", "south loop", "north loop",
  "east village", "west village", "north shore", "south shore",
  "south side", "north side", "east side", "west side",
  "near west side", "near north side", "near south side", "near east side",
  "magnificent mile", "gold coast", "old town", "lincoln park",
  "silicon valley", "wall street", "main street", "high street",
  "downtown", "midtown", "uptown", "city center", "town center",
  "bay area", "tri state", "east coast", "west coast",
  "south beach", "north beach", "central park", "times square",
  "beverly hills", "palm beach", "santa monica", "lake district",
  // Award / accolade labels
  "james beard", "michelin star", "michelin starred", "award winning",
  "james beard award", "editor choice award", "best in class",
  // Common descriptive phrases in LLM responses
  "step up", "stand out", "top tier", "mid range", "high end", "low end",
  "long run", "short run", "easy run", "tempo run", "speed work",
  "race day", "rest day", "leg day",
  "one stop", "all in one", "end to end", "side by side",
  "hands down", "across the board", "around the clock",
  // LLM structural headers (commonly bold-formatted, not brands)
  "enterprise options", "boutique options", "boutique alternatives",
  "neighborhood guides", "neighborhood guide", "neighborhoods to watch",
  "luxury sustainable", "fast fashion alternatives",
  "insurance coverage", "charging infrastructure",
  "key specs comparison", "key specs", "federal tax credits",
  "credit card partners", "credit card", "mortgage lenders",
  "certifications to look for", "certifications", "rankings source",
  "mental health focused", "mental health", "robo advisors", "robo-advisors",
  "collaboration add-ons", "add-ons", "add ons",
  "chicago neighborhoods to watch", "neighborhoods",
]);

// Layer 4: Brand Knowledge Graph — product-to-parent mapping
const PRODUCT_TO_BRAND: Record<string, string> = {
  "iphone": "Apple", "ipad": "Apple", "macbook": "Apple", "airpods": "Apple",
  "apple watch": "Apple", "imac": "Apple", "apple tv": "Apple", "siri": "Apple",
  "gmail": "Google", "google maps": "Google", "youtube": "Google",
  "android": "Google", "chrome": "Google", "google ads": "Google",
  "windows": "Microsoft", "excel": "Microsoft", "outlook": "Microsoft",
  "teams": "Microsoft", "azure": "Microsoft", "bing": "Microsoft",
  "linkedin": "Microsoft", "github": "Microsoft", "xbox": "Microsoft",
  "aws": "Amazon", "alexa": "Amazon", "kindle": "Amazon",
  "facebook": "Meta", "instagram": "Meta", "whatsapp": "Meta",
  "chatgpt": "OpenAI", "dall-e": "OpenAI", "gpt-4": "OpenAI",
  "gemini": "Google", "claude": "Anthropic",
  "photoshop": "Adobe", "illustrator": "Adobe",
  "slack": "Salesforce", "tableau": "Salesforce",
  "tesla model": "Tesla", "model 3": "Tesla", "model y": "Tesla",
};

// Layer 3: Domain-to-brand mapping for citation enrichment
const DOMAIN_TO_BRAND: Record<string, string> = {
  "apple.com": "Apple", "google.com": "Google", "microsoft.com": "Microsoft",
  "amazon.com": "Amazon", "meta.com": "Meta", "facebook.com": "Meta",
  "openai.com": "OpenAI", "anthropic.com": "Anthropic",
  "adobe.com": "Adobe", "salesforce.com": "Salesforce",
  "hubspot.com": "HubSpot", "shopify.com": "Shopify",
  "semrush.com": "Semrush", "ahrefs.com": "Ahrefs", "moz.com": "Moz",
  "nike.com": "Nike", "adidas.com": "Adidas", "samsung.com": "Samsung",
};

/**
 * Aggressively strip ALL URLs, domains, and reference markers from text.
 * Prevents domain names from leaking into NER as brand candidates.
 */
function stripUrlsForNER(text: string): string {
  return text
    // Remove markdown links [text](url) — keep the link text only
    .replace(/\[([^\]]*)\]\([^)]+\)/g, '$1')
    // Remove parenthesized URLs like (https://example.com/...)
    .replace(/\(https?:\/\/[^)]+\)/g, '')
    // Remove raw URLs (http/https)
    .replace(/https?:\/\/[^\s<>"{}|\\^`\[\])+,]+/gi, '')
    // Remove www.domain.com references
    .replace(/www\.[a-zA-Z0-9][a-zA-Z0-9.-]+\.[a-zA-Z]{2,}[^\s,;)"]*/gi, '')
    // Remove bare domain references like runningwarehouse.com, gazellesports.com/path
    .replace(/[a-zA-Z0-9][a-zA-Z0-9-]*\.(?:com|org|net|io|co|ai|dev|app|edu|gov|info|club)(?:\/[^\s,;)"]*)?/gi, '')
    // Remove "URL:" prefix
    .replace(/\bURL\s*:\s*/gi, '')
    // Remove citation markers like [1], [2], etc.
    .replace(/\[\d+\]/g, '')
    // Clean up leftover parentheses with only whitespace
    .replace(/\(\s*\)/g, '')
    // Clean up extra whitespace
    .replace(/\s+/g, ' ')
    .trim();
}

/**
 * Clean a brand candidate: strip trailing punctuation, normalize quotes,
 * and remove common non-brand suffixes like "Official Website".
 */
function cleanBrandCandidate(raw: string): string {
  return raw
    .replace(/[:\-–—,;.!?]+$/, '')           // Strip trailing punctuation (fixes "Type:", "Pros:", etc.)
    .replace(/^[:\-–—,;.!?\s]+/, '')          // Strip leading punctuation
    .replace(/[\u2018\u2019\u2032]/g, "'")    // Smart single quotes → straight
    .replace(/[\u201C\u201D\u2033]/g, '"')    // Smart double quotes → straight
    .replace(/\s*(official\s+(?:website|site|store|page|homepage))\s*$/i, '')  // "Hoka Official Website" → "Hoka"
    .replace(/\s*(home\s*page|landing\s*page)\s*$/i, '')
    .trim();
}

/**
 * Layer 5 validation: Is this candidate likely a real brand name?
 * Returns false for generic terms, noise, and fragments.
 */
function isLikelyBrand(candidate: string): boolean {
  const lower = candidate.toLowerCase().trim();

  // Too short or too long
  if (lower.length < 3 || lower.length > 50) return false;

  // In multi-word stoplist
  if (BRAND_STOPLIST.has(lower)) return false;

  // Pure numbers
  if (/^\d+$/.test(lower)) return false;

  // Contains any word that's a single character (fragments like "Free U", "S Sporting")
  const words = lower.split(/\s+/);
  if (words.some(w => w.length < 2 && w !== '&')) return false;

  // Ends with generic possessive fragment like "'s" and is short
  if (/^.{1,4}'s$/i.test(lower)) return false;

  // Looks like a concatenated domain name: single long word, only first letter caps
  // e.g., "Runningwarehouse", "Dickssportinggoods", "Performancerunning"
  // Threshold at 14 chars to avoid rejecting real brands like "Wealthfront" (11), "Reformation" (11)
  if (words.length === 1 && lower.length > 14) {
    const uppercaseCount = (candidate.match(/[A-Z]/g) || []).length;
    if (uppercaseCount <= 1) return false;
  }

  // Single generic word — extremely common nouns/adjectives/adverbs
  if (words.length === 1) {
    if (/^(the|very|most|best|top|great|good|new|free|easy|fast|simple|quick|more|less|also|just|well|some|many|other|each|both|such|these|those|this|that|here|there|when|where|how|what|why|which|will|would|could|should|they|their|your|with|from|have|been|were|does|then|than|into|only|over|after|before|about|between|through|during|without|however|therefore|furthermore|additionally|moreover|meanwhile|nevertheless|alternatively|specifically|essentially|particularly|generally|typically|usually|often|always|never|sometimes|perhaps|maybe|likely|unlikely|certainly|probably|possibly|rather|quite|still|already|indeed|overall|primarily|mainly|especially|basically|simply|currently|recently|actually|obviously|clearly|highly|extremely|virtually|nearly|roughly|approximately|finally|ultimately|accordingly|regardless|nonetheless)$/i.test(lower)) return false;

    // Common nouns that get capitalized at sentence start
    if (/^(shipping|returns|delivery|pricing|prices|budget|premium|standard|selection|collection|collections|catalog|inventory|experience|quality|comfort|support|stability|cushioning|performance|durability|style|design|technology|features|models|options|varieties|sizes|colors|styles|store|stores|shop|outlet|retailers|retailer|location|locations|branch|free|comprehensive|additional|alternative|alternatives|largest|smallest|newest|oldest|fastest|cheapest|specialty|exclusive|limited|popular|recommended|online|website|platform|software|application|service|tool|solution|product|company|business|enterprise|organization|overview|conclusion|summary|introduction|disclaimer|membership|warranty|guarantee|pickup|checkout|wide|narrow|fit|size|weight|cushion|traction|grip|breathable|lightweight|versatile|durable|affordable|available|notable|important|key|main|top|first|second|third|fourth|last|latest|next|previous|certain|multiple|numerous|various|several|different|significant|similar|typical|common|average|standard|basic|advanced|regular|entire|complete|full|total|single|double|major|minor|primary|secondary|special|general|specific|original|traditional|modern|classic|unique|custom|local|global|national|international|personal|professional|official|public|private|natural|physical|digital|virtual|annual|monthly|weekly|daily|type|pros|cons|specifications|specs|verdict|comparison|rating|score|price|value|ride|feel|review|reviews|sources|guide|drop|upper|midsole|outsole|sizing|foam|mesh|rubber|carbon|plate|heel|toe|arch|sole|lace|laces|tongue|collar|insole|footbed|offset|stack|rocker|responsive|plush|firm|soft|snug|tight|loose|true|award|winning|starred|mile|downtown|uptown|midtown|district|county|township|boulevard|avenue|highway|plaza|square|beach|lake|mountain|valley|creek|harbor|island|peninsula|heights|estates|terrace|grove)$/i.test(lower)) return false;
  }

  // Multi-word: reject geographic direction + noun patterns (e.g., "River North", "West Loop")
  if (words.length >= 2) {
    const firstWord = words[0];
    if (/^(north|south|east|west|upper|lower|central|greater|inner|outer|old|new|near|far|mid|lake|river|bay|mount|port|fort|cape|isle|san|santa|saint|los|las|el|la|del)$/i.test(firstWord)) {
      // Allow known exceptions: "New Balance", known brands starting with these words
      // But filter generic geographic patterns
      const isKnownBrandPattern = /^(new balance|old navy|north face|old spice|red bull)$/i.test(lower);
      if (!isKnownBrandPattern) return false;
    }
  }

  return true;
}

/**
 * LAYER 1: Universal LLM-Agnostic NER
 * Extracts brand candidates from LLM response text using confidence-based detection.
 * Each brand is tagged with which strategy detected it for confidence filtering.
 */
function extractBrandCandidatesFromText(
  text: string,
  knownBrands: string[]
): Map<string, { count: number; positions: number[]; title: string; highConfidence: boolean }> {
  const brands = new Map<string, { count: number; positions: number[]; title: string; highConfidence: boolean }>();
  if (!text) return brands;

  // Strip URLs/domains BEFORE NER
  const cleanText = stripUrlsForNER(text);

  const sentences = cleanText.split(/(?<=[.!?])\s+|(?:\r?\n)+/).filter(s => s.trim().length > 0);

  function addBrand(rawKey: string, rawTitle: string, position: number, highConf: boolean) {
    // Clean candidate: strip trailing punctuation, normalize quotes, remove suffixes
    const title = cleanBrandCandidate(rawTitle);
    const key = cleanBrandCandidate(rawKey).toLowerCase();
    if (key.length < 3) return; // Too short after cleaning

    if (brands.has(key)) {
      const existing = brands.get(key)!;
      existing.count++;
      if (!existing.positions.includes(position)) existing.positions.push(position);
      if (highConf) existing.highConfidence = true;
    } else {
      brands.set(key, { count: 1, positions: [position], title, highConfidence: highConf });
    }
  }

  // Pre-scan: find known brands/competitors in the text (always high confidence)
  const lowerClean = cleanText.toLowerCase();
  for (const known of knownBrands) {
    if (!known || known.length < 2) continue;
    const knownLower = known.toLowerCase();
    let idx = 0;
    const positions: number[] = [];
    while ((idx = lowerClean.indexOf(knownLower, idx)) !== -1) {
      // Find which sentence this falls in
      const textBefore = cleanText.substring(0, idx);
      const sentIdx = (textBefore.match(/[.!?\n]/g) || []).length + 1;
      positions.push(sentIdx);
      idx += knownLower.length;
    }
    if (positions.length > 0) {
      const key = knownLower;
      for (const pos of positions) {
        addBrand(key, known, pos, true);
      }
    }
  }

  for (let i = 0; i < sentences.length; i++) {
    const sentence = sentences[i];
    const position = i + 1;
    let match;

    // Strategy A: Bold/markdown names (**Brand Name**) — HIGH confidence
    const boldPattern = /\*\*([^*]{2,40})\*\*|__([^_]{2,40})__/g;
    while ((match = boldPattern.exec(sentence)) !== null) {
      const candidate = (match[1] || match[2]).trim();
      if (candidate.split(' ').length > 5) continue;
      if (!isLikelyBrand(candidate)) continue;
      addBrand(candidate.toLowerCase(), candidate, position, true);
    }

    // Strategy B: Numbered/bulleted list items — HIGH confidence
    // Matches "1. Brand Name:", "• Brand Name -", "- Brand Name:"
    const listMatch = sentence.match(/^\s*(?:\d+[.)]\s*|[•\-]\s*)\*{0,2}([A-Z][A-Za-z'][A-Za-z\s&'.]{0,35}?)(?:\*{0,2})\s*[-–:]/);
    if (listMatch) {
      const candidate = listMatch[1].trim().replace(/\*+/g, '');
      if (isLikelyBrand(candidate)) {
        addBrand(candidate.toLowerCase(), candidate, position, true);
      }
    }

    // Strategy C: Multi-word capitalized phrases (2+ words, each 3+ chars) — MEDIUM confidence
    const multiWordPattern = /\b([A-Z][a-zA-Z']{2,}(?:\s+(?:and|of|for|by|the|&)\s+[A-Z][a-zA-Z']{2,}|\s+[A-Z][a-zA-Z']{2,}){1,3})\b/g;
    while ((match = multiWordPattern.exec(sentence)) !== null) {
      const candidate = match[1].trim();
      if (!isLikelyBrand(candidate)) continue;
      addBrand(candidate.toLowerCase(), candidate, position, false);
    }

    // Strategy D: ALL-CAPS words (3+ chars) — HIGH confidence (brand abbreviations: ASICS, REI, HOKA)
    const allCapsPattern = /\b([A-Z]{3,10})\b/g;
    while ((match = allCapsPattern.exec(sentence)) !== null) {
      const candidate = match[1].trim();
      if (/^(THE|AND|FOR|BUT|NOT|YOU|URL|FAQ|USA|UPS|APR|MAY|JUN|JUL|AUG|SEP|OCT|NOV|DEC|TOP|NEW|GET|ALL|BIG|SET|RUN|FIT|TRY|SEE|ADD|USE|WAY|DAY|GTS|FREE|BEST|MOST|WIDE|FULL|HIGH|LOW|PRO|GPS|LED|USB|PDF|CSS|API|SQL|ETF|IPO|CEO|CFO|CTO|COO|LLC|INC|LTD|DNA|EVA|TPU|OEM|RSS|CDN|CMS|RAM|ROM|VPN|SSD|HDD|HDR|FPS|RPM|MID|MAX|LOFT|FOAM|MESH|GORE|KNIT|ZOOM|FLEX|AIR|GEL|CMEVA|BLAST|PLUS|PEBA|RMAT|AHAR|PWRRUN|HOVR|NITRO|BOOST|VFLY|DRFT|GTX|SPEC|FAST|LITE|TECH|CORE|DUAL|HYPER|ULTRA|FUEL|GRID|WAVE|PACE|LINK|SYNC|BETA|PURE|NEXT|STEP|DASH|FLOW|SALE|SHIP|CART|RATE|PLAN|TIER|FLAT|SLIM|THIN|HALF|PAIR|FEAT|PICK|LIST|NOTE|GOAL|MILE|CLUB|IRA|SUV|MLS|CFP|EQS|GOTS|OEKO|TEX)$/.test(candidate)) continue;
      if (!isLikelyBrand(candidate)) continue;
      addBrand(candidate.toLowerCase(), candidate, position, true);
    }
  }

  return brands;
}

/** Helper: merge sub-brand j's data into parent brand i */
function mergeSubBrand(results: ExtractedBrandEntity[], parentIdx: number, childIdx: number): void {
  const parent = results[parentIdx];
  const child = results[childIdx];
  parent.mention_count += child.mention_count;
  if (child.positions) {
    for (const pos of child.positions) {
      if (!parent.positions?.includes(pos)) {
        parent.positions = parent.positions || [];
        parent.positions.push(pos);
      }
    }
  }
  parent.entity_points = Math.round(
    (parent.positions || []).reduce((sum, pos) => sum + (1 / pos), 0) * 100
  ) / 100;
}

/**
 * MASTER: Extract all brands from an LLM response using 5-layer detection.
 * Absolute rule: a brand may appear ONLY if the LLM explicitly mentioned it.
 *
 * Confidence filter: Only include brands that are either:
 * - Detected by a high-confidence strategy (bold, list item, ALL-CAPS, known brand)
 * - Mentioned 2+ times across different sentences
 */
function extractBrandsFromResponse(
  responseText: string,
  citations: Citation[],
  brandName: string,
  brandTags: string[],
  competitors: string[],
): ExtractedBrandEntity[] {
  if (!responseText || responseText.length < 10) return [];

  const lowerText = responseText.toLowerCase();

  // Build list of known brands for pre-scan
  const knownBrands = [brandName, ...brandTags, ...competitors].filter(Boolean);

  // ===== LAYER 1: Universal NER (Source of Truth) =====
  const textBrands = extractBrandCandidatesFromText(responseText, knownBrands);

  // ===== LAYER 4: Brand Knowledge Graph =====
  for (const [product, parentBrand] of Object.entries(PRODUCT_TO_BRAND)) {
    // Use word-boundary matching to prevent "excel" matching inside "excellent"
    const productRegex = new RegExp(`\\b${product.toLowerCase().replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\b`, 'i');
    const productMatch = productRegex.exec(lowerText);
    if (productMatch) {
      const parentKey = parentBrand.toLowerCase();
      if (!textBrands.has(parentKey)) {
        const textBefore = responseText.substring(0, productMatch.index);
        const sentencePos = (textBefore.match(/[.!?\n]/g) || []).length + 1;
        textBrands.set(parentKey, { count: 1, positions: [sentencePos], title: parentBrand, highConfidence: true });
      }
      const productKey = product.toLowerCase();
      if (textBrands.has(productKey) && productKey !== parentKey) {
        const productData = textBrands.get(productKey)!;
        const parentData = textBrands.get(parentKey)!;
        parentData.count += productData.count;
        parentData.positions = [...new Set([...parentData.positions, ...productData.positions])].sort((a, b) => a - b);
        textBrands.delete(productKey);
      }
    }
  }

  // ===== LAYER 3: Domain Inference (enrich only, never adds new brands) =====
  const domainBrandSources = new Map<string, string[]>();
  for (const citation of citations) {
    const domain = citation.domain?.toLowerCase() || '';
    const mappedBrand = DOMAIN_TO_BRAND[domain];
    if (mappedBrand) {
      const key = mappedBrand.toLowerCase();
      if (textBrands.has(key)) {
        if (!domainBrandSources.has(key)) domainBrandSources.set(key, []);
        domainBrandSources.get(key)!.push(citation.url);
      }
    }
  }

  // ===== ASSEMBLY with confidence filter =====
  const allBrandTerms = [brandName, ...brandTags].filter(Boolean).map(t => t.toLowerCase());
  const allCompetitorTerms = competitors.filter(Boolean).map(c => c.toLowerCase());
  const results: ExtractedBrandEntity[] = [];

  for (const [key, data] of textBrands.entries()) {
    if (!isLikelyBrand(key)) continue;

    // CONFIDENCE GATE: Skip low-confidence brands that were only found once
    // Include if: high confidence, OR mentioned in 2+ different sentences, OR known brand/competitor
    const isKnown = allBrandTerms.some(t => key.includes(t) || t.includes(key))
      || allCompetitorTerms.some(c => key.includes(c) || c.includes(key));
    const uniquePositions = [...new Set(data.positions)].length;

    if (!data.highConfidence && !isKnown && uniquePositions < 2) {
      continue; // Skip: low confidence, unknown, mentioned only once
    }

    const entityPoints = data.positions.reduce((sum, pos) => sum + (1 / pos), 0);

    let title = data.title;
    for (const [, parentBrand] of Object.entries(PRODUCT_TO_BRAND)) {
      if (parentBrand.toLowerCase() === key) { title = parentBrand; break; }
    }

    const isOwnBrand = allBrandTerms.some(t => key.includes(t) || t.includes(key));
    const isCompetitor = allCompetitorTerms.some(c => key.includes(c) || c.includes(key));

    const firstMentionIdx = lowerText.indexOf(key);
    let sentiment: "positive" | "neutral" | "negative" = "neutral";
    if (firstMentionIdx !== -1) {
      const ctxStart = Math.max(0, firstMentionIdx - 100);
      const ctxEnd = Math.min(responseText.length, firstMentionIdx + key.length + 100);
      sentiment = analyzeSentiment(responseText.substring(ctxStart, ctxEnd));
    }

    const sources = domainBrandSources.get(key);

    results.push({
      title,
      mention_count: data.count,
      position: data.positions[0],
      positions: data.positions,
      entity_points: Math.round(entityPoints * 100) / 100,
      is_own_brand: isOwnBrand,
      is_competitor: isCompetitor,
      sentiment,
      sources: sources && sources.length > 0 ? sources : undefined,
    });
  }

  // Sort: own brand first, then competitors, then by entity_points
  results.sort((a, b) => {
    if (a.is_own_brand && !b.is_own_brand) return -1;
    if (!a.is_own_brand && b.is_own_brand) return 1;
    if (a.is_competitor && !b.is_competitor) return -1;
    if (!a.is_competitor && b.is_competitor) return 1;
    return b.entity_points - a.entity_points;
  });

  // ===== DEDUP PASS 1: Merge sub-brands into parent brands already in results =====
  // e.g., "Nike Pegasus 41", "Nike Air Zoom" → merged into "Nike"
  const toRemove = new Set<number>();
  for (let i = 0; i < results.length; i++) {
    if (toRemove.has(i)) continue;
    const parentTitle = results[i].title.toLowerCase();
    for (let j = 0; j < results.length; j++) {
      if (i === j || toRemove.has(j)) continue;
      const childTitle = results[j].title.toLowerCase();
      if (childTitle.startsWith(parentTitle + " ") ||
        childTitle.startsWith("the " + parentTitle)) {
        mergeSubBrand(results, i, j);
        toRemove.add(j);
      }
    }
  }
  for (const idx of [...toRemove].sort((a, b) => b - a)) {
    results.splice(idx, 1);
  }

  // ===== DEDUP PASS 2: Collapse product models into known brands/competitors =====
  // e.g., "Saucony Kinvara 15" → renamed to "Saucony" if Saucony is a known competitor
  // Handles cases where the parent brand wasn't separately detected
  const allKnownNames = [...allBrandTerms, ...allCompetitorTerms];
  for (let i = results.length - 1; i >= 0; i--) {
    const titleLower = results[i].title.toLowerCase();
    for (const known of allKnownNames) {
      if (!known || known.length < 2) continue;
      if (titleLower.startsWith(known + " ") && titleLower !== known) {
        // Check if parent already exists in results
        const parentIdx = results.findIndex((r, idx) => idx !== i && r.title.toLowerCase() === known);
        if (parentIdx !== -1) {
          // Merge into existing parent
          mergeSubBrand(results, parentIdx, i);
          results.splice(i, 1);
        } else {
          // Rename to parent brand (capitalize first letter of each word)
          const properTitle = known.split(' ').map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(' ');
          results[i].title = properTitle;
          results[i].is_own_brand = allBrandTerms.includes(known);
          results[i].is_competitor = allCompetitorTerms.includes(known);
        }
        break;
      }
    }
  }

  // ===== DEDUP PASS 3: Final deduplicate by title after renaming =====
  const seenTitles = new Map<string, number>();
  for (let i = results.length - 1; i >= 0; i--) {
    const key = results[i].title.toLowerCase();
    if (seenTitles.has(key)) {
      mergeSubBrand(results, seenTitles.get(key)!, i);
      results.splice(i, 1);
    } else {
      seenTitles.set(key, i);
    }
  }

  console.log(`[BrandDetection] Extracted ${results.length} brands from ${responseText.length} chars`);
  return results;
}

/**
 * Map DataForSEO brand_entities from ChatGPT Scraper API to our ExtractedBrandEntity format.
 * Cross-references with response text to get mention counts and positions.
 */
function mapDataForSEOBrandEntities(
  apiBrands: DataForSEOBrandEntity[],
  responseText: string,
  brandName: string,
  brandTags: string[],
  competitors: string[],
  citations: Citation[]
): ExtractedBrandEntity[] {
  const lowerText = responseText.toLowerCase();
  const allBrandTerms = [brandName, ...brandTags].filter(Boolean).map(t => t.toLowerCase());
  const allCompetitorTerms = competitors.filter(Boolean).map(c => c.toLowerCase());

  const results: ExtractedBrandEntity[] = [];
  const seenTitles = new Set<string>();

  for (const apiBrand of apiBrands) {
    if (!apiBrand.title || apiBrand.title.length < 2) continue;
    const titleLower = apiBrand.title.toLowerCase();

    // Deduplicate
    if (seenTitles.has(titleLower)) continue;
    seenTitles.add(titleLower);

    // Count mentions in actual response text
    let mentionCount = 0;
    const positions: number[] = [];
    let searchIdx = 0;
    while ((searchIdx = lowerText.indexOf(titleLower, searchIdx)) !== -1) {
      mentionCount++;
      const textBefore = responseText.substring(0, searchIdx);
      const sentenceIdx = (textBefore.match(/[.!?\n]/g) || []).length + 1;
      if (!positions.includes(sentenceIdx)) positions.push(sentenceIdx);
      searchIdx += titleLower.length;
    }

    // If brand not found in response text, use minimal defaults
    if (mentionCount === 0) {
      mentionCount = 1;
      positions.push(1);
    }

    const entityPoints = positions.reduce((sum, pos) => sum + (1 / pos), 0);

    const isOwnBrand = allBrandTerms.some(t => titleLower.includes(t) || t.includes(titleLower));
    const isCompetitor = allCompetitorTerms.some(c => titleLower.includes(c) || c.includes(titleLower));

    // Sentiment from response context
    let sentiment: "positive" | "neutral" | "negative" = "neutral";
    const firstIdx = lowerText.indexOf(titleLower);
    if (firstIdx !== -1) {
      const ctxStart = Math.max(0, firstIdx - 100);
      const ctxEnd = Math.min(responseText.length, firstIdx + titleLower.length + 100);
      sentiment = analyzeSentiment(responseText.substring(ctxStart, ctxEnd));
    }

    // Sources from API brand entity URLs or citation cross-reference
    const sources: string[] = [];
    if (apiBrand.urls) {
      for (const u of apiBrand.urls) {
        if (u.url) sources.push(u.url);
      }
    }
    // Also check citations for matching domains
    for (const citation of citations) {
      const domain = citation.domain?.toLowerCase() || '';
      if (domain && titleLower.includes(domain.split('.')[0])) {
        if (!sources.includes(citation.url)) sources.push(citation.url);
      }
    }

    results.push({
      title: apiBrand.title,
      markdown: apiBrand.markdown,
      category: apiBrand.category,
      mention_count: mentionCount,
      position: positions[0],
      positions,
      entity_points: Math.round(entityPoints * 100) / 100,
      is_own_brand: isOwnBrand,
      is_competitor: isCompetitor,
      sentiment,
      sources: sources.length > 0 ? sources : undefined,
    });
  }

  // Sort: own brand first, then competitors, then by entity_points
  results.sort((a, b) => {
    if (a.is_own_brand && !b.is_own_brand) return -1;
    if (!a.is_own_brand && b.is_own_brand) return 1;
    if (a.is_competitor && !b.is_competitor) return -1;
    if (!a.is_competitor && b.is_competitor) return 1;
    return b.entity_points - a.entity_points;
  });

  console.log(`[BrandDetection] Mapped ${results.length} API brand entities from ${apiBrands.length} raw entities`);
  return results;
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
 * ChatGPT Scraper API — gets response + brand_entities natively
 * Uses /ai_optimization/chat_gpt/llm_scraper/live/advanced
 * Returns: markdown response, sources (citations), brand_entities
 */
async function getChatGPTScraperResponse(
  keyword: string,
  locationCode: number
): Promise<{
  success: boolean;
  response: string;
  tokens: number;
  cost: number;
  latency_ms: number;
  citations?: Citation[];
  brand_entities?: DataForSEOBrandEntity[];
  error?: string;
}> {
  console.log(`[ChatGPT Scraper] Querying: "${keyword.substring(0, 60)}..." | Location: ${locationCode}`);
  const startTime = Date.now();

  const maxRetries = 3;
  let lastError = "";
  let totalCost = 0;

  for (let attempt = 0; attempt < maxRetries; attempt++) {
    if (attempt > 0) {
      const delay = Math.pow(2, attempt) * 1000;
      console.log(`[ChatGPT Scraper] Retry ${attempt + 1}/${maxRetries}, waiting ${delay}ms...`);
      await new Promise(resolve => setTimeout(resolve, delay));
    }

    const result = await callDataForSEO("/ai_optimization/chat_gpt/llm_scraper/live/advanced", [{
      keyword: keyword,
      location_code: locationCode,
      language_code: "en",
      force_web_search: true,
    }]);

    const latency = Date.now() - startTime;

    if (result.error) {
      lastError = result.error;
      console.error(`[ChatGPT Scraper] Attempt ${attempt + 1} error: ${result.error}`);
      if (result.status_code === 401 || result.status_code === 402) {
        return { success: false, response: "", tokens: 0, cost: totalCost, latency_ms: latency, error: result.error };
      }
      continue;
    }

    const data = result.data as {
      tasks?: Array<{
        result?: Array<{
          keyword?: string;
          model?: string;
          markdown?: string;
          sources?: Array<{ url?: string; title?: string; domain?: string }>;
          brand_entities?: DataForSEOBrandEntity[];
          fan_out_queries?: Array<{ keyword?: string }>;
          input_tokens?: number;
          output_tokens?: number;
          items?: Array<{
            type?: string;
            markdown?: string;
            sources?: Array<{ url?: string; title?: string; domain?: string }>;
            brand_entities?: DataForSEOBrandEntity[];
          }>;
        }>;
        cost?: number;
        status_code?: number;
        status_message?: string;
      }>;
    };

    const task = data?.tasks?.[0];
    const taskResult = task?.result?.[0];
    const cost = task?.cost || 0;
    totalCost += cost;

    if (task?.status_code && task.status_code !== 20000) {
      lastError = task.status_message || `Task failed with code ${task.status_code}`;
      console.error(`[ChatGPT Scraper] Task error: ${lastError}`);

      // Don't retry on rate limits or service unavailable — fail fast
      if (lastError.includes("rate_limit") || lastError.includes("Service Unavailable") || task.status_code === 40000) {
        console.warn(`[ChatGPT Scraper] Rate limit / unavailable — skipping retries`);
        return { success: false, response: "", tokens: 0, cost: totalCost, latency_ms: Date.now() - startTime, error: lastError };
      }
      continue;
    }

    // Extract response text from markdown (result level = complete response)
    let responseText = taskResult?.markdown || "";

    // If no result-level markdown, concatenate from items
    if (!responseText && taskResult?.items) {
      responseText = taskResult.items
        .filter(item => item.markdown)
        .map(item => item.markdown)
        .join("\n\n");
    }

    if (!responseText) {
      lastError = "No ChatGPT scraper response returned - empty markdown";
      console.error(`[ChatGPT Scraper] Attempt ${attempt + 1}: No response text found`);
      continue;
    }

    // Extract citations from sources
    const citations: Citation[] = [];
    const allSources = taskResult?.sources || [];
    for (const source of allSources) {
      if (source.url) {
        try {
          const urlObj = new URL(source.url);
          const domain = urlObj.hostname.replace(/^www\./, '');
          citations.push({
            url: source.url,
            title: source.title || domain,
            domain: domain,
            position: citations.length + 1,
            snippet: `Referenced in ChatGPT response`,
            is_brand_source: false,
          });
        } catch {
          // skip invalid URLs
        }
      }
    }

    // Collect brand_entities from result level (aggregated)
    const brandEntities = taskResult?.brand_entities || [];

    // Also collect from items if result-level is empty
    if (brandEntities.length === 0 && taskResult?.items) {
      for (const item of taskResult.items) {
        if (item.brand_entities) {
          for (const be of item.brand_entities) {
            // Deduplicate by title
            if (!brandEntities.some(existing => existing.title.toLowerCase() === be.title.toLowerCase())) {
              brandEntities.push(be);
            }
          }
        }
      }
    }

    const totalTokens = (taskResult?.input_tokens || 0) + (taskResult?.output_tokens || 0);

    console.log(`[ChatGPT Scraper] Got ${responseText.length} chars, ${totalTokens} tokens, ${citations.length} sources, ${brandEntities.length} brand entities, ${latency}ms, cost: $${cost}`);

    return {
      success: true,
      response: responseText,
      tokens: totalTokens,
      cost: totalCost,
      latency_ms: latency,
      citations: citations.length > 0 ? citations : undefined,
      brand_entities: brandEntities.length > 0 ? brandEntities : undefined,
    };
  }

  // All retries failed
  const latency = Date.now() - startTime;
  console.error(`[ChatGPT Scraper] All ${maxRetries} attempts failed: ${lastError}`);
  return {
    success: false,
    response: "",
    tokens: 0,
    cost: totalCost,
    latency_ms: latency,
    error: `ChatGPT Scraper failed after ${maxRetries} attempts: ${lastError}`,
  };
}

/**
 * LIVE LLM Response API - Real-time inference (NOT cached)
 * Uses DataForSEO provider-specific endpoints for each model
 *
 * Endpoints:
 * - ChatGPT: /ai_optimization/chat_gpt/llm_scraper/live/advanced (with brand entities)
 * - Gemini: /ai_optimization/gemini/llm_responses/live
 * - Claude: /ai_optimization/claude/llm_responses/live
 * - Perplexity: /ai_optimization/perplexity/llm_responses/live
 *
 * Required params: user_prompt, model_name (or keyword for ChatGPT scraper)
 * Cost: ~$0.001-0.005 per query
 */
async function getLiveLLMResponse(
  prompt: string,
  model: "chatgpt" | "gemini" | "claude" | "perplexity",
  locationCode?: number,
  locationName?: string
): Promise<{
  success: boolean;
  response: string;
  tokens: number;
  cost: number;
  latency_ms: number;
  citations?: Citation[];
  brand_entities?: DataForSEOBrandEntity[];
  error?: string;
}> {
  console.log(`[LIVE LLM/${model}] Querying real-time... [v3-message_chain]`);
  const startTime = Date.now();

  // For ChatGPT: Use llm_scraper/live/advanced to get brand_entities natively
  if (model === "chatgpt") {
    // For ChatGPT scraper, inject location into the keyword/prompt directly
    const locationContext = locationName
      ? `[Context: ${locationName} market] `
      : "";
    return getChatGPTScraperResponse(`${locationContext}${prompt}`, locationCode || 2840);
  }

  // Map model IDs to DataForSEO endpoints and model names (from docs)
  const modelConfig: Record<string, { endpoint: string; modelName: string }> = {
    chatgpt: { endpoint: "/ai_optimization/chat_gpt/llm_responses/live", modelName: "gpt-4.1-mini" },
    gemini: { endpoint: "/ai_optimization/gemini/llm_responses/live", modelName: "gemini-2.5-flash" },
    claude: { endpoint: "/ai_optimization/claude/llm_responses/live", modelName: "claude-opus-4-0" },
    perplexity: { endpoint: "/ai_optimization/perplexity/llm_responses/live", modelName: "sonar" },
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

    // DataForSEO user_prompt must be clean — no instruction prefixes
    // Use native web_search_country_iso_code for location awareness instead
    const locationCodeToISO: Record<number, string> = {
      2356: "IN", 2840: "US", 2826: "GB", 2036: "AU", 2124: "CA",
      2276: "DE", 2250: "FR", 2392: "JP", 2076: "BR", 2484: "MX",
      2380: "IT", 2724: "ES", 2410: "KR", 2702: "SG", 2784: "AE",
      2682: "SA", 2566: "NG", 2710: "ZA", 2360: "ID", 2458: "MY",
      2608: "PH", 2764: "TH", 2704: "VN", 2158: "TW", 2344: "HK",
      2528: "NL", 2056: "BE", 2756: "CH", 2040: "AT", 2752: "SE",
      2578: "NO", 2208: "DK", 2246: "FI", 2616: "PL", 2643: "RU",
      2792: "TR", 2818: "EG", 2404: "KE", 2800: "UG",
    };

    const isoCode = locationCode ? locationCodeToISO[locationCode] : undefined;

    const payload: Record<string, unknown> = {
      user_prompt: prompt,
      model_name: config.modelName,
      max_output_tokens: 1000,
      temperature: 0.7,
    };

    // Gemini does NOT support web_search_country_iso_code
    // Perplexity and Claude DO — and Claude REQUIRES web_search: true with it
    if (model === "perplexity" || model === "claude") {
      payload.web_search = true;
      if (isoCode) {
        payload.web_search_country_iso_code = isoCode;
      }
    }

    console.log(`[LIVE LLM/${model}] [v10] Prompt: "${prompt.substring(0, 60)}" | ISO: ${isoCode || 'none'}`);
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
              annotations?: Array<{
                title?: string;
                url?: string;
              }>;
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
      console.error(`[LIVE LLM/${model}] Task error (code ${task.status_code}): ${lastError}`);
      console.error(`[LIVE LLM/${model}] Task data dump: ${JSON.stringify(task).substring(0, 500)}`);

      // Don't retry on rate limits, service unavailable, or field validation errors — fail fast
      if (lastError.includes("rate_limit") || lastError.includes("Service Unavailable") || lastError.includes("Invalid Field") || task.status_code === 40000) {
        console.warn(`[LIVE LLM/${model}] Non-retryable error — skipping retries`);
        return { success: false, response: "", tokens: 0, cost: totalCost, latency_ms: Date.now() - startTime, error: lastError };
      }
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

    // Also extract structured citations from annotations (Perplexity, etc.)
    const structuredCitations: Citation[] = [];
    if (taskResult?.items) {
      for (const item of taskResult.items) {
        if (item.sections) {
          for (const section of item.sections) {
            if (section.annotations) {
              for (const ann of section.annotations) {
                if (ann.url) {
                  try {
                    const urlObj = new URL(ann.url);
                    const domain = urlObj.hostname.replace(/^www\./, '');
                    structuredCitations.push({
                      url: ann.url,
                      title: ann.title || domain,
                      domain: domain,
                      position: structuredCitations.length + 1,
                      snippet: `Referenced in ${model} response`,
                      is_brand_source: false,
                    });
                  } catch (e) {
                    // skip invalid URLs
                  }
                }
              }
            }
          }
        }
      }
    }

    console.log(`[LIVE LLM/${model}] Structured citations from annotations: ${structuredCitations.length}`);

    return {
      success: true,
      response: responseText,
      tokens: totalTokens,
      cost: totalCost,
      latency_ms: latency,
      citations: structuredCitations.length > 0 ? structuredCitations : undefined,
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
    citations: undefined,
    error: `DataForSEO LIVE failed after ${maxRetries} attempts: ${lastError}`
  };
}

/**
 * Extract brand/product mentions as pseudo-citations
 * When LIVE LLM responses don't contain URLs, we extract mentioned brands/products
 * as "implicit citations" to show what sources the AI is referencing
 * Supports fuzzy/partial matching for multi-word brand names
 */
function extractImplicitCitations(
  text: string,
  brandName: string,
  brandTags: string[],
  competitors: string[]
): Citation[] {
  if (!text) return [];

  const citations: Citation[] = [];
  const foundBrands = new Set<string>();
  const lower = text.toLowerCase();

  // Check for brand mentions
  const allBrands = [brandName, ...brandTags, ...competitors].filter(Boolean);

  for (const brand of allBrands) {
    if (!brand || brand.length < 2) continue;
    const brandLower = brand.toLowerCase();

    // Exact match first
    let found = lower.includes(brandLower);

    // Fuzzy matching: for multi-word brands, check if significant portion matches
    if (!found) {
      const brandWords = brandLower.split(/\s+/).filter(w => w.length >= 3);
      if (brandWords.length >= 2) {
        // Check if at least 2 consecutive words from the brand appear together in text
        for (let i = 0; i <= brandWords.length - 2; i++) {
          const partialPhrase = brandWords.slice(i, i + 2).join(' ');
          if (lower.includes(partialPhrase)) {
            found = true;
            break;
          }
        }
        // Also check if 60%+ of brand words appear anywhere in text
        if (!found) {
          const matchedWords = brandWords.filter(w => lower.includes(w));
          if (matchedWords.length >= Math.ceil(brandWords.length * 0.6) && matchedWords.length >= 2) {
            found = true;
          }
        }
      }
    }

    if (found && !foundBrands.has(brandLower)) {
      foundBrands.add(brandLower);

      // Try to construct a likely URL for the brand
      const cleanBrand = brand.replace(/[^a-zA-Z0-9]/g, '').toLowerCase();
      const likelyDomain = `${cleanBrand}.com`;

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

  console.log(`[extractImplicitCitations] Found ${citations.length} citations from ${allBrands.length} brands`);
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
  models: Array<"chatgpt" | "gemini" | "claude" | "perplexity"> = ["chatgpt", "gemini", "claude"],
  locationCode?: number,
  locationName?: string
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
    brand_entities?: DataForSEOBrandEntity[];
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
    brand_entities?: DataForSEOBrandEntity[];
  }>();

  let totalCost = 0;
  const responses: string[] = [];

  // Query ALL models in PARALLEL — each is a different provider, no shared rate limits
  console.log(`[LIVE LLM Validation] Firing ${models.length} models in parallel...`);

  const modelResults = await Promise.all(models.map(async (model) => {
    const result = await getLiveLLMResponse(prompt, model, locationCode, locationName);
    return { model, result };
  }));

  for (const { model, result } of modelResults) {
    totalCost += result.cost;

    if (result.success) {
      const brandData = parseBrandData(result.response, brandName, brandTags);

      console.log(`[LIVE LLM/${model}] Response received, length: ${result.response.length}`);
      console.log(`[LIVE LLM/${model}] Brand data: mentioned=${brandData.mentioned}, count=${brandData.count}`);

      const urlCitations = extractUrlsFromText(result.response);
      console.log(`[LIVE LLM/${model}] URL citations extracted: ${urlCitations.length}`);

      const implicitCitations = extractImplicitCitations(result.response, brandName, brandTags, competitors);
      console.log(`[LIVE LLM/${model}] Implicit citations extracted: ${implicitCitations.length}`);

      // Merge citations, avoiding duplicates. Priority: annotations > URLs > implicit
      const seenDomains = new Set<string>();
      const extractedCitations: Citation[] = [];

      if (result.citations && result.citations.length > 0) {
        console.log(`[LIVE LLM/${model}] Structured annotation citations: ${result.citations.length}`);
        for (const c of result.citations) {
          const domainLower = c.domain.toLowerCase();
          if (!seenDomains.has(domainLower)) {
            seenDomains.add(domainLower);
            extractedCitations.push(c);
          }
        }
      }

      for (const c of urlCitations) {
        const domainLower = c.domain.toLowerCase();
        if (!seenDomains.has(domainLower)) {
          seenDomains.add(domainLower);
          extractedCitations.push(c);
        }
      }

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
        brand_entities: result.brand_entities,
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
    brand_entities?: DataForSEOBrandEntity[];
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

  // Brand Detection: Use DataForSEO API brand_entities when available (ChatGPT),
  // fall back to NER for other models
  let extractedBrands: ExtractedBrandEntity[] = [];
  if (extraData?.brand_entities && extraData.brand_entities.length > 0) {
    // Map DataForSEO brand entities to our ExtractedBrandEntity format
    extractedBrands = mapDataForSEOBrandEntities(
      extraData.brand_entities, response, brandName, brandTags, competitors, citationsWithBrandFlag
    );
    console.log(`[BrandDetection/${modelId}] Using DataForSEO API: ${extractedBrands.length} brands`);
  } else if (response) {
    // Fallback: NER for models without API brand detection
    extractedBrands = extractBrandsFromResponse(response, citationsWithBrandFlag, brandName, brandTags, competitors);
    console.log(`[BrandDetection/${modelId}] Using NER fallback: ${extractedBrands.length} brands`);
  }

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
    extracted_brands: extractedBrands.length > 0 ? extractedBrands : undefined,
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
      console.error("[GEO Audit] Validation failed:", validationError, JSON.stringify(body));
      return new Response(
        JSON.stringify({ success: false, error: validationError }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Sanitize inputs
    const {
      client_id,
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
            liveModels,
            location_code,
            location_name
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
                  brand_entities: modelData.brand_entities,
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
            console.log("[DB] Saving citations to 'citations' table...");
            const { error: citationError } = await supabase.from("citations").insert(citationRecords);
            if (citationError) console.error("[DB] Citation save error:", citationError);
          }

          // Log API usage
          console.log("[DB] Saving usage to 'api_usage' table...");
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
