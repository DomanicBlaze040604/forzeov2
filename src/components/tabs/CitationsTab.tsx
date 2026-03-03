import React from "react";
import { cn } from "@/lib/utils";
import {
  Link2,
  Search,
  Download,
  ArrowUpDown,
  ExternalLink,
  Copy,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Label } from "@/components/ui/label";
import {
  classifyDomain,
  DOMAIN_TYPES,
  normalizeCitationCategory,
} from "@/utils/dashboardHelpers";
import type { Client, Prompt, AuditResult, CitationMeta } from "@/hooks/useClientDashboard";

/** Shape of a single aggregated citation object. */
export interface CitationItem {
  url: string;
  title: string;
  domain: string;
  count: number;
  prompts: string[];
  models: string[];
}

export interface CitationsTabProps {
  allCitations: CitationItem[];
  filteredCitations: CitationItem[];
  citationSearch: string;
  setCitationSearch: (value: string) => void;
  selectedCitation: string | null;
  setSelectedCitation: (value: string | null) => void;
  exportCitations: () => void;
  citationsByPrompt: Record<string, CitationItem[]>;
  citationMeta: Record<string, CitationMeta> | undefined;
  selectedClient: Client | null;
  prompts: Prompt[];
  filteredAuditResults: AuditResult[];
  selectedPromptDetail: string | null;
  setSelectedPromptDetail: (value: string | null) => void;
}

