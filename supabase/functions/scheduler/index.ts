// @ts-nocheck
/**
 * ============================================================================
 * SCHEDULER EDGE FUNCTION
 * ============================================================================
 * 
 * Background scheduler for auto-running prompts at configured intervals.
 * Checks prompt_schedules table for due runs and executes them.
 * 
 * This function should be called periodically (e.g., every minute via cron)
 * or can be invoked manually to process pending schedules.
 * 
 * @version 1.0.0
 */

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

// ============================================
// CORS CONFIGURATION
// ============================================

const corsHeaders = {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
    "Access-Control-Allow-Methods": "POST, OPTIONS",
};

// ============================================
// ENVIRONMENT CONFIGURATION
// ============================================

const SUPABASE_URL = Deno.env.get("SUPABASE_URL") || "";
const SUPABASE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || "";
const TAVILY_API_KEY = Deno.env.get("TAVILY_API_KEY") || "";
const TAVILY_API_URL = "https://api.tavily.com";

// DataForSEO
const DATAFORSEO_API = "https://api.dataforseo.com/v3";
const DATAFORSEO_LOGIN = Deno.env.get("DATAFORSEO_LOGIN") || "";
const DATAFORSEO_PASSWORD = Deno.env.get("DATAFORSEO_PASSWORD") || "";
const DATAFORSEO_AUTH = btoa(`${DATAFORSEO_LOGIN}:${DATAFORSEO_PASSWORD}`);

// ============================================
// TYPE DEFINITIONS
// ============================================

interface Schedule {
    id: string;
    client_id: string;
    prompt_id: string | null;
    name: string;
    interval_value: number;
    interval_unit: string;
    is_active: boolean;
    include_tavily: boolean;
    models: string[];
    last_run_at: string | null;
    next_run_at: string | null;
    total_runs: number;
}

interface Client {
    id: string;
    brand_name: string;
    brand_tags: string[];
    competitors: string[];
    location_code: number;
}

interface Prompt {
    id: string;
    prompt_text: string;
    category: string;
}

// ============================================
// HELPER FUNCTIONS
// ============================================

function calculateNextRun(intervalValue: number, intervalUnit: string): Date {
    const now = new Date();
    let ms = 0;

    switch (intervalUnit) {
        case "seconds":
            ms = intervalValue * 1000;
            break;
        case "minutes":
            ms = intervalValue * 60 * 1000;
            break;
        case "hours":
            ms = intervalValue * 60 * 60 * 1000;
            break;
        case "days":
            ms = intervalValue * 24 * 60 * 60 * 1000;
            break;
        default:
            ms = intervalValue * 60 * 1000; // Default to minutes
    }

    return new Date(now.getTime() + ms);
}

function extractDomain(url: string): string {
    try {
        return new URL(url).hostname.replace(/^www\./, "");
    } catch {
        return "";
    }
}

// ============================================
// TAVILY SEARCH
// ============================================

async function tavilySearch(query: string): Promise<{
    success: boolean;
    answer?: string;
    sources: Array<{ url: string; title: string; content: string; domain: string }>;
    error?: string;
}> {
    if (!TAVILY_API_KEY) {
        return { success: false, sources: [], error: "Tavily API key not configured" };
    }

    try {
        const response = await fetch(`${TAVILY_API_URL}/search`, {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
                "Authorization": `Bearer ${TAVILY_API_KEY}`,
            },
            body: JSON.stringify({
                query,
                search_depth: "advanced",
                include_answer: true,
                include_raw_content: false,
                max_results: 20,
            }),
        });

        if (!response.ok) {
            return { success: false, sources: [], error: `HTTP ${response.status}` };
        }

        const data = await response.json();
        const sources = (data.results || []).map((r: { url: string; title: string; content: string }) => ({
            url: r.url,
            title: r.title,
            content: r.content,
            domain: extractDomain(r.url),
        }));

        return { success: true, answer: data.answer, sources };
    } catch (err) {
        return { success: false, sources: [], error: String(err) };
    }
}

// ============================================
// DATAFORSEO LLM QUERY
// ============================================

