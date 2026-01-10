/**
 * ============================================================================
 * SIGNAL SCORER & RECOMMENDATIONS ENGINE
 * ============================================================================
 * 
 * Processes fresh signals and generates recommendations:
 * 
 * 1. Score signals (freshness, authority, relevance)
 * 2. Correlate with Tavily (check if domain appears in AI answers)
 * 3. Classify signals (emerging, reinforcing, low-impact)
 * 4. Generate actionable recommendations
 * 
 * @version 1.0.0
 */

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const TAVILY_API_KEY = Deno.env.get("TAVILY_API_KEY");

// ============================================
// TYPES
// ============================================

interface FreshSignal {
    id: string;
    client_id: string;
    url: string;
    title: string;
    content_snippet: string;
    published_at: string | null;
    source_domain: string;
    matched_topic: string | null;
    brand_mentions: string[];
    competitor_mentions: string[];
    content_type: string;
    freshness_score: number;
    authority_score: number;
    relevance_score: number;
    influence_score: number;
}

interface DomainAuthority {
    domain: string;
    authority_bucket: string;
    authority_score: number;
}

// ============================================
// SCORING FUNCTIONS
// ============================================

function calculateFreshnessScore(publishedAt: string | null): number {
    if (!publishedAt) return 0.5; // Unknown date = medium freshness

    const now = Date.now();
    const published = new Date(publishedAt).getTime();
    const daysOld = (now - published) / (1000 * 60 * 60 * 24);

    // Decay over 30 days: 0 days = 1.0, 30 days = 0.0
    return Math.max(0, Math.min(1, 1 - (daysOld / 30)));
}

function calculateRelevanceScore(
    title: string,
    content: string,
    brandMentions: string[],
    competitorMentions: string[]
): number {
    let score = 0;

    // Direct brand mentions = high relevance
    if (brandMentions.length > 0) {
        score += 0.4 + (0.1 * Math.min(brandMentions.length, 3));
    }

    // Competitor mentions = relevant to competitive landscape
    if (competitorMentions.length > 0) {
        score += 0.2 + (0.05 * Math.min(competitorMentions.length, 4));
    }

    // Title relevance indicators
    const titleLower = title.toLowerCase();
    if (titleLower.includes("best") || titleLower.includes("top 10")) score += 0.15;
    if (titleLower.includes("review") || titleLower.includes("comparison")) score += 0.1;
    if (titleLower.includes("guide") || titleLower.includes("how to")) score += 0.05;

    return Math.min(1, score);
}

// ============================================
// TAVILY CORRELATION
// ============================================

async function correlatewithTavily(
    signal: FreshSignal,
    prompt: string
): Promise<{
    appears: boolean;
    rank: number | null;
    adjacentDomains: string[];
}> {
    if (!TAVILY_API_KEY) {
        console.log("[Signal Scorer] No Tavily API key, skipping correlation");
        return { appears: false, rank: null, adjacentDomains: [] };
    }

    try {
        const response = await fetch("https://api.tavily.com/search", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
                api_key: TAVILY_API_KEY,
                query: prompt,
                search_depth: "basic",
                include_domains: [],
                exclude_domains: [],
                max_results: 10,
            }),
        });

        if (!response.ok) {
            throw new Error(`Tavily error: ${response.statusText}`);
        }

        const data = await response.json();
        const results = data.results || [];

        // Check if signal's domain appears
        const signalDomain = signal.source_domain.toLowerCase();
        let appears = false;
        let rank: number | null = null;
        const adjacentDomains: string[] = [];

        for (let i = 0; i < results.length; i++) {
            const resultDomain = new URL(results[i].url).hostname.replace("www.", "").toLowerCase();

            if (resultDomain === signalDomain || resultDomain.includes(signalDomain)) {
                appears = true;
                rank = i + 1;
            } else {
                adjacentDomains.push(resultDomain);
            }
        }

        return { appears, rank, adjacentDomains: adjacentDomains.slice(0, 5) };

    } catch (err) {
        console.error("[Signal Scorer] Tavily error:", err);
        return { appears: false, rank: null, adjacentDomains: [] };
    }
}

function classifySignal(
    influenceScore: number,
    tavilyAppears: boolean,
    competitorMentions: string[]
): { classification: string; reason: string } {

    if (tavilyAppears && influenceScore >= 0.7) {
        return {
            classification: "reinforcing",
            reason: "High-influence source already appearing in AI answers",
        };
    }

    if (!tavilyAppears && influenceScore >= 0.6) {
        return {
            classification: "emerging",
            reason: "High-influence source not yet in AI answers - potential future influencer",
        };
    }

    if (competitorMentions.length > 0 && influenceScore >= 0.5) {
        return {
            classification: "competitor_signal",
            reason: `Competitor activity detected: ${competitorMentions.join(", ")}`,
        };
    }

    return {
        classification: "low_impact",
        reason: "Low influence score or already saturated in AI visibility",
    };
}

