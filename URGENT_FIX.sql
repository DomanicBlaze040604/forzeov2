-- ============================================================================
-- URGENT FIX: Allow client_id to be NULL
-- ============================================================================
-- Run this in Supabase SQL Editor RIGHT NOW
-- ============================================================================

ALTER TABLE prompt_schedules ALTER COLUMN client_id DROP NOT NULL;

-- Verify the fix
SELECT
  column_name,
  is_nullable,
  data_type
FROM information_schema.columns
WHERE table_name = 'prompt_schedules'
  AND column_name IN ('client_id', 'client_ids');

-- You should see:
-- client_id   | YES | uuid
-- client_ids  | YES | ARRAY
