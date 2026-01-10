# Forzeo GEO Dashboard - Complete Feature Documentation

## Overview

Forzeo is an **AI Visibility Analytics Platform** that tracks how your brand appears in AI-generated responses across multiple LLMs (ChatGPT, Gemini, Perplexity, Claude) and search engines.

---

## Core Features

### 1. Brand/Client Management

**What it does:**  
Manage multiple brands/clients with their own prompts, competitors, and tracking settings.

**How it works:**
1. User creates a client with name, brand domain, and competitors
2. Data stored in `clients` table
3. Each client has isolated prompts and audit history

**Database tables:** `clients`, `organizations`

---

### 2. Prompt Management

**What it does:**  
Create, organize, and track search prompts to monitor your brand visibility.

**How it works:**
1. User adds prompts (e.g., "Best CRM software 2024")
2. Prompts categorized: `broad`, `niche`, `super_niche`, `comparison`, etc.
3. Can import from CSV or generate with AI
4. Each prompt tracks: audit count, last audited, citations found

**Database tables:** `prompts`

---

### 3. GEO Audit Engine (geo-audit)

**What it does:**  
Queries multiple AI models to check if your brand is mentioned in their responses.

**How it works:**

```
User clicks "Run Audit"
         ↓
Frontend → geo-audit Edge Function
         ↓
DataForSEO LIVE LLM API
         ↓
┌─────────────────────────────────┐
│  ChatGPT  │ Gemini │ Perplexity │
│  Claude   │ AI Overview │ SERP │
└─────────────────────────────────┘
         ↓
Response parsed for:
  • Brand mentioned? (boolean)
  • Position/Rank (1-10)
  • Citations extracted (URLs)
  • Competitor mentions
         ↓
Results stored in audit_results + citations
```

**Key metrics calculated:**
- **Share of Voice (SOV):** % of models mentioning your brand
- **Average Rank:** Position in AI responses
- **Trust Index:** Based on citation sources
- **Visibility Score:** Combined metric

**Database tables:** `audit_results`, `citations`

**Edge function:** `supabase/functions/geo-audit/index.ts`

---

### 4. Campaigns (Massive Audits)

**What it does:**  
Run multiple prompts as a single batched audit to track overall brand performance.

**How it works:**
1. User clicks "Run Campaign" → names the campaign
2. System creates campaign record with `total_prompts` count
3. Each prompt auditd sequentially
4. Trigger updates campaign stats on each completion
5. Status: `running` → `completed`

**Metrics aggregated:**
- Average SOV across all prompts
- Average rank
- Total citations
- Completion percentage

**Database tables:** `campaigns`, `audit_results.campaign_id`

---

### 5. Tavily Search (tavily-search)

**What it does:**  
Real-time web search to find where your brand appears in editorial content, reviews, and comparisons.

**How it works:**

```
Prompt Text → Tavily API (advanced search)
         ↓
Returns:
  • Web sources (URL, title, content, score)
  • AI-generated answer
  • Domain rankings
         ↓
Analysis:
  • Brand mentioned in sources?
  • Competitor mention counts
  • Top domains (Forbes, TechCrunch, etc.)
  • Source type breakdown
         ↓
Stored in tavily_results table
```

**Use cases:**
- Find what websites mention your brand
- Discover competitor coverage
- Identify high-authority sources for outreach

**Database tables:** `tavily_results`

**Edge function:** `supabase/functions/tavily-search/index.ts`

---

### 6. Fresh Signals Intelligence System

This is a 3-part system for monitoring the web and getting proactive recommendations.

#### 6a. RSS Ingestor (rss-ingestor)

**What it does:**  
Polls RSS feeds (Google Alerts, industry news) to discover fresh content mentioning your brand or competitors.

**How it works:**

```
┌─────────────────────────────┐
│    RSS Feeds configured     │
│  (Google Alerts, news, etc.)│
└───────────────┬─────────────┘
                ↓
        rss-ingestor Edge Function
        (runs on schedule or manually)
                ↓
┌─────────────────────────────┐
│     For each RSS item:      │
│  • Hash URL (dedup)         │
│  • Extract domain           │
│  • Detect brand mentions    │
│  • Detect competitor mentions│
│  • Classify content type    │
└───────────────┬─────────────┘
                ↓
        Stored as "Fresh Signals"
        (processing_status: pending)
```

**Database tables:** `rss_feeds`, `fresh_signals`

**Edge function:** `supabase/functions/rss-ingestor/index.ts`

---

#### 6b. Signal Scorer (signal-scorer)

**What it does:**  
Scores and classifies signals, correlates with AI visibility, and generates actionable recommendations.

**How it works:**

