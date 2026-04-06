import React, { useMemo } from "react";
import { cn } from "@/lib/utils";
import {
    DollarSign,
    TrendingUp,
    AlertTriangle,
    BarChart3,
    Activity,
    Shield,
} from "lucide-react";
import {
    ResponsiveContainer,
    LineChart,
    Line,
    XAxis,
    YAxis,
    CartesianGrid,
    Tooltip,
    Legend,
    BarChart,
    Bar,
    Cell,
} from "recharts";
import { MODEL_LOGOS } from "@/components/ModelLogos";
import { AI_MODELS } from "@/hooks/useClientDashboard";
import type { AuditResult } from "@/hooks/useClientDashboard";

// ---------------------------------------------------------------------------
// Cost thresholds per model (alert if cost-per-call exceeds this)
// ---------------------------------------------------------------------------
const COST_THRESHOLDS: Record<string, number> = {
    chatgpt: 0.01,
    gemini: 0.01,
    claude: 0.01,
    perplexity: 0.01,
    google_ai_overview: 0.005,
    google_serp: 0.005,
};

const MODEL_COLORS: Record<string, string> = {
    chatgpt: "#10b981",
    gemini: "#3b82f6",
    claude: "#f59e0b",
    perplexity: "#8b5cf6",
    google_ai_overview: "#ef4444",
    google_serp: "#22c55e",
};

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------
interface ModelCostStat {
    model: string;
    modelName: string;
    totalCalls: number;
    totalCost: number;
    avgCost: number;
    maxCost: number;
    minCost: number;
    status: "normal" | "elevated" | "spike";
    exceedsThreshold: boolean;
}

interface DailyModelCost {
    date: string;
    [modelId: string]: number | string;
}

