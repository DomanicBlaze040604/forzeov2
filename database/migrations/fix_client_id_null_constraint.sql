-- ============================================================================
-- FIX: Allow client_id to be NULL for multi-account schedules
-- ============================================================================
-- Issue: prompt_schedules.client_id has NOT NULL constraint
-- Fix: Make client_id nullable to allow multi-account schedules
-- ============================================================================

-- Remove NOT NULL constraint from client_id column
ALTER TABLE prompt_schedules
ALTER COLUMN client_id DROP NOT NULL;

-- Verify the check constraint exists (should already be there from previous migration)
-- This constraint ensures either client_id OR client_ids is provided, but not both
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'check_client_selection'
  ) THEN
    ALTER TABLE prompt_schedules
    ADD CONSTRAINT check_client_selection
    CHECK (
      (client_id IS NOT NULL AND client_ids IS NULL) OR
      (client_id IS NULL AND client_ids IS NOT NULL AND array_length(client_ids, 1) > 0)
    );

    RAISE NOTICE 'Added check_client_selection constraint';
  ELSE
    RAISE NOTICE 'check_client_selection constraint already exists';
  END IF;
END $$;

-- Verification query (comment out after running)
-- SELECT
--   column_name,
--   is_nullable,
--   data_type
-- FROM information_schema.columns
-- WHERE table_name = 'prompt_schedules'
--   AND column_name IN ('client_id', 'client_ids');
