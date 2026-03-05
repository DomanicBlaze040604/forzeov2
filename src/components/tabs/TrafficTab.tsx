import React, { useMemo, useState } from "react";
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
import { BarChart3, Unlink, TrendingUp, ArrowUpRight, RefreshCw, Settings2, Trash2, CheckCircle, Info, ChevronDown, ExternalLink, Loader2 } from "lucide-react";
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
import { useGA4Connector, type GA4SyncLog, type GA4ConnectorHook, type GA4Property, type GA4Stream } from "@/hooks/useGA4Connector";
import type { Client } from "@/hooks/useClientDashboard";

// ── Source style config ────────────────────────────────────────────────────
const SOURCE_CONFIG: Record<string, { color: string; icon: string; bg: string }> = {
    ChatGPT: { color: "#10a37f", icon: "🤖", bg: "bg-emerald-50 border-emerald-100" },
    Perplexity: { color: "#6366f1", icon: "🔮", bg: "bg-indigo-50 border-indigo-100" },
    Gemini: { color: "#4285f4", icon: "✨", bg: "bg-blue-50 border-blue-100" },
    Claude: { color: "#d97706", icon: "🧠", bg: "bg-amber-50 border-amber-100" },
};

// ── Custom Recharts Tooltip ────────────────────────────────────────────────
function CustomTooltip({ active, payload, label }: any) {
    if (!active || !payload?.length) return null;
    return (
        <div className="bg-white border border-gray-200 rounded-xl shadow-xl p-3 text-xs min-w-[180px]">
            <p className="font-semibold text-gray-700 mb-2">{label}</p>
            {payload.map((entry: any) => (
                <div key={entry.name} className="flex items-center justify-between gap-4 mb-1">
                    <span className="flex items-center gap-1.5">
                        <span className="inline-block w-2 h-2 rounded-full" style={{ backgroundColor: entry.color }} />
                        <span className="text-gray-600">{entry.name}</span>
                    </span>
                    <span className="font-bold text-gray-900">
                        {entry.name === "SOV %" ? `${entry.value}%` : (entry.value || 0).toLocaleString()}
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
                    <h3 className="font-semibold text-gray-900 text-base font-sans">Disconnect Google Analytics?</h3>
                </div>
                <p className="text-sm text-gray-600 mb-6 font-sans">
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
            <h3 className="text-lg font-semibold text-gray-900 mb-2 font-sans">
                Connect Google Analytics to see your AI Traffic
            </h3>
            <p className="text-sm text-gray-500 max-w-md mb-6 leading-relaxed font-sans">
                See how AI citations from ChatGPT, Perplexity, Gemini and Claude translate
                into real website visits and conversions.
            </p>
            <Button onClick={onOpenSettings} className="bg-blue-600 hover:bg-blue-700 text-white gap-2 h-11 px-6 rounded-xl font-sans font-semibold shadow-md transition-all active:scale-95">
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
    // SOV series from the existing OverviewTab computation
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

    const {
        integration,
        trafficData,
        loading,
        syncing,
        last7DaysBySource,
        totalLLMSessionsLast7,
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
    const [propError, setPropError] = useState<string | null>(null);
    const [streamError, setStreamError] = useState<string | null>(null);
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

    // ── Build date-aligned chart data ────────────────────────────────────────
    const chartData = useMemo(() => {
        if (!isConnected || !trafficData.length) return [];

        const days = rangeFilter === "7d" ? 7 : rangeFilter === "30d" ? 30 : 90;
        const now = new Date();
        const cutoff = new Date(now.getTime() - days * 24 * 60 * 60 * 1000);

        // Build date range (last N days)
        const dateRange: string[] = [];
        for (let i = days; i >= 0; i--) {
            const d = new Date(now.getTime() - i * 24 * 60 * 60 * 1000);
            dateRange.push(d.toISOString().split("T")[0]);
        }

        // Group traffic data by date
        const trafficByDate: Record<string, Record<string, number>> = {};
        for (const row of trafficData) {
            if (row.sync_date < cutoff.toISOString().split("T")[0]) continue;
            if (!trafficByDate[row.sync_date]) trafficByDate[row.sync_date] = {};
            trafficByDate[row.sync_date][row.source] =
                (trafficByDate[row.sync_date][row.source] || 0) + row.sessions;
        }

        // Map to client's SOV series (align dates)
        const clientSeries = sovTimeSeries.series.find((s) => s.isClient);

        return dateRange.map((dateStr, idx) => {
            const label = new Date(dateStr + "T00:00:00").toLocaleDateString("en-US", {
                month: "short",
                day: "numeric",
            });
            const traffic = trafficByDate[dateStr] || {};
            const totalSessions = Object.values(traffic).reduce((a, b) => a + b, 0);

            // Try to find SOV for this date from SOV series
            // The SOV series labels may not 1-1 align; use index as approximate proxy
            const sovLabel = sovTimeSeries.labels[Math.min(idx, sovTimeSeries.labels.length - 1)];
            const sovLabelIdx = sovTimeSeries.labels.indexOf(sovLabel);
            const sovValue = clientSeries?.data[sovLabelIdx] ?? null;

            return {
                date: label,
                "SOV %": sovValue,
                "AI Sessions": totalSessions,
                ChatGPT: traffic["ChatGPT"] || 0,
                Perplexity: traffic["Perplexity"] || 0,
                Gemini: traffic["Gemini"] || 0,
                Claude: traffic["Claude"] || 0,
            };
        });
    }, [isConnected, trafficData, rangeFilter, sovTimeSeries]);

    // ── Conversion table data ─────────────────────────────────────────────────
    const conversionTableData = useMemo(() => {
        const cutoff = new Date();
        cutoff.setDate(cutoff.getDate() - (rangeFilter === "7d" ? 7 : rangeFilter === "30d" ? 30 : 90));
        const cutoffStr = cutoff.toISOString().split("T")[0];

        const agg: Record<string, { sessions: number; conversions: number }> = {};
        for (const row of trafficData) {
            if (row.sync_date < cutoffStr) continue;
            if (!agg[row.source]) agg[row.source] = { sessions: 0, conversions: 0 };
            agg[row.source].sessions += row.sessions;
            agg[row.source].conversions += row.conversions;
        }

        return Object.entries(agg)
            .map(([source, data]) => ({
                source,
                sessions: data.sessions,
                conversions: data.conversions,
                activeUsers: trafficData.filter(r => r.source === source && r.sync_date >= cutoffStr).reduce((a, b) => a + (b.active_users || 0), 0),
                avgEngagement: trafficData.filter(r => r.source === source && r.sync_date >= cutoffStr).reduce((a, b, _, arr) => a + (b.engagement_rate || 0) / arr.length, 0),
                cvr: data.sessions > 0 ? ((data.conversions / data.sessions) * 100).toFixed(1) : "0.0",
            }))
            .sort((a, b) => b.sessions - a.sessions);
    }, [trafficData, rangeFilter]);

    const totalSessions = conversionTableData.reduce((s, r) => s + r.sessions, 0);
    const totalConversions = conversionTableData.reduce((s, r) => s + r.conversions, 0);

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

    // ── Dynamic source aggregation based on rangeFilter ───────────────────────
    const sessionsBySource = useMemo(() => {
        const days = rangeFilter === "7d" ? 7 : rangeFilter === "30d" ? 30 : 90;
        const now = new Date();
        const cutoffCurrent = new Date(now.getTime() - days * 24 * 60 * 60 * 1000);
        const cutoffCurrentStr = cutoffCurrent.toISOString().split("T")[0];

        const cutoffPrev = new Date(cutoffCurrent.getTime() - days * 24 * 60 * 60 * 1000);
        const cutoffPrevStr = cutoffPrev.toISOString().split("T")[0];

        const totals: Record<string, { sessions: number; prevSessions: number }> = {
            ChatGPT: { sessions: 0, prevSessions: 0 },
            Perplexity: { sessions: 0, prevSessions: 0 },
            Gemini: { sessions: 0, prevSessions: 0 },
            Claude: { sessions: 0, prevSessions: 0 },
        };

        for (const row of trafficData) {
            if (row.sync_date >= cutoffCurrentStr) {
                const s = totals[row.source];
                if (s) {
                    s.sessions += row.sessions;
                }
            } else if (row.sync_date >= cutoffPrevStr) {
                const s = totals[row.source];
                if (s) {
                    s.prevSessions += row.sessions;
                }
            }
        }
        return totals;
    }, [trafficData, rangeFilter]);

    return (
        <div className="space-y-6 fade-in relative">
            <ConfirmDisconnectModal
                open={showDisconnectModal}
                onConfirm={() => { setShowDisconnectModal(false); disconnect(); }}
                onCancel={() => setShowDisconnectModal(false)}
            />

            {/* Page title row */}
            <div className="flex items-center justify-between">
                <div className="flex items-center gap-4">
                    <div className="p-2.5 bg-blue-50 rounded-xl border border-blue-100 shadow-sm">
                        <BarChart3 className="h-5 w-5 text-blue-600" />
                    </div>
                    <div>
                        <h2 className="text-lg font-bold text-gray-900 font-sans tracking-tight">
                            AI Traffic Analytics
                        </h2>
                        <div className="flex items-center gap-2 mt-0.5">
                            <p className="text-xs text-gray-500 font-sans">
                                Connected to <span className="font-semibold text-gray-700">{integration.ga4_property_name}</span>
                            </p>
                            <span className="text-gray-300">•</span>
                            <p className="text-[10px] text-gray-400 font-sans">
                                Last synced: {integration.last_synced_at
                                    ? new Date(integration.last_synced_at).toLocaleString()
                                    : "Never"}
                            </p>
                        </div>
                    </div>
                </div>

                <div className="flex items-center gap-3">
                    <div className="flex items-center bg-gray-100/80 p-1 rounded-xl gap-0.5 mr-2">
                        {(["7d", "30d", "90d"] as const).map((r) => (
                            <button
                                key={r}
                                onClick={() => setRangeFilter(r)}
                                className={cn(
                                    "px-3 py-1.5 text-xs font-bold rounded-lg transition-all font-sans",
                                    rangeFilter === r ? "bg-white text-gray-900 shadow-sm" : "text-gray-500 hover:text-gray-700"
                                )}
                            >
                                {r === "7d" ? "7 Days" : r === "30d" ? "30 Days" : "90 Days"}
                            </button>
                        ))}
                    </div>

                    <div className="flex items-center gap-2 border-l border-gray-200 pl-4">
                        <Button
                            variant="outline"
                            size="sm"
                            onClick={triggerSync}
                            disabled={syncing}
                            className="h-9 px-4 rounded-xl font-sans font-semibold text-gray-700 border-gray-200 bg-white shadow-sm hover:bg-gray-50 border active:scale-95 transition-all"
                        >
                            {syncing ? <RefreshCw className="h-3.5 w-3.5 animate-spin mr-2" /> : <RefreshCw className="h-3.5 w-3.5 mr-2" />}
                            Refresh
                        </Button>
                        <Button
                            variant="outline"
                            size="sm"
                            onClick={() => {
                                setShowConfigure(!showConfigure);
                                if (!showConfigure && properties.length === 0) fetchProperties();
                            }}
                            className={cn(
                                "h-9 px-4 rounded-xl font-sans font-semibold border-gray-200 shadow-sm active:scale-95 transition-all",
                                showConfigure ? "bg-blue-50 text-blue-700 border-blue-200" : "bg-white text-gray-700 border hover:bg-gray-50"
                            )}
                        >
                            <Settings2 className="h-3.5 w-3.5 mr-2" />
                            Settings
                        </Button>
                        <Button
                            variant="outline"
                            size="sm"
                            onClick={() => setShowDisconnectModal(true)}
                            className="h-9 px-3 rounded-xl font-sans font-semibold text-red-600 border-red-100 bg-red-50 hover:bg-red-100 hover:border-red-200 shadow-sm active:scale-95 transition-all"
                            title="Disconnect GA4"
                        >
                            <Trash2 className="h-3.5 w-3.5" />
                        </Button>
                    </div>
                </div>
            </div>

            {/* Inline Configuration Panel */}
            {showConfigure && (
                <div className="bg-gradient-to-r from-blue-50 to-indigo-50/30 rounded-2xl border border-blue-100 p-6 animate-in slide-in-from-top-4 duration-300">
                    <div className="flex items-start justify-between mb-6">
                        <div>
                            <h3 className="text-sm font-bold text-blue-900 font-sans">Integration Settings</h3>
                            <p className="text-xs text-blue-700 mt-1 font-sans">Update your property or data stream tracking</p>
                        </div>
                        <Button variant="ghost" size="sm" onClick={() => setShowConfigure(false)} className="h-8 w-8 p-0 rounded-lg text-blue-400 hover:text-blue-600">
                            <ChevronDown className="h-5 w-5 rotate-180" />
                        </Button>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                        <div className="space-y-2">
                            <Label className="text-[11px] font-bold text-blue-900/60 uppercase tracking-wider font-sans ml-1">Google Property</Label>
                            {loadingProps ? (
                                <div className="h-10 flex items-center px-4 bg-white/50 rounded-xl border border-blue-100 text-xs text-blue-400 italic font-sans">
                                    <Loader2 className="h-3.5 w-3.5 animate-spin mr-2" /> Loading properties...
                                </div>
                            ) : (
                                <Select value={selectedProperty?.id} onValueChange={handlePropertyChange}>
                                    <SelectTrigger className="h-11 bg-white border-blue-100 rounded-xl shadow-sm focus:ring-blue-500 font-sans">
                                        <SelectValue placeholder="Select Property" />
                                    </SelectTrigger>
                                    <SelectContent className="rounded-xl border-blue-100 shadow-xl max-h-64">
                                        {properties.map(p => (
                                            <SelectItem key={p.id} value={p.id} className="font-sans py-2.5">
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
                            <Label className="text-[11px] font-bold text-blue-900/60 uppercase tracking-wider font-sans ml-1">Web Stream</Label>
                            <Select
                                value={selectedStream?.id}
                                onValueChange={(id) => setSelectedStream(streams.find(s => s.id === id) || null)}
                                disabled={!selectedProperty || loadingStreams}
                            >
                                <SelectTrigger className="h-11 bg-white border-blue-100 rounded-xl shadow-sm focus:ring-blue-500 font-sans">
                                    <SelectValue placeholder={loadingStreams ? "Loading streams..." : "Select Stream"} />
                                </SelectTrigger>
                                <SelectContent className="rounded-xl border-blue-100 shadow-xl max-h-64">
                                    {streams.map(s => (
                                        <SelectItem key={s.id} value={s.id} className="font-sans py-2.5">
                                            <div className="flex flex-col">
                                                <span className="font-semibold text-gray-900">{s.displayName || s.name}</span>
                                                <span className="text-[10px] text-gray-400 font-mono italic">{s.measurementId}</span>
                                            </div>
                                        </SelectItem>
                                    ))}
                                    {streams.length === 0 && !loadingStreams && (
                                        <p className="px-4 py-8 text-center text-xs text-gray-400 italic font-sans">No web streams found</p>
                                    )}
                                </SelectContent>
                            </Select>
                        </div>

                        <div className="flex items-end">
                            <Button
                                onClick={handleSave}
                                disabled={!selectedStream || completing}
                                className="h-11 px-8 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-sans font-bold shadow-lg shadow-blue-500/20 active:scale-95 transition-all w-full md:w-auto"
                            >
                                {completing ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <CheckCircle className="h-4 w-4 mr-2" />}
                                Save Configuration
                            </Button>
                        </div>
                    </div>
                </div>
            )}

            {/* KPI cards */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                {Object.entries(SOURCE_CONFIG).map(([source, cfg]) => {
                    const data = sessionsBySource[source] || { sessions: 0, prevSessions: 0 };
                    const growth = data.prevSessions > 0
                        ? ((data.sessions - data.prevSessions) / data.prevSessions) * 100
                        : 0;

                    return (
                        <div key={source} className={cn("rounded-xl border p-4 bg-white", cfg.bg.split(" ")[1])}>
                            <div className="flex items-center justify-between mb-2">
                                <div className="flex items-center gap-2">
                                    <span className="text-base">{cfg.icon}</span>
                                    <span className="text-xs font-medium text-gray-700">{source}</span>
                                </div>
                                {data.sessions > 0 && growth !== 0 && (
                                    <Badge className={cn(
                                        "text-[10px] font-bold border-0",
                                        growth > 0 ? "text-emerald-700 bg-emerald-100" : "text-rose-700 bg-rose-100"
                                    )}>
                                        {growth > 0 ? "+" : ""}{growth.toFixed(0)}%
                                    </Badge>
                                )}
                            </div>
                            <div className="text-2xl font-bold" style={{ color: cfg.color }}>
                                {data.sessions.toLocaleString()}
                            </div>
                            <div className="text-[10px] text-gray-500 mt-0.5">sessions ({rangeFilter})</div>
                        </div>
                    );
                })}
            </div>

            {/* Dual-axis Correlation Chart */}
            <div className="bg-white rounded-2xl border border-gray-200 p-5 shadow-sm">
                <div className="mb-4">
                    <h3 className="font-semibold text-gray-900 text-base flex items-center gap-2">
                        <TrendingUp className="h-4 w-4 text-blue-500" />
                        Visibility vs. Traffic Correlation
                    </h3>
                    <p className="text-xs text-gray-500 mt-0.5">
                        Compare AI Visibility Score with referral sessions from LLM platforms
                    </p>
                </div>

                {chartData.every(d => d["AI Sessions"] === 0) ? (
                    <div className="text-center py-20 bg-gray-50/50 rounded-xl border border-dashed border-gray-200">
                        <div className="flex flex-col items-center gap-3">
                            <div className="p-3 bg-white rounded-full shadow-sm">
                                <TrendingUp className="h-6 w-6 text-gray-300" />
                            </div>
                            <div>
                                <h4 className="font-medium text-gray-900">Waiting for first sessions...</h4>
                                <p className="text-xs text-gray-400 max-w-[240px] mx-auto mt-1">
                                    Your property is connected! GA4 data typically takes 24-48 hours to appear for new streams.
                                </p>
                            </div>
                            <Button variant="outline" size="sm" onClick={() => ga4.triggerSync()} className="h-8 text-xs mt-2">
                                <RefreshCw className="h-3.5 w-3.5 mr-2" /> Check for updates
                            </Button>
                        </div>
                    </div>
                ) : (
                    <ResponsiveContainer width="100%" height={280}>
                        <ComposedChart data={chartData} margin={{ top: 5, right: 20, left: 0, bottom: 5 }}>
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
                                width={36}
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
                            {/* Bar: AI Sessions (right axis) */}
                            <Bar
                                yAxisId="right"
                                dataKey="AI Sessions"
                                fill="#bfdbfe"
                                radius={[3, 3, 0, 0]}
                                maxBarSize={20}
                                name="AI Sessions"
                            />
                            {/* Line: SOV % (left axis) */}
                            <Line
                                yAxisId="left"
                                type="monotone"
                                dataKey="SOV %"
                                stroke="#3b82f6"
                                strokeWidth={2.5}
                                dot={false}
                                activeDot={{ r: 4, strokeWidth: 0 }}
                                name="SOV %"
                            />
                        </ComposedChart>
                    </ResponsiveContainer>
                )}
            </div>

            {/* Breakdown Grid */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                {/* Per-source breakdown bars */}
                <div className="lg:col-span-2 bg-white rounded-2xl border border-gray-200 p-5 shadow-sm">
                    <h3 className="font-medium text-gray-900 mb-4 text-sm">LLM Source Sessions Trend</h3>
                    {chartData.length === 0 ? (
                        <p className="text-gray-400 text-sm text-center py-6">No data available</p>
                    ) : (
                        <ResponsiveContainer width="100%" height={200}>
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
                                {Object.entries(SOURCE_CONFIG).map(([source, cfg]) => (
                                    <Bar
                                        key={source}
                                        dataKey={source}
                                        stackId="sources"
                                        fill={cfg.color}
                                        radius={source === "Claude" || source === "Gemini" ? [2, 2, 0, 0] : undefined}
                                        maxBarSize={20}
                                    />
                                ))}
                            </ComposedChart>
                        </ResponsiveContainer>
                    )}
                </div>

                {/* Source Mix Donut */}
                <div className="bg-white rounded-2xl border border-gray-200 p-5 shadow-sm">
                    <h3 className="font-medium text-gray-900 mb-4 text-sm">Source Distribution</h3>
                    {totalSessions === 0 ? (
                        <p className="text-gray-400 text-sm text-center py-12">No traffic to distribute</p>
                    ) : (
                        <ResponsiveContainer width="100%" height={200}>
                            <PieChart>
                                <Pie
                                    data={conversionTableData}
                                    cx="50%"
                                    cy="50%"
                                    innerRadius={60}
                                    outerRadius={80}
                                    paddingAngle={5}
                                    dataKey="sessions"
                                    nameKey="source"
                                >
                                    {conversionTableData.map((entry, index) => (
                                        <Cell key={`cell-${index}`} fill={SOURCE_CONFIG[entry.source]?.color || "#cbd5e1"} />
                                    ))}
                                </Pie>
                                <RechartsTooltip
                                    formatter={(value: number | undefined) => [`${value || 0} sessions`, "Traffic"]}
                                    contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 10px 15px -3px rgb(0 0 0 / 0.1)' }}
                                />
                            </PieChart>
                        </ResponsiveContainer>
                    )}
                </div>
            </div>

            {/* Conversion Table */}
            <div className="bg-white rounded-2xl border border-gray-200 shadow-sm overflow-hidden">
                <div className="p-5 border-b border-gray-100 flex items-center justify-between">
                    <div>
                        <h3 className="font-semibold text-gray-900 text-base">Conversion Attribution</h3>
                        <p className="text-xs text-gray-500 mt-0.5">LLM-referred sessions and key events</p>
                    </div>
                    <Badge className="bg-purple-100 text-purple-700 border-0 text-xs">Pro Feature</Badge>
                </div>

                <div className="overflow-x-auto">
                    <table className="w-full">
                        <thead>
                            <tr className="text-xs font-semibold text-gray-500 uppercase tracking-wider border-b border-gray-100">
                                <th className="text-left py-3 px-5">Source</th>
                                <th className="text-right py-3 px-4">Visits</th>
                                <th className="text-right py-3 px-4">Act. Users</th>
                                <th className="text-right py-3 px-4">Engagement</th>
                                <th className="text-right py-3 px-4">Conversions</th>
                                <th className="text-right py-3 px-5">Conv. Rate</th>
                            </tr>
                        </thead>
                        <tbody className="text-sm divide-y divide-gray-50">
                            {conversionTableData.map((row) => {
                                const cfg = SOURCE_CONFIG[row.source] || {};
                                return (
                                    <tr key={row.source} className="hover:bg-gray-50/60 transition-colors">
                                        <td className="py-3 px-5">
                                            <div className="flex items-center gap-2">
                                                <span className="text-base">{cfg.icon}</span>
                                                <span className="font-medium text-gray-800">{row.source}</span>
                                            </div>
                                        </td>
                                        <td className="py-3 px-4 text-right text-gray-700 font-medium">
                                            {row.sessions.toLocaleString()}
                                        </td>
                                        <td className="py-3 px-4 text-right text-gray-600">
                                            {row.activeUsers.toLocaleString()}
                                        </td>
                                        <td className="py-3 px-4 text-right text-gray-600 font-medium">
                                            {(row.avgEngagement * 100).toFixed(1)}%
                                        </td>
                                        <td className="py-3 px-4 text-right text-gray-700">
                                            {row.conversions.toLocaleString()}
                                        </td>
                                        <td className="py-3 px-5 text-right">
                                            <span
                                                className={cn(
                                                    "px-2 py-0.5 rounded-full text-xs font-semibold",
                                                    parseFloat(row.cvr) > 0
                                                        ? "bg-emerald-100 text-emerald-700"
                                                        : "bg-gray-100 text-gray-500"
                                                )}
                                            >
                                                {row.cvr}%
                                            </span>
                                        </td>
                                    </tr>
                                );
                            })}
                            {conversionTableData.length === 0 && (
                                <tr>
                                    <td colSpan={4} className="py-10 text-center text-gray-400 text-sm italic">
                                        No conversion data yet — data populates after your first sync completes.
                                    </td>
                                </tr>
                            )}
                            {conversionTableData.length > 0 && (
                                <tr className="bg-gray-50 font-semibold text-gray-800">
                                    <td className="py-3 px-5">Total</td>
                                    <td className="py-3 px-4 text-right">{totalSessions.toLocaleString()}</td>
                                    <td className="py-3 px-4 text-right">{totalConversions.toLocaleString()}</td>
                                    <td className="py-3 px-5 text-right">
                                        <span className="px-2 py-0.5 rounded-full text-xs font-semibold bg-blue-100 text-blue-700">
                                            {totalSessions > 0
                                                ? ((totalConversions / totalSessions) * 100).toFixed(1)
                                                : "0.0"}
                                            %
                                        </span>
                                    </td>
                                </tr>
                            )}
                        </tbody>
                    </table>
                </div>
            </div>
        </div>
    );
}

export default TrafficTab;
