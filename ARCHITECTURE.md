# Forzeo GEO Dashboard - Architecture

This document explains how every part of the system works in detail.

---

## Table of Contents

1. [System Overview](#system-overview)
2. [Data Flow](#data-flow)
3. [Scoring Formulas](#scoring-formulas)
4. [Frontend Architecture](#frontend-architecture)
5. [Backend Architecture](#backend-architecture)
6. [Database Schema](#database-schema)
7. [API Integration](#api-integration)

---

## System Overview

```
┌─────────────────────────────────────────────────────────────────┐
│                     USER'S BROWSER                              │
│  ┌─────────────────────────────────────────────────────────┐   │
│  │              React Frontend (ClientDashboard)            │   │
│  │  - Add/manage clients                                    │   │
│  │  - Add/import prompts                                    │   │
│  │  - View results & analytics                              │   │
│  │  - Export reports                                        │   │
│  └─────────────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────────────┘
                              │
                              │ HTTPS
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│                    SUPABASE BACKEND                             │
│  ┌─────────────────┐  ┌─────────────────┐  ┌───────────────┐   │
│  │   PostgreSQL    │  │  Edge Functions │  │   Storage     │   │
│  │   Database      │  │  (Deno Runtime) │  │   (Files)     │   │
│  │                 │  │                 │  │               │   │
│  │  - clients      │  │  - geo-audit    │  │  - logos      │   │
│  │  - prompts      │  │                 │  │  - exports    │   │
│  │  - results      │  │                 │  │               │   │
│  └─────────────────┘  └─────────────────┘  └───────────────┘   │
└─────────────────────────────────────────────────────────────────┘
                              │
                              │ API Calls
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│                    EXTERNAL APIs                                │
│  ┌─────────────────┐  ┌─────────────────┐                      │
│  │   DataForSEO    │  │   DataForSEO    │                      │
│  │   LLM Mentions  │  │   LIVE LLM      │                      │
│  │   (Cached)      │  │   (Real-time)   │                      │
│  │  $0.02/query    │  │  $0.05-0.10/q   │                      │
│  └─────────────────┘  └─────────────────┘                      │
│  ┌─────────────────┐  ┌─────────────────┐                      │
│  │   DataForSEO    │  │   DataForSEO    │                      │
│  │   Google SERP   │  │   AI Overview   │                      │
│  │  $0.002/query   │  │  $0.003/query   │                      │
│  └─────────────────┘  └─────────────────┘                      │
└─────────────────────────────────────────────────────────────────┘
```

---

## Data Flow

### When User Clicks "Run Audit"

```
Step 1: User clicks "Run" button
        ↓
Step 2: Frontend sends request to geo-audit Edge Function
        {
          prompt_text: "Best dating apps in India",
          brand_name: "Juleo",
          brand_tags: ["Juleo Club", "juleo.club"],
          competitors: ["Bumble", "Tinder"],
          models: ["chatgpt", "google_ai_overview"]
        }
        ↓
Step 3: Edge Function queries each AI model
        ├── DataForSEO LLM Mentions (cached) → If data exists
        ├── DataForSEO LIVE LLM (real-time) → If no cached data
        ├── DataForSEO AI Overview → Google's AI answer
        └── DataForSEO SERP → Google search results
        ↓
Step 4: Parse each response
        - Find brand mentions
        - Extract rank from numbered lists
        - Collect citation URLs
        - Detect competitor mentions
        ↓
Step 5: Calculate metrics
        - Share of Voice = mentioned_models / total_models
        - Average Rank = sum(ranks) / count(ranks)
        - Total Citations = count(unique_urls)
        ↓
Step 6: Save to Supabase database
        ↓
Step 7: Return results to frontend
        ↓
Step 8: Frontend updates dashboard
```

---

## Scoring Formulas

### Share of Voice (SOV)

**Formula:**
```
SOV = (Models where brand mentioned / Total successful models) × 100
```

**Example:**
```
Models tested: ChatGPT, Google AI, Perplexity
Results:
  - ChatGPT: Brand mentioned ✓
  - Google AI: Brand NOT mentioned ✗
  - Perplexity: Brand mentioned ✓

SOV = (2 / 3) × 100 = 67%
```

**Code:**
```typescript
const successfulResults = results.filter(r => r.success);
const visibleCount = successfulResults.filter(r => r.brand_mentioned).length;
const shareOfVoice = Math.round((visibleCount / successfulResults.length) * 100);
```

---

### Brand Rank Detection

**How it works:** We scan AI responses for numbered lists and find where your brand appears.

**Patterns we detect:**
```
1. Bumble          → Rank 1
2. Juleo           → Rank 2  (Your brand!)
3. Tinder          → Rank 3

Also works with:
1) Bumble
2) Juleo
[1] Bumble
[2] Juleo
```

**Code:**
```typescript
function findBrandRank(response: string, brandTerms: string[]): number | null {
  const lines = response.split('\n');
  
  for (const line of lines) {
    // Match patterns like "1. Brand" or "1) Brand" or "[1] Brand"
    const match = line.match(/^\s*(\d+)[.)\]]\s*\*{0,2}(.+)/);
    
    if (match) {
      const rank = parseInt(match[1]);
      const content = match[2].toLowerCase();
      
      // Check if any brand term appears in this line
      for (const term of brandTerms) {
        if (content.includes(term.toLowerCase())) {
          return rank;
        }
      }
    }
  }
  
  return null; // Brand not found in any numbered list
}
```

---

### Brand Mention Detection

**How it works:** Count all occurrences of brand name and alternative tags.

**Example:**
```
Brand Name: "Juleo"
Brand Tags: ["Juleo Club", "juleo.club"]

AI Response:
"Juleo is a great dating app. Juleo Club offers verified profiles.
Visit juleo.club for more information."

Result: 4 mentions (Juleo×2, Juleo Club×1, juleo.club×1)
```

**Code:**
```typescript
function countBrandMentions(response: string, brandName: string, brandTags: string[]): number {
  const allTerms = [brandName, ...brandTags];
  const lowerResponse = response.toLowerCase();
  let totalCount = 0;
  
  for (const term of allTerms) {
    const termLower = term.toLowerCase();
    let searchIndex = 0;
    
    while (true) {
      const foundIndex = lowerResponse.indexOf(termLower, searchIndex);
      if (foundIndex === -1) break;
      totalCount++;
      searchIndex = foundIndex + 1;
    }
  }
  
  return totalCount;
}
```

---

### Competitor Gap Analysis

**What it shows:** How your brand compares to competitors in AI responses.

**Example Output:**
```
┌─────────────────────────────────────────────────┐
│ Brand/Competitor    │ Mentions │ Share         │
├─────────────────────────────────────────────────┤
│ Bumble              │ 15       │ ████████ 40%  │
│ Juleo (You)         │ 10       │ █████ 27%     │
│ Tinder              │ 8        │ ████ 21%      │
│ Hinge               │ 5        │ ██ 12%        │
└─────────────────────────────────────────────────┘
```

**Code:**
```typescript
function calculateCompetitorGap(results: AuditResult[], brandName: string, competitors: string[]) {
  const mentions: Record<string, number> = {};
  mentions[brandName] = 0;
  competitors.forEach(c => mentions[c] = 0);
  
  // Count mentions across all results
  for (const result of results) {
    for (const modelResult of result.model_results) {
      const response = modelResult.raw_response.toLowerCase();
      
      // Count brand mentions
      if (modelResult.brand_mentioned) {
        mentions[brandName] += modelResult.brand_mention_count;
      }
      
      // Count competitor mentions
      for (const competitor of competitors) {
        const regex = new RegExp(competitor, 'gi');
        const matches = response.match(regex);
        if (matches) mentions[competitor] += matches.length;
      }
    }
  }
  
  // Calculate percentages
  const total = Object.values(mentions).reduce((a, b) => a + b, 0) || 1;
  
  return Object.entries(mentions)
    .map(([name, count]) => ({
      name,
      mentions: count,
      percentage: Math.round((count / total) * 100)
    }))
    .sort((a, b) => b.mentions - a.mentions);
}
```

---

### Citation Aggregation

**What it does:** Collects all URLs that AI models cite and groups them by domain.

**Example:**
```
AI Response includes links to:
- https://www.forbes.com/best-dating-apps
- https://www.forbes.com/dating-app-reviews
- https://techcrunch.com/dating-apps-2025

Result:
┌────────────────────────────────────────┐
│ Domain          │ Citations │ Prompts  │
├────────────────────────────────────────┤
│ forbes.com      │ 2         │ 3        │
│ techcrunch.com  │ 1         │ 1        │
└────────────────────────────────────────┘
```

**Code:**
```typescript
function aggregateCitations(results: AuditResult[]) {
  const citationMap = new Map<string, {
    url: string;
    title: string;
    domain: string;
    count: number;
    prompts: string[];
  }>();
  
  for (const result of results) {
    for (const modelResult of result.model_results) {
      for (const citation of modelResult.citations) {
        const key = citation.url;
        
        if (citationMap.has(key)) {
          const existing = citationMap.get(key)!;
          existing.count++;
          if (!existing.prompts.includes(result.prompt_text)) {
            existing.prompts.push(result.prompt_text);
          }
        } else {
          citationMap.set(key, {
            url: citation.url,
            title: citation.title,
            domain: citation.domain,
            count: 1,
            prompts: [result.prompt_text]
          });
        }
      }
    }
  }
  
  return Array.from(citationMap.values())
    .sort((a, b) => b.count - a.count);
}
```

---

## Frontend Architecture

### Component Structure (v6.1)

```
ClientDashboard.tsx
│
├── Sidebar Navigation (Collapsible)
│   ├── Toggle Button (PanelLeft/PanelLeftClose icons)
│   ├── Logo & Brand
│   ├── Client Selector (dropdown with add client)
│   ├── Navigation Items
│   │   ├── Overview (Home icon)
│   │   ├── Prompts (MessageSquare icon)
│   │   ├── Citations (Link2 icon)
│   │   ├── Sources (Globe icon)
│   │   └── Content (Sparkles icon)
│   └── Settings Button (bottom)
│
├── Main Content Area
│   │
│   ├── Header Bar
│   │   ├── Page Title
│   │   ├── Date Range Filter (functional)
│   │   ├── Model Filter (multi-select)
│   │   ├── Export Button (JSON full audit)
│   │   └── Run All Audits Button
│   │
│   ├── Overview Tab
│   │   ├── Metric Cards (SOV, Rank, Citations, Cost)
│   │   ├── Visibility by Model (bar chart with MODEL_LOGOS)
│   │   ├── Competitor Gap (horizontal bars with BrandLogo)
│   │   ├── Top Sources (list with domain icons)
│   │   └── AI Insights & Recommendations
│   │
│   ├── Prompts Tab
│   │   ├── Sub-tabs (Active/Suggested/Inactive)
│   │   ├── Add Prompt Input
│   │   ├── Bulk Add Button
│   │   └── Prompts Table (with Run/View/Delete actions)
│   │
│   ├── Citations Tab
│   │   ├── Citation Stats Cards
│   │   └── Citations Table (URL, Domain, Model, COUNT column)
│   │
│   ├── Sources Tab
│   │   ├── Sources Bar Chart (pixel-based heights)
│   │   ├── Domains/URLs Toggle
│   │   └── Sources Table (with prompt info)
│   │
│   └── Content Tab
│       ├── Topic Input
│       ├── Content Type Selector (article, listicle, guide, FAQ, comparison)
│       ├── Generate Button
│       └── Generated Content Display (markdown)
│
└── Dialogs/Sheets
    ├── Prompt Detail Dialog (full audit results)
    ├── Add Client Dialog
    ├── Bulk Prompts Dialog
    └── Settings Sheet
        ├── Brand Settings (name, tags)
        ├── Competitors (with BrandLogo icons)
        └── AI Models (with MODEL_LOGOS icons)
```

### Key Components

| Component | Purpose |
|-----------|---------|
| `MODEL_LOGOS` | AI model icons with brand colors (ChatGPT green, Claude orange, etc.) |
| `BrandLogo` | Brand/competitor logo component with fallback initials |
| `useClientDashboard` | Central state management hook with Supabase integration |

### State Management

All state is managed in the `useClientDashboard` hook:

```typescript
// Core Data
clients: Client[]              // All clients
selectedClient: Client | null  // Currently selected
prompts: Prompt[]              // Current client's prompts
auditResults: AuditResult[]    // Current client's results
summary: DashboardSummary      // Aggregated metrics

// UI State
selectedModels: string[]       // Which AI models to use
loading: boolean               // Global loading state
loadingPromptId: string | null // Which prompt is being audited
error: string | null           // Error message
```

### Data Persistence

**Before (localStorage):**
- Data was stored in browser
- Lost when clearing browser data
- Not shared across devices/tabs

**After (Supabase):**
- Data stored in PostgreSQL database
- Persists forever
- Shared across all devices
- Real-time sync possible

---

## Backend Architecture

### geo-audit Edge Function

**Location:** `backend/geo-audit/index.ts`

**Purpose:** Query multiple AI models and analyze responses for brand visibility.

**Request:**
```typescript
{
  client_id: string;
  prompt_id: string;
  prompt_text: string;
  brand_name: string;
  brand_tags: string[];
  competitors: string[];
  location_code: number;
  models: string[];
}
```

**Response:**
```typescript
{
  success: true,
  data: {
    prompt_text: string;
    brand_name: string;
    summary: {
      share_of_voice: number;
      average_rank: number | null;
      total_citations: number;
      total_cost: number;
    };
    model_results: [{
      model: string;
      model_name: string;
      success: boolean;
      brand_mentioned: boolean;
      brand_mention_count: number;
      brand_rank: number | null;
      citations: Array<{url, title, domain}>;
      api_cost: number;
      raw_response: string;
    }];
    timestamp: string;
  }
}
```

### generate-content Edge Function

**Location:** `backend/generate-content/index.ts`

**Purpose:** Generate SEO-optimized content using Groq's Llama model.

**Request:**
```typescript
{
  prompt: string;
  type: "article" | "listicle" | "comparison" | "guide" | "faq";
  brand_name?: string;
  competitors?: string[];
}
```

**Response:**
```typescript
{
  response: string;  // Generated content in Markdown
  type: string;
  generatedAt: string;
}
```

---

## Database Schema

### Supabase Dashboard Links

**View your data directly in Supabase:**

| Table | Dashboard Link |
|-------|----------------|
| Audit Results | https://supabase.com/dashboard/project/pqvyyziaczzgaythgpyc/editor/audit_results |
| Citations | https://supabase.com/dashboard/project/pqvyyziaczzgaythgpyc/editor/forzeo_citations |
| API Usage | https://supabase.com/dashboard/project/pqvyyziaczzgaythgpyc/editor/forzeo_api_usage |
| Clients | https://supabase.com/dashboard/project/pqvyyziaczzgaythgpyc/editor/clients |
| Prompts | https://supabase.com/dashboard/project/pqvyyziaczzgaythgpyc/editor/forzeo_prompts |

**Edge Function Logs:**
https://supabase.com/dashboard/project/pqvyyziaczzgaythgpyc/functions/geo-audit/logs

### Tables Overview

```
┌─────────────────┐     ┌─────────────────┐     ┌─────────────────┐
│    clients      │────<│ forzeo_prompts  │     │  audit_results  │
├─────────────────┤     ├─────────────────┤     ├─────────────────┤
│ id              │     │ id              │     │ id              │
│ name            │     │ client_id       │────>│ client_id       │
│ brand_name      │     │ prompt_text     │     │ prompt_id       │
│ brand_tags[]    │     │ category        │     │ prompt_text     │
│ slug            │     │ is_active       │     │ brand_name      │
│ target_region   │     │ created_at      │     │ share_of_voice  │
│ location_code   │     └─────────────────┘     │ visibility_score│
│ industry        │                             │ model_results   │
│ competitors[]   │     ┌─────────────────┐     │ top_sources     │
│ primary_color   │     │forzeo_citations │     │ total_cost      │
│ created_at      │     ├─────────────────┤     │ created_at      │
└─────────────────┘     │ id              │     └─────────────────┘
                        │ audit_result_id │            │
                        │ url             │<───────────┘
                        │ domain          │
                        │ model           │     ┌─────────────────┐
                        │ is_brand_source │     │forzeo_api_usage │
                        │ created_at      │     ├─────────────────┤
                        └─────────────────┘     │ id              │
                                                │ client_id       │
                                                │ api_name        │
                                                │ cost            │
                                                │ models_used[]   │
                                                │ created_at      │
                                                └─────────────────┘
```

### audit_results Table (Main Storage)

This is where all LLM responses and analysis results are stored.

```sql
CREATE TABLE audit_results (
  id UUID PRIMARY KEY,
  client_id UUID,                    -- Links to clients table
  prompt_id UUID,                    -- Links to prompts table
  prompt_text TEXT NOT NULL,         -- "Best dating apps in India 2025"
  prompt_category TEXT,              -- "custom", "niche", "super_niche"
  brand_name TEXT,                   -- "Juleo"
  brand_tags TEXT[],                 -- ["Juleo Club", "juleo.club"]
  competitors TEXT[],                -- ["Bumble", "Tinder", "Hinge"]
  models_used TEXT[],                -- ["chatgpt", "gemini", "google_ai_overview"]
  share_of_voice INTEGER,            -- 0-100 percentage
  visibility_score INTEGER,          -- Weighted visibility score
  trust_index INTEGER,               -- Citation authority score
  average_rank DECIMAL(5,2),         -- Average rank in AI responses
  total_models_checked INTEGER,      -- Number of models queried
  visible_in INTEGER,                -- Models where brand was mentioned
  cited_in INTEGER,                  -- Models where brand was cited
  total_citations INTEGER,           -- Total citation count
  total_cost DECIMAL(10,6),          -- API cost for this audit
  model_results JSONB,               -- Full response data from each model
  top_sources JSONB,                 -- Top cited domains
  top_competitors JSONB,             -- Competitor mention analysis
  summary JSONB,                     -- Aggregated summary metrics
  created_at TIMESTAMPTZ             -- When the audit was run
);
```

**model_results JSONB structure:**
```json
[
  {
    "model": "chatgpt",
    "model_name": "ChatGPT",
    "provider": "OpenAI",
    "success": true,
    "brand_mentioned": true,
    "brand_mention_count": 3,
    "brand_rank": 2,
    "brand_sentiment": "positive",
    "winner_brand": "Bumble",
    "competitors_found": [
      {"name": "Bumble", "count": 5, "rank": 1},
      {"name": "Tinder", "count": 3, "rank": 3}
    ],
    "citations": [
      {"url": "https://example.com", "title": "...", "domain": "example.com"}
    ],
    "citation_count": 5,
    "api_cost": 0.0001,
    "raw_response": "Full AI response text...",
    "response_length": 2500
  }
]
```

### forzeo_citations Table

Stores individual citations for fast querying and analysis.

```sql
CREATE TABLE forzeo_citations (
  id UUID PRIMARY KEY,
  audit_result_id UUID,              -- Links to audit_results
  client_id UUID,                    -- Links to clients
  url TEXT NOT NULL,                 -- Full citation URL
  title TEXT,                        -- Page title
  domain TEXT NOT NULL,              -- Domain name
  position INTEGER,                  -- Position in results
  snippet TEXT,                      -- Text snippet
  model TEXT NOT NULL,               -- Which model cited this
  is_brand_source BOOLEAN,           -- Is this the brand's own site?
  created_at TIMESTAMPTZ
);
```

### forzeo_api_usage Table

Tracks API costs and usage for billing/monitoring.

```sql
CREATE TABLE forzeo_api_usage (
  id UUID PRIMARY KEY,
  organization_id UUID,
  client_id UUID,
  api_name TEXT NOT NULL,            -- "geo_audit", "generate_content"
  endpoint TEXT,                     -- "/geo-audit"
  request_count INTEGER,             -- Number of requests
  cost DECIMAL(10,6),                -- Total cost
  prompt_text TEXT,                  -- The prompt that was run
  models_used TEXT[],                -- Models used in this request
  created_at TIMESTAMPTZ
);
```

### clients Table

```sql
CREATE TABLE clients (
  id UUID PRIMARY KEY,
  name TEXT NOT NULL,                -- "Juleo Club"
  brand_name TEXT NOT NULL,          -- "Juleo"
  brand_tags TEXT[],                 -- ["Juleo Club", "juleo.club"]
  slug TEXT,                         -- "juleo"
  target_region TEXT,                -- "India"
  location_code INTEGER,             -- 2356 (DataForSEO location code)
  industry TEXT,                     -- "Dating/Matrimony"
  competitors TEXT[],                -- ["Bumble", "Tinder"]
  primary_color TEXT,                -- "#ec4899"
  created_at TIMESTAMPTZ
);
```

### forzeo_prompts Table

```sql
CREATE TABLE forzeo_prompts (
  id UUID PRIMARY KEY,
  client_id UUID,
  prompt_text TEXT NOT NULL,         -- "Best dating apps in India"
  category TEXT,                     -- "niche", "super_niche", "custom"
  is_custom BOOLEAN,
  is_active BOOLEAN,
  created_at TIMESTAMPTZ
);
```

---

## API Integration

### 2-Tier Data Source System

```
┌─────────────────────────────────────────────────────────────────────┐
│                        geo-audit Edge Function                       │
│                                                                      │
│  LIVE LLM APIs (Provider-Specific - Primary)                        │
│     └── ChatGPT  → /content_generation/generate_live (OpenAI)       │
│     └── Gemini   → /content_generation/generate_live (Google)       │
│     └── Claude   → /content_generation/generate_live (Anthropic)    │
│     └── Perplexity → /content_generation/generate_live (Perplexity) │
│     └── Real-time inference from actual AI providers                │
│     └── Entropy/nonce to prevent caching                            │
│     └── Retry logic with exponential backoff                        │
│     └── Cost: ~$0.05-0.10/query per model                           │
│                                                                      │
│  GOOGLE APIs (Always queried):                                      │
│     └── Google AI Overview (DataForSEO)                             │
│     └── Google SERP (DataForSEO)                                    │
└─────────────────────────────────────────────────────────────────────┘
```

### LIVE LLM API Implementation

Each AI model is queried via DataForSEO's provider-specific LIVE endpoints:

**Endpoint:** `POST https://api.dataforseo.com/v3/content_generation/generate_live`

**Provider-Specific Models:**
| Model | internal_model Parameter |
|-------|--------------------------|
| ChatGPT | `gpt-4o` |
| Gemini | `gemini-2.0-flash` |
| Claude | `claude-sonnet-4-20250514` |
| Perplexity | `sonar` |

**Features:**
- Real-time inference from actual AI providers (not simulated)
- Each model uses its native API through DataForSEO
- Entropy/nonce added to prompts to prevent caching
- Sequential queries with delays to avoid rate limits

**Example Request:**
```json
{
  "text": "Best dating apps in India 2025",
  "internal_model": "gpt-4o",
  "max_tokens": 1500,
  "temperature": 0.7,
  "creativity_index": 0.5
}
```

**Cost:** ~$0.05-0.10 per query per model

### Supported AI Models

| Model | Provider | API Endpoint | internal_model | Cost |
|-------|----------|--------------|----------------|------|
| ChatGPT | OpenAI | content_generation/generate_live | gpt-4o | ~$0.05-0.10 |
| Claude | Anthropic | content_generation/generate_live | claude-sonnet-4-20250514 | ~$0.05-0.10 |
| Gemini | Google | content_generation/generate_live | gemini-2.0-flash | ~$0.05-0.10 |
| Perplexity | Perplexity AI | content_generation/generate_live | sonar | ~$0.05-0.10 |
| Google AI Overview | DataForSEO | serp/google/ai_overview/live | N/A | ~$0.003 |
| Google SERP | DataForSEO | serp/google/organic/live | N/A | ~$0.002 |

**All LLM models use LIVE provider-specific APIs for real-time responses.**

### DataForSEO - Google SERP

**Endpoint:** `POST https://api.dataforseo.com/v3/serp/google/organic/live/advanced`

**What it returns:** Google search results including:
- Organic results (titles, URLs, snippets)
- Featured snippets
- People Also Ask questions
- Related searches

**Cost:** ~$0.002 per query

**Example Request:**
```json
{
  "keyword": "Best dating apps in India 2025",
  "location_code": 2356,
  "language_code": "en",
  "device": "desktop",
  "depth": 30
}
```

### DataForSEO - AI Overview

**Endpoint:** `POST https://api.dataforseo.com/v3/serp/google/ai_overview/live/advanced`

**What it returns:** Google's AI-generated answer including:
- AI summary text
- Referenced sources
- Related questions

**Cost:** ~$0.003 per query

---

## Cost Breakdown

| Action | Models | Cost |
|--------|--------|------|
| Single prompt (4 LLM models) | ChatGPT + Gemini + Claude + Perplexity | ~$0.20-0.40 |
| Google AI Overview | 1 query | ~$0.003 |
| Google SERP | 1 query | ~$0.002 |

**Typical costs:**
- 10 prompts (4 models each): ~$2.00-4.00
- 100 prompts (4 models each): ~$20-40

---

## How to Check Your Data

### 1. Supabase Dashboard (Recommended)

Open the Supabase Table Editor to view all stored data:

**Audit Results (main data):**
https://supabase.com/dashboard/project/pqvyyziaczzgaythgpyc/editor/audit_results

**Citations:**
https://supabase.com/dashboard/project/pqvyyziaczzgaythgpyc/editor/forzeo_citations

**API Usage/Costs:**
https://supabase.com/dashboard/project/pqvyyziaczzgaythgpyc/editor/forzeo_api_usage

### 2. Edge Function Logs

View real-time logs from the geo-audit function:
https://supabase.com/dashboard/project/pqvyyziaczzgaythgpyc/functions/geo-audit/logs

### 3. REST API Queries

Query data directly via REST API:

```bash
# Get latest audit results
curl "https://pqvyyziaczzgaythgpyc.supabase.co/rest/v1/audit_results?select=*&order=created_at.desc&limit=10" \
  -H "apikey: YOUR_ANON_KEY" \
  -H "Authorization: Bearer YOUR_ANON_KEY"

# Get all citations
curl "https://pqvyyziaczzgaythgpyc.supabase.co/rest/v1/forzeo_citations?select=*&limit=100" \
  -H "apikey: YOUR_ANON_KEY"

# Get API usage/costs
curl "https://pqvyyziaczzgaythgpyc.supabase.co/rest/v1/forzeo_api_usage?select=*" \
  -H "apikey: YOUR_ANON_KEY"
```

### 4. SQL Queries in Supabase

Run custom SQL queries at:
https://supabase.com/dashboard/project/pqvyyziaczzgaythgpyc/sql/new

**Example queries:**

```sql
-- Get total cost by date
SELECT 
  DATE(created_at) as date,
  COUNT(*) as audits,
  SUM(total_cost) as total_cost
FROM audit_results
GROUP BY DATE(created_at)
ORDER BY date DESC;

-- Get top performing prompts (highest SOV)
SELECT 
  prompt_text,
  share_of_voice,
  visibility_score,
  brand_name
FROM audit_results
WHERE share_of_voice > 50
ORDER BY share_of_voice DESC
LIMIT 10;

-- Get most cited domains
SELECT 
  domain,
  COUNT(*) as citation_count
FROM forzeo_citations
GROUP BY domain
ORDER BY citation_count DESC
LIMIT 20;
```

---

## Data Retention & Deletion Behavior

### Prompt Deletion
When a prompt is deleted from the dashboard:

| Action | Behavior |
|--------|----------|
| Prompt record | Deleted from `forzeo_prompts` table |
| Audit results | **Kept in database** for historical tracking |
| UI display | Removed from active prompts list |
| Summary metrics | Recalculated based on remaining active prompts |

**Why keep audit results?**
- Historical tracking of brand visibility over time
- Cost tracking and API usage history
- Trend analysis and reporting
- Audit trail for compliance

### Clear All Prompts
When "Clear All Prompts" is used:
- All prompts for the client are deleted from database
- Audit results remain in database for historical reference
- UI is cleared (prompts and results removed from view)
- Summary is reset to null

### Accessing Historical Data
Even after prompts are deleted, you can still access historical audit results:
- Via Supabase Dashboard: https://supabase.com/dashboard/project/pqvyyziaczzgaythgpyc/editor/audit_results
- Via SQL queries filtering by `client_id` and date range
- Via REST API with appropriate filters

---

## Security

### API Keys
- Stored in Supabase Edge Function secrets
- Never exposed to frontend
- Accessed via `Deno.env.get("KEY_NAME")`

### Database Security
- Row Level Security (RLS) enabled
- Users can only access their own data
- All queries filtered by organization_id

### CORS
- Edge functions include proper CORS headers
- Only allows requests from authorized origins

---

## Performance

### Parallel API Calls
All AI models are queried simultaneously:
```typescript
const results = await Promise.all([
  queryGoogleSERP(prompt),
  queryGoogleAIOverview(prompt),
  queryGroq(prompt)
]);
```

### Caching
- Results stored in Supabase
- Same prompt won't be re-audited unless manually triggered
- Client data cached in React state

### Lazy Loading
- Only load data for selected client
- Switching clients triggers fresh data fetch