// ============================================
// RECOMMENDATION GENERATION
// ============================================

interface Recommendation {
    client_id: string;
    signal_id: string;
    recommendation_type: string;
    priority: string;
    title: string;
    description: string;
    evidence: string;
    action_items: string[];
    urgency_days: number;
    source_domain: string;
    source_url: string;
    matched_prompt: string | null;
    expires_at: string;
}

function generateRecommendations(
    signal: FreshSignal,
    classification: string,
    tavilyAppears: boolean,
    adjacentDomains: string[]
): Recommendation[] {
    const recommendations: Recommendation[] = [];
    const now = new Date();

    // Emerging high-influence source
    if (classification === "emerging" && signal.influence_score >= 0.65) {
        recommendations.push({
            client_id: signal.client_id,
            signal_id: signal.id,
            recommendation_type: "content_opportunity",
            priority: signal.influence_score >= 0.8 ? "high" : "medium",
            title: `New high-impact content on ${signal.source_domain}`,
            description: `A ${signal.content_type} "${signal.title}" was published recently. This source type historically influences AI answers.`,
            evidence: `Influence score: ${(signal.influence_score * 100).toFixed(0)}%. Not yet appearing in Tavily results.`,
            action_items: [
                "Engage or secure inclusion on similar editorial sources",
                "Publish content matching this format and angle",
                "Monitor for AI answer changes in coming weeks",
            ],
            urgency_days: 7,
            source_domain: signal.source_domain,
            source_url: signal.url,
            matched_prompt: signal.matched_topic,
            expires_at: new Date(now.getTime() + 14 * 24 * 60 * 60 * 1000).toISOString(),
        });
    }

    // Competitor mentioned in high-influence content
    if (signal.competitor_mentions.length > 0 && signal.influence_score >= 0.5) {
        recommendations.push({
            client_id: signal.client_id,
            signal_id: signal.id,
            recommendation_type: "competitor_alert",
            priority: tavilyAppears ? "high" : "medium",
            title: `Competitor mentioned: ${signal.competitor_mentions[0]}`,
            description: `${signal.competitor_mentions.join(", ")} mentioned in "${signal.title}" on ${signal.source_domain}.`,
            evidence: `${tavilyAppears ? "This source already appears in AI answers." : "This source may influence future AI answers."}`,
            action_items: [
                "Review the content for competitive positioning",
                "Consider response content or outreach",
                tavilyAppears ? "Monitor for changes in your AI visibility" : "Track if this content enters AI answers",
            ],
            urgency_days: tavilyAppears ? 3 : 10,
            source_domain: signal.source_domain,
            source_url: signal.url,
            matched_prompt: signal.matched_topic,
            expires_at: new Date(now.getTime() + 21 * 24 * 60 * 60 * 1000).toISOString(),
        });
    }

    // Brand not mentioned in listicle/review
    if (signal.brand_mentions.length === 0 &&
        signal.competitor_mentions.length > 0 &&
        ["listicle", "review"].includes(signal.content_type) &&
        signal.influence_score >= 0.5) {

        recommendations.push({
            client_id: signal.client_id,
            signal_id: signal.id,
            recommendation_type: "visibility_gap",
            priority: "high",
            title: `Missing from: "${signal.title}"`,
            description: `Your brand is not mentioned in this ${signal.content_type}, but competitors are. This content may influence AI visibility.`,
            evidence: `Competitors mentioned: ${signal.competitor_mentions.join(", ")}. Influence score: ${(signal.influence_score * 100).toFixed(0)}%`,
            action_items: [
                "Contact the publication for inclusion",
                "Create similar content optimized for AI visibility",
                "Track this source in future AI answer audits",
            ],
            urgency_days: 5,
            source_domain: signal.source_domain,
            source_url: signal.url,
            matched_prompt: signal.matched_topic,
            expires_at: new Date(now.getTime() + 14 * 24 * 60 * 60 * 1000).toISOString(),
        });
    }

    return recommendations;
}

// ============================================
// MAIN HANDLER
// ============================================

