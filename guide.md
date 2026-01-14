# Forzeo Platform - Complete User Guide

**Welcome to Forzeo!** This guide will walk you through every feature of the platform, from adding your first brand to mastering advanced analytics.

---

## 📋 Table of Contents

1. [Getting Started](#getting-started)
2. [Adding Your First Brand](#adding-your-first-brand)
3. [Managing Prompts](#managing-prompts)
4. [Running Audits](#running-audits)
5. [Understanding Your Results](#understanding-your-results)
6. [Running Campaigns](#running-campaigns)
7. [Citation Intelligence](#citation-intelligence)
8. [AI-Powered Insights](#ai-powered-insights)
9. [Discovery Engine](#discovery-engine)
10. [Scheduling Automated Audits](#scheduling-automated-audits)
11. [Fresh Signals Intelligence](#fresh-signals-intelligence)
12. [Exporting Reports](#exporting-reports)
13. [Advanced Features](#advanced-features)

---

## Getting Started

### What is Forzeo?

Forzeo tracks how your brand appears when people ask AI assistants (ChatGPT, Gemini, Claude, Perplexity) questions about your industry.

**Example:**  
If someone asks ChatGPT: *"Best CRM software for small business"*  
- Does your brand appear in the response?
- What position are you listed at?
- Which sources does the AI cite?

If you're not mentioned, you're invisible to a growing audience that relies on AI for recommendations.

### Key Metrics You'll Track

| Metric | What It Means |
|--------|---------------|
| **Share of Voice (SOV)** | % of AI models that mention your brand (0-100%) |
| **Average Rank** | Your position in AI-generated lists (#1 is best) |
| **Citations** | Number of sources AI models reference about you |
| **Visibility Score** | Combined metric of your overall AI presence |

### Interpreting Share of Voice

| Range | Status | What to Do |
|-------|--------|------------|
| 70-100% | 🟢 **Excellent** | Keep dominating! Monitor competitors |
| 50-69% | 🟡 **Good** | Strong presence, room to improve |
| 25-49% | 🟠 **Moderate** | Significant gaps, take action |
| 0-24% | 🔴 **Low** | Urgent: You're invisible to AI |

---

## Adding Your First Brand

### Step 1: Access the Dashboard

1. Log in to Forzeo at your deployment URL
2. You'll see the main dashboard with a sidebar menu

### Step 2: Create a New Client

1. Click the **"+ Add Client"** button (top right of the dashboard)
2. Fill in the form:

| Field | Description | Example |
|-------|-------------|---------|
| **Brand Name** | Your company/product name | "Acme CRM" |
| **Brand Domain** | Your primary website | "acmecrm.com" |
| **Website URL** | Full website URL (optional) | "https://www.acmecrm.com" |
| **Industry** | Select from dropdown or choose "Custom" | "SaaS" or enter custom |
| **Location** | Geographic market | "United States" |
| **Competitors** | Comma-separated list | "Salesforce, HubSpot, Zoho" |

3. Click **"Save Client"**

> **💡 Tip:** The Website URL helps AI understand your brand better when generating recommendations.

### Step 3: Use Auto-Find Competitors (Optional)

1. Instead of manually entering competitors, click **"Auto-Find"**
2. Our AI will discover your top competitors automatically
3. Review and edit the suggested list
4. Click **"Accept"**

---

## Managing Prompts

Prompts are the search queries you want to track. Think: *"What would potential customers ask AI about my industry?"*

### Adding Prompts Manually

1. Select your brand from the sidebar
2. Click **"Add Prompt"**
3. Enter your query:
   - Example: *"Best CRM for real estate agents"*
   - Example: *"Most affordable project management tools"*
4. Select a **Category**:
   - **Broad:** Generic industry queries
   - **Niche:** Specific use cases
   - **Super Niche:** Very targeted audiences
   - **Comparison:** "X vs Y" queries
   - **Local:** Geographic-specific
5. Click **"Save"**

### Generating Prompts with AI

1. Click **"Generate Prompts"**
2. Enter keywords or topics related to your industry
3. Our AI will create 10-20 relevant prompts automatically
4. Review the suggestions
5. Select the ones you want to track
6. Click **"Add Selected Prompts"**

**Example Input:**  
*Keywords:* "CRM, sales automation, lead management"

**AI-Generated Prompts:**
- "Best CRM for sales automation"
- "How to manage leads effectively"
- "CRM vs spreadsheet for small business"
- "Affordable sales automation tools 2026"

### Importing Prompts from CSV

1. Click **"Import CSV"**
2. Upload a file with this format:
   ```
   prompt_text,category
   "Best dating apps in India",broad
   "Top restaurants near me",local
   "Affordable fashion websites",niche
   ```
3. Review and confirm import
4. Click **"Import"**

---

## Running Audits

An audit checks how your brand appears across 6 AI models in real-time.

### Models Queried

| Model | Provider | What It Tests |
|-------|----------|---------------|
| **ChatGPT** | OpenAI GPT-4o | Most popular AI assistant |
| **Gemini** | Google Gemini | Google's AI ecosystem |
| **Claude** | Anthropic | Enterprise AI users |
| **Perplexity** | Perplexity AI | Research-focused AI |
| **AI Overview** | Google | Google Search AI snippets |
| **SERP** | Google | Traditional search results |

### Running a Single Prompt Audit

1. Navigate to the **"Prompts"** tab
2. Find the prompt you want to audit
3. Click the **"Run Audit"** button (▶️ icon)
4. Wait 30-60 seconds for results
5. View detailed results in the **"Results"** tab



### Running Bulk Audits

1. Select multiple prompts using checkboxes
2. Click **"Run Bulk Audit"**
3. System processes all prompts sequentially
4. Monitor progress in the **"Campaigns"** tab

---

## Understanding Your Results

### Results Dashboard

After running an audit, you'll see:

#### 1. **Overview Cards**
- **Share of Voice:** Percentage displayed with color-coded status
- **Average Rank:** Your position across all models
- **Total Citations:** Number of sources mentioning you
- **Visibility Score:** Combined metric (0-100)

#### 2. **Model-by-Model Breakdown**

View results for each AI model:

| Model | Mentioned? | Rank | Citation Count |
|-------|------------|------|----------------|
| ChatGPT | ✅ Yes | #2 | 5 |
| Gemini | ✅ Yes | #3 | 3 |
| Perplexity | ❌ No | - | 0 |
| Claude | ✅ Yes | #1 | 7 |

#### 3. **Full Responses**

Click on any model to see:
- The complete AI-generated response
- Highlighted mentions of your brand
- Competitor mentions
- All cited sources

#### 4. **Competitor Analysis**

See how you stack up:

| Competitor | Mentions | Avg Rank | Gap |
|------------|----------|----------|-----|
| Competitor A | 5/6 (83%) | #1.2 | Ahead by 0.8 |
| Your Brand | 3/6 (50%) | #2.0 | - |
| Competitor B | 2/6 (33%) | #3.5 | Behind by 1.5 |

---

## Running Campaigns

Campaigns let you batch-process multiple prompts to get an aggregated view of your brand's overall AI visibility.

### Creating a Campaign

1. Click **"Run Campaign"** from the dashboard
2. Name your campaign:
   - Example: *"Q1 2026 Visibility Audit"*
   - Example: *"Complete Industry Analysis"*
3. The system automatically includes all active prompts for the selected brand
4. Click **"Start Campaign"**

### Campaign Processing

1. System creates a campaign record
2. Each prompt is audited sequentially
3. Progress bar shows completion percentage
4. Status updates from **Running** → **Completed**

### Campaign Results

View aggregated metrics:

| Metric | Value |
|--------|-------|
| **Total Prompts** | 50 |
| **Avg SOV** | 67% |
| **Avg Rank** | #2.3 |
| **Total Citations** | 342 |
| **Top Competitor** | Competitor A (appeared 45 times) |

### Campaign Actions

- **View Details:** See per-prompt breakdown
- **Rename Campaign:** Update the campaign name
- **Delete Campaign:** Remove from history (prompts remain intact)
- **Export Results:** Download comprehensive report

---

## Citation Intelligence

The Citation Intelligence Engine analyzes *where* AI models get their information about your brand.

### Running Citation Analysis

1. Run an audit on a prompt
2. Navigate to the **"Citations"** tab
3. Click **"Analyze Citations"**
4. System performs deep analysis on all discovered URLs

### What Gets Analyzed

For each citation:

| Data Point | What It Means |
|------------|---------------|
| **URL/Domain** | The source website |
| **Category** | Type of source (see below) |
| **Status** | Verified (real) or Hallucinated (fake) |
| **Opportunity Level** | How easy it is to take action |
| **Model** | Which AI cited this source |

### Citation Categories

| Category | Examples | Opportunity Level |
|----------|----------|-------------------|
| **Brand Owned** | Your own blog, product pages | 🟢 **Easy** - You control it |
| **Competitor** | Competitor websites | 🟢 **Easy** - Create counter-content |
| **UGC/Social** | Reddit, Quora, LinkedIn | 🟢 **Easy** - Reply directly |
| **Press & Media** | Forbes, TechCrunch | 🟡 **Medium** - Requires PR outreach |
| **App Stores** | Google Play, App Store | 🟡 **Medium** - Optimize listings |
| **Wikipedia** | Wikipedia.org | 🔴 **Difficult** - Strict editing rules |
| **Other** | General websites | 🟡 **Medium** - General outreach |

### Understanding Opportunity Levels

#### 🟢 Easy Wins (Low Effort, High Impact)
- **Brand Owned:** Update your own content immediately
- **UGC/Social:** Post replies on Reddit/Quora threads
- **Competitor:** Create comparison content

#### 🟡 Medium Effort (Requires Coordination)
- **Press & Media:** Pitch guest posts or interview requests
- **App Stores:** Optimize store descriptions and reviews
- **Other Websites:** Email outreach to request mentions

#### 🔴 Difficult (High Barriers)
- **Wikipedia:** Strict verification requirements
- Submit edits with authoritative sources

### Citation Intelligence Features

#### 1. **Filtering**
Filter citations by:
- **Category:** UGC, Competitor, Press, etc.
- **Status:** Verified, Hallucinated, Unknown
- **Model:** ChatGPT, Gemini, Claude, Perplexity
- **Opportunity Level:** Easy, Medium, Difficult
- **Search:** Text search across URLs and domains

#### 2. **Sorting**
Click any column header to sort:
- Status, URL, Category, Model, Opportunity Level

#### 3. **Bulk Actions**
- Select multiple citations with checkboxes
- Click **"Delete Selected"** to remove in bulk
- Use **"Select All"** to choose entire page

#### 4. **Saved Filter Presets**
1. Apply your desired filters
2. Click **"Save Preset"**
3. Name your preset (e.g., "Easy Wins Only")
4. Load anytime from **"Load Preset"** dropdown

#### 5. **Column Visibility**
1. Click **"Columns"** button
2. Toggle which columns to show/hide
3. Customize your view for focused analysis

#### 6. **Pagination**
- Choose items per page: 10, 25, 50, or 100
- Navigate with page numbers or Previous/Next
- See total result count

---

## AI-Powered Insights

Forzeo generates intelligent, actionable recommendations based on your audit data.

### Accessing Insights

After running an audit:
1. Go to the **"Insights"** tab
2. View AI-generated recommendations
3. See priority levels for each action

### Insight Structure

#### **Executive Summary**
One-sentence overview of your visibility status with priority badge:
- 🔴 **Critical** - Immediate action required
- 🟡 **Needs Work** - Improvements needed
- 🟢 **Good** - Maintain current strategy

**Example:**  
> 🔴 **Critical:** Your brand has low visibility (33% SOV) with strong competitor dominance and minimal citations from authoritative sources.

#### **Strategic Recommendations**

5 AI-generated, specific recommendations (NOT generic advice):

**Excellent Recommendations:**
✅ "Create a comparison page: 'Acme CRM vs Salesforce for Real Estate' targeting the $12M real estate CRM market"  
✅ "Publish a detailed Reddit comment on r/realestate responding to the thread 'CRM recommendations for agents' (1.2k upvotes)"  
✅ "Reach out to the author at TechCrunch who covered competitor launches 3 times in Q4 2025"

**Bad Recommendations (Forzeo Avoids These):**
❌ "Study competitor strategy" (too vague)  
❌ "Build relationships with journalists" (no specifics)  
❌ "Create more content" (not actionable)

#### **Key Actions**

Divided by timeline:

**Immediate (This Week):**
- Update meta descriptions on top 3 landing pages
- Respond to 5 Reddit threads mentioning competitors

**Short-term (This Month):**
- Create comparison landing pages for top 3 competitors
- Publish guest post on identified high-authority site

**Long-term (This Quarter):**
- Launch PR campaign targeting TechCrunch, Forbes
- Build Wikipedia page with proper citations

### Prompt-Level Insights

Click on any individual prompt to see:
- Recommendations specific to that query
- Top domains to target
- Competitor gap analysis
- Citation opportunities

### Overall Insights Dashboard

1. Navigate to **"Overall Insights"**
2. View aggregated data across ALL prompts:
   - Priority breakdown (Critical/Needs Work/Good)
   - Top recommendations across all audits
   - Competitor patterns
   - Domain opportunities

---

## Discovery Engine

Formerly called "Tavily Analysis," the Discovery Engine finds where your brand appears across the web in real-time.

### What It Does

Deep web search to discover:
- Editorial content mentioning your brand
- Review sites and comparison pages
- Forum discussions and social mentions
- High-authority sources for outreach

### Running Discovery

#### Option 1: Auto-Run During Audits

1. Go to **"Settings"** or audit configuration
2. Toggle **"Discovery Engine"** ON (amber/yellow indicator)
3. Every audit will automatically include web search
4. Results appear in **"Citations"** tab with full content

#### Option 2: Manual Discovery

1. Navigate to **"Discovery"** tab
2. Enter your brand name or keyword
3. Click **"Run Discovery"**
4. Review discovered sources

### Discovery Results

For each discovered source:

| Data | Description |
|------|-------------|
| **URL** | Full web address |
| **Title** | Page headline |
| **Content Preview** | Extracted text snippet |
| **Score** | Relevance score (0-1) |
| **Domain Authority** | Site reputation |
| **Brand Mentioned?** | Yes/No |
| **Competitor Mentions** | List of competitors found |

### Using Discovery Data

**Identify Gaps:**
- Sources mentioning competitors but not you
- High-authority sites you're missing from

**Find Opportunities:**
- Active discussions where you can contribute
- Review sites to request coverage

**Correlate with AI:**
- See which web sources AI models actually cite
- Focus efforts on AI-trusted domains

---

## Scheduling Automated Audits

Set up recurring audits to monitor visibility over time without manual intervention.

### Creating a Schedule

1. Navigate to **"Schedules"** tab
2. Click **"Create Schedule"**
3. Configure:

| Setting | Options | Example |
|---------|---------|---------|
| **Name** | Custom label | "Weekly Visibility Check" |
| **Prompts** | Select which prompts to audit | All prompts, or specific ones |
| **Frequency** | Interval | Every 1 day, 7 days, 30 days |
| **Models** | Which AI models to query | All 6, or select specific ones |
| **Discovery** | Enable web search | Toggle ON/OFF |
| **Start Date** | When to begin | Today or future date |

4. Click **"Save Schedule"**

### Schedule Monitoring

View active schedules:

| Schedule | Last Run | Next Run | Total Runs | Status |
|----------|----------|----------|------------|--------|
| Weekly Check | Jan 10, 2026 | Jan 17, 2026 | 24 | 🟢 Active |
| Monthly Deep Audit | Jan 1, 2026 | Feb 1, 2026 | 3 | 🟢 Active |

### Schedule Actions

- **Pause:** Temporarily stop automatic runs
- **Resume:** Reactivate a paused schedule
- **Edit:** Modify frequency or prompts
- **Delete:** Remove schedule permanently
- **Run Now:** Trigger an immediate run

### Viewing Schedule History

1. Click on any schedule
2. See **"Run History"** tab
3. View results from each automated run:
   - Timestamp
   - SOV at that time
   - Rank changes
   - Citation count

### Cost Considerations

> **💰 Important:** Each scheduled run costs the same as a manual audit (~$0.20-0.40 per prompt). Monitor your usage!

**Benefits:**
- Faster data navigation with pagination and sorting

---

## Fresh Signals Intelligence

Get alerts about new content on the web that mentions your brand or competitors *before* it gets indexed by AI models.

### What Are Fresh Signals?

Web content discovered in real-time from:
- Google Alerts RSS feeds
- Industry news aggregators
- Blog feeds
- Social media mentions

### Setting Up RSS Feeds

1. Navigate to **"Signals"** tab
2. Click **"Add RSS Feed"**
3. Configure:

| Field | Description | Example |
|-------|-------------|---------|
| **Name** | Feed label | "Google Alert - Acme CRM" |
| **Feed URL** | RSS feed address | Google Alert RSS URL |
| **Category** | Type of content | News, Blogs, Social |
| **Active** | Enable/disable | Toggle ON |

4. Click **"Save Feed"**

### Signal Detection Process

```
RSS Feed → Content Discovered → Signal Scorer Analyzes →
→ Calculates Influence Score → Generates Recommendations
```

### Signal Classification

Each signal is automatically classified:

| Type | What It Means | Action |
|------|---------------|--------|
| 🔥 **AMPLIFY** | Content already appears in AI responses | Share, backlink, maximize it |
| 🆕 **EMERGING** | Brand-new content, high potential | Get quoted/linked immediately |
| ⚔️ **COMPETITIVE** | Competitor is winning this mention | Create counter-content |
| 💡 **OPPORTUNITY** | Gap in market, no one dominating | Create content to fill void |

### Signal Scoring System

Each signal gets scored on:

| Factor | Weight | What It Measures |
|--------|--------|------------------|
| **Freshness** | 30% | How new is the content |
| **Authority** | 40% | Domain reputation/trust |
| **Relevance** | 30% | Keyword match quality |

**Influence Score = Combined score (0-1)**

Only signals scoring ≥ 0.5 generate recommendations.

### Viewing Signals

1. Go to **"Signals"** dashboard
2. Filter by:
   - Classification (Amplify, Emerging, etc.)
   - Time range (Last 24h, 7 days, 30 days)
   - Priority level
3. Click on any signal to see:
   - Full article content
   - Detected brand/competitor mentions
   - Specific action recommendations
   - Expiry date (recommendations expire after 30 days)

### Acting on Signals

Each signal includes:

**Priority Level:**
- 🔴 High - Act within 24-48 hours
- 🟡 Medium - Act within 1 week
- 🟢 Low - Monitor

**Action Items:**
- Specific steps to take
- Who to contact
- Content to create
- Deadlines

**Example High-Priority Signal:**

> **🔥 AMPLIFY - HIGH PRIORITY**
>
> **Source:** TechCrunch article "Best CRMs for 2026"  
> **Detected:** Your brand mentioned #3, Competitor A is #1  
> **Influence Score:** 0.87  
> **Expires:** Jan 21, 2026
>
> **Actions:**
> 1. Share this article on social media within 24h (capitalize on mention)
> 2. Email author Sarah Johnson (sarah@techcrunch.com) to provide additional quotes
> 3. Create internal blog post responding to article points
> 4. Monitor for AI model citation within 7-14 days

---

## Exporting Reports

Share your visibility data with stakeholders or analyze externally.

### Export Formats

| Format | Best For | Contains |
|--------|----------|----------|
| **CSV** | Spreadsheet analysis | Raw data tables |
| **TXT** | Executive summaries | Formatted narratives |
| **PDF** | Client presentations | Visual reports (coming soon) |

### Exporting Audit Reports (TXT)

1. Navigate to **"Results"** tab for a prompt
2. Click **"Export Report"**
3. Report includes:

**Contents:**
- Executive Summary (AI-generated overview)
- Share of Voice breakdown
- Model-by-model results with full responses
- Competitor comparison
- Citation list with categories
- Strategic Recommendations (from Insights)
- Key Actions (Immediate, Short-term, Long-term)
- Discovery Engine findings (if enabled)

4. File saves as: `audit-report-{brand}-{prompt}-{date}.txt`

### Exporting Citation Intelligence (TXT)

1. Go to **"Citations"** → **"Citation Intelligence"** tab
2. Apply any filters you want (export respects active filters)
3. Click **"Export Report"** (top right)
4. Report includes:

**Contents:**
- Summary statistics (verified vs hallucinated)
- Category distribution
- Opportunity level breakdown
- Top 10 recommendations
- Complete citation list with:
  - URL, domain, title
  - Category, status, opportunity level
  - Model that cited it
  - Analysis notes

5. File saves as: `citation-intelligence-{clientId}-{date}.txt`

### Exporting Campaign Results (CSV)

1. Navigate to **"Campaigns"** tab
2. Click on a completed campaign
3. Click **"Export CSV"**
4. CSV contains:
   - Prompt, Category, SOV, Avg Rank, Citations
   - Competitor mentions
   - Model-specific data
   - Timestamp

### Exporting Prompt Data (CSV)

1. Go to **"Prompts"** tab
2. Click **"Export All Prompts"**
3. CSV columns:
   - prompt_text
   - category
   - total_audits
   - last_audited
   - avg_sov
   - avg_rank

---

## Advanced Features

### Content Generator

Create AI-optimized content based on your audit data.

#### Generating Visibility Content

1. Run an audit with Discovery Engine enabled
2. Go to **"Content"** tab
3. Click **"Generate Visibility Content"**
4. AI creates:
   - Blog posts addressing visibility gaps
   - Comparison pages vs competitors
   - FAQ content optimized for AI queries
   - Social media posts

#### Content Types Available

| Content Type | Use Case | Based On |
|-------------|----------|----------|
| **Quora Answer** | Humanized response to relevant questions | Audit + Discovery data |
| **Reddit Comment** | Authentic community contribution | Discussion threads found |
| **Comparison Page** | "Brand vs Competitor" landing page | Competitor analysis |
| **Press Release** | Announcement for media outreach | Brand features + gaps |
| **Blog Post** | SEO-optimized long-form content | Audit insights |

#### Generating Content

1. Select **Content Type**
2. Choose which **Audit Result** to base it on
3. Add any **Additional Context** (optional)
4. Click **"Generate"**
5. Edit and refine the output
6. Copy or export

---

### User Management (If Admin)

Invite team members to collaborate:

1. Navigate to **"Users"** (admin only)
2. Click **"Invite User"**
3. Enter email and role:
   - **Admin:** Full access
   - **Member:** View and run audits
   - **Viewer:** Read-only
4. Click **"Send Invitation"**

Manage existing users:
- **Edit permissions**
- **Revoke access**
- **Restore access**
- **View activity log**

---

### Cost Tracking

Monitor API usage and costs:

1. Go to **"Settings"** → **"API Usage"**
2. View breakdown:
   - Cost per model
   - Total spent this month
   - Average cost per audit
   - Most expensive prompts

Set budget alerts:
1. Click **"Set Budget Alert"**
2. Enter monthly limit
3. Receive notifications at 50%, 75%, 90% thresholds

---

### Activity Log

Track all actions in your account:

1. Navigate to **"Activity"** tab
2. Filter by:
   - Action type (Audit, Delete, Update, Export)
   - User (who performed the action)
   - Date range
3. View detailed logs:
   - Timestamp
   - User
   - Action description
   - Related entity (client, prompt, campaign)

---

## Troubleshooting

### Audit Fails or Returns "No Data"

**Possible Causes:**
- API keys missing or invalid
- Insufficient balance in DataForSEO account
- Temporary API outage

**Solutions:**
1. Check **"Settings"** → **"API Keys"** are configured
2. Verify DataForSEO account balance
3. Try again in a few minutes
4. Contact support if persistent

### Discovery Engine Returns Empty Results

**Possible Causes:**
- No web sources mention your brand for that query
- Tavily API key missing

**Solutions:**
1. Try broader search terms
2. Verify Tavily API key in settings
3. Run more prompts to gather data

### Citations Show as "Hallucinated"

**What It Means:**
AI model cited a URL that doesn't actually exist or doesn't contain the claimed information.

**Actions:**
- This is valuable data! Shows AI unreliability
- Document hallucinations in reports
- Focus on verified citations for outreach

### Slow Performance

**Optimizations:**
- Reduce prompts per campaign
- Disable Discovery Engine for faster audits
- Archive old prompts you no longer track
- Use pagination on large result sets

---

## Best Practices

### For Best Results

1. **Start Broad, Then Go Niche**
   - Begin with 5-10 broad industry prompts
   - Analyze which perform worst
   - Create niche prompts targeting those gaps

2. **Competitor Selection Matters**
   - Include 3-5 direct competitors
   - Add 1-2 aspirational competitors (leaders)
   - Update quarterly as market changes

3. **Schedule Wisely**
   - Weekly audits for critical prompts
   - Monthly audits for niche prompts
   - Quarterly deep campaigns

4. **Act on Insights Immediately**
   - Easy Wins (UGC/Social) within 48 hours
   - Medium Effort (Press) within 2 weeks
   - Long-term actions within 90 days

5. **Export Regular Reports**
   - Weekly exports for trend tracking
   - Monthly reports for stakeholders
   - Quarterly comparisons to measure progress

---

## Support & Resources

### Getting Help

- **Documentation:** `/README.md`, `/FEATURE_GUIDE.md`, `/ARCHITECTURE.md`
- **API Guides:** `/API_KEY_GUIDE.md`, `/SETUP.md`
- **Contact:** support@forzeo.com (replace with actual support contact)

### Recommended Workflow

**Week 1:**
- Add your brand
- Create 10 broad prompts
- Run initial audits
- Review results

**Week 2:**
- Analyze Citation Intelligence
- Tackle Easy Win opportunities
- Create comparison content

**Week 3-4:**
- Set up schedules for monitoring
- Add Fresh Signals RSS feeds
- Execute Medium Effort recommendations

**Monthly:**
- Run full campaign audit
- Export reports for stakeholders
- Adjust strategy based on insights

---

## Glossary

| Term | Definition |
|------|------------|
| **Audit** | One-time query across all AI models for a specific prompt |
| **Campaign** | Batch processing of multiple prompts |
| **Citation** | A URL referenced by an AI model in its response |
| **Discovery Engine** | Web search tool to find brand mentions |
| **Hallucination** | Fake citation created by AI (URL doesn't exist) |
| **Prompt** | Search query you're tracking |
| **Share of Voice (SOV)** | % of AI models mentioning your brand |
| **Signal** | Fresh web content discovered via RSS feeds |
| **Visibility Score** | Combined metric of AI presence |

---

## Quick Reference Card

### Most Common Tasks

| Task | Steps |
|------|-------|
| **Add a brand** | Dashboard → + Add Client → Fill form → Save |
| **Create prompts** | Select brand → Add Prompt → Enter query → Save |
| **Run audit** | Prompts tab → Click ▶️ → Wait for results |
| **View results** | Results tab → Click prompt → See breakdown |
| **Analyze citations** | Citations tab → Analyze Citations → Review |
| **Export report** | Results → Export Report → Save TXT file |
| **Create schedule** | Schedules → Create → Configure → Save |
| **Check insights** | Insights tab → Read recommendations → Act |

---

**🎉 Congratulations!** You're now ready to master Forzeo and dominate AI visibility for your brand.

**Next Step:** Add your first brand and run your first audit to see where you stand!
