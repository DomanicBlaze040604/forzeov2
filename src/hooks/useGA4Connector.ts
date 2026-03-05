import { useState, useEffect, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

// ── Types ─────────────────────────────────────────────────────────────────

export interface GA4Integration {
    id: string;
    client_id: string;
    user_id: string;
    ga4_property_id: string | null;
    ga4_property_name: string | null;
    ga4_stream_id: string | null;
    ga4_stream_name: string | null;
    connected_email: string | null;
    status: "pending" | "connected" | "disconnected" | "error";
    error_message: string | null;
    last_synced_at: string | null;
    created_at: string;
}

export interface GA4SyncLog {
    id: string;
    client_id: string;
    sync_date: string; // YYYY-MM-DD
    source: "ChatGPT" | "Perplexity" | "Gemini" | "Claude";
    sessions: number;
    conversions: number;
    active_users: number;
    engagement_rate: number;
    avg_session_duration: number;
}

export interface GA4Property {
    id: string;
    displayName: string;
    accountName: string;
}

export interface GA4Stream {
    id: string;
    displayName: string;
    name?: string;
    measurementId?: string;
    uri?: string;
}

// ─────────────────────────────────────────────────────────────────────────────

const SUPABASE_FUNCTION_URL = import.meta.env.VITE_SUPABASE_URL
    ? `${import.meta.env.VITE_SUPABASE_URL}/functions/v1`
    : "https://bvmwnxargzlfheiwyget.supabase.co/functions/v1";

const GOOGLE_CLIENT_ID = import.meta.env.VITE_GOOGLE_CLIENT_ID || "";
const REDIRECT_URI = `${window.location.origin}/`; // Uritify to root to match most GCloud setups

async function callProxy(action: string, clientId: string, extra: Record<string, unknown> = {}) {
    const { data: { session } } = await supabase.auth.getSession();
    const token = session?.access_token || "";

    const res = await fetch(`${SUPABASE_FUNCTION_URL}/ga4-proxy`, {
        method: "POST",
        headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ action, client_id: clientId, ...extra }),
    });

    const data = await res.json();
    if (!res.ok || data.error) throw new Error(data.error || `HTTP ${res.status}`);
    return data;
}

// ─────────────────────────────────────────────────────────────────────────────

export type GA4ConnectorHook = ReturnType<typeof useGA4Connector>;

