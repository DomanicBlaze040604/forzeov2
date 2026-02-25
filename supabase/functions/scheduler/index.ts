// @ts-nocheck
/**
 * ============================================================================
 * ENHANCED SCHEDULER EDGE FUNCTION v2.0
 * ============================================================================
 *
 * Background scheduler for auto-running prompts at configured intervals.
 * Supports both single-account and multi-account schedules.
 *
 * NEW FEATURES:
 * - Multi-account schedule support (delegates to multi-account-runner)
 * - Execution locks to prevent duplicate runs
 * - Enhanced recurrence (daily, weekly, monthly)
 * - Timezone-aware scheduling
 *
 * This function should be called periodically (e.g., every minute via cron)
 * or can be invoked manually to process pending schedules.
 *
 * @version 2.0.0
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
    client_id: string | null;
    client_ids: string[] | null; // Multi-account support
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
    recurrence_type: string; // 'once', 'daily', 'weekly', 'monthly'
    recurrence_days_of_week: number[] | null;
    recurrence_day_of_month: number | null;
    timezone: string | null;
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
// EXECUTION LOCK MANAGEMENT
// ============================================

async function acquireExecutionLock(
    supabase: ReturnType<typeof createClient>,
    scheduleId: string
): Promise<boolean> {
    try {
        const expiresAt = new Date(Date.now() + 3600000); // 1 hour from now
        const lockedBy = `scheduler-${Deno.env.get("DENO_DEPLOYMENT_ID") || "local"}`;

        const { error } = await supabase
            .from("execution_locks")
            .insert({
                schedule_id: scheduleId,
                locked_by: lockedBy,
                expires_at: expiresAt.toISOString(),
            });

        // If unique constraint violation (error code 23505), lock already exists
        if (error?.code === "23505") {
            console.log(`[Scheduler] Schedule ${scheduleId} already locked`);
            return false;
        }

        if (error) {
            console.error("[Scheduler] Failed to acquire lock:", error);
            return false;
        }

        console.log(`[Scheduler] Acquired lock for schedule ${scheduleId}`);
        return true;
    } catch (err) {
        console.error("[Scheduler] Lock acquisition error:", err);
        return false;
    }
}

async function releaseExecutionLock(
    supabase: ReturnType<typeof createClient>,
    scheduleId: string
): Promise<void> {
    try {
        await supabase
            .from("execution_locks")
            .delete()
            .eq("schedule_id", scheduleId);

        console.log(`[Scheduler] Released lock for schedule ${scheduleId}`);
    } catch (err) {
        console.error("[Scheduler] Failed to release lock:", err);
    }
}

// ============================================
// RECURRENCE CALCULATION
// ============================================

function calculateNextRun(schedule: Schedule): Date {
    const now = new Date();
    // Use the stored next_run_at as the base time to prevent drift.
    // If not available, fall back to now.
    const baseTime = schedule.next_run_at ? new Date(schedule.next_run_at) : now;

    // For legacy schedules with interval_unit
    if (schedule.interval_unit && !schedule.recurrence_type) {
        let ms = 0;
        switch (schedule.interval_unit) {
            case "seconds":
                ms = schedule.interval_value * 1000;
                break;
            case "minutes":
                ms = schedule.interval_value * 60 * 1000;
                break;
            case "hours":
                ms = schedule.interval_value * 60 * 60 * 1000;
                break;
            case "days":
                ms = schedule.interval_value * 24 * 60 * 60 * 1000;
                break;
            default:
                ms = schedule.interval_value * 60 * 1000;
        }
        // Advance from baseTime, skip past now if needed
        let next = new Date(baseTime.getTime() + ms);
        while (next <= now) {
            next = new Date(next.getTime() + ms);
        }
        return next;
    }

    // For new recurrence-based schedules, preserve the original time-of-day
    switch (schedule.recurrence_type) {
        case "daily": {
            // Add 1 day from baseTime, skip past now if needed
            let next = new Date(baseTime.getTime() + 24 * 60 * 60 * 1000);
            while (next <= now) {
                next = new Date(next.getTime() + 24 * 60 * 60 * 1000);
            }
            return next;
        }

        case "weekly": {
            // Run on specific days of week, preserving time-of-day from baseTime
            const daysOfWeek = schedule.recurrence_days_of_week || [baseTime.getUTCDay()];
            const currentDay = now.getUTCDay(); // 0=Sunday, 6=Saturday

            // Find next matching day after now
            for (let i = 0; i <= 7; i++) {
                const checkDay = (currentDay + i) % 7;
                if (daysOfWeek.includes(checkDay)) {
                    const candidate = new Date(now);
                    candidate.setUTCDate(candidate.getUTCDate() + i);
                    // Preserve the original time-of-day from baseTime
                    candidate.setUTCHours(baseTime.getUTCHours(), baseTime.getUTCMinutes(), 0, 0);
                    if (candidate > now) {
                        return candidate;
                    }
                }
            }
            // Fallback: 7 days from now with original time
            const fallback = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);
            fallback.setUTCHours(baseTime.getUTCHours(), baseTime.getUTCMinutes(), 0, 0);
            return fallback;
        }

        case "monthly": {
            // Run on specific day of month, preserving time-of-day from baseTime
            const dayOfMonth = schedule.recurrence_day_of_month || baseTime.getUTCDate();
            // Set day to 1 first to prevent month overflow (e.g., March 31 + 1 month → May 1)
            const nextMonth = new Date(baseTime);
            nextMonth.setUTCDate(1);
            nextMonth.setUTCMonth(nextMonth.getUTCMonth() + 1);
            const maxDay = new Date(nextMonth.getUTCFullYear(), nextMonth.getUTCMonth() + 1, 0).getDate();
            nextMonth.setUTCDate(Math.min(dayOfMonth, maxDay));
            nextMonth.setUTCHours(baseTime.getUTCHours(), baseTime.getUTCMinutes(), 0, 0);
            // If still in the past, advance another month
            if (nextMonth <= now) {
                nextMonth.setUTCDate(1);
                nextMonth.setUTCMonth(nextMonth.getUTCMonth() + 1);
                const maxDay2 = new Date(nextMonth.getUTCFullYear(), nextMonth.getUTCMonth() + 1, 0).getDate();
                nextMonth.setUTCDate(Math.min(dayOfMonth, maxDay2));
            }
            return nextMonth;
        }

        case "once":
        default:
            // For one-time schedules, set far future
            return new Date(now.getTime() + 365 * 24 * 60 * 60 * 1000);
    }
}

// ============================================
// HELPER FUNCTIONS
// ============================================

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

    const modelConfig: Record<string, { endpoint: string; model_name: string }> = {
        chatgpt: { endpoint: "/ai_optimization/chat_gpt/llm_responses/live", model_name: "gpt-5-nano" },
        gemini: { endpoint: "/ai_optimization/gemini/llm_responses/live", model_name: "gemini-2.5-flash" },
        claude: { endpoint: "/ai_optimization/claude/llm_responses/live", model_name: "claude-haiku-4-5" },
        perplexity: { endpoint: "/ai_optimization/perplexity/llm_responses/live", model_name: "sonar" },
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
        const payload: Record<string, any> = {
            prompt,
            model_name: config.model_name,
            location_code: locationCode,
            language_code: "en",
        };

        // GPT-5 Nano is extremely sensitive — do NOT send temperature or max_output_tokens
        if (config.model_name !== "gpt-5-nano") {
            payload.max_output_tokens = 1000;
            payload.temperature = 0.7;
        }

        const response = await fetch(`${DATAFORSEO_API}${config.endpoint}`, {
            method: "POST",
            headers: {
                "Authorization": `Basic ${DATAFORSEO_AUTH}`,
                "Content-Type": "application/json",
            },
            body: JSON.stringify([payload]),
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
// PROCESS SINGLE-ACCOUNT SCHEDULE
// ============================================

async function processSingleAccountSchedule(
    supabase: ReturnType<typeof createClient>,
    schedule: Schedule,
    client: Client,
    prompt: Prompt | null
): Promise<{ success: boolean; error?: string }> {
    const promptText = prompt?.prompt_text || schedule.name;

    console.log(`[Scheduler] Processing single-account schedule "${schedule.name}" for prompt: "${promptText.substring(0, 50)}..."`);

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
                visibility_score: shareOfVoice,
                average_rank: averageRank,
                total_citations: totalCitations,
                total_cost: totalCost,
                model_results: modelResults,
                tavily_results: tavilyResults,
                sources: allSources,
                completed_at: new Date().toISOString(),
            })
            .eq("id", run.id);

        console.log(`[Scheduler] Completed single-account schedule "${schedule.name}" - SOV: ${shareOfVoice}%`);
        return { success: true };

    } catch (err) {
        console.error("[Scheduler] Error processing single-account schedule:", err);

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
        let body: Record<string, any> = {};
        try {
            if (req.method === "POST") {
                body = await req.json();
            }
        } catch {
            // Body may be empty or malformed (e.g., from pg_cron) - continue with defaults
            body = {};
        }
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
            // Check if this is a multi-account schedule
            const isMultiAccount = schedule.client_ids && schedule.client_ids.length > 0;

            // Acquire execution lock
            const lockAcquired = await acquireExecutionLock(supabase, schedule.id);
            if (!lockAcquired) {
                console.log(`[Scheduler] Skipping schedule ${schedule.id} - already running`);
                results.push({
                    schedule_id: schedule.id,
                    name: schedule.name,
                    success: false,
                    error: "Schedule already running (lock held)"
                });
                continue;
            }

            try {
                // IMPORTANT: Update next_run_at BEFORE execution to prevent
                // duplicate triggers if the execution times out or fails.
                // The cron runs every minute; without this, a timeout would
                // leave next_run_at in the past and the cron would re-trigger.
                if (schedule.recurrence_type !== "once") {
                    const nextRun = calculateNextRun(schedule);
                    await supabase
                        .from("prompt_schedules")
                        .update({
                            last_run_at: new Date().toISOString(),
                            next_run_at: nextRun.toISOString(),
                            total_runs: schedule.total_runs + 1,
                        })
                        .eq("id", schedule.id);

                    console.log(`[Scheduler] Next run for "${schedule.name}": ${nextRun.toISOString()}`);
                } else {
                    // For one-time schedules, deactivate immediately
                    await supabase
                        .from("prompt_schedules")
                        .update({
                            last_run_at: new Date().toISOString(),
                            is_active: false,
                            total_runs: schedule.total_runs + 1,
                        })
                        .eq("id", schedule.id);

                    console.log(`[Scheduler] One-time schedule "${schedule.name}" deactivated`);
                }

                if (isMultiAccount) {
                    // Multi-account schedule: Delegate to multi-account-runner
                    console.log(`[Scheduler] Delegating multi-account schedule "${schedule.name}" to multi-account-runner`);

                    const { data, error } = await supabase.functions.invoke('multi-account-runner', {
                        body: {
                            schedule: schedule,
                            force: false // Don't force, respect conditional rules
                        }
                    });

                    if (error) {
                        throw new Error(`Multi-account runner failed: ${error.message}`);
                    }

                    results.push({
                        schedule_id: schedule.id,
                        name: schedule.name,
                        success: true
                    });
                } else {
                    // Single-account schedule: Process directly
                    // Get client
                    const { data: client } = await supabase
                        .from("clients")
                        .select("*")
                        .eq("id", schedule.client_id)
                        .single();

                    if (!client) {
                        results.push({
                            schedule_id: schedule.id,
                            name: schedule.name,
                            success: false,
                            error: "Client not found"
                        });
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

                    // Process single-account schedule
                    const result = await processSingleAccountSchedule(supabase, schedule, client as Client, prompt);
                    results.push({
                        schedule_id: schedule.id,
                        name: schedule.name,
                        success: result.success,
                        error: result.error,
                    });
                }

            } catch (err) {
                console.error(`[Scheduler] Error processing schedule ${schedule.id}:`, err);
                results.push({
                    schedule_id: schedule.id,
                    name: schedule.name,
                    success: false,
                    error: String(err)
                });
            } finally {
                // Always release lock
                await releaseExecutionLock(supabase, schedule.id);
            }
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
