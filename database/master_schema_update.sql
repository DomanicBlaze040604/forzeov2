-- ============================================================
-- MASTER SCHEMA UPDATE — ADD MISSING TABLES
-- ============================================================
-- Run this AFTER master_schema.sql to add the 7 missing tables
-- that exist in complete_production_schema.sql
-- ============================================================

-- 1. ORGANIZATION MEMBERS (Multi-tenant user roles)
CREATE TABLE IF NOT EXISTS organization_members (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role TEXT DEFAULT 'member' CHECK (role IN ('owner', 'admin', 'member', 'viewer')),
  invited_by UUID REFERENCES auth.users(id),
  invited_at TIMESTAMPTZ DEFAULT NOW(),
  accepted_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(organization_id, user_id)
);

CREATE INDEX IF NOT EXISTS idx_org_members_org ON organization_members(organization_id);
CREATE INDEX IF NOT EXISTS idx_org_members_user ON organization_members(user_id);

-- 2. SIGNAL CORRELATIONS (Tavily correlation tracking)
CREATE TABLE IF NOT EXISTS signal_correlations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  signal_id UUID REFERENCES fresh_signals(id) ON DELETE CASCADE,
  client_id UUID REFERENCES clients(id) ON DELETE CASCADE,
  prompt_text TEXT,
  tavily_rank INT,
  tavily_appears BOOLEAN DEFAULT false,
  classification TEXT DEFAULT 'unknown',
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_signal_correlations_signal ON signal_correlations(signal_id);
CREATE INDEX IF NOT EXISTS idx_signal_correlations_client ON signal_correlations(client_id);

-- 3. RECOMMENDATION SOURCES (Multi-source recommendations)
CREATE TABLE IF NOT EXISTS recommendation_sources (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  recommendation_id UUID REFERENCES recommendations(id) ON DELETE CASCADE,
  source_type TEXT CHECK (source_type IN ('audit','citation','signal')),
  source_id UUID,
  confidence_score FLOAT DEFAULT 0.5
);

