// @ts-nocheck
import { serve } from "https://deno.land/std@0.177.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const OPENROUTER_API_KEY = Deno.env.get("OPENROUTER_API_KEY") || ""
const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!

// Qwen3 235B A22B — 235B MoE reasoning model with enforced thinking, FREE via OpenRouter
const OPENROUTER_MODEL = "qwen/qwen3-235b-a22b"
const OPENROUTER_API_URL = "https://openrouter.ai/api/v1/chat/completions"

const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

const sleep = (ms) => new Promise(resolve => setTimeout(resolve, ms));

// ============================================================================
// RETRY WITH BACKOFF
// ============================================================================

async function retryWithBackoff(fn, maxRetries = 3) {
    for (let attempt = 0; attempt < maxRetries; attempt++) {
        try {
            return await fn();
        } catch (error) {
            if (error.status === 429 && attempt < maxRetries - 1) {
                let retryAfter = 1000 * Math.pow(2, attempt);
                try {
                    const errorData = JSON.parse(error.message);
                    const match = errorData.error?.message?.match(/try again in ([\d.]+)(ms|s)/);
                    if (match) {
                        retryAfter = match[2] === 's' ? parseFloat(match[1]) * 1000 : parseFloat(match[1]);
                    }
                } catch { }
                console.log(`[Verify] Rate limited, retrying in ${retryAfter}ms (attempt ${attempt + 1}/${maxRetries})`);
                await sleep(retryAfter);
                continue;
            }
            if (error.status === 429) {
                error.isRateLimit = true
            }
            throw error;
        }
    }
}

// ============================================================================
// TEXT PROCESSING
// ============================================================================

// Split page text into meaningful paragraphs
function splitIntoParagraphs(text) {
    return text
        .split(/\n{2,}|\r\n{2,}/)
        .map(p => p.trim().replace(/\s+/g, ' '))
        .filter(p => p.length >= 40)
        .slice(0, 30)
}

// Detect brand name mentions in text (case-insensitive, fuzzy word match)
function detectBrandMention(text, brand) {
    if (!brand || brand === 'brand mention') return { found: false, snippet: null }

    const lowerText = text.toLowerCase()
    const lowerBrand = brand.toLowerCase().trim()

    // Check exact brand name match
    const exactIdx = lowerText.indexOf(lowerBrand)
    if (exactIdx !== -1) {
        const start = Math.max(0, exactIdx - 80)
        const end = Math.min(text.length, exactIdx + lowerBrand.length + 120)
        return { found: true, snippet: text.substring(start, end).trim() }
    }

    // Check if majority of brand words appear (handles "Apollo Hospitals" ↔ "Apollo Hospital")
    const brandWords = lowerBrand.split(/\s+/).filter(w => w.length > 2)
    if (brandWords.length > 1) {
        const matchedWords = brandWords.filter(w => lowerText.includes(w))
        if (matchedWords.length >= Math.ceil(brandWords.length * 0.6)) {
            const firstIdx = lowerText.indexOf(matchedWords[0])
            if (firstIdx !== -1) {
                const start = Math.max(0, firstIdx - 80)
                const end = Math.min(text.length, firstIdx + 200)
                return { found: true, snippet: text.substring(start, end).trim() }
            }
        }
    }

    return { found: false, snippet: null }
}

// Select the most relevant paragraphs for the model (keyword pre-filter)
function selectBestParagraphs(paragraphs, brand, maxCount = 5) {
    const brandLower = brand.toLowerCase()
    const brandWords = brandLower.split(/\s+/).filter(w => w.length > 2)

    const scored = paragraphs.map(p => {
        const lower = p.toLowerCase()
        let score = 0
        if (lower.includes(brandLower)) score += 10
        for (const word of brandWords) {
            if (lower.includes(word)) score += 3
        }
        score += Math.min(5, p.length / 100) // prefer longer paragraphs
        return { paragraph: p, score }
    })

    scored.sort((a, b) => b.score - a.score)
    return scored.slice(0, maxCount).map(s => s.paragraph)
}

// ============================================================================
// STEPFUN STEP 3.5 FLASH — Citation Verification via OpenRouter (FREE)
// ============================================================================

