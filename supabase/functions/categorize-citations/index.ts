// @ts-nocheck
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const GROQ_API_KEY = Deno.env.get("GROQ_API_KEY") || "";
const GROQ_API_URL = "https://api.groq.com/openai/v1/chat/completions";

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

        // Limit batch size to prevent token limits
        const batch = domains.slice(0, 50);

        const systemPrompt = `You are an expert SEO analysis engine. 
Classify the provided list of domains into the following schema.

Categories:
- ugc (Forums, Reddit, Quora, Social Media)
- editorial (News, Magazines, Blogs, Publishers)
- affiliate (Coupon sites, Review sites with clear affiliate focus)
- competitor (Direct competitors or similar brands)
- educational (Universities, Government, Documentation)
- ecommerce (Stores, Marketplaces)
- other

Authority Tiers:
- 1: High Trust (Gov, Edu, Wikipedia, Major News like NYT/BBC)
- 2: Established (Industry blogs, Review sites, Company blogs)
- 3: Low/Unknown (Small blogs, Forums, New sites)

Relationship:
- If the domain matches the known Brand Name: "owned"
- If the domain matches a known Competitor: "competitor"
- Otherwise: "neutral"

Return ONLY a JSON object mapping each domain to its classification.
Format:
{
  "domain.com": { 
    "category": "ugc|editorial|...", 
    "source_type": "string",
    "authority_tier": 1|2|3, 
    "relationship_type": "owned|competitor|neutral" 
  }
}`;

        const userPrompt = `Classify these domains:
${batch.join("\n")}

Context:
My Brand: ${brand_name || "Unknown"}
Competitors: ${(competitors || []).join(", ")}`;

        const response = await fetch(GROQ_API_URL, {
            method: "POST",
            headers: {
                "Authorization": `Bearer ${GROQ_API_KEY}`,
                "Content-Type": "application/json",
            },
            body: JSON.stringify({
                model: "llama-3.1-70b-versatile",
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
            throw new Error(`Groq API Error: ${response.status}`);
        }

        const data = await response.json();
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
