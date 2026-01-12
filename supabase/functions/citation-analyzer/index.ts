// @ts-nocheck
/**
 * ============================================================================
 * CITATION ANALYZER EDGE FUNCTION
 * ============================================================================
 * 
 * Analyzes citations for the Citation-Level Brand & Competitor Intelligence Engine.
 * 
 * Features:
 * - URL verification (reachability checks)
 * - Hallucination detection
 * - Category classification (UGC, competitor, press, app store, Wikipedia)
 * - Groq AI analysis for deep insights
 * - Recommendation generation with AI content
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

const GROQ_API_KEY = Deno.env.get("GROQ_API_KEY") || "";
const GROQ_API_URL = "https://api.groq.com/openai/v1/chat/completions";
const GROQ_MODEL = "llama-3.1-8b-instant";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL") || "";
const SUPABASE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || "";

// ============================================
// DOMAIN CLASSIFICATION PATTERNS
// ============================================

const UGC_DOMAINS = [
    'reddit.com', 'quora.com', 'x.com', 'twitter.com',
    'facebook.com', 'linkedin.com', 'medium.com',
    'disqus.com', 'discord.com', 'stackoverflow.com',
    'producthunt.com', 'ycombinator.com', 'news.ycombinator.com',
    'trustpilot.com', 'g2.com', 'capterra.com'
];

const PRESS_DOMAINS = [
    'forbes.com', 'techcrunch.com', 'wired.com', 'theverge.com',
    'businessinsider.com', 'cnbc.com', 'reuters.com', 'bbc.com',
    'nytimes.com', 'wsj.com', 'bloomberg.com', 'ft.com',
    'mashable.com', 'venturebeat.com', 'cnet.com', 'zdnet.com',
    'engadget.com', 'gizmodo.com', 'arstechnica.com',
    'inc.com', 'entrepreneur.com', 'fastcompany.com'
];

const APP_STORE_PATTERNS = [
    'play.google.com', 'apps.apple.com', 'appstore.com',
    'microsoft.com/store', 'amazon.com/app'
];

// ============================================
// TYPE DEFINITIONS
// ============================================

interface Citation {
    id?: string;
    url: string;
    domain: string;
    title?: string;
    model?: string;
    audit_result_id?: string;
}

interface AnalysisRequest {
    client_id: string;
    audit_result_id?: string;
    citations?: Citation[];
    brand_name: string;
    brand_domain?: string;
    competitors?: string[];
    analyze_all?: boolean;
}

interface CitationIntelligence {
    url: string;
    domain: string;
    is_reachable: boolean | null;
    http_status: number | null;
    is_hallucinated: boolean;
    hallucination_type: string | null;
    hallucination_reason: string | null;
    citation_category: string;
    subcategory: string | null;
    opportunity_level: string;
    brand_mentioned_in_source: boolean;
    competitor_mentions: string[];
    ai_analysis: object;
}

interface Recommendation {
    recommendation_type: string;
    priority: string;
    title: string;
    description: string;
    generated_content: string | null;
    content_type: string | null;
    action_items: string[];
    estimated_effort: string;
}

// ============================================
// HELPER FUNCTIONS
// ============================================

function extractDomain(url: string): string {
    try {
        return new URL(url).hostname.replace(/^www\./, "").toLowerCase();
    } catch {
        return "";
    }
}

function sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
}

// ============================================
// URL VERIFICATION
// ============================================

async function verifyUrl(url: string): Promise<{
    reachable: boolean;
    status: number | null;
    error?: string;
}> {
    try {
        const controller = new AbortController();
        const timeout = setTimeout(() => controller.abort(), 8000);

        const response = await fetch(url, {
            method: 'HEAD',
            signal: controller.signal,
            headers: {
                'User-Agent': 'Mozilla/5.0 (compatible; Forzeo Citation Analyzer/1.0)'
            }
        });

        clearTimeout(timeout);

        return {
            reachable: response.ok,
            status: response.status
        };
    } catch (error) {
        return {
            reachable: false,
            status: null,
            error: error instanceof Error ? error.name : 'unknown'
        };
    }
}

// ============================================
// CITATION CLASSIFICATION
// ============================================

function classifyCitation(
    url: string,
    domain: string,
    brandDomain: string | null,
    competitors: string[]
): { category: string; subcategory: string | null; opportunityLevel: string } {
    const lowerDomain = domain.toLowerCase();
    const lowerUrl = url.toLowerCase();

    // Brand owned
    if (brandDomain && lowerDomain.includes(brandDomain.toLowerCase().replace(/^www\./, ''))) {
        return { category: 'brand_owned', subcategory: 'official', opportunityLevel: 'easy' };
    }

    // Wikipedia
    if (lowerDomain.includes('wikipedia.org')) {
        return { category: 'wikipedia', subcategory: null, opportunityLevel: 'difficult' };
    }

    // App stores
    for (const pattern of APP_STORE_PATTERNS) {
        if (lowerUrl.includes(pattern)) {
            const subcategory = lowerUrl.includes('play.google.com') ? 'google_play' :
                lowerUrl.includes('apps.apple.com') ? 'app_store' : 'other_store';
            return { category: 'app_store', subcategory, opportunityLevel: 'medium' };
        }
    }

    // Competitor content
    for (const competitor of competitors) {
        const compLower = competitor.toLowerCase().replace(/\s+/g, '');
        if (lowerDomain.includes(compLower) || lowerUrl.includes(compLower)) {
            return { category: 'competitor_blog', subcategory: competitor, opportunityLevel: 'easy' };
        }
    }

    // Press/Media
    for (const pressDomain of PRESS_DOMAINS) {
        if (lowerDomain.includes(pressDomain)) {
            return { category: 'press_media', subcategory: pressDomain, opportunityLevel: 'medium' };
        }
    }

    // UGC
    for (const ugcDomain of UGC_DOMAINS) {
        if (lowerDomain.includes(ugcDomain)) {
            const subcategory = lowerDomain.includes('reddit') ? 'reddit' :
                lowerDomain.includes('quora') ? 'quora' :
                    lowerDomain.includes('twitter') || lowerDomain.includes('x.com') ? 'twitter' :
                        lowerDomain.includes('linkedin') ? 'linkedin' :
                            lowerDomain.includes('stackoverflow') ? 'stackoverflow' :
                                ugcDomain;
            return { category: 'ugc', subcategory, opportunityLevel: 'easy' };
        }
    }

    return { category: 'other', subcategory: null, opportunityLevel: 'medium' };
}

// ============================================
// GROQ AI ANALYSIS
// ============================================

const ANALYSIS_SYSTEM_PROMPT = `You are an expert GEO (Generative Engine Optimization) analyst specializing in AI citation analysis. Your role is to provide SPECIFIC, ACTIONABLE insights - never generic advice.

Analysis Requirements:
1. Be SPECIFIC to the exact URL and domain provided
2. Consider the brand's actual competitive position
3. Provide insights that are directly implementable
4. Quantify opportunities where possible (e.g., "high-intent traffic", "decision-stage visibility")
5. Consider the user's journey and intent behind searching

Never give vague advice like "engage authentically" - instead provide specific tactics like "respond within 24 hours addressing the specific pain point of [X] mentioned in the thread"`;

async function analyzeWithGroq(
    citation: Citation,
    category: string,
    brandName: string,
    competitors: string[]
): Promise<{ analysis: object; recommendation: Recommendation | null }> {
    if (!GROQ_API_KEY) {
        console.log("[Groq] API key not configured");
        return { analysis: {}, recommendation: null };
    }

    const userPrompt = `ANALYZE THIS AI CITATION: 

BRAND: ${brandName}
URL: ${citation.url}
DOMAIN: ${citation.domain}
TITLE: ${citation.title || 'Unknown'}
CATEGORY: ${category}
COMPETITORS: ${competitors.join(', ') || 'Not specified'}

Provide SPECIFIC, ACTIONABLE analysis. No generic advice.

Return JSON:
{
  "content_analysis": "What this specific page likely discusses based on URL/domain patterns. Be specific to this exact URL.",
  "brand_opportunity": "Exactly what ${brandName} should do here. Include specific tactics, not vague advice like 'engage authentically'. Example good answer: 'Post a detailed answer within 24h addressing the integration question, include a code snippet showing how ${brandName} handles this use case.'",
  "competitor_threat": "Is ${competitors[0] || 'a competitor'} mentioned here? What specific claims might they make that ${brandName} needs to counter?",
  "recommended_action": "ONE concrete next step. Not 'create content' but 'Draft a 500-word response comparing ${brandName} approach to the top-voted answer's recommendation'",
  "action_owner": "marketing|engineering|support|leadership",
  "priority": "critical|high|medium|low",
  "priority_reason": "Why this priority level - be specific about traffic, intent, or competitive exposure",
  "effort_estimate": "30min|2h|1day|3days|1week",
  "success_metric": "How to measure if this worked - e.g., 'Track if ${brandName} starts appearing in AI answers about this topic'"
}`;

    try {
        const response = await fetch(GROQ_API_URL, {
            method: "POST",
            headers: {
                "Authorization": `Bearer ${GROQ_API_KEY}`,
                "Content-Type": "application/json",
            },
            body: JSON.stringify({
                model: GROQ_MODEL,
                messages: [
                    { role: "system", content: ANALYSIS_SYSTEM_PROMPT },
                    { role: "user", content: userPrompt }
                ],
                temperature: 0.4,
                max_tokens: 800,
                response_format: { type: "json_object" }
            })
        });

        if (!response.ok) {
            console.error(`[Groq] HTTP ${response.status}`);
            return { analysis: {}, recommendation: null };
        }

        const data = await response.json();
        const content = data.choices?.[0]?.message?.content;

        if (!content) {
            return { analysis: {}, recommendation: null };
        }

        const analysis = JSON.parse(content);

        // Generate recommendation based on analysis and category
        const recommendation = generateRecommendation(citation, category, analysis, brandName);

        return { analysis, recommendation };
    } catch (error) {
        console.error(`[Groq] Analysis error: ${error}`);
        return { analysis: {}, recommendation: null };
    }
}

// ============================================
// RECOMMENDATION GENERATION
// ============================================

function generateRecommendation(
    citation: Citation,
    category: string,
    analysis: any,
    brandName: string
): Recommendation | null {
    const priority = analysis.priority || 'medium';
    const effort = analysis.effort_estimate || '1day';
    const domain = citation.domain.toLowerCase();
    const title = citation.title || 'Content';

    switch (category) {
        case 'ugc': {
            const platform = domain.includes('quora') ? 'Quora' :
                domain.includes('reddit') ? 'Reddit' :
                    domain.includes('linkedin') ? 'LinkedIn' :
                        domain.includes('twitter') || domain.includes('x.com') ? 'X/Twitter' :
                            domain.includes('stackoverflow') ? 'Stack Overflow' : 'Forum';

            const contentType = domain.includes('quora') ? 'quora_answer' :
                domain.includes('reddit') ? 'reddit_comment' :
                    domain.includes('stackoverflow') ? 'stackoverflow_answer' : 'social_response';

            return {
                recommendation_type: 'engage_ugc',
                priority,
                title: `${platform}: Respond to "${title.substring(0, 40)}..."`,
                description: analysis.brand_opportunity || `High-intent ${platform} discussion where ${brandName} should be mentioned. Users here are actively researching solutions.`,
                generated_content: null,
                content_type: contentType,
                action_items: [
                    `Open ${citation.url} and read the FULL thread (not just the question)`,
                    `Identify the top 3 pain points mentioned by ${platform === 'Reddit' ? 'OP and commenters' : 'the asker and answerers'}`,
                    `Note which competitors are mentioned and what claims they make`,
                    `Draft response: Start with your experience, then mention ${brandName} naturally as what solved your problem`,
                    `Include ONE specific detail (e.g., "saved 3 hours/week" or "handled our 10k daily requests")`,
                    `Post from a ${platform === 'Reddit' ? 'personal account with history (not brand account)' : 'credible profile'}`,
                    `Set reminder: Check back in 48h to answer follow-up questions`
                ],
                estimated_effort: effort
            };
        }

        case 'competitor_blog': {
            const competitor = analysis.competitor_threat || citation.domain.split('.')[0];
            return {
                recommendation_type: 'create_comparison',
                priority: 'high',
                title: `Counter "${title.substring(0, 35)}..." with comparison content`,
                description: `AI cites ${competitor} content. Create ${brandName} vs ${competitor} comparison to capture this search intent and give AI an alternative to cite.`,
                generated_content: null,
                content_type: 'comparison_page',
                action_items: [
                    `Read competitor page: ${citation.url}`,
                    `List their 5 main claims/features they highlight`,
                    `Document where ${brandName} is objectively better AND where competitor has advantages (honesty = credibility)`,
                    `Create comparison page with URL structure: ${brandName.toLowerCase()}.com/vs/${competitor.toLowerCase()}`,
                    `Include: Feature table, pricing comparison, real user quotes from G2/Capterra`,
                    `Add FAQ section with common "vs" questions from Google autocomplete`,
                    `Submit to Google Search Console and monitor for AI citation within 2 weeks`
                ],
                estimated_effort: '3days'
            };
        }

        case 'press_media': {
            const publication = citation.domain.replace(/^www\./, '').split('.')[0];
            return {
                recommendation_type: 'publish_pr',
                priority,
                title: `PR opportunity: Get ${brandName} featured on ${publication}`,
                description: `${publication} covers your space. AI cites them. Getting ${brandName} mentioned here = AI citation potential.`,
                generated_content: null,
                content_type: 'press_release',
                action_items: [
                    `Read the cited article: ${citation.url}`,
                    `Identify the journalist/author (check byline, search "site:${citation.domain} [author name]")`,
                    `Find journalist on Twitter/LinkedIn - follow and engage with their content for 1-2 weeks`,
                    `Prepare news hook: What's genuinely newsworthy about ${brandName}? (new feature, funding, milestone, partnership)`,
                    `Draft pitch email: Lead with THEIR beat focus, then how ${brandName} is relevant`,
                    `Include: 1 interesting data point, offer exclusive angle, suggest 15-min call`,
                    `Follow up once after 5 days if no response. No more than that.`
                ],
                estimated_effort: '1week'
            };
        }

        case 'app_store': {
            const store = domain.includes('play.google') ? 'Google Play' :
                domain.includes('apple') ? 'App Store' : 'App Store';
            return {
                recommendation_type: 'improve_reviews',
                priority,
                title: `${store} optimization: Improve visibility vs competitors`,
                description: `AI cites app store listings. Improving ${brandName}'s listing can influence AI recommendations.`,
                generated_content: null,
                content_type: 'review_template',
                action_items: [
                    `Audit current listing: Check your ${store} page for keyword optimization`,
                    `Analyze competitor reviews: What do users praise/complain about in cited competitor?`,
                    `Reply to ALL negative reviews (last 30 days) - shows active support`,
                    `Create in-app review prompt: Trigger after positive action (completed task, 7th session, etc.)`,
                    `A/B test screenshots: Show actual value, not just UI`,
                    `Update description: Front-load keywords AI associates with your category`
                ],
                estimated_effort: '1week'
            };
        }

        case 'wikipedia': {
            return {
                recommendation_type: 'wikipedia_advisory',
                priority: 'low',
                title: 'Wikipedia: Build notability first (DO NOT edit directly)',
                description: `AI heavily cites Wikipedia. But editing your own page violates policy. Focus on earning coverage.`,
                generated_content: null,
                content_type: 'notability_analysis',
                action_items: [
                    `Check if ${brandName} Wikipedia page exists: search Wikipedia`,
                    `If no page: You need 3+ independent reliable sources (major press, not blogs) before creating`,
                    `DO NOT create/edit your own page - Wikipedia editors will revert and flag for conflict of interest`,
                    `Strategy: Get featured in Forbes, TechCrunch, WSJ, etc. first`,
                    `Monitor: Set Google Alert for "${brandName} Wikipedia" to catch any mentions`,
                    `Consider: Hire a Wikipedia consultant (they can't edit for you, but can advise on notability)`
                ],
                estimated_effort: '1week'
            };
        }

        default:
            return null;
    }
}

// ============================================
// CONTENT GENERATION
// ============================================

const UGC_RESPONSE_PROMPT = `You are writing a GENUINE response as a real person who has ACTUALLY used products/services in this space.

CRITICAL REQUIREMENTS for authentic human-sounding content:

1. OPENING: Start mid-thought, never with "I" or a greeting. Examples:
   - "Honestly, after trying like 5 different options..."
   - "So I was in the exact same situation last month..."
   - "This is something I've spent way too much time researching..."

2. PERSONAL STORY: Include ONE specific detail that makes it real:
   - A specific frustration: "kept losing my settings every time it updated"
   - A moment of discovery: "stumbled across it in a random HN thread"
   - A use case: "needed something that could handle our 50k+ monthly visitors"

3. NATURAL LANGUAGE:
   - Use contractions (I'm, it's, couldn't, wouldn't)
   - Include fillers sparingly: "honestly", "actually", "basically"
   - Show uncertainty: "I think", "from what I've seen", "might be worth checking"
   - React emotionally: "game-changer for us", "saved me so much headache"

4. BRAND MENTION: Introduce naturally as discovery, NOT recommendation:
   - "ended up going with [brand] after all that"
   - "[brand] is what I landed on, though YMMV"
   - "switched to [brand] a few months back"

5. HONESTY: Include one minor downside or caveat:
   - "learning curve was real"
   - "pricing isn't the cheapest but..."
   - "took a bit to set up properly"

6. CLOSING: End helpfully without being promotional:
   - "happy to answer questions if you end up trying it"
   - "lmk if you want specifics on the setup"
   - "hope that helps narrow things down"

FORBIDDEN:
- "Best [product] ever"
- "I highly recommend"
- Bullet points of features
- Marketing speak (seamless, robust, comprehensive)
- Perfect grammar - keep it conversational

Length: 150-250 words max. Write like you're helping a friend, not selling.`;

const COMPARISON_PAGE_PROMPT = `Create a genuinely helpful, FAIR comparison that people will actually trust and share.

CRITICAL: This must read as unbiased editorial content, NOT marketing material.

## STRUCTURE:

### 1. Meta/SEO (hidden from main content)
Meta Title: [Brand A] vs [Brand B]: Honest [Year] Comparison | Which Is Right for You?
Meta Description: We tested both [Brand A] and [Brand B] for [X weeks]. Here's what we found, including the dealbreakers and standout features for different use cases.

### 2. Opening Hook (2-3 sentences)
- Acknowledge the reader's dilemma
- Mention you've actually tested/researched both
- Set expectation: no clear winner, depends on needs

### 3. TL;DR Quick Verdict (3 bullets)
- Choose [Brand A] if: [specific use case]
- Choose [Brand B] if: [specific use case]  
- Skip both if: [alternative scenario]

### 4. Quick Comparison Table
| Feature | Brand A | Brand B |
|---------|---------|----------|
| Best For | [specific persona] | [specific persona] |
| Pricing | $X/mo | $Y/mo |
| Standout | [1 thing] | [1 thing] |
| Weakness | [honest flaw] | [honest flaw] |

### 5. Deep Dive Sections (3-4 key factors)
For each factor:
- What we tested / how we evaluated
- Brand A's approach + specific example
- Brand B's approach + specific example  
- VERDICT for this factor with nuance

### 6. Real User Sentiment
Summarize actual user complaints/praise from G2, Reddit, Capterra (cite source types)

### 7. The Bottom Line
- Acknowledge there's no universal winner
- Summarize decision framework
- Suggest trying both free trials if available

TONE: Journalist reviewing products, not a brand promoting itself.
Be fair to competitors - credibility comes from honesty.`;

const PRESS_RELEASE_PROMPT = `Write a compelling, newsworthy press release that journalists would actually want to cover.

KEY PRINCIPLES:
1. Lead with NEWS, not company fluff
2. Answer "why should readers care TODAY?"
3. Include data/numbers when possible
4. Provide a genuine human story angle

## STRUCTURE:

### HEADLINE (8-12 words)
[Action Verb] + [Newsworthy Element] + [Relevance Hook]
Example: "[Brand] Launches [Feature] as [Industry] Faces [Relevant Challenge]"

### SUBHEADLINE (15-20 words)
Expand on the impact - who benefits and what changes

### DATELINE + LEAD PARAGRAPH
[CITY, STATE] – [Date] – 
First sentence: The WHAT and WHY in one punchy line
Second sentence: The SO WHAT - impact or significance
Third sentence: Supporting context or data point

### BODY PARAGRAPH 1: The Problem/Opportunity
What market need or trend does this address?
Include: industry data, trend, or customer pain point

### BODY PARAGRAPH 2: The Solution
What specifically was launched/announced?
Include: concrete details, not marketing adjectives

### QUOTE 1 (Executive/Founder)
"[Authentic-sounding statement that adds COLOR, not just corporate speak]"
- Should sound like something a real person would say
- Include a specific insight or number
- Attribute with full name and title

### BODY PARAGRAPH 3: Details/Features
Expand on 2-3 key specifics
Include: pricing, availability, technical specs if relevant

### QUOTE 2 (Customer or Partner - optional)
"[Real-sounding testimonial about specific benefit]"

### BOILERPLATE (About [Company])
2-3 sentences: Founded [year], serves [customers], known for [one differentiator]
Website: [URL]

### MEDIA CONTACT
Name | Email | Phone

FORBIDDEN WORDS: leverage, synergy, cutting-edge, best-in-class, world-class, excited to announce, pleased to announce, proud to announce

Make it sound like a Reuters/AP wire story, not a marketing blog.`;

async function generateContent(
    contentType: string,
    context: {
        brandName: string;
        competitors?: string[];
        threadContext?: string;
        targetPublication?: string;
        topic?: string;
    }
): Promise<string> {
    if (!GROQ_API_KEY) {
        return "Groq API key not configured. Please add GROQ_API_KEY to generate content.";
    }

    let systemPrompt = "";
    let userPrompt = "";

    switch (contentType) {
        case 'quora_answer':
        case 'reddit_comment':
        case 'social_response':
            systemPrompt = UGC_RESPONSE_PROMPT;
            userPrompt = `BRAND TO MENTION: ${context.brandName}
COMPETITORS TO BE AWARE OF: ${context.competitors?.join(', ') || 'N/A'}
PLATFORM: ${contentType === 'quora_answer' ? 'Quora (more formal, longer answers expected)' : contentType === 'reddit_comment' ? 'Reddit (casual, community-focused, may use slang)' : 'Social media (brief, engaging)'}

DISCUSSION TOPIC: ${context.topic || 'General industry discussion'}
THREAD CONTEXT: ${context.threadContext || 'Someone asking for recommendations or experiences in this space'}

SPECIFIC REQUIREMENTS:
- Persona: Someone who has genuinely tried multiple options including ${context.competitors?.[0] || 'competitors'}
- Pain point to address: ${context.topic ? `related to ${context.topic}` : 'common industry frustrations'}
- Your journey: Tried other options, found ${context.brandName}, share your real experience
- End with offering to help further (builds trust)

Generate the response now. Remember: NO marketing speak, sound like a real person typing on their phone.`;
            break;

        case 'comparison_page':
            systemPrompt = COMPARISON_PAGE_PROMPT;
            userPrompt = `PRIMARY BRAND: ${context.brandName}
COMPARISON AGAINST: ${context.competitors?.[0] || 'main competitor'}
${context.competitors && context.competitors.length > 1 ? `OTHER COMPETITORS TO MENTION: ${context.competitors.slice(1).join(', ')}` : ''}

INDUSTRY/NICHE: ${context.topic || 'this product category'}

REQUIREMENTS FOR THIS COMPARISON:
1. Research angle: "We spent 2 weeks testing both solutions"
2. Target reader: Someone actively comparing these two options (high purchase intent)
3. Balanced coverage: Give fair treatment to both - don't trash the competitor
4. Specific differentiators: What actually makes ${context.brandName} different (not marketing claims)
5. Acknowledge competitor strengths: Where is ${context.competitors?.[0] || 'competitor'} actually better?
6. Clear verdict: Who should choose which, with specific scenarios

Generate the full comparison article in markdown format.`;
            break;

        case 'press_release':
            systemPrompt = PRESS_RELEASE_PROMPT;
            userPrompt = `COMPANY: ${context.brandName}
TARGET PUBLICATION: ${context.targetPublication || 'Tech Crunch / industry publications'}
NEWS ANGLE: ${context.topic || 'Product/feature announcement'}
COMPETITIVE CONTEXT: ${context.competitors?.join(', ') || 'Industry competitors'} are the alternatives

REQUIREMENTS FOR THIS PRESS RELEASE:
1. Lead with the NEWS hook - why would a journalist care TODAY?
2. Include placeholder for a real statistic: [INSERT: customer growth %, user count, etc.]
3. Quote should sound human, not corporate: Use "we found that..." not "we are excited to..."
4. Address: What problem does this solve that competitors don't?
5. Include a customer-impact angle: Who benefits and how specifically?
6. Boilerplate: Keep it to 2 sentences max

Generate the press release now. Make it newsworthy, not promotional.`;
            break;

        default:
            return "Unknown content type";
    }

    try {
        const response = await fetch(GROQ_API_URL, {
            method: "POST",
            headers: {
                "Authorization": `Bearer ${GROQ_API_KEY}`,
                "Content-Type": "application/json",
            },
            body: JSON.stringify({
                model: GROQ_MODEL,
                messages: [
                    { role: "system", content: systemPrompt },
                    { role: "user", content: userPrompt }
                ],
                temperature: 0.8,
                max_tokens: 1500
            })
        });

        if (!response.ok) {
            console.error(`[Groq] HTTP ${response.status}`);
            return "Failed to generate content. Please try again.";
        }

        const data = await response.json();
        return data.choices?.[0]?.message?.content || "No content generated";
    } catch (error) {
        console.error(`[Groq] Content generation error: ${error}`);
        return "Error generating content. Please try again.";
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

    if (req.method !== "POST") {
        return new Response(JSON.stringify({ error: "Method not allowed" }), {
            status: 405,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
    }

    try {
        const body = await req.json();
        const action = body.action || 'analyze';

        console.log(`[Citation Analyzer] Action: ${action}`);

        // Initialize Supabase client
        const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

        // Handle different actions
        switch (action) {
            case 'analyze': {
                const request: AnalysisRequest = body;

                if (!request.client_id || !request.brand_name) {
                    return new Response(JSON.stringify({ error: "client_id and brand_name required" }), {
                        status: 400,
                        headers: { ...corsHeaders, "Content-Type": "application/json" },
                    });
                }

                let citations: Citation[] = request.citations || [];

                // If analyze_all, fetch citations from database
                if (request.analyze_all && request.audit_result_id) {
                    const { data: dbCitations } = await supabase
                        .from('citations')
                        .select('id, url, domain, title, model, audit_result_id')
                        .eq('audit_result_id', request.audit_result_id);

                    if (dbCitations) {
                        citations = dbCitations;
                    }
                }

                console.log(`[Citation Analyzer] Analyzing ${citations.length} citations`);

                const results: CitationIntelligence[] = [];
                const recommendations: Recommendation[] = [];

                for (const citation of citations) {
                    // Verify URL
                    console.log(`[Citation Analyzer] Verifying: ${citation.url.substring(0, 50)}...`);
                    const verification = await verifyUrl(citation.url);
                    await sleep(300); // Rate limiting

                    // Classify citation
                    const classification = classifyCitation(
                        citation.url,
                        citation.domain,
                        request.brand_domain || null,
                        request.competitors || []
                    );

                    // Determine hallucination status
                    const isHallucinated = !verification.reachable;
                    const hallucinationType = isHallucinated ?
                        (verification.error === 'AbortError' ? 'unreachable' :
                            verification.status === 404 ? 'fake_domain' : 'unreachable') : null;

                    // AI analysis with Groq
                    let aiAnalysis = {};
                    let recommendation: Recommendation | null = null;

                    if (!isHallucinated && GROQ_API_KEY) {
                        const groqResult = await analyzeWithGroq(
                            citation,
                            classification.category,
                            request.brand_name,
                            request.competitors || []
                        );
                        aiAnalysis = groqResult.analysis;
                        recommendation = groqResult.recommendation;
                        await sleep(200); // Rate limiting for Groq
                    }

                    const intelligence: CitationIntelligence = {
                        url: citation.url,
                        domain: citation.domain,
                        is_reachable: verification.reachable,
                        http_status: verification.status,
                        is_hallucinated: isHallucinated,
                        hallucination_type: hallucinationType,
                        hallucination_reason: isHallucinated ? verification.error || `HTTP ${verification.status}` : null,
                        citation_category: classification.category,
                        subcategory: classification.subcategory,
                        opportunity_level: classification.opportunityLevel,
                        brand_mentioned_in_source: false, // Would need content scraping
                        competitor_mentions: [],
                        ai_analysis: aiAnalysis
                    };

                    results.push(intelligence);

                    // Save to database
                    const { data: savedIntelligence, error: saveError } = await supabase
                        .from('citation_intelligence')
                        .insert({
                            citation_id: citation.id || null,
                            audit_result_id: citation.audit_result_id || request.audit_result_id,
                            client_id: request.client_id,
                            url: intelligence.url,
                            domain: intelligence.domain,
                            title: citation.title,
                            model: citation.model,
                            is_reachable: intelligence.is_reachable,
                            http_status: intelligence.http_status,
                            last_verified_at: new Date().toISOString(),
                            is_hallucinated: intelligence.is_hallucinated,
                            hallucination_type: intelligence.hallucination_type,
                            hallucination_reason: intelligence.hallucination_reason,
                            citation_category: intelligence.citation_category,
                            subcategory: intelligence.subcategory,
                            opportunity_level: intelligence.opportunity_level,
                            ai_analysis: intelligence.ai_analysis,
                            analysis_status: 'completed',
                            processed_at: new Date().toISOString()
                        })
                        .select()
                        .single();

                    if (saveError) {
                        console.error(`[Citation Analyzer] Save error: ${saveError.message}`);
                    }

                    // Save recommendation if generated
                    if (recommendation && savedIntelligence) {
                        const { error: recError } = await supabase
                            .from('citation_recommendations')
                            .insert({
                                citation_intelligence_id: savedIntelligence.id,
                                client_id: request.client_id,
                                recommendation_type: recommendation.recommendation_type,
                                priority: recommendation.priority,
                                title: recommendation.title,
                                description: recommendation.description,
                                generated_content: recommendation.generated_content,
                                content_type: recommendation.content_type,
                                action_items: recommendation.action_items,
                                estimated_effort: recommendation.estimated_effort
                            });

                        if (recError) {
                            console.error(`[Citation Analyzer] Recommendation save error: ${recError.message}`);
                        } else {
                            recommendations.push(recommendation);
                        }
                    }
                }

                // Summary
                const summary = {
                    total_analyzed: results.length,
                    hallucinated: results.filter(r => r.is_hallucinated).length,
                    verified: results.filter(r => r.is_reachable).length,
                    by_category: {
                        ugc: results.filter(r => r.citation_category === 'ugc').length,
                        competitor_blog: results.filter(r => r.citation_category === 'competitor_blog').length,
                        press_media: results.filter(r => r.citation_category === 'press_media').length,
                        app_store: results.filter(r => r.citation_category === 'app_store').length,
                        wikipedia: results.filter(r => r.citation_category === 'wikipedia').length,
                        brand_owned: results.filter(r => r.citation_category === 'brand_owned').length,
                        other: results.filter(r => r.citation_category === 'other').length
                    },
                    recommendations_generated: recommendations.length
                };

                return new Response(JSON.stringify({
                    success: true,
                    summary,
                    results,
                    recommendations,
                    timestamp: new Date().toISOString()
                }), {
                    headers: { ...corsHeaders, "Content-Type": "application/json" },
                });
            }

            case 'generate_content': {
                const { content_type, context } = body;

                if (!content_type || !context?.brandName) {
                    return new Response(JSON.stringify({ error: "content_type and context.brandName required" }), {
                        status: 400,
                        headers: { ...corsHeaders, "Content-Type": "application/json" },
                    });
                }

                const content = await generateContent(content_type, context);

                // Update recommendation if ID provided
                if (body.recommendation_id) {
                    await supabase
                        .from('citation_recommendations')
                        .update({
                            generated_content: content,
                            regeneration_count: supabase.rpc('increment_regeneration_count'),
                            last_regenerated_at: new Date().toISOString()
                        })
                        .eq('id', body.recommendation_id);
                }

                return new Response(JSON.stringify({
                    success: true,
                    content,
                    content_type,
                    timestamp: new Date().toISOString()
                }), {
                    headers: { ...corsHeaders, "Content-Type": "application/json" },
                });
            }

            case 'get_summary': {
                const { client_id } = body;

                if (!client_id) {
                    return new Response(JSON.stringify({ error: "client_id required" }), {
                        status: 400,
                        headers: { ...corsHeaders, "Content-Type": "application/json" },
                    });
                }

                // Fetch intelligence summary
                const { data: intelligence } = await supabase
                    .from('citation_intelligence')
                    .select('citation_category, is_hallucinated, is_reachable, opportunity_level')
                    .eq('client_id', client_id);

                // Fetch recommendation counts
                const { data: recommendations } = await supabase
                    .from('citation_recommendations')
                    .select('priority, is_actioned, recommendation_type')
                    .eq('client_id', client_id);

                const summary = {
                    total_analyzed: intelligence?.length || 0,
                    hallucinated: intelligence?.filter(i => i.is_hallucinated).length || 0,
                    verified: intelligence?.filter(i => i.is_reachable).length || 0,
                    categories: {
                        ugc: intelligence?.filter(i => i.citation_category === 'ugc').length || 0,
                        competitor_blog: intelligence?.filter(i => i.citation_category === 'competitor_blog').length || 0,
                        press_media: intelligence?.filter(i => i.citation_category === 'press_media').length || 0,
                        app_store: intelligence?.filter(i => i.citation_category === 'app_store').length || 0,
                        wikipedia: intelligence?.filter(i => i.citation_category === 'wikipedia').length || 0,
                        other: intelligence?.filter(i => i.citation_category === 'other').length || 0
                    },
                    recommendations: {
                        total: recommendations?.length || 0,
                        pending: recommendations?.filter(r => !r.is_actioned).length || 0,
                        by_priority: {
                            critical: recommendations?.filter(r => r.priority === 'critical').length || 0,
                            high: recommendations?.filter(r => r.priority === 'high').length || 0,
                            medium: recommendations?.filter(r => r.priority === 'medium').length || 0,
                            low: recommendations?.filter(r => r.priority === 'low').length || 0
                        }
                    }
                };

                return new Response(JSON.stringify({
                    success: true,
                    summary,
                    timestamp: new Date().toISOString()
                }), {
                    headers: { ...corsHeaders, "Content-Type": "application/json" },
                });
            }

            default:
                return new Response(JSON.stringify({ error: `Unknown action: ${action}` }), {
                    status: 400,
                    headers: { ...corsHeaders, "Content-Type": "application/json" },
                });
        }

    } catch (err) {
        console.error("[Citation Analyzer] Error:", err);
        return new Response(JSON.stringify({
            success: false,
            error: String(err),
        }), {
            status: 500,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
    }
});
