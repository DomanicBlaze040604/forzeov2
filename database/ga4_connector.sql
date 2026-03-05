-- ============================================================
-- GA4 Traffic Connector: Database Migration
-- Forzeo GEO Dashboard
-- ============================================================
-- Run this SQL in your Supabase SQL Editor to create the
-- two tables required for the GA4 Traffic Connector feature.
-- ============================================================

-- -------------------------------------------------------
-- TABLE 1: ga4_integrations
-- Stores one OAuth connection per client/project
-- -------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.ga4_integrations (
  id               UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  client_id        UUID NOT NULL REFERENCES public.clients(id) ON DELETE CASCADE,
  user_id          UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,

  -- Selected GA4 property / stream
  ga4_property_id   TEXT,                    -- e.g. "properties/123456"
  ga4_property_name TEXT,                    -- e.g. "Forzeo Marketing Site"
  ga4_stream_id     TEXT,                    -- Web data stream ID
  ga4_stream_name   TEXT,                    -- e.g. "www.forzeo.com"

  -- OAuth credentials (stored as-is; encrypt at app layer if needed)
  access_token      TEXT,
  refresh_token     TEXT,
  token_expires_at  TIMESTAMPTZ,

  -- Connected Google account email
  connected_email   TEXT,

  -- Status: 'connected' | 'disconnected' | 'error'
  status            TEXT NOT NULL DEFAULT 'disconnected',
  error_message     TEXT,

  last_synced_at    TIMESTAMPTZ,
  created_at        TIMESTAMPTZ DEFAULT NOW(),
  updated_at        TIMESTAMPTZ DEFAULT NOW(),

  -- Only one integration per client at a time
  CONSTRAINT ga4_integrations_client_unique UNIQUE (client_id)
);

-- -------------------------------------------------------
-- TABLE 2: ga4_sync_logs
-- Daily LLM-referral traffic data pulled from GA4
-- -------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.ga4_sync_logs (
  id                    UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  client_id             UUID NOT NULL REFERENCES public.clients(id) ON DELETE CASCADE,

  sync_date             DATE NOT NULL,

  -- Source name: 'ChatGPT' | 'Perplexity' | 'Gemini' | 'Claude'
  source                TEXT NOT NULL,

  -- GA4 metrics
  sessions              INTEGER NOT NULL DEFAULT 0,
  conversions           INTEGER NOT NULL DEFAULT 0,    -- keyEvents (Pro tier)
  active_users          INTEGER NOT NULL DEFAULT 0,
  engagement_rate       NUMERIC(10, 4) DEFAULT 0,
  avg_session_duration  NUMERIC(10, 2) DEFAULT 0,      -- seconds

  created_at            TIMESTAMPTZ DEFAULT NOW(),

  -- One row per (client, date, source)
  CONSTRAINT ga4_sync_logs_unique UNIQUE (client_id, sync_date, source)
);

-- -------------------------------------------------------
-- INDEXES
-- -------------------------------------------------------
CREATE INDEX IF NOT EXISTS idx_ga4_integrations_client ON public.ga4_integrations(client_id);
CREATE INDEX IF NOT EXISTS idx_ga4_sync_logs_client    ON public.ga4_sync_logs(client_id);
CREATE INDEX IF NOT EXISTS idx_ga4_sync_logs_date      ON public.ga4_sync_logs(sync_date);

-- -------------------------------------------------------
-- ROW LEVEL SECURITY
-- -------------------------------------------------------

ALTER TABLE public.ga4_integrations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ga4_sync_logs    ENABLE ROW LEVEL SECURITY;

-- Users can only see their own integrations (via client membership)
DROP POLICY IF EXISTS "ga4_integrations_select" ON public.ga4_integrations;
CREATE POLICY "ga4_integrations_select" ON public.ga4_integrations
  FOR SELECT USING (
    user_id = auth.uid()
    OR EXISTS (
      SELECT 1 FROM public.profiles
      WHERE id = auth.uid() AND role IN ('admin', 'agency')
    )
  );

DROP POLICY IF EXISTS "ga4_integrations_insert" ON public.ga4_integrations;
CREATE POLICY "ga4_integrations_insert" ON public.ga4_integrations
  FOR INSERT WITH CHECK (user_id = auth.uid());

DROP POLICY IF EXISTS "ga4_integrations_update" ON public.ga4_integrations;
CREATE POLICY "ga4_integrations_update" ON public.ga4_integrations
  FOR UPDATE USING (user_id = auth.uid());

DROP POLICY IF EXISTS "ga4_integrations_delete" ON public.ga4_integrations;
CREATE POLICY "ga4_integrations_delete" ON public.ga4_integrations
  FOR DELETE USING (user_id = auth.uid());

-- ga4_sync_logs: readable by the user who owns the integration
DROP POLICY IF EXISTS "ga4_sync_logs_select" ON public.ga4_sync_logs;
CREATE POLICY "ga4_sync_logs_select" ON public.ga4_sync_logs
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM public.ga4_integrations g
      WHERE g.client_id = ga4_sync_logs.client_id
        AND (g.user_id = auth.uid()
             OR EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role IN ('admin', 'agency')))
    )
  );

-- Service role (Edge Functions) can write sync logs
DROP POLICY IF EXISTS "ga4_sync_logs_service_write" ON public.ga4_sync_logs;
CREATE POLICY "ga4_sync_logs_service_write" ON public.ga4_sync_logs
  FOR ALL USING (auth.role() = 'service_role');

-- -------------------------------------------------------
-- UPDATED_AT TRIGGER for ga4_integrations
-- -------------------------------------------------------
CREATE OR REPLACE FUNCTION public.update_ga4_integration_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS set_ga4_integrations_updated_at ON public.ga4_integrations;
CREATE TRIGGER set_ga4_integrations_updated_at
  BEFORE UPDATE ON public.ga4_integrations
  FOR EACH ROW EXECUTE FUNCTION public.update_ga4_integration_updated_at();
