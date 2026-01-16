-- ==============================================
-- Add location_code column to prompts table
-- ==============================================
-- Run this in Supabase SQL Editor

-- Add location columns to prompts table
ALTER TABLE prompts ADD COLUMN IF NOT EXISTS location_code INT;
ALTER TABLE prompts ADD COLUMN IF NOT EXISTS location_name TEXT;

-- Create index for faster location-based queries
CREATE INDEX IF NOT EXISTS idx_prompts_location ON prompts(location_code);

-- Verify the columns were added
SELECT column_name, data_type 
FROM information_schema.columns 
WHERE table_name = 'prompts' 
AND column_name IN ('location_code', 'location_name');

SELECT 'Prompt location columns added successfully!' as status;
