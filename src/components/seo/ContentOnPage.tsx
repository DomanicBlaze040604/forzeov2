import { useState, useCallback, useMemo, useEffect } from "react";
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip as RechartsTooltip,
  ResponsiveContainer,
} from "recharts";
import {
  TrendingDown, FileText, Link2, Award, Loader2, Sparkles, Zap,
  AlertTriangle, ArrowDownRight, ExternalLink, RefreshCw,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import { callGroq, parseAIJson, fmtNum, fmtPct, truncateUrl, scoreColor, scoreBg, callSEOFunction } from "./helpers";
import type {
  ContentDecayItem, InternalLinkSuggestion, ContentScoreItem,
} from "./types";
import type { SEORow, TopPage } from "@/hooks/useSEOConnector";

interface ContentOnPageProps {
  clientId: string;
  siteUrl: string | null;
  brandName: string;
  gscData: SEORow[];
  gscTopPages: TopPage[];
  dateRange: number;
}

export default function ContentOnPage({
  clientId, brandName, gscData, gscTopPages, dateRange,
}: ContentOnPageProps) {
  const [activePanel, setActivePanel] = useState<"decay" | "links" | "score">("decay");

  // ── Content Decay ───────────────────────────────────────────────────────
  const contentDecay = useMemo((): ContentDecayItem[] => {
    if (gscData.length === 0) return [];

    const pageRows = gscData.filter(r => r.page && !r.query && !r.country);
    if (pageRows.length === 0) return [];

    const sorted = [...pageRows].sort((a, b) => a.date.localeCompare(b.date));
    const mid = sorted[Math.floor(sorted.length / 2)]?.date;
    if (!mid) return [];

    const firstHalf: Record<string, { clicks: number; impressions: number }> = {};
    const secondHalf: Record<string, { clicks: number; impressions: number }> = {};

    for (const r of sorted) {
      if (!r.page) continue;
      const bucket = r.date < mid ? firstHalf : secondHalf;
      if (!bucket[r.page]) bucket[r.page] = { clicks: 0, impressions: 0 };
      bucket[r.page].clicks += r.clicks;
      bucket[r.page].impressions += r.impressions;
    }

    const decaying: ContentDecayItem[] = [];
    for (const [page, prev] of Object.entries(firstHalf)) {
      const curr = secondHalf[page] || { clicks: 0, impressions: 0 };
      const lost = prev.clicks - curr.clicks;
      if (lost > 0 && prev.clicks > 2) {
        decaying.push({
          page,
          currentClicks: curr.clicks,
          previousClicks: prev.clicks,
          clicksLost: lost,
          decayPct: (lost / prev.clicks) * 100,
          currentImpressions: curr.impressions,
          previousImpressions: prev.impressions,
          period: dateRange <= 30 ? "30d" : dateRange <= 60 ? "60d" : "90d",
        });
      }
    }

    return decaying.sort((a, b) => b.clicksLost - a.clicksLost).slice(0, 20);
  }, [gscData, dateRange]);

  // ── Auto-load Cache ─────────────────────────────────────────────────────
  useEffect(() => {
    if (!clientId) return;
    const loadCache = async () => {
      try {
        const res = await callSEOFunction("seo-tools", "get_all_audits", clientId, {});
        const audits = res.audits || [];

        const cachedLinks = audits.find((a: any) => a.audit_type === "internal_links");
        if (cachedLinks) setLinkSuggestions(cachedLinks.data.suggestions || []);

        const cachedScores = audits.find((a: any) => a.audit_type === "content_scores");
        if (cachedScores) setContentScores(cachedScores.data.scores || []);
      } catch (err) {
        console.error("Failed to load content cache:", err);
      }
    };
    loadCache();
  }, [clientId]);

  // ── Internal Linking Suggestions ────────────────────────────────────────
  const [linkSuggestions, setLinkSuggestions] = useState<InternalLinkSuggestion[]>([]);
  const [linksLoading, setLinksLoading] = useState(false);

  const generateLinkSuggestions = useCallback(async () => {
    if (gscTopPages.length < 2) { toast.error("Need at least 2 pages to suggest links"); return; }
    setLinksLoading(true);
    try {
      const pagesStr = gscTopPages.slice(0, 20).map(p =>
        `"${p.page}" (${p.clicks} clicks, pos ${p.position.toFixed(1)})`
      ).join("\n");

      const prompt = `Analyze these pages and suggest internal linking opportunities.
Each suggestion should connect two EXISTING pages from the list for topical relevance.

PAGES:
${pagesStr}

Brand: ${brandName || "the website"}

Return ONLY a JSON array of 5-8 suggestions:
[{
  "sourcePage": "full URL of page to add link FROM",
  "targetPage": "full URL of page to link TO",
  "anchorText": "natural anchor text to use",
  "relevanceScore": 85,
  "reason": "Why these pages should link together"
}]`;

      const response = await callGroq(prompt,
        "You are an SEO internal linking expert. Suggest data-driven internal links between pages. Return ONLY valid JSON.",
        1500
      );
      const parsed = parseAIJson<InternalLinkSuggestion[]>(response);
      setLinkSuggestions(parsed);
      
      // Save for historic data
      try {
        await callSEOFunction("seo-tools", "save_audit", clientId, {
          audit_type: "internal_links",
          data: { suggestions: parsed }
        });
      } catch {}

      toast.success(`Generated ${parsed.length} link suggestions`);
    } catch (err: any) {
      toast.error("Link suggestion failed: " + err.message);
    } finally {
      setLinksLoading(false);
    }
  }, [gscTopPages, brandName]);

  // ── Content Score ───────────────────────────────────────────────────────
  const [contentScores, setContentScores] = useState<ContentScoreItem[]>([]);
  const [scoreLoading, setScoreLoading] = useState(false);

  const generateContentScores = useCallback(async () => {
    if (gscTopPages.length === 0) { toast.error("No page data available"); return; }
    setScoreLoading(true);
    try {
      const topPages = gscTopPages.slice(0, 10);
      const pagesStr = topPages.map(p =>
        `"${p.page}" (${p.clicks} clicks, ${p.impressions} impr, pos ${p.position.toFixed(1)}, CTR ${(p.ctr).toFixed(1)}%)`
      ).join("\n");

      const prompt = `Score these pages for SEO content quality based on their performance data.
For each page, provide an estimated content optimization score.

PAGES:
${pagesStr}

Return ONLY a JSON array:
[{
  "url": "page URL",
  "overallScore": 75,
  "readabilityScore": 80,
  "keywordScore": 70,
  "structureScore": 75,
  "lengthScore": 80,
  "wordCount": 1200,
  "suggestions": ["Specific improvement 1", "Specific improvement 2"]
}]`;

      const response = await callGroq(prompt,
        "You are an SEO content analyst. Score pages based on their search performance data and provide actionable improvement suggestions. Return ONLY valid JSON.",
        2000
      );
      const parsed = parseAIJson<ContentScoreItem[]>(response);
      setContentScores(parsed);

      // Save for historic data
      try {
        await callSEOFunction("seo-tools", "save_audit", clientId, {
          audit_type: "content_scores",
          data: { scores: parsed }
        });
      } catch {}

      toast.success(`Scored ${parsed.length} pages`);
    } catch (err: any) {
      toast.error("Content scoring failed: " + err.message);
    } finally {
      setScoreLoading(false);
    }
  }, [gscTopPages]);

  const panels: { id: "decay" | "links" | "score", label: string, icon: any, badge?: number }[] = [
    { id: "decay", label: "Content Decay", icon: TrendingDown, badge: contentDecay.length },
    { id: "links", label: "Internal Links", icon: Link2 },
    { id: "score", label: "Content Score", icon: Award },
  ];

  return (
    <div className="space-y-5">
      <div className="flex gap-1 bg-gray-50 rounded-xl p-1 w-fit flex-wrap">
        {panels.map(p => (
          <button key={p.id} onClick={() => setActivePanel(p.id)}
            className={cn("flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all",
              activePanel === p.id ? "bg-white shadow-sm text-gray-800" : "text-gray-500 hover:text-gray-700")}>
            <p.icon className="h-3.5 w-3.5" />{p.label}
            {p.badge && p.badge > 0 && (
              <span className="bg-rose-100 text-rose-700 text-[10px] font-bold px-1.5 py-0.5 rounded-full">{p.badge}</span>
            )}
          </button>
        ))}
      </div>

      {/* ── Content Decay ────────────────────────────────────────────────── */}
      {activePanel === "decay" && (
        <div className="space-y-4">
          <div>
            <h3 className="text-sm font-bold text-gray-800">Content Decay Alerts</h3>
            <p className="text-xs text-gray-500 mt-0.5">Pages losing traffic — comparing first half vs second half of your date range</p>
          </div>

          {contentDecay.length === 0 ? (
            <div className="bg-emerald-50 border border-emerald-200 rounded-2xl p-8 text-center">
              <Zap className="h-10 w-10 text-emerald-300 mx-auto mb-3" />
              <p className="text-sm font-semibold text-emerald-800">No significant content decay detected!</p>
              <p className="text-xs text-emerald-600 mt-1">Your pages are maintaining or growing traffic.</p>
            </div>
          ) : (
            <>
              {/* Chart */}
              <div className="bg-white rounded-2xl border border-gray-200 p-5">
                <h4 className="text-xs font-semibold text-gray-500 mb-3">Clicks Lost by Page</h4>
                <ResponsiveContainer width="100%" height={200}>
                  <BarChart data={contentDecay.slice(0, 10)} layout="vertical" margin={{ left: 120 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                    <XAxis type="number" tick={{ fontSize: 10, fill: "#94a3b8" }} />
                    <YAxis type="category" dataKey="page" tick={{ fontSize: 9, fill: "#64748b" }}
                      tickFormatter={(v: string) => truncateUrl(v, 25)} width={120} />
                    <RechartsTooltip formatter={(v: any) => [v, "Clicks Lost"]} />
                    <Bar dataKey="clicksLost" fill="#ef4444" radius={[0, 4, 4, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>

              {/* Table */}
              <div className="bg-white rounded-2xl border border-gray-200 overflow-hidden">
                <div className="overflow-x-auto max-h-[400px] overflow-y-auto">
                  <table className="w-full text-xs">
                    <thead className="bg-gray-50 sticky top-0">
                      <tr>
                        <th className="text-left px-4 py-3 font-semibold text-gray-600">Page</th>
                        <th className="text-right px-3 py-3 font-semibold text-gray-600">Before</th>
                        <th className="text-right px-3 py-3 font-semibold text-gray-600">After</th>
                        <th className="text-right px-3 py-3 font-semibold text-gray-600">Lost</th>
                        <th className="text-right px-3 py-3 font-semibold text-gray-600">Decay</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100">
                      {contentDecay.map((d, i) => (
                        <tr key={i} className="hover:bg-gray-50 transition-colors">
                          <td className="px-4 py-2.5 text-gray-700 truncate max-w-[250px]">
                            <div className="flex items-center gap-1.5">
                              <ArrowDownRight className="h-3 w-3 text-rose-500 flex-shrink-0" />
                              {truncateUrl(d.page, 45)}
                            </div>
                          </td>
                          <td className="px-3 py-2.5 text-right text-gray-600 tabular-nums">{d.previousClicks}</td>
                          <td className="px-3 py-2.5 text-right text-gray-600 tabular-nums">{d.currentClicks}</td>
                          <td className="px-3 py-2.5 text-right font-bold text-rose-600 tabular-nums">-{d.clicksLost}</td>
                          <td className="px-3 py-2.5 text-right">
                            <span className="text-rose-600 font-semibold">-{d.decayPct.toFixed(0)}%</span>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </>
          )}
        </div>
      )}

      {/* ── Internal Links ───────────────────────────────────────────────── */}
      {activePanel === "links" && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-sm font-bold text-gray-800">Internal Linking Suggestions</h3>
              <p className="text-xs text-gray-500 mt-0.5">AI-powered cross-linking opportunities between your pages</p>
            </div>
            <Button variant="outline" size="sm" onClick={generateLinkSuggestions} disabled={linksLoading} className="gap-2 text-xs h-8">
              {linksLoading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Sparkles className="h-3.5 w-3.5" />}
              Generate Suggestions
            </Button>
          </div>

          {linkSuggestions.length === 0 ? (
            <div className="bg-gray-50 border border-gray-200 rounded-2xl p-10 text-center">
              <Link2 className="h-10 w-10 text-gray-300 mx-auto mb-3" />
              <p className="text-sm text-gray-500">Click "Generate Suggestions" to get AI-powered internal linking ideas</p>
            </div>
          ) : (
            <div className="space-y-3">
              {linkSuggestions.map((ls, i) => (
                <div key={i} className="bg-white rounded-2xl border border-gray-200 p-4 hover:shadow-sm transition-shadow">
                  <div className="flex items-start gap-3">
                    <div className={cn("p-2 rounded-lg flex-shrink-0",
                      ls.relevanceScore >= 80 ? "bg-emerald-50" : ls.relevanceScore >= 60 ? "bg-amber-50" : "bg-blue-50")}>
                      <Link2 className={cn("h-4 w-4",
                        ls.relevanceScore >= 80 ? "text-emerald-600" : ls.relevanceScore >= 60 ? "text-amber-600" : "text-blue-600")} />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1">
                        <span className="text-xs font-bold text-gray-800 truncate">{truncateUrl(ls.sourcePage, 40)}</span>
                        <span className="text-gray-400">→</span>
                        <span className="text-xs font-bold text-blue-600 truncate">{truncateUrl(ls.targetPage, 40)}</span>
                      </div>
                      <p className="text-xs text-gray-500 mb-1.5">{ls.reason}</p>
                      <div className="flex items-center gap-3">
                        <span className="text-[10px] bg-gray-100 text-gray-600 px-2 py-0.5 rounded">
                          Anchor: "{ls.anchorText}"
                        </span>
                        <span className={cn("text-[10px] font-bold px-2 py-0.5 rounded",
                          ls.relevanceScore >= 80 ? "bg-emerald-100 text-emerald-700" : "bg-amber-100 text-amber-700")}>
                          {ls.relevanceScore}% relevant
                        </span>
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* ── Content Score ────────────────────────────────────────────────── */}
      {activePanel === "score" && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-sm font-bold text-gray-800">Content Quality Scores</h3>
              <p className="text-xs text-gray-500 mt-0.5">AI-graded optimization score per page</p>
            </div>
            <Button variant="outline" size="sm" onClick={generateContentScores} disabled={scoreLoading} className="gap-2 text-xs h-8">
              {scoreLoading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Award className="h-3.5 w-3.5" />}
              Score Pages
            </Button>
          </div>

          {contentScores.length === 0 ? (
            <div className="bg-gray-50 border border-gray-200 rounded-2xl p-10 text-center">
              <Award className="h-10 w-10 text-gray-300 mx-auto mb-3" />
              <p className="text-sm text-gray-500">Click "Score Pages" to get AI-powered content quality scores</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
              {contentScores.map((cs, i) => (
                <div key={i} className="bg-white rounded-2xl border border-gray-200 p-5">
                  <div className="flex items-center justify-between mb-3">
                    <span className="text-xs text-gray-600 truncate max-w-[250px]">{truncateUrl(cs.url, 40)}</span>
                    <div className={cn("text-xl font-bold px-3 py-1 rounded-xl", scoreBg(cs.overallScore), scoreColor(cs.overallScore))}>
                      {cs.overallScore}
                    </div>
                  </div>

                  {/* Score bars */}
                  <div className="space-y-2 mb-3">
                    {[
                      { label: "Readability", value: cs.readabilityScore },
                      { label: "Keywords", value: cs.keywordScore },
                      { label: "Structure", value: cs.structureScore },
                      { label: "Length", value: cs.lengthScore },
                    ].map((s, j) => (
                      <div key={j} className="flex items-center gap-2">
                        <span className="text-[10px] text-gray-500 w-16">{s.label}</span>
                        <div className="flex-1 h-1.5 bg-gray-100 rounded-full overflow-hidden">
                          <div className="h-full rounded-full transition-all duration-700"
                            style={{
                              width: `${s.value}%`,
                              backgroundColor: s.value >= 80 ? "#10b981" : s.value >= 60 ? "#f59e0b" : "#ef4444",
                            }} />
                        </div>
                        <span className="text-[10px] font-bold text-gray-600 tabular-nums w-6 text-right">{s.value}</span>
                      </div>
                    ))}
                  </div>

                  {cs.wordCount > 0 && (
                    <p className="text-[10px] text-gray-400 mb-2">~{fmtNum(cs.wordCount)} words</p>
                  )}

                  {cs.suggestions.length > 0 && (
                    <div className="mt-2 pt-2 border-t border-gray-100">
                      <span className="text-[10px] font-semibold text-gray-500">Suggestions:</span>
                      <ul className="mt-1 space-y-0.5">
                        {cs.suggestions.map((s, j) => (
                          <li key={j} className="text-[10px] text-gray-500 flex items-start gap-1">
                            <Zap className="h-2.5 w-2.5 text-amber-500 mt-0.5 flex-shrink-0" />
                            {s}
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
