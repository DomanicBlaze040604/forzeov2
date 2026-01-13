# Forzeo GEO Dashboard

AI Visibility Analytics Platform - Track how your brand appears in AI-generated responses.

## Live Demo

🚀 https://singular-marigold-949625.netlify.app/

---

## What is This?

Forzeo tracks your brand's visibility when people ask AI assistants questions like:
- "Best dating apps in India 2025"
- "Top restaurants near me"
- "Affordable fashion websites"

If your brand doesn't appear in AI responses, you're invisible to a growing audience.

---

## How It Works

```
┌─────────────────────────────────────────────────────────────────┐
│  1. YOU ADD PROMPTS                                             │
│     "Best dating apps in India 2025"                            │
└─────────────────────────────────────────────────────────────────┘
                              ↓
┌─────────────────────────────────────────────────────────────────┐
│  2. WE QUERY AI MODELS (LIVE provider-specific APIs)            │
│     ├─ ChatGPT  → OpenAI GPT-4o (real-time)                     │
│     ├─ Gemini   → Google Gemini (real-time)                     │
│     ├─ Claude   → Anthropic Claude (real-time)                  │
│     └─ Perplexity → Perplexity AI (real-time)                   │
└─────────────────────────────────────────────────────────────────┘
                              ↓
┌─────────────────────────────────────────────────────────────────┐
│  3. WE ANALYZE RESPONSES                                        │
│     - Brand mentioned? ✓/✗                                      │
│     - Rank in list? #1, #2, #3...                               │
│     - Citations & sources                                       │
│     - Competitor mentions                                       │
└─────────────────────────────────────────────────────────────────┘
                              ↓
┌─────────────────────────────────────────────────────────────────┐
│  4. YOU SEE RESULTS                                             │
│     Share of Voice: 67% | Rank: #2 | Citations: 12              │
└─────────────────────────────────────────────────────────────────┘
```

---

## Data Sources (LIVE LLM System)

### DataForSEO LIVE LLM APIs (Provider-Specific)
Each AI model is queried via its dedicated LIVE endpoint for real-time responses:

| Model | Endpoint | Provider |
|-------|----------|----------|
| ChatGPT | `/content_generation/generate_live` | OpenAI GPT-4o |
| Gemini | `/content_generation/generate_live` | Google Gemini |
| Claude | `/content_generation/generate_live` | Anthropic Claude |
| Perplexity | `/content_generation/generate_live` | Perplexity AI |

**Features:**
- ✅ Real-time inference (no cached/simulated responses)
- ✅ Provider-specific APIs for authentic responses
- ✅ Entropy/nonce to prevent caching
- ✅ Retry logic with exponential backoff
- ✅ Cost: ~$0.05-0.10/query per model

### Google APIs
- **AI Overview**: Google's AI-generated snippets
- **SERP**: Traditional organic search results
- Cost: ~$0.002-0.003/query

### Forzeo Discovery Engine (Web Source Analysis)
Formerly known as the Tavily integration, this deep analysis engine provides real-time web search to analyze where your brand appears in editorial content:

| Feature | Description |
|---------|-------------|
| **Deep Search** | Advanced web search for brand/competitor mentions |
| **Content Extraction** | Extracts full raw page content for AI analysis |
| **Opportunity Logic** | Auto-classifies sources as Easy/Medium/Difficult for outreach |
| **Analysis** | Correlates web presence with AI visibility |

**Use cases:**
- Find editorial sources mentioning your brand
- Discover competitor coverage patterns
- Identify high-authority sources for outreach

---

## ✨ Recent Updates (January 2026)

### Citation Intelligence - Major UI/UX Overhaul
The Citation Intelligence dashboard now includes comprehensive personalization and data management features:

**New Features:**
- ✅ **Delete Functionality**: Individual and bulk delete with confirmation dialogs
- ✅ **Advanced Filtering**: 4-tier filtering (Category, Status, Model, Search) with cumulative logic
- ✅ **Sortable Columns**: Click any header to sort ascending/descending
- ✅ **Pagination**: Smart page controls with customizable items-per-page (10/25/50/100)
- ✅ **Column Toggles**: Show/hide columns dynamically via settings dropdown
- ✅ **Saved Filter Presets**: Save and load favorite filter combinations
- ✅ **Export Reports**: Generate comprehensive TXT reports with all intelligence data
- ✅ **Discovery Toggle Redesign**: Professional amber/yellow color scheme with dot indicator

