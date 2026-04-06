import { useState, useEffect, useCallback, useMemo } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

// ── Types ──────────────────────────────────────────────────────────────────────

export interface GSCIntegration {
  id: string;
  client_id: string;
  site_url: string | null;
  site_name: string | null;
  connected_email: string | null;
  status: "pending" | "connected" | "disconnected" | "error";
  error_message: string | null;
  last_synced_at: string | null;
}

export interface BingIntegration {
  id: string;
  client_id: string;
  site_url: string | null;
  status: "pending" | "connected" | "disconnected" | "error";
  error_message: string | null;
  last_synced_at: string | null;
}

export interface SEORow {
  id: string;
  client_id: string;
  date: string;
  query: string | null;
  page: string | null;
  country: string | null;
  device: string | null;
  clicks: number;
  impressions: number;
  ctr: number;
  position: number;
}

export interface SEOMetricSummary {
  totalClicks: number;
  totalImpressions: number;
  avgCTR: number;
  avgPosition: number;
  clicksDelta: number | null;
  impressionsDelta: number | null;
}

export interface TopQuery {
  query: string;
  clicks: number;
  impressions: number;
  ctr: number;
  position: number;
}

export interface TopPage {
  page: string;
  clicks: number;
  impressions: number;
  ctr: number;
  position: number;
}

export interface DailyMetric {
  date: string;
  clicks: number;
  impressions: number;
  ctr: number;
  position: number;
}

// ── Constants ─────────────────────────────────────────────────────────────────

const FN_URL = import.meta.env.VITE_SUPABASE_URL
  ? `${import.meta.env.VITE_SUPABASE_URL}/functions/v1`
  : "https://bvmwnxargzlfheiwyget.supabase.co/functions/v1";

const GOOGLE_CLIENT_ID = import.meta.env.VITE_GOOGLE_CLIENT_ID || "";

async function callGSC(action: string, clientId: string, extra: Record<string, unknown> = {}) {
  const { data: { session } } = await supabase.auth.getSession();
  const res = await fetch(`${FN_URL}/gsc-proxy`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${session?.access_token || ""}`,
    },
    body: JSON.stringify({ action, client_id: clientId, ...extra }),
  });
  const data = await res.json();
  if (!res.ok || data.error) throw new Error(data.error || `HTTP ${res.status}`);
  return data;
}

async function callBing(action: string, clientId: string, extra: Record<string, unknown> = {}) {
  const { data: { session } } = await supabase.auth.getSession();
  const res = await fetch(`${FN_URL}/bing-seo`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${session?.access_token || ""}`,
    },
    body: JSON.stringify({ action, client_id: clientId, ...extra }),
  });
  const data = await res.json();
  if (!res.ok || data.error) throw new Error(data.error || `HTTP ${res.status}`);
  return data;
}

// ── Hook ──────────────────────────────────────────────────────────────────────

