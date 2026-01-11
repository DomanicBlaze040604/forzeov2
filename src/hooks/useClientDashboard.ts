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

import { useState, useCallback, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";

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
  { id: "claude", name: "Claude", provider: "Anthropic", color: "#f59e0b", costPerQuery: 0.02 },
  { id: "gemini", name: "Gemini", provider: "Google", color: "#3b82f6", costPerQuery: 0.02 },
  { id: "perplexity", name: "Perplexity", provider: "Perplexity AI", color: "#8b5cf6", costPerQuery: 0.02 },
  { id: "google_ai_overview", name: "Google AI Overview", provider: "DataForSEO", color: "#ef4444", costPerQuery: 0.003 },
  { id: "google_serp", name: "Google SERP", provider: "DataForSEO", color: "#22c55e", costPerQuery: 0.002 },
];

export type PromptCategory =
  | "custom" | "imported" | "generated" | "niche" | "super_niche"
  | "brand" | "competitor" | "location" | "feature";

export interface Client {
  id: string;
  name: string;
  brand_name: string;
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
  citations: Array<{ url: string; title: string; domain: string }>;
  citation_count: number;
  api_cost: number;
  raw_response: string;
  response_length: number;
  is_cited?: boolean;
  authority_type?: string;
  ai_search_volume?: number;
}

export interface AuditResult {
  id: string;
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
  "India": 2356, "United States": 2840, "United Kingdom": 2826, "Thailand": 2764,
  "Singapore": 2702, "Australia": 2036, "Canada": 2124, "Germany": 2276,
  "France": 2250, "UAE": 2784,
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
};

function loadFromStorage<T>(key: string, defaultValue: T): T {
  try {
    const stored = localStorage.getItem(key);
    return stored ? JSON.parse(stored) : defaultValue;
  } catch { return defaultValue; }
}

