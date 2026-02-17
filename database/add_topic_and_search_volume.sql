-- Add topic and search volume columns to prompts table
-- Run this migration in Supabase SQL editor

-- Topic: groups prompts by seed keyword / category
ALTER TABLE prompts ADD COLUMN IF NOT EXISTS topic TEXT DEFAULT NULL;

-- Estimated AI Search Volume from DataForSEO
ALTER TABLE prompts ADD COLUMN IF NOT EXISTS estimated_search_volume INTEGER DEFAULT NULL;
ALTER TABLE prompts ADD COLUMN IF NOT EXISTS search_volume_updated_at TIMESTAMPTZ DEFAULT NULL;

-- Index for topic-based grouping queries
CREATE INDEX IF NOT EXISTS idx_prompts_topic ON prompts(client_id, topic) WHERE topic IS NOT NULL;