**Benefits:**
- Faster data navigation with pagination and sorting  
- Personalized views with column visibility controls
- Efficient bulk operations for data cleanup
- Exportable reports for external analysis
- Professional, modern UI throughout

---

📘 **[Read the Full Feature Architecture Guide](./FEATURE_GUIDE.md)** for detailed logic explanations.

### Groq AI (Content Generation)
Groq's Llama 3.1 model powers intelligent content features:

| Feature | Description |
|---------|-------------|
| **Prompt Generation** | Generate search prompts from keywords |
| **Content Generation** | Create SEO-optimized blog posts, articles |
| **Visibility Content** | Generate content based on audit + Tavily data |
| **AI Insights Panel** | Actionable recommendations based on audit + Tavily analysis |
| **Auto-Find Competitors** | AI-powered competitor discovery |

**Model:** `llama-3.1-8b-instant` (fast inference)

---

## Key Metrics

| Metric | Description |
|--------|-------------|
| **Share of Voice (SOV)** | % of AI models mentioning your brand |
| **Average Rank** | Position in AI-generated lists (#1 is best) |
| **Citations** | Sources AI models reference |
| **Competitor Gap** | How you compare to competitors |

### SOV Interpretation
| Range | Status |
|-------|--------|
| 70-100% | 🟢 Excellent - Dominating AI responses |
| 50-69% | 🟡 Good - Appearing in most responses |
| 25-49% | 🟠 Moderate - Room for improvement |
| 0-24% | 🔴 Low - Urgent action needed |

---

## Features

### Core Features
- ✅ **6 AI Models** - ChatGPT, Claude, Gemini, Perplexity, Google AI Overview, SERP
- ✅ **Multi-Client** - Track multiple brands from one dashboard
- ✅ **LIVE LLM** - Real-time inference from actual AI providers (no simulated responses)
- ✅ **Provider-Specific APIs** - Direct queries to ChatGPT, Gemini, Claude, Perplexity
- ✅ **Retry Logic** - Exponential backoff for reliable API calls
- ✅ **Competitor Analysis** - Compare brand vs competitors
- ✅ **Citation Tracking** - See which sources AI cites
- ✅ **Export Reports** - CSV, TXT full audit report export
- ✅ **Database Storage** - All results saved to Supabase
- ✅ **Historical Data Retention** - Audit results preserved even after prompt deletion
- ✅ **Dark Theme UI** - Professional dashboard interface


### v7.0 Features (Current)
- ✅ **Website URL Field** - Add brand website to improve AI content generation
- ✅ **Custom Industry Input** - Enter specific industry when "Custom" is selected
- ✅ **Fixed Delete Buttons** - Schedule and brand deletion now working
- ✅ **Groq AI Integration** - Prompt generation, content creation, competitor discovery
- ✅ **Tavily Source Analysis** - Web source analysis and visibility correlation

### v7.1 Features
- ✅ **AI Insights Panel** - Groq-powered actionable recommendations per prompt with priority levels
- ✅ **Tavily Auto-Run** - Automatically runs Tavily analysis when toggle is ON during audits
- ✅ **Enhanced Export Report** - Full report now includes Tavily analysis + AI Insights section
- ✅ **Prompt-Level Recommendations** - Data-driven suggestions based on audit + Tavily data

### v7.2 Features
- ✅ **Overall Insights Dashboard** - Aggregated visibility metrics and recommendations across all prompts
- ✅ **Priority Breakdown** - View prompts by Critical, Needs Work, Good categories
- ✅ **Top Recommendations** - Aggregated insights from competitors, domains, and Tavily
- ✅ **Enhanced Export** - Full report includes overall visibility summary + per-prompt insights

### v7.3 Features
- ✅ **AI-Powered Pinpoint Insights** - Advanced AI generates strategic recommendations combining local aggregation + AI analysis
- ✅ **Executive Summary** - AI-generated one-sentence visibility status with priority badge
- ✅ **Strategic Recommendations** - 5 targeted, actionable recommendations
- ✅ **Key Actions** - Immediate, short-term, and long-term action items

### v7.4 Features (Latest)
- ✅ **Citation Intelligence Engine** - Analyze AI citations for hallucination detection, category classification, and actionable recommendations
- ✅ **Opportunity Levels** - Citations classified as Easy Win, Medium Effort, or Difficult
- ✅ **AI Content Generation** - Generate humanized Quora answers, Reddit comments, comparison pages, press releases
- ✅ **Enhanced Insights Prompts** - All AI recommendations now specific and actionable (no generic advice)
- ✅ **Anti-Generic Rules** - Prompts forbid vague phrases like "study their strategy" or "build relationships"
- ✅ **Tavily Analysis Enhancement** - Web source analysis now generates domain-specific tactics with timelines

### v6.1 Features (Consolidated & Polished)
- ✅ **Premium UI Design** - Complete redesign with glassmorphism, refined typography (Inter), and "finished product" aesthetics.
- ✅ **Rules of Hooks Fixes** - Refactored core tab architecture for maximum stability.
- ✅ **Interactive Competitor Analysis** - Clickable "+N" badges to reveal hidden competitors.
- ✅ **Expanded Source Tracking** - Dedicated "Sources" tab with domain/URL toggle and gap analysis.
- ✅ **Dynamic Charts** - Sources Bar Chart and Donut Charts with interactivity.
- ✅ **Enhanced Tables** - Expandable rows, improved visibility metrics, and sticky headers.
- ✅ **Unlimited Prompts** - No limit on prompts per client.
- ✅ **Functional Filters** - Filter results by date range, model, and active/inactive status.
- ✅ **Export Capabilities** - Export to CSV, TXT (Report), and detailed audit logs.
- ✅ **Global Search** - Search across prompts, citations, and domains.
- ✅ **Content Generator** - Built-in AI content generation tool.

---

## Quick Start

### 1. Clone & Install
```bash
git clone https://github.com/DomanicBlaze040604/FORZEO1.git
cd FORZEO1
npm install
```

### 2. Environment Variables
Create `.env` file:
```env
VITE_SUPABASE_URL=https://pqvyyziaczzgaythgpyc.supabase.co
VITE_SUPABASE_PUBLISHABLE_KEY=your-anon-key
```

### 3. Run Development Server
```bash
npm run dev
```

### 4. Open Browser
Visit `http://localhost:5173`

---

## Deployment

### Frontend (Netlify)
```bash
npm run build
netlify deploy --prod
```

### Edge Functions (Supabase)
```bash
npx supabase functions deploy geo-audit --project-ref pqvyyziaczzgaythgpyc
```

### Set Supabase Secrets
```bash
npx supabase secrets set DATAFORSEO_LOGIN=your-login --project-ref pqvyyziaczzgaythgpyc
npx supabase secrets set DATAFORSEO_PASSWORD=your-password --project-ref pqvyyziaczzgaythgpyc
```

---

## API Costs

| Service | Cost | Notes |
|---------|------|-------|
| ChatGPT (LIVE) | ~$0.05-0.10/query | OpenAI GPT-4o real-time |
| Gemini (LIVE) | ~$0.05-0.10/query | Google Gemini real-time |
| Claude (LIVE) | ~$0.05-0.10/query | Anthropic Claude real-time |
| Perplexity (LIVE) | ~$0.05-0.10/query | Perplexity AI real-time |
| DataForSEO SERP | ~$0.002/query | Google results |
| DataForSEO AI Overview | ~$0.003/query | Google AI snippets |

**Typical cost per prompt (4 models):** ~$0.20-0.40

---

## Tech Stack

| Layer | Technology |
|-------|------------|
| Frontend | React, TypeScript, Tailwind CSS, Radix UI |
| Backend | Supabase Edge Functions (Deno) |
| Database | Supabase PostgreSQL |
| AI Content | Groq (Llama 3.1) |
| Web Search | Tavily API |
| LLM Queries | DataForSEO LIVE API |
| Hosting | Netlify |

---

## Project Structure

```
├── src/
│   ├── pages/ClientDashboard.tsx    # Main dashboard UI (v6.0 - sidebar, tabs, dialogs)
│   ├── hooks/useClientDashboard.ts  # State management & Supabase integration
│   ├── components/
│   │   ├── ModelLogos.tsx           # AI model icons with colors
│   │   ├── BrandLogo.tsx            # Brand/competitor logo component
│   │   └── ui/                      # Radix UI components
│   └── lib/                         # Utilities
├── backend/
│   ├── geo-audit/index.ts           # Main audit API (LIVE LLM queries)
│   └── generate-content/index.ts    # Content generation API
├── database/                        # SQL schemas & migrations
├── supabase/functions/              # Edge functions (deployed)
└── netlify.toml                     # Netlify config
```

---

## Documentation

See `ARCHITECTURE.md` for detailed technical documentation.

---

## License

MIT

