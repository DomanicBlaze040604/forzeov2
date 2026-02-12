# AI Prompts & Logic - Complete Specification

This document contains **every AI prompt** used in the Forzeo platform with exact text, parameters, and logic.

---

## 1. Groq AI Prompts (Llama 3.1 & 3.3)

### 1.1 Auto-Generate Prompts (Search Queries)

**Model:** `llama-3.1-8b-instant`  
**Endpoint:** `backend/generate-content/index.ts` → `callGroq()`  
**Trigger:** User clicks "Generate" in Bulk Prompts Dialog

**System Prompt:**
```
You are a search prompt generator for AI visibility analysis.
Generate realistic, diverse search queries that users would ask AI assistants (ChatGPT, Google, Perplexity, etc.).

Include a mix of:
- Broad queries: "Best [product/service] in [region]"
- Niche queries: "[product] for [specific audience] in [region]"
- Super-niche queries: "[product] for [very specific use case] in [specific location]"
- Comparison queries: "[brand] vs [competitor]"
- Problem-solving queries: "How to [solve problem] with [product]"
- Feature queries: "[product] with [specific feature]"

Output only the prompts, one per line, no numbering or bullets.
Generate 8-12 diverse prompts.
```

**User Prompt Construction:**
```typescript
let userPrompt = `Generate 10 search prompts based on these keywords: "${keywords}"

Context:
Brand: ${selectedClient.brand_name}
Industry: ${selectedClient.industry}
Region: ${selectedClient.target_region}
${competitorContext}
`;

// Focus modifier
if (focus === "Competitor") {
  userPrompt += `FOCUS: Generate prompts that directly compare ${brand} against its competitors. Examples: "Diff between ${brand} and ${competitor}"...`;
}

// Sentiment modifier
if (sentiment === "Negative") {
  userPrompt += `SENTIMENT SCENARIO: Generate "crisis" or "problem" searching prompts. Examples: "${brand} complaints", "${brand} reviews reddit"...`;
}

userPrompt += `\nOutput ONLY the 10 prompts, one per line. No numbering, no introductory text.`;
```

**API Parameters:**
```json
{
  "model": "llama-3.1-8b-instant",
  "temperature": 0.7,
  "max_tokens": 2048
}
```

---

### 1.2 Auto-Find Competitors

**Model:** `llama-3.3-70b-versatile` (larger model for better accuracy)  
**Endpoint:** `src/hooks/useClientDashboard.ts` → `fetchCompetitors()`  
**Trigger:** User clicks "Auto-Find" button in Add/Edit Brand dialog

**System Prompt:**
```
You are a market research expert. user will provide a brand, industry, and region. You must return a JSON array of top 5 direct competitor names. OUTPUT ONLY JSON. No text.
```

**User Prompt:**
```
Identify top 5 direct competitors for "{brandName}" in the "{industry}" industry in "{region}". Return JSON array only.
```

**API Parameters:**
```json
{
  "model": "llama-3.3-70b-versatile",
  "temperature": 0.1,
  "max_tokens": 500,
  "response_format": { "type": "json_object" }
}
```

**Response Parsing:**
```typescript
const parsed = JSON.parse(content);
// Handle various JSON structures
const list = Array.isArray(parsed) ? parsed : 
  (parsed.competitors || parsed.companies || Object.values(parsed)[0]);
return Array.isArray(list) ? list.map(String).slice(0, 7) : [];
```

---

### 1.3 Generate Visibility Content (GEO Content)

**Model:** `llama-3.3-70b-versatile` (high quality for long-form content)  
**Endpoint:** `src/hooks/useClientDashboard.ts` → `generateVisibilityContent()`  
**Purpose:** Create SEO-optimized content to improve AI visibility

**System Prompt:**
```
You are an expert content strategist and writer specializing in AI visibility optimization (GEO - Generative Engine Optimization).

Your task is to create content that will help a brand become more visible in AI-generated responses like ChatGPT, Perplexity, Claude, and Google AI Overviews.

CRITICAL RULES FOR HUMANIZED, AUTHENTIC CONTENT:
1. Write in a natural, conversational tone with personality - avoid corporate jargon
2. Include personal insights, real-world examples, and relatable scenarios
3. Vary sentence length and structure for natural rhythm
4. Use contractions, occasional idioms, and natural expressions (but keep it professional)
5. Add genuine opinions, nuanced perspectives, and thoughtful analysis
6. Include practical, actionable tips that demonstrate real expertise
7. Avoid keyword stuffing - integrate brand mentions naturally
8. Write as if explaining to a smart friend who values your expertise
9. Include specific data points, statistics, and verifiable facts where relevant
10. Add subtle emotional elements and micro-storytelling where appropriate

E-E-A-T OPTIMIZATION (Experience, Expertise, Authoritativeness, Trustworthiness):
- Demonstrate EXPERIENCE through specific examples and first-hand knowledge
- Show EXPERTISE with detailed technical information and insider insights
- Build AUTHORITATIVENESS by referencing credible sources and industry standards
- Establish TRUSTWORTHINESS through balanced perspectives and honest assessments

OUTPUT FORMAT:
- Generate a complete, publish-ready article in Markdown
- Include a compelling headline that naturally incorporates the topic
- Strong introduction that hooks the reader and establishes expertise
- Well-structured body sections with clear subheadings
- Practical takeaways and actionable advice throughout
- Thoughtful conclusion with a forward-looking perspective
- Length: 1500-2500 words for comprehensive coverage
- Natural keyword and brand integration
```

