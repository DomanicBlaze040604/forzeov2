# Forzeo GEO Dashboard

AI Visibility Analytics Platform - Track how your brand appears in AI-generated responses.

## Live Demo

🚀 **https://wondrous-queijadas-f95c7e.netlify.app**

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
│  2. WE QUERY AI MODELS (3-tier system)                          │
│     ├─ Tier 1: DataForSEO Cached Data (fast, cheap)             │
│     ├─ Tier 2: DataForSEO LIVE LLM API (real-time)              │
│     └─ Tier 3: Groq Fallback (last resort)                      │
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

## Data Sources (3-Tier System)

### Tier 1: DataForSEO Cached (Primary)
- `/llm_mentions/*` API - Historical/cached AI responses
- Covers: ChatGPT, Claude, Gemini, Perplexity
- Cost: ~$0.02/query | Fast response

### Tier 2: DataForSEO LIVE (Real-time)
- `/llm_responses/live` API - Fresh LLM inference
- Real-time responses with entropy to prevent caching
- Multi-model validation to reduce hallucinations
- Cost: ~$0.05-0.10/query | Slower but accurate

### Tier 3: Groq Fallback (Last Resort)
- Only used when DataForSEO completely fails
- Uses Llama 3.3 70B model
- Cost: FREE (14,400 req/day limit)

### Google APIs
- **AI Overview**: Google's AI-generated snippets
- **SERP**: Traditional organic search results
- Cost: ~$0.002-0.003/query

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

- ✅ **6 AI Models** - ChatGPT, Claude, Gemini, Perplexity, Google AI Overview, SERP
- ✅ **Multi-Client** - Track multiple brands from one dashboard
- ✅ **LIVE LLM** - Real-time inference when cached data unavailable
- ✅ **Multi-Model Validation** - Cross-check responses to reduce hallucinations
- ✅ **Competitor Analysis** - Compare brand vs competitors
- ✅ **Citation Tracking** - See which sources AI cites
- ✅ **Content Generation** - AI-powered SEO content via Groq
- ✅ **Export Reports** - CSV, JSON, formatted text
- ✅ **Database Storage** - All results saved to Supabase
- ✅ **Dark Theme UI** - Professional dashboard interface

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
VITE_GROQ_API_KEY=your-groq-key
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
npx supabase secrets set GROQ_API_KEY=your-groq-key --project-ref pqvyyziaczzgaythgpyc
```

---

## API Costs

| Service | Cost | Notes |
|---------|------|-------|
| DataForSEO Cached | ~$0.02/query | Primary source |
| DataForSEO LIVE | ~$0.05-0.10/query | Real-time inference |
| DataForSEO SERP | ~$0.002/query | Google results |
| DataForSEO AI Overview | ~$0.003/query | Google AI snippets |
| Groq | FREE | Fallback only |

**Typical cost per prompt:** ~$0.03-0.15 (depending on data availability)

---

## Tech Stack

| Layer | Technology |
|-------|------------|
| Frontend | React, TypeScript, Tailwind CSS, Radix UI |
| Backend | Supabase Edge Functions (Deno) |
| Database | Supabase PostgreSQL |
| APIs | DataForSEO, Groq |
| Hosting | Netlify |

---

## Project Structure

```
├── src/
│   ├── pages/ClientDashboard.tsx    # Main UI
│   ├── hooks/useClientDashboard.ts  # State & logic
│   └── components/                  # UI components
├── backend/
│   ├── geo-audit/index.ts           # Main audit API
│   └── generate-content/index.ts    # Content generation
├── database/                        # SQL schemas
├── supabase/functions/              # Edge functions
└── netlify.toml                     # Netlify config
```

---

## Documentation

See `ARCHITECTURE.md` for detailed technical documentation.

---

## License

MIT
