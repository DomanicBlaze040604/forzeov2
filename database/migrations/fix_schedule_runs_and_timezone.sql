-- ============================================================================
-- FIX: schedule_runs table for multi-account support + timezone column
-- ============================================================================
-- Issues:
--   1. schedule_runs.client_id is NOT NULL but multi-account runs don't have a single client_id
--   2. schedule_runs.prompt_text is NOT NULL but multi-account runs don't have a single prompt
--   3. Missing columns needed by multi-account-runner (client_ids, total_brands, etc.)
-- ============================================================================

-- 1. Make client_id nullable for multi-account runs
ALTER TABLE schedule_runs ALTER COLUMN client_id DROP NOT NULL;

-- 2. Make prompt_text nullable for multi-account runs
ALTER TABLE schedule_runs ALTER COLUMN prompt_text DROP NOT NULL;

-- 3. Add multi-account columns if they don't exist
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'schedule_runs' AND column_name = 'client_ids') THEN
    ALTER TABLE schedule_runs ADD COLUMN client_ids UUID[];
  END IF;

  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'schedule_runs' AND column_name = 'total_brands') THEN
    ALTER TABLE schedule_runs ADD COLUMN total_brands INTEGER;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'schedule_runs' AND column_name = 'completed_brands') THEN
    ALTER TABLE schedule_runs ADD COLUMN completed_brands INTEGER DEFAULT 0;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'schedule_runs' AND column_name = 'failed_brands') THEN
    ALTER TABLE schedule_runs ADD COLUMN failed_brands INTEGER DEFAULT 0;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'schedule_runs' AND column_name = 'total_prompts') THEN
    ALTER TABLE schedule_runs ADD COLUMN total_prompts INTEGER;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'schedule_runs' AND column_name = 'prompts_completed') THEN
    ALTER TABLE schedule_runs ADD COLUMN prompts_completed INTEGER DEFAULT 0;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'schedule_runs' AND column_name = 'current_brand_id') THEN
    ALTER TABLE schedule_runs ADD COLUMN current_brand_id UUID;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'schedule_runs' AND column_name = 'current_prompt_id') THEN
    ALTER TABLE schedule_runs ADD COLUMN current_prompt_id UUID;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'schedule_runs' AND column_name = 'execution_progress') THEN
    ALTER TABLE schedule_runs ADD COLUMN execution_progress JSONB;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'schedule_runs' AND column_name = 'metadata') THEN
    ALTER TABLE schedule_runs ADD COLUMN metadata JSONB;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'schedule_runs' AND column_name = 'notification_sent_at') THEN
    ALTER TABLE schedule_runs ADD COLUMN notification_sent_at TIMESTAMPTZ;
  END IF;
END $$;

-- 4. Add multi-account columns to prompt_schedules if they don't exist
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'prompt_schedules' AND column_name = 'client_ids') THEN
    ALTER TABLE prompt_schedules ADD COLUMN client_ids UUID[];
  END IF;

  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'prompt_schedules' AND column_name = 'prompt_selection_type') THEN
    ALTER TABLE prompt_schedules ADD COLUMN prompt_selection_type TEXT;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'prompt_schedules' AND column_name = 'selected_categories') THEN
    ALTER TABLE prompt_schedules ADD COLUMN selected_categories TEXT[];
  END IF;

  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'prompt_schedules' AND column_name = 'selected_prompt_ids') THEN
    ALTER TABLE prompt_schedules ADD COLUMN selected_prompt_ids UUID[];
  END IF;

  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'prompt_schedules' AND column_name = 'concurrency_limit') THEN
    ALTER TABLE prompt_schedules ADD COLUMN concurrency_limit INTEGER DEFAULT 3;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'prompt_schedules' AND column_name = 'notify_on_completion') THEN
    ALTER TABLE prompt_schedules ADD COLUMN notify_on_completion BOOLEAN DEFAULT true;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'prompt_schedules' AND column_name = 'conditional_rules') THEN
    ALTER TABLE prompt_schedules ADD COLUMN conditional_rules JSONB;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'prompt_schedules' AND column_name = 'recurrence_type') THEN
    ALTER TABLE prompt_schedules ADD COLUMN recurrence_type TEXT;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'prompt_schedules' AND column_name = 'recurrence_days_of_week') THEN
    ALTER TABLE prompt_schedules ADD COLUMN recurrence_days_of_week INTEGER[];
  END IF;

  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'prompt_schedules' AND column_name = 'recurrence_day_of_month') THEN
    ALTER TABLE prompt_schedules ADD COLUMN recurrence_day_of_month INTEGER;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'prompt_schedules' AND column_name = 'timezone') THEN
    ALTER TABLE prompt_schedules ADD COLUMN timezone TEXT;
  END IF;
END $$;

-- 5. Make prompt_schedules.client_id nullable (from URGENT_FIX.sql)
ALTER TABLE prompt_schedules ALTER COLUMN client_id DROP NOT NULL;

-- 6. Add/update check constraint for client selection
DO $$
BEGIN
  -- Drop existing constraint if it exists (to recreate with correct definition)
  IF EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'check_client_selection') THEN
    ALTER TABLE prompt_schedules DROP CONSTRAINT check_client_selection;
  END IF;

  ALTER TABLE prompt_schedules
  ADD CONSTRAINT check_client_selection
  CHECK (
    (client_id IS NOT NULL AND client_ids IS NULL) OR
    (client_id IS NULL AND client_ids IS NOT NULL AND array_length(client_ids, 1) > 0)
  );
END $$;

-- 7. Create schedule_analytics table if not exists
CREATE TABLE IF NOT EXISTS schedule_analytics (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  schedule_id UUID NOT NULL REFERENCES prompt_schedules(id) ON DELETE CASCADE,
  date DATE NOT NULL,
  total_runs INTEGER DEFAULT 0,
  successful_runs INTEGER DEFAULT 0,
  failed_runs INTEGER DEFAULT 0,
  avg_execution_time_seconds INTEGER,
  total_prompts_executed INTEGER DEFAULT 0,
  total_cost DECIMAL(10,6) DEFAULT 0,
  avg_sov DECIMAL(5,1),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(schedule_id, date)
);

-- 8. Create execution_locks table if not exists
CREATE TABLE IF NOT EXISTS execution_locks (
  schedule_id UUID PRIMARY KEY REFERENCES prompt_schedules(id) ON DELETE CASCADE,
  locked_by TEXT NOT NULL,
  expires_at TIMESTAMPTZ NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Verification
SELECT
  column_name,
  is_nullable,
  data_type
FROM information_schema.columns
WHERE table_name = 'schedule_runs'
  AND column_name IN ('client_id', 'client_ids', 'prompt_text', 'total_brands', 'metadata', 'notification_sent_at');
