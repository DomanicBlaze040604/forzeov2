-- ============================================================================
-- SETUP: pg_cron job to auto-trigger the scheduler edge function
-- ============================================================================
--
-- The scheduler edge function checks for due schedules (next_run_at <= now())
-- and executes them. This cron job invokes it every 1 minute so schedules
-- run within ~1 minute of their scheduled time.
--
-- PREREQUISITES:
--   1. Enable the pg_cron extension in Supabase Dashboard > Database > Extensions
--   2. Enable the pg_net extension in Supabase Dashboard > Database > Extensions
--
-- HOW TO RUN:
--   Execute this SQL in the Supabase SQL Editor (Dashboard > SQL Editor)
-- ============================================================================

-- 1. Enable required extensions (if not already enabled)
CREATE EXTENSION IF NOT EXISTS pg_cron;
CREATE EXTENSION IF NOT EXISTS pg_net;

-- 2. Remove any existing scheduler cron job (idempotent)
SELECT cron.unschedule('invoke-scheduler')
WHERE EXISTS (
  SELECT 1 FROM cron.job WHERE jobname = 'invoke-scheduler'
);

-- 3. Create the cron job - runs every 1 minute
-- Uses the anon key since the scheduler function has verify_jwt = false
SELECT cron.schedule(
  'invoke-scheduler',
  '* * * * *',
  $$
  SELECT net.http_post(
    url := 'https://bvmwnxargzlfheiwyget.supabase.co/functions/v1/scheduler',
    headers := '{"Content-Type": "application/json", "Authorization": "Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImJ2bXdueGFyZ3psZmhlaXd5Z2V0Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjgwMjY1MjgsImV4cCI6MjA4MzYwMjUyOH0.wicc8Do5vcnwxW57kNHYWJd6qF5rJbjLRHODTtT2ybI"}'::jsonb,
    body := '{"source": "pg_cron", "auto": true}'::jsonb
  ) AS request_id;
  $$
);

-- 4. Verify the job was created
SELECT jobid, jobname, schedule, command
FROM cron.job
WHERE jobname = 'invoke-scheduler';
