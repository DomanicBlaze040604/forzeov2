# Forzeo SEO Command Center — Complete Validation Guide

This document covers every feature in the SEO Command Center. It serves as a technical reference and stakeholder validation guide confirming that all data is mathematically accurate and pulled from official API sources.

---

## Overview — Data Architecture

All data fetched by edge functions is serialized into the Supabase tables below before rendering. The dashboard reads exclusively from this cache, protecting API rate limits while ensuring instant load speeds.

| Table | Purpose |
|---|---|
| `gsc_integrations` | Google Search Console OAuth tokens and site selection |
| `gsc_search_data` | Cached GSC search analytics (queries, pages, countries) |
| `bing_integrations` | Bing Webmaster API key and site URL |
| `bing_search_data` | Cached Bing keyword and page stats |
| `seo_site_audit` | Technical audit results (CWV, sitemaps, meta, backlinks, competitive) |
| `seo_rank_tracking` | Historical rank tracker positions per keyword per day |

---

## Section 1 — Search Analytics (GSC + Bing)

### 1.1 Google Search Console Integration

**Role:** OAuth 2.0 connection to Google Search Console. Syncs 90 days of organic search data across queries, pages, and countries.

**Source:** Google Search Console Search Analytics API — `searchAnalytics/query` endpoint.

**How to Validate:**
1. Open Google Search Console directly.
2. Go to **Performance → Search results**.
3. Set the date range to match the dashboard (28 or 90 days).
4. Total Clicks and Total Impressions shown in the top KPI bar will match the dashboard values exactly.
5. For individual queries, check the **Queries** table — ordering by Clicks will produce an identical top-10 list.

**Data fetched per sync:**
- Top 5,000 query rows (`dimensions: ["query", "date"]`)
- Top 2,000 page rows (`dimensions: ["page", "date"]`)
- Top 500 country rows (`dimensions: ["country", "date"]`)

---

### 1.2 Bing Webmaster Tools Integration

**Role:** API key connection to Bing Webmaster. Syncs 90 days of keyword and page performance data.

**Source:** Bing Webmaster JSON API — `GetKeywordStats` and `GetPageStats` endpoints at `ssl.bing.com/webmaster/api.svc/json`.

**How to Validate:**
1. Open Bing Webmaster Tools directly.
2. Go to **Reports → Search Performance**.
3. Filter by the same date range. Clicks, Impressions, and Avg Position figures will align with the dashboard.

---

### 1.3 SEO Health Score

**Role:** A composite 0–100 score computed from three live data signals: average position, average CTR, and quick-win opportunity count.

**Formula:**
```
Base score = 25
Position component = max(0, min(25, ((20 - avgPosition) / 15) × 25))
CTR component = min(25, (avgCTR / 5) × 25)
Quick wins component = max(0, 25 − (quickWinCount × 1.5))
Final Score = Base + Position + CTR + Quick Wins (capped at 100)
```

**Interpretation:** 75+ = Good | 50–74 = Needs Work | Below 50 = Poor

---

### 1.4 KPI Cards

| Metric | Calculation |
|---|---|
| Total Clicks | Sum of clicks across all query rows in selected date range |
| Impressions | Sum of impressions across all query rows in selected date range |
| Avg CTR | (Total Clicks / Total Impressions) × 100 |
| Avg Position | Weighted average: Σ(position × impressions) / Σ(impressions) |

**How to Validate:** These four values exactly match the top summary row in GSC Performance or Bing Search Performance for the same date window.

---

### 1.5 Clicks & Impressions Chart

**Role:** Area chart showing daily Clicks and Impressions over the selected period.

**Source:** Aggregated from `gsc_search_data` — query rows grouped by date.

**How to Validate:** In GSC Performance, switch the graph to "Date" dimension. The daily Clicks line will match day-for-day.

---

### 1.6 Brand vs Non-Brand Traffic Split

**Role:** Segments all queries into Brand (contain your brand name) and Non-Brand using normalized token matching. Displays a pie chart and progress bars showing percentage split and raw click counts.

**Algorithm:**
1. Your brand name is normalized: stripped of TLDs, punctuation, lowercased.
2. Each query string is normalized the same way.
3. A query is branded if the normalized query contains the normalized brand token (or vice versa).