export function CitationsTab({
  allCitations,
  filteredCitations,
  citationSearch,
  setCitationSearch,
  selectedCitation,
  setSelectedCitation,
  exportCitations,
  citationsByPrompt,
  citationMeta,
  selectedClient,
  prompts,
  filteredAuditResults,
  selectedPromptDetail: _selectedPromptDetail,
  setSelectedPromptDetail,
}: CitationsTabProps) {

  return (
    <div className="space-y-6">
      <div className="bg-purple-50 border border-purple-200 rounded-lg p-4 flex items-start gap-3"><div className="p-2 bg-purple-100 rounded-lg"><Link2 className="h-5 w-5 text-purple-600" /></div><div><h4 className="font-medium text-purple-900">What are Citations?</h4><p className="text-sm text-purple-700 mt-0.5">Citations are the specific URLs that AI shows to prove its responses. They're the evidence that the AI uses to back up what it says - citation-backed responses mean the answer is traceable.</p></div></div>
      <div className="flex items-center justify-between"><div className="flex items-center gap-4"><h2 className="text-lg font-semibold text-gray-900">All Citations</h2><Badge variant="outline">{allCitations.length} total</Badge></div><div className="flex items-center gap-2"><div className="relative"><Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" /><Input placeholder="Search citations..." value={citationSearch} onChange={(e) => setCitationSearch(e.target.value)} className="pl-9 w-64" /></div><Button variant="outline" size="sm" onClick={exportCitations} aria-label="Export citations"><Download className="h-4 w-4 mr-1" /> Export Citations</Button></div></div>
      <div className="grid grid-cols-3 gap-6">
        <div className="col-span-2 bg-white rounded-xl border border-gray-200 overflow-hidden">
          <div className="max-h-[600px] overflow-y-auto">
            <table className="w-full relative" role="grid">
              <caption className="sr-only">Citations table listing all URLs cited by AI models across audits</caption>
              <thead className="bg-gray-50/80 backdrop-blur-sm border-b border-gray-200 sticky top-0 z-10">
                <tr>
                  <th scope="col" className="text-left px-6 py-4 text-xs font-semibold text-gray-500 uppercase w-16">#</th>
                  <th scope="col" className="text-left px-6 py-4 text-xs font-semibold text-gray-500 uppercase" aria-sort="none">
                    <div className="flex items-center gap-1 cursor-pointer hover:text-gray-900 group">URL <ArrowUpDown className="h-3 w-3 text-gray-400 group-hover:text-gray-600" /></div>
                  </th>
                  <th scope="col" className="text-left px-6 py-4 text-xs font-semibold text-gray-500 uppercase w-48">Domain</th>
                  <th scope="col" className="text-center px-6 py-4 text-xs font-semibold text-gray-500 uppercase w-24">Count</th>
                  <th scope="col" className="text-center px-6 py-4 text-xs font-semibold text-gray-500 uppercase w-24">Type</th>
                  <th scope="col" className="text-center px-6 py-4 text-xs font-semibold text-gray-500 uppercase w-28">Hallucinated?</th>
                  <th scope="col" className="text-center px-6 py-4 text-xs font-semibold text-gray-500 uppercase w-24">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {filteredCitations.map((c, i) => {
                  const nc3 = normalizeCitationCategory(citationMeta?.[c.domain]?.category); const t = DOMAIN_TYPES[(nc3 && nc3 !== 'other') ? nc3 : classifyDomain(c.domain, selectedClient?.brand_domain, selectedClient?.competitors, selectedClient?.brand_name)] || DOMAIN_TYPES.other;
                  return (
                    <tr key={i} className={cn("hover:bg-gray-50 transition-colors group cursor-pointer border-b border-gray-50 last:border-0", selectedCitation === c.url && "bg-blue-50/50")} role="row" tabIndex={0} aria-selected={selectedCitation === c.url} onClick={() => setSelectedCitation(c.url)} onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); setSelectedCitation(c.url); } }}>
                      <td className="px-6 py-4 text-sm text-gray-400 font-mono">{i + 1}</td>
                      <td className="px-6 py-4">
                        <div className="flex items-center gap-3">
                          <div className="p-1 bg-white rounded border border-gray-100 shadow-sm flex-shrink-0">
                            <img src={`https://www.google.com/s2/favicons?domain=${c.domain}&sz=32`} alt="" className="h-4 w-4 rounded opacity-80" onError={(e) => { (e.target as HTMLImageElement).src = 'data:image/svg+xml,<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="%23ccc"><circle cx="12" cy="12" r="10"/></svg>'; }} />
                          </div>
                          <div className="min-w-0 max-w-lg">
                            <div className="text-sm font-medium text-gray-900 truncate group-hover:text-blue-600 transition-colors">{c.title || c.url}</div>
                            <div className="text-xs text-gray-500 truncate mt-0.5">{c.url}</div>
                          </div>
                        </div>
                      </td>
                      <td className="px-6 py-4 text-sm text-gray-600">{c.domain}</td>
                      <td className="px-6 py-4 text-center">
                        <span className="inline-flex items-center justify-center min-w-[32px] px-2 py-1 bg-blue-50 text-blue-700 text-sm font-bold rounded-full border border-blue-100">{c.count}</span>
                      </td>
                      <td className="px-6 py-4 text-center">
                        <span className={cn("px-2.5 py-1 rounded-full text-xs font-medium border", t.bg, t.color, "border-opacity-20")}>{t.label}</span>
                      </td>
                      {/* Hallucination Detection - Basic heuristics */}
                      <td className="px-6 py-4 text-center">
                        {(() => {
                          // Basic hallucination detection heuristics
                          const url = c.url?.toLowerCase() || "";
                          const domain = c.domain?.toLowerCase() || "";

                          // Likely hallucinated patterns
                          const suspiciousPatterns = [
                            /example\.com/,
                            /test\./,
                            /fake\./,
                            /sample\./,
                            /placeholder/,
                            /lorem/,
                            /xxx\./,
                          ];
                          const hasRandomString = /[a-z]{20,}/.test(url);
                          const hasSuspiciousPattern = suspiciousPatterns.some(p => p.test(url));
                          const hasMissingScheme = !url.startsWith('http://') && !url.startsWith('https://');

                          // Detection logic
                          let status: 'yes' | 'no' | 'maybe' = 'no';
                          if (hasSuspiciousPattern || hasRandomString) {
                            status = 'yes';
                          } else if (hasMissingScheme || domain.length < 4) {
                            status = 'maybe';
                          }

                          return (
                            <Badge className={cn(
                              "text-xs",
                              status === 'yes' && "bg-red-100 text-red-700 hover:bg-red-100 border-red-200",
                              status === 'no' && "bg-green-100 text-green-700 hover:bg-green-100 border-green-200",
                              status === 'maybe' && "bg-yellow-100 text-yellow-700 hover:bg-yellow-100 border-yellow-200"
                            )}>
                              {status === 'yes' ? 'Yes' : status === 'no' ? 'No' : 'Maybe'}
                            </Badge>
                          );
                        })()}
                      </td>
                      <td className="px-6 py-4 text-center">
                        <a href={c.url} target="_blank" rel="noopener noreferrer" className="inline-flex items-center justify-center p-2 text-gray-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-all" onClick={(e) => e.stopPropagation()} title="Open URL" aria-label="Open external link">
                          <ExternalLink className="h-4 w-4" />
                        </a>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
          {filteredCitations.length === 0 && (<div className="p-12 text-center"><Link2 className="h-10 w-10 mx-auto mb-3 text-gray-300" /><p className="text-gray-500">No citations yet. Run audits to collect citation data.</p></div>)}
          {filteredCitations.length > 0 && <div className="p-3 text-center text-sm text-gray-500 border-t bg-gray-50">Showing all {filteredCitations.length} citations</div>}
        </div>
        <div className="space-y-4">
          <div className="bg-white rounded-xl border border-gray-200 p-5"><h3 className="font-semibold text-gray-900 mb-4">Citations by Prompt</h3><div className="space-y-3 max-h-96 overflow-y-auto">{Object.entries(citationsByPrompt).map(([promptId, citations]) => { const prompt = prompts.find(p => p.id === promptId); const result = filteredAuditResults.find(r => r.prompt_id === promptId); return (<div key={promptId} className="p-3 bg-gray-50 rounded-lg hover:bg-gray-100 cursor-pointer border border-gray-200" onClick={() => setSelectedPromptDetail(promptId)}><div className="text-sm font-medium text-gray-900 line-clamp-2">{prompt?.prompt_text || result?.prompt_text}</div><div className="flex items-center gap-3 mt-2"><div className="flex-1 h-2 bg-gray-200 rounded-full overflow-hidden"><div className="h-full bg-blue-500 rounded-full" style={{ width: `${Math.min(citations.length * 10, 100)}%` }} /></div><span className="text-xs font-medium text-gray-700 whitespace-nowrap">{citations.length} citations</span></div></div>); })}{Object.keys(citationsByPrompt).length === 0 && <p className="text-sm text-gray-500 text-center py-4">No citations collected yet</p>}</div></div>
          {selectedCitation && (<div className="bg-white rounded-xl border border-gray-200 p-5"><h3 className="font-semibold text-gray-900 mb-3">Citation Details</h3>{(() => { const c = allCitations.find(x => x.url === selectedCitation); if (!c) return null; return (<div className="space-y-3"><div><Label className="text-xs text-gray-500">Title</Label><p className="text-sm text-gray-900">{c.title || "No title"}</p></div><div><Label className="text-xs text-gray-500">URL</Label><a href={c.url} target="_blank" rel="noopener noreferrer" className="text-sm text-blue-600 hover:underline break-all">{c.url}</a></div><div><Label className="text-xs text-gray-500">Domain</Label><p className="text-sm text-gray-900">{c.domain}</p></div><div><Label className="text-xs text-gray-500">Cited in {c.prompts.length} prompt(s)</Label><div className="mt-1 space-y-1">{c.prompts.slice(0, 5).map((p, i) => <p key={i} className="text-xs text-gray-600 truncate">{p}</p>)}{c.prompts.length > 5 && <p className="text-xs text-blue-600 font-medium">+{c.prompts.length - 5} more prompts</p>}</div></div><Button variant="outline" size="sm" className="w-full" onClick={() => navigator.clipboard.writeText(c.url)} aria-label="Copy URL"><Copy className="h-3.5 w-3.5 mr-1" /> Copy URL</Button></div>); })()}</div>)}
        </div>
      </div>
    </div>
  );
}
