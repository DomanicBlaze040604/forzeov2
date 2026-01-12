-- ============================================================================
-- CITATION INTELLIGENCE SCHEMA
-- ============================================================================
-- Database schema for Citation-Level Brand & Competitor Intelligence Engine:
-- - Citation analysis and verification
-- - Hallucination detection
-- - Category classification
-- - AI-powered recommendations
-- ============================================================================

-- ============================================
-- CITATION INTELLIGENCE TABLE
-- ============================================
-- Stores enriched analysis of each citation

CREATE TABLE IF NOT EXISTS citation_intelligence (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    citation_id UUID, -- Optional reference to original citations table (if exists)
    audit_result_id UUID REFERENCES audit_results(id) ON DELETE CASCADE,
    client_id UUID NOT NULL REFERENCES clients(id) ON DELETE CASCADE,
    
    -- Original citation data
    url TEXT NOT NULL,
    domain TEXT NOT NULL,
    title TEXT,
    model TEXT, -- Which AI model cited this
    
    -- URL verification
    is_reachable BOOLEAN DEFAULT NULL,
    http_status INTEGER,
    last_verified_at TIMESTAMPTZ,
    verification_error TEXT,
    
    -- Hallucination detection
    is_hallucinated BOOLEAN DEFAULT FALSE,
    hallucination_type TEXT, -- unreachable, misattributed, contradictory, fake_domain
    hallucination_reason TEXT,
    content_matches_claim BOOLEAN,
    
    -- Classification
    citation_category TEXT NOT NULL DEFAULT 'other', -- ugc, competitor_blog, press_media, app_store, wikipedia, brand_owned, other
    subcategory TEXT, -- reddit, quora, forbes, techcrunch, etc.
    opportunity_level TEXT DEFAULT 'medium', -- easy, medium, difficult
    
    -- Brand analysis
    brand_mentioned_in_source BOOLEAN DEFAULT FALSE,
    competitor_mentions TEXT[],
    source_sentiment TEXT, -- positive, neutral, negative
    
    -- AI analysis (from Groq)
    ai_analysis JSONB DEFAULT '{}',
    analysis_status TEXT DEFAULT 'pending', -- pending, analyzing, completed, failed
    
    -- Processing
    processed_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now()
);

-- ============================================
-- CITATION RECOMMENDATIONS TABLE
-- ============================================
-- Actionable recommendations for each citation

CREATE TABLE IF NOT EXISTS citation_recommendations (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    citation_intelligence_id UUID REFERENCES citation_intelligence(id) ON DELETE CASCADE,
    client_id UUID NOT NULL REFERENCES clients(id) ON DELETE CASCADE,
    
    -- Recommendation details
    recommendation_type TEXT NOT NULL, -- engage_ugc, create_comparison, publish_pr, improve_reviews, wikipedia_advisory
    priority TEXT DEFAULT 'medium', -- critical, high, medium, low
    
    title TEXT NOT NULL,
    description TEXT,
    
    -- Generated content from Groq
    generated_content TEXT,
    content_type TEXT, -- quora_answer, reddit_comment, comparison_page, press_release, review_template, wiki_gap_analysis
    generation_prompt TEXT, -- The prompt used to generate content
    
    -- Action tracking
    action_items TEXT[],
    estimated_effort TEXT, -- hours, days, weeks
    
    -- User interaction
    is_viewed BOOLEAN DEFAULT FALSE,
    is_actioned BOOLEAN DEFAULT FALSE,
    actioned_at TIMESTAMPTZ,
    action_notes TEXT,
    
    -- Content regeneration
    regeneration_count INTEGER DEFAULT 0,
    last_regenerated_at TIMESTAMPTZ,
    
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now()
);

-- ============================================
-- INDEXES
-- ============================================

CREATE INDEX IF NOT EXISTS idx_citation_intelligence_client ON citation_intelligence(client_id);
CREATE INDEX IF NOT EXISTS idx_citation_intelligence_audit ON citation_intelligence(audit_result_id);
CREATE INDEX IF NOT EXISTS idx_citation_intelligence_category ON citation_intelligence(citation_category);
CREATE INDEX IF NOT EXISTS idx_citation_intelligence_hallucinated ON citation_intelligence(is_hallucinated) WHERE is_hallucinated = true;
CREATE INDEX IF NOT EXISTS idx_citation_intelligence_status ON citation_intelligence(analysis_status);
CREATE INDEX IF NOT EXISTS idx_citation_intelligence_domain ON citation_intelligence(domain);

CREATE INDEX IF NOT EXISTS idx_citation_recommendations_intelligence ON citation_recommendations(citation_intelligence_id);
CREATE INDEX IF NOT EXISTS idx_citation_recommendations_client ON citation_recommendations(client_id);
CREATE INDEX IF NOT EXISTS idx_citation_recommendations_type ON citation_recommendations(recommendation_type);
CREATE INDEX IF NOT EXISTS idx_citation_recommendations_priority ON citation_recommendations(priority) WHERE is_actioned = false;
CREATE INDEX IF NOT EXISTS idx_citation_recommendations_unactioned ON citation_recommendations(client_id, is_actioned) WHERE is_actioned = false;

