# Edge Functions - Complete Specification

**Runtime:** Deno (Supabase)  
**Total Functions:** 7  
**Language:** TypeScript

---

## 1. geo-audit (Core LLM Auditing)

**Path:** `supabase/functions/geo-audit/index.ts`  
**Size:** 87,730 bytes  
**Purpose:** Query multiple AI models and analyze brand visibility

### Request Schema
```typescript
{
  client_id: string;
  prompt_id: string;
  prompt_text: string;
  brand_name: string;
  brand_tags: string[];
  competitors: string[];
  location_code: number;
  models: string[]; // ['chatgpt', 'claude', 'gemini', 'perplexity', 'google_ai_overview']
  niche_level?: string;
  campaign_id?: string;
  save_to_db: boolean;
}
```

### Response Schema
```typescript
{
  success: boolean;
  data: {
    id: string;
    prompt_text: string;
    brand_name: string;
    summary: {
      share_of_voice: number;
      average_rank: number | null;
      total_citations: number;
      total_cost: number;
    };
    model_results: Array<{
      model: string;
      model_name: string;
      success: boolean;
      brand_mentioned: boolean;
      brand_mention_count: number;
      brand_rank: number | null;
      citations: Array<{url, title, domain}>;
      competitors_found: Array<{name, count, rank}>;
      api_cost: number;
      raw_response: string;
    }>;
    timestamp: string;
  };
  error?: string;
}
```

### API Integrations

**DataForSEO Live LLM:**
```typescript
// ChatGPT
POST https://api.dataforseo.com/v3/content_generation/generate_live
{
  "text": "{prompt} [CONTEXT_{nonce}]",
  "internal_model": "gpt-4o",
  "max_tokens": 1500,
  "temperature": 0.7
}

// Claude
{
  "internal_model": "claude-sonnet-4-20250514"
}

// Gemini
{
  "internal_model": "gemini-2.0-flash"
}

// Perplexity
{
  "internal_model": "sonar"
}
```

### Retry Logic
```typescript
async function fetchWithRetry(url, options, maxRetries = 3) {
  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      const response = await fetch(url, options);
      if (response.ok) return response;
      
      if (attempt < maxRetries) {
        const delay = Math.pow(2, attempt) * 1000; // Exponential backoff
        await new Promise(r => setTimeout(r, delay));
      }
    } catch (error) {
      if (attempt === maxRetries) throw error;
    }
  }
}
```

### Error Handling
- Network timeouts → Retry with backoff
- Rate limits → 429 status → Wait and retry
- Invalid responses → Mark as failed, continue with other models
- Database errors → Return error but don't fail entire audit

---

## 2. generate-content (Groq Content Generation)

**Path:** `backend/generate-content/index.ts`  
**Purpose:** Generate SEO-optimized content using Groq Llama models

### Request Schema
```typescript
{
  prompt: string;
  type: 'prompts' | 'article' | 'comparison' | 'guide' | 'faq' | 'visibility-content';
  brand_name?: string;
  competitors?: string[];
  system_prompt?: string;
}
```

### Response Schema
```typescript
{
  response: string; // Generated content in Markdown
  type: string;
  generatedAt: string;
}
```

### Groq API Call
```typescript
async function callGroq(prompt: string, systemPrompt: string) {
  const response = await fetch('https://api.groq.com/openai/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${GROQ_API_KEY}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      model: 'llama-3.1-8b-instant',
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: prompt }
      ],
      temperature: 0.7,
      max_tokens: 4096
    })
  });
  
  const data = await response.json();
  return data.choices?.[0]?.message?.content || '';
}
```

### Content Types
- `prompts` → Search query generation
- `article` → Long-form blog post
- `comparison` → Brand comparison page
- `guide` → How-to guide
- `visibility-content` → GEO-optimized content based on audit data

---

## 3. citation-analyzer (Deep Citation Intelligence)

**Path:** `supabase/functions/citation-analyzer/index.ts`  
**Purpose:** Analyze citations with Groq AI and generate recommendations

### Request Schema
```typescript
{
  audit_result_id: string;
  client_id: string;
  brand_name: string;
  competitors: string[];
  force_rerun?: boolean;
}
```

### Process Flow
1. **Fetch Citations** from `citations` table
2. **Verify URLs** (HTTP HEAD request)
3. **Extract Content** (via Tavily or direct fetch)
4. **Classify Category** (UGC, Press, Wikipedia, etc.)
5. **Determine Opportunity Level** (Easy/Medium/Difficult)
6. **Analyze with Groq** (generate insights)
7. **Generate Recommendations** (actionable content)
8. **Upsert to DB** (citation_intelligence + citation_recommendations)

### Classification Logic
```typescript
function classifyCitation(url: string, domain: string): {
  category: string;
  opportunity: string;
} {
  // UGC Platforms
  if (['reddit.com', 'quora.com', 'linkedin.com'].includes(domain)) {
    return { category: 'ugc', opportunity: 'easy' };
  }
  
  // Press/Media
  if (['forbes.com', 'techcrunch.com', 'wsj.com'].includes(domain)) {
    return { category: 'press_media', opportunity: 'medium' };
  }
  
  // Wikipedia
  if (domain === 'wikipedia.org') {
    return { category: 'wikipedia', opportunity: 'difficult' };
  }
  
  // Brand Owned
  if (url.includes(brandDomain)) {
    return { category: 'brand_owned', opportunity: 'easy' };
  }
  
  return { category: 'other', opportunity: 'medium' };
}
```

### Groq Analysis Prompt
```typescript
const ANALYSIS_SYSTEM_PROMPT = `You are a citation analysis expert. Analyze this URL and provide:
1. What this source discusses
2. Brand opportunity (specific tactics)
3. Competitor threat level
4. Recommended action (concrete next step)
5. Priority level and reason
6. Effort estimate
7. Success metric

