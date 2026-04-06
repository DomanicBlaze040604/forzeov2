import { supabase } from "@/integrations/supabase/client";

// ── Edge function caller ──────────────────────────────────────────────────────

const FN_URL = import.meta.env.VITE_SUPABASE_URL
  ? `${import.meta.env.VITE_SUPABASE_URL}/functions/v1`
  : "https://bvmwnxargzlfheiwyget.supabase.co/functions/v1";

export async function callSEOFunction(
  fnName: string,
  action: string,
  clientId: string,
  extra: Record<string, unknown> = {}
) {
  const { data: { session } } = await supabase.auth.getSession();
  const res = await fetch(`${FN_URL}/${fnName}`, {
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

// ── Formatting helpers ────────────────────────────────────────────────────────

export function fmtNum(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}K`;
  return String(Math.round(n));
}

export function fmtPct(n: number): string {
  return `${n.toFixed(1)}%`;
}

export function fmtPos(p: number): string {
  return p > 0 ? p.toFixed(1) : "—";
}

export function fmtDate(s: string): string {
  const d = new Date(s + "T00:00:00");
  return d.toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

export function fmtDateTime(s: string): string {
  return new Date(s).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export function truncateUrl(url: string, max = 55): string {
  try {
    const u = new URL(url);
    const path = u.pathname + u.search;
    return path.length > max ? path.slice(0, max) + "…" : path;
  } catch {
    return url.length > max ? url.slice(0, max) + "…" : url;
  }
}

// ── Rating helpers ────────────────────────────────────────────────────────────

export function cwvRating(metric: string, value: number | null): "good" | "needs-improvement" | "poor" | null {
  if (value === null) return null;
  switch (metric) {
    case "lcp": return value <= 2500 ? "good" : value <= 4000 ? "needs-improvement" : "poor";
    case "fid": return value <= 100 ? "good" : value <= 300 ? "needs-improvement" : "poor";
    case "inp": return value <= 200 ? "good" : value <= 500 ? "needs-improvement" : "poor";
    case "cls": return value <= 0.1 ? "good" : value <= 0.25 ? "needs-improvement" : "poor";
    default: return null;
  }
}

export function ratingColor(rating: "good" | "needs-improvement" | "poor" | null): string {
  switch (rating) {
    case "good": return "text-emerald-600";
    case "needs-improvement": return "text-amber-600";
    case "poor": return "text-rose-600";
    default: return "text-gray-400";
  }
}

export function ratingBg(rating: "good" | "needs-improvement" | "poor" | null): string {
  switch (rating) {
    case "good": return "bg-emerald-50 border-emerald-200";
    case "needs-improvement": return "bg-amber-50 border-amber-200";
    case "poor": return "bg-rose-50 border-rose-200";
    default: return "bg-gray-50 border-gray-200";
  }
}

export function scoreColor(score: number): string {
  if (score >= 80) return "text-emerald-600";
  if (score >= 60) return "text-amber-600";
  if (score >= 40) return "text-orange-600";
  return "text-rose-600";
}

export function scoreBg(score: number): string {
  if (score >= 80) return "bg-emerald-50";
  if (score >= 60) return "bg-amber-50";
  if (score >= 40) return "bg-orange-50";
  return "bg-rose-50";
}

// ── AI caller ─────────────────────────────────────────────────────────────────

export async function callGroq(prompt: string, system: string, maxTokens = 2000): Promise<string> {
  const { data, error } = await supabase.functions.invoke("groq-proxy", {
    body: {
      model: "llama-3.3-70b-versatile",
      messages: [
        { role: "system", content: system },
        { role: "user", content: prompt },
      ],
      temperature: 0.4,
      max_tokens: maxTokens,
    },
  });
  if (error) throw new Error(`Function error: ${error.message}`);
  if (data?.error) throw new Error(`AI error: ${data.error}`);
  if (!data?.response) throw new Error("Empty response from AI");
  return data.response as string;
}

export function parseAIJson<T>(raw: string): T {
  const cleaned = raw.replace(/```json\s*/g, "").replace(/```\s*/g, "").trim();
  return JSON.parse(cleaned) as T;
}
