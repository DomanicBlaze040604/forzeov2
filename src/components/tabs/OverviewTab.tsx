import React from "react";
import { cn } from "@/lib/utils";
import {
  Target,
  Link2,
  BarChart3,
  Eye,
  Users,
  Globe,
  ChevronRight,
  MessageSquare,
  Building2,
  Clock,
  TrendingUp,
  TrendingDown,
  Minus,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { SOVLineChart } from "@/components/SOVLineChart";
import { AgencyOverview } from "@/components/AgencyOverview";
import { UniversalImport } from "@/components/UniversalImport";
import { MODEL_LOGOS } from "@/components/ModelLogos";
import { AI_MODELS } from "@/hooks/useClientDashboard";
import type { Client, Prompt, AuditResult } from "@/hooks/useClientDashboard";
import {
  DOMAIN_TYPES,
  computePositionForResult,
  roundToHundred,
} from "@/utils/dashboardHelpers";

// ---------------------------------------------------------------------------
// Local helper components
// ---------------------------------------------------------------------------

function DonutChart({
  value,
  size = 120,
  label = "Citations",
  segments = [],
}: {
  value: number;
  size?: number;
  label?: string;
  segments?: { type: string; count: number }[];
}) {
  const strokeWidth = 14;
  const radius = (size - strokeWidth) / 2;
  const circumference = 2 * Math.PI * radius;
  const total = segments.reduce((sum, s) => sum + s.count, 0) || value || 1;

  // Build arcs for each segment
  let currentOffset = 0;
  const arcs =
    segments.length > 0
      ? segments.map((s) => {
          const pct = s.count / total;
          const dash = circumference * pct;
          const offset = circumference * currentOffset;
          currentOffset += pct;
          const typeColor =
            (DOMAIN_TYPES as any)[s.type]?.dot || "#6b7280";
          return {
            dash,
            offset,
            color: typeColor,
            type: s.type,
            count: s.count,
            pct: Math.round(pct * 100),
          };
        })
      : [
          {
            dash: circumference * 0.75,
            offset: 0,
            color: "#3b82f6",
            type: "default",
            count: value,
            pct: 100,
          },
        ];

  return (
    <div className="relative" style={{ width: size, height: size }}>
      <svg width={size} height={size} className="transform -rotate-90">
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          stroke="#f3f4f6"
          strokeWidth={strokeWidth}
        />
        {arcs.map((arc, i) => (
          <circle
            key={i}
            cx={size / 2}
            cy={size / 2}
            r={radius}
            fill="none"
            stroke={arc.color}
            strokeWidth={strokeWidth}
            strokeDasharray={`${arc.dash} ${circumference}`}
            strokeDashoffset={-arc.offset}
            strokeLinecap="round"
            className="transition-all duration-500"
          />
        ))}
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <span className="text-2xl font-bold text-gray-900">{value}</span>
        <span className="text-xs text-gray-500">{label}</span>
      </div>
    </div>
  );
}

function TrendIndicator({
  value,
  suffix = "%",
}: {
  value: number;
  suffix?: string;
}) {
  if (value > 0)
    return (
      <span className="flex items-center gap-0.5 text-green-600 text-xs">
        <TrendingUp className="h-3 w-3" />+{value}
        {suffix}
      </span>
    );
  if (value < 0)
    return (
      <span className="flex items-center gap-0.5 text-red-600 text-xs">
        <TrendingDown className="h-3 w-3" />
        {value}
        {suffix}
      </span>
    );
  return (
    <span className="flex items-center gap-0.5 text-gray-400 text-xs">
      <Minus className="h-3 w-3" />0{suffix}
    </span>
  );
}

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface DomainStatItem {
  domain: string;
  count: number;
  type: string;
  avg: number;
  models: string[];
  promptCount: number;
  prompts: { text: string; visible: boolean; competitors: string[] }[];
}

export interface CompetitorGapItem {
  name: string;
  mentions: number;
  percentage: number;
}

export interface DetailedBrandStat {
  name: string;
  mentions: number;
  percentage: number;
  avgRank: number | null;
  auditPresence: number;
}

export interface SovTimeSeriesData {
  labels: string[];
  series: Array<{
    name: string;
    isClient: boolean;
    domain: string;
    data: (number | null)[];
  }>;
}

export interface CitationItem {
  url: string;
  title: string;
  domain: string;
  count: number;
  prompts: string[];
  models: string[];
}

export interface OverviewTabProps {
  // Auth / agency
  isAgency: boolean;

  // Data
  clients: Client[];
  selectedClient: Client | null;
  prompts: Prompt[];
  auditResults: AuditResult[];
  filteredAuditResults: AuditResult[];

  // Computed / derived data
  modelStats: Record<string, { visible: number; total: number; cost: number }>;
  competitorGap: CompetitorGapItem[];
  detailedBrandStats: DetailedBrandStat[];
  sovTimeSeries: SovTimeSeriesData;
  allCitations: CitationItem[];
  domainStats: DomainStatItem[];
  typeSegments: { type: string; count: number }[];
  recentPrompts: (AuditResult & { prompt_text: string })[];

  // Selected models for visibility-by-model section
  selectedModels: string[];

  // SOV chart time range
  sovTimeRange: "week" | "month" | "year";
  setSovTimeRange: (range: "week" | "month" | "year") => void;

  // Show brand-only toggle
  showBrandOnly: boolean;
  setShowBrandOnly: (v: boolean) => void;

  // Brand visibility modal
  showBrandVisibilityModal: boolean;
  setShowBrandVisibilityModal: (v: boolean) => void;

  // Navigation / callbacks
  switchClient: (client: Client) => void;
  setManageBrandsOpen: (v: boolean) => void;
  setActiveTab: (tab: string) => void;
  setSelectedPromptDetail: (id: string) => void;
  refreshData: () => void;
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export const OverviewTab: React.FC<OverviewTabProps> = ({
  isAgency,
  clients,
  selectedClient,
  prompts,
  auditResults,
  filteredAuditResults,
  modelStats,
  competitorGap,
  detailedBrandStats,
  sovTimeSeries,
  allCitations,
  domainStats,
  typeSegments,
  recentPrompts,
  selectedModels,
  sovTimeRange,
  setSovTimeRange,
  showBrandOnly,
  setShowBrandOnly,
  showBrandVisibilityModal,
  setShowBrandVisibilityModal,
  switchClient,
  setManageBrandsOpen,
  setActiveTab,
  setSelectedPromptDetail,
  refreshData,
}) => {
  // ---- Agency landing (no selected brand) ----
  if (isAgency && !selectedClient) {
    return <AgencyOverview clients={clients} prompts={prompts} auditResults={auditResults} onNavigateToBrand={(id) => { const c = clients.find(x => x.id === id); if (c) switchClient(c); }} onViewAllBrands={() => setManageBrandsOpen(true)} />;
  }

  return (
    <div className="space-y-6 fade-in">
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <div className="bg-white rounded-xl border border-gray-200 p-6 shadow-sm hover:shadow-md transition-shadow">
          <div className="flex items-center justify-between">
            <div className="text-sm font-medium text-gray-500 uppercase tracking-wide">Share of Voice</div>
            <div className="p-2.5 bg-blue-50 rounded-lg"><Target className="h-5 w-5 text-blue-600" /></div>
          </div>
          <div className="mt-4 flex items-baseline gap-2">
            <span className="text-4xl font-bold text-gray-950">{(() => {
              const allResults = filteredAuditResults.flatMap(r => r.model_results || []);
              // SOV = Brand Mentions / (Brand Mentions + Competitor Mentions) x 100
              let brandMentionCount = 0;
              let competitorMentionCount = 0;
              const competitors = selectedClient?.competitors || [];
              allResults.forEach(mr => {
                if (mr.brand_mentioned) brandMentionCount++;
                const response = (mr.raw_response || "").toLowerCase();
                competitors.forEach(c => {
                  if (response.includes(c.toLowerCase())) competitorMentionCount++;
                });
              });
              const totalMentions = brandMentionCount + competitorMentionCount;
              return totalMentions > 0 ? Math.round((brandMentionCount / totalMentions) * 100) : 0;
            })()}%</span>
            <TrendIndicator value={0} />
          </div>
          <div className="mt-3 text-xs font-medium text-gray-400">Brand vs competitors in AI</div>
        </div>
        <div className="bg-white rounded-xl border border-gray-200 p-6 shadow-sm hover:shadow-md transition-shadow">
          <div className="flex items-center justify-between">
            <div className="text-sm font-medium text-gray-500 uppercase tracking-wide">Citation Rate</div>
            <div className="p-2.5 bg-green-50 rounded-lg"><Link2 className="h-5 w-5 text-green-600" /></div>
          </div>
          <div className="mt-4 flex items-baseline gap-2">
            <span className="text-4xl font-bold text-gray-950">{(() => {
              const totalResults = filteredAuditResults.flatMap(r => r.model_results || []);
              const brandDomain = selectedClient?.brand_domain?.toLowerCase().replace(/^(https?:\/\/)?(www\.)?/, '').replace(/\/.*$/, '') || '';
              const citedResults = totalResults.filter(mr => (mr as any).is_cited || (brandDomain && mr.citations && mr.citations.some(c => c.domain.toLowerCase().includes(brandDomain) || brandDomain.includes(c.domain.toLowerCase()))));
              return totalResults.length > 0 ? Math.round((citedResults.length / totalResults.length) * 100) : 0;
            })()}%</span>
            <TrendIndicator value={0} />
          </div>
          <div className="mt-3 text-xs font-medium text-gray-400">% of responses citing your site</div>
        </div>

        <div className="bg-white rounded-xl border border-gray-200 p-6 shadow-sm hover:shadow-md transition-shadow">
          <div className="flex items-center justify-between">
            <div className="text-sm font-medium text-gray-500 uppercase tracking-wide">Citations Found</div>
            <div className="p-2.5 bg-purple-50 rounded-lg"><Link2 className="h-5 w-5 text-purple-600" /></div>
          </div>
          <div className="mt-4 flex items-baseline gap-2">
            <span className="text-4xl font-bold text-gray-950">{allCitations.length}</span>
            <span className="text-sm text-gray-500 font-medium">citations</span>
          </div>
          <div className="mt-3 text-xs font-medium text-gray-400">{domainStats.length} unique domains referenced</div>
        </div>
        <div className="bg-white rounded-xl border border-gray-200 p-6 shadow-sm hover:shadow-md transition-shadow">
          <div className="flex items-center justify-between">
            <div className="text-sm font-medium text-gray-500 uppercase tracking-wide">Average Position</div>
            <div className="p-2.5 bg-amber-50 rounded-lg"><BarChart3 className="h-5 w-5 text-amber-600" /></div>
          </div>
          <div className="mt-4 flex items-baseline gap-2">
            <span className="text-4xl font-bold text-gray-950">
              {(() => {
                const positions = filteredAuditResults
                  .map(r => computePositionForResult(r, selectedClient))
                  .filter((p): p is number => p !== null);
                if (positions.length === 0) return "\u2014";
                const avgRank = Math.round(positions.reduce((sum, p) => sum + p, 0) / positions.length * 10) / 10;
                return `#${avgRank}`;
              })()}
            </span>
            <TrendIndicator value={0} />
          </div>
          <div className="mt-3 text-xs font-medium text-gray-400">{filteredAuditResults.length} audits completed</div>
        </div>
      </div>
      {/* SOV Trend Graph */}
      <div className="bg-white rounded-2xl border border-gray-200/80 p-5 shadow-sm">
        <div className="flex items-center justify-between mb-1">
          <div>
            <h3 className="text-base font-semibold text-gray-900">Share of Voice</h3>
            <p className="text-xs text-gray-400">Brand vs top competitors over time</p>
          </div>
          <div className="flex items-center bg-gray-100/80 p-1 rounded-xl">
            {(["week", "month", "year"] as const).map(range => (
              <button
                key={range}
                onClick={() => setSovTimeRange(range)}
                className={cn(
                  "px-4 py-1.5 text-sm font-medium rounded-lg transition-all",
                  sovTimeRange === range
                    ? "bg-white text-gray-900 shadow-sm"
                    : "text-gray-500 hover:text-gray-700"
                )}
              >
                {range === "week" ? "Week" : range === "month" ? "Month" : "Year"}
              </button>
            ))}
          </div>
        </div>
        <SOVLineChart labels={sovTimeSeries.labels} series={sovTimeSeries.series} height={240} />
        {(selectedClient?.competitors || []).length === 0 && sovTimeSeries.series.length <= 1 && (
          <p className="text-xs text-gray-400 mt-2">Add competitors in Settings to compare Share of Voice</p>
        )}
      </div>
      <div className="grid grid-cols-1 md:grid-cols-5 gap-6">
        <div className="col-span-1 md:col-span-3 bg-white rounded-xl border border-gray-200 p-5">
          <div className="flex items-center justify-between mb-4"><div><h3 className="font-semibold text-gray-900 flex items-center gap-2"><Eye className="h-4 w-4 text-gray-400" /> Visibility by Model</h3><p className="text-xs text-gray-500 mt-0.5">Percentage of responses mentioning your brand</p></div></div>
          <div className="space-y-4 mt-6">{AI_MODELS.filter(m => selectedModels.includes(m.id)).map(model => { const stats = modelStats[model.id] || { visible: 0, total: 0, cost: 0 }; const pct = stats.total > 0 ? Math.round((stats.visible / stats.total) * 100) : 0; const Logo = MODEL_LOGOS[model.id]?.Logo; const color = MODEL_LOGOS[model.id]?.color || "#666"; return (<div key={model.id} className="flex items-center gap-3"><div className="w-32 flex items-center gap-2">{Logo && <Logo className="h-4 w-4" style={{ color }} />}<span className="text-sm text-gray-700 truncate">{model.name}</span></div><div className="flex-1 h-8 bg-gray-100 rounded-full overflow-hidden relative"><div className="h-full rounded-full transition-all duration-500" style={{ width: `${Math.max(pct, 2)}%`, backgroundColor: color }} /><span className="absolute inset-0 flex items-center justify-center text-xs font-medium" style={{ color: pct > 50 ? "white" : "#374151" }}>{pct}%</span></div><span className="text-sm font-medium text-gray-600 w-16 text-right">{stats.visible}/{stats.total}</span></div>); })}</div>
          {filteredAuditResults.length === 0 && <div className="text-center py-8 text-gray-500"><BarChart3 className="h-10 w-10 mx-auto mb-2 text-gray-300" /><p className="text-sm">Run audits to see visibility data</p></div>}
        </div>
        <div className="col-span-1 md:col-span-2 bg-white rounded-xl border border-gray-200 p-5">
          <div className="flex items-center justify-between mb-4"><h3 className="font-semibold text-gray-900 flex items-center gap-2"><Users className="h-4 w-4 text-gray-400" /> Brand Visibility</h3><button onClick={() => setShowBrandVisibilityModal(true)} className="text-sm text-blue-600 hover:text-blue-700 font-medium flex items-center gap-1">View All <ChevronRight className="h-3.5 w-3.5" /></button></div>
          <div className="space-y-3">{competitorGap.slice(0, 8).map((c, i) => { const isBrand = c.name === selectedClient?.brand_name; const brandDomain = isBrand ? selectedClient?.brand_domain : `${c.name.toLowerCase().replace(/[^a-z0-9]/g, '')}.com`; return (<div key={i} className={cn("flex items-center gap-3 p-2 rounded-lg", isBrand && "bg-blue-50")}><span className="text-sm text-gray-400 w-5">{i + 1}</span><img src={`https://www.google.com/s2/favicons?domain=${brandDomain}&sz=20`} alt="" className="h-5 w-5 rounded" onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; (e.target as HTMLImageElement).nextElementSibling?.classList.remove('hidden'); }} /><Building2 className="h-5 w-5 text-gray-400 hidden" /><span className={cn("flex-1 text-sm truncate", isBrand ? "font-semibold text-blue-700" : "text-gray-700")}>{c.name}</span><div className="w-20 h-2 bg-gray-100 rounded-full overflow-hidden"><div className="h-full rounded-full" style={{ width: `${c.percentage}%`, backgroundColor: isBrand ? "#3b82f6" : "#9ca3af" }} /></div><span className={cn("text-sm font-medium w-12 text-right", isBrand ? "text-blue-600" : "text-gray-600")}>{c.percentage}%</span></div>); })}{competitorGap.length === 0 && <p className="text-sm text-gray-500 text-center py-4">Run audits to see brand data</p>}</div>
        </div>
      </div>
      <div className="bg-white rounded-xl border border-gray-200 p-5">
        <div className="flex items-center justify-between mb-4"><div><h3 className="font-semibold text-gray-900 flex items-center gap-2"><Globe className="h-4 w-4 text-gray-400" /> Top Sources</h3><p className="text-xs text-gray-500 mt-0.5">Most cited domains across all models</p></div><button onClick={() => setActiveTab("sources")} className="text-sm text-blue-600 hover:text-blue-700 font-medium flex items-center gap-1">View All <ChevronRight className="h-3.5 w-3.5" /></button></div>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <div className="flex flex-col items-center justify-center">
            <DonutChart value={allCitations.length} size={160} segments={typeSegments} />
            <div className="flex flex-wrap justify-center gap-x-4 gap-y-2 mt-4 text-xs">
              {(() => {
                const otherOverflow = typeSegments.slice(6).reduce((sum, s) => sum + s.count, 0);
                // Merge overflow into existing "other" segment if present in top 6
                const hasOtherInTop6 = typeSegments.slice(0, 6).some(s => s.type === 'other');
                const displaySegs = typeSegments.slice(0, 6).map(s =>
                  s.type === 'other' ? { ...s, count: s.count + otherOverflow } : s
                );
                const extraOtherCount = hasOtherInTop6 ? 0 : otherOverflow;
                const items = [
                  ...displaySegs.map(s => ({ key: s.type, value: s.count })),
                  ...(extraOtherCount > 0 ? [{ key: "__other__", value: extraOtherCount }] : []),
                ];
                const pctMap = roundToHundred(items);
                return (
                  <>
                    {displaySegs.map((seg) => {
                      const t = DOMAIN_TYPES[seg.type] || DOMAIN_TYPES.other;
                      return (
                        <div key={seg.type} className="flex items-center gap-1.5">
                          <span className="h-2.5 w-2.5 rounded-full flex-shrink-0" style={{ backgroundColor: t.dot }} />
                          <span className="text-gray-700 font-medium">{t.label}</span>
                          <span className="text-gray-400">({pctMap.get(seg.type) || 0}%)</span>
                        </div>
                      );
                    })}
                    {extraOtherCount > 0 && (
                      <div className="flex items-center gap-1.5">
                        <span className="h-2.5 w-2.5 rounded-full flex-shrink-0" style={{ backgroundColor: "#6b7280" }} />
                        <span className="text-gray-700 font-medium">Other</span>
                        <span className="text-gray-400">({pctMap.get("__other__") || 0}%)</span>
                      </div>
                    )}
                  </>
                );
              })()}
            </div>
          </div>
          <div className="col-span-1 md:col-span-2 overflow-hidden overflow-x-auto">
            <table className="w-full" role="grid">
              <caption className="sr-only">Top sources table showing the most cited domains across all AI models</caption>
              <thead>
                <tr className="text-xs font-semibold text-gray-500 uppercase tracking-wider border-b border-gray-100">
                  <th scope="col" className="text-left py-3 pl-2">Domain</th>
                  <th scope="col" className="text-right py-3">Citations</th>
                  <th scope="col" className="text-right py-3">Prompts</th>
                  <th scope="col" className="text-right py-3 pr-2">Type</th>
                </tr>
              </thead>
              <tbody className="text-sm divide-y divide-gray-50">
                {domainStats.slice(0, 6).map((s, i) => {
                  const t = DOMAIN_TYPES[s.type] || DOMAIN_TYPES.other;
                  return (
                    <tr key={i} className="group hover:bg-gray-50 transition-colors">
                      <td className="py-3 pl-2">
                        <div className="flex items-center gap-2">
                          <img src={`https://www.google.com/s2/favicons?domain=${s.domain}&sz=16`} alt="" className="h-4 w-4 rounded opacity-70 group-hover:opacity-100 transition-opacity" onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }} />
                          <span className="text-gray-900 font-medium">{s.domain}</span>
                        </div>
                      </td>
                      <td className="py-3 text-right text-gray-600 font-medium">{s.count}</td>
                      <td className="py-3 text-right text-gray-500">{s.promptCount}</td>
                      <td className="py-3 text-right pr-2">
                        <span className={cn("px-2 py-0.5 rounded-full text-[10px] font-semibold uppercase tracking-wide border border-opacity-20", t.bg, t.color)}>{t.label}</span>
                      </td>
                    </tr>
                  );
                })}
                {domainStats.length === 0 && <tr><td colSpan={4} className="py-8 text-center text-gray-500 italic">Run audits to see source data</td></tr>}
              </tbody>
            </table>
          </div>
        </div>
      </div>
      <div>
        <div className="flex items-center justify-between mb-4"><h3 className="font-semibold text-gray-900 flex items-center gap-2"><MessageSquare className="h-4 w-4 text-gray-400" /> Recent Audits</h3><div className="flex items-center gap-2"><span className="text-sm text-gray-500 hidden sm:inline">{selectedClient?.brand_name} mentioned</span><button onClick={() => setShowBrandOnly(!showBrandOnly)} className={cn("relative w-10 h-5 rounded-full transition-colors", showBrandOnly ? "bg-blue-500" : "bg-gray-200")}><span className={cn("absolute top-0.5 w-4 h-4 bg-white rounded-full shadow transition-transform", showBrandOnly ? "translate-x-5" : "translate-x-0.5")} /></button></div></div>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">{recentPrompts.filter(r => !showBrandOnly || r.summary.share_of_voice > 0).slice(0, 9).map((r, i) => (<div key={i} onClick={() => setSelectedPromptDetail(r.prompt_id)} className="bg-white rounded-xl border border-gray-200 p-4 hover:border-gray-300 hover:shadow-sm transition-all cursor-pointer"><h4 className="font-medium text-gray-900 text-sm line-clamp-2 mb-2">{r.prompt_text}</h4><p className="text-xs text-gray-500 line-clamp-2 mb-3">{r.model_results[0]?.raw_response?.substring(0, 100) || "No response"}...</p><div className="flex items-center justify-between"><div className="flex items-center gap-1">{r.model_results.slice(0, 4).map((mr, j) => { const Logo = MODEL_LOGOS[mr.model]?.Logo; const color = MODEL_LOGOS[mr.model]?.color || "#666"; return Logo ? (<div key={j} className={cn("p-1 rounded", mr.brand_mentioned ? "bg-green-50" : "bg-gray-50")}><Logo className="h-3.5 w-3.5" style={{ color: mr.brand_mentioned ? color : "#9ca3af" }} /></div>) : null; })}</div><span className="text-xs text-gray-400 flex items-center gap-1"><Clock className="h-3 w-3" />{new Date(r.created_at).toLocaleDateString()}</span></div></div>))}</div>
        {recentPrompts.length === 0 && (<div className="bg-white rounded-xl border border-gray-200 p-12 text-center"><MessageSquare className="h-10 w-10 mx-auto mb-3 text-gray-300" /><p className="text-gray-500">No recent audits. Run some prompts to see results here.</p></div>)}
      </div>
      {/* Import Section */}
      <div className="mt-6">
        {selectedClient && selectedClient.id && <UniversalImport clientId={selectedClient.id} onImportComplete={() => refreshData()} />}
      </div>
      {/* Brand Visibility Modal */}
      <BrandVisibilityModal
        showBrandVisibilityModal={showBrandVisibilityModal}
        setShowBrandVisibilityModal={setShowBrandVisibilityModal}
        selectedClient={selectedClient}
        detailedBrandStats={detailedBrandStats}
        filteredAuditResults={filteredAuditResults}
      />
    </div>
  );
};

