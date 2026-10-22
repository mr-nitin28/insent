-- ==============================================================================
-- Migration: 0001_init.sql
-- Description: Core multi-tenant schema with SKIP LOCKED queue and RLS
-- ==============================================================================

CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- ------------------------------------------------------------------------------
-- 1. Workspaces (Tenant Isolation Boundary)
-- ------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS workspaces (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  owner_id TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ------------------------------------------------------------------------------
-- 2. App Settings (Global & Per-Workspace Kill Switches)
-- ------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS app_settings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id UUID REFERENCES workspaces(id) ON DELETE CASCADE,
  kill_switch_active BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX IF NOT EXISTS app_settings_workspace_idx ON app_settings(workspace_id);

-- ------------------------------------------------------------------------------
-- 3. Social Accounts (Encrypted Tokens at Rest)
-- ------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS social_accounts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id UUID NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  platform TEXT NOT NULL DEFAULT 'instagram',
  account_id TEXT NOT NULL, -- Instagram Scoped User ID
  username TEXT NOT NULL,
  name TEXT,
  profile_picture_url TEXT,
  encrypted_access_token TEXT NOT NULL,
  token_iv TEXT NOT NULL,
  token_auth_tag TEXT NOT NULL,
  token_expires_at TIMESTAMPTZ,
  status TEXT NOT NULL DEFAULT 'connected' CHECK (status IN ('connected', 'needs_reauth', 'disconnected')),
  hourly_cap INT NOT NULL DEFAULT 600,
  webhook_subscribed BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT social_accounts_platform_account_unique UNIQUE (platform, account_id)
);
CREATE INDEX IF NOT EXISTS social_accounts_workspace_idx ON social_accounts(workspace_id);

-- ------------------------------------------------------------------------------
-- 4. Automation Rules
-- ------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS automation_rules (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id UUID NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  account_id UUID NOT NULL REFERENCES social_accounts(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  priority INT NOT NULL DEFAULT 10,
  match_mode TEXT NOT NULL DEFAULT 'exact' CHECK (match_mode IN ('exact', 'whole_word', 'contains')),
  keywords TEXT[] NOT NULL DEFAULT '{}',
  post_scope TEXT, -- NULL covers all posts; specific media_id targets single post
  destination_ref TEXT NOT NULL,
  message_template TEXT NOT NULL,
  public_reply_template TEXT,
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'paused')),
  version INT NOT NULL DEFAULT 1,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS automation_rules_account_idx ON automation_rules(account_id);
CREATE INDEX IF NOT EXISTS automation_rules_workspace_idx ON automation_rules(workspace_id);

-- ------------------------------------------------------------------------------
-- 5. Automation Runs (The Message Queue with Idempotent Constraints)
-- ------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS automation_runs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id UUID NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  account_id UUID NOT NULL REFERENCES social_accounts(id) ON DELETE CASCADE,
  rule_id UUID REFERENCES automation_rules(id) ON DELETE SET NULL,
  comment_id TEXT NOT NULL,
  commenter_id TEXT,
  commenter_username TEXT,
  comment_text TEXT,
  post_id TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'sending', 'sent', 'skipped', 'failed', 'unknown_delivery')),
  reason TEXT,
  attempts INT NOT NULL DEFAULT 0,
  run_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  claimed_at TIMESTAMPTZ,
  sent_at TIMESTAMPTZ,
  message_id TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  -- Exactly one private reply run per comment per account
  CONSTRAINT automation_runs_account_comment_unique UNIQUE (account_id, comment_id)
);
CREATE INDEX IF NOT EXISTS automation_runs_queue_idx ON automation_runs(status, run_at) WHERE status = 'pending';
CREATE INDEX IF NOT EXISTS automation_runs_workspace_idx ON automation_runs(workspace_id);

-- ------------------------------------------------------------------------------
-- 6. Tracked Links & Bot-Filtered Clicks
-- ------------------------------------------------------------------------------
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

-- ------------------------------------------------------------------------------
-- 7. Daily Aggregated Counters
-- ------------------------------------------------------------------------------
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

-- ------------------------------------------------------------------------------
-- 8. Audit Log
-- ------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS audit_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id UUID NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  action TEXT NOT NULL,
  actor_id TEXT,
  details JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS audit_log_workspace_idx ON audit_log(workspace_id, created_at DESC);

