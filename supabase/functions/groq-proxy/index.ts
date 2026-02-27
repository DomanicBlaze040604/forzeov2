import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const GROQ_API_KEY = Deno.env.get("GROQ_API_KEY") || "";
const GROQ_API_URL = "https://api.groq.com/openai/v1/chat/completions";

const corsHeaders = {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req: Request) => {
    if (req.method === "OPTIONS") {
        return new Response(null, { headers: corsHeaders });
    }

    if (!GROQ_API_KEY) {
        return new Response(
            JSON.stringify({ error: "GROQ_API_KEY is not configured. Run: supabase secrets set GROQ_API_KEY=<key>" }),
            { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
    }

    try {
        const body = await req.json();

        // Validate required fields
        if (!body.messages || !Array.isArray(body.messages)) {
            return new Response(
                JSON.stringify({ error: "messages array is required" }),
                { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
            );
        }

        const groqPayload = {
            model: body.model || "llama-3.3-70b-versatile",
            messages: body.messages,
            temperature: body.temperature ?? 0.7,
            max_tokens: body.max_tokens ?? 4096,
            ...(body.response_format ? { response_format: body.response_format } : {}),
        };

        const groqRes = await fetch(GROQ_API_URL, {
            method: "POST",
            headers: {
                "Authorization": `Bearer ${GROQ_API_KEY}`,
                "Content-Type": "application/json",
            },
            body: JSON.stringify(groqPayload),
        });

        if (!groqRes.ok) {
            const errorText = await groqRes.text();
            console.error(`[groq-proxy] Groq API error ${groqRes.status}:`, errorText);
            return new Response(
                JSON.stringify({ error: `Groq API error: ${groqRes.status}`, detail: errorText }),
                { status: groqRes.status, headers: { ...corsHeaders, "Content-Type": "application/json" } }
            );
        }

        const data = await groqRes.json();
        const content = data.choices?.[0]?.message?.content || null;

        return new Response(
            JSON.stringify({ response: content, usage: data.usage }),
            { headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );

    } catch (err) {
        console.error("[groq-proxy] Error:", err);
        return new Response(
            JSON.stringify({ error: String(err) }),
            { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
    }
});
