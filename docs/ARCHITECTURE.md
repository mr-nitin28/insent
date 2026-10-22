# ANOZIK Social Connect — Architecture Specification

ANOZIK Social Connect is a modular, high-performance, multi-tenant social automation platform designed to connect social media engagement (such as Instagram comments) to personalized direct messages and tracked destination actions.

---

## 1. Folder Structure & Strict Architectural Boundaries

```
anozik-social-connect/
├── docs/                # Architecture, Meta API Notes, Audit, Runbook, Future, Adapting
├── supabase/migrations/ # Forward-only SQL migrations with Row-Level Security
├── scripts/             # simulate-webhook.ts (E2E simulator), seed.ts
├── src/
│   ├── config/          # business.config.ts, env.ts (the ONLY place with brand/business logic)
│   ├── core/            # PURE domain logic: matching, templates, throttle, status machine, errors
│   ├── channels/        # Channel adapters (types.ts, registry.ts, instagram/)
│   ├── destinations/    # Destination providers (types.ts, registry.ts, custom-url/, anozik/)
│   ├── modules/         # Application services: accounts, automations, runs, links, analytics, retention
│   └── app/             # Thin Next.js App Router endpoints and minimal creator dashboard
└── tests/               # Unit, integration, and simulated E2E test suites
```

### Architectural Invariants:
1. **Pure Core:** `src/core/` is completely pure. It performs zero I/O, imports no third-party network libraries or sibling directories, and contains pure business domain logic.
2. **Thin Web Layer:** `src/app/` contains no business logic. Route handlers validate inputs with Zod, invoke a module service, and return standard JSON or HTTP responses.
3. **Pluggable Channels & Destinations:** Channels implement `ChannelAdapter`; destinations implement `DestinationProvider`. Core and module layers interact solely through these contracts.
4. **Boundary Limit:** Files remain under ~250 lines; functions under ~40 lines. Zero circular dependencies.

---

## 2. Data Model & Concurrency Primitives

Data is stored in Supabase PostgreSQL with strict multi-tenancy enforced at the database level using Row-Level Security (RLS) indexed on `workspace_id`.

```
[workspaces] (tenant boundary)
    │
    ├── [social_accounts] (encrypted tokens, status, hourly caps)
    ├── [automation_rules] (keywords, match mode, message template, post scope)
    ├── [automation_runs]  (status, attempts, next_attempt, UNIQUE: account_id + comment_id)
    ├── [tracked_links]    (slug, destination_url, click_count)
    │       └── [link_clicks] (timestamp, ip_hash, user_agent, bot_flag)
    ├── [daily_counters]  (aggregate runs & sends per account per day)
    └── [app_settings]    (global & workspace kill switches)
```

### Queue Engine: Postgres `FOR UPDATE SKIP LOCKED`
Instead of adding Redis and an always-on BullMQ worker, runs are claimed directly from PostgreSQL:
```sql
CREATE OR REPLACE FUNCTION claim_pending_runs(batch_size int, max_age_seconds int)
RETURNS SETOF automation_runs LANGUAGE sql AS $$
  UPDATE automation_runs
  SET status = 'sending', claimed_at = now(), updated_at = now()
  WHERE id IN (
    SELECT id FROM automation_runs
    WHERE status = 'pending'
      AND run_at <= now()
      AND (created_at >= now() - (max_age_seconds || ' seconds')::interval)
    ORDER BY run_at ASC
    FOR UPDATE SKIP LOCKED
    LIMIT batch_size
  )
  RETURNING *;
$$;
```
This guarantees atomic, non-blocking queue processing across concurrent serverless instances at zero extra cost.

---

## 3. Request Flow & Pipeline

```
Webhook POST
  │
  ├── 1. Signature Verify: HMAC-SHA256(raw_body, INSTAGRAM_APP_SECRET) via timingSafeEqual
  ├── 2. Inbound Normalize: adapter.normalize(payload) -> InboundEvent[]
  ├── 3. Filter Ingest:
  │      - Drop if commenter_id === account_id (own comment loop guard)
  │      - Drop if parent_id is present (drop comment replies in V1)
  │      - Check 6.5-day eligibility window
  ├── 4. Evaluate Rules (in-memory cached per account):
  │      - Lowest priority number first -> Stricter match mode -> Earliest keyword position
  │      - If no match: Drop silently, nothing stored
  ├── 5. Idempotent Insert:
  │      - INSERT INTO automation_runs (account_id, comment_id, ...) ON CONFLICT DO NOTHING
  │      - Unique index on (account_id, comment_id) guarantees single run per comment
  ├── 6. Immediate Response: HTTP 200 returned in <200ms
  └── 7. Worker Kick: Next.js after() triggers background drain + cron every 30s as fallback
```

