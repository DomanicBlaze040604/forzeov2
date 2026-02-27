// @ts-nocheck
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

// OpenRouter API
const OPENROUTER_API_KEY = Deno.env.get("OPENROUTER_API_KEY") || "";
const OPENROUTER_API_URL = "https://openrouter.ai/api/v1/chat/completions";
const OPENROUTER_MODEL = "nvidia/nemotron-3-nano-30b-a3b:free"; // Truly free, fast classification

serve(async (req) => {
    if (req.method === "OPTIONS") {
        return new Response("ok", { headers: corsHeaders });
    }

    try {
        const { domains, brand_name, brand_domain, competitors } = await req.json();

        if (!domains || !Array.isArray(domains) || domains.length === 0) {
            throw new Error("No domains provided");
        }

        if (!OPENROUTER_API_KEY) {
            throw new Error("OPENROUTER_API_KEY is not set.");
        }

        // Batch up to 40 domains per call
        const batch = domains.slice(0, 40);

        // Build brand matching hint
        const brandDomain = brand_domain || `${(brand_name || "").toLowerCase().replace(/[^a-z0-9]/g, "")}.com`;
        const competitorList = (competitors || []).join(", ");

        const systemPrompt = `You are a domain classifier. Classify each domain into EXACTLY ONE category.

CATEGORIES (use these exact lowercase strings):
- "owned" — Brand's own domain or subdomain
- "competitor" — A competitor's domain
- "social" — Social media (Facebook, YouTube, Twitter/X, LinkedIn, Instagram, Pinterest, TikTok, Snapchat)
- "ugc" — Forums, Q&A, community (Reddit, Quora, StackOverflow, TeamBHP, community forums)
- "review" — Review/comparison/buyer guide sites (G2, Trustpilot, Capterra, CarDekho, CNET, PCMag, WireCutter, ConsumerReports, TopGear, Zigwheels, 91mobiles, CarAndDriver, MotorTrend)
- "ecommerce" — Marketplaces, online stores, listings (Amazon, Flipkart, eBay, Walmart, Meesho, Myntra, BigBasket, Blinkit, Spinny, Cars24, CarWale, OLX, AutoTrader, Swiggy, Zomato)
- "editorial" — News, magazines, blogs, publishers (NYT, BBC, Forbes, TechCrunch, Medium, HuffPost, NDTV, IndiaToday, TheHindu, TimesOfIndia, MoneyControl)
- "reference" — Wikipedia, .gov, .edu, encyclopedias, docs, academic
- "institutional" — Government bodies, regulatory, industry orgs
- "other" — ONLY if truly none of the above fit

HARD RULES (override everything else):
- "${brandDomain}" or any subdomain of it → ALWAYS "owned"
- www.facebook.com, www.instagram.com, www.youtube.com, twitter.com, x.com, www.linkedin.com, www.pinterest.com, www.tiktok.com → ALWAYS "social"
- www.reddit.com, www.quora.com → ALWAYS "ugc"
- en.wikipedia.org, *.wikipedia.org → ALWAYS "reference"
- www.amazon.com, www.amazon.in, www.flipkart.com → ALWAYS "ecommerce"
${competitorList ? `- If domain contains or matches any competitor name from [${competitorList}] → "competitor"` : ""}

Brand: ${brand_name || "Unknown"}
Brand domain: ${brandDomain}
Competitors: ${competitorList || "none specified"}

Return ONLY a JSON object. No markdown, no explanation.
Format: { "domain.com": { "category": "...", "source_type": "...", "authority_tier": 1|2|3, "relationship_type": "owned|competitor|neutral" } }`;

        const userPrompt = `Classify these ${batch.length} domains:\n${batch.join("\n")}`;

        const response = await fetch(OPENROUTER_API_URL, {
            method: "POST",
            headers: {
                "Authorization": `Bearer ${OPENROUTER_API_KEY}`,
                "Content-Type": "application/json",
                "HTTP-Referer": "https://forzeo.com",
                "X-Title": "Forzeo Citation Classifier",
            },
            body: JSON.stringify({
                model: OPENROUTER_MODEL,
                messages: [
                    { role: "system", content: systemPrompt },
                    { role: "user", content: userPrompt }
                ],
                temperature: 0.0,
                response_format: { type: "json_object" },
                max_tokens: 8000,
            })
        });

        if (!response.ok) {
            const errorText = await response.text();
            console.error("OpenRouter Error:", errorText);
            throw new Error(`OpenRouter API error ${response.status}: ${errorText.substring(0, 200)}`);
        }

        const data = await response.json();
        const content = data.choices?.[0]?.message?.content || "{}";

        let result;
        // Strip thinking tags + markdown fences before parsing
        let cleaned = content
            .replace(/<think>[\s\S]*?<\/think>/g, "")
            .replace(/```json\n?|\n?```/g, "")
            .trim();
        try {
            result = JSON.parse(cleaned);
        } catch {
            // Truncated JSON — salvage by closing the object
            // Find last complete entry (ends with }) and close the outer object
            const lastComplete = cleaned.lastIndexOf("}");
            if (lastComplete > 0) {
                let truncated = cleaned.substring(0, lastComplete + 1);
                // Count braces to determine nesting
                const opens = (truncated.match(/\{/g) || []).length;
                const closes = (truncated.match(/\}/g) || []).length;
                // Add missing closing braces
                for (let i = 0; i < opens - closes; i++) {
                    truncated += "}";
                }
                console.warn(`[Categorize] Salvaged truncated JSON (${Object.keys(JSON.parse(truncated)).length} domains recovered)`);
                result = JSON.parse(truncated);
            } else {
                throw new Error("Failed to parse model response as JSON");
            }
        }

        // Post-process: enforce hard rules that AI might miss
        const brandDomainLower = brandDomain.toLowerCase();
        const competitorNames = (competitors || []).map((c: string) => c.toLowerCase().replace(/[^a-z0-9]/g, ""));

        for (const [domain, info] of Object.entries(result)) {
            const d = domain.toLowerCase();
            const val = info as any;

            // Force owned
            if (d === brandDomainLower || d === `www.${brandDomainLower}` || d.endsWith(`.${brandDomainLower}`)) {
                val.category = "owned";
                val.relationship_type = "owned";
            }
            // Force social
            else if (/^(www\.)?(facebook|youtube|twitter|x|linkedin|instagram|pinterest|tiktok|snapchat)\.(com|co)$/i.test(d)) {
                val.category = "social";
                val.relationship_type = "neutral";
            }
            // Force ugc
            else if (/^(www\.)?(reddit|quora|stackexchange|stackoverflow)\.(com|co)$/i.test(d)) {
                val.category = "ugc";
                val.relationship_type = "neutral";
            }
            // Force reference
            else if (/wikipedia\.org$/i.test(d)) {
                val.category = "reference";
                val.relationship_type = "neutral";
            }
            // Force competitor
            else if (competitorNames.some(comp => d.includes(comp) && comp.length > 2)) {
                val.category = "competitor";
                val.relationship_type = "competitor";
            }
        }

        console.log(`[Categorize] Classified ${Object.keys(result).length} domains`);

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
