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

## 3. Campaigns (Massive Scale Audits)

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

## 4. Signal Detection (Fresh Web Influence)

*   **Purpose**: Identify *new* content on the web that hasn't yet been indexed by AI but likely will be.
*   **Mechanism**: Periodically scans high-authority domains and industry-specific feeds.
*   **Actionability**: Alerts users to "Pre-Trend" topics so they can create content *before* the AI models ingest the information, effectively "injecting" their brand into future training data.
