-- ==============================================================================
-- Migration: 0004_post_specific_scopes.sql
-- Description: Fine-grained scope targeting for posts, reels, and stories
-- ==============================================================================

ALTER TABLE automation_rules
  ADD COLUMN IF NOT EXISTS scope_type TEXT NOT NULL DEFAULT 'all'
    CHECK (scope_type IN ('specific', 'all', 'next_post', 'story')),
  ADD COLUMN IF NOT EXISTS target_media_ids TEXT[] NOT NULL DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS target_media_snapshot JSONB NOT NULL DEFAULT '[]'::jsonb;

-- Populate target_media_ids and scope_type from legacy post_scope column
UPDATE automation_rules
SET
  scope_type = CASE WHEN post_scope IS NULL THEN 'all' ELSE 'specific' END,
  target_media_ids = CASE WHEN post_scope IS NOT NULL THEN ARRAY[post_scope] ELSE '{}'::text[] END
WHERE target_media_ids = '{}'::text[];

-- GIN index for fast array containment checks in high-throughput webhook matching
CREATE INDEX IF NOT EXISTS automation_rules_target_media_idx
  ON automation_rules USING GIN (target_media_ids);

-- Composite index for fast account & status filtered rule lookups
CREATE INDEX IF NOT EXISTS automation_rules_account_scope_idx
  ON automation_rules (account_id, scope_type, status);

