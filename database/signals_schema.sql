-- ============================================================================
-- FRESH SIGNALS SCHEMA
-- ============================================================================
-- Database schema for Fresh Signal Intelligence system:
-- - RSS feeds for Google Alerts
-- - Fresh signals (ingested content)
-- - Signal correlations (Tavily matches)
-- - Recommendations (actionable insights)
-- ============================================================================

-- ============================================
-- RSS FEEDS TABLE
-- ============================================
-- Stores user-provided RSS feed URLs (e.g., Google Alerts)

CREATE TABLE IF NOT EXISTS rss_feeds (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    client_id UUID NOT NULL REFERENCES clients(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    rss_url TEXT NOT NULL,
    feed_type TEXT DEFAULT 'google_alert', -- google_alert, newsapi, bing, custom
    topic TEXT, -- What this feed tracks (e.g., "Best dating apps in India")
    brand_keywords TEXT[], -- Keywords to match for brand mentions
    competitor_keywords TEXT[], -- Keywords to match for competitor mentions
    is_active BOOLEAN DEFAULT true,
    last_polled_at TIMESTAMPTZ,
    last_poll_status TEXT, -- success, error, no_new_content
    last_poll_error TEXT,
    etag TEXT, -- For conditional HTTP requests
    last_modified TEXT, -- For conditional HTTP requests
    poll_interval_hours INTEGER DEFAULT 6,
    items_fetched_total INTEGER DEFAULT 0,
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now()
);

-- ============================================
-- FRESH SIGNALS TABLE
-- ============================================
-- Stores ingested content from RSS feeds with scoring

CREATE TABLE IF NOT EXISTS fresh_signals (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    client_id UUID NOT NULL REFERENCES clients(id) ON DELETE CASCADE,
    feed_id UUID REFERENCES rss_feeds(id) ON DELETE SET NULL,
    
    -- Content info
    url TEXT NOT NULL,
    url_hash TEXT NOT NULL, -- For deduplication
    title TEXT,
    content_snippet TEXT,
    published_at TIMESTAMPTZ,
    discovered_at TIMESTAMPTZ DEFAULT now(),
    source_domain TEXT,
    matched_topic TEXT,
    
    -- Mention detection
    brand_mentions TEXT[], -- Detected brand mentions
    competitor_mentions TEXT[], -- Detected competitor mentions
    
    -- Content classification
    content_type TEXT, -- listicle, review, blog, news, forum, social
    sentiment TEXT, -- positive, negative, neutral
    
    -- Scoring (0.0 - 1.0)
    freshness_score FLOAT DEFAULT 0,
    authority_score FLOAT DEFAULT 0,
    relevance_score FLOAT DEFAULT 0,
    influence_score FLOAT DEFAULT 0, -- Combined weighted score
    
    -- Processing status
    processing_status TEXT DEFAULT 'pending', -- pending, scored, correlated, processed
    correlation_status TEXT DEFAULT 'pending', -- pending, in_progress, completed, skipped
    
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now(),
    
    UNIQUE(client_id, url_hash)
);

-- ============================================
-- SIGNAL CORRELATIONS TABLE
-- ============================================
-- Tracks Tavily correlation data for each signal

CREATE TABLE IF NOT EXISTS signal_correlations (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    signal_id UUID NOT NULL REFERENCES fresh_signals(id) ON DELETE CASCADE,
    client_id UUID NOT NULL REFERENCES clients(id) ON DELETE CASCADE,
    
    -- Correlation context
    prompt_text TEXT, -- The prompt used for Tavily search
    
    -- Tavily results
    tavily_search_id TEXT,
    tavily_appears BOOLEAN DEFAULT false, -- Does signal's domain appear in Tavily?
    tavily_rank INTEGER, -- Position in Tavily results (if found)
    tavily_result_count INTEGER DEFAULT 0,
    
    -- Classification
    classification TEXT DEFAULT 'unknown', -- emerging, reinforcing, low_impact
    classification_reason TEXT,
    
    -- AI propagation tracking
    ai_first_appearance_at TIMESTAMPTZ, -- When this source first appeared in AI answers
    propagation_lag_days INTEGER, -- Days between signal publish and AI appearance
    
    -- Analysis data
    adjacent_domains TEXT[], -- Other domains in Tavily results
    relevance_overlap FLOAT, -- How relevant to AI answers
    
    created_at TIMESTAMPTZ DEFAULT now()
);

-- ============================================
-- RECOMMENDATIONS TABLE
-- ============================================
-- Actionable recommendations generated from signals

CREATE TABLE IF NOT EXISTS recommendations (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    client_id UUID NOT NULL REFERENCES clients(id) ON DELETE CASCADE,
    signal_id UUID REFERENCES fresh_signals(id) ON DELETE SET NULL,
    correlation_id UUID REFERENCES signal_correlations(id) ON DELETE SET NULL,
    
    -- Recommendation details
    recommendation_type TEXT NOT NULL, -- content_opportunity, competitor_alert, source_emerging, visibility_risk
    priority TEXT DEFAULT 'medium', -- critical, high, medium, low
    
    title TEXT NOT NULL,
    description TEXT,
    evidence TEXT, -- Data backing this recommendation
    
    -- Actionable items
    action_items TEXT[],
    urgency_days INTEGER, -- Recommended days to act
    
    -- Source context
    source_domain TEXT,
    source_url TEXT,
    matched_prompt TEXT,
    
    -- User interaction
    is_read BOOLEAN DEFAULT false,
    is_dismissed BOOLEAN DEFAULT false,
    dismissed_at TIMESTAMPTZ,
    dismissed_reason TEXT,
    is_actioned BOOLEAN DEFAULT false,
    actioned_at TIMESTAMPTZ,
    action_notes TEXT,
    
    -- Tracking
    expires_at TIMESTAMPTZ, -- When this recommendation becomes stale
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now()
);

-- ============================================
-- DOMAIN AUTHORITY TABLE
-- ============================================
-- Cached domain authority data for scoring

CREATE TABLE IF NOT EXISTS domain_authority (
    domain TEXT PRIMARY KEY,
    authority_bucket TEXT DEFAULT 'unknown', -- high, medium, low, unknown
    authority_score FLOAT DEFAULT 0.5,
    domain_type TEXT, -- news, blog, government, education, social, ugc, commercial
    is_trusted BOOLEAN DEFAULT false,
    last_verified_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now()
);

-- Pre-populate some known high-authority domains
INSERT INTO domain_authority (domain, authority_bucket, authority_score, domain_type, is_trusted) VALUES
    ('nytimes.com', 'high', 0.95, 'news', true),
    ('wsj.com', 'high', 0.95, 'news', true),
    ('bbc.com', 'high', 0.95, 'news', true),
    ('reuters.com', 'high', 0.95, 'news', true),
    ('forbes.com', 'high', 0.9, 'news', true),
    ('techcrunch.com', 'high', 0.85, 'news', true),
    ('theverge.com', 'high', 0.85, 'news', true),
    ('wired.com', 'high', 0.85, 'news', true),
    ('wikipedia.org', 'high', 0.95, 'education', true),
    ('gov.in', 'high', 0.95, 'government', true),
    ('reddit.com', 'medium', 0.6, 'ugc', false),
    ('quora.com', 'medium', 0.55, 'ugc', false),
    ('medium.com', 'medium', 0.5, 'blog', false)
ON CONFLICT (domain) DO NOTHING;

-- ============================================
-- INDEXES
-- ============================================

CREATE INDEX IF NOT EXISTS idx_rss_feeds_client ON rss_feeds(client_id);
CREATE INDEX IF NOT EXISTS idx_rss_feeds_active ON rss_feeds(is_active) WHERE is_active = true;
CREATE INDEX IF NOT EXISTS idx_rss_feeds_due ON rss_feeds(last_polled_at, poll_interval_hours) WHERE is_active = true;

CREATE INDEX IF NOT EXISTS idx_fresh_signals_client ON fresh_signals(client_id);
CREATE INDEX IF NOT EXISTS idx_fresh_signals_feed ON fresh_signals(feed_id);
CREATE INDEX IF NOT EXISTS idx_fresh_signals_status ON fresh_signals(processing_status);
CREATE INDEX IF NOT EXISTS idx_fresh_signals_influence ON fresh_signals(influence_score DESC);
CREATE INDEX IF NOT EXISTS idx_fresh_signals_published ON fresh_signals(published_at DESC);
CREATE INDEX IF NOT EXISTS idx_fresh_signals_url_hash ON fresh_signals(url_hash);

CREATE INDEX IF NOT EXISTS idx_signal_correlations_signal ON signal_correlations(signal_id);
CREATE INDEX IF NOT EXISTS idx_signal_correlations_client ON signal_correlations(client_id);
CREATE INDEX IF NOT EXISTS idx_signal_correlations_class ON signal_correlations(classification);

CREATE INDEX IF NOT EXISTS idx_recommendations_client ON recommendations(client_id);
CREATE INDEX IF NOT EXISTS idx_recommendations_priority ON recommendations(priority) WHERE is_dismissed = false;
CREATE INDEX IF NOT EXISTS idx_recommendations_unread ON recommendations(client_id, is_read) WHERE is_read = false AND is_dismissed = false;

-- ============================================
-- ROW LEVEL SECURITY
-- ============================================

ALTER TABLE rss_feeds ENABLE ROW LEVEL SECURITY;
ALTER TABLE fresh_signals ENABLE ROW LEVEL SECURITY;
ALTER TABLE signal_correlations ENABLE ROW LEVEL SECURITY;
ALTER TABLE recommendations ENABLE ROW LEVEL SECURITY;
ALTER TABLE domain_authority ENABLE ROW LEVEL SECURITY;

-- RLS Policies for rss_feeds
CREATE POLICY "Users can view own client RSS feeds" ON rss_feeds
    FOR SELECT USING (
        client_id IN (
            SELECT c.id FROM clients c
            JOIN organization_members om ON c.organization_id = om.organization_id
            WHERE om.user_id = auth.uid() AND c.deleted_at IS NULL
        )
    );

CREATE POLICY "Users can insert RSS feeds for own clients" ON rss_feeds
    FOR INSERT WITH CHECK (
        client_id IN (
            SELECT c.id FROM clients c
            JOIN organization_members om ON c.organization_id = om.organization_id
            WHERE om.user_id = auth.uid() AND c.deleted_at IS NULL
        )
    );

CREATE POLICY "Users can update own client RSS feeds" ON rss_feeds
    FOR UPDATE USING (
        client_id IN (
            SELECT c.id FROM clients c
            JOIN organization_members om ON c.organization_id = om.organization_id
            WHERE om.user_id = auth.uid() AND c.deleted_at IS NULL
        )
    );

CREATE POLICY "Users can delete own client RSS feeds" ON rss_feeds
    FOR DELETE USING (
        client_id IN (
            SELECT c.id FROM clients c
            JOIN organization_members om ON c.organization_id = om.organization_id
            WHERE om.user_id = auth.uid() AND c.deleted_at IS NULL
        )
    );

-- RLS Policies for fresh_signals
CREATE POLICY "Users can view own client signals" ON fresh_signals
    FOR SELECT USING (
        client_id IN (
            SELECT c.id FROM clients c
            JOIN organization_members om ON c.organization_id = om.organization_id
            WHERE om.user_id = auth.uid() AND c.deleted_at IS NULL
        )
    );

-- RLS Policies for signal_correlations
CREATE POLICY "Users can view own client correlations" ON signal_correlations
    FOR SELECT USING (
        client_id IN (
            SELECT c.id FROM clients c
            JOIN organization_members om ON c.organization_id = om.organization_id
            WHERE om.user_id = auth.uid() AND c.deleted_at IS NULL
        )
    );

-- RLS Policies for recommendations
CREATE POLICY "Users can view own client recommendations" ON recommendations
    FOR SELECT USING (
        client_id IN (
            SELECT c.id FROM clients c
            JOIN organization_members om ON c.organization_id = om.organization_id
            WHERE om.user_id = auth.uid() AND c.deleted_at IS NULL
        )
    );

CREATE POLICY "Users can update own recommendations" ON recommendations
    FOR UPDATE USING (
        client_id IN (
            SELECT c.id FROM clients c
            JOIN organization_members om ON c.organization_id = om.organization_id
            WHERE om.user_id = auth.uid() AND c.deleted_at IS NULL
        )
    );

-- Domain authority is public read
CREATE POLICY "Anyone can view domain authority" ON domain_authority
    FOR SELECT USING (true);

-- ============================================
-- VIEWS
-- ============================================

-- Aggregated signal statistics per client
CREATE OR REPLACE VIEW signal_stats AS
SELECT 
    client_id,
    COUNT(*) AS total_signals,
    COUNT(*) FILTER (WHERE processing_status = 'pending') AS pending_signals,
    COUNT(*) FILTER (WHERE influence_score >= 0.7) AS high_influence_signals,
    COUNT(*) FILTER (WHERE published_at >= now() - interval '7 days') AS signals_last_7d,
    AVG(influence_score) AS avg_influence_score,
    COUNT(DISTINCT source_domain) AS unique_domains
FROM fresh_signals
GROUP BY client_id;

-- Unread recommendations summary
CREATE OR REPLACE VIEW recommendation_summary AS
SELECT 
    client_id,
    COUNT(*) FILTER (WHERE priority = 'critical' AND NOT is_dismissed AND NOT is_read) AS critical_unread,
    COUNT(*) FILTER (WHERE priority = 'high' AND NOT is_dismissed AND NOT is_read) AS high_unread,
    COUNT(*) FILTER (WHERE NOT is_dismissed AND NOT is_read) AS total_unread,
    COUNT(*) FILTER (WHERE is_actioned) AS actioned_count,
    COUNT(*) AS total_count
FROM recommendations
GROUP BY client_id;

-- ============================================
-- FUNCTIONS
-- ============================================

-- Function to get due RSS feeds for polling
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

-- Function to calculate influence score
CREATE OR REPLACE FUNCTION calculate_influence_score(
    p_freshness_score FLOAT,
    p_authority_score FLOAT,
    p_relevance_score FLOAT
) RETURNS FLOAT AS $$
BEGIN
    -- Weighted combination: Authority (40%), Freshness (30%), Relevance (30%)
    RETURN (p_authority_score * 0.4) + (p_freshness_score * 0.3) + (p_relevance_score * 0.3);
END;
$$ LANGUAGE plpgsql;

-- ============================================
-- TRIGGERS
-- ============================================

-- Auto-update updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = now();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_rss_feeds_updated
    BEFORE UPDATE ON rss_feeds
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at();

CREATE TRIGGER trigger_fresh_signals_updated
    BEFORE UPDATE ON fresh_signals
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at();

CREATE TRIGGER trigger_recommendations_updated
    BEFORE UPDATE ON recommendations
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at();

-- ============================================
-- GRANTS (for service role)
-- ============================================

GRANT ALL ON rss_feeds TO service_role;
GRANT ALL ON fresh_signals TO service_role;
GRANT ALL ON signal_correlations TO service_role;
GRANT ALL ON recommendations TO service_role;
GRANT ALL ON domain_authority TO service_role;
