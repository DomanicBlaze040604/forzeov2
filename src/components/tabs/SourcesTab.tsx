import React, { useState } from "react";
import { cn } from "@/lib/utils";
import {
  Search,
  AlertTriangle,
  ExternalLink,
  Link2,
  Download,
  ArrowUpDown,
  Loader2,
  Globe,
  Sparkles,
  Info,
  X,
  ChevronRight,
  ChevronDown,
  Circle,
  Shield,
  CheckCircle,
  Clock,
  Building2,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuTrigger,
  DropdownMenuSeparator,
} from "@/components/ui/dropdown-menu";
import { AI_MODELS } from "@/hooks/useClientDashboard";
import type { Client, CitationMeta } from "@/hooks/useClientDashboard";
import { MODEL_LOGOS } from "@/components/ModelLogos";
import { toast } from "sonner";

// ---------------------------------------------------------------------------
// Domain classification helpers (duplicated from ClientDashboard – these
// should ideally live in a shared utils module).
// ---------------------------------------------------------------------------

export const DOMAIN_TYPES: Record<string, { label: string; color: string; bg: string; dot: string }> = {
  owned: { label: "Owned", color: "text-emerald-700", bg: "bg-emerald-100", dot: "#10b981" },
  competitor: { label: "Competitor", color: "text-red-700", bg: "bg-red-100", dot: "#ef4444" },
  ugc: { label: "UGC", color: "text-cyan-700", bg: "bg-cyan-100", dot: "#06b6d4" },
  editorial: { label: "Editorial", color: "text-purple-700", bg: "bg-purple-100", dot: "#a855f7" },
  review: { label: "Review", color: "text-yellow-700", bg: "bg-yellow-100", dot: "#eab308" },
  reference: { label: "Reference", color: "text-green-700", bg: "bg-green-100", dot: "#22c55e" },
  institutional: { label: "Institutional", color: "text-blue-700", bg: "bg-blue-100", dot: "#3b82f6" },
  social: { label: "Social", color: "text-pink-700", bg: "bg-pink-100", dot: "#ec4899" },
  ecommerce: { label: "E-commerce", color: "text-orange-700", bg: "bg-orange-100", dot: "#f97316" },
  other: { label: "Other", color: "text-gray-700", bg: "bg-gray-100", dot: "#6b7280" },
};

export const normalizeCitationCategory = (cat?: string): string => {
  if (!cat) return "other";
  const map: Record<string, string> = {
    review_sites: "review",
    comparison_sites: "review",
    blogs: "editorial",
    marketplaces: "ecommerce",
    directories: "ecommerce",
    reference_authority: "reference",
  };
  return map[cat] || (DOMAIN_TYPES[cat] ? cat : "other");
};

export function classifyDomain(
  domain: string,
  clientDomain?: string,
  competitors?: string[],
  brandName?: string,
): string {
  const d = domain.toLowerCase().replace(/^www\./, "");

  if (clientDomain && d.includes(clientDomain.toLowerCase().replace(/^www\./, ""))) return "owned";
  if (brandName) {
    const normalizedBrand = brandName.toLowerCase().replace(/[^a-z0-9]/g, "");
    if (normalizedBrand.length > 2 && d.includes(normalizedBrand)) return "owned";
  }

  if (competitors) {
    for (const comp of competitors) {
      if (!comp) continue;
      if (d.includes(comp.toLowerCase().replace(/^www\./, ""))) return "competitor";
      const normalizedComp = comp.toLowerCase().replace(/[^a-z0-9]/g, "");
      if (normalizedComp.length > 2 && d.includes(normalizedComp)) return "competitor";
    }
  }

  const ugc = ["reddit.com", "quora.com", "stackexchange.com", "stackoverflow.com", "medium.com", "dev.to", "producthunt.com", "hackernews", "news.ycombinator"];
  const editorial = ["nytimes.com", "forbes.com", "businessinsider.com", "techcrunch.com", "wired.com", "theverge.com", "arstechnica.com", "zdnet.com", "cnet.com", "bbc.com", "reuters.com", "bloomberg.com", "wsj.com", "cnbc.com", "theguardian.com", "washingtonpost.com", "nerdwallet.com", "investopedia.com"];
  const review = ["g2.com", "capterra.com", "trustradius.com", "getapp.com", "softwareadvice.com", "trustpilot.com", "glassdoor.com", "yelp.com", "tripadvisor.com", "consumerreports.org"];
  const reference = ["wikipedia.org", "wikimedia.org", "britannica.com", "merriam-webster.com", "dictionary.com"];
  const institutional = [".gov", ".edu", ".org"];
  const social = ["twitter.com", "x.com", "linkedin.com", "facebook.com", "instagram.com", "youtube.com", "tiktok.com", "pinterest.com"];
  const ecommerce = ["amazon.com", "ebay.com", "walmart.com", "shopify.com", "etsy.com", "alibaba.com"];

  if (ugc.some((u) => d.includes(u))) return "ugc";
  if (editorial.some((u) => d.includes(u))) return "editorial";
  if (review.some((u) => d.includes(u))) return "review";
  if (reference.some((u) => d.includes(u))) return "reference";
  if (social.some((u) => d.includes(u))) return "social";
  if (ecommerce.some((u) => d.includes(u))) return "ecommerce";
  if (institutional.some((u) => d.endsWith(u))) return "institutional";

  return "other";
}

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface DomainStat {
  domain: string;
  count: number;
  type: string;
  avg: number;
  models: string[];
  promptCount: number;
  prompts: Array<{ text: string; visible: boolean; competitors: string[] }>;
  /** Present only in gap view */
  gapCompetitors?: string[];
}

export interface CitationEntry {
  url: string;
  title: string;
  domain: string;
  count: number;
  prompts: string[];
  models: string[];
}

interface ProgressState {
  completed: number;
  total: number;
  currentBatch: number;
  totalBatches: number;
  running: boolean;
}

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------

