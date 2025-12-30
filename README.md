# Forzeo GEO Dashboard

## What is This?

Forzeo is a tool that helps businesses understand how visible their brand is when people ask AI assistants questions. 

Think of it like this: When someone asks ChatGPT "What's the best dating app in India?" - does your app get mentioned? If yes, where in the list? This tool answers those questions.

---

## The Problem We Solve

AI assistants like ChatGPT, Google AI, and Perplexity are becoming the new search engines. People ask them:
- "Best restaurants near me"
- "Top dental clinics in London"
- "Affordable fashion websites"

If your brand doesn't appear in these AI responses, you're invisible to a growing number of potential customers.

**Forzeo tracks your brand's visibility across multiple AI platforms and shows you:**
- Are you being mentioned?
- Where do you rank compared to competitors?
- Which sources are AI models citing?

---

## How It Works

```
┌─────────────────────────────────────────────────────────────────┐
│  1. YOU ADD PROMPTS                                             │
│     "Best dating apps in India 2025"                            │
│     "Dating apps with ID verification"                          │
└─────────────────────────────────────────────────────────────────┘
                              ↓
┌─────────────────────────────────────────────────────────────────┐
│  2. WE QUERY DATAFORSEO'S AI DATABASE                           │
│     Searches cached responses from ChatGPT, Claude, Gemini,     │
│     Perplexity + Google AI Overview & SERP                      │
└─────────────────────────────────────────────────────────────────┘
                              ↓
┌─────────────────────────────────────────────────────────────────┐
│  3. WE ANALYZE RESPONSES                                        │
│     - Did they mention your brand? ✓ or ✗                       │
│     - What rank? #1, #2, #3...                                  │
│     - What sources did they cite?                               │
│     - Did they mention competitors?                             │
└─────────────────────────────────────────────────────────────────┘
                              ↓
┌─────────────────────────────────────────────────────────────────┐
│  4. YOU SEE RESULTS                                             │
│     Share of Voice: 67%                                         │
│     Average Rank: #2                                            │
│     Top Source: wikipedia.org                                   │
└─────────────────────────────────────────────────────────────────┘
```

---

## Data Sources

### Primary: DataForSEO LLM Mentions API
- Searches DataForSEO's database of cached AI responses
- Covers: ChatGPT, Claude, Gemini, Perplexity
- Shows real AI responses with citations
- Cost: ~$0.02 per query

### Google AI Overview & SERP
- Real-time Google search results
- AI Overview snippets when available
- Traditional organic search results
- Cost: ~$0.002-0.003 per query

### Fallback: Groq (Last Resort)
- Only used when DataForSEO API completely fails
- Uses Llama 3.3 70B model
- Free tier available

---

## Key Metrics Explained

### Share of Voice (SOV)
The percentage of AI models that mention your brand.

| SOV Range | What It Means |
|-----------|---------------|
| 70-100%   | Excellent! Your brand dominates AI responses |
| 50-69%    | Good. You appear in most responses |
| 25-49%    | Moderate. Room for improvement |
| 0-24%     | Low. Urgent action needed |

### Average Rank
When AI gives a numbered list, where does your brand appear? Lower = Better (#1 is best)

### Citations
The websites that AI models reference. If AI cites your website, you're seen as an authority.

---

## Features

- **Multi-Client Support** - Track multiple brands from one dashboard
- **6 AI Models** - ChatGPT, Claude, Gemini, Perplexity, Google AI Overview, Google SERP
- **Prompt Management** - Add single, bulk import, or AI-generate prompts
- **Competitor Analysis** - Compare your brand vs competitors
- **Citation Tracking** - See which sources AI models cite
- **Content Generation** - Generate SEO-optimized content via Groq
- **Export Reports** - CSV, JSON, and formatted text reports
- **Dark Theme UI** - Professional dashboard interface

---

## Project Structure

```
forzeo-dashboard/
├── src/
│   ├── pages/ClientDashboard.tsx    # Main UI
│   ├── hooks/useClientDashboard.ts  # State & logic
│   └── components/ui/               # UI components
├── backend/
│   ├── geo-audit/index.ts           # Main audit API
│   └── generate-content/index.ts    # Content generation
├── database/
│   └── *.sql                        # Database schemas
├── supabase/functions/              # Edge functions
└── netlify.toml                     # Netlify config
```

---

## Quick Start

### 1. Install Dependencies
```bash
npm install
```

### 2. Set Environment Variables
Create a `.env` file:
```
VITE_SUPABASE_URL=your-supabase-url
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

### Netlify (Frontend)
```bash
netlify deploy --prod
```

### Supabase (Edge Functions)
```bash
npx supabase functions deploy geo-audit --project-ref YOUR_PROJECT_REF
```

---

## API Costs

| Service | Cost | Notes |
|---------|------|-------|
| DataForSEO LLM Mentions | ~$0.02/query | Primary source for AI responses |
| DataForSEO SERP | ~$0.002/query | Google search results |
| DataForSEO AI Overview | ~$0.003/query | Google AI snippets |
| Groq | Free | Fallback only (14,400 req/day) |

**Typical cost per prompt:** ~$0.025 (testing 5 models)

---

## Tech Stack

- **Frontend:** React, TypeScript, Tailwind CSS, Radix UI
- **Backend:** Supabase Edge Functions (Deno)
- **Database:** Supabase (PostgreSQL)
- **APIs:** DataForSEO, Groq
- **Hosting:** Netlify

---

## Live Demo

**URL:** https://wondrous-queijadas-f95c7e.netlify.app

---

## Support

See `ARCHITECTURE.md` for detailed technical documentation.
