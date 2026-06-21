-- Web Vitals persistence table
-- Run this in the Supabase SQL editor.

CREATE TABLE IF NOT EXISTS public.web_vitals (
  id         UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  metric     TEXT        NOT NULL,          -- CLS | INP | LCP | FCP | TTFB
  value      NUMERIC     NOT NULL,
  rating     TEXT        NOT NULL,          -- good | needs-improvement | poor
  path       TEXT,                          -- window.location.pathname
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_web_vitals_metric_created
  ON public.web_vitals (metric, created_at DESC);

ALTER TABLE public.web_vitals ENABLE ROW LEVEL SECURITY;

-- No user reads — only the service role writes (beacon endpoint)
CREATE POLICY "service role only" ON public.web_vitals
  FOR ALL USING (auth.role() = 'service_role');
