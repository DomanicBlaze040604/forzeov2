# Metrics & Formulas - Complete Specification

All scoring algorithms and calculation formulas used in the platform.

---

## M1. Share of Voice (SOV)

**Definition:** Percentage of AI models that mentioned the brand

**Formula:**
```
SOV = (models_mentioning_brand / total_successful_models) × 100
```

**Example:**
```
Models tested: ChatGPT, Claude, Gemini, Perplexity (4 total)
Results:
  - ChatGPT: Brand mentioned ✓
  - Claude: Brand mentioned ✓
  - Gemini: Brand NOT mentioned ✗
  - Perplexity: Brand mentioned ✓

SOV = (3 / 4) × 100 = 75%
```

**Interpretation:**
| Range | Status | Action |
|-------|--------|--------|
| 70-100% | 🟢 Excellent | Maintain visibility |
| 50-69% | 🟡 Good | Optimize top sources |
| 25-49% | 🟠 Moderate | Create comparative content |
| 0-24% | 🔴 Low | Urgent: Build authoritative content |

**Code:**
```typescript
function calculateSOV(modelResults: ModelResult[]): number {
  const successful = modelResults.filter(r => r.success);
  if (successful.length === 0) return 0;
  
  const mentioned = successful.filter(r => r.brand_mentioned);
  return Math.round((mentioned.length / successful.length) * 100);
}
```

---

## M2. Average Brand Rank

**Definition:** Average position of brand in AI-generated numbered lists

**Formula:**
```
Average Rank = sum(brand_ranks) / count(ranks_found)
```

**Example:**
```
ChatGPT response: Brand is #2
Claude response: Brand is #1
Gemini response: Brand not in list
Perplexity response: Brand is #3

Average Rank = (2 + 1 + 3) / 3 = 2.0
```

**Interpretation:**
- **#1-2:** Premium positioning (Top recommended)
- **#3-5:** Strong visibility (Top 5)
- **#6-10:** Moderate visibility (Mentioned but not top)
- **null:** Not ranked in lists (narrative mention only)

**Code:**
```typescript
function calculateAverageRank(modelResults: ModelResult[]): number | null {
  const ranks = modelResults
    .map(r => r.brand_rank)
    .filter(rank => rank !== null);
  
  if (ranks.length === 0) return null;
  
  const sum = ranks.reduce((a, b) => a + b, 0);
  return Math.round((sum / ranks.length) * 10) / 10; // 1 decimal
}
```

---

## M3. Citation Rate

**Definition:** Percentage of AI responses that cited the brand's website

**Formula:**
```
Citation Rate = (responses_citing_brand_domain / total_responses) × 100
```

**Example:**
```
Total responses: 4
Responses citing yourbrand.com: 2 (ChatGPT, Claude)

Citation Rate = (2 / 4) × 100 = 50%
```

**Code:**
```typescript
function calculateCitationRate(modelResults: ModelResult[], brandDomain: string): number {
  if (modelResults.length === 0) return 0;
  
  const citingBrandDomain = modelResults.filter(r => 
    r.citations.some(c => c.domain.includes(brandDomain))
  );
  
  return Math.round((citingBrandDomain.length / modelResults.length) * 100);
}
```

---

## M4. Competitor Gap

**Definition:** Distribution of brand mentions vs competitors

**Formula:**
```
For each entity (brand + competitors):
  mention_percentage = (entity_mentions / total_mentions) × 100

Gap = competitor_top_percentage - brand_percentage
```

**Example:**
```
Total mentions across all responses: 37
- Competitor A: 15 mentions (40.5%)
- Your Brand: 10 mentions (27.0%)
- Competitor B: 8 mentions (21.6%)
- Competitor C: 4 mentions (10.8%)

Gap vs Leader: 40.5% - 27.0% = 13.5% disadvantage
```

**Code:**
```typescript
function calculateCompetitorGap(
  auditResults: AuditResult[],
  brandName: string,
  competitors: string[]
): Array<{name: string, mentions: number, percentage: number}> {
  const mentionCounts: Record<string, number> = {};
  mentionCounts[brandName] = 0;
  competitors.forEach(c => mentionCounts[c] = 0);
  
  // Count mentions
  for (const result of auditResults) {
    for (const modelResult of result.model_results) {
      const response = modelResult.raw_response.toLowerCase();
      
      if (modelResult.brand_mentioned) {
        mentionCounts[brandName] += modelResult.brand_mention_count;
      }
      
      for (const competitor of competitors) {
        const regex = new RegExp(competitor, 'gi');
        const matches = response.match(regex);
        if (matches) mentionCounts[competitor] += matches.length;
      }
    }
  }
  
  // Calculate percentages
  const total = Object.values(mentionCounts).reduce((a, b) => a + b, 0) || 1;
  
  return Object.entries(mentionCounts)
    .map(([name, count]) => ({
      name,
      mentions: count,
      percentage: Math.round((count / total) * 100)
    }))
    .sort((a, b) => b.mentions - a.mentions);
}
```

