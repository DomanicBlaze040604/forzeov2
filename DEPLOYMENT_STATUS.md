# Forzeo Platform - Deployment Status

**Last Updated:** February 20, 2026

---

## Edge Functions Deployment Status

### ✅ Deployed Functions

| Function | Status | Purpose |
|----------|--------|---------|
| `geo-audit` | ✅ Deployed | Core audit engine — live LLM inference via DataForSEO |
| `categorize-citations` | ✅ Deployed | AI categorization using Gemini 2.0 Flash + post-processing |
| `verify-citations` | ✅ Deployed | Semantic similarity verification via Jina + Groq |
| `citation-analyzer` | ✅ Deployed | Deep analysis of citation sources |
| `tavily-search` | ✅ Deployed | Discovery engine for deep web analysis |
| `scheduler` | ✅ Deployed | Cron-triggered scheduler with multi-account delegation |
| `multi-account-runner` | ✅ Deployed | Multi-brand audit orchestration |
| `notify-schedule-execution` | ✅ Deployed | Email notifications on schedule completion |
| `notify-admin-signup` | ✅ Deployed | New user signup notifications |
| `signal-scorer` | ✅ Deployed | Signal detection and scoring |
| `rss-ingestor` | ✅ Deployed | RSS feed ingestion for signals |
| `ai-search-volume` | ✅ Deployed | AI-powered search volume estimation |

### Deployment Commands
```bash
# Deploy individual function
npx supabase functions deploy <function-name>

# Deploy all functions
npx supabase functions deploy

# Check logs
npx supabase functions logs <function-name> --tail
```

---

## Database Migration Status

### ✅ Applied Migrations

| Migration | Description | Status |
|-----------|-------------|--------|
| `add_citation_tiered_categorization.sql` | Adds `relationship_type`, `source_type`, `authority_tier`, `is_affiliate` columns | ✅ Applied |
| `add_citation_verification.sql` | Adds verification columns (`verification_status`, `similarity_score`, `matched_paragraph`, `page_content`, etc.) and intent/trust tags | ✅ Applied |
| `add_notifications_table.sql` | Creates `notifications` table with RLS for admin users | ✅ Applied |
| `fix_client_id_null_constraint.sql` | Makes `prompt_schedules.client_id` nullable for multi-account schedules | ✅ Applied |
| `multi_account_scheduler.sql` | Creates multi-account scheduler tables (`account_groups`, `execution_locks`, `schedule_analytics`, `conditional_execution_rules`) | ✅ Applied |

---

## Environment Variables Required

| Variable | Service | Purpose |
|----------|---------|---------|
| `SUPABASE_URL` | Supabase | Database and auth |
| `SUPABASE_SERVICE_ROLE_KEY` | Supabase | Server-side operations |
| `OPENROUTER_API_KEY` | OpenRouter | Citation categorization (Gemini 2.0 Flash) |
| `GROQ_API_KEY` | Groq | Citation verification (Llama 3.1) |
| `DATAFORSEO_LOGIN` | DataForSEO | Geo-audit API credentials |
| `DATAFORSEO_PASSWORD` | DataForSEO | Geo-audit API credentials |
| `TAVILY_API_KEY` | Tavily | Discovery engine deep analysis |
| `RESEND_API_KEY` | Resend | Email notifications |

---

## Frontend Status

### Build
- **Framework**: Vite + React + TypeScript
- **Dev Server**: `npm run dev` on port 5175
- **Production Build**: `npm run build`

### Key Components
| Component | Location | Purpose |
|-----------|----------|---------|
| `ClientDashboard.tsx` | `src/pages/` | Main dashboard with all tabs |
| `useClientDashboard.ts` | `src/hooks/` | Core hook — audits, categorization, verification |
| `MultiAccountScheduler.tsx` | `src/components/` | Bulk scheduler wizard (admin-only) |
| `ScheduleManager.tsx` | `src/components/` | Schedule management and monitoring |
| `CitationPreview.tsx` | `src/components/` | Hover preview for citations |
| `SignalsDashboard.tsx` | `src/components/` | Signal detection UI |

---

## Support

If you encounter issues:
1. Check edge function logs: `npx supabase functions logs <name> --tail`
2. Verify database migrations completed
3. Check browser console for frontend errors
4. Contact: ammar@forzeo.com, sachinjain@forzeo.com
