# Operational Runbook: ANOZIK Social Connect

This runbook documents operational procedures, incident response steps, and emergency troubleshooting for production deployments.

---

## 1. Emergency Kill Switch Activation

### Scenario:

A rogue automation, spam loop, or incorrect message template threatens account standing or Meta rate limits.

### Procedure:

1. **Via Dashboard UI:**
   Navigate to the creator dashboard and toggle the **Emergency Kill Switch** to `ACTIVE`.
2. **Via Database (Direct SQL):**
   ```sql
   -- Activate kill switch across a specific workspace:
   UPDATE app_settings
   SET kill_switch_active = true, updated_at = now()
   WHERE workspace_id = '<WORKSPACE_UUID>';

   -- Emergency global kill switch (all workspaces):
   UPDATE app_settings
   SET kill_switch_active = true, updated_at = now();
   ```
3. **Immediate Effect:**
   The queue worker immediately halts DM dispatch. Claimed and incoming runs transition to `skipped` with the reason `"Workspace emergency kill switch is active"`. Zero outgoing API calls reach Meta.

---

## 2. Token Expiry & Re-authentication Incident

### Symptoms:

- Runs failing with error code `MetaApiError 190` ("Access token has expired or been revoked").
- Account status in database flips to `needs_reauth`.
- Active automations for that account are paused.

### Root Cause:

Instagram long-lived tokens expire after ~60 days, or when an account password is changed or permissions are revoked from Instagram settings.

### Resolution:

1. Direct the creator to complete the Instagram Login flow again via `/api/oauth/connect`.
2. The callback exchanges the new authorization code for a fresh 60-day token, encrypts it with AES-256-GCM, and updates `social_accounts`.
3. Account status updates automatically to `connected`.
4. Any `failed` runs caused by auth expiration can be reset via SQL if still within the 6.5-day window:
   ```sql
   UPDATE automation_runs
   SET status = 'pending', attempts = 0, updated_at = now()
   WHERE account_id = '<ACCOUNT_UUID>'
     AND status = 'failed'
     AND reason LIKE '%reauthentication%'
     AND created_at >= now() - interval '6 days';
   ```

---

## 3. Stuck Queue Recovery

### Symptoms:

- Runs remain in status `sending` with no progress.
- Total pending lease count grows unexpectedly.

### Root Cause:

Serverless worker instance terminated mid-execution (Vercel lambda timeout, network abort, or unhandled process termination).

### Automated Mitigation:

The built-in reaper function `reap_stuck_runs(300)` runs at the start of every worker batch. Any run claimed in `sending` for longer than 5 minutes is automatically reaped into `unknown_delivery`.

### Manual Audit & Clearing:

```sql
-- Check runs currently stuck in sending:
SELECT id, account_id, comment_id, claimed_at, attempts
FROM automation_runs
WHERE status = 'sending'
  AND claimed_at < now() - interval '5 minutes';

-- Trigger reaper manually:
SELECT reap_stuck_runs(300);
```

---

## 4. Handling `unknown_delivery` Runs

### Policy:

**NEVER automatically resend an `unknown_delivery` run.** Meta often completes DM delivery even when returning error code 1 or when a network connection drops mid-response. Auto-retrying an unconfirmed run risks sending duplicate DMs into a recipient's inbox.

### Resolution Steps:

1. Check the Instagram Direct inbox for the commenter's handle to see if the message was delivered.
2. If confirmed delivered:
   ```sql
   UPDATE automation_runs
   SET status = 'sent', updated_at = now()
   WHERE id = '<RUN_UUID>';
   ```
3. If confirmed NOT delivered and still within the 6.5-day window, manually re-queue:
   ```sql
   UPDATE automation_runs
   SET status = 'pending', attempts = 0, updated_at = now()
   WHERE id = '<RUN_UUID>'
     AND created_at >= now() - interval '6.5 days';
   ```

---

## 5. Meta User Data Deletion & Deauthorization Callbacks

### Regulatory Requirement:

Meta requires compliance callbacks when users remove an app from their Instagram/Facebook settings or submit a GDPR data deletion request.

### Implementation:

1. **Deauthorize Callback:**
   When Meta posts a signed `signed_request` to `/api/webhooks/deauthorize`:
   - Parse and verify the HMAC-SHA256 signature using `INSTAGRAM_APP_SECRET`.
   - Update `social_accounts` for that user to `disconnected`.
   - Wipe `encrypted_access_token`, `token_iv`, and `token_auth_tag`.
2. **Data Deletion Callback:**
   When Meta posts a signed `signed_request` to `/api/webhooks/data-deletion`:
   - Scrape commenter identifiers (`commenter_id`, `commenter_username`, `comment_text`) for all associated runs.
   - Return `{ url: "https://anozik.com/deletion-status?id=<confirmation_code>", confirmation_code: "<code_id>" }`.
3. **Automated Retention Job:**
   The daily retention worker runs `retentionService.purgeExpiredCommentData(30)` to anonymize all commenter identifiers older than configured retention days.