export interface SourcesTabProps {
  selectedClient: Client | null;

  // Data
  allCitations: CitationEntry[];
  domainStats: DomainStat[];
  citationMeta: Record<string, CitationMeta>;
  filteredAuditResults: Array<{
    id: string;
    prompt_id: string;
    prompt_text: string;
    model_results: Array<{
      model: string;
      brand_mentioned: boolean;
      raw_response?: string;
      citations: Array<{ url: string; title: string; domain: string }>;
      [key: string]: any;
    }>;
    [key: string]: any;
  }>;

  // View state
  sourcesView: "domains" | "urls";
  setSourcesView: (v: "domains" | "urls") => void;
  sourcesGapView: "all" | "gap";
  setSourcesGapView: (v: "all" | "gap") => void;
  sourcesTypeFilter: string;
  setSourcesTypeFilter: (v: string) => void;
  sourcesModelFilter: string[];
  setSourcesModelFilter: React.Dispatch<React.SetStateAction<string[]>>;
  sourcesModelFilterOpen: boolean;
  setSourcesModelFilterOpen: (v: boolean) => void;
  sourcesPage: number;
  setSourcesPage: React.Dispatch<React.SetStateAction<number>>;
  SOURCES_PAGE_SIZE: number;

  // Actions
  categorizeCitations: (
    domains: string[],
    onProgress?: (progress: { completed: number; total: number; currentBatch: number; totalBatches: number }) => void,
  ) => Promise<any>;
  verifyCitations: (
    citations: Array<{ url: string; citation_id: string }>,
    claim: string,
    onProgress?: (progress: { completed: number; total: number; currentBatch: number; totalBatches: number }) => void,
  ) => Promise<void>;