-- ------------------------------------------------------------------------------
-- 9. Queue Lease Function: claim_pending_runs (FOR UPDATE SKIP LOCKED)
-- ------------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION claim_pending_runs(batch_size INT, max_age_seconds INT DEFAULT 561600)
RETURNS SETOF automation_runs
LANGUAGE sql
AS $$
  UPDATE automation_runs
  SET status = 'sending', claimed_at = now(), updated_at = now()
  WHERE id IN (
    SELECT id FROM automation_runs
    WHERE status = 'pending'
      AND run_at <= now()
      AND created_at >= (now() - (max_age_seconds || ' seconds')::interval)
    ORDER BY run_at ASC
    FOR UPDATE SKIP LOCKED
    LIMIT batch_size
  )
  RETURNING *;
$$;

-- ------------------------------------------------------------------------------
-- 10. Reaper Function: reap_stuck_runs -> transitions to 'unknown_delivery'
-- (Never auto-resets to pending; halts double DM storms)
-- ------------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION reap_stuck_runs(timeout_seconds INT DEFAULT 300)
RETURNS INT
LANGUAGE plpgsql
AS $$
DECLARE
  reaped_count INT;
BEGIN
  WITH reaped AS (
    UPDATE automation_runs
    SET status = 'unknown_delivery',
        reason = 'Worker lease timed out; delivery unconfirmed. Stopped auto-resends.',
        claimed_at = NULL,
        updated_at = now()
    WHERE status = 'sending'
      AND claimed_at < (now() - (timeout_seconds || ' seconds')::interval)
    RETURNING id
  )
  SELECT count(*) INTO reaped_count FROM reaped;
  RETURN reaped_count;
END;
$$;

-- ------------------------------------------------------------------------------
-- 11. Row-Level Security (RLS) Configuration
-- ------------------------------------------------------------------------------
ALTER TABLE workspaces ENABLE ROW LEVEL SECURITY;
ALTER TABLE app_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE social_accounts ENABLE ROW LEVEL SECURITY;
ALTER TABLE automation_rules ENABLE ROW LEVEL SECURITY;
ALTER TABLE automation_runs ENABLE ROW LEVEL SECURITY;
ALTER TABLE tracked_links ENABLE ROW LEVEL SECURITY;
ALTER TABLE link_clicks ENABLE ROW LEVEL SECURITY;
ALTER TABLE daily_counters ENABLE ROW LEVEL SECURITY;
ALTER TABLE audit_log ENABLE ROW LEVEL SECURITY;

-- Service role has unrestricted administrative access for backend ingestion & worker
GRANT ALL ON ALL TABLES IN SCHEMA public TO service_role;
GRANT ALL ON ALL SEQUENCES IN SCHEMA public TO service_role;
GRANT ALL ON ALL FUNCTIONS IN SCHEMA public TO service_role;

-- Tenant isolation RLS policies for authenticated users
CREATE POLICY workspace_isolation_workspaces ON workspaces
  FOR ALL USING (auth.uid()::text = owner_id);

CREATE POLICY workspace_isolation_app_settings ON app_settings
  FOR ALL USING (workspace_id IN (SELECT id FROM workspaces WHERE owner_id = auth.uid()::text));

CREATE POLICY workspace_isolation_social_accounts ON social_accounts
  FOR ALL USING (workspace_id IN (SELECT id FROM workspaces WHERE owner_id = auth.uid()::text));

CREATE POLICY workspace_isolation_automation_rules ON automation_rules
  FOR ALL USING (workspace_id IN (SELECT id FROM workspaces WHERE owner_id = auth.uid()::text));

CREATE POLICY workspace_isolation_automation_runs ON automation_runs
  FOR ALL USING (workspace_id IN (SELECT id FROM workspaces WHERE owner_id = auth.uid()::text));

CREATE POLICY workspace_isolation_tracked_links ON tracked_links
  FOR ALL USING (workspace_id IN (SELECT id FROM workspaces WHERE owner_id = auth.uid()::text));

CREATE POLICY workspace_isolation_link_clicks ON link_clicks
  FOR ALL USING (workspace_id IN (SELECT id FROM workspaces WHERE owner_id = auth.uid()::text));

CREATE POLICY workspace_isolation_daily_counters ON daily_counters
  FOR ALL USING (workspace_id IN (SELECT id FROM workspaces WHERE owner_id = auth.uid()::text));

CREATE POLICY workspace_isolation_audit_log ON audit_log
  FOR ALL USING (workspace_id IN (SELECT id FROM workspaces WHERE owner_id = auth.uid()::text));
