// @ts-nocheck
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const GROQ_API_KEY = Deno.env.get("GROQ_API_KEY") || "";
const GROQ_API_URL = "https://api.groq.com/openai/v1/chat/completions";

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

                console.log(`[Categorize] Rate limited, retrying in ${retryAfter}ms (attempt ${attempt + 1}/${maxRetries})`);
                await sleep(retryAfter);
                continue;
            }
            throw error;
        }
    }
}

serve(async (req) => {
    // Handle CORS
    if (req.method === "OPTIONS") {
        return new Response("ok", { headers: corsHeaders });
    }

    try {
        const { domains, brand_name, competitors } = await req.json();

        if (!domains || !Array.isArray(domains) || domains.length === 0) {
            throw new Error("No domains provided");
        }

        if (!GROQ_API_KEY) {
            throw new Error("GROQ_API_KEY is not set");
        }

        // Reduce batch size to stay well under 6000 TPM limit on free tier
        const batch = domains.slice(0, 15);

        const systemPrompt = `You are an expert SEO citation classifier. Classify domains using the EXACT categories defined below.

PRIMARY CATEGORIES (Choose ONE per domain):
- owned: Client's own domains
- competitor: Direct competitors
- editorial: News sites, magazines, publishers (NYT, BBC, TechCrunch)
- blogs: Independent blogs, personal sites
- review_sites: Review platforms (G2, Trustpilot, Capterra)
- comparison_sites: Comparison engines (vs, alternative to)
- marketplaces: eCommerce, app stores, directories
- directories: Business listings, link directories
- social: Social media platforms (Twitter, LinkedIn, Facebook)
- ugc: Forums, Reddit, Quora, community content
- reference_authority: Wikipedia, gov, edu, documentation
- other: Everything else

SOURCE SUBTYPE (Optional):
tech_blog, fitness_blog, forum_thread, press_release, news_article, product_review, etc.

INTENT TAGS (Multiple allowed):
pricing, alternatives, comparison, best_of, recommendation, how_to, tutorial, news, research

TRUST & AUTHORITY TAGS (Multiple allowed):
high_authority (Gov, Edu, Wikipedia, Major News)
low_authority (Unknown, new sites)
ugc_unverified (User-generated without moderation)
expert_review (Professional reviewers)
sponsored (Paid/promoted content)
affiliate (Affiliate links/reviews)

CLASSIFICATION RULES (Apply in order):
1. IF domain matches "${brand_name}" → owned
2. ELSE IF domain in [${(competitors || []).join(", ")}] → competitor
3. ELSE IF social platform → social
4. ELSE IF forum/Q&A → ugc
5. ELSE IF comparison keywords ("vs", "alternative") → comparison_sites
6. ELSE IF blog → blogs
7. ELSE IF review platform → review_sites
8. ELSE IF marketplace/directory → marketplaces or directories
9. ELSE IF encyclopedic (wiki, gov, edu) → reference_authority
10. ELSE IF publisher/news → editorial
11. ELSE → other

Return ONLY valid JSON:
{
  "domain.com": {
    "category": "<primary_category>",
    "source_type": "<subtype>",
    "authority_tier": 1|2|3,
    "relationship_type": "owned|competitor|neutral",
    "intent_tags": ["tag1", "tag2"],
    "trust_tags": ["tag1", "tag2"]
  }
}`;

        const userPrompt = `Classify these domains:
${batch.join("\n")}

Context:
Brand: ${brand_name || "Unknown"}
Competitors: ${(competitors || []).join(", ")}`;

        const data = await retryWithBackoff(async () => {
            const response = await fetch(GROQ_API_URL, {
                method: "POST",
                headers: {
                    "Authorization": `Bearer ${GROQ_API_KEY}`,
                    "Content-Type": "application/json",
                },
                body: JSON.stringify({
                    model: "llama-3.1-8b-instant",
                    messages: [
                        { role: "system", content: systemPrompt },
                        { role: "user", content: userPrompt }
                    ],
                    temperature: 0.1,
                    response_format: { type: "json_object" }
                })
            });

            if (!response.ok) {
                const errorText = await response.text();
                console.error("Groq Error:", errorText);
                const error = new Error(errorText);
                error.status = response.status;
                throw error;
            }

            return await response.json();
        });

        const result = JSON.parse(data.choices[0].message.content);

        return new Response(JSON.stringify({ success: true, data: result }), {
            headers: { ...corsHeaders, "Content-Type": "application/json" },
        });

    } catch (error) {
        console.error("Error:", error);
        return new Response(JSON.stringify({ success: false, error: error.message }), {
            status: 500,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
    }
});