---

## M5. Influence Score (Fresh Signals)

**Definition:** Weighted score indicating likelihood of AI indexing

**Formula:**
```
influence_score = (authority × 0.4) + (freshness × 0.3) + (relevance × 0.3)
```

**Component Formulas:**

### M5.1 Freshness Score
```
freshness = max(0, 1 - (days_since_publish / 30))
```

**Example:**
- Published today: `1 - (0/30) = 1.0`
- Published 15 days ago: `1 - (15/30) = 0.5`
- Published 30+ days ago: `0.0`

### M5.2 Authority Score
**Lookup from `domain_authority` table:**
- NYTimes, WSJ, BBC: `0.9-1.0`
- Forbes, TechCrunch: `0.7-0.8`
- Reddit, Quora: `0.3-0.5`
- Unknown domains: `0.5` (default)

### M5.3 Relevance Score
```
keyword_matches = count(brand_keywords) + count(competitor_keywords)
relevance = min(1.0, keyword_matches / 10)
```

**Example:**
- 3 brand mentions + 2 competitor mentions = 5 matches
- `relevance = min(1.0, 5/10) = 0.5`

### Full Calculation Example
```
Signal from TechCrunch:
- Published 5 days ago
- Domain authority: 0.75
- 8 keyword matches

freshness = 1 - (5/30) = 0.83
authority = 0.75
relevance = min(1.0, 8/10) = 0.8

influence = (0.75 × 0.4) + (0.83 × 0.3) + (0.8 × 0.3)
          = 0.3 + 0.249 + 0.24
          = 0.789 → 78.9%
```

**Code:**
```typescript
function calculateInfluenceScore(signal: FreshSignal, domainAuthority: number): number {
  const daysSincePublish = daysSince(signal.published_at);
  
  const freshness = Math.max(0, 1 - (daysSincePublish / 30));
  const authority = domainAuthority || 0.5;
  const keywordMatches = signal.brand_mentions.length + signal.competitor_mentions.length;
  const relevance = Math.min(1.0, keywordMatches / 10);
  
  return (authority * 0.4) + (freshness * 0.3) + (relevance * 0.3);
}
```

---

## M6. API Cost Calculation

**Per Model Costs (DataForSEO):**
- ChatGPT (GPT-4o): `$0.05-0.10` / query
- Claude Sonnet: `$0.05-0.10` / query
- Gemini 2.0: `$0.05-0.10` / query
- Perplexity: `$0.05-0.10` / query
- Google AI Overview: `$0.003` / query
- Google SERP: `$0.002` / query

**Groq Costs:**
- Llama 3.1/3.3: `Free tier` (14,400 requests/day)

**Tavily Costs:**
- Basic search: `$0.005` / query
- Advanced search: `$0.01` / query

**Total Audit Cost Formula:**
```
total_cost = sum(model_costs) + (tavily_enabled ? tavily_cost : 0)
```

**Example:**
```
Audit with ChatGPT + Claude + Gemini + Perplexity + Tavily:
= $0.08 + $0.08 + $0.07 + $0.09 + $0.01
= $0.33 per prompt
```

---

## M7. Visibility Score (Legacy - Not Primary)

**Formula (Weighted):**
```
visibility_score = (SOV × 0.5) + (citation_rate × 0.3) + (rank_factor × 0.2)

where:
  rank_factor = max(0, 100 - (average_rank × 10))
```

**Example:**
```
SOV = 75%
Citation Rate = 50%
Average Rank = 2.0

rank_factor = 100 - (2.0 × 10) = 80

visibility_score = (75 × 0.5) + (50 × 0.3) + (80 × 0.2)
                 = 37.5 + 15 + 16
                 = 68.5
```

**Note:** Current version **prioritizes SOV** as primary metric, visibility_score used for historical data only.

---

## M8. Trust Index (Citation Authority)

**Formula:**
```
trust_index = (high_authority_citations / total_citations) × 100
```

**High Authority Domains:**
- News: NYTimes, WSJ, BBC, Reuters
- Tech: TechCrunch, Wired, Ars Technica
- Reference: Wikipedia, Gov sites (.gov)

**Example:**
```
Total citations: 20
High authority: 8 (Forbes, NYTimes, Wikipedia)

trust_index = (8 / 20) × 100 = 40%
```

---

## Validation & Testing

**Test Cases:**

### SOV
- ✅ All models mention → 100%
- ✅ No models mention → 0%
- ✅ 2 of 4 mention → 50%
- ✅ Failed models excluded from denominator

### Average Rank
- ✅ All ranked → Average of ranks
- ✅ Some not ranked → Average of found ranks
- ✅ None ranked → `null`

### Citation Rate
- ✅ All cite brand domain → 100%
- ✅ None cite → 0%
- ✅ Citation domain matching is case-insensitive

### Influence Score
- ✅ New + High authority + High relevance → ~0.85-1.0
- ✅ Old + Low authority → ~0.2-0.4
- ✅ All components bounded [0, 1]
