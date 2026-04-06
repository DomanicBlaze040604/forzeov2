-- SEO Integration tables: Google Search Console + Bing Webmaster
-- Run in Supabase SQL editor: https://supabase.com/dashboard/project/bvmwnxargzlfheiwyget/sql

-- ── Google Search Console integration ────────────────────────────────────────
CREATE TABLE IF NOT EXISTS gsc_integrations (
  id                  uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  client_id           uuid NOT NULL REFERENCES clients(id) ON DELETE CASCADE,
  user_id             uuid NOT NULL,
  site_url            text,
  site_name           text,
  connected_email     text,
  access_token        text,
  refresh_token       text,
  token_expiry        timestamptz,
  status              text DEFAULT 'pending',  -- pending | connected | disconnected | error
  error_message       text,
  last_synced_at      timestamptz,
  created_at          timestamptz DEFAULT now(),
  UNIQUE (client_id)
);
ALTER TABLE gsc_integrations ENABLE ROW LEVEL SECURITY;
CREATE POLICY "auth users full access" ON gsc_integrations FOR ALL USING (auth.role() = 'authenticated');

-- ── GSC search analytics cache ────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS gsc_search_data (
  id            uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  client_id     uuid NOT NULL REFERENCES clients(id) ON DELETE CASCADE,
  date          date NOT NULL,
  query         text,
  page          text,
  country       text,
  device        text,
  clicks        integer DEFAULT 0,
  impressions   integer DEFAULT 0,
  ctr           numeric DEFAULT 0,
  position      numeric DEFAULT 0,
  created_at    timestamptz DEFAULT now(),
  UNIQUE (client_id, date, query, page, country, device)
);
CREATE INDEX IF NOT EXISTS gsc_search_data_client_date ON gsc_search_data (client_id, date DESC);
ALTER TABLE gsc_search_data ENABLE ROW LEVEL SECURITY;
CREATE POLICY "auth users full access" ON gsc_search_data FOR ALL USING (auth.role() = 'authenticated');

-- ── Bing Webmaster integration ────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS bing_integrations (
  id              uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  client_id       uuid NOT NULL REFERENCES clients(id) ON DELETE CASCADE,
  api_key         text,
  site_url        text,
  status          text DEFAULT 'pending',
  error_message   text,
  last_synced_at  timestamptz,
  created_at      timestamptz DEFAULT now(),
  UNIQUE (client_id)
);
ALTER TABLE bing_integrations ENABLE ROW LEVEL SECURITY;
CREATE POLICY "auth users full access" ON bing_integrations FOR ALL USING (auth.role() = 'authenticated');

-- ── Bing search data cache ────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS bing_search_data (
  id            uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  client_id     uuid NOT NULL REFERENCES clients(id) ON DELETE CASCADE,
  date          date NOT NULL,
  query         text,
  page          text,
  clicks        integer DEFAULT 0,
  impressions   integer DEFAULT 0,
  ctr           numeric DEFAULT 0,
  position      numeric DEFAULT 0,
  created_at    timestamptz DEFAULT now(),
  UNIQUE (client_id, date, query, page)
);
CREATE INDEX IF NOT EXISTS bing_search_data_client_date ON bing_search_data (client_id, date DESC);
ALTER TABLE bing_search_data ENABLE ROW LEVEL SECURITY;
CREATE POLICY "auth users full access" ON bing_search_data FOR ALL USING (auth.role() = 'authenticated');

-- ── SEO AI Insights (persisted Groq-generated content) ────────────────────────
CREATE TABLE IF NOT EXISTS seo_ai_insights (
  id            uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  client_id     uuid NOT NULL REFERENCES clients(id) ON DELETE CASCADE,
  user_id       uuid NOT NULL,
  insight_type  text NOT NULL,  -- 'strategist' | 'meta_description' | 'content_brief'
  query_context text,           -- the keyword/query this was generated for (null for strategist)
  engine        text,           -- 'google' | 'bing'
  date_range    integer,        -- 28 | 90
  response      jsonb NOT NULL, -- full AI response
  created_at    timestamptz DEFAULT now()
);
CREATE INDEX IF NOT EXISTS seo_ai_insights_client ON seo_ai_insights (client_id, insight_type, created_at DESC);
ALTER TABLE seo_ai_insights ENABLE ROW LEVEL SECURITY;
CREATE POLICY "auth users full access" ON seo_ai_insights FOR ALL USING (auth.role() = 'authenticated');
