import React, { useRef, useState } from "react";
import { useVirtualizer } from "@tanstack/react-virtual";
import { cn } from "@/lib/utils";
import {
  Search,
  Plus,
  Trash2,
  Play,
  Archive,
  RotateCcw,
  Download,
  Settings,
  CheckCircle,
  X,
  ArrowUpDown,
  Loader2,
  FileText,
  Globe,
  Lightbulb,
  RefreshCw,
  Tag,
  MessageSquare,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { toast } from "sonner";

import type {
  Client,
  Prompt,
  AuditResult,
  PromptInsightRecommendation,
  PromptInsightResult,
} from "@/hooks/useClientDashboard";
import { computePositionForResult } from "@/utils/dashboardHelpers";
import { brandMentionedInText, brandNamesMatch } from "@/utils/brandMatching";

export interface PromptsTabProps {
  prompts: Prompt[];
  auditResults: AuditResult[];
  filteredPrompts: Prompt[];
  selectedClient: Client | null;
  isAdmin: boolean;
  isAgency: boolean;
  loading: boolean;
  loadingPromptIds: Set<string>;

  // Selection
  selectedPromptIds: Set<string>;
  setSelectedPromptIds: React.Dispatch<React.SetStateAction<Set<string>>>;

  // Tab view
  promptsTabView: "active" | "suggested" | "inactive";
  setPromptsTabView: React.Dispatch<
    React.SetStateAction<"active" | "suggested" | "inactive">
  >;

  // Filters
  promptsFilterVisibility: "all" | "visible" | "not_visible";
  setPromptsFilterVisibility: React.Dispatch<
    React.SetStateAction<"all" | "visible" | "not_visible">
  >;
  promptsFilterCompetitor: string;
  setPromptsFilterCompetitor: React.Dispatch<React.SetStateAction<string>>;

  // Sort
  promptSortField: string | null;
  setPromptSortField: React.Dispatch<React.SetStateAction<string | null>>;

  // Search
  searchQuery: string;
  setSearchQuery: React.Dispatch<React.SetStateAction<string>>;

  // Inline topic editing
  inlineEditTopicId: string | null;
  setInlineEditTopicId: React.Dispatch<React.SetStateAction<string | null>>;
  inlineEditTopicValue: string;
  setInlineEditTopicValue: React.Dispatch<React.SetStateAction<string>>;

  // Dialogs / detail
  setSelectedPromptDetail: React.Dispatch<React.SetStateAction<string | null>>;
  setBulkPromptsOpen: React.Dispatch<React.SetStateAction<boolean>>;

  // Edit prompt dialog
  setEditingPromptId: React.Dispatch<React.SetStateAction<string | null>>;
  setEditingPromptText: React.Dispatch<React.SetStateAction<string>>;
  setEditingPromptTopic: React.Dispatch<React.SetStateAction<string>>;
  setEditPromptOpen: React.Dispatch<React.SetStateAction<boolean>>;

  // Edit location dialog
  setEditingLocationPromptId: React.Dispatch<
    React.SetStateAction<string | null>
  >;
  setEditingLocationValue: React.Dispatch<React.SetStateAction<string>>;
  setEditLocationOpen: React.Dispatch<React.SetStateAction<boolean>>;

  // Actions from useClientDashboard
  runSinglePrompt: (promptId: string) => Promise<void>;
  bulkArchivePrompts: (ids: string[]) => Promise<void>;
  bulkDeletePrompts: (ids: string[]) => Promise<void>;
  reactivatePrompt: (promptId: string) => Promise<void>;
  updatePrompt: (
    promptId: string,
    updates: Partial<Prompt>
  ) => Promise<void>;
  getAIOpportunity: (promptId: string) => { tier: string; color: string; score: number; demandDataAvailable: boolean };

  // Prompt result lookup
  getPromptResult: (promptId: string) => AuditResult | undefined;

  // Tavily results (keyed by prompt id)
  tavilyResults: Record<string, any>;

  // Recommendations modal
  recsModalOpen: boolean;
  setRecsModalOpen: React.Dispatch<React.SetStateAction<boolean>>;
  recsModalPromptId: string | null;
  setRecsModalPromptId: React.Dispatch<React.SetStateAction<string | null>>;
  recsModalLoading: boolean;
  setRecsModalLoading: React.Dispatch<React.SetStateAction<boolean>>;
  recsModalData: PromptInsightRecommendation[] | null;
  setRecsModalData: React.Dispatch<
    React.SetStateAction<PromptInsightRecommendation[] | null>
  >;
  generateRecommendations: (
    promptText: string,
    auditResult: AuditResult | null,
    tavilyData: any,
    completedRecommendations?: string[]
  ) => Promise<PromptInsightResult | null>;

  // Bulk run progress
  bulkRunProgress: { current: number; total: number } | null;
  setBulkRunProgress: React.Dispatch<
    React.SetStateAction<{ current: number; total: number } | null>
  >;

  // Export functions
  exportToCSV: () => void;
  exportModelResponsesToCSV: () => void;
}

export const PromptsTab: React.FC<PromptsTabProps> = ({
  prompts,
  auditResults,
  filteredPrompts,
  selectedClient,
  isAdmin,
  isAgency,
  loading: _loading,
  loadingPromptIds,
  selectedPromptIds,
  setSelectedPromptIds,
  promptsTabView,
  setPromptsTabView,
  promptsFilterVisibility,
  setPromptsFilterVisibility,
  promptsFilterCompetitor,
  setPromptsFilterCompetitor,
  promptSortField: _promptSortField,
  setPromptSortField,
  searchQuery,
  setSearchQuery,
  inlineEditTopicId,
  setInlineEditTopicId,
  inlineEditTopicValue,
  setInlineEditTopicValue,
  setSelectedPromptDetail,
  setBulkPromptsOpen,
  setEditingPromptId,
  setEditingPromptText,
  setEditingPromptTopic,
  setEditPromptOpen,
  setEditingLocationPromptId,
  setEditingLocationValue,
  setEditLocationOpen,
  runSinglePrompt,
  bulkArchivePrompts,
  bulkDeletePrompts,
  reactivatePrompt,
  updatePrompt,
  getAIOpportunity,
  getPromptResult,
  tavilyResults,
  recsModalOpen,
  setRecsModalOpen,
  recsModalPromptId,
  setRecsModalPromptId,
  recsModalLoading,
  setRecsModalLoading,
  recsModalData,
  setRecsModalData,
  generateRecommendations,
  bulkRunProgress,
  setBulkRunProgress,
  exportToCSV,
  exportModelResponsesToCSV,
}) => {
  const activeCount = prompts.filter((p) => p.is_active !== false).length;
  const runPromptIds = new Set(auditResults.map((r) => r.prompt_id));
  const suggestedCount = prompts.filter(
    (p) => p.is_active !== false && !runPromptIds.has(p.id)
  ).length;
  const inactiveCount = prompts.filter((p) => p.is_active === false).length;
  const isInactiveView = promptsTabView === "inactive";

  // Virtualization
  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const rowVirtualizer = useVirtualizer({
    count: filteredPrompts.length,
    getScrollElement: () => scrollContainerRef.current,
    estimateSize: () => 52,
    overscan: 10,
  });

  // Bulk topic assignment
  const [bulkTopicMode, setBulkTopicMode] = useState(false);
  const [bulkTopicValue, setBulkTopicValue] = useState("");

  return (
    <div className="space-y-4">

      {/* Header with Tabs */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="flex items-center gap-3 overflow-x-auto pb-1 md:pb-0">
          <div className="flex items-center bg-gray-100 rounded-lg p-1">
            <button onClick={() => setPromptsTabView("active")} className={cn("px-4 py-2 rounded-md text-sm font-medium transition-all", promptsTabView === "active" ? "bg-white shadow-sm text-gray-900" : "text-gray-500 hover:text-gray-700")}>
              <span className="flex items-center gap-2">Active <span className={cn("px-1.5 py-0.5 rounded text-xs", promptsTabView === "active" ? "bg-green-100 text-green-700" : "bg-gray-200 text-gray-500")}>{activeCount}</span></span>
            </button>
            <button onClick={() => setPromptsTabView("suggested")} className={cn("px-4 py-2 rounded-md text-sm font-medium transition-all", promptsTabView === "suggested" ? "bg-white shadow-sm text-gray-900" : "text-gray-500 hover:text-gray-700")}>
              <span className="flex items-center gap-2">Pending <span className={cn("px-1.5 py-0.5 rounded text-xs", suggestedCount > 0 ? "bg-orange-100 text-orange-600" : "bg-gray-200 text-gray-500")}>{suggestedCount}</span></span>
            </button>
            <button onClick={() => setPromptsTabView("inactive")} className={cn("px-4 py-2 rounded-md text-sm font-medium transition-all", promptsTabView === "inactive" ? "bg-white shadow-sm text-gray-900" : "text-gray-500 hover:text-gray-700")}>
              <span className="flex items-center gap-2"><Archive className="h-3.5 w-3.5" /> Archived <span className="px-1.5 py-0.5 rounded text-xs bg-gray-200 text-gray-500">{inactiveCount}</span></span>
            </button>
          </div>
        </div>

        <div className="flex items-center gap-3">
          {/* Filters - All Models filter removed per user request */}            <Select value={promptsFilterCompetitor} onValueChange={setPromptsFilterCompetitor}>
            <SelectTrigger className="w-[130px] h-9 text-xs bg-white border-gray-200">
              <SelectValue placeholder="Competitor" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Competitors</SelectItem>
              {selectedClient?.competitors.map((c: string) => (
                <SelectItem key={c} value={c}>{c}</SelectItem>
              ))}
            </SelectContent>
          </Select>

          <Select value={promptsFilterVisibility} onValueChange={(v: any) => setPromptsFilterVisibility(v)}>
            <SelectTrigger className="w-[130px] h-9 text-xs bg-white border-gray-200">
              <SelectValue placeholder="Visibility" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Any Visibility</SelectItem>
              <SelectItem value="visible">Visible Only</SelectItem>
              <SelectItem value="not_visible">Not Visible</SelectItem>
            </SelectContent>
          </Select>

          {/* Run Topic button removed */}
          {isAdmin ? (
            <span className="text-sm text-gray-500 hidden sm:inline"> {prompts.length} total prompts</span>
          ) : (
            <span className={cn("text-xs font-medium px-2 py-1 rounded-md border", prompts.length >= (isAgency ? 15 : 200) ? "text-red-600 bg-red-50 border-red-100" : "text-gray-600 bg-gray-50 border-gray-200")}>{prompts.length}/{isAgency ? 15 : 200} Prompts</span>
          )}
          <Button onClick={() => setBulkPromptsOpen(true)} className="bg-gray-900 hover:bg-gray-800 whitespace-nowrap" disabled={!isAdmin && prompts.length >= (isAgency ? 15 : 200)}><Plus className="h-4 w-4 mr-1" /> Add Prompt</Button>
        </div>
      </div>

      {/* Info banner for archived view */}
      {
        isInactiveView && inactiveCount > 0 && (
          <div className="bg-amber-50 border border-amber-200 rounded-lg p-4 flex items-start gap-3">
            <div className="p-2 bg-amber-100 rounded-lg"><Archive className="h-5 w-5 text-amber-600" /></div>
            <div>
              <h4 className="font-medium text-amber-900">Archived Prompts</h4>
              <p className="text-sm text-amber-700 mt-0.5">These prompts are archived but their data is preserved. You can restore them anytime by clicking the restore button.</p>
            </div>
          </div>
        )
      }

      {/* Search & Export */}
      <div className="flex items-center justify-between gap-3 bg-white p-3 rounded-xl border border-gray-200 shadow-sm">
        <div className="relative flex-1 max-w-md">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
          <Input placeholder="Search prompts..." value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} className="pl-9 bg-gray-50 border-transparent hover:bg-gray-100 focus:bg-white focus:ring-2 focus:ring-blue-500 transition-colors" />
        </div>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="outline" className="bg-white border-gray-200 hover:bg-gray-50 text-gray-700 font-medium shadow-sm transition-all duration-200">
              <Download className="h-4 w-4 mr-2 text-gray-500" /> Export Data
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-56">
            <DropdownMenuItem onClick={exportToCSV} className="cursor-pointer">
              <FileText className="h-4 w-4 mr-2 text-gray-400" /> Export Summary (CSV)
            </DropdownMenuItem>
            <DropdownMenuItem onClick={exportModelResponsesToCSV} className="cursor-pointer">
              <FileText className="h-4 w-4 mr-2 text-blue-500" /> Export Raw Responses (CSV)
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>

      {/* Table */}
      <div ref={scrollContainerRef} className={cn("bg-white rounded-xl border border-gray-200 overflow-hidden shadow-sm overflow-x-auto max-h-[600px] overflow-y-auto", selectedPromptIds.size > 0 && "pb-16")}>
        <table className="w-full">
          <thead className="bg-gray-50/80 backdrop-blur-sm border-b border-gray-200 sticky top-0 z-10">
            <tr className="flex w-full">
              <th className="w-10 flex-none px-3 py-3 text-left" title="Select prompts for bulk actions"><Checkbox checked={selectedPromptIds.size === filteredPrompts.length && filteredPrompts.length > 0} onCheckedChange={(checked) => { if (checked) { setSelectedPromptIds(new Set(filteredPrompts.map(p => p.id))); } else { setSelectedPromptIds(new Set()); } }} /></th>
              <th className="flex-1 min-w-0 px-3 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider" title="The question you want AI models to answer">
                <div className="flex items-center gap-1 cursor-pointer hover:text-gray-900 group">Prompt <ArrowUpDown className="h-3 w-3 text-gray-400 group-hover:text-gray-600" /></div>
              </th>
              <th className="w-28 flex-none px-3 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider" title="Topic / seed keyword this prompt belongs to">Topic</th>
              <th className="w-32 flex-none px-3 py-3 text-center text-xs font-semibold text-gray-500 uppercase tracking-wider cursor-pointer hover:text-gray-900 group" title="AI Opportunity reflects the relative strategic upside of improving visibility for this prompt in AI-generated answers." onClick={() => { setPromptSortField(prev => prev === 'ai_opportunity' ? null : 'ai_opportunity'); }}><div className="flex items-center justify-center gap-1">AI Opportunity <ArrowUpDown className="h-3 w-3 text-gray-400 group-hover:text-gray-600" /></div></th>
              <th className="w-20 flex-none px-3 py-3 text-center text-xs font-semibold text-gray-500 uppercase tracking-wider" title="How many AI models mentioned your brand vs total models tested">Visibility</th>
              <th className="w-20 flex-none px-3 py-3 text-center text-xs font-semibold text-gray-500 uppercase tracking-wider" title="Your brand's average position in AI-generated ranked lists (#1 is best)">Position</th>
              <th className="w-36 flex-none px-3 py-3 text-center text-xs font-semibold text-gray-500 uppercase tracking-wider" title="Other brands that AI mentioned alongside or instead of yours">Brands</th>
              <th className="w-20 flex-none px-3 py-3 text-center text-xs font-semibold text-gray-500 uppercase tracking-wider" title="Number of web sources the AI referenced in its response">Citations</th>
              <th className="w-36 flex-none px-3 py-3 text-center text-xs font-semibold text-gray-500 uppercase tracking-wider" title="AI-generated suggestions to improve your visibility">Recommendations</th>
              {isAdmin && <th className="w-16 flex-none px-3 py-3 text-center text-xs font-semibold text-gray-500 uppercase tracking-wider" title="Run audits, edit, or archive prompts">Actions</th>}
            </tr>
          </thead>
          <tbody
            className="relative"
            style={{ height: `${rowVirtualizer.getTotalSize()}px` }}
          >
            {rowVirtualizer.getVirtualItems().map((virtualRow) => {
              const p = filteredPrompts[virtualRow.index];
              const r = getPromptResult(p.id);
              const isLoading = loadingPromptIds.has(p.id);
              // Visibility: use backend brand_mentioned OR client-side normalized matching (catches brand_tags aliases)
              const visibleCount = r?.model_results.filter(mr => {
                if (mr.brand_mentioned) return true;
                // Client-side fallback: check brand_tags and normalized name matching
                if (selectedClient && mr.raw_response) {
                  return brandMentionedInText(mr.raw_response, selectedClient.brand_name, selectedClient.brand_tags);
                }
                return false;
              }).length || 0;
              const totalCount = r?.model_results.length || 0;
              // Calculate position using shared helper (same logic as overview card)
              const pos = computePositionForResult(r, selectedClient);
              const cit = r?.summary.total_citations || 0;
              const isInactive = p.is_active === false;

              return (
                <tr
                  key={p.id}
                  data-index={virtualRow.index}
                  ref={rowVirtualizer.measureElement}
                  className={cn("hover:bg-gray-50 transition-colors group border-b border-gray-50 last:border-0 absolute w-full flex items-center", isInactive && "opacity-60")}
                  style={{
                    top: 0,
                    transform: `translateY(${virtualRow.start}px)`,
                  }}
                >
                  <td className="w-10 flex-none px-3 py-3"><Checkbox checked={selectedPromptIds.has(p.id)} onCheckedChange={(checked) => { const newSet = new Set(selectedPromptIds); if (checked) { newSet.add(p.id); } else { newSet.delete(p.id); } setSelectedPromptIds(newSet); }} /></td>
                  <td className="flex-1 min-w-0 px-3 py-3">
                    <div className="flex items-center gap-2 min-w-0">
                      {isInactive && <Archive className="h-4 w-4 text-gray-400 flex-shrink-0" />}
                      <span
                        onClick={(e) => {
                          e.stopPropagation();
                          if (isAdmin || r) {
                            setSelectedPromptDetail(p.id);
                          }
                        }}
                        className={cn(
                          "text-sm font-medium transition-colors truncate",
                          (isAdmin || r) ? "cursor-pointer hover:text-blue-600 hover:underline underline-offset-2 text-gray-900" : "cursor-default text-gray-400",
                          isInactive && "text-gray-500"
                        )}
                        title={p.prompt_text}
                      >
                        {p.prompt_text}
                      </span>
                      {p.niche_level && <Badge variant="outline" className="text-[10px] px-1.5 py-0.5 uppercase tracking-wide flex-shrink-0 bg-gray-50 text-gray-600 border-gray-200">{p.niche_level === "super_niche" ? "Super Niche" : p.niche_level === "niche" ? "Niche" : "Broad"}</Badge>}
                      {p.location_name && <Badge variant="outline" className="text-[10px] px-1.5 py-0.5 flex-shrink-0 bg-blue-50 text-blue-600 border-blue-200 flex items-center gap-1"><Globe className="h-2.5 w-2.5" />{p.location_name}</Badge>}
                    </div>
                  </td>
                  <td className="w-28 flex-none px-3 py-3">
                    {inlineEditTopicId === p.id ? (
                      <input
                        autoFocus
                        type="text"
                        value={inlineEditTopicValue}
                        onChange={(e) => setInlineEditTopicValue(e.target.value)}
                        onBlur={async () => {
                          const newTopic = inlineEditTopicValue.trim();
                          if (newTopic !== (p.topic || "")) {
                            try {
                              await updatePrompt(p.id, { topic: newTopic || "" });
                            } catch (err: any) {
                              console.error("Failed to update topic:", err);
                            }
                          }
                          setInlineEditTopicId(null);
                        }}
                        onKeyDown={async (e) => {
                          if (e.key === "Enter") {
                            e.preventDefault();
                            (e.target as HTMLInputElement).blur();
                          }
                          if (e.key === "Escape") {
                            setInlineEditTopicId(null);
                          }
                        }}
                        className="w-full text-xs px-2 py-1 border border-violet-300 rounded-md focus:outline-none focus:ring-2 focus:ring-violet-400 bg-white"
                        placeholder="Enter topic..."
                      />
                    ) : (
                      <span
                        onClick={(e) => {
                          e.stopPropagation();
                          setInlineEditTopicId(p.id);
                          setInlineEditTopicValue(p.topic || "");
                        }}
                        className="cursor-pointer group/topic"
                        title="Click to edit topic"
                      >
                        {p.topic ? (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-violet-50 text-violet-700 border border-violet-200 text-xs font-medium truncate max-w-[120px] group-hover/topic:border-violet-400 transition-colors">
                            <Tag className="h-2.5 w-2.5 flex-shrink-0" />{p.topic}
                          </span>
                        ) : <span className="text-gray-300 text-xs hover:text-violet-400 transition-colors">+ Add topic</span>}
                      </span>
                    )}
                  </td>
                  <td className="w-32 flex-none px-3 py-3 text-center">
                    {(() => {
                      const op = getAIOpportunity(p.id);
                      return (
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-semibold" style={{ backgroundColor: op.color + '18', color: op.color, border: `1px solid ${op.color}40` }} title={!op.demandDataAvailable ? "Search volume data pending — score may change once fetched" : `AI Opportunity score: ${op.score}`}>
                          {op.tier}
                          {!op.demandDataAvailable && <span className="opacity-60" title="Search volume data not yet available">~</span>}
                        </span>
                      );
                    })()}
                  </td>
                  <td className="w-20 flex-none px-3 py-3 text-center overflow-hidden">
                    <span className={cn("text-sm font-medium", visibleCount > 0 ? "text-gray-900" : "text-gray-400")}>
                      {r ? `${visibleCount}/${totalCount}` : "\u2014"}
                    </span>
                  </td>
                  <td className="w-20 flex-none px-3 py-3 text-center overflow-hidden font-medium text-sm"><span className={pos ? "text-blue-600" : "text-gray-400"}>{pos ? `#${typeof pos === 'number' ? pos.toFixed(1) : pos}` : "\u2014"}</span></td>
                  <td className="w-36 flex-none px-3 py-3 overflow-hidden">
                    <div className="flex items-center justify-center gap-1">
                      {(() => {
                        // Extract brands mentioned in responses
                        // Non-admin: only tracked competitor brands
                        // Admin: all detected brands (competitors + extracted entities)
                        if (!r) return <span className="text-xs text-gray-400 italic">Not run</span>;

                        const trackedBrands = new Set<string>();
                        const brandName = selectedClient?.brand_name || '';
                        const brandTags = selectedClient?.brand_tags || [];
                        const competitors = selectedClient?.competitors || [];

                        // Check all model responses for tracked brand/competitor mentions
                        r.model_results.forEach(mr => {
                          const response = (mr.raw_response || '');
                          // Own brand: check brand_name + brand_tags with normalized matching
                          if (brandName && brandMentionedInText(response, brandName, brandTags)) {
                            trackedBrands.add(brandName);
                          }
                          // Competitors: use normalized matching so "monday.com" matches "Monday CRM" etc.
                          competitors.forEach(comp => {
                            if (brandMentionedInText(response, comp)) {
                              trackedBrands.add(comp);
                            }
                          });
                          // Also check competitors_found from backend (already matched by geo-audit)
                          (mr.competitors_found || []).forEach(cf => {
                            if (cf.count > 0) {
                              // Map back to the original competitor name
                              const matchedComp = competitors.find(c => brandNamesMatch(c, cf.name));
                              trackedBrands.add(matchedComp || cf.name);
                            }
                          });
                        });

                        // Admin: also include extracted brand entities from DataForSEO
                        if (isAdmin) {
                          r.model_results.forEach(mr => {
                            (mr.extracted_brands || []).forEach(eb => {
                              if (!eb.is_own_brand) {
                                // Check if this extracted brand matches any configured competitor
                                const matchedComp = competitors.find(c => brandNamesMatch(c, eb.title));
                                trackedBrands.add(matchedComp || eb.title);
                              }
                            });
                          });
                        }

                        // Non-admin: only show competitor brands (exclude own brand)
                        const brandsArray = isAdmin
                          ? Array.from(trackedBrands)
                          : Array.from(trackedBrands).filter(b => competitors.some(c => brandNamesMatch(c, b)));
                        if (brandsArray.length === 0) {
                          return <span className="text-xs text-gray-400 italic">None</span>;
                        }

                        const displayBrands = brandsArray.slice(0, 5);
                        const overflowCount = brandsArray.length - displayBrands.length;

                        return (
                          <div className="flex items-center gap-1">
                            {displayBrands.map((brand, idx) => {
                              const isUserBrand = brandNamesMatch(brand, brandName) || brandTags.some(t => brandNamesMatch(brand, t));
                              const domain = `${brand.toLowerCase().replace(/[^a-z0-9]/g, '')}.com`;
                              return (
                                <div
                                  key={idx}
                                  title={brand}
                                  className={cn(
                                    "flex-none flex items-center justify-center h-6 w-6 rounded-md border transition-all hover:scale-110",
                                    isUserBrand
                                      ? "bg-green-50 border-green-200 shadow-sm ring-1 ring-green-100"
                                      : "bg-white border-gray-200 shadow-sm"
                                  )}
                                >
                                  <img
                                    src={`https://www.google.com/s2/favicons?domain=${domain}&sz=32`}
                                    alt={brand}
                                    className="h-3.5 w-3.5 rounded-sm"
                                    onError={(e) => {
                                      e.currentTarget.style.display = 'none';
                                      e.currentTarget.parentElement!.innerText = brand.charAt(0).toUpperCase();
                                      e.currentTarget.parentElement!.className += " text-[10px] font-bold text-gray-500 uppercase";
                                    }}
                                  />
                                </div>
                              );
                            })}
                            {overflowCount > 0 && (
                              <div className="flex-none h-6 min-w-[24px] rounded-md bg-gray-50 border border-gray-200 flex items-center justify-center text-[10px] font-bold text-gray-500 shadow-sm px-1">
                                +{overflowCount}
                              </div>
                            )}
                          </div>
                        );
                      })()}
                    </div>
                  </td>
                  <td className="w-20 flex-none px-3 py-3 text-center">{cit > 0 ? <Badge variant="secondary" className="bg-blue-50 text-blue-700 hover:bg-blue-100 border border-blue-200 text-xs">{cit}</Badge> : <span className="text-gray-300">{"\u2014"}</span>}</td>
                  {/* Recommendations Button */}
                  <td className="w-36 flex-none px-3 py-3 text-center">
                    {r ? (
                      <Button
                        variant="outline"
                        size="sm"
                        disabled={recsModalLoading && recsModalPromptId === p.id}
                        onClick={async () => {
                          // Open recommendations modal
                          setRecsModalPromptId(p.id);
                          setRecsModalOpen(true);
                          setRecsModalLoading(true);
                          setRecsModalData(null);

                          // Generate ACTUAL recommendations based on model results and Tavily data
                          const result = getPromptResult(p.id);
                          if (result) {
                            try {
                              const tData = tavilyResults[p.id];
                              const recs = await generateRecommendations(
                                p.prompt_text,
                                result,
                                tData
                              );
                              if (recs && recs.recommendations) {
                                setRecsModalData(recs.recommendations);
                              } else {
                                setRecsModalData([]);
                              }
                            } catch (err) {
                              console.error("Error generating recommendations:", err);
                              setRecsModalData([]);
                            }
                          } else {
                            // If no result yet, show empty or handle
                            setRecsModalData([]);
                          }
                          setRecsModalLoading(false);
                        }}
                        className="h-7 px-3 text-xs font-medium text-blue-600 border-blue-200 hover:bg-blue-50 hover:border-blue-300 flex items-center gap-1.5"
                      >
                        {recsModalLoading && recsModalPromptId === p.id ? (
                          <Loader2 className="h-3.5 w-3.5 animate-spin" />
                        ) : (
                          <Lightbulb className="h-3.5 w-3.5" />
                        )}
                        Recommendations
                      </Button>
                    ) : (
                      <span className="text-gray-300">{"\u2014"}</span>
                    )}
                  </td>
                  {isAdmin && (
                    <td className="w-16 flex-none px-3 py-3">
                      <div className="flex items-center justify-center gap-1">
                        {isInactive ? (
                          <>
                            <Button variant="ghost" size="sm" onClick={() => reactivatePrompt(p.id)} className="h-7 px-2 text-green-600 hover:text-green-700 hover:bg-green-50" title="Restore prompt">
                              <RotateCcw className="h-3.5 w-3.5" />
                            </Button>
                          </>
                        ) : (
                          <>
                            <Button variant="ghost" size="sm" onClick={() => runSinglePrompt(p.id)} disabled={isLoading} className="h-7 px-2 text-gray-500 hover:text-blue-600" title="Run audit">
                              <Loader2 className={cn("h-3.5 w-3.5", isLoading && "animate-spin")} />
                              {!isLoading && <RefreshCw className="h-3.5 w-3.5" />}
                            </Button>
                          </>
                        )}
                      </div>
                    </td>
                  )}
                </tr>
              );
            })}
          </tbody>
        </table>
        {filteredPrompts.length === 0 && (
          <div className="p-16 text-center">
            {promptsTabView === "suggested" ? (
              <>
                <CheckCircle className="h-12 w-12 mx-auto mb-4 text-green-300" />
                <p className="text-gray-600 font-medium">All prompts have been run!</p>
                <p className="text-sm text-gray-500 mt-1">Great job keeping up with your audits.</p>
              </>
            ) : promptsTabView === "inactive" ? (
              <>
                <Archive className="h-12 w-12 mx-auto mb-4 text-gray-300" />
                <p className="text-gray-600 font-medium">No archived prompts</p>
                <p className="text-sm text-gray-500 mt-1">Archived prompts will appear here. Their data is preserved for tracking.</p>
              </>
            ) : (
              <>
                <MessageSquare className="h-12 w-12 mx-auto mb-4 text-gray-300" />
                <p className="text-gray-600 font-medium">No prompts yet</p>
                <p className="text-sm text-gray-500 mt-1">Add your first prompt to get started with audits.</p>
                <Button onClick={() => setBulkPromptsOpen(true)} className="mt-4" disabled={!isAdmin && prompts.length >= (isAgency ? 15 : 200)}><Plus className="h-4 w-4 mr-1" /> Add Prompt</Button>
                {!isAdmin && prompts.length >= (isAgency ? 15 : 200) && <p className="text-xs text-red-500 mt-2">{isAgency ? 'Agency' : 'Free'} prompt limit reached ({isAgency ? '15/15' : '200/200'})</p>}
              </>
            )}
          </div>
        )}
      </div>

      {/* Floating Action Bar for Bulk Operations */}
      {selectedPromptIds.size > 0 && (
        <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-50 bg-gray-900 text-white rounded-xl shadow-2xl px-6 py-3 flex items-center gap-4 animate-in slide-in-from-bottom-4">
          {bulkRunProgress ? (
            <div className="flex items-center gap-4 min-w-[300px]">
              <span className="text-sm font-medium whitespace-nowrap text-blue-200">Running...</span>
              <div className="flex-1 h-2 bg-gray-700 rounded-full overflow-hidden">
                <div className="h-full bg-blue-500 transition-all duration-300" style={{ width: `${(bulkRunProgress.current / bulkRunProgress.total) * 100}%` }}></div>
              </div>
              <span className="text-sm font-medium whitespace-nowrap">{bulkRunProgress.current} / {bulkRunProgress.total}</span>
            </div>
          ) : (
            <>
              <span className="text-sm font-medium">{selectedPromptIds.size} selected</span>
              <div className="h-4 w-px bg-gray-600" />

              {/* Run Audit Button */}
              {isAdmin && (
                <>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={async () => {
                      if (selectedPromptIds.size === 0) return;
                      const idsToRun = Array.from(selectedPromptIds);
                      setBulkRunProgress({ current: 0, total: idsToRun.length });

                      for (let i = 0; i < idsToRun.length; i++) {
                        try {
                          await runSinglePrompt(idsToRun[i]);
                        } catch (e) {
                          console.error("Run error", e);
                        }
                        setBulkRunProgress({ current: i + 1, total: idsToRun.length });
                      }

                      setBulkRunProgress(null);
                      setSelectedPromptIds(new Set());
                      toast.success(`Completed ${idsToRun.length} audits`);
                    }}
                    className="text-green-400 hover:text-green-300 hover:bg-gray-800"
                  >
                    <Play className="h-4 w-4 mr-1.5" />
                    Run Audit
                  </Button>
                  <div className="h-4 w-px bg-gray-600" />
                </>
              )}

              {selectedPromptIds.size === 1 && (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => {
                    const promptId = Array.from(selectedPromptIds)[0];
                    const prompt = prompts.find(pr => pr.id === promptId);
                    if (prompt) {
                      setEditingPromptId(promptId);
                      setEditingPromptText(prompt.prompt_text);
                      setEditingPromptTopic(prompt.topic || "");
                      setEditPromptOpen(true);
                      setSelectedPromptIds(new Set());
                    }
                  }}
                  className="text-white hover:bg-gray-700"
                >
                  <Settings className="h-4 w-4 mr-1.5" />
                  Edit
                </Button>
              )}
              {selectedPromptIds.size === 1 && (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => {
                    const promptId = Array.from(selectedPromptIds)[0];
                    const prompt = prompts.find(pr => pr.id === promptId);
                    if (prompt) {
                      setEditingLocationPromptId(promptId);
                      setEditingLocationValue(prompt.location_name || "");
                      setEditLocationOpen(true);
                    }
                  }}
                  className="text-white hover:bg-gray-700"
                >
                  <Globe className="h-4 w-4 mr-1.5" />
                  Location
                </Button>
              )}
              {/* Bulk Set Topic */}
              {bulkTopicMode ? (
                <div className="flex items-center gap-2">
                  <input
                    autoFocus
                    type="text"
                    value={bulkTopicValue}
                    onChange={(e) => setBulkTopicValue(e.target.value)}
                    onKeyDown={async (e) => {
                      if (e.key === "Enter") {
                        e.preventDefault();
                        const topic = bulkTopicValue.trim();
                        const ids = Array.from(selectedPromptIds);
                        try {
                          await Promise.all(ids.map(id => updatePrompt(id, { topic: topic || "" })));
                          toast.success(`Set topic "${topic || '(cleared)'}" on ${ids.length} prompt${ids.length > 1 ? 's' : ''}`);
                        } catch (err) {
                          console.error("Bulk topic update failed:", err);
                          toast.error("Failed to update topics");
                        }
                        setBulkTopicMode(false);
                        setBulkTopicValue("");
                        setSelectedPromptIds(new Set());
                      }
                      if (e.key === "Escape") {
                        setBulkTopicMode(false);
                        setBulkTopicValue("");
                      }
                    }}
                    className="w-32 px-2 py-1 text-sm rounded-md bg-gray-800 border border-gray-600 text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-violet-400"
                    placeholder="Enter topic..."
                  />
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={async () => {
                      const topic = bulkTopicValue.trim();
                      const ids = Array.from(selectedPromptIds);
                      try {
                        await Promise.all(ids.map(id => updatePrompt(id, { topic: topic || "" })));
                        toast.success(`Set topic "${topic || '(cleared)'}" on ${ids.length} prompt${ids.length > 1 ? 's' : ''}`);
                      } catch (err) {
                        console.error("Bulk topic update failed:", err);
                        toast.error("Failed to update topics");
                      }
                      setBulkTopicMode(false);
                      setBulkTopicValue("");
                      setSelectedPromptIds(new Set());
                    }}
                    className="text-violet-400 hover:text-violet-300 hover:bg-gray-800"
                  >
                    <CheckCircle className="h-4 w-4" />
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => { setBulkTopicMode(false); setBulkTopicValue(""); }}
                    className="text-gray-400 hover:text-white hover:bg-gray-700"
                  >
                    <X className="h-3.5 w-3.5" />
                  </Button>
                </div>
              ) : (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setBulkTopicMode(true)}
                  className="text-violet-400 hover:text-violet-300 hover:bg-gray-800"
                >
                  <Tag className="h-4 w-4 mr-1.5" />
                  Set Topic{selectedPromptIds.size > 1 ? ` (${selectedPromptIds.size})` : ''}
                </Button>
              )}
              <Button
                variant="ghost"
                size="sm"
                onClick={async () => {
                  const idsToArchive = Array.from(selectedPromptIds);
                  await bulkArchivePrompts(idsToArchive);
                  setSelectedPromptIds(new Set());
                  toast.success(`Archived ${idsToArchive.length} prompt${idsToArchive.length > 1 ? 's' : ''}`);
                }}
                className="text-white hover:bg-gray-700"
              >
                <Archive className="h-4 w-4 mr-1.5" />
                Archive{selectedPromptIds.size > 1 ? ` (${selectedPromptIds.size})` : ''}
              </Button>
              {isAdmin && (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={async () => {
                    if (!confirm(`Permanently delete ${selectedPromptIds.size} prompt${selectedPromptIds.size > 1 ? 's' : ''}? This cannot be undone.`)) return;
                    const idsToDelete = Array.from(selectedPromptIds);
                    await bulkDeletePrompts(idsToDelete);
                    setSelectedPromptIds(new Set());
                    toast.success(`Deleted ${idsToDelete.length} prompt${idsToDelete.length > 1 ? 's' : ''}`);
                  }}
                  className="text-red-400 hover:text-red-300 hover:bg-red-900/20"
                >
                  <Trash2 className="h-4 w-4 mr-1.5" />
                  Delete{selectedPromptIds.size > 1 ? ` (${selectedPromptIds.size})` : ''}
                </Button>
              )}
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setSelectedPromptIds(new Set())}
                className="text-gray-400 hover:text-white hover:bg-gray-700"
              >
                <X className="h-4 w-4" />
              </Button>
            </>
          )}
        </div>
      )}

      {/* Recommendations Modal */}
      <Dialog open={recsModalOpen} onOpenChange={setRecsModalOpen}>
        <DialogContent className="sm:max-w-lg bg-white max-h-[85vh] flex flex-col">
          <DialogHeader className="pb-4 border-b flex-shrink-0">
            <DialogTitle className="text-lg font-semibold flex items-center gap-2">
              <Lightbulb className="h-5 w-5 text-blue-600" />
              Recommendations
            </DialogTitle>
          </DialogHeader>
          <div className="py-4 space-y-4 flex-1 overflow-y-auto min-h-0 pr-2">
            {recsModalLoading ? (
              <div className="flex items-center justify-center py-8">
                <Loader2 className="h-8 w-8 animate-spin text-blue-600" />
              </div>
            ) : recsModalData && recsModalData.length > 0 ? (
              recsModalData.map((rec, idx) => (
                <div
                  key={idx}
                  className="flex gap-4 p-4 bg-gradient-to-r from-blue-50 to-indigo-50 border border-blue-100 rounded-xl"
                >
                  <div className="flex-shrink-0 w-8 h-8 rounded-full bg-blue-600 text-white flex items-center justify-center font-bold text-sm">
                    {idx + 1}
                  </div>
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-1">
                      <h4 className="font-semibold text-gray-900">{rec.title}</h4>
                      <Badge className={cn('text-xs', rec.type === 'High Impact' ? 'bg-amber-50 text-amber-700 border-amber-200' : 'bg-blue-50 text-blue-700 border-blue-200')}>{rec.type}</Badge>
                    </div>
                    <p className="text-sm text-gray-600">{rec.whyThisWorks}</p>
                    {rec.timeline && <p className="text-xs text-gray-400 mt-1">{"\u23F1"} {rec.timeline}</p>}
                  </div>
                </div>
              ))
            ) : (
              <div className="text-center py-8 text-gray-500">
                <Lightbulb className="h-10 w-10 mx-auto mb-3 text-gray-300" />
                <p>No recommendations available</p>
              </div>
            )}
          </div>
          <div className="pt-4 border-t flex justify-end flex-shrink-0">
            <Button variant="outline" onClick={() => setRecsModalOpen(false)}>Close</Button>
          </div>
        </DialogContent>
      </Dialog>
    </div >
  );
};

export default PromptsTab;
