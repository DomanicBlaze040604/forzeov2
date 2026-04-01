import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const GROQ_API_KEY = Deno.env.get("GROQ_API_KEY") || "";
const GROQ_API_URL = "https://api.groq.com/openai/v1/chat/completions";
const MODEL = "llama-3.3-70b-versatile";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface PromptEntry { text: string; visibilityScore: number; }
interface CompetitorEntry { name: string; mentions: number; percentage: number; isBrand: boolean; }
interface ModelEntry { name: string; visible: number; total: number; pct: number; }
interface DeltaEntry { sovDelta: number; rankDelta: number | null; citationsDelta: number; citationRateDelta: number; }
interface ClientContext {
  brandName?: string;
  brandDomain?: string;
  prompts?: string[];
  topPrompts?: PromptEntry[];
  weakPrompts?: PromptEntry[];
  competitorSOV?: CompetitorEntry[];
  modelVisibility?: ModelEntry[];
  sovScore?: number;
  citationCount?: number;
  competitors?: string[];
  connectors?: { ga4?: boolean; searchConsole?: boolean };
  deltas?: DeltaEntry | null;
}
interface ChatMessage { role: "system" | "user" | "assistant"; content: string; }

// KB data fetched directly by the edge function
interface KBData {
  brandContext?: string;
  location?: string;
  geographicReach?: string;
  language?: string;
  tone?: string;
  targetAudience?: string;
  styleNotes?: string;
  orgName?: string;
  websiteUrl?: string;
  yearFounded?: string;
  twitterUrl?: string;
  editorialPolicy?: string;
}

async function fetchKBData(clientId: string): Promise<KBData> {
  const supabaseUrl = Deno.env.get("SUPABASE_URL");
  const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  if (!supabaseUrl || !supabaseKey || !clientId) return {};

  const sb = createClient(supabaseUrl, supabaseKey);

  const [kbRes, eeatRes, toneRes] = await Promise.all([
    sb.from("client_knowledge_base").select("*").eq("client_id", clientId).maybeSingle(),
    sb.from("client_eeat").select("*").eq("client_id", clientId).maybeSingle(),
    sb.from("client_tone").select("*").eq("client_id", clientId).maybeSingle(),
  ]);

  return {
    brandContext:    kbRes.data?.brand_context   || "",
    location:        kbRes.data?.location         || "",
    geographicReach: kbRes.data?.geographic_reach || "",
    language:        kbRes.data?.language         || "English",
    tone:            toneRes.data?.tone           || "",
    targetAudience:  toneRes.data?.target_audience || "",
    styleNotes:      toneRes.data?.style_notes    || "",
    orgName:         eeatRes.data?.org_name       || "",
    websiteUrl:      eeatRes.data?.website_url    || "",
    yearFounded:     eeatRes.data?.year_founded   || "",
    twitterUrl:      eeatRes.data?.twitter_url    || "",
    editorialPolicy: eeatRes.data?.editorial_policy || "",
  };
}

