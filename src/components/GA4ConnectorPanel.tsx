import React, { useState, useEffect } from "react";
import {
    BarChart3, CheckCircle, RefreshCw, Unlink, AlertCircle,
    Loader2, ChevronDown, TrendingUp, ExternalLink, Info, X
} from "lucide-react";
import { Button } from "@/components/ui/button";
import {
    Select, SelectContent, SelectItem, SelectTrigger, SelectValue
} from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import {
    useGA4Connector,
    type GA4Property,
    type GA4Stream,
    type GA4ConnectorHook
} from "@/hooks/useGA4Connector";
import type { Client } from "@/hooks/useClientDashboard";

// ── Source config ─────────────────────────────────────────────────────────
const SOURCE_CONFIG: Record<string, { color: string; bg: string; icon: string }> = {
    ChatGPT: { color: "#10a37f", bg: "bg-emerald-50", icon: "🤖" },
    Perplexity: { color: "#6366f1", bg: "bg-indigo-50", icon: "🔮" },
    Gemini: { color: "#4285f4", bg: "bg-blue-50", icon: "✨" },
    Claude: { color: "#d97706", bg: "bg-amber-50", icon: "🧠" },
};

// ── Tooltip helper ────────────────────────────────────────────────────────
function Tooltip({ content, children }: { content: string; children: React.ReactNode }) {
    const [visible, setVisible] = useState(false);
    return (
        <span
            className="relative inline-flex"
            onMouseEnter={() => setVisible(true)}
            onMouseLeave={() => setVisible(false)}
        >
            {children}
            {visible && (
                <span className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 w-56 px-3 py-2 bg-gray-900 text-white text-xs rounded-lg shadow-xl z-50 pointer-events-none">
                    {content}
                    <span className="absolute top-full left-1/2 -translate-x-1/2 border-4 border-transparent border-t-gray-900" />
                </span>
            )}
        </span>
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

// ────────────────────────────────────────────────────────────────────────────
// Main GA4ConnectorPanel Component
// ────────────────────────────────────────────────────────────────────────────

interface GA4ConnectorPanelProps {
    selectedClient: Client | null;
    ga4: GA4ConnectorHook;
}

export function GA4ConnectorPanel({ selectedClient, ga4 }: GA4ConnectorPanelProps) {
    const {
        integration,
        loading,
        syncing,
        last7DaysBySource,
        totalLLMSessionsLast7,
        startOAuth,
        listProperties,
        listStreams,
        saveProperty,
        triggerSync,
        disconnect,
    } = ga4;

    // Configuration state
    const [configStep, setConfigStep] = useState<"property" | "stream">("property");
    const [properties, setProperties] = useState<GA4Property[]>([]);
    const [streams, setStreams] = useState<GA4Stream[]>([]);
    const [selectedProperty, setSelectedProperty] = useState<GA4Property | null>(null);
    const [selectedStream, setSelectedStream] = useState<GA4Stream | null>(null);
    const [loadingProps, setLoadingProps] = useState(false);
    const [loadingStreams, setLoadingStreams] = useState(false);
    const [propError, setPropError] = useState<string | null>(null);
    const [streamError, setStreamError] = useState<string | null>(null);
    const [showDisconnectModal, setShowDisconnectModal] = useState(false);
    const [completing, setCompleting] = useState(false);

    const loadProps = async () => {
        if (integration?.status !== "pending") return;
        setLoadingProps(true);
        setPropError(null);
        try {
            const p = await listProperties();
            setProperties(p);
        } catch (e: any) {
            setPropError(e.message || "Failed to load properties");
            console.error(e);
        } finally {
            setLoadingProps(false);
        }
    };

    // Load properties when entering pending/configure state
    useEffect(() => {
        loadProps();
    }, [integration?.status]);

    // Load streams when property is selected
    const handlePropertyChange = async (propId: string) => {
        const prop = properties.find((p) => p.id === propId) || null;
        setSelectedProperty(prop);
        setSelectedStream(null);
        setStreams([]);
        setStreamError(null);
        if (!prop) return;
        setLoadingStreams(true);
        try {
            const s = await listStreams(prop.id);
            setStreams(s);
        } catch (e: any) {
            setStreamError(e.message || "Failed to load streams");
            console.error(e);
        } finally {
            setLoadingStreams(false);
        }
    };

    const handleCompleteIntegration = async () => {
        if (!selectedProperty || !selectedStream) return;
        setCompleting(true);
        try {
            await saveProperty(selectedProperty, selectedStream);
        } finally {
            setCompleting(false);
        }
    };

    // ── Format "last synced" relative time ─────────────────────────────────
    const lastSyncedLabel = (() => {
        if (!integration?.last_synced_at) return "Never";
        const diff = Date.now() - new Date(integration.last_synced_at).getTime();
        const mins = Math.floor(diff / 60000);
        if (mins < 1) return "Just now";
        if (mins < 60) return `${mins}m ago`;
        const hrs = Math.floor(mins / 60);
        if (hrs < 24) return `${hrs}h ago`;
        return `${Math.floor(hrs / 24)}d ago`;
    })();

    // ════════════════════════════════════════════════════════════════════════════
    // STATE 1 — DISCONNECTED
    // ════════════════════════════════════════════════════════════════════════════
    if (!integration || integration.status === "disconnected") {
        return (
            <div className="border border-gray-200 rounded-2xl overflow-hidden">
                {/* Header */}
                <div className="flex items-center gap-3 p-5 border-b border-gray-100 bg-gradient-to-r from-slate-50 to-white">
                    <div className="p-2.5 bg-white rounded-xl border border-gray-200 shadow-sm">
                        <svg viewBox="0 0 48 48" className="h-6 w-6">
                            <path fill="#FFC107" d="M43.6 20.2H42V20H24v8h11.3C33.8 32.2 29.3 35 24 35c-6.1 0-11-4.9-11-11s4.9-11 11-11c2.8 0 5.3 1 7.2 2.7l5.7-5.7C33.3 7.3 28.9 5 24 5 13 5 4 14 4 25s9 20 20 20 20-9 20-20c0-1.3-.1-2.6-.4-3.8z" />
                            <path fill="#FF3D00" d="M6.3 15.5l6.6 4.8C14.6 16.9 19 14 24 14c2.8 0 5.3 1 7.2 2.7l5.7-5.7C33.3 7.3 28.9 5 24 5c-7.8 0-14.5 4.5-17.7 10.5z" />
                            <path fill="#4CAF50" d="M24 45c4.8 0 9.2-1.8 12.5-4.8l-5.8-5.8C28.9 35.8 26.6 37 24 37c-5.3 0-9.8-3.5-11.4-8.3l-6.6 5.1C9.2 40.3 16 45 24 45z" />
                            <path fill="#1976D2" d="M43.6 20.2H42V20H24v8h11.3c-.7 2-2 3.8-3.7 5v4.1l.1-.1 6 4.8C37.5 42 44 37 44 25c0-1.3-.1-2.6-.4-3.8z" />
                        </svg>
                    </div>
                    <div>
                        <h3 className="font-semibold text-gray-900 text-sm">Google Analytics 4</h3>
                        <p className="text-xs text-gray-500">Not connected</p>
                    </div>
                    <Badge className="ml-auto bg-gray-100 text-gray-600 border-0 text-xs font-medium">Disconnected</Badge>
                </div>

                {/* Body */}
                <div className="p-6">
                    <h4 className="font-semibold text-gray-900 text-base mb-1">
                        Measure the ROI of your AI Visibility.
                    </h4>
                    <p className="text-sm text-gray-500 mb-5">
                        Connect GA4 to see how citations in AI responses translate into real web traffic and conversions.
                    </p>

                    <ul className="space-y-3 mb-7">
                        {[
                            "Track real-time referral traffic from ChatGPT, Perplexity, and Gemini",
                            "Correlate citation spikes with website sessions",
                            "Attribute lead conversions to specific LLM recommendations (Growth & Pro Tiers)",
                        ].map((point, i) => (
                            <li key={i} className="flex items-start gap-2.5 text-sm text-gray-700">
                                <CheckCircle className="h-4 w-4 text-emerald-500 flex-shrink-0 mt-0.5" />
                                {point}
                            </li>
                        ))}
                    </ul>

                    <Button
                        onClick={startOAuth}
                        disabled={loading || !selectedClient}
                        className="w-full bg-white hover:bg-gray-50 text-gray-700 border border-gray-300 shadow-sm font-medium gap-2"
                    >
                        {loading ? (
                            <><Loader2 className="h-4 w-4 animate-spin" />Connecting...</>
                        ) : (
                            <>
                                <svg viewBox="0 0 48 48" className="h-4 w-4">
                                    <path fill="#FFC107" d="M43.6 20.2H42V20H24v8h11.3C33.8 32.2 29.3 35 24 35c-6.1 0-11-4.9-11-11s4.9-11 11-11c2.8 0 5.3 1 7.2 2.7l5.7-5.7C33.3 7.3 28.9 5 24 5 13 5 4 14 4 25s9 20 20 20 20-9 20-20c0-1.3-.1-2.6-.4-3.8z" />
                                    <path fill="#FF3D00" d="M6.3 15.5l6.6 4.8C14.6 16.9 19 14 24 14c2.8 0 5.3 1 7.2 2.7l5.7-5.7C33.3 7.3 28.9 5 24 5c-7.8 0-14.5 4.5-17.7 10.5z" />
                                    <path fill="#4CAF50" d="M24 45c4.8 0 9.2-1.8 12.5-4.8l-5.8-5.8C28.9 35.8 26.6 37 24 37c-5.3 0-9.8-3.5-11.4-8.3l-6.6 5.1C9.2 40.3 16 45 24 45z" />
                                    <path fill="#1976D2" d="M43.6 20.2H42V20H24v8h11.3c-.7 2-2 3.8-3.7 5v4.1l.1-.1 6 4.8C37.5 42 44 37 44 25c0-1.3-.1-2.6-.4-3.8z" />
                                </svg>
                                Sign in with Google
                            </>
                        )}
                    </Button>
                </div>
            </div>
        );
    }

    // ════════════════════════════════════════════════════════════════════════════
    // STATE 2 — CONFIGURE (Pending: OAuth done, property not yet selected)
    // ════════════════════════════════════════════════════════════════════════════
    if (integration.status === "pending") {
        return (
            <div className="border border-blue-200 rounded-2xl overflow-hidden">
                {/* Header */}
                <div className="flex items-center gap-3 p-5 border-b border-blue-100 bg-gradient-to-r from-blue-50 to-white">
                    <div className="p-2.5 bg-white rounded-xl border border-blue-200 shadow-sm">
                        <svg viewBox="0 0 48 48" className="h-6 w-6">
                            <path fill="#FFC107" d="M43.6 20.2H42V20H24v8h11.3C33.8 32.2 29.3 35 24 35c-6.1 0-11-4.9-11-11s4.9-11 11-11c2.8 0 5.3 1 7.2 2.7l5.7-5.7C33.3 7.3 28.9 5 24 5 13 5 4 14 4 25s9 20 20 20 20-9 20-20c0-1.3-.1-2.6-.4-3.8z" />
                            <path fill="#FF3D00" d="M6.3 15.5l6.6 4.8C14.6 16.9 19 14 24 14c2.8 0 5.3 1 7.2 2.7l5.7-5.7C33.3 7.3 28.9 5 24 5c-7.8 0-14.5 4.5-17.7 10.5z" />
                            <path fill="#4CAF50" d="M24 45c4.8 0 9.2-1.8 12.5-4.8l-5.8-5.8C28.9 35.8 26.6 37 24 37c-5.3 0-9.8-3.5-11.4-8.3l-6.6 5.1C9.2 40.3 16 45 24 45z" />
                            <path fill="#1976D2" d="M43.6 20.2H42V20H24v8h11.3c-.7 2-2 3.8-3.7 5v4.1l.1-.1 6 4.8C37.5 42 44 37 44 25c0-1.3-.1-2.6-.4-3.8z" />
                        </svg>
                    </div>
                    <div className="flex-1">
                        <h3 className="font-semibold text-gray-900 text-sm">Google Analytics 4</h3>
                        <div className="flex items-center gap-1.5 mt-0.5">
                            <CheckCircle className="h-3.5 w-3.5 text-emerald-500" />
                            <span className="text-xs text-emerald-700 font-medium">
                                Connected as {integration.connected_email}
                            </span>
                        </div>
                    </div>
                </div>

                {/* Body */}
                <div className="p-6 space-y-5">
                    <div>
                        <p className="text-sm font-medium text-gray-700 mb-1.5">Select GA4 Property</p>
                        {loadingProps ? (
                            <div className="flex items-center gap-2 text-sm text-gray-500 py-3">
                                <Loader2 className="h-4 w-4 animate-spin" />
                                Fetching your GA4 properties...
                            </div>
                        ) : propError ? (
                            <div className="flex items-center justify-between text-xs text-red-500 py-2">
                                <span>{propError}</span>
                                <Button variant="ghost" size="sm" className="h-7 text-[10px]" onClick={loadProps}>Retry</Button>
                            </div>
                        ) : (
                            <Select onValueChange={handlePropertyChange}>
                                <SelectTrigger>
                                    <SelectValue placeholder="Choose a property..." />
                                </SelectTrigger>
                                <SelectContent>
                                    {properties.map((p) => (
                                        <SelectItem key={p.id} value={p.id}>
                                            <div>
                                                <div className="font-medium text-xs text-black">{p.displayName}</div>
                                                <div className="text-[10px] text-gray-400">{p.accountName}</div>
                                            </div>
                                        </SelectItem>
                                    ))}
                                    {properties.length === 0 && (
                                        <div className="px-3 py-2 text-sm text-gray-400">No properties found</div>
                                    )}
                                </SelectContent>
                            </Select>
                        )}
                    </div>

                    {selectedProperty && (
                        <div>
                            <p className="text-sm font-medium text-gray-700 mb-1.5">Select Web Data Stream</p>
                            {loadingStreams ? (
                                <div className="flex items-center gap-2 text-sm text-gray-500 py-3">
                                    <Loader2 className="h-4 w-4 animate-spin" />
                                    Fetching streams...
                                </div>
                            ) : streamError ? (
                                <div className="text-xs text-red-500 py-2">{streamError}</div>
                            ) : (
                                <Select onValueChange={(id) => setSelectedStream(streams.find((s) => s.id === id) || null)}>
                                    <SelectTrigger>
                                        <SelectValue placeholder="Choose a web stream..." />
                                    </SelectTrigger>
                                    <SelectContent>
                                        {streams.map((s) => (
                                            <SelectItem key={s.id} value={s.id}>
                                                <div>
                                                    <div className="font-medium">{s.displayName}</div>
                                                    {s.uri && <div className="text-xs text-gray-400">{s.uri}</div>}
                                                </div>
                                            </SelectItem>
                                        ))}
                                        {streams.length === 0 && (
                                            <div className="px-3 py-2 text-sm text-gray-400">No web streams found</div>
                                        )}
                                    </SelectContent>
                                </Select>
                            )}
                        </div>
                    )}

                    <div className="flex gap-3 pt-1">
                        <Button variant="outline" className="flex-1" onClick={disconnect} disabled={loading}>
                            Cancel
                        </Button>
                        <Button
                            className="flex-1 bg-blue-600 hover:bg-blue-700 text-white"
                            onClick={handleCompleteIntegration}
                            disabled={!selectedProperty || !selectedStream || completing}
                        >
                            {completing ? <><Loader2 className="h-4 w-4 animate-spin mr-2" />Saving...</> : "Complete Integration"}
                        </Button>
                    </div>
                </div>
            </div>
        );
    }

    // ════════════════════════════════════════════════════════════════════════════
    // STATE 3 — ACTIVE (Connected & configured)
    // ════════════════════════════════════════════════════════════════════════════
    const isError = integration.status === "error";

    return (
        <>
            <ConfirmDisconnectModal
                open={showDisconnectModal}
                onConfirm={() => { setShowDisconnectModal(false); disconnect(); }}
                onCancel={() => setShowDisconnectModal(false)}
            />

            <div className={cn("border rounded-2xl overflow-hidden relative shadow-sm", isError ? "border-red-200" : "border-gray-200")}>
                {/* Syncing Overlay */}
                {syncing && (
                    <div className="absolute inset-0 bg-white/40 backdrop-blur-[1px] z-10 flex items-center justify-center animate-in fade-in duration-300">
                        <div className="bg-white px-4 py-2 rounded-full shadow-lg border border-emerald-100 flex items-center gap-2">
                            <RefreshCw className="h-4 w-4 animate-spin text-emerald-600" />
                            <span className="text-xs font-semibold text-gray-700">Syncing GA4 Data...</span>
                        </div>
                    </div>
                )}

                {/* Header */}
                <div className={cn("flex items-center gap-3 p-5 border-b", isError ? "border-red-100 bg-red-50" : "border-gray-100 bg-gradient-to-r from-emerald-50 to-white")}>
                    <div className="p-2.5 bg-white rounded-xl border border-gray-200 shadow-sm">
                        <svg viewBox="0 0 48 48" className="h-6 w-6">
                            <path fill="#FFC107" d="M43.6 20.2H42V20H24v8h11.3C33.8 32.2 29.3 35 24 35c-6.1 0-11-4.9-11-11s4.9-11 11-11c2.8 0 5.3 1 7.2 2.7l5.7-5.7C33.3 7.3 28.9 5 24 5 13 5 4 14 4 25s9 20 20 20 20-9 20-20c0-1.3-.1-2.6-.4-3.8z" />
                            <path fill="#FF3D00" d="M6.3 15.5l6.6 4.8C14.6 16.9 19 14 24 14c2.8 0 5.3 1 7.2 2.7l5.7-5.7C33.3 7.3 28.9 5 24 5c-7.8 0-14.5 4.5-17.7 10.5z" />
                            <path fill="#4CAF50" d="M24 45c4.8 0 9.2-1.8 12.5-4.8l-5.8-5.8C28.9 35.8 26.6 37 24 37c-5.3 0-9.8-3.5-11.4-8.3l-6.6 5.1C9.2 40.3 16 45 24 45z" />
                            <path fill="#1976D2" d="M43.6 20.2H42V20H24v8h11.3c-.7 2-2 3.8-3.7 5v4.1l.1-.1 6 4.8C37.5 42 44 37 44 25c0-1.3-.1-2.6-.4-3.8z" />
                        </svg>
                    </div>
                    <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                            <h3 className="font-semibold text-gray-900 text-sm">Google Analytics 4</h3>
                            {isError ? (
                                <Badge className="bg-red-100 text-red-700 border-0 text-xs">Error</Badge>
                            ) : (
                                <div className="flex items-center gap-1.5 px-2 py-0.5 bg-emerald-100 rounded-full">
                                    <span className="relative flex h-2 w-2">
                                        <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75" />
                                        <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500" />
                                    </span>
                                    <span className="text-xs font-semibold text-emerald-700">Live</span>
                                </div>
                            )}
                        </div>
                        <p className="text-xs text-gray-500 truncate mt-0.5">
                            {integration.ga4_property_name || "Syncing..."} · Last synced {lastSyncedLabel}
                        </p>
                    </div>
                </div>

                {/* Error banner */}
                {isError && (
                    <div className="px-5 pt-4 pb-0">
                        <div className="flex items-start gap-2 p-3 bg-red-50 border border-red-200 rounded-xl text-xs text-red-700">
                            <AlertCircle className="h-4 w-4 flex-shrink-0 mt-0.5" />
                            <div>
                                <strong>Sync failed:</strong>{" "}
                                {integration.error_message || "Unknown error"}.{" "}
                                <button className="underline font-semibold" onClick={startOAuth}>Re-authenticate</button>
                            </div>
                        </div>
                    </div>
                )}

                {/* 7-Day session mini-grid */}
                <div className="p-5 pb-3">
                    <div className="flex items-center justify-between mb-3">
                        <div className="flex items-center gap-1.5">
                            <p className="text-xs font-semibold text-gray-700 uppercase tracking-wider">AI Referral Traffic</p>
                            <Tooltip content="Forzeo filters sessions from chat.openai.com, perplexity.ai, gemini.google.com, and claude.ai automatically.">
                                <Info className="h-3.5 w-3.5 text-gray-400 cursor-help" />
                            </Tooltip>
                        </div>
                        <span className="text-xs text-gray-500">Last 7 days</span>
                    </div>
                    <div className="grid grid-cols-2 gap-2">
                        {Object.entries(SOURCE_CONFIG).map(([source, cfg]) => {
                            const data = last7DaysBySource[source] || { sessions: 0, prevSessions: 0 };
                            const growth = data.prevSessions > 0
                                ? ((data.sessions - data.prevSessions) / data.prevSessions) * 100
                                : 0;

                            return (
                                <div key={source} className={cn("rounded-xl p-3 border border-gray-100", cfg.bg)}>
                                    <div className="flex items-center justify-between mb-1">
                                        <div className="flex items-center gap-1.5">
                                            <span className="text-sm">{cfg.icon}</span>
                                            <span className="text-xs font-medium text-gray-700">{source}</span>
                                        </div>
                                        {data.sessions > 0 && growth !== 0 && (
                                            <span className={cn(
                                                "text-[10px] font-bold px-1 rounded flex items-center",
                                                growth > 0 ? "text-emerald-600 bg-emerald-50" : "text-rose-600 bg-rose-50"
                                            )}>
                                                {growth > 0 ? "+" : ""}{growth.toFixed(0)}%
                                            </span>
                                        )}
                                    </div>
                                    <div className="text-xl font-bold" style={{ color: cfg.color }}>
                                        {data.sessions.toLocaleString()}
                                    </div>
                                    <div className="text-[10px] text-gray-500 mt-0.5">sessions</div>
                                </div>
                            );
                        })}
                    </div>
                    <div className="mt-3 flex items-center justify-between p-3 bg-gray-50 rounded-xl border border-gray-100">
                        <span className="text-xs font-medium text-gray-600">Total AI sessions (7d)</span>
                        <span className="text-sm font-bold text-gray-900">{totalLLMSessionsLast7.toLocaleString()}</span>
                    </div>
                </div>

                {/* Action buttons */}
                <div className="px-5 pb-5 pt-2 flex gap-2">
                    <Button
                        variant="outline"
                        size="sm"
                        className="flex-1 gap-1.5"
                        onClick={triggerSync}
                        disabled={syncing || isError}
                    >
                        {syncing ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <RefreshCw className="h-3.5 w-3.5" />}
                        {syncing ? "Syncing..." : "Refresh Sync"}
                    </Button>
                    <Button
                        variant="ghost"
                        size="sm"
                        className="flex-1 gap-1.5 text-red-600 hover:text-red-700 hover:bg-red-50"
                        onClick={() => setShowDisconnectModal(true)}
                        disabled={loading}
                    >
                        <Unlink className="h-3.5 w-3.5" />
                        Disconnect
                    </Button>
                </div>
            </div>
        </>
    );
}

export default GA4ConnectorPanel;