async function queryLLM(
    prompt: string,
    model: string,
    locationCode: number
): Promise<{
    success: boolean;
    response: string;
    citations: Array<{ url: string; title: string; domain: string }>;
    cost: number;
    error?: string;
}> {
    if (!DATAFORSEO_LOGIN || !DATAFORSEO_PASSWORD) {
        return { success: false, response: "", citations: [], cost: 0, error: "DataForSEO not configured" };
    }

    const modelConfig: Record<string, { endpoint: string; internal_model: string }> = {
        chatgpt: { endpoint: "/ai_optimization/chat_gpt/llm_responses/live", internal_model: "gpt-4.1-mini" },
        gemini: { endpoint: "/ai_optimization/gemini/llm_responses/live", internal_model: "gemini-2.5-flash" },
        claude: { endpoint: "/ai_optimization/claude/llm_responses/live", internal_model: "claude-sonnet-4-0" },
        perplexity: { endpoint: "/ai_optimization/perplexity/llm_responses/live", internal_model: "sonar-pro" },
    };

    const config = modelConfig[model];
    if (!config) {
        // Handle Google endpoints
        if (model === "google_ai_overview" || model === "google_serp") {
            const endpoint = model === "google_ai_overview"
                ? "/serp/google/organic/live/advanced"
                : "/serp/google/organic/live/advanced";

            try {
                const response = await fetch(`${DATAFORSEO_API}${endpoint}`, {
                    method: "POST",
                    headers: {
                        "Authorization": `Basic ${DATAFORSEO_AUTH}`,
                        "Content-Type": "application/json",
                    },
                    body: JSON.stringify([{
                        keyword: prompt,
                        location_code: locationCode,
                        language_code: "en",
                        device: "desktop",
                        depth: 10,
                    }]),
                });

                if (!response.ok) {
                    return { success: false, response: "", citations: [], cost: 0, error: `HTTP ${response.status}` };
                }

                const data = await response.json();
                const task = data?.tasks?.[0];
                const result = task?.result?.[0];
                const cost = task?.cost || 0;
                const items = result?.items || [];

                let text = "";
                const citations: Array<{ url: string; title: string; domain: string }> = [];

                for (const item of items) {
                    if (item.type === "organic" && item.url) {
                        text += `${item.title}\n${item.description || ""}\n\n`;
                        citations.push({
                            url: item.url,
                            title: item.title || "",
                            domain: item.domain || extractDomain(item.url),
                        });
                    }
                }

                return { success: true, response: text.trim(), citations, cost };
            } catch (err) {
                return { success: false, response: "", citations: [], cost: 0, error: String(err) };
            }
        }
        return { success: false, response: "", citations: [], cost: 0, error: `Unknown model: ${model}` };
    }

    try {
        const response = await fetch(`${DATAFORSEO_API}${config.endpoint}`, {
            method: "POST",
            headers: {
                "Authorization": `Basic ${DATAFORSEO_AUTH}`,
                "Content-Type": "application/json",
            },
            body: JSON.stringify([{
                prompt,
                internal_model: config.internal_model,
                location_code: locationCode,
                language_code: "en",
            }]),
        });

        if (!response.ok) {
            return { success: false, response: "", citations: [], cost: 0, error: `HTTP ${response.status}` };
        }

        const data = await response.json();
        const task = data?.tasks?.[0];
        const result = task?.result?.[0];
        const cost = task?.cost || 0;

        const llmResponse = result?.response || result?.items?.[0]?.text || "";

        // Extract citations from response
        const citations: Array<{ url: string; title: string; domain: string }> = [];
        const urlRegex = /https?:\/\/[^\s<>"{}|\\^`\[\]]+/gi;
        const urls = llmResponse.match(urlRegex) || [];
        for (const url of urls) {
            citations.push({
                url,
                title: extractDomain(url),
                domain: extractDomain(url),
            });
        }

        return { success: true, response: llmResponse, citations, cost };
    } catch (err) {
        return { success: false, response: "", citations: [], cost: 0, error: String(err) };
    }
}

// ============================================
// PARSE BRAND DATA
// ============================================

function parseBrandData(
    response: string,
    brandName: string,
    brandTags: string[] = []
): {
    mentioned: boolean;
    count: number;
    rank: number | null;
} {
    if (!response) {
        return { mentioned: false, count: 0, rank: null };
    }

    const lower = response.toLowerCase();
    const allTerms = [brandName, ...brandTags].filter(Boolean);
    let totalCount = 0;

    for (const term of allTerms) {
        if (!term) continue;
        const termLower = term.toLowerCase();
        let idx = 0;
        while ((idx = lower.indexOf(termLower, idx)) !== -1) {
            totalCount++;
            idx++;
        }
    }

    // Find rank in numbered lists
    let rank: number | null = null;
    const lines = response.split("\n");
    for (const line of lines) {
        const match = line.match(/^\s*(\d+)[.)\]]\s*\*{0,2}(.+)/);
        if (match) {
            const lineContent = match[2].toLowerCase();
            for (const term of allTerms) {
                if (term && lineContent.includes(term.toLowerCase())) {
                    rank = parseInt(match[1]);
                    break;
                }
            }
            if (rank) break;
        }
    }

    return { mentioned: totalCount > 0, count: totalCount, rank };
}

