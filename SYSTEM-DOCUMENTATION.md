# Forzeo GEO Dashboard - Complete System Documentation

> **Version:** 3.1 | **Last Updated:** March 3, 2026
> **Platform:** AI Visibility Analytics for Brand Monitoring Across AI Search Engines

---

## Table of Contents

1. [System Overview](#1-system-overview)
2. [Technology Stack](#2-technology-stack)
3. [Project Structure](#3-project-structure)
4. [Architecture Diagram](#4-architecture-diagram)
5. [Frontend Architecture](#5-frontend-architecture)
   - 5.1 [Entry Point & App Shell](#51-entry-point--app-shell)
   - 5.2 [Pages](#52-pages)
   - 5.3 [Components](#53-components)
   - 5.4 [Tabs System](#54-tabs-system)
   - 5.5 [UI Component Library](#55-ui-component-library)
   - 5.6 [Hooks (State Management)](#56-hooks-state-management)
   - 5.7 [Utilities](#57-utilities)
6. [Backend Architecture](#6-backend-architecture)
   - 6.1 [Supabase Edge Functions](#61-supabase-edge-functions)
   - 6.2 [Core Audit Engine (geo-audit)](#62-core-audit-engine-geo-audit)
   - 6.3 [Citation Processing Pipeline](#63-citation-processing-pipeline)
   - 6.4 [Scheduling System](#64-scheduling-system)
   - 6.5 [Content & Intelligence Functions](#65-content--intelligence-functions)
   - 6.6 [Notification System](#66-notification-system)
7. [Database Schema](#7-database-schema)
8. [Authentication & Authorization](#8-authentication--authorization)
9. [Data Flow & Workflows](#9-data-flow--workflows)
   - 9.1 [Audit Execution Flow](#91-audit-execution-flow)
   - 9.2 [Multi-Brand Schedule Flow](#92-multi-brand-schedule-flow)
   - 9.3 [Citation Pipeline Flow](#93-citation-pipeline-flow)
   - 9.4 [Content Generation Flow](#94-content-generation-flow)
10. [Key Algorithms](#10-key-algorithms)
    - 10.1 [Share of Voice (SOV)](#101-share-of-voice-sov)
    - 10.2 [Brand Matching Algorithm](#102-brand-matching-algorithm)
    - 10.3 [Rank Extraction](#103-rank-extraction)
    - 10.4 [Domain Classification](#104-domain-classification)
11. [Styling & Design System](#11-styling--design-system)
12. [Performance Optimizations](#12-performance-optimizations)
13. [Third-Party Integrations](#13-third-party-integrations)
14. [Cost Structure & Tracking](#14-cost-structure--tracking)
15. [Build & Deployment](#15-build--deployment)
16. [File Reference](#16-file-reference)

---

## 1. System Overview

### What is Forzeo GEO Dashboard?

Forzeo GEO Dashboard is a **Generative Engine Optimization (GEO)** analytics platform that tracks how brands appear across AI-powered search engines. It answers the fundamental question: **"When someone asks an AI about your industry, does the AI mention your brand?"**

### What Problem Does It Solve?

As AI search engines (ChatGPT, Gemini, Claude, Perplexity, Google AI Overviews) increasingly replace traditional search, brands need to understand:

- **Are AI models recommending their brand?** (Share of Voice)
- **What rank does the brand appear at?** (Average Position)
- **Which sources do AI models cite?** (Citation Tracking)
- **How do competitors compare?** (Competitive Gap Analysis)
- **What content should be created to improve visibility?** (Content Intelligence)

### How It Works (High Level)

1. **Define prompts** - e.g., "Best dating apps in India", "Top CRM software for startups"
2. **Run audits** - The system queries 6 AI models simultaneously with each prompt
3. **Analyze responses** - It detects brand mentions, extracts rankings, collects citations
4. **Compute metrics** - Share of Voice, Average Rank, Visibility Score, Trust Index
5. **Present insights** - Dashboard with charts, tables, recommendations, and exportable reports

---

## 2. Technology Stack

### Frontend
| Technology | Purpose |
|---|---|
| **React 18** | UI framework with hooks and concurrent features |
| **TypeScript** | Type-safe JavaScript for all frontend code |
| **Vite** | Build tool with hot module replacement |
| **Tailwind CSS 3** | Utility-first CSS framework |
| **Radix UI** | Headless, accessible UI primitives (dialogs, menus, tabs, etc.) |
| **TanStack Virtual** | Virtual scrolling for large data tables |
| **Lucide React** | Icon library |
| **React Markdown** | Markdown rendering for AI responses |
| **date-fns** | Date manipulation and formatting |
| **Sonner** | Toast notification system |

### Backend
| Technology | Purpose |
|---|---|
| **Supabase** | Backend-as-a-Service (PostgreSQL + Auth + Edge Functions) |
| **Deno** | Runtime for Supabase Edge Functions |
| **PostgreSQL** | Primary database (managed by Supabase) |
| **Supabase Auth** | Authentication with email/password + OAuth |
| **Supabase Edge Functions** | Serverless backend logic (TypeScript on Deno) |

### External Services
| Service | Purpose |
|---|---|
| **DataForSEO** | Primary API for querying AI models (ChatGPT, Gemini, Claude, Perplexity) and Google SERP/AI Overviews |
| **Groq** | Fast LLM inference for content generation and analysis |
| **OpenRouter** | AI-powered domain classification (free tier) |
| **Tavily** | Real-time web search and content extraction |
| **Jina** | Web page content extraction for citation verification |
| **Resend** | Transactional email delivery |
| **Google OAuth** | Social login provider |

---

## 3. Project Structure

```
client-dashboard/
├── public/                              # Static assets
├── dist/                                # Production build output
├── src/
│   ├── main.tsx                         # React entry point
│   ├── App.tsx                          # Root component (auth + routing)
│   ├── index.css                        # Global styles + Tailwind + animations
│   ├── debug-logger.ts                  # Development console logging
│   │
│   ├── pages/
│   │   └── ClientDashboard.tsx          # Main dashboard page (~2000 lines)
│   │
│   ├── components/
│   │   ├── AuthForm.tsx                 # Login/signup/forgot-password form
│   │   ├── AgencyOverview.tsx           # Agency-level multi-brand dashboard
│   │   ├── AgencyBrandsManager.tsx      # Admin multi-brand CRUD
│   │   ├── CampaignsList.tsx            # Campaign management
│   │   ├── CampaignDetail.tsx           # Single campaign detail view
│   │   ├── CitationPreview.tsx          # Hover tooltip for citation details
│   │   ├── CitationIntelligence.tsx     # Deep citation analysis panel
│   │   ├── MultiAccountScheduler.tsx    # 4-step scheduling wizard (admin)
│   │   ├── ScheduleManager.tsx          # Schedule execution monitor
│   │   ├── SignalsDashboard.tsx         # RSS signal detection panel
│   │   ├── SOVLineChart.tsx             # Custom SVG trend chart
│   │   ├── ModelLogos.tsx               # AI model brand icons
│   │   ├── ForzeoLogo.tsx               # Application logo
│   │   ├── UniversalImport.tsx          # CSV/JSON/text import dialog
│   │   ├── UserManagement.tsx           # Admin user management
│   │   ├── VisibilityGraphs.tsx         # Graph visualizations
│   │   │
│   │   ├── tabs/                        # Dashboard tab content
│   │   │   ├── OverviewTab.tsx          # Metrics cards + charts
│   │   │   ├── PromptsTab.tsx           # Prompt CRUD + execution
│   │   │   ├── TopicsTab.tsx            # Topic/keyword discovery
│   │   │   ├── SourcesTab.tsx           # Citation source analysis
│   │   │   ├── CitationsTab.tsx         # Citation data table
│   │   │   ├── ContentTab.tsx           # AI content generation
│   │   │   └── InsightsTab.tsx          # AI recommendations
│   │   │
│   │   ├── scheduler/                   # Multi-account scheduler sub-components
│   │   │   ├── AccountSelector.tsx      # Client/brand picker
│   │   │   ├── PromptSelector.tsx       # Prompt selection step
│   │   │   ├── ConditionalRulesEditor.tsx # Budget & retry rules
│   │   │   ├── ExecutionMonitor.tsx     # Real-time progress tracker
│   │   │   └── AnalyticsDashboard.tsx   # Schedule analytics
│   │   │
│   │   ├── dialogs/                     # Modal dialog components
│   │   │
│   │   └── ui/                          # Radix UI primitive wrappers (~22 files)
│   │       ├── button.tsx, card.tsx, dialog.tsx, tabs.tsx
│   │       ├── input.tsx, select.tsx, checkbox.tsx, label.tsx
│   │       ├── dropdown-menu.tsx, popover.tsx, sheet.tsx
│   │       ├── badge.tsx, alert.tsx, progress.tsx
│   │       ├── calendar.tsx, radio-group.tsx, textarea.tsx
│   │       └── ... (more primitives)
│   │
│   ├── hooks/
│   │   ├── useAuth.ts                   # Role-based authentication hook
│   │   └── useClientDashboard.ts        # Central state management (~2000 lines)
│   │
│   ├── utils/
│   │   ├── brandMatching.ts             # Fuzzy brand name matching
│   │   ├── dashboardHelpers.ts          # Domain classification + metric helpers
│   │   ├── timezone.ts                  # Timezone conversion utilities
│   │   └── timezone.test.ts             # Timezone utility tests
│   │
│   ├── integrations/
│   │   └── supabase/
│   │       └── client.ts                # Supabase client initialization
│   │
│   └── lib/
│       └── utils.ts                     # clsx + tailwind-merge utility
│
├── supabase/
│   └── functions/
│       ├── _shared/                     # Shared Deno utilities
│       ├── geo-audit/                   # Core audit engine
│       ├── categorize-citations/        # AI domain classification
│       ├── verify-citations/            # Semantic citation verification
│       ├── citation-analyzer/           # Deep citation analysis
│       ├── tavily-search/               # Web search integration
│       ├── scheduler/                   # Cron job scheduler
│       ├── multi-account-runner/        # Multi-brand orchestration
│       ├── notify-schedule-execution/   # Email on schedule complete
│       ├── notify-admin-signup/         # Email on new user signup
│       ├── signal-scorer/               # Signal detection scoring
│       ├── rss-ingestor/                # RSS feed ingestion
│       ├── groq-proxy/                  # Groq LLM proxy
│       ├── ai-search-volume/            # Search volume estimation
│       └── send-report/                 # Report delivery
│
├── package.json                         # Dependencies and scripts
├── tsconfig.json                        # TypeScript configuration
├── vite.config.ts                       # Vite build configuration
├── tailwind.config.js                   # Tailwind CSS theming
└── postcss.config.js                    # PostCSS plugins
```

---

## 4. Architecture Diagram

```
┌─────────────────────────────────────────────────────────────────────┐
│                         USER'S BROWSER                              │
│                                                                     │
│  ┌──────────────────────────────────────────────────────────────┐   │
│  │                    React SPA (Vite)                           │   │
│  │                                                              │   │
│  │  App.tsx ── Auth Check ──┬── AuthForm (Login/Signup)         │   │
│  │                          │                                    │   │
│  │                          └── ClientDashboard.tsx               │   │
│  │                               │                               │   │
│  │  ┌────────────────────────────┼──────────────────────────┐   │   │
│  │  │              Tab Navigation                            │   │   │
│  │  │  ┌──────────┬──────────┬──────────┬──────────────┐     │   │   │
│  │  │  │ Overview  │ Prompts  │ Sources  │ Citations    │     │   │   │
│  │  │  │ Topics    │ Content  │ Insights │ Signals      │     │   │   │
│  │  │  └──────────┴──────────┴──────────┴──────────────┘     │   │   │
│  │  │                                                        │   │   │
│  │  │  Admin Features:                                       │   │   │
│  │  │  ┌──────────────────┬──────────────────┐               │   │   │
│  │  │  │ Multi-Account    │ User Management  │               │   │   │
│  │  │  │ Scheduler        │ Agency Overview  │               │   │   │
│  │  │  └──────────────────┴──────────────────┘               │   │   │
│  │  └────────────────────────────────────────────────────────┘   │   │
│  │                                                              │   │
│  │  Hooks Layer:                                                │   │
│  │  ┌──────────────────────┐  ┌────────────────────────────┐   │   │
│  │  │ useAuth()            │  │ useClientDashboard()       │   │   │
│  │  │ - Session management │  │ - Client CRUD              │   │   │
│  │  │ - Role-based access  │  │ - Prompt management        │   │   │
│  │  │ - Permission checks  │  │ - Audit execution          │   │   │
│  │  └──────────────────────┘  │ - Data fetching/caching    │   │   │
│  │                            │ - Export (JSON/CSV)        │   │   │
│  │                            └────────────────────────────┘   │   │
│  └──────────────────────────────────────────────────────────────┘   │
└────────────────────────────────┬────────────────────────────────────┘
                                 │ HTTPS
                                 ▼
┌─────────────────────────────────────────────────────────────────────┐
│                     SUPABASE CLOUD                                  │
│                                                                     │
│  ┌──────────────────────────────────────────────────────────────┐   │
│  │                    Supabase Auth                              │   │
│  │  - Email/Password authentication                             │   │
│  │  - Google OAuth provider                                     │   │
│  │  - JWT token management                                      │   │
│  │  - Session persistence & refresh                             │   │
│  └──────────────────────────────────────────────────────────────┘   │
│                                                                     │
│  ┌──────────────────────────────────────────────────────────────┐   │
│  │                 Edge Functions (Deno)                         │   │
│  │                                                              │   │
│  │  Core:                                                       │   │
│  │  ┌─────────────┐ ┌───────────────────┐ ┌─────────────────┐  │   │
│  │  │ geo-audit   │ │ multi-account-    │ │ scheduler       │  │   │
│  │  │ (audit      │ │ runner (multi-    │ │ (cron job       │  │   │
│  │  │  engine)    │ │  brand orchestr.) │ │  execution)     │  │   │
│  │  └──────┬──────┘ └────────┬──────────┘ └────────┬────────┘  │   │
│  │         │                 │                      │           │   │
│  │  Citation Pipeline:                                          │   │
│  │  ┌─────────────────┐ ┌───────────────┐ ┌─────────────────┐  │   │
│  │  │ categorize-     │ │ verify-       │ │ citation-       │  │   │
│  │  │ citations       │ │ citations     │ │ analyzer        │  │   │
│  │  └─────────────────┘ └───────────────┘ └─────────────────┘  │   │
│  │                                                              │   │
│  │  Intelligence:                                               │   │
│  │  ┌──────────────┐ ┌──────────────┐ ┌──────────────────┐     │   │
│  │  │ tavily-      │ │ groq-proxy   │ │ ai-search-       │     │   │
│  │  │ search       │ │ (content AI) │ │ volume           │     │   │
│  │  └──────────────┘ └──────────────┘ └──────────────────┘     │   │
│  │                                                              │   │
│  │  Signals:                                                    │   │
│  │  ┌──────────────┐ ┌──────────────┐                           │   │
│  │  │ rss-ingestor │ │ signal-      │                           │   │
│  │  │              │ │ scorer       │                           │   │
│  │  └──────────────┘ └──────────────┘                           │   │
│  │                                                              │   │
│  │  Notifications:                                              │   │
│  │  ┌────────────────────────┐ ┌────────────────────────┐       │   │
│  │  │ notify-schedule-       │ │ notify-admin-signup    │       │   │
│  │  │ execution              │ │                        │       │   │
│  │  └────────────────────────┘ └────────────────────────┘       │   │
│  └──────────────────────────────────────────────────────────────┘   │
│                                                                     │
│  ┌──────────────────────────────────────────────────────────────┐   │
│  │                    PostgreSQL Database                        │   │
│  │                                                              │   │
│  │  ┌──────────┐ ┌─────────────────┐ ┌────────────────────┐    │   │
│  │  │ clients  │ │ forzeo_prompts  │ │ audit_results      │    │   │
│  │  └──────────┘ └─────────────────┘ └────────────────────┘    │   │
│  │  ┌──────────────────┐ ┌──────────────┐ ┌───────────────┐    │   │
│  │  │ forzeo_citations │ │ profiles     │ │ user_clients  │    │   │
│  │  └──────────────────┘ └──────────────┘ └───────────────┘    │   │
│  │  ┌───────────────────┐ ┌──────────────────┐                  │   │
│  │  │ prompt_schedules  │ │ forzeo_api_usage │                  │   │
│  │  └───────────────────┘ └──────────────────┘                  │   │
│  └──────────────────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────────────────┘
                                 │
                                 ▼
┌─────────────────────────────────────────────────────────────────────┐
│                    EXTERNAL AI PROVIDERS                             │
│                                                                     │
│  ┌──────────────────────────────────────────────────────────────┐   │
│  │                DataForSEO LIVE APIs                           │   │
│  │  ┌──────────┐ ┌──────────┐ ┌──────────┐ ┌──────────────┐    │   │
│  │  │ ChatGPT  │ │ Gemini   │ │ Claude   │ │ Perplexity   │    │   │
│  │  │ LIVE LLM │ │ LIVE LLM │ │ LIVE LLM │ │ LIVE LLM     │    │   │
│  │  └──────────┘ └──────────┘ └──────────┘ └──────────────┘    │   │
│  │  ┌────────────────────┐ ┌──────────────────┐                 │   │
│  │  │ Google AI Overview │ │ Google SERP      │                 │   │
│  │  └────────────────────┘ └──────────────────┘                 │   │
│  └──────────────────────────────────────────────────────────────┘   │
│                                                                     │
│  ┌────────────┐ ┌────────────┐ ┌────────────┐ ┌──────────────┐     │
│  │ Groq       │ │ OpenRouter │ │ Tavily     │ │ Jina         │     │
│  │ (Content)  │ │ (Classify) │ │ (Search)   │ │ (Extraction) │     │
│  └────────────┘ └────────────┘ └────────────┘ └──────────────┘     │
│                                                                     │
│  ┌────────────┐                                                     │
│  │ Resend     │                                                     │
│  │ (Email)    │                                                     │
│  └────────────┘                                                     │
└─────────────────────────────────────────────────────────────────────┘
```

---

## 5. Frontend Architecture

### 5.1 Entry Point & App Shell

#### `main.tsx`
The application bootstrap file. Imports the debug logger, then mounts the React app into the `#root` DOM element.

#### `App.tsx` - Root Component
Manages the top-level authentication flow:

```
App Mount
  ↓
supabase.auth.onAuthStateChange()
  ↓
┌─ INITIAL_SESSION / SIGNED_IN / TOKEN_REFRESHED
│    ↓
│    Set session → checkUserOnboarding()
│    ↓
│    Query `profiles` table for user role
│    Query `user_clients` for assigned brands
│    ↓
│    ┌─ No assigned clients → Show OnboardingWizard
│    └─ Has clients → Show ClientDashboard
│
└─ SIGNED_OUT
     ↓
     Show AuthForm (gradient background)
```

**Key behaviors:**
- Single unified auth listener (prevents duplicate events)
- Token refresh optimization (skips unnecessary re-renders)
- `OnboardingWizard` lazy-loaded with `React.lazy()` for bundle splitting

#### `index.css` - Global Styles
Houses the complete design system:

- **Tailwind directives** (`@tailwind base/components/utilities`)
- **CSS custom properties** for colors, shadows, and premium palette
- **Glassmorphism effects** (`.card-glass` with `backdrop-filter: blur`)
- **Gradient cards** (`.card-gradient-blue`, `.card-gradient-emerald`, etc.)
- **Animations** (`.fade-in`, `.slide-in-left`, `.bounce-in`, `.float`)
- **Staggered animations** (`.stagger-1` through `.stagger-6`)
- **Glow effects** (`.glow-blue`, `.glow-purple`, `.glow-emerald`)
- **Custom scrollbar** (Webkit + Firefox)
- **Print/PDF export styles** (hides UI chrome, optimizes for A4 landscape)

---

### 5.2 Pages

#### `ClientDashboard.tsx` (~2000 lines)
The main and only page of the application. Houses:

- **Sidebar navigation** with collapsible menu
- **Client switcher** dropdown (for users with multiple brands)
- **Tab navigation** (Overview, Prompts, Topics, Sources, Citations, Content, Insights)
- **Audit execution** with real-time progress tracking
- **Settings dialog** for brand configuration
- **Export functionality** (JSON, CSV, full text report)
- **Role-based feature visibility** (admin/agency/user)

---

### 5.3 Components

#### Core Business Components

| Component | File | Purpose |
|---|---|---|
| **AuthForm** | `AuthForm.tsx` | Login, signup, and password reset with network retry logic |
| **AgencyOverview** | `AgencyOverview.tsx` | Multi-brand agency dashboard with aggregate metrics |
| **AgencyBrandsManager** | `AgencyBrandsManager.tsx` | Admin interface for managing multiple brands |
| **CampaignsList** | `CampaignsList.tsx` | Campaign CRUD (create, list, delete) |
| **CampaignDetail** | `CampaignDetail.tsx` | Detailed view of a single campaign |
| **CitationPreview** | `CitationPreview.tsx` | Hover tooltip showing citation URL, title, snippet, verification score |
| **CitationIntelligence** | `CitationIntelligence.tsx` | Deep analysis panel for citation patterns |
| **MultiAccountScheduler** | `MultiAccountScheduler.tsx` | 4-step wizard: Select Clients → Select Prompts → Configure Models → Set Schedule |
| **ScheduleManager** | `ScheduleManager.tsx` | Monitor running/completed schedule executions |
| **SignalsDashboard** | `SignalsDashboard.tsx` | RSS-based signal detection and scoring |
| **SOVLineChart** | `SOVLineChart.tsx` | Custom SVG line chart with Catmull-Rom spline interpolation |
| **ModelLogos** | `ModelLogos.tsx` | AI model brand icons (ChatGPT, Gemini, Claude, Perplexity, Google) |
| **UniversalImport** | `UniversalImport.tsx` | Import prompts from CSV, JSON, or plain text |
| **UserManagement** | `UserManagement.tsx` | Admin panel for user roles, activation, and client assignment |
| **VisibilityGraphs** | `VisibilityGraphs.tsx` | Visibility trend and comparison graphs |

#### Scheduler Sub-Components (in `scheduler/`)

| Component | Purpose |
|---|---|
| **AccountSelector** | Step 1: Pick which brands/clients to audit |
| **PromptSelector** | Step 2: Choose prompts (all, by category, or custom) |
| **ConditionalRulesEditor** | Step 3: Set budget caps, retry policies, concurrency |
| **ExecutionMonitor** | Real-time progress tracking during execution |
| **AnalyticsDashboard** | Historical schedule analytics and cost tracking |

---

### 5.4 Tabs System

The dashboard uses a tabbed interface. Each tab is a separate component in `src/components/tabs/`:

#### OverviewTab
**Purpose:** Primary dashboard view with key metrics and visualizations.

**Contains:**
- **Metric cards:** SOV %, Average Rank, Total Citations, Total Cost
- **Donut chart:** Citation distribution by source type
- **Bar chart:** Visibility score per AI model
- **Competitor gap:** Horizontal bar chart comparing brand vs. competitors
- **Top sources:** List of most-cited domains
- **SOV trend:** Line chart with Catmull-Rom cubic spline smoothing
- **Agency overview:** Multi-brand summary (admin only)

#### PromptsTab
**Purpose:** Manage the prompts that are used for audits.

**Contains:**
- **Sub-tabs:** Active, Suggested, Inactive
- **Add prompt:** Text input for new prompts
- **Bulk add:** Import multiple prompts at once
- **Prompt table:** Displays prompt text, category, last audit date, SOV result
- **Actions:** Run single prompt, view results, toggle active/inactive, delete
- **Keyboard shortcut:** `Ctrl+Enter` to run all active prompts

#### TopicsTab
**Purpose:** Discover keywords and topic clusters related to the brand.

**Contains:**
- AI-generated topic suggestions based on brand industry
- Keyword clustering by semantic relevance
- One-click conversion of topics to prompts

#### SourcesTab
**Purpose:** Analyze which domains are being cited by AI models.

**Contains:**
- **Bar chart:** Top cited domains
- **Toggle:** View by domains vs. individual URLs
- **Sources table:** Domain, citation count, prompt context, authority tier
- **Relationship type:** Owned, competitor, or neutral source classification

#### CitationsTab
**Purpose:** Detailed table of every citation extracted from AI responses.

**Contains:**
- **Stats cards:** Total citations, unique citations, breakdown by source type
- **Sortable table:** URL, domain, model, count, date, snippet
- **Domain type badges:** Color-coded (owned=green, competitor=red, editorial=blue, etc.)
- **Citation preview:** Hover to see full details
- **Filters:** By domain type, by AI model
- **Export:** Download citations as CSV or JSON

#### ContentTab
**Purpose:** Generate SEO-optimized content using AI.

**Contains:**
- **Topic/keyword input** field
- **Content type selector:** Article, Listicle, Guide, FAQ, Comparison
- **Generate button** with loading state
- **Markdown preview** with syntax highlighting
- **Actions:** Copy to clipboard, download as file
- **Brand mentions** highlighted in generated content

#### InsightsTab
**Purpose:** AI-generated recommendations based on audit data.

**Contains:**
- Visibility improvement suggestions
- Content opportunity identification
- Competitor gap recommendations
- Keyword strategy priorities
- Action items ranked by impact

---

### 5.5 UI Component Library

Located in `src/components/ui/`, these are Radix UI primitives wrapped with Tailwind CSS styling. All follow the same pattern: Radix provides accessibility and behavior, Tailwind provides visual styling, and `cn()` from `lib/utils.ts` handles class merging.

**Components:** Alert, Badge, Button, Calendar, Card, Checkbox, Dialog, Dropdown Menu, Input, Label, Popover, Progress, Radio Group, Select, Sheet, Tabs, Textarea, and more (~22 total).

---

### 5.6 Hooks (State Management)

#### `useAuth()` - Authentication & Authorization

**Returns:**
```typescript
{
  user: AuthUser | null       // Current user with role metadata
  role: 'admin' | 'agency' | 'user'
  isAdmin: boolean
  isAgency: boolean
  isActive: boolean
  loading: boolean
  assignedClientIds: string[] // Which brands the user can access
  refreshAuth(): Promise<void>
  checkPermission(permission: string): boolean
}
```

**Permission Matrix:**

| Permission | Admin | Agency | User |
|---|:---:|:---:|:---:|
| view_overview | Yes | Yes | Yes |
| view_prompts | Yes | Yes | Yes |
| add_prompts | Yes | Yes | Yes |
| run_audits | Yes | Yes | Yes |
| view_sources | Yes | Yes | Yes |
| view_content | Yes | Yes | Yes |
| generate_content | Yes | Yes | Yes |
| view_insights | Yes | Yes | Yes |
| export_data | Yes | Yes | Yes |
| view_intelligence | Yes | Yes | - |
| view_signals | Yes | Yes | - |
| manage_brands | Yes | Yes | - |
| view_campaigns | Yes | - | - |
| create_campaigns | Yes | - | - |
| view_analytics | Yes | - | - |
| view_schedules | Yes | - | - |
| create_schedules | Yes | - | - |
| manage_users | Yes | - | - |
| view_all_data | Yes | - | - |

#### `useClientDashboard()` - Central State Management (~2000 lines)

The primary state management hook. Manages all dashboard data and operations.

**Key State:**
```typescript
{
  // Data
  clients: Client[]
  selectedClient: Client | null
  prompts: Prompt[]
  auditResults: AuditResult[]

  // UI State
  loading: boolean
  auditProgress: { current: number, total: number, model: string }
  activeTab: string

  // Methods (see below)
}
```

**Client Management:**
- `addClient(name, brandName, domain, tags, region, industry, competitors)`
- `updateClient(clientId, updates)`
- `deleteClient(clientId)`
- `switchClient(clientId)` - Load all data for a different brand

**Prompt Management:**
- `addCustomPrompt(promptText)`
- `bulkAddPrompts(prompts[])`
- `generatePromptsFromKeywords(keywords)` - AI-generated prompt suggestions
- `togglePrompt(promptId, isActive)`
- `deletePrompt(promptId)`

**Audit Execution:**
- `runFullAudit()` - Run all active prompts across all models
- `runSinglePrompt(promptId)` - Run one prompt
- `runFullAudit(clientId, promptIds, models)` - Targeted audit

**Analytics:**
- `calculateSummary()` - Compute SOV, rank, citations, cost
- `getTopSources()` - Most-cited domains
- `getCompetitorGap()` - Competitive comparison data

**Export:**
- `exportAsJSON()` - Full data export
- `exportAsCSV()` - Tabular data export
- `generateFullTextReport()` - Human-readable report

**AI Models Configuration:**
```typescript
const AI_MODELS = [
  { id: "chatgpt",           name: "ChatGPT",    provider: "OpenAI",      color: "#10b981" },
  { id: "claude",            name: "Claude",      provider: "Anthropic",   color: "#f59e0b" },
  { id: "gemini",            name: "Gemini",      provider: "Google",      color: "#3b82f6" },
  { id: "perplexity",        name: "Perplexity",  provider: "Perplexity",  color: "#a855f7" },
  { id: "google_ai_overview", name: "Google AI",   provider: "Google",      color: "#dc2626" },
  { id: "google_serp",       name: "Google SERP", provider: "Google",      color: "#dc2626" },
];
```

---

### 5.7 Utilities

#### `brandMatching.ts` - Fuzzy Brand Name Matching

**Purpose:** Determine if two brand names refer to the same entity, even with variations.

```
Input examples that should all match "Monday":
  "Monday", "monday.com", "Monday CRM", "Monday App", "Monday Software", "monday"

Algorithm:
1. normalizeBrandToken(name):
   - Convert to lowercase
   - Strip TLDs (.com, .io, .org, .net, .co, etc.)
   - Strip common suffixes (CRM, App, Software, Platform, Hub, etc.)
   - Remove punctuation
   - Trim whitespace

2. brandNamesMatch(a, b):
   - Normalize both names
   - Check against COMMON_WORD_SKIP set (100+ words like "the", "best", "app")
   - Return true if:
     - Exact match after normalization, OR
     - One contains the other (both >= 4 chars)

3. brandMentionedInText(response, brandName, aliases):
   - Check if brand or any alias appears in AI response
   - Uses both exact substring match and normalized token matching
```

#### `dashboardHelpers.ts` - Domain Classification & Metrics

**Key exports:**

```typescript
// Domain type taxonomy with visual styling
DOMAIN_TYPES = {
  owned:         { label: "Owned",        color: "text-emerald-700", dot: "bg-emerald-500" },
  competitor:    { label: "Competitor",    color: "text-red-700",     dot: "bg-red-500"     },
  ugc:           { label: "UGC",          color: "text-orange-700",  dot: "bg-orange-500"  },
  editorial:     { label: "Editorial",     color: "text-blue-700",    dot: "bg-blue-500"    },
  review:        { label: "Review",        color: "text-purple-700",  dot: "bg-purple-500"  },
  reference:     { label: "Reference",     color: "text-cyan-700",    dot: "bg-cyan-500"    },
  institutional: { label: "Institutional", color: "text-teal-700",    dot: "bg-teal-500"    },
  social:        { label: "Social",        color: "text-pink-700",    dot: "bg-pink-500"    },
  ecommerce:     { label: "E-Commerce",    color: "text-amber-700",   dot: "bg-amber-500"   },
  other:         { label: "Other",         color: "text-gray-700",    dot: "bg-gray-500"    },
}

// Classify any domain into one of the types above
classifyDomain(domain, clientDomain?, competitors?, brandName?) → string

// Multi-layer fallback for computing brand rank from audit results
computePositionForResult(result, selectedClient) → number | null
  // 1. Check summary.average_rank (backend-computed, most reliable)
  // 2. Average model_results[].brand_rank (persisted DB field)
  // 3. Parse from raw AI response text via cleanAndAnalyzeResponse (handles older audits)
  // 4. Use DataForSEO extracted_brands[].position (entity API field)
  // 5. Mention-order heuristic: count how many competitors appear before brand in text
```

#### `timezone.ts` - Timezone Conversion

```typescript
localTimeToUTC(localDate, localTime, timezone) → UTC ISO string
utcToLocalTime(utcDate, timezone) → { date, time }
formatInTimezone(utcDate, timezone, format) → formatted string
getLocalTimezone() → browser timezone string
```

#### `lib/utils.ts` - CSS Class Merging

```typescript
cn(...inputs: ClassValue[]) → string
// Combines clsx (conditional classes) + tailwind-merge (conflict resolution)
// Example: cn("px-2 py-1", condition && "px-4") → "py-1 px-4"
```

---

## 6. Backend Architecture

### 6.1 Supabase Edge Functions

All backend logic runs as **Supabase Edge Functions** - serverless TypeScript functions running on the Deno runtime. They are deployed to Supabase Cloud and invoked via HTTPS.

**Shared patterns across all functions:**
- CORS headers for cross-origin requests
- Input validation and sanitization
- Error handling with sanitized error messages
- Environment variable-based configuration (no hardcoded secrets)
- JSON request/response format

---

### 6.2 Core Audit Engine (`geo-audit`)

**File:** `supabase/functions/geo-audit/index.ts`
**Purpose:** The heart of the system. Queries multiple AI models and analyzes their responses for brand visibility.

**Request format:**
```json
{
  "client_id": "uuid",
  "prompt_id": "uuid",
  "prompt_text": "Best dating apps in India",
  "brand_name": "Juleo",
  "brand_tags": ["Juleo Club", "Juleo App"],
  "competitors": ["Bumble", "Tinder", "Hinge"],
  "location_code": 2356,
  "models": ["chatgpt", "gemini", "claude", "perplexity", "google_ai_overview", "google_serp"]
}
```

**Processing pipeline:**
1. **Validate input** - Sanitize strings, validate UUIDs
2. **Query each model in parallel** using `Promise.all()`
3. **For each model response:**
   - Extract the raw text response
   - Detect brand mentions (exact + fuzzy matching)
   - Count brand mention occurrences
   - Extract brand rank from numbered lists
   - Collect all citation URLs (regex + HTML parsing)
   - Detect competitor mentions
   - Calculate per-model cost
4. **Aggregate across models:**
   - Share of Voice = (models with brand mention / total models) × 100
   - Average Rank = mean of brand_rank across models
   - Total Citations = count of unique citation URLs
   - Total Cost = sum of per-model costs
5. **Persist to database** (audit_results, forzeo_citations, forzeo_api_usage)
6. **Return structured response**

**Response format:**
```json
{
  "success": true,
  "data": {
    "prompt_text": "Best dating apps in India",
    "brand_name": "Juleo",
    "summary": {
      "share_of_voice": 67,
      "average_rank": 3.5,
      "total_citations": 24,
      "total_cost": 0.32
    },
    "model_results": [
      {
        "model": "chatgpt",
        "model_name": "ChatGPT",
        "success": true,
        "brand_mentioned": true,
        "brand_mention_count": 3,
        "brand_rank": 2,
        "brand_sentiment": "positive",
        "citations": [
          { "url": "https://example.com/article", "title": "Top Apps", "domain": "example.com" }
        ],
        "citation_count": 6,
        "api_cost": 0.08,
        "raw_response": "Here are the best dating apps...",
        "response_length": 1847
      }
    ],
    "timestamp": "2026-03-03T12:00:00Z"
  }
}
```

**AI Model Endpoints (via DataForSEO):**

| Model | DataForSEO Endpoint | Internal Model |
|---|---|---|
| ChatGPT | `/ai_optimization/chat_gpt/llm_responses/live` | gpt-4.1-mini |
| Gemini | `/ai_optimization/gemini/llm_responses/live` | gemini-2.5-flash |
| Claude | `/ai_optimization/claude/llm_responses/live` | claude-sonnet-4-0 |
| Perplexity | `/ai_optimization/perplexity/llm_responses/live` | sonar-pro |
| Google AI Overview | `/serp/google/ai_overview/live` | N/A (Google Search) |
| Google SERP | `/serp/google/organic/live` | N/A (Google Search) |

**Reliability features:**
- Exponential backoff retry (1s → 2s → 4s)
- Per-model timeout handling
- Graceful degradation (if one model fails, others still return)
- Cost tracking for budget monitoring

---

### 6.3 Citation Processing Pipeline

Three edge functions form a pipeline for deep citation analysis:

#### `categorize-citations`
**Purpose:** Classify citation domains into categories using AI.

**Process:**
1. Receives a batch of domains (max 40)
2. Sends to an AI classification model
3. Returns category for each domain

**Categories:** owned, competitor, social, ugc, review, ecommerce, editorial, reference, institutional, other

#### `verify-citations`
**Purpose:** Verify that cited URLs actually contain relevant content.

**Process:**
1. Extract page content from the cited URL (via Jina Reader)
2. Compare extracted content against the AI's claim (via Groq)
3. Return a semantic similarity score (0-100)

#### `citation-analyzer`
**Purpose:** Deep analysis of citation sources.

**Analysis includes:**
- Authority score estimation
- Topic relevance to brand/query
- Content freshness indicator
- Sentiment toward the brand

---

### 6.4 Scheduling System

Two functions work together for automated recurring audits:

#### `scheduler`
**Purpose:** Cron-triggered function that checks for due schedules and executes them.

**Features:**
- Execution locking (prevents duplicate runs)
- Recurrence support: once, daily, weekly (specific days), monthly
- Timezone-aware scheduling
- Delegates to `multi-account-runner` for multi-brand schedules

#### `multi-account-runner`
**Purpose:** Orchestrate audits across multiple brands with safety controls.

**Features:**
- **Chunked processing:** Processes 3 prompts per invocation to stay within Edge Function timeouts
- **Concurrency limiting:** Controls how many parallel model queries run
- **Budget caps:** Stops execution if cost exceeds `max_cost_per_run`
- **Execution state tracking:** Saves progress to database for resumability
- **Resume capability:** If an invocation times out, the next one picks up where it left off
- **Progress notifications:** Updates execution status in real-time

**Timeout management:**
```
Edge Function Timeout:     150 seconds
Safe Execution Window:     110 seconds
Per-Prompt Timeout:        60 seconds
Chunk Size:                3 prompts
Avg Seconds per Prompt:    37 seconds
```

---

### 6.5 Content & Intelligence Functions

#### `groq-proxy`
**Purpose:** Proxy for Groq API calls for fast content generation.
**Model:** Llama 3.1 8B Instant
**Use cases:** Content generation, insights, topic suggestions

#### `tavily-search`
**Purpose:** Real-time web search for brand mentions and competitive intelligence.
**Returns:** AI-generated answer, source URLs with relevance scores, brand/competitor mention analysis

#### `ai-search-volume`
**Purpose:** Estimate how often specific queries are asked to AI search engines.
**Uses:** Groq for inference-based estimation

#### `signal-scorer`
**Purpose:** Score and prioritize signals from RSS feeds and data sources.
**Detects:** Trends, anomalies, opportunities, competitive movements

#### `rss-ingestor`
**Purpose:** Ingest and parse RSS feeds for the signal detection system.
**Implementation:** Native XML parsing (no external API)

---

### 6.6 Notification System

#### `notify-schedule-execution`
**Purpose:** Send email notification when a scheduled audit completes.
**Trigger:** Called by `multi-account-runner` on completion.
**Email provider:** Resend

#### `notify-admin-signup`
**Purpose:** Notify admins when a new user signs up.
**Trigger:** Supabase Auth webhook on user creation.
**Email provider:** Resend

---

## 7. Database Schema

### Entity Relationship

```
profiles (1) ←──── (N) user_clients (N) ────→ (1) clients
                                                     │
                                                     ├──→ (N) forzeo_prompts
                                                     │
                                                     ├──→ (N) audit_results ──→ (N) forzeo_citations
                                                     │
                                                     ├──→ (N) prompt_schedules
                                                     │
                                                     └──→ (N) forzeo_api_usage
```

### Table Definitions

#### `clients` - Brand/Company Profiles
| Column | Type | Description |
|---|---|---|
| id | UUID (PK) | Unique identifier |
| name | TEXT | Display name |
| brand_name | TEXT | Primary brand name for matching |
| brand_domain | TEXT | Brand's website domain |
| brand_tags | TEXT[] | Alternative brand names/aliases |
| slug | TEXT | URL-friendly identifier |
| target_region | TEXT | Geographic target (e.g., "India") |
| location_code | INTEGER | DataForSEO location code (e.g., 2356 for India) |
| industry | TEXT | Industry vertical |
| competitors | TEXT[] | List of competitor brand names |
| primary_color | TEXT | Brand color for UI theming |
| created_at | TIMESTAMPTZ | Creation timestamp |

#### `forzeo_prompts` - Audit Prompts
| Column | Type | Description |
|---|---|---|
| id | UUID (PK) | Unique identifier |
| client_id | UUID (FK → clients) | Owning brand |
| prompt_text | TEXT | The prompt sent to AI models |
| category | TEXT | 'niche', 'super_niche', or 'custom' |
| is_active | BOOLEAN | Whether included in bulk audits |
| created_at | TIMESTAMPTZ | Creation timestamp |

#### `audit_results` - Audit Outcomes
| Column | Type | Description |
|---|---|---|
| id | UUID (PK) | Unique identifier |
| client_id | UUID (FK → clients) | Owning brand |
| prompt_id | UUID (FK → forzeo_prompts) | Source prompt |
| prompt_text | TEXT | Prompt text snapshot |
| brand_name | TEXT | Brand being tracked |
| share_of_voice | INTEGER | SOV percentage (0-100) |
| visibility_score | INTEGER | Computed visibility score |
| trust_index | INTEGER | Source authority score |
| average_rank | DECIMAL(5,2) | Average brand position |
| total_citations | INTEGER | Number of citations found |
| total_cost | DECIMAL(10,6) | API cost for this audit |
| model_results | JSONB | Per-model detailed results |
| top_sources | JSONB | Most-cited domains |
| top_competitors | JSONB | Competitor analysis |
| summary | JSONB | Aggregate metrics |
| created_at | TIMESTAMPTZ | Audit timestamp |

#### `forzeo_citations` - Individual Citations
| Column | Type | Description |
|---|---|---|
| id | UUID (PK) | Unique identifier |
| audit_result_id | UUID (FK → audit_results) | Parent audit |
| client_id | UUID (FK → clients) | Owning brand |
| url | TEXT | Full citation URL |
| title | TEXT | Page title |
| domain | TEXT | Domain name |
| position | INTEGER | Position in AI response |
| snippet | TEXT | Relevant text excerpt |
| model | TEXT | Which AI model cited this |
| is_brand_source | BOOLEAN | Whether it's a brand-owned source |
| created_at | TIMESTAMPTZ | Extraction timestamp |

#### `profiles` - User Profiles (extends Supabase Auth)
| Column | Type | Description |
|---|---|---|
| id | UUID (PK, FK → auth.users) | Supabase user ID |
| email | TEXT | User email |
| role | TEXT | 'admin', 'agency', or 'user' |
| is_active | BOOLEAN | Account active status |
| created_at | TIMESTAMPTZ | Registration timestamp |
| last_login_at | TIMESTAMPTZ | Last login timestamp |

#### `user_clients` - User-Brand Access Mapping
| Column | Type | Description |
|---|---|---|
| id | UUID (PK) | Unique identifier |
| user_id | UUID (FK → auth.users) | User |
| client_id | UUID (FK → clients) | Brand they can access |
| role | TEXT | Role for this specific brand |
| created_at | TIMESTAMPTZ | Assignment timestamp |

#### `prompt_schedules` - Recurring Audit Schedules
| Column | Type | Description |
|---|---|---|
| id | UUID (PK) | Unique identifier |
| client_id | UUID (FK → clients) | Owning brand |
| name | TEXT | Schedule name |
| prompt_ids | UUID[] | Which prompts to run |
| models | TEXT[] | Which AI models to query |
| recurrence_type | TEXT | 'once', 'daily', 'weekly', 'monthly' |
| recurrence_days_of_week | INTEGER[] | Days for weekly schedules (0=Sun) |
| next_run_at | TIMESTAMPTZ | Next scheduled execution time |
| last_run_at | TIMESTAMPTZ | Most recent execution time |
| is_active | BOOLEAN | Whether schedule is enabled |
| created_at | TIMESTAMPTZ | Creation timestamp |

#### `forzeo_api_usage` - API Cost Tracking
| Column | Type | Description |
|---|---|---|
| id | UUID (PK) | Unique identifier |
| client_id | UUID (FK → clients) | Owning brand |
| api_name | TEXT | API service name |
| endpoint | TEXT | Specific endpoint called |
| request_count | INTEGER | Number of requests |
| cost | DECIMAL(10,6) | Total cost |
| prompt_text | TEXT | Associated prompt |
| models_used | TEXT[] | Models queried |
| created_at | TIMESTAMPTZ | Usage timestamp |

---

## 8. Authentication & Authorization

### Authentication Flow

```
┌────────────────────────────────────────────────────────────────┐
│                     Authentication Flow                         │
│                                                                │
│  ┌──────────┐                                                  │
│  │ User     │──── Email + Password ───→ Supabase Auth          │
│  │ visits   │──── Google OAuth ───────→ Supabase Auth          │
│  │ app      │──── Forgot Password ────→ Supabase Auth          │
│  └──────────┘                                │                 │
│                                              ▼                 │
│                                    ┌───────────────────┐       │
│                                    │  JWT Token Issued  │       │
│                                    │  (stored in        │       │
│                                    │   localStorage)    │       │
│                                    └─────────┬─────────┘       │
│                                              │                 │
│                                              ▼                 │
│                                    ┌───────────────────┐       │
│                                    │ Fetch Profile      │       │
│                                    │ (role, is_active)  │       │
│                                    └─────────┬─────────┘       │
│                                              │                 │
│                                              ▼                 │
│                                    ┌───────────────────┐       │
│                                    │ Fetch User-Clients │       │
│                                    │ (assigned brands)  │       │
│                                    └─────────┬─────────┘       │
│                                              │                 │
│                                    ┌─────────┴─────────┐       │
│                                    │                   │       │
│                                    ▼                   ▼       │
│                           No clients?          Has clients?    │
│                           Show Onboarding      Show Dashboard  │
│                           Wizard               immediately     │
└────────────────────────────────────────────────────────────────┘
```

### Role-Based Access Control

The system has three roles with descending privilege levels:

**Admin** - Full system access
- All features visible
- Can manage users (create, deactivate, change roles)
- Can view all brands/clients
- Can create and manage schedules
- Can access campaign management
- Can view analytics across all brands

**Agency** - Expanded access for agency partners
- Can view and manage assigned brands
- Can run audits and manage prompts
- Can access citation intelligence
- Can view signal detection
- Cannot manage users or schedules
- Cannot access campaigns or cross-brand analytics

**User** - Standard brand access
- Can view dashboard for assigned brands
- Can add/manage prompts and run audits
- Can generate content and view insights
- Can export data
- Cannot access admin features

### Network Resilience

The `AuthForm` component includes robust error handling:
- **Network error detection:** Identifies connectivity issues vs. auth failures
- **Exponential backoff retry:** Automatically retries failed requests (1s → 2s → 4s)
- **Offline banner:** Visual indicator when the user is disconnected
- **Friendly error messages:** Translates technical errors to user-friendly language

---

## 9. Data Flow & Workflows

### 9.1 Audit Execution Flow

```
User clicks "Run Audit" in Dashboard
         │
         ▼
useClientDashboard.runFullAudit()
         │
         ├── Collect active prompts
         ├── Determine selected models
         │
         ▼ (for each prompt)
Frontend calls: supabase.functions.invoke('geo-audit', { body: {...} })
         │
         ▼
┌─────────────────────────────────────────────────────────────┐
│                   geo-audit Edge Function                     │
│                                                             │
│  1. Validate & sanitize input                               │
│  2. Query models in parallel (Promise.all):                 │
│     ┌──────────┐ ┌──────────┐ ┌──────────┐ ┌──────────┐    │
│     │ ChatGPT  │ │ Gemini   │ │ Claude   │ │Perplexity│    │
│     └────┬─────┘ └────┬─────┘ └────┬─────┘ └────┬─────┘    │
│          │            │            │            │           │
│          ▼            ▼            ▼            ▼           │
│     ┌──────────┐ ┌──────────┐ ┌──────────┐ ┌──────────┐    │
│     │Google AI │ │Google    │ │          │ │          │    │
│     │Overview  │ │SERP      │ │          │ │          │    │
│     └────┬─────┘ └────┬─────┘ └──────────┘ └──────────┘    │
│          │            │                                     │
│  3. Parse each response:                                    │
│     - Brand mention detection (exact + fuzzy)               │
│     - Rank extraction from numbered lists                   │
│     - Citation URL extraction (regex + parsing)             │
│     - Competitor mention detection                          │
│     - Per-model cost calculation                            │
│                                                             │
│  4. Aggregate metrics:                                      │
│     SOV = (mentioned_models / total_models) × 100          │
│     Avg Rank = mean(model_ranks)                           │
│     Citations = count(unique_urls)                          │
│     Cost = sum(model_costs)                                │
│                                                             │
│  5. Save to database:                                       │
│     → audit_results                                         │
│     → forzeo_citations                                      │
│     → forzeo_api_usage                                      │
└─────────────────────┬───────────────────────────────────────┘
                      │
                      ▼
Frontend receives response
         │
         ├── Update metric cards (SOV, Rank, Citations, Cost)
         ├── Render charts (model comparison, competitor gap)
         ├── Populate citations table
         └── Update SOV trend line
```

### 9.2 Multi-Brand Schedule Flow

```
Admin creates schedule via MultiAccountScheduler
         │
         ├── Step 1: Select clients (brands)
         ├── Step 2: Select prompts (all / by category / custom)
         ├── Step 3: Configure models, concurrency, budget
         ├── Step 4: Set recurrence (once / daily / weekly / monthly)
         │
         ▼
Schedule saved to prompt_schedules table
         │
         ▼ (at scheduled time)
┌─────────────────────────────────────────────────────────────┐
│                    scheduler Edge Function                    │
│                                                             │
│  1. Query prompt_schedules WHERE next_run_at <= NOW()       │
│  2. Acquire execution lock (prevent duplicates)             │
│  3. Invoke multi-account-runner                             │
└─────────────────────┬───────────────────────────────────────┘
                      │
                      ▼
┌─────────────────────────────────────────────────────────────┐
│              multi-account-runner Edge Function               │
│                                                             │
│  1. Load schedule configuration                             │
│  2. Fetch selected clients and their prompts                │
│  3. Chunk prompts into groups of 3                          │
│                                                             │
│  For each chunk (within 110s safe window):                  │
│     ├── Call geo-audit for each prompt                      │
│     ├── Track cumulative cost                               │
│     ├── Check budget cap (stop if exceeded)                 │
│     ├── Update execution progress in database               │
│     └── Check remaining time (stop if near timeout)         │
│                                                             │
│  If timeout approaching:                                    │
│     └── Save execution state for resumption                 │
│                                                             │
│  On completion:                                             │
│     ├── Update schedule.last_run_at                         │
│     ├── Calculate schedule.next_run_at                      │
│     └── Invoke notify-schedule-execution (email)            │
└─────────────────────────────────────────────────────────────┘
```

### 9.3 Citation Pipeline Flow

```
After audit completes with citations
         │
         ▼
┌─────────────────────────────────────────┐
│       categorize-citations               │
│                                         │
│  Input: List of domains (max 40)        │
│  Process: AI classifies each domain     │
│  Output: { domain: category } map       │
│                                         │
│  Categories:                            │
│  owned, competitor, social, ugc,        │
│  review, ecommerce, editorial,          │
│  reference, institutional, other        │
└────────────────┬────────────────────────┘
                 │
                 ▼
┌─────────────────────────────────────────┐
│       verify-citations                   │
│                                         │
│  Input: Citation URL + AI claim         │
│  Process:                               │
│    1. Fetch page via Jina Reader        │
│    2. Compare content vs AI's claim     │
│    3. Score semantic similarity (0-100) │
│  Output: Verification score             │
└────────────────┬────────────────────────┘
                 │
                 ▼
┌─────────────────────────────────────────┐
│       citation-analyzer                  │
│                                         │
│  Input: Citation + brand context        │
│  Process: Deep analysis                 │
│  Output:                                │
│    - Authority score                    │
│    - Topic relevance                    │
│    - Content freshness                  │
│    - Brand sentiment                    │
└─────────────────────────────────────────┘
```

### 9.4 Content Generation Flow

```
User enters topic in ContentTab
         │
         ├── Selects content type (article / listicle / guide / FAQ / comparison)
         │
         ▼
Frontend calls: supabase.functions.invoke('groq-proxy', {
  body: { topic, contentType, brandName, industry, competitors }
})
         │
         ▼
┌─────────────────────────────────────────┐
│           groq-proxy Edge Function       │
│                                         │
│  1. Build prompt with brand context     │
│  2. Call Groq API (Llama 3.1 8B)        │
│  3. Return generated markdown           │
└────────────────┬────────────────────────┘
                 │
                 ▼
Frontend renders markdown
         │
         ├── Syntax highlighting
         ├── Brand mentions highlighted
         └── Copy / Download actions
```

---

## 10. Key Algorithms

### 10.1 Share of Voice (SOV)

**What it measures:** The percentage of AI models that mention the brand when asked a relevant question.

**Formula:**
```
SOV = (Number of models that mentioned the brand / Total successful models) × 100
```

**Example:**
```
Prompt: "Best dating apps in India"
Brand: "Juleo"

Results:
  ChatGPT:    Brand mentioned ✓ (rank #3)
  Gemini:     Brand NOT mentioned ✗
  Claude:     Brand mentioned ✓ (rank #2)
  Perplexity: Brand mentioned ✓ (rank #4)
  Google AI:  Brand mentioned ✓ (rank #5)
  Google SERP: Brand NOT mentioned ✗

SOV = (4 / 6) × 100 = 67%
```

**Interpretation:**
- **80-100%:** Excellent - AI models consistently recommend the brand
- **50-79%:** Good - Brand has moderate AI visibility
- **20-49%:** Fair - Room for improvement
- **0-19%:** Poor - Brand is largely invisible to AI models

---

### 10.2 Brand Matching Algorithm

The system uses a multi-layer brand detection approach because AI models mention brands in many different formats.

**Challenge:** "monday.com" might appear as "Monday", "Monday.com", "Monday CRM", "monday app", etc.

**Solution (3-step process):**

**Step 1: Token Normalization**
```
Input: "monday.com"
  → lowercase: "monday.com"
  → strip TLD: "monday"
  → strip suffixes: "monday"
  → result: "monday"

Input: "Monday CRM"
  → lowercase: "monday crm"
  → strip TLD: "monday crm"
  → strip suffixes: "monday"
  → result: "monday"
```

**Step 2: Common Word Filtering**
A skip list of 100+ common English words prevents false positives:
- Words like "best", "top", "app", "the", "new" are ignored
- Prevents "Best App" from matching a brand called "Best"

**Step 3: Matching**
```
Match if:
  1. Normalized tokens are identical, OR
  2. One normalized token contains the other (both >= 4 characters)
```

---

### 10.3 Rank Extraction

Extracts the brand's position from numbered lists in AI responses.

**AI Response example:**
```
Here are the best dating apps in India:

1. Bumble - Great for women-first dating
2. Tinder - Most popular worldwide
3. Juleo - Designed for serious relationships in India
4. Hinge - Known for meaningful connections
5. OkCupid - Free and feature-rich
```

**Extraction:** Parse numbered patterns (1., 2., 3., etc.) and find which number contains the brand name → Rank = 3

**Multi-layer fallback:**
1. Use `summary.average_rank` if pre-computed
2. Average `model_results[].brand_rank` across models
3. Parse numbered lists from `raw_response` text
4. Use DataForSEO's extracted brand position data

---

### 10.4 Domain Classification

Classifies citation domains into meaningful categories for analysis.

**Classification rules:**
```
Domain matches brand_domain     → "owned"
Domain matches competitor list  → "competitor"
Domain contains social patterns → "social"
  (facebook, youtube, twitter, linkedin, instagram, tiktok)
Domain contains UGC patterns    → "ugc"
  (reddit, quora, stackoverflow, medium, forums)
Domain contains review patterns → "review"
  (g2, capterra, trustpilot, trustradius, getapp)
Domain contains ecommerce       → "ecommerce"
  (amazon, flipkart, ebay, shopify)
Domain contains editorial       → "editorial"
  (forbes, techcrunch, bbc, nytimes, wired, verge)
Domain contains reference       → "reference"
  (wikipedia, .edu, .gov, britannica)
Domain contains institutional   → "institutional"
  (government, regulatory bodies)
Otherwise                       → "other"
```

---

## 11. Styling & Design System

### Color System

The design uses CSS custom properties defined in `index.css`:

**Core palette:**
- Primary (indigo/blue)
- Secondary (soft gray)
- Accent (vibrant highlight)
- Destructive (red for errors/warnings)
- Muted (background gray)

**Premium palette:**
- Premium Blue (#3b82f6)
- Premium Purple (#8b5cf6)
- Premium Emerald (#10b981)
- Premium Amber (#f59e0b)
- Premium Rose (#f43f5e)

### Visual Effects

| Effect | Class | Description |
|---|---|---|
| Glassmorphism | `.card-glass` | Semi-transparent card with backdrop blur |
| Elevated card | `.card-elevated` | Card with depth shadow |
| Interactive card | `.card-interactive` | Scale + shadow on hover |
| Gradient cards | `.card-gradient-*` | Background gradient variants |
| Glow effects | `.glow-blue`, `.glow-purple` | Colored shadow glow |
| Gradient text | `.gradient-text` | Blue → Purple → Pink text |
| Hover lift | `.hover-lift` | Subtle upward translation on hover |

### Animations

| Animation | Class | Duration |
|---|---|---|
| Fade in | `.fade-in` | 0.5s |
| Slide in left | `.slide-in-left` | 0.5s |
| Slide in right | `.slide-in-right` | 0.5s |
| Zoom in | `.zoom-in` | 0.5s |
| Bounce in | `.bounce-in` | 0.6s |
| Float | `.float` | 3s (infinite) |
| Pulse soft | `.pulse-soft` | 2s (infinite) |
| Staggered | `.stagger-1` to `.stagger-6` | 0.1s increments |

### Print / PDF Export

Special `@media print` styles:
- Hides navigation, buttons, modals
- Optimizes for A4 landscape format
- Sets page break rules for clean pagination
- Removes shadows and animations
- Uses black text on white background

---

## 12. Performance Optimizations

### Code Splitting
```
Main bundle:
  → App.tsx, ClientDashboard, tabs, hooks

Lazy-loaded chunks:
  → OnboardingWizard (React.lazy)
  → UserManagement (React.lazy)
  → MultiAccountScheduler (React.lazy)
  → SignalsDashboard (React.lazy)

Vendor chunks (vite.config.ts):
  → react-vendor (React + ReactDOM)
  → supabase (Supabase JS)
  → ui (Radix UI dialogs, selects, dropdowns)
```

### React Optimizations
- `useCallback` for event handlers and expensive computations
- `useMemo` for derived data (metrics, sorted lists, filtered data)
- `useRef` for non-rendering values (prevents double-fetch on StrictMode)
- Conditional rendering based on active tab (only render visible tab)

### Virtual Scrolling
- TanStack React Virtual for large citation/source tables
- Only renders visible rows in the viewport
- Handles 10,000+ rows without performance degradation

### API Optimizations
- **Parallel queries:** All AI model queries run simultaneously via `Promise.all()`
- **Retry with backoff:** Failed requests retry with exponential delay (1s → 2s → 4s)
- **Request debouncing:** Prevents duplicate audit triggers
- **Chunked processing:** Multi-account runner processes 3 prompts at a time to stay within timeouts

### Database Optimizations
- Indexed queries on `(client_id, created_at)` for audit_results
- Indexed domain lookups for forzeo_citations
- JSONB for flexible model_results storage
- Pagination for large result sets

---

## 13. Third-Party Integrations

| Service | What It Does In Our System | Integration Point |
|---|---|---|
| **Supabase** | Hosts our database, authentication system, and serverless functions | Frontend client + all Edge Functions |
| **DataForSEO** | Provides real-time access to AI model responses (ChatGPT, Gemini, Claude, Perplexity) and Google search data | `geo-audit` Edge Function |
| **Groq** | Powers fast content generation, insights, and topic suggestions using Llama models | `groq-proxy`, `signal-scorer`, `ai-search-volume` |
| **OpenRouter** | Classifies citation domains into categories (uses free-tier models) | `categorize-citations` Edge Function |
| **Tavily** | Provides real-time web search results for brand monitoring | `tavily-search` Edge Function |
| **Jina** | Extracts readable content from web pages for citation verification | `verify-citations` Edge Function |
| **Resend** | Sends transactional emails (schedule completion, signup notifications) | `notify-schedule-execution`, `notify-admin-signup` |
| **Google OAuth** | Provides "Sign in with Google" authentication | Supabase Auth provider |

**Security note:** All API credentials are stored as environment variables in Supabase Edge Function secrets. No keys are hardcoded in the codebase.

---

## 14. Cost Structure & Tracking

### Per-Query Costs (Approximate)

| AI Model | Cost per Query | Source |
|---|---|---|
| ChatGPT (LIVE) | ~$0.05-0.10 | DataForSEO |
| Gemini (LIVE) | ~$0.05-0.10 | DataForSEO |
| Claude (LIVE) | ~$0.05-0.10 | DataForSEO |
| Perplexity (LIVE) | ~$0.05-0.10 | DataForSEO |
| Google AI Overview | ~$0.003 | DataForSEO |
| Google SERP | ~$0.002 | DataForSEO |

### Typical Usage Costs

| Scenario | Estimated Cost |
|---|---|
| Single prompt, 4 LLM models | ~$0.20-0.40 |
| Single prompt, all 6 models | ~$0.30-0.50 |
| 10 prompts, all 6 models | ~$3.00-5.00 |
| 50 prompts, all 6 models | ~$15-25 |
| 100 prompts, all 6 models | ~$30-50 |

### Cost Tracking

Costs are tracked at three levels:
1. **Per audit result:** `audit_results.total_cost` - total cost for one prompt across all models
2. **Per model:** `model_results[].api_cost` - cost for querying one specific AI model
3. **Aggregate:** `forzeo_api_usage` table - historical cost tracking by API, endpoint, and client

### Budget Controls

The multi-account runner supports budget caps:
- `max_cost_per_run` - Maximum spend per scheduled execution
- Execution stops immediately if the budget is exceeded
- Remaining prompts are skipped (not deferred)

---

## 15. Build & Deployment

### Development

```bash
# Install dependencies
npm install

# Start development server (localhost:5173)
npm run dev

# Start local Supabase (requires Docker)
npm run supabase:start

# Serve Edge Functions locally
npm run functions:serve

# Run linting
npm run lint
```

### Production Build

```bash
# Type check + Vite production build
npm run build

# Output: /dist directory
```

**Build configuration (vite.config.ts):**
- React Fast Refresh plugin for HMR
- Path alias: `@/*` → `./src/*`
- Manual chunk splitting for optimal caching:
  - `react-vendor` → React + ReactDOM
  - `supabase` → Supabase JS client
  - `ui` → Radix UI components

### TypeScript Configuration
- Target: ES2020
- JSX: react-jsx (React 18 transform)
- Strict mode: enabled
- Module resolution: bundler
- Path alias: `@/*` → `./src/*`

### Deployment
- **Frontend:** Static site deployment (Vercel, Netlify, or similar)
- **Backend:** Supabase Cloud (managed PostgreSQL + Edge Functions)
- **Edge Functions:** Deployed via `supabase functions deploy <function-name>`

---

## 16. File Reference

### Frontend - Core
| File | Purpose |
|---|---|
| `src/main.tsx` | React entry point |
| `src/App.tsx` | Root component with auth flow |
| `src/index.css` | Global styles, animations, design system |
| `src/pages/ClientDashboard.tsx` | Main dashboard page |

### Frontend - Hooks
| File | Purpose |
|---|---|
| `src/hooks/useAuth.ts` | Authentication & role-based permissions |
| `src/hooks/useClientDashboard.ts` | Central state management |

### Frontend - Components
| File | Purpose |
|---|---|
| `src/components/AuthForm.tsx` | Login/signup form |
| `src/components/AgencyOverview.tsx` | Agency multi-brand dashboard |
| `src/components/AgencyBrandsManager.tsx` | Admin brand management |
| `src/components/CampaignsList.tsx` | Campaign CRUD |
| `src/components/CitationPreview.tsx` | Citation hover tooltip |
| `src/components/CitationIntelligence.tsx` | Deep citation analysis |
| `src/components/MultiAccountScheduler.tsx` | 4-step scheduling wizard |
| `src/components/ScheduleManager.tsx` | Schedule execution monitor |
| `src/components/SignalsDashboard.tsx` | RSS signal detection |
| `src/components/SOVLineChart.tsx` | Custom SVG trend chart |
| `src/components/ModelLogos.tsx` | AI model icons |
| `src/components/UniversalImport.tsx` | CSV/JSON import |
| `src/components/UserManagement.tsx` | Admin user management |
| `src/components/VisibilityGraphs.tsx` | Graph visualizations |

### Frontend - Tabs
| File | Purpose |
|---|---|
| `src/components/tabs/OverviewTab.tsx` | Key metrics and charts |
| `src/components/tabs/PromptsTab.tsx` | Prompt management |
| `src/components/tabs/TopicsTab.tsx` | Topic/keyword discovery |
| `src/components/tabs/SourcesTab.tsx` | Citation source analysis |
| `src/components/tabs/CitationsTab.tsx` | Citation data table |
| `src/components/tabs/ContentTab.tsx` | AI content generation |
| `src/components/tabs/InsightsTab.tsx` | AI recommendations |

### Frontend - Utilities
| File | Purpose |
|---|---|
| `src/utils/brandMatching.ts` | Fuzzy brand name matching |
| `src/utils/dashboardHelpers.ts` | Domain classification + metric helpers |
| `src/utils/timezone.ts` | Timezone conversion |
| `src/lib/utils.ts` | CSS class merging (clsx + tailwind-merge) |
| `src/integrations/supabase/client.ts` | Supabase client initialization |

### Backend - Edge Functions
| Function | Purpose |
|---|---|
| `supabase/functions/geo-audit/` | Core audit engine (queries AI models) |
| `supabase/functions/categorize-citations/` | AI domain classification |
| `supabase/functions/verify-citations/` | Semantic citation verification |
| `supabase/functions/citation-analyzer/` | Deep citation analysis |
| `supabase/functions/tavily-search/` | Web search integration |
| `supabase/functions/scheduler/` | Cron job scheduler |
| `supabase/functions/multi-account-runner/` | Multi-brand audit orchestration |
| `supabase/functions/notify-schedule-execution/` | Email on schedule complete |
| `supabase/functions/notify-admin-signup/` | Email on new user signup |
| `supabase/functions/signal-scorer/` | Signal detection scoring |
| `supabase/functions/rss-ingestor/` | RSS feed ingestion |
| `supabase/functions/groq-proxy/` | Groq LLM proxy for content |
| `supabase/functions/ai-search-volume/` | Search volume estimation |
| `supabase/functions/send-report/` | Report delivery |

### Configuration
| File | Purpose |
|---|---|
| `package.json` | Dependencies and scripts |
| `tsconfig.json` | TypeScript compiler options |
| `vite.config.ts` | Build tool configuration |
| `tailwind.config.js` | Tailwind CSS theming |
| `postcss.config.js` | PostCSS plugins |

---

*This document provides a complete technical overview of the Forzeo GEO Dashboard system. All API credentials and secrets are stored as environment variables and are intentionally excluded from this documentation.*