export function useSEOConnector(clientId: string | null | undefined) {
  const [gscIntegration, setGscIntegration] = useState<GSCIntegration | null>(null);
  const [bingIntegration, setBingIntegration] = useState<BingIntegration | null>(null);
  const [gscData, setGscData] = useState<SEORow[]>([]);
  const [bingData, setBingData] = useState<SEORow[]>([]);
  const [gscSites, setGscSites] = useState<{ siteUrl: string; permissionLevel: string }[]>([]);
  const [loading, setLoading] = useState(false);
  const [syncing, setSyncing] = useState(false);
  const [dateRange, setDateRange] = useState<28 | 90>(28);

  // ── Load integrations ────────────────────────────────────────────────────────
  const loadIntegrations = useCallback(async (overrideClientId?: string) => {
    const targetId = overrideClientId || clientId;
    if (!targetId) {
      setGscIntegration(null); setBingIntegration(null);
      setGscData([]); setBingData([]);
      return;
    }
    setLoading(true);
    try {
      const [gscRes, bingRes] = await Promise.all([
        supabase.from("gsc_integrations" as any).select("*").eq("client_id", targetId).maybeSingle(),
        supabase.from("bing_integrations" as any).select("*").eq("client_id", targetId).maybeSingle(),
      ]);
      setGscIntegration((gscRes.data as GSCIntegration) || null);
      setBingIntegration((bingRes.data as BingIntegration) || null);
    } catch (err) {
      console.error("[useSEOConnector] loadIntegrations:", err);
    } finally {
      setLoading(false);
    }
  }, [clientId]);

  // ── Load data from cache ─────────────────────────────────────────────────────
  const loadData = useCallback(async () => {
    if (!clientId) return;
    const since = new Date();
    since.setDate(since.getDate() - dateRange);
    const sinceStr = since.toISOString().split("T")[0];

    const [gscRes, bingRes] = await Promise.all([
      supabase.from("gsc_search_data" as any)
        .select("*").eq("client_id", clientId)
        .gte("date", sinceStr).order("date", { ascending: false }).limit(10000),
      supabase.from("bing_search_data" as any)
        .select("*").eq("client_id", clientId)
        .gte("date", sinceStr).order("date", { ascending: false }).limit(5000),
    ]);

    setGscData((gscRes.data as SEORow[]) || []);
    setBingData((bingRes.data as SEORow[]) || []);
  }, [clientId, dateRange]);

  useEffect(() => { loadIntegrations(); }, [loadIntegrations]);
  useEffect(() => { loadData(); }, [loadData]);

  // Sync state across React StrictMode / multi-mounts during OAuth redirect
  useEffect(() => {
    const handler = (e: Event) => {
      const customEvent = e as CustomEvent;
      if (customEvent.detail === clientId) loadIntegrations();
    };
    window.addEventListener("forzeo_gsc_auth_success", handler);
    return () => window.removeEventListener("forzeo_gsc_auth_success", handler);
  }, [clientId, loadIntegrations]);

  // ── GSC OAuth ────────────────────────────────────────────────────────────────
  const connectGSC = useCallback(() => {
    if (!clientId) return;
    const redirectUri = `${window.location.origin}/`;
    const params = new URLSearchParams({
      client_id: GOOGLE_CLIENT_ID,
      redirect_uri: redirectUri,
      response_type: "code",
      scope: [
        "https://www.googleapis.com/auth/webmasters.readonly",
        "https://www.googleapis.com/auth/userinfo.email",
      ].join(" "),
      access_type: "offline",
      prompt: "consent",
      state: `gsc:${clientId}`,
    });
    window.location.href = `https://accounts.google.com/o/oauth2/v2/auth?${params}`;
  }, [clientId]);

  // ── Handle OAuth callback ────────────────────────────────────────────────────
  const handleGSCCallback = useCallback(async (code: string, stateClientId?: string) => {
    const targetClientId = stateClientId || clientId;
    if (!targetClientId) return;
    try {
      await callGSC("exchange_code", targetClientId, {
        code,
        redirect_uri: `${window.location.origin}/`,
      });
      await loadIntegrations(targetClientId);
      
      // Notify active listeners holding the same client ID to refresh (bypasses StrictMode dropping)
      window.dispatchEvent(new CustomEvent("forzeo_gsc_auth_success", { detail: targetClientId }));

      // Auto-fetch site list
      const data = await callGSC("list_sites", targetClientId);
      setGscSites(data.sites || []);
      toast.success("Google Search Console connected");
    } catch (err: any) {
      toast.error("GSC connection failed: " + err.message);
    }
  }, [clientId, loadIntegrations]);

  // ── List GSC sites ───────────────────────────────────────────────────────────
  const listGSCSites = useCallback(async () => {
    if (!clientId) return;
    try {
      const data = await callGSC("list_sites", clientId);
      setGscSites(data.sites || []);
    } catch (err: any) {
      toast.error("Failed to list sites: " + err.message);
    }
  }, [clientId]);

  // ── Select GSC site ──────────────────────────────────────────────────────────
  const selectGSCSite = useCallback(async (siteUrl: string) => {
    if (!clientId) return;
    try {
      await callGSC("select_site", clientId, { site_url: siteUrl, site_name: siteUrl });
      await loadIntegrations();
      toast.success("Site selected — syncing data...");
      setSyncing(true);
      await callGSC("sync", clientId);
      await loadData();
      setSyncing(false);
      toast.success("Search Console data synced");
    } catch (err: any) {
      setSyncing(false);
      toast.error("Sync failed: " + err.message);
    }
  }, [clientId, loadIntegrations, loadData]);

  // ── GSC sync ─────────────────────────────────────────────────────────────────
  const syncGSC = useCallback(async () => {
    if (!clientId || !gscIntegration?.site_url) return;
    setSyncing(true);
    try {
      const result = await callGSC("sync", clientId);
      await Promise.all([loadIntegrations(), loadData()]);
      toast.success(`Synced ${result.rows_synced || 0} rows from Search Console`);
    } catch (err: any) {
      toast.error("GSC sync failed: " + err.message);
    } finally {
      setSyncing(false);
    }
  }, [clientId, gscIntegration, loadIntegrations, loadData]);

  // ── GSC disconnect ───────────────────────────────────────────────────────────
  const disconnectGSC = useCallback(async () => {
    if (!clientId) return;
    try {
      await callGSC("disconnect", clientId);
      setGscIntegration(null); setGscData([]); setGscSites([]);
      toast.success("Google Search Console disconnected");
    } catch (err: any) {
      toast.error("Disconnect failed: " + err.message);
    }
  }, [clientId]);

  // ── Bing connect ─────────────────────────────────────────────────────────────
  const connectBing = useCallback(async (apiKey: string, siteUrl: string) => {
    if (!clientId) return;
    try {
      await callBing("connect", clientId, { api_key: apiKey, site_url: siteUrl });
      await loadIntegrations();
      setSyncing(true);
      await callBing("sync", clientId);
      await loadData();
      setSyncing(false);
      toast.success("Bing Webmaster connected and synced");
    } catch (err: any) {
      setSyncing(false);
      toast.error("Bing connection failed: " + err.message);
    }
  }, [clientId, loadIntegrations, loadData]);

  // ── Bing sync ─────────────────────────────────────────────────────────────────
  const syncBing = useCallback(async () => {
    if (!clientId) return;
    setSyncing(true);
    try {
      const result = await callBing("sync", clientId);
      await Promise.all([loadIntegrations(), loadData()]);
      toast.success(`Synced ${result.rows_synced || 0} rows from Bing`);
    } catch (err: any) {
      toast.error("Bing sync failed: " + err.message);
    } finally {
      setSyncing(false);
    }
  }, [clientId, loadIntegrations, loadData]);

  // ── Bing disconnect ──────────────────────────────────────────────────────────
  const disconnectBing = useCallback(async () => {
    if (!clientId) return;
    try {
      await callBing("disconnect", clientId);
      setBingIntegration(null); setBingData([]);
      toast.success("Bing Webmaster disconnected");
    } catch (err: any) {
      toast.error("Disconnect failed: " + err.message);
    }
  }, [clientId]);

  // ── Computed metrics ─────────────────────────────────────────────────────────

  // Helper: check if a field is "empty" (null, undefined, or empty string)
  const isEmpty = (v: string | null | undefined) => !v || v === '';

  const gscMetrics = useMemo((): SEOMetricSummary => {
    const queryRows = gscData.filter(r => r.query && isEmpty(r.page) && isEmpty(r.country));
    if (queryRows.length === 0) return { totalClicks: 0, totalImpressions: 0, avgCTR: 0, avgPosition: 0, clicksDelta: null, impressionsDelta: null };
    const totalClicks = queryRows.reduce((s, r) => s + r.clicks, 0);
    const totalImpressions = queryRows.reduce((s, r) => s + r.impressions, 0);
    const avgCTR = totalImpressions > 0 ? (totalClicks / totalImpressions) * 100 : 0;
    const avgPosition = queryRows.reduce((s, r) => s + r.position * r.impressions, 0) / (totalImpressions || 1);
    return { totalClicks, totalImpressions, avgCTR, avgPosition, clicksDelta: null, impressionsDelta: null };
  }, [gscData]);

  const bingMetrics = useMemo((): SEOMetricSummary => {
    const queryRows = bingData.filter(r => r.query && isEmpty(r.page));
    if (queryRows.length === 0) return { totalClicks: 0, totalImpressions: 0, avgCTR: 0, avgPosition: 0, clicksDelta: null, impressionsDelta: null };
    const totalClicks = queryRows.reduce((s, r) => s + r.clicks, 0);
    const totalImpressions = queryRows.reduce((s, r) => s + r.impressions, 0);
    const avgCTR = totalImpressions > 0 ? (totalClicks / totalImpressions) * 100 : 0;
    const avgPosition = queryRows.reduce((s, r) => s + r.position * r.impressions, 0) / (totalImpressions || 1);
    return { totalClicks, totalImpressions, avgCTR, avgPosition, clicksDelta: null, impressionsDelta: null };
  }, [bingData]);

  const gscTopQueries = useMemo((): TopQuery[] => {
    const map: Record<string, { clicks: number; impressions: number; positionSum: number }> = {};
    gscData.filter(r => r.query && isEmpty(r.page) && isEmpty(r.country)).forEach(r => {
      if (!map[r.query!]) map[r.query!] = { clicks: 0, impressions: 0, positionSum: 0 };
      map[r.query!].clicks += r.clicks;
      map[r.query!].impressions += r.impressions;
      map[r.query!].positionSum += r.position * r.impressions;
    });
    return Object.entries(map)
      .map(([query, d]) => ({
        query,
        clicks: d.clicks,
        impressions: d.impressions,
        ctr: d.impressions > 0 ? (d.clicks / d.impressions) * 100 : 0,
        position: d.impressions > 0 ? d.positionSum / d.impressions : 0,
      }))
      .sort((a, b) => b.clicks - a.clicks)
      .slice(0, 50);
  }, [gscData]);

  const gscTopPages = useMemo((): TopPage[] => {
    const map: Record<string, { clicks: number; impressions: number; positionSum: number }> = {};
    gscData.filter(r => r.page && isEmpty(r.query) && isEmpty(r.country)).forEach(r => {
      if (!map[r.page!]) map[r.page!] = { clicks: 0, impressions: 0, positionSum: 0 };
      map[r.page!].clicks += r.clicks;
      map[r.page!].impressions += r.impressions;
      map[r.page!].positionSum += r.position * r.impressions;
    });
    return Object.entries(map)
      .map(([page, d]) => ({
        page,
        clicks: d.clicks,
        impressions: d.impressions,
        ctr: d.impressions > 0 ? (d.clicks / d.impressions) * 100 : 0,
        position: d.impressions > 0 ? d.positionSum / d.impressions : 0,
      }))
      .sort((a, b) => b.clicks - a.clicks)
      .slice(0, 50);
  }, [gscData]);

  const bingTopQueries = useMemo((): TopQuery[] => {
    const map: Record<string, { clicks: number; impressions: number; positionSum: number }> = {};
    bingData.filter(r => r.query && isEmpty(r.page)).forEach(r => {
      if (!map[r.query!]) map[r.query!] = { clicks: 0, impressions: 0, positionSum: 0 };
      map[r.query!].clicks += r.clicks;
      map[r.query!].impressions += r.impressions;
      map[r.query!].positionSum += r.position * r.impressions;
    });
    return Object.entries(map)
      .map(([query, d]) => ({
        query,
        clicks: d.clicks,
        impressions: d.impressions,
        ctr: d.impressions > 0 ? (d.clicks / d.impressions) * 100 : 0,
        position: d.impressions > 0 ? d.positionSum / d.impressions : 0,
      }))
      .sort((a, b) => b.clicks - a.clicks)
      .slice(0, 50);
  }, [bingData]);

  const bingTopPages = useMemo((): TopPage[] => {
    const map: Record<string, { clicks: number; impressions: number; positionSum: number }> = {};
    bingData.filter(r => r.page && isEmpty(r.query)).forEach(r => {
      if (!map[r.page!]) map[r.page!] = { clicks: 0, impressions: 0, positionSum: 0 };
      map[r.page!].clicks += r.clicks;
      map[r.page!].impressions += r.impressions;
      map[r.page!].positionSum += r.position * r.impressions;
    });
    return Object.entries(map)
      .map(([page, d]) => ({
        page,
        clicks: d.clicks,
        impressions: d.impressions,
        ctr: d.impressions > 0 ? (d.clicks / d.impressions) * 100 : 0,
        position: d.impressions > 0 ? d.positionSum / d.impressions : 0,
      }))
      .sort((a, b) => b.clicks - a.clicks)
      .slice(0, 50);
  }, [bingData]);

  const gscDailyClicks = useMemo((): DailyMetric[] => {
    const map: Record<string, DailyMetric> = {};
    gscData.filter(r => r.query && isEmpty(r.page) && isEmpty(r.country)).forEach(r => {
      if (!map[r.date]) map[r.date] = { date: r.date, clicks: 0, impressions: 0, ctr: 0, position: 0 };
      map[r.date].clicks += r.clicks;
      map[r.date].impressions += r.impressions;
    });
    return Object.values(map)
      .map(d => ({ ...d, ctr: d.impressions > 0 ? (d.clicks / d.impressions) * 100 : 0 }))
      .sort((a, b) => a.date.localeCompare(b.date));
  }, [gscData]);

  const bingDailyClicks = useMemo((): DailyMetric[] => {
    const map: Record<string, DailyMetric> = {};
    bingData.filter(r => r.query && isEmpty(r.page)).forEach(r => {
      if (!map[r.date]) map[r.date] = { date: r.date, clicks: 0, impressions: 0, ctr: 0, position: 0 };
      map[r.date].clicks += r.clicks;
      map[r.date].impressions += r.impressions;
    });
    return Object.values(map)
      .map(d => ({ ...d, ctr: d.impressions > 0 ? (d.clicks / d.impressions) * 100 : 0 }))
      .sort((a, b) => a.date.localeCompare(b.date));
  }, [bingData]);

  const gscCountries = useMemo(() => {
    const map: Record<string, { country: string; clicks: number; impressions: number }> = {};
    gscData.filter(r => r.country && isEmpty(r.query) && isEmpty(r.page)).forEach(r => {
      if (!map[r.country!]) map[r.country!] = { country: r.country!, clicks: 0, impressions: 0 };
      map[r.country!].clicks += r.clicks;
      map[r.country!].impressions += r.impressions;
    });
    return Object.values(map).sort((a, b) => b.clicks - a.clicks).slice(0, 20);
  }, [gscData]);

  return {
    // State
    gscIntegration, bingIntegration,
    gscData, bingData,
    gscSites,
    loading, syncing,
    dateRange, setDateRange,

    // GSC actions
    connectGSC, handleGSCCallback, listGSCSites, selectGSCSite, syncGSC, disconnectGSC,

    // Bing actions
    connectBing, syncBing, disconnectBing,

    // Computed
    gscMetrics, bingMetrics,
    gscTopQueries, gscTopPages,
    bingTopQueries, bingTopPages,
    gscDailyClicks, bingDailyClicks, gscCountries,

    // Reload
    reload: loadIntegrations,
  };
}

export type SEOConnectorHook = ReturnType<typeof useSEOConnector>;
