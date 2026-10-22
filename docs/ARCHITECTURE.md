# ANOZIK Social Connect — Architecture Specification

ANOZIK Social Connect is a modular, high-performance, multi-tenant social automation platform designed to connect social media engagement (such as Instagram comments) to personalized direct messages and tracked destination actions.

---

## 1. Folder Structure & Architectural Boundaries

```
anozik-social-connect/
├── docs/                # Architecture, Meta API Notes, Audit, Runbook, Future, Adapting
├── supabase/migrations/ # Forward-only SQL migrations with Row-Level Security
├── scripts/             # simulate-webhook.ts (E2E simulator), check-dependencies.ts, seed.ts
├── src/
│   ├── config/          # business.config.ts, env.ts (the ONLY place with brand/business logic)
│   ├── core/            # PURE domain logic: matching, templates, throttle, status machine, errors
│   ├── channels/        # Channel adapters (types.ts, registry.ts, instagram/)
│   ├── destinations/    # Destination providers (types.ts, registry.ts, custom-url/, anozik/)
│   ├── modules/         # Services: accounts, automations, runs, links, retention
│   └── app/             # Thin Next.js App Router endpoints and minimal creator dashboard
└── tests/               # Unit, integration, security (RLS), and simulated E2E test suites
```

### Architectural Invariants:

1. **Pure Core:** `src/core/` is completely pure (0 external I/O, 0 outer imports).
2. **Thin Web Layer:** `src/app/` contains no business logic. Handlers parse via Zod and call modules.
3. **Pluggable Ports:** Channels implement `ChannelAdapter`; destinations implement `DestinationProvider`.
4. **Boundary Limit:** Files remain under ~200 lines; functions under ~40 lines. Zero circular dependencies.

---

## 2. Data Model & Concurrency Primitives

Data is stored in Supabase PostgreSQL with strict multi-tenancy enforced at the database level using Row-Level Security (RLS) indexed on `workspace_id`.

```
[workspaces] (tenant boundary)
    ├── [social_accounts] (encrypted tokens, status, hourly caps)
    ├── [automation_rules] (keywords, match mode, message template, post scope)
    ├── [automation_runs]  (status, attempts, next_attempt, UNIQUE: account_id + comment_id)
    ├── [tracked_links]    (slug, destination_url, click_count)
    │       ├── [link_clicks] (timestamp, ip_hash, user_agent, bot_flag)
    │       └── [conversions] (tracked_link_id, event_name, value, currency)
    ├── [daily_counters]  (aggregate runs & sends per account per day)
    └── [app_settings]    (global & workspace kill switches)
```

### Queue Engine: Postgres `FOR UPDATE SKIP LOCKED`

Runs are claimed atomically from PostgreSQL via `claim_pending_runs` using `FOR UPDATE SKIP LOCKED`. This guarantees atomic, non-blocking queue processing across concurrent serverless instances at zero extra cost.

---

## 3. Request Flow & Pipeline

```
Webhook POST
  ├── 1. Signature Verify: HMAC-SHA256(raw_body, secret) via timingSafeEqual
  ├── 2. Inbound Normalize: adapter.normalize(payload) -> InboundEvent[]
  ├── 3. Filter Ingest: Drop own comments and comment replies (loop guards)
  ├── 4. Evaluate Rules (in-memory cached per account 30s): Priority -> Strictness -> Earliest pos
  ├── 5. Idempotent Insert: UNIQUE (account_id, comment_id) ON CONFLICT DO NOTHING
  ├── 6. Immediate Response: HTTP 200 returned in <200ms
  └── 7. Worker Kick: Next.js after() triggers background drain + cron every 30s as fallback

Worker Execution:
  ├── 1. Reap Stuck Runs: Runs in 'sending' > 5m transition to 'unknown_delivery' (never re-sent)
  ├── 2. Claim Batch: claim_pending_runs(batch_size=10) with SKIP LOCKED
  ├── 3. Check Eligibility: Kill switch, valid token, 6.5-day window, hourly throttle cap
  ├── 4. Prepare Message: Resolve destination URL -> generate tracked link -> render template
  ├── 5. Send Private Reply: adapter.send(account, event, renderedText)
  ├── 6. Classify Result: sent | retry (backoff) | unknown_delivery | needs_reauth (pause rules)
  └── 7. Optional Public Reply: adapter.replyPublicly(...) (failure never alters DM status)
```

---

## 4. State Machine Specification

Automation runs adhere to a deterministic finite state machine:
`pending` -> `sending` -> `sent` | `skipped` | `failed` | `unknown_delivery`.

- Illegal transitions (e.g. `sent` -> `pending`) throw `InvalidStateTransitionError`.
- Worker crashes, gateway timeouts, or Meta generic code 1 map directly to `unknown_delivery` (never auto-resent).

---

## 5. Adapter Interfaces

Channels implement `ChannelAdapter` (`verifyAndParse`, `normalize`, `send`, `replyPublicly`, `connectUrl`, `completeConnect`, `refreshCredentials`). Destinations implement `DestinationProvider` (`list`, `resolve`). Adding a channel or destination requires adding one folder and one registry line.

---

## 6. Configuration & Branding Model

All business parameters reside exclusively in `src/config/business.config.ts`, validated via Zod (`brand`, `channels`, `destinations`, `limits`, `templates`). Zero brand terms exist in core or modules.

---

## 7. Security & Compliance Architecture

1. **Token Protection:** AES-256-GCM encrypted tokens at rest. Never exposed to browser.
2. **Signature Verification:** Raw body HMAC-SHA256 with `crypto.timingSafeEqual`.
3. **Data Retention:** Automated GDPR cleanup scrubs usernames, IDs, and comment text.
4. **Bot Filtering:** Social preview crawlers filtered before incrementing link click counts.
5. **URL Allowlist:** Destination URLs require HTTPS and reject public shorteners.

---

## 8. Dependency Justification

| Dependency                    | Purpose             | Justification                                                   |
| :---------------------------- | :------------------ | :-------------------------------------------------------------- |
| `next`, `react`, `react-dom`  | Web & API framework | Standard App Router; provides server actions & `after()` kick   |
| `zod`                         | Input validation    | Parse, do not trust: strict validation of webhooks, env, config |
| `@supabase/supabase-js`       | Database client     | Connects to Postgres with RLS and executes `claim_pending_runs` |
| `lucide-react`, `tailwindcss` | Minimal dashboard   | Accessible, lightweight styling and dashboard UI                |
| `vitest`                      | Test runner         | Native ESM TypeScript test runner with ultra-fast execution     |

Zero Redis. Zero BullMQ. Zero always-on container expenses.
