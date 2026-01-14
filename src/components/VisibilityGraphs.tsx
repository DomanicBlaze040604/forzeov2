/**
 * ============================================================================
 * VISIBILITY GRAPHS COMPONENT
 * ============================================================================
 * 
 * Two graphs for tracking brand and overall visibility over time:
 * - Brand Visibility: SOV, rank, citations trends
 * - Overall Visibility: Aggregated metrics across all prompts
 * 
 * Features:
 * - Auto-updates when new runs complete
 * - Date/time on each data point
 * - Click to view run details
 * 
 * @version 1.0.0
 */

import { useState, useEffect, useMemo } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { supabase } from "@/integrations/supabase/client";
import { TrendingUp, TrendingDown, Minus, Calendar, Clock, ExternalLink, RefreshCw, Filter, Sparkles } from "lucide-react";
import { Input } from "@/components/ui/input";

// ============================================
// TYPES
// ============================================

interface ScheduleRun {
    id: string;
    schedule_id: string;
    client_id: string;
    prompt_id: string | null;
    prompt_text: string;
    status: string;
    share_of_voice: number;
    visibility_score: number;
    average_rank: number | null;
    total_citations: number;
    total_cost: number;
    model_results: Array<{
        model: string;
        success: boolean;
        brand_mentioned: boolean;
        brand_mention_count: number;
        brand_rank: number | null;
        citations: Array<{ url: string; title: string; domain: string }>;
        raw_response: string;
    }>;
    tavily_results: {
        answer?: string;
        sources?: Array<{ url: string; title: string; content: string; domain: string }>;
    } | null;
    sources: Array<{ url: string; title: string; domain: string }>;
    started_at: string;
    completed_at: string;
}

interface VisibilityDataPoint {
    date: string;
    time: string;
    timestamp: Date;
    sov: number;
    rank: number | null;
    citations: number;
    runs: ScheduleRun[];
}

interface VisibilityGraphsProps {
    clientId: string;
    brandName: string;
}

// ============================================
// BAR CHART WITH DATETIME
// ============================================

function BarChart({
    data,
    dataKey,
    color,
    height = 140,
    onBarClick,
}: {
    data: VisibilityDataPoint[];
    dataKey: "sov" | "rank" | "citations";
    color: string;
    height?: number;
    onBarClick?: (point: VisibilityDataPoint) => void;
}) {
    const [hoveredIndex, setHoveredIndex] = useState<number | null>(null);

    if (data.length === 0) {
        return (
            <div className="flex items-center justify-center h-[140px] text-gray-400 text-sm">
                No data yet
            </div>
        );
    }

    const values = data.map(d => d[dataKey] ?? 0);
    const max = Math.max(...values, 1);
    const barWidth = Math.max(8, Math.min(40, 300 / data.length));


    // For rank, invert display (lower is better)
    const getBarHeight = (value: number) => {
        if (dataKey === "rank") {
            // Invert: highest rank (worst) = short bar, lowest rank (best) = tall bar
            const inverted = max > 0 ? (max - value + 1) / max : 0;
            return Math.max(4, inverted * (height - 30));
        }
        return Math.max(4, (value / max) * (height - 30));
    };



    return (
        <div className="relative" style={{ height }}>
            {/* Chart area */}
            <div className="flex items-end justify-center gap-[2px] h-[110px] px-2">
                {data.map((point, i) => {
                    const value = point[dataKey] ?? 0;
                    const barHeight = getBarHeight(value);
                    const isHovered = hoveredIndex === i;

                    return (
                        <div
                            key={i}
                            className="relative flex flex-col items-center"
                            onMouseEnter={() => setHoveredIndex(i)}
                            onMouseLeave={() => setHoveredIndex(null)}
                        >
                            {/* Tooltip */}
                            {isHovered && (
                                <div className="absolute bottom-full mb-2 z-20 bg-gray-900 text-white rounded-lg shadow-xl p-3 text-xs whitespace-nowrap transform -translate-x-1/2 left-1/2">
                                    <div className="font-semibold text-sm mb-1">{point.date} {point.time}</div>
                                    <div className="space-y-1 text-gray-300">
                                        <div className="flex justify-between gap-4">
                                            <span>SOV:</span>
                                            <span className="font-medium text-green-400">{point.sov}%</span>
                                        </div>
                                        <div className="flex justify-between gap-4">
                                            <span>Rank:</span>
                                            <span className="font-medium text-blue-400">{point.rank ? `#${point.rank}` : "N/A"}</span>
                                        </div>
                                        <div className="flex justify-between gap-4">
                                            <span>Citations:</span>
                                            <span className="font-medium text-purple-400">{point.citations}</span>
                                        </div>
                                        <div className="flex justify-between gap-4 pt-1 border-t border-gray-700">
                                            <span>Runs:</span>
                                            <span className="font-medium">{point.runs.length}</span>
                                        </div>
                                    </div>
                                    <div className="text-[10px] text-gray-400 mt-2">Click for details</div>
                                    {/* Arrow */}
                                    <div className="absolute top-full left-1/2 -translate-x-1/2 border-4 border-transparent border-t-gray-900" />
                                </div>
                            )}

                            {/* Bar */}
                            <div
                                className="cursor-pointer transition-all duration-200 rounded-t"
                                style={{
                                    width: barWidth,
                                    height: barHeight,
                                    backgroundColor: isHovered ? color : `${color}cc`,
                                    transform: isHovered ? "scaleY(1.05)" : "scaleY(1)",
                                    transformOrigin: "bottom",
                                }}
                                onClick={() => onBarClick?.(point)}
                            />
                        </div>
                    );
                })}
            </div>

            {/* X-axis labels */}
            <div className="flex justify-between px-2 mt-1">
                {data.length <= 10 ? (
                    data.map((point, i) => (
                        <div key={i} className="text-[9px] text-gray-400 text-center" style={{ width: barWidth }}>
                            {point.date.split(" ")[0]}
                        </div>
                    ))
                ) : (
                    <>
                        <div className="text-[9px] text-gray-400">{data[0]?.date}</div>
                        <div className="text-[9px] text-gray-400">{data[Math.floor(data.length / 2)]?.date}</div>
                        <div className="text-[9px] text-gray-400">{data[data.length - 1]?.date}</div>
                    </>
                )}
            </div>
        </div>
    );
}