-- ============================================
-- VIEWS
-- ============================================

-- Citation intelligence summary per client
CREATE OR REPLACE VIEW citation_intelligence_summary AS
SELECT 
    client_id,
    COUNT(*) AS total_citations_analyzed,
    COUNT(*) FILTER (WHERE is_hallucinated = true) AS hallucinated_count,
    COUNT(*) FILTER (WHERE is_reachable = true) AS verified_count,
    COUNT(*) FILTER (WHERE citation_category = 'ugc') AS ugc_count,
    COUNT(*) FILTER (WHERE citation_category = 'competitor_blog') AS competitor_count,
    COUNT(*) FILTER (WHERE citation_category = 'press_media') AS press_count,
    COUNT(*) FILTER (WHERE citation_category = 'app_store') AS app_store_count,
    COUNT(*) FILTER (WHERE citation_category = 'wikipedia') AS wikipedia_count,
    COUNT(*) FILTER (WHERE citation_category = 'brand_owned') AS brand_owned_count,
    COUNT(*) FILTER (WHERE brand_mentioned_in_source = true) AS brand_mentioned_count,
    COUNT(DISTINCT domain) AS unique_domains
FROM citation_intelligence
GROUP BY client_id;

-- Recommendation summary per client
CREATE OR REPLACE VIEW citation_recommendation_summary AS
SELECT 
    client_id,
    COUNT(*) AS total_recommendations,
    COUNT(*) FILTER (WHERE priority = 'critical') AS critical_count,
    COUNT(*) FILTER (WHERE priority = 'high') AS high_count,
    COUNT(*) FILTER (WHERE is_actioned = false) AS pending_count,
    COUNT(*) FILTER (WHERE is_actioned = true) AS completed_count,
    COUNT(*) FILTER (WHERE generated_content IS NOT NULL) AS with_content_count
FROM citation_recommendations
GROUP BY client_id;

-- ============================================
-- TRIGGERS
-- ============================================

-- Auto-update updated_at timestamp
CREATE OR REPLACE FUNCTION update_citation_intelligence_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = now();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_citation_intelligence_updated
    BEFORE UPDATE ON citation_intelligence
    FOR EACH ROW
    EXECUTE FUNCTION update_citation_intelligence_updated_at();

CREATE TRIGGER trigger_citation_recommendations_updated
    BEFORE UPDATE ON citation_recommendations
    FOR EACH ROW
    EXECUTE FUNCTION update_citation_intelligence_updated_at();

-- ============================================
-- ROW LEVEL SECURITY
-- ============================================

ALTER TABLE citation_intelligence ENABLE ROW LEVEL SECURITY;
ALTER TABLE citation_recommendations ENABLE ROW LEVEL SECURITY;

-- RLS Policies for citation_intelligence
CREATE POLICY "Users can view own client citation intelligence" ON citation_intelligence
    FOR SELECT USING (
        client_id IN (
            SELECT c.id FROM clients c
            JOIN organization_members om ON c.organization_id = om.organization_id
            WHERE om.user_id = auth.uid() AND c.deleted_at IS NULL
        )
    );

CREATE POLICY "Users can insert citation intelligence for own clients" ON citation_intelligence
    FOR INSERT WITH CHECK (
        client_id IN (
            SELECT c.id FROM clients c
            JOIN organization_members om ON c.organization_id = om.organization_id
            WHERE om.user_id = auth.uid() AND c.deleted_at IS NULL
        )
    );

CREATE POLICY "Users can update own client citation intelligence" ON citation_intelligence
    FOR UPDATE USING (
        client_id IN (
            SELECT c.id FROM clients c
            JOIN organization_members om ON c.organization_id = om.organization_id
            WHERE om.user_id = auth.uid() AND c.deleted_at IS NULL
        )
    );

-- RLS Policies for citation_recommendations
CREATE POLICY "Users can view own client citation recommendations" ON citation_recommendations
    FOR SELECT USING (
        client_id IN (
            SELECT c.id FROM clients c
            JOIN organization_members om ON c.organization_id = om.organization_id
            WHERE om.user_id = auth.uid() AND c.deleted_at IS NULL
        )
    );

CREATE POLICY "Users can insert citation recommendations for own clients" ON citation_recommendations
    FOR INSERT WITH CHECK (
        client_id IN (
            SELECT c.id FROM clients c
            JOIN organization_members om ON c.organization_id = om.organization_id
            WHERE om.user_id = auth.uid() AND c.deleted_at IS NULL
        )
    );

CREATE POLICY "Users can update own client citation recommendations" ON citation_recommendations
    FOR UPDATE USING (
        client_id IN (
            SELECT c.id FROM clients c
            JOIN organization_members om ON c.organization_id = om.organization_id
            WHERE om.user_id = auth.uid() AND c.deleted_at IS NULL
        )
    );

-- ============================================
-- GRANTS (for service role)
-- ============================================

GRANT ALL ON citation_intelligence TO service_role;
GRANT ALL ON citation_recommendations TO service_role;
