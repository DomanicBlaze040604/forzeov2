/**
 * ============================================================================
 * FORZEO CLIENT DASHBOARD HOOK
 * ============================================================================
 * 
 * This is the main state management hook for the Forzeo GEO Dashboard.
 * It manages all client data, prompts, audit results, and analytics.
 * 
 * ============================================================================
 * DATA STORAGE
 * ============================================================================
 * 
 * Primary: Supabase PostgreSQL database
 * Fallback: localStorage (for offline/cache)
 * 
 * Tables used:
 * - clients: Brand/client configurations
 * - forzeo_prompts: Search prompts to analyze
 * - audit_results: LLM response analysis results
 * - forzeo_citations: Extracted source citations
 * - forzeo_api_usage: API cost tracking
 * 
 * ============================================================================
 * KEY FEATURES
 * ============================================================================
 * 
 * Client Management:
 * - Add, update, delete clients
 * - Switch between clients
 * - Configure brand tags and competitors
 * 
 * Prompt Management:
 * - Add single or bulk prompts
 * - Generate prompts from keywords (AI)
 * - Import/export prompts
 * - Categorize by niche level
 * 
 * Audit Execution:
 * - Run full audit (all prompts)
 * - Run single prompt audit
 * - Re-run existing audits
 * - Track loading states
 * 
 * Analytics:
 * - Share of Voice calculation
 * - Model-by-model visibility stats
 * - Competitor gap analysis
 * - Top sources aggregation
 * - Insights and recommendations
 * 
 * Export:
 * - CSV export
 * - JSON export
 * - Full text report
 * 
 * ============================================================================
 * USAGE
 * ============================================================================
 * 
 * ```tsx
 * import { useClientDashboard } from "@/hooks/useClientDashboard";
 * 
 * function Dashboard() {
 *   const {
 *     clients,
 *     selectedClient,
 *     prompts,
 *     auditResults,
 *     summary,
 *     runFullAudit,
 *     addCustomPrompt,
 *     // ... more
 *   } = useClientDashboard();
 * 
 *   return <div>...</div>;
 * }
 * ```
 * 
 * @version 2.0.0
 * @author Forzeo Team
 */

import { useState, useCallback, useEffect, useRef, useMemo } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

// ============================================
// TYPES
// ============================================

export interface AIModel {
  id: string;
  name: string;
  provider: string;
  color: string;
  costPerQuery: number;
}

export const AI_MODELS: AIModel[] = [
  { id: "chatgpt", name: "ChatGPT", provider: "OpenAI", color: "#10b981", costPerQuery: 0.02 },
  { id: "google_ai_overview", name: "Google AI Overview", provider: "DataForSEO", color: "#ef4444", costPerQuery: 0.003 },
  { id: "perplexity", name: "Perplexity", provider: "Perplexity AI", color: "#8b5cf6", costPerQuery: 0.02 },
  { id: "gemini", name: "Gemini", provider: "Google", color: "#3b82f6", costPerQuery: 0.02 },
  { id: "claude", name: "Claude", provider: "Anthropic", color: "#f59e0b", costPerQuery: 0.02 },
  { id: "google_serp", name: "Google SERP", provider: "DataForSEO", color: "#22c55e", costPerQuery: 0.002 },
];

// Helper to clean and analyze response text
/**
 * Normalize a brand name token for fuzzy matching.
 */
function normalizeBrandToken(name: string): string {
  return name
    .toLowerCase()
    .replace(/\.(com|io|ai|co|org|net|app|dev|me|us|uk|de|fr|in|ca|au|xyz|info|biz|so|gg)$/gi, '')
    .replace(/\b(crm|app|software|platform|tool|cloud|hq|labs|inc|llc|ltd|corp|suite|hub|pro|studio|agency|group|saas|erp)\b/gi, '')
    .replace(/[^a-z0-9]/g, '')
    .trim();
}

export function cleanAndAnalyzeResponse(
  rawText: string,
  brandName: string,
  competitors: string[],
  brandTags: string[] = []
): {
  cleanedResponse: string;
  brandMentions: number;
  brandRank: number | null;
  competitorStats: { name: string; count: number; rank: number | null }[];
} {
  // 1. Clean Text
  let cleaned = rawText
    .replace(/DataForSEO API call/gi, "")
    .replace(/https:\/\/api\.dataforseo\.com[^\s]*/g, "") // Remove API links if any
    // Fix: Only normalize horizontal whitespace, preserve identifiers and newlines
    .replace(/[ \t]+/g, " ")
    .trim();

  // 1b. Deduplicate repeated responses (API sometimes returns content twice)
  if (cleaned.length > 200) {
    const halfLen = Math.floor(cleaned.length / 2);
    const searchStart = Math.max(halfLen - 100, 0);
    const searchEnd = Math.min(halfLen + 100, cleaned.length);
    const midSection = cleaned.substring(searchStart, searchEnd);
    const newlineOffset = midSection.indexOf('\n');
    if (newlineOffset !== -1) {
      const splitPoint = searchStart + newlineOffset + 1;
      const firstHalf = cleaned.substring(0, splitPoint).trim();
      const secondHalf = cleaned.substring(splitPoint).trim();
      const compareLen = Math.min(150, firstHalf.length, secondHalf.length);
      if (compareLen > 50 && firstHalf.substring(0, compareLen) === secondHalf.substring(0, compareLen)) {
        cleaned = firstHalf;
      }
    }
  }

  // 2. Analyze Mentions & Ranks
  const lowerText = cleaned.toLowerCase();
  const lowerBrand = brandName.toLowerCase();
  const brandToken = normalizeBrandToken(brandName);
  const allBrandTerms = [brandName, ...brandTags].filter(Boolean);

  // Brand Mentions (exact + normalized)
  let brandMentions = 0;
  for (const term of allBrandTerms) {
    const termLower = term.toLowerCase();
    const matches = lowerText.match(new RegExp(termLower.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), "g"));
    if (matches) brandMentions += matches.length;
  }
  // Normalized token fallback — strip ALL non-alphanumeric (including spaces)
  // so multi-word brands like "Tata Tele Services" → "tatateleservices" match
  if (brandMentions === 0 && brandToken.length >= 3) {
    const cleanText = lowerText.replace(/[^a-z0-9]/g, '');
    const tokenMatches = cleanText.match(new RegExp(brandToken, "g"));
    if (tokenMatches) brandMentions = tokenMatches.length;
  }

  // Rank Detection using numbered lists (1. Brand, 2. Competitor...)
  let brandRank: number | null = null;
  const lines = cleaned.split(/(?:\r\n|\r|\n)/);

  // Competitor Stats (use normalized matching for counting)
  const competitorStats = competitors.map(comp => {
    const lowerComp = comp.toLowerCase();
    const compToken = normalizeBrandToken(comp);
    let count = 0;
    // Exact match
    const exactMatches = lowerText.match(new RegExp(lowerComp.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), "g"));
    if (exactMatches) count = exactMatches.length;
    // Normalized fallback — strip spaces too for multi-word competitor names
    if (count === 0 && compToken.length >= 3) {
      const cleanText = lowerText.replace(/[^a-z0-9]/g, '');
      const tokenMatches = cleanText.match(new RegExp(compToken, "g"));
      if (tokenMatches) count = tokenMatches.length;
    }
    return { name: comp, count, rank: null as number | null };
  });

  // Scan for ranks in numbered lists
  let currentRank: number | null = null;

  lines.forEach(line => {
    const trimmed = line.trim();
    if (!trimmed) return;

    // Check for list item start (e.g. "1.", "1)", "10.")
    const listMatch = trimmed.match(/^(\d+)[\.\)]\s*/);
    if (listMatch) {
      const parsed = parseInt(listMatch[1], 10);
      if (!isNaN(parsed)) currentRank = parsed;
    }
    // Reset rank on headers (e.g. "### Summary") to avoid bleeding ranks into conclusions
    else if (trimmed.startsWith('#')) {
      currentRank = null;
    }

    if (currentRank !== null) {
      const lowerLine = line.toLowerCase();
      const lowerLineClean = lowerLine.replace(/[^a-z0-9]/g, '');

      // Check Brand Rank (exact + normalized + brand_tags)
      if (brandRank === null) {
        for (const term of allBrandTerms) {
          if (lowerLine.includes(term.toLowerCase())) {
            brandRank = currentRank;
            break;
          }
        }
        // Normalized fallback
        if (brandRank === null && brandToken.length >= 3 && lowerLineClean.includes(brandToken)) {
          brandRank = currentRank;
        }
      }

      // Check Competitor Ranks (exact + normalized)
      competitorStats.forEach(stat => {
        if (stat.rank === null) {
          const compToken = normalizeBrandToken(stat.name);
          if (lowerLine.includes(stat.name.toLowerCase())) {
            stat.rank = currentRank;
          } else if (compToken.length >= 3 && lowerLineClean.includes(compToken)) {
            stat.rank = currentRank;
          }
        }
      });
    }
  });

  // Fallback: if no numbered-list rank found but brand IS mentioned,
  // derive rank from mention order (how many competitors appear before the brand)
  if (brandRank === null && brandMentions > 0) {
    const lowerCleaned = cleaned.toLowerCase();
    const brandIdx = lowerCleaned.indexOf(brandName.toLowerCase());
    if (brandIdx !== -1) {
      let order = 1;
      competitors.forEach(comp => {
        const compIdx = lowerCleaned.indexOf(comp.toLowerCase());
        if (compIdx !== -1 && compIdx < brandIdx) order++;
      });
      brandRank = order;
    }
  }

  return { cleanedResponse: cleaned, brandMentions, brandRank, competitorStats };
}

export interface CitationMeta {
  category: string; // e.g. ugc, editorial, affiliate
  source_type: string; // e.g. wiki, social, review
  authority_tier: number; // 1, 2, 3
  relationship_type: string; // owned, competitor, neutral
  is_affiliate?: boolean;
  // Verification fields
  verification_status?: string; // verified, partially_verified, hallucinated, pending, error
  similarity_score?: number; // 0.0-1.0
  matched_paragraph?: string; // Matched text excerpt
  page_fetch_status?: number; // HTTP status code
  page_content?: string; // Cached page content (first 5000 chars)
  verified_at?: string; // ISO timestamp
  // Enhanced categorization
  intent_tags?: string[]; // pricing, alternatives, comparison, etc.
  trust_tags?: string[]; // high_authority, ugc_unverified, etc.
}

// (duplicate CitationMeta removed — see lines 205-211)

export type PromptCategory =
  | "custom" | "imported" | "generated" | "niche" | "super_niche"
  | "brand" | "competitor" | "location" | "feature";

export interface Client {
  id: string;
  name: string;
  brand_name: string;
  brand_domain?: string;
  brand_tags: string[];
  slug: string;
  target_region: string;
  location_code: number;
  industry: string;
  competitors: string[];
  primary_color: string;
  created_at: string;
}

export interface Prompt {
  id: string;
  client_id: string;
  prompt_text: string;
  category: PromptCategory;
  is_custom: boolean;
  is_active: boolean;
  niche_level?: "broad" | "niche" | "super_niche";
  tags?: string[];
  location_code?: number; // Optional location override for this prompt
  location_name?: string; // Display name for the location
  topic?: string; // Topic/seed keyword grouping
  estimated_search_volume?: number | null; // AI search volume from DataForSEO
  search_volume_updated_at?: string | null;
}

/**
 * Brand entity extracted from LLM response using DataForSEO's brand_entities API
 * Used to automatically discover and track brands mentioned in AI responses
 * 
 * Scoring: entity_points = sum of 1/position for each mention (earlier = higher score)
 */
export interface ExtractedBrandEntity {
  title: string;           // Brand name from API
  markdown?: string;       // Markdown representation if available
  category?: string;       // Brand category if available (e.g., "sports", "tech")
  mention_count: number;   // Number of times mentioned in response
  position: number;        // Primary position (1-indexed, first mention)
  positions?: number[];    // All positions where mentioned
  entity_points: number;   // Relevance score: sum of 1/position (earlier = higher)
  is_own_brand: boolean;   // Matches client's brand or brand_tags
  is_competitor: boolean;  // Matches known competitor
  sentiment?: "positive" | "neutral" | "negative";
  sources?: string[];      // URLs associated with this brand (if available)
}

export interface ModelResult {
  model: string;
  model_name: string;
  provider: string;
  success: boolean;
  error?: string;
  brand_mentioned: boolean;
  brand_mention_count: number;
  brand_rank: number | null;
  brand_sentiment?: string;
  matched_terms?: string[];
  winner_brand?: string;
  competitors_found?: Array<{ name: string; count: number; rank: number | null; sentiment?: string }>;
  potential_competitors?: string[];
  citations: Array<{ url: string; title: string; domain: string }>;
  citation_count: number;
  api_cost: number;
  raw_response: string;
  response_length: number;
  is_cited?: boolean;
  authority_type?: string;
  ai_search_volume?: number;
  is_ai_overview?: boolean; // True if actual AI Overview was found, false if fallback to SERP
  extracted_brands?: ExtractedBrandEntity[]; // Brand entities from LLM Scraper API
}

export interface AuditResult {
  id: string;
  client_id?: string;
  prompt_id: string;
  prompt_text: string;
  model_results: ModelResult[];
  summary: {
    share_of_voice: number;
    average_rank: number | null;
    total_citations: number;
    total_cost: number;
  };
  created_at: string;
}

export interface DashboardSummary {
  total_prompts: number;
  overall_sov: number;
  average_rank: number | null;
  total_citations: number;
  total_cost: number;
}

export interface ModelStats { visible: number; total: number; cost: number; }
export interface CompetitorGapItem { name: string; mentions: number; percentage: number; }
export interface SourceItem { domain: string; count: number; prompts: string[]; type: string; promptCount: number; avg: number; }
export interface Insights { status: "high" | "medium" | "low"; statusText: string; recommendations: string[]; }

// Prompt-level AI Visibility Strategist types
export interface PromptInsightRecommendation {
  title: string;
  type: 'High Impact' | 'Quick Win';
  targetPlatforms: string;
  priority: 'High' | 'Medium' | 'Low';
  whyThisWorks: string;
  exactAction: {
    contentFormat: string;
    targetUrl: string;
    wordCount: string;
    keyClaims: string[];
    existingPageNote?: string;
  };
  executionSteps: string[];
  timeline: string;
  successMetric: string;
}

export interface PromptInsightResult {
  citationGapSummary: string;
  platformPresence: { platform: string; present: boolean; rank: number | null }[];
  recommendations: PromptInsightRecommendation[];
  priority: 'high' | 'medium' | 'low';
}

// Industry presets
export const INDUSTRY_PRESETS: Record<string, {
  competitors: string[]; prompts: string[]; nichePrompts: string[]; superNichePrompts: string[];
}> = {
  "Dating/Matrimony": {
    competitors: ["Bumble", "Hinge", "Tinder", "Shaadi", "Aisle"],
    prompts: ["Best dating apps in {region} 2025", "Dating apps with verification", "Safe dating apps for women"],
    nichePrompts: ["Best dating apps for professionals in {region}", "Dating apps with video calling features"],
    superNichePrompts: ["Best dating apps for divorced professionals over 40 in {region}"]
  },
  "Healthcare/Dental": {
    competitors: ["Bupa Dental", "MyDentist", "Dental Care"],
    prompts: ["Best dental clinic in {region}", "Emergency dentist near me"],
    nichePrompts: ["Best cosmetic dentist in {region}", "Dental implants specialist {region}"],
    superNichePrompts: ["Best dentist for dental anxiety patients in {region}"]
  },
  "E-commerce/Fashion": {
    competitors: ["Myntra", "Ajio", "Amazon Fashion", "Flipkart"],
    prompts: ["Best online fashion stores {region}", "Affordable clothing websites"],
    nichePrompts: ["Sustainable fashion brands {region}", "Plus size clothing online {region}"],
    superNichePrompts: ["Handloom sarees direct from weavers {region}"]
  },
  "Food/Beverage": {
    competitors: ["Sysco", "US Foods", "Makro"],
    prompts: ["Best food distributors in {region}", "Wholesale food suppliers"],
    nichePrompts: ["Organic food distributors {region}", "Specialty food importers {region}"],
    superNichePrompts: ["Halal certified meat suppliers {region}"]
  },
  "Custom": { competitors: [], prompts: [], nichePrompts: [], superNichePrompts: [] }
};

export const LOCATION_CODES: Record<string, number> = {
  // ===== COUNTRIES =====
  // North America
  "United States": 2840, "Canada": 2124, "Mexico": 2484,
  // Europe
  "United Kingdom": 2826, "Germany": 2276, "France": 2250, "Spain": 2724,
  "Italy": 2380, "Netherlands": 2528, "Switzerland": 2756, "Sweden": 2752,
  // Asia Pacific
  "India": 2356, "Thailand": 2764, "Singapore": 2702, "Australia": 2036,
  "Japan": 2392, "South Korea": 2410, "Malaysia": 2458, "Indonesia": 2360,
  "Philippines": 2608, "Vietnam": 2704, "China": 2156,
  // Middle East
  "UAE": 2784, "Saudi Arabia": 2682, "Israel": 2376,
  // South America
  "Brazil": 2076, "Argentina": 2032,
  // Africa
  "South Africa": 2710, "Nigeria": 2566,

  // ===== US CITIES =====
  "US: New York": 1023191, "US: Los Angeles": 1013962, "US: Chicago": 1016367,
  "US: Houston": 1026481, "US: Phoenix": 1023564, "US: San Francisco": 1014221,
  "US: Dallas": 1026339, "US: Miami": 1015116, "US: Seattle": 1027744,
  "US: Boston": 1018127, "US: Denver": 1014395, "US: Atlanta": 1015254,
  "US: San Diego": 1014218, "US: Austin": 1026135, "US: Las Vegas": 1023163,

  // ===== UK CITIES =====
  "UK: London": 1006886, "UK: Manchester": 1006977, "UK: Birmingham": 1006632,
  "UK: Leeds": 1006943, "UK: Glasgow": 1006822, "UK: Liverpool": 1006958,
  "UK: Edinburgh": 1006789, "UK: Bristol": 1006682,

  // ===== INDIA CITIES =====
  "India: Mumbai": 1007788, "India: Delhi": 1007768, "India: Bangalore": 1007751,
  "India: Hyderabad": 1007774, "India: Chennai": 1007762, "India: Kolkata": 1007780,
  "India: Pune": 1007793, "India: Ahmedabad": 1007747,

  // ===== THAILAND CITIES =====
  "Thailand: Bangkok": 1012541, "Thailand: Chiang Mai": 1012551,
  "Thailand: Phuket": 1012568, "Thailand: Pattaya": 1012565,

  // ===== AUSTRALIA CITIES =====
  "Australia: Sydney": 9069883, "Australia: Melbourne": 9069872,
  "Australia: Brisbane": 9069858, "Australia: Perth": 9069878,

  // ===== GERMANY CITIES =====
  "Germany: Berlin": 1003854, "Germany: Munich": 1004047, "Germany: Hamburg": 1003938,
  "Germany: Frankfurt": 1003906, "Germany: Cologne": 1003993,

  // ===== UAE CITIES =====
  "UAE: Dubai": 1013010, "UAE: Abu Dhabi": 1013002,

  // ===== SINGAPORE =====
  "Singapore: Central": 9076810,

  // ===== CANADA CITIES =====
  "Canada: Toronto": 9000984, "Canada: Vancouver": 9001009,
  "Canada: Montreal": 9000930, "Canada: Calgary": 9000889,
};

// ============================================
// STORAGE HELPERS - LocalStorage as cache
// ============================================

const STORAGE_KEYS = {
  RESULTS: "forzeo_audit_results_v3",
  CLIENTS: "forzeo_clients_v3",
  PROMPTS: "forzeo_prompts_v3",
  SELECTED_CLIENT: "forzeo_selected_client",
  SELECTED_MODELS: "forzeo_selected_models",
  INCLUDE_TAVILY: "forzeo_include_tavily",
  PENDING_AUDIT: "forzeo_pending_audit",
};

function loadFromStorage<T>(key: string, defaultValue: T): T {
  try {
    const stored = localStorage.getItem(key);
    return stored ? JSON.parse(stored) : defaultValue;
  } catch { return defaultValue; }
}

