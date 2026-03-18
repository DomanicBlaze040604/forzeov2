-- Forzeo Launchpad: Pre-Audit Checklist
-- Tracks completion state for post-onboarding technical setup tasks

CREATE TABLE IF NOT EXISTS onboarding_checklists (
    id          uuid DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id     uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    task_key    text NOT NULL CHECK (task_key IN ('schema_done', 'robots_done', 'llms_done', 'ga4_done', 'call_booked')),
    is_completed boolean NOT NULL DEFAULT false,
    updated_at  timestamptz NOT NULL DEFAULT now(),

    UNIQUE (user_id, task_key)
);

-- Index for fast per-user lookups
CREATE INDEX IF NOT EXISTS idx_onboarding_checklists_user_id
    ON onboarding_checklists (user_id);

-- Row-Level Security: users can only see and modify their own rows
ALTER TABLE onboarding_checklists ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own checklist"
    ON onboarding_checklists FOR SELECT
    USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own checklist rows"
    ON onboarding_checklists FOR INSERT
    WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own checklist rows"
    ON onboarding_checklists FOR UPDATE
    USING (auth.uid() = user_id);

-- Admins can view all checklists
CREATE POLICY "Admins can view all checklists"
    ON onboarding_checklists FOR SELECT
    USING (
        EXISTS (
            SELECT 1 FROM profiles
            WHERE profiles.id = auth.uid()
            AND profiles.role = 'admin'
        )
    );