// ============================================
// PROCESS SCHEDULE
// ============================================

async function processSchedule(
    supabase: ReturnType<typeof createClient>,
    schedule: Schedule,
    client: Client,
    prompt: Prompt | null
): Promise<{ success: boolean; error?: string }> {
    const promptText = prompt?.prompt_text || schedule.name;

    console.log(`[Scheduler] Processing schedule "${schedule.name}" for prompt: "${promptText.substring(0, 50)}..."`);

    // Create run record
    const { data: run, error: runError } = await supabase
        .from("schedule_runs")
        .insert({
            schedule_id: schedule.id,
            client_id: client.id,
            prompt_id: prompt?.id || null,
            prompt_text: promptText,
            status: "running",
            started_at: new Date().toISOString(),
        })
        .select()
        .single();

    if (runError || !run) {
        console.error("[Scheduler] Failed to create run record:", runError);
        return { success: false, error: runError?.message || "Failed to create run" };
    }

    try {
        const modelResults: Array<{
            model: string;
            success: boolean;
            brand_mentioned: boolean;
            brand_mention_count: number;
            brand_rank: number | null;
            citations: Array<{ url: string; title: string; domain: string }>;
            api_cost: number;
            raw_response: string;
        }> = [];

        let totalCost = 0;
        let totalCitations = 0;
        let visibleCount = 0;
        let rankSum = 0;
        let rankCount = 0;

        // Run selected models
        for (const model of schedule.models) {
            const result = await queryLLM(promptText, model, client.location_code);

            const brandData = parseBrandData(result.response, client.brand_name, client.brand_tags);

            modelResults.push({
                model,
                success: result.success,
                brand_mentioned: brandData.mentioned,
                brand_mention_count: brandData.count,
                brand_rank: brandData.rank,
                citations: result.citations,
                api_cost: result.cost,
                raw_response: result.response,
            });

            if (result.success) {
                totalCost += result.cost;
                totalCitations += result.citations.length;
                if (brandData.mentioned) visibleCount++;
                if (brandData.rank) {
                    rankSum += brandData.rank;
                    rankCount++;
                }
            }

            // Small delay between models
            await new Promise(r => setTimeout(r, 500));
        }

        // Run Tavily if enabled
        let tavilyResults = null;
        if (schedule.include_tavily) {
            const tavilyResult = await tavilySearch(promptText);
            if (tavilyResult.success) {
                tavilyResults = {
                    answer: tavilyResult.answer,
                    sources: tavilyResult.sources,
                };
            }
        }

        // Calculate metrics
        const successfulModels = modelResults.filter(r => r.success).length;
        const shareOfVoice = successfulModels > 0 ? Math.round((visibleCount / successfulModels) * 100) : 0;
        const averageRank = rankCount > 0 ? Math.round((rankSum / rankCount) * 100) / 100 : null;

        // Collect all sources
        const allSources: Array<{ url: string; title: string; domain: string }> = [];
        for (const mr of modelResults) {
            allSources.push(...mr.citations);
        }
        if (tavilyResults?.sources) {
            for (const s of tavilyResults.sources) {
                allSources.push({ url: s.url, title: s.title, domain: s.domain });
            }
        }

        // Update run record with results
        await supabase
            .from("schedule_runs")
            .update({
                status: "completed",
                share_of_voice: shareOfVoice,
                visibility_score: shareOfVoice, // Using SOV as visibility score
                average_rank: averageRank,
                total_citations: totalCitations,
                total_cost: totalCost,
                model_results: modelResults,
                tavily_results: tavilyResults,
                sources: allSources,
                completed_at: new Date().toISOString(),
            })
            .eq("id", run.id);

        // Update schedule with next run time
        const nextRun = calculateNextRun(schedule.interval_value, schedule.interval_unit);
        await supabase
            .from("prompt_schedules")
            .update({
                last_run_at: new Date().toISOString(),
                next_run_at: nextRun.toISOString(),
                total_runs: schedule.total_runs + 1,
            })
            .eq("id", schedule.id);

        console.log(`[Scheduler] Completed schedule "${schedule.name}" - SOV: ${shareOfVoice}%, Next run: ${nextRun.toISOString()}`);
        return { success: true };

    } catch (err) {
        console.error("[Scheduler] Error processing schedule:", err);

        // Mark run as failed
        await supabase
            .from("schedule_runs")
            .update({
                status: "failed",
                error_message: String(err),
                completed_at: new Date().toISOString(),
            })
            .eq("id", run.id);

        return { success: false, error: String(err) };
    }
}