// ============================================
// MAIN COMPONENT
// ============================================

export function VisibilityGraphs({ clientId, brandName }: VisibilityGraphsProps) {
    const [runs, setRuns] = useState<ScheduleRun[]>([]);
    const [loading, setLoading] = useState(true);
    const [timeRange, setTimeRange] = useState<"24h" | "7d" | "30d" | "all">("7d");
    const [selectedRun, setSelectedRun] = useState<ScheduleRun | null>(null);
    const [dialogOpen, setDialogOpen] = useState(false);
    const [dataSource, setDataSource] = useState<"all" | "scheduled" | "manual">("all");
    const [viewMode, setViewMode] = useState<"charts" | "log">("charts");
    const [filterDialogOpen, setFilterDialogOpen] = useState(false);
    const [filterSovMin, setFilterSovMin] = useState("");
    const [filterRankMax, setFilterRankMax] = useState("");
    const [filterModel, setFilterModel] = useState("all");

    // Fetch runs from both scheduled runs AND existing audit results
    useEffect(() => {
        fetchAllData();

        // Set up realtime subscription for new scheduled runs
        const channel = supabase
            .channel("schedule_runs_changes")
            .on(
                "postgres_changes",
                { event: "INSERT", schema: "public", table: "schedule_runs", filter: `client_id=eq.${clientId}` },
                (payload) => {
                    console.log("[VisibilityGraphs] New run:", payload.new);
                    setRuns(prev => [payload.new as ScheduleRun, ...prev]);
                }
            )
            .subscribe();

        return () => {
            supabase.removeChannel(channel);
        };
    }, [clientId, timeRange, dataSource]);

    const fetchAllData = async () => {
        setLoading(true);
        try {
            const now = new Date();
            let startDate: string | null = null;

            if (timeRange === "24h") {
                startDate = new Date(now.getTime() - 24 * 60 * 60 * 1000).toISOString();
            } else if (timeRange === "7d") {
                startDate = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000).toISOString();
            } else if (timeRange === "30d") {
                startDate = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000).toISOString();
            }

            const allRuns: ScheduleRun[] = [];

            // Fetch from schedule_runs (scheduled/automated runs)
            if (dataSource === "all" || dataSource === "scheduled") {
                let scheduledQuery = supabase
                    .from("schedule_runs")
                    .select("*")
                    .eq("client_id", clientId)
                    .eq("status", "completed")
                    .order("started_at", { ascending: true });

                if (startDate) {
                    scheduledQuery = scheduledQuery.gte("started_at", startDate);
                }

                const { data: scheduledData } = await scheduledQuery;
                if (scheduledData) {
                    allRuns.push(...scheduledData);
                }
            }

            // Fetch from audit_results (manual audits run from dashboard)
            if (dataSource === "all" || dataSource === "manual") {
                let auditQuery = supabase
                    .from("audit_results")
                    .select("*")
                    .eq("client_id", clientId)
                    .order("created_at", { ascending: true });

                if (startDate) {
                    auditQuery = auditQuery.gte("created_at", startDate);
                }

                const { data: auditData } = await auditQuery;
                if (auditData) {
                    // Convert audit_results format to ScheduleRun format for unified display
                    const convertedAudits: ScheduleRun[] = auditData.map((audit: {
                        id: string;
                        client_id: string;
                        prompt_id: string;
                        prompt_text: string;
                        model_results: ScheduleRun["model_results"];
                        share_of_voice?: number;
                        visibility_score?: number;
                        average_rank?: number;
                        total_citations?: number;
                        total_cost?: number;
                        created_at: string;
                    }) => ({
                        id: audit.id,
                        schedule_id: "manual",
                        client_id: audit.client_id,
                        prompt_id: audit.prompt_id,
                        prompt_text: audit.prompt_text,
                        status: "completed",
                        share_of_voice: audit.share_of_voice ||
                            Math.round((audit.model_results?.filter((mr: { brand_mentioned?: boolean }) => mr.brand_mentioned).length || 0) /
                                (audit.model_results?.length || 1) * 100),
                        visibility_score: audit.visibility_score || 0,
                        average_rank: audit.average_rank ||
                            (audit.model_results?.find((mr: { brand_rank?: number | null }) => mr.brand_rank)?.brand_rank || null),
                        total_citations: audit.total_citations ||
                            audit.model_results?.reduce((sum: number, mr: { citations?: unknown[] }) => sum + (mr.citations?.length || 0), 0) || 0,
                        total_cost: audit.total_cost || 0,
                        model_results: audit.model_results || [],
                        tavily_results: null,
                        sources: audit.model_results?.flatMap((mr: { citations?: Array<{ url: string; title: string; domain: string }> }) =>
                            mr.citations?.map((c: { url: string; title: string; domain: string }) => ({ url: c.url, title: c.title, domain: c.domain })) || []
                        ) || [],
                        started_at: audit.created_at,
                        completed_at: audit.created_at,
                    }));
                    allRuns.push(...convertedAudits);
                }
            }

            // Sort by date and dedupe
            allRuns.sort((a, b) => new Date(a.started_at).getTime() - new Date(b.started_at).getTime());

            setRuns(allRuns);
        } catch (err) {
            console.error("[VisibilityGraphs] Error fetching data:", err);
        } finally {
            setLoading(false);
        }
    };

    // Process data for charts
    const chartData = useMemo((): VisibilityDataPoint[] => {
        if (runs.length === 0) return [];

        // Group runs by hour
        const grouped: Record<string, ScheduleRun[]> = {};
        for (const run of runs) {
            const date = new Date(run.started_at);
            const key = `${date.getFullYear()}-${date.getMonth()}-${date.getDate()}-${date.getHours()}`;
            if (!grouped[key]) grouped[key] = [];
            grouped[key].push(run);
        }

        return Object.entries(grouped).map(([_, groupRuns]) => {
            const latest = groupRuns[groupRuns.length - 1];
            const date = new Date(latest.started_at);

            // Calculate averages for the group
            const avgSov = Math.round(groupRuns.reduce((sum, r) => sum + r.share_of_voice, 0) / groupRuns.length);
            const ranksWithValue = groupRuns.filter(r => r.average_rank !== null);
            const avgRank = ranksWithValue.length > 0
                ? Math.round(ranksWithValue.reduce((sum, r) => sum + (r.average_rank || 0), 0) / ranksWithValue.length * 10) / 10
                : null;
            const totalCitations = groupRuns.reduce((sum, r) => sum + r.total_citations, 0);

            return {
                date: date.toLocaleDateString("en-US", { month: "short", day: "numeric" }),
                time: date.toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit" }),
                timestamp: date,
                sov: avgSov,
                rank: avgRank,
                citations: totalCitations,
                runs: groupRuns,
            };
        }).sort((a, b) => a.timestamp.getTime() - b.timestamp.getTime());
    }, [runs]);

    // Calculate trends
    const trends = useMemo(() => {
        if (chartData.length < 2) return { sov: 0, rank: 0, citations: 0 };

        const first = chartData[0];
        const last = chartData[chartData.length - 1];

        return {
            sov: last.sov - first.sov,
            rank: first.rank && last.rank ? first.rank - last.rank : 0, // Positive = improvement (lower rank)
            citations: last.citations - first.citations,
        };
    }, [chartData]);

    const filteredRuns = useMemo(() => {
        return runs.filter(run => {
            if (filterSovMin && run.share_of_voice < Number(filterSovMin)) return false;
            if (filterRankMax) {
                if (!run.average_rank) return false;
                if (run.average_rank > Number(filterRankMax)) return false;
            }
            if (filterModel !== "all") {
                const hasModel = run.model_results.some(m => m.model.toLowerCase().includes(filterModel.toLowerCase()));
                if (!hasModel) return false;
            }
            return true;
        });
    }, [runs, filterSovMin, filterRankMax, filterModel]);

    const handlePointClick = (point: VisibilityDataPoint) => {
        if (point.runs.length > 0) {
            setSelectedRun(point.runs[point.runs.length - 1]);
            setDialogOpen(true);
        }
    };

    const TrendIcon = ({ value, inverted = false }: { value: number; inverted?: boolean }) => {
        const isPositive = inverted ? value > 0 : value > 0;
        if (value === 0) return <Minus className="h-4 w-4 text-gray-400" />;
        if (isPositive) return <TrendingUp className="h-4 w-4 text-green-500" />;
        return <TrendingDown className="h-4 w-4 text-red-500" />;
    };

    return (
        <div className="space-y-6">
            {/* Header */}
            <div className="flex items-center justify-between">
                <div>
                    <h2 className="text-xl font-semibold text-gray-900">Visibility Analytics</h2>
                    <p className="text-sm text-gray-500">Track {brandName}'s AI visibility over time</p>
                </div>
                <div className="flex items-center gap-3">
                    <Select value={dataSource} onValueChange={(v) => setDataSource(v as typeof dataSource)}>
                        <SelectTrigger className="w-32">
                            <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                            <SelectItem value="all">All Data</SelectItem>
                            <SelectItem value="manual">Manual Runs</SelectItem>
                            <SelectItem value="scheduled">Scheduled</SelectItem>
                        </SelectContent>
                    </Select>
                    <Select value={timeRange} onValueChange={(v) => setTimeRange(v as typeof timeRange)}>
                        <SelectTrigger className="w-32">
                            <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                            <SelectItem value="24h">Last 24h</SelectItem>
                            <SelectItem value="7d">Last 7 days</SelectItem>
                            <SelectItem value="30d">Last 30 days</SelectItem>
                            <SelectItem value="all">All time</SelectItem>
                        </SelectContent>
                    </Select>
                    <Button variant="outline" size="sm" onClick={() => setFilterDialogOpen(true)}>
                        <Filter className="h-4 w-4 mr-2" />
                        Filters
                    </Button>
                    <Button variant="outline" size="sm" onClick={fetchAllData} disabled={loading}>
                        <RefreshCw className={`h-4 w-4 mr-2 ${loading ? "animate-spin" : ""}`} />
                        Refresh
                    </Button>
                </div>
            </div>

            {/* Filters Dialog */}
            <Dialog open={filterDialogOpen} onOpenChange={setFilterDialogOpen}>
                <DialogContent className="sm:max-w-[425px]">
                    <DialogHeader>
                        <DialogTitle>Advanced Filters</DialogTitle>
                    </DialogHeader>
                    <div className="grid gap-4 py-4">
                        <div className="grid grid-cols-2 gap-4">
                            <div className="space-y-2">
                                <label className="text-sm font-medium">Min SOV %</label>
                                <Input type="number" value={filterSovMin} onChange={(e) => setFilterSovMin(e.target.value)} placeholder="0" />
                            </div>
                            <div className="space-y-2">
                                <label className="text-sm font-medium">Max Rank</label>
                                <Input type="number" value={filterRankMax} onChange={(e) => setFilterRankMax(e.target.value)} placeholder="10" />
                            </div>
                        </div>
                        <div className="space-y-2">
                            <label className="text-sm font-medium">Model</label>
                            <Select value={filterModel} onValueChange={setFilterModel}>
                                <SelectTrigger><SelectValue placeholder="All Models" /></SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="all">All Models</SelectItem>
                                    <SelectItem value="chatgpt">ChatGPT</SelectItem>
                                    <SelectItem value="claude">Claude</SelectItem>
                                    <SelectItem value="gemini">Gemini</SelectItem>
                                    <SelectItem value="perplexity">Perplexity</SelectItem>
                                    <SelectItem value="google_ai_overview">Google AI Overview</SelectItem>
                                </SelectContent>
                            </Select>
                        </div>
                    </div>
                </DialogContent>
            </Dialog>

            {/* Main Content Tabs */}
            <div className="flex items-center bg-gray-100 p-1 rounded-lg w-fit mb-4">
                <button
                    onClick={() => setViewMode("charts")}
                    className={`px-4 py-2 text-sm font-medium rounded-md transition-all ${viewMode === "charts" ? "bg-white text-gray-900 shadow-sm" : "text-gray-600 hover:text-gray-900"}`}
                >
                    Charts & Metrics
                </button>
                <button
                    onClick={() => setViewMode("log")}
                    className={`px-4 py-2 text-sm font-medium rounded-md transition-all ${viewMode === "log" ? "bg-white text-gray-900 shadow-sm" : "text-gray-600 hover:text-gray-900"}`}
                >
                    Audit Log
                </button>
            </div>

            {viewMode === "charts" ? (
                <div className="space-y-6 animate-in fade-in duration-300">
                    {/* Graphs Grid */}
                    <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
                        {/* Share of Voice */}
                        <Card>
                            <CardHeader className="pb-2">
                                <div className="flex items-center justify-between">
                                    <CardTitle className="text-sm font-medium text-gray-600">Share of Voice</CardTitle>
                                    <div className="flex items-center gap-1">
                                        <TrendIcon value={trends.sov} />
                                        <span className={`text-sm ${trends.sov > 0 ? "text-green-600" : trends.sov < 0 ? "text-red-600" : "text-gray-400"}`}>
                                            {trends.sov > 0 ? "+" : ""}{trends.sov}%
                                        </span>
                                    </div>
                                </div>
                                <div className="text-2xl font-bold text-gray-900">
                                    {chartData.length > 0 ? `${chartData[chartData.length - 1].sov}%` : "—"}
                                </div>
                            </CardHeader>
                            <CardContent>
                                <BarChart
                                    data={chartData}
                                    dataKey="sov"
                                    color="#10b981"
                                    onBarClick={handlePointClick}
                                />
                            </CardContent>
                        </Card>

                        {/* Average Rank */}
                        <Card>
                            <CardHeader className="pb-2">
                                <div className="flex items-center justify-between">
                                    <CardTitle className="text-sm font-medium text-gray-600">Average Rank</CardTitle>
                                    <div className="flex items-center gap-1">
                                        <TrendIcon value={trends.rank} inverted />
                                        <span className={`text-sm ${trends.rank > 0 ? "text-green-600" : trends.rank < 0 ? "text-red-600" : "text-gray-400"}`}>
                                            {trends.rank > 0 ? "+" : ""}{trends.rank.toFixed(1)}
                                        </span>
                                    </div>
                                </div>
                                <div className="text-2xl font-bold text-gray-900">
                                    {chartData.length > 0 && chartData[chartData.length - 1].rank !== null
                                        ? `#${chartData[chartData.length - 1].rank}`
                                        : "—"}
                                </div>
                            </CardHeader>
                            <CardContent>
                                <BarChart
                                    data={chartData}
                                    dataKey="rank"
                                    color="#3b82f6"
                                    onBarClick={handlePointClick}
                                />
                            </CardContent>
                        </Card>

                        {/* Citations */}
                        <Card>
                            <CardHeader className="pb-2">
                                <div className="flex items-center justify-between">
                                    <CardTitle className="text-sm font-medium text-gray-600">Total Citations</CardTitle>
                                    <div className="flex items-center gap-1">
                                        <TrendIcon value={trends.citations} />
                                        <span className={`text-sm ${trends.citations > 0 ? "text-green-600" : trends.citations < 0 ? "text-red-600" : "text-gray-400"}`}>
                                            {trends.citations > 0 ? "+" : ""}{trends.citations}
                                        </span>
                                    </div>
                                </div>
                                <div className="text-2xl font-bold text-gray-900">
                                    {chartData.length > 0 ? chartData[chartData.length - 1].citations : "—"}
                                </div>
                            </CardHeader>
                            <CardContent>
                                <BarChart
                                    data={chartData}
                                    dataKey="citations"
                                    color="#8b5cf6"
                                    onBarClick={handlePointClick}
                                />
                            </CardContent>
                        </Card>
                    </div>

                    {/* Recent Runs (Simplified for Charts view) */}
                    <Card>
                        <CardHeader>
                            <CardTitle className="text-sm font-medium text-gray-600">Recent Runs Overview</CardTitle>
                        </CardHeader>
                        <CardContent>
                            <div className="space-y-2">
                                {filteredRuns.slice(0, 5).map((run) => (
                                    <div
                                        key={run.id}
                                        className="flex items-center justify-between p-3 bg-gray-50 rounded-lg hover:bg-gray-100 cursor-pointer transition-colors"
                                        onClick={() => { setSelectedRun(run); setDialogOpen(true); }}
                                    >
                                        <div className="flex flex-col gap-1 flex-1 min-w-0 px-4">
                                            <div className="flex items-center gap-3">
                                                <div className="flex items-center gap-2 text-xs text-gray-500">
                                                    <Calendar className="h-3.5 w-3.5" />
                                                    {new Date(run.started_at).toLocaleDateString()}
                                                </div>
                                                <div className="flex items-center gap-2 text-xs text-gray-500">
                                                    <Clock className="h-3.5 w-3.5" />
                                                    {new Date(run.started_at).toLocaleTimeString()}
                                                </div>
                                            </div>
                                            <div className="text-sm font-medium text-gray-900 truncate" title={run.prompt_text}>
                                                {run.prompt_text}
                                            </div>
                                        </div>
                                        <div className="flex items-center gap-2 flex-shrink-0">
                                            <Badge variant="outline" className="bg-green-50 text-green-700 border-green-200">
                                                {run.share_of_voice}%
                                            </Badge>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </CardContent>
                    </Card>
                </div>
            ) : (
                <div className="space-y-4 animate-in fade-in duration-300">
                    <Card>
                        <CardHeader>
                            <div className="flex items-center justify-between">
                                <CardTitle>Comprehensive Audit Log</CardTitle>
                                <div className="text-sm text-gray-500">{filteredRuns.length} runs found</div>
                            </div>
                        </CardHeader>
                        <CardContent>
                            <div className="rounded-md border">
                                <table className="w-full text-sm text-left">
                                    <thead className="bg-gray-50 text-gray-500 border-b">
                                        <tr>
                                            <th className="h-10 px-4 font-medium">Date & Time</th>
                                            <th className="h-10 px-4 font-medium w-1/3">Prompt</th>
                                            <th className="h-10 px-4 font-medium text-center">SOV</th>
                                            <th className="h-10 px-4 font-medium text-center">Rank</th>
                                            <th className="h-10 px-4 font-medium text-center">Citations</th>
                                            <th className="h-10 px-4 font-medium text-right">Action</th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y">
                                        {filteredRuns.map((run) => (
                                            <tr key={run.id} className="hover:bg-gray-50 transition-colors">
                                                <td className="p-4 align-middle">
                                                    <div className="flex flex-col">
                                                        <span className="font-medium text-gray-900">{new Date(run.started_at).toLocaleDateString()}</span>
                                                        <span className="text-gray-500 text-xs">{new Date(run.started_at).toLocaleTimeString()}</span>
                                                    </div>
                                                </td>
                                                <td className="p-4 align-middle">
                                                    <div className="font-medium text-gray-900 truncate max-w-[300px]" title={run.prompt_text}>
                                                        {run.prompt_text}
                                                    </div>
                                                </td>
                                                <td className="p-4 align-middle text-center">
                                                    <Badge variant="outline" className={`bg-green-50 text-green-700 border-green-200 ${run.share_of_voice > 50 ? "bg-green-100" : ""}`}>
                                                        {run.share_of_voice}%
                                                    </Badge>
                                                </td>
                                                <td className="p-4 align-middle text-center">
                                                    {run.average_rank ? (
                                                        <Badge variant="outline" className="bg-blue-50 text-blue-700 border-blue-200">
                                                            #{run.average_rank}
                                                        </Badge>
                                                    ) : <span className="text-gray-400">-</span>}
                                                </td>
                                                <td className="p-4 align-middle text-center">
                                                    <div className="font-medium text-purple-700">{run.total_citations}</div>
                                                </td>
                                                <td className="p-4 align-middle text-right">
                                                    <Button size="sm" variant="ghost" className="h-8 w-8 p-0" onClick={() => { setSelectedRun(run); setDialogOpen(true); }}>
                                                        <ExternalLink className="h-4 w-4" />
                                                    </Button>
                                                </td>
                                            </tr>
                                        ))}
                                        {filteredRuns.length === 0 && (
                                            <tr>
                                                <td colSpan={6} className="p-8 text-center text-gray-500">
                                                    No audits found matching your filters.
                                                </td>
                                            </tr>
                                        )}
                                    </tbody>
                                </table>
                            </div>
                        </CardContent>
                    </Card>
                </div>
            )}

            {/* Run Detail Dialog */}
            <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
                <DialogContent className="max-w-4xl max-h-[85vh] flex flex-col p-0 gap-0 bg-white">
                    <DialogHeader className="p-6 pb-2 border-b">
                        <DialogTitle className="flex items-center justify-between">
                            <span>Run Details</span>
                            <span className="text-sm font-normal text-gray-500">{selectedRun && new Date(selectedRun.started_at).toLocaleString()}</span>
                        </DialogTitle>
                    </DialogHeader>
                    {selectedRun && (
                        <div className="overflow-y-auto p-6 space-y-8">
                            {/* Summary */}
                            <div className="grid grid-cols-4 gap-4">
                                <div className="p-4 bg-green-50 rounded-xl border border-green-100">
                                    <div className="text-sm text-green-600 font-medium mb-1">Share of Voice</div>
                                    <div className="text-3xl font-bold text-green-700">{selectedRun.share_of_voice}%</div>
                                </div>
                                <div className="p-4 bg-blue-50 rounded-xl border border-blue-100">
                                    <div className="text-sm text-blue-600 font-medium mb-1">Average Rank</div>
                                    <div className="text-3xl font-bold text-blue-700">
                                        {selectedRun.average_rank ? `#${selectedRun.average_rank}` : "N/A"}
                                    </div>
                                </div>
                                <div className="bg-gradient-to-br from-purple-50 to-violet-50 border border-purple-200 rounded-xl p-4 text-center">
                                    <div className="text-3xl font-bold text-purple-700">{selectedRun.total_citations}</div>
                                    <div className="text-sm font-medium text-purple-600 mt-1">Citations</div>
                                </div>
                            </div>

                            {/* Prompt */}
                            <div className="bg-gray-50 p-4 rounded-xl border border-gray-100">
                                <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2">Analyzed Prompt</h3>
                                <div className="text-gray-900 font-medium text-lg leading-relaxed">{selectedRun.prompt_text}</div>
                            </div>

                            {/* Tavily Answer */}
                            {selectedRun.tavily_results?.answer && (
                                <div>
                                    <h3 className="text-lg font-semibold text-gray-900 mb-3 flex items-center gap-2">
                                        <Sparkles className="h-5 w-5 text-purple-500" /> AI Executive Summary
                                    </h3>
                                    <div className="p-4 bg-gradient-to-r from-purple-50 to-blue-50 rounded-xl border border-blue-100 text-gray-800 leading-relaxed shadow-sm">
                                        {selectedRun.tavily_results.answer}
                                    </div>
                                </div>
                            )}

                            {/* Top Sources */}
                            <div>
                                <h3 className="text-lg font-semibold text-gray-900 mb-3">Top Sources</h3>
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                                    {(() => {
                                        const citationCounts = new Map<string, number>();
                                        selectedRun.model_results?.forEach(mr => {
                                            mr.citations?.forEach(c => {
                                                citationCounts.set(c.domain, (citationCounts.get(c.domain) || 0) + 1);
                                            });
                                        });

                                        return (selectedRun.sources || []).slice(0, 10).map((source, i) => {
                                            const count = citationCounts.get(source.domain) || 1;
                                            const isFrequent = count > 1;

                                            return (
                                                <a
                                                    key={i}
                                                    href={source.url}
                                                    target="_blank"
                                                    rel="noopener noreferrer"
                                                    className={`flex items-center gap-3 p-3 rounded-lg border transition-all ${isFrequent ? "bg-amber-50 border-amber-200 hover:shadow-md" : "bg-white border-gray-200 hover:border-gray-300 hover:shadow-sm"}`}
                                                >
                                                    <div className={`flex items-center justify-center w-6 h-6 rounded-full text-xs font-bold ${isFrequent ? "bg-amber-100 text-amber-700" : "bg-gray-100 text-gray-600"}`}>
                                                        {i + 1}
                                                    </div>
                                                    <div className="flex-1 min-w-0">
                                                        <div className="font-medium text-gray-900 truncate">{source.title || source.domain}</div>
                                                        <div className="text-xs text-gray-500 truncate">{source.domain}</div>
                                                    </div>
                                                    {isFrequent && (
                                                        <Badge variant="secondary" className="bg-amber-100 text-amber-700 border-amber-200 whitespace-nowrap">
                                                            {count} mentions
                                                        </Badge>
                                                    )}
                                                </a>
                                            );
                                        });
                                    })()}
                                </div>
                            </div>

                            {/* Model Results */}
                            <div>
                                <h3 className="text-lg font-semibold text-gray-900 mb-3">Model Analysis</h3>
                                <div className="space-y-6">
                                    {(selectedRun.model_results || []).map((mr, i) => (
                                        <div key={i} className="border border-gray-200 rounded-xl overflow-hidden shadow-sm hover:shadow-md transition-shadow">
                                            <div className="bg-gray-50 px-4 py-3 border-b border-gray-100 flex items-center justify-between">
                                                <span className="font-semibold text-gray-900 flex items-center gap-2">
                                                    {mr.model}
                                                </span>
                                                <div className="flex items-center gap-2">
                                                    {mr.brand_mentioned ? (
                                                        <Badge className="bg-green-100 text-green-700 hover:bg-green-200 border-none">Visible</Badge>
                                                    ) : (
                                                        <Badge variant="outline" className="text-gray-500">Not Visible</Badge>
                                                    )}
                                                    {mr.brand_rank && <Badge className="bg-blue-100 text-blue-700 hover:bg-blue-200 border-none">#{mr.brand_rank}</Badge>}
                                                </div>
                                            </div>
                                            <div className="p-4 bg-white">
                                                <div className="prose prose-sm max-w-none text-gray-700">
                                                    <pre className="whitespace-pre-wrap font-sans text-sm leading-relaxed">{mr.raw_response}</pre>
                                                </div>

                                                {mr.citations && mr.citations.length > 0 && (
                                                    <div className="mt-4 pt-4 border-t border-gray-100">
                                                        <div className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2">Sources Cited</div>
                                                        <div className="flex flex-wrap gap-2">
                                                            {mr.citations.map((c, k) => (
                                                                <a key={k} href={c.url} target="_blank" rel="noreferrer" className="text-xs flex items-center gap-1 px-2 py-1 bg-gray-50 text-gray-600 rounded-md hover:bg-gray-100 border border-gray-200 transition-colors">
                                                                    <ExternalLink className="h-3 w-3" />
                                                                    {c.domain}
                                                                </a>
                                                            ))}
                                                        </div>
                                                    </div>
                                                )}
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        </div>
                    )}
                </DialogContent>
            </Dialog>
        </div>
    );
}


export default VisibilityGraphs;
