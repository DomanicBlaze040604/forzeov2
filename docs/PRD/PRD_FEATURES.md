# Feature Specifications - Complete

Version coverage: v2.4 → v2.1

---

## F1. Live LLM Auditing

**Priority:** P0 (Critical)  
**User Story:** As a brand manager, I want to track how my brand appears in AI-generated responses so I can optimize my AI visibility strategy.

### Sub-Features

#### F1.1 Multi-Model Querying
- **Models:** ChatGPT, Claude, Gemini, Perplexity, Google AI Overview, Google SERP
- **Method:** Real-time via DataForSEO Live LLM API
- **Anti-Caching:** Random nonce appended to prompts
- **Retry Logic:** 3 attempts with exponential backoff

#### F1.2 Brand Detection
- **Primary:** Brand name matching (case-insensitive)
- **Secondary:** Brand tags matching (alternative names, URLs)
- **Counting:** All occurrences across response
- **Rank Detection:** Numbered list pattern matching (1., 1), [1])

#### F1.3 Competitor Analysis
- **Detection:** Match competitor names in responses
- **Counting:** Total mentions per competitor
- **Ranking:** Extract rank if in numbered list
- **Gap Analysis:** Calculate brand vs competitor share

#### F1.4 Citation Extraction
- **URL Detection:** Regex pattern for http(s):// URLs
- **Domain Parsing:** Extract hostname from URL
- **Deduplication:** Unique URLs per audit
- **Storage:** `citations` table with model attribution

### UI Flow
1. User selects prompt → Clicks "Run"
2. Loading indicator shows "Querying {model}..."
3. Results display in table with SOV%, Rank, Citations
4. Click row → Opens detailed modal with full responses

---

## F2. Citation Intelligence

**Priority:** P0 (Critical)  
**User Story:** As a marketer, I want deep analysis of citation sources so I can identify actionable opportunities.

### Sub-Features

#### F2.1 URL Verification
- **Method:** HTTP HEAD request to check reachability
- **Timeout:** 5 seconds
- **Recording:** `http_status`, `is_reachable`, `last_verified_at`

#### F2.2 Hallucination Detection
- **Unreachable:** Status 404/403/500
- **Misattributed:** Content doesn't match AI claim
- **Contradictory:** Source contradicts AI statement
- **Storage:** `is_hallucinated`, `hallucination_type`, `hallucination_reason`

#### F2.3 Category Classification
**Logic:**
```
UGC: reddit.com, quora.com, linkedin.com → Easy
Press: forbes.com, techcrunch.com → Medium
Wikipedia: wikipedia.org → Difficult
App Store: play.google.com, apps.apple.com → Medium
Competitor: URL in competitors list → Easy
Brand Owned: URL matches brand_domain → Easy
Other: Default → Medium
```

#### F2.4 Groq Deep Analysis
- **Content Extraction:** Full page text (via Tavily or fetch)
- **AI Analysis:** Groq analyzes brand opportunity
- **JSON Output:** Structured insights
- **Storage:** `ai_analysis` JSONB field

#### F2.5 Recommendation Generation
**Types:**
- `engage_ugc` → Reply to Reddit/Quora
- `create_comparison` → Build comparison page
- `publish_pr` → Press release draft
- `improve_reviews` → App store optimization
- `wikipedia_advisory` → Wikipedia strategy

**Content Generation:**
- Groq generates ready-to-post content
- Stored in `generated_content` field
- User can regenerate up to 3 times

### UI Flow
1. Run audit → Navigate to "Intelligence" tab
2. Click "Analyze Citations" button
3. Progress bar shows "Analyzing 12/45 citations..."
4. Table displays: Status, URL, Category, Opportunity
5. Click row → View recommendations + generated content
6. Click "Regenerate" → New content from Groq

---

## F3. Campaign Management

**Priority:** P1 (High)  
**User Story:** As an agency, I want to batch-audit 100+ prompts and view aggregated results.

### Sub-Features

#### F3.1 Campaign Creation
- **Input:** Campaign name + prompt selection
- **Limits:** No max prompts
- **Storage:** Creates `campaigns` record with `status='running'`

#### F3.2 Sequential Execution
- **Loop:** Iterate through selected prompts
- **Delay:** 500ms between queries (rate limit protection)
- **Progress:** Real-time UI updates
- **Interruption:** User can cancel mid-campaign

#### F3.3 Aggregated Metrics (Auto-Calculated via Trigger)
```sql
CREATE FUNCTION update_campaign_stats_from_audit()
RETURNS TRIGGER AS $$
BEGIN
  UPDATE campaigns SET
    avg_sov = (SELECT AVG(share_of_voice) FROM audit_results WHERE campaign_id = NEW.campaign_id),
    avg_rank = (SELECT AVG(average_rank) FROM audit_results WHERE campaign_id = NEW.campaign_id),
    total_citations = (SELECT SUM(total_citations) FROM audit_results WHERE campaign_id = NEW.campaign_id),
    completed_prompts = completed_prompts + 1
  WHERE id = NEW.campaign_id;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;
```

#### F3.4 Campaign Detail View
- **Metrics:** Overall SOV, Avg Rank, Total Cost
- **Citations:** All unique citations across prompts
- **Competitors:** Leaderboard with mention counts
- **Export:** Full campaign report (TXT)

### UI Flow
1. Navigate to "Campaigns" tab
2. Click "Create Campaign"
3. Enter name + select prompts
4. Click "Run Campaign"
5. Progress modal shows completion
6. Navigate to campaign detail view

---

## F4. Fresh Signals Detection