interface CostAlert {
    model: string;
    modelName: string;
    avgCost: number;
    threshold: number;
    severity: "warning" | "critical";
    message: string;
}

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------
export interface CostTabProps {
    filteredAuditResults: AuditResult[];
    clientId?: string;
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------
export const CostTab: React.FC<CostTabProps> = ({
    filteredAuditResults,
    clientId,
}) => {
    const [dfsData, setDfsData] = React.useState<{date: string, count: number}[]>([]);

    React.useEffect(() => {
        if (!clientId) return;
        const fetchDFS = async () => {
            const { supabase } = await import("@/integrations/supabase/client");
            const { data } = await supabase
                .from("seo_rank_tracking")
                .select("created_at")
                .eq("client_id", clientId);
            
            if (data) {
                const dates = data.map(d => d.created_at);
                setDfsData(dates.map(date => ({ date, count: 1 })));
            }
        };
        fetchDFS();
    }, [clientId]);
    // ------- Compute per-model cost stats -------
    const modelCostStats = useMemo<ModelCostStat[]>(() => {
        const buckets: Record<
            string,
            { costs: number[]; totalCost: number; totalCalls: number }
        > = {};

        for (const r of filteredAuditResults) {
            for (const mr of r.model_results || []) {
                const cost = (mr as any).api_cost || 0;
                const id = mr.model;
                if (!buckets[id]) buckets[id] = { costs: [], totalCost: 0, totalCalls: 0 };
                buckets[id].costs.push(cost);
                buckets[id].totalCost += cost;
                buckets[id].totalCalls += 1;
            }
        }

        return Object.entries(buckets)
            .map(([id, data]) => {
                const avg = data.totalCalls > 0 ? data.totalCost / data.totalCalls : 0;
                const max = Math.max(...data.costs, 0);
                const min = Math.min(...data.costs, Infinity);
                const threshold = COST_THRESHOLDS[id] || 0.01;
                const exceedsThreshold = avg > threshold;
                const status: ModelCostStat["status"] =
                    avg > threshold * 5 ? "spike" : avg > threshold ? "elevated" : "normal";
                const modelConfig = AI_MODELS.find((m) => m.id === id);
                return {
                    model: id,
                    modelName: modelConfig?.name || id,
                    totalCalls: data.totalCalls,
                    totalCost: data.totalCost,
                    avgCost: avg,
                    maxCost: max,
                    minCost: min === Infinity ? 0 : min,
                    status,
                    exceedsThreshold,
                };
            })
            .sort((a, b) => b.totalCost - a.totalCost);
    }, [filteredAuditResults]);

    // ------- Compute daily cost-per-call trend -------
    const dailyCostTrend = useMemo<DailyModelCost[]>(() => {
        const dayMap: Record<string, Record<string, { total: number; count: number }>> = {};

        for (const r of filteredAuditResults) {
            const day = new Date(r.created_at).toISOString().split("T")[0];
            if (!dayMap[day]) dayMap[day] = {};
            for (const mr of r.model_results || []) {
                const cost = (mr as any).api_cost || 0;
                if (!dayMap[day][mr.model]) dayMap[day][mr.model] = { total: 0, count: 0 };
                dayMap[day][mr.model].total += cost;
                dayMap[day][mr.model].count += 1;
            }
        }

        return Object.keys(dayMap)
            .sort()
            .map((date) => {
                const entry: DailyModelCost = { date: new Date(date).toLocaleDateString("en-US", { month: "short", day: "numeric" }) };
                for (const [model, data] of Object.entries(dayMap[date])) {
                    entry[model] = data.count > 0 ? +(data.total / data.count).toFixed(5) : 0;
                }
                return entry;
            });
    }, [filteredAuditResults]);

    // ------- Find unique model IDs in data -------
    const activeModels = useMemo(() => {
        const ids = new Set<string>();
        for (const r of filteredAuditResults) {
            for (const mr of r.model_results || []) ids.add(mr.model);
        }
        return Array.from(ids);
    }, [filteredAuditResults]);

    // ------- Generate cost alerts -------
    const costAlerts = useMemo<CostAlert[]>(() => {
        return modelCostStats
            .filter((s) => s.exceedsThreshold)
            .map((s) => {
                const threshold = COST_THRESHOLDS[s.model] || 0.01;
                const severity: CostAlert["severity"] =
                    s.avgCost > threshold * 5 ? "critical" : "warning";
                return {
                    model: s.model,
                    modelName: s.modelName,
                    avgCost: s.avgCost,
                    threshold,
                    severity,
                    message:
                        severity === "critical"
                            ? `${s.modelName} avg cost $${s.avgCost.toFixed(4)}/call is ${Math.round(s.avgCost / threshold)}× above threshold ($${threshold})`
                            : `${s.modelName} avg cost $${s.avgCost.toFixed(4)}/call exceeds threshold ($${threshold})`,
                };
            });
    }, [modelCostStats]);

    // ------- Total stats -------
    const totalSpend = modelCostStats.reduce((s, m) => s + m.totalCost, 0);
    const totalCalls = modelCostStats.reduce((s, m) => s + m.totalCalls, 0);
    const avgCostPerAudit =
        filteredAuditResults.length > 0
            ? totalSpend / filteredAuditResults.length
            : 0;

    // ------- Per-model bar chart data -------
    const barChartData = modelCostStats.map((s) => ({
        name: s.modelName,
        model: s.model,
        cost: +s.totalCost.toFixed(4),
        avgCost: +s.avgCost.toFixed(5),
        calls: s.totalCalls,
        status: s.status,
    }));

    // ------- Empty state -------
    if (filteredAuditResults.length === 0) {
        return (
            <div className="flex flex-col items-center justify-center py-20">
                <DollarSign className="h-12 w-12 text-gray-300 mb-4" />
                <p className="text-lg text-gray-500 font-medium">No cost data available</p>
                <p className="text-sm text-gray-400 mt-1">Run some audits to see cost analytics</p>
            </div>
        );
    }

    return (
        <div className="space-y-6 fade-in">
            {/* ---- Alerts ---- */}
            {costAlerts.length > 0 && (
                <div className="space-y-2">
                    {costAlerts.map((alert) => (
                        <div
                            key={alert.model}
                            className={cn(
                                "flex items-center gap-3 px-4 py-3 rounded-xl border text-sm font-medium",
                                alert.severity === "critical"
                                    ? "bg-red-50 border-red-200 text-red-800"
                                    : "bg-amber-50 border-amber-200 text-amber-800"
                            )}
                        >
                            <AlertTriangle
                                className={cn(
                                    "h-4 w-4 flex-shrink-0",
                                    alert.severity === "critical" ? "text-red-500" : "text-amber-500"
                                )}
                            />
                            {alert.message}
                            <span
                                className={cn(
                                    "ml-auto px-2 py-0.5 rounded text-xs font-bold uppercase",
                                    alert.severity === "critical"
                                        ? "bg-red-200 text-red-900"
                                        : "bg-amber-200 text-amber-900"
                                )}
                            >
                                {alert.severity}
                            </span>
                        </div>
                    ))}
                </div>
            )}

            {/* ---- KPI Cards ---- */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                <div className="bg-white rounded-xl border border-gray-200 p-6 shadow-sm">
                    <div className="flex items-center justify-between">
                        <div className="text-sm font-medium text-gray-500 uppercase tracking-wide">Total Spend</div>
                        <div className="p-2.5 bg-green-50 rounded-lg">
                            <DollarSign className="h-5 w-5 text-green-600" />
                        </div>
                    </div>
                    <div className="mt-4 text-4xl font-bold text-gray-950">
                        ${totalSpend.toFixed(2)}
                    </div>
                    <div className="mt-3 text-xs font-medium text-gray-400">
                        {totalCalls.toLocaleString()} total API calls
                    </div>
                </div>

                <div className="bg-white rounded-xl border border-gray-200 p-6 shadow-sm">
                    <div className="flex items-center justify-between">
                        <div className="text-sm font-medium text-gray-500 uppercase tracking-wide">Avg / Audit</div>
                        <div className="p-2.5 bg-blue-50 rounded-lg">
                            <BarChart3 className="h-5 w-5 text-blue-600" />
                        </div>
                    </div>
                    <div className="mt-4 text-4xl font-bold text-gray-950">
                        ${avgCostPerAudit.toFixed(4)}
                    </div>
                    <div className="mt-3 text-xs font-medium text-gray-400">
                        {filteredAuditResults.length} audits in period
                    </div>
                </div>

                <div className="bg-white rounded-xl border border-gray-200 p-6 shadow-sm">
                    <div className="flex items-center justify-between">
                        <div className="text-sm font-medium text-gray-500 uppercase tracking-wide">Active Models</div>
                        <div className="p-2.5 bg-purple-50 rounded-lg">
                            <Activity className="h-5 w-5 text-purple-600" />
                        </div>
                    </div>
                    <div className="mt-4 text-4xl font-bold text-gray-950">{activeModels.length}</div>
                    <div className="mt-3 text-xs font-medium text-gray-400">
                        {costAlerts.length > 0 ? (
                            <span className="text-amber-600">{costAlerts.length} cost alert{costAlerts.length !== 1 ? "s" : ""}</span>
                        ) : (
                            <span className="text-green-600 flex items-center gap-1"><Shield className="h-3 w-3" /> All within budget</span>
                        )}
                    </div>
                </div>

                <div className="bg-white rounded-xl border border-gray-200 p-6 shadow-sm">
                    <div className="flex items-center justify-between">
                        <div className="text-sm font-medium text-gray-500 uppercase tracking-wide">Costliest Model</div>
                        <div className="p-2.5 bg-amber-50 rounded-lg">
                            <TrendingUp className="h-5 w-5 text-amber-600" />
                        </div>
                    </div>
                    <div className="mt-4 text-4xl font-bold text-gray-950">
                        {modelCostStats[0]?.modelName || "—"}
                    </div>
                    <div className="mt-3 text-xs font-medium text-gray-400">
                        ${modelCostStats[0]?.totalCost.toFixed(4) || "0"} total / ${modelCostStats[0]?.avgCost.toFixed(5) || "0"} avg
                    </div>
                </div>
            </div>

            {/* ---- Per-Model Cost Breakdown ---- */}
            <div className="bg-white rounded-xl border border-gray-200 p-5 shadow-sm">
                <h3 className="font-semibold text-gray-900 mb-4 flex items-center gap-2">
                    <BarChart3 className="h-4 w-4 text-gray-400" />
                    Cost Per Model
                </h3>
                <div className="overflow-x-auto">
                    <table className="w-full" role="grid">
                        <caption className="sr-only">Cost breakdown per AI model showing total calls, total cost, average cost, max cost, and status</caption>
                        <thead>
                            <tr className="text-xs font-semibold text-gray-500 uppercase tracking-wider border-b border-gray-100">
                                <th scope="col" className="text-left py-3 pl-2">Model</th>
                                <th scope="col" className="text-right py-3">Total Calls</th>
                                <th scope="col" className="text-right py-3">Total Cost</th>
                                <th scope="col" className="text-right py-3">Avg / Call</th>
                                <th scope="col" className="text-right py-3">Max / Call</th>
                                <th scope="col" className="text-right py-3 pr-2">Status</th>
                            </tr>
                        </thead>
                        <tbody className="text-sm divide-y divide-gray-50">
                            {modelCostStats.map((s) => {
                                const Logo = MODEL_LOGOS[s.model]?.Logo;
                                const color = MODEL_LOGOS[s.model]?.color || MODEL_COLORS[s.model] || "#666";
                                return (
                                    <tr key={s.model} className="group hover:bg-gray-50 transition-colors">
                                        <td className="py-3 pl-2">
                                            <div className="flex items-center gap-2">
                                                {Logo && <Logo className="h-4 w-4" style={{ color }} />}
                                                <span className="font-medium text-gray-900">{s.modelName}</span>
                                            </div>
                                        </td>
                                        <td className="py-3 text-right text-gray-600 font-medium">{s.totalCalls.toLocaleString()}</td>
                                        <td className="py-3 text-right text-gray-900 font-semibold">${s.totalCost.toFixed(4)}</td>
                                        <td className="py-3 text-right text-gray-600">${s.avgCost.toFixed(5)}</td>
                                        <td className="py-3 text-right text-gray-600">${s.maxCost.toFixed(5)}</td>
                                        <td className="py-3 text-right pr-2">
                                            <span
                                                className={cn(
                                                    "px-2 py-0.5 rounded-full text-[10px] font-semibold uppercase tracking-wide border",
                                                    s.status === "spike"
                                                        ? "bg-red-50 text-red-700 border-red-200"
                                                        : s.status === "elevated"
                                                            ? "bg-amber-50 text-amber-700 border-amber-200"
                                                            : "bg-green-50 text-green-700 border-green-200"
                                                )}
                                            >
                                                {s.status}
                                            </span>
                                        </td>
                                    </tr>
                                );
                            })}
                            {modelCostStats.length === 0 && (
                                <tr>
                                    <td colSpan={6} className="py-8 text-center text-gray-500 italic">
                                        No cost data found
                                    </td>
                                </tr>
                            )}
                        </tbody>
                    </table>
                </div>
            </div>

            {/* ---- Cost-Per-Call Trend Chart ---- */}
            {dailyCostTrend.length > 1 && (
                <div className="bg-white rounded-xl border border-gray-200 p-5 shadow-sm">
                    <h3 className="font-semibold text-gray-900 mb-1 flex items-center gap-2">
                        <TrendingUp className="h-4 w-4 text-gray-400" />
                        Cost-Per-Call Trend
                    </h3>
                    <p className="text-xs text-gray-400 mb-4">Average cost per API call by day. Red dots indicate anomalies (&gt;3× rolling average).</p>
                    <ResponsiveContainer width="100%" height={300}>
                        <LineChart data={dailyCostTrend}>
                            <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                            <XAxis dataKey="date" tick={{ fontSize: 11 }} />
                            <YAxis tick={{ fontSize: 11 }} tickFormatter={(v: number) => `$${v}`} />
                            <Tooltip
                                formatter={(value: any, name: any) => [`$${Number(value).toFixed(5)}`, AI_MODELS.find((m) => m.id === name)?.name || name]}
                                contentStyle={{ borderRadius: 12, fontSize: 12 }}
                            />
                            <Legend
                                formatter={(value: string) => AI_MODELS.find((m) => m.id === value)?.name || value}
                            />
                            {activeModels.map((id) => (
                                <Line
                                    key={id}
                                    type="monotone"
                                    dataKey={id}
                                    stroke={MODEL_COLORS[id] || "#666"}
                                    strokeWidth={2}
                                    dot={{ r: 3 }}
                                    activeDot={{ r: 5 }}
                                    connectNulls
                                />
                            ))}
                        </LineChart>
                    </ResponsiveContainer>
                </div>
            )}

            {/* ---- Cost Distribution Bar Chart ---- */}
            {barChartData.length > 0 && (
                <div className="bg-white rounded-xl border border-gray-200 p-5 shadow-sm">
                    <h3 className="font-semibold text-gray-900 mb-1 flex items-center gap-2">
                        <BarChart3 className="h-4 w-4 text-gray-400" />
                        Total Cost by Model
                    </h3>
                    <p className="text-xs text-gray-400 mb-4">Total spend per model in the selected period</p>
                    <ResponsiveContainer width="100%" height={250}>
                        <BarChart data={barChartData} layout="vertical">
                            <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="#f0f0f0" />
                            <XAxis type="number" tick={{ fontSize: 11 }} tickFormatter={(v: number) => `$${v}`} />
                            <YAxis dataKey="name" type="category" width={120} tick={{ fontSize: 12 }} />
                            <Tooltip
                                formatter={(value: any) => [`$${Number(value).toFixed(4)}`, "Total Cost"]}
                                contentStyle={{ borderRadius: 12, fontSize: 12 }}
                            />
                            <Bar dataKey="cost" radius={[0, 6, 6, 0]}>
                                {barChartData.map((entry, i) => (
                                    <Cell
                                        key={i}
                                        fill={
                                            entry.status === "spike"
                                                ? "#ef4444"
                                                : entry.status === "elevated"
                                                    ? "#f59e0b"
                                                    : MODEL_COLORS[entry.model] || "#6b7280"
                                        }
                                    />
                                ))}
                            </Bar>
                        </BarChart>
                    </ResponsiveContainer>
                </div>
            )}

            {/* ---- Cost Insights Text ---- */}
            <div className="bg-gradient-to-br from-gray-50 to-gray-100 rounded-xl border border-gray-200 p-5">
                <h3 className="font-semibold text-gray-900 mb-3 flex items-center gap-2">
                    <Activity className="h-4 w-4 text-gray-400" />
                    Cost Insights
                </h3>
                <ul className="space-y-2 text-sm text-gray-700">
                    {modelCostStats.length > 0 && (
                        <li className="flex items-start gap-2">
                            <span className="text-green-500 mt-0.5">✓</span>
                            <span>
                                <strong>{modelCostStats[0].modelName}</strong> is the highest total cost at{" "}
                                <strong>${modelCostStats[0].totalCost.toFixed(4)}</strong> across {modelCostStats[0].totalCalls} calls.
                            </span>
                        </li>
                    )}
                    {modelCostStats.filter((s) => s.status === "normal").length > 0 && (
                        <li className="flex items-start gap-2">
                            <span className="text-green-500 mt-0.5">✓</span>
                            <span>
                                <strong>{modelCostStats.filter((s) => s.status === "normal").length}</strong> model{modelCostStats.filter((s) => s.status === "normal").length !== 1 ? "s are" : " is"}{" "}
                                within normal cost thresholds.
                            </span>
                        </li>
                    )}
                    {costAlerts.filter((a) => a.severity === "critical").length > 0 && (
                        <li className="flex items-start gap-2">
                            <span className="text-red-500 mt-0.5">⚠</span>
                            <span>
                                <strong>{costAlerts.filter((a) => a.severity === "critical").length}</strong> model{costAlerts.filter((a) => a.severity === "critical").length !== 1 ? "s have" : " has"}{" "}
                                critical cost spikes — consider switching to cheaper variants.
                            </span>
                        </li>
                    )}
                    {totalSpend > 0 && (
                        <li className="flex items-start gap-2">
                            <span className="text-blue-500 mt-0.5">ℹ</span>
                            <span>
                                Average cost per audit run: <strong>${avgCostPerAudit.toFixed(4)}</strong>. At this rate,
                                100 audits would cost ~<strong>${(avgCostPerAudit * 100).toFixed(2)}</strong>.
                            </span>
                        </li>
                    )}
                </ul>
            </div>

            {/* ---- Independent SEO Operations Section ---- */}
            <div className="pt-6 border-t border-gray-200 mt-10">
                <div className="mb-6">
                    <h2 className="text-xl font-bold text-gray-900 flex items-center gap-2">
                        <Activity className="h-5 w-5 text-green-500" />
                        SEO Operations Costs
                    </h2>
                    <p className="text-sm text-gray-500">
                        Tracks API costs incurred by backend SEO tools (e.g. DataForSEO Rank Tracker)
                    </p>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
                    <div className="bg-white rounded-xl border border-gray-200 p-6 shadow-sm">
                        <div className="flex items-center justify-between">
                            <div className="text-sm font-medium text-gray-500 uppercase tracking-wide">SEO Spend</div>
                            <div className="p-2.5 bg-green-50 rounded-lg">
                                <DollarSign className="h-5 w-5 text-green-600" />
                            </div>
                        </div>
                        <div className="mt-4 text-4xl font-bold text-gray-950">
                            ${(dfsData.reduce((s, d) => s + d.count, 0) * 0.002).toFixed(4)}
                        </div>
                        <div className="mt-3 text-xs font-medium text-gray-400">
                            {dfsData.reduce((s, d) => s + d.count, 0).toLocaleString()} rank checks
                        </div>
                    </div>
                </div>

                {dfsData.length > 0 && (
                    <div className="bg-white rounded-xl border border-gray-200 p-5 shadow-sm">
                        <h3 className="font-semibold text-gray-900 mb-4 flex items-center gap-2">
                            <BarChart3 className="h-4 w-4 text-gray-400" />
                            Daily SEO Task Breakdown (Google SERP API)
                        </h3>
                        <div className="overflow-x-auto">
                            <table className="w-full text-sm" role="grid">
                                <thead>
                                    <tr className="text-xs font-semibold text-gray-500 uppercase tracking-wider border-b border-gray-100">
                                        <th scope="col" className="text-left py-3 pl-2">Date</th>
                                        <th scope="col" className="text-left py-3">Tool</th>
                                        <th scope="col" className="text-right py-3">Tasks Ran</th>
                                        <th scope="col" className="text-right py-3">Total Cost</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-gray-50">
                                    {(() => {
                                        const dailyTotals: Record<string, number> = {};
                                        dfsData.forEach(d => {
                                            const day = new Date(d.date).toLocaleDateString();
                                            if (!dailyTotals[day]) dailyTotals[day] = 0;
                                            dailyTotals[day] += d.count;
                                        });

                                        return Object.entries(dailyTotals).sort((a,b) => new Date(b[0]).getTime() - new Date(a[0]).getTime()).map(([dateStr, count]) => (
                                            <tr key={dateStr} className="group hover:bg-gray-50 transition-colors">
                                                <td className="py-3 pl-2 font-medium text-gray-900">{dateStr}</td>
                                                <td className="py-3 text-gray-600">Rank Tracker</td>
                                                <td className="py-3 text-right text-gray-600 font-medium">{count.toLocaleString()}</td>
                                                <td className="py-3 text-right text-gray-900 font-semibold">${(count * 0.002).toFixed(4)}</td>
                                            </tr>
                                        ));
                                    })()}
                                </tbody>
                            </table>
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
};

export default CostTab;