async function verifyCitationWithModel(claim, pageText, entityCheck) {
    // Select best paragraphs instead of raw text dump
    const paragraphs = splitIntoParagraphs(pageText)
    const bestParagraphs = selectBestParagraphs(paragraphs, claim.brand, 5)
    const focusedText = bestParagraphs.length > 0
        ? bestParagraphs.join('\n\n')
        : pageText.substring(0, 3000)

    const res = await fetch(OPENROUTER_API_URL, {
        method: "POST",
        headers: {
            "Content-Type": "application/json",
            "Authorization": `Bearer ${OPENROUTER_API_KEY}`,
            "HTTP-Referer": "https://forzeo.com",
            "X-Title": "Forzeo Citation Verifier",
        },
        body: JSON.stringify({
            model: OPENROUTER_MODEL,
            messages: [
                {
                    role: "system",
                    content: `You are a citation verification engine for an AI visibility auditing platform.

TASK: An AI model (ChatGPT/Gemini/Perplexity) was asked questions about a brand. It returned citations (URLs) in its response. You must verify whether each citation is legitimate by analyzing the fetched page content.

BRAND BEING AUDITED: "${claim.brand}"
CITATION DOMAIN: ${claim.domain || 'unknown'}
CITATION CATEGORY: ${claim.category || 'unknown'}
BRAND DETECTED ON PAGE: ${entityCheck.found ? 'YES — "' + (entityCheck.snippet || '').substring(0, 150) + '"' : 'NO'}

ANALYSIS STEPS:
1. Is this page REAL with substantive content? (not an error page, login wall, cookie notice, or empty)
2. Is the content topically relevant to the brand's industry/niche?
3. Does the page specifically mention or reference the brand "${claim.brand}"?

SCORING RULES (score = how legitimate is this citation):
- 0.80-1.0 → Page is REAL, has substantive content, AND is clearly relevant to the brand's industry/niche. Brand mention is a bonus, not required.
- 0.50-0.79 → Page is REAL with some content but relevance to the brand's industry is weak or tangential
- 0.20-0.49 → Page exists but content is thin, mostly unrelated, or behind a paywall/login
- 0.0-0.19 → Error page, empty page, completely unrelated to anything in the brand's industry

WHAT MAKES A CITATION VALID (score 0.80+):
- A competitor's website IS a valid citation — it proves the AI knows the industry
- A review site, news article, or blog about the same topic IS valid
- Wikipedia, educational, and reference pages about the topic ARE valid
- E-commerce sites listing products in the same category ARE valid
- Industry directories, comparison sites, forums about the topic ARE valid
- The page does NOT need to mention the brand "${claim.brand}" to be a valid citation

WHAT MAKES A CITATION INVALID (score < 0.30):
- Error pages (404, 403, access denied)
- Pages with no substantive content (login walls, cookie notices, empty)
- Pages completely unrelated to the brand's industry (e.g., a cooking blog cited for a SaaS tool)

Set entity_match:true ONLY if the brand name "${claim.brand}" literally appears on the page.

Respond with ONLY valid JSON (no markdown, no explanation):
{"score": 0.0-1.0, "entity_match": true|false, "matched_text": "most relevant 200-char excerpt or null", "reasoning": "one sentence why"}`
                },
                {
                    role: "user",
                    content: `PAGE CONTENT:\n${focusedText.substring(0, 4000)}`
                }
            ],
            temperature: 0.0,
            max_tokens: 2000, // Qwen3 thinking tokens + JSON response
        })
    })

    if (!res.ok) {
        const errorText = await res.text()
        const error = new Error(errorText)
        error.status = res.status
        throw error
    }

    const data = await res.json()
    const content = data.choices?.[0]?.message?.content

    if (!content) {
        throw new Error('Empty model response')
    }

    // Parse JSON — strip <think>...</think> reasoning tags and markdown fences
    let cleaned = content
    // Remove Qwen3 thinking tags (enforced reasoning mode)
    cleaned = cleaned.replace(/<think>[\s\S]*?<\/think>/g, '').trim()
    // Remove markdown fences
    cleaned = cleaned.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim()

    // Robust JSON extraction — find JSON object even if surrounded by text
    let result
    try {
        result = JSON.parse(cleaned)
    } catch {
        // Try to extract JSON from the response
        const jsonMatch = cleaned.match(/\{[\s\S]*"score"[\s\S]*\}/)
        if (jsonMatch) {
            try {
                result = JSON.parse(jsonMatch[0])
            } catch {
                console.error(`[Verify] Failed to parse model response: ${cleaned.substring(0, 300)}`)
                // Fallback: use entity detection as the sole signal
                return {
                    score: entityCheck.found ? 0.85 : 0.40,
                    matched_text: entityCheck.snippet || null,
                    entity_match: entityCheck.found,
                    reasoning: 'Model response parse failed — used entity detection fallback'
                }
            }
        } else {
            console.error(`[Verify] No JSON in model response: ${cleaned.substring(0, 300)}`)
            return {
                score: entityCheck.found ? 0.85 : 0.40,
                matched_text: entityCheck.snippet || null,
                entity_match: entityCheck.found,
                reasoning: 'Model response parse failed — used entity detection fallback'
            }
        }
    }

    // Validate the parsed result has required fields
    if (typeof result.score !== 'number' || result.score < 0 || result.score > 1) {
        result.score = entityCheck.found ? 0.85 : 0.40
    }
    if (typeof result.entity_match !== 'boolean') {
        result.entity_match = entityCheck.found
    }

    // Safety net: if our entity detection found the brand but model missed it, override entity_match
    if (entityCheck.found && !result.entity_match) {
        console.log(`[Verify] Entity detection override: brand found on page but model missed it`)
        result.entity_match = true
        result.score = Math.max(result.score, 0.80) // Brand on page = at minimum a valid citation
        result.matched_text = result.matched_text || entityCheck.snippet
    }

    // Safety net: if brand is literally on the page, it's always a valid citation
    if (entityCheck.found && result.score < 0.80) {
        result.score = 0.80
    }

    return result
}