**Priority:** P2 (Medium)  
**User Story:** As a strategist, I want to detect fresh content before AI models index it.

### Sub-Features

#### F4.1 RSS Feed Management
- **Input:** Feed URL + keywords (brand + competitor)
- **Types:** Google Alerts, NewsAPI, Bing News, Custom
- **Polling:** Scheduled via `rss-ingestor` Edge Function
- **Frequency:** Configurable (default 6 hours)

#### F4.2 Signal Ingestion
- **Parsing:** Extract title, URL, published_at, content
- **Deduplication:** SHA-256 hash of URL
- **Mention Detection:** Keyword matching in title + content
- **Scoring:** Calculate freshness, authority, relevance, influence

#### F4.3 Tavily Correlation
- **Method:** Run Tavily search for signal topic
- **Check:** Does signal URL appear in Tavily results?
- **Classification:**
  - `emerging` → Not in Tavily, high influence
  - `reinforcing` → In Tavily, high influence
  - `low_impact` → Low influence score
- **Propagation Tracking:** Days between publish → AI citation

#### F4.4 Insights Dashboard
- **Filters:** By influence score, classification, date range
- **Sorting:** By score, published date
- **Actions:** Click → View full content + correlation data

---

## F5. Agency Management (v2.4)

**Priority:** P0 (Critical)  
**User Story:** As an agency admin, I want to manage multiple client brands with quota enforcement.

### Sub-Features

#### F5.1 Role-Based Access Control
**Roles:**
- `admin` → Unlimited brands, prompts, can delete all
- `agency` → Max 5 brands, 15 prompts/brand, cannot delete brands
- `user` → Unlimited brands, 30 prompts/brand, can delete own only

**Enforcement:** Frontend + RLS policies

#### F5.2 Agency Dashboard (AgencyOverview Component)
**Metrics:**
- Total Brands (count)
- Total Prompts (across all brands)
- Average Visibility (global SOV)

**Alerts:**
- "Brands Needing Attention" → SOV < 30%
- Visual indicators with brand name + visibility %

**Quick Actions:**
- "View All Brands" button
- Click brand → Switch to that brand's dashboard

#### F5.3 Quota Display
**Sidebar:**
- "X/5 Brands" badge (if agency role)
- "X/15 Prompts" badge (per brand, if agency)
- Visual warning when approaching limit

**Enforcement:**
- "Add Brand" button disabled at limit
- "Add Prompt" shows error message at limit

#### F5.4 Location-Specific Prompts (v2.4)
- **Globe Icon:** Next to each prompt in table
- **Click:** Opens location selector dialog
- **Options:** Country + City (e.g., "India: Mumbai")
- **Storage:** `prompts.location_code`, `prompts.location_name`
- **Audit:** Uses prompt-specific location (overrides brand default)

---

## F6. Prompt Management

**Priority:** P0 (Critical)

### Sub-Features

#### F6.1 Manual Entry
- **Input:** Single prompt text field
- **Validation:** Min 3 characters, max 500
- **Auto-Save:** Saved to `prompts` table immediately

#### F6.2 Bulk Import
- **Input:** Textarea (one prompt per line)
- **Limit Check:** Enforced before insert
- **Deduplication:** Skip if `(client_id, prompt_text)` exists

#### F6.3 AI Generation (Groq)
- **Trigger:** "Generate" button in Bulk Prompts Dialog
- **Inputs:** Keywords, Sentiment (Neutral/Positive/Negative), Focus (General/Feature/Competitor)
- **Output:** 10 prompts from Groq
- **User Review:** User can edit before saving

#### F6.4 Archive & Restore
- **Soft Delete:** Set `is_active = false`
- **UI:** Move to "Inactive" tab
- **Restore:** Click → Set `is_active = true`
- **Data Retention:** Audit results preserved

---

## F7. Analytics & Insights

### F7.1 Overview Tab
**Cards:**
- Share of Voice (%) with trend indicator
- Average Rank (#) with color coding
- Total Citations with growth %
- Total Cost ($) with breakdown

**Charts:**
- Visibility by Model (bar chart)
- Competitor Gap (horizontal bars)
- Top Sources (list with counts)

**AI Insights Panel:**
- Groq-generated recommendations
- Priority badge (High/Medium/Low)
- 5 specific action items
- Refresh button to regenerate

### F7.2 Export Capabilities
**Formats:**
- CSV → Prompt, Category, SOV, Rank, Citations
- TXT → Full report with all data + Tavily + AI insights
- JSON → Raw audit data (for integrations)

**Report Contents (TXT):**
- Header with brand info
- Summary metrics
- Visibility by model table
- Competitor analysis
- Top sources list
- Tavily results (if enabled)
- AI-powered insights (per-prompt + overall)

---

## F8. User Interface Features

### F8.1 Dark Theme
- Glass morphism effects
- Consistent color palette
- Radix UI components

### F8.2 Responsive Design
- Mobile-friendly sidebar (collapsible)
- Tablet-optimized tables
- Desktop full-width dashboard

### F8.3 Interactive Elements
- Hover states on all clickable items
- Loading skeletons for async operations
- Toast notifications for success/error
- Confirmation dialogs for destructive actions

### F8.4 Advanced Table Features (Citation Intelligence)
- **Filtering:** 4-tier (Category, Status, Model, Search)
- **Sorting:** Click column headers
- **Pagination:** 10/25/50/100 per page
- **Column Toggles:** Show/hide columns
- **Bulk Actions:** Multi-select with checkboxes
- **Filter Presets:** Save/load filter combinations

---

**Total Feature Count:** 40+ distinct features across 8 major areas
