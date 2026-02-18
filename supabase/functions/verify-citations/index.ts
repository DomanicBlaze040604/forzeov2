import { serve } from "https://deno.land/std@0.177.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const GROQ_API_KEY = Deno.env.get("GROQ_API_KEY")!
const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!

const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

// Helper function to sleep
const sleep = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

// Retry wrapper with exponential backoff for rate limits
async function retryWithBackoff(fn: () => Promise<any>, maxRetries = 3) {
    for (let attempt = 0; attempt < maxRetries; attempt++) {
        try {
            return await fn();
        } catch (error) {
            if (error.status === 429 && attempt < maxRetries - 1) {
                // Extract retry delay from error message or use exponential backoff
                let retryAfter = 1000 * Math.pow(2, attempt); // 1s, 2s, 4s

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
            throw error;
        }
    }
}

// Semantic similarity checker using LLM for now (TODO: Replace with local embeddings)
async function checkSimilarity(claim: string, pageText: string): Promise<{ score: number; matched_text: string | null; entity_match: boolean }> {
    const groqRes = await fetch("https://api.groq.com/openai/v1/chat/completions", {
        method: "POST",
        headers: {
            "Content-Type": "application/json",
            "Authorization": `Bearer ${GROQ_API_KEY}`,
        },
        body: JSON.stringify({
            model: "llama-3.1-8b-instant",
            messages: [
                {
                    role: "system",
                    content: `You are a semantic similarity engine for citation verification.

Given a CLAIM and PAGE TEXT, calculate:
1. Similarity score (0.0 to 1.0) - how semantically similar is the content?
2. Entity match (true/false) - does the page mention the same entities as the claim?
3. Matched text - the most relevant excerpt (max 200 chars)

Thresholds:
- >0.85 + entity match = VERIFIED
- 0.50-0.84 = PARTIALLY VERIFIED
- <0.50 or no entity match = HALLUCINATED

Respond ONLY with JSON:
{
  "score": 0.0-1.0,
  "entity_match": true|false,
  "matched_text": "excerpt" | null
}`
                },
                {
                    role: "user",
                    content: `CLAIM: "${claim}"\n\nPAGE TEXT:\n${pageText.substring(0, 2000)}`
                }
            ],
            temperature: 0.1,
            max_tokens: 200
        })
    })

    if (!groqRes.ok) {
        const errorText = await groqRes.text()
        const error = new Error(errorText)
        error.status = groqRes.status
        throw error
    }

    const groqData = await groqRes.json()
    const llmResponse = groqData.choices?.[0]?.message?.content

    if (!llmResponse) {
        throw new Error('Empty LLM response')
    }

    return JSON.parse(llmResponse)
}

serve(async (req) => {
    if (req.method === 'OPTIONS') {
        return new Response('ok', { headers: corsHeaders })
    }

    try {
        const { citations, claim } = await req.json()

        if (!Array.isArray(citations) || !claim) {
            return new Response(
                JSON.stringify({ error: 'Invalid request: citations array and claim required' }),
                { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
            )
        }

        const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY)
        const results = []

        console.log(`[Verify] Processing ${citations.length} citations for claim: "${claim}"`)

        for (const citation of citations) {
            try {
                const { url, citation_id } = citation

                if (!url) {
                    console.warn(`[Verify] Skipping citation ${citation_id}: missing URL`)
                    continue
                }

                console.log(`[Verify] Processing: ${url}`)

                // Check if already verified in last 24 hours (CACHING)
                const { data: existing } = await supabase
                    .from('citation_intelligence')
                    .select('verification_status, verified_at, similarity_score')
                    .eq('id', citation_id)
                    .single()

                if (existing?.verified_at) {
                    const age = Date.now() - new Date(existing.verified_at).getTime()
                    const hours = age / (1000 * 60 * 60)
                    if (hours < 24 && existing.verification_status !== 'pending') {
                        console.log(`[Verify] Cache hit for ${url} (verified ${Math.round(hours)}h ago)`)
                        results.push({
                            citation_id,
                            url,
                            status: existing.verification_status,
                            score: existing.similarity_score,
                            cached: true
                        })
                        continue
                    }
                }

                // Step 1: Fetch page content with Jina Reader (Primary)
                console.log(`[Verify] Fetching content from ${url}`)
                const jinaUrl = `https://r.jina.ai/${encodeURIComponent(url)}`
                let pageContent = null
                let pageStatus = 0

                try {
                    const jinaRes = await fetch(jinaUrl, {
                        headers: {
                            'Accept': 'text/plain',
                            'X-Return-Format': 'text'
                        }
                    })
                    pageStatus = jinaRes.status

                    if (jinaRes.ok) {
                        pageContent = await jinaRes.text()
                    }
                } catch (e) {
                    console.warn(`[Verify] Jina Reader failed for ${url}:`, e.message)
                }

                // Fallback: Trafilatura (TODO: Implement if Jina fails)
                // For now, if Jina fails, mark as error

                if (!pageContent || pageContent.trim().length === 0) {
                    console.warn(`[Verify] No content fetched for ${url}`)
                    await supabase
                        .from('citation_intelligence')
                        .update({
                            verification_status: pageStatus === 404 ? 'hallucinated' : 'error',
                            page_fetch_status: pageStatus,
                            verified_at: new Date().toISOString()
                        })
                        .eq('id', citation_id)

                    results.push({
                        citation_id,
                        url,
                        status: pageStatus === 404 ? 'hallucinated' : 'error',
                        fetch_status: pageStatus
                    })
                    continue
                }

                // Step 2: Semantic Similarity Check with retry logic
                console.log(`[Verify] Checking semantic similarity for ${url}`)

                const similarity = await retryWithBackoff(async () => {
                    return await checkSimilarity(claim, pageContent)
                }, 3)

                // Step 3: Determine verification status based on thresholds
                let verificationStatus: string
                if (similarity.score > 0.85 && similarity.entity_match) {
                    verificationStatus = 'verified'
                } else if (similarity.score >= 0.50 && similarity.score <= 0.84) {
                    verificationStatus = 'partially_verified'
                } else {
                    verificationStatus = 'hallucinated'
                }

                // Step 4: Store verification result
                await supabase
                    .from('citation_intelligence')
                    .update({
                        verification_status: verificationStatus,
                        similarity_score: similarity.score,
                        matched_paragraph: similarity.matched_text,
                        page_fetch_status: pageStatus,
                        page_content: pageContent.substring(0, 5000), // Store first 5000 chars for preview
                        verified_at: new Date().toISOString()
                    })
                    .eq('id', citation_id)

                console.log(`[Verify] ✅ ${url} -> ${verificationStatus} (${similarity.score.toFixed(2)})`)

                results.push({
                    citation_id,
                    url,
                    status: verificationStatus,
                    score: similarity.score,
                    entity_match: similarity.entity_match,
                    matched_text: similarity.matched_text,
                    fetch_status: pageStatus
                })

                // Small delay between citations to avoid rate limits
                await sleep(100)

            } catch (error) {
                console.error(`[Verify] Error processing citation ${citation.citation_id}:`, error)

                // Store error in database
                try {
                    await supabase
                        .from('citation_intelligence')
                        .update({
                            verification_status: 'error',
                            verified_at: new Date().toISOString()
                        })
                        .eq('id', citation.citation_id)
                } catch { }

                results.push({
                    citation_id: citation.citation_id,
                    url: citation.url,
                    status: 'error',
                    error: error.message
                })
            }
        }

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