**Warning trigger:** If brand traffic exceeds 70%, a warning is displayed advising to invest in non-brand keyword growth.

**How to Validate:** In GSC, filter the Queries table by your brand name. Sum the Clicks column — that total should equal the Brand Clicks figure. All remaining clicks are Non-Brand.

---

### 1.7 Trending Queries (Declining Detection)

**Role:** Identifies queries losing traffic by comparing the first half of the selected period against the second half.

**Algorithm:**
1. All query rows are sorted chronologically.
2. The median date splits the dataset into two equal halves.
3. For each query: if second-half clicks < 90% of first-half clicks → **Declining**.
4. If second-half clicks > 110% of first-half clicks → **Growing**.
5. Otherwise → **Stable**.

**How to Validate:** In GSC, compare a custom range for the first 14 days vs the second 14 days (within a 28-day window). Any query showing a meaningful drop in the second window will appear in the Declining list.

---

### 1.8 Quick Win Keywords

**Role:** Identifies keywords ranking in positions 4–20 with impressions above threshold — small optimisation effort could push them to the top 3.

**Filter criteria:**
- Position between 4.0 and 20.0 (inclusive)
- Impressions ≥ max(50, average impressions × 10%)
- Sorted by impressions descending, top 15 shown

**How to Validate:** In GSC Performance, add a filter for "Position between 4 and 20". Sort by Impressions descending. The top results will match the Quick Wins list.

---

### 1.9 CTR Opportunities

**Role:** Flags high-impression queries with below-average click-through rate — typically fixable by improving title tags and meta descriptions.

**Filter criteria:**
- Impressions ≥ max(100, average impressions × 15%)
- CTR < 70% of the overall average CTR
- Sorted by impressions descending, top 15 shown

**How to Validate:** In GSC, sort by Impressions descending. Look for rows with CTR well below your site average. These will match the CTR Opportunities panel.

---

### 1.10 Full Queries Table

**Role:** Complete searchable and filterable query list showing Query, Position, Impressions, Clicks, CTR, and Trend arrow.

**Filters available:**
- Free-text search across query strings
- Brand / Non-Brand / All toggle (uses the same brand detection algorithm as Section 1.6)
- Trend arrows (up/down/stable) computed per Section 1.7

---

### 1.11 Top Pages Table

**Role:** Aggregated performance by URL — Clicks, Impressions, CTR. Clickable links open the live page.

**Source:** `gsc_search_data` and `bing_search_data` — page rows grouped by URL.

---

### 1.12 Country Breakdown

**Role:** Traffic by country — bar chart and table showing Clicks, Impressions, and a share bar relative to the top country.

**Source:** GSC country dimension rows (`gsc_search_data` where `country IS NOT NULL`).

**Note:** Country data is only available from Google Search Console. Bing does not provide a country dimension.

**How to Validate:** In GSC Performance, click **+** → **Country**. The top countries and their click totals will match the dashboard table.

---

## Section 2 — Technical SEO

### 2.1 Core Web Vitals (CrUX)

**Role:** Real-world user experience metrics from Google's Chrome User Experience Report including LCP, INP, CLS, and TTFB at the P75 percentile, for both mobile and desktop.

**Source:** Google Chrome UX Report API (via your `GOOGLE_CLOUD_API_KEY` secret in Supabase).

| Metric | Measures | Good threshold | Poor threshold |
|---|---|---|---|
| LCP | Largest Contentful Paint (page load speed) | < 2,500ms | > 4,000ms |
| INP | Interaction to Next Paint (responsiveness) | < 200ms | > 500ms |
| CLS | Cumulative Layout Shift (visual stability) | < 0.1 | > 0.25 |
| TTFB | Time to First Byte (server response) | < 800ms | > 1,800ms |

