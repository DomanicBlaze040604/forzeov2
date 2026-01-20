# Data Flows - Complete Specification

End-to-end data flow diagrams for integration testing.

---

## Flow 1: Live LLM Audit (Core Workflow)

```
┌─────────────────────────────────────────────────────────────────┐
│ FRONTEND: ClientDashboard                                       │
│ User clicks "Run" on prompt                                     │
└───────────────────────┬─────────────────────────────────────────┘
                        │
                        │ POST /functions/v1/geo-audit
                        │ {client_id, prompt_id, prompt_text, brand_name, models}
                        ▼
┌─────────────────────────────────────────────────────────────────┐
│ EDGE FUNCTION: geo-audit                                        │
│ 1. Validate request                                             │
│ 2. For each model in models[]:                                  │
│    ├─ ChatGPT → POST DataForSEO Live LLM (gpt-4o)              │
│    ├─ Claude → POST DataForSEO Live LLM (claude-sonnet-4)      │
│    ├─ Gemini → POST DataForSEO Live LLM (gemini-2.0)           │
│    └─ Perplexity → POST DataForSEO Live LLM (sonar)            │
│ 3. Parse each response:                                         │
│    ├─ Detect brand mentions                                     │
│    ├─ Find brand rank in lists                                  │
│    ├─ Extract citation URLs                                     │
│    └─ Detect competitor mentions                                │
│ 4. Calculate metrics:                                           │
│    ├─ Share of Voice (SOV)                                      │
│    ├─ Average Rank                                              │
│    └─ Total Citations                                           │
└───────────────────────┬─────────────────────────────────────────┘
                        │
                        │ INSERT INTO audit_results + citations
                        ▼
┌─────────────────────────────────────────────────────────────────┐
│ DATABASE: Supabase PostgreSQL                                   │
│ audit_results: {id, client_id, prompt_id, share_of_voice...}   │
│ citations: [{url, domain, model}]                               │
└───────────────────────┬─────────────────────────────────────────┘
                        │
                        │ Return {success, data}
                        ▼
┌─────────────────────────────────────────────────────────────────┐
│ FRONTEND: Update UI                                             │
│ - setAuditResults([...results, newResult])                      │
│ - setSummary({overall_sov, avg_rank, ...})                      │
│ - Display results in table                                      │
└─────────────────────────────────────────────────────────────────┘
```

**Key States:**
- Loading: `loadingPromptId` set to prompt being audited
- Error: `error` message displayed in toast
- Success: Results added to `auditResults` array

---

## Flow 2: Citation Intelligence (Deep Analysis)

```
┌─────────────────────────────────────────────────────────────────┐
│ FRONTEND: Navigate to Intelligence Tab                          │
│ User clicks "Analyze Citations" button                          │
└───────────────────────┬─────────────────────────────────────────┘
                        │
                        │ POST /functions/v1/citation-analyzer
                        │ {audit_result_id, client_id, brand_name, competitors}
                        ▼
┌─────────────────────────────────────────────────────────────────┐
│ EDGE FUNCTION: citation-analyzer                                │
│ 1. Fetch citations from audit_result_id                         │
│ 2. For each citation (batch 20):                                │
│    ├─ HTTP HEAD request (verify reachability)                   │
│    ├─ Classify category (UGC, Press, Wikipedia, etc.)           │
│    ├─ Determine opportunity level (Easy/Medium/Difficult)       │
│    ├─ Extract content via Tavily (if not hallucinated)          │
│    └─ Analyze with Groq:                                        │
│        └─ POST Groq API /chat/completions                       │
│           - System: Citation analysis expert prompt             │
│           - User: {brand, URL, category, content}               │
│           - Response: {insights, recommendations} JSON          │
│ 3. Generate Recommendations:                                    │
│    ├─ engage_ugc → Quora/Reddit reply (Groq generated)         │
│    ├─ create_comparison → Comparison page (Groq generated)     │
│    ├─ publish_pr → Press release (Groq generated)              │
│    └─ improve_reviews → App store strategy                      │
│ 4. Upsert citation_intelligence + citation_recommendations      │
└───────────────────────┬─────────────────────────────────────────┘
                        │
                        │ INSERT/UPDATE citation_intelligence, 
                        │ INSERT citation_recommendations
                        ▼
┌─────────────────────────────────────────────────────────────────┐
│ DATABASE: Multiple Tables                                       │
│ citation_intelligence: {url, category, opportunity, ai_analysis}│
│ citation_recommendations: {type, generated_content, actions}    │
└───────────────────────┬─────────────────────────────────────────┘
                        │
                        │ Return {processed_count, insights}
                        ▼
┌─────────────────────────────────────────────────────────────────┐
│ FRONTEND: Display Results                                       │
│ - Table with filters (Category, Status, Opportunity)            │
│ - Click row → View recommendations + generated content          │
│ - "Regenerate" → Re-call Groq for new content                   │
└─────────────────────────────────────────────────────────────────┘
```

**Batch Processing:**
- 20 citations per batch (avoid timeout)
- 1000ms delay between batches
- Progress updates via UI polling