function saveToStorage(key: string, value: unknown): void {
  try { localStorage.setItem(key, JSON.stringify(value)); } catch (err) { console.error("Storage error:", err); }
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
// MAIN HOOK
// ============================================

export function useClientDashboard() {
  const [clients, setClients] = useState<Client[]>([]);
  const [selectedClient, setSelectedClient] = useState<Client | null>(null);
  const [prompts, setPrompts] = useState<Prompt[]>([]);
  const [auditResults, setAuditResults] = useState<AuditResult[]>([]);
  const [summary, setSummary] = useState<DashboardSummary | null>(null);
  const [selectedModels, setSelectedModelsState] = useState<string[]>(
    loadFromStorage(STORAGE_KEYS.SELECTED_MODELS, ["chatgpt", "google_ai_overview", "google_serp"])
  );
  const [loading, setLoading] = useState(false);
  const [loadingPromptId, setLoadingPromptId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [includeTavily, setIncludeTavilyState] = useState<boolean>(
    loadFromStorage(STORAGE_KEYS.INCLUDE_TAVILY, true)
  );
  const [tavilyResults, setTavilyResults] = useState<Record<string, unknown>>({});

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

  const fetchClients = useCallback(async () => {
    try {
      const { data, error: fetchError } = await supabase
        .from("clients")
        .select("*")
        .order("created_at", { ascending: false });

      if (!fetchError && data && data.length > 0) {
        const mappedClients: Client[] = data.map(c => ({
          id: c.id, name: c.name, brand_name: c.brand_name, brand_tags: c.brand_tags || [],
          slug: c.slug, target_region: c.target_region, location_code: c.location_code,
          industry: c.industry, competitors: c.competitors || [],
          primary_color: c.primary_color || generateColor(), created_at: c.created_at,
        }));
        setClients(mappedClients);
        saveToStorage(STORAGE_KEYS.CLIENTS, mappedClients);
        const lastSelectedId = loadFromStorage<string>(STORAGE_KEYS.SELECTED_CLIENT, mappedClients[0]?.id);
        const lastSelected = mappedClients.find(c => c.id === lastSelectedId) || mappedClients[0];
        setSelectedClient(lastSelected);
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
    } else {
      setClients(storedClients);
      const lastSelectedId = loadFromStorage<string>(STORAGE_KEYS.SELECTED_CLIENT, storedClients[0]?.id);
      setSelectedClient(storedClients.find(c => c.id === lastSelectedId) || storedClients[0]);
    }
  }, []);

  const addClient = useCallback(async (clientData: Partial<Client>): Promise<Client> => {
    const newClient: Client = {
      id: crypto.randomUUID(),
      name: clientData.name || "New Client",
      brand_name: clientData.brand_name || clientData.name || "New Brand",
      slug: generateSlug(clientData.name || "new-client"),
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
        slug: newClient.slug, target_region: newClient.target_region, location_code: newClient.location_code,
        industry: newClient.industry, primary_color: newClient.primary_color,
        brand_tags: newClient.brand_tags, competitors: newClient.competitors,
      });
      if (insertError) console.error("Supabase insert error:", insertError);
    } catch (err) { console.log("Supabase insert failed:", err); }

    const newClients = [...clients, newClient];
    setClients(newClients);
    saveToStorage(STORAGE_KEYS.CLIENTS, newClients);
    return newClient;
  }, [clients]);

  const updateClient = useCallback(async (clientId: string, updates: Partial<Client>): Promise<Client | null> => {
    const clientIndex = clients.findIndex(c => c.id === clientId);
    if (clientIndex === -1) return null;

    const updatedClient = { ...clients[clientIndex], ...updates };

    // Save to Supabase first
    try {
      const { error: updateError } = await supabase.from("clients").update({
        name: updatedClient.name, brand_name: updatedClient.brand_name,
        target_region: updatedClient.target_region, location_code: updatedClient.location_code,
        industry: updatedClient.industry, primary_color: updatedClient.primary_color,
        brand_tags: updatedClient.brand_tags, competitors: updatedClient.competitors,
      }).eq("id", clientId);
      if (updateError) console.error("Supabase update error:", updateError);
    } catch (err) { console.log("Supabase update failed:", err); }

    const newClients = [...clients];
    newClients[clientIndex] = updatedClient;
    setClients(newClients);
    saveToStorage(STORAGE_KEYS.CLIENTS, newClients);
    if (selectedClient?.id === clientId) setSelectedClient(updatedClient);
    return updatedClient;
  }, [clients, selectedClient]);

  const deleteClient = useCallback(async (clientId: string): Promise<boolean> => {
    if (clients.length <= 1) return false;

    try {
      await supabase.from("clients").delete().eq("id", clientId);
    } catch (err) { console.log("Supabase delete failed:", err); }

    const newClients = clients.filter(c => c.id !== clientId);
    setClients(newClients);
    saveToStorage(STORAGE_KEYS.CLIENTS, newClients);
    if (selectedClient?.id === clientId) setSelectedClient(newClients[0]);
    return true;
  }, [clients, selectedClient]);

  const switchClient = useCallback(async (client: Client) => {
    setSelectedClient(client);
    saveToStorage(STORAGE_KEYS.SELECTED_CLIENT, client.id);

    // Load prompts from Supabase first
    try {
      const { data: promptsData } = await supabase
        .from("prompts").select("*").eq("client_id", client.id).eq("is_active", true);
      if (promptsData && promptsData.length > 0) {
        const mappedPrompts: Prompt[] = promptsData.map(p => ({
          id: p.id, client_id: p.client_id, prompt_text: p.prompt_text,
          category: p.category || "custom", is_custom: p.is_custom, is_active: p.is_active,
        }));
        setPrompts(mappedPrompts);
        const storedPrompts = loadFromStorage<Record<string, Prompt[]>>(STORAGE_KEYS.PROMPTS, {});
        storedPrompts[client.id] = mappedPrompts;
        saveToStorage(STORAGE_KEYS.PROMPTS, storedPrompts);
      } else {
        const storedPrompts = loadFromStorage<Record<string, Prompt[]>>(STORAGE_KEYS.PROMPTS, {});
        setPrompts(storedPrompts[client.id] || []);
      }
    } catch {
      const storedPrompts = loadFromStorage<Record<string, Prompt[]>>(STORAGE_KEYS.PROMPTS, {});
      setPrompts(storedPrompts[client.id] || []);
    }

    // Load results from Supabase
    try {
      const { data: resultsData } = await supabase
        .from("audit_results").select("*").eq("client_id", client.id).order("created_at", { ascending: false });
      if (resultsData && resultsData.length > 0) {
        const mappedResults: AuditResult[] = resultsData.map(r => ({
          id: r.id, prompt_id: r.prompt_id, prompt_text: r.prompt_text,
          model_results: r.model_results || [],
          // Build summary from individual columns (database stores them separately, not as JSONB)
          summary: r.summary || {
            share_of_voice: r.share_of_voice ?? 0,
            average_rank: r.average_rank ?? null,
            total_citations: r.total_citations ?? 0,
            total_cost: r.total_cost ?? 0,
          },
          created_at: r.created_at,
        }));
        setAuditResults(mappedResults);
        updateSummary(mappedResults);
        const storedResults = loadFromStorage<Record<string, AuditResult[]>>(STORAGE_KEYS.RESULTS, {});
        storedResults[client.id] = mappedResults;
        saveToStorage(STORAGE_KEYS.RESULTS, storedResults);
        return;
      }
    } catch { /* fallback to localStorage */ }

    const storedResults = loadFromStorage<Record<string, AuditResult[]>>(STORAGE_KEYS.RESULTS, {});
    const clientResults = storedResults[client.id] || [];
    setAuditResults(clientResults);
    updateSummary(clientResults);
  }, []);

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
  }, [selectedClient, clients]);

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
  }, [selectedClient, clients]);

  // ============================================
  // PROMPT MANAGEMENT - Supabase Primary
  // ============================================

  const addCustomPrompt = useCallback(async (promptText: string, category?: PromptCategory): Promise<Prompt | null> => {
    if (!selectedClient) return null;
    const nicheLevel = detectNicheLevel(promptText);
    const detectedCategory = category || (nicheLevel === "super_niche" ? "super_niche" : nicheLevel === "niche" ? "niche" : "custom");

    const newPrompt: Prompt = {
      id: crypto.randomUUID(), client_id: selectedClient.id, prompt_text: promptText,
      category: detectedCategory, is_custom: true, is_active: true, niche_level: nicheLevel,
    };

    // Save to Supabase first
    try {
      const { error: insertError } = await supabase.from("prompts").insert({
        id: newPrompt.id, client_id: newPrompt.client_id, prompt_text: newPrompt.prompt_text,
        category: newPrompt.category, is_custom: newPrompt.is_custom, is_active: newPrompt.is_active,
      });
      if (insertError) console.error("Supabase prompt insert error:", insertError);
    } catch (err) { console.log("Supabase prompt insert failed:", err); }

    const newPrompts = [...prompts, newPrompt];
    setPrompts(newPrompts);
    const storedPrompts = loadFromStorage<Record<string, Prompt[]>>(STORAGE_KEYS.PROMPTS, {});
    storedPrompts[selectedClient.id] = newPrompts;
    saveToStorage(STORAGE_KEYS.PROMPTS, storedPrompts);
    return newPrompt;
  }, [selectedClient, prompts]);

  const addMultiplePrompts = useCallback(async (promptTexts: string[], category?: PromptCategory) => {
    if (!selectedClient) return;
    const newPrompts: Prompt[] = promptTexts.filter(t => t.trim()).map(text => {
      const nicheLevel = detectNicheLevel(text);
      return {
        id: crypto.randomUUID(), client_id: selectedClient.id, prompt_text: text.trim(),
        category: category || (nicheLevel === "super_niche" ? "super_niche" : nicheLevel === "niche" ? "niche" : "imported"),
        is_custom: true, is_active: true, niche_level: nicheLevel,
      };
    });

    // Save to Supabase
    try {
      const { error: insertError } = await supabase.from("prompts").insert(
        newPrompts.map(p => ({
          id: p.id, client_id: p.client_id, prompt_text: p.prompt_text,
          category: p.category, is_custom: p.is_custom, is_active: p.is_active,
        }))
      );
      if (insertError) console.error("Supabase bulk insert error:", insertError);
    } catch (err) { console.log("Supabase bulk insert failed:", err); }

    const allPrompts = [...prompts, ...newPrompts];
    setPrompts(allPrompts);
    const storedPrompts = loadFromStorage<Record<string, Prompt[]>>(STORAGE_KEYS.PROMPTS, {});
    storedPrompts[selectedClient.id] = allPrompts;
    saveToStorage(STORAGE_KEYS.PROMPTS, storedPrompts);
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

  const updateSummary = useCallback((results: AuditResult[]) => {
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
  }, []);

  const runFullAudit = useCallback(async () => {
    if (!selectedClient || prompts.length === 0) return;
    setLoading(true);
    setError(null);
    const results: AuditResult[] = [...auditResults];

    for (const prompt of prompts) {
      if (results.find(r => r.prompt_id === prompt.id)) continue;
      setLoadingPromptId(prompt.id);

      try {
        const { data, error: fnError } = await supabase.functions.invoke("geo-audit", {
          body: {
            client_id: selectedClient.id, prompt_id: prompt.id, prompt_text: prompt.prompt_text,
            brand_name: selectedClient.brand_name, brand_tags: selectedClient.brand_tags,
            competitors: selectedClient.competitors, location_code: selectedClient.location_code,
            models: selectedModels, niche_level: prompt.niche_level, save_to_db: true,
          },
        });

        if (!fnError && data?.success) {
          const result: AuditResult = {
            id: data.data.id || crypto.randomUUID(), prompt_id: prompt.id, prompt_text: prompt.prompt_text,
            model_results: data.data.model_results, summary: data.data.summary, created_at: data.data.timestamp,
          };
          results.push(result);
          setAuditResults([...results]);
          const storedResults = loadFromStorage<Record<string, AuditResult[]>>(STORAGE_KEYS.RESULTS, {});
          storedResults[selectedClient.id] = results;
          saveToStorage(STORAGE_KEYS.RESULTS, storedResults);
          updateSummary(results);
        } else {
          setError(fnError?.message || data?.error || "Audit failed");
        }
        await new Promise(r => setTimeout(r, 300));
      } catch (err) {
        console.error("Audit error:", err);
        setError(err instanceof Error ? err.message : "Audit failed");
      }
    }
    setLoading(false);
    setLoadingPromptId(null);
  }, [selectedClient, prompts, selectedModels, auditResults, updateSummary]);

  const runSinglePrompt = useCallback(async (promptId: string) => {
    if (!selectedClient) return;
    const prompt = prompts.find(p => p.id === promptId);
    if (!prompt) return;

    // Check if there's an existing result (for re-run)
    const existingResultIndex = auditResults.findIndex(r => r.prompt_id === promptId);

    setLoadingPromptId(promptId);
    setError(null);

    try {
      // Run geo-audit
      const { data, error: fnError } = await supabase.functions.invoke("geo-audit", {
        body: {
          client_id: selectedClient.id, prompt_id: prompt.id, prompt_text: prompt.prompt_text,
          brand_name: selectedClient.brand_name, brand_tags: selectedClient.brand_tags,
          competitors: selectedClient.competitors, location_code: selectedClient.location_code,
          models: selectedModels, niche_level: prompt.niche_level, save_to_db: true,
        },
      });

      if (!fnError && data?.success) {
        const result: AuditResult = {
          id: data.data.id || crypto.randomUUID(), prompt_id: prompt.id, prompt_text: prompt.prompt_text,
          model_results: data.data.model_results, summary: data.data.summary, created_at: data.data.timestamp,
        };

        let newResults: AuditResult[];
        if (existingResultIndex >= 0) {
          // Replace existing result (re-run)
          newResults = [...auditResults];
          newResults[existingResultIndex] = result;
        } else {
          // Add new result
          newResults = [...auditResults, result];
        }

        setAuditResults(newResults);
        const storedResults = loadFromStorage<Record<string, AuditResult[]>>(STORAGE_KEYS.RESULTS, {});
        storedResults[selectedClient.id] = newResults;
        saveToStorage(STORAGE_KEYS.RESULTS, storedResults);
        updateSummary(newResults);

        // Run Tavily search if enabled
        if (includeTavily) {
          try {
            console.log("[Tavily] Running source analysis for prompt:", prompt.prompt_text.substring(0, 50));
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
        setError(fnError?.message || data?.error || "Audit failed");
      }
    } catch (err) {
      console.error("Single audit error:", err);
      setError(err instanceof Error ? err.message : "Audit failed");
    } finally {
      setLoadingPromptId(null);
    }
  }, [selectedClient, prompts, selectedModels, auditResults, updateSummary, includeTavily]);

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

    // 2. Run Prompts
    // We don't necessarily need to update local auditResults immediately if the Campaign View fetches its own data.
    // But updating it keeps the "Analytics" tab fresh too.
    const newResults: AuditResult[] = [...auditResults];

    for (const promptId of promptIds) {
      const prompt = prompts.find(p => p.id === promptId);
      if (!prompt) continue;

      setLoadingPromptId(promptId);

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
            location_code: selectedClient.location_code,
            models: selectedModels,
            niche_level: prompt.niche_level,
            save_to_db: true,
          },
        });

        if (!fnError && data?.success) {
          const result: AuditResult = {
            id: data.data.id || crypto.randomUUID(), prompt_id: prompt.id, prompt_text: prompt.prompt_text,
            model_results: data.data.model_results, summary: data.data.summary, created_at: data.data.timestamp,
          };
          newResults.push(result);
          // Update local state incremental
          setAuditResults([...newResults]);
        } else {
          console.error("Campaign prompt failed:", fnError || data?.error);
        }
        await new Promise(r => setTimeout(r, 500)); // Rate limit buffer
      } catch (err) {
        console.error("Campaign run error:", err);
      }
    }

    // Final state update
    setAuditResults(newResults);
    const storedResults = loadFromStorage<Record<string, AuditResult[]>>(STORAGE_KEYS.RESULTS, {});
    storedResults[selectedClient.id] = newResults;
    saveToStorage(STORAGE_KEYS.RESULTS, storedResults);
    updateSummary(newResults);

    setLoading(false);
    setLoadingPromptId(null);
  }, [selectedClient, prompts, selectedModels, auditResults, updateSummary]);

  // ============================================
  // EXPORT/IMPORT FUNCTIONS
  // ============================================

  const exportToCSV = useCallback(() => {
    if (!selectedClient || auditResults.length === 0) return;
    const rows = [["Prompt", "Category", "Niche Level", "SOV", "Rank", "Citations", "Cost"]];
    for (const r of auditResults) {
      const prompt = prompts.find(p => p.id === r.prompt_id);
      rows.push([r.prompt_text, prompt?.category || "custom", prompt?.niche_level || "broad",
      `${r.summary.share_of_voice}%`, r.summary.average_rank?.toString() || "-",
      r.summary.total_citations.toString(), `$${r.summary.total_cost.toFixed(4)}`]);
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

    let report = `FORZEO GEO VISIBILITY REPORT\n${"=".repeat(60)}\n\n`;
    report += `Client: ${selectedClient.name}\nBrand: ${selectedClient.brand_name}\n`;
    report += `Industry: ${selectedClient.industry}\nRegion: ${selectedClient.target_region}\nDate: ${date}\n\n`;
    report += `SUMMARY\n${"-".repeat(40)}\nShare of Voice: ${summary?.overall_sov || 0}%\n`;
    report += `Average Rank: ${summary?.average_rank ? `#${summary.average_rank}` : 'N/A'}\n`;
    report += `Total Citations: ${summary?.total_citations || 0}\nTotal Cost: $${(summary?.total_cost || 0).toFixed(4)}\n\n`;
    report += `Status: ${ins.statusText}\n\nRecommendations:\n${ins.recommendations.map(r => `  • ${r}`).join('\n')}\n\n`;
    report += `VISIBILITY BY MODEL\n${"-".repeat(40)}\n`;
    AI_MODELS.forEach(model => {
      const s = stats[model.id] || { visible: 0, total: 0, cost: 0 };
      const pct = s.total > 0 ? Math.round((s.visible / s.total) * 100) : 0;
      report += `${model.name.padEnd(20)} ${s.visible}/${s.total} (${pct}%)  $${s.cost.toFixed(4)}\n`;
    });
    report += `\nCOMPETITOR ANALYSIS\n${"-".repeat(40)}\n`;
    gap.forEach((c, idx) => { report += `${idx + 1}. ${c.name.padEnd(25)} ${c.percentage}% (${c.mentions})\n`; });
    report += `\nTOP SOURCES\n${"-".repeat(40)}\n`;
    sources.forEach((s, idx) => { report += `${idx + 1}. ${s.domain.padEnd(40)} ${s.count}\n`; });

    const blob = new Blob([report], { type: "text/plain" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${selectedClient.slug}-report-${new Date().toISOString().split("T")[0]}.txt`;
    a.click();
    URL.revokeObjectURL(url);
  }, [selectedClient, summary, getModelStats, getCompetitorGap, getTopSources, getInsights]);

  const importData = useCallback((data: string) => {
    try {
      if (data.trim().startsWith("{") || data.trim().startsWith("[")) {
        const parsed = JSON.parse(data);
        if (parsed.prompts) {
          const promptTexts = parsed.prompts.map((p: string | { text: string }) => typeof p === "string" ? p : p.text);
          addMultiplePrompts(promptTexts);
        }
      } else {
        addMultiplePrompts(data.split("\n").filter(l => l.trim().length > 3));
      }
    } catch {
      addMultiplePrompts(data.split("\n").filter(l => l.trim().length > 3));
    }
  }, [addMultiplePrompts]);

  // ============================================
  // AI GENERATION FUNCTIONS
  // ============================================

  const generatePromptsFromKeywords = useCallback(async (keywords: string, options: { sentiment?: string; focus?: string; competitors?: string[] } = {}): Promise<string[]> => {
    if (!selectedClient) return [];

    const { sentiment = "Neutral", focus = "General", competitors = [] } = options;
    const competitorContext = competitors.length > 0 ? `Competitors to analyze against: ${competitors.join(", ")}` : "";

    // Construct a more detailed prompt based on options
    let systemInstruction = `You are an expert SEO and Brand Reputation Analyst. Generate 10 search prompts that real users would type into AI search engines (like Perplexity, SearchGPT, Google Gemini).`;

    let userPrompt = `Generate 10 search prompts based on these keywords: "${keywords}"\n\nContext:\nBrand: ${selectedClient.brand_name}\nIndustry: ${selectedClient.industry}\nRegion: ${selectedClient.target_region}\n${competitorContext}\n\n`;

    // Add Focus Logic
    if (focus === "Competitor") {
      userPrompt += `FOCUS: Generate prompts that directly compare ${selectedClient.brand_name} against its competitors. Examples: "Diff between ${selectedClient.brand_name} and ${competitors[0] || 'competitor'}", "Is ${selectedClient.brand_name} better than..."\n`;
    } else if (focus === "Feature") {
      userPrompt += `FOCUS: Generate prompts specific to features, pricing, and use-cases. Examples: "${selectedClient.brand_name} pricing", "${selectedClient.brand_name} for enterprise", "How to use..."\n`;
    } else {
      userPrompt += `FOCUS: Generate a mix of informational, navigational, and commercial investigation prompts.\n`;
    }

    // Add Sentiment Logic
    if (sentiment === "Negative") {
      userPrompt += `SENTIMENT SCENARIO: Generate "crisis" or "problem" searching prompts to test how the AI handles negative queries. Examples: "${selectedClient.brand_name} complaints", "${selectedClient.brand_name} reviews reddit", "Is ${selectedClient.brand_name} legit?", "Cancel ${selectedClient.brand_name} subscription".\n`;
    } else if (sentiment === "Positive") {
      userPrompt += `SENTIMENT SCENARIO: Generate prompts from highly interested buyers looking for validation. Examples: "Why is ${selectedClient.brand_name} the best?", "Success stories with ${selectedClient.brand_name}".\n`;
    }

    userPrompt += `\nOutput ONLY the 10 prompts, one per line. No numbering, no introductory text.`;

    // 1. Try Supabase Edge Function first (if backend logic exists)
    try {
      const { data, error } = await supabase.functions.invoke("generate-content", {
        body: { prompt: userPrompt, type: "prompts" },
      });
      if (!error && data?.response) {
        return data.response.split("\n").map((l: string) => l.trim()).filter((l: string) => l.length > 10 && !l.startsWith("-") && !l.match(/^\d+\./));
      }
    } catch (err) { console.log("Generate prompts error:", err); }

    // 2. Direct Groq Fallback (Primary method if desired)
    const groqApiKey = import.meta.env.VITE_GROQ_API_KEY;
    if (!groqApiKey) return [];

    try {
      const response = await fetch("https://api.groq.com/openai/v1/chat/completions", {
        method: "POST",
        headers: { "Authorization": `Bearer ${groqApiKey}`, "Content-Type": "application/json" },
        body: JSON.stringify({
          model: "llama-3.1-8b-instant",
          messages: [
            { role: "system", content: systemInstruction },
            { role: "user", content: userPrompt }
          ],
          temperature: 0.7,
          max_tokens: 2048,
        }),
      });

      if (response.ok) {
        const data = await response.json();
        const content = data.choices?.[0]?.message?.content || "";
        // Clean up the output to ensure just lines of text
        return content.split("\n")
          .map((l: string) => l.replace(/^\d+\.\s*/, "").replace(/^-\s*/, "").trim())
          .filter((l: string) => l.length > 5);
      }
    } catch (err) { console.error("Groq error:", err); }

    return [];
  }, [selectedClient]);

  const generateContent = useCallback(async (topic: string, contentType: string): Promise<string | null> => {
    if (!selectedClient) return null;
    const prompt = `Write a ${contentType} about: ${topic}\n\nBrand: ${selectedClient.brand_name}\nIndustry: ${selectedClient.industry}\nCompetitors: ${selectedClient.competitors.join(", ")}\nRegion: ${selectedClient.target_region}\n\nMake it SEO-optimized. Format in Markdown.`;

    try {
      const { data, error } = await supabase.functions.invoke("generate-content", {
        body: { prompt, type: contentType, brand_name: selectedClient.brand_name, competitors: selectedClient.competitors },
      });
      if (!error && data?.response) return data.response;
    } catch (err) { console.log("Generate content error:", err); }

    const groqApiKey = import.meta.env.VITE_GROQ_API_KEY;
    if (!groqApiKey) return null;
    try {
      const response = await fetch("https://api.groq.com/openai/v1/chat/completions", {
        method: "POST",
        headers: { "Authorization": `Bearer ${groqApiKey}`, "Content-Type": "application/json" },
        body: JSON.stringify({
          model: "llama-3.1-8b-instant",
          messages: [{ role: "system", content: "You are an expert content writer." }, { role: "user", content: prompt }],
          temperature: 0.7, max_tokens: 4096,
        }),
      });
      if (response.ok) {
        const data = await response.json();
        return data.choices?.[0]?.message?.content || null;
      }
    } catch (err) { console.error("Groq error:", err); }
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

  useEffect(() => { fetchClients(); }, [fetchClients]);

  useEffect(() => {
    if (selectedClient) {
      // Load from Supabase on client change
      (async () => {
        try {
          const { data: promptsData } = await supabase
            .from("prompts").select("*").eq("client_id", selectedClient.id).eq("is_active", true);
          if (promptsData && promptsData.length > 0) {
            const mappedPrompts: Prompt[] = promptsData.map(p => ({
              id: p.id, client_id: p.client_id, prompt_text: p.prompt_text,
              category: p.category || "custom", is_custom: p.is_custom, is_active: p.is_active,
            }));
            setPrompts(mappedPrompts);
          } else {
            const storedPrompts = loadFromStorage<Record<string, Prompt[]>>(STORAGE_KEYS.PROMPTS, {});
            setPrompts(storedPrompts[selectedClient.id] || []);
          }
        } catch {
          const storedPrompts = loadFromStorage<Record<string, Prompt[]>>(STORAGE_KEYS.PROMPTS, {});
          setPrompts(storedPrompts[selectedClient.id] || []);
        }

        try {
          const { data: resultsData } = await supabase
            .from("audit_results").select("*").eq("client_id", selectedClient.id).order("created_at", { ascending: false });
          if (resultsData && resultsData.length > 0) {
            const mappedResults: AuditResult[] = resultsData.map(r => ({
              id: r.id, prompt_id: r.prompt_id, prompt_text: r.prompt_text,
              model_results: r.model_results || [],
              // Build summary from individual columns (database stores them separately, not as JSONB)
              summary: r.summary || {
                share_of_voice: r.share_of_voice ?? 0,
                average_rank: r.average_rank ?? null,
                total_citations: r.total_citations ?? 0,
                total_cost: r.total_cost ?? 0,
              },
              created_at: r.created_at,
            }));
            setAuditResults(mappedResults);
            updateSummary(mappedResults);
          } else {
            const storedResults = loadFromStorage<Record<string, AuditResult[]>>(STORAGE_KEYS.RESULTS, {});
            const clientResults = storedResults[selectedClient.id] || [];
            setAuditResults(clientResults);
            updateSummary(clientResults);
          }
        } catch {
          const storedResults = loadFromStorage<Record<string, AuditResult[]>>(STORAGE_KEYS.RESULTS, {});
          const clientResults = storedResults[selectedClient.id] || [];
          setAuditResults(clientResults);
          updateSummary(clientResults);
        }
      })();
    }
  }, [selectedClient, updateSummary]);

  // ============================================
  // RETURN
  // ============================================

  return {
    // State
    clients, selectedClient, prompts, auditResults, summary, costBreakdown,
    selectedModels, loading, loadingPromptId, error, includeTavily, tavilyResults,

    // Client management
    addClient, updateClient, deleteClient, switchClient, setSelectedModels, setIncludeTavily,
    updateBrandTags, updateCompetitors,

    // Audit
    runFullAudit, runSinglePrompt, runCampaign, clearResults,

    // Prompts
    addCustomPrompt, addMultiplePrompts, generateNichePrompts, deletePrompt, reactivatePrompt, clearAllPrompts,

    // Export/Import
    exportToCSV, exportPrompts, exportFullReport, importData,

    // AI features
    generatePromptsFromKeywords, generateContent,

    // Analytics
    getAllCitations, getModelStats, getCompetitorGap, getTopSources, getInsights,

    // Constants
    INDUSTRY_PRESETS, LOCATION_CODES,
  };
}