// ============================================================================
// MAIN SIMILARITY CHECK — Waterfall: Quick checks → Entity → Reasoning Model
// ============================================================================

async function checkSimilarity(claim, pageText) {
    // Step 0: Content quality pre-check (free, instant — skip model call if clearly junk)
    const trimmed = pageText.trim()
    if (trimmed.length < 100) {
        console.log(`[Verify] Page content too short (${trimmed.length} chars) — likely empty/error`)
        return { score: 0.10, matched_text: null, entity_match: false }
    }

    // Detect common error/block pages
    const lowerText = trimmed.toLowerCase().substring(0, 500)
    const junkPatterns = [
        'access denied', 'page not found', '404 not found', '403 forbidden',
        'please enable javascript', 'enable cookies', 'captcha', 'are you a robot',
        'this site requires javascript', 'browser not supported'
    ]
    const isJunk = junkPatterns.some(p => lowerText.includes(p)) && trimmed.length < 500
    if (isJunk) {
        console.log(`[Verify] Detected error/block page — skipping model call`)
        return { score: 0.15, matched_text: null, entity_match: false }
    }

    // Step 1: Free entity detection (instant, no API)
    const entityCheck = detectBrandMention(pageText, claim.brand)
    console.log(`[Verify] Entity detection for "${claim.brand}": ${entityCheck.found ? 'FOUND' : 'not found'}`)

    // Step 2: Qwen3 235B reasoning model via OpenRouter (free)
    const result = await verifyCitationWithModel(claim, pageText, entityCheck)

    console.log(`[Verify] Model result: score=${result.score}, entity=${result.entity_match}, reason="${result.reasoning || ''}"`)

    return {
        score: Math.min(1.0, Math.max(0, result.score)),
        matched_text: result.matched_text || entityCheck.snippet || null,
        entity_match: result.entity_match || entityCheck.found
    }
}

// ============================================================================
// PROCESS A SINGLE CITATION
// ============================================================================