-- 4. DOMAIN AUTHORITY HISTORY (Track authority changes)
CREATE TABLE IF NOT EXISTS domain_authority_history (
  domain TEXT,
  authority_score FLOAT,
  measured_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_domain_history ON domain_authority_history(domain, measured_at DESC);

-- 5. EXECUTION EVENTS (Debugging/Monitoring)
CREATE TABLE IF NOT EXISTS execution_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id UUID REFERENCES clients(id),
  entity_type TEXT,
  entity_id UUID,
  event_type TEXT,
  metadata JSONB,
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_execution_events_client ON execution_events(client_id);
CREATE INDEX IF NOT EXISTS idx_execution_events_type ON execution_events(event_type);

-- 6. AUDIT LOG (Security/Compliance)
CREATE TABLE IF NOT EXISTS audit_log (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  organization_id UUID REFERENCES organizations(id) ON DELETE SET NULL,
  user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  action TEXT NOT NULL,
  entity_type TEXT NOT NULL,
  entity_id UUID,
  old_data JSONB,
  new_data JSONB,
  ip_address INET,
  user_agent TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_audit_log_org ON audit_log(organization_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_audit_log_user ON audit_log(user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_audit_log_entity ON audit_log(entity_type, entity_id);

-- 7. SCHEDULED AUDITS (Recurring automation)
CREATE TABLE IF NOT EXISTS scheduled_audits (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  client_id UUID NOT NULL REFERENCES clients(id) ON DELETE CASCADE,
  frequency TEXT NOT NULL CHECK (frequency IN ('daily', 'weekly', 'monthly')),
  day_of_week INTEGER CHECK (day_of_week >= 0 AND day_of_week <= 6),
  day_of_month INTEGER CHECK (day_of_month >= 1 AND day_of_month <= 28),
  hour_utc INTEGER DEFAULT 9 CHECK (hour_utc >= 0 AND hour_utc <= 23),
  prompt_filter JSONB DEFAULT '{"categories": ["broad", "niche"], "active_only": true}'::jsonb,
  models TEXT[] DEFAULT ARRAY['chatgpt', 'google_ai_overview'],
  is_active BOOLEAN DEFAULT true,
  last_run_at TIMESTAMPTZ,
  next_run_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_scheduled_client ON scheduled_audits(client_id) WHERE is_active = true;
CREATE INDEX IF NOT EXISTS idx_scheduled_next ON scheduled_audits(next_run_at) WHERE is_active = true;

-- ============================================================
-- ADDITIONAL HELPER FUNCTIONS
-- ============================================================

-- Function to log audit actions
CREATE OR REPLACE FUNCTION log_audit_action()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO audit_log (
    organization_id,
    user_id,
    action,
    entity_type,
    entity_id,
    old_data,
    new_data
  ) VALUES (
    COALESCE(NEW.organization_id, OLD.organization_id),
    auth.uid(),
    TG_OP,
    TG_TABLE_NAME,
    COALESCE(NEW.id, OLD.id),
    CASE WHEN TG_OP IN ('UPDATE', 'DELETE') THEN to_jsonb(OLD) ELSE NULL END,
    CASE WHEN TG_OP IN ('INSERT', 'UPDATE') THEN to_jsonb(NEW) ELSE NULL END
  );
  RETURN COALESCE(NEW, OLD);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to calculate influence score
CREATE OR REPLACE FUNCTION calculate_influence_score(
    p_freshness_score FLOAT,
    p_authority_score FLOAT,
    p_relevance_score FLOAT
) RETURNS FLOAT AS $$
BEGIN
    RETURN (p_authority_score * 0.4) + (p_freshness_score * 0.3) + (p_relevance_score * 0.3);
END;
$$ LANGUAGE plpgsql;

-- Function to get client visibility summary
CREATE OR REPLACE FUNCTION get_client_visibility_summary(p_client_id UUID, days INTEGER DEFAULT 30)
RETURNS TABLE (
  avg_sov DECIMAL,
  avg_visibility_score DECIMAL,
  avg_trust_index DECIMAL,
  total_audits BIGINT,
  total_cost DECIMAL
) AS $$
BEGIN
  RETURN QUERY
  SELECT 
    AVG(share_of_voice)::DECIMAL,
    AVG(visibility_score)::DECIMAL,
    AVG(trust_index)::DECIMAL,
    COUNT(*)::BIGINT,
    SUM(ar.total_cost)
  FROM audit_results ar
  WHERE ar.client_id = p_client_id
    AND ar.created_at > NOW() - (days || ' days')::INTERVAL;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to get RSS feeds due for polling
CREATE OR REPLACE FUNCTION get_due_rss_feeds()
RETURNS SETOF rss_feeds AS $$
BEGIN
    RETURN QUERY
    SELECT *
    FROM rss_feeds
    WHERE is_active = true
    AND (
        last_polled_at IS NULL
        OR last_polled_at + (poll_interval_hours || ' hours')::interval <= now()
    )
    ORDER BY last_polled_at ASC NULLS FIRST
    LIMIT 50;
END;
$$ LANGUAGE plpgsql;

-- Function to get monthly usage (for billing)
CREATE OR REPLACE FUNCTION get_monthly_usage(org_id UUID, month_date DATE DEFAULT CURRENT_DATE)
RETURNS TABLE(
    total_audits BIGINT,
    total_prompts BIGINT,
    total_clients BIGINT,
    total_cost NUMERIC
) AS $$
BEGIN
    RETURN QUERY
    SELECT
        COUNT(DISTINCT ar.id)::BIGINT AS total_audits,
        COUNT(DISTINCT p.id)::BIGINT AS total_prompts,
        COUNT(DISTINCT c.id)::BIGINT AS total_clients,
        COALESCE(SUM(ar.total_cost), 0) AS total_cost
    FROM clients c
    LEFT JOIN prompts p ON p.client_id = c.id
    LEFT JOIN audit_results ar ON ar.client_id = c.id
        AND ar.created_at >= date_trunc('month', month_date)
        AND ar.created_at < date_trunc('month', month_date) + interval '1 month'
    WHERE c.organization_id = org_id AND c.deleted_at IS NULL;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================================
-- RLS POLICIES FOR NEW TABLES
-- ============================================================

-- Enable RLS
ALTER TABLE organization_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE signal_correlations ENABLE ROW LEVEL SECURITY;
ALTER TABLE audit_log ENABLE ROW LEVEL SECURITY;
ALTER TABLE scheduled_audits ENABLE ROW LEVEL SECURITY;

-- Organization Members policies
CREATE POLICY "Users can view members of their organizations" 
ON organization_members FOR SELECT TO authenticated 
USING (user_id = auth.uid() OR is_admin(auth.uid()));

CREATE POLICY "Admins can manage organization members" 
ON organization_members FOR ALL TO authenticated 
USING (is_admin(auth.uid())) WITH CHECK (is_admin(auth.uid()));

-- Signal Correlations policies
CREATE POLICY "Users can access signal_correlations" 
ON signal_correlations FOR ALL TO authenticated 
USING (is_admin(auth.uid()) OR EXISTS (
  SELECT 1 FROM user_clients 
  WHERE user_clients.client_id = signal_correlations.client_id 
  AND user_clients.user_id = auth.uid()
));

-- Audit Log policies (Admin only)
CREATE POLICY "Admins can view audit_log" 
ON audit_log FOR SELECT TO authenticated 
USING (is_admin(auth.uid()));

-- Scheduled Audits policies
CREATE POLICY "Users can access scheduled_audits" 
ON scheduled_audits FOR ALL TO authenticated 
USING (is_admin(auth.uid()) OR EXISTS (
  SELECT 1 FROM user_clients 
  WHERE user_clients.client_id = scheduled_audits.client_id 
  AND user_clients.user_id = auth.uid()
));

-- ============================================================
-- TRIGGERS FOR NEW TABLES
-- ============================================================

-- Update timestamps trigger for scheduled_audits
CREATE TRIGGER update_scheduled_audits_ts 
BEFORE UPDATE ON scheduled_audits 
FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- ============================================================
-- GRANT PERMISSIONS
-- ============================================================
GRANT ALL ON organization_members TO service_role;
GRANT ALL ON signal_correlations TO service_role;
GRANT ALL ON recommendation_sources TO service_role;
GRANT ALL ON domain_authority_history TO service_role;
GRANT ALL ON execution_events TO service_role;
GRANT ALL ON audit_log TO service_role;
GRANT ALL ON scheduled_audits TO service_role;

GRANT SELECT, INSERT, UPDATE, DELETE ON organization_members TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON signal_correlations TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON recommendation_sources TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON domain_authority_history TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON execution_events TO authenticated;
GRANT SELECT ON audit_log TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON scheduled_audits TO authenticated;

-- ============================================================
-- VERIFICATION
-- ============================================================
SELECT 'Master Schema Update Complete! Added 7 missing tables.' as status;
SELECT COUNT(*) as total_tables FROM information_schema.tables WHERE table_schema = 'public';
