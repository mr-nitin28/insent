-- ==============================================================================
-- Migration: 0002_links_conversions.sql
-- Description: Analytics, link tracking, conversions, counters, and audit log
-- ==============================================================================

-- 1. Tracked Links & Bot-Filtered Clicks
CREATE TABLE IF NOT EXISTS tracked_links (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id UUID NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  rule_id UUID REFERENCES automation_rules(id) ON DELETE SET NULL,
  slug TEXT UNIQUE NOT NULL,
  destination_url TEXT NOT NULL,
  click_count INT NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS tracked_links_slug_idx ON tracked_links(slug);
CREATE INDEX IF NOT EXISTS tracked_links_workspace_idx ON tracked_links(workspace_id);

CREATE TABLE IF NOT EXISTS link_clicks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id UUID NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  tracked_link_id UUID NOT NULL REFERENCES tracked_links(id) ON DELETE CASCADE,
  is_bot BOOLEAN NOT NULL DEFAULT false,
  user_agent TEXT,
  ip_hash TEXT,
  referrer TEXT,
  clicked_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS link_clicks_tracked_link_idx ON link_clicks(tracked_link_id);

-- 2. Conversions (Section 5.5 specification)
CREATE TABLE IF NOT EXISTS conversions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id UUID NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  tracked_link_id UUID REFERENCES tracked_links(id) ON DELETE SET NULL,
  event_name TEXT NOT NULL,
  value NUMERIC(10, 2),
  currency TEXT DEFAULT 'USD',
  metadata JSONB DEFAULT '{}'::jsonb,
  occurred_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS conversions_tracked_link_idx ON conversions(tracked_link_id);
CREATE INDEX IF NOT EXISTS conversions_workspace_idx ON conversions(workspace_id);

-- 3. Daily Aggregated Counters
CREATE TABLE IF NOT EXISTS daily_counters (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id UUID NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  account_id UUID NOT NULL REFERENCES social_accounts(id) ON DELETE CASCADE,
  date DATE NOT NULL DEFAULT CURRENT_DATE,
  total_runs INT NOT NULL DEFAULT 0,
  total_sends INT NOT NULL DEFAULT 0,
  total_errors INT NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT daily_counters_account_date_unique UNIQUE (account_id, date)
);

-- 4. Audit Log
CREATE TABLE IF NOT EXISTS audit_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id UUID NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  action TEXT NOT NULL,
  actor_id TEXT,
  details JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS audit_log_workspace_idx ON audit_log(workspace_id, created_at DESC);

-- 5. RLS Configuration
ALTER TABLE tracked_links ENABLE ROW LEVEL SECURITY;
ALTER TABLE link_clicks ENABLE ROW LEVEL SECURITY;
ALTER TABLE conversions ENABLE ROW LEVEL SECURITY;
ALTER TABLE daily_counters ENABLE ROW LEVEL SECURITY;
ALTER TABLE audit_log ENABLE ROW LEVEL SECURITY;

CREATE POLICY workspace_isolation_tracked_links ON tracked_links
  FOR ALL USING (workspace_id IN (SELECT id FROM workspaces WHERE owner_id = auth.uid()::text));

CREATE POLICY workspace_isolation_link_clicks ON link_clicks
  FOR ALL USING (workspace_id IN (SELECT id FROM workspaces WHERE owner_id = auth.uid()::text));

CREATE POLICY workspace_isolation_conversions ON conversions
  FOR ALL USING (workspace_id IN (SELECT id FROM workspaces WHERE owner_id = auth.uid()::text));

CREATE POLICY workspace_isolation_daily_counters ON daily_counters
  FOR ALL USING (workspace_id IN (SELECT id FROM workspaces WHERE owner_id = auth.uid()::text));

CREATE POLICY workspace_isolation_audit_log ON audit_log
  FOR ALL USING (workspace_id IN (SELECT id FROM workspaces WHERE owner_id = auth.uid()::text));
