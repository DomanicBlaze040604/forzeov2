-- ============================================================================
-- SETUP: pg_cron job to auto-verify citations via verify-citations edge function
-- ============================================================================
--
-- Calls verify-citations in batch mode every 5 minutes.
-- The edge function picks up to 20 pending/stale citations and verifies them
-- using Jina Reader (content fetch) + Groq LLM (semantic similarity).
--
-- Throughput: ~240 citations/hour (20 per run × 12 runs/hour)
-- A 1000-citation backlog clears in ~4 hours.
--
-- Citations are re-verified after 7 days (stale re-check).
--
-- PREREQUISITES:
--   1. Enable the pg_cron extension in Supabase Dashboard > Database > Extensions
--   2. Enable the pg_net extension in Supabase Dashboard > Database > Extensions
--   (Both should already be enabled from setup_scheduler_cron.sql)
--
-- HOW TO RUN:
--   Execute this SQL in the Supabase SQL Editor (Dashboard > SQL Editor)
-- ============================================================================

-- 1. Ensure required extensions are enabled
CREATE EXTENSION IF NOT EXISTS pg_cron;
CREATE EXTENSION IF NOT EXISTS pg_net;

-- 2. Remove any existing verification cron job (idempotent)
SELECT cron.unschedule('invoke-verify-citations')
WHERE EXISTS (
  SELECT 1 FROM cron.job WHERE jobname = 'invoke-verify-citations'
);

-- 3. Create the cron job - runs every 5 minutes
-- Uses the anon key since verify-citations has verify_jwt = false
SELECT cron.schedule(
  'invoke-verify-citations',
  '*/5 * * * *',
  $$
  SELECT net.http_post(
    url := 'https://bvmwnxargzlfheiwyget.supabase.co/functions/v1/verify-citations',
    headers := '{"Content-Type": "application/json", "Authorization": "Bearer YOUR_SUPABASE_ANON_KEY"}'::jsonb,
    body := '{"mode": "batch", "limit": 20, "source": "pg_cron"}'::jsonb
  ) AS request_id;
  $$
);

-- 4. Verify the job was created
SELECT jobid, jobname, schedule, command
FROM cron.job
WHERE jobname = 'invoke-verify-citations';
