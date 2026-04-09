-- Rank Tracker upgrade — run in Supabase SQL editor
-- https://supabase.com/dashboard/project/bvmwnxargzlfheiwyget/sql

-- ── Tracked keywords list ──────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS seo_tracked_keywords (
  id           uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  client_id    uuid NOT NULL REFERENCES clients(id) ON DELETE CASCADE,
  keyword      text NOT NULL,
  tags         text[] DEFAULT '{}',
  created_at   timestamptz DEFAULT now(),
  UNIQUE (client_id, keyword)
);
ALTER TABLE seo_tracked_keywords ENABLE ROW LEVEL SECURITY;
CREATE POLICY "auth users full access" ON seo_tracked_keywords FOR ALL USING (auth.role() = 'authenticated');

-- ── Rank tracking table (create or upgrade) ───────────────────────────────────
CREATE TABLE IF NOT EXISTS seo_rank_tracking (
  id               uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  client_id        uuid NOT NULL REFERENCES clients(id) ON DELETE CASCADE,
  keyword          text NOT NULL,
  date             date NOT NULL DEFAULT CURRENT_DATE,
  position         integer,
  url              text,
  title            text,
  search_volume    integer DEFAULT 0,
  keyword_difficulty integer,
  competitors      jsonb DEFAULT '[]',   -- [{domain, position, url, title}]
  serp_features    text[] DEFAULT '{}',  -- ["featured_snippet", "local_pack", ...]
  created_at       timestamptz DEFAULT now(),
  UNIQUE (client_id, keyword, date)
);
ALTER TABLE seo_rank_tracking ADD COLUMN IF NOT EXISTS title text;
ALTER TABLE seo_rank_tracking ADD COLUMN IF NOT EXISTS keyword_difficulty integer;
ALTER TABLE seo_rank_tracking ADD COLUMN IF NOT EXISTS competitors jsonb DEFAULT '[]';
ALTER TABLE seo_rank_tracking ADD COLUMN IF NOT EXISTS serp_features text[] DEFAULT '{}';
CREATE INDEX IF NOT EXISTS seo_rank_tracking_client_date ON seo_rank_tracking (client_id, date DESC);
CREATE INDEX IF NOT EXISTS seo_rank_tracking_keyword ON seo_rank_tracking (client_id, keyword);
ALTER TABLE seo_rank_tracking ENABLE ROW LEVEL SECURITY;
CREATE POLICY "auth users full access" ON seo_rank_tracking FOR ALL USING (auth.role() = 'authenticated');
