-- Audit snapshot table for run-over-run delta tracking
-- Run in Supabase SQL editor: https://supabase.com/dashboard/project/bvmwnxargzlfheiwyget/sql

CREATE TABLE IF NOT EXISTS audit_snapshots (
  id               uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  client_id        uuid NOT NULL REFERENCES clients(id) ON DELETE CASCADE,
  created_at       timestamptz DEFAULT now(),
  overall_sov      numeric DEFAULT 0,
  avg_rank         numeric,
  total_citations  integer DEFAULT 0,
  citation_rate    numeric DEFAULT 0,
  competitor_sov   jsonb DEFAULT '[]',
  model_visibility jsonb DEFAULT '[]',
  prompt_scores    jsonb DEFAULT '[]'
);

CREATE INDEX IF NOT EXISTS audit_snapshots_client_created
  ON audit_snapshots (client_id, created_at DESC);

ALTER TABLE audit_snapshots ENABLE ROW LEVEL SECURITY;
CREATE POLICY "auth users full access" ON audit_snapshots
  FOR ALL USING (auth.role() = 'authenticated');