function buildSystemPrompt(ctx: ClientContext, kb: KBData): string {
  const brand = ctx.brandName || "the brand";
  const domain = ctx.brandDomain || kb.websiteUrl || "unknown";
  const sov = ctx.sovScore ?? 0;
  const citations = ctx.citationCount ?? 0;
  const promptCount = (ctx.prompts || []).length;
  const connectedSources = [
    ctx.connectors?.ga4 ? "Google Analytics 4" : null,
    ctx.connectors?.searchConsole ? "Google Search Console" : null,
  ].filter(Boolean).join(", ") || "none";

  // ── Top performing prompts ─────────────────────────────────────────────────
  const topPromptsText = (ctx.topPrompts || []).slice(0, 5)
    .map(p => `  - "${p.text}" → ${p.visibilityScore}%`)
    .join("\n") || "  No audit data yet";

  // ── Weak / zero-visibility prompts ────────────────────────────────────────
  const weakPromptsText = (ctx.weakPrompts || []).length > 0
    ? (ctx.weakPrompts || [])
        .map(p => `  - "${p.text}" → ${p.visibilityScore}%`)
        .join("\n")
    : "  None — all prompts have some visibility";

  // ── Competitor SOV breakdown ───────────────────────────────────────────────
  const competitorSOVText = (ctx.competitorSOV || []).length > 0
    ? (ctx.competitorSOV || [])
        .map(c => `  - ${c.isBrand ? `**${c.name} (YOUR BRAND)**` : c.name}: ${c.percentage}% share (${c.mentions} mentions)`)
        .join("\n")
    : `  Competitors: ${(ctx.competitors || []).join(", ") || "none listed"}`;

  // ── Run-over-run delta ────────────────────────────────────────────────────
  const deltaSection = ctx.deltas
    ? (() => {
        const d = ctx.deltas!;
        const sov = d.sovDelta > 0 ? `+${d.sovDelta}%` : `${d.sovDelta}%`;
        const rank = d.rankDelta != null
          ? (d.rankDelta > 0 ? `improved by ${d.rankDelta}` : d.rankDelta < 0 ? `dropped by ${Math.abs(d.rankDelta)}` : "unchanged")
          : "n/a";
        const cit = d.citationsDelta > 0 ? `+${d.citationsDelta}` : `${d.citationsDelta}`;
        const cr = d.citationRateDelta > 0 ? `+${d.citationRateDelta}%` : `${d.citationRateDelta}%`;
        return `\n## Changes Since Last Audit Run\n- SOV: ${sov}\n- Avg Position: ${rank}\n- Citations: ${cit}\n- Citation Rate: ${cr}\n`;
      })()
    : "";

  // ── AI engine visibility breakdown ────────────────────────────────────────
  const modelText = (ctx.modelVisibility || []).length > 0
    ? (ctx.modelVisibility || [])
        .map(m => `  - ${m.name}: ${m.pct}% visible (${m.visible}/${m.total} prompts)`)
        .join("\n")
    : "  No model-level data yet";

  // ── Knowledge Base enrichment ─────────────────────────────────────────────
  const kbLines: string[] = [];

  if (kb.brandContext) kbLines.push(`**Brand Description:** ${kb.brandContext}`);
  if (kb.tone) kbLines.push(`**Brand Tone:** ${kb.tone}${kb.targetAudience ? ` — targeting ${kb.targetAudience}` : ""}`);
  if (kb.styleNotes) kbLines.push(`**Writing Style:** ${kb.styleNotes}`);
  if (kb.location || kb.geographicReach) {
    kbLines.push(`**Geographic Focus:** ${[kb.location, kb.geographicReach].filter(Boolean).join(", ")}`);
  }
  if (kb.language && kb.language !== "English") kbLines.push(`**Primary Language:** ${kb.language}`);
  if (kb.orgName) {
    kbLines.push(`**Legal Entity:** ${kb.orgName}${kb.yearFounded ? ` (founded ${kb.yearFounded})` : ""}`);
  }
  if (kb.editorialPolicy) kbLines.push(`**Editorial Policy:** ${kb.editorialPolicy}`);

  const kbSection = kbLines.length > 0
    ? `\n## Brand Knowledge Base\n${kbLines.join("\n")}\n`
    : "";

  return `You are an expert AI assistant specializing in Answer Engine Optimization (AEO) and Generative Engine Optimization (GEO). You help brands improve their visibility in AI-powered search engines like ChatGPT, Perplexity, Google AI Overview, Claude, and Gemini.

## Brand Dashboard Context
- **Brand:** ${brand} (${domain})
- **Current Share of Voice:** ${sov}%
- **Total Citations Found:** ${citations}
- **Active Prompts Being Tracked:** ${promptCount}
- **Connected Data Sources:** ${connectedSources}

## Top Performing Prompts (by visibility)
${topPromptsText}

## Weak / Zero-Visibility Prompts (need improvement)
${weakPromptsText}

## Competitor Share of Voice
${competitorSOVText}

## Visibility by AI Engine
${modelText}
${deltaSection}${kbSection}
## Your Role
- Give concise, actionable advice tailored to this brand's actual data
- When SOV is low (<20%), prioritize improving brand mentions in AI responses
- For "improve my prompts" questions: focus on the weak/zero-visibility prompts listed above
- For competitor analysis: use the SOV breakdown — identify where competitors outrank the brand
- For AI engine questions: use the per-engine breakdown to pinpoint which platforms to target first
- Reference the brand's actual numbers and competitors in your answers
- Match your communication style to the brand's tone when generating content
- Be direct and specific — avoid generic SEO advice
- Format responses clearly with bullet points when listing recommendations
- If asked about data you don't have (e.g., specific page performance), explain what connector would unlock that data

Keep responses focused and under 300 words unless the user explicitly asks for a detailed breakdown.`;
}

serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  if (!GROQ_API_KEY) {
    return new Response(
      JSON.stringify({ error: "GROQ_API_KEY not configured" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }

  try {
    const body = await req.json();
    const messages: ChatMessage[] = body.messages || [];
    const ctx: ClientContext = body.clientContext || {};
    const clientId: string = body.clientId || "";

    if (!messages.length) {
      return new Response(
        JSON.stringify({ error: "messages array is required" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Fetch KB data in parallel with nothing else (fast — 3 small queries)
    const kb = await fetchKBData(clientId);

    const systemPrompt = buildSystemPrompt(ctx, kb);
    const groqMessages = [
      { role: "system", content: systemPrompt },
      ...messages.filter(m => m.role !== "system"),
    ];

    const groqRes = await fetch(GROQ_API_URL, {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${GROQ_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: MODEL,
        messages: groqMessages,
        temperature: 0.6,
        max_tokens: 1024,
      }),
    });

    if (!groqRes.ok) {
      const errText = await groqRes.text();
      console.error("[agent-chat] Groq error:", groqRes.status, errText);
      return new Response(
        JSON.stringify({ error: `Groq API error: ${groqRes.status}` }),
        { status: groqRes.status, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const data = await groqRes.json();
    const content = data.choices?.[0]?.message?.content || "";

    return new Response(
      JSON.stringify({ response: content, usage: data.usage }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (err) {
    console.error("[agent-chat] Error:", err);
    return new Response(
      JSON.stringify({ error: String(err) }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