export function useGA4Connector(clientId: string | null | undefined) {
    const [integration, setIntegration] = useState<GA4Integration | null>(null);
    const [trafficData, setTrafficData] = useState<GA4SyncLog[]>([]);
    const [loading, setLoading] = useState(false);
    const [syncing, setSyncing] = useState(false);

    // ── Load integration row ────────────────────────────────────────────────
    const loadIntegration = useCallback(async () => {
        if (!clientId) {
            setIntegration(null);
            return;
        }
        setLoading(true);
        try {
            const { data, error } = await supabase
                .from("ga4_integrations")
                .select("*")
                .eq("client_id", clientId)
                .maybeSingle();

            if (error) throw error;
            setIntegration(data as GA4Integration | null);
        } catch (err) {
            console.error("[useGA4Connector] loadIntegration:", err);
        } finally {
            setLoading(false);
        }
    }, [clientId]);

    // ── Load traffic data (last 90 days) ───────────────────────────────────
    const loadTrafficData = useCallback(async () => {
        if (!clientId) {
            setTrafficData([]);
            return;
        }
        try {
            const cutoff = new Date();
            cutoff.setDate(cutoff.getDate() - 90);

            const { data, error } = await supabase
                .from("ga4_sync_logs")
                .select("*")
                .eq("client_id", clientId)
                .gte("sync_date", cutoff.toISOString().split("T")[0])
                .order("sync_date", { ascending: true });

            if (error) throw error;
            setTrafficData((data as GA4SyncLog[]) || []);
        } catch (err) {
            console.error("[useGA4Connector] loadTrafficData:", err);
        }
    }, [clientId]);

    useEffect(() => {
        loadIntegration();
        loadTrafficData();
    }, [loadIntegration, loadTrafficData]);

    // ── Exchange OAuth code (called from callback page) ────────────────────
    const exchangeCode = useCallback(
        async (code: string, redirectUri?: string) => {
            if (!clientId) throw new Error("No client selected");
            setLoading(true);
            try {
                const result = await callProxy("exchange_code", clientId, { code, redirect_uri: redirectUri });
                await loadIntegration();
                return result;
            } finally {
                setLoading(false);
            }
        },
        [clientId, loadIntegration]
    );

    // ── Handle incoming OAuth callback ──────────────────────────────────────
    useEffect(() => {
        const params = new URLSearchParams(window.location.search);
        const code = params.get("code");
        const state = params.get("state"); // This is the clientId we passed

        if (code && state && state === clientId) {
            console.log("[useGA4Connector] Detected OAuth code, exchanging...");

            // Clear URL immediately so we don't exchange twice on refresh
            const newUrl = window.location.pathname;
            window.history.replaceState({}, document.title, newUrl);

            exchangeCode(code, REDIRECT_URI)
                .then(() => toast.success("Google account linked successfully!"))
                .catch((err) => {
                    console.error("[useGA4Connector] Exchange failed:", err);
                    toast.error(`Verification failed: ${err.message}`);
                });
        }
    }, [clientId, exchangeCode]);

    // ── Initiate Google OAuth ───────────────────────────────────────────────
    const startOAuth = useCallback(() => {
        if (!GOOGLE_CLIENT_ID) {
            toast.error("Google OAuth is not configured. Set VITE_GOOGLE_CLIENT_ID.");
            return;
        }

        const params = new URLSearchParams({
            client_id: GOOGLE_CLIENT_ID,
            redirect_uri: REDIRECT_URI,
            response_type: "code",
            scope: [
                "https://www.googleapis.com/auth/analytics.readonly",
                "https://www.googleapis.com/auth/userinfo.email",
            ].join(" "),
            access_type: "offline",
            prompt: "consent",
            state: clientId || "",
        });

        window.location.href = `https://accounts.google.com/o/oauth2/v2/auth?${params.toString()}`;
    }, [clientId]);

    // ── List GA4 properties ────────────────────────────────────────────────
    const listProperties = useCallback(async (): Promise<GA4Property[]> => {
        if (!clientId) return [];
        const result = await callProxy("list_properties", clientId);
        return result.properties || [];
    }, [clientId]);

    // ── List GA4 streams for a property ───────────────────────────────────
    const listStreams = useCallback(async (propertyId: string): Promise<GA4Stream[]> => {
        if (!clientId) return [];
        const result = await callProxy("list_streams", clientId, { property_id: propertyId });
        return result.streams || [];
    }, [clientId]);

    // ── Save selected property + stream ───────────────────────────────────
    const saveProperty = useCallback(
        async (property: GA4Property, stream: GA4Stream) => {
            if (!clientId) return;
            setLoading(true);
            try {
                await callProxy("save_property", clientId, {
                    property_id: property.id,
                    property_name: property.displayName,
                    stream_id: stream.id,
                    stream_name: stream.displayName,
                });
                toast.success(`Successfully connected ${property.displayName} to Google Analytics Property ID: ${property.id.replace("properties/", "")}`);
                await loadIntegration();
                // Immediately kick off an initial sync
                triggerSync();
            } catch (err: any) {
                toast.error(`Failed to save property: ${err.message}`);
            } finally {
                setLoading(false);
            }
        },
        [clientId, loadIntegration]
    );

    // ── Trigger manual sync ────────────────────────────────────────────────
    const triggerSync = useCallback(async () => {
        if (!clientId) return;
        setSyncing(true);
        try {
            const result = await callProxy("refresh_sync", clientId);
            console.log("[useGA4Connector] Sync Result:", result);
            if (result.synced === 0 && result.diagnostics) {
                console.log("[useGA4Connector] DIAGNOSTIC - Property ID Queried:", result.diagnostics.queried_property_id);
                console.log("[useGA4Connector] DIAGNOSTIC - Top Sources Found:", result.diagnostics.top_sources);
                console.log("[useGA4Connector] If Top Sources is empty [], Google has ZERO data for this property in the last 30 days.");
            }
            await loadIntegration();
            await loadTrafficData();
            toast.success("GA4 data synced successfully");
        } catch (err: any) {
            toast.error(`Sync failed: ${err.message}`);
        } finally {
            setSyncing(false);
        }
    }, [clientId, loadIntegration, loadTrafficData]);

    // ── Disconnect ─────────────────────────────────────────────────────────
    const disconnect = useCallback(async () => {
        if (!clientId) return;
        setLoading(true);
        try {
            await callProxy("disconnect", clientId);
            setIntegration(null);
            setTrafficData([]);
            toast.success("Google Analytics disconnected");
        } catch (err: any) {
            toast.error(`Disconnect failed: ${err.message}`);
        } finally {
            setLoading(false);
        }
    }, [clientId]);

    // ── Derived: last 7 days metrics per source ────────────────────────────
    const last7DaysBySource = (() => {
        const cutoff7 = new Date();
        cutoff7.setDate(cutoff7.getDate() - 7);
        const cutoff7Str = cutoff7.toISOString().split("T")[0];

        const cutoff14 = new Date();
        cutoff14.setDate(cutoff14.getDate() - 14);
        const cutoff14Str = cutoff14.toISOString().split("T")[0];

        const totals: Record<string, { sessions: number; activeUsers: number; engagementRate: number; prevSessions: number }> = {
            ChatGPT: { sessions: 0, activeUsers: 0, engagementRate: 0, prevSessions: 0 },
            Perplexity: { sessions: 0, activeUsers: 0, engagementRate: 0, prevSessions: 0 },
            Gemini: { sessions: 0, activeUsers: 0, engagementRate: 0, prevSessions: 0 },
            Claude: { sessions: 0, activeUsers: 0, engagementRate: 0, prevSessions: 0 },
        };

        const counts: Record<string, number> = { ChatGPT: 0, Perplexity: 0, Gemini: 0, Claude: 0 };

        for (const row of trafficData) {
            if (row.sync_date >= cutoff7Str) {
                const s = totals[row.source];
                if (s) {
                    s.sessions += row.sessions;
                    s.activeUsers += row.active_users || 0;
                    s.engagementRate += row.engagement_rate || 0;
                    counts[row.source]++;
                }
            } else if (row.sync_date >= cutoff14Str) {
                const s = totals[row.source];
                if (s) s.prevSessions += row.sessions;
            }
        }

        // Finalize averages
        for (const source in totals) {
            if (counts[source] > 0) {
                totals[source].engagementRate = totals[source].engagementRate / counts[source];
            }
        }

        return totals;
    })();

    const totalLLMSessionsLast7 = Object.values(last7DaysBySource).reduce((a, b) => a + b.sessions, 0);

    return {
        integration,
        trafficData,
        loading,
        syncing,
        last7DaysBySource,
        totalLLMSessionsLast7,
        startOAuth,
        exchangeCode,
        listProperties,
        listStreams,
        saveProperty,
        triggerSync,
        disconnect,
        refetch: () => { loadIntegration(); loadTrafficData(); },
    };
}