async function processCitation(citation, claim, supabase) {
    // Normalize claim to structured object
    const claimObj = typeof claim === 'string'
        ? { brand: claim, domain: citation.url ? new URL(citation.url).hostname.replace('www.', '') : undefined }
        : claim
    const { url, citation_id } = citation

    if (!url) {
        console.warn(`[Verify] Skipping citation: missing URL`)
        return null
    }

    console.log(`[Verify] Processing: ${url}`)

    // CACHING — skip if verified in last 24 hours
    const { data: existing } = await supabase
        .from('citation_intelligence')
        .select('id, verification_status, verified_at, similarity_score')
        .eq('url', url)
        .limit(1)
        .maybeSingle()

    if (existing?.verified_at) {
        const age = Date.now() - new Date(existing.verified_at).getTime()
        const hours = age / (1000 * 60 * 60)
        if (hours < 24 && existing.verification_status !== 'pending') {
            console.log(`[Verify] Cache hit for ${url} (verified ${Math.round(hours)}h ago)`)
            return {
                citation_id,
                url,
                status: existing.verification_status,
                score: existing.similarity_score,
                cached: true
            }
        }
    }

    // Step 1: Fetch page content with Jina Reader
    console.log(`[Verify] Fetching content from ${url}`)
    const jinaUrl = `https://r.jina.ai/${encodeURIComponent(url)}`
    let pageContent = null
    let pageStatus = 0

    try {
        const jinaRes = await fetch(jinaUrl, {
            headers: {
                'Accept': 'text/plain',
                'X-Return-Format': 'text'
            },
            signal: AbortSignal.timeout(15000)
        })
        pageStatus = jinaRes.status

        if (jinaRes.ok) {
            pageContent = await jinaRes.text()
        }
    } catch (e) {
        console.warn(`[Verify] Jina Reader failed for ${url}:`, e.message)
    }

    // No content → 404 = hallucinated, else error (retry next run)
    if (!pageContent || pageContent.trim().length === 0) {
        console.warn(`[Verify] No content fetched for ${url} (status: ${pageStatus})`)

        const updateData = {
            verification_status: pageStatus === 404 ? 'hallucinated' : 'error',
            page_fetch_status: pageStatus,
            verified_at: new Date().toISOString()
        }

        if (existing?.id) {
            await supabase.from('citation_intelligence').update(updateData).eq('id', existing.id)
        } else {
            await supabase.from('citation_intelligence').update(updateData).eq('url', url)
        }

        return {
            citation_id,
            url,
            status: updateData.verification_status,
            fetch_status: pageStatus
        }
    }

    // Step 2: Verify with entity detection + StepFun reasoning model
    console.log(`[Verify] Verifying ${url} for brand "${claimObj.brand}"`)

    const similarity = await retryWithBackoff(async () => {
        return await checkSimilarity(claimObj, pageContent)
    }, 3)

    // Step 3: Determine verification status from score
    // Citation validity = is this a real, relevant page? (NOT "does it mention the brand?")
    let verificationStatus
    if (similarity.score >= 0.50) {
        verificationStatus = 'verified'
    } else if (similarity.score >= 0.25) {
        verificationStatus = 'partially_verified'
    } else {
        verificationStatus = 'hallucinated'
    }

    // Step 4: Store result
    const updateData = {
        verification_status: verificationStatus,
        similarity_score: similarity.score,
        matched_paragraph: similarity.matched_text,
        page_fetch_status: pageStatus,
        page_content: pageContent.substring(0, 5000),
        verified_at: new Date().toISOString()
    }

    if (existing?.id) {
        await supabase.from('citation_intelligence').update(updateData).eq('id', existing.id)
    } else {
        await supabase.from('citation_intelligence').update(updateData).eq('url', url)
    }

    console.log(`[Verify] ${url} -> ${verificationStatus} (${similarity.score.toFixed(2)})`)

    return {
        citation_id,
        url,
        status: verificationStatus,
        score: similarity.score,
        entity_match: similarity.entity_match,
        matched_text: similarity.matched_text,
        fetch_status: pageStatus
    }
}

// ============================================================================
// CONCURRENCY LIMITER
// ============================================================================

async function runWithConcurrency(tasks, limit) {
    const results = []
    let index = 0

    async function runNext() {
        while (index < tasks.length) {
            const currentIndex = index++
            results[currentIndex] = await tasks[currentIndex]()
        }
    }

    const workers = Array.from({ length: Math.min(limit, tasks.length) }, () => runNext())
    await Promise.all(workers)
    return results
}

// ============================================================================
// BATCH MODE — cron-triggered background verification
// ============================================================================

