-- Campaign Schema for "One Massive" View
-- Groups multiple audit_results into a single logical "Campaign"

CREATE TABLE IF NOT EXISTS campaigns (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    client_id UUID NOT NULL REFERENCES clients(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    status TEXT DEFAULT 'running', -- running, completed, error
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    total_prompts INT DEFAULT 0,
    completed_prompts INT DEFAULT 0,
    -- Aggregated Stats (updated via trigger or edge function)
    avg_sov NUMERIC,
    avg_rank NUMERIC,
    total_citations INT
);

-- Add campaign_id to audit_results (for linking runs to campaigns)
ALTER TABLE audit_results 
ADD COLUMN IF NOT EXISTS campaign_id UUID REFERENCES campaigns(id) ON DELETE SET NULL;

-- RLS Policies
ALTER TABLE campaigns ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own campaigns"
    ON campaigns FOR SELECT
    USING (
        client_id IN (
            SELECT c.id FROM clients c
            JOIN organization_members om ON c.organization_id = om.organization_id
            WHERE om.user_id = auth.uid() AND c.deleted_at IS NULL
        )
    );

CREATE POLICY "Users can insert their own campaigns"
    ON campaigns FOR INSERT
    WITH CHECK (
        client_id IN (
            SELECT c.id FROM clients c
            JOIN organization_members om ON c.organization_id = om.organization_id
            WHERE om.user_id = auth.uid() AND c.deleted_at IS NULL
        )
    );

CREATE POLICY "Users can update their own campaigns"
    ON campaigns FOR UPDATE
    USING (
        client_id IN (
            SELECT c.id FROM clients c
            JOIN organization_members om ON c.organization_id = om.organization_id
            WHERE om.user_id = auth.uid() AND c.deleted_at IS NULL
        )
    );

CREATE POLICY "Users can delete their own campaigns"
    ON campaigns FOR DELETE
    USING (
        client_id IN (
            SELECT c.id FROM clients c
            JOIN organization_members om ON c.organization_id = om.organization_id
            WHERE om.user_id = auth.uid() AND c.deleted_at IS NULL
        )
    );

-- Indexes
CREATE INDEX IF NOT EXISTS idx_campaigns_client_id ON campaigns(client_id);
CREATE INDEX IF NOT EXISTS idx_audit_results_campaign_id ON audit_results(campaign_id);
