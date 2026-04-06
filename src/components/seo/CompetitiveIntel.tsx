import { useState, useCallback, useEffect } from "react";
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip as RechartsTooltip,
  ResponsiveContainer, BarChart, Bar, Cell,
} from "recharts";
import {
  Search, TrendingUp, TrendingDown, ArrowUpRight, ArrowDownRight, Minus,
  Loader2, RefreshCw, Plus, X, Target, Zap, Eye, Star, AlertTriangle,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import { callSEOFunction, fmtNum, fmtPos } from "./helpers";
import type { KeywordGapItem, SERPFeature, RankTrackerEntry } from "./types";

// ── SERP Feature badge colors ─────────────────────────────────────────────────
const FEATURE_COLORS: Record<string, string> = {
  featured_snippet: "bg-purple-100 text-purple-700",
  people_also_ask: "bg-blue-100 text-blue-700",
  local_pack: "bg-green-100 text-green-700",
  knowledge_graph: "bg-amber-100 text-amber-700",
  video: "bg-red-100 text-red-700",
  images: "bg-pink-100 text-pink-700",
  shopping: "bg-orange-100 text-orange-700",
  top_stories: "bg-cyan-100 text-cyan-700",
  twitter: "bg-sky-100 text-sky-700",
  related_searches: "bg-gray-100 text-gray-700",
};

interface CompetitiveIntelProps {
  clientId: string;
  siteUrl: string | null;
  competitors?: string[];
}

export default function CompetitiveIntel({ clientId, siteUrl, competitors = [] }: CompetitiveIntelProps) {
  const [activePanel, setActivePanel] = useState<"gap" | "serp" | "rank">("gap");

  // ── Keyword Gap State ───────────────────────────────────────────────────
  const [gapResults, setGapResults] = useState<KeywordGapItem[]>([]);
  const [gapLoading, setGapLoading] = useState(false);
  const [gapFilter, setGapFilter] = useState<"all" | "missing" | "weak" | "strong">("all");
  const [competitorInput, setCompetitorInput] = useState("");
  const [competitorDomains, setCompetitorDomains] = useState<string[]>(competitors);

  // Sync from props
  useEffect(() => {
    if (competitors.length > 0 && competitorDomains.length === 0) {
      setCompetitorDomains(competitors);
    }
  }, [competitors]);

  // ── SERP Features State ─────────────────────────────────────────────────
  const [serpResults, setSerpResults] = useState<SERPFeature[]>([]);
  const [serpLoading, setSerpLoading] = useState(false);
  const [serpKeywords, setSerpKeywords] = useState("");

  // ── Rank Tracker State ──────────────────────────────────────────────────
  const [rankData, setRankData] = useState<RankTrackerEntry[]>([]);
  const [rankLoading, setRankLoading] = useState(false);
  const [newKeyword, setNewKeyword] = useState("");
  const [trackedKeywords, setTrackedKeywords] = useState<string[]>([]);

  // ── Auto-load Cache ─────────────────────────────────────────────────────
  useEffect(() => {
    if (!clientId) return;
    const loadCache = async () => {
      try {
        const res = await callSEOFunction("seo-tools", "get_all_audits", clientId, {});
        const audits = res.audits || [];

        const cachedGap = audits.find((a: any) => a.audit_type === "keyword_gap");
        if (cachedGap) setGapResults(cachedGap.data.gaps || []);

        const cachedSerp = audits.find((a: any) => a.audit_type === "serp_features");
        if (cachedSerp) setSerpResults(cachedSerp.data.results || []);

        // Rank tracker history
        const rankRes = await callSEOFunction("seo-competitive", "get_rank_history", clientId, {});
        const rows = rankRes.rows || [];
        
        // Group by keyword
        const grouped: Record<string, RankTrackerEntry> = {};
        rows.forEach((r: any) => {
          if (!grouped[r.keyword]) {
            grouped[r.keyword] = {
              keyword: r.keyword,
              positions: [],
              currentPosition: 0,
              previousPosition: 0,
              change: 0,
              bestPosition: 999,
              searchVolume: r.search_volume || 0,
              url: r.url,
            };
          }
          if (r.position !== null) {
            grouped[r.keyword].positions.push({ date: r.date, position: r.position });
            grouped[r.keyword].currentPosition = r.position;
            grouped[r.keyword].bestPosition = Math.min(grouped[r.keyword].bestPosition, r.position);
          }
        });
        
        const initialTracked = Object.keys(grouped);
        setTrackedKeywords(initialTracked);
        setRankData(Object.values(grouped));

      } catch (err) {
        console.error("Failed to load competitive cache:", err);
      }
    };
    loadCache();
  }, [clientId]);

  // ── Fetchers ────────────────────────────────────────────────────────────

  const addCompetitor = useCallback(() => {
    const d = competitorInput.trim().replace(/^https?:\/\//, "").replace(/\/.*$/, "");
    if (d && !competitorDomains.includes(d)) {
      setCompetitorDomains(prev => [...prev, d]);
    }
    setCompetitorInput("");
  }, [competitorInput, competitorDomains]);

  const fetchKeywordGap = useCallback(async () => {
    if (!siteUrl) { toast.error("No site connected"); return; }
    if (competitorDomains.length === 0) { toast.error("Add at least one competitor domain"); return; }
    setGapLoading(true);
    try {
      const domain = siteUrl.replace("sc-domain:", "").replace(/^https?:\/\//, "").replace(/\/.*$/, "");
      const data = await callSEOFunction("seo-competitive", "keyword_gap", clientId, {
        your_domain: domain,
        competitor_domains: competitorDomains,
      });
      setGapResults(data.gaps || []);
      toast.success(`Found ${data.total || 0} keyword gaps`);
    } catch (err: any) {
      toast.error("Keyword gap failed: " + err.message);
    } finally {
      setGapLoading(false);
    }
  }, [clientId, siteUrl, competitorDomains]);

  const fetchSERPFeatures = useCallback(async () => {
    if (!siteUrl) { toast.error("No site connected"); return; }
    const keywords = serpKeywords.split("\n").map(k => k.trim()).filter(Boolean);
    if (keywords.length === 0) { toast.error("Enter keywords to check"); return; }
    setSerpLoading(true);
    try {
      const data = await callSEOFunction("seo-competitive", "serp_features", clientId, {
        keywords,
        site_url: siteUrl,
      });
      setSerpResults(data.results || []);
      toast.success(`Analyzed ${data.results?.length || 0} SERPs`);
    } catch (err: any) {
      toast.error("SERP analysis failed: " + err.message);
    } finally {
      setSerpLoading(false);
    }
  }, [clientId, siteUrl, serpKeywords]);

  const addTrackedKeyword = useCallback(async () => {
    const kw = newKeyword.trim();
    if (kw && !trackedKeywords.includes(kw)) {
      const updated = [...trackedKeywords, kw];
      setTrackedKeywords(updated);
      // Persist tracked keyword
      try {
        await callSEOFunction("seo-competitive", "save_tracked_keywords", clientId, { keywords: [kw] });
      } catch {}
    }
    setNewKeyword("");
  }, [newKeyword, trackedKeywords]);

  const checkRanks = useCallback(async () => {
    if (!siteUrl) { toast.error("No site connected"); return; }
    if (trackedKeywords.length === 0) { toast.error("Add keywords to track"); return; }
    setRankLoading(true);
    try {
      const data = await callSEOFunction("seo-competitive", "rank_check", clientId, {
        keywords: trackedKeywords,
        site_url: siteUrl,
      });
      // Merge with existing rank data
      const results = data.results || [];
      const updated: RankTrackerEntry[] = results.map((r: any) => {
        const existing = rankData.find(rd => rd.keyword === r.keyword);
        const positions = existing?.positions || [];
        if (r.position !== null) {
          positions.push({ date: new Date().toISOString().split("T")[0], position: r.position });
        }
        return {
          keyword: r.keyword,
          positions,
          currentPosition: r.position || 0,
          previousPosition: existing?.currentPosition || 0,
          change: existing ? (existing.currentPosition - (r.position || 0)) : 0,
          bestPosition: Math.min(r.position || 999, existing?.bestPosition || 999),
          searchVolume: r.searchVolume || 0,
          url: r.url,
        };
      });
      setRankData(updated);
      toast.success(`Checked ranks for ${results.length} keywords`);
    } catch (err: any) {
      toast.error("Rank check failed: " + err.message);
    } finally {
      setRankLoading(false);
    }
  }, [clientId, siteUrl, trackedKeywords, rankData]);

  const filteredGaps = gapFilter === "all" ? gapResults : gapResults.filter(g => g.category === gapFilter);

  const panels = [
    { id: "gap", label: "Keyword Gap", icon: Target },
    { id: "serp", label: "SERP Features", icon: Star },
    { id: "rank", label: "Rank Tracker", icon: TrendingUp },
  ] as const;

  return (
    <div className="space-y-5">
      <div className="flex gap-1 bg-gray-50 rounded-xl p-1 w-fit flex-wrap">
        {panels.map(p => (
          <button key={p.id} onClick={() => setActivePanel(p.id)}
            className={cn("flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all",
              activePanel === p.id ? "bg-white shadow-sm text-gray-800" : "text-gray-500 hover:text-gray-700")}>
            <p.icon className="h-3.5 w-3.5" />{p.label}
          </button>
        ))}
      </div>

      {/* ── Keyword Gap ──────────────────────────────────────────────────── */}
      {activePanel === "gap" && (
        <div className="space-y-4">
          <div className="flex items-start justify-between">
            <div>
              <h3 className="text-sm font-bold text-gray-800">Keyword Gap Analysis</h3>
              <p className="text-xs text-gray-500 mt-0.5">Find keywords your competitors rank for that you don't</p>
            </div>
            <Button variant="outline" size="sm" onClick={fetchKeywordGap} disabled={gapLoading} className="gap-2 text-xs h-8">
              {gapLoading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Search className="h-3.5 w-3.5" />}
              Analyze Gap
            </Button>
          </div>

          {/* Competitor inputs */}
          <div className="bg-white rounded-2xl border border-gray-200 p-4 space-y-3">
            <span className="text-xs font-semibold text-gray-600">Competitor Domains</span>
            <div className="flex gap-2">
              <Input placeholder="e.g. competitor.com" value={competitorInput}
                onChange={e => setCompetitorInput(e.target.value)}
                onKeyDown={e => e.key === "Enter" && addCompetitor()}
                className="text-sm max-w-sm" />
              <Button variant="outline" size="sm" onClick={addCompetitor} className="gap-1 text-xs h-9">
                <Plus className="h-3.5 w-3.5" /> Add
              </Button>
            </div>
            {competitorDomains.length > 0 && (
              <div className="flex flex-wrap gap-2">
                {competitorDomains.map((d, i) => (
                  <Badge key={i} variant="secondary" className="gap-1.5 pr-1">
                    {d}
                    <button onClick={() => setCompetitorDomains(prev => prev.filter((_, j) => j !== i))}
                      className="p-0.5 rounded-full hover:bg-gray-300/50"><X className="h-3 w-3" /></button>
                  </Badge>
                ))}
              </div>
            )}
          </div>

          {gapResults.length > 0 && (
            <>
              {/* Filters */}
              <div className="flex gap-1 bg-gray-50 rounded-lg p-1 w-fit">
                {([
                  { id: "all", label: `All (${gapResults.length})` },
                  { id: "missing", label: `Missing (${gapResults.filter(g => g.category === "missing").length})` },
                  { id: "weak", label: `Weak (${gapResults.filter(g => g.category === "weak").length})` },
                  { id: "strong", label: `Strong (${gapResults.filter(g => g.category === "strong").length})` },
                ] as const).map(f => (
                  <button key={f.id} onClick={() => setGapFilter(f.id)}
                    className={cn("px-3 py-1 rounded-md text-xs font-semibold transition-all",
                      gapFilter === f.id ? "bg-white shadow-sm text-gray-800" : "text-gray-500")}>{f.label}</button>
                ))}
              </div>

              {/* Table */}
              <div className="bg-white rounded-2xl border border-gray-200 overflow-hidden">
                <div className="overflow-x-auto max-h-[400px] overflow-y-auto">
                  <table className="w-full text-xs">
                    <thead className="bg-gray-50 sticky top-0">
                      <tr>
                        <th className="text-left px-4 py-3 font-semibold text-gray-600">Keyword</th>
                        <th className="text-right px-3 py-3 font-semibold text-gray-600">Volume</th>
                        <th className="text-right px-3 py-3 font-semibold text-gray-600">Difficulty</th>
                        <th className="text-right px-3 py-3 font-semibold text-gray-600">Your Pos</th>
                        <th className="text-right px-3 py-3 font-semibold text-gray-600">Competitor</th>
                        <th className="text-center px-3 py-3 font-semibold text-gray-600">Status</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100">
                      {filteredGaps.slice(0, 50).map((g, i) => (
                        <tr key={i} className="hover:bg-gray-50 transition-colors">
                          <td className="px-4 py-2.5 font-medium text-gray-800">{g.keyword}</td>
                          <td className="px-3 py-2.5 text-right text-gray-600 tabular-nums">{fmtNum(g.searchVolume)}</td>
                          <td className="px-3 py-2.5 text-right">
                            <span className={cn("font-semibold tabular-nums",
                              g.difficulty < 30 ? "text-emerald-600" : g.difficulty < 60 ? "text-amber-600" : "text-rose-600")}>
                              {g.difficulty}
                            </span>
                          </td>
                          <td className="px-3 py-2.5 text-right text-gray-600 tabular-nums">{g.yourPosition || "—"}</td>
                          <td className="px-3 py-2.5 text-right text-gray-600 tabular-nums">{g.competitorPosition || "—"}</td>
                          <td className="px-3 py-2.5 text-center">
                            <span className={cn("px-2 py-0.5 rounded-full text-[10px] font-bold",
                              g.category === "missing" ? "bg-rose-100 text-rose-700"
                              : g.category === "weak" ? "bg-amber-100 text-amber-700"
                              : "bg-emerald-100 text-emerald-700")}>
                              {g.category}
                            </span>
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

      {/* ── SERP Features ──────────────────────────────────────────────── */}
      {activePanel === "serp" && (
        <div className="space-y-4">
          <div className="flex items-start justify-between">
            <div>
              <h3 className="text-sm font-bold text-gray-800">SERP Feature Tracking</h3>
              <p className="text-xs text-gray-500 mt-0.5">See which SERP features appear for your keywords</p>
            </div>
            <Button variant="outline" size="sm" onClick={fetchSERPFeatures} disabled={serpLoading} className="gap-2 text-xs h-8">
              {serpLoading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Star className="h-3.5 w-3.5" />}
              Analyze SERPs
            </Button>
          </div>

          <div className="bg-white rounded-2xl border border-gray-200 p-4">
            <label className="text-xs font-semibold text-gray-600 block mb-2">Keywords (one per line)</label>
            <textarea
              value={serpKeywords}
              onChange={e => setSerpKeywords(e.target.value)}
              placeholder={"seo tools\nkeyword research\nbacklink checker"}
              rows={4}
              className="w-full text-sm border border-gray-200 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-200 resize-none"
            />
          </div>

          {serpResults.length > 0 && (
            <div className="space-y-3">
              {serpResults.map((sr, i) => (
                <div key={i} className="bg-white rounded-2xl border border-gray-200 p-4">
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-sm font-bold text-gray-800">"{sr.query}"</span>
                    <span className="text-xs text-gray-500">
                      {sr.position ? `Position ${sr.position}` : "Not ranking"}
                    </span>
                  </div>
                  {sr.features.length > 0 ? (
                    <div className="flex flex-wrap gap-1.5">
                      {sr.features.map((f, j) => (
                        <span key={j} className={cn("px-2 py-0.5 rounded-full text-[10px] font-bold",
                          FEATURE_COLORS[f] || "bg-gray-100 text-gray-700")}>
                          {f.replace(/_/g, " ")}
                        </span>
                      ))}
                    </div>
                  ) : (
                    <p className="text-xs text-gray-400">No special SERP features detected</p>
                  )}
                  {sr.yourUrl && (
                    <p className="text-[10px] text-gray-400 mt-2 truncate">Your URL: {sr.yourUrl}</p>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* ── Rank Tracker ─────────────────────────────────────────────────── */}
      {activePanel === "rank" && (
        <div className="space-y-4">
          <div className="flex items-start justify-between">
            <div>
              <h3 className="text-sm font-bold text-gray-800">Rank Tracker</h3>
              <p className="text-xs text-gray-500 mt-0.5">Monitor keyword positions over time</p>
            </div>
            <Button variant="outline" size="sm" onClick={checkRanks}
              disabled={rankLoading || trackedKeywords.length === 0} className="gap-2 text-xs h-8">
              {rankLoading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <RefreshCw className="h-3.5 w-3.5" />}
              Check Ranks
            </Button>
          </div>

          {/* Add keyword */}
          <div className="flex gap-2">
            <Input placeholder="Add keyword to track…" value={newKeyword}
              onChange={e => setNewKeyword(e.target.value)}
              onKeyDown={e => e.key === "Enter" && addTrackedKeyword()}
              className="text-sm max-w-sm" />
            <Button variant="outline" size="sm" onClick={addTrackedKeyword} className="gap-1 text-xs h-9">
              <Plus className="h-3.5 w-3.5" /> Add
            </Button>
          </div>

          {trackedKeywords.length > 0 && (
            <div className="flex flex-wrap gap-2">
              {trackedKeywords.map((kw, i) => (
                <Badge key={i} variant="secondary" className="gap-1.5 pr-1">
                  {kw}
                  <button onClick={() => setTrackedKeywords(prev => prev.filter((_, j) => j !== i))}
                    className="p-0.5 rounded-full hover:bg-gray-300/50"><X className="h-3 w-3" /></button>
                </Badge>
              ))}
            </div>
          )}

          {rankData.length > 0 && (
            <>
              {/* Rank table */}
              <div className="bg-white rounded-2xl border border-gray-200 overflow-hidden">
                <div className="overflow-x-auto">
                  <table className="w-full text-xs">
                    <thead className="bg-gray-50">
                      <tr>
                        <th className="text-left px-4 py-3 font-semibold text-gray-600">Keyword</th>
                        <th className="text-right px-3 py-3 font-semibold text-gray-600">Position</th>
                        <th className="text-right px-3 py-3 font-semibold text-gray-600">Change</th>
                        <th className="text-right px-3 py-3 font-semibold text-gray-600">Best</th>
                        <th className="text-right px-3 py-3 font-semibold text-gray-600">Volume</th>
                        <th className="text-left px-4 py-3 font-semibold text-gray-600">URL</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100">
                      {rankData.map((r, i) => (
                        <tr key={i} className="hover:bg-gray-50 transition-colors">
                          <td className="px-4 py-2.5 font-medium text-gray-800">{r.keyword}</td>
                          <td className="px-3 py-2.5 text-right font-bold text-gray-900 tabular-nums">
                            {r.currentPosition || "—"}
                          </td>
                          <td className="px-3 py-2.5 text-right">
                            {r.change !== 0 && (
                              <span className={cn("flex items-center justify-end gap-0.5 font-semibold",
                                r.change > 0 ? "text-emerald-600" : "text-rose-600")}>
                                {r.change > 0 ? <ArrowUpRight className="h-3 w-3" /> : <ArrowDownRight className="h-3 w-3" />}
                                {Math.abs(r.change)}
                              </span>
                            )}
                            {r.change === 0 && <Minus className="h-3 w-3 text-gray-400 ml-auto" />}
                          </td>
                          <td className="px-3 py-2.5 text-right text-emerald-600 tabular-nums">{r.bestPosition < 999 ? r.bestPosition : "—"}</td>
                          <td className="px-3 py-2.5 text-right text-gray-600 tabular-nums">{fmtNum(r.searchVolume)}</td>
                          <td className="px-4 py-2.5 text-gray-500 truncate max-w-[200px]">{r.url || "—"}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>

              {/* Position trend chart */}
              {rankData.some(r => r.positions.length > 1) && (
                <div className="bg-white rounded-2xl border border-gray-200 p-5">
                  <h4 className="text-sm font-bold text-gray-800 mb-4">Position Trends</h4>
                  <ResponsiveContainer width="100%" height={200}>
                    <LineChart margin={{ top: 4, right: 8, bottom: 0, left: 0 }}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                      <XAxis dataKey="date" tick={{ fontSize: 10, fill: "#94a3b8" }} />
                      <YAxis reversed domain={[1, "auto"]} tick={{ fontSize: 10, fill: "#94a3b8" }} />
                      <RechartsTooltip />
                      {rankData.filter(r => r.positions.length > 1).slice(0, 5).map((r, i) => (
                        <Line
                          key={r.keyword}
                          data={r.positions}
                          dataKey="position"
                          name={r.keyword}
                          stroke={["#3b82f6", "#8b5cf6", "#10b981", "#f59e0b", "#ef4444"][i % 5]}
                          strokeWidth={2}
                          dot={false}
                        />
                      ))}
                    </LineChart>
                  </ResponsiveContainer>
                </div>
              )}
            </>
          )}
        </div>
      )}
    </div>
  );
}
