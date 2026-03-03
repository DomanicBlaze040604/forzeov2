import React from "react";
import { cn } from "@/lib/utils";
import {
  ChevronRight,
  Plus,
  AlertTriangle,
  Layers,
  Tag,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { computePositionForResult } from "@/utils/dashboardHelpers";
import type { Client, Prompt, AuditResult } from "@/hooks/useClientDashboard";

/** Shape of a single topic row produced by the topicData useMemo in ClientDashboard */
export interface TopicDataItem {
  topic: string;
  promptCount: number;
  prompts: Prompt[];
  visibility: string;
  visibilityPct: number;
  avgPosition: number | null;
  citations: number;
  brands: string[];
  brandFrequencies: Record<string, number>;
  searchVolume: number | null;
  aiOpportunity: { score: number; tier: string; color: string };
}

export interface TopicsTabProps {
  topicData: TopicDataItem[];
  unassignedPrompts: Prompt[];
  expandedTopic: string | null;
  setExpandedTopic: (topic: string | null) => void;
  setActiveTab: (tab: string) => void;
  setBulkPromptsOpen: (open: boolean) => void;
  getPromptResult: (promptId: string) => AuditResult | undefined;
  selectedClient: Client | null;
  setSelectedPromptDetail: (promptId: string | null) => void;
  getAIOpportunity: (promptId: string) => { score: number; tier: string; color: string; demandDataAvailable: boolean };
}

export const TopicsTab: React.FC<TopicsTabProps> = ({
  topicData,
  unassignedPrompts,
  expandedTopic,
  setExpandedTopic,
  setActiveTab,
  setBulkPromptsOpen,
  getPromptResult,
  selectedClient,
  setSelectedPromptDetail,
  getAIOpportunity,
}) => {
  return (
    <div className="space-y-4 animate-in fade-in">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-semibold text-gray-900">Topics</h2>
          <p className="text-sm text-gray-500 mt-0.5">Cumulative metrics for all prompts grouped by topic</p>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-sm text-gray-500">{topicData.length} topic{topicData.length !== 1 ? 's' : ''}</span>
          {unassignedPrompts.length > 0 && (
            <Badge variant="outline" className="text-xs text-amber-600 bg-amber-50 border-amber-200">
              {unassignedPrompts.length} unassigned
            </Badge>
          )}
        </div>
      </div>

      {topicData.length === 0 ? (
        <div className="bg-white rounded-xl border border-gray-200 p-12 text-center shadow-sm">
          <Layers className="h-12 w-12 mx-auto mb-4 text-gray-300" />
          <p className="text-gray-600 font-medium">No topics yet</p>
          <p className="text-sm text-gray-500 mt-1">Assign topics to your prompts using the seed keyword field when adding prompts.</p>
          <Button onClick={() => { setActiveTab("prompts"); setBulkPromptsOpen(true); }} className="mt-4"><Plus className="h-4 w-4 mr-1" /> Add Prompts with Topic</Button>
        </div>
      ) : (
        <div className="bg-white rounded-xl border border-gray-200 overflow-hidden shadow-sm">
          <table className="w-full" role="grid">
            <caption className="sr-only">Topics aggregation table showing cumulative metrics for all prompts grouped by topic</caption>
            <thead className="bg-gray-50/80 border-b border-gray-200">
              <tr>
                <th scope="col" className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">Topic</th>
                <th scope="col" className="px-4 py-3 text-center text-xs font-semibold text-gray-500 uppercase tracking-wider w-20">Prompts</th>
                <th scope="col" className="px-4 py-3 text-center text-xs font-semibold text-gray-500 uppercase tracking-wider w-28" title="AI Opportunity reflects the relative strategic upside of improving visibility for this prompt in AI-generated answers.">AI Opportunity</th>
                <th scope="col" className="px-4 py-3 text-center text-xs font-semibold text-gray-500 uppercase tracking-wider w-24">Avg Position</th>
                <th scope="col" className="px-4 py-3 text-center text-xs font-semibold text-gray-500 uppercase tracking-wider w-24">Visibility</th>
                <th scope="col" className="px-4 py-3 text-center text-xs font-semibold text-gray-500 uppercase tracking-wider w-24">Citations</th>
                <th scope="col" className="px-4 py-3 text-center text-xs font-semibold text-gray-500 uppercase tracking-wider w-28">Brands</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {topicData.map((td) => (
                <React.Fragment key={td.topic}>
                  <tr
                    className="hover:bg-gray-50 transition-colors cursor-pointer"
                    role="row"
                    tabIndex={0}
                    aria-expanded={expandedTopic === td.topic}
                    onClick={() => setExpandedTopic(expandedTopic === td.topic ? null : td.topic)}
                    onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); setExpandedTopic(expandedTopic === td.topic ? null : td.topic); } }}
                  >
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2">
                        <ChevronRight className={cn("h-4 w-4 text-gray-400 transition-transform", expandedTopic === td.topic && "rotate-90")} />
                        <Tag className="h-4 w-4 text-violet-500" />
                        <span className="font-medium text-gray-900">{td.topic}</span>
                      </div>
                    </td>
                    <td className="px-4 py-3 text-center">
                      <Badge variant="secondary" className="bg-gray-100 text-gray-700 text-xs">{td.promptCount}</Badge>
                    </td>
                    <td className="px-4 py-3 text-center">
                      {(() => {
                        const op = (td as any).aiOpportunity || { tier: 'Minimal', color: '#9ca3af' };
                        return <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-semibold" style={{ backgroundColor: op.color + '18', color: op.color, border: `1px solid ${op.color}40` }}>{op.tier}</span>;
                      })()}
                    </td>
                    <td className="px-4 py-3 text-center text-sm font-medium text-gray-600">
                      {td.avgPosition ? `#${td.avgPosition}` : "\u2014"}
                    </td>
                    <td className="px-4 py-3 text-center">
                      <span className={cn("text-sm font-medium", td.visibilityPct > 0 ? "text-gray-900" : "text-gray-400")}>
                        {td.visibility}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-center">
                      {td.citations > 0 ? (
                        <Badge variant="secondary" className="bg-blue-50 text-blue-700 border border-blue-200 text-xs">{td.citations}</Badge>
                      ) : <span className="text-gray-300">{"\u2014"}</span>}
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center justify-center gap-1">
                        {td.brands.slice(0, 4).map((brand, idx) => {
                          const domain = `${brand.toLowerCase().replace(/[^a-z0-9]/g, '')}.com`;
                          const freq = td.brandFrequencies?.[brand] || 0;
                          return (
                            <div key={idx} title={`${brand} (${freq}x)`} className="relative h-6 w-6 rounded-md border border-gray-200 bg-white shadow-sm flex items-center justify-center">
                              <img src={`https://www.google.com/s2/favicons?domain=${domain}&sz=16`} alt={brand} className="h-3.5 w-3.5 rounded-sm"
                                onError={(e) => { e.currentTarget.style.display = 'none'; e.currentTarget.parentElement!.innerText = brand.charAt(0).toUpperCase(); e.currentTarget.parentElement!.className += " text-[9px] font-bold text-gray-500"; }}
                              />
                              {freq > 1 && <span className="absolute -top-1.5 -right-1.5 bg-blue-600 text-white text-[8px] font-bold rounded-full h-3.5 min-w-[14px] flex items-center justify-center px-0.5 leading-none">{freq}</span>}
                            </div>
                          );
                        })}
                        {td.brands.length > 4 && <span className="text-[10px] font-bold text-gray-500">+{td.brands.length - 4}</span>}
                        {td.brands.length === 0 && <span className="text-xs text-gray-300">{"\u2014"}</span>}
                      </div>
                    </td>
                  </tr>

                  {/* Expanded: show individual prompts */}
                  {expandedTopic === td.topic && td.prompts.map((p) => {
                    const r = getPromptResult(p.id);
                    const vis = r ? `${r.model_results.filter(mr => mr.brand_mentioned).length}/${r.model_results.length}` : "\u2014";
                    const pos = computePositionForResult(r, selectedClient);
                    const cit = r?.summary.total_citations || 0;

                    return (
                      <tr key={p.id} className="bg-gray-50/50 hover:bg-gray-100/50 transition-colors" role="row">
                        <td className="px-4 py-2 pl-12">
                          <span
                            className="text-sm text-gray-700 cursor-pointer hover:text-blue-600 hover:underline underline-offset-2"
                            role="link"
                            tabIndex={0}
                            onClick={(e) => { e.stopPropagation(); setSelectedPromptDetail(p.id); }}
                            onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); e.stopPropagation(); setSelectedPromptDetail(p.id); } }}
                          >
                            {p.prompt_text}
                          </span>
                        </td>
                        <td className="px-4 py-2 text-center text-xs text-gray-400">{"\u2014"}</td>
                        <td className="px-4 py-2 text-center">
                          {(() => {
                            const op = getAIOpportunity(p.id);
                            return <span className="inline-flex items-center px-1.5 py-0.5 rounded-full text-[10px] font-semibold" style={{ backgroundColor: op.color + '18', color: op.color, border: `1px solid ${op.color}40` }}>{op.tier}</span>;
                          })()}
                        </td>
                        <td className="px-4 py-2 text-center text-xs text-gray-500">{pos ? `#${pos}` : "\u2014"}</td>
                        <td className="px-4 py-2 text-center text-xs text-gray-500">{vis}</td>
                        <td className="px-4 py-2 text-center text-xs text-gray-500">{cit > 0 ? cit : "\u2014"}</td>
                        <td className="px-4 py-2 text-center text-xs text-gray-400">{"\u2014"}</td>
                      </tr>
                    );
                  })}
                </React.Fragment>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Unassigned prompts section */}
      {unassignedPrompts.length > 0 && (
        <div className="bg-amber-50/50 rounded-xl border border-amber-200 p-4">
          <div className="flex items-center gap-2 mb-2">
            <AlertTriangle className="h-4 w-4 text-amber-500" />
            <span className="text-sm font-medium text-amber-800">{unassignedPrompts.length} prompts without a topic</span>
          </div>
          <p className="text-xs text-amber-600">These prompts are not grouped into any topic. Edit them to assign a topic for aggregated analytics.</p>
        </div>
      )}
    </div>
  );
};

export default TopicsTab;
