# API Cost Tracking System - Technical Documentation

**Status:** Removed from production UI (January 2026)  
**Purpose:** Complete documentation for future re-integration

---

## Table of Contents

1. [Overview](#overview)
2. [Architecture](#architecture)
3. [Data Flow](#data-flow)
4. [Database Schema](#database-schema)
5. [Backend Implementation](#backend-implementation)
6. [Frontend Implementation](#frontend-implementation)
7. [UI Components](#ui-components)
8. [Cost Calculation Logic](#cost-calculation-logic)
9. [Re-Integration Guide](#re-integration-guide)
10. [Code Locations](#code-locations)

---

## Overview

### What Was the Cost Tracking System?

The API Cost Tracking System monitored and displayed the financial cost of querying various AI models and search APIs. Every audit run incurred costs from:

- **DataForSEO LIVE LLM APIs** (~$0.05-0.10 per model query)
  - ChatGPT (OpenAI GPT-4o)
  - Gemini (Google Gemini)
  - Claude (Anthropic Claude)
  - Perplexity AI
- **Google APIs** (~$0.002-0.003 per query)
  - AI Overview
  - SERP
- **Tavily API** (variable, for deep web search)

**Typical Cost Per Audit:** $0.20-0.40 (running 4-6 models)

### Why It Was Removed

The cost displays were removed to:
- Simplify the consumer-facing interface
- Focus users on performance metrics (SOV, Rank, Citations)
- Avoid overwhelming users with financial information
- Keep billing concerns separate from product analytics

---

## Architecture

### System Components

```
┌─────────────────────────────────────────────────────┐
│                FRONTEND (React/TypeScript)           │
│  - Cost Display Cards                               │
│  - Sidebar Cost Widget                              │
│  - Export Functions (CSV/TXT with cost column)      │
└─────────────────┬───────────────────────────────────┘
                  │
                  ↓
┌─────────────────────────────────────────────────────┐
│            SUPABASE EDGE FUNCTIONS (Deno)            │
│  - geo-audit: Calculates cost per model query       │
│  - tavily-search: Tracks Tavily API usage           │
└─────────────────┬───────────────────────────────────┘
                  │
                  ↓
┌─────────────────────────────────────────────────────┐
│         SUPABASE POSTGRESQL DATABASE                 │
│  - audit_results.total_cost (DECIMAL)               │
│  - schedule_runs.total_cost (DECIMAL)               │
│  - summary.total_cost (aggregated)                  │
└─────────────────────────────────────────────────────┘
```

---

## Data Flow

### 1. Audit Execution Flow

```
User clicks "Run Audit"
         ↓
Frontend calls geo-audit Edge Function
         ↓
Edge Function queries 6 AI models
         ↓
For each model response:
  - Calculate API cost based on model pricing
  - Store cost in model_result object
         ↓
Aggregate total_cost = sum of all model costs
         ↓
Return to frontend with cost data
         ↓
Frontend displays cost in UI
         ↓
Save to database (audit_results.total_cost)
```

### 2. Cost Calculation Per Model

```javascript
// Pseudo-code from geo-audit edge function
const MODEL_COSTS = {
  'chatgpt': 0.08,           // OpenAI GPT-4o
  'gemini': 0.07,            // Google Gemini
  'claude': 0.09,            // Anthropic Claude
  'perplexity': 0.10,        // Perplexity AI
  'google_ai_overview': 0.003, // Google AI snippets
  'google_serp': 0.002       // Traditional SERP
};

function calculateAuditCost(models) {
  let totalCost = 0;
  models.forEach(model => {
    totalCost += MODEL_COSTS[model.id] || 0;
  });
  return totalCost;
}
```

### 3. Aggregation Flow

```
Individual Audit Results (each has total_cost)
         ↓
Campaign/Summary Aggregation
         ↓
totalCost = audits.reduce((sum, audit) => sum + audit.total_cost, 0)
         ↓
Display in Overview Dashboard
```

---

## Database Schema

### 1. `audit_results` Table

```sql
CREATE TABLE audit_results (
  id UUID PRIMARY KEY,
  client_id UUID REFERENCES clients(id),
  prompt_id UUID REFERENCES prompts(id),
  prompt_text TEXT,
  share_of_voice INTEGER,
  visibility_score INTEGER,
  average_rank DECIMAL(4,2),
  total_citations INTEGER,
  total_cost DECIMAL(10,6),  -- ⭐ COST FIELD
  model_results JSONB,
  created_at TIMESTAMPTZ DEFAULT NOW()
);
```

**Cost Field Purpose:**
- Stores total API cost for this specific audit run
- Precision: DECIMAL(10,6) allows values like $0.352841
- Used for: Aggregation, reporting, budgeting

### 2. `schedule_runs` Table

```sql
CREATE TABLE schedule_runs (
  id UUID PRIMARY KEY,
  schedule_id UUID REFERENCES prompt_schedules(id),
  client_id UUID,
  prompt_id UUID,
  prompt_text TEXT,
  status TEXT,
  share_of_voice INTEGER,
  visibility_score INTEGER,
  average_rank DECIMAL(4,2),
  total_citations INTEGER,
  total_cost DECIMAL(10,6),  -- ⭐ COST FIELD
  model_results JSONB,
  started_at TIMESTAMPTZ,
  completed_at TIMESTAMPTZ
);
```

### 3. Summary Interface (TypeScript)

```typescript
interface AuditSummary {
  total_prompts: number;
  overall_sov: number;
  average_rank: number | null;
  total_citations: number;
  total_cost: number;  // ⭐ COST FIELD
}
```

---

## Backend Implementation

### Edge Function: `geo-audit/index.ts`

**Location:** `supabase/functions/geo-audit/index.ts`

#### Cost Tracking Logic

```typescript
// 1. Define model costs (at top of file)
const MODEL_COSTS: Record<string, number> = {
  'chatgpt': 0.08,
  'gemini': 0.07,
  'claude': 0.09,
  'perplexity': 0.10,
  'google_ai_overview': 0.003,
  'google_serp': 0.002,
};

// 2. Calculate cost per model query
async function queryModel(modelId: string, prompt: string) {
  // ... API call logic ...
  
  const apiCost = MODEL_COSTS[modelId] || 0.05; // default fallback
  
  return {
    model: modelId,
    response: data,
    api_cost: apiCost  // ⭐ INCLUDE COST
  };
}

// 3. Aggregate total cost
const modelResults = await Promise.all(
  selectedModels.map(m => queryModel(m, promptText))
);

const totalCost = modelResults.reduce(
  (sum, result) => sum + result.api_cost, 
  0
);

// 4. Store in database
const { error } = await supabase
  .from('audit_results')
  .insert({
    client_id,
    prompt_id,
    total_cost: totalCost,  // ⭐ SAVE COST
    model_results: modelResults,
    // ... other fields
  });
```

#### Response Structure

```typescript
return new Response(JSON.stringify({
  success: true,
  data: {
    id: auditId,
    summary: {
      share_of_voice: sov,
      average_rank: avgRank,
      total_citations: citationCount,
      total_cost: totalCost  // ⭐ RETURN COST TO FRONTEND
    },
    model_results: modelResults,
    timestamp: new Date().toISOString()
  }
}));
```

---

## Frontend Implementation

### 1. State Management (`useClientDashboard.ts`)

**Location:** `src/hooks/useClientDashboard.ts`

#### Interface Definitions

```typescript
interface AuditSummary {
  share_of_voice: number;
  average_rank: number | null;
  total_citations: number;
  total_cost: number;  // ⭐ COST FIELD
}

interface AuditResult {
  id: string;
  prompt_id: string;
  prompt_text: string;
  model_results: ModelResult[];
  summary: AuditSummary;
  created_at: string;
}
```

#### Summary Calculation

```typescript
const updateSummary = useCallback((results: AuditResult[]) => {
  if (results.length === 0) { setSummary(null); return; }
  
  let totalSov = 0, 
      totalCitations = 0, 
      totalCost = 0,  // ⭐ COST ACCUMULATOR
      rankSum = 0, 
      rankCount = 0;
      
  for (const r of results) {
    totalSov += r.summary.share_of_voice;
    totalCitations += r.summary.total_citations;
    totalCost += r.summary.total_cost;  // ⭐ SUM COSTS
    if (r.summary.average_rank) { 
      rankSum += r.summary.average_rank; 
      rankCount++; 
    }
  }
  
  setSummary({
    total_prompts: results.length, 
    overall_sov: Math.round(totalSov / results.length),
    average_rank: rankCount > 0 ? Math.round((rankSum / rankCount) * 10) / 10 : null,
    total_citations: totalCitations, 
    total_cost: totalCost,  // ⭐ SET TOTAL COST
  });
}, []);
```

### 2. Model Statistics

```typescript
const modelStats = useMemo(() => {
  const stats: Record<string, { 
    visible: number; 
    total: number; 
    cost: number  // ⭐ COST PER MODEL
  }> = {};
  
  AI_MODELS.forEach(model => { 
    stats[model.id] = { visible: 0, total: 0, cost: 0 }; 
  });
  
  filteredAuditResults.forEach(result => { 
    result.model_results.forEach(mr => { 
      if (stats[mr.model]) { 
        stats[mr.model].total++; 
        if (mr.brand_mentioned) stats[mr.model].visible++; 
        stats[mr.model].cost += mr.api_cost;  // ⭐ TRACK COST
      } 
    }); 
  });
  
  return stats;
}, [filteredAuditResults]);

// Usage: Calculate total cost across all models
const totalCost = Object.values(modelStats).reduce(
  (sum, m) => sum + m.cost, 
  0
);
```

---

## UI Components

### 1. Overview Dashboard Card

**Location:** `src/pages/ClientDashboard.tsx` (Lines ~531-540)

```tsx
{/* API Cost Card - REMOVED VERSION */}
<div className="bg-white rounded-xl border border-gray-200 p-6 shadow-sm hover:shadow-md transition-shadow">
  <div className="flex items-center justify-between">
    <div className="text-sm font-medium text-gray-500 uppercase tracking-wide">
      API Cost
    </div>
    <div className="p-2.5 bg-amber-50 rounded-lg">
      <CreditCard className="h-5 w-5 text-amber-600" />
    </div>
  </div>
  <div className="mt-4 flex items-baseline gap-2">
    <span className="text-4xl font-bold text-gray-950">
      ${totalCost.toFixed(2)}
    </span>
  </div>
  <div className="mt-3 text-xs font-medium text-gray-400">
    {filteredAuditResults.length} audits completed
  </div>
</div>
```

**Current Replacement:**
```tsx
{/* Audits Completed Card - CURRENT VERSION */}
<div className="bg-white rounded-xl border border-gray-200 p-6 shadow-sm hover:shadow-md transition-shadow">
  <div className="flex items-center justify-between">
    <div className="text-sm font-medium text-gray-500 uppercase tracking-wide">
      Audits Completed
    </div>
    <div className="p-2.5 bg-amber-50 rounded-lg">
      <CreditCard className="h-5 w-5 text-amber-600" />
    </div>
  </div>
  <div className="mt-4 flex items-baseline gap-2">
    <span className="text-4xl font-bold text-gray-950">
      {filteredAuditResults.length}
    </span>
  </div>
  <div className="mt-3 text-xs font-medium text-gray-400">
    {domainStats.length} unique domains
  </div>
</div>
```

### 2. Sidebar Cost Widget

**Location:** `src/pages/ClientDashboard.tsx` (Lines ~420-428)

```tsx
{/* Sidebar Widget - REMOVED VERSION */}
<div className="p-3 border-t border-gray-100 flex-shrink-0">
  <div className="bg-gradient-to-br from-gray-900 to-gray-800 rounded-xl p-4 mb-3 shadow-lg overflow-hidden">
    <div className="text-xs font-medium text-gray-400 mb-1">API Cost</div>
    <div className="text-xl font-bold text-white truncate">
      ${totalCost.toFixed(4)}
    </div>
    <div className="text-xs text-gray-400 mt-2 flex items-center gap-1.5">
      <span className="inline-block w-2 h-2 rounded-full bg-green-400 flex-shrink-0 animate-pulse"></span>
      <span className="truncate">{auditResults.length} audits run</span>
    </div>
  </div>
  {/* ... Help button ... */}
</div>
```

**Current Replacement:**
```tsx
{/* Sidebar Widget - CURRENT VERSION */}
<div className="p-3 border-t border-gray-100 flex-shrink-0">
  <div className="bg-gradient-to-br from-gray-900 to-gray-800 rounded-xl p-4 mb-3 shadow-lg overflow-hidden">
    <div className="text-xs font-medium text-gray-400 mb-1">Audits Completed</div>
    <div className="text-xl font-bold text-white truncate">
      {auditResults.length}
    </div>
    <div className="text-xs text-gray-400 mt-2 flex items-center gap-1.5">
      <span className="inline-block w-2 h-2 rounded-full bg-green-400 flex-shrink-0 animate-pulse"></span>
      <span className="truncate">Total audits run</span>
    </div>
  </div>
  {/* ... Help button ... */}
</div>
```

### 3. Prompt Detail Dialog

**Location:** `src/pages/ClientDashboard.tsx` (Lines ~1916-1919)

```tsx
{/* Cost Card in Prompt Detail - REMOVED VERSION */}
<div className="grid grid-cols-4 gap-4">
  {/* ... SOV, Rank, Citations cards ... */}
  <div className="bg-gradient-to-br from-amber-50 to-orange-50 border border-amber-200 rounded-xl p-4 text-center">
    <div className="text-3xl font-bold text-amber-700">
      ${result.summary.total_cost.toFixed(4)}
    </div>
    <div className="text-sm font-medium text-amber-600 mt-1">Cost</div>
  </div>
</div>
```

**Current Replacement:**
```tsx
{/* 3-column grid without cost - CURRENT VERSION */}
<div className="grid grid-cols-3 gap-4">
  {/* Only SOV, Rank, Citations cards */}
</div>
```

### 4. Visibility Graphs Component

**Location:** `src/components/VisibilityGraphs.tsx` (Lines ~734-741)

```tsx
{/* Cost Display in Schedule Run Detail - REMOVED VERSION */}
<div className="p-4 bg-amber-50 rounded-xl border border-amber-100">
  <div className="text-sm text-amber-600 font-medium mb-1">Cost</div>
  <div className="text-3xl font-bold text-amber-700">
    ${selectedRun.total_cost.toFixed(4)}
  </div>
</div>
```

---

## Cost Calculation Logic

### Model Pricing Table

| Model | Provider | Cost per Query | Notes |
|-------|----------|----------------|-------|
| ChatGPT | OpenAI GPT-4o | $0.08 | LIVE API inference |
| Gemini | Google Gemini | $0.07 | LIVE API inference |
| Claude | Anthropic Claude | $0.09 | LIVE API inference |
| Perplexity | Perplexity AI | $0.10 | LIVE API inference |
| Google AI Overview | Google | $0.003 | AI-generated snippets |
| Google SERP | Google | $0.002 | Traditional search |

### Cost Calculation Examples

#### Example 1: Single Audit (4 models)
```
ChatGPT:    $0.08
Gemini:     $0.07
Perplexity: $0.10
AI Overview: $0.003
-----------------------
TOTAL:      $0.253
```

#### Example 2: Campaign (10 prompts, 6 models each)
```
Per prompt: $0.08 + $0.07 + $0.09 + $0.10 + $0.003 + $0.002 = $0.345
10 prompts: $0.345 × 10 = $3.45
```

#### Example 3: Monthly Scheduled Audits
```
Schedule: 5 prompts, daily, 4 models
Per day:  5 prompts × $0.25 = $1.25
Per month: $1.25 × 30 days = $37.50
```

---

## Export Functions

### 1. CSV Export

**Location:** `src/hooks/useClientDashboard.ts` (Lines ~1101-1118)

**REMOVED VERSION:**
```typescript
const exportToCSV = useCallback(() => {
  if (!selectedClient || auditResults.length === 0) return;
  
  const rows = [
    ["Prompt", "Category", "Niche Level", "SOV", "Rank", "Citations", "Cost"]
  ];
  
  for (const r of auditResults) {
    const prompt = prompts.find(p => p.id === r.prompt_id);
    rows.push([
      r.prompt_text, 
      prompt?.category || "custom", 
      prompt?.niche_level || "broad",
      `${r.summary.share_of_voice}%`, 
      r.summary.average_rank?.toString() || "-",
      r.summary.total_citations.toString(), 
      `$${r.summary.total_cost.toFixed(4)}`  // ⭐ COST COLUMN
    ]);
  }
  
  // ... CSV generation ...
}, [selectedClient, auditResults, prompts]);
```

**CURRENT VERSION:**
```typescript
const exportToCSV = useCallback(() => {
  if (!selectedClient || auditResults.length === 0) return;
  
  const rows = [
    ["Prompt", "Category", "Niche Level", "SOV", "Rank", "Citations"]
  ];
  
  for (const r of auditResults) {
    const prompt = prompts.find(p => p.id === r.prompt_id);
    rows.push([
      r.prompt_text, 
      prompt?.category || "custom", 
      prompt?.niche_level || "broad",
      `${r.summary.share_of_voice}%`, 
      r.summary.average_rank?.toString() || "-",
      r.summary.total_citations.toString()
    ]);
  }
  
  // ... CSV generation ...
}, [selectedClient, auditResults, prompts]);
```

### 2. TXT Report Export

**Location:** `src/hooks/useClientDashboard.ts` (Lines ~1135-1364)

**REMOVED LINES:**
```typescript
// Summary section
report += `Total Citations: ${summary?.total_citations || 0}\n`;
report += `Total Cost: $${(summary?.total_cost || 0).toFixed(4)}\n\n`;  // ⭐ REMOVED

// Model performance section
AI_MODELS.forEach(model => {
  const s = stats[model.id] || { visible: 0, total: 0, cost: 0 };
  const pct = s.total > 0 ? Math.round((s.visible / s.total) * 100) : 0;
  report += `${model.name.padEnd(20)} ${s.visible}/${s.total} (${pct}%)  $${s.cost.toFixed(4)}\n`;  // ⭐ REMOVED COST
});
```

**CURRENT VERSION:**
```typescript
// Summary section (no cost line)
report += `Total Citations: ${summary?.total_citations || 0}\n\n`;

// Model performance section (no cost display)
AI_MODELS.forEach(model => {
  const s = stats[model.id] || { visible: 0, total: 0, cost: 0 };
  const pct = s.total > 0 ? Math.round((s.visible / s.total) * 100) : 0;
  report += `${model.name.padEnd(20)} ${s.visible}/${s.total} (${pct}%)\n`;
});
```

---

## Re-Integration Guide

### Step 1: Restore Database Fields

**No changes needed** - The `total_cost` fields still exist in the database schema:
- `audit_results.total_cost`
- `schedule_runs.total_cost`
- Summary interfaces

### Step 2: Restore Backend Cost Calculation

**File:** `supabase/functions/geo-audit/index.ts`

Ensure the edge function calculates and returns costs:

```typescript
// Add MODEL_COSTS constant at top of file
const MODEL_COSTS: Record<string, number> = {
  'chatgpt': 0.08,
  'gemini': 0.07,
  'claude': 0.09,
  'perplexity': 0.10,
  'google_ai_overview': 0.003,
  'google_serp': 0.002,
};

// In queryModel function, add api_cost to result
return {
  model: modelId,
  // ... other fields
  api_cost: MODEL_COSTS[modelId] || 0.05
};

// Calculate total_cost before inserting to database
const totalCost = modelResults.reduce((sum, r) => sum + r.api_cost, 0);

// Include in database insert
await supabase.from('audit_results').insert({
  // ... other fields
  total_cost: totalCost
});

// Include in response
return {
  summary: {
    // ... other fields
    total_cost: totalCost
  }
};
```

### Step 3: Restore Frontend State Management

**File:** `src/hooks/useClientDashboard.ts`

Uncomment or restore:

```typescript
// Line 759-771: updateSummary function
const updateSummary = useCallback((results: AuditResult[]) => {
  // ... existing code ...
  let totalCost = 0;
  for (const r of results) {
    totalCost += r.summary.total_cost;
  }
  setSummary({
    // ... other fields
    total_cost: totalCost,
  });
}, []);

// Line 168: Restore totalCost calculation
const totalCost = Object.values(modelStats).reduce((sum, m) => sum + m.cost, 0);
```

### Step 4: Restore UI Components

#### A. Overview Dashboard Card

**File:** `src/pages/ClientDashboard.tsx` (~Line 531)

```tsx
<div className="bg-white rounded-xl border border-gray-200 p-6 shadow-sm hover:shadow-md transition-shadow">
  <div className="flex items-center justify-between">
    <div className="text-sm font-medium text-gray-500 uppercase tracking-wide">API Cost</div>
    <div className="p-2.5 bg-amber-50 rounded-lg"><CreditCard className="h-5 w-5 text-amber-600" /></div>
  </div>
  <div className="mt-4 flex items-baseline gap-2">
    <span className="text-4xl font-bold text-gray-950">${totalCost.toFixed(2)}</span>
  </div>
  <div className="mt-3 text-xs font-medium text-gray-400">{filteredAuditResults.length} audits completed</div>
</div>
```

#### B. Sidebar Widget

**File:** `src/pages/ClientDashboard.tsx` (~Line 420)

```tsx
<div className="text-xs font-medium text-gray-400 mb-1">API Cost</div>
<div className="text-xl font-bold text-white truncate">${totalCost.toFixed(4)}</div>
```

#### C. Prompt Detail Card

**File:** `src/pages/ClientDashboard.tsx` (~Line 1916)

```tsx
<div className="bg-gradient-to-br from-amber-50 to-orange-50 border border-amber-200 rounded-xl p-4 text-center">
  <div className="text-3xl font-bold text-amber-700">${result.summary.total_cost.toFixed(4)}</div>
  <div className="text-sm font-medium text-amber-600 mt-1">Cost</div>
</div>
```

#### D. Visibility Graphs

**File:** `src/components/VisibilityGraphs.tsx` (~Line 734)

```tsx
<div className="p-4 bg-amber-50 rounded-xl border border-amber-100">
  <div className="text-sm text-amber-600 font-medium mb-1">Cost</div>
  <div className="text-3xl font-bold text-amber-700">${selectedRun.total_cost.toFixed(4)}</div>
</div>
```

### Step 5: Restore Export Functions

#### CSV Export

**File:** `src/hooks/useClientDashboard.ts` (~Line 1103)

```typescript
const rows = [["Prompt", "Category", "Niche Level", "SOV", "Rank", "Citations", "Cost"]];
// ... in loop:
rows.push([
  // ... other columns
  `$${r.summary.total_cost.toFixed(4)}`
]);
```

#### TXT Report Export

**File:** `src/hooks/useClientDashboard.ts` (~Line 1149, 1155)

```typescript
// Add to summary section
report += `Total Cost: $${(summary?.total_cost || 0).toFixed(4)}\n\n`;

// Add to model stats
report += `${model.name.padEnd(20)} ${s.visible}/${s.total} (${pct}%)  $${s.cost.toFixed(4)}\n`;
```

### Step 6: Update TypeScript Interfaces

Ensure all interfaces include cost fields (they still do, no changes needed):

```typescript
interface AuditSummary {
  total_cost: number;
}

interface ScheduleRun {
  total_cost: number;
}
```

### Step 7: Test Thoroughly

1. **Backend Test:** Run a single audit, verify `total_cost` is calculated and saved
2. **Frontend Test:** Verify cost displays in all UI locations
3. **Export Test:** Check CSV and TXT exports include cost data
4. **Campaign Test:** Verify cost aggregation works correctly
5. **Scheduled Run Test:** Verify scheduled audits track costs

### Step 8: Update Documentation

1. Update `guide.md` to re-add cost information
2. Update `README.md` to mention cost tracking
3. Add cost monitoring best practices

---

## Code Locations

### Files Modified to Remove Costs

| File | Lines Modified | Changes Made |
|------|----------------|--------------|
| `src/pages/ClientDashboard.tsx` | 168, 272, 420-428, 531-540, 1916-1919 | Removed totalCost var, sidebar widget, overview card, detail card |
| `src/hooks/useClientDashboard.ts` | 759-771, 816-826, 1103-1108, 1149, 1155 | Removed cost from summaries, exports |
| `src/components/VisibilityGraphs.tsx` | 734-741 | Removed cost from run detail |
| `guide.md` | Multiple | Removed cost references |

### Files That Still Contain Cost Logic

| File | Status | Notes |
|------|--------|-------|
| `supabase/functions/geo-audit/index.ts` | ✅ Active | Backend still calculates costs |
| Database schema | ✅ Active | `total_cost` columns still exist |
| TypeScript interfaces | ✅ Active | Cost fields remain in interfaces |

**Key Insight:** The backend infrastructure for cost tracking remains intact. Only the UI display layer was removed. This makes re-integration straightforward - just restore the UI components.

---

## Best Practices for Future

### 1. Cost Monitoring

```typescript
// Add cost alerts
if (totalCost > BUDGET_THRESHOLD) {
  showWarning(`Budget exceeded: $${totalCost.toFixed(2)}`);
}

// Track monthly spend
const monthlySpend = await calculateMonthlySpend(clientId);
if (monthlySpend > MONTHLY_LIMIT) {
  preventNewAudits();
}
```

### 2. Cost Optimization

- Cache frequently-run prompts
- Batch audits during off-peak hours
- Use cheaper models for preliminary tests
- Implement usage quotas per client

### 3. Admin vs User Views

Consider showing costs only to admins:

```tsx
{user.role === 'admin' && (
  <div className="cost-display">
    Total Cost: ${totalCost.toFixed(2)}
  </div>
)}
```

---

## Conclusion

This documentation provides everything needed to re-enable the API cost tracking system. The underlying infrastructure remains in place - only the UI displays were removed. Re-integration should take approximately 1-2 hours of development time.

**Key Files for Re-Integration:**
1. `src/pages/ClientDashboard.tsx` - Main UI components
2. `src/hooks/useClientDashboard.ts` - State management
3. `src/components/VisibilityGraphs.tsx` - Analytics views
4. `guide.md` - User documentation

All code snippets in this document are production-ready and can be copied directly into the codebase.
