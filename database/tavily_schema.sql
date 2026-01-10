-- ============================================
-- Tavily Integration & Scheduling Schema
-- ============================================
-- Run this in Supabase SQL Editor
-- ============================================

-- ============================================
-- TAVILY RESULTS TABLE
-- ============================================
-- Stores Tavily search results for AI visibility analysis

CREATE TABLE IF NOT EXISTS tavily_results (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  client_id UUID REFERENCES clients(id) ON DELETE CASCADE,
  prompt_id UUID REFERENCES prompts(id) ON DELETE SET NULL,
  prompt_text TEXT NOT NULL,
  
  -- Tavily response data
  query TEXT NOT NULL,
  answer TEXT,
  sources JSONB DEFAULT '[]'::jsonb,
  raw_content JSONB,
  
  -- Analysis metadata
  search_depth TEXT DEFAULT 'advanced',
  max_results INTEGER DEFAULT 20,
  
  -- Timestamps
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes for tavily_results
CREATE INDEX IF NOT EXISTS idx_tavily_client ON tavily_results(client_id);
CREATE INDEX IF NOT EXISTS idx_tavily_prompt ON tavily_results(prompt_id);
CREATE INDEX IF NOT EXISTS idx_tavily_created ON tavily_results(created_at DESC);

-- ============================================
-- PROMPT SCHEDULES TABLE
-- ============================================
-- Configuration for auto-running prompts

CREATE TABLE IF NOT EXISTS prompt_schedules (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  client_id UUID NOT NULL REFERENCES clients(id) ON DELETE CASCADE,
  prompt_id UUID REFERENCES prompts(id) ON DELETE CASCADE,
  
  -- Schedule config
  name TEXT NOT NULL,
  interval_value INTEGER NOT NULL CHECK (interval_value > 0),
  interval_unit TEXT NOT NULL CHECK (interval_unit IN ('seconds', 'minutes', 'hours', 'days')),
  
  -- Options
  is_active BOOLEAN DEFAULT true,
  include_tavily BOOLEAN DEFAULT true,
  models TEXT[] DEFAULT ARRAY['chatgpt', 'google_ai_overview'],
  
  -- Tracking
  last_run_at TIMESTAMPTZ,
  next_run_at TIMESTAMPTZ,
  total_runs INTEGER DEFAULT 0,
  
  -- Timestamps
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes for prompt_schedules
CREATE INDEX IF NOT EXISTS idx_schedules_client ON prompt_schedules(client_id) WHERE is_active = true;
CREATE INDEX IF NOT EXISTS idx_schedules_next_run ON prompt_schedules(next_run_at) WHERE is_active = true;
CREATE INDEX IF NOT EXISTS idx_schedules_prompt ON prompt_schedules(prompt_id);

-- ============================================
-- SCHEDULE RUNS TABLE
-- ============================================
-- Historical tracking of each scheduled run

CREATE TABLE IF NOT EXISTS schedule_runs (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  schedule_id UUID NOT NULL REFERENCES prompt_schedules(id) ON DELETE CASCADE,
  client_id UUID NOT NULL REFERENCES clients(id) ON DELETE CASCADE,
  prompt_id UUID REFERENCES prompts(id) ON DELETE SET NULL,
  prompt_text TEXT NOT NULL,
  
  -- Run status
  status TEXT NOT NULL DEFAULT 'running' CHECK (status IN ('running', 'completed', 'failed')),
  
  -- Visibility metrics snapshot
  share_of_voice INTEGER DEFAULT 0 CHECK (share_of_voice >= 0 AND share_of_voice <= 100),
  visibility_score INTEGER DEFAULT 0 CHECK (visibility_score >= 0 AND visibility_score <= 100),
  average_rank DECIMAL(4,2),
  total_citations INTEGER DEFAULT 0,
  total_cost DECIMAL(10,6) DEFAULT 0,
  
  -- Full results
  model_results JSONB DEFAULT '[]'::jsonb,
  tavily_results JSONB,
  sources JSONB DEFAULT '[]'::jsonb,
  
  -- Error tracking
  error_message TEXT,
  
  -- Timestamps
  started_at TIMESTAMPTZ DEFAULT NOW(),
  completed_at TIMESTAMPTZ
);

-- Indexes for schedule_runs
CREATE INDEX IF NOT EXISTS idx_runs_schedule ON schedule_runs(schedule_id);
CREATE INDEX IF NOT EXISTS idx_runs_client ON schedule_runs(client_id);
CREATE INDEX IF NOT EXISTS idx_runs_started ON schedule_runs(started_at DESC);
CREATE INDEX IF NOT EXISTS idx_runs_status ON schedule_runs(status);

-- ============================================
-- VISIBILITY HISTORY VIEW
-- ============================================
-- Aggregated view for visibility graphs

CREATE OR REPLACE VIEW visibility_history AS
SELECT 
  sr.client_id,
  date_trunc('hour', sr.started_at) AS period,
  AVG(sr.share_of_voice)::INTEGER AS avg_sov,
  AVG(sr.visibility_score)::INTEGER AS avg_visibility,
  AVG(sr.average_rank)::DECIMAL(4,2) AS avg_rank,
  SUM(sr.total_citations)::INTEGER AS total_citations,
  SUM(sr.total_cost) AS total_cost,
  COUNT(*)::INTEGER AS run_count,
  MAX(sr.started_at) AS last_run
FROM schedule_runs sr
WHERE sr.status = 'completed'
GROUP BY sr.client_id, date_trunc('hour', sr.started_at)
ORDER BY period DESC;

-- ============================================
-- TRIGGER: Update updated_at on schedules
-- ============================================

CREATE TRIGGER update_prompt_schedules_updated_at
  BEFORE UPDATE ON prompt_schedules
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- ============================================
-- RLS POLICIES
-- ============================================

ALTER TABLE tavily_results ENABLE ROW LEVEL SECURITY;
ALTER TABLE prompt_schedules ENABLE ROW LEVEL SECURITY;
ALTER TABLE schedule_runs ENABLE ROW LEVEL SECURITY;

-- Tavily results access
CREATE POLICY tavily_results_access ON tavily_results
  FOR ALL USING (
    client_id IN (
      SELECT c.id FROM clients c
      JOIN organization_members om ON c.organization_id = om.organization_id
      WHERE om.user_id = auth.uid() AND c.deleted_at IS NULL
    )
  );

-- Prompt schedules access
CREATE POLICY prompt_schedules_access ON prompt_schedules
  FOR ALL USING (
    client_id IN (
      SELECT c.id FROM clients c
      JOIN organization_members om ON c.organization_id = om.organization_id
      WHERE om.user_id = auth.uid() AND c.deleted_at IS NULL
    )
  );

-- Schedule runs access
CREATE POLICY schedule_runs_access ON schedule_runs
  FOR ALL USING (
    client_id IN (
      SELECT c.id FROM clients c
      JOIN organization_members om ON c.organization_id = om.organization_id
      WHERE om.user_id = auth.uid() AND c.deleted_at IS NULL
    )
  );

-- ============================================
-- GRANTS
-- ============================================

GRANT ALL ON tavily_results TO service_role;
GRANT ALL ON prompt_schedules TO service_role;
GRANT ALL ON schedule_runs TO service_role;
GRANT SELECT ON visibility_history TO service_role;