```
Worker Execution:
  │
  ├── 1. Reap Stuck Runs: Runs in 'sending' > 5 minutes transition to 'unknown_delivery' (never re-sent)
  ├── 2. Claim Batch: claim_pending_runs(batch_size=10) with SKIP LOCKED
  ├── 3. Check Eligibility:
  │      - Workspace kill switch active? -> Skip
  │      - Account connected & token valid? -> If not, pause rule & flag account
  │      - Hourly throttle cap reached? -> Delay run_at by throttle window
  ├── 4. Prepare Message:
  │      - Resolve destination provider URL -> Generate tracked short link
  │      - Render template ({username}, {link}) -> Append business disclosure
  ├── 5. Send Private Reply: adapter.send(account, event, renderedText)
  ├── 6. Classify Result:
  │      - Success -> mark 'sent'
  │      - Rate limit / transient 5xx -> backoff retry (attempts < 4)
  │      - Unconfirmed (timeout, Meta code 1) -> mark 'unknown_delivery'
  │      - Auth expired (190) -> mark account 'needs_reauth', run 'failed'
  └── 7. Optional Public Reply: adapter.replyPublicly(...) (failure never alters DM status)
```

---

## 4. State Machine Specification

An automation run adheres to a deterministic, non-reversible finite state machine:

```
                  ┌──────────────┐
                  │   PENDING    │◀────────┐ (retry with backoff, max 4)
                  └──────┬───────┘         │
                         │ claim           │
                         ▼                 │
                  ┌──────────────┐         │
                  │   SENDING    ├─────────┘
                  └──┬───┬───┬───┘
         success     │   │   │ crash / timeout
       ┌─────────────┘   │   └─────────────┐
       ▼                 ▼                 ▼
 ┌───────────┐     ┌───────────┐ ┌───────────────────┐
 │   SENT    │     │  SKIPPED  │ │ UNKNOWN_DELIVERY  │ (terminal: no auto-retry)
 └───────────┘     └───────────┘ └───────────────────┘
                         │
                         ▼
                   ┌───────────┐
                   │  FAILED   │ (permanent error or exhausted attempts)
                   └───────────┘
```

- **Transitions:** Illegal transitions (e.g. `sent` -> `pending`) throw `InvalidStateTransitionError`.
- **Unknown Delivery:** Worker crashes, gateway timeouts, or Meta generic code 1 map directly to `unknown_delivery`. This prevents destructive duplicate DM spam loops.

---

## 5. Adapter Interfaces

### Channel Adapter (`src/channels/types.ts`)
```ts
export interface ChannelAdapter {
  readonly id: string;
  verifyAndParse(req: Request): Promise<unknown>;
  normalize(payload: unknown): InboundEvent[];
  send(account: AccountCredentials, event: InboundEvent, text: string): Promise<SendResult>;
  replyPublicly?(account: AccountCredentials, event: InboundEvent, text: string): Promise<SendResult>;
  connectUrl(state: string): string;
  completeConnect(code: string): Promise<ConnectedAccount>;
  refreshCredentials(account: AccountCredentials): Promise<RefreshResult>;
}
```

### Destination Provider (`src/destinations/types.ts`)
```ts
export interface DestinationProvider {
  readonly id: string;
  readonly label: string;
  list(workspaceId: string): Promise<DestinationOption[]>;
  resolve(ref: DestinationRef): Promise<{ url: string }>;
}
```

Adding a new channel (WhatsApp, Telegram) requires implementing `ChannelAdapter` in `src/channels/<name>/` and registering it in `registry.ts`. Adding a business integration (Shopify, Calendly) requires implementing `DestinationProvider` in `src/destinations/<name>/`.

---

## 6. Configuration & Branding Model

All business parameters, brand identities, and platform limits reside exclusively in `src/config/business.config.ts`, validated via Zod:
- `brand.name`, `brand.domain`
- `channels.enabled`
- `destinations.enabled`
- `limits.hourlyCapPerAccount` (default 600)
- `limits.maxRetries` (4)
- `limits.retentionDays` (30)
- `defaults.disclosureText` ("Automated response via {brand}")

No brand terms, pricing, or product names exist anywhere in core or module logic.

---

## 7. Security & Compliance Architecture

1. **Token Protection:** Tokens encrypted via AES-256-GCM using `TOKEN_ENCRYPTION_KEY` before persistence; decrypted in memory only during active dispatch. Tokens are never exposed in browser payloads or API responses.
2. **Signature Verification:** Raw body string HMAC-SHA256 verified with `crypto.timingSafeEqual` against `X-Hub-Signature-256`.
3. **Data Retention & Privacy:** Automated cleanup routine scrubs commenter usernames, IDs, and comment text after `limits.retentionDays`.
4. **Link Tracking & Bot Filtering:** Tracked links detect and discard social preview crawlers (e.g. WhatsApp, FacebookExternalHit, Twitterbot, LinkedInBot) before recording clicks.
5. **URL Allowlist:** Destination URLs require valid HTTPS protocols and reject public URL shorteners (bit.ly, tinyurl).

---

## 8. Dependency Justification

| Dependency | Purpose | Justification |
| :--- | :--- | :--- |
| `next`, `react`, `react-dom` | Web framework & dashboard | Standard modern App Router; provides server actions & `after()` background execution |
| `zod` | Input validation | Parse, do not trust: enforces schema contracts on webhooks, env, and config |
| `@supabase/supabase-js` | Database client | Connects to Supabase Postgres with RLS and executes `claim_pending_runs` RPC |
| `lucide-react`, `tailwindcss` | Minimal creator dashboard | Accessible, lightweight styling and dashboard UI |
| `vitest` | Unit & integration tests | Native ESM TypeScript test runner with ultra-fast execution |

Zero Redis. Zero BullMQ. Zero always-on container expenses.