```
Fresh Signals (pending)
         ↓
   signal-scorer Edge Function
         ↓
┌─────────────────────────────────┐
│  Calculate Scores:              │
│  • Freshness (age of content)   │
│  • Authority (domain reputation)│
│  • Relevance (keyword matches)  │
│  • Influence = combined score   │
└───────────────┬─────────────────┘
                ↓
    If influence_score >= 0.5
         ↓
┌─────────────────────────────┐
│   Tavily Correlation        │
│  (Check if source appears   │
│   in AI search results)     │
└───────────────┬─────────────┘
                ↓
┌─────────────────────────────────┐
│   Classification:               │
│  • AMPLIFY - High value, in AI  │
│  • EMERGING - New, watch this   │
│  • COMPETITIVE - Competitor win │
│  • OPPORTUNITY - Gap to fill    │
└───────────────┬─────────────────┘
                ↓
    Generate Recommendations
    (priority, action items, expiry)
         ↓
    Store in recommendations table
```

**Recommendation types:**
- 🔥 **AMPLIFY:** Content already appears in AI - maximize it
- 🆕 **EMERGING:** New fresh content - get quoted/linked
- ⚔️ **COMPETITIVE:** Competitor is winning - counter it
- 💡 **OPPORTUNITY:** Gap in market - create content

**Database tables:** `fresh_signals`, `signal_correlations`, `recommendations`, `domain_authority`

**Edge function:** `supabase/functions/signal-scorer/index.ts`

---

### 7. Schedules

**What it does:**  
Automate prompt audits on recurring schedules (hourly, daily, weekly).

**How it works:**
1. User creates schedule: select prompts, frequency, models
2. `scheduler` edge function runs on cron
3. Triggers audits automatically
4. Tracks run history in `schedule_runs`

**Database tables:** `prompt_schedules`, `schedule_runs`, `scheduled_audits`

**Edge function:** `supabase/functions/scheduler/index.ts`

---

### 8. Citations Tracking

**What it does:**  
Collect and analyze all URLs cited by AI models in their responses.

**Captured data:**
- URL, title, domain
- Position in response
- Which AI model cited it
- Is it a brand source?

**Why it matters:**
- See which sources AI trusts
- Identify citation opportunities
- Track brand domain mentions

**Database tables:** `citations`

---

### 9. Analytics Dashboard

**What it does:**  
Visualize visibility trends over time.

**Metrics displayed:**
- Share of Voice trend
- Average Rank trend
- Citation count over time
- API cost tracking
- Audit log history

**Data source:** Aggregated from `audit_results`, `campaigns`

---

## Data Flow Diagram

```
┌─────────────────────────────────────────────────────────────────┐
│                         USER INTERFACE                          │
│  Dashboard │ Prompts │ Campaigns │ Analytics │ Signals │ Settings│
└─────────────────────┬───────────────────────────────────────────┘
                      │
                      ▼
┌─────────────────────────────────────────────────────────────────┐
│                     SUPABASE EDGE FUNCTIONS                      │
│  geo-audit │ tavily-search │ signal-scorer │ rss-ingestor │ scheduler│
└─────────────────────┬───────────────────────────────────────────┘
                      │
          ┌───────────┼───────────┐
          ▼           ▼           ▼
   ┌───────────┐ ┌─────────┐ ┌──────────┐
   │ DataForSEO│ │ Tavily  │ │RSS Feeds │
   │  LLM API  │ │   API   │ │ (Google) │
   └───────────┘ └─────────┘ └──────────┘
          │           │           │
          └───────────┼───────────┘
                      ▼
┌─────────────────────────────────────────────────────────────────┐
│                    SUPABASE DATABASE                             │
│  clients │ prompts │ audit_results │ citations │ campaigns      │
│  fresh_signals │ recommendations │ prompt_schedules             │
└─────────────────────────────────────────────────────────────────┘
```

---

## API Configuration

| API | Purpose | Required |
|-----|---------|----------|
| **DataForSEO** | LLM queries (ChatGPT, Gemini, etc.) | ✅ Yes |
| **Tavily** | Web search for sources | Optional |
| **Serper** | Backup SERP data | Optional |
| **OpenAI** | Direct ChatGPT queries | Optional |
| **Anthropic** | Direct Claude queries | Optional |

---

## Database Tables Summary

| Table | Purpose |
|-------|---------|
| `organizations` | Multi-tenant workspaces |
| `users` | User accounts |
| `clients` | Brands being tracked |
| `prompts` | Search queries to audit |
| `audit_results` | Individual audit results |
| `citations` | URLs cited by AI models |
| `campaigns` | Batched audit runs |
| `prompt_schedules` | Automation config |
| `schedule_runs` | Scheduled run history |
| `tavily_results` | Web search results |
| `rss_feeds` | Feed sources |
| `fresh_signals` | Discovered content |
| `signal_correlations` | AI appearance checks |
| `recommendations` | Action items |
| `domain_authority` | Source reputation |
| `api_usage` | Cost tracking |

---

## Getting Started

1. **Create a client** with your brand name and competitors
2. **Add prompts** (what questions would users ask about your industry?)
3. **Run an audit** to see current visibility
4. **Set up schedules** for automated monitoring
5. **Add RSS feeds** for fresh signal detection
6. **Review recommendations** for action items
