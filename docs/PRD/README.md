# Comprehensive Product Requirements Documentation

**Forzeo GEO Visibility Dashboard - Complete PRD Suite**

---

## 📋 Table of Contents

This folder contains the complete Product Requirements Documentation (PRD) for the Forzeo GEO Visibility Dashboard. All documents are detailed, technical specifications designed for implementation, testing, and onboarding.

### Core Documents

1. **[PRD_MASTER.md](./PRD_MASTER.md)** - Start Here
   - Executive summary
   - System architecture diagram
   - Tech stack overview
   - User roles & permissions
   - Index to all other documents

2. **[PRD_AI_PROMPTS.md](./PRD_AI_PROMPTS.md)** - AI Integration
   - All Groq prompts (Llama 3.1 & 3.3)
   - DataForSEO Live LLM queries
   - Response parsing logic
   - Prompt generation formulas
   - Competitor discovery logic

3. **[PRD_DATABASE.md](./PRD_DATABASE.md)** - Database Architecture
   - Complete 27-table schema
   - Table relationships & foreign keys
   - RLS policies (Row Level Security)
   - Indexes & triggers
   - v3.0 enhancement tables

4. **[PRD_EDGE_FUNCTIONS.md](./PRD_EDGE_FUNCTIONS.md)** - Backend APIs
   - All 7 Supabase Edge Functions
   - Request/response schemas
   - Error handling & retry logic
   - API integration details
   - Environment variables

5. **[PRD_FEATURES.md](./PRD_FEATURES.md)** - Feature Specifications
   - 40+ feature specifications
   - User stories & flows
   - UI interactions
   - Agency management (v2.4)
   - Citation Intelligence

6. **[PRD_METRICS.md](./PRD_METRICS.md)** - Formulas & Scoring
   - Share of Voice (SOV)
   - Brand rank detection
   - Citation rate
   - Competitor gap analysis
   - Influence score (Signals)
   - Validation test cases

7. **[PRD_UI_SPECS.md](./PRD_UI_SPECS.md)** - UI Components
   - Design system (colors, typography, spacing)
   - 50+ component specifications
   - Radix UI usage patterns
   - Responsive breakpoints
   - Layout structures

8. **[PRD_DATA_FLOWS.md](./PRD_DATA_FLOWS.md)** - Integration Testing
   - 6 end-to-end data flows
   - API call sequences
   - Database operation flows
   - Integration test scenarios
   - State transitions

---

## 📊 Quick Stats

- **Total Tables:** 27
- **Total Edge Functions:** 7
- **Total Features:** 40+
- **Total AI Prompts:** 10+
- **Total Formulas:** 8
- **Total Components:** 50+
- **AI Models Integrated:** 6 (ChatGPT, Claude, Gemini, Perplexity, Google AI, SERP)
- **External APIs:** 3 (DataForSEO, Groq, Tavily)

---

## 🎯 Document Usage Guide

**For Developers:**
1. Start with `PRD_MASTER.md` for system overview
2. Read `PRD_DATABASE.md` for schema setup
3. Review `PRD_EDGE_FUNCTIONS.md` for backend implementation
4. Reference `PRD_AI_PROMPTS.md` for AI integration

**For Product Managers:**
1. Review `PRD_FEATURES.md` for complete feature list
2. Check `PRD_METRICS.md` for success criteria
3. Use `PRD_DATA_FLOWS.md` for user journey understanding

**For Designers:**
1. Start with `PRD_UI_SPECS.md` for component library
2. Review `PRD_FEATURES.md` for UI flows
3. Reference design tokens in `PRD_UI_SPECS.md`

**For QA/Testing:**
1. Use `PRD_DATA_FLOWS.md` for integration test scenarios
2. Reference `PRD_METRICS.md` for validation formulas
3. Check `PRD_FEATURES.md` for acceptance criteria

---

## 🔄 Version History

- **v2.4** (Jan 2026) - Agency Management, Location-Specific Prompts
- **v2.3** (Jan 2026) - Master Schema, Role-Based UI
- **v2.2** (Jan 2026) - Deep Analysis Reliability, Complete Production Schema
- **v2.1** (Jan 2026) - RBAC, Prompt Limits (30), UI Refinements

---

## 📦 Repository Structure

```
docs/
├── PRD/                          (This folder)
│   ├── README.md                 (You are here)
│   ├── PRD_MASTER.md
│   ├── PRD_AI_PROMPTS.md
│   ├── PRD_DATABASE.md
│   ├── PRD_EDGE_FUNCTIONS.md
│   ├── PRD_FEATURES.md
│   ├── PRD_METRICS.md
│   ├── PRD_UI_SPECS.md
│   └── PRD_DATA_FLOWS.md
├── trace_report.md               (Groq logic trace)
├── README.md                     (Main project README)
├── ARCHITECTURE.md               (Technical architecture)
├── DATABASE_ARCHITECTURE.md      (Database details)
└── FEATURE_GUIDE.md              (Feature explanations)
```

---

## 🚀 Getting Started

If you're new to this project:

1. **Read:** `PRD_MASTER.md` (5 min)
2. **Skim:** `PRD_FEATURES.md` (10 min)
3. **Review:** `PRD_DATABASE.md` (15 min)
4. **Deep Dive:** Other docs as needed for your role

---

**Maintained by:** Product & Engineering Team  
**Last Updated:** January 2026  
**Status:** Living Documentation
