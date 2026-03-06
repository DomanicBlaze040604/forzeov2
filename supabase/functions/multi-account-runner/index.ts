import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient, SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2"

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
}

// Performance constants
const AVERAGE_SECONDS_PER_PROMPT = 37
const EDGE_FUNCTION_TIMEOUT = 150 // seconds
const SAFE_EXECUTION_WINDOW = 110 // seconds (extra buffer for cleanup/logging)
const CHUNK_SIZE_PROMPTS = 3 // Max prompts to process in one invocation
const PER_PROMPT_TIMEOUT = 60_000 // 60 seconds max per geo-audit call
const PER_PROMPT_WARN_MS = 45_000 // warn if a single prompt takes > 45s

// ============================================================================
// TYPES
// ============================================================================

interface Schedule {
  id: string
  name: string
  client_ids: string[]
  prompt_selection_type: 'all' | 'category' | 'custom'
  selected_categories?: string[]
  selected_prompt_ids?: string[]
  models: string[]
  concurrency_limit: number
  conditional_rules?: any
  max_cost_per_run?: number // Budget cap in USD — stops execution if exceeded
}

interface Client {
  id: string
  brand_name: string
  brand_tags: string[]
  competitors: string[]
  location_code: number
  target_region: string
}

interface Prompt {
  id: string
  prompt_text: string
  category: string
  location_code?: number
  client_id: string
  is_active: boolean
}

interface ConditionalRule {
  ruleType: string
  config: {
    threshold?: number
    operator?: string
    hours?: number
  }
}

interface ExecutionState {
  runId: string
  scheduleId: string
  clientIds: string[]
  processedClients: string[]
  currentClientIndex: number
  totalPrompts: number
  completedPrompts: number
  failedBrands: number
  completedBrands: number
  startTime: number
}

