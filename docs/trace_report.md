# Groq Logic & Feature Trace Report

## 1. Auto-Generating Prompts
**Goal:** Generate relevant, diverse search queries for brand analysis.

### Logic Flow
1.  **UI Trigger:** `ClientDashboard.tsx` -> `useClientDashboard.ts` calls `generatePromptsFromKeywords`.
2.  **API Call:** Attempts `supabase.functions.invoke("generate-content")`.
3.  **Model:** `llama-3.1-8b-instant` (via Groq).
4.  **System Prompt (The Core Logic):**
    ```text
    You are a search prompt generator for AI visibility analysis.
    Generate realistic, diverse search queries that users would ask AI assistants (ChatGPT, Google, Perplexity, etc.).

    Include a mix of:
    - Broad queries: "Best [product/service] in [region]"
    - Niche queries: "[product] for [specific audience] in [region]"
    - Super-niche queries: "[product] for [very specific use case] in [specific location]"
    - Comparison queries: "[brand] vs [competitor]"
    - Problem-solving queries: "How to [solve problem] with [product]"
    - Feature queries: "[product] with [specific feature]"

    Output only the prompts, one per line, no numbering or bullets.
    Generate 8-12 diverse prompts.
    ```
5.  **User Prompt Construction:**
    The user's input `keywords` is wrapped with context:
    `Generate 10 search prompts based on these keywords: "{keywords}"... Context: Brand: {brand}, Industry: {industry}...`
    *   **Focus Modifiers:** If "Competitor" focus is selected, it adds: `FOCUS: Generate prompts that directly compare {brand} against its competitors...`
    *   **Sentiment Modifiers:** If "Negative" is selected, it adds: `SENTIMENT SCENARIO: Generate "crisis" or "problem" searching prompts...`

---

## 2. Auto-Finding Competitors
**Goal:** Discover top 5 direct competitors when adding/editing a brand.

### Logic Flow
1.  **UI Trigger:** `ClientDashboard.tsx` "Auto-Find" button -> `useClientDashboard.ts` calls `fetchCompetitors`.
2.  **API Call:** **Direct Client-Side Fetch** to `https://api.groq.com/openai/v1/chat/completions`.
    *   *Note:* This does NOT use the backend Edge Function.
3.  **Model:** `llama-3.3-70b-versatile` (Uses a larger, smarter model for better accuracy).
4.  **System Prompt:**
    ```text
    You are a market research expert. user will provide a brand, industry, and region. You must return a JSON array of top 5 direct competitor names. OUTPUT ONLY JSON. No text.
    ```
5.  **User Prompt:**
    ```text
    Identify top 5 direct competitors for "{brandName}" in the "{industry}" industry in "{region}". Return JSON array only.
    ```
6.  **Response Handling:**
    *   Expects a JSON object.
    *   Parses the output and looks for an array (handling keys like `competitors`, `companies`, or a direct array).
    *   Returns the top 5 names as a string array.

---

## Technical Summary
| Feature | Implementation Method | AI Model | Key File |
| :--- | :--- | :--- | :--- |
| **Generate Prompts** | **Edge Function** (primary) | `llama-3.1-8b-instant` | `backend/generate-content/index.ts` |
| **Find Competitors** | **Client-Side Fetch** | `llama-3.3-70b-versatile` | `src/hooks/useClientDashboard.ts` |
