-- Knowledge Base tables for client brand data
-- Run this in the Supabase SQL editor: https://supabase.com/dashboard/project/bvmwnxargzlfheiwyget/sql

-- ── client_knowledge_base ────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS client_knowledge_base (
  id              uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  client_id       uuid NOT NULL REFERENCES clients(id) ON DELETE CASCADE,
  exact_match     boolean DEFAULT false,
  location        text DEFAULT '',
  geographic_reach text DEFAULT 'Nationwide',
  language        text DEFAULT 'English',
  brand_context   text DEFAULT '',
  updated_at      timestamptz DEFAULT now(),
  UNIQUE (client_id)
);

ALTER TABLE client_knowledge_base ENABLE ROW LEVEL SECURITY;
CREATE POLICY "auth users full access" ON client_knowledge_base
  FOR ALL USING (auth.role() = 'authenticated');

-- ── client_eeat ──────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS client_eeat (
  id                uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  client_id         uuid NOT NULL REFERENCES clients(id) ON DELETE CASCADE,
  org_name          text DEFAULT '',
  legal_name        text DEFAULT '',
  website_url       text DEFAULT '',
  year_founded      text DEFAULT '',
  twitter_url       text DEFAULT '',
  logo_url          text DEFAULT '',
  kb_owner          text DEFAULT '',
  editor_in_chief   text DEFAULT '',
  review_frequency  text DEFAULT 'Monthly',
  editorial_policy  text DEFAULT '',
  updated_at        timestamptz DEFAULT now(),
  UNIQUE (client_id)
);

ALTER TABLE client_eeat ENABLE ROW LEVEL SECURITY;
CREATE POLICY "auth users full access" ON client_eeat
  FOR ALL USING (auth.role() = 'authenticated');

-- ── client_tone ───────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS client_tone (
  id              uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  client_id       uuid NOT NULL REFERENCES clients(id) ON DELETE CASCADE,
  tone            text DEFAULT 'Professional',
  style_notes     text DEFAULT '',
  target_audience text DEFAULT '',
  updated_at      timestamptz DEFAULT now(),
  UNIQUE (client_id)
);

ALTER TABLE client_tone ENABLE ROW LEVEL SECURITY;
CREATE POLICY "auth users full access" ON client_tone
  FOR ALL USING (auth.role() = 'authenticated');
