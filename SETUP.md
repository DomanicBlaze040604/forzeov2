# Forzeo GEO Dashboard - Setup Guide

Complete setup instructions for deploying the AI Visibility Analytics Platform.

## Table of Contents

1. [Prerequisites](#prerequisites)
2. [Supabase Setup](#supabase-setup)
3. [Backend Deployment](#backend-deployment)
4. [Frontend Setup](#frontend-setup)
5. [Configuration](#configuration)
6. [Troubleshooting](#troubleshooting)
7. [Understanding Metrics](#understanding-metrics)

---

## Prerequisites

### Required Accounts

| Service | Purpose | Cost |
|---------|---------|------|
| **Supabase** | Backend hosting, database | Free tier available |
| **DataForSEO** | AI visibility data | $1 free credit on signup |
| **Groq** | Content generation | Free (14,400 req/day) |

### Development Tools

- **Node.js 18+**: https://nodejs.org
- **npm** or **yarn**: Package manager
- **Supabase CLI**: `npm install -g supabase`

### Sign Up Links

1. **Supabase**: https://supabase.com
2. **DataForSEO**: https://dataforseo.com
3. **Groq**: https://console.groq.com

---

## Supabase Setup

### Step 1: Create Project

1. Go to https://app.supabase.com
2. Click **"New Project"**
3. Fill in:
   - **Name**: `forzeo-dashboard`
   - **Database Password**: (save this securely)
   - **Region**: Choose closest to your users
4. Click **"Create new project"**
5. Wait ~2 minutes for initialization

### Step 2: Get Credentials

From your Supabase dashboard:

1. Go to **Settings** → **API**
2. Copy these values:

```
Project URL: https://xxxxx.supabase.co
anon public key: eyJhbGciOiJIUzI1NiIs...
service_role key: eyJhbGciOiJIUzI1NiIs... (keep secret!)
```

### Step 3: Configure Secrets

1. Go to **Settings** → **Edge Functions**
2. Click **"Manage Secrets"**
3. Add these secrets:

| Name | Value | Description |
|------|-------|-------------|
| `DATAFORSEO_LOGIN` | your-email@example.com | DataForSEO account email |
| `DATAFORSEO_PASSWORD` | your-api-password | DataForSEO API password |
| `GROQ_API_KEY` | gsk_xxxxx | Groq API key (content generation) |
| `SERPER_API_KEY` | xxxxx | (Optional) Serper.dev API key |
| `GEMINI_API_KEY` | AIzaSy... | (Optional) Google Gemini API key |

### Step 4: Initialize Database (Optional)

If you want database persistence:

1. Go to **SQL Editor**
2. Copy contents of `database/schema.sql`
3. Click **"Run"**

---

## Backend Deployment

### Step 1: Install Supabase CLI

```bash
npm install -g supabase
```

### Step 2: Login & Link

```bash
# Login to Supabase
npx supabase login

# Link to your project (find ID in project URL)
npx supabase link --project-ref YOUR_PROJECT_ID
```

### Step 3: Create Functions Directory

```bash
mkdir -p supabase/functions/geo-audit
mkdir -p supabase/functions/generate-content
```

### Step 4: Copy Function Files

```bash
# Copy from this repo
cp backend/geo-audit/index.ts supabase/functions/geo-audit/
cp backend/generate-content/index.ts supabase/functions/generate-content/
```

### Step 5: Deploy Functions

```bash
# Deploy geo-audit (main API)
npx supabase functions deploy geo-audit --no-verify-jwt

# Deploy generate-content (AI content)
npx supabase functions deploy generate-content --no-verify-jwt
```

### Step 6: Verify Deployment

Test the function:

```bash
curl -X POST https://YOUR_PROJECT_ID.supabase.co/functions/v1/geo-audit \
  -H "Content-Type: application/json" \
  -d '{
    "prompt_text": "Best dating apps in India 2025",
    "brand_name": "Juleo",
    "brand_tags": ["Juleo Club"],
    "competitors": ["Bumble", "Tinder"],
    "location_code": 2356,
    "models": ["google_ai_overview"]
  }'
```

Expected response:

```json
{
  "success": true,
  "data": {
    "summary": {
      "share_of_voice": 0,
      "visibility_score": 0,
      ...
    }
  }
}
```

---

## Frontend Setup

### Option A: Add to Existing React Project

#### 1. Install Dependencies

```bash
npm install @supabase/supabase-js lucide-react
npm install @radix-ui/react-dialog @radix-ui/react-dropdown-menu
npm install @radix-ui/react-tabs @radix-ui/react-checkbox
npm install @radix-ui/react-select @radix-ui/react-label
npm install class-variance-authority clsx tailwind-merge
```

#### 2. Configure Supabase Client

Create `src/integrations/supabase/client.ts`:

```typescript
import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = "https://YOUR_PROJECT_ID.supabase.co";
const SUPABASE_ANON_KEY = "your-anon-key";

export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
```

#### 3. Copy Frontend Files

```bash
cp frontend/types.ts src/types/
cp frontend/useClientDashboard.ts src/hooks/
cp frontend/ClientDashboard.tsx src/pages/
```

#### 4. Add Route

```tsx
// In App.tsx or router config
import ClientDashboard from './pages/ClientDashboard';

<Route path="/clients" element={<ClientDashboard />} />
```

### Option B: Create New Project

```bash
# Create Vite project
npm create vite@latest forzeo-dashboard -- --template react-ts
cd forzeo-dashboard

# Install dependencies
npm install
npm install @supabase/supabase-js lucide-react
# ... (rest of dependencies)

# Copy files and configure
```

### Run Development Server

```bash
npm run dev
# Open http://localhost:5173/clients
```

---

## Configuration

### Environment Variables

Create `.env` file:

```env
VITE_SUPABASE_URL=https://your-project.supabase.co
VITE_SUPABASE_ANON_KEY=your-anon-key
```

### Default Clients

The dashboard comes with 4 pre-configured pilot clients:

| Client | Industry | Region | Location Code |
|--------|----------|--------|---------------|
| Juleo Club | Dating/Matrimony | India | 2356 |
| Jagota | Food/Beverage | Thailand | 2764 |
| Post House Dental | Healthcare | Surrey, UK | 2826 |
| Shoptheyn | E-commerce/Fashion | India | 2356 |

### Adding New Clients

1. Click client dropdown in header
2. Select **"Add New Client"**
3. Fill in:
   - **Client Name**: Display name
   - **Brand Name**: Primary brand to detect
   - **Industry**: Auto-fills competitors
   - **Target Region**: Geographic focus

### Location Codes

Common DataForSEO location codes:

| Region | Code | Region | Code |
|--------|------|--------|------|
| India | 2356 | United States | 2840 |
| United Kingdom | 2826 | Thailand | 2764 |
| Singapore | 2702 | Australia | 2036 |
| Canada | 2124 | Germany | 2276 |
| France | 2250 | Japan | 2392 |
| UAE | 2784 | Saudi Arabia | 2682 |

---

## Troubleshooting

### "Function not found" Error

1. Verify function is deployed:
   ```bash
   npx supabase functions list
   ```

2. Check function logs:
   ```bash
   npx supabase functions logs geo-audit
   ```

3. Ensure `--no-verify-jwt` flag was used during deployment

### "DataForSEO Error"

1. Verify credentials in Supabase secrets
2. Check DataForSEO account balance at https://app.dataforseo.com
3. Test API directly:
   ```bash
   curl -X POST "https://api.dataforseo.com/v3/serp/google/organic/live/advanced" \
     -H "Authorization: Basic $(echo -n 'email:password' | base64)" \
     -H "Content-Type: application/json" \
     -d '[{"keyword":"test","location_code":2840}]'
   ```

### "CORS Error"

1. Check browser console for specific error
2. Verify Supabase URL in client config
3. Ensure functions have CORS headers (they do by default)

### "No Results"

1. Check if prompt is too specific
2. Try broader search terms
3. Verify location code is correct
4. Check DataForSEO account has credits

### "Groq API Error"

1. Verify GROQ_API_KEY in Supabase secrets
2. Check Groq dashboard for rate limits
3. API key format: `gsk_xxxxx`

---

## Understanding Metrics

### Share of Voice (SOV)

**What it measures:** Percentage of AI models that mention your brand.

**Formula:** `(Models with brand mention / Total models) × 100`

**Benchmarks:**

| Score | Status | Action |
|-------|--------|--------|
| 70%+ | 🟢 Excellent | Maintain presence |
| 50-69% | 🟡 Good | Minor optimizations |
| 25-49% | 🟠 Moderate | Content strategy needed |
| <25% | 🔴 Low | Urgent intervention |

### Visibility Score

**What it measures:** Weighted score based on mentions, citations, and rankings.

**Components:**
- Cited (domain in sources): 100 points
- Mentioned (name in text): 50 points
- Rank #1: +30 points
- Rank #2: +20 points
- Rank #3: +10 points
- Each mention: +5 points (max 20)

### Trust Index

**What it measures:** Citation authority vs mere mentions.

**Formula:** `(Citation Rate × 0.6) + (Authority Rate × 0.4)`

**Authority Types:**
- **Authority**: Cited + mentioned 3+ times
- **Alternative**: Cited but mentioned <3 times
- **Mentioned**: Named but not cited

### Brand Rank

**What it measures:** Position in AI-generated numbered lists.

**Detection:** Parses patterns like "1. Brand", "2) Brand", "#1 Brand"

**Scoring:**
- Rank #1: Best possible
- Rank #2-3: Strong position
- Rank #4-5: Moderate
- Rank #6+: Needs improvement
- No rank: Mentioned but not in list

### Sentiment

**What it measures:** Tone of content around brand mentions.

**Analysis:** 100 characters before and after each mention.

**Keywords:**
- **Positive**: best, top, excellent, recommended, trusted, etc.
- **Negative**: avoid, poor, worst, scam, unreliable, etc.

### Cost Tracking

**Per-query costs:**

| Model | Cost |
|-------|------|
| ChatGPT (LLM Mentions) | $0.02 |
| Claude (LLM Mentions) | $0.02 |
| Gemini (LLM Mentions) | $0.02 |
| Perplexity (LLM Mentions) | $0.02 |
| Google AI Overview | $0.003 |
| Google SERP | $0.002 |

**Typical audit:** 10 prompts × 4 models = ~$0.80

---

## Production Deployment

### Frontend (Netlify/Vercel)

```bash
npm run build
# Deploy dist/ folder
```

### Environment Variables

Set in hosting platform:
- `VITE_SUPABASE_URL`
- `VITE_SUPABASE_ANON_KEY`

### Custom Domain

1. Add domain in Supabase dashboard
2. Configure DNS records
3. Update CORS if needed

---

## Next Steps

After setup:

1. **Add your brand** as a new client
2. **Configure competitors** in settings
3. **Add prompts** (use AI generator for ideas)
4. **Run audit** to see visibility
5. **Analyze results** and optimize content

For technical details, see [ARCHITECTURE.md](./ARCHITECTURE.md).

---

## Support

- 📧 Email: support@forzeo.com
- 📖 Docs: https://docs.forzeo.com
- 🐛 Issues: https://github.com/forzeo/geo-dashboard/issues