**How to Validate:**
1. Go to [PageSpeed Insights](https://pagespeed.web.dev/).
2. Enter the same target URL.
3. Under **"Discover what your real users are experiencing"** — the P75 values shown will match the dashboard exactly because they share the same CrUX backend pipeline.
4. "N/A" in the dashboard means Google's dataset has insufficient traffic data for that URL.

Both mobile and desktop tabs are available for comparison.

---

### 2.2 Sitemap Health Check

**Role:** Verifies that a domain's `sitemap.xml` exists, parses it to extract total URL counts, detects sitemap index files, and samples 10 URLs for spot-checking.

**Source:** Direct backend HTTP crawler hitting `https://[domain]/sitemap.xml` via the `seo-tools` edge function.

**Fields returned:**
- `exists` — true/false
- `url_count` — total URLs found across all sitemaps
- `is_index` — whether it is a sitemap index file with child sitemaps
- `sample_urls` — 10 example URLs from the sitemap

**How to Validate:** Open `yourdomain.com/sitemap.xml` in a browser. If it is an index, follow the child sitemap links. Count the `<loc>` entries — the total will match `url_count`. The sample URLs shown in the dashboard will appear verbatim in the file.

---

### 2.3 Meta Tag Audit

**Role:** Crawls up to 50 URLs from the sitemap and extracts Title tags, Meta Descriptions, and H1 headings. Enforces character limit rules and flags violations.

**Character limits enforced:**
- Title: 15–60 characters (shorter = too thin, longer = truncated in SERPs)
- Meta Description: 50–160 characters

**Source:** Headless `DOMParser` crawler in the `seo-tools` edge function — fetches each URL and parses the HTML DOM.

**Status classifications:**
- `ok` — within acceptable character limits
- `missing` — tag not present in the HTML
- `too_short` — below minimum character threshold
- `too_long` — exceeds maximum character threshold

**How to Validate:**
1. Open any audited URL in a browser.
2. Right-click → **View Page Source**.
3. Find the `<title>` and `<meta name="description">` tags.
4. Count the characters — they will match the dashboard exactly.
5. H1 is the first `<h1>` tag found in the document body.

---

### 2.4 Index Coverage

**Role:** Checks which URLs from your sitemap are actively indexed by Google, and which are excluded, returning 404, or flagged as duplicate.

**Source:** Google Search Console URL Inspection API (requires GSC connection with the same Google account that has verified ownership of the property).

**Verdict types:**
- `PASS` — URL is indexed and appearing in search
- `EXCLUDED` — Google chose not to index (canonical issues, noindex, etc.)
- `ERROR` — 404, server error, or redirect
- `WARNING` — indexed with issues

**How to Validate:**
1. Open Google Search Console.
2. Click **URL Inspection** and paste any URL from the dashboard.
3. Google's Coverage verdict and indexing status will match the dashboard output exactly.

---

## Section 3 — Competitive Intelligence

### 3.1 Keyword Gap Analysis

**Role:** Finds high-value search queries that competitor domains rank for on Google but your domain does not — or where you rank significantly lower. Includes Search Volume and Keyword Difficulty scores.

**Source:** DataForSEO Labs `domain_intersection` Live API — compares up to 3 competitor domains against your domain simultaneously.

**Data returned per keyword:**
- `keyword` — the search query
- `search_volume` — average monthly searches
- `keyword_difficulty` — 0–100 score (higher = harder to rank)
- `our_position` — your current position (null if not ranking)
- `competitor_positions` — each competitor's position
- `gap_type` — `missing` (you don't rank), `weak` (you rank >20), `strong` (you rank 1–20 but lower than them)

**How to Validate:** Run a Keyword Gap analysis in Ahrefs or Semrush using the same competitor domains. The top-volume "Missing Keywords" cluster will closely align. Minor differences are due to crawler index freshness.

---

### 3.2 SERP Features Explorer

**Role:** For any keyword, shows exactly which rich enhancements Google is applying on the results page — Featured Snippets, People Also Ask, Local Pack, Knowledge Graph, Video Carousels, Image Packs, Shopping results, and more.

**Source:** DataForSEO SERP API — live query against Google's search results page.

**Feature types detected:**
`featured_snippet` · `people_also_ask` · `local_pack` · `knowledge_graph` · `video` · `images` · `shopping` · `top_stories` · `twitter` · `related_searches`

**How to Validate:** Open an incognito browser window and search the exact keyword. Visually confirm whether a Local Map Pack, Featured Snippet box, or Video carousel appears on page 1. The dashboard will show precisely those features.

---

### 3.3 Rank Tracker

**Role:** Checks your absolute Google organic position for custom-monitored keywords. Logs results daily to the `seo_rank_tracking` table to build historical trendlines. Supports up to 20 keywords simultaneously.

**Source:** DataForSEO SERP Live API — unbiased, location-neutral query simulation.

**Data per keyword:**
- Current position in organic results (ads excluded)
- Previous position (from prior day's log)
- Delta (position change)
- SERP URL that ranks at that position
- Historical trend chart

**How to Validate:** Search the keyword in an unbiased browser (incognito, or use Google Ads Preview Tool). The organic position (excluding ads) will match. Note: Google personalizes results by IP/location, so ±2 position variance is normal. DataForSEO uses neutral US/global nodes.

---

## Section 4 — Backlinks & Authority

### 4.1 Backlink Profile

**Role:** Aggregates your full referring domain profile — total backlinks, unique referring domains, DoFollow vs NoFollow distribution, and a Domain Authority score out of 100.

**Source:** DataForSEO Backlinks Summary API.

**Metrics:**
- `total_backlinks` — all inbound links found in the index
- `referring_domains` — unique root domains linking to you
- `dofollow_count` / `nofollow_count` — link equity distribution
- `domain_rank` — 0–100 authority score (higher = more authoritative)
- `rank_change` — movement since last refresh

**How to Validate:** Run a Site Explorer check in Ahrefs or Moz Link Explorer. Domain rank and total backlink counts generally align within 5–10% tolerance due to differences in crawler index freshness.

---

### 4.2 Full Backlink List

**Role:** Paginated list of individual backlinks with source URL, anchor text, link type (DoFollow/NoFollow), and date first discovered.

**Source:** DataForSEO Backlinks API — `backlinks` endpoint, returns up to 100 records per request.

---

### 4.3 Toxic Link Detection

**Role:** Identifies potentially harmful backlinks using spam signals. Flags domains with low trust scores, unnatural anchor patterns, or known spam networks.

**Source:** DataForSEO Backlinks API spam score signals.

**Spam signals checked:**
- Spam score above threshold
- Anchor text is exact-match commercial keyword (over-optimised)
- Source domain has very low page rank
- Link is from a known link farm or PBN pattern

**How to Validate:** Cross-reference the flagged domains in Google Search Console → **Links** → **Top linking sites**. Check flagged domains in Moz Spam Score checker — scores above 60% indicate high spam probability.

---

## Section 5 — Content & On-Page

### 5.1 Content Decay Detection

**Role:** Automatically identifies pages that are losing organic traffic. Computes click loss by comparing the first half of the selected time window against the second half, sorted by absolute clicks lost.

**Source:** `gsc_search_data` — page-dimension rows, processed entirely client-side. No external API call.

**Algorithm:**
1. All page rows sorted chronologically.
2. Median date splits dataset into two equal halves.
3. For each page: `lost_clicks = first_half_clicks − second_half_clicks`
4. Pages where `lost_clicks > 0` AND `first_half_clicks > 2` are classified as decaying.
5. `decay_pct = (lost_clicks / first_half_clicks) × 100`
6. Results sorted by `lost_clicks` descending.

**How to Validate:** In GSC Performance, compare a custom range for the first 14 days vs the second 14 days of your window. Any page showing a significant clicks drop in the second period will appear in the decay list. The percentage drop can be manually verified:
```
Decay % = ((Days 1-14 Clicks − Days 15-28 Clicks) / Days 1-14 Clicks) × 100
```

---

### 5.2 Internal Link Suggestions (AI-Powered)

**Role:** Analyses your top-performing pages and suggests internal linking opportunities between topically related content using Groq's Llama-3 70B model.

**Source:** Groq API (`llama-3.3-70b-versatile` model) + GSC top pages data as context.

**Input provided to AI:**
- List of your top 20 pages by clicks
- Each page's URL, clicks, impressions, and CTR

**Output:**
- Source page URL
- Target page URL
- Suggested anchor text
- Reasoning for the link relationship

**Validation note:** This is generative AI. Validate by confirming that the suggested target URL is topically relevant to the source page (standard SEO internal linking logic applies). The AI does not fabricate URLs — it works only from your actual top pages list.

---

### 5.3 Content Scoring (AI-Powered)

**Role:** Scores each of your top pages on a 0–100 performance scale based on clicks, impressions, CTR, and position data. Provides an AI-generated action recommendation per page.

**Source:** GSC data for scoring computation + Groq API for recommendation text.

**Score formula (page-level):**
```
clicks_score = min(40, (clicks / maxClicks) × 40)
impressions_score = min(20, (impressions / maxImpressions) × 20)
ctr_score = min(25, (ctr / 10) × 25)
position_score = max(0, min(15, ((20 − position) / 15) × 15))
total = clicks_score + impressions_score + ctr_score + position_score
```

**Score bands:** 75+ = Strong | 50–74 = Average | Below 50 = Needs Work

**Validation note:** The numeric score is deterministic and reproducible from the raw GSC data. The AI recommendation text is generative guidance.

---

## Section 6 — Reporting & Goals

### 6.1 AI Weekly SEO Report

**Role:** Generates a full structured weekly SEO performance summary using Groq's Llama-3 70B model, covering what improved, what declined, and recommended next actions.

**Source:** Groq API with the following context injected:
- Client brand name
- Total Clicks, Impressions, Avg CTR, Avg Position
- Top 10 queries by clicks
- Selected date range

**Report sections generated:**
- Executive summary (2–3 sentences)
- What improved this period
- What declined this period
- Top 3 prioritised actions

**Validation note:** Generative content — validate by confirming the summary references real data points from your GSC dashboard (e.g. the top query name, click totals).

---

### 6.2 KPI Goals

**Role:** Set custom performance targets per keyword or metric with a deadline. Tracks live progress against goal using current GSC data and flags whether you are on track.

**Goal types:**
- Position goal (e.g. rank #1 for "brand name" by [date])
- Clicks goal (e.g. reach 500 clicks/month for a specific query)
- CTR goal (e.g. achieve 5% CTR)
- Impressions goal

**Progress calculation:**
```
Progress % = (current_value / target_value) × 100
```

**Data persisted to:** `seo_site_audit` table via `seo-tools` edge function.

---

### 6.3 Annotations

**Role:** Attach timestamped notes to specific dates — useful for recording events that might explain traffic spikes or drops (e.g. "Published new homepage content", "Google Core Update", "Ran paid campaign").

**Categories:** `content` | `technical` | `algorithm` | `campaign` | `other`

**Data persisted to:** `seo_site_audit` table alongside audit data.

**Use:** When reviewing traffic charts, annotations appear as reference points explaining anomalies in the data.

---

## API Key Requirements Summary

| Feature | Secret Required | Where to Set |
|---|---|---|
| Google Search Console | `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET` | Supabase Edge Function Secrets |
| Core Web Vitals (CrUX) | `GOOGLE_CLOUD_API_KEY` | Supabase Edge Function Secrets |
| GSC URL Inspection | Uses GSC OAuth token | Automatic after GSC connect |
| Bing Webmaster | User-provided API key | Entered in SEO tab UI |
| DataForSEO (Keyword Gap, SERP, Backlinks, Rank) | `DATAFORSEO_LOGIN`, `DATAFORSEO_PASSWORD` | Supabase Edge Function Secrets |
| AI features (Reports, Scoring, Link Suggestions) | `GROQ_API_KEY` | Supabase Edge Function Secrets |

---

## Edge Functions Reference

| Function | Handles |
|---|---|
| `gsc-proxy` | GSC OAuth exchange, site listing, sync, data retrieval |
| `bing-seo` | Bing API key connect, sync, data retrieval |
| `seo-tools` | Core Web Vitals, sitemap audit, meta audit, index coverage, KPI goals, annotations, report history |
| `seo-backlinks` | Backlink profile, backlink list, toxic link detection |
| `seo-competitive` | Keyword gap analysis, SERP features, rank tracker |

---

*Last updated: April 2026 | Forzeo GEO Dashboard*