---

## Flow 3: Campaign Execution

```
┌─────────────────────────────────────────────────────────────────┐
│ FRONTEND: Create Campaign Dialog                                │
│ User selects prompts, enters campaign name                      │
└───────────────────────┬─────────────────────────────────────────┘
                        │
                        │ 1. INSERT INTO campaigns
                        │ 2. runCampaign(campaignId, promptIds)
                        ▼
┌─────────────────────────────────────────────────────────────────┐
│ FRONTEND HOOK: useClientDashboard.runCampaign()                 │
│ For each promptId in promptIds:                                 │
│   ├─ setLoadingPromptId(promptId)                               │
│   ├─ POST /functions/v1/geo-audit {campaign_id}                 │
│   ├─ Wait 500ms (rate limit)                                    │
│   └─ Increment completed_prompts                                │
└───────────────────────┬─────────────────────────────────────────┘
                        │
                        │ Multiple POST requests (sequential)
                        ▼
┌─────────────────────────────────────────────────────────────────┐
│ EDGE FUNCTION: geo-audit (per prompt)                           │
│ - Same logic as Flow 1                                          │
│ - Additional: campaign_id in audit_results                       │
└───────────────────────┬─────────────────────────────────────────┘
                        │
                        │ TRIGGER: update_campaign_stats_from_audit()
                        ▼
┌─────────────────────────────────────────────────────────────────┐
│ DATABASE TRIGGER: Auto-Calculate Campaign Stats                 │
│ UPDATE campaigns SET                                             │
│   avg_sov = AVG(audit_results.share_of_voice),                  │
│   avg_rank = AVG(audit_results.average_rank),                   │
│   total_citations = SUM(audit_results.total_citations),         │
│   completed_prompts = completed_prompts + 1                     │
│ WHERE campaign_id = NEW.campaign_id                             │
└───────────────────────┬─────────────────────────────────────────┘
                        │
                        │ Campaign stats updated in real-time
                        ▼
┌─────────────────────────────────────────────────────────────────┐
│ FRONTEND: Campaign Detail View                                  │
│ - Display aggregated metrics                                    │
│ - List all prompts with individual results                      │
│ - Export full campaign report                                   │
└─────────────────────────────────────────────────────────────────┘
```

---

## Flow 4: Fresh Signals Detection

```
┌─────────────────────────────────────────────────────────────────┐
│ SCHEDULER: Supabase Cron (Every 6 hours)                        │
└───────────────────────┬─────────────────────────────────────────┘
                        │
                        │ POST /functions/v1/rss-ingestor
                        ▼
┌─────────────────────────────────────────────────────────────────┐
│ EDGE FUNCTION: rss-ingestor                                     │
│ 1. SELECT * FROM rss_feeds WHERE is_active = true               │
│ 2. For each feed:                                               │
│    ├─ Fetch RSS XML from rss_url                                │
│    ├─ Parse feed items (title, URL, published_at, content)      │
│    ├─ For each item:                                            │
│    │  ├─ Generate url_hash = SHA256(url)                        │
│    │  ├─ Check if EXISTS (url_hash) → Skip if duplicate         │
│    │  ├─ Detect brand mentions (keyword matching)               │
│    │  ├─ Detect competitor mentions                             │
│    │  ├─ Calculate scores:                                      │
│    │  │  ├─ freshness = 1 - (days_ago / 30)                     │
│    │  │  ├─ authority = lookup(domain_authority)                │
│    │  │  ├─ relevance = min(1, keyword_matches / 10)            │
│    │  │  └─ influence = (auth*0.4) + (fresh*0.3) + (rel*0.3)   │
│    │  └─ INSERT INTO fresh_signals                              │
│    └─ UPDATE rss_feeds SET last_polled_at = NOW()               │
└───────────────────────┬─────────────────────────────────────────┘
                        │
                        │ Signals stored
                        ▼
┌─────────────────────────────────────────────────────────────────┐
│ EDGE FUNCTION: signal-scorer (Triggered hourly)                 │
│ 1. SELECT * FROM fresh_signals WHERE processing_status='pending'│
│ 2. For each signal:                                             │
│    ├─ POST Tavily API /search {query: signal.title}            │
│    ├─ Check if signal.url in Tavily results                     │
│    ├─ Classify:                                                 │
│    │  ├─ emerging → Not in Tavily, high influence               │
│    │  ├─ reinforcing → In Tavily, high influence                │
│    │  └─ low_impact → Low influence                             │
│    ├─ INSERT INTO signal_correlations                           │
│    └─ UPDATE fresh_signals SET processing_status='processed'    │
└───────────────────────┬─────────────────────────────────────────┘
                        │
                        │ Correlated signals
                        ▼
┌─────────────────────────────────────────────────────────────────┐
│ FRONTEND: Signals Tab                                           │
│ - Display signals sorted by influence_score                     │
│ - Filter by classification (emerging/reinforcing/low_impact)    │
│ - Click → View correlation data + Tavily results                │
└─────────────────────────────────────────────────────────────────┘
```

