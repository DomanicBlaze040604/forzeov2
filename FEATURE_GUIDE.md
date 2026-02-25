# Forzeo Platform - Feature Architecture & Logic Guide

This document provides a detailed technical explanation of the core features, algorithms, and logic powering the Forzeo Dashboard.

---

## 1. Geo-Audit Engine (Live AI Analysis)

The Geo-Audit Engine is the core mechanism for tracking "Share of Voice" across major LLMs.

### How It Works
1.  **Request**: User initiates an audit for a specific query (e.g., "Best CRM for small business").
2.  **Live Inference**: The system calls **DataForSEO's Live LLM API**. This is *not* a cached database; it triggers real-time inference on the actual models:
    *   **ChatGPT**: via OpenAI GPT-4o
    *   **Gemini**: via Google Gemini 1.5 Pro
    *   **Claude**: via Anthropic Claude 3.5 Sonnet
    *   **Perplexity**: via Perplexity Online
3.  **Parsing & Scoring**: The raw text response is parsed to calculate metrics:
    *   **Rank**: The position of the brand in the list (1-10).
    *   **Share of Voice (SOV)**: Percentage of models that mentioned the brand.
    *   **Recommendation**: A generated "Top Recommendation" based on the brand's presence (or lack thereof).

### Database Schema
*   `audit_results`: Stores the high-level metrics (rank, sov, citations_count) for a specific run.
*   `citations`: Parses URLs linked in the AI response and stores them linked to the audit.

---

## 2. Citation Intelligence Engine

The Citation Intelligence system analyzes the *sources* that AI models use to construct their answers. It combines **Forzeo Discovery Engine** (powered by Tavily) and **Groq (Llama 3.1)** for deep analysis.

### A. Discovery Engine (Deep Analysis)
*   **Provider**: Forzeo Discovery Engine (via Tavily API).
*   **Function**: When "Deep Analysis" is enabled, the system visits every citation URL extracted from the audit.
*   **Extraction**: It extracts the **raw page content** (text), not just metadata. This allows the AI to "read" the full article, forum thread, or review.

### B. Intelligent Classification Logic
The system automatically classifies every URL into a category to determine the "Opportunity Level".

| Category | Typical Domains | Opportunity Level | Logic |
| :--- | :--- | :--- | :--- |
| **Brand Owned** | Client's own domain | **Easy** | You control this content directly. |
| **Competitor** | Competitor blogs/sites | **Easy** | High priority to create distinct counter-content or comparisons. |
| **UGC / Social** | Reddit, Quora, LinkedIn | **Easy** | You can reply directly to the thread or discussion. |
| **Press & Media** | Forbes, TechCrunch | **Medium** | Requires PR outreach or relationship building. |
| **App Store** | Google Play, App Store | **Medium** | Requires optimization of store listing or review management. |
| **Wikipedia** | wikipedia.org | **Difficult** | Highly regulated; edits are often rejected/reverted. |
| **Other** | Anything else | **Medium** | General outreach required. |

### C. Opportunity Scoring
The logic (`determineOpportunityLevel`) assigns a difficulty score to help users prioritize:
*   **Easy Wins**: Sources where action is immediate (e.g., posting a reply on Reddit, fixing your own landing page).
*   **Medium Effort**: Sources requiring some coordination (e.g., emailing a journalist, updating an app store description).
*   **Difficult**: Sources with high barriers to entry (e.g., Wikipedia).

### D. Upsert & Re-Run Logic
To prevent duplicate data when re-running analysis:
1.  The system checks for an existing `citation_intelligence` record matching the `audit_result_id` AND `url`.
2.  **Upsert**: If found, it updates the existing record with new analysis. If not, it inserts a new one.
3.  **Recommendations**: Old recommendations for that specific citation are cleared and regenerated to ensure advice is strictly current.

---

## 3. Citation Verification Engine (Truth Layer)

The Citation Verification Engine determines whether AI-cited URLs actually support the claims made — detecting hallucinated citations.

