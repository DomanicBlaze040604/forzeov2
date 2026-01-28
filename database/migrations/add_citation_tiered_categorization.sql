-- ============================================================================
-- CITATION INTELLIGENCE SCHEMA MIGRATION
-- ============================================================================
-- Adds new columns for enhanced tiered categorization:
-- - relationship_type: 'owned', 'competitor', 'neutral', 'affiliate'
-- - source_type: 'ugc', 'editorial', 'review', 'wiki', 'social', 'comparison', 'local', 'other'
-- - authority_tier: 1 (Wikipedia/.gov/.edu), 2 (publishers), 3 (forums/UGC)
-- - is_affiliate: boolean for affiliate link detection
-- - affiliate_type: 'detected', 'possible', 'manual', null
-- ============================================================================

-- Add new columns for tiered categorization
ALTER TABLE citation_intelligence ADD COLUMN IF NOT EXISTS relationship_type TEXT DEFAULT 'neutral';
COMMENT ON COLUMN citation_intelligence.relationship_type IS 'Type: owned, competitor, neutral, affiliate';

ALTER TABLE citation_intelligence ADD COLUMN IF NOT EXISTS source_type TEXT DEFAULT 'other';
COMMENT ON COLUMN citation_intelligence.source_type IS 'Type: ugc, editorial, review, wiki, social, comparison, local, other';

ALTER TABLE citation_intelligence ADD COLUMN IF NOT EXISTS authority_tier INTEGER DEFAULT 2;
COMMENT ON COLUMN citation_intelligence.authority_tier IS 'Authority tier: 1=high trust (.gov/.edu/wiki), 2=publishers, 3=forums/UGC';

ALTER TABLE citation_intelligence ADD COLUMN IF NOT EXISTS is_affiliate BOOLEAN DEFAULT FALSE;
COMMENT ON COLUMN citation_intelligence.is_affiliate IS 'Whether affiliate link patterns were detected';

ALTER TABLE citation_intelligence ADD COLUMN IF NOT EXISTS affiliate_type TEXT;
COMMENT ON COLUMN citation_intelligence.affiliate_type IS 'Type: detected, possible, manual, or null';

-- Add indexes for the new columns
CREATE INDEX IF NOT EXISTS idx_citation_intelligence_relationship ON citation_intelligence(relationship_type);
CREATE INDEX IF NOT EXISTS idx_citation_intelligence_source_type ON citation_intelligence(source_type);
CREATE INDEX IF NOT EXISTS idx_citation_intelligence_authority ON citation_intelligence(authority_tier);
CREATE INDEX IF NOT EXISTS idx_citation_intelligence_affiliate ON citation_intelligence(is_affiliate) WHERE is_affiliate = true;

-- Update the summary view to include new metrics
-- Update the summary view to include new metrics
DROP VIEW IF EXISTS citation_intelligence_summary;
CREATE OR REPLACE VIEW citation_intelligence_summary AS
SELECT 
    client_id,
    COUNT(*) AS total_citations_analyzed,
    COUNT(*) FILTER (WHERE is_hallucinated = true) AS hallucinated_count,
    COUNT(*) FILTER (WHERE is_reachable = true) AS verified_count,
    -- Category counts
    COUNT(*) FILTER (WHERE citation_category = 'ugc') AS ugc_count,
    COUNT(*) FILTER (WHERE citation_category = 'competitor_blog') AS competitor_count,
    COUNT(*) FILTER (WHERE citation_category = 'press_media') AS press_count,
    COUNT(*) FILTER (WHERE citation_category = 'app_store') AS app_store_count,
    COUNT(*) FILTER (WHERE citation_category = 'wikipedia') AS wikipedia_count,
    COUNT(*) FILTER (WHERE citation_category = 'brand_owned') AS brand_owned_count,
    COUNT(*) FILTER (WHERE citation_category = 'review_directory') AS review_count,
    COUNT(*) FILTER (WHERE citation_category = 'comparison') AS comparison_count,
    COUNT(*) FILTER (WHERE citation_category = 'local') AS local_count,
    -- Relationship counts
    COUNT(*) FILTER (WHERE relationship_type = 'owned') AS relationship_owned_count,
    COUNT(*) FILTER (WHERE relationship_type = 'competitor') AS relationship_competitor_count,
    COUNT(*) FILTER (WHERE relationship_type = 'affiliate') AS relationship_affiliate_count,
    -- Authority tier counts
    COUNT(*) FILTER (WHERE authority_tier = 1) AS tier_1_count,
    COUNT(*) FILTER (WHERE authority_tier = 2) AS tier_2_count,
    COUNT(*) FILTER (WHERE authority_tier = 3) AS tier_3_count,
    -- Other metrics
    COUNT(*) FILTER (WHERE brand_mentioned_in_source = true) AS brand_mentioned_count,
    COUNT(*) FILTER (WHERE is_affiliate = true) AS affiliate_count,
    COUNT(DISTINCT domain) AS unique_domains
FROM citation_intelligence
GROUP BY client_id;