---

## Flow 5: Prompt Generation (Groq AI)

```
┌─────────────────────────────────────────────────────────────────┐
│ FRONTEND: Bulk Prompts Dialog                                   │
│ User enters keywords, selects sentiment, focus                  │
│ Clicks "Generate"                                                │
└───────────────────────┬─────────────────────────────────────────┘
                        │
                        │ Call generatePromptsFromKeywords()
                        ▼
┌─────────────────────────────────────────────────────────────────┐
│ FRONTEND HOOK: useClientDashboard                               │
│ 1. Try: POST /functions/v1/generate-content                     │
│    - {prompt: userPrompt, type: "prompts"}                      │
│ 2. Fallback: Direct Groq API call                               │
│    - POST https://api.groq.com/openai/v1/chat/completions       │
│    - Model: llama-3.1-8b-instant                                │
│    - System: "You are a search prompt generator..."             │
│    - User: "Generate 10 prompts for {keywords}..."              │
└───────────────────────┬─────────────────────────────────────────┘
                        │
                        │ POST Groq API
                        ▼
┌─────────────────────────────────────────────────────────────────┐
│ GROQ API: Llama 3.1 8B Instant                                  │
│ - Generates 10 search queries                                   │
│ - Returns text (one per line)                                   │
└───────────────────────┬─────────────────────────────────────────┘
                        │
                        │ Return ["prompt1", "prompt2", ...]
                        ▼
┌─────────────────────────────────────────────────────────────────┐
│ FRONTEND: Display Generated Prompts                             │
│ - User can edit prompts before saving                           │
│ - Click "Save" → addMultiplePrompts(prompts)                    │
│ - INSERT INTO prompts (batch)                                   │
└─────────────────────────────────────────────────────────────────┘
```

---

## Flow 6: Auto-Find Competitors

```
┌─────────────────────────────────────────────────────────────────┐
│ FRONTEND: Add/Edit Brand Dialog                                 │
│ User clicks "Auto-Find" button                                  │
└───────────────────────┬─────────────────────────────────────────┘
                        │
                        │ Call fetchCompetitors(brand, industry, region)
                        ▼
┌─────────────────────────────────────────────────────────────────┐
│ FRONTEND HOOK: useClientDashboard.fetchCompetitors()            │
│ POST https://api.groq.com/openai/v1/chat/completions            │
│ {                                                                │
│   model: "llama-3.3-70b-versatile",                             │
│   messages: [                                                    │
│     {role: "system", content: "Market research expert..."},     │
│     {role: "user", content: "Find 5 competitors for {brand}"}   │
│   ],                                                             │
│   response_format: {type: "json_object"}                        │
│ }                                                                │
└───────────────────────┬─────────────────────────────────────────┘
                        │
                        │ Groq returns JSON
                        ▼
┌─────────────────────────────────────────────────────────────────┐
│ GROQ API Response                                                │
│ {"competitors": ["Competitor1", "Competitor2", ...]}            │
└───────────────────────┬─────────────────────────────────────────┘
                        │
                        │ Parse JSON
                        ▼
┌─────────────────────────────────────────────────────────────────┐
│ FRONTEND: Auto-Fill Competitors Field                           │
│ - Merge with existing competitors                               │
│ - Update newClientForm state                                    │
│ - User can edit before saving                                   │
└─────────────────────────────────────────────────────────────────┘
```

---

## Integration Test Scenarios

### Test 1: Complete Audit Flow
1. **Setup:** Create client + prompt
2. **Action:** Click "Run" button
3. **Verify:**
   - Loading indicator appears
   - API call to geo-audit Edge Function
   - DataForSEO queries 4+ models
   - audit_results record created
   - citations records created
   - UI updates with SOV%, rank, citations count

### Test 2: Citation Intelligence
1. **Setup:** Run audit with 10+ citations
2. **Action:** Click "Analyze Citations"
3. **Verify:**
   - citation-analyzer Edge Function called
   - Tavily extracts content
   - Groq analyzes each citation
   - citation_intelligence records created
   - citation_recommendations created
   - Generated content displayed in UI

### Test 3: Campaign Execution
1. **Setup:** Create 20 prompts
2. **Action:** Create campaign with all 20
3. **Verify:**
   - campaigns record created (status='running')
   - 20 sequential geo-audit calls
   - Trigger auto-updates avg_sov, avg_rank
   - Campaign detail view shows aggregated data
   - Export generates full report

### Test 4: Fresh Signals Pipeline
1. **Setup:** Create RSS feed (Google Alert)
2. **Action:** Trigger rss-ingestor
3. **Verify:**
   - RSS XML parsed
   - fresh_signals records created
   - Scores calculated correctly
   - signal-scorer correlates with Tavily
   - signal_correlations created
   - UI displays classified signals

---

**Total Data Flows:** 6 major flows  
**Edge Functions Involved:** 7  
**Database Tables Involved:** 27  
**External APIs:** 3 (DataForSEO, Groq, Tavily)