### How It Works
1. **Fetch Page Content**: Uses [Jina Reader](https://r.jina.ai/) to fetch the full text of each cited URL.
2. **Semantic Similarity**: Sends the fetched content + the original AI prompt to Groq LLM to compute a similarity score (0.0–1.0).
3. **Status Assignment**:
   | Score | Status | Meaning |
   |-------|--------|---------|
   | > 0.85 + entity match | ✅ `verified` | URL genuinely supports the claim |
   | 0.50 – 0.84 | ⚠️ `partially_verified` | Loosely related content |
   | < 0.50 or fetch failure | ❌ `hallucinated` | URL does not support the claim |

### Performance Optimizations
- **24-Hour Caching**: Results cached per URL in `citation_intelligence` table — no redundant API calls.
- **Retry Logic**: Exponential backoff on Groq API 429 (rate limit) errors.
- **Batch Processing**: Citations processed in batches of 10 with progress tracking.

### Database Columns Added
| Column | Type | Description |
|--------|------|-------------|
| `verification_status` | text | `verified`, `partially_verified`, `hallucinated`, `pending`, `error` |
| `similarity_score` | float | 0.0–1.0 semantic similarity |
| `matched_paragraph` | text | Excerpt from page that matched the claim |
| `page_fetch_status` | int | HTTP status code from Jina Reader |
| `page_content` | text | First 5,000 chars of fetched page (for hover preview) |
| `verified_at` | timestamp | When verification was last run |

### Edge Function: `verify-citations`
- **Runtime**: Deno (Supabase Edge Functions)
- **APIs Used**: Jina Reader (content fetch), Groq LLM (similarity scoring)
- **Auth**: `verify_jwt = false` (called from frontend with service role)

---

## 4. Citation Categorization Engine

Enhanced AI-powered categorization using **Google Gemini 2.0 Flash** (via OpenRouter) to classify every citation domain into one of 12 precise categories, with a post-processing safety net for guaranteed accuracy.

### Model
- **Provider**: OpenRouter API
- **Model**: `google/gemini-2.0-flash-001` (primary), falls back to `qwen/qwen3.5-397b-a17b`
- **Domain Normalization**: Automatically strips `www.` prefix to ensure consistency across citations and aggregate metrics.
- **Temperature**: 0.0 (deterministic)

### Categories
| Category | Examples |
|----------|---------|
| `editorial` | Forbes, TechCrunch, industry blogs |
| `ugc` | Reddit, Quora, forums |
| `social` | LinkedIn, Twitter, Facebook, YouTube, Instagram |
| `ecommerce` | Amazon, Flipkart, online retailers |
| `competitor` | Competitor brand websites |
| `owned` | Client's own domain |
| `reference` | Wikipedia, Wikia |
| `press` | PR Newswire, press releases |
| `institutional` | .gov, .edu, .org domains |
| `review` | Product review sites |
| `local` | Google Maps, Yelp, local directories |
| `other` | Everything else |

### Post-Processing Safety Net
The edge function applies **regex-based enforcement rules** after AI classification to guarantee accuracy:
- `facebook.com`, `youtube.com`, `instagram.com`, `twitter.com`, `linkedin.com` → **social** (always)
- `reddit.com`, `quora.com`, `stackoverflow.com` → **ugc** (always)
- `wikipedia.org` → **reference** (always)
- Brand's own domain → **owned** (always)
- Known competitor domains → **competitor** (always)

### Batch Processing
- **Frontend Batch Size**: 40 domains per edge function call (matches edge function capacity)
- **Concurrency**: 2 parallel batches
- **Inter-round Delay**: 500ms between rounds
- **Domain Normalization**: AI-returned domains are normalized by stripping `www.` prefixes to match internal records perfectly.
- **Retry Logic**: Failed batches retry once after 3s delay (handles 503 rate limiting)

### Auto-Categorization
- **On Page Load**: Automatically categorizes any uncategorized domains
- **On Audit Completion**: Fire-and-forget categorization of new domains after each audit
- **Manual Button**: "Categorize with AI" button re-classifies ALL domains (overwriting previous values)
- **Progress Bar**: Shared progress tracking for both auto and manual categorization

### Edge Function: `categorize-citations`
- **Runtime**: Deno (Supabase Edge Functions)
- **API**: OpenRouter (Gemini 2.0 Flash)
- **Inputs**: `domains[]`, `brand_name`, `brand_domain`, `competitors[]`
- **Output**: JSON map of `{ domain: { category, source_type, authority_tier, relationship_type } }`

### D. pg_cron Verification Pipeline Integration
When domains are categorized, the system now automatically feeds them into the verification pipeline:
- **New domains**: Written with `verification_status: 'pending'` so the pg_cron job (`invoke-verify-citations`, runs every 5 minutes) picks them up immediately for content fetching and semantic similarity scoring.
- **Re-categorized domains**: Uses a spread (`...existingMeta`) before writing new category fields, so `verification_status`, `similarity_score`, `matched_paragraph`, and `page_content` are **preserved** — re-categorization never overwrites verification results.

This creates a fully automated pipeline: **Audit → Categorize → Verify** with zero manual steps.

---

## 5. Hover Content Preview

The Citations tab features an intelligent hover preview that shows page content without requiring users to visit links.

### Behavior
- **Trigger**: Hover over any domain or URL row for **400ms** (delay prevents accidental popups during scrolling)
- **Position**: Preview appears to the left of the table, within viewport bounds
- **Animation**: Smooth 200ms fade-in

### Preview Contents
1. **Domain favicon** + domain name + full URL
2. **Verification status badge** (Verified / Partial / Hallucinated)
3. **Page content preview** (first 1,500 characters from cached `page_content`)
4. **Matched evidence** paragraph (highlighted in blue)
5. **Confidence score** percentage
6. **"Open full page"** link

### States
- **Loading**: Spinner while fetching from database
- **No Content**: Shown when "Verify Citations" hasn't been run yet — prompts user to run verification
- **Content**: Full preview with all metadata

---


Campaigns allow users to batch process hundreds of prompts to get an aggregate view of brand performance.

### Logic Flow
1.  **Initialization**: User defines a "Campaign" (e.g., "Q1 Competitor Analysis") and selects a list of prompts.
2.  **Sequential Execution**: The system iterates through prompts, triggering the `geo-audit` function for each.
3.  **Aggregation**:
    *   **Global SOV**: Average Share of Voice across all prompts in the campaign.
    *   **Citations**: All unique citations are collected into a master list.
    *   **Competitor Leaderboard**: Counts how often each competitor appears across the entire campaign context.

### Integration
*   **Tavily Integration**: Campaigns now support the "Deep Analysis" toggle. If enabled, the `geo-audit` function will also trigger the discovery engine for every single result in the campaign (Warning: High API usage).

---

## 7. Citation Intelligence - Advanced UI/UX Features

The Citation Intelligence dashboard offers a comprehensive suite of personalization and data management tools.

### A. Delete Functionality
**Individual Delete:**
- Red trash icon on each table row
- Confirmation dialog prevents accidental deletions
- Real-time UI updates after deletion

**Bulk Delete:**
- Multi-select via checkboxes on each row
- "Select All" checkbox in table header
- Bulk action bar displays selected count
- One-click "Delete Selected" button

### B. Advanced Filtering System
**Four-Tier Filtering:**
1. **Category Filter**: UGC, Competitor, Press, App Stores, Wikipedia, Brand Owned, Other
2. **Status Filter**: Verified, Hallucinated, Unknown
3. **Model Filter**: Dynamic list based on available models (ChatGPT, Gemini, Claude, Perplexity)
4. **Search Filter**: Live search across URL, domain, and title fields

**Features:**
- Filters apply cumulatively for precise data narrowing
- "Clear All" button for instant reset
- Visual indicators for active filters
- Integrates with opportunity level filtering from overview cards

### C. Sortable Columns
**Click-to-Sort Headers:**
- All columns support ascending/descending sort
- Visual indicators: `↕` (unsorted), `⌃` (asc), `⌄` (desc)
- Hover effects for discoverability
- Auto-resets pagination to page 1 on sort

**Sortable Fields:**
- Status, URL/Domain, Category, Model, Opportunity Level

### D. Pagination Controls
**Smart Pagination:**
- Page number buttons with intelligent truncation (shows 5 pages max)
- Previous/Next navigation with disabled states
- Result counter: "Showing X to Y of Z results"

**Items Per Page Selector:**
- Options: 10, 25, 50, 100 items per page
- Default: 25 items
- Auto-resets to page 1 on change

### E. Column Visibility Toggles
**Customizable Table View:**
- "Columns" button in toolbar opens settings dropdown
- Checkbox list for each column (Status, URL, Category, Model, Opportunity)
- Hide/show columns dynamically
- Headers and cells both respect visibility settings

### F. Saved Filter Presets
**Save Current State:**
- "Save Preset" button appears when filters are active
- User-defined preset names for easy identification
- Stores complete filter configuration

**Load Presets:**
- "Load Preset..." dropdown in toolbar
- One-click restoration of saved filter combinations
- Success notifications on load

### G. Export Functionality
**Comprehensive TXT Reports:**
- "Export Report" button in header (next to "Analyze Citations")
- Respects current active filters
- Auto-generates filename: `citation-intelligence-{clientId}-{date}.txt`

**Report Contents:**
- Summary statistics (verified/hallucinated breakdown with percentages)
- Category distribution with citation counts
- Opportunity level analysis (Easy/Medium/Difficult breakdown)
- Top 10 recommendations with priority levels
- Detailed citation list with full metadata

### H. Discovery Toggle Redesign
**Visual Update:**
- Changed from purple/star icon to amber/yellow with dot indicator
- Active state: Amber background, amber border, amber dot
- Inactive state: White background, gray border, gray dot
- More professional and visually consistent

---

## 8. Signal Detection (Fresh Web Influence)

*   **Purpose**: Identify *new* content on the web that hasn't yet been indexed by AI but likely will be.
*   **Mechanism**: Periodically scans high-authority domains and industry-specific feeds.
*   **Actionability**: Alerts users to "Pre-Trend" topics so they can create content *before* the AI models ingest the information, effectively "injecting" their brand into future training data.

---

## 9. Multi-Account Scheduler (Bulk Scheduler)

Admin-only feature for scheduling audits across multiple brands simultaneously with timezone support.

### Components
- **`MultiAccountScheduler.tsx`**: 4-step wizard (Select Brands → Select Prompts → Set Schedule → Review & Create)
- **`ScheduleManager.tsx`**: Manages active schedules, execution history, real-time progress monitoring
- **Scheduler sub-components**: `AccountSelector`, `PromptSelector`, `ExecutionMonitor`, `AnalyticsDashboard`, `ConditionalRulesEditor`

### Architecture
| Component | Purpose |
|-----------|---------|
| **`scheduler`** edge function | Cron-triggered, checks for due schedules, delegates multi-account runs |
| **`multi-account-runner`** edge function | Orchestrates audit execution across multiple brands in sequence |
| **`notify-schedule-execution`** edge function | Sends email notifications (via Resend API) on completion |

### Database Tables
- **`prompt_schedules`**: Enhanced with `client_ids UUID[]`, `recurrence_type`, `timezone`, `models TEXT[]`
- **`schedule_runs`**: Tracks execution progress with `brands_completed`, `brands_total`, `metadata JSONB`
- **`account_groups`**: Named groups of brands for quick selection
- **`execution_locks`**: Prevents concurrent execution of the same schedule
- **`schedule_analytics`**: Performance metrics per schedule
- **`conditional_execution_rules`**: Rules for conditional execution (e.g., skip if already ran today)

### Features
- **Timezone Support**: Full IANA timezone support (default: `Asia/Kolkata`)
- **Recurrence**: One-time, daily, weekly, monthly
- **Concurrency**: 3 brands processed in parallel
- **Progress Tracking**: Real-time progress bar with per-brand status
- **Email Notifications**: Summary emails on completion with execution metrics

---

## 10. Notifications System

In-app notification system for admin users, currently used for signup alerts.

### Database Table: `notifications`
| Column | Type | Description |
|--------|------|-------------|
| `id` | UUID | Primary key |
| `user_id` | UUID | Admin user who receives the notification |
| `type` | text | `signup`, `alert`, `warning` |
| `title` | text | Notification title |
| `message` | text | Notification body |
| `metadata` | JSONB | Additional data (e.g., new user email) |
| `is_read` | boolean | Read status |
| `read_at` | timestamp | When marked as read |

### Edge Function: `notify-admin-signup`
- Triggered on new user signup
- Creates in-app notification for admin users
- Sends email notification via Resend API

### RLS Policies
- Admins can only view/update their own notifications
- Row-level security enforced via `profiles.role = 'admin'` check

---

## 11. AI Visibility Strategist (Prompt-Level Insights)

The most advanced insight layer in Forzeo — a two-step AI analysis that tells a brand *exactly* why it is absent from AI responses for a given query, and what to **specifically** build or publish to get cited.

### How It Works

Invoked from the **Insights tab** inside the Prompt Detail Dialog.

1. **Context Assembly** (frontend, in `generateRecommendations`):
   - Per-platform raw response text (ChatGPT, Perplexity, Gemini, Google AI Overview, Claude)
   - Cited source URLs with up to 500 chars of Tavily-scraped content per URL
   - Brand's existing web content (filtered from Tavily results by brand domain)
   - Competitor analysis from raw AI responses
   - Tavily web analysis: brand mentions, competitor mentions, top domains, source types

2. **LLM Call** (Groq `llama-3.3-70b-versatile`, JSON mode, `max_tokens: 4096`):

   **Step 1 — Citation Gap Analysis (internal reasoning):**
   - Platform Presence Audit: for each AI platform, is the brand present and at what rank?
   - Competitor Citation Analysis: what content TYPE and CLAIM is driving each competitor's citation?
   - Content Gap Identification: which specific claims/benefits/formats is the target brand missing?
   - Platform-Specific Patterns: which platforms prefer which content types?

   **Step 2 — Recommendation Generation:**
   - Outputs exactly **6 recommendations**: 2-3 High Impact Strategic + 3-4 Quick Tactical Wins

3. **Critical Output Rules**:
   - Never recommends creating a page that already exists (checks existing content input)
   - No generic backlink building without specific domain targets
   - No vague phrases ("create quality content", "study their strategy")
   - At least 1 recommendation must be platform-specific (targeting a single LLM)
   - At least 1 recommendation must address the highest-gap AI platform

### Output Structure (`PromptInsightResult`)

```typescript
interface PromptInsightResult {
  priority: 'high' | 'medium' | 'low';
  citationGapSummary: string;       // 4-6 sentence plain-English summary
  platformPresence: {
    platform: string;               // ChatGPT / Perplexity / Gemini / Google AI Overview / Claude
    present: boolean;
    rank: number | null;
  }[];
  recommendations: PromptInsightRecommendation[];
}

interface PromptInsightRecommendation {
  title: string;
  type: 'High Impact' | 'Quick Win';
  targetPlatforms: string;
  priority: string;
  whyThisWorks: string;             // 2-3 sentences referencing specific gap/competitor pattern
  exactAction: {
    contentFormat: string;          // article / FAQ / comparison page / structured data / etc.
    targetUrl: string;              // exact domain or recommended URL slug
    wordCount: string;
    keyClaims: string[];            // specific claims from gap analysis
    existingPageNote?: string;      // populated only if an existing page was found
  };
  executionSteps: string[];
  timeline: string;                 // This week / Within 2 weeks / Within 1 month
  successMetric: string;
}
```

### UI Display
| Section | Display |
|---------|---------|
| **Citation Gap Summary** | Indigo gradient card, plain-English paragraph |
| **Platform Presence** | Table with Present/Absent badge + rank per platform |
| **High Impact Strategic Actions** | Purple cards with Sparkles icon, full detail per rec |
| **Quick Tactical Wins** | Teal cards with Zap icon, full detail per rec |

### Fallback Behavior
If Groq is unavailable or JSON parsing fails, the function returns a `PromptInsightResult` built from local audit data:
- `citationGapSummary`: constructed from SOV, competitor list, and average rank
- `platformPresence`: derived from `model_results` in the audit
- `recommendations`: 2 basic recommendations based on SOV and competitor presence

### API Details
| Setting | Value |
|---------|-------|
| **Provider** | Groq |
| **Model** | `llama-3.3-70b-versatile` |
| **Max Tokens** | 4096 |
| **Temperature** | 0.5 |
| **Response Format** | JSON object |
| **Env Var** | `VITE_GROQ_API_KEY` |
