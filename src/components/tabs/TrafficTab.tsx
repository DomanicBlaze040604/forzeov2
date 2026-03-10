import { useMemo, useState } from "react";
import {
    ComposedChart,
    Line,
    Bar,
    XAxis,
    YAxis,
    CartesianGrid,
    Tooltip as RechartsTooltip,
    Legend,
    ResponsiveContainer,
    PieChart,
    Pie,
    Cell,
} from "recharts";
import {
    BarChart3,
    Unlink,
    TrendingUp,
    TrendingDown,
    ArrowUpRight,
    ArrowDownRight,
    RefreshCw,
    Settings2,
    Trash2,
    CheckCircle,
    ChevronDown,
    Loader2,
    Users,
    Clock,
    MousePointerClick,
    Activity,
    Target,
    Network,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select";
import { cn } from "@/lib/utils";
import { type GA4ConnectorHook, type GA4Property, type GA4Stream } from "@/hooks/useGA4Connector";
import type { Client } from "@/hooks/useClientDashboard";

// ── Source style config ────────────────────────────────────────────────────
const SOURCE_CONFIG: Record<string, { color: string; icon: string; bg: string; border: string }> = {
    ChatGPT:    { color: "#10a37f", icon: "🤖", bg: "bg-emerald-50", border: "border-emerald-200/60" },
    Perplexity: { color: "#6366f1", icon: "🔮", bg: "bg-indigo-50",  border: "border-indigo-200/60" },
    Gemini:     { color: "#4285f4", icon: "✨", bg: "bg-blue-50",    border: "border-blue-200/60" },
    Claude:     { color: "#d97706", icon: "🧠", bg: "bg-amber-50",   border: "border-amber-200/60" },
    Copilot:    { color: "#0078d4", icon: "🔵", bg: "bg-sky-50",     border: "border-sky-200/60" },
    "Meta AI":  { color: "#0668E1", icon: "🌐", bg: "bg-blue-50",    border: "border-blue-200/60" },
};

const PRIMARY_SOURCES = ["ChatGPT", "Perplexity", "Gemini", "Claude"];
const LLM_SOURCES = new Set(["ChatGPT", "Perplexity", "Gemini", "Claude", "Copilot", "Meta AI"]);
const CHANNEL_SOURCES = new Set(["Total", "Direct", "Referral"]);
const CHANNEL_COLORS: Record<string, string> = { Total: "#6b7280", LLM: "#3b82f6", Direct: "#10b981", Referral: "#f59e0b" };

// ── Helpers ─────────────────────────────────────────────────────────────────

function formatDuration(seconds: number): string {
    if (!seconds || seconds <= 0) return "0s";
    if (seconds < 60) return `${Math.round(seconds)}s`;
    const mins = Math.floor(seconds / 60);
    const secs = Math.round(seconds % 60);
    return secs > 0 ? `${mins}m ${secs}s` : `${mins}m`;
}

function calcGrowth(current: number, prev: number): number | null {
    if (prev === 0 && current === 0) return null;
    if (prev === 0) return 100;
    return ((current - prev) / prev) * 100;
}

function GrowthBadge({ value }: { value: number | null }) {
    if (value === null) return null;
    const isPositive = value > 0;
    const isZero = value === 0;
    if (isZero) return null;
    return (
        <span className={cn(
            "inline-flex items-center gap-0.5 text-[11px] font-bold px-1.5 py-0.5 rounded-md",
            isPositive ? "text-emerald-700 bg-emerald-100" : "text-rose-700 bg-rose-100"
        )}>
            {isPositive ? <TrendingUp className="h-3 w-3" /> : <TrendingDown className="h-3 w-3" />}
            {isPositive ? "+" : ""}{value.toFixed(0)}%
        </span>
    );
}

// ── Custom Recharts Tooltip ────────────────────────────────────────────────
function CustomTooltip({ active, payload, label }: any) {
    if (!active || !payload?.length) return null;
    return (
        <div className="bg-white/95 backdrop-blur-sm border border-gray-200 rounded-xl shadow-2xl p-3.5 text-xs min-w-[190px]">
            <p className="font-bold text-gray-800 mb-2 text-[13px]">{label}</p>
            {payload.map((entry: any) => (
                <div key={entry.name} className="flex items-center justify-between gap-6 py-0.5">
                    <span className="flex items-center gap-2">
                        <span className="inline-block w-2.5 h-2.5 rounded-full shadow-sm" style={{ backgroundColor: entry.color }} />
                        <span className="text-gray-600">{entry.name}</span>
                    </span>
                    <span className="font-bold text-gray-900 tabular-nums">
                        {entry.name === "SOV %" ? `${(entry.value || 0).toFixed(1)}%` : (entry.value || 0).toLocaleString()}
                    </span>
                </div>
            ))}
        </div>
    );
}

// ── Confirm Disconnect Modal ───────────────────────────────────────────────
function ConfirmDisconnectModal({
    open,
    onConfirm,
    onCancel,
}: {
    open: boolean;
    onConfirm: () => void;
    onCancel: () => void;
}) {
    if (!open) return null;
    return (
        <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4">
            <div className="bg-white rounded-2xl shadow-2xl max-w-sm w-full p-6 animate-in zoom-in-95">
                <div className="flex items-center gap-3 mb-4">
                    <div className="p-2 bg-red-100 rounded-xl">
                        <Unlink className="h-5 w-5 text-red-600" />
                    </div>
                    <h3 className="font-semibold text-gray-900 text-base">Disconnect Google Analytics?</h3>
                </div>
                <p className="text-sm text-gray-600 mb-6">
                    This will stop all traffic syncing. Your existing sync data will be preserved. You can reconnect at any time.
                </p>
                <div className="flex gap-3">
                    <Button variant="outline" className="flex-1" onClick={onCancel}>Cancel</Button>
                    <Button className="flex-1 bg-red-600 hover:bg-red-700 text-white" onClick={onConfirm}>
                        Disconnect
                    </Button>
                </div>
            </div>
        </div>
    );
}

// ── Disconnected empty state ───────────────────────────────────────────────
function DisconnectedState({ onOpenSettings }: { onOpenSettings: () => void }) {
    return (
        <div className="flex flex-col items-center justify-center py-20 text-center">
            <div className="p-5 bg-gradient-to-br from-blue-50 to-indigo-50 rounded-2xl mb-5 border border-blue-100">
                <BarChart3 className="h-12 w-12 text-blue-500 mx-auto" />
            </div>
            <h3 className="text-lg font-semibold text-gray-900 mb-2">
                Connect Google Analytics to see your AI Traffic
            </h3>
            <p className="text-sm text-gray-500 max-w-md mb-6 leading-relaxed">
                See how AI citations from ChatGPT, Perplexity, Gemini and Claude translate
                into real website visits and conversions.
            </p>
            <Button onClick={onOpenSettings} className="bg-blue-600 hover:bg-blue-700 text-white gap-2 h-11 px-6 rounded-xl font-semibold shadow-md transition-all active:scale-95">
                Connect Google Analytics
                <ArrowUpRight className="h-4 w-4" />
            </Button>
        </div>
    );
}

// ────────────────────────────────────────────────────────────────────────────
// TrafficTab Component
// ────────────────────────────────────────────────────────────────────────────

interface TrafficTabProps {
    selectedClient: Client | null;
    sovTimeSeries: {
        labels: string[];
        series: Array<{ name: string; isClient: boolean; data: (number | null)[] }>;
    };
    onOpenSettings: () => void;
    ga4: GA4ConnectorHook;
}

export function TrafficTab({ sovTimeSeries, onOpenSettings, ga4 }: TrafficTabProps) {
    const [rangeFilter, setRangeFilter] = useState<"7d" | "30d" | "90d">("30d");
    const [showConfigure, setShowConfigure] = useState(false);
    const [showDisconnectModal, setShowDisconnectModal] = useState(false);
    const [channelLines, setChannelLines] = useState<Record<string, boolean>>({ Total: true, LLM: true, Direct: true, Referral: true });

    const {
        integration,
        trafficData,
        syncing,
        listProperties,
        listStreams,
        saveProperty,
        triggerSync,
        disconnect,
    } = ga4;

    const [properties, setProperties] = useState<GA4Property[]>([]);
    const [streams, setStreams] = useState<GA4Stream[]>([]);
    const [selectedProperty, setSelectedProperty] = useState<GA4Property | null>(null);
    const [selectedStream, setSelectedStream] = useState<GA4Stream | null>(null);
    const [loadingProps, setLoadingProps] = useState(false);
    const [loadingStreams, setLoadingStreams] = useState(false);
    const [, setPropError] = useState<string | null>(null);
    const [, setStreamError] = useState<string | null>(null);
    const [completing, setCompleting] = useState(false);

    const isConnected = integration?.status === "connected";

    const fetchProperties = async () => {
        setLoadingProps(true);
        setPropError(null);
        try {
            const p = await listProperties();
            setProperties(p);
        } catch (e: any) {
            setPropError(e.message || "Failed to load properties");
        } finally {
            setLoadingProps(false);
        }
    };

    const handlePropertyChange = async (propId: string) => {
        const prop = properties.find((p) => p.id === propId) || null;
        setSelectedProperty(prop);
        setSelectedStream(null);
        setStreams([]);
        if (!prop) return;
        setLoadingStreams(true);
        try {
            const s = await listStreams(prop.id);
            setStreams(s);
        } catch (e: any) {
            setStreamError(e.message || "Failed to load streams");
        } finally {
            setLoadingStreams(false);
        }
    };

    const handleSave = async () => {
        if (!selectedProperty || !selectedStream) return;
        setCompleting(true);
        try {
            await saveProperty(selectedProperty, selectedStream);
            setShowConfigure(false);
        } finally {
            setCompleting(false);
        }
    };

    // ── Summary stats (Total AI Sessions, Active Users, Engagement, Duration) ──
    const summaryStats = useMemo(() => {
        const days = rangeFilter === "7d" ? 7 : rangeFilter === "30d" ? 30 : 90;
        const now = new Date();
        const cutoffCurrent = new Date(now.getTime() - days * 86400000);
        const cutoffCurrentStr = cutoffCurrent.toISOString().split("T")[0];
        const cutoffPrev = new Date(cutoffCurrent.getTime() - days * 86400000);
        const cutoffPrevStr = cutoffPrev.toISOString().split("T")[0];

        let sessions = 0, activeUsers = 0, engRateSum = 0, durSum = 0, count = 0;
        let pSessions = 0, pActiveUsers = 0, pEngRateSum = 0, pDurSum = 0, pCount = 0;

        for (const row of trafficData) {
            if (CHANNEL_SOURCES.has(row.source)) continue;
            if (row.sync_date >= cutoffCurrentStr) {
                sessions += row.sessions;
                activeUsers += row.active_users || 0;
                engRateSum += row.engagement_rate || 0;
                durSum += row.avg_session_duration || 0;
                count++;
            } else if (row.sync_date >= cutoffPrevStr) {
                pSessions += row.sessions;
                pActiveUsers += row.active_users || 0;
                pEngRateSum += row.engagement_rate || 0;
                pDurSum += row.avg_session_duration || 0;
                pCount++;
            }
        }

        return {
            sessions,
            activeUsers,
            avgEngagement: count > 0 ? engRateSum / count : 0,
            avgDuration: count > 0 ? durSum / count : 0,
            sessionsGrowth: calcGrowth(sessions, pSessions),
            usersGrowth: calcGrowth(activeUsers, pActiveUsers),
            engGrowth: pCount > 0 ? calcGrowth(engRateSum / count || 0, pEngRateSum / pCount) : null,
            durGrowth: pCount > 0 ? calcGrowth(durSum / count || 0, pDurSum / pCount) : null,
        };
    }, [trafficData, rangeFilter]);

    // ── Per-source session aggregation ────────────────────────────────────────
    const sessionsBySource = useMemo(() => {
        const days = rangeFilter === "7d" ? 7 : rangeFilter === "30d" ? 30 : 90;
        const now = new Date();
        const cutoffCurrent = new Date(now.getTime() - days * 86400000);
        const cutoffCurrentStr = cutoffCurrent.toISOString().split("T")[0];
        const cutoffPrev = new Date(cutoffCurrent.getTime() - days * 86400000);
        const cutoffPrevStr = cutoffPrev.toISOString().split("T")[0];

        const totals: Record<string, { sessions: number; prevSessions: number; activeUsers: number; engagementRate: number; duration: number; count: number }> = {};
        for (const source of Object.keys(SOURCE_CONFIG)) {
            totals[source] = { sessions: 0, prevSessions: 0, activeUsers: 0, engagementRate: 0, duration: 0, count: 0 };
        }

        for (const row of trafficData) {
            const s = totals[row.source];
            if (!s) continue;
            if (row.sync_date >= cutoffCurrentStr) {
                s.sessions += row.sessions;
                s.activeUsers += row.active_users || 0;
                s.engagementRate += row.engagement_rate || 0;
                s.duration += row.avg_session_duration || 0;
                s.count++;
            } else if (row.sync_date >= cutoffPrevStr) {
                s.prevSessions += row.sessions;
            }
        }
        return totals;
    }, [trafficData, rangeFilter]);

    // ── Visible sources (primary 4 + extras with data) ────────────────────────
    const visibleSources = useMemo(() => {
        const extra = Object.keys(sessionsBySource).filter(
            s => !PRIMARY_SOURCES.includes(s) && sessionsBySource[s]?.sessions > 0
        );
        return [...PRIMARY_SOURCES, ...extra];
    }, [sessionsBySource]);

    // ── Active sources for charts ─────────────────────────────────────────────
    const activeSources = useMemo(() => {
        return Object.keys(SOURCE_CONFIG).filter(source => sessionsBySource[source]?.sessions > 0);
    }, [sessionsBySource]);

    // ── Chart data (date-aligned) ─────────────────────────────────────────────
    const chartData = useMemo(() => {
        if (!isConnected || !trafficData.length) return [];

        const days = rangeFilter === "7d" ? 7 : rangeFilter === "30d" ? 30 : 90;
        const now = new Date();

        const dateRange: string[] = [];
        for (let i = days; i >= 0; i--) {
            const d = new Date(now.getTime() - i * 86400000);
            dateRange.push(d.toISOString().split("T")[0]);
        }

        const cutoffStr = dateRange[0];
        const trafficByDate: Record<string, Record<string, number>> = {};
        for (const row of trafficData) {
            if (row.sync_date < cutoffStr || CHANNEL_SOURCES.has(row.source)) continue;
            if (!trafficByDate[row.sync_date]) trafficByDate[row.sync_date] = {};
            trafficByDate[row.sync_date][row.source] =
                (trafficByDate[row.sync_date][row.source] || 0) + row.sessions;
        }

        const clientSeries = sovTimeSeries.series.find((s) => s.isClient);

        return dateRange.map((dateStr, idx) => {
            const label = new Date(dateStr + "T00:00:00").toLocaleDateString("en-US", {
                month: "short",
                day: "numeric",
            });
            const traffic = trafficByDate[dateStr] || {};
            const totalSessions = Object.values(traffic).reduce((a, b) => a + b, 0);

            const sovLabel = sovTimeSeries.labels[Math.min(idx, sovTimeSeries.labels.length - 1)];
            const sovLabelIdx = sovTimeSeries.labels.indexOf(sovLabel);
            const sovValue = clientSeries?.data[sovLabelIdx] ?? null;

            return {
                date: label,
                "SOV %": sovValue,
                "AI Sessions": totalSessions,
                ...Object.fromEntries(
                    Object.keys(SOURCE_CONFIG).map(source => [source, traffic[source] || 0])
                ),
            };
        });
    }, [isConnected, trafficData, rangeFilter, sovTimeSeries]);

    // ── Conversion table data ─────────────────────────────────────────────────
    const conversionTableData = useMemo(() => {
        const days = rangeFilter === "7d" ? 7 : rangeFilter === "30d" ? 30 : 90;
        const cutoff = new Date();
        cutoff.setDate(cutoff.getDate() - days);
        const cutoffStr = cutoff.toISOString().split("T")[0];

        const agg: Record<string, { sessions: number; conversions: number; activeUsers: number; engagementRateSum: number; durationSum: number; count: number }> = {};
        for (const row of trafficData) {
            if (row.sync_date < cutoffStr || CHANNEL_SOURCES.has(row.source)) continue;
            if (!agg[row.source]) agg[row.source] = { sessions: 0, conversions: 0, activeUsers: 0, engagementRateSum: 0, durationSum: 0, count: 0 };
            agg[row.source].sessions += row.sessions;
            agg[row.source].conversions += row.conversions;
            agg[row.source].activeUsers += row.active_users || 0;
            agg[row.source].engagementRateSum += row.engagement_rate || 0;
            agg[row.source].durationSum += row.avg_session_duration || 0;
            agg[row.source].count++;
        }

        const totalSessions = Object.values(agg).reduce((s, d) => s + d.sessions, 0);

        return Object.entries(agg)
            .map(([source, data]) => ({
                source,
                sessions: data.sessions,
                conversions: data.conversions,
                activeUsers: data.activeUsers,
                avgEngagement: data.count > 0 ? data.engagementRateSum / data.count : 0,
                avgDuration: data.count > 0 ? data.durationSum / data.count : 0,
                share: totalSessions > 0 ? (data.sessions / totalSessions) * 100 : 0,
                cvr: data.sessions > 0 ? ((data.conversions / data.sessions) * 100).toFixed(1) : "0.0",
            }))
            .sort((a, b) => b.sessions - a.sessions);
    }, [trafficData, rangeFilter]);

    const totalSessions = conversionTableData.reduce((s, r) => s + r.sessions, 0);
    const totalConversions = conversionTableData.reduce((s, r) => s + r.conversions, 0);
    const totalActiveUsers = conversionTableData.reduce((s, r) => s + r.activeUsers, 0);
    const totalAvgEngagement = conversionTableData.length > 0
        ? conversionTableData.reduce((s, r) => s + r.avgEngagement, 0) / conversionTableData.length
        : 0;
    const totalAvgDuration = conversionTableData.length > 0
        ? conversionTableData.reduce((s, r) => s + r.avgDuration, 0) / conversionTableData.length
        : 0;

    const hasAnyData = totalSessions > 0 || chartData.some(d => d["AI Sessions"] > 0);

    // ── Donut data with share percentages ─────────────────────────────────────
    const donutData = useMemo(() => {
        return conversionTableData
            .filter(r => r.sessions > 0)
            .map(r => ({
                name: r.source,
                value: r.sessions,
                share: r.share,
                color: SOURCE_CONFIG[r.source]?.color || "#cbd5e1",
            }));
    }, [conversionTableData]);

    // ── Multi-channel chart data (Total, LLM, Direct, Referral per date) ─────
    const channelChartData = useMemo(() => {
        if (!isConnected || !trafficData.length) return [];

        const days = rangeFilter === "7d" ? 7 : rangeFilter === "30d" ? 30 : 90;
        const now = new Date();
        const cutoff = new Date(now.getTime() - days * 86400000);
        const cutoffStr = cutoff.toISOString().split("T")[0];

        const dateMap: Record<string, { date: string; Total: number; LLM: number; Direct: number; Referral: number }> = {};

        for (const row of trafficData) {
            if (row.sync_date < cutoffStr) continue;
            if (!dateMap[row.sync_date]) {
                dateMap[row.sync_date] = { date: row.sync_date, Total: 0, LLM: 0, Direct: 0, Referral: 0 };
            }
            const entry = dateMap[row.sync_date];
            if (row.source === "Total") entry.Total = row.sessions;
            else if (row.source === "Direct") entry.Direct = row.sessions;
            else if (row.source === "Referral") entry.Referral = row.sessions;
            else if (LLM_SOURCES.has(row.source)) entry.LLM += row.sessions;
        }

        return Object.values(dateMap).sort((a, b) => a.date.localeCompare(b.date));
    }, [isConnected, trafficData, rangeFilter]);

    const hasChannelData = channelChartData.some(d => d.Total > 0);

    // ── CVR Delta: LLM vs non-LLM ────────────────────────────────────────────
    const cvrDelta = useMemo(() => {
        const days = rangeFilter === "7d" ? 7 : rangeFilter === "30d" ? 30 : 90;
        const cutoff = new Date(Date.now() - days * 86400000);
        const cutoffStr = cutoff.toISOString().split("T")[0];

        let llmSessions = 0, llmConversions = 0;
        let totalSessions = 0, totalConversions = 0;

        for (const row of trafficData) {
            if (row.sync_date < cutoffStr) continue;
            if (row.source === "Total") {
                totalSessions += row.sessions;
                totalConversions += row.conversions;
            } else if (LLM_SOURCES.has(row.source)) {
                llmSessions += row.sessions;
                llmConversions += row.conversions;
            }
        }

        const llmCvr = llmSessions > 0 ? (llmConversions / llmSessions) * 100 : 0;
        const nonLlmSessions = totalSessions - llmSessions;
        const nonLlmConversions = totalConversions - llmConversions;
        const nonLlmCvr = nonLlmSessions > 0 ? (nonLlmConversions / nonLlmSessions) * 100 : 0;
        const lift = nonLlmCvr > 0 ? ((llmCvr - nonLlmCvr) / nonLlmCvr) * 100 : 0;

        return { llmCvr, nonLlmCvr, lift, totalSessions };
    }, [trafficData, rangeFilter]);

    // ── Engagement: LLM avg duration vs overall avg duration ──────────────────
    const engagementDelta = useMemo(() => {
        const days = rangeFilter === "7d" ? 7 : rangeFilter === "30d" ? 30 : 90;
        const cutoff = new Date(Date.now() - days * 86400000);
        const cutoffStr = cutoff.toISOString().split("T")[0];

        let llmDurW = 0, llmW = 0, totalDurW = 0, totalW = 0;

        for (const row of trafficData) {
            if (row.sync_date < cutoffStr) continue;
            if (row.source === "Total") {
                totalDurW += row.avg_session_duration * row.sessions;
                totalW += row.sessions;
            } else if (LLM_SOURCES.has(row.source)) {
                llmDurW += row.avg_session_duration * row.sessions;
                llmW += row.sessions;
            }
        }

        return {
            llmAvg: llmW > 0 ? llmDurW / llmW : 0,
            overallAvg: totalW > 0 ? totalDurW / totalW : 0,
        };
    }, [trafficData, rangeFilter]);

    const rangeLabel = rangeFilter === "7d" ? "7 days" : rangeFilter === "30d" ? "30 days" : "90 days";

    // ── Not connected ─────────────────────────────────────────────────────────
    if (!isConnected) {
        return (
            <div className="space-y-6 fade-in">
                <div className="bg-white rounded-2xl border border-gray-200 p-6">
                    <DisconnectedState onOpenSettings={onOpenSettings} />
                </div>
            </div>
        );
    }

    return (
        <div className="space-y-5 fade-in relative">
            <ConfirmDisconnectModal
                open={showDisconnectModal}
                onConfirm={() => { setShowDisconnectModal(false); disconnect(); }}
                onCancel={() => setShowDisconnectModal(false)}
            />

            {/* ── Header ──────────────────────────────────────────────────────── */}
            <div className="flex items-center justify-between">
                <div className="flex items-center gap-4">
                    <div className="p-2.5 bg-gradient-to-br from-blue-50 to-indigo-50 rounded-xl border border-blue-100 shadow-sm">
                        <BarChart3 className="h-5 w-5 text-blue-600" />
                    </div>
                    <div>
                        <h2 className="text-lg font-bold text-gray-900 tracking-tight">
                            AI Traffic Analytics
                        </h2>
                        <div className="flex items-center gap-2 mt-0.5">
                            <div className="flex items-center gap-1.5">
                                <span className="inline-block w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                                <p className="text-xs text-gray-500">
                                    Connected to <span className="font-semibold text-gray-700">{integration.ga4_property_name}</span>
                                </p>
                            </div>
                            <span className="text-gray-300">|</span>
                            <p className="text-[11px] text-gray-400">
                                Synced {integration.last_synced_at
                                    ? new Date(integration.last_synced_at).toLocaleString("en-US", { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" })
                                    : "never"}
                            </p>
                        </div>
                    </div>
                </div>

                <div className="flex items-center gap-2">
                    {/* Date range toggle */}
                    <div className="flex items-center bg-gray-100/80 p-1 rounded-xl gap-0.5">
                        {(["7d", "30d", "90d"] as const).map((r) => (
                            <button
                                key={r}
                                onClick={() => setRangeFilter(r)}
                                className={cn(
                                    "px-3 py-1.5 text-xs font-bold rounded-lg transition-all",
                                    rangeFilter === r ? "bg-white text-gray-900 shadow-sm" : "text-gray-500 hover:text-gray-700"
                                )}
                            >
                                {r === "7d" ? "7 Days" : r === "30d" ? "30 Days" : "90 Days"}
                            </button>
                        ))}
                    </div>

                    <div className="w-px h-6 bg-gray-200 mx-1" />

                    <Button
                        variant="outline"
                        size="sm"
                        onClick={triggerSync}
                        disabled={syncing}
                        className="h-9 px-4 rounded-xl font-semibold text-gray-700 border-gray-200 bg-white shadow-sm hover:bg-gray-50 active:scale-95 transition-all"
                    >
                        <RefreshCw className={cn("h-3.5 w-3.5 mr-2", syncing && "animate-spin")} />
                        {syncing ? "Syncing..." : "Refresh"}
                    </Button>
                    <Button
                        variant="outline"
                        size="sm"
                        onClick={() => {
                            setShowConfigure(!showConfigure);
                            if (!showConfigure && properties.length === 0) fetchProperties();
                        }}
                        className={cn(
                            "h-9 px-4 rounded-xl font-semibold shadow-sm active:scale-95 transition-all",
                            showConfigure ? "bg-blue-50 text-blue-700 border-blue-200" : "bg-white text-gray-700 border-gray-200 hover:bg-gray-50"
                        )}
                    >
                        <Settings2 className="h-3.5 w-3.5 mr-2" />
                        Settings
                    </Button>
                    <Button
                        variant="outline"
                        size="sm"
                        onClick={() => setShowDisconnectModal(true)}
                        className="h-9 w-9 p-0 rounded-xl font-semibold text-red-500 border-red-100 bg-red-50/50 hover:bg-red-100 hover:border-red-200 shadow-sm active:scale-95 transition-all"
                        title="Disconnect GA4"
                    >
                        <Trash2 className="h-3.5 w-3.5" />
                    </Button>
                </div>
            </div>

            {/* ── Inline Configuration Panel ──────────────────────────────────── */}
            {showConfigure && (
                <div className="bg-gradient-to-r from-blue-50 to-indigo-50/30 rounded-2xl border border-blue-100 p-6 animate-in slide-in-from-top-4 duration-300">
                    <div className="flex items-start justify-between mb-6">
                        <div>
                            <h3 className="text-sm font-bold text-blue-900">Integration Settings</h3>
                            <p className="text-xs text-blue-700 mt-1">Update your property or data stream tracking</p>
                        </div>
                        <Button variant="ghost" size="sm" onClick={() => setShowConfigure(false)} className="h-8 w-8 p-0 rounded-lg text-blue-400 hover:text-blue-600">
                            <ChevronDown className="h-5 w-5 rotate-180" />
                        </Button>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                        <div className="space-y-2">
                            <Label className="text-[11px] font-bold text-blue-900/60 uppercase tracking-wider ml-1">Google Property</Label>
                            {loadingProps ? (
                                <div className="h-10 flex items-center px-4 bg-white/50 rounded-xl border border-blue-100 text-xs text-blue-400 italic">
                                    <Loader2 className="h-3.5 w-3.5 animate-spin mr-2" /> Loading properties...
                                </div>
                            ) : (
                                <Select value={selectedProperty?.id} onValueChange={handlePropertyChange}>
                                    <SelectTrigger className="h-11 bg-white border-blue-100 rounded-xl shadow-sm focus:ring-blue-500">
                                        <SelectValue placeholder="Select Property" />
                                    </SelectTrigger>
                                    <SelectContent className="rounded-xl border-blue-100 shadow-xl max-h-64">
                                        {properties.map(p => (
                                            <SelectItem key={p.id} value={p.id} className="py-2.5">
                                                <div className="flex flex-col">
                                                    <span className="font-semibold text-gray-900">{p.displayName}</span>
                                                    <span className="text-[10px] text-gray-400">{p.accountName}</span>
                                                </div>
                                            </SelectItem>
                                        ))}
                                    </SelectContent>
                                </Select>
                            )}
                        </div>

                        <div className="space-y-2">
                            <Label className="text-[11px] font-bold text-blue-900/60 uppercase tracking-wider ml-1">Web Stream</Label>
                            <Select
                                value={selectedStream?.id}
                                onValueChange={(id) => setSelectedStream(streams.find(s => s.id === id) || null)}
                                disabled={!selectedProperty || loadingStreams}
                            >
                                <SelectTrigger className="h-11 bg-white border-blue-100 rounded-xl shadow-sm focus:ring-blue-500">
                                    <SelectValue placeholder={loadingStreams ? "Loading streams..." : "Select Stream"} />
                                </SelectTrigger>
                                <SelectContent className="rounded-xl border-blue-100 shadow-xl max-h-64">
                                    {streams.map(s => (
                                        <SelectItem key={s.id} value={s.id} className="py-2.5">
                                            <div className="flex flex-col">
                                                <span className="font-semibold text-gray-900">{s.displayName || s.name}</span>
                                                <span className="text-[10px] text-gray-400 font-mono italic">{s.measurementId}</span>
                                            </div>
                                        </SelectItem>
                                    ))}
                                    {streams.length === 0 && !loadingStreams && (
                                        <p className="px-4 py-8 text-center text-xs text-gray-400 italic">No web streams found</p>
                                    )}
                                </SelectContent>
                            </Select>
                        </div>

                        <div className="flex items-end">
                            <Button
                                onClick={handleSave}
                                disabled={!selectedStream || completing}
                                className="h-11 px-8 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-bold shadow-lg shadow-blue-500/20 active:scale-95 transition-all w-full md:w-auto"
                            >
                                {completing ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <CheckCircle className="h-4 w-4 mr-2" />}
                                Save Configuration
                            </Button>
                        </div>
                    </div>
                </div>
            )}

            {/* ── Summary KPI Row ─────────────────────────────────────────────── */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                {[
                    {
                        label: "Total AI Sessions",
                        value: summaryStats.sessions.toLocaleString(),
                        growth: summaryStats.sessionsGrowth,
                        icon: <MousePointerClick className="h-4 w-4" />,
                        iconColor: "text-blue-600",
                        iconBg: "bg-blue-50",
                    },
                    {
                        label: "Active Users",
                        value: summaryStats.activeUsers.toLocaleString(),
                        growth: summaryStats.usersGrowth,
                        icon: <Users className="h-4 w-4" />,
                        iconColor: "text-violet-600",
                        iconBg: "bg-violet-50",
                    },
                    {
                        label: "Avg Engagement",
                        value: `${(summaryStats.avgEngagement * 100).toFixed(1)}%`,
                        growth: summaryStats.engGrowth,
                        icon: <Activity className="h-4 w-4" />,
                        iconColor: "text-emerald-600",
                        iconBg: "bg-emerald-50",
                    },
                    {
                        label: "Avg Duration",
                        value: formatDuration(summaryStats.avgDuration),
                        growth: summaryStats.durGrowth,
                        icon: <Clock className="h-4 w-4" />,
                        iconColor: "text-amber-600",
                        iconBg: "bg-amber-50",
                    },
                ].map((kpi) => (
                    <div key={kpi.label} className="bg-white rounded-xl border border-gray-200 p-4 shadow-sm">
                        <div className="flex items-center justify-between mb-3">
                            <div className={cn("p-1.5 rounded-lg", kpi.iconBg)}>
                                <span className={kpi.iconColor}>{kpi.icon}</span>
                            </div>
                            <GrowthBadge value={kpi.growth} />
                        </div>
                        <div className="text-2xl font-bold text-gray-900 tracking-tight">{kpi.value}</div>
                        <div className="text-[11px] text-gray-500 mt-0.5">{kpi.label} <span className="text-gray-400">({rangeLabel})</span></div>
                    </div>
                ))}
            </div>

            {/* ── Source Breakdown Cards ───────────────────────────────────────── */}
            <div className={cn(
                "grid gap-3",
                visibleSources.length <= 4 ? "grid-cols-2 md:grid-cols-4" : "grid-cols-2 md:grid-cols-3 lg:grid-cols-5 xl:grid-cols-6"
            )}>
                {visibleSources.map((source) => {
                    const cfg = SOURCE_CONFIG[source] || { color: "#6b7280", icon: "🔗", bg: "bg-gray-50", border: "border-gray-200" };
                    const data = sessionsBySource[source] || { sessions: 0, prevSessions: 0, activeUsers: 0, engagementRate: 0, duration: 0, count: 0 };
                    const growth = calcGrowth(data.sessions, data.prevSessions);

                    return (
                        <div key={source} className={cn("rounded-xl border p-3.5 bg-white shadow-sm transition-all hover:shadow-md", cfg.border)}>
                            <div className="flex items-center justify-between mb-2">
                                <div className="flex items-center gap-1.5">
                                    <span className="text-sm">{cfg.icon}</span>
                                    <span className="text-xs font-semibold text-gray-700">{source}</span>
                                </div>
                                <GrowthBadge value={growth} />
                            </div>
                            <div className="text-xl font-bold tabular-nums" style={{ color: cfg.color }}>
                                {data.sessions.toLocaleString()}
                            </div>
                            <div className="text-[10px] text-gray-400 mt-0.5">sessions</div>
                            {data.activeUsers > 0 && (
                                <div className="flex items-center gap-1 mt-1.5 pt-1.5 border-t border-gray-100">
                                    <Users className="h-3 w-3 text-gray-400" />
                                    <span className="text-[10px] text-gray-500">{data.activeUsers} users</span>
                                </div>
                            )}
                        </div>
                    );
                })}
            </div>

            {/* ── Visibility vs. Traffic Correlation ──────────────────────────── */}
            <div className="bg-white rounded-2xl border border-gray-200 p-5 shadow-sm">
                <div className="flex items-center justify-between mb-4">
                    <div>
                        <h3 className="font-semibold text-gray-900 text-sm flex items-center gap-2">
                            <TrendingUp className="h-4 w-4 text-blue-500" />
                            Visibility vs. Traffic Correlation
                        </h3>
                        <p className="text-xs text-gray-500 mt-0.5">
                            Compare AI Visibility Score with referral sessions from LLM platforms
                        </p>
                    </div>
                </div>

                {!hasAnyData ? (
                    <div className="text-center py-16 bg-gray-50/50 rounded-xl border border-dashed border-gray-200">
                        <div className="flex flex-col items-center gap-3">
                            <div className="p-3 bg-white rounded-full shadow-sm">
                                {syncing ? (
                                    <Loader2 className="h-6 w-6 text-blue-400 animate-spin" />
                                ) : (
                                    <TrendingUp className="h-6 w-6 text-gray-300" />
                                )}
                            </div>
                            <div>
                                <h4 className="font-medium text-gray-900 text-sm">
                                    {syncing ? "Syncing data..." : "No AI traffic data yet"}
                                </h4>
                                <p className="text-xs text-gray-400 max-w-[300px] mx-auto mt-1">
                                    {syncing
                                        ? "Fetching the latest data from Google Analytics..."
                                        : "Click Refresh to pull the latest data from Google Analytics."}
                                </p>
                            </div>
                            {!syncing && (
                                <Button variant="outline" size="sm" onClick={triggerSync} className="h-8 text-xs mt-2 rounded-lg">
                                    <RefreshCw className="h-3.5 w-3.5 mr-2" /> Sync Now
                                </Button>
                            )}
                        </div>
                    </div>
                ) : (
                    <ResponsiveContainer width="100%" height={300}>
                        <ComposedChart data={chartData} margin={{ top: 5, right: 20, left: 0, bottom: 5 }}>
                            <defs>
                                <linearGradient id="barGradient" x1="0" y1="0" x2="0" y2="1">
                                    <stop offset="0%" stopColor="#93c5fd" stopOpacity={0.9} />
                                    <stop offset="100%" stopColor="#bfdbfe" stopOpacity={0.5} />
                                </linearGradient>
                            </defs>
                            <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                            <XAxis
                                dataKey="date"
                                tick={{ fontSize: 10, fill: "#9ca3af" }}
                                tickLine={false}
                                axisLine={false}
                                interval="preserveStartEnd"
                            />
                            <YAxis
                                yAxisId="left"
                                tick={{ fontSize: 10, fill: "#9ca3af" }}
                                tickLine={false}
                                axisLine={false}
                                tickFormatter={(v: number) => `${v}%`}
                                width={38}
                            />
                            <YAxis
                                yAxisId="right"
                                orientation="right"
                                tick={{ fontSize: 10, fill: "#9ca3af" }}
                                tickLine={false}
                                axisLine={false}
                                width={40}
                            />
                            <RechartsTooltip content={<CustomTooltip />} />
                            <Legend
                                wrapperStyle={{ fontSize: 11, paddingTop: 12 }}
                                iconType="circle"
                                iconSize={8}
                            />
                            <Bar
                                yAxisId="right"
                                dataKey="AI Sessions"
                                fill="url(#barGradient)"
                                radius={[4, 4, 0, 0]}
                                maxBarSize={24}
                                name="AI Sessions"
                            />
                            <Line
                                yAxisId="left"
                                type="monotone"
                                dataKey="SOV %"
                                stroke="#3b82f6"
                                strokeWidth={2.5}
                                dot={false}
                                activeDot={{ r: 5, strokeWidth: 2, stroke: "#fff" }}
                                name="SOV %"
                            />
                        </ComposedChart>
                    </ResponsiveContainer>
                )}
            </div>

            {/* ── Sessions Trend + Source Distribution ─────────────────────────── */}
            <div className="grid grid-cols-1 lg:grid-cols-5 gap-5">
                {/* Stacked bar - per source */}
                <div className="lg:col-span-3 bg-white rounded-2xl border border-gray-200 p-5 shadow-sm">
                    <h3 className="font-semibold text-gray-900 mb-4 text-sm">Sessions by Source</h3>
                    {!hasAnyData ? (
                        <div className="text-center py-14">
                            <p className="text-gray-400 text-sm">No session data for selected period</p>
                        </div>
                    ) : (
                        <ResponsiveContainer width="100%" height={220}>
                            <ComposedChart data={chartData} margin={{ top: 0, right: 12, left: 0, bottom: 0 }}>
                                <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" vertical={false} />
                                <XAxis
                                    dataKey="date"
                                    tick={{ fontSize: 10, fill: "#9ca3af" }}
                                    tickLine={false}
                                    axisLine={false}
                                    interval="preserveStartEnd"
                                />
                                <YAxis
                                    tick={{ fontSize: 10, fill: "#9ca3af" }}
                                    tickLine={false}
                                    axisLine={false}
                                    width={32}
                                />
                                <RechartsTooltip content={<CustomTooltip />} />
                                <Legend wrapperStyle={{ fontSize: 11, paddingTop: 8 }} iconType="circle" iconSize={8} />
                                {Object.entries(SOURCE_CONFIG)
                                    .filter(([source]) => activeSources.includes(source) || PRIMARY_SOURCES.includes(source))
                                    .map(([source, cfg], idx, arr) => (
                                    <Bar
                                        key={source}
                                        dataKey={source}
                                        stackId="sources"
                                        fill={cfg.color}
                                        radius={idx === arr.length - 1 ? [3, 3, 0, 0] : undefined}
                                        maxBarSize={22}
                                    />
                                ))}
                            </ComposedChart>
                        </ResponsiveContainer>
                    )}
                </div>

                {/* Donut chart with legend */}
                <div className="lg:col-span-2 bg-white rounded-2xl border border-gray-200 p-5 shadow-sm">
                    <h3 className="font-semibold text-gray-900 mb-4 text-sm">Source Distribution</h3>
                    {donutData.length === 0 ? (
                        <div className="text-center py-14">
                            <p className="text-gray-400 text-sm">No traffic to distribute</p>
                        </div>
                    ) : (
                        <div className="flex flex-col items-center">
                            <div className="relative">
                                <ResponsiveContainer width={200} height={200}>
                                    <PieChart>
                                        <Pie
                                            data={donutData}
                                            cx="50%"
                                            cy="50%"
                                            innerRadius={55}
                                            outerRadius={85}
                                            paddingAngle={3}
                                            dataKey="value"
                                            nameKey="name"
                                            stroke="none"
                                        >
                                            {donutData.map((entry, index) => (
                                                <Cell key={`cell-${index}`} fill={entry.color} />
                                            ))}
                                        </Pie>
                                        <RechartsTooltip
                                            formatter={(value: any) => [`${Number(value || 0).toLocaleString()} sessions`, ""]}
                                            contentStyle={{ borderRadius: '12px', border: '1px solid #e5e7eb', boxShadow: '0 10px 25px -5px rgb(0 0 0 / 0.1)', fontSize: 12 }}
                                        />
                                    </PieChart>
                                </ResponsiveContainer>
                                {/* Center label */}
                                <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
                                    <span className="text-xl font-bold text-gray-900">{totalSessions}</span>
                                    <span className="text-[10px] text-gray-400">total</span>
                                </div>
                            </div>

                            {/* Legend */}
                            <div className="w-full mt-3 space-y-1.5">
                                {donutData.map((entry) => (
                                    <div key={entry.name} className="flex items-center justify-between px-1 py-1">
                                        <div className="flex items-center gap-2">
                                            <span className="w-2.5 h-2.5 rounded-full flex-shrink-0" style={{ backgroundColor: entry.color }} />
                                            <span className="text-xs text-gray-700 font-medium">{entry.name}</span>
                                        </div>
                                        <div className="flex items-center gap-3">
                                            <span className="text-xs text-gray-500 tabular-nums">{entry.value.toLocaleString()}</span>
                                            <span className="text-xs font-bold text-gray-900 tabular-nums w-12 text-right">{entry.share.toFixed(1)}%</span>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </div>
                    )}
                </div>
            </div>

            {/* ── Conversion Attribution Table ────────────────────────────────── */}
            <div className="bg-white rounded-2xl border border-gray-200 shadow-sm overflow-hidden">
                <div className="p-5 border-b border-gray-100 flex items-center justify-between">
                    <div>
                        <h3 className="font-semibold text-gray-900 text-sm">Conversion Attribution</h3>
                        <p className="text-xs text-gray-500 mt-0.5">Detailed LLM-referred session metrics and key events</p>
                    </div>
                    <Badge className="bg-purple-50 text-purple-700 border border-purple-200 text-[10px] font-bold">Pro</Badge>
                </div>

                <div className="overflow-x-auto">
                    <table className="w-full">
                        <thead>
                            <tr className="text-[11px] font-bold text-gray-500 uppercase tracking-wider border-b border-gray-100 bg-gray-50/50">
                                <th className="text-left py-3 px-5">Source</th>
                                <th className="text-right py-3 px-4">Sessions</th>
                                <th className="text-right py-3 px-4">Share</th>
                                <th className="text-right py-3 px-4">Users</th>
                                <th className="text-right py-3 px-4">Engagement</th>
                                <th className="text-right py-3 px-4">Avg Duration</th>
                                <th className="text-right py-3 px-4">Conversions</th>
                                <th className="text-right py-3 px-5">Conv Rate</th>
                            </tr>
                        </thead>
                        <tbody className="text-sm">
                            {conversionTableData.map((row, idx) => {
                                const cfg = SOURCE_CONFIG[row.source] || { icon: "🔗", color: "#6b7280" };
                                return (
                                    <tr key={row.source} className={cn(
                                        "hover:bg-blue-50/30 transition-colors border-b border-gray-50",
                                        idx % 2 === 0 ? "bg-white" : "bg-gray-50/30"
                                    )}>
                                        <td className="py-3 px-5">
                                            <div className="flex items-center gap-2.5">
                                                <span className="text-sm">{cfg.icon}</span>
                                                <span className="font-semibold text-gray-800">{row.source}</span>
                                            </div>
                                        </td>
                                        <td className="py-3 px-4 text-right font-bold text-gray-900 tabular-nums">
                                            {row.sessions.toLocaleString()}
                                        </td>
                                        <td className="py-3 px-4 text-right">
                                            <div className="flex items-center justify-end gap-2">
                                                <div className="w-12 h-1.5 bg-gray-100 rounded-full overflow-hidden">
                                                    <div className="h-full rounded-full" style={{ width: `${row.share}%`, backgroundColor: cfg.color }} />
                                                </div>
                                                <span className="text-xs text-gray-600 tabular-nums w-10 text-right">{row.share.toFixed(1)}%</span>
                                            </div>
                                        </td>
                                        <td className="py-3 px-4 text-right text-gray-600 tabular-nums">
                                            {row.activeUsers.toLocaleString()}
                                        </td>
                                        <td className="py-3 px-4 text-right text-gray-600 tabular-nums">
                                            {(row.avgEngagement * 100).toFixed(1)}%
                                        </td>
                                        <td className="py-3 px-4 text-right text-gray-600 tabular-nums">
                                            {formatDuration(row.avgDuration)}
                                        </td>
                                        <td className="py-3 px-4 text-right text-gray-700 tabular-nums">
                                            {row.conversions.toLocaleString()}
                                        </td>
                                        <td className="py-3 px-5 text-right">
                                            <span className={cn(
                                                "inline-block px-2 py-0.5 rounded-full text-xs font-bold tabular-nums",
                                                parseFloat(row.cvr) > 0
                                                    ? "bg-emerald-100 text-emerald-700"
                                                    : "bg-gray-100 text-gray-500"
                                            )}>
                                                {row.cvr}%
                                            </span>
                                        </td>
                                    </tr>
                                );
                            })}
                            {conversionTableData.length === 0 && (
                                <tr>
                                    <td colSpan={8} className="py-12 text-center text-gray-400 text-sm italic">
                                        No conversion data yet — click Refresh to sync.
                                    </td>
                                </tr>
                            )}
                            {conversionTableData.length > 0 && (
                                <tr className="bg-gray-50 font-bold text-gray-800 border-t-2 border-gray-200">
                                    <td className="py-3.5 px-5 text-sm">Total</td>
                                    <td className="py-3.5 px-4 text-right text-sm tabular-nums">{totalSessions.toLocaleString()}</td>
                                    <td className="py-3.5 px-4 text-right text-xs text-gray-500">100%</td>
                                    <td className="py-3.5 px-4 text-right text-sm tabular-nums">{totalActiveUsers.toLocaleString()}</td>
                                    <td className="py-3.5 px-4 text-right text-sm tabular-nums">
                                        {(totalAvgEngagement * 100).toFixed(1)}%
                                    </td>
                                    <td className="py-3.5 px-4 text-right text-sm tabular-nums">
                                        {formatDuration(totalAvgDuration)}
                                    </td>
                                    <td className="py-3.5 px-4 text-right text-sm tabular-nums">{totalConversions.toLocaleString()}</td>
                                    <td className="py-3.5 px-5 text-right">
                                        <span className="inline-block px-2 py-0.5 rounded-full text-xs font-bold bg-blue-100 text-blue-700 tabular-nums">
                                            {totalSessions > 0
                                                ? ((totalConversions / totalSessions) * 100).toFixed(1)
                                                : "0.0"}%
                                        </span>
                                    </td>
                                </tr>
                            )}
                        </tbody>
                    </table>
                </div>
            </div>

            {/* ═══════════════════════════════════════════════════════════════════ */}
            {/* ── LLM Attribution Intelligence ───────────────────────────────── */}
            {/* ═══════════════════════════════════════════════════════════════════ */}

            {hasChannelData && (
                <>
                    {/* ── Section Divider ───────────────────────────────────────── */}
                    <div className="flex items-center gap-3 pt-2">
                        <div className="p-2 bg-gradient-to-br from-indigo-50 to-blue-50 rounded-xl border border-indigo-100 shadow-sm">
                            <Network className="h-4.5 w-4.5 text-indigo-600" />
                        </div>
                        <div>
                            <h2 className="text-[15px] font-bold text-gray-900 tracking-tight">LLM Attribution</h2>
                            <p className="text-xs text-gray-500">How AI traffic scales relative to your total digital footprint</p>
                        </div>
                    </div>

                    {/* ── Multi-Channel Correlation Trendline ──────────────────── */}
                    <div className="bg-white rounded-2xl border border-gray-200 p-5 shadow-sm">
                        <div className="flex items-center justify-between mb-4">
                            <div>
                                <h3 className="font-semibold text-gray-900 text-sm flex items-center gap-2">
                                    <Network className="h-4 w-4 text-indigo-500" />
                                    Multi-Channel Correlation
                                </h3>
                                <p className="text-xs text-gray-500 mt-0.5">
                                    Toggle channels to spot correlation between LLM citations and other traffic sources
                                </p>
                            </div>
                            <div className="flex items-center gap-1.5 flex-wrap justify-end">
                                {Object.entries(CHANNEL_COLORS).map(([key, color]) => (
                                    <button
                                        key={key}
                                        onClick={() => setChannelLines(prev => ({ ...prev, [key]: !prev[key] }))}
                                        className={cn(
                                            "flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-[11px] font-semibold transition-all border",
                                            channelLines[key]
                                                ? "bg-white shadow-sm border-gray-200 text-gray-700"
                                                : "bg-gray-50/80 text-gray-400 border-transparent"
                                        )}
                                    >
                                        <span
                                            className="w-2 h-2 rounded-full transition-opacity"
                                            style={{ backgroundColor: color, opacity: channelLines[key] ? 1 : 0.25 }}
                                        />
                                        {key}
                                    </button>
                                ))}
                            </div>
                        </div>
                        <ResponsiveContainer width="100%" height={300}>
                            <ComposedChart data={channelChartData} margin={{ top: 5, right: 12, left: 0, bottom: 5 }}>
                                <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                                <XAxis
                                    dataKey="date"
                                    tick={{ fontSize: 10, fill: "#9ca3af" }}
                                    tickLine={false}
                                    axisLine={false}
                                    interval="preserveStartEnd"
                                    tickFormatter={(d: string) => {
                                        const dt = new Date(d + "T00:00:00");
                                        return `${dt.getMonth() + 1}/${dt.getDate()}`;
                                    }}
                                />
                                <YAxis
                                    tick={{ fontSize: 10, fill: "#9ca3af" }}
                                    tickLine={false}
                                    axisLine={false}
                                    width={44}
                                    tickFormatter={(v: number) => v >= 1000 ? `${(v / 1000).toFixed(1)}K` : String(v)}
                                />
                                <RechartsTooltip content={<CustomTooltip />} />
                                {channelLines.Total && (
                                    <Line type="monotone" dataKey="Total" stroke={CHANNEL_COLORS.Total} strokeWidth={2} dot={false} name="Total Sessions" />
                                )}
                                {channelLines.LLM && (
                                    <Line type="monotone" dataKey="LLM" stroke={CHANNEL_COLORS.LLM} strokeWidth={2.5} dot={false} name="LLM Sessions" />
                                )}
                                {channelLines.Direct && (
                                    <Line type="monotone" dataKey="Direct" stroke={CHANNEL_COLORS.Direct} strokeWidth={2} dot={false} name="Direct Sessions" strokeDasharray="4 3" />
                                )}
                                {channelLines.Referral && (
                                    <Line type="monotone" dataKey="Referral" stroke={CHANNEL_COLORS.Referral} strokeWidth={2} dot={false} name="Referral Sessions" strokeDasharray="4 3" />
                                )}
                            </ComposedChart>
                        </ResponsiveContainer>
                    </div>

                    {/* ── Comparative Intelligence: CVR Delta + Engagement ─────── */}
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        {/* CVR Delta Card */}
                        <div className="bg-white rounded-2xl border border-gray-200 p-5 shadow-sm">
                            <div className="flex items-center gap-2.5 mb-4">
                                <div className="p-1.5 bg-blue-50 rounded-lg">
                                    <Target className="h-4 w-4 text-blue-600" />
                                </div>
                                <div>
                                    <h3 className="font-semibold text-gray-900 text-sm">Conversion Rate Delta</h3>
                                    <p className="text-[11px] text-gray-500">LLM vs. Standard Traffic</p>
                                </div>
                            </div>
                            {cvrDelta.totalSessions > 0 ? (
                                <div className="space-y-4">
                                    <div className="text-center py-3 rounded-xl bg-gradient-to-br from-gray-50 to-gray-100/50 border border-gray-100">
                                        <div className="flex items-center justify-center gap-1.5">
                                            {cvrDelta.lift >= 0 ? (
                                                <ArrowUpRight className="h-5 w-5 text-emerald-500" />
                                            ) : (
                                                <ArrowDownRight className="h-5 w-5 text-red-500" />
                                            )}
                                            <span className={cn(
                                                "text-3xl font-black tabular-nums",
                                                cvrDelta.lift >= 0 ? "text-emerald-600" : "text-red-600"
                                            )}>
                                                {cvrDelta.lift >= 0 ? "+" : ""}{cvrDelta.lift.toFixed(1)}%
                                            </span>
                                        </div>
                                        <div className="text-[11px] text-gray-500 mt-1 font-medium">
                                            {cvrDelta.lift >= 0 ? "LLM traffic converts higher" : "LLM traffic converts lower"}
                                        </div>
                                    </div>
                                    <div className="grid grid-cols-2 gap-3">
                                        <div className="text-center p-3 rounded-xl bg-blue-50/60 border border-blue-100/60">
                                            <div className="text-xl font-black text-blue-700 tabular-nums">{cvrDelta.llmCvr.toFixed(2)}%</div>
                                            <div className="text-[10px] text-blue-600/70 font-semibold mt-0.5 uppercase tracking-wide">LLM CVR</div>
                                        </div>
                                        <div className="text-center p-3 rounded-xl bg-gray-50 border border-gray-100">
                                            <div className="text-xl font-black text-gray-700 tabular-nums">{cvrDelta.nonLlmCvr.toFixed(2)}%</div>
                                            <div className="text-[10px] text-gray-500 font-semibold mt-0.5 uppercase tracking-wide">Standard CVR</div>
                                        </div>
                                    </div>
                                </div>
                            ) : (
                                <div className="text-center py-8 text-sm text-gray-400 italic">
                                    No conversion data available for comparison
                                </div>
                            )}
                        </div>

                        {/* Engagement Comparison Card */}
                        <div className="bg-white rounded-2xl border border-gray-200 p-5 shadow-sm">
                            <div className="flex items-center gap-2.5 mb-4">
                                <div className="p-1.5 bg-purple-50 rounded-lg">
                                    <Clock className="h-4 w-4 text-purple-600" />
                                </div>
                                <div>
                                    <h3 className="font-semibold text-gray-900 text-sm">Average Engagement</h3>
                                    <p className="text-[11px] text-gray-500">Session Duration Comparison</p>
                                </div>
                            </div>
                            {engagementDelta.overallAvg > 0 ? (
                                <div>
                                    <div className="flex items-center justify-center gap-5 py-4">
                                        <div className="text-center flex-1">
                                            <div className="text-3xl font-black text-blue-700 tabular-nums">
                                                {formatDuration(engagementDelta.llmAvg)}
                                            </div>
                                            <div className="text-[10px] text-blue-600/70 font-semibold mt-1 uppercase tracking-wide">LLM Traffic</div>
                                        </div>
                                        <div className="text-lg font-black text-gray-300 select-none">vs</div>
                                        <div className="text-center flex-1">
                                            <div className="text-3xl font-black text-gray-600 tabular-nums">
                                                {formatDuration(engagementDelta.overallAvg)}
                                            </div>
                                            <div className="text-[10px] text-gray-500 font-semibold mt-1 uppercase tracking-wide">Overall</div>
                                        </div>
                                    </div>
                                    {engagementDelta.llmAvg > 0 && (() => {
                                        const diff = engagementDelta.llmAvg - engagementDelta.overallAvg;
                                        const pct = engagementDelta.overallAvg > 0 ? (diff / engagementDelta.overallAvg) * 100 : 0;
                                        const isPos = pct > 0;
                                        if (Math.abs(pct) < 0.5) return null;
                                        return (
                                            <div className="text-center mt-1">
                                                <span className={cn(
                                                    "inline-flex items-center gap-1 text-[11px] font-bold px-2.5 py-1 rounded-lg",
                                                    isPos ? "text-emerald-700 bg-emerald-50 border border-emerald-100" : "text-rose-700 bg-rose-50 border border-rose-100"
                                                )}>
                                                    {isPos ? <TrendingUp className="h-3 w-3" /> : <TrendingDown className="h-3 w-3" />}
                                                    LLM users stay {Math.abs(pct).toFixed(0)}% {isPos ? "longer" : "shorter"}
                                                </span>
                                            </div>
                                        );
                                    })()}
                                </div>
                            ) : (
                                <div className="text-center py-8 text-sm text-gray-400 italic">
                                    No engagement data available for comparison
                                </div>
                            )}
                        </div>
                    </div>
                </>
            )}
        </div>
    );
}

export default TrafficTab;
