# Forzeo GEO Visibility Dashboard - Complete Product Requirements Document

**Version:** 2.4  
**Date:** January 2026  
**Status:** Production Ready

---

## Executive Summary

The Forzeo GEO Visibility Dashboard is a comprehensive AI visibility analytics platform that tracks how brands appear in AI-generated responses across major Large Language Models (ChatGPT, Claude, Gemini, Perplexity, Google AI Overview).

**Core Value Proposition:**
- Track brand visibility across 6+ AI models in real-time
- Analyze citation sources and competitive positioning
- Generate AI-powered recommendations for visibility improvement
- Support multi-client agency management with role-based access control

**Target Users:**
- **Agencies:** Managing 5+ brands with 15 prompts per brand limit
- **Admins:** Full platform control with unlimited access
- **Standard Users:** Single brand management

---

## Product Overview

### What Problem Does This Solve?

As AI assistants become primary information sources, brands need to track their visibility in AI-generated responses. Traditional SEO metrics don't capture AI visibility, creating a blind spot in digital marketing strategies.

### Key Features

1. **Live LLM Auditing** - Real-time queries to ChatGPT, Claude, Gemini, Perplexity
2. **Citation Intelligence** - Deep analysis of sources AI models cite
3. **Competitor Analysis** - Track competitive mentions and positioning
4. **Campaign Management** - Batch audit hundreds of prompts
5. **Fresh Signals Detection** - RSS-based early warning system
6. **AI-Powered Insights** - Groq-generated recommendations
7. **Agency Management** - Multi-tenant with quota enforcement
8. **Role-Based Access Control** - Admin/Agency/User roles

---

## Documentation Structure

This PRD is organized into modular documents:

1. **[PRD_FEATURES.md](./PRD_FEATURES.md)** - Complete feature specifications
2. **[PRD_DATABASE.md](./PRD_DATABASE.md)** - Database architecture (27 tables)
3. **[PRD_EDGE_FUNCTIONS.md](./PRD_EDGE_FUNCTIONS.md)** - All 7 Edge Functions
4. **[PRD_AI_PROMPTS.md](./PRD_AI_PROMPTS.md)** - Every AI prompt and logic
5. **[PRD_METRICS.md](./PRD_METRICS.md)** - Formulas and scoring algorithms
6. **[PRD_UI_SPECS.md](./PRD_UI_SPECS.md)** - Complete UI component specifications
7. **[PRD_DATA_FLOWS.md](./PRD_DATA_FLOWS.md)** - End-to-end data flow diagrams

---

## Core Metrics

| Metric | Formula | Interpretation |
|--------|---------|----------------|
| **Share of Voice (SOV)** | `(models_mentioning_brand / total_models) × 100` | % of AI models citing your brand |
| **Average Rank** | `sum(brand_ranks) / count(ranks)` | Position in AI-generated lists |
| **Citation Rate** | `(responses_citing_brand_domain / total_responses) × 100` | % citing your website |
| **Competitor Gap** | `(competitor_mentions - brand_mentions) / total_mentions` | Competitive disadvantage |

---

## Tech Stack

| Layer | Technology | Purpose |
|-------|------------|---------|
| **Frontend** | React 18 + TypeScript + Vite | SPA with type safety |
| **UI Framework** | Tailwind CSS + Radix UI | Component library |
| **Backend** | Supabase Edge Functions (Deno) | Serverless API |
| **Database** | PostgreSQL 14+ (Supabase) | Relational data with JSONB |
| **Authentication** | Supabase Auth | User management + RLS |
| **AI - Content** | Groq (Llama 3.1/3.3) | Prompt generation, recommendations |
| **AI - Auditing** | DataForSEO Live LLM API | Real-time ChatGPT/Claude/Gemini queries |
| **Web Search** | Tavily API | Deep citation analysis |
| **Hosting** | Netlify | Static site deployment |

---

## System Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                      FRONTEND (React SPA)                        │
│  ┌────────────────┐  ┌────────────────┐  ┌──────────────────┐  │
│  │ ClientDashboard│  │ AgencyOverview │  │ CitationIntel    │  │
│  │ - Prompts Tab  │  │ - Multi-brand  │  │ - Deep Analysis  │  │
│  │ - Analytics    │  │ - Quotas       │  │ - Opportunities  │  │
│  │ - Campaigns    │  │ - Alerts       │  │ - Recommendations│  │
│  └────────────────┘  └────────────────┘  └──────────────────┘  │
└─────────────────────────────────────────────────────────────────┘
                               │ HTTPS
                               ▼
┌─────────────────────────────────────────────────────────────────┐
│                    SUPABASE BACKEND                             │
│  ┌─────────────────┐  ┌──────────────────────────────────────┐ │
│  │   PostgreSQL    │  │       Edge Functions (Deno)          │ │
│  │   27 Tables     │  │  1. geo-audit (Live LLM queries)     │ │
│  │   RLS Policies  │  │  2. generate-content (Groq)          │ │
│  │   Triggers      │  │  3. citation-analyzer (Deep Insights)│ │
│  │   Functions     │  │  4. tavily-search (Web Discovery)    │ │
│  │   Views         │  │  5. rss-ingestor (Signals)           │ │
│  └─────────────────┘  │  6. signal-scorer (Influence)        │ │
│                       │  7. scheduler (Automation)           │ │
│                       └──────────────────────────────────────┘ │
└─────────────────────────────────────────────────────────────────┘
                               │ API Calls
                               ▼
┌─────────────────────────────────────────────────────────────────┐
│                        EXTERNAL APIs                            │
│  ┌───────────────┐  ┌──────────────┐  ┌────────────────────┐  │
│  │ DataForSEO    │  │ Groq AI      │  │ Tavily Search      │  │
│  │ - ChatGPT     │  │ - Llama 3.1  │  │ - Web crawling     │  │
│  │ - Claude      │  │ - Llama 3.3  │  │ - Content extract  │  │
│  │ - Gemini      │  │ - Prompts    │  │ - Source analysis  │  │
│  │ - Perplexity  │  │ - Content    │  │                    │  │
│  └───────────────┘  └──────────────┘  └────────────────────┘  │
└─────────────────────────────────────────────────────────────────┘
```

---

## User Roles & Permissions

| Role | Brands | Prompts/Brand | Delete Brands | View All Users | Create Campaigns |
|------|--------|---------------|---------------|----------------|------------------|
| **Admin** | Unlimited | Unlimited | ✅ All brands | ✅ | ✅ |
| **Agency** | Max 5 | Max 15 | ❌ | Own org only | ✅ |
| **Standard User** | Unlimited | Max 30 | ✅ Own only | ❌ | ✅ |

---

## Next Steps

**For Implementation:**
1. Review [PRD_FEATURES.md](./PRD_FEATURES.md) for complete feature specifications
2. Review [PRD_DATABASE.md](./PRD_DATABASE.md) for schema setup
3. Review [PRD_EDGE_FUNCTIONS.md](./PRD_EDGE_FUNCTIONS.md) for backend logic
4. Review [PRD_AI_PROMPTS.md](./PRD_AI_PROMPTS.md) for AI integration

**For Testing:**
1. Review [PRD_METRICS.md](./PRD_METRICS.md) for validation formulas
2. Review [PRD_DATA_FLOWS.md](./PRD_DATA_FLOWS.md) for integration testing

**For UI Development:**
1. Review [PRD_UI_SPECS.md](./PRD_UI_SPECS.md) for component requirements

---

**Document Maintenance:**
- Last Updated: January 2026
- Owner: Product Team
- Status: Living Document (update as features evolve)
