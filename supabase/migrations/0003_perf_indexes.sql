-- ==============================================================================
-- Migration: 0003_perf_indexes.sql
-- Description: Rolling throttle lookup index for rapid hourly send counts
-- ==============================================================================

CREATE INDEX IF NOT EXISTS automation_runs_account_sent_idx
ON automation_runs (account_id, sent_at DESC)
WHERE status = 'sent';