// ============================================
// MAIN HANDLER
// ============================================

serve(async (req: Request) => {
    // Handle CORS preflight
    if (req.method === "OPTIONS") {
        return new Response(null, { headers: corsHeaders });
    }

    if (!SUPABASE_URL || !SUPABASE_KEY) {
        return new Response(JSON.stringify({ error: "Supabase not configured" }), {
            status: 500,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
    }

    const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

    try {
        const body = req.method === "POST" ? await req.json() : {};
        const scheduleId = body.schedule_id; // Optional: run specific schedule
        const forceRun = body.force === true; // Force run even if not due

        console.log(`[Scheduler] Starting scheduler run...`);

        // Get due schedules
        let query = supabase
            .from("prompt_schedules")
            .select("*")
            .eq("is_active", true);

        if (scheduleId) {
            query = query.eq("id", scheduleId);
        } else if (!forceRun) {
            // Only get schedules that are due
            query = query.or(`next_run_at.is.null,next_run_at.lte.${new Date().toISOString()}`);
        }

        const { data: schedules, error: schedulesError } = await query;

        if (schedulesError) {
            throw new Error(`Failed to fetch schedules: ${schedulesError.message}`);
        }

        if (!schedules || schedules.length === 0) {
            console.log("[Scheduler] No schedules due");
            return new Response(JSON.stringify({
                success: true,
                message: "No schedules due",
                processed: 0,
            }), {
                headers: { ...corsHeaders, "Content-Type": "application/json" },
            });
        }

        console.log(`[Scheduler] Found ${schedules.length} schedules to process`);

        const results: Array<{ schedule_id: string; name: string; success: boolean; error?: string }> = [];

        for (const schedule of schedules as Schedule[]) {
            // Get client
            const { data: client } = await supabase
                .from("clients")
                .select("*")
                .eq("id", schedule.client_id)
                .single();

            if (!client) {
                results.push({ schedule_id: schedule.id, name: schedule.name, success: false, error: "Client not found" });
                continue;
            }

            // Get prompt if linked
            let prompt: Prompt | null = null;
            if (schedule.prompt_id) {
                const { data: promptData } = await supabase
                    .from("prompts")
                    .select("*")
                    .eq("id", schedule.prompt_id)
                    .single();
                prompt = promptData as Prompt | null;
            }

            // Process schedule
            const result = await processSchedule(supabase, schedule, client as Client, prompt);
            results.push({
                schedule_id: schedule.id,
                name: schedule.name,
                success: result.success,
                error: result.error,
            });
        }

        const successCount = results.filter(r => r.success).length;
        console.log(`[Scheduler] Completed: ${successCount}/${results.length} schedules`);

        return new Response(JSON.stringify({
            success: true,
            processed: results.length,
            successful: successCount,
            results,
        }), {
            headers: { ...corsHeaders, "Content-Type": "application/json" },
        });

    } catch (err) {
        console.error("[Scheduler] Error:", err);
        return new Response(JSON.stringify({
            success: false,
            error: String(err),
        }), {
            status: 500,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
    }
});