// ---------------------------------------------------------------------------
// BrandVisibilityModal (local sub-component)
// ---------------------------------------------------------------------------

function BrandVisibilityModal({
  showBrandVisibilityModal,
  setShowBrandVisibilityModal,
  selectedClient,
  detailedBrandStats,
  filteredAuditResults,
}: {
  showBrandVisibilityModal: boolean;
  setShowBrandVisibilityModal: (v: boolean) => void;
  selectedClient: Client | null;
  detailedBrandStats: DetailedBrandStat[];
  filteredAuditResults: AuditResult[];
}) {
  const clientStats = detailedBrandStats.find(s => s.name === selectedClient?.brand_name);
  const sov = clientStats?.percentage || 0;
  const rank = clientStats?.avgRank;

  return (
    <Dialog open={showBrandVisibilityModal} onOpenChange={setShowBrandVisibilityModal}>
      <DialogContent className="max-w-4xl max-h-[85vh] overflow-hidden flex flex-col p-6">
        <DialogHeader className="mb-4">
          <DialogTitle className="flex items-center gap-2 text-xl">
            <Users className="h-5 w-5 text-blue-600" />
            Brand Visibility Landscape
          </DialogTitle>
          <p className="text-sm text-gray-500">Detailed breakdown of brand mentions across all audits</p>
        </DialogHeader>

        {/* Stats Cards */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6 shrink-0">
          <div className="bg-blue-50 border border-blue-100 p-4 rounded-xl">
            <div className="text-sm text-blue-600 font-medium mb-1">Your Share of Voice</div>
            <div className="text-3xl font-bold text-blue-700">{sov}%</div>
          </div>
          <div className="bg-indigo-50 border border-indigo-100 p-4 rounded-xl">
            <div className="text-sm text-indigo-600 font-medium mb-1">Avg. Position</div>
            <div className="text-3xl font-bold text-indigo-700">{rank ? `#${rank}` : '-'}</div>
          </div>
          <div className="bg-gray-50 border border-gray-100 p-4 rounded-xl">
            <div className="text-sm text-gray-600 font-medium mb-1">Audits with Presence</div>
            <div className="text-3xl font-bold text-gray-700">{clientStats?.auditPresence || 0} <span className="text-base font-normal text-gray-400">/ {filteredAuditResults.length}</span></div>
          </div>
        </div>

        <div className="overflow-y-auto flex-1 -mx-2 px-2 border rounded-lg border-gray-100">
          <table className="w-full relative" role="grid">
            <caption className="sr-only">Brand visibility landscape showing detailed breakdown of brand mentions across all audits</caption>
            <thead className="sticky top-0 bg-white z-10 border-b border-gray-200">
              <tr>
                <th scope="col" className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase w-16">Position</th>
                <th scope="col" className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase">Brand</th>
                <th scope="col" className="px-4 py-3 text-right text-xs font-semibold text-gray-500 uppercase">Mentions</th>
                <th scope="col" className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase w-1/3 pl-8">Visibility Share</th>
                <th scope="col" className="px-4 py-3 text-right text-xs font-semibold text-gray-500 uppercase">Avg Position</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {detailedBrandStats.map((brand, i) => {
                const isClient = brand.name === selectedClient?.brand_name;
                const brandDomain = isClient ? selectedClient?.brand_domain : `${brand.name.toLowerCase().replace(/[^a-z0-9]/g, '')}.com`;
                return (
                  <tr key={i} className={cn("hover:bg-gray-50/80 transition-colors", isClient && "bg-blue-50/40 hover:bg-blue-50/60")}>
                    <td className="px-4 py-3 text-sm font-medium text-gray-500">#{i + 1}</td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-3">
                        <img src={`https://www.google.com/s2/favicons?domain=${brandDomain}&sz=32`} className="w-6 h-6 rounded-md bg-white border border-gray-100 shadow-sm" onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; (e.target as HTMLImageElement).nextElementSibling?.classList.remove('hidden'); }} />
                        <div className="w-6 h-6 rounded-md bg-gray-100 hidden flex items-center justify-center text-[10px] font-bold text-gray-400 uppercase">{brand.name.substring(0, 2)}</div>
                        <span className={cn("font-medium", isClient ? "text-blue-700" : "text-gray-900")}>{brand.name}</span>
                        {isClient && <Badge className="ml-2 bg-blue-100 text-blue-700 hover:bg-blue-100 border-0 text-[10px] h-5">You</Badge>}
                      </div>
                    </td>
                    <td className="px-4 py-3 text-right text-sm text-gray-600 font-medium">{brand.mentions}</td>
                    <td className="px-4 py-3 pl-8">
                      <div className="flex items-center gap-3">
                        <div className="flex-1 h-2 bg-gray-100 rounded-full overflow-hidden">
                          <div className="h-full rounded-full transition-all duration-500" style={{ width: `${brand.percentage}%`, backgroundColor: isClient ? '#3b82f6' : '#9ca3af' }} />
                        </div>
                        <span className="text-sm font-medium w-9 text-right">{brand.percentage}%</span>
                      </div>
                    </td>
                    <td className="px-4 py-3 text-right">
                      <div className={cn("inline-flex items-center px-2 py-0.5 rounded text-sm font-medium", brand.avgRank && brand.avgRank <= 3 ? "bg-amber-50 text-amber-700 border border-amber-100" : "text-gray-600")}>
                        {brand.avgRank ? `#${brand.avgRank}` : '-'}
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </DialogContent>
    </Dialog>
  );
}

export default OverviewTab;