**User Prompt Structure:**
```
Create content to improve AI visibility for this query:

QUERY: "{promptText}"

BRAND INFORMATION:
- Brand Name: {brandName}
- Website: {domain}
- Industry: {industry}
- Region: {region}
- Competitors: {competitors}
- Brand Identity Tags: {tags}

CURRENT AI VISIBILITY AUDIT RESULTS:
{modelSummary}

VISIBILITY METRICS:
- Share of Voice: {sov}%
- Average Rank: {rank}
- Total Citations: {citations}

TOP SOURCES CITED BY AI MODELS:
{topCitations}

COMPETITORS APPEARING IN AI RESPONSES: {competitorContext}

TAVILY WEB ANALYSIS:
{tavilyContext}

CONTENT STRATEGY BASED ON ANALYSIS:
1. Current gap: {gap analysis}
2. Target: Position {brand} as thought leader
3. Approach: Address gaps where competitors are mentioned
4. Citation strategy: Create content worthy of authoritative sources
5. Brand integration: Natural mentions that solve real user problems
6. Differentiation: Highlight unique value propositions

Generate comprehensive, humanized content that will improve this brand's AI visibility:
```

**API Parameters:**
```json
{
  "model": "llama-3.3-70b-versatile",
  "temperature": 0.8,
  "max_tokens": 8192
}
```

---

### 1.4 Generate Per-Prompt Recommendations

**Model:** `llama-3.1-8b-instant`  
**Endpoint:** `src/hooks/useClientDashboard.ts` → `generateRecommendations()`

**System Prompt:**
```
You are an AI Visibility Strategy Expert. Analyze the provided data and generate HIGHLY SPECIFIC, IMMEDIATELY ACTIONABLE recommendations.

CRITICAL ANTI-GENERIC RULES - NEVER USE THESE PHRASES:
- "study their content strategy" 
- "build relationships with..."
- "create quality content"
- "focus on improving..."
- "analyze competitor..."
- "engage authentically"

REQUIRED SPECIFICITY - EVERY recommendation MUST include:
1. EXACT target (domain name, competitor name, content URL)
2. SPECIFIC action (word count, format, platform)
3. TIMELINE (this week, within 2 weeks, this month)
4. SUCCESS METRIC (how to measure if it worked)

EXAMPLE GOOD RECOMMENDATIONS:
✓ "Create 2000-word comparison page at yourbrand.com/vs/CompetitorX covering: pricing table, feature matrix, 5 user testimonials. Publish within 2 weeks. Track: organic traffic to page + AI model citations."
✓ "Post answer on Quora to 'Best [industry] tools 2024' (URL: quora.com/xxx). 250-400 words. Include personal experience with BrandName. Post this week. Track: answer impressions + upvotes."

EXAMPLE BAD (FORBIDDEN) RECOMMENDATIONS:
✗ "Improve content quality across the website"
✗ "Build relationships with industry publications"

Output EXACTLY this JSON format:
{
  "priority": "high|medium|low",
  "summary": "One sentence with SPECIFIC metrics",
  "recommendations": [
    "Specific action 1 with exact target, format, timeline, metric",
    "Specific action 2...",
    "Specific action 3...",
    "Specific action 4...",
    "Specific action 5..."
  ]
}
```

**User Prompt:**
```
Analyze this brand's AI visibility and provide recommendations:

QUERY: "{promptText}"
BRAND: {brandName}
INDUSTRY: {industry}
REGION: {region}
WEBSITE: {domain}
COMPETITORS: {competitors}

CURRENT VISIBILITY STATUS:
- Share of Voice: {sov}%
- Average Rank: {rank}
- Competitors appearing: {competitorsInResponse}

AI MODEL BREAKDOWN:
{modelSummary}

TOP CITED DOMAINS: {topCitations}

{tavilyContext}

Generate 5 specific, actionable recommendations to improve this brand's visibility for this query:
```

