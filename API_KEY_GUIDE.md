# API Key Acquisition Guide - Quick Start

## 🎯 Priority Order (Easiest → Hardest)

### 1. xAI (Grok) - START HERE ⭐
**Why first:** Cheapest ($0.003/query), easiest setup, 96% cost savings

**Steps:**
1. Go to https://console.x.ai
2. Sign in (use X/Twitter account or email)
3. Click "API Keys" in left sidebar
4. Click "Create API Key"
5. Copy the key (starts with `xai-`)
6. **Save immediately** (can't view again!)

**Cost:** FREE tier available, then pay-as-you-go

---

### 2. Google AI (Gemini) - NEARLY FREE ⭐
**Why second:** Almost free ($0.001/query), simple setup

**Steps:**
1. Go to https://aistudio.google.com
2. Sign in with Google account
3. Click "Get API key" button
4. Create new project or select existing
5. Copy the key (starts with `AIza`)

**Cost:** Generous free tier (1500 requests/day)

---

### 3. Anthropic (Claude)
**Why third:** Great quality, reasonable price ($0.020/query)

**Steps:**
1. Go to https://console.anthropic.com
2. Sign up with email
3. Verify email
4. Navigate to "API Keys"
5. Click "Create Key"
6. Copy the key (starts with `sk-ant-`)

**Cost:** $5 free credit, then pay-as-you-go

---

### 4. Perplexity
**Why fourth:** Good for search-augmented responses

**Steps:**
1. Go to https://perplexity.ai/settings/api
2. Sign up / Log in
3. Navigate to API section
4. Generate API key
5. Copy the key (starts with `pplx-`)

**Cost:** Pay-as-you-go ($1-3 per 1M tokens)

---

## Adding to Supabase

### Option A: Supabase Dashboard (Easiest)

1. Go to your Supabase project
2. Click **Settings** (left sidebar)
3. Click **Edge Functions**
4. Scroll to **Secrets**
5. Click **Add Secret**
6. Enter:
   - **Name:** `XAI_API_KEY`
   - **Value:** `xai-abc123...`
7. Click **Save**
8. Repeat for each key

### Option B: Supabase CLI

```bash
# Install Supabase CLI if needed
npm install -g supabase

# Link to your project
supabase link --project-ref your-project-ref

# Add secrets
supabase secrets set XAI_API_KEY=xai-abc123...
supabase secrets set GEMINI_API_KEY=AIzaABC123...
supabase secrets set ANTHROPIC_API_KEY=sk-ant-abc123...
supabase secrets set PERPLEXITY_API_KEY=pplx-abc123...
supabase secrets set OPENAI_API_KEY=sk-proj-8jYZKjidV...

# Verify
supabase secrets list
```

---

## Quick Test Script

Once keys are added, test them:

```typescript
// Test in Supabase SQL Editor or Edge Function
const XAI_KEY = Deno.env.get("XAI_API_KEY");
const GEMINI_KEY = Deno.env.get("GEMINI_API_KEY");

console.log("XAI:", XAI_KEY ? "✓ Set" : "✗ Missing");
console.log("Gemini:", GEMINI_KEY ? "✓ Set" : "✗ Missing");
```

---

## Cost Monitoring

Set up billing alerts:

### xAI
- Go to console.x.ai → Billing
- Set alert at $50

### Google AI
- Cloud Console → Billing → Budgets
- Set alert at $25

### Anthropic
- console.anthropic.com → Usage
- Monitor daily

### OpenAI
- platform.openai.com → Usage
- Set monthly limit: $100

---

## Troubleshooting

**"Invalid API key"**
- Check for extra spaces
- Ensure key starts with correct prefix
- Regenerate if needed

**"Rate limit exceeded"**
- Wait and retry
- Check if you're on free tier
- Upgrade if needed

**"Insufficient quota"**
- Add payment method
- Check billing dashboard
- Request quota increase

---

## Next Steps After Keys Are Ready

1. ✅ All keys added to Supabase
2. ✅ Test connectivity
3. → Start implementing Grok (cheapest/easiest)
4. → Test with real query
5. → Expand to other providers

**Estimated time:** 30-45 minutes total