function saveToStorage(key: string, value: unknown): void {
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch (err: any) {
    if (err?.name === 'QuotaExceededError' || err?.code === 22) {
      console.warn('[Storage] Quota exceeded, pruning old data...');
      try {
        // Prune audit results first (largest data) — keep only latest 50 per client
        const resultsKey = STORAGE_KEYS.RESULTS;
        const stored = localStorage.getItem(resultsKey);
        if (stored) {
          const allResults: Record<string, any[]> = JSON.parse(stored);
          for (const clientId of Object.keys(allResults)) {
            if (allResults[clientId]?.length > 50) {
              allResults[clientId] = allResults[clientId].slice(0, 50);
            }
          }
          localStorage.setItem(resultsKey, JSON.stringify(allResults));
        }
        // Retry original save
        localStorage.setItem(key, JSON.stringify(value));
        console.log('[Storage] Pruned old data and saved successfully.');
      } catch (retryErr) {
        // If still failing, try removing oldest client's data instead of clearing everything
        console.warn('[Storage] Still exceeding quota after pruning. Removing oldest client data...');
        try {
          const resultsKey = STORAGE_KEYS.RESULTS;
          const stored = localStorage.getItem(resultsKey);
          if (stored) {
            const allResults: Record<string, any[]> = JSON.parse(stored);
            const clientIds = Object.keys(allResults);
            if (clientIds.length > 1) {
              // Remove the client with the oldest data first
              let oldestClient = clientIds[0];
              let oldestTime = Infinity;
              for (const cid of clientIds) {
                const results = allResults[cid] || [];
                const earliest = results.reduce((min: number, r: any) => {
                  const t = new Date(r.created_at || 0).getTime();
                  return t < min ? t : min;
                }, Infinity);
                if (earliest < oldestTime) { oldestTime = earliest; oldestClient = cid; }
              }
              delete allResults[oldestClient];
              localStorage.setItem(resultsKey, JSON.stringify(allResults));
              console.log(`[Storage] Removed oldest client ${oldestClient} data.`);
            } else {
              localStorage.removeItem(resultsKey);
            }
          }
          localStorage.setItem(key, JSON.stringify(value));
        } catch {
          console.error('[Storage] Cannot save even after eviction:', retryErr);
        }
      }
    } else {
      console.error("Storage error:", err);
    }
  }
}

function generateSlug(name: string): string {
  return name.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
}

function generateColor(): string {
  const colors = ["#ec4899", "#f59e0b", "#06b6d4", "#8b5cf6", "#10b981", "#ef4444", "#3b82f6"];
  return colors[Math.floor(Math.random() * colors.length)];
}

function detectNicheLevel(promptText: string): "broad" | "niche" | "super_niche" {
  const words = promptText.toLowerCase().split(/\s+/);
  const wordCount = words.length;
  const superNicheKeywords = ["specific", "specialized", "custom", "tailored", "over 40", "over 50", "vegan", "organic", "halal"];
  const nicheKeywords = ["professional", "premium", "luxury", "affordable", "best", "top", "recommended"];
  const hasSuperNiche = superNicheKeywords.some(kw => promptText.toLowerCase().includes(kw));
  const hasNiche = nicheKeywords.some(kw => promptText.toLowerCase().includes(kw));
  if (hasSuperNiche || wordCount > 10) return "super_niche";
  if (hasNiche || wordCount > 6) return "niche";
  return "broad";
}

// ============================================
// STARTUP: Proactive localStorage cleanup
// ============================================
let _storageCleanupDone = false;
function cleanupStorageOnStartup() {
  if (_storageCleanupDone) return;
  _storageCleanupDone = true;
  try {
    // Estimate total usage
    let totalBytes = 0;
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (key) totalBytes += (localStorage.getItem(key)?.length || 0) * 2; // UTF-16
    }
    const MB = totalBytes / (1024 * 1024);
    console.log(`[Storage] Total localStorage usage: ${MB.toFixed(2)} MB`);

    // If over 3.5 MB (limit is ~5 MB), prune aggressively
    if (MB > 3.5) {
      console.warn(`[Storage] Usage high (${MB.toFixed(2)} MB), pruning audit results cache...`);
      const resultsRaw = localStorage.getItem(STORAGE_KEYS.RESULTS);
      if (resultsRaw) {
        try {
          const allResults: Record<string, any[]> = JSON.parse(resultsRaw);
          let pruned = false;
          for (const clientId of Object.keys(allResults)) {
            if (allResults[clientId]?.length > 30) {
              allResults[clientId] = allResults[clientId].slice(0, 30);
              pruned = true;
            }
          }
          if (pruned) {
            localStorage.setItem(STORAGE_KEYS.RESULTS, JSON.stringify(allResults));
            console.log('[Storage] Pruned audit results successfully.');
          }
        } catch {
          // Results cache corrupted, clear it
          localStorage.removeItem(STORAGE_KEYS.RESULTS);
          console.warn('[Storage] Cleared corrupted results cache.');
        }
      }
    }
  } catch (e) {
    console.warn('[Storage] Cleanup error:', e);
  }
}

// ============================================
// MAIN HOOK
// ============================================