async function handleBatchVerification(params) {
    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY)
    const BATCH_LIMIT = Math.min(params.limit || 20, 30)
    const CONCURRENCY = 3 // StepFun via OpenRouter handles concurrency well

    console.log(`[Verify-Batch] Starting (limit: ${BATCH_LIMIT}, model: ${OPENROUTER_MODEL}, source: ${params.source || 'unknown'})`)

    const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString()

    const { data: pendingCitations, error: queryError } = await supabase
        .from('citation_intelligence')
        .select('id, url, domain, client_id, citation_category')
        .or(`verification_status.eq.pending,verification_status.is.null,and(verified_at.lt.${sevenDaysAgo},verification_status.neq.error)`)
        .order('created_at', { ascending: true })
        .limit(BATCH_LIMIT)

    if (queryError) {
        console.error('[Verify-Batch] Query error:', queryError)
        return new Response(
            JSON.stringify({ success: false, error: queryError.message }),
            { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        )
    }

    if (!pendingCitations || pendingCitations.length === 0) {
        console.log('[Verify-Batch] No pending citations found')
        return new Response(
            JSON.stringify({ success: true, mode: 'batch', processed: 0, message: 'No pending citations' }),
            { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        )
    }

    console.log(`[Verify-Batch] Found ${pendingCitations.length} citations to verify`)

    // Look up brand names
    const clientIds = [...new Set(pendingCitations.map(c => c.client_id).filter(Boolean))]
    const clientMap = new Map()

    if (clientIds.length > 0) {
        const { data: clients } = await supabase
            .from('clients')
            .select('id, brand_name')
            .in('id', clientIds)

        if (clients) {
            for (const c of clients) clientMap.set(c.id, c.brand_name)
        }
    }

    // Process each citation
    const tasks = pendingCitations.map((citation) => async () => {
        const claimContext = {
            brand: clientMap.get(citation.client_id) || 'brand mention',
            category: citation.citation_category || undefined,
            domain: citation.domain || undefined
        }
        try {
            return await processCitation(
                { url: citation.url, citation_id: citation.id },
                claimContext,
                supabase
            )
        } catch (error) {
            console.error(`[Verify-Batch] Error: ${citation.url}:`, error)
            if (error.isRateLimit) {
                console.log(`[Verify-Batch] Rate limited for ${citation.url} — keeping as pending`)
                return { url: citation.url, status: 'rate_limited', error: 'Will retry next run' }
            }
            try {
                await supabase.from('citation_intelligence')
                    .update({ verification_status: 'error', verified_at: new Date().toISOString() })
                    .eq('id', citation.id)
            } catch { }
            return { url: citation.url, status: 'error', error: error?.message }
        }
    })

    const results = (await runWithConcurrency(tasks, CONCURRENCY)).filter(Boolean)

    const stats = {
        verified: results.filter(r => r.status === 'verified').length,
        partial: results.filter(r => r.status === 'partially_verified').length,
        hallucinated: results.filter(r => r.status === 'hallucinated').length,
        error: results.filter(r => r.status === 'error').length,
        cached: results.filter(r => r.cached).length,
    }

    console.log(`[Verify-Batch] Done: ${results.length} processed — ${stats.verified} verified, ${stats.partial} partial, ${stats.hallucinated} hallucinated, ${stats.error} errors, ${stats.cached} cached`)

    return new Response(
        JSON.stringify({ success: true, mode: 'batch', processed: results.length, stats, results }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
}

// ============================================================================
// HTTP HANDLER
// ============================================================================

serve(async (req) => {
    if (req.method === 'OPTIONS') {
        return new Response('ok', { headers: corsHeaders })
    }

    try {
        const body = await req.json()

        // Batch mode: auto-process pending citations from DB
        if (body.mode === 'batch') {
            return await handleBatchVerification(body)
        }

        // Direct mode: verify specific citations with a claim
        const { citations, claim } = body

        if (!Array.isArray(citations) || !claim) {
            return new Response(
                JSON.stringify({ error: 'Invalid request: citations array and claim required, or use mode:"batch"' }),
                { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
            )
        }

        const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY)
        console.log(`[Verify] Processing ${citations.length} citations for claim: "${claim}"`)

        const CONCURRENCY = 3
        const tasks = citations.map(citation => async () => {
            try {
                return await processCitation(citation, claim, supabase)
            } catch (error) {
                console.error(`[Verify] Error: ${citation.url}:`, error)
                if (error.isRateLimit) {
                    return { citation_id: citation.citation_id, url: citation.url, status: 'rate_limited', error: 'Will retry' }
                }
                try {
                    await supabase
                        .from('citation_intelligence')
                        .update({ verification_status: 'error', verified_at: new Date().toISOString() })
                        .eq('url', citation.url)
                } catch { }
                return { citation_id: citation.citation_id, url: citation.url, status: 'error', error: error.message }
            }
        })

        const results = (await runWithConcurrency(tasks, CONCURRENCY)).filter(Boolean)

        return new Response(
            JSON.stringify({ success: true, results }),
            { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        )

    } catch (error) {
        console.error('[Verify] Fatal error:', error)
        return new Response(
            JSON.stringify({ error: error.message }),
            { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        )
    }
})
