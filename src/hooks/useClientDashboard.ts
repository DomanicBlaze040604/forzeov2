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
    } else {
      setClients(storedClients);
      const lastSelectedId = loadFromStorage<string>(STORAGE_KEYS.SELECTED_CLIENT, storedClients[0]?.id);
      setSelectedClient(storedClients.find(c => c.id === lastSelectedId) || storedClients[0]);
    }
  }, []);

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
    if (selectedClient?.id === clientId) setSelectedClient(updatedClient);
    return updatedClient;
  }, [clients, selectedClient]);

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
    if (selectedClient?.id === clientId) {
      setSelectedClient(newClients.length > 0 ? newClients[0] : null);
    }
    return true;
  }, [clients, selectedClient]);

  const switchClient = useCallback(async (client: Client) => {
    setSelectedClient(client);
    saveToStorage(STORAGE_KEYS.SELECTED_CLIENT, client.id);

    // Load prompts from Supabase first
    try {
      const { data: promptsData } = await supabase
        .from("prompts").select("*").eq("client_id", client.id);
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
          id: r.id, client_id: r.client_id, prompt_id: r.prompt_id, prompt_text: r.prompt_text,
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

    // Check agency prompt limit (10 prompts per brand)
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
    };

    // Save to Supabase first - THROW on error
    try {
      const { error: insertError } = await supabase.from("prompts").insert({
        id: newPrompt.id, client_id: newPrompt.client_id, prompt_text: newPrompt.prompt_text,
        category: newPrompt.category, is_custom: newPrompt.is_custom, is_active: newPrompt.is_active,
      });
      if (insertError) throw insertError;

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

  const addMultiplePrompts = useCallback(async (promptTexts: string[], category?: PromptCategory) => {
    if (!selectedClient) return;

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
        // Limit the number of prompts to add
        maxPromptsToAdd = Math.min(promptTexts.length, remainingSlots);
        if (maxPromptsToAdd < promptTexts.length) {
          console.warn(`Agency limit: Only adding ${maxPromptsToAdd} of ${promptTexts.length} prompts (limit: 15 per brand)`);
        }
      }
    }

    const newPrompts: Prompt[] = promptTexts.slice(0, maxPromptsToAdd).filter(t => t.trim()).map(text => {
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
      if (insertError) throw insertError;

      // Only update local state if DB insert succeeded
      const allPrompts = [...prompts, ...newPrompts];
      setPrompts(allPrompts);
      const storedPrompts = loadFromStorage<Record<string, Prompt[]>>(STORAGE_KEYS.PROMPTS, {});
      storedPrompts[selectedClient.id] = allPrompts;
      saveToStorage(STORAGE_KEYS.PROMPTS, storedPrompts);
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

  const updatePrompt = useCallback(async (promptId: string, newText: string) => {
    if (!selectedClient || !newText.trim()) return;

    // Update in Supabase - THROW on error to bubble up to UI
    try {
      const { error: updateError } = await supabase
        .from("prompts")
        .update({ prompt_text: newText.trim() })
        .eq("id", promptId);

      if (updateError) throw updateError;

      // Update local state
      const updatedPrompts = prompts.map(p => p.id === promptId ? { ...p, prompt_text: newText.trim() } : p);
      setPrompts(updatedPrompts);
      const storedPrompts = loadFromStorage<Record<string, Prompt[]>>(STORAGE_KEYS.PROMPTS, {});
      storedPrompts[selectedClient.id] = updatedPrompts;
      saveToStorage(STORAGE_KEYS.PROMPTS, storedPrompts);
    } catch (err) {
      console.error("Supabase update prompt failed:", err);
      throw err;
    }
  }, [selectedClient, prompts]);

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
        await new Promise(r => setTimeout(r, 300));
      } catch (err) {
        console.error("Audit error CRITICAL:", err);
        setError(err instanceof Error ? err.message : "Audit failed");
      }
    }
    setLoading(false);
    setLoadingPromptId(null);
  }, [selectedClient, prompts, selectedModels, auditResults, updateSummary, includeTavily]);

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
      console.error("Single audit error CRITICAL:", err);
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

          // Run Tavily search if enabled
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
    const rows = [["Prompt", "Category", "Niche Level", "SOV", "Rank", "Citations"]];
    for (const r of auditResults) {
      const prompt = prompts.find(p => p.id === r.prompt_id);
      rows.push([r.prompt_text, prompt?.category || "custom", prompt?.niche_level || "broad",
      `${r.summary.share_of_voice}%`, r.summary.average_rank?.toString() || "-",
      r.summary.total_citations.toString()]);
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
    report += `Website: ${selectedClient.brand_domain || 'Not specified'}\n`;
    report += `Industry: ${selectedClient.industry}\nRegion: ${selectedClient.target_region}\nDate: ${date}\n\n`;
    report += `SUMMARY\n${"-".repeat(40)}\nShare of Voice: ${summary?.overall_sov || 0}%\n`;
    report += `Average Rank: ${summary?.average_rank ? `#${summary.average_rank}` : 'N/A'}\n`;
    report += `Total Citations: ${summary?.total_citations || 0}\n\n`;
    report += `Status: ${ins.statusText}\n\nRecommendations:\n${ins.recommendations.map(r => `  • ${r}`).join('\n')}\n\n`;
    report += `VISIBILITY BY MODEL\n${"-".repeat(40)}\n`;
    AI_MODELS.forEach(model => {
      const s = stats[model.id] || { visible: 0, total: 0, cost: 0 };
      const pct = s.total > 0 ? Math.round((s.visible / s.total) * 100) : 0;
      report += `${model.name.padEnd(20)} ${s.visible}/${s.total} (${pct}%)\n`;
    });
    report += `\nCOMPETITOR ANALYSIS\n${"-".repeat(40)}\n`;
    gap.forEach((c, idx) => { report += `${idx + 1}. ${c.name.padEnd(25)} ${c.percentage}% (${c.mentions})\n`; });
    report += `\nTOP SOURCES\n${"-".repeat(40)}\n`;
    sources.forEach((s, idx) => { report += `${idx + 1}. ${s.domain.padEnd(40)} ${s.count}\n`; });

    // Add Tavily Results section
    const tavilyEntries = Object.entries(tavilyResults).filter(([_, data]) => data);
    if (tavilyEntries.length > 0) {
      report += `\n${"=".repeat(60)}\nTAVILY AI SOURCE ANALYSIS\n${"=".repeat(60)}\n\n`;

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
      report += `\n${"=".repeat(60)}\nAI VISIBILITY INSIGHTS & RECOMMENDATIONS\n${"=".repeat(60)}\n\n`;

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

      report += `OVERALL VISIBILITY SUMMARY\n${"-".repeat(40)}\n`;
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
      auditResults.forEach(result => {
        result.model_results.forEach(mr => {
          const response = mr.raw_response?.toLowerCase() || '';
          selectedClient.competitors.forEach(comp => {
            const matches = response.match(new RegExp(comp.toLowerCase(), 'gi'));
            if (matches) allCompMentions[comp] = (allCompMentions[comp] || 0) + matches.length;
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

    const blob = new Blob([report], { type: "text/plain" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${selectedClient.slug}-report-${new Date().toISOString().split("T")[0]}.txt`;
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

  const generateContent = useCallback(async (topic: string, contentType: string, tone?: string, audience?: string, keywords?: string): Promise<string | null> => {
    if (!selectedClient) return null;
    let prompt = `Write a ${contentType} about: ${topic}\n\nBrand: ${selectedClient.brand_name}\nIndustry: ${selectedClient.industry}\nCompetitors: ${selectedClient.competitors.join(", ")}\nRegion: ${selectedClient.target_region}`;

    if (audience?.trim()) prompt += `\nTarget Audience: ${audience.trim()}`;
    if (keywords?.trim()) prompt += `\nKey Selling Points / Keywords: ${keywords.trim()}`;

    if (tone?.trim()) {
      prompt += `\n\nTONE OF VOICE / STYLE REFERENCE:\n"${tone.trim()}"\n\nINSTRUCTION: Analyze the style, vocabulary, and sentence structure of the reference text above. Generate the desired content strictly mimicking this tone and style.`;
    }

    prompt += `\n\nMake it SEO-optimized. Format in Markdown.`;

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
- Share of Voice: ${auditResult?.summary?.share_of_voice || 0}% (${auditResult?.summary?.share_of_voice || 0 >= 50 ? 'Good - appearing in most AI responses' : 'Improvement needed'})
- Average Rank: ${auditResult?.summary?.average_rank || 'Not ranked in lists'}
- Total Citations: ${auditResult?.summary?.total_citations || 0}

TOP SOURCES CITED BY AI MODELS:
${topCitations}

COMPETITORS APPEARING IN AI RESPONSES: ${competitorContext}

${tavilyContext}

CONTENT STRATEGY BASED ON ANALYSIS:
1. Current gap: ${auditResult?.summary?.share_of_voice || 0 < 50 ? `${selectedClient.brand_name} is underrepresented vs competitors` : `${selectedClient.brand_name} has good visibility but can improve ranking`}
2. Target: Position ${selectedClient.brand_name} as a thought leader and trusted authority for "${promptText}"
3. Approach: Address gaps where competitors are mentioned but the brand is not
4. Citation strategy: Create content worthy of being cited by authoritative sources
5. Brand integration: Natural mentions that solve real user problems
6. Differentiation: Highlight unique value propositions not covered by competitors

Generate comprehensive, humanized content that will improve this brand's AI visibility:`;


    // Try Groq API directly for best quality
    const groqApiKey = import.meta.env.VITE_GROQ_API_KEY;
    if (!groqApiKey) {
      console.error('[Groq] No API key configured');
      return null;
    }

    try {
      console.log('[Groq] Generating visibility content for:', promptText.substring(0, 50));
      const response = await fetch("https://api.groq.com/openai/v1/chat/completions", {
        method: "POST",
        headers: {
          "Authorization": `Bearer ${groqApiKey}`,
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          model: "llama-3.3-70b-versatile",  // Use larger model for better quality
          messages: [
            { role: "system", content: systemPrompt },
            { role: "user", content: userPrompt }
          ],
          temperature: 0.8,  // Higher temperature for more creative/human writing
          max_tokens: 8192,
        }),
      });

      if (response.ok) {
        const data = await response.json();
        const content = data.choices?.[0]?.message?.content;
        console.log('[Groq] Generated content:', content?.length || 0, 'characters');
        return content || null;
      } else {
        const errorText = await response.text();
        console.error('[Groq] API error:', response.status, errorText);
      }
    } catch (err) {
      console.error('[Groq] Exception:', err);
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

  /**
   * Auto-discover competitors using Groq API
   */
  const fetchCompetitors = useCallback(async (
    brandName: string,
    industry: string,
    region: string
  ): Promise<string[]> => {
    const groqApiKey = import.meta.env.VITE_GROQ_API_KEY;
    if (!groqApiKey || !brandName) return [];

    try {
      const response = await fetch("https://api.groq.com/openai/v1/chat/completions", {
        method: "POST",
        headers: {
          "Authorization": `Bearer ${groqApiKey}`,
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
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
        }),
      });

      if (response.ok) {
        const data = await response.json();
        const content = data.choices?.[0]?.message?.content;
        try {
          const parsed = JSON.parse(content);
          // Handle various possible JSON structures the LLM might return
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
   * Generate AI-powered recommendations for a specific prompt based on audit and Tavily data
   * Uses Groq API to analyze visibility gaps and provide actionable insights
   */
  const generateRecommendations = useCallback(async (
    promptText: string,
    auditResult: AuditResult | null,
    tavilyData: any
  ): Promise<{ recommendations: string[]; priority: 'high' | 'medium' | 'low'; summary: string } | null> => {
    if (!selectedClient) return null;

    const groqApiKey = import.meta.env.VITE_GROQ_API_KEY;
    if (!groqApiKey) {
      console.error('[Groq] No API key for recommendations');
      return null;
    }

    // Build context from audit
    const sov = auditResult?.summary?.share_of_voice || 0;
    const rank = auditResult?.summary?.average_rank || 'Not ranked';
    const modelSummary = auditResult?.model_results
      .map(mr => `${mr.model_name}: ${mr.brand_mentioned ? 'Mentioned' : 'Not mentioned'}${mr.brand_rank ? `, Rank #${mr.brand_rank}` : ''}`)
      .join('\n') || 'No model data';

    const topCitations = auditResult?.model_results
      .flatMap(mr => mr.citations)
      .slice(0, 5)
      .map(c => `${c.domain}`)
      .join(', ') || 'None';

    const competitorsInResponse = auditResult?.model_results
      .flatMap(mr => {
        const response = mr.raw_response?.toLowerCase() || '';
        return selectedClient.competitors.filter(c => response.includes(c.toLowerCase()));
      })
      .filter((v, i, a) => a.indexOf(v) === i) || [];

    // Build Tavily context
    const tavilyContext = tavilyData ? `
Tavily Web Analysis:
- Brand Found in Web Sources: ${tavilyData.analysis?.brand_mentioned ? 'Yes' : 'No'} (${tavilyData.analysis?.brand_mention_count || 0} times)
- Competitor Web Presence: ${JSON.stringify(tavilyData.analysis?.competitor_mentions || {})}
- Top Authoritative Domains: ${(tavilyData.analysis?.top_domains || []).slice(0, 5).map((d: any) => d.domain).join(', ') || 'None'}
- Dominant Source Types: ${JSON.stringify(tavilyData.analysis?.source_types || {})}
- Tavily Insights: ${(tavilyData.analysis?.insights || []).join('; ') || 'None'}` : '';

    const systemPrompt = `You are an AI Visibility Strategy Expert. Analyze the provided data and generate HIGHLY SPECIFIC, IMMEDIATELY ACTIONABLE recommendations.

CRITICAL ANTI-GENERIC RULES - NEVER USE THESE PHRASES:
- "study their content strategy" 
- "build relationships with..."
- "create quality content"
- "focus on improving..."
- "analyze competitor..."
- "engage authentically"

REQUIRED SPECIFICITY - EVERY recommendation MUST include:
1. EXACT target (domain name, competitor name, content URL)
2. SPECIFIC action (word count, format, platform)
3. TIMELINE (this week, within 2 weeks, this month)
4. SUCCESS METRIC (how to measure if it worked)

EXAMPLE GOOD RECOMMENDATIONS:
✓ "Create 2000-word comparison page at yourbrand.com/vs/CompetitorX covering: pricing table, feature matrix, 5 user testimonials. Publish within 2 weeks. Track: organic traffic to page + AI model citations."
✓ "Post answer on Quora to 'Best [industry] tools 2024' (URL: quora.com/xxx). 250-400 words. Include personal experience with BrandName. Post this week. Track: answer impressions + upvotes."
✓ "Pitch TechCrunch contributor Sarah Smith (sarah@tc.com) with exclusive data: 'X% of users prefer Y'. Angle: industry trend piece. Send pitch Monday. Track: coverage + backlink."

EXAMPLE BAD (FORBIDDEN) RECOMMENDATIONS:
✗ "Improve content quality across the website"
✗ "Build relationships with industry publications"
✗ "Study how competitors get mentioned"

Output EXACTLY this JSON format:
{
  "priority": "high|medium|low",
  "summary": "One sentence with SPECIFIC metrics (e.g., 'Visibility at 23%, CompetitorX leads with 67%')",
  "recommendations": [
    "Specific action 1 with exact target, format, timeline, metric",
    "Specific action 2...",
    "Specific action 3...",
    "Specific action 4...",
    "Specific action 5..."
  ]
}`;

    const userPrompt = `Analyze this brand's AI visibility and provide recommendations:

QUERY: "${promptText}"

BRAND: ${selectedClient.brand_name}
INDUSTRY: ${selectedClient.industry}
REGION: ${selectedClient.target_region}
WEBSITE: ${selectedClient.brand_domain || 'Not specified'}
COMPETITORS: ${selectedClient.competitors.join(', ')}

CURRENT VISIBILITY STATUS:
- Share of Voice: ${sov}%
- Average Rank: ${rank}
- Competitors appearing in AI responses: ${competitorsInResponse.join(', ') || 'None'}

AI MODEL BREAKDOWN:
${modelSummary}

TOP CITED DOMAINS: ${topCitations}
${tavilyContext}

Generate 5 specific, actionable recommendations to improve this brand's visibility for this query:`;

    try {
      console.log('[Groq] Generating recommendations for:', promptText.substring(0, 40));
      const response = await fetch("https://api.groq.com/openai/v1/chat/completions", {
        method: "POST",
        headers: {
          "Authorization": `Bearer ${groqApiKey}`,
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          model: "llama-3.1-8b-instant",
          messages: [
            { role: "system", content: systemPrompt },
            { role: "user", content: userPrompt }
          ],
          temperature: 0.5,
          max_tokens: 1024,
        }),
      });

      if (response.ok) {
        const data = await response.json();
        const content = data.choices?.[0]?.message?.content || '';
        console.log('[Groq] Recommendations response:', content.substring(0, 100));

        try {
          // Parse JSON response
          const jsonMatch = content.match(/\{[\s\S]*\}/);
          if (jsonMatch) {
            const parsed = JSON.parse(jsonMatch[0]);
            return {
              priority: parsed.priority || 'medium',
              summary: parsed.summary || 'Analysis complete',
              recommendations: parsed.recommendations || []
            };
          }
        } catch (parseErr) {
          console.error('[Groq] Failed to parse recommendations JSON:', parseErr);
          // Fallback: try to extract recommendations from text
          const lines = content.split('\n').filter((l: string) => l.trim().startsWith('-') || l.trim().match(/^\d+\./));
          if (lines.length > 0) {
            return {
              priority: sov < 30 ? 'high' : sov < 60 ? 'medium' : 'low',
              summary: `Current visibility is ${sov}% - ${sov < 30 ? 'urgent improvement needed' : sov < 60 ? 'room for growth' : 'maintain and optimize'}`,
              recommendations: lines.slice(0, 5).map((l: string) => l.replace(/^[-\d.]+\s*/, '').trim())
            };
          }
        }
      } else {
        console.error('[Groq] Recommendations API error:', response.status);
      }
    } catch (err) {
      console.error('[Groq] Recommendations exception:', err);
    }

    // Return fallback recommendations based on data
    const fallbackRecs = [];
    if (sov < 50) fallbackRecs.push(`Improve visibility - currently only appearing in ${sov}% of AI responses`);
    if (competitorsInResponse.length > 0) fallbackRecs.push(`Target competitor gap: ${competitorsInResponse[0]} is appearing where you're not`);
    if (tavilyData?.analysis?.insights?.length > 0) {
      fallbackRecs.push(`Insight from web analysis: ${tavilyData.analysis.insights[0]}`);
    }
    if (topCitations) fallbackRecs.push(`Build relationships with cited sources: ${topCitations}`);

    return {
      priority: sov < 30 ? 'high' : sov < 60 ? 'medium' : 'low',
      summary: `Share of Voice: ${sov}%`,
      recommendations: fallbackRecs.length > 0 ? fallbackRecs : ['Run more audits to gather data for recommendations']
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

    const groqApiKey = import.meta.env.VITE_GROQ_API_KEY;
    if (!groqApiKey) {
      console.error('[Groq] No API key for overall recommendations');
      return null;
    }

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
      console.log('[Groq] Generating overall recommendations');
      const response = await fetch("https://api.groq.com/openai/v1/chat/completions", {
        method: "POST",
        headers: {
          "Authorization": `Bearer ${groqApiKey}`,
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          model: "llama-3.1-8b-instant",
          messages: [
            { role: "system", content: systemPrompt },
            { role: "user", content: userPrompt }
          ],
          temperature: 0.5,
          max_tokens: 1200,
        }),
      });

      if (response.ok) {
        const data = await response.json();
        const content = data.choices?.[0]?.message?.content || '';
        console.log('[Groq] Overall recommendations response:', content.substring(0, 100));

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
  // RETURN
  // ============================================

  return {
    // State
    clients, selectedClient, prompts, auditResults, summary, costBreakdown,
    selectedModels, loading, loadingPromptId, error, includeTavily, tavilyResults,

    // Client management
    addClient, updateClient, deleteClient, switchClient, setSelectedModels, setIncludeTavily,
    updateBrandTags, updateCompetitors, fetchCompetitors,

    // Audit
    runFullAudit, runSinglePrompt, runCampaign, clearResults,

    // Prompts
    addCustomPrompt, addMultiplePrompts, generateNichePrompts, deletePrompt, reactivatePrompt, clearAllPrompts, updatePrompt,

    // Export/Import
    exportToCSV, exportPrompts, exportFullReport, importData,

    // AI features
    generatePromptsFromKeywords, generateContent, generateVisibilityContent, generateRecommendations, generateOverallRecommendations,

    // Analytics
    getAllCitations, getModelStats, getCompetitorGap, getTopSources, getInsights,

    // Constants
    INDUSTRY_PRESETS, LOCATION_CODES,

    // State setters
    setClients,
  };
}