export function useClientDashboard() {
  // Run storage cleanup once on first mount
  cleanupStorageOnStartup();
  const [clients, setClients] = useState<Client[]>([]);
  const [selectedClient, setSelectedClient] = useState<Client | null>(null);
  const [prompts, setPrompts] = useState<Prompt[]>([]);
  const [auditResults, setAuditResults] = useState<AuditResult[]>([]);
  const auditResultsRef = useRef<AuditResult[]>([]);
  const [summary, setSummary] = useState<DashboardSummary | null>(null);
  const [selectedModels, setSelectedModelsState] = useState<string[]>(
    loadFromStorage(STORAGE_KEYS.SELECTED_MODELS, ["chatgpt", "google_ai_overview", "google_serp"])
  );
  const [loading, setLoading] = useState(false);
  const [loadingPromptIds, setLoadingPromptIds] = useState<Set<string>>(new Set());
  const [error, setError] = useState<string | null>(null);
  const [includeTavily, setIncludeTavilyState] = useState<boolean>(
    loadFromStorage(STORAGE_KEYS.INCLUDE_TAVILY, true)
  );
  const [tavilyResults, setTavilyResults] = useState<Record<string, unknown>>({});
  const [citationMeta, setCitationMeta] = useState<Record<string, CitationMeta>>({});
  const [categorizationProgress, setCategorizationProgress] = useState<{ completed: number; total: number; currentBatch: number; totalBatches: number; running: boolean } | null>(null);

  // Auto-persist audit results to localStorage whenever they change
  useEffect(() => {
    if (selectedClient && auditResults.length > 0) {
      const stored = loadFromStorage<Record<string, AuditResult[]>>(STORAGE_KEYS.RESULTS, {});
      stored[selectedClient.id] = auditResults;
      saveToStorage(STORAGE_KEYS.RESULTS, stored);
    }
  }, [auditResults, selectedClient]);

  const [auditProgress, setAuditProgress] = useState<number | null>(null);

  // ============================================
  // FETCH GUARD & DATA CACHE (prevents duplicate/cascading fetches)
  // ============================================
  const loadingClientRef = useRef<string | null>(null);
  const dataCache = useRef<Map<string, {
    prompts: Prompt[];
    results: AuditResult[];
    tavily: Record<string, unknown>;
    citationMeta: Record<string, CitationMeta>;
    timestamp: number;
  }>>(new Map());
  const CACHE_TTL_MS = 5 * 60 * 1000; // 5 minutes

  // BUG-003 fix: Invalidate cache for a specific client so stale data isn't served after mutations
  const invalidateClientCache = useCallback((clientId: string) => {
    dataCache.current.delete(clientId);
  }, []);

  // Ref to fetchSearchVolumes so audit functions can call it without circular deps
  const fetchSearchVolumesRef = useRef<(() => Promise<void>) | null>(null);

  const setIncludeTavily = useCallback((include: boolean) => {
    setIncludeTavilyState(include);
    saveToStorage(STORAGE_KEYS.INCLUDE_TAVILY, include);
  }, []);

  const setSelectedModels = useCallback((models: string[]) => {
    setSelectedModelsState(models);
    saveToStorage(STORAGE_KEYS.SELECTED_MODELS, models);
  }, []);

  // ============================================
  // ANALYTICS FUNCTIONS
  // ============================================

  const getModelStats = useCallback((): Record<string, ModelStats> => {
    const stats: Record<string, ModelStats> = {};
    AI_MODELS.forEach(model => { stats[model.id] = { visible: 0, total: 0, cost: 0 }; });
    auditResults.forEach(result => {
      result.model_results.forEach(mr => {
        if (stats[mr.model]) {
          stats[mr.model].total++;
          if (mr.brand_mentioned) stats[mr.model].visible++;
          stats[mr.model].cost += mr.api_cost;
        }
      });
    });
    return stats;
  }, [auditResults]);

  const getCompetitorGap = useCallback((): CompetitorGapItem[] => {
    if (!selectedClient) return [];
    const mentions: Record<string, number> = {};
    mentions[selectedClient.brand_name] = 0;
    selectedClient.competitors.forEach(c => { mentions[c] = 0; });
    auditResults.forEach(result => {
      result.model_results.forEach(mr => {
        const response = mr.raw_response?.toLowerCase() || "";
        if (mr.brand_mentioned) mentions[selectedClient.brand_name] += mr.brand_mention_count;
        selectedClient.competitors.forEach(comp => {
          const regex = new RegExp(comp.toLowerCase(), "gi");
          const matches = response.match(regex);
          if (matches) mentions[comp] += matches.length;
        });
      });
    });
    const total = Object.values(mentions).reduce((a, b) => a + b, 0) || 1;
    return Object.entries(mentions)
      .map(([name, count]) => ({ name, mentions: count, percentage: Math.round((count / total) * 100) }))
      .sort((a, b) => b.mentions - a.mentions);
  }, [selectedClient, auditResults]);

  const getTopSources = useCallback((): SourceItem[] => {
    const sources: Record<string, { count: number; prompts: Set<string> }> = {};
    auditResults.forEach(result => {
      result.model_results.forEach(mr => {
        mr.citations.forEach(citation => {
          if (!sources[citation.domain]) sources[citation.domain] = { count: 0, prompts: new Set() };
          sources[citation.domain].count++;
          sources[citation.domain].prompts.add(result.prompt_text);
        });
      });
    });

    // Helper function to classify domain type
    const classifyDomain = (domain: string): string => {
      const d = domain.toLowerCase();
      if (d.includes("reddit") || d.includes("quora") || d.includes("youtube")) return "ugc";
      if (d.includes("forbes") || d.includes("techcrunch") || d.includes("wired")) return "editorial";
      if (d.includes("wikipedia")) return "reference";
      if (d.includes(".gov") || d.includes(".edu")) return "institutional";
      if (d.includes("apple") || d.includes("google") || d.includes("microsoft")) return "corporate";
      return "other";
    };

    const total = auditResults.length || 1;
    return Object.entries(sources)
      .map(([domain, data]) => ({
        domain,
        count: data.count,
        prompts: Array.from(data.prompts),
        type: classifyDomain(domain),
        promptCount: data.prompts.size,
        avg: Math.round((data.count / total) * 10) / 10
      }))
      .sort((a, b) => b.count - a.count);
  }, [auditResults]);

  const getInsights = useCallback((): Insights => {
    const sov = summary?.overall_sov || 0;
    if (sov >= 50) {
      return {
        status: "high", statusText: `High visibility at ${sov}%`,
        recommendations: ["Maintain current content strategy", "Monitor competitor movements", "Expand to new keywords"]
      };
    } else if (sov >= 20) {
      return {
        status: "medium", statusText: `Medium visibility at ${sov}%`,
        recommendations: ["Increase brand mentions in authoritative sources", "Improve ranking in AI-generated lists", "Create more targeted content"]
      };
    }
    return {
      status: "low", statusText: `Low visibility at ${sov}%`,
      recommendations: ["Increase brand mentions in authoritative sources", "Improve ranking in AI-generated lists",
        `Monitor ${selectedClient?.competitors[0] || "competitor"}'s presence`, "Focus on niche and super-niche keywords"]
    };
  }, [summary, selectedClient]);

  const costBreakdown = useCallback(() => {
    let total = 0;
    const byModel: Record<string, number> = {};
    const byPrompt: Record<string, number> = {};
    auditResults.forEach(result => {
      result.model_results.forEach(mr => {
        total += mr.api_cost;
        byModel[mr.model] = (byModel[mr.model] || 0) + mr.api_cost;
      });
      byPrompt[result.prompt_id] = result.summary.total_cost;
    });
    return { total, by_model: byModel, by_prompt: byPrompt };
  }, [auditResults])();

  // ============================================
  // CLIENT MANAGEMENT - Supabase Primary
  // ============================================

  // ============================================
  // CENTRALIZED DATA LOADING (single entry point)
  // ============================================

  const loadClientData = useCallback(async (client: Client, forceRefresh = false) => {
    // Guard: prevent concurrent fetches for the same or different client
    const requestId = client.id + '_' + Date.now();
    loadingClientRef.current = requestId;

    // Check cache first (unless force refresh)
    if (!forceRefresh) {
      const cached = dataCache.current.get(client.id);
      if (cached && Date.now() - cached.timestamp < CACHE_TTL_MS) {
        console.log(`[loadClientData] Cache hit for ${client.brand_name}, age: ${Math.round((Date.now() - cached.timestamp) / 1000)}s`);
        setPrompts(cached.prompts);
        setAuditResults(cached.results);
        setTavilyResults(cached.tavily);
        setCitationMeta(cached.citationMeta);
        updateSummaryDirect(cached.results);
        return;
      }
    }

    console.log(`[loadClientData] Loading data for: ${client.brand_name} (id: ${client.id})`);

    let loadedPrompts: Prompt[] = [];
    let loadedResults: AuditResult[] = [];
    let loadedTavily: Record<string, unknown> = {};
    let loadedCitationMeta: Record<string, CitationMeta> = {};

    // --- Load Prompts ---
    try {
      const { data: promptsData, error: promptError } = await supabase
        .from("prompts").select("*").eq("client_id", client.id).eq("is_active", true);

      if (promptError) throw promptError;

      if (promptsData && promptsData.length > 0) {
        loadedPrompts = promptsData.map(p => ({
          id: p.id, client_id: p.client_id, prompt_text: p.prompt_text,
          category: p.category || "custom", is_custom: p.is_custom, is_active: p.is_active,
          niche_level: p.niche_level, tags: p.tags,
          location_code: p.location_code, location_name: p.location_name,
          topic: p.topic || undefined,
          estimated_search_volume: p.estimated_search_volume ?? undefined,
          search_volume_updated_at: p.search_volume_updated_at || undefined,
        }));
      } else {
        const storedPrompts = loadFromStorage<Record<string, Prompt[]>>(STORAGE_KEYS.PROMPTS, {});
        loadedPrompts = storedPrompts[client.id] || [];
      }
    } catch (err: any) {
      console.error("Prompts fetch failed:", err);
      toast.error("Failed to load prompts: " + (err.message || "Unknown error"));
      const storedPrompts = loadFromStorage<Record<string, Prompt[]>>(STORAGE_KEYS.PROMPTS, {});
      loadedPrompts = storedPrompts[client.id] || [];
    }

    // Stale check: abort if a newer load was started
    if (loadingClientRef.current !== requestId) {
      console.log(`[loadClientData] Aborted stale fetch for ${client.brand_name}`);
      return;
    }

    // --- Load Audit Results ---
    try {
      const { data: resultsData } = await supabase
        .from("audit_results").select("*").eq("client_id", client.id).order("created_at", { ascending: false }).limit(500);
      if (resultsData && resultsData.length > 0) {
        loadedResults = resultsData.map(r => ({
          id: r.id, prompt_id: r.prompt_id, prompt_text: r.prompt_text,
          model_results: r.model_results || [],
          summary: r.summary || {
            share_of_voice: r.share_of_voice ?? 0,
            average_rank: r.average_rank ?? null,
            total_citations: r.total_citations ?? 0,
            total_cost: r.total_cost ?? 0,
          },
          created_at: r.created_at,
        }));
      } else {
        const storedResults = loadFromStorage<Record<string, AuditResult[]>>(STORAGE_KEYS.RESULTS, {});
        loadedResults = storedResults[client.id] || [];
      }
    } catch {
      const storedResults = loadFromStorage<Record<string, AuditResult[]>>(STORAGE_KEYS.RESULTS, {});
      loadedResults = storedResults[client.id] || [];
    }

    // Stale check
    if (loadingClientRef.current !== requestId) return;

    // --- Load Tavily Results ---
    try {
      const { data: tavilyData } = await supabase
        .from('tavily_results').select('*').eq('client_id', client.id)
        .order('created_at', { ascending: false }).limit(500);
      if (tavilyData && tavilyData.length > 0) {
        const tavilyMap: Record<string, unknown> = {};
        tavilyData.forEach(t => {
          if (t.prompt_id && !tavilyMap[t.prompt_id]) {
            tavilyMap[t.prompt_id] = {
              success: true, query: t.query, answer: t.answer, sources: t.sources || [],
              analysis: { brand_mentioned: false, brand_mention_count: 0, competitor_mentions: {}, top_domains: [], source_types: {}, insights: [] },
              timestamp: t.created_at,
            };
          }
        });
        loadedTavily = tavilyMap;
      }
    } catch (err) { console.log("[Tavily] Database fetch failed:", err); }

    // Stale check
    if (loadingClientRef.current !== requestId) return;

    // --- Load Citation Meta ---
    try {
      const { data, error: ciError } = await supabase
        .from('citation_intelligence')
        .select('domain, citation_category, source_type, authority_tier, relationship_type, verification_status, similarity_score, matched_paragraph, page_fetch_status')
        .eq('client_id', client.id);
      if (ciError) {
        console.error("[CitationMeta] Load error:", ciError);
      } else if (data) {
        const meta: Record<string, CitationMeta> = {};
        const statusPriority: Record<string, number> = {
          verified: 5, partially_verified: 4, hallucinated: 3, error: 2, pending: 1
        };
        // BUG-005 fix: Sort by priority descending so highest-priority row per domain is processed first
        data.sort((a: any, b: any) => {
          const aPri = statusPriority[a.verification_status || ''] || 0;
          const bPri = statusPriority[b.verification_status || ''] || 0;
          return bPri - aPri;
        });
        data.forEach((row: any) => {
          const domain = (row.domain || '').replace(/^www\./, '');
          if (!domain) return;
          const existing = meta[domain];
          const existingPriority = statusPriority[existing?.verification_status || ''] || 0;
          const newPriority = statusPriority[row.verification_status || ''] || 0;
          if (!existing || newPriority > existingPriority) {
            meta[domain] = {
              category: row.citation_category, source_type: row.source_type,
              authority_tier: row.authority_tier, relationship_type: row.relationship_type,
              is_affiliate: row.source_type === 'affiliate',
              verification_status: row.verification_status,
              similarity_score: row.similarity_score,
              matched_paragraph: row.matched_paragraph,
              page_fetch_status: row.page_fetch_status
            };
          } else if (newPriority === existingPriority && !existing.category && row.citation_category) {
            meta[domain] = { ...existing, category: row.citation_category, source_type: row.source_type, authority_tier: row.authority_tier, relationship_type: row.relationship_type };
          }
        });
        loadedCitationMeta = meta;
        console.log(`[CitationMeta] Loaded ${data.length} rows for client ${client.brand_name}`);
      }
    } catch (err) { console.error("Failed to fetch citation meta:", err); }

    // Final stale check before setting state
    if (loadingClientRef.current !== requestId) return;

    // --- Set all state in one batch ---
    setPrompts(loadedPrompts);
    setAuditResults(loadedResults);
    setTavilyResults(loadedTavily);
    setCitationMeta(loadedCitationMeta);
    updateSummaryDirect(loadedResults);

    // Persist to localStorage (backup)
    const storedPrompts = loadFromStorage<Record<string, Prompt[]>>(STORAGE_KEYS.PROMPTS, {});
    storedPrompts[client.id] = loadedPrompts;
    saveToStorage(STORAGE_KEYS.PROMPTS, storedPrompts);
    const storedResults = loadFromStorage<Record<string, AuditResult[]>>(STORAGE_KEYS.RESULTS, {});
    storedResults[client.id] = loadedResults;
    saveToStorage(STORAGE_KEYS.RESULTS, storedResults);

    // Store in memory cache
    dataCache.current.set(client.id, {
      prompts: loadedPrompts,
      results: loadedResults,
      tavily: loadedTavily,
      citationMeta: loadedCitationMeta,
      timestamp: Date.now(),
    });

    console.log(`[loadClientData] Loaded for ${client.brand_name}: ${loadedPrompts.length} prompts, ${loadedResults.length} results, ${Object.keys(loadedTavily).length} tavily, ${Object.keys(loadedCitationMeta).length} citation meta`);

    // AUTO-AUDIT: Removed old in-hook auto-audit. Auto-run for new brands is now
    // handled exclusively by ClientDashboard's autoRunClientId -> runFullAudit flow,
    // which uses the user's selected models, has retry logic, and runs all prompts.
    if (loadedResults.length === 0 && loadedPrompts.length > 0) {
      const clientCreatedAt = new Date(client.created_at);
      const fifteenMinutesAgo = new Date(Date.now() - 15 * 60 * 1000);
      if (clientCreatedAt > fifteenMinutesAgo) {
        console.log("[loadClientData] New client detected with prompts but no results. Auto-run will be triggered by ClientDashboard.");
      }
    }
  }, []);

  const fetchClients = useCallback(async () => {
    try {
      const { data, error: fetchError } = await supabase
        .from("clients")
        .select("*")
        .order("created_at", { ascending: false });

      if (!fetchError && data) {
        const mappedClients: Client[] = data.map(c => ({
          id: c.id, name: c.name, brand_name: c.brand_name, brand_domain: c.brand_domain,
          brand_tags: c.brand_tags || [], slug: c.slug, target_region: c.target_region,
          location_code: c.location_code, industry: c.industry, competitors: c.competitors || [],
          primary_color: c.primary_color || generateColor(), created_at: c.created_at,
        }));
        setClients(mappedClients);
        saveToStorage(STORAGE_KEYS.CLIENTS, mappedClients);

        if (mappedClients.length > 0) {
          const lastSelectedId = loadFromStorage<string>(STORAGE_KEYS.SELECTED_CLIENT, mappedClients[0]?.id);
          const lastSelected = mappedClients.find(c => c.id === lastSelectedId) || mappedClients[0];
          setSelectedClient(lastSelected);
          // Load data for the selected client (single fetch, no useEffect cascade)
          await loadClientData(lastSelected);
        }
        return;
      }
    } catch (err) { console.log("Supabase fetch failed, using localStorage:", err); }

    // Fallback to localStorage
    const storedClients = loadFromStorage<Client[]>(STORAGE_KEYS.CLIENTS, []);
    if (storedClients.length === 0) {
      const defaultClients: Client[] = [{
        id: crypto.randomUUID(), name: "Juleo Club", brand_name: "Juleo", slug: "juleo",
        target_region: "India", location_code: 2356, industry: "Dating/Matrimony",
        primary_color: "#ec4899", created_at: new Date().toISOString(),
        brand_tags: ["Juleo Club", "juleo.club", "Juleo App"],
        competitors: ["Bumble", "Hinge", "Tinder", "Shaadi", "Aisle"]
      }];
      setClients(defaultClients);
      saveToStorage(STORAGE_KEYS.CLIENTS, defaultClients);
      setSelectedClient(defaultClients[0]);
      await loadClientData(defaultClients[0]);
    } else {
      setClients(storedClients);
      const lastSelectedId = loadFromStorage<string>(STORAGE_KEYS.SELECTED_CLIENT, storedClients[0]?.id);
      const lastSelected = storedClients.find(c => c.id === lastSelectedId) || storedClients[0];
      setSelectedClient(lastSelected);
      await loadClientData(lastSelected);
    }
  }, [loadClientData]);

  const addClient = useCallback(async (clientData: Partial<Client>): Promise<Client> => {
    // Check 1-brand limit for normal users
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) throw new Error('User not authenticated');

    // Fetch user's role
    const { data: profile } = await supabase
      .from('profiles')
      .select('role')
      .eq('id', user.id)
      .single();

    const isAdmin = profile?.role === 'admin';
    const isAgency = profile?.role === 'agency';

    // Check brand limits based on role
    if (!isAdmin) {
      const { data: existingAssignments } = await supabase
        .from('user_clients')
        .select('client_id')
        .eq('user_id', user.id);

      const currentBrandCount = existingAssignments?.length || 0;

      // Agency users: 5 brand limit
      if (isAgency && currentBrandCount >= 5) {
        throw new Error('Agency users can create up to 5 brands. You have reached your limit.');
      }

      // Normal users: 1 brand limit
      if (!isAgency && currentBrandCount >= 1) {
        throw new Error('Normal users can only create 1 brand. Please contact admin to add more brands.');
      }
    }

    const newClient: Client = {
      id: crypto.randomUUID(),
      name: clientData.name || "New Client",
      brand_name: clientData.brand_name || clientData.name || "New Brand",
      brand_domain: clientData.brand_domain || undefined,
      slug: `${user.id.substring(0, 8)}-${generateSlug(clientData.name || "new-client")}`,
      target_region: clientData.target_region || "United States",
      location_code: clientData.location_code || 2840,
      industry: clientData.industry || "Custom",
      primary_color: clientData.primary_color || generateColor(),
      created_at: new Date().toISOString(),
      brand_tags: clientData.brand_tags || [clientData.brand_name || clientData.name || ""],
      competitors: clientData.competitors || INDUSTRY_PRESETS[clientData.industry || "Custom"]?.competitors || [],
    };

    // Save to Supabase first
    try {
      const { error: insertError } = await supabase.from("clients").insert({
        id: newClient.id, name: newClient.name, brand_name: newClient.brand_name,
        brand_domain: newClient.brand_domain, slug: newClient.slug,
        target_region: newClient.target_region, location_code: newClient.location_code,
        industry: newClient.industry, primary_color: newClient.primary_color,
        brand_tags: newClient.brand_tags, competitors: newClient.competitors,
      });
      if (insertError) throw insertError;

      // Auto-assign brand to user who created it
      const { error: assignError } = await supabase
        .from('user_clients')
        .insert({
          user_id: user.id,
          client_id: newClient.id,
          granted_by: user.id
        });

      if (assignError) console.error('Error auto-assigning brand:', assignError);
    } catch (err) {
      console.log("Supabase insert failed:", err);
      throw err;
    }

    const newClients = [...clients, newClient];
    setClients(newClients);
    saveToStorage(STORAGE_KEYS.CLIENTS, newClients);
    invalidateClientCache(newClient.id);
    return newClient;
  }, [clients, invalidateClientCache]);

  const updateClient = useCallback(async (clientId: string, updates: Partial<Client>): Promise<Client | null> => {
    const clientIndex = clients.findIndex(c => c.id === clientId);
    if (clientIndex === -1) return null;

    const updatedClient = { ...clients[clientIndex], ...updates };

    // Save to Supabase first
    try {
      const { error: updateError } = await supabase.from("clients").update({
        name: updatedClient.name, brand_name: updatedClient.brand_name,
        brand_domain: updatedClient.brand_domain, target_region: updatedClient.target_region,
        location_code: updatedClient.location_code, industry: updatedClient.industry,
        primary_color: updatedClient.primary_color, brand_tags: updatedClient.brand_tags,
        competitors: updatedClient.competitors,
      }).eq("id", clientId);
      if (updateError) console.error("Supabase update error:", updateError);
    } catch (err) { console.log("Supabase update failed:", err); }

    const newClients = [...clients];
    newClients[clientIndex] = updatedClient;
    setClients(newClients);
    saveToStorage(STORAGE_KEYS.CLIENTS, newClients);
    invalidateClientCache(clientId);
    if (selectedClient?.id === clientId) setSelectedClient(updatedClient);
    return updatedClient;
  }, [clients, selectedClient, invalidateClientCache]);

  const deleteClient = useCallback(async (clientId: string): Promise<boolean> => {
    try {
      const { error } = await supabase.from("clients").delete().eq("id", clientId);
      if (error) {
        console.error("Supabase delete failed:", error);
        throw error;
      }
    } catch (err) {
      console.error("Delete client failed:", err);
      throw err;
    }

    const newClients = clients.filter(c => c.id !== clientId);
    setClients(newClients);
    saveToStorage(STORAGE_KEYS.CLIENTS, newClients);
    invalidateClientCache(clientId);
    if (selectedClient?.id === clientId) {
      setSelectedClient(newClients.length > 0 ? newClients[0] : null);
    }
    return true;
  }, [clients, selectedClient, invalidateClientCache]);

  const switchClient = useCallback(async (client: Client) => {
    // Clear stale data BEFORE setting new client to prevent showing old brand's data
    // with the new brand's name (race condition fix)
    setPrompts([]);
    setAuditResults([]);
    setTavilyResults({});
    setCitationMeta({});
    setSummary(null);
    setSelectedClient(client);
    saveToStorage(STORAGE_KEYS.SELECTED_CLIENT, client.id);
    // Single entry point for data loading — no duplicate fetches
    await loadClientData(client);
  }, [loadClientData]);

  const updateBrandTags = useCallback(async (tags: string[]) => {
    if (!selectedClient) return;
    const updated = { ...selectedClient, brand_tags: tags };
    setSelectedClient(updated);
    try {
      await supabase.from("clients").update({ brand_tags: tags }).eq("id", selectedClient.id);
    } catch (err) { console.log("Supabase update failed:", err); }
    const newClients = clients.map(c => c.id === selectedClient.id ? updated : c);
    setClients(newClients);
    saveToStorage(STORAGE_KEYS.CLIENTS, newClients);
    invalidateClientCache(selectedClient.id);
  }, [selectedClient, clients, invalidateClientCache]);

  const updateCompetitors = useCallback(async (competitors: string[]) => {
    if (!selectedClient) return;
    const updated = { ...selectedClient, competitors };
    setSelectedClient(updated);
    try {
      await supabase.from("clients").update({ competitors }).eq("id", selectedClient.id);
    } catch (err) { console.log("Supabase update failed:", err); }
    const newClients = clients.map(c => c.id === selectedClient.id ? updated : c);
    setClients(newClients);
    saveToStorage(STORAGE_KEYS.CLIENTS, newClients);
    invalidateClientCache(selectedClient.id);
  }, [selectedClient, clients, invalidateClientCache]);

  // ============================================
  // PROMPT MANAGEMENT - Supabase Primary
  // ============================================

  const addCustomPrompt = useCallback(async (promptText: string, category?: PromptCategory, locationCode?: number, locationName?: string, topic?: string): Promise<Prompt | null> => {
    if (!selectedClient) return null;

    // Check agency prompt limit (15 prompts per brand)
    const { data: { user } } = await supabase.auth.getUser();
    if (user) {
      const { data: profile } = await supabase.from('profiles').select('role').eq('id', user.id).single();
      if (profile?.role === 'agency') {
        const { count } = await supabase
          .from('prompts')
          .select('*', { count: 'exact', head: true })
          .eq('client_id', selectedClient.id);
        if ((count || 0) >= 15) {
          throw new Error('Agency users are limited to 15 prompts per brand. Delete some prompts or contact admin.');
        }
      }
    }

    const nicheLevel = detectNicheLevel(promptText);
    const detectedCategory = category || (nicheLevel === "super_niche" ? "super_niche" : nicheLevel === "niche" ? "niche" : "custom");

    const newPrompt: Prompt = {
      id: crypto.randomUUID(), client_id: selectedClient.id, prompt_text: promptText,
      category: detectedCategory, is_custom: true, is_active: true, niche_level: nicheLevel,
      location_code: locationCode, location_name: locationName,
      topic: topic || undefined,
    };

    // Save to Supabase first
    try {
      const { error: insertError } = await supabase.from("prompts").insert({
        id: newPrompt.id, client_id: newPrompt.client_id, prompt_text: newPrompt.prompt_text,
        category: newPrompt.category, is_custom: newPrompt.is_custom, is_active: newPrompt.is_active,
        location_code: newPrompt.location_code, location_name: newPrompt.location_name,
        topic: newPrompt.topic || null,
      });

      if (insertError) {
        // If unique constraint violation (duplicate prompt), fetch existing and return it
        if (insertError.code === '23505') {
          const { data: existing } = await supabase
            .from("prompts")
            .select("*")
            .eq("client_id", selectedClient.id)
            .eq("prompt_text", promptText)
            .single();

          if (existing) {
            toast.info("Prompt already exists. Using existing prompt.");
            return existing;
          }
        }
        throw insertError;
      }

      // Only update local state if DB insert succeeded
      const newPrompts = [...prompts, newPrompt];
      setPrompts(newPrompts);
      const storedPrompts = loadFromStorage<Record<string, Prompt[]>>(STORAGE_KEYS.PROMPTS, {});
      storedPrompts[selectedClient.id] = newPrompts;
      saveToStorage(STORAGE_KEYS.PROMPTS, storedPrompts);

      return newPrompt;
    } catch (err) {
      console.error("Supabase prompt insert failed:", err);
      throw err; // Propagate error to UI
    }
  }, [selectedClient, prompts]);

  const addMultiplePrompts = useCallback(async (promptTexts: string[], category?: PromptCategory, locationCode?: number, locationName?: string, topic?: string): Promise<Prompt[]> => {
    if (!selectedClient) return [];

    // Check agency prompt limit (15 prompts per brand)
    const { data: { user } } = await supabase.auth.getUser();
    let maxPromptsToAdd = promptTexts.length;
    if (user) {
      const { data: profile } = await supabase.from('profiles').select('role').eq('id', user.id).single();
      if (profile?.role === 'agency') {
        const { count } = await supabase
          .from('prompts')
          .select('*', { count: 'exact', head: true })
          .eq('client_id', selectedClient.id);
        const currentCount = count || 0;
        const remainingSlots = 15 - currentCount;
        if (remainingSlots <= 0) {
          throw new Error('Agency users are limited to 15 prompts per brand. Delete some prompts or contact admin.');
        }
        maxPromptsToAdd = Math.min(promptTexts.length, remainingSlots);
        if (maxPromptsToAdd < promptTexts.length) {
          console.warn(`Agency limit: Only adding ${maxPromptsToAdd} of ${promptTexts.length} prompts (limit: 15 per brand)`);
        }
      }
    }

    // Deduplicate against existing prompts (case-insensitive, trimmed)
    const existingTexts = new Set(prompts.map(p => p.prompt_text.trim().toLowerCase()));
    const uniqueTexts = promptTexts
      .slice(0, maxPromptsToAdd)
      .map(t => t.trim())
      .filter(t => t.length > 0)
      .filter(t => !existingTexts.has(t.toLowerCase()));

    if (uniqueTexts.length === 0) {
      console.log('All prompts already exist, skipping insert.');
      return [];
    }

    // Also deduplicate within the input itself
    const seenInBatch = new Set<string>();
    const dedupedTexts = uniqueTexts.filter(t => {
      const key = t.toLowerCase();
      if (seenInBatch.has(key)) return false;
      seenInBatch.add(key);
      return true;
    });

    const skippedCount = promptTexts.length - dedupedTexts.length;
    if (skippedCount > 0) {
      console.log(`Skipped ${skippedCount} duplicate prompt(s).`);
    }

    const newPrompts: Prompt[] = dedupedTexts.map(text => {
      const nicheLevel = detectNicheLevel(text);
      return {
        id: crypto.randomUUID(), client_id: selectedClient.id, prompt_text: text,
        category: category || (nicheLevel === "super_niche" ? "super_niche" : nicheLevel === "niche" ? "niche" : "imported"),
        is_custom: true, is_active: true, niche_level: nicheLevel,
        location_code: locationCode, location_name: locationName,
        topic: topic || undefined,
      };
    });

    // Save to Supabase
    try {
      const { error: insertError } = await supabase.from("prompts").insert(
        newPrompts.map(p => ({
          id: p.id, client_id: p.client_id, prompt_text: p.prompt_text,
          category: p.category, is_custom: p.is_custom, is_active: p.is_active,
          location_code: p.location_code, location_name: p.location_name,
          topic: p.topic || null,
        }))
      );

      if (insertError) {
        // If unique constraint violation on bulk, fall back to individual inserts
        if (insertError.code === '23505') {
          console.warn('Bulk insert hit duplicate constraint, falling back to individual inserts...');
          const successfulPrompts: Prompt[] = [];
          for (const p of newPrompts) {
            const { error: singleError } = await supabase.from("prompts").insert({
              id: p.id, client_id: p.client_id, prompt_text: p.prompt_text,
              category: p.category, is_custom: p.is_custom, is_active: p.is_active,
              location_code: p.location_code, location_name: p.location_name,
              topic: p.topic || null,
            });
            if (!singleError) {
              successfulPrompts.push(p);
            } else if (singleError.code !== '23505') {
              console.error('Failed to insert prompt:', p.prompt_text, singleError);
            }
          }
          if (successfulPrompts.length > 0) {
            const allPrompts = [...prompts, ...successfulPrompts];
            setPrompts(allPrompts);
            const storedPrompts = loadFromStorage<Record<string, Prompt[]>>(STORAGE_KEYS.PROMPTS, {});
            storedPrompts[selectedClient.id] = allPrompts;
            saveToStorage(STORAGE_KEYS.PROMPTS, storedPrompts);
          }
          return successfulPrompts;
        }
        throw insertError;
      }

      // Only update local state if DB insert succeeded
      const allPrompts = [...prompts, ...newPrompts];
      setPrompts(allPrompts);
      const storedPrompts = loadFromStorage<Record<string, Prompt[]>>(STORAGE_KEYS.PROMPTS, {});
      storedPrompts[selectedClient.id] = allPrompts;
      saveToStorage(STORAGE_KEYS.PROMPTS, storedPrompts);
      return newPrompts;
    } catch (err) {
      console.error("Supabase bulk insert failed:", err);
      throw err;
    }
  }, [selectedClient, prompts]);

  const generateNichePrompts = useCallback(async () => {
    if (!selectedClient) return;
    const preset = INDUSTRY_PRESETS[selectedClient.industry];
    if (!preset) return;
    const region = selectedClient.target_region;
    const allPrompts = [
      ...preset.prompts.map(p => p.replace("{region}", region)),
      ...preset.nichePrompts.map(p => p.replace("{region}", region)),
      ...preset.superNichePrompts.map(p => p.replace("{region}", region)),
    ];
    await addMultiplePrompts(allPrompts);
  }, [selectedClient, addMultiplePrompts]);

  const deletePrompt = useCallback(async (promptId: string) => {
    if (!selectedClient) return;

    // Soft delete - mark prompt as inactive in database (keep for tracking)
    try {
      await supabase.from("prompts").update({ is_active: false }).eq("id", promptId);
    } catch (err) { console.log("Supabase soft delete prompt failed:", err); }

    // Update local prompts state - mark as inactive instead of removing
    const updatedPrompts = prompts.map(p => p.id === promptId ? { ...p, is_active: false } : p);
    setPrompts(updatedPrompts);
    const storedPrompts = loadFromStorage<Record<string, Prompt[]>>(STORAGE_KEYS.PROMPTS, {});
    storedPrompts[selectedClient.id] = updatedPrompts;
    saveToStorage(STORAGE_KEYS.PROMPTS, storedPrompts);

    // Keep audit results in local storage for historical tracking
    // Only update the summary to reflect active prompts
    const activeResults = auditResults.filter(r => {
      const prompt = updatedPrompts.find(p => p.id === r.prompt_id);
      return prompt?.is_active !== false;
    });

    // Note: We don't remove audit results from storage - they stay for historical tracking
    // We only update the UI to show active prompts
    setAuditResults(activeResults);

    // Recalculate summary based on remaining active prompts
    if (activeResults.length === 0) {
      setSummary(null);
    } else {
      let totalSov = 0, totalCitations = 0, totalCost = 0, rankSum = 0, rankCount = 0;
      for (const r of activeResults) {
        totalSov += r.summary.share_of_voice;
        totalCitations += r.summary.total_citations;
        totalCost += r.summary.total_cost;
        if (r.summary.average_rank) { rankSum += r.summary.average_rank; rankCount++; }
      }
      setSummary({
        total_prompts: activeResults.length,
        overall_sov: Math.round(totalSov / activeResults.length),
        average_rank: rankCount > 0 ? Math.round((rankSum / rankCount) * 10) / 10 : null,
        total_citations: totalCitations,
        total_cost: totalCost,
      });
    }
  }, [selectedClient, prompts, auditResults]);

  const bulkArchivePrompts = useCallback(async (promptIds: string[]) => {
    if (!selectedClient || promptIds.length === 0) return;
    const archiveSet = new Set(promptIds);

    // 1. Single DB update
    try {
      await supabase
        .from("prompts")
        .update({ is_active: false })
        .in("id", promptIds);
    } catch (err) { console.error("Supabase batch archive failed:", err); }

    // 2. Single local state update
    const updatedPrompts = prompts.map(p =>
      archiveSet.has(p.id) ? { ...p, is_active: false } : p
    );
    setPrompts(updatedPrompts);

    // 3. Update localStorage
    const storedPrompts = loadFromStorage<Record<string, Prompt[]>>(STORAGE_KEYS.PROMPTS, {});
    storedPrompts[selectedClient.id] = updatedPrompts;
    saveToStorage(STORAGE_KEYS.PROMPTS, storedPrompts);

    // 4. Remove archived prompts' results from active view & recalculate summary
    const activeResults = auditResults.filter(r => !archiveSet.has(r.prompt_id));
    setAuditResults(activeResults);
    if (activeResults.length === 0) {
      setSummary(null);
    } else {
      let totalSov = 0, totalCitations = 0, totalCost = 0, rankSum = 0, rankCount = 0;
      for (const r of activeResults) {
        totalSov += r.summary.share_of_voice;
        totalCitations += r.summary.total_citations;
        totalCost += r.summary.total_cost;
        if (r.summary.average_rank) { rankSum += r.summary.average_rank; rankCount++; }
      }
      setSummary({
        total_prompts: activeResults.length,
        overall_sov: Math.round(totalSov / activeResults.length),
        average_rank: rankCount > 0 ? Math.round((rankSum / rankCount) * 10) / 10 : null,
        total_citations: totalCitations,
        total_cost: totalCost,
      });
    }
  }, [selectedClient, prompts, auditResults]);

  const bulkDeletePrompts = useCallback(async (promptIds: string[]) => {
    if (!selectedClient || promptIds.length === 0) return;
    const deleteSet = new Set(promptIds);

    // 1. Permanently delete from database
    try {
      await supabase
        .from("prompts")
        .delete()
        .in("id", promptIds);
    } catch (err) { console.error("Supabase batch delete failed:", err); }

    // 2. Remove from local state
    const updatedPrompts = prompts.filter(p => !deleteSet.has(p.id));
    setPrompts(updatedPrompts);

    // 3. Update localStorage
    const storedPrompts = loadFromStorage<Record<string, Prompt[]>>(STORAGE_KEYS.PROMPTS, {});
    storedPrompts[selectedClient.id] = updatedPrompts;
    saveToStorage(STORAGE_KEYS.PROMPTS, storedPrompts);

    // 4. Remove deleted prompts' results and recalculate summary
    const activeResults = auditResults.filter(r => !deleteSet.has(r.prompt_id));
    setAuditResults(activeResults);
    if (activeResults.length === 0) {
      setSummary(null);
    } else {
      let totalSov = 0, totalCitations = 0, totalCost = 0, rankSum = 0, rankCount = 0;
      for (const r of activeResults) {
        totalSov += r.summary.share_of_voice;
        totalCitations += r.summary.total_citations;
        totalCost += r.summary.total_cost;
        if (r.summary.average_rank) { rankSum += r.summary.average_rank; rankCount++; }
      }
      setSummary({
        total_prompts: activeResults.length,
        overall_sov: Math.round(totalSov / activeResults.length),
        average_rank: rankCount > 0 ? Math.round((rankSum / rankCount) * 10) / 10 : null,
        total_citations: totalCitations,
        total_cost: totalCost,
      });
    }
  }, [selectedClient, prompts, auditResults]);

  const updatePrompt = useCallback(async (promptId: string, updates: string | { prompt_text?: string, location_code?: number, location_name?: string, topic?: string }) => {
    if (!selectedClient) return;

    const updateData: any = {};
    if (typeof updates === 'string') {
      if (!updates.trim()) return;
      updateData.prompt_text = updates.trim();
    } else {
      if (updates.prompt_text !== undefined) updateData.prompt_text = updates.prompt_text.trim();
      if (updates.location_code !== undefined) updateData.location_code = updates.location_code;
      if (updates.location_name !== undefined) updateData.location_name = updates.location_name;
      if (updates.topic !== undefined) updateData.topic = updates.topic;
    }

    if (Object.keys(updateData).length === 0) return;

    // Update in Supabase - THROW on error to bubble up to UI
    try {
      const { error: updateError } = await supabase
        .from("prompts")
        .update(updateData)
        .eq("id", promptId);

      if (updateError) throw updateError;

      // Use functional state update to avoid stale closure issues with concurrent calls
      setPrompts(prev => {
        const updatedPrompts = prev.map(p => p.id === promptId ? { ...p, ...updateData } : p);
        const storedPrompts = loadFromStorage<Record<string, Prompt[]>>(STORAGE_KEYS.PROMPTS, {});
        storedPrompts[selectedClient.id] = updatedPrompts;
        saveToStorage(STORAGE_KEYS.PROMPTS, storedPrompts);
        return updatedPrompts;
      });
    } catch (err) {
      console.error("Supabase update prompt failed:", err);
      throw err;
    }
  }, [selectedClient]);

  const reactivatePrompt = useCallback(async (promptId: string) => {
    if (!selectedClient) return;

    // Reactivate prompt in database
    try {
      await supabase.from("prompts").update({ is_active: true }).eq("id", promptId);
    } catch (err) { console.log("Supabase reactivate prompt failed:", err); }

    // Update local prompts state - mark as active
    const updatedPrompts = prompts.map(p => p.id === promptId ? { ...p, is_active: true } : p);
    setPrompts(updatedPrompts);
    const storedPrompts = loadFromStorage<Record<string, Prompt[]>>(STORAGE_KEYS.PROMPTS, {});
    storedPrompts[selectedClient.id] = updatedPrompts;
    saveToStorage(STORAGE_KEYS.PROMPTS, storedPrompts);

    // Restore audit results for this prompt to the UI
    const storedResults = loadFromStorage<Record<string, AuditResult[]>>(STORAGE_KEYS.RESULTS, {});
    const allStoredResults = storedResults[selectedClient.id] || [];
    const promptResult = allStoredResults.find(r => r.prompt_id === promptId);

    if (promptResult && !auditResults.find(r => r.prompt_id === promptId)) {
      const newResults = [...auditResults, promptResult];
      setAuditResults(newResults);

      // Recalculate summary
      let totalSov = 0, totalCitations = 0, totalCost = 0, rankSum = 0, rankCount = 0;
      for (const r of newResults) {
        totalSov += r.summary.share_of_voice;
        totalCitations += r.summary.total_citations;
        totalCost += r.summary.total_cost;
        if (r.summary.average_rank) { rankSum += r.summary.average_rank; rankCount++; }
      }
      setSummary({
        total_prompts: newResults.length,
        overall_sov: Math.round(totalSov / newResults.length),
        average_rank: rankCount > 0 ? Math.round((rankSum / rankCount) * 10) / 10 : null,
        total_citations: totalCitations,
        total_cost: totalCost,
      });
    }
  }, [selectedClient, prompts, auditResults]);

  const clearAllPrompts = useCallback(async () => {
    if (!selectedClient) return;

    // Delete all prompts from database (keep audit results for historical tracking)
    try {
      await supabase.from("prompts").delete().eq("client_id", selectedClient.id);
    } catch (err) { console.log("Supabase clear prompts failed:", err); }

    // Clear local state (audit results stay in DB for tracking)
    setPrompts([]);
    setAuditResults([]);
    setSummary(null);

    const storedPrompts = loadFromStorage<Record<string, Prompt[]>>(STORAGE_KEYS.PROMPTS, {});
    storedPrompts[selectedClient.id] = [];
    saveToStorage(STORAGE_KEYS.PROMPTS, storedPrompts);

    const storedResults = loadFromStorage<Record<string, AuditResult[]>>(STORAGE_KEYS.RESULTS, {});
    storedResults[selectedClient.id] = [];
    saveToStorage(STORAGE_KEYS.RESULTS, storedResults);
  }, [selectedClient]);

  const clearResults = useCallback(async () => {
    if (!selectedClient) return;
    try {
      await supabase.from("audit_results").delete().eq("client_id", selectedClient.id);
    } catch (err) { console.log("Supabase clear results failed:", err); }
    setAuditResults([]);
    setSummary(null);
    const storedResults = loadFromStorage<Record<string, AuditResult[]>>(STORAGE_KEYS.RESULTS, {});
    storedResults[selectedClient.id] = [];
    saveToStorage(STORAGE_KEYS.RESULTS, storedResults);
  }, [selectedClient]);

  // ============================================
  // AUDIT EXECUTION - Save to Supabase
  // ============================================

  // Plain function (not useCallback) — avoids identity changes polluting dependency arrays
  const updateSummaryDirect = (results: AuditResult[]) => {
    if (results.length === 0) { setSummary(null); return; }
    let totalSov = 0, totalCitations = 0, totalCost = 0, rankSum = 0, rankCount = 0;
    for (const r of results) {
      totalSov += r.summary.share_of_voice;
      totalCitations += r.summary.total_citations;
      totalCost += r.summary.total_cost;
      if (r.summary.average_rank) { rankSum += r.summary.average_rank; rankCount++; }
    }
    setSummary({
      total_prompts: results.length, overall_sov: Math.round(totalSov / results.length),
      average_rank: rankCount > 0 ? Math.round((rankSum / rankCount) * 10) / 10 : null,
      total_citations: totalCitations, total_cost: totalCost,
    });
  };
  // Keep a stable reference alias for places that need a useCallback-style ref
  const updateSummary = useCallback((results: AuditResult[]) => updateSummaryDirect(results), []);

  // BUG-001 fix: Auto-update summary whenever auditResults changes — replaces unsafe setTimeout calls inside state updaters
  // PERF-002: Keep ref in sync for collision detection without triggering re-renders
  useEffect(() => {
    auditResultsRef.current = auditResults;
    updateSummaryDirect(auditResults);
  }, [auditResults]);

  const runFullAudit = useCallback(async (promptsOverride?: Prompt[]) => {
    const promptsToRun = promptsOverride || prompts;
    if (!selectedClient || promptsToRun.length === 0) return;
    setLoading(true);
    setError(null);
    let failedCount = 0;

    // Persist pending audit state so it can resume after page refresh
    const activePromptIds = promptsToRun.filter(p => p.is_active !== false).map(p => p.id);
    const pendingAudit = {
      clientId: selectedClient.id,
      pendingPromptIds: activePromptIds,
      startedAt: new Date().toISOString(),
    };
    saveToStorage(STORAGE_KEYS.PENDING_AUDIT, pendingAudit);

    for (const prompt of promptsToRun) {
      if (prompt.is_active === false) continue; // Skip inactive prompts

      // Check redundancy against FRESH state (ref would be better, but this reduces gap)
      // Note: In strict concurrency, we might still double-audit if timing matches perfectly, 
      // but functional update below prevents state corruption.
      setLoadingPromptIds(prev => new Set(prev).add(prompt.id));

      try {
        // Retry logic: up to 2 retries with exponential backoff for edge function failures
        let data: any = null;
        let fnError: any = null;
        const MAX_RETRIES = 2;
        for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
          const requestBody = {
            client_id: selectedClient.id, prompt_id: prompt.id, prompt_text: prompt.prompt_text,
            brand_name: selectedClient.brand_name, brand_tags: selectedClient.brand_tags,
            competitors: selectedClient.competitors,
            location_code: Number(prompt.location_code || selectedClient.location_code || 2840),
            location_name: selectedClient.target_region || "United States",
            models: selectedModels, niche_level: prompt.niche_level, save_to_db: true,
            skip_cache: true,
          };

          if (attempt === 0) {
            console.log(`[Audit] Running prompt "${prompt.prompt_text.substring(0, 50)}..."`);
          }

          const result = await supabase.functions.invoke("geo-audit", { body: requestBody });
          data = result.data;
          fnError = result.error;
          if (!fnError && data?.success) break; // Success — exit retry loop

          console.warn(`[Audit] Attempt ${attempt + 1} failed:`, {
            error: fnError?.message || fnError,
            errorDetails: JSON.stringify(fnError),
            status: fnError?.status,
            prompt: prompt.prompt_text.substring(0, 40),
          });

          if (attempt === MAX_RETRIES) {
            console.error(`[Audit] Failed after ${MAX_RETRIES} retries:`, fnError);
            toast.error(`Audit failed: ${prompt.prompt_text.substring(0, 30)}...`, {
              description: fnError?.message || (typeof fnError === 'string' ? fnError : "Check console for details")
            });
          }
          if (attempt < MAX_RETRIES) {
            const delay = Math.pow(2, attempt + 1) * 1000; // 2s, 4s
            await new Promise(r => setTimeout(r, delay));
          }
        }

        if (!fnError && data?.success) {
          // Clean and analyze results client-side for better accuracy
          const processedModelResults = data.data.model_results.map((mr: any) => {
            const analysis = cleanAndAnalyzeResponse(
              mr.raw_response || "",
              selectedClient.brand_name,
              selectedClient.competitors,
              selectedClient.brand_tags
            );
            return {
              ...mr,
              raw_response: analysis.cleanedResponse,
              brand_mentioned: analysis.brandMentions > 0,
              brand_mention_count: analysis.brandMentions,
              brand_rank: analysis.brandRank || mr.brand_rank,
              competitors_found: analysis.competitorStats.filter(c => c.count > 0 || c.rank !== null),
            };
          });

          // Recalculate summary locally is tricky without full list, so we rely on updateSummaryDirect later
          // But locally we can compute partials? No, simplest is to just push result.

          let summaries = { sov: 0, rankSum: 0, rankCount: 0, citations: 0, cost: 0 };
          processedModelResults.forEach((mr: any) => {
            if (mr.brand_mentioned) summaries.sov += (100 / processedModelResults.length);
            if (mr.brand_rank) { summaries.rankSum += mr.brand_rank; summaries.rankCount++; }
            summaries.citations += (mr.citations?.length || 0);
            summaries.cost += (mr.api_cost || 0);
          });

          const result: AuditResult = {
            id: data.data.id || crypto.randomUUID(), prompt_id: prompt.id, prompt_text: prompt.prompt_text,
            model_results: processedModelResults,
            summary: {
              share_of_voice: Math.round(summaries.sov),
              average_rank: summaries.rankCount > 0 && isFinite(summaries.rankSum / summaries.rankCount) ? parseFloat((summaries.rankSum / summaries.rankCount).toFixed(1)) : null,
              total_citations: summaries.citations,
              total_cost: summaries.cost
            },
            created_at: data.data.timestamp,
          };

          // Functional update to avoid race conditions
          setAuditResults(prev => {
            if (prev.find(r => r.prompt_id === prompt.id)) return prev;
            return [...prev, result];
          });

          // Persistence handled by useEffect

          // Run Tavily search if enabled
          if (includeTavily) {
            // ... (keep logic same, omitted for brevity, logic remains valid)
            try {
              // Fire and forget Tavily to avoid blocking next prompt loop?
              // The original code awaited it. We'll await it to be safe.
              console.log("[Tavily] Running for:", prompt.prompt_text.substring(0, 30));
              const { data: tavilyData } = await supabase.functions.invoke("tavily-search", {
                body: {
                  client_id: selectedClient.id, prompt_id: prompt.id, prompt_text: prompt.prompt_text,
                  brand_name: selectedClient.brand_name, competitors: selectedClient.competitors,
                  search_depth: "advanced", max_results: 20, include_answer: true, save_to_db: true,
                },
              });
              if (tavilyData?.success) {
                setTavilyResults(prev => ({ ...prev, [prompt.id]: tavilyData }));
              }
            } catch (err) { console.error("Tavily error:", err); }
          }
        } else {
          failedCount++;
          console.warn(`[Audit] Prompt failed: "${prompt.prompt_text.substring(0, 50)}..."`);
        }
        // Small delay between prompts to be nice to API
        await new Promise(r => setTimeout(r, 300));
      } catch (err) {
        failedCount++;
        console.error("[Audit] Exception on prompt:", prompt.prompt_text.substring(0, 50), err);
      } finally {
        setLoadingPromptIds(prev => { const n = new Set(prev); n.delete(prompt.id); return n; });
        // Remove completed prompt from pending audit state
        try {
          const pending = loadFromStorage<{ clientId: string; pendingPromptIds: string[]; startedAt: string } | null>(STORAGE_KEYS.PENDING_AUDIT, null);
          if (pending) {
            pending.pendingPromptIds = pending.pendingPromptIds.filter(id => id !== prompt.id);
            saveToStorage(STORAGE_KEYS.PENDING_AUDIT, pending);
          }
        } catch { /* ignore storage errors */ }
      }
    }
    if (failedCount > 0) {
      console.warn(`[Audit] Completed with ${failedCount} failed prompt(s).`);
    }
    setLoading(false);

    // Clear pending audit state — audit is complete
    try { localStorage.removeItem(STORAGE_KEYS.PENDING_AUDIT); } catch { /* ignore */ }

    // Auto-trigger search volume fetch after audit completes
    try {
      await fetchSearchVolumesRef.current?.();
    } catch (err) {
      console.warn("[SearchVolume] Auto-fetch after audit failed:", err);
    }

    // Auto-categorize any new citation domains (fire-and-forget)
    autoCategorizeRef.current?.().catch(err => console.warn("[AutoCategorize] Post-audit failed:", err));
  }, [selectedClient, prompts, selectedModels, updateSummary, includeTavily]);

  const runSinglePrompt = useCallback(async (promptOrId: string | Prompt) => {
    if (!selectedClient) return;

    let prompt: Prompt | undefined;
    if (typeof promptOrId === 'string') {
      prompt = prompts.find(p => p.id === promptOrId);
    } else {
      prompt = promptOrId;
    }

    if (!prompt) {
      console.warn("runSinglePrompt: Prompt not found", promptOrId);
      return;
    }

    setLoadingPromptIds(prev => new Set(prev).add(prompt.id));
    setError(null);

    try {
      // Retry logic: up to 2 retries with exponential backoff
      let data: any = null;
      let fnError: any = null;
      const MAX_RETRIES = 2;
      for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
        const requestBody = {
          client_id: selectedClient.id, prompt_id: prompt.id, prompt_text: prompt.prompt_text,
          brand_name: selectedClient.brand_name, brand_tags: selectedClient.brand_tags,
          competitors: selectedClient.competitors,
          location_code: prompt.location_code || selectedClient.location_code,
          location_name: selectedClient.target_region || "United States",
          models: selectedModels, niche_level: prompt.niche_level, save_to_db: true,
        };
        if (attempt === 0) {
          console.log(`[SingleAudit] Running prompt "${prompt.prompt_text.substring(0, 50)}..."`);
        }
        const result = await supabase.functions.invoke("geo-audit", { body: requestBody });
        data = result.data;
        fnError = result.error;
        if (!fnError && data?.success) break;

        console.warn(`[SingleAudit] Attempt ${attempt + 1} failed:`, {
          error: fnError?.message || fnError,
          status: fnError?.status,
          prompt: prompt.prompt_text.substring(0, 40),
        });

        if (attempt < MAX_RETRIES) {
          const delay = Math.pow(2, attempt + 1) * 1000;
          await new Promise(r => setTimeout(r, delay));
        }
      }

      if (!fnError && data?.success) {
        // Clean and analyze results client-side for better accuracy
        const processedModelResults = data.data.model_results.map((mr: any) => {
          const analysis = cleanAndAnalyzeResponse(
            mr.raw_response || "",
            selectedClient.brand_name,
            selectedClient.competitors,
            selectedClient.brand_tags
          );
          return {
            ...mr,
            raw_response: analysis.cleanedResponse,
            brand_mentioned: analysis.brandMentions > 0,
            brand_mention_count: analysis.brandMentions,
            brand_rank: analysis.brandRank || mr.brand_rank,
            competitors_found: analysis.competitorStats.filter(c => c.count > 0 || c.rank !== null),
          };
        });

        // Recalculate summary locally is tricky without full list, so we rely on updateSummaryDirect later
        let summaries = { sov: 0, rankSum: 0, rankCount: 0, citations: 0, cost: 0 };
        processedModelResults.forEach((mr: any) => {
          if (mr.brand_mentioned) summaries.sov += (100 / processedModelResults.length);
          if (mr.brand_rank) { summaries.rankSum += mr.brand_rank; summaries.rankCount++; }
          summaries.citations += (mr.citations?.length || 0);
          summaries.cost += (mr.api_cost || 0);
        });

        const result: AuditResult = {
          id: data.data.id || crypto.randomUUID(), prompt_id: prompt.id, prompt_text: prompt.prompt_text,
          model_results: processedModelResults,
          summary: {
            share_of_voice: Math.round(summaries.sov),
            average_rank: summaries.rankCount > 0 && isFinite(summaries.rankSum / summaries.rankCount) ? parseFloat((summaries.rankSum / summaries.rankCount).toFixed(1)) : null,
            total_citations: summaries.citations,
            total_cost: summaries.cost
          },
          created_at: data.data.timestamp,
        };

        setAuditResults(prev => {
          const index = prev.findIndex(r => r.prompt_id === prompt!.id);
          if (index >= 0) {
            const nextResults = [...prev];
            nextResults[index] = result;
            return nextResults;
          }
          return [...prev, result];
        });

        // Persistence handled by useEffect

        // Run Tavily search if enabled
        if (includeTavily) {
          try {
            // Fire and forget, but await to not unmount early
            console.log("[Tavily] Running for:", prompt.prompt_text.substring(0, 30));
            const { data: tavilyData } = await supabase.functions.invoke("tavily-search", {
              body: {
                client_id: selectedClient.id, prompt_id: prompt.id, prompt_text: prompt.prompt_text,
                brand_name: selectedClient.brand_name, competitors: selectedClient.competitors,
                search_depth: "advanced", max_results: 20, include_answer: true, save_to_db: true,
              },
            });

            if (tavilyData?.success) {
              setTavilyResults(prev => ({ ...prev, [prompt.id]: tavilyData }));
            }
          } catch (tavilyErr) {
            console.error("[Tavily] Exception:", tavilyErr);
          }
        }
      } else {
        setError(fnError?.message || data?.error || "Audit failed");
      }
    } catch (err) {
      console.error("Single audit error CRITICAL:", err);
      setError(err instanceof Error ? err.message : "Audit failed");
    } finally {
      setLoadingPromptIds(prev => { const n = new Set(prev); n.delete(prompt!.id); return n; });
    }

    // Auto-trigger search volume fetch after single audit completes
    try {
      await fetchSearchVolumesRef.current?.();
    } catch (err) {
      console.warn("[SearchVolume] Auto-fetch after single audit failed:", err);
    }

    // Auto-categorize any new citation domains (fire-and-forget)
    autoCategorizeRef.current?.().catch(err => console.warn("[AutoCategorize] Post-single-audit failed:", err));
  }, [selectedClient, prompts, selectedModels, updateSummary, includeTavily]);

  /**
   * Run multi-account schedule execution
   * Invokes the multi-account-runner edge function to execute prompts across multiple brands
   */
  const runMultiAccountSchedule = useCallback(async (scheduleId: string) => {
    try {
      const { data, error } = await supabase.functions.invoke('multi-account-runner', {
        body: { schedule_id: scheduleId, force: true }
      });

      if (error) {
        console.error('Multi-account run error:', error);
        toast.error('Failed to start multi-account execution');
        return null;
      }

      if (data?.run_id) {
        toast.success('Multi-account execution started');
        return data.run_id;
      }

      toast.warning('Schedule execution was skipped');
      return null;
    } catch (err) {
      console.error('Multi-account run exception:', err);
      toast.error('Failed to start multi-account execution');
      return null;
    }
  }, []);

  const runCampaign = useCallback(async (name: string, promptIds: string[]) => {
    if (!selectedClient || promptIds.length === 0) return;
    setLoading(true);
    setError(null);

    // 1. Create Campaign
    let campaignId = "";
    try {
      const { data: camp, error: campError } = await supabase
        .from("campaigns")
        .insert({
          client_id: selectedClient.id,
          name: name,
          total_prompts: promptIds.length,
          status: "running"
        })
        .select()
        .single();
      if (campError) throw new Error(campError.message);
      campaignId = camp.id;
    } catch (err) {
      setError("Failed to create campaign: " + (err instanceof Error ? err.message : String(err)));
      setLoading(false);
      return;
    }

    // 2. Run Prompts — BUG-002 fix: accumulate results locally, set state once at end
    const campaignResults: AuditResult[] = [];

    for (const promptId of promptIds) {
      const prompt = prompts.find(p => p.id === promptId);
      if (!prompt) continue;

      setLoadingPromptIds(prev => new Set(prev).add(promptId));

      try {
        const { data, error: fnError } = await supabase.functions.invoke("geo-audit", {
          body: {
            client_id: selectedClient.id,
            campaign_id: campaignId,
            prompt_id: prompt.id,
            prompt_text: prompt.prompt_text,
            brand_name: selectedClient.brand_name,
            brand_tags: selectedClient.brand_tags,
            competitors: selectedClient.competitors,
            location_code: prompt.location_code || selectedClient.location_code,
            location_name: selectedClient.target_region || "United States",
            models: selectedModels,
            niche_level: prompt.niche_level,
            save_to_db: true,
          },
        });

        if (!fnError && data?.success) {
          const processedModelResults = data.data.model_results.map((mr: any) => {
            const analysis = cleanAndAnalyzeResponse(
              mr.raw_response || "",
              selectedClient.brand_name,
              selectedClient.competitors,
              selectedClient.brand_tags
            );
            return {
              ...mr,
              raw_response: analysis.cleanedResponse,
              brand_mentioned: analysis.brandMentions > 0,
              brand_mention_count: analysis.brandMentions,
              brand_rank: analysis.brandRank || mr.brand_rank,
              competitors_found: analysis.competitorStats.filter(c => c.count > 0 || c.rank !== null),
            };
          });

          let summaries = { sov: 0, rankSum: 0, rankCount: 0, citations: 0, cost: 0 };
          processedModelResults.forEach((mr: any) => {
            if (mr.brand_mentioned) summaries.sov += (100 / processedModelResults.length);
            if (mr.brand_rank) { summaries.rankSum += mr.brand_rank; summaries.rankCount++; }
            summaries.citations += (mr.citations?.length || 0);
            summaries.cost += (mr.api_cost || 0);
          });

          const result: AuditResult = {
            id: data.data.id || crypto.randomUUID(), prompt_id: prompt.id, prompt_text: prompt.prompt_text,
            model_results: processedModelResults,
            summary: {
              share_of_voice: Math.round(summaries.sov),
              average_rank: summaries.rankCount > 0 && isFinite(summaries.rankSum / summaries.rankCount) ? parseFloat((summaries.rankSum / summaries.rankCount).toFixed(1)) : null,
              total_citations: summaries.citations,
              total_cost: summaries.cost
            },
            created_at: data.data.timestamp,
          };
          campaignResults.push(result);

          if (includeTavily) {
            try {
              console.log("[Tavily] Running source analysis for campaign prompt:", prompt.prompt_text.substring(0, 50));
              const { data: tavilyData, error: tavilyError } = await supabase.functions.invoke("tavily-search", {
                body: {
                  client_id: selectedClient.id,
                  prompt_id: prompt.id,
                  prompt_text: prompt.prompt_text,
                  brand_name: selectedClient.brand_name,
                  competitors: selectedClient.competitors,
                  search_depth: "advanced",
                  max_results: 20,
                  include_answer: true,
                  save_to_db: true,
                },
              });

              if (!tavilyError && tavilyData?.success) {
                console.log("[Tavily] Got", tavilyData.sources?.length || 0, "sources");
                setTavilyResults(prev => ({ ...prev, [prompt.id]: tavilyData }));
              } else {
                console.warn("[Tavily] Search failed:", tavilyError || tavilyData?.error);
              }
            } catch (tavilyErr) {
              console.error("[Tavily] Exception:", tavilyErr);
            }
          }
        } else {
          console.error("Campaign prompt failed:", fnError || data?.error);
        }
        await new Promise(r => setTimeout(r, 500));
      } catch (err) {
        console.error("Campaign run error:", err);
      } finally {
        const pid = promptId;
        setLoadingPromptIds(prev => { const n = new Set(prev); n.delete(pid); return n; });
      }
    }

    // Single state update with dedup — summary auto-updates via useEffect (BUG-001 fix)
    setAuditResults(prev => {
      const existingIds = new Set(prev.map(r => r.prompt_id));
      const deduped = campaignResults.filter(r => !existingIds.has(r.prompt_id));
      return [...prev, ...deduped];
    });

    setLoading(false);
  }, [selectedClient, prompts, selectedModels, updateSummary, includeTavily]);

  // ============================================
  // EXPORT/IMPORT FUNCTIONS
  // ============================================

  const exportToCSV = useCallback(() => {
    if (!selectedClient || auditResults.length === 0) return;
    const rows = [["Prompt", "Category", "Niche Level", "SOV", "Position", "Citations", "Competitors Found"]];
    for (const r of auditResults) {
      const prompt = prompts.find(p => p.id === r.prompt_id);
      // Collect competitors mentioned in this audit
      const competitorsFound = new Set<string>();
      if (selectedClient?.competitors) {
        r.model_results.forEach(mr => {
          const response = mr.raw_response?.toLowerCase() || '';
          selectedClient.competitors.forEach(comp => {
            if (response.includes(comp.toLowerCase())) competitorsFound.add(comp);
          });
        });
      }
      rows.push([r.prompt_text, prompt?.category || "custom", prompt?.niche_level || "broad",
      `${r.summary.share_of_voice}%`, r.summary.average_rank?.toString() || "-",
      r.summary.total_citations.toString(), Array.from(competitorsFound).join('; ')]);
    }
    const csv = rows.map(r => r.map(c => `"${c}"`).join(",")).join("\n");
    const blob = new Blob([csv], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${selectedClient.slug}-results-${new Date().toISOString().split("T")[0]}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }, [selectedClient, auditResults, prompts]);

  const exportPrompts = useCallback(() => {
    if (!selectedClient) return;
    const data = {
      client: selectedClient.name, exported_at: new Date().toISOString(),
      prompts: prompts.map(p => ({ text: p.prompt_text, category: p.category, niche_level: p.niche_level }))
    };
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${selectedClient.slug}-prompts-${new Date().toISOString().split("T")[0]}.json`;
    a.click();
    URL.revokeObjectURL(url);
  }, [selectedClient, prompts]);

  const exportFullReport = useCallback(() => {
    if (!selectedClient) return;
    const stats = getModelStats();
    const gap = getCompetitorGap();
    const sources = getTopSources().slice(0, 10);
    const ins = getInsights();
    const date = new Date().toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' });

    let report = `# Forzeo GEO Visibility Report\n\n`;
    report += `| Field | Value |\n|---|---|\n`;
    report += `| **Client** | ${selectedClient.name} |\n`;
    report += `| **Brand** | ${selectedClient.brand_name} |\n`;
    report += `| **Website** | ${selectedClient.brand_domain || 'Not specified'} |\n`;
    report += `| **Industry** | ${selectedClient.industry} |\n`;
    report += `| **Region** | ${selectedClient.target_region} |\n`;
    report += `| **Date** | ${date} |\n\n`;
    report += `## Summary\n\n`;
    report += `- **Share of Voice:** ${summary?.overall_sov || 0}%\n`;
    report += `- **Average Position:** ${summary?.average_rank ? `#${summary.average_rank}` : 'N/A'}\n`;
    report += `- **Total Citations:** ${summary?.total_citations || 0}\n`;
    report += `- **Status:** ${ins.statusText}\n\n`;
    report += `### Recommendations\n\n${ins.recommendations.map(r => `- ${r}`).join('\n')}\n\n`;
    report += `## Visibility by Model\n\n`;
    report += `| Model | Visible | Total | Rate |\n|---|---|---|---|\n`;
    AI_MODELS.forEach(model => {
      const s = stats[model.id] || { visible: 0, total: 0, cost: 0 };
      const pct = s.total > 0 ? Math.round((s.visible / s.total) * 100) : 0;
      report += `| ${model.name} | ${s.visible} | ${s.total} | ${pct}% |\n`;
    });
    report += `\n## Competitor Analysis\n\n`;
    report += `| # | Competitor | SOV | Mentions |\n|---|---|---|---|\n`;
    gap.forEach((c, idx) => { report += `| ${idx + 1} | ${c.name} | ${c.percentage}% | ${c.mentions} |\n`; });
    report += `\n## Top Sources\n\n`;
    report += `| # | Domain | Citations |\n|---|---|---|\n`;
    sources.forEach((s, idx) => { report += `| ${idx + 1} | ${s.domain} | ${s.count} |\n`; });

    // Add Tavily Results section
    const tavilyEntries = Object.entries(tavilyResults).filter(([_, data]) => data);
    if (tavilyEntries.length > 0) {
      report += `\n---\n\n## Tavily AI Source Analysis\n\n`;

      tavilyEntries.forEach(([promptText, data]: [string, any]) => {
        report += `QUERY: "${promptText}"\n${"-".repeat(40)}\n`;

        if (data.answer) {
          report += `AI Answer:\n${data.answer.substring(0, 500)}${data.answer.length > 500 ? '...' : ''}\n\n`;
        }

        if (data.analysis) {
          report += `Brand Mentioned: ${data.analysis.brand_mentioned ? 'Yes' : 'No'} (${data.analysis.brand_mention_count || 0} times)\n`;

          const compMentions = Object.entries(data.analysis.competitor_mentions || {})
            .filter(([_, count]) => (count as number) > 0)
            .map(([name, count]) => `${name}: ${count}`)
            .join(', ');
          if (compMentions) {
            report += `Competitor Mentions: ${compMentions}\n`;
          }

          if (data.analysis.top_domains?.length > 0) {
            report += `Top Domains: ${data.analysis.top_domains.slice(0, 5).map((d: any) => d.domain).join(', ')}\n`;
          }

          if (data.analysis.source_types) {
            const types = Object.entries(data.analysis.source_types)
              .filter(([_, count]) => (count as number) > 0)
              .map(([type, count]) => `${type}: ${count}`)
              .join(', ');
            report += `Source Types: ${types}\n`;
          }

          if (data.analysis.insights?.length > 0) {
            report += `Insights:\n${data.analysis.insights.map((i: string) => `  • ${i}`).join('\n')}\n`;
          }
        }

        if (data.sources?.length > 0) {
          report += `\nTop Sources (${data.sources.length} total):\n`;
          data.sources.slice(0, 5).forEach((src: any, idx: number) => {
            report += `  ${idx + 1}. ${src.domain} - ${src.title?.substring(0, 50) || 'No title'}...\n`;
          });
        }

        report += `\n`;
      });
    }

    // Add AI Visibility Insights section
    if (auditResults.length > 0) {
      report += `\n---\n\n## AI Visibility Insights & Recommendations\n\n`;

      // Overall Summary
      const overallSov = auditResults.length > 0
        ? Math.round(auditResults.reduce((sum, r) => sum + (r.summary?.share_of_voice || 0), 0) / auditResults.length)
        : 0;
      const overallPriority = overallSov < 30 ? 'HIGH' : overallSov < 60 ? 'MEDIUM' : 'LOW';
      const highPriorityCount = auditResults.filter(r => (r.summary?.share_of_voice || 0) < 30).length;
      const mediumPriorityCount = auditResults.filter(r => {
        const sov = r.summary?.share_of_voice || 0;
        return sov >= 30 && sov < 60;
      }).length;
      const lowPriorityCount = auditResults.filter(r => (r.summary?.share_of_voice || 0) >= 60).length;

      report += `### Overall Visibility Summary\n\n`;
      report += `Average Visibility: ${overallSov}%\n`;
      report += `Overall Priority: ${overallPriority}\n`;
      report += `Prompts by Priority:\n`;
      report += `  • Critical (<30%): ${highPriorityCount}\n`;
      report += `  • Needs Work (30-60%): ${mediumPriorityCount}\n`;
      report += `  • Good (>60%): ${lowPriorityCount}\n\n`;

      // Aggregated Recommendations
      const aggRecs: string[] = [];
      if (overallSov < 30) {
        aggRecs.push(`Critical: Overall brand visibility is very low (${overallSov}%). Focus on building authoritative content across all target queries.`);
      }

      // Find top competitors mentioned across all audits
      const allCompMentions: Record<string, number> = {};
      // Pre-compile regex patterns once outside the loop
      const compRegexes = selectedClient.competitors.map(comp => ({
        name: comp,
        regex: new RegExp(comp.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'gi')
      }));
      auditResults.forEach(result => {
        result.model_results.forEach(mr => {
          const response = mr.raw_response || '';
          compRegexes.forEach(({ name, regex }) => {
            regex.lastIndex = 0; // Reset lastIndex before each match
            const matches = response.match(regex);
            if (matches) allCompMentions[name] = (allCompMentions[name] || 0) + matches.length;
          });
        });
      });
      const topComps = Object.entries(allCompMentions).sort((a, b) => b[1] - a[1]).slice(0, 3);
      if (topComps.length > 0) {
        aggRecs.push(`Top competitors in AI responses: ${topComps.map(([name, count]) => `${name} (${count}x)`).join(', ')}. Analyze their content strategies.`);
      }

      // Find top cited domains
      const allDomains: Record<string, number> = {};
      auditResults.forEach(result => {
        result.model_results.forEach(mr => {
          mr.citations.forEach(c => allDomains[c.domain] = (allDomains[c.domain] || 0) + 1);
        });
      });
      const topDoms = Object.entries(allDomains).sort((a, b) => b[1] - a[1]).slice(0, 5).map(([d]) => d);
      if (topDoms.length > 0) {
        aggRecs.push(`High-value citation sources to target: ${topDoms.join(', ')}`);
      }

      if (highPriorityCount > 0) {
        aggRecs.push(`${highPriorityCount} prompt${highPriorityCount > 1 ? 's' : ''} with critical visibility gaps require immediate attention.`);
      }

      if (aggRecs.length > 0) {
        report += `AI-POWERED STRATEGIC INSIGHTS (Aggregated)\n${"-".repeat(40)}\n`;
        aggRecs.forEach((rec, idx) => report += `${idx + 1}. ${rec}\n`);
        report += `\n`;
      }

      report += `PER-PROMPT INSIGHTS\n${"-".repeat(40)}\n\n`;

      auditResults.forEach(result => {
        const sov = result.summary?.share_of_voice || 0;
        const rank = result.summary?.average_rank;
        const citations = result.summary?.total_citations || 0;
        const tavilyData = tavilyResults[result.prompt_id] as any;

        // Determine priority
        const priority = sov < 30 ? 'HIGH' : sov < 60 ? 'MEDIUM' : 'LOW';

        report += `QUERY: "${result.prompt_text.substring(0, 80)}${result.prompt_text.length > 80 ? '...' : ''}"\n`;
        report += `${"─".repeat(40)}\n`;
        report += `Priority: ${priority} | Visibility: ${sov}% | Rank: ${rank ? `#${rank}` : 'N/A'} | Citations: ${citations}\n\n`;

        // Generate inline recommendations based on data
        const recommendations: string[] = [];

        if (sov < 30) {
          recommendations.push(`Critical: Brand visibility is very low (${sov}%). Focus on building authoritative content and getting cited by high-authority sources.`);
        } else if (sov < 60) {
          recommendations.push(`Moderate visibility (${sov}%). Target improvement by expanding content presence on cited domains.`);
        }

        // Check competitor mentions from audit
        const competitorsFound: string[] = [];
        result.model_results.forEach(mr => {
          const response = mr.raw_response?.toLowerCase() || '';
          selectedClient.competitors.forEach(comp => {
            if (response.includes(comp.toLowerCase()) && !competitorsFound.includes(comp)) {
              competitorsFound.push(comp);
            }
          });
        });

        if (competitorsFound.length > 0) {
          recommendations.push(`Competitors appearing in responses: ${competitorsFound.slice(0, 3).join(', ')}. Analyze their content strategy and create differentiated content.`);
        }

        // Add Tavily-based recommendations
        if (tavilyData?.analysis) {
          if (!tavilyData.analysis.brand_mentioned && tavilyData.analysis.top_domains?.length > 0) {
            const topDomains = tavilyData.analysis.top_domains.slice(0, 3).map((d: any) => d.domain).join(', ');
            recommendations.push(`Target these influential domains for content placement: ${topDomains}`);
          }
          if (tavilyData.analysis.insights?.length > 0) {
            recommendations.push(tavilyData.analysis.insights[0]);
          }
        }

        // Add citation strategy
        if (citations > 0) {
          const topCitedDomains = result.model_results
            .flatMap(mr => mr.citations)
            .slice(0, 3)
            .map(c => c.domain)
            .filter((v, i, a) => a.indexOf(v) === i)
            .join(', ');
          if (topCitedDomains) {
            recommendations.push(`Build relationships with frequently cited sources: ${topCitedDomains}`);
          }
        }

        // Fallback recommendation
        if (recommendations.length === 0) {
          recommendations.push('Run more audits to gather comprehensive data for actionable insights.');
        }

        report += `Recommendations:\n`;
        recommendations.forEach((rec, idx) => {
          report += `  ${idx + 1}. ${rec}\n`;
        });
        report += `\n`;
      });
    }

    const blob = new Blob([report], { type: "text/markdown" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${selectedClient.slug}-report-${new Date().toISOString().split("T")[0]}.md`;
    a.click();
    URL.revokeObjectURL(url);
  }, [selectedClient, summary, auditResults, tavilyResults, getModelStats, getCompetitorGap, getTopSources, getInsights]);

  const importData = useCallback((data: string) => {
    try {
      if (data.trim().startsWith("{") || data.trim().startsWith("[")) {
        const parsed = JSON.parse(data);
        if (parsed.prompts) {
          const promptTexts = parsed.prompts.map((p: string | { text: string }) => typeof p === "string" ? p : p.text);
          addMultiplePrompts(promptTexts);
        }
      } else {
        addMultiplePrompts(data.split("\n").filter(l => l.trim().length > 0));
      }
    } catch {
      addMultiplePrompts(data.split("\n").filter(l => l.trim().length > 0));
    }
  }, [addMultiplePrompts]);

  // ============================================
  // AI GENERATION FUNCTIONS
  // ============================================

  // Location drilldown helper for granular geo-context in prompt generation
  const getLocationDrilldown = useCallback((region: string): string => {
    const geographyMap: Record<string, string[]> = {
      "India": ["Mumbai", "Bangalore", "Delhi NCR"],
      "UAE": ["Dubai", "Abu Dhabi"],
      "United States": ["New York", "San Francisco", "Austin"],
      "USA": ["New York", "San Francisco", "Austin"],
      "UK": ["London", "Manchester"],
      "United Kingdom": ["London", "Manchester"],
      "Dubai": ["Dubai Marina", "Downtown Dubai", "Business Bay"],
      "Bangalore": ["Indiranagar", "Koramangala", "Whitefield"],
      "Mumbai": ["Bandra", "Lower Parel", "Andheri"],
      "Singapore": ["CBD", "Orchard Road", "Marina Bay"],
      "Australia": ["Sydney", "Melbourne", "Brisbane"],
      "Canada": ["Toronto", "Vancouver", "Montreal"],
      "Germany": ["Berlin", "Munich", "Frankfurt"],
      "France": ["Paris", "Lyon", "Marseille"],
    };
    const subLocations = geographyMap[region];
    if (subLocations) {
      return `Drill down into specific sub-locations: ${subLocations.join(", ")}.`;
    }
    return `Focus on the most prominent commercial hubs within ${region}.`;
  }, []);

  const generatePromptsFromKeywords = useCallback(async (keywords: string, _options: { sentiment?: string; focus?: string; competitors?: string[] } = {}): Promise<string[]> => {
    if (!selectedClient) return [];

    const brandName = selectedClient.brand_name;
    const industry = selectedClient.industry;
    const region = selectedClient.target_region || "United States";
    const locationInstruction = getLocationDrilldown(region);

    // GEO Strategist system prompt — Brand-Neutral Category Dominance
    const systemInstruction = `You are a Generative Engine Optimization (GEO) Strategist. Your goal is to generate 10 high-intent search queries that real buyers use to discover top-tier solutions in a specific category.

STRICT CONSTRAINTS:
- BRAND NEUTRALITY: You must NEVER include the brand name "${brandName}" in any output. Focus entirely on category-level searches (e.g., "Best [Category]" instead of "${brandName} reviews").
- BUYER INTENT: Prioritize queries that indicate a user is ready to purchase or compare (Commercial Investigation).
- NO FILLER: Output ONLY the 10 prompts, one per line. No numbers, no introductory text, no conversational filler.`;

    // Construct the dynamic user prompt
    const userPrompt = `Category Keyword: ${keywords}
Industry: ${industry}
Region: ${region}

Instructions:
1. Generate 10 brand-neutral search prompts.
2. ${locationInstruction}
3. Prompt Mix Requirement:
   - 3x "Pillar" Queries: (Top 5, Top 10, Best of 2026).
   - 3x "Localized" Queries: (Best in [City/Area]).
   - 3x "Industry Variations": High-intent variations specific to ${industry} (e.g., pricing, reliability, specific technical use-cases).
   - 1x "Decision Criteria": A query asking the AI for advice on how to choose a provider in this category.
4. STOPSHIP: Do NOT mention the brand "${brandName}" in any output.`;

    // 1. Try Supabase Edge Function first
    try {
      const { data, error } = await supabase.functions.invoke("generate-content", {
        body: { prompt: userPrompt, systemPrompt: systemInstruction, type: "prompts" },
      });
      if (!error && data?.response) {
        const parsed = data.response.split("\n")
          .map((l: string) => l.replace(/^\d+\.\s*/, "").replace(/^-\s*/, "").replace(/^[•]\s*/, "").trim())
          .filter((l: string) => l.length > 10 && !l.toLowerCase().includes(brandName.toLowerCase()));
        if (parsed.length >= 5) return parsed;
      }
    } catch (err) { console.log("[GEO] Edge function error:", err); }

    // 2. Try groq-proxy edge function (key stays server-side)
    try {
      const { data: proxyData, error: proxyError } = await supabase.functions.invoke("groq-proxy", {
        body: {
          model: "llama-3.1-8b-instant",
          messages: [
            { role: "system", content: systemInstruction },
            { role: "user", content: userPrompt }
          ],
          temperature: 0.7,
          max_tokens: 2048,
        },
      });

      if (!proxyError && proxyData?.response) {
        return proxyData.response.split("\n")
          .map((l: string) => l.replace(/^\d+\.\s*/, "").replace(/^-\s*/, "").replace(/^[•]\s*/, "").trim())
          .filter((l: string) => l.length > 10 && !l.toLowerCase().includes(brandName.toLowerCase()));
      }
    } catch (err) { console.error("[GEO] groq-proxy error:", err); }

    return [];

  }, [selectedClient, getLocationDrilldown]);

  const generateContent = useCallback(async (topic: string, contentType: string, tone?: string, audience?: string, keywords?: string): Promise<string | null> => {
    if (!selectedClient) return null;

    const contentTypeLabels: Record<string, string> = {
      article: "in-depth article (1500-2000 words)",
      listicle: "listicle / top-10 style article (1200-1800 words)",
      comparison: "comprehensive comparison guide (1500-2000 words)",
      guide: "how-to guide with step-by-step instructions (1500-2000 words)",
      faq: "FAQ section with 8-12 detailed Q&A pairs",
      press_release: "professional press release (600-800 words)",
      product_description: "compelling product description (400-600 words)",
    };

    const typeLabel = contentTypeLabels[contentType] || contentType;

    let prompt = `Write a ${typeLabel} about: ${topic}

BRAND CONTEXT:
- Brand: ${selectedClient.brand_name}
- Industry: ${selectedClient.industry}
- Region: ${selectedClient.target_region}
- Competitors: ${selectedClient.competitors.join(", ")}`;

    if (audience?.trim()) prompt += `\n- Target Audience: ${audience.trim()}`;
    if (keywords?.trim()) prompt += `\n- Key Selling Points / Keywords: ${keywords.trim()}`;

    if (tone?.trim()) {
      prompt += `\n\nTONE OF VOICE / STYLE REFERENCE:\n"${tone.trim()}"\n\nINSTRUCTION: Analyze the style, vocabulary, and sentence structure of the reference text above. Generate the desired content strictly mimicking this tone and style.`;
    }

    prompt += `

CONTENT QUALITY REQUIREMENTS:
1. FORMAT: Use proper Markdown with clear hierarchy:
   - # for the main title
   - ## for major sections
   - ### for subsections
   - Use **bold** for key terms and brand names
   - Use bullet points and numbered lists for scannable content
   - Include a brief introduction and conclusion
2. WRITING STYLE:
   - Write in a natural, humanized tone with personality — avoid corporate jargon
   - Use specific data points, examples, and micro-storytelling where relevant
   - Vary sentence length: mix punchy short sentences with detailed longer ones
   - Address the reader directly ("you") for engagement
3. SEO OPTIMIZATION:
   - Naturally weave the topic keywords throughout (no keyword stuffing)
   - Use semantic variations of key terms
   - Write compelling section headers that include relevant keywords
4. BRAND INTEGRATION:
   - Mention ${selectedClient.brand_name} naturally 3-5 times (not forced)
   - Position the brand as a thought leader, not as a hard sell
   - Reference competitors briefly for comparison context where appropriate
5. E-E-A-T SIGNALS:
   - Demonstrate Experience: Include practical tips and real-world scenarios
   - Show Expertise: Use industry-specific terminology correctly
   - Build Authority: Reference industry trends and best practices
   - Establish Trust: Be transparent, cite reasoning, avoid hype`;

    const systemPrompt = `You are an elite content strategist and writer specializing in ${selectedClient.industry}. You create content that ranks highly in both traditional search and AI-powered search engines. Your writing is engaging, authoritative, and optimized for E-E-A-T (Experience, Expertise, Authoritativeness, Trustworthiness). You always output well-structured Markdown with proper headings, lists, and formatting.`;

    try {
      const { data, error } = await supabase.functions.invoke("generate-content", {
        body: { prompt, type: contentType, brand_name: selectedClient.brand_name, competitors: selectedClient.competitors },
      });
      if (!error && data?.response) return data.response;
    } catch (err) { console.log("Generate content error:", err); }

    try {
      const { data: proxyData, error: proxyError } = await supabase.functions.invoke("groq-proxy", {
        body: {
          model: "llama-3.1-8b-instant",
          messages: [{ role: "system", content: systemPrompt }, { role: "user", content: prompt }],
          temperature: 0.7,
          max_tokens: 4096,
        },
      });
      if (!proxyError && proxyData?.response) return proxyData.response;
    } catch (err) { console.error("groq-proxy error:", err); }
    return null;
  }, [selectedClient]);

  /**
   * Generate humanized content based on audit results and Tavily analysis
   * Uses Groq API to create SEO-optimized content that improves AI visibility
   */
  const generateVisibilityContent = useCallback(async (
    promptText: string,
    auditResult: AuditResult | null,
    tavilyData: any
  ): Promise<string | null> => {
    if (!selectedClient) return null;

    // Build comprehensive context from audit results
    const modelSummary = auditResult?.model_results
      .map(mr => `${mr.model_name}: ${mr.brand_mentioned ? 'Mentioned' : 'Not mentioned'}, Rank: ${mr.brand_rank || 'N/A'}, Citations: ${mr.citations.length}`)
      .join('\n') || 'No audit data available';

    const topCitations = auditResult?.model_results
      .flatMap(mr => mr.citations)
      .slice(0, 10)
      .map(c => `- ${c.domain}: ${c.title || c.url}`)
      .join('\n') || 'No citations';

    const competitorContext = auditResult?.model_results
      .flatMap(mr => {
        const response = mr.raw_response?.toLowerCase() || '';
        return selectedClient.competitors.filter(c => response.includes(c.toLowerCase()));
      })
      .filter((v, i, a) => a.indexOf(v) === i)
      .join(', ') || 'None mentioned';

    // Build Tavily context
    const tavilyContext = tavilyData ? `
TAVILY AI SOURCE ANALYSIS:
- Brand Found: ${tavilyData.analysis?.brand_mentioned ? 'Yes' : 'No'} (${tavilyData.analysis?.brand_mention_count || 0} mentions)
- Competitor Mentions: ${JSON.stringify(tavilyData.analysis?.competitor_mentions || {})}
- Top Domains: ${(tavilyData.analysis?.top_domains || []).slice(0, 5).map((d: any) => d.domain).join(', ')}
- Source Types: ${JSON.stringify(tavilyData.analysis?.source_types || {})}
- AI Insights: ${(tavilyData.analysis?.insights || []).join('; ')}
- Tavily Answer: ${tavilyData.answer?.substring(0, 500) || 'N/A'}
` : 'No Tavily data available';

    const systemPrompt = `You are an expert content strategist and writer specializing in AI visibility optimization (GEO - Generative Engine Optimization).

Your task is to create content that will help a brand become more visible in AI-generated responses like ChatGPT, Perplexity, Claude, and Google AI Overviews.

CRITICAL RULES FOR HUMANIZED, AUTHENTIC CONTENT:
1. Write in a natural, conversational tone with personality - avoid corporate jargon
2. Include personal insights, real-world examples, and relatable scenarios that show genuine expertise
3. Vary sentence length and structure for natural rhythm - mix short punchy sentences with longer explanatory ones
4. Use contractions, occasional idioms, and natural expressions (but keep it professional)
5. Add genuine opinions, nuanced perspectives, and thoughtful analysis
6. Include practical, actionable tips that demonstrate real expertise
7. Avoid keyword stuffing - integrate brand mentions naturally and sparingly
8. Write as if explaining to a smart friend who values your expertise
9. Include specific data points, statistics, and verifiable facts where relevant
10. Add subtle emotional elements and micro-storytelling where appropriate

E-E-A-T OPTIMIZATION (Experience, Expertise, Authoritativeness, Trustworthiness):
- Demonstrate EXPERIENCE through specific examples and first-hand knowledge
- Show EXPERTISE with detailed technical information and insider insights
- Build AUTHORITATIVENESS by referencing credible sources and industry standards
- Establish TRUSTWORTHINESS through balanced perspectives and honest assessments

OUTPUT FORMAT:
- Generate a complete, publish-ready article in Markdown
- Include a compelling headline that naturally incorporates the topic
- Strong introduction that hooks the reader and establishes expertise
- Well-structured body sections with clear subheadings
- Practical takeaways and actionable advice throughout
- Thoughtful conclusion with a forward-looking perspective
- Length: 1500-2500 words for comprehensive coverage
- Natural keyword and brand integration`;

    const userPrompt = `Create content to improve AI visibility for this query:

QUERY: "${promptText}"

BRAND INFORMATION:
- Brand Name: ${selectedClient.brand_name}
- Website: ${selectedClient.brand_domain || 'Not specified'}
- Industry: ${selectedClient.industry}
- Region: ${selectedClient.target_region}
- Competitors: ${selectedClient.competitors.join(', ')}
- Brand Identity Tags: ${selectedClient.brand_tags?.join(', ') || 'None'}

CURRENT AI VISIBILITY AUDIT RESULTS:
${modelSummary}

VISIBILITY METRICS:
- Share of Voice: ${auditResult?.summary?.share_of_voice || 0}% (${(auditResult?.summary?.share_of_voice || 0) >= 50 ? 'Good - appearing in most AI responses' : 'Improvement needed'})
- Average Rank: ${auditResult?.summary?.average_rank || 'Not ranked in lists'}
- Total Citations: ${auditResult?.summary?.total_citations || 0}

TOP SOURCES CITED BY AI MODELS:
${topCitations}

COMPETITORS APPEARING IN AI RESPONSES: ${competitorContext}

${tavilyContext}

CONTENT STRATEGY BASED ON ANALYSIS:
1. Current gap: ${(auditResult?.summary?.share_of_voice || 0) < 50 ? `${selectedClient.brand_name} is underrepresented vs competitors` : `${selectedClient.brand_name} has good visibility but can improve ranking`}
2. Target: Position ${selectedClient.brand_name} as a thought leader and trusted authority for "${promptText}"
3. Approach: Address gaps where competitors are mentioned but the brand is not
4. Citation strategy: Create content worthy of being cited by authoritative sources
5. Brand integration: Natural mentions that solve real user problems
6. Differentiation: Highlight unique value propositions not covered by competitors

Generate comprehensive, humanized content that will improve this brand's AI visibility:`;


    // Use groq-proxy edge function (key stays server-side)
    try {
      console.log('[groq-proxy] Generating visibility content for:', promptText.substring(0, 50));
      const { data: proxyData, error: proxyError } = await supabase.functions.invoke("groq-proxy", {
        body: {
          model: "llama-3.3-70b-versatile",
          messages: [
            { role: "system", content: systemPrompt },
            { role: "user", content: userPrompt }
          ],
          temperature: 0.8,
          max_tokens: 8192,
        },
      });

      if (!proxyError && proxyData?.response) {
        console.log('[groq-proxy] Generated content:', proxyData.response.length, 'characters');
        return proxyData.response;
      } else if (proxyError) {
        console.error('[groq-proxy] Error:', proxyError);
      }
    } catch (err) {
      console.error('[groq-proxy] Exception:', err);
    }

    // Fallback to edge function
    try {
      const { data, error } = await supabase.functions.invoke("generate-content", {
        body: {
          prompt: userPrompt,
          type: "visibility-content",
          brand_name: selectedClient.brand_name,
          competitors: selectedClient.competitors,
          system_prompt: systemPrompt
        },
      });
      if (!error && data?.response) return data.response;
    } catch (err) {
      console.log("Generate content edge function error:", err);
    }

    return null;
  }, [selectedClient]);

  const getAllCitations = useCallback(() => {
    const citationMap = new Map<string, { url: string; title: string; domain: string; count: number; prompts: string[] }>();
    for (const result of auditResults) {
      for (const mr of result.model_results) {
        for (const c of mr.citations) {
          const key = c.url;
          if (citationMap.has(key)) {
            const existing = citationMap.get(key)!;
            existing.count++;
            if (!existing.prompts.includes(result.prompt_text)) existing.prompts.push(result.prompt_text);
          } else {
            citationMap.set(key, { ...c, count: 1, prompts: [result.prompt_text] });
          }
        }
      }
    }
    return Array.from(citationMap.values()).sort((a, b) => b.count - a.count);
  }, [auditResults]);

  // ============================================
  // INITIALIZATION
  // ============================================
  const initRef = useRef(false);
  useEffect(() => {
    if (!initRef.current) {
      initRef.current = true;
      fetchClients();
    }
  }, [fetchClients]);
  // NOTE: The old useEffect that loaded prompts/results/auto-audit on selectedClient change
  // has been REMOVED. Data loading is now handled by loadClientData() which is called
  // explicitly from fetchClients() and switchClient() — no cascading re-renders.

  // ============================================
  // RESUME INTERRUPTED AUDIT (after page refresh)
  // ============================================
  const auditResumeRef = useRef(false);
  useEffect(() => {
    if (auditResumeRef.current || !selectedClient || prompts.length === 0 || loading) return;
    const pending = loadFromStorage<{ clientId: string; pendingPromptIds: string[]; startedAt: string } | null>(STORAGE_KEYS.PENDING_AUDIT, null);
    if (!pending || pending.clientId !== selectedClient.id || pending.pendingPromptIds.length === 0) return;

    // Only resume if audit was started within last 30 minutes
    const startedAt = new Date(pending.startedAt).getTime();
    if (Date.now() - startedAt > 30 * 60 * 1000) {
      localStorage.removeItem(STORAGE_KEYS.PENDING_AUDIT);
      return;
    }

    // Filter out prompts that already have results (completed before refresh)
    const completedIds = new Set(auditResults.map(r => r.prompt_id));
    const remainingPrompts = prompts.filter(p => pending.pendingPromptIds.includes(p.id) && !completedIds.has(p.id));

    if (remainingPrompts.length === 0) {
      localStorage.removeItem(STORAGE_KEYS.PENDING_AUDIT);
      return;
    }

    auditResumeRef.current = true;
    console.log(`[Audit] Resuming interrupted audit: ${remainingPrompts.length} prompts remaining`);
    toast.info(`Resuming audit: ${remainingPrompts.length} prompts remaining`, { duration: 4000 });
    runFullAudit(remainingPrompts);
  }, [selectedClient, prompts, auditResults, loading, runFullAudit]);

  /**
   * Auto-discover competitors using Groq API
   */
  const fetchCompetitors = useCallback(async (
    brandName: string,
    industry: string,
    region: string
  ): Promise<string[]> => {
    if (!brandName) return [];

    try {
      const { data: proxyData, error: proxyError } = await supabase.functions.invoke("groq-proxy", {
        body: {
          model: "llama-3.3-70b-versatile",
          messages: [
            {
              role: "system",
              content: "You are a market research expert. user will provide a brand, industry, and region. You must return a JSON array of top 5 direct competitor names. OUTPUT ONLY JSON. No text."
            },
            {
              role: "user",
              content: `Identify top 5 direct competitors for "${brandName}" in the "${industry}" industry in "${region}". Return JSON array only.`
            }
          ],
          temperature: 0.1,
          max_tokens: 500,
          response_format: { type: "json_object" }
        },
      });

      if (!proxyError && proxyData?.response) {
        try {
          const parsed = JSON.parse(proxyData.response);
          const list = Array.isArray(parsed) ? parsed : (parsed.competitors || parsed.companies || Object.values(parsed)[0]);
          return Array.isArray(list) ? list.map(String).slice(0, 7) : [];
        } catch (e) {
          console.error("Failed to parse competitor JSON", e);
          return [];
        }
      }
    } catch (err) {
      console.error("Error fetching competitors:", err);
    }
    return [];
  }, []);


  /**
   * Generate AI Visibility Strategist insights for a specific prompt
   * Uses Groq API with full Citation Gap Analysis and structured recommendations
   */
  const generateRecommendations = useCallback(async (
    promptText: string,
    auditResult: AuditResult | null,
    tavilyData: any,
    completedRecommendations: string[] = []
  ): Promise<PromptInsightResult | null> => {
    if (!selectedClient) return null;

    // Build context from audit - per-platform response text
    const sov = auditResult?.summary?.share_of_voice || 0;
    const rank = auditResult?.summary?.average_rank || 'Not ranked';

    // Map model IDs to AI platform names for the prompt
    const platformNameMap: Record<string, string> = {
      chatgpt: 'ChatGPT',
      perplexity: 'Perplexity',
      gemini: 'Gemini',
      google_serp: 'Google AI Overview',
      claude: 'Claude'
    };

    // Build per-platform response text
    const perPlatformResponses = (auditResult?.model_results || []).map(mr => {
      const platformName = platformNameMap[mr.model] || mr.model_name;
      const brandPresent = mr.brand_mentioned ? 'Present' : 'Absent';
      const rankInfo = mr.brand_rank ? `Rank: #${mr.brand_rank}` : 'Not ranked';

      // Get brand entities / extracted brands info for richer context
      const extractedBrands = (mr.extracted_brands || [])
        .filter(b => !b.is_own_brand)
        .slice(0, 10)
        .map(b => `${b.title} (position: ${b.position}, mentions: ${b.mention_count})`)
        .join('; ');

      return `**${platformName} Response:**
Brand Status: ${brandPresent}, ${rankInfo}
Competitors Found: ${extractedBrands || 'None extracted'}
Citations: ${mr.citations.map(c => c.domain).join(', ') || 'None'}
Response Text (truncated): ${(mr.raw_response || '').substring(0, 1500)}`;
    }).join('\n\n---\n\n');

    // Build cited source URLs with snippets
    const allCitations = (auditResult?.model_results || []).flatMap(mr =>
      mr.citations.map(c => ({
        url: c.url,
        domain: c.domain,
        title: c.title || '',
        model: platformNameMap[mr.model] || mr.model_name
      }))
    );
    const uniqueCitedUrls = Array.from(new Map(allCitations.map(c => [c.url, c])).values());

    // Add Tavily-scraped content for cited URLs if available
    const citedSourceContent = uniqueCitedUrls.slice(0, 10).map(c => {
      // Check if Tavily results have content for this URL
      const tavilyMatch = tavilyData?.results?.find((r: any) =>
        r.url === c.url || r.url?.includes(c.domain)
      );
      const snippet = tavilyMatch?.content || tavilyMatch?.snippet || 'Snippet not available';
      return `- ${c.domain} (cited by ${c.model}): ${c.title}
  URL: ${c.url}
  Content: ${snippet.substring(0, 500)}`;
    }).join('\n');

    // Build existing brand content check from Tavily
    const brandContentCheck = tavilyData?.results?.filter((r: any) =>
      r.url?.includes(selectedClient.brand_domain || '___none___')
    ).map((r: any) => `- ${r.url}: ${r.title || 'No title'}`).join('\n') || 'Not verified. For any page creation recommendation, include the instruction: Check if this page exists before building — search site:' + (selectedClient.brand_domain || selectedClient.brand_name.toLowerCase().replace(/\s+/g, '')) + ' [keyword] in Google first.';

    // Competitor analysis
    const competitorsInResponse = auditResult?.model_results
      .flatMap(mr => {
        const response = mr.raw_response?.toLowerCase() || '';
        return selectedClient.competitors.filter(c => response.includes(c.toLowerCase()));
      })
      .filter((v, i, a) => a.indexOf(v) === i) || [];

    // Tavily additional context
    const tavilyContext = tavilyData ? `
Web Source Analysis (Tavily):
- Brand Found: ${tavilyData.analysis?.brand_mentioned ? 'Yes' : 'No'} (${tavilyData.analysis?.brand_mention_count || 0} mentions)
- Competitor Mentions: ${JSON.stringify(tavilyData.analysis?.competitor_mentions || {})}
- Top Domains: ${(tavilyData.analysis?.top_domains || []).slice(0, 5).map((d: any) => d.domain).join(', ')}
- Source Types: ${JSON.stringify(tavilyData.analysis?.source_types || {})}
- AI Insights: ${(tavilyData.analysis?.insights || []).join('; ')}` : 'No Tavily data available';

    const systemPrompt = `You are an AI Visibility Strategist helping a brand improve how often and how prominently it appears in AI-generated responses (ChatGPT, Perplexity, Google AI Overview, Gemini, Claude).

Your job is to analyze why competitor brands are being cited in AI responses for a specific query, and generate precise, actionable recommendations to close that citation gap for the target brand.

## STEP 1 — CITATION GAP ANALYSIS (Internal Reasoning)

Before generating any recommendations, reason through the following. Do not skip this step.

1. **Platform Presence Audit:** For each AI platform, state whether the target brand is present or absent, and its position rank if present.

2. **Competitor Citation Analysis:** For each competitor appearing in AI responses, identify:
   - The content TYPE driving their citation (health editorial / product listing / Q&A answer / news article / clinical reference / expert quote)
   - The specific CLAIM or benefit being cited
   - The DOMAIN TYPE of the source (health publication / e-commerce / forum / brand site)

3. **Content Gap Identification:** What specific claims, benefits, or content formats is the target brand missing from the citation ecosystem? Be specific.

4. **Platform-Specific Patterns:** Note if certain platforms cite specific content types (e.g., Perplexity cites clinical health articles, Google AI Overview cites structured product pages, ChatGPT cites listicles and e-commerce descriptions).

## STEP 2 — RECOMMENDATION GENERATION

Generate exactly 6 recommendations: 2-3 HIGH IMPACT STRATEGIC and 3-4 QUICK TACTICAL WINS.

## CRITICAL RULES

**Never recommend:**
- Creating a page that already exists (check existing content input first)
- Guest posting on domains not relevant to the brand's industry
- Reddit or forum posts as a primary brand strategy
- Generic backlink building without a specific domain target
- Never use the phrases "create quality content", "study their content strategy", or "analyze competitor"

**Always ensure:**
- Every cited domain target is editorially relevant to the query topic
- Every content recommendation includes specific claims or facts driving competitor citations
- At least one recommendation is platform-specific (targeting a single LLM's citation behavior)
- If the brand has no presence on a high-value platform, one recommendation must address that gap

Output EXACTLY this JSON format:
{
  "priority": "high|medium|low",
  "citationGapSummary": "4-6 sentences in plain English summarizing the citation gap, suitable for a marketing professional.",
  "platformPresence": [
    { "platform": "ChatGPT", "present": true/false, "rank": number_or_null },
    { "platform": "Perplexity", "present": true/false, "rank": number_or_null },
    { "platform": "Gemini", "present": true/false, "rank": number_or_null },
    { "platform": "Google AI Overview", "present": true/false, "rank": number_or_null },
    { "platform": "Claude", "present": true/false, "rank": number_or_null }
  ],
  "recommendations": [
    {
      "title": "Recommendation Title",
      "type": "High Impact",
      "targetPlatforms": "Specific LLM(s) or All Platforms",
      "priority": "High",
      "whyThisWorks": "2-3 sentences explaining specifically why this will improve AI citation — reference the gap or competitor pattern.",
      "exactAction": {
        "contentFormat": "article / FAQ page / comparison page / Quora answer / structured data markup / etc.",
        "targetUrl": "Exact domain or recommended URL slug for new page",
        "wordCount": "Specific number",
        "keyClaims": ["Claim 1 from gap analysis", "Claim 2", "Claim 3"],
        "existingPageNote": "Optimize existing page at [URL] — only if existing page found"
      },
      "executionSteps": ["Step 1", "Step 2", "Step 3"],
      "timeline": "This week / Within 2 weeks / Within 1 month",
      "successMetric": "One specific, measurable outcome"
    }
  ]
}`;

    const userPrompt = `Analyze this brand's AI visibility and provide Citation Gap Analysis + 6 Recommendations:

**Query:** "${promptText}"
**Target Brand:** ${selectedClient.brand_name}
**Target Brand Website:** ${selectedClient.brand_domain || 'Not specified'}
**Industry:** ${selectedClient.industry}
**Region:** ${selectedClient.target_region}
**Competitors:** ${selectedClient.competitors.join(', ')}

---

**AI Platform Responses:**
${perPlatformResponses || 'No per-platform data available. Generate platform-agnostic recommendations.'}

---

**Cited Source URLs with Content:**
${citedSourceContent || 'No cited URLs available.'}
${!citedSourceContent ? '\nNote: Only snippet-level content is available for cited URLs. Reason from the language, claims, and terminology visible in snippets to identify citation patterns.' : ''}

---

**Target Brand Existing Content Check:**
${brandContentCheck}

---

${tavilyContext}

---

**Completed Recommendations (Do Not Repeat):**
${completedRecommendations.length > 0 ? completedRecommendations.join('\n') : 'None — this is the first analysis.'}

---

CURRENT VISIBILITY STATUS:
- Share of Voice: ${sov}%
- Average Rank: ${rank}
- Competitors appearing: ${competitorsInResponse.join(', ') || 'None'}

Generate the Citation Gap Analysis and exactly 6 Recommendations (2-3 High Impact + 3-4 Quick Wins) as JSON:`;

    try {
      console.log('[groq-proxy] Generating AI Visibility Strategist insights for:', promptText.substring(0, 40));
      const { data: proxyData, error: proxyError } = await supabase.functions.invoke("groq-proxy", {
        body: {
          model: "llama-3.3-70b-versatile",
          messages: [
            { role: "system", content: systemPrompt },
            { role: "user", content: userPrompt }
          ],
          temperature: 0.5,
          max_tokens: 4096,
          response_format: { type: "json_object" }
        },
      });

      if (!proxyError && proxyData?.response) {
        const content = proxyData.response;
        console.log('[groq-proxy] AI Visibility Strategist response:', content.substring(0, 150));

        try {
          const jsonMatch = content.match(/\{[\s\S]*\}/);
          if (jsonMatch) {
            const parsed = JSON.parse(jsonMatch[0]);
            return {
              priority: parsed.priority || 'medium',
              citationGapSummary: parsed.citationGapSummary || 'Analysis complete.',
              platformPresence: Array.isArray(parsed.platformPresence) ? parsed.platformPresence.map((p: any) => ({
                platform: p.platform || 'Unknown',
                present: !!p.present,
                rank: p.rank ?? null
              })) : [],
              recommendations: Array.isArray(parsed.recommendations)
                ? parsed.recommendations.map((r: any) => ({
                  title: r.title || 'Recommendation',
                  type: r.type === 'Quick Win' ? 'Quick Win' as const : 'High Impact' as const,
                  targetPlatforms: r.targetPlatforms || 'All Platforms',
                  priority: r.priority || 'Medium',
                  whyThisWorks: r.whyThisWorks || '',
                  exactAction: {
                    contentFormat: r.exactAction?.contentFormat || '',
                    targetUrl: r.exactAction?.targetUrl || '',
                    wordCount: r.exactAction?.wordCount || '',
                    keyClaims: Array.isArray(r.exactAction?.keyClaims) ? r.exactAction.keyClaims : [],
                    existingPageNote: r.exactAction?.existingPageNote || undefined
                  },
                  executionSteps: Array.isArray(r.executionSteps) ? r.executionSteps : [],
                  timeline: r.timeline || '',
                  successMetric: r.successMetric || ''
                }))
                : []
            };
          }
        } catch (parseErr) {
          console.error('[groq-proxy] Failed to parse AI Visibility Strategist JSON:', parseErr);
        }
      } else if (proxyError) {
        console.error('[groq-proxy] AI Visibility Strategist error:', proxyError);
      }
    } catch (err) {
      console.error('[groq-proxy] AI Visibility Strategist exception:', err);
    }

    // Return fallback based on data
    const fallbackPlatformPresence = (auditResult?.model_results || []).map(mr => ({
      platform: platformNameMap[mr.model] || mr.model_name,
      present: mr.brand_mentioned,
      rank: mr.brand_rank ?? null
    }));

    const fallbackRecs: PromptInsightRecommendation[] = [];
    if (sov < 50) {
      fallbackRecs.push({
        title: 'Improve Overall AI Visibility',
        type: 'High Impact',
        targetPlatforms: 'All Platforms',
        priority: 'High',
        whyThisWorks: `Currently only appearing in ${sov}% of AI responses. Competitors are dominating the citation space for this query.`,
        exactAction: { contentFormat: 'Authority article', targetUrl: `${selectedClient.brand_domain || 'yourbrand.com'}/blog/${promptText.toLowerCase().replace(/\s+/g, '-').substring(0, 40)}`, wordCount: '2000-2500 words', keyClaims: ['Address the core query comprehensively', 'Include specific data points and statistics', 'Reference authoritative sources'] },
        executionSteps: ['Research the top-ranking content for this query', 'Draft a comprehensive article addressing all angles', 'Include brand-specific data and case studies', 'Publish and submit to Google Search Console'],
        timeline: 'Within 2 weeks',
        successMetric: `Brand mentioned in at least 2 additional AI platform responses within 60 days`
      });
    }
    if (competitorsInResponse.length > 0) {
      fallbackRecs.push({
        title: `Close Gap Against ${competitorsInResponse[0]}`,
        type: 'High Impact',
        targetPlatforms: 'All Platforms',
        priority: 'High',
        whyThisWorks: `${competitorsInResponse[0]} is appearing in AI responses where ${selectedClient.brand_name} is absent. Direct comparison content can shift citations.`,
        exactAction: { contentFormat: 'Comparison page', targetUrl: `${selectedClient.brand_domain || 'yourbrand.com'}/vs/${competitorsInResponse[0].toLowerCase().replace(/\s+/g, '-')}`, wordCount: '1500-2000 words', keyClaims: ['Feature-by-feature comparison', 'Pricing transparency', 'User testimonials'] },
        executionSteps: ['Audit competitor content for the claims driving their citations', 'Create a structured comparison page with tables and data', 'Include genuine user reviews and testimonials'],
        timeline: 'Within 2 weeks',
        successMetric: `Brand appears alongside ${competitorsInResponse[0]} in AI comparison responses`
      });
    }
    if (fallbackRecs.length < 6) {
      fallbackRecs.push({
        title: 'Run Audit for Complete Analysis',
        type: 'Quick Win',
        targetPlatforms: 'All Platforms',
        priority: 'Medium',
        whyThisWorks: 'More audit data enables the AI Visibility Strategist to generate precise, citation-gap-driven recommendations.',
        exactAction: { contentFormat: 'Audit', targetUrl: '', wordCount: 'N/A', keyClaims: ['Gather per-platform response data', 'Identify citation sources'] },
        executionSteps: ['Run a full audit on this prompt', 'Enable Tavily for web source analysis', 'Re-generate insights with the additional data'],
        timeline: 'This week',
        successMetric: 'Complete audit data available for AI analysis'
      });
    }

    return {
      priority: sov < 30 ? 'high' : sov < 60 ? 'medium' : 'low',
      citationGapSummary: `Share of Voice is ${sov}%. ${competitorsInResponse.length > 0 ? `Competitors ${competitorsInResponse.join(', ')} are appearing in AI responses. ` : ''}Run the AI analysis to get detailed citation gap insights.`,
      platformPresence: fallbackPlatformPresence,
      recommendations: fallbackRecs
    };
  }, [selectedClient]);

  /**
   * Generate AI-powered overall recommendations for the dashboard
   * Combines local aggregation data with Groq API for pinpoint insights
   */
  const generateOverallRecommendations = useCallback(async (
    aggregatedData: {
      overallSov: number;
      totalPrompts: number;
      highPriorityCount: number;
      mediumPriorityCount: number;
      lowPriorityCount: number;
      topCompetitors: { name: string; count: number }[];
      topDomains: string[];
      tavilyInsights: string[];
    }
  ): Promise<{ recommendations: string[]; priority: 'high' | 'medium' | 'low'; summary: string; keyActions: string[] } | null> => {
    if (!selectedClient) return null;

    const systemPrompt = `You are an AI Visibility Strategy Expert analyzing aggregated brand performance.
Generate PRECISE, IMMEDIATELY ACTIONABLE strategic recommendations.

CRITICAL ANTI-GENERIC RULES - NEVER USE:
- "study their strategy" / "analyze competitors"
- "build relationships" / "create quality content"  
- "focus on..." / "improve..." without specifics
- "engage with..." / "optimize..."

EVERY KEY ACTION MUST INCLUDE:
1. EXACT deliverable (comparison page, Quora answer, press pitch, etc.)
2. SPECIFIC target (domain.com, @journalist, r/subreddit)
3. CONCRETE timeline (this week, by Friday, within 2 weeks)
4. MEASURABLE outcome (traffic increase, citation count, ranking position)

EXAMPLE GOOD KEY ACTIONS:
✓ "This week: Post on r/[industry] thread about '[topic]'. 300 words from personal experience mentioning [brand]. Track: upvotes + replies."
✓ "Within 2 weeks: Create [brand].com/vs/[top competitor] comparison. Include pricing table + 5 G2 reviews. Track: page rank for '[brand] vs [competitor]'."
✓ "This month: Pitch [publication] with '[specific angle]'. Contact: [editor name]. Hook: unique data point. Track: coverage + backlinks."

EXAMPLE BAD (FORBIDDEN):
✗ "Develop content strategy for high-priority prompts"
✗ "Build thought leadership in the industry"
✗ "Focus on improving overall visibility"

Output EXACTLY this JSON:
{
"priority": "high|medium|low",
"summary": "Specific executive summary with numbers (e.g., 'Visibility 34%, [Competitor] dominates at 78%')",
"recommendations": [
  "Strategic recommendation with specific action, target, and metric",
  "Strategic recommendation 2...",
  "Strategic recommendation 3...",
  "Strategic recommendation 4...",
  "Strategic recommendation 5..."
],
"keyActions": [
  "IMMEDIATE (this week): Specific action with target and deliverable",
  "SHORT-TERM (this month): Specific action with timeline and metric",
  "LONG-TERM (this quarter): Specific campaign with measurable goal"
]
}`;

    const userPrompt = `Analyze this brand's OVERALL AI visibility performance and provide strategic recommendations:

BRAND: ${selectedClient.brand_name}
INDUSTRY: ${selectedClient.industry}
REGION: ${selectedClient.target_region}
WEBSITE: ${selectedClient.brand_domain || 'Not specified'}
COMPETITORS: ${selectedClient.competitors.join(', ')}

AGGREGATED VISIBILITY METRICS:
- Average Visibility (SOV): ${aggregatedData.overallSov}%
- Total Prompts Analyzed: ${aggregatedData.totalPrompts}
- Critical (<30% visibility): ${aggregatedData.highPriorityCount} prompts
- Needs Work (30-60%): ${aggregatedData.mediumPriorityCount} prompts
- Good (>60%): ${aggregatedData.lowPriorityCount} prompts

TOP COMPETITORS IN AI RESPONSES:
${aggregatedData.topCompetitors.map(c => `- ${c.name}: ${c.count} mentions`).join('\n') || 'No competitor data'}

MOST CITED DOMAINS BY AI:
${aggregatedData.topDomains.slice(0, 10).join(', ') || 'No citation data'}

WEB SOURCE INSIGHTS (from Tavily):
${aggregatedData.tavilyInsights.slice(0, 5).join('\n') || 'No Tavily data'}

Provide strategic, pinpoint recommendations to improve overall AI visibility for ${selectedClient.brand_name}:`;

    try {
      console.log('[groq-proxy] Generating overall recommendations');
      const { data: proxyData, error: proxyError } = await supabase.functions.invoke("groq-proxy", {
        body: {
          model: "llama-3.1-8b-instant",
          messages: [
            { role: "system", content: systemPrompt },
            { role: "user", content: userPrompt }
          ],
          temperature: 0.5,
          max_tokens: 1200,
        },
      });

      if (!proxyError && proxyData?.response) {
        const content = proxyData.response;
        console.log('[groq-proxy] Overall recommendations response:', content.substring(0, 100));

        try {
          const jsonMatch = content.match(/\{[\s\S]*\}/);
          if (jsonMatch) {
            const parsed = JSON.parse(jsonMatch[0]);
            return {
              priority: parsed.priority || 'medium',
              summary: parsed.summary || 'Analysis complete',
              recommendations: parsed.recommendations || [],
              keyActions: parsed.keyActions || []
            };
          }
        } catch (parseErr) {
          console.error('[Groq] Failed to parse overall recommendations JSON:', parseErr);
        }
      }
    } catch (err) {
      console.error('[Groq] Overall recommendations exception:', err);
    }

    // Return fallback based on aggregated data
    const fallbackRecs = [];
    if (aggregatedData.overallSov < 30) {
      fallbackRecs.push(`Critical: Overall visibility is ${aggregatedData.overallSov}%. Prioritize content creation for high-impact queries.`);
    }
    if (aggregatedData.topCompetitors.length > 0) {
      fallbackRecs.push(`Analyze ${aggregatedData.topCompetitors[0].name}'s content strategy - they appear ${aggregatedData.topCompetitors[0].count}x in AI responses.`);
    }
    if (aggregatedData.topDomains.length > 0) {
      fallbackRecs.push(`Target high-authority sources: ${aggregatedData.topDomains.slice(0, 3).join(', ')}`);
    }
    if (aggregatedData.tavilyInsights.length > 0) {
      fallbackRecs.push(`Web Analysis Insight: ${aggregatedData.tavilyInsights[0]}`);
    }

    return {
      priority: aggregatedData.overallSov < 30 ? 'high' : aggregatedData.overallSov < 60 ? 'medium' : 'low',
      summary: `Average visibility: ${aggregatedData.overallSov}% across ${aggregatedData.totalPrompts} prompts`,
      recommendations: fallbackRecs.length > 0 ? fallbackRecs : ['Run more audits to generate insights'],
      keyActions: ['Audit more prompts to gather comprehensive data']
    };
  }, [selectedClient]);

  // ============================================
  // CITATION INTELLIGENCE
  // ============================================

  const fetchCitationMeta = useCallback(async () => {
    if (!selectedClient) return;
    try {
      const { data, error } = await supabase
        .from('citation_intelligence')
        .select('domain, citation_category, source_type, authority_tier, relationship_type, verification_status, similarity_score, matched_paragraph, page_fetch_status')
        .eq('client_id', selectedClient.id);

      if (data) {
        const meta: Record<string, CitationMeta> = {};
        // Priority ranking: verified > partially_verified > hallucinated > error > pending > null
        const statusPriority: Record<string, number> = {
          verified: 5, partially_verified: 4, hallucinated: 3, error: 2, pending: 1
        };
        data.forEach((row: any) => {
          const domain = (row.domain || '').replace(/^www\./, '');
          if (!domain) return;
          const existing = meta[domain];
          const existingPriority = statusPriority[existing?.verification_status || ''] || 0;
          const newPriority = statusPriority[row.verification_status || ''] || 0;

          // Keep the row with the highest-priority verification status (prefer verified over pending)
          if (!existing || newPriority > existingPriority) {
            meta[domain] = {
              category: row.citation_category,
              source_type: row.source_type,
              authority_tier: row.authority_tier,
              relationship_type: row.relationship_type,
              is_affiliate: row.source_type === 'affiliate',
              verification_status: row.verification_status,
              similarity_score: row.similarity_score,
              matched_paragraph: row.matched_paragraph,
              page_fetch_status: row.page_fetch_status
            };
          } else if (newPriority === existingPriority && !existing.category && row.citation_category) {
            // Same verification status but new row has category info — merge it
            meta[domain] = { ...existing, category: row.citation_category, source_type: row.source_type, authority_tier: row.authority_tier, relationship_type: row.relationship_type };
          }
        });
        setCitationMeta(meta);
      }
    } catch (err) {
      console.error("Failed to fetch citation meta:", err);
    }
  }, [selectedClient]);

  const categorizeCitations = useCallback(async (domains: string[], onProgress?: (progress: { completed: number; total: number; currentBatch: number; totalBatches: number }) => void) => {
    if (domains.length === 0) return;
    try {
      // Deduplicate
      const uniqueDomains = Array.from(new Set(domains));
      const BATCH_SIZE = 40; // Must match edge function limit (processes max 40 per call)
      const CONCURRENCY = 2; // Run 2 batches in parallel (3 caused 503s)
      const batches: string[][] = [];
      for (let i = 0; i < uniqueDomains.length; i += BATCH_SIZE) {
        batches.push(uniqueDomains.slice(i, i + BATCH_SIZE));
      }

      const newMeta = { ...citationMeta };
      const allUpsertData: any[] = [];
      let completed = 0;

      // Helper to invoke edge function with retry
      const invokeCategorize = async (batch: string[], attempt = 1): Promise<any> => {
        const result = await supabase.functions.invoke('categorize-citations', {
          body: {
            domains: batch,
            brand_name: selectedClient?.brand_name,
            brand_domain: selectedClient?.brand_domain,
            competitors: selectedClient?.competitors
          }
        });
        // Retry on 503/429 (rate limit) — once after delay
        if (result.error && attempt < 2) {
          console.warn(`[Categorize] Batch failed (attempt ${attempt}), retrying in 3s...`);
          await new Promise(r => setTimeout(r, 3000));
          return invokeCategorize(batch, attempt + 1);
        }
        return result;
      };

      // Process batches with concurrency
      for (let i = 0; i < batches.length; i += CONCURRENCY) {
        const chunk = batches.slice(i, i + CONCURRENCY);

        onProgress?.({
          completed,
          total: uniqueDomains.length,
          currentBatch: i + 1,
          totalBatches: batches.length,
        });

        const results = await Promise.allSettled(
          chunk.map(batch => invokeCategorize(batch))
        );

        // Small delay between rounds to avoid 503s
        if (i + CONCURRENCY < batches.length) {
          await new Promise(r => setTimeout(r, 500));
        }

        results.forEach((result, idx) => {
          const batch = chunk[idx];
          if (result.status === 'fulfilled' && result.value.data?.success && result.value.data.data) {
            // Build a lookup of sent domains for normalization (AI may strip www.)
            const sentDomains = new Set(chunk[idx]);
            const sentDomainMap = new Map<string, string>();
            chunk[idx].forEach(d => {
              sentDomainMap.set(d.toLowerCase(), d);
              sentDomainMap.set(d.toLowerCase().replace(/^www\./, ''), d);
              sentDomainMap.set('www.' + d.toLowerCase().replace(/^www\./, ''), d);
            });

            Object.entries(result.value.data.data).forEach(([aiDomain, info]: [string, any]) => {
              // Normalize: use original domain name if AI returned a different form
              const originalDomain = sentDomainMap.get(aiDomain.toLowerCase()) || aiDomain;

              allUpsertData.push({
                client_id: selectedClient?.id,
                domain: originalDomain,
                url: `https://${originalDomain}`,
                citation_category: info.category,
                source_type: info.source_type,
                authority_tier: info.authority_tier,
                relationship_type: info.relationship_type,
                verification_status: 'pending', // So cron picks up new domains for verification
                updated_at: new Date().toISOString()
              });

              newMeta[originalDomain] = {
                ...newMeta[originalDomain], // Preserve existing verification fields
                category: info.category,
                source_type: info.source_type,
                authority_tier: info.authority_tier,
                relationship_type: info.relationship_type,
                is_affiliate: info.source_type === 'affiliate'
              };
            });

            // Log sample for debugging
            const sample = Object.entries(result.value.data.data).slice(0, 3);
            console.log(`[Categorize] Sample results:`, sample.map(([d, v]: [string, any]) => `${d} → ${v.category}`).join(', '));
          } else {
            console.warn(`Batch ${i + idx + 1} failed:`, result.status === 'rejected' ? result.reason : result.value.data?.error);
          }
          completed += batch.length;
        });
      }

      // Final progress update
      onProgress?.({
        completed: uniqueDomains.length,
        total: uniqueDomains.length,
        currentBatch: batches.length,
        totalBatches: batches.length,
      });

      // Store all results in DB (no unique constraint on domain, so check+insert/update)
      if (allUpsertData.length > 0 && selectedClient) {
        console.log(`[Categorize] Saving ${allUpsertData.length} results to DB...`);

        // Find which domains already exist for this client (batch .in() to avoid limit)
        // Check BOTH www and non-www variants to prevent duplicate rows
        const allDomainsToCheck = allUpsertData.map(d => d.domain);
        const allDomainVariants = allDomainsToCheck.flatMap(d => {
          const bare = d.replace(/^www\./, '');
          return [d, `www.${bare}`, bare];
        });
        const uniqueVariants = [...new Set(allDomainVariants)];

        const existingRows: any[] = [];
        const IN_BATCH = 50; // Supabase .in() limit safety
        for (let b = 0; b < uniqueVariants.length; b += IN_BATCH) {
          const batchDomains = uniqueVariants.slice(b, b + IN_BATCH);
          const { data: rows, error: lookupErr } = await supabase
            .from('citation_intelligence')
            .select('id, domain')
            .eq('client_id', selectedClient.id)
            .in('domain', batchDomains);
          if (lookupErr) console.error("[Categorize] Lookup error:", lookupErr);
          if (rows) existingRows.push(...rows);
        }

        // Build lookup maps that normalize www/non-www variants to find existing rows
        const existingDomains = new Set<string>();
        const existingMap = new Map<string, string>();
        existingRows.forEach(r => {
          const bare = r.domain.replace(/^www\./, '');
          existingDomains.add(r.domain);
          existingDomains.add(bare);
          existingDomains.add(`www.${bare}`);
          // Map all variants to the same ID (first match wins)
          if (!existingMap.has(r.domain)) existingMap.set(r.domain, r.id);
          if (!existingMap.has(bare)) existingMap.set(bare, r.id);
          if (!existingMap.has(`www.${bare}`)) existingMap.set(`www.${bare}`, r.id);
        });
        console.log(`[Categorize] ${existingDomains.size} existing, ${allUpsertData.length - existingDomains.size} new`);

        // Update existing records
        let updatedCount = 0;
        for (const row of allUpsertData.filter(d => existingDomains.has(d.domain))) {
          const existingId = existingMap.get(row.domain);
          if (existingId) {
            const { error: updateErr } = await supabase.from('citation_intelligence').update({
              citation_category: row.citation_category,
              source_type: row.source_type,
              authority_tier: row.authority_tier,
              relationship_type: row.relationship_type,
              updated_at: row.updated_at,
            }).eq('id', existingId);
            if (updateErr) console.error(`[Categorize] Update error for ${row.domain}:`, updateErr);
            else updatedCount++;
          }
        }
        console.log(`[Categorize] Updated ${updatedCount} existing rows`);

        // Insert new records
        const newRows = allUpsertData.filter(d => !existingDomains.has(d.domain));
        if (newRows.length > 0) {
          const { error: insertError } = await supabase
            .from('citation_intelligence')
            .insert(newRows);
          if (insertError) console.error("[Categorize] DB Insert Error:", insertError);
          else console.log(`[Categorize] Inserted ${newRows.length} new rows`);
        }
      }

      setCitationMeta(newMeta);
      toast.success(`Categorized ${allUpsertData.length} domains successfully!`);
      return newMeta;
    } catch (err) {
      console.error("Categorization failed:", err);
      toast.error("AI Categorization failed: " + (err instanceof Error ? err.message : String(err)));
    }
  }, [selectedClient, citationMeta]);

  // Auto-categorize only NEW uncategorized domains (with progress tracking)
  const autoCategorizeNewDomains = useCallback(async () => {
    if (!selectedClient) return;
    try {
      // Collect all unique domains from current audit results
      const allDomains = new Set<string>();
      auditResults.forEach(ar => {
        ar.model_results?.forEach(mr => {
          mr.citations?.forEach(c => {
            if (c.domain) allDomains.add(c.domain);
          });
        });
      });

      // Filter to only uncategorized domains
      const uncategorized = Array.from(allDomains).filter(d => !citationMeta?.[d]?.category);
      if (uncategorized.length === 0) {
        console.log("[AutoCategorize] All domains already categorized, skipping");
        return;
      }

      console.log(`[AutoCategorize] Found ${uncategorized.length} new domains to categorize`);
      setCategorizationProgress({ completed: 0, total: uncategorized.length, currentBatch: 0, totalBatches: Math.ceil(uncategorized.length / 40), running: true });

      await categorizeCitations(uncategorized, (progress) => {
        setCategorizationProgress({ ...progress, running: progress.completed < progress.total });
      });

      setCategorizationProgress(null);
      console.log(`[AutoCategorize] Done categorizing ${uncategorized.length} domains`);

      // Auto-verify newly categorized citations (fire-and-forget)
      autoVerifyPendingRef.current?.().catch(err =>
        console.warn("[AutoVerify] Post-categorize failed (non-blocking):", err)
      );
    } catch (err) {
      setCategorizationProgress(null);
      console.warn("[AutoCategorize] Failed (non-blocking):", err);
    }
  }, [selectedClient, auditResults, citationMeta, categorizeCitations]);

  // Ref to allow forward-referencing autoCategorizeNewDomains from earlier-defined callbacks
  const autoCategorizeRef = useRef(autoCategorizeNewDomains);
  useEffect(() => { autoCategorizeRef.current = autoCategorizeNewDomains; }, [autoCategorizeNewDomains]);

  // Ref to allow autoVerifyPending to call verifyCitations (declared below) without forward-ref error
  const verifyCitationsRef = useRef<typeof verifyCitations | null>(null);

  // Auto-verify pending citations after categorization completes
  const autoVerifyPending = useCallback(async () => {
    if (!selectedClient) return;
    try {
      // Collect citations that need verification
      const pendingUrls = new Set<string>();
      auditResults.forEach(ar => {
        ar.model_results?.forEach(mr => {
          mr.citations?.forEach(c => {
            if (c.url && c.domain) {
              const meta = citationMeta?.[c.domain];
              if (!meta?.verification_status || meta.verification_status === 'pending') {
                pendingUrls.add(c.url);
              }
            }
          });
        });
      });

      const pendingCitations = Array.from(pendingUrls).slice(0, 30).map(url => ({
        url,
        citation_id: url
      }));

      if (pendingCitations.length === 0) {
        console.log("[AutoVerify] No pending citations to verify");
        return;
      }

      console.log(`[AutoVerify] Verifying ${pendingCitations.length} pending citations (of ${pendingUrls.size} total)`);
      const claim = selectedClient.brand_name || "brand mention";
      await verifyCitationsRef.current?.(pendingCitations, claim);
      console.log(`[AutoVerify] Completed auto-verification`);
    } catch (err) {
      console.warn("[AutoVerify] Failed (non-blocking):", err);
    }
  }, [selectedClient, auditResults, citationMeta]);

  const autoVerifyPendingRef = useRef(autoVerifyPending);
  useEffect(() => { autoVerifyPendingRef.current = autoVerifyPending; }, [autoVerifyPending]);

  // Auto-categorize uncategorized domains on page load (runs once per client session)
  const autoCategorizeDoneForClient = useRef<string | null>(null);
  useEffect(() => {
    if (!selectedClient || auditResults.length === 0) return;
    if (autoCategorizeDoneForClient.current === selectedClient.id) return;
    autoCategorizeDoneForClient.current = selectedClient.id;
    console.log(`[AutoCategorize] On load: checking for uncategorized domains for ${selectedClient.brand_name}`);
    autoCategorizeRef.current?.().catch(err => console.warn("[AutoCategorize] On-load failed:", err));
  }, [selectedClient, auditResults, citationMeta]);

  // Verify citations using semantic similarity engine
  const verifyCitations = useCallback(async (citations: Array<{ url: string; citation_id: string }>, claim: string, onProgress?: (progress: { completed: number; total: number; currentBatch: number; totalBatches: number }) => void) => {
    if (citations.length === 0) return;
    try {
      const BATCH_SIZE = 10;
      const batches: typeof citations[] = [];
      for (let i = 0; i < citations.length; i += BATCH_SIZE) {
        batches.push(citations.slice(i, i + BATCH_SIZE));
      }

      let completed = 0;
      let verified = 0;
      let partial = 0;
      let hallucinated = 0;

      for (let batchIdx = 0; batchIdx < batches.length; batchIdx++) {
        const batch = batches[batchIdx];

        onProgress?.({
          completed,
          total: citations.length,
          currentBatch: batchIdx + 1,
          totalBatches: batches.length,
        });

        const { data, error } = await supabase.functions.invoke('verify-citations', {
          body: {
            citations: batch,
            claim
          }
        });

        if (data?.success && data.results) {
          // Update local citationMeta immediately with batch results
          const updatedMeta = { ...citationMeta };
          data.results.forEach((result: any) => {
            if (result.status === 'verified') verified++;
            else if (result.status === 'partially_verified') partial++;
            else if (result.status === 'hallucinated') hallucinated++;

            // Extract domain from URL and update citationMeta for instant UI feedback
            try {
              const domain = new URL(result.url).hostname.replace('www.', '');
              if (updatedMeta[domain]) {
                updatedMeta[domain] = {
                  ...updatedMeta[domain],
                  verification_status: result.status,
                  similarity_score: result.score,
                  matched_paragraph: result.matched_text,
                };
              } else {
                updatedMeta[domain] = {
                  category: 'other', source_type: 'other', authority_tier: 3, relationship_type: 'neutral',
                  verification_status: result.status,
                  similarity_score: result.score,
                  matched_paragraph: result.matched_text,
                };
              }
            } catch { }
          });
          setCitationMeta(updatedMeta);
        } else {
          console.warn(`Batch ${batchIdx + 1} failed:`, data?.error || error);
        }

        completed += batch.length;
      }

      // Final progress update
      onProgress?.({
        completed: citations.length,
        total: citations.length,
        currentBatch: batches.length,
        totalBatches: batches.length,
      });

      toast.success(`Verified ${citations.length} citations: ${verified} verified, ${partial} partial, ${hallucinated} hallucinated`);

      // Full refresh to sync DB state (also updates cache)
      if (selectedClient) {
        await fetchCitationMeta();
      }

    } catch (err) {
      console.error("Verification failed:", err);
      toast.error("Citation verification failed: " + (err instanceof Error ? err.message : String(err)));
    }
  }, [selectedClient, citationMeta, fetchCitationMeta]);

  // Keep ref synced so autoVerifyPending (declared before verifyCitations) can call it
  useEffect(() => { verifyCitationsRef.current = verifyCitations; }, [verifyCitations]);


  // NOTE: The old useEffect that loaded citation meta on selectedClient change
  // has been REMOVED. Citation meta is now loaded as part of loadClientData().

  // ============================================
  // AI SEARCH VOLUME (DataForSEO)
  // ============================================

  const fetchSearchVolumes = useCallback(async (promptsToFetch?: Prompt[]) => {
    if (!selectedClient) return;
    const targetPrompts = (promptsToFetch || prompts).filter(p => {
      if (!p.topic && !p.prompt_text) return false;
      // Skip if updated within 30 days
      if (p.search_volume_updated_at) {
        const updatedAt = new Date(p.search_volume_updated_at).getTime();
        const thirtyDaysAgo = Date.now() - 30 * 24 * 60 * 60 * 1000;
        if (updatedAt > thirtyDaysAgo) return false;
      }
      return true;
    });

    if (targetPrompts.length === 0) return;

    // Use topic as keyword, fallback to first few words of prompt
    const keywords = [...new Set(targetPrompts.map(p =>
      (p.topic || p.prompt_text.split(/\s+/).slice(0, 5).join(" ")).toLowerCase()
    ))];

    try {
      console.log(`[SearchVolume] Fetching for ${keywords.length} keywords:`, keywords.slice(0, 5));
      const { data, error } = await supabase.functions.invoke("ai-search-volume", {
        body: {
          keywords,
          location_code: selectedClient.location_code || 2840,
          language_name: "English",
        },
      });

      if (error) {
        // Check for auth/JWT errors
        const errMsg = error.message || String(error);
        if (errMsg.includes("401") || errMsg.includes("non-2xx")) {
          console.error("[SearchVolume] Auth error — edge function may need --no-verify-jwt flag:", errMsg);
          toast.error("Search volume API auth error. The edge function needs to be redeployed with --no-verify-jwt.");
        } else {
          toast.error("Failed to fetch search volumes: " + errMsg);
        }
        return;
      }

      const results: Array<{ keyword: string; ai_search_volume: number | null }> = data?.results || [];
      const volumeMap = new Map(results.map(r => [r.keyword.toLowerCase(), r.ai_search_volume]));

      // Update prompts in DB and local state
      const updates: Prompt[] = [];
      for (const p of targetPrompts) {
        const key = (p.topic || p.prompt_text.split(/\s+/).slice(0, 5).join(" ")).toLowerCase();
        const volume = volumeMap.get(key) ?? null;

        await supabase.from("prompts").update({
          estimated_search_volume: volume,
          search_volume_updated_at: new Date().toISOString(),
        }).eq("id", p.id);

        updates.push({ ...p, estimated_search_volume: volume, search_volume_updated_at: new Date().toISOString() });
      }

      // Update local state
      setPrompts(prev => prev.map(p => {
        const updated = updates.find(u => u.id === p.id);
        return updated || p;
      }));

      const volCount = updates.filter(u => u.estimated_search_volume != null).length;
      if (volCount > 0) {
        toast.success(`Updated search volumes for ${volCount} prompt${volCount > 1 ? 's' : ''}`);
      }
    } catch (err) {
      console.error("Error fetching AI search volumes:", err);
      toast.error("Search volume fetch failed: " + (err instanceof Error ? err.message : String(err)));
    }
  }, [selectedClient, prompts]);

  // Keep ref synced so audit functions can call fetchSearchVolumes
  fetchSearchVolumesRef.current = fetchSearchVolumes;

  // ============================================
  // AI OPPORTUNITY SCORING
  // ============================================

  const getAIOpportunity = useCallback((promptId: string): { score: number; tier: string; color: string; demandDataAvailable: boolean } => {
    const DEFAULT = { score: 0, tier: 'Minimal', color: '#9ca3af', demandDataAvailable: false };
    const prompt = prompts.find(p => p.id === promptId);
    if (!prompt) return DEFAULT;

    // --- 1. Demand Strength (40%) — percentile rank of search volume ---
    const allVolumes = prompts
      .map(p => p.estimated_search_volume ?? null)
      .filter((v): v is number => v !== null)
      .sort((a, b) => a - b);

    let demandScore = 20; // default if no search volume data
    const demandDataAvailable = prompt.estimated_search_volume != null && allVolumes.length > 0;
    if (demandDataAvailable) {
      const rank = allVolumes.filter(v => v <= prompt.estimated_search_volume!).length;
      const percentile = (rank / allVolumes.length) * 100;
      if (percentile >= 90) demandScore = 92;
      else if (percentile >= 70) demandScore = 74;
      else if (percentile >= 30) demandScore = 49;
      else demandScore = 17;
    }

    // --- 2. AI Answer Depth (40%) — from latest audit result ---
    let depthScore = 30; // default for un-audited prompts
    const result = auditResults
      .filter(r => r.prompt_id === promptId)
      .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())[0];

    if (result) {
      const models = result.model_results || [];
      const totalModels = models.length;
      const visibleCount = models.filter(m => m.brand_mentioned).length;
      const totalCitations = result.summary?.total_citations || 0;
      const avgResponseLength = models.reduce((sum, m) => sum + (m.raw_response?.length || 0), 0) / (totalModels || 1);

      // Visibility component (0-50): how many models generated a substantive answer
      const visibilityPart = totalModels > 0 ? (totalModels / 6) * 50 : 0; // 6 models = max
      // Citation richness (0-30): more citations = richer ecosystem
      const citationPart = Math.min(totalCitations, 15) * 2;
      // Response depth (0-20): longer responses = more structured answers
      const depthPart = Math.min(avgResponseLength / 2000, 1) * 20;

      depthScore = Math.min(Math.round(visibilityPart + citationPart + depthPart), 100);
    }

    // --- 3. Intent Value (20%) — rule-based from prompt text ---
    const text = prompt.prompt_text.toLowerCase();
    let intentScore = 20; // generic default

    const transactional = /\b(buy|price|cost|order|purchase|shop|deal|discount|coupon|offer|cheapest|affordable)\b/;
    const commercial = /\b(best|top|review|compare|vs|versus|rated|recommended|ranking|leading|popular|alternative)\b/;
    const investigational = /\b(how to|guide|tutorial|steps|process|setup|install|configure|implement|way to|method)\b/;
    const informational = /\b(what is|what are|define|meaning|explain|overview|introduction|difference between|why)\b/;

    if (transactional.test(text)) intentScore = 100;
    else if (commercial.test(text)) intentScore = 80;
    else if (investigational.test(text)) intentScore = 60;
    else if (informational.test(text)) intentScore = 40;

    // --- Final weighted score ---
    const finalScore = Math.round(demandScore * 0.4 + depthScore * 0.4 + intentScore * 0.2);

    // --- Tier mapping ---
    let tier: string;
    let color: string;
    if (finalScore >= 80) { tier = 'Very High'; color = '#16a34a'; }
    else if (finalScore >= 60) { tier = 'High'; color = '#22c55e'; }
    else if (finalScore >= 40) { tier = 'Medium'; color = '#eab308'; }
    else if (finalScore >= 20) { tier = 'Low'; color = '#f97316'; }
    else { tier = 'Minimal'; color = '#9ca3af'; }

    return { score: finalScore, tier, color, demandDataAvailable };
  }, [prompts, auditResults]);

  // ============================================
  // RETURN
  // ============================================

  return {
    auditProgress,
    // State
    clients, selectedClient, prompts, auditResults, summary, costBreakdown,
    selectedModels, loading, loadingPromptIds, error, includeTavily, tavilyResults,

    // Client management
    addClient, updateClient, deleteClient, switchClient, setSelectedModels, setIncludeTavily,
    updateBrandTags, updateCompetitors, fetchCompetitors,

    // Audit
    runFullAudit, runSinglePrompt, runCampaign, runMultiAccountSchedule, clearResults,

    // Prompts
    addCustomPrompt, addMultiplePrompts, generateNichePrompts, deletePrompt, bulkArchivePrompts, bulkDeletePrompts, reactivatePrompt, clearAllPrompts, updatePrompt,

    // Export/Import
    exportToCSV, exportPrompts, exportFullReport, importData,

    // AI features
    generatePromptsFromKeywords, generateContent, generateVisibilityContent, generateRecommendations, generateOverallRecommendations, fetchSearchVolumes,

    // Analytics
    getAllCitations, getModelStats, getCompetitorGap, getTopSources, getInsights,
    citationMeta, categorizeCitations, verifyCitations, categorizationProgress, setCategorizationProgress,
    getAIOpportunity,

    // Constants
    INDUSTRY_PRESETS, LOCATION_CODES,

    // State setters
    setClients,

    // Refresh data (for use after imports, etc.)
    refreshData: fetchClients,
  };
}
