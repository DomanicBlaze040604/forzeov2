-- Add verification and enhanced categorization columns to citation_intelligence table
-- This migration supports both citation verification (Jina + semantic similarity) and
-- enhanced categorization with intent tags and trust/authority levels

-- Verification columns
ALTER TABLE citation_intelligence 
  ADD COLUMN IF NOT EXISTS verification_status TEXT DEFAULT 'pending';
-- Possible values: 'verified', 'partially_verified', 'hallucinated', 'pending', 'error'

ALTER TABLE citation_intelligence 
  ADD COLUMN IF NOT EXISTS similarity_score FLOAT;
-- Semantic similarity score (0.0 to 1.0): >0.85+entity=verified, 0.50-0.84=partial, <0.50=hallucinated

ALTER TABLE citation_intelligence 
  ADD COLUMN IF NOT EXISTS matched_paragraph TEXT;
-- The paragraph from the page that matched the claim

ALTER TABLE citation_intelligence 
  ADD COLUMN IF NOT EXISTS page_fetch_status INTEGER;
-- HTTP status code from Jina Reader fetch (200, 404, 500, etc.)

ALTER TABLE citation_intelligence 
  ADD COLUMN IF NOT EXISTS verified_at TIMESTAMPTZ;
-- Timestamp of when verification was completed (24h cache TTL)

ALTER TABLE citation_intelligence 
  ADD COLUMN IF NOT EXISTS page_content TEXT;
-- Cached page content from Jina Reader (for hover preview)

-- Enhanced categorization columns
ALTER TABLE citation_intelligence 
  ADD COLUMN IF NOT EXISTS intent_tags TEXT[];
-- Intent tags: pricing, alternatives, comparison, best_of, recommendation, how_to, tutorial, news, research

ALTER TABLE citation_intelligence 
  ADD COLUMN IF NOT EXISTS trust_tags TEXT[];
-- Trust tags: high_authority, low_authority, ugc_unverified, expert_review, sponsored, affiliate

-- Create indexes for verification filtering and caching
CREATE INDEX IF NOT EXISTS idx_citation_verification_status 
  ON citation_intelligence(verification_status);

CREATE INDEX IF NOT EXISTS idx_citation_verified_at 
  ON citation_intelligence(verified_at);

-- Create indexes for enhanced categorization queries
CREATE INDEX IF NOT EXISTS idx_citation_intent_tags 
  ON citation_intelligence USING GIN (intent_tags);

CREATE INDEX IF NOT EXISTS idx_citation_trust_tags 
  ON citation_intelligence USING GIN (trust_tags);

-- Add column comments for documentation
COMMENT ON COLUMN citation_intelligence.verification_status IS 'Citation verification status: verified (>0.85+entity), partially_verified (0.50-0.84), hallucinated (<0.50), pending, or error';
COMMENT ON COLUMN citation_intelligence.similarity_score IS 'Semantic similarity score (0.0 to 1.0) from verification engine';
COMMENT ON COLUMN citation_intelligence.matched_paragraph IS 'Text excerpt from the page that matched the claim';
COMMENT ON COLUMN citation_intelligence.page_fetch_status IS 'HTTP status code from Jina Reader (200=success, 404=not found, etc.)';
COMMENT ON COLUMN citation_intelligence.verified_at IS 'Timestamp when citation was last verified (24h cache TTL)';
COMMENT ON COLUMN citation_intelligence.intent_tags IS 'Intent classification: pricing, alternatives, comparison, best_of, recommendation, how_to, tutorial, news, research';
COMMENT ON COLUMN citation_intelligence.trust_tags IS 'Trust/authority level: high_authority, low_authority, ugc_unverified, expert_review, sponsored, affiliate';
