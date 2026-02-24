# Forzeo GEO Dashboard — Tech Stack

## Frontend

| Technology | Purpose |
|---|---|
| **React 18** | UI framework |
| **TypeScript 5.2** | Type-safe JavaScript |
| **Vite 5** | Build tool & dev server |
| **Tailwind CSS 3** | Utility-first styling |
| **Radix UI** | Headless accessible components (dialogs, selects, tabs, popovers, etc.) |
| **Lucide React** | Icon library |
| **react-markdown + remark-gfm** | Markdown rendering |
| **date-fns + react-day-picker** | Date utilities & picker |
| **sonner** | Toast notifications |
| **Custom SVG Charts** | Catmull-Rom spline line charts (no external chart library) |
| **Amplitude** | Product analytics & session replay |

**State Management:** Custom React hooks (`useClientDashboard`, `useAuth`) + React Context — no Redux/Zustand.

---

## Backend

| Technology | Purpose |
|---|---|
| **Supabase Edge Functions** | Serverless API (runs on Deno) |
| **TypeScript (Deno)** | Backend language |
| **PostgreSQL** | Database (Supabase-hosted) |
| **Supabase Auth** | Authentication & RLS |

### Edge Functions

| Function | Responsibility |
|---|---|
| `geo-audit` | Core — queries AI models, brand detection, citation tracking |
| `scheduler` | Cron-based auto-run of prompts |
| `multi-account-runner` | Multi-account/multi-prompt orchestration |
| `verify-citations` | Citation verification with semantic similarity |
| `categorize-citations` | Citation categorization (12+ categories) |
| `tavily-search` | Web source analysis |
| `ai-search-volume` | Search volume tracking |
| `notify-admin-signup` | Email notifications on new signups |
| `notify-schedule-execution` | Schedule completion alerts |

### External API Integrations

| API | Purpose |
|---|---|
| **DataForSEO** (LIVE LLM) | Real-time queries to ChatGPT, Gemini, Claude, Perplexity |
| **Tavily** | Web source discovery & visibility analysis |
| **Groq** | Content generation & citation verification |
| **OpenRouter** | Qwen3-235B reasoning model |
| **Jina Reader** | Page content extraction |
| **Serper** | SERP provider (optional) |

---

## Database

- **PostgreSQL** via Supabase
- **Client:** `@supabase/supabase-js`
- **Auth:** Supabase Auth with role-based access control (Admin / Agency / User)
- **Security:** Row-Level Security (RLS) policies
- **Migrations:** Raw SQL in `database/migrations/`

---

## Infrastructure & Deployment

| Layer | Tool |
|---|---|
| **Frontend hosting** | Netlify |
| **Backend hosting** | Supabase Edge Functions |
| **Database hosting** | Supabase (PostgreSQL) |
| **Auth** | Supabase Auth |
| **Build** | Vite → `dist/` |

---

## Dev Tooling

| Tool | Purpose |
|---|---|
| **npm** | Package manager |
| **ESLint** | Linting (with TypeScript & React plugins) |
| **Vitest** | Unit testing |
| **tsx** | TypeScript execution for scripts |
| **PostCSS + Autoprefixer** | CSS processing |

### Scripts

```
npm run dev             # Start dev server (port 5173)
npm run build           # Production build
npm run lint            # Run ESLint
npm run functions:serve # Local edge function testing
npm run functions:deploy # Deploy edge functions
```

---

## Architecture Summary

```
┌─────────────┐     ┌──────────────────────┐     ┌────────────┐
│   React +   │────▶│  Supabase Edge Fns   │────▶│ PostgreSQL │
│  Tailwind   │     │  (Deno / TypeScript)  │     │ (Supabase) │
│  (Netlify)  │◀────│                       │◀────│    + RLS   │
└─────────────┘     └──────────┬───────────┘     └────────────┘
                               │
                    ┌──────────▼───────────┐
                    │   External APIs      │
                    │  DataForSEO · Tavily │
                    │  Groq · OpenRouter   │
                    │  Jina · Serper       │
                    └──────────────────────┘
```

**In short:** A full-stack TypeScript app — React on the frontend, Deno edge functions on the backend, PostgreSQL for storage, integrated with multiple AI and search APIs for visibility analytics.
