import { useState, useCallback, useEffect, useMemo } from "react";
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid,
  Tooltip as RechartsTooltip, ResponsiveContainer,
} from "recharts";
import {
  Search, Plus, Trash2, RefreshCw, Loader2, TrendingUp, TrendingDown,
  Minus, ChevronDown, ChevronUp, Download, Upload, Zap, Target, Award,
  BarChart3, Globe, Star, AlertTriangle, CheckCircle, X, Filter,
  ArrowUpRight, ArrowDownRight, Sparkles, Eye,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { fmtNum } from "./helpers";
import type { TopQuery } from "@/hooks/useSEOConnector";

const FN_URL = import.meta.env.VITE_SUPABASE_URL
  ? `${import.meta.env.VITE_SUPABASE_URL}/functions/v1`
  : "https://bvmwnxargzlfheiwyget.supabase.co/functions/v1";

async function callRankCheck(clientId: string, keywords: string[], siteUrl: string, competitorDomains: string[]) {
  const { data: { session } } = await supabase.auth.getSession();
  const res = await fetch(`${FN_URL}/seo-competitive`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${session?.access_token || ""}`,
      apikey: import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY || "",
    },
    body: JSON.stringify({ action: "rank_check", client_id: clientId, keywords, site_url: siteUrl, competitor_domains: competitorDomains }),
  });
  const data = await res.json();
  if (!res.ok || data.error) throw new Error(data.error || `HTTP ${res.status}`);
  return data;
}

// ── Types ─────────────────────────────────────────────────────────────────────

interface TrackedKeyword {
  id: string;
  keyword: string;
  tags: string[];
  created_at: string;
}

interface CompetitorPosition {
  domain: string;
  position: number | null;
  url: string | null;
  title: string | null;
}

interface KeywordPosition {
  keyword: string;
  date: string;
  position: number | null;
  url: string | null;
  title: string | null;
  search_volume: number;
  keyword_difficulty: number | null;
  competitors: CompetitorPosition[];
  serp_features: string[];
  previous_position: number | null;
  change: number | null;
}

interface HistoryRow {
  keyword: string;
  date: string;
  position: number | null;
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function positionColor(pos: number | null): string {
  if (pos === null) return "text-gray-400";
  if (pos <= 3) return "text-emerald-600";
  if (pos <= 10) return "text-blue-600";
  if (pos <= 20) return "text-amber-600";
  return "text-gray-500";
}

function positionBg(pos: number | null): string {
  if (pos === null) return "bg-gray-100";
  if (pos <= 3) return "bg-emerald-100";
  if (pos <= 10) return "bg-blue-100";
  if (pos <= 20) return "bg-amber-100";
  return "bg-gray-100";
}

function difficultyColor(d: number | null): string {
  if (d === null) return "text-gray-400";
  if (d <= 30) return "text-emerald-600";
  if (d <= 60) return "text-amber-600";
  return "text-rose-600";
}

function serpFeatureIcon(feature: string): string {
  const icons: Record<string, string> = {
    featured_snippet: "⭐",
    people_also_ask: "❓",
    local_pack: "📍",
    knowledge_graph: "🧠",
    video: "▶️",
    images: "🖼️",
    shopping: "🛒",
    top_stories: "📰",
  };
  return icons[feature] || "✦";
}

// ── Mini sparkline ────────────────────────────────────────────────────────────

function Sparkline({ data, keyword }: { data: HistoryRow[]; keyword: string }) {
  const pts = data
    .filter(r => r.keyword === keyword && r.position !== null)
    .sort((a, b) => a.date.localeCompare(b.date))
    .slice(-14)
    .map(r => ({ date: r.date, position: r.position }));

  if (pts.length < 2) return <span className="text-xs text-gray-300">—</span>;

  const maxPos = Math.max(...pts.map(p => p.position!));
  const minPos = Math.min(...pts.map(p => p.position!));
  const latest = pts[pts.length - 1].position!;
  const earliest = pts[0].position!;
  const improved = latest < earliest;

  return (
    <ResponsiveContainer width={80} height={28}>
      <LineChart data={pts} margin={{ top: 2, right: 2, bottom: 2, left: 2 }}>
        <Line
          type="monotone"
          dataKey="position"
          stroke={improved ? "#10b981" : "#f59e0b"}
          strokeWidth={1.5}
          dot={false}
          isAnimationActive={false}
        />
        <YAxis domain={[minPos - 1, maxPos + 1]} hide reversed />
      </LineChart>
    </ResponsiveContainer>
  );
}

// ── SERP Feature Badges ───────────────────────────────────────────────────────

function SERPBadges({ features }: { features: string[] }) {
  if (!features.length) return null;
  return (
    <div className="flex gap-1 flex-wrap">
      {features.slice(0, 3).map(f => (
        <span key={f} title={f.replace(/_/g, " ")}
          className="text-[10px] px-1 py-0.5 bg-purple-100 text-purple-600 rounded font-medium cursor-default">
          {serpFeatureIcon(f)}
        </span>
      ))}
      {features.length > 3 && (
        <span className="text-[10px] text-gray-400">+{features.length - 3}</span>
      )}
    </div>
  );
}

// ── Position Badge ────────────────────────────────────────────────────────────

function PosBadge({ pos }: { pos: number | null }) {
  return (
    <span className={cn("text-xs font-bold tabular-nums px-2 py-0.5 rounded-lg min-w-[36px] text-center inline-block",
      positionBg(pos), positionColor(pos))}>
      {pos !== null ? `#${pos}` : "—"}
    </span>
  );
}

// ── Change Badge ──────────────────────────────────────────────────────────────

function ChangeBadge({ change }: { change: number | null }) {
  if (change === null) return <span className="text-gray-300 text-xs">New</span>;
  if (change === 0) return <Minus className="h-3.5 w-3.5 text-gray-300 mx-auto" />;
  const improved = change > 0;
  return (
    <span className={cn("inline-flex items-center gap-0.5 text-[11px] font-bold",
      improved ? "text-emerald-600" : "text-rose-500")}>
      {improved ? <ArrowUpRight className="h-3.5 w-3.5" /> : <ArrowDownRight className="h-3.5 w-3.5" />}
      {Math.abs(change)}
    </span>
  );
}

// ── Add Keywords Modal ────────────────────────────────────────────────────────

function AddKeywordsModal({
  open,
  onClose,
  onAdd,
  suggestedFromGSC,
}: {
  open: boolean;
  onClose: () => void;
  onAdd: (keywords: string[]) => void;
  suggestedFromGSC: TopQuery[];
}) {
  const [text, setText] = useState("");
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [gscSearch, setGscSearch] = useState("");

  if (!open) return null;

  const manualKeywords = text.split("\n").map(k => k.trim()).filter(Boolean);
  const filtered = suggestedFromGSC.filter(q =>
    !gscSearch || q.query.toLowerCase().includes(gscSearch.toLowerCase())
  ).slice(0, 50);

  const toggleGSC = (q: string) => {
    setSelected(prev => {
      const next = new Set(prev);
      next.has(q) ? next.delete(q) : next.add(q);
      return next;
    });
  };

  const handleAdd = () => {
    const all = [...new Set([...manualKeywords, ...Array.from(selected)])].filter(Boolean);
    if (!all.length) { toast.error("Enter at least one keyword"); return; }
    onAdd(all);
    setText(""); setSelected(new Set());
    onClose();
  };

  return (
    <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl max-h-[85vh] flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
          <h3 className="font-bold text-gray-900 text-base">Add Keywords to Track</h3>
          <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-gray-100">
            <X className="h-4 w-4 text-gray-400" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-6 space-y-5">
          {/* Manual entry */}
          <div>
            <Label className="text-xs font-semibold text-gray-600 mb-2 block">Type Keywords (one per line)</Label>
            <textarea
              value={text}
              onChange={e => setText(e.target.value)}
              placeholder={"seo tool\nbest crm software\nyour brand name"}
              className="w-full h-28 text-sm border border-gray-200 rounded-xl p-3 resize-none focus:outline-none focus:ring-2 focus:ring-blue-300 font-mono"
            />
            {manualKeywords.length > 0 && (
              <p className="text-xs text-gray-400 mt-1">{manualKeywords.length} keyword{manualKeywords.length > 1 ? "s" : ""} entered</p>
            )}
          </div>

          {/* Import from GSC */}
          {suggestedFromGSC.length > 0 && (
            <div>
              <div className="flex items-center justify-between mb-2">
                <Label className="text-xs font-semibold text-gray-600">
                  Import from GSC Top Queries
                </Label>
                <span className="text-xs text-gray-400">{selected.size} selected</span>
              </div>
              <div className="relative mb-2">
                <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-gray-400" />
                <input value={gscSearch} onChange={e => setGscSearch(e.target.value)}
                  placeholder="Search GSC queries…"
                  className="w-full pl-8 pr-3 py-1.5 text-xs border border-gray-200 rounded-lg focus:outline-none focus:ring-1 focus:ring-blue-300" />
              </div>
              <div className="space-y-1 max-h-52 overflow-y-auto border border-gray-100 rounded-xl p-2">
                {filtered.map(q => (
                  <button key={q.query} onClick={() => toggleGSC(q.query)}
                    className={cn("w-full text-left px-3 py-2 rounded-lg text-xs flex items-center justify-between transition-all",
                      selected.has(q.query)
                        ? "bg-blue-50 border border-blue-200"
                        : "hover:bg-gray-50 border border-transparent")}>
                    <span className="text-gray-700 truncate flex-1">{q.query}</span>
                    <span className="text-gray-400 ml-3 flex-shrink-0">{fmtNum(q.clicks)} clicks</span>
                    {selected.has(q.query) && <CheckCircle className="h-3.5 w-3.5 text-blue-500 ml-2 flex-shrink-0" />}
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex gap-3 px-6 py-4 border-t border-gray-100">
          <Button variant="outline" onClick={onClose} className="flex-1">Cancel</Button>
          <Button onClick={handleAdd} className="flex-1 bg-blue-600 hover:bg-blue-700 text-white">
            <Plus className="h-4 w-4 mr-1.5" />
            Add {manualKeywords.length + selected.size > 0 ? `${manualKeywords.length + selected.size} Keyword${manualKeywords.length + selected.size > 1 ? "s" : ""}` : "Keywords"}
          </Button>
        </div>
      </div>
    </div>
  );
}

// ── History Chart Modal ───────────────────────────────────────────────────────

function HistoryModal({
  keyword,
  history,
  onClose,
}: {
  keyword: string;
  history: HistoryRow[];
  onClose: () => void;
}) {
  const data = history
    .filter(r => r.keyword === keyword && r.position !== null)
    .sort((a, b) => a.date.localeCompare(b.date))
    .map(r => ({
      date: new Date(r.date + "T00:00:00").toLocaleDateString("en-US", { month: "short", day: "numeric" }),
      position: r.position,
    }));

  const maxPos = Math.max(...data.map(d => d.position!), 1);

  return (
    <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-xl">
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
          <div>
            <h3 className="font-bold text-gray-900 text-sm">Position History</h3>
            <p className="text-xs text-gray-500 mt-0.5">"{keyword}"</p>
          </div>
          <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-gray-100">
            <X className="h-4 w-4 text-gray-400" />
          </button>
        </div>
        <div className="p-6">
          {data.length < 2 ? (
            <div className="text-center py-8 text-gray-400 text-sm">Not enough history yet. Check rankings daily to build a trend.</div>
          ) : (
            <ResponsiveContainer width="100%" height={220}>
              <LineChart data={data} margin={{ top: 8, right: 8, bottom: 0, left: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" vertical={false} />
                <XAxis dataKey="date" tick={{ fontSize: 11, fill: "#9ca3af" }} axisLine={false} tickLine={false} />
                <YAxis reversed domain={[1, maxPos + 2]} tick={{ fontSize: 11, fill: "#9ca3af" }} axisLine={false} tickLine={false} width={28} />
                <RechartsTooltip
                  content={({ active, payload, label }) => {
                    if (!active || !payload?.length) return null;
                    return (
                      <div className="bg-white border border-gray-200 rounded-xl shadow-xl p-3 text-xs">
                        <p className="font-bold text-gray-700 mb-1">{label}</p>
                        <p>Position: <strong>#{payload[0].value}</strong></p>
                      </div>
                    );
                  }}
                />
                <Line type="monotone" dataKey="position" stroke="#3b82f6" strokeWidth={2} dot={{ r: 3, fill: "#3b82f6" }} />
              </LineChart>
            </ResponsiveContainer>
          )}
          <p className="text-[11px] text-gray-400 text-center mt-2">Lower position = higher ranking (inverted Y axis)</p>
        </div>
      </div>
    </div>
  );
}

// ── Main Component ────────────────────────────────────────────────────────────

interface RankTrackerProps {
  clientId: string;
  siteUrl: string | null;
  competitorDomains?: string[];
  gscTopQueries?: TopQuery[];
}

export default function RankTracker({
  clientId,
  siteUrl,
  competitorDomains = [],
  gscTopQueries = [],
}: RankTrackerProps) {
  const [trackedKeywords, setTrackedKeywords] = useState<TrackedKeyword[]>([]);
  const [positions, setPositions] = useState<KeywordPosition[]>([]);
  const [history, setHistory] = useState<HistoryRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [checking, setChecking] = useState(false);
  const [addOpen, setAddOpen] = useState(false);
  const [historyKeyword, setHistoryKeyword] = useState<string | null>(null);
  const [lastChecked, setLastChecked] = useState<string | null>(null);

  const [searchFilter, setSearchFilter] = useState("");
  const [statusFilter, setStatusFilter] = useState<"all" | "top3" | "top10" | "improved" | "declined" | "notranking">("all");
  const [sortBy, setSortBy] = useState<"position" | "keyword" | "volume" | "change">("position");
  const [sortDir, setSortDir] = useState<"asc" | "desc">("asc");

  // ── Load ──────────────────────────────────────────────────────────────────

  const loadAll = useCallback(async () => {
    if (!clientId) return;
    setLoading(true);
    try {
      // ── Direct Supabase calls (no edge function needed) ──────────────────
      const [kwRes, latestRes, histRes] = await Promise.all([
        supabase.from("seo_tracked_keywords" as any)
          .select("*").eq("client_id", clientId).order("created_at", { ascending: true }),
        supabase.from("seo_rank_tracking" as any)
          .select("*").eq("client_id", clientId)
          .order("date", { ascending: false }).limit(1000),
        supabase.from("seo_rank_tracking" as any)
          .select("keyword,date,position,url,competitors,serp_features,search_volume")
          .eq("client_id", clientId).order("date", { ascending: true }).limit(5000),
      ]);

      setTrackedKeywords((kwRes.data as TrackedKeyword[]) || []);
      setHistory((histRes.data as HistoryRow[]) || []);

      // Build latest position per keyword + delta vs previous
      const rows = (latestRes.data || []) as any[];
      const seen = new Set<string>();
      const latest: any[] = [];
      rows.forEach(r => { if (!seen.has(r.keyword)) { seen.add(r.keyword); latest.push(r); } });

      // For delta: find second-most-recent date per keyword
      const prevSeen = new Set<string>();
      const prevMap: Record<string, number | null> = {};
      rows.forEach(r => {
        if (seen.has(r.keyword) && !prevSeen.has(r.keyword) && latest.find(l => l.keyword === r.keyword && l.date !== r.date)) {
          prevMap[r.keyword] = r.position;
          prevSeen.add(r.keyword);
        }
      });

      const positions = latest.map(r => ({
        ...r,
        previous_position: prevMap[r.keyword] ?? null,
        change: (prevMap[r.keyword] != null && r.position != null)
          ? (prevMap[r.keyword] as number) - (r.position as number) : null,
      }));

      setPositions(positions);
      if (positions.length) {
        const dates = positions.map((p: any) => p.date).filter(Boolean);
        if (dates.length) setLastChecked([...dates].sort().reverse()[0]);
      }
    } catch (err: any) {
      console.error("[RankTracker] loadAll:", err);
    } finally {
      setLoading(false);
    }
  }, [clientId]);

  useEffect(() => { loadAll(); }, [loadAll]);

  // ── Add keywords ──────────────────────────────────────────────────────────

  const handleAdd = useCallback(async (keywords: string[]) => {
    try {
      const rows = keywords.map(k => ({ client_id: clientId, keyword: k.toLowerCase().trim(), tags: [] }));
      const { error } = await supabase.from("seo_tracked_keywords" as any).upsert(rows, { onConflict: "client_id,keyword" });
      if (error) throw new Error(error.message);
      toast.success(`${keywords.length} keyword${keywords.length > 1 ? "s" : ""} added`);
      await loadAll();
    } catch (err: any) {
      toast.error("Failed to add keywords: " + err.message);
    }
  }, [clientId, loadAll]);

  // ── Remove keyword ────────────────────────────────────────────────────────

  const handleRemove = useCallback(async (keyword: string) => {
    try {
      await Promise.all([
        supabase.from("seo_tracked_keywords" as any).delete().eq("client_id", clientId).eq("keyword", keyword),
        supabase.from("seo_rank_tracking" as any).delete().eq("client_id", clientId).eq("keyword", keyword),
      ]);
      setTrackedKeywords(p => p.filter(k => k.keyword !== keyword));
      setPositions(p => p.filter(k => k.keyword !== keyword));
      toast.success("Keyword removed");
    } catch (err: any) {
      toast.error("Failed to remove: " + err.message);
    }
  }, [clientId]);

  // ── Check rankings now ────────────────────────────────────────────────────

  const checkRankings = useCallback(async () => {
    if (!siteUrl) { toast.error("No site URL — connect GSC first"); return; }
    if (!trackedKeywords.length) { toast.error("No keywords to track — add some first"); return; }
    setChecking(true);
    try {
      const keywords = trackedKeywords.map(k => k.keyword);
      await callRankCheck(clientId, keywords, siteUrl, competitorDomains);
      toast.success("Rankings updated");
      await loadAll();
    } catch (err: any) {
      toast.error("Rank check failed: " + err.message);
    } finally {
      setChecking(false);
    }
  }, [clientId, siteUrl, trackedKeywords, competitorDomains, loadAll]);

  // ── Export CSV ────────────────────────────────────────────────────────────

  const exportCSV = useCallback(() => {
    const headers = ["Keyword","Position","Change","Search Volume","URL","SERP Features"];
    const rows = positions.map(p => [
      p.keyword,
      p.position ?? "Not ranking",
      p.change !== null ? (p.change > 0 ? `+${p.change}` : String(p.change)) : "New",
      p.search_volume || "",
      p.url || "",
      (p.serp_features || []).join(";"),
    ]);
    const csv = [headers, ...rows].map(r => r.map(c => `"${String(c).replace(/"/g, '""')}"`).join(",")).join("\n");
    const blob = new Blob([csv], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a"); a.href = url; a.download = "rank-tracker.csv"; a.click();
    URL.revokeObjectURL(url);
  }, [positions]);

  // ── Filtered + sorted rows ────────────────────────────────────────────────

  // Merge tracked keywords with positions (show all tracked, even if no position yet)
  const mergedRows = useMemo((): KeywordPosition[] => {
    const posMap: Record<string, KeywordPosition> = {};
    for (const p of positions) posMap[p.keyword] = p;
    return trackedKeywords.map(k => posMap[k.keyword] || {
      keyword: k.keyword, date: "", position: null, url: null, title: null,
      search_volume: 0, keyword_difficulty: null, competitors: [], serp_features: [],
      previous_position: null, change: null,
    });
  }, [trackedKeywords, positions]);

  const displayRows = useMemo(() => {
    let rows = mergedRows;
    if (searchFilter) rows = rows.filter(r => r.keyword.toLowerCase().includes(searchFilter.toLowerCase()));
    if (statusFilter === "top3") rows = rows.filter(r => r.position !== null && r.position <= 3);
    if (statusFilter === "top10") rows = rows.filter(r => r.position !== null && r.position <= 10);
    if (statusFilter === "improved") rows = rows.filter(r => r.change !== null && r.change > 0);
    if (statusFilter === "declined") rows = rows.filter(r => r.change !== null && r.change < 0);
    if (statusFilter === "notranking") rows = rows.filter(r => r.position === null);

    rows = [...rows].sort((a, b) => {
      let va: any, vb: any;
      if (sortBy === "position") { va = a.position ?? 999; vb = b.position ?? 999; }
      else if (sortBy === "keyword") { va = a.keyword; vb = b.keyword; }
      else if (sortBy === "volume") { va = a.search_volume || 0; vb = b.search_volume || 0; }
      else { va = a.change ?? -999; vb = b.change ?? -999; }
      if (va < vb) return sortDir === "asc" ? -1 : 1;
      if (va > vb) return sortDir === "asc" ? 1 : -1;
      return 0;
    });
    return rows;
  }, [mergedRows, searchFilter, statusFilter, sortBy, sortDir]);

  // ── Summary stats ──────────────────────────────────────────────────────────

  const stats = useMemo(() => {
    const ranked = mergedRows.filter(r => r.position !== null);
    return {
      total: trackedKeywords.length,
      top3: ranked.filter(r => r.position! <= 3).length,
      top10: ranked.filter(r => r.position! <= 10).length,
      top20: ranked.filter(r => r.position! <= 20).length,
      notRanking: mergedRows.filter(r => r.position === null).length,
      improved: mergedRows.filter(r => r.change !== null && r.change > 0).length,
      declined: mergedRows.filter(r => r.change !== null && r.change < 0).length,
      avgPosition: ranked.length
        ? Math.round(ranked.reduce((s, r) => s + r.position!, 0) / ranked.length)
        : null,
    };
  }, [mergedRows, trackedKeywords]);

  // ── Sort toggle ────────────────────────────────────────────────────────────

  const toggleSort = (col: typeof sortBy) => {
    if (sortBy === col) setSortDir(d => d === "asc" ? "desc" : "asc");
    else { setSortBy(col); setSortDir("asc"); }
  };

  const SortIcon = ({ col }: { col: typeof sortBy }) => (
    sortBy === col
      ? (sortDir === "asc" ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />)
      : <ChevronDown className="h-3 w-3 text-gray-300" />
  );

  if (loading) {
    return (
      <div className="flex items-center justify-center py-16">
        <Loader2 className="h-7 w-7 animate-spin text-gray-300" />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* ── Header ─────────────────────────────────────────────────────────── */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h3 className="text-sm font-bold text-gray-900 flex items-center gap-2">
            <Target className="h-4 w-4 text-blue-500" />
            Keyword Rank Tracker
          </h3>
          <p className="text-xs text-gray-400 mt-0.5">
            {siteUrl || "No site connected"} · {trackedKeywords.length} keywords tracked
            {lastChecked && ` · Last checked ${new Date(lastChecked + "T00:00:00").toLocaleDateString()}`}
          </p>
        </div>
        <div className="flex gap-2 flex-wrap">
          <Button variant="outline" size="sm" onClick={exportCSV} disabled={!positions.length}
            className="gap-1.5 text-xs h-8">
            <Download className="h-3.5 w-3.5" /> Export
          </Button>
          <Button variant="outline" size="sm" onClick={() => setAddOpen(true)} className="gap-1.5 text-xs h-8">
            <Plus className="h-3.5 w-3.5" /> Add Keywords
          </Button>
          <Button size="sm" onClick={checkRankings} disabled={checking || !trackedKeywords.length}
            className="gap-1.5 text-xs h-8 bg-blue-600 hover:bg-blue-700 text-white">
            {checking ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <RefreshCw className="h-3.5 w-3.5" />}
            {checking ? "Checking…" : "Check Rankings"}
          </Button>
        </div>
      </div>

      {/* ── Summary cards ─────────────────────────────────────────────────── */}
      {trackedKeywords.length > 0 && (
        <div className="grid grid-cols-3 sm:grid-cols-4 lg:grid-cols-7 gap-2">
          {[
            { label: "Tracked", value: stats.total, color: "text-gray-700 bg-gray-50", border: "border-gray-200" },
            { label: "Avg Pos.", value: stats.avgPosition !== null ? `#${stats.avgPosition}` : "—", color: "text-blue-700 bg-blue-50", border: "border-blue-200" },
            { label: "Top 3", value: stats.top3, color: "text-emerald-700 bg-emerald-50", border: "border-emerald-200" },
            { label: "Top 10", value: stats.top10, color: "text-blue-700 bg-blue-50", border: "border-blue-200" },
            { label: "Top 20", value: stats.top20, color: "text-amber-700 bg-amber-50", border: "border-amber-200" },
            { label: "↑ Improved", value: stats.improved, color: "text-emerald-700 bg-emerald-50", border: "border-emerald-200" },
            { label: "↓ Declined", value: stats.declined, color: "text-rose-700 bg-rose-50", border: "border-rose-200" },
          ].map(s => (
            <div key={s.label} className={cn("rounded-xl border p-3 text-center", s.border)}>
              <p className={cn("text-lg font-bold", s.color.split(" ")[0])}>{s.value}</p>
              <p className="text-[10px] text-gray-500 font-medium">{s.label}</p>
            </div>
          ))}
        </div>
      )}

      {/* ── Position distribution bar ─────────────────────────────────────── */}
      {trackedKeywords.length > 0 && stats.total > 0 && (
        <div className="bg-white rounded-2xl border border-gray-200/80 shadow-sm p-4">
          <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-3">Position Distribution</p>
          <div className="flex gap-1 h-5 rounded-lg overflow-hidden">
            {[
              { label: "1–3", count: stats.top3, color: "bg-emerald-400" },
              { label: "4–10", count: stats.top10 - stats.top3, color: "bg-blue-400" },
              { label: "11–20", count: stats.top20 - stats.top10, color: "bg-amber-400" },
              { label: "21+", count: Math.max(0, (mergedRows.filter(r => r.position !== null && r.position > 20).length)), color: "bg-gray-300" },
              { label: "Not ranking", count: stats.notRanking, color: "bg-gray-200" },
            ].filter(s => s.count > 0).map(s => (
              <div key={s.label} title={`${s.label}: ${s.count} keyword${s.count > 1 ? "s" : ""}`}
                className={cn("h-full flex items-center justify-center text-[10px] text-white font-bold transition-all cursor-default", s.color)}
                style={{ flex: s.count }}>
                {s.count >= 2 ? s.count : ""}
              </div>
            ))}
          </div>
          <div className="flex gap-3 mt-2 flex-wrap">
            {[
              { label: "Top 3", color: "bg-emerald-400" },
              { label: "4–10", color: "bg-blue-400" },
              { label: "11–20", color: "bg-amber-400" },
              { label: "21+", color: "bg-gray-300" },
              { label: "Not ranking", color: "bg-gray-200" },
            ].map(s => (
              <span key={s.label} className="flex items-center gap-1 text-[10px] text-gray-500">
                <span className={cn("w-2 h-2 rounded-full", s.color)} /> {s.label}
              </span>
            ))}
          </div>
        </div>
      )}

      {/* ── Empty state ───────────────────────────────────────────────────── */}
      {trackedKeywords.length === 0 && (
        <div className="bg-gray-50 border border-dashed border-gray-200 rounded-2xl p-10 text-center">
          <Target className="h-10 w-10 text-gray-300 mx-auto mb-3" />
          <p className="font-semibold text-gray-600">No keywords tracked yet</p>
          <p className="text-sm text-gray-400 mt-1 mb-4">
            Add keywords to monitor your Google rankings daily — including competitor positions side by side.
          </p>
          <Button onClick={() => setAddOpen(true)} className="bg-blue-600 hover:bg-blue-700 text-white gap-2">
            <Plus className="h-4 w-4" /> Add First Keywords
          </Button>
        </div>
      )}

      {/* ── Filters ───────────────────────────────────────────────────────── */}
      {trackedKeywords.length > 0 && (
        <div className="flex items-center gap-3 flex-wrap">
          <div className="relative flex-1 min-w-48">
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-gray-400" />
            <input type="text" placeholder="Filter keywords…" value={searchFilter}
              onChange={e => setSearchFilter(e.target.value)}
              className="w-full pl-8 pr-3 py-1.5 text-xs border border-gray-200 rounded-lg focus:outline-none focus:ring-1 focus:ring-blue-300" />
          </div>
          <div className="flex bg-gray-100 rounded-xl p-1 gap-1 flex-wrap">
            {([
              { id: "all", label: "All" },
              { id: "top3", label: "Top 3" },
              { id: "top10", label: "Top 10" },
              { id: "improved", label: "↑ Improved" },
              { id: "declined", label: "↓ Declined" },
              { id: "notranking", label: "Not Ranking" },
            ] as const).map(f => (
              <button key={f.id} onClick={() => setStatusFilter(f.id)}
                className={cn("px-2.5 py-1 rounded-lg text-xs font-semibold transition-all",
                  statusFilter === f.id ? "bg-white shadow-sm text-gray-800" : "text-gray-500 hover:text-gray-700")}>
                {f.label}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* ── Main table ────────────────────────────────────────────────────── */}
      {trackedKeywords.length > 0 && (
        <div className="bg-white rounded-2xl border border-gray-200/80 shadow-sm overflow-hidden">
          {/* Table header */}
          <div className={cn(
            "grid gap-2 px-4 py-2.5 bg-gray-50 border-b border-gray-100 text-[10px] font-semibold text-gray-500 uppercase tracking-wider",
            competitorDomains.length > 0
              ? `grid-cols-[1fr_80px_60px_70px_70px_90px_80px_40px]`
              : `grid-cols-[1fr_80px_60px_70px_90px_80px_40px]`
          )}>
            <button className="flex items-center gap-1 text-left" onClick={() => toggleSort("keyword")}>
              Keyword <SortIcon col="keyword" />
            </button>
            <button className="flex items-center gap-1 justify-center" onClick={() => toggleSort("position")}>
              Position <SortIcon col="position" />
            </button>
            <button className="flex items-center gap-1 justify-center" onClick={() => toggleSort("change")}>
              Change <SortIcon col="change" />
            </button>
            <button className="flex items-center gap-1 justify-center" onClick={() => toggleSort("volume")}>
              Volume <SortIcon col="volume" />
            </button>
            {competitorDomains.length > 0 && (
              <span className="text-center">Competitors</span>
            )}
            <span className="text-center">SERP</span>
            <span className="text-center">Trend</span>
            <span />
          </div>

          {/* Rows */}
          <div className="divide-y divide-gray-50">
            {displayRows.length === 0 ? (
              <div className="text-center py-8 text-gray-400 text-sm">No keywords match your filter</div>
            ) : displayRows.map(row => (
              <div key={row.keyword}
                className={cn(
                  "grid gap-2 px-4 py-3 hover:bg-gray-50/60 items-center transition-colors",
                  competitorDomains.length > 0
                    ? `grid-cols-[1fr_80px_60px_70px_70px_90px_80px_40px]`
                    : `grid-cols-[1fr_80px_60px_70px_90px_80px_40px]`
                )}>
                {/* Keyword */}
                <div className="min-w-0">
                  <p className="text-xs font-semibold text-gray-800 truncate">{row.keyword}</p>
                  {row.url && (
                    <a href={row.url} target="_blank" rel="noopener noreferrer"
                      className="text-[10px] text-blue-500 hover:underline truncate block max-w-full">
                      {row.url.replace(/^https?:\/\//, "").slice(0, 45)}
                    </a>
                  )}
                </div>

                {/* Position */}
                <div className="flex justify-center">
                  <PosBadge pos={row.position} />
                </div>

                {/* Change */}
                <div className="flex justify-center">
                  <ChangeBadge change={row.change} />
                </div>

                {/* Search Volume */}
                <div className="text-center">
                  <span className="text-xs text-gray-600 tabular-nums">
                    {row.search_volume ? fmtNum(row.search_volume) : "—"}
                  </span>
                </div>

                {/* Competitor positions */}
                {competitorDomains.length > 0 && (
                  <div className="flex flex-col gap-0.5">
                    {competitorDomains.slice(0, 2).map((cd) => {
                      const comp = (row.competitors || []).find(c => c.domain === cd);
                      return (
                        <div key={cd} className="flex items-center gap-1.5 text-[10px]">
                          <span className="text-gray-400 truncate max-w-[40px]" title={cd}>
                            {cd.replace(/^https?:\/\//, "").split("/")[0].slice(0, 10)}
                          </span>
                          <PosBadge pos={comp?.position || null} />
                        </div>
                      );
                    })}
                  </div>
                )}

                {/* SERP Features */}
                <div className="flex justify-center">
                  <SERPBadges features={row.serp_features || []} />
                </div>

                {/* Sparkline */}
                <div className="flex justify-center" onClick={() => setHistoryKeyword(row.keyword)}
                  style={{ cursor: "pointer" }}>
                  <Sparkline data={history} keyword={row.keyword} />
                </div>

                {/* Actions */}
                <div className="flex justify-end">
                  <button onClick={() => handleRemove(row.keyword)}
                    className="p-1.5 rounded-lg hover:bg-red-50 text-gray-300 hover:text-red-400 transition-colors">
                    <Trash2 className="h-3.5 w-3.5" />
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ── Competitor legend ─────────────────────────────────────────────── */}
      {competitorDomains.length > 0 && trackedKeywords.length > 0 && (
        <p className="text-[11px] text-gray-400 text-center">
          Competitor positions shown for: {competitorDomains.join(", ")}
        </p>
      )}

      {/* ── Modals ────────────────────────────────────────────────────────── */}
      <AddKeywordsModal
        open={addOpen}
        onClose={() => setAddOpen(false)}
        onAdd={handleAdd}
        suggestedFromGSC={gscTopQueries}
      />
      {historyKeyword && (
        <HistoryModal
          keyword={historyKeyword}
          history={history}
          onClose={() => setHistoryKeyword(null)}
        />
      )}
    </div>
  );
}