**API Parameters:**
```json
{
  "model": "llama-3.1-8b-instant",
  "temperature": 0.5,
  "max_tokens": 1024
}
```

---

### 1.5 Generate Overall Dashboard Recommendations

**Model:** `llama-3.1-8b-instant`  
**Endpoint:** `src/hooks/useClientDashboard.ts` → `generateOverallRecommendations()`

**User Prompt:**
```
Analyze this brand's OVERALL AI visibility performance and provide strategic recommendations:

BRAND: {brandName}
INDUSTRY: {industry}
REGION: {region}
WEBSITE: {domain}
COMPETITORS: {competitors}

AGGREGATED VISIBILITY METRICS:
- Average Visibility (SOV): {overallSov}%
- Total Prompts Analyzed: {totalPrompts}
- Critical (<30% visibility): {highPriorityCount} prompts
- Needs Work (30-60%): {mediumPriorityCount} prompts
- Good (>60%): {lowPriorityCount} prompts

TOP COMPETITORS IN AI RESPONSES:
{topCompetitors}

MOST CITED DOMAINS BY AI:
{topDomains}

WEB SOURCE INSIGHTS (from Tavily):
{tavilyInsights}

Provide strategic, pinpoint recommendations to improve overall AI visibility for {brandName}:
```

---

## 2. DataForSEO Live LLM API Prompts

### 2.1 ChatGPT Query

**Endpoint:** `POST https://api.dataforseo.com/v3/content_generation/generate_live`

**Request Body:**
```json
{
  "text": "{prompt_text} [CONTEXT_{random_nonce}]",
  "internal_model": "gpt-4o",
  "max_tokens": 1500,
  "temperature": 0.7,
  "creativity_index": 0.5
}
```

**Note:** Random nonce added to prevent caching and ensure real-time inference.

### 2.2 Claude Query

```json
{
  "text": "{prompt_text} [ENTROPY_{timestamp}]",
  "internal_model": "claude-sonnet-4-20250514",
  "max_tokens": 1500,
  "temperature": 0.7
}
```

### 2.3 Gemini Query

```json
{
  "text": "{prompt_text}",
  "internal_model": "gemini-2.0-flash",
  "max_tokens": 1500,
  "temperature": 0.7
}
```

### 2.4 Perplexity Query

```json
{
  "text": "{prompt_text}",
  "internal_model": "sonar",
  "max_tokens": 1500
}
```

### 2.5 Location Intelligence Injection (New v2.7)

**Purpose**: Ensure AI models provide locally relevant pricing, currency, and brands (e.g., ₹ INR for India, local competitors).

**Logic**:
If `locationName` is present and NOT "United States":
1. Append context to `prompt_text`:
   ```text
   Respond with locally relevant information for {locationName}. Use local currency, local brands, and local pricing where applicable.
   ```
2. Thread this context through to all 4 Live LLM providers (ChatGPT, Claude, Gemini, Perplexity).

---

## 3. Response Parsing Logic

### 3.1 Brand Mention Detection

```typescript
function countBrandMentions(response: string, brandName: string, brandTags: string[]): number {
  const allTerms = [brandName, ...brandTags];
  const lowerResponse = response.toLowerCase();
  let totalCount = 0;

for (const term of allTerms) {
    const regex = new RegExp(term.toLowerCase(), 'gi');
    const matches = response.match(regex);
    if (matches) totalCount += matches.length;
  }
  
  return totalCount;
}
```

### 3.2 Brand Rank Detection

```typescript
function findBrandRank(response: string, brandTerms: string[]): number | null {
  const lines = response.split('\n');
  
  for (const line of lines) {
    // Match patterns like "1. Brand" or "1) Brand" or "[1] Brand"
    const match = line.match(/^\s*(\d+)[.)]\s*\*{0,2}(.+)/);
    
    if (match) {
      const rank = parseInt(match[1]);
      const content = match[2].toLowerCase();
      
      for (const term of brandTerms) {
        if (content.includes(term.toLowerCase())) {
          return rank;
        }
      }
    }
  }
  
  return null;
}
```

### 3.3 Citation Extraction

```typescript
function extractCitations(response: string): Array<{url: string, domain: string, title?: string}> {
  const citations = [];
  const urlRegex = /https?:\/\/[^\s<>"{}|\\^`\[\]]+/g;
  const matches = response.match(urlRegex);
  
  if (matches) {
    for (const url of matches) {
      const domain = new URL(url).hostname.replace('www.', '');
      citations.push({ url, domain });
    }
  }
  
  return citations;
}
```

---

**Document Metadata:**
- Total AI Integrations: 2 (Groq, DataForSEO)
- Total Unique Prompts: 10+
- Models Used: GPT-4o, Claude Sonnet 4, Gemini 2.0, Perplexity Sonar, Llama 3.1/3.3