Return JSON format.`;
```

---

## 4. tavily-search (Web Discovery Engine)

**Path:** `supabase/functions/tavily-search/index.ts`  
**Purpose:** Deep web search and content extraction

### Request Schema
```typescript
{
  client_id: string;
  prompt_id: string;
  prompt_text: string;
  brand_name: string;
  competitors: string[];
  search_depth: 'basic' | 'advanced';
  max_results: number;
  include_answer: boolean;
  save_to_db: boolean;
}
```

### Response Schema
```typescript
{
  success: boolean;
  sources: Array<{
    url: string;
    title: string;
    domain: string;
    content: string;
    score: number;
  }>;
  answer: string;
  analysis: {
    brand_mentioned: boolean;
    brand_mention_count: number;
    competitor_mentions: Record<string, number>;
    top_domains: Array<{domain, count}>;
    source_types: Record<string, number>;
    insights: string[];
  };
}
```

### Tavily API Call
```typescript
const response = await fetch('https://api.tavily.com/search', {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json'
  },
  body: JSON.stringify({
    api_key: TAVILY_API_KEY,
    query: prompt_text,
    search_depth: 'advanced',
    max_results: 20,
    include_answer: true,
    include_raw_content: true
  })
});
```

---

## 5. rss-ingestor (Fresh Content Detection)

**Path:** `supabase/functions/rss-ingestor/index.ts`  
**Purpose:** Poll RSS feeds and ingest fresh signals

### Request Schema
```typescript
{
  feed_id?: string; // Optional: process specific feed
  client_id?: string; // Optional: process all feeds for client
}
```

### Process Flow
1. **Fetch Active Feeds** from `rss_feeds`
2. **Parse RSS/Atom** feed XML
3. **Extract Items** (title, URL, published_at, content)
4. **Check Duplicates** (via `url_hash`)
5. **Detect Mentions** (brand + competitor keywords)
6. **Calculate Scores** (freshness, authority, relevance)
7. **Insert into `fresh_signals`**
8. **Update `last_polled_at`**

### Scoring Logic
```typescript
function calculateScores(item, feed) {
  const publishedDaysAgo = daysSince(item.published_at);
  
  // Freshness (decay over time)
  const freshness = Math.max(0, 1 - (publishedDaysAgo / 30));
  
  // Authority (lookup from domain_authority table)
  const authority = getDomainAuthority(item.domain) || 0.5;
  
  // Relevance (keyword match strength)
  const brandMatches = countKeywordMatches(item.content, feed.brand_keywords);
  const competitorMatches = countKeywordMatches(item.content, feed.competitor_keywords);
  const relevance = Math.min(1, (brandMatches + competitorMatches) / 10);
  
  // Influence (weighted formula)
  const influence = (authority * 0.4) + (freshness * 0.3) + (relevance * 0.3);
  
  return { freshness, authority, relevance, influence };
}
```

---

## 6. signal-scorer (Tavily Correlation)

**Path:** `supabase/functions/signal-scorer/index.ts`  
**Purpose:** Correlate fresh signals with Tavily search results

### Process Flow
1. **Fetch Unprocessed Signals** (`processing_status = 'pending'`)
2. **Run Tavily Search** for each signal's topic
3. **Check if Signal URL Appears** in Tavily results
4. **Record Correlation** in `signal_correlations`
5. **Classify Signal** (emerging/reinforcing/low_impact)
6. **Update `processing_status = 'processed'`**

### Classification Logic
```typescript
function classifySignal(signal, tavilyResults) {
  const appearsInTavily = tavilyResults.some(r => r.url === signal.url);
  
  if (appearsInTavily && signal.influence_score > 0.7) {
    return 'reinforcing'; // Already indexed, high influence
  } else if (!appearsInTavily && signal.influence_score > 0.6) {
    return 'emerging'; // Not yet indexed, likely to be
  } else {
    return 'low_impact';
  }
}
```

---

## 7. scheduler (Automation)

**Path:** `supabase/functions/scheduler/index.ts`  
**Purpose:** Run scheduled audits and RSS polling

### Triggered via Supabase Cron
```sql
SELECT cron.schedule(
  'run-scheduled-audits',
  '0 */6 * * *', -- Every 6 hours
  $$
  SELECT net.http_post(
    url:='https://your-project.supabase.co/functions/v1/scheduler',
    headers:='{"Authorization": "Bearer YOUR_ANON_KEY"}'::jsonb,
    body:='{"task": "scheduled_audits"}'::jsonb
  );
  $$
);
```

### Tasks
- `scheduled_audits` → Run audits for prompts with `scheduled_audit` flag
- `rss_polling` → Trigger `rss-ingestor` for all active feeds
- `signal_correlation` → Trigger `signal-scorer` for pending signals

---

## Environment Variables (All Functions)

```bash
# DataForSEO
DATAFORSEO_LOGIN=your-login
DATAFORSEO_PASSWORD=your-password

# Groq AI
GROQ_API_KEY=your-groq-key

# Tavily
TAVILY_API_KEY=your-tavily-key

# Supabase
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_ANON_KEY=your-anon-key
SUPABASE_SERVICE_KEY=your-service-key
```

---

**Deployment:**
```bash
npx supabase functions deploy geo-audit --project-ref YOUR_REF
npx supabase functions deploy generate-content --project-ref YOUR_REF
npx supabase functions deploy citation-analyzer --project-ref YOUR_REF
npx supabase functions deploy tavily-search --project-ref YOUR_REF
npx supabase functions deploy rss-ingestor --project-ref YOUR_REF
npx supabase functions deploy signal-scorer --project-ref YOUR_REF
npx supabase functions deploy scheduler --project-ref YOUR_REF
```