// ============================================================================
// MAIN HANDLER
// ============================================================================

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders })
  }

  try {
    const { schedule_id, schedule, force = false, resume_state = null } = await req.json()

    // Initialize Supabase client with service role key
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    const supabase = createClient(supabaseUrl, supabaseServiceKey)

    // If resuming from previous invocation
    if (resume_state) {
      console.log(`[Multi-Account Runner] Resuming execution from state:`, resume_state)
      const runId = await resumeExecution(supabase, resume_state)
      return new Response(
        JSON.stringify({ success: true, run_id: runId, resumed: true }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      )
    }

    // Fetch schedule if only ID provided
    let scheduleData: Schedule
    if (schedule) {
      scheduleData = schedule
    } else if (schedule_id) {
      const { data, error } = await supabase
        .from('prompt_schedules')
        .select('*')
        .eq('id', schedule_id)
        .single()

      if (error || !data) {
        return new Response(
          JSON.stringify({ error: "Schedule not found" }),
          { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        )
      }
      scheduleData = data as Schedule
    } else {
      return new Response(
        JSON.stringify({ error: "schedule_id or schedule required" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      )
    }

    console.log(`[Multi-Account Runner] Starting execution for schedule: ${scheduleData.name}`)

    // Run the multi-account schedule
    const runId = await runMultiAccountSchedule(supabase, scheduleData, force)

    return new Response(
      JSON.stringify({
        success: true,
        run_id: runId,
        message: `Multi-account execution started for ${scheduleData.client_ids?.length || 0} brands`
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    )
  } catch (error) {
    console.error("[Multi-Account Runner] Error:", error)
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : String(error) }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    )
  }
})

// ============================================================================
// CORE EXECUTION LOGIC
// ============================================================================

async function runMultiAccountSchedule(
  supabase: SupabaseClient,
  schedule: Schedule,
  force: boolean = false
): Promise<string> {
  const startTime = Date.now()

  // 0. Dedup guard: skip if there's already a running execution for this schedule
  {
    const { data: existingRun } = await supabase
      .from('schedule_runs')
      .select('id, started_at')
      .eq('schedule_id', schedule.id)
      .eq('status', 'running')
      .order('started_at', { ascending: false })
      .limit(1)
      .maybeSingle()

    if (existingRun) {
      const startedAt = new Date(existingRun.started_at).getTime()
      const twoHoursAgo = Date.now() - 2 * 60 * 60 * 1000
      if (startedAt > twoHoursAgo) {
        console.log(`[Multi-Account Runner] Schedule ${schedule.id} already has a running execution (${existingRun.id}), skipping duplicate`)
        return existingRun.id
      }
      // Mark stale run (>2h) as error so it doesn't block future runs
      await supabase.from('schedule_runs')
        .update({ status: 'error', completed_at: new Date().toISOString(), metadata: { error: 'Timed out after 2 hours' } })
        .eq('id', existingRun.id)
    }
  }

  // 1. Evaluate conditional rules (unless forced)
  if (!force) {
    const { shouldRun, reason } = await shouldExecuteSchedule(supabase, schedule)
    if (!shouldRun) {
      console.log(`[Multi-Account Runner] Schedule ${schedule.id} skipped: ${reason}`)

      // Log skipped execution
      await supabase.from('schedule_runs').insert({
        schedule_id: schedule.id,
        status: 'skipped',
        started_at: new Date().toISOString(),
        completed_at: new Date().toISOString(),
        metadata: { skip_reason: reason }
      })

      return 'skipped'
    }
  }

  const { client_ids, concurrency_limit = 3 } = schedule

  // 2. Create schedule run record
  const { data: run, error: runError } = await supabase
    .from('schedule_runs')
    .insert({
      schedule_id: schedule.id,
      client_ids: client_ids,
      total_brands: client_ids.length,
      status: 'running',
      started_at: new Date().toISOString(),
      metadata: { execution_mode: 'auto', timeout_protection: true }
    })
    .select()
    .single()

  if (runError || !run) {
    console.error("[Multi-Account Runner] Failed to create run record:", runError)
    throw new Error("Failed to create schedule run record")
  }

  console.log(`[Multi-Account Runner] Created run record: ${run.id}`)

  try {
    // 3. Fetch all clients
    const { data: clients, error: clientsError } = await supabase
      .from('clients')
      .select('*')
      .in('id', client_ids)

    if (clientsError || !clients || clients.length === 0) {
      throw new Error("Failed to fetch clients")
    }

    console.log(`[Multi-Account Runner] Fetched ${clients.length} clients`)

    // 4. Get prompts for each client based on selection type
    const clientPromptMap = await getPromptsForClients(
      supabase,
      client_ids,
      schedule.prompt_selection_type,
      schedule.selected_categories,
      schedule.selected_prompt_ids
    )

    const totalPrompts = Object.values(clientPromptMap).reduce((sum, prompts) => sum + prompts.length, 0)
    console.log(`[Multi-Account Runner] Total prompts to execute: ${totalPrompts}`)

    // 5. Estimate execution time
    const estimatedTimeSeconds = (totalPrompts * AVERAGE_SECONDS_PER_PROMPT) / concurrency_limit
    console.log(`[Multi-Account Runner] Estimated execution time: ${Math.ceil(estimatedTimeSeconds / 60)} minutes`)

    // 6. Initialize execution progress
    const executionProgress: Record<string, any> = {}
    for (const client of clients) {
      executionProgress[client.id] = {
        brand_name: client.brand_name,
        total_prompts: clientPromptMap[client.id]?.length || 0,
        completed_prompts: 0,
        failed_prompts: 0,
        total_cost: 0,
        status: 'pending',
        prompts: []
      }
    }

    await supabase
      .from('schedule_runs')
      .update({
        total_prompts: totalPrompts,
        execution_progress: executionProgress,
        metadata: {
          execution_mode: estimatedTimeSeconds > SAFE_EXECUTION_WINDOW ? 'chunked' : 'synchronous',
          timeout_protection: true,
          estimated_time_seconds: estimatedTimeSeconds
        }
      })
      .eq('id', run.id)

    // 7. Choose execution strategy based on estimated time
    if (estimatedTimeSeconds > SAFE_EXECUTION_WINDOW) {
      console.log(`[Multi-Account Runner] Using CHUNKED execution (estimated ${estimatedTimeSeconds}s > ${SAFE_EXECUTION_WINDOW}s)`)

      // Process first chunk and schedule continuation
      await executeChunked(supabase, schedule, run.id, clients, clientPromptMap, executionProgress)

      return run.id
    } else {
      console.log(`[Multi-Account Runner] Using SYNCHRONOUS execution (estimated ${estimatedTimeSeconds}s <= ${SAFE_EXECUTION_WINDOW}s)`)

      // Process all prompts synchronously
      await executeSynchronous(supabase, schedule, run.id, clients, clientPromptMap, executionProgress, startTime)

      return run.id
    }
  } catch (error) {
    // Update run status to failed
    await supabase
      .from('schedule_runs')
      .update({
        status: 'failed',
        completed_at: new Date().toISOString(),
        metadata: { error: error instanceof Error ? error.message : String(error), execution_mode: 'failed' }
      })
      .eq('id', run.id)

    throw error
  }
}

/**
 * Execute all prompts synchronously (for small batches)
 */
async function executeSynchronous(
  supabase: SupabaseClient,
  schedule: Schedule,
  runId: string,
  clients: Client[],
  clientPromptMap: Record<string, Prompt[]>,
  executionProgress: Record<string, any>,
  startTime: number
) {
  const concurrency_limit = schedule.concurrency_limit || 3
  let completedBrands = 0
  let failedBrands = 0
  const queue = [...clients]
  const running = new Set<Promise<void>>()

  while (queue.length > 0 || running.size > 0) {
    // Start new tasks up to concurrency limit
    while (running.size < concurrency_limit && queue.length > 0) {
      const client = queue.shift()!
      const prompts = clientPromptMap[client.id] || []

      console.log(`[Multi-Account Runner] Starting brand: ${client.brand_name} (${prompts.length} prompts)`)

      const promise = runClientPrompts(
        supabase,
        schedule,
        runId,
        client,
        prompts,
        executionProgress
      ).then(() => {
        completedBrands++
        console.log(`[Multi-Account Runner] Completed brand: ${client.brand_name}`)
        running.delete(promise)
      }).catch((err) => {
        console.error(`[Multi-Account Runner] Failed brand ${client.brand_name}:`, err)
        failedBrands++
        executionProgress[client.id].status = 'failed'
        running.delete(promise)
      })

      running.add(promise)
    }

    // Wait for at least one task to complete
    if (running.size > 0) {
      await Promise.race(running)
    }
  }

  // Mark run as completed
  const endTime = Date.now()
  const executionTimeSeconds = Math.floor((endTime - startTime) / 1000)

  console.log(`[Multi-Account Runner] Execution complete. Time: ${executionTimeSeconds}s, Completed: ${completedBrands}, Failed: ${failedBrands}`)

  await supabase
    .from('schedule_runs')
    .update({
      status: failedBrands > 0 ? 'completed_with_errors' : 'completed',
      completed_brands: completedBrands,
      failed_brands: failedBrands,
      completed_at: new Date().toISOString(),
      execution_progress: executionProgress
    })
    .eq('id', runId)

  // Calculate total cost from all geo-audit responses
  const totalCost = Object.values(executionProgress).reduce((sum: number, p: any) => sum + (p.total_cost || 0), 0)
  console.log(`[Multi-Account Runner] Total API cost for this run: $${totalCost.toFixed(4)}`)

  // Update schedule_runs with cost
  await supabase
    .from('schedule_runs')
    .update({ total_cost: totalCost })
    .eq('id', runId)

  // Update analytics
  await updateScheduleAnalytics(supabase, schedule.id, {
    totalRuns: 1,
    successfulRuns: failedBrands === 0 ? 1 : 0,
    failedRuns: failedBrands > 0 ? 1 : 0,
    executionTimeSeconds: executionTimeSeconds,
    totalPromptsExecuted: Object.values(executionProgress).reduce((sum: number, p: any) => sum + p.completed_prompts, 0),
    totalCost
  })

  // Trigger notification dispatcher
  try {
    await supabase.functions.invoke('notify-schedule-execution', {
      body: { run_id: runId }
    })
    console.log(`[Multi-Account Runner] Notification triggered for run: ${runId}`)
  } catch (notifError) {
    console.error("[Multi-Account Runner] Failed to trigger notification:", notifError)
  }
}

/**
 * Execute in chunks to prevent timeout (for large batches)
 */
async function executeChunked(
  supabase: SupabaseClient,
  schedule: Schedule,
  runId: string,
  clients: Client[],
  clientPromptMap: Record<string, Prompt[]>,
  executionProgress: Record<string, any>
) {
  const chunkStartTime = Date.now()
  let processedInChunk = 0
  let currentClientIndex = 0

  // Process prompts until we approach timeout
  for (let i = 0; i < clients.length; i++) {
    const elapsedSeconds = (Date.now() - chunkStartTime) / 1000

    // Check if we're approaching timeout - leave buffer for cleanup
    if (elapsedSeconds > SAFE_EXECUTION_WINDOW - 30) {
      console.log(`[Multi-Account Runner] Approaching timeout at ${elapsedSeconds}s, scheduling continuation`)

      // Save state and schedule continuation
      const resumeState: ExecutionState = {
        runId,
        scheduleId: schedule.id,
        clientIds: schedule.client_ids,
        processedClients: clients.slice(0, i).map(c => c.id),
        currentClientIndex: i,
        totalPrompts: Object.values(clientPromptMap).reduce((sum, p) => sum + p.length, 0),
        completedPrompts: Object.values(executionProgress).reduce((sum: number, p: any) => sum + p.completed_prompts, 0),
        failedBrands: Object.values(executionProgress).filter((p: any) => p.status === 'failed').length,
        completedBrands: Object.values(executionProgress).filter((p: any) => p.status === 'completed').length,
        startTime: chunkStartTime
      }

      // Update run with resume state
      await supabase
        .from('schedule_runs')
        .update({
          execution_progress: executionProgress,
          metadata: { resume_state: resumeState, chunked_execution: true }
        })
        .eq('id', runId)

      // Schedule continuation (self-invoke with resume_state)
      await supabase.functions.invoke('multi-account-runner', {
        body: { resume_state: resumeState }
      })

      console.log(`[Multi-Account Runner] Continuation scheduled, processed ${processedInChunk} prompts in this chunk`)
      return
    }

    const client = clients[i]
    const prompts = clientPromptMap[client.id] || []

    if (prompts.length === 0) continue

    console.log(`[Multi-Account Runner] Processing brand: ${client.brand_name} (${prompts.length} prompts)`)

    try {
      await runClientPrompts(supabase, schedule, runId, client, prompts, executionProgress)
      processedInChunk += prompts.length
      currentClientIndex = i + 1
    } catch (err) {
      console.error(`[Multi-Account Runner] Failed brand ${client.brand_name}:`, err)
      executionProgress[client.id].status = 'failed'
    }
  }

  // All clients processed in this chunk - mark as completed
  const completedBrands = Object.values(executionProgress).filter((p: any) => p.status === 'completed').length
  const failedBrands = Object.values(executionProgress).filter((p: any) => p.status === 'failed').length

  await supabase
    .from('schedule_runs')
    .update({
      status: failedBrands > 0 ? 'completed_with_errors' : 'completed',
      completed_brands: completedBrands,
      failed_brands: failedBrands,
      completed_at: new Date().toISOString(),
      execution_progress: executionProgress
    })
    .eq('id', runId)

  // Calculate total cost from all geo-audit responses
  const chunkedTotalCost = Object.values(executionProgress).reduce((sum: number, p: any) => sum + (p.total_cost || 0), 0)
  console.log(`[Multi-Account Runner] Chunked total API cost: $${chunkedTotalCost.toFixed(4)}`)

  // Update schedule_runs with cost
  await supabase
    .from('schedule_runs')
    .update({ total_cost: chunkedTotalCost })
    .eq('id', runId)

  // Update analytics
  await updateScheduleAnalytics(supabase, schedule.id, {
    totalRuns: 1,
    successfulRuns: failedBrands === 0 ? 1 : 0,
    failedRuns: failedBrands > 0 ? 1 : 0,
    executionTimeSeconds: Math.floor((Date.now() - chunkStartTime) / 1000),
    totalPromptsExecuted: Object.values(executionProgress).reduce((sum: number, p: any) => sum + p.completed_prompts, 0),
    totalCost: chunkedTotalCost
  })

  // Trigger notification
  try {
    await supabase.functions.invoke('notify-schedule-execution', {
      body: { run_id: runId }
    })
  } catch (notifError) {
    console.error("[Multi-Account Runner] Failed to trigger notification:", notifError)
  }

  console.log(`[Multi-Account Runner] Chunked execution complete. Processed all ${clients.length} clients.`)
}

/**
 * Resume execution from saved state
 */
async function resumeExecution(
  supabase: SupabaseClient,
  state: ExecutionState
): Promise<string> {
  console.log(`[Multi-Account Runner] Resuming execution for run ${state.runId}, starting from client index ${state.currentClientIndex}`)

  // Fetch schedule
  const { data: schedule } = await supabase
    .from('prompt_schedules')
    .select('*')
    .eq('id', state.scheduleId)
    .single()

  if (!schedule) {
    throw new Error("Schedule not found for resume")
  }

  // Fetch run record
  const { data: run } = await supabase
    .from('schedule_runs')
    .select('*')
    .eq('id', state.runId)
    .single()

  if (!run) {
    throw new Error("Run record not found for resume")
  }

  // Fetch remaining clients
  const remainingClientIds = state.clientIds.slice(state.currentClientIndex)
  const { data: clients } = await supabase
    .from('clients')
    .select('*')
    .in('id', remainingClientIds)

  if (!clients || clients.length === 0) {
    console.log(`[Multi-Account Runner] No remaining clients to process, marking as complete`)

    // Mark as completed
    await supabase
      .from('schedule_runs')
      .update({
        status: state.failedBrands > 0 ? 'completed_with_errors' : 'completed',
        completed_at: new Date().toISOString()
      })
      .eq('id', state.runId)

    return state.runId
  }

  // Get prompts for remaining clients
  const clientPromptMap = await getPromptsForClients(
    supabase,
    remainingClientIds,
    schedule.prompt_selection_type,
    schedule.selected_categories,
    schedule.selected_prompt_ids
  )

  // Continue chunked execution
  await executeChunked(
    supabase,
    schedule as Schedule,
    state.runId,
    clients as Client[],
    clientPromptMap,
    run.execution_progress || {}
  )

  return state.runId
}

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================

/**
 * Get prompts for multiple clients based on selection type
 */
async function getPromptsForClients(
  supabase: SupabaseClient,
  clientIds: string[],
  selectionType: string,
  selectedCategories?: string[],
  selectedPromptIds?: string[]
): Promise<Record<string, Prompt[]>> {
  const clientPromptMap: Record<string, Prompt[]> = {}

  for (const clientId of clientIds) {
    let query = supabase
      .from('prompts')
      .select('*')
      .eq('client_id', clientId)
      .eq('is_active', true)

    // Filter by selection type
    if (selectionType === 'category' && selectedCategories && selectedCategories.length > 0) {
      query = query.in('category', selectedCategories)
    } else if (selectionType === 'custom' && selectedPromptIds && selectedPromptIds.length > 0) {
      query = query.in('id', selectedPromptIds)
    }
    // 'all' type - no additional filtering needed

    const { data: prompts } = await query
    clientPromptMap[clientId] = prompts || []
  }

  return clientPromptMap
}

/**
 * Run prompts for a single client sequentially
 */
async function runClientPrompts(
  supabase: SupabaseClient,
  schedule: Schedule,
  runId: string,
  client: Client,
  prompts: Prompt[],
  executionProgress: Record<string, any>
) {
  // Update current brand
  await supabase
    .from('schedule_runs')
    .update({ current_brand_id: client.id })
    .eq('id', runId)

  executionProgress[client.id].status = 'running'

  // Sequential execution within each brand (with retry logic)
  for (const prompt of prompts) {
    // Budget check: stop if max_cost_per_run exceeded
    if (schedule.max_cost_per_run && schedule.max_cost_per_run > 0) {
      const accumulatedCost = Object.values(executionProgress).reduce((sum: number, p: any) => sum + (p.total_cost || 0), 0)
      if (accumulatedCost >= schedule.max_cost_per_run) {
        console.warn(`[Multi-Account Runner] Budget exceeded: $${accumulatedCost.toFixed(4)} >= $${schedule.max_cost_per_run} — stopping execution`)
        executionProgress[client.id].status = 'budget_exceeded'
        return
      }
    }
    const MAX_RETRIES = 2
    let success = false

    for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
      try {
        const promptStartTime = Date.now()
        console.log(`[Multi-Account Runner] Running prompt: ${prompt.prompt_text.substring(0, 50)}... (attempt ${attempt + 1})`)

        // Call geo-audit edge function with timeout protection
        const geoAuditPromise = supabase.functions.invoke('geo-audit', {
          body: {
            client_id: client.id,
            prompt_id: prompt.id,
            prompt_text: prompt.prompt_text,
            brand_name: client.brand_name,
            brand_tags: client.brand_tags,
            competitors: client.competitors,
            location_code: prompt.location_code || client.location_code || 2840,
            location_name: client.target_region,
            models: schedule.models || ['gemini-2.0-flash', 'gpt-5-nano'],
            save_to_db: true,
            skip_cache: true
          }
        })

        // Race against timeout to prevent hanging
        const timeoutPromise = new Promise<{ data: null, error: { message: string } }>((_, reject) =>
          setTimeout(() => reject(new Error(`geo-audit timed out after ${PER_PROMPT_TIMEOUT / 1000}s`)), PER_PROMPT_TIMEOUT)
        )

        const { data, error } = await Promise.race([geoAuditPromise, timeoutPromise])

        if (!error && data?.success) {
          const promptDurationMs = Date.now() - promptStartTime
          if (promptDurationMs > PER_PROMPT_WARN_MS) {
            console.warn(`[Multi-Account Runner] Slow prompt (${(promptDurationMs / 1000).toFixed(1)}s): ${prompt.prompt_text.substring(0, 60)}`)
          }
          executionProgress[client.id].completed_prompts++
          // Track cost from geo-audit response
          const promptCost = data?.data?.summary?.total_cost || 0
          executionProgress[client.id].total_cost = (executionProgress[client.id].total_cost || 0) + promptCost
          executionProgress[client.id].prompts.push({
            id: prompt.id,
            prompt_text: prompt.prompt_text,
            status: 'completed'
          })
          success = true
          break
        } else {
          console.error(`[Multi-Account Runner] Prompt failed (attempt ${attempt + 1}):`, error)
        }

        // Exponential backoff before retry
        if (attempt < MAX_RETRIES) {
          const delay = Math.pow(2, attempt + 1) * 1000 // 2s, 4s
          await new Promise(r => setTimeout(r, delay))
        }
      } catch (err) {
        console.error(`[Multi-Account Runner] Error running prompt (attempt ${attempt + 1}):`, err)

        if (attempt < MAX_RETRIES) {
          const delay = Math.pow(2, attempt + 1) * 1000
          await new Promise(r => setTimeout(r, delay))
        }
      }
    }

    if (!success) {
      executionProgress[client.id].failed_prompts++
      executionProgress[client.id].prompts.push({
        id: prompt.id,
        prompt_text: prompt.prompt_text,
        status: 'failed'
      })
    }

    // Update progress in real-time
    await supabase
      .from('schedule_runs')
      .update({
        execution_progress: executionProgress,
        prompts_completed: Object.values(executionProgress).reduce(
          (sum: number, p: any) => sum + p.completed_prompts, 0
        ),
        current_prompt_id: prompt.id
      })
      .eq('id', runId)

    // Rate limit delay (300ms between prompts)
    await new Promise(r => setTimeout(r, 300))
  }

  executionProgress[client.id].status = 'completed'

  // Post-audit: categorize new citation domains so the verification cron picks them up
  try {
    await categorizeClientCitations(supabase, client)
  } catch (catErr) {
    console.warn(`[Multi-Account Runner] Citation categorization failed for ${client.brand_name} (non-blocking):`, catErr)
  }
}

/**
 * Post-audit: Categorize new citation domains and store in citation_intelligence.
 * Creates rows with verification_status='pending' so the background verification
 * cron job picks them up automatically.
 */
async function categorizeClientCitations(
  supabase: SupabaseClient,
  client: Client
): Promise<void> {
  // 1. Get unique domains from this client's recent audit results
  const { data: recentResults } = await supabase
    .from('audit_results')
    .select('model_results')
    .eq('client_id', client.id)
    .order('created_at', { ascending: false })
    .limit(20)

  if (!recentResults || recentResults.length === 0) return

  const allDomains = new Set<string>()
  for (const result of recentResults) {
    const modelResults = (result as any).model_results || []
    for (const mr of modelResults) {
      for (const citation of (mr.citations || [])) {
        if (citation.domain) allDomains.add(citation.domain)
      }
    }
  }

  if (allDomains.size === 0) return

  // 2. Find which domains already have citation_intelligence rows
  const domainArray = Array.from(allDomains)
  const existingRows: any[] = []
  const IN_BATCH = 50
  for (let b = 0; b < domainArray.length; b += IN_BATCH) {
    const batch = domainArray.slice(b, b + IN_BATCH)
    const { data: rows } = await supabase
      .from('citation_intelligence')
      .select('domain')
      .eq('client_id', client.id)
      .in('domain', batch)
    if (rows) existingRows.push(...rows)
  }

  const existingDomains = new Set(existingRows.map((r: any) => r.domain))
  const newDomains = domainArray.filter(d => !existingDomains.has(d))

  if (newDomains.length === 0) {
    console.log(`[Multi-Account Runner] All ${domainArray.length} domains already categorized for ${client.brand_name}`)
    return
  }

  console.log(`[Multi-Account Runner] Categorizing ${newDomains.length} new domains for ${client.brand_name}`)

  // 3. Call categorize-citations in batches of 40
  const BATCH_SIZE = 40
  const allInsertData: any[] = []

  for (let i = 0; i < newDomains.length; i += BATCH_SIZE) {
    const batch = newDomains.slice(i, i + BATCH_SIZE)

    try {
      const { data, error } = await supabase.functions.invoke('categorize-citations', {
        body: {
          domains: batch,
          brand_name: client.brand_name,
          brand_domain: null,
          competitors: client.competitors || []
        }
      })

      if (error || !data?.success || !data?.data) {
        console.warn(`[Multi-Account Runner] Categorization batch failed:`, error || data?.error)
        continue
      }

      // Build insert data from classification results
      for (const [domain, info] of Object.entries(data.data) as [string, any][]) {
        allInsertData.push({
          client_id: client.id,
          domain: domain,
          url: `https://${domain}`,
          citation_category: info.category || 'other',
          source_type: info.source_type || 'other',
          authority_tier: info.authority_tier || 2,
          relationship_type: info.relationship_type || 'neutral',
          verification_status: 'pending',
        })
      }

      // Rate limit delay between batches
      if (i + BATCH_SIZE < newDomains.length) {
        await new Promise(r => setTimeout(r, 500))
      }
    } catch (err) {
      console.warn(`[Multi-Account Runner] Categorization batch error:`, err)
    }
  }

  // 4. Insert into citation_intelligence
  if (allInsertData.length > 0) {
    const { error: insertError } = await supabase
      .from('citation_intelligence')
      .insert(allInsertData)

    if (insertError) {
      console.error(`[Multi-Account Runner] citation_intelligence insert error:`, insertError)
    } else {
      console.log(`[Multi-Account Runner] Inserted ${allInsertData.length} citation_intelligence rows for ${client.brand_name}`)
    }
  }
}

/**
 * Evaluate conditional rules to determine if schedule should run
 */
async function shouldExecuteSchedule(
  supabase: SupabaseClient,
  schedule: Schedule
): Promise<{ shouldRun: boolean; reason?: string }> {
  if (!schedule.conditional_rules || schedule.conditional_rules.length === 0) {
    return { shouldRun: true }
  }

  for (const rule of schedule.conditional_rules) {
    const result = await evaluateRule(supabase, schedule, rule)
    if (!result.shouldRun) {
      return result // Fail fast if any rule blocks execution
    }
  }

  return { shouldRun: true }
}

/**
 * Evaluate a single conditional rule
 */
async function evaluateRule(
  supabase: SupabaseClient,
  schedule: Schedule,
  rule: ConditionalRule
): Promise<{ shouldRun: boolean; reason?: string }> {
  switch (rule.ruleType) {
    case 'sov_threshold': {
      // Get latest SOV for all selected brands
      const { data: latestResults } = await supabase
        .from('audit_results')
        .select('client_id, summary')
        .in('client_id', schedule.client_ids)
        .order('created_at', { ascending: false })
        .limit(schedule.client_ids.length)

      if (!latestResults || latestResults.length === 0) {
        return { shouldRun: true } // No previous results, allow execution
      }

      const avgSOV = latestResults.reduce((sum, r) =>
        sum + (r.summary?.share_of_voice || 0), 0
      ) / latestResults.length

      const meetsThreshold =
        rule.config.operator === 'less_than'
          ? avgSOV < (rule.config.threshold || 0)
          : avgSOV > (rule.config.threshold || 0)

      return meetsThreshold
        ? { shouldRun: true }
        : { shouldRun: false, reason: `Avg SOV (${avgSOV.toFixed(1)}%) does not meet threshold` }
    }

    case 'last_run_hours':
    case 'skip_if_recent': {
      const { data: lastRun } = await supabase
        .from('schedule_runs')
        .select('completed_at')
        .eq('schedule_id', schedule.id)
        .order('completed_at', { ascending: false })
        .limit(1)
        .single()

      if (!lastRun) return { shouldRun: true }

      const hoursSinceLastRun =
        (Date.now() - new Date(lastRun.completed_at).getTime()) / (1000 * 60 * 60)

      return hoursSinceLastRun >= (rule.config.hours || 24)
        ? { shouldRun: true }
        : { shouldRun: false, reason: `Last run was ${hoursSinceLastRun.toFixed(1)}h ago (minimum: ${rule.config.hours}h)` }
    }

    default:
      return { shouldRun: true }
  }
}

/**
 * Update schedule analytics (upsert daily metrics)
 */
async function updateScheduleAnalytics(
  supabase: SupabaseClient,
  scheduleId: string,
  metrics: {
    totalRuns: number
    successfulRuns: number
    failedRuns: number
    executionTimeSeconds: number
    totalPromptsExecuted: number
    totalCost: number
  }
) {
  const today = new Date().toISOString().split('T')[0]

  try {
    // Fetch existing record for today
    const { data: existing } = await supabase
      .from('schedule_analytics')
      .select('*')
      .eq('schedule_id', scheduleId)
      .eq('date', today)
      .single()

    if (existing) {
      // Update existing record
      const newTotalRuns = existing.total_runs + metrics.totalRuns
      const newAvgExecutionTime = Math.floor(
        (existing.avg_execution_time_seconds * existing.total_runs + metrics.executionTimeSeconds) / newTotalRuns
      )

      await supabase
        .from('schedule_analytics')
        .update({
          total_runs: newTotalRuns,
          successful_runs: existing.successful_runs + metrics.successfulRuns,
          failed_runs: existing.failed_runs + metrics.failedRuns,
          avg_execution_time_seconds: newAvgExecutionTime,
          total_prompts_executed: existing.total_prompts_executed + metrics.totalPromptsExecuted,
          total_cost: existing.total_cost + metrics.totalCost
        })
        .eq('schedule_id', scheduleId)
        .eq('date', today)
    } else {
      // Insert new record
      await supabase
        .from('schedule_analytics')
        .insert({
          schedule_id: scheduleId,
          date: today,
          total_runs: metrics.totalRuns,
          successful_runs: metrics.successfulRuns,
          failed_runs: metrics.failedRuns,
          avg_execution_time_seconds: metrics.executionTimeSeconds,
          total_prompts_executed: metrics.totalPromptsExecuted,
          total_cost: metrics.totalCost
        })
    }
  } catch (error) {
    console.error("[Multi-Account Runner] Failed to update analytics:", error)
    // Don't throw - analytics failure shouldn't stop execution
  }
}