serve(async (req: Request) => {
    if (req.method === "OPTIONS") {
        return new Response("ok", { headers: corsHeaders });
    }

    try {
        const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
        const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
        const supabase = createClient(supabaseUrl, supabaseKey);

        const body = await req.json().catch(() => ({}));
        const signalId = body.signal_id;
        const limit = body.limit || 20;

        // Fetch pending signals
        let signalsQuery = supabase
            .from("fresh_signals")
            .select("*")
            .eq("processing_status", "pending");

        if (signalId) {
            signalsQuery = signalsQuery.eq("id", signalId);
        }

        const { data: signals, error: signalsError } = await signalsQuery
            .order("discovered_at", { ascending: true })
            .limit(limit);

        if (signalsError) throw signalsError;
        if (!signals?.length) {
            return new Response(
                JSON.stringify({ success: true, message: "No pending signals", processed: 0 }),
                { headers: { ...corsHeaders, "Content-Type": "application/json" } }
            );
        }

        console.log(`[Signal Scorer] Processing ${signals.length} signals`);

        // Fetch domain authority cache
        const domains = [...new Set(signals.map((s: FreshSignal) => s.source_domain))];
        const { data: authorities } = await supabase
            .from("domain_authority")
            .select("*")
            .in("domain", domains);

        const authorityMap = new Map<string, DomainAuthority>(
            (authorities || []).map((a: DomainAuthority) => [a.domain, a])
        );

        const results = {
            processed: 0,
            correlations: 0,
            recommendations: 0,
            errors: [] as string[],
        };

        for (const signal of signals as FreshSignal[]) {
            try {
                // Calculate scores
                const freshnessScore = calculateFreshnessScore(signal.published_at);
                const authorityData = authorityMap.get(signal.source_domain);
                const authorityScore = authorityData?.authority_score ?? 0.3; // Default to low
                const relevanceScore = calculateRelevanceScore(
                    signal.title,
                    signal.content_snippet,
                    signal.brand_mentions,
                    signal.competitor_mentions
                );

                // Weighted influence score
                const influenceScore = (authorityScore * 0.4) + (freshnessScore * 0.3) + (relevanceScore * 0.3);

                // Update signal with scores
                await supabase.from("fresh_signals").update({
                    freshness_score: freshnessScore,
                    authority_score: authorityScore,
                    relevance_score: relevanceScore,
                    influence_score: influenceScore,
                    processing_status: "scored",
                }).eq("id", signal.id);

                // Correlate with Tavily for high-influence signals
                let correlation = null;
                if (influenceScore >= 0.5 && signal.matched_topic) {
                    const tavilyResult = await correlatewithTavily(signal, signal.matched_topic);
                    const { classification, reason } = classifySignal(
                        influenceScore,
                        tavilyResult.appears,
                        signal.competitor_mentions
                    );

                    correlation = {
                        signal_id: signal.id,
                        client_id: signal.client_id,
                        prompt_text: signal.matched_topic,
                        tavily_appears: tavilyResult.appears,
                        tavily_rank: tavilyResult.rank,
                        classification,
                        classification_reason: reason,
                        adjacent_domains: tavilyResult.adjacentDomains,
                    };

                    await supabase.from("signal_correlations").insert(correlation);
                    results.correlations++;

                    // Generate recommendations
                    const recs = generateRecommendations(
                        { ...signal, influence_score: influenceScore },
                        classification,
                        tavilyResult.appears,
                        tavilyResult.adjacentDomains
                    );

                    if (recs.length > 0) {
                        await supabase.from("recommendations").insert(recs);
                        results.recommendations += recs.length;
                    }

                    // Update signal correlation status
                    await supabase.from("fresh_signals").update({
                        correlation_status: "completed",
                        processing_status: "processed",
                    }).eq("id", signal.id);
                } else {
                    // Low influence, skip correlation
                    await supabase.from("fresh_signals").update({
                        correlation_status: "skipped",
                        processing_status: "processed",
                    }).eq("id", signal.id);
                }

                results.processed++;

            } catch (err) {
                console.error(`[Signal Scorer] Error for signal ${signal.id}:`, err);
                results.errors.push(`${signal.id}: ${err instanceof Error ? err.message : String(err)}`);
            }
        }

        console.log(`[Signal Scorer] Complete: ${results.processed} signals, ${results.correlations} correlations, ${results.recommendations} recommendations`);

        return new Response(
            JSON.stringify({ success: true, ...results }),
            { headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );

    } catch (err) {
        console.error("[Signal Scorer] Fatal error:", err);
        return new Response(
            JSON.stringify({ success: false, error: err instanceof Error ? err.message : String(err) }),
            { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
    }
});