  // Categorization progress (from hook)
  categorizationProgress: ProgressState | null;
  setCategorizationProgress: React.Dispatch<React.SetStateAction<ProgressState | null>>;
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

const SourcesTab: React.FC<SourcesTabProps> = ({
  selectedClient,
  allCitations,
  domainStats,
  citationMeta,
  filteredAuditResults,
  sourcesView,
  setSourcesView,
  sourcesGapView,
  setSourcesGapView,
  sourcesTypeFilter,
  setSourcesTypeFilter,
  sourcesModelFilter,
  setSourcesModelFilter,
  sourcesModelFilterOpen,
  setSourcesModelFilterOpen,
  sourcesPage,
  setSourcesPage,
  SOURCES_PAGE_SIZE,
  categorizeCitations,
  verifyCitations,
  categorizationProgress,
  setCategorizationProgress,
}) => {
  // Local state that was previously in the parent
  const [sourceSearch, setSourceSearch] = useState("");
  const [expandedDomain, setExpandedDomain] = useState<string | null>(null);
  const [verificationProgress, setVerificationProgress] = useState<ProgressState | null>(null);

  // Derived data (lifted from parent useMemos – recomputed locally)
  const modelFilteredDomainStats = React.useMemo(
    () =>
      sourcesModelFilter.length === 0
        ? domainStats
        : domainStats.filter((s) => s.models.some((m) => sourcesModelFilter.includes(m))),
    [domainStats, sourcesModelFilter],
  );

  const modelFilteredCitations = React.useMemo(
    () =>
      sourcesModelFilter.length === 0
        ? allCitations
        : allCitations.filter((c) => c.models.some((m) => sourcesModelFilter.includes(m))),
    [allCitations, sourcesModelFilter],
  );

  const filteredDomainStats = React.useMemo(
    () =>
      !sourceSearch
        ? modelFilteredDomainStats
        : modelFilteredDomainStats.filter((s) => s.domain.toLowerCase().includes(sourceSearch.toLowerCase())),
    [modelFilteredDomainStats, sourceSearch],
  );

  const filteredUrlCitations = React.useMemo(
    () =>
      !sourceSearch
        ? modelFilteredCitations
        : modelFilteredCitations.filter(
            (c) =>
              c.url.toLowerCase().includes(sourceSearch.toLowerCase()) ||
              c.domain.toLowerCase().includes(sourceSearch.toLowerCase()) ||
              c.title?.toLowerCase().includes(sourceSearch.toLowerCase()),
          ),
    [modelFilteredCitations, sourceSearch],
  );

  const gapDomains = React.useMemo(() => {
    if (!selectedClient) return [];
    const brandDomains = new Set<string>();
    const competitorDomains = new Map<string, Set<string>>();
    filteredAuditResults.forEach((result) => {
      result.model_results.forEach((mr) => {
        if (sourcesModelFilter.length > 0 && !sourcesModelFilter.includes(mr.model)) return;
        const response = mr.raw_response?.toLowerCase() || "";
        const hasBrand = mr.brand_mentioned;
        mr.citations.forEach((c) => {
          if (hasBrand) brandDomains.add(c.domain);
          selectedClient.competitors.forEach((comp) => {
            if (response.includes(comp.toLowerCase())) {
              if (!competitorDomains.has(c.domain)) competitorDomains.set(c.domain, new Set());
              competitorDomains.get(c.domain)!.add(comp);
            }
          });
        });
      });
    });
    return Array.from(competitorDomains.entries())
      .filter(([domain]) => !brandDomains.has(domain))
      .map(([domain, competitors]) => ({ domain, competitors: Array.from(competitors) }))
      .slice(0, 20);
  }, [selectedClient, filteredAuditResults, sourcesModelFilter]);

  const displayedStats: DomainStat[] = (
    sourcesGapView === "gap"
      ? gapDomains
          .map((g) => {
            const stat = modelFilteredDomainStats.find((s) => s.domain === g.domain);
            return stat ? { ...stat, gapCompetitors: g.competitors } : null;
          })
          .filter(Boolean)
      : filteredDomainStats
  ) as DomainStat[];

  // Export helper
  const exportSources = () => {
    if (sourcesView === "domains") {
      if (domainStats.length === 0) return;
      const rows = [["Domain", "Type", "Citations", "Prompts"]];
      for (const s of domainStats) {
        rows.push([s.domain, s.type, s.count.toString(), s.promptCount.toString()]);
      }
      const csv = rows.map((r) => r.map((cell) => `"${cell.replace(/"/g, '""')}"`).join(",")).join("\n");
      const blob = new Blob([csv], { type: "text/csv" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `sources-domains-${new Date().toISOString().split("T")[0]}.csv`;
      a.click();
      URL.revokeObjectURL(url);
    } else {
      if (allCitations.length === 0) return;
      const rows = [["URL", "Title", "Domain", "Type", "Count", "Prompts"]];
      for (const c of allCitations) {
        rows.push([
          c.url,
          c.title || "",
          c.domain,
          classifyDomain(c.domain, selectedClient?.brand_domain, selectedClient?.competitors, selectedClient?.brand_name),
          c.count.toString(),
          c.prompts.join("; "),
        ]);
      }
      const csv = rows.map((r) => r.map((cell) => `"${cell.replace(/"/g, '""')}"`).join(",")).join("\n");
      const blob = new Blob([csv], { type: "text/csv" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `sources-urls-${new Date().toISOString().split("T")[0]}.csv`;
      a.click();
      URL.revokeObjectURL(url);
    }
  };

  // -------------------------------------------------------------------------
  // JSX
  // -------------------------------------------------------------------------
  return (
    <div className="space-y-6">
      <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 flex items-start gap-3"><div className="p-2 bg-blue-100 rounded-lg"><Globe className="h-5 w-5 text-blue-600" /></div><div><h4 className="font-medium text-blue-900">What are Sources?</h4><p className="text-sm text-blue-700 mt-0.5">Sources are the origin websites where AI models pull facts from. These are the domains that the AI references when generating responses - the places where the information comes from.</p></div></div>
      <div className="flex items-center gap-2">
        {sourcesView === "domains" && (
          <>
            <Button
              variant="outline"
              size="sm"
              disabled={!!categorizationProgress?.running}
              onClick={async () => {
                const allDomains = domainStats.map(d => d.domain);

                if (allDomains.length === 0) {
                  toast.success("No domains to categorize!");
                  return;
                }

                setCategorizationProgress({ completed: 0, total: allDomains.length, currentBatch: 0, totalBatches: Math.ceil(allDomains.length / 100), running: true });

                await categorizeCitations(allDomains, (progress) => {
                  setCategorizationProgress({ ...progress, running: progress.completed < progress.total });
                });

                setCategorizationProgress(null);
              }}
              className="hidden md:flex"
            >
              {categorizationProgress?.running ? (
                <Loader2 className="h-3.5 w-3.5 mr-1 animate-spin" />
              ) : (
                <Sparkles className="h-3.5 w-3.5 mr-1 text-purple-600" />
              )}
              {categorizationProgress?.running
                ? `Categorizing... ${Math.round((categorizationProgress.completed / categorizationProgress.total) * 100)}%`
                : "Categorize with AI"}
            </Button>
            {categorizationProgress?.running && (
              <div className="flex items-center gap-2 min-w-[200px]">
                <div className="flex-1 bg-gray-200 rounded-full h-2 overflow-hidden">
                  <div
                    className="h-full bg-gradient-to-r from-purple-500 to-blue-500 transition-all duration-500 ease-out rounded-full"
                    style={{ width: `${Math.round((categorizationProgress.completed / categorizationProgress.total) * 100)}%` }}
                  />
                </div>
                <span className="text-xs text-gray-500 whitespace-nowrap">
                  {categorizationProgress.completed}/{categorizationProgress.total} · Batch {categorizationProgress.currentBatch}/{categorizationProgress.totalBatches}
                </span>
              </div>
            )}

            <Button
              variant="outline"
              size="sm"
              disabled={!!verificationProgress?.running}
              onClick={async () => {
                // Get all citations that need verification
                const citationsToVerify = allCitations
                  .filter(c => citationMeta?.[c.domain]?.verification_status === 'pending' || !citationMeta?.[c.domain]?.verification_status)
                  .map(c => ({ url: c.url, citation_id: c.url }));

                if (citationsToVerify.length === 0) {
                  toast.success("All citations verified!");
                  return;
                }

                setVerificationProgress({ completed: 0, total: citationsToVerify.length, currentBatch: 0, totalBatches: Math.ceil(citationsToVerify.length / 10), running: true });

                // Use brand name as the claim for verification
                const claim = selectedClient?.brand_name || "brand mention";

                await verifyCitations(citationsToVerify, claim, (progress) => {
                  setVerificationProgress({ ...progress, running: progress.completed < progress.total });
                });

                setVerificationProgress(null);
              }}
              className="hidden md:flex"
            >
              {verificationProgress?.running ? (
                <Loader2 className="h-3.5 w-3.5 mr-1 animate-spin" />
              ) : (
                <Shield className="h-3.5 w-3.5 mr-1 text-green-600" />
              )}
              {verificationProgress?.running
                ? `Verifying... ${Math.round((verificationProgress.completed / verificationProgress.total) * 100)}%`
                : "Verify Citations"}
            </Button>
            {verificationProgress?.running && (
              <div className="flex items-center gap-2 min-w-[200px]">
                <div className="flex-1 bg-gray-200 rounded-full h-2 overflow-hidden">
                  <div
                    className="h-full bg-gradient-to-r from-green-500 to-emerald-500 transition-all duration-500 ease-out rounded-full"
                    style={{ width: `${Math.round((verificationProgress.completed / verificationProgress.total) * 100)}%` }}
                  />
                </div>
                <span className="text-xs text-gray-500 whitespace-nowrap">
                  {verificationProgress.completed}/{verificationProgress.total} · Batch {verificationProgress.currentBatch}/{verificationProgress.totalBatches}
                </span>
              </div>
            )}
          </>
        )}
        <button onClick={() => setSourcesView("domains")} className={cn("px-4 py-2 rounded-lg text-sm font-medium transition-colors", sourcesView === "domains" ? "bg-gray-900 text-white" : "bg-white border border-gray-200 text-gray-600 hover:bg-gray-50")}>Domains ({domainStats.length})</button>
        <button onClick={() => setSourcesView("urls")} className={cn("px-4 py-2 rounded-lg text-sm font-medium transition-colors", sourcesView === "urls" ? "bg-gray-900 text-white" : "bg-white border border-gray-200 text-gray-600 hover:bg-gray-50")}>URLs ({allCitations.length})</button>
      </div>
      <div className="bg-white rounded-xl border border-gray-200 p-5">
        <div className="flex items-center justify-between mb-4"><h3 className="font-semibold text-gray-900">Source Usage by Domain</h3><div className="flex items-center gap-4 text-xs">{domainStats.slice(0, 5).map((s, i) => (<div key={i} className="flex items-center gap-1.5"><img src={`https://www.google.com/s2/favicons?domain=${s.domain}&sz=16`} alt="" className="h-3.5 w-3.5 rounded" /><span className="text-gray-600">{s.domain}</span></div>))}</div></div>
        <div className="h-48 flex items-end gap-2 border-b border-gray-100 pb-4">{domainStats.slice(0, 15).map((s, i) => { const max = Math.max(...domainStats.slice(0, 15).map(x => x.count), 1); const h = (s.count / max) * 100; const t = DOMAIN_TYPES[s.type] || DOMAIN_TYPES.other; return (<div key={i} className="flex-1 flex flex-col items-center gap-1 group cursor-pointer" onClick={() => setExpandedDomain(expandedDomain === s.domain ? null : s.domain)}><div className="w-full rounded-t hover:opacity-80 transition-opacity relative" style={{ height: `${Math.max(h, 4)}%`, backgroundColor: t.dot, minHeight: 4 }}><div className="absolute -top-6 left-1/2 -translate-x-1/2 bg-gray-900 text-white text-xs px-2 py-1 rounded opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap z-10">{s.domain}: {s.count}</div></div><span className="text-xs text-gray-500">{s.count}</span></div>); })}</div>
        <div className="flex items-center justify-end gap-4 mt-4 text-xs">{Object.entries(DOMAIN_TYPES).slice(0, 6).map(([k, t]) => (<div key={k} className="flex items-center gap-1.5"><span className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: t.dot }} /><span className="text-gray-600">{t.label}</span></div>))}</div>
      </div>
      <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
        <div className="flex items-center justify-between p-4 border-b border-gray-100"><div className="flex items-center gap-3">{sourcesView === "domains" && <><button onClick={() => setSourcesGapView("all")} className={cn("flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium transition-colors", sourcesGapView === "all" ? "bg-gray-100 text-gray-700" : "text-gray-500 hover:bg-gray-50")}><Globe className="h-3.5 w-3.5" /> All Domains</button><button onClick={() => setSourcesGapView("gap")} className={cn("flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium transition-colors", sourcesGapView === "gap" ? "bg-orange-100 text-orange-700" : "text-gray-500 hover:bg-gray-50")}><AlertTriangle className="h-3.5 w-3.5" /> Gap Analysis{gapDomains.length > 0 && <Badge variant="secondary" className="ml-1">{gapDomains.length}</Badge>}</button></>}{sourcesView === "urls" && <span className="text-sm font-medium text-gray-700">All URLs ({modelFilteredCitations.length})</span>}</div><div className="flex items-center gap-2">
          {/* Multi-select LLM Model Filter */}
          <div className="relative">
            <button
              onClick={() => setSourcesModelFilterOpen(!sourcesModelFilterOpen)}
              className={cn(
                "h-9 px-3 rounded-lg border text-sm font-medium transition-colors flex items-center gap-2",
                sourcesModelFilter.length > 0
                  ? "border-blue-300 bg-blue-50 text-blue-700 hover:bg-blue-100"
                  : "border-gray-200 bg-white text-gray-700 hover:bg-gray-50"
              )}
            >
              <Sparkles className="h-3.5 w-3.5" />
              {sourcesModelFilter.length === 0
                ? "All Models"
                : sourcesModelFilter.length === 1
                  ? AI_MODELS.find(m => m.id === sourcesModelFilter[0])?.name || sourcesModelFilter[0]
                  : `${sourcesModelFilter.length} Models`}
              {sourcesModelFilter.length > 0 && (
                <span className="ml-0.5 px-1.5 py-0.5 bg-blue-200 text-blue-800 text-xs font-bold rounded-full">{sourcesModelFilter.length}</span>
              )}
              <ChevronDown className={cn("h-3.5 w-3.5 transition-transform", sourcesModelFilterOpen && "rotate-180")} />
            </button>
            {sourcesModelFilterOpen && (
              <>
                <div className="fixed inset-0 z-40" onClick={() => setSourcesModelFilterOpen(false)} />
                <div className="absolute right-0 top-full mt-1 w-64 bg-white rounded-lg border border-gray-200 shadow-lg z-50 py-1 animate-in fade-in slide-in-from-top-2 duration-150">
                  <div className="px-3 py-2 border-b border-gray-100 flex items-center justify-between">
                    <span className="text-xs font-semibold text-gray-500 uppercase tracking-wider">Filter by AI Engine</span>
                    <button
                      onClick={() => setSourcesModelFilter(sourcesModelFilter.length === AI_MODELS.length ? [] : AI_MODELS.map(m => m.id))}
                      className="text-xs text-blue-600 hover:text-blue-800 font-medium"
                    >
                      {sourcesModelFilter.length === AI_MODELS.length ? "Clear All" : "Select All"}
                    </button>
                  </div>
                  {AI_MODELS.map(model => {
                    const Logo = MODEL_LOGOS[model.id]?.Logo;
                    const color = MODEL_LOGOS[model.id]?.color || "#666";
                    const isSelected = sourcesModelFilter.includes(model.id);
                    return (
                      <label
                        key={model.id}
                        className={cn(
                          "flex items-center gap-3 px-3 py-2.5 cursor-pointer transition-colors",
                          isSelected ? "bg-blue-50/50" : "hover:bg-gray-50"
                        )}
                      >
                        <input
                          type="checkbox"
                          checked={isSelected}
                          onChange={() => {
                            setSourcesModelFilter(prev =>
                              prev.includes(model.id)
                                ? prev.filter(id => id !== model.id)
                                : [...prev, model.id]
                            );
                          }}
                          className="h-4 w-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                        />
                        <div className="flex items-center gap-2 flex-1">
                          {Logo && <Logo className="h-4 w-4" style={{ color }} />}
                          <span className="text-sm font-medium text-gray-700">{model.name}</span>
                        </div>
                        <span className="text-xs text-gray-400">{model.provider === "DataForSEO" ? "Google" : model.provider}</span>
                      </label>
                    );
                  })}
                  {sourcesModelFilter.length > 0 && (
                    <div className="px-3 py-2 border-t border-gray-100">
                      <button
                        onClick={() => { setSourcesModelFilter([]); setSourcesModelFilterOpen(false); }}
                        className="w-full text-center text-xs text-gray-500 hover:text-gray-700 font-medium py-1"
                      >
                        Reset to All Models
                      </button>
                    </div>
                  )}
                </div>
              </>
            )}
          </div>
          <select value={sourcesTypeFilter} onChange={(e) => setSourcesTypeFilter(e.target.value)} className="h-9 px-3 rounded-lg border border-gray-200 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-blue-500"><option value="all">All Types</option>{Object.entries(DOMAIN_TYPES).map(([key, val]) => (<option key={key} value={key}>{val.label}</option>))}</select><div className="relative"><Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" /><Input placeholder={sourcesView === "urls" ? "Search URLs..." : "Search domains..."} value={sourceSearch} onChange={(e) => setSourceSearch(e.target.value)} className="pl-9 w-48 h-9" /></div><Button variant="outline" size="sm" onClick={exportSources}><Download className="h-3.5 w-3.5 mr-1" /> Export {sourcesView === "domains" ? "Domains" : "URLs"}</Button>{(sourcesModelFilter.length > 0 || sourcesTypeFilter !== "all" || sourceSearch || sourcesGapView !== "all") && (<Button variant="ghost" size="sm" className="text-red-500 hover:text-red-700 hover:bg-red-50" onClick={() => { setSourcesModelFilter([]); setSourcesTypeFilter("all"); setSourceSearch(""); setSourcesGapView("all"); setSourcesPage(0); }}><X className="h-3.5 w-3.5 mr-1" /> Clear Filters</Button>)}</div></div>
        {sourcesGapView === "gap" && sourcesView === "domains" && (<div className="px-4 py-3 bg-orange-50 border-b border-orange-100"><p className="text-sm text-orange-700"><AlertTriangle className="h-4 w-4 inline mr-1" />These domains cite your competitors but not your brand.</p></div>)}
        {sourcesView === "domains" ? (
          <div className="max-h-[600px] overflow-y-auto">
            <table className="w-full relative">
              <thead className="bg-gray-50/80 backdrop-blur-sm border-b border-gray-200 sticky top-0 z-10">
                <tr>
                  <th className="text-left px-6 py-4 text-xs font-semibold text-gray-500 uppercase w-16">#</th>
                  <th className="text-left px-6 py-4 text-xs font-semibold text-gray-500 uppercase">
                    <div className="flex items-center gap-1.5 cursor-pointer hover:text-gray-900 group" title="The domain where AI models found this information">
                      <span>Source</span>
                      <ArrowUpDown className="h-3 w-3 text-gray-400 group-hover:text-gray-600" />
                    </div>
                  </th>
                  <th className="text-left px-6 py-4 text-xs font-semibold text-gray-500 uppercase">
                    <div className="flex items-center gap-1" title="Category of the source (UGC, Editorial, Wikipedia, etc.)">
                      <span>Type</span>
                      <Info className="h-3 w-3 text-gray-400" />
                    </div>
                  </th>
                  <th className="text-center px-6 py-4 text-xs font-semibold text-gray-500 uppercase">
                    <div className="flex items-center justify-center gap-1" title="Basic check for suspicious domains">
                      <span>Verified</span>
                      <Info className="h-3 w-3 text-gray-400" />
                    </div>
                  </th>
                  <th className="text-right px-6 py-4 text-xs font-semibold text-gray-500 uppercase">
                    <div className="flex items-center justify-end gap-1" title="Total number of times this domain was cited across all model responses">
                      <span>Citations</span>
                      <Info className="h-3 w-3 text-gray-400" />
                    </div>
                  </th>
                  <th className="text-right px-6 py-4 text-xs font-semibold text-gray-500 uppercase">
                    <div className="flex items-center justify-end gap-1" title="Number of unique prompts where this domain appeared">
                      <span>Prompts</span>
                      <Info className="h-3 w-3 text-gray-400" />
                    </div>
                  </th>
                  {sourcesGapView === "gap" && <th className="text-left px-6 py-4 text-xs font-semibold text-gray-500 uppercase">Competitors</th>}
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {(() => { const filtered = (displayedStats as typeof domainStats).filter(s => { const nc = normalizeCitationCategory(citationMeta?.[s.domain]?.category); const ft = (nc && nc !== 'other') ? nc : classifyDomain(s.domain, selectedClient?.brand_domain, selectedClient?.competitors, selectedClient?.brand_name); return sourcesTypeFilter === "all" || ft === sourcesTypeFilter; }); const totalPages = Math.ceil(filtered.length / SOURCES_PAGE_SIZE); const paginated = filtered.slice(sourcesPage * SOURCES_PAGE_SIZE, (sourcesPage + 1) * SOURCES_PAGE_SIZE); return paginated; })().map((s, i) => {
                  const nc = normalizeCitationCategory(citationMeta?.[s.domain]?.category); const type = (nc && nc !== 'other') ? nc : classifyDomain(s.domain, selectedClient?.brand_domain, selectedClient?.competitors, selectedClient?.brand_name);
                  const t = DOMAIN_TYPES[type] || DOMAIN_TYPES.other;
                  const isExpanded = expandedDomain === s.domain;
                  const domainCitations = allCitations.filter(c => c.domain === s.domain);
                  return (
                    <React.Fragment key={i}>
                      <tr
                        className={cn("hover:bg-gray-50 cursor-pointer transition-colors group", isExpanded && "bg-blue-50/50")}
                        onClick={() => setExpandedDomain(isExpanded ? null : s.domain)}
                      >
                        <td className="px-6 py-4 text-sm text-gray-400 font-mono">{i + 1}</td>
                        <td className="px-6 py-4">
                          <div className="flex items-center gap-3">
                            <div className="p-1 bg-white rounded border border-gray-100 shadow-sm">
                              <img src={`https://www.google.com/s2/favicons?domain=${s.domain}&sz=32`} alt="" className="h-5 w-5 rounded" onError={(e) => { (e.target as HTMLImageElement).src = 'data:image/svg+xml,<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="%23ccc"><circle cx="12" cy="12" r="10"/></svg>'; }} />
                            </div>
                            <div className="flex items-center gap-2">
                              <a href={`https://${s.domain}`} target="_blank" rel="noopener noreferrer" className="text-base font-semibold text-gray-900 hover:text-blue-600 hover:underline decoration-blue-300 underline-offset-2" onClick={(e) => e.stopPropagation()}>{s.domain}</a>
                              <ChevronRight className={cn("h-4 w-4 text-gray-400 transition-transform duration-200", isExpanded && "rotate-90 text-blue-500")} />
                            </div>
                          </div>
                        </td>
                        <td className="px-6 py-4">
                          {(() => {
                            const nc = normalizeCitationCategory(citationMeta?.[s.domain]?.category); const type = (nc && nc !== 'other') ? nc : classifyDomain(s.domain, selectedClient?.brand_domain, selectedClient?.competitors, selectedClient?.brand_name);
                            const t = DOMAIN_TYPES[type] || DOMAIN_TYPES.other;
                            return <span className={cn("px-2.5 py-1 rounded-full text-xs font-medium border", t.bg, t.color, "border-opacity-20")}>{t.label}</span>;
                          })()}
                        </td>
                        <td className="px-6 py-4 text-center">
                          {(() => {
                            const meta = citationMeta?.[s.domain];
                            const status = meta?.verification_status || 'pending';

                            if (status === 'verified') {
                              return (
                                <Badge variant="outline" className="bg-green-50 text-green-700 border-green-200 flex items-center gap-1 w-fit mx-auto">
                                  <CheckCircle className="h-3 w-3" />
                                  Verified
                                </Badge>
                              );
                            } else if (status === 'partially_verified') {
                              return (
                                <Badge variant="outline" className="bg-yellow-50 text-yellow-700 border-yellow-200 flex items-center gap-1 w-fit mx-auto">
                                  <AlertTriangle className="h-3 w-3" />
                                  Partial
                                </Badge>
                              );
                            } else if (status === 'hallucinated') {
                              return (
                                <Badge variant="destructive" className="bg-red-50 text-red-700 border-red-200 flex items-center gap-1 w-fit mx-auto">
                                  <X className="h-3 w-3" />
                                  Hallucinated
                                </Badge>
                              );
                            } else if (status === 'error') {
                              return (
                                <Badge variant="outline" className="bg-gray-50 text-gray-500 border-gray-200 flex items-center gap-1 w-fit mx-auto">
                                  <AlertTriangle className="h-3 w-3" />
                                  Error
                                </Badge>
                              );
                            } else {
                              return (
                                <Badge variant="outline" className="bg-gray-50 text-gray-500 border-gray-200 flex items-center gap-1 w-fit mx-auto">
                                  <Clock className="h-3 w-3" />
                                  Pending
                                </Badge>
                              );
                            }
                          })()}
                        </td>
                        <td className="px-6 py-4 text-right text-base font-medium text-gray-700">{s.count}</td>
                        <td className="px-6 py-4 text-right text-sm text-gray-500">{s.promptCount}</td>
                        {sourcesGapView === "gap" && (
                          <td className="px-6 py-4">
                            <div className="flex items-center gap-1.5 flex-wrap">
                              {((s as any).gapCompetitors || []).slice(0, 3).map((comp: string, j: number) => (
                                <span key={j} className="inline-flex items-center gap-1 px-2 py-1 bg-red-50 border border-red-200 rounded text-xs text-red-700 font-medium whitespace-nowrap"><Building2 className="h-3 w-3" />{comp}</span>
                              ))}
                              {((s as any).gapCompetitors || []).length > 3 && (
                                <DropdownMenu>
                                  <DropdownMenuTrigger asChild>
                                    <button onClick={(e) => e.stopPropagation()} className="text-xs text-gray-500 bg-gray-100 hover:bg-gray-200 px-2 py-1 rounded transition-colors cursor-pointer outline-none focus:ring-2 focus:ring-gray-200">
                                      +{(s as any).gapCompetitors.length - 3}
                                    </button>
                                  </DropdownMenuTrigger>
                                  <DropdownMenuContent onClick={(e) => e.stopPropagation()} align="start" className="w-48">
                                    <div className="px-2 py-1.5 text-xs font-semibold text-gray-500">Other Competitors</div>
                                    <DropdownMenuSeparator />
                                    {((s as any).gapCompetitors || []).slice(3).map((comp: string, k: number) => (
                                      <div key={k} className="px-2 py-1.5 text-sm flex items-center gap-2">
                                        <Building2 className="h-3.5 w-3.5 text-gray-400" />
                                        <span>{comp}</span>
                                      </div>
                                    ))}
                                  </DropdownMenuContent>
                                </DropdownMenu>
                              )}
                            </div>
                          </td>
                        )}
                      </tr>
                      {isExpanded && (
                        <tr className="bg-gray-50/50">
                          <td colSpan={sourcesGapView === "gap" ? 7 : 6} className="px-0 py-0 border-b border-gray-200">
                            <div className="p-6 bg-gray-50/50 space-y-6 animate-in slide-in-from-top-2 duration-200">
                              <div>
                                <div className="text-sm font-semibold text-gray-900 mb-3 flex items-center gap-2">
                                  <div className="p-1 bg-blue-100 rounded text-blue-600"><Link2 className="h-3.5 w-3.5" /></div>
                                  All Citations from {s.domain} ({domainCitations.length})
                                </div>
                                <div className="grid grid-cols-1 gap-2 max-h-80 overflow-y-auto pr-2">
                                  {domainCitations.length > 0 ? domainCitations.map((c, j) => (
                                    <div key={j} className="flex items-center gap-4 p-3 bg-white rounded-lg border border-gray-200 hover:border-blue-200 hover:shadow-sm transition-all group/card">
                                      <div className="flex-1 min-w-0">
                                        <div className="text-sm font-medium text-gray-900 truncate group-hover/card:text-blue-600 transition-colors">{c.title || c.url}</div>
                                        <div className="text-xs text-gray-500 truncate mt-0.5">{c.url}</div>
                                      </div>
                                      <span className="px-2.5 py-1 bg-gray-100 text-gray-600 text-xs font-semibold rounded-full border border-gray-200">{c.count}x</span>
                                      <a href={c.url} target="_blank" rel="noopener noreferrer" className="p-2 text-gray-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-colors" onClick={(e) => e.stopPropagation()}>
                                        <ExternalLink className="h-4 w-4" />
                                      </a>
                                    </div>
                                  )) : <p className="text-sm text-gray-500 italic">No individual URLs tracked for this domain</p>}
                                </div>
                              </div>
                              {s.prompts && s.prompts.length > 0 && (
                                <div>
                                  <div className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-3">Cited in prompts ({s.prompts.length})</div>
                                  <div className="flex flex-wrap gap-2">
                                    {s.prompts.map((prompt: any, j: number) => (
                                      <Badge key={j} variant="secondary" className={cn(
                                        "text-xs max-w-full bg-white border transition-colors px-2 py-1 flex items-center gap-1.5 h-auto whitespace-normal text-left",
                                        prompt.visible ? "border-green-200 hover:border-green-300 bg-green-50/30" : "border-gray-200 hover:border-blue-200 hover:bg-gray-50"
                                      )}>
                                        {prompt.visible ? (
                                          <CheckCircle className="h-3 w-3 text-green-600 flex-shrink-0" />
                                        ) : (
                                          <Circle className="h-3 w-3 text-gray-300 flex-shrink-0" />
                                        )}
                                        <span className={cn("truncate max-w-[300px]", prompt.visible ? "text-green-900" : "text-gray-700")}>{prompt.text}</span>
                                        {prompt.competitors && prompt.competitors.length > 0 && (
                                          <span className="flex items-center gap-1 ml-1 px-1.5 py-0.5 bg-orange-100 text-orange-700 rounded text-[10px] font-medium border border-orange-200" title={`Competitors mentioned: ${prompt.competitors.join(", ")}`}>
                                            <AlertTriangle className="h-3 w-3" />
                                            {prompt.competitors.length}
                                          </span>
                                        )}
                                      </Badge>
                                    ))}
                                  </div>
                                </div>
                              )}
                            </div>
                          </td>
                        </tr>
                      )}
                    </React.Fragment>
                  );
                })}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="max-h-[600px] overflow-y-auto">
            <table className="w-full relative">
              <thead className="bg-gray-50/80 backdrop-blur-sm border-b border-gray-200 sticky top-0 z-10">
                <tr>
                  <th className="text-left px-6 py-4 text-xs font-semibold text-gray-500 uppercase w-16">#</th>
                  <th className="text-left px-6 py-4 text-xs font-semibold text-gray-500 uppercase">
                    <div className="flex items-center gap-1 cursor-pointer hover:text-gray-900 group"><Link2 className="h-3 w-3 text-gray-400 group-hover:text-gray-600" /> URL <ArrowUpDown className="h-3 w-3 text-gray-400 group-hover:text-gray-600" /></div>
                  </th>
                  <th className="text-left px-6 py-4 text-xs font-semibold text-gray-500 uppercase w-48">Domain</th>
                  <th className="text-left px-6 py-4 text-xs font-semibold text-gray-500 uppercase w-32">Type</th>
                  <th className="text-center px-6 py-4 text-xs font-semibold text-gray-500 uppercase w-24">Verified</th>
                  <th className="text-center px-6 py-4 text-xs font-semibold text-gray-500 uppercase w-24">Count</th>
                  <th className="text-center px-6 py-4 text-xs font-semibold text-gray-500 uppercase w-20">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {filteredUrlCitations.filter(c => { const nc = normalizeCitationCategory(citationMeta?.[c.domain]?.category); const ft = (nc && nc !== 'other') ? nc : classifyDomain(c.domain, selectedClient?.brand_domain, selectedClient?.competitors); return sourcesTypeFilter === "all" || ft === sourcesTypeFilter; }).map((c, i) => {
                  const nc = normalizeCitationCategory(citationMeta?.[c.domain]?.category); const type = (nc && nc !== 'other') ? nc : classifyDomain(c.domain, selectedClient?.brand_domain, selectedClient?.competitors);
                  const t = DOMAIN_TYPES[type] || DOMAIN_TYPES.other;
                  return (
                    <tr
                      key={i}
                      className="hover:bg-gray-50 transition-colors group"
                    >
                      <td className="px-6 py-4 text-sm text-gray-400 font-mono">{i + 1}</td>
                      <td className="px-6 py-4">
                        <div className="flex items-center gap-3">
                          <img src={`https://www.google.com/s2/favicons?domain=${c.domain}&sz=16`} alt="" className="h-4 w-4 rounded opacity-70" />
                          <div className="min-w-0 max-w-lg">
                            <div className="text-sm font-medium text-gray-900 truncate group-hover:text-blue-600 transition-colors">{c.title || c.url}</div>
                            <div className="text-xs text-gray-500 truncate mt-0.5">{c.url}</div>
                          </div>
                        </div>
                      </td>
                      <td className="px-6 py-4 text-sm text-gray-600">{c.domain}</td>
                      <td className="px-6 py-4"><span className={cn("px-2.5 py-1 rounded-full text-xs font-medium border", t.bg, t.color, "border-opacity-20")}>{t.label}</span></td>
                      <td className="px-6 py-4 text-center">
                        {(() => {
                          try {
                            const domain = new URL(c.url).hostname.replace('www.', '');
                            const meta = citationMeta?.[domain];
                            const status = meta?.verification_status || 'pending';

                            if (status === 'verified') {
                              return (
                                <Badge variant="outline" className="bg-green-50 text-green-700 border-green-200 flex items-center gap-1 w-fit mx-auto">
                                  <CheckCircle className="h-3 w-3" />
                                  Verified
                                </Badge>
                              );
                            } else if (status === 'partially_verified') {
                              return (
                                <Badge variant="outline" className="bg-yellow-50 text-yellow-700 border-yellow-200 flex items-center gap-1 w-fit mx-auto">
                                  <AlertTriangle className="h-3 w-3" />
                                  Partial
                                </Badge>
                              );
                            } else if (status === 'hallucinated') {
                              return (
                                <Badge variant="destructive" className="bg-red-50 text-red-700 border-red-200 flex items-center gap-1 w-fit mx-auto">
                                  <X className="h-3 w-3" />
                                  Hallucinated
                                </Badge>
                              );
                            } else if (status === 'error') {
                              return (
                                <Badge variant="outline" className="bg-gray-50 text-gray-500 border-gray-200 flex items-center gap-1 w-fit mx-auto">
                                  <AlertTriangle className="h-3 w-3" />
                                  Error
                                </Badge>
                              );
                            } else {
                              return (
                                <Badge variant="outline" className="bg-gray-50 text-gray-500 border-gray-200 flex items-center gap-1 w-fit mx-auto">
                                  <Clock className="h-3 w-3" />
                                  Pending
                                </Badge>
                              );
                            }
                          } catch {
                            return <Badge variant="outline" className="bg-gray-50 text-gray-500 border-gray-200">Pending</Badge>;
                          }
                        })()}
                      </td>
                      <td className="px-6 py-4 text-center">
                        <span className="inline-flex items-center justify-center min-w-[32px] px-2 py-1 bg-blue-50 text-blue-700 text-sm font-bold rounded-full">{c.count}</span>
                      </td>
                      <td className="px-6 py-4 text-center">
                        <a href={c.url} target="_blank" rel="noopener noreferrer" className="inline-flex items-center justify-center p-2 text-gray-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-all" title="Open URL">
                          <ExternalLink className="h-4 w-4" />
                        </a>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
        {displayedStats.length === 0 && sourcesView === "domains" && (<div className="p-12 text-center"><Globe className="h-10 w-10 mx-auto mb-3 text-gray-300" /><p className="text-gray-500">{sourcesGapView === "gap" ? "No gap opportunities found" : "No source data yet. Run audits to collect data."}</p></div>)}
        {filteredUrlCitations.length === 0 && sourcesView === "urls" && (<div className="p-12 text-center"><Link2 className="h-10 w-10 mx-auto mb-3 text-gray-300" /><p className="text-gray-500">No URLs yet. Run audits to collect data.</p></div>)}
        {sourcesView === "urls" && filteredUrlCitations.length > 0 && <div className="p-3 text-center text-sm text-gray-500 border-t bg-gray-50">Showing all {filteredUrlCitations.length} URLs</div>}
        {sourcesView === "domains" && displayedStats.length > 0 && (() => {
          const filtered = (displayedStats as typeof domainStats).filter(s => { const nc = normalizeCitationCategory(citationMeta?.[s.domain]?.category); const ft = (nc && nc !== 'other') ? nc : classifyDomain(s.domain, selectedClient?.brand_domain, selectedClient?.competitors, selectedClient?.brand_name); return sourcesTypeFilter === "all" || ft === sourcesTypeFilter; });
          const totalPages = Math.ceil(filtered.length / SOURCES_PAGE_SIZE);
          return (
            <div className="p-3 flex items-center justify-between border-t bg-gray-50">
              <span className="text-sm text-gray-500">Showing {Math.min(sourcesPage * SOURCES_PAGE_SIZE + 1, filtered.length)}-{Math.min((sourcesPage + 1) * SOURCES_PAGE_SIZE, filtered.length)} of {filtered.length} domains</span>
              {totalPages > 1 && (
                <div className="flex items-center gap-2">
                  <Button variant="outline" size="sm" disabled={sourcesPage === 0} onClick={() => setSourcesPage(p => p - 1)}>Previous</Button>
                  <span className="text-sm text-gray-600">Page {sourcesPage + 1} of {totalPages}</span>
                  <Button variant="outline" size="sm" disabled={sourcesPage >= totalPages - 1} onClick={() => setSourcesPage(p => p + 1)}>Next</Button>
                </div>
              )}
            </div>
          );
        })()}

      </div>
    </div>
  );
};

export default SourcesTab;
