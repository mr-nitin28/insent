# Comprehensive Audit of Reference Repositories

This document audits the four reference open-source projects for Instagram comment-to-DM automation:
1. `instachat-main`
2. `instagram-comment-to-dm-main` (CampaignCue)
3. `insta-p8-main`
4. `openreply-main`

---

## 1. Per-Repository Deep Dive

### 1.1 `instachat-main`
- **Stack & Structure:** Next.js 16 (App Router), React 19, Supabase (PostgreSQL), Tailwind CSS v4, TypeScript 5. Minimal dependencies (zero Redis, zero BullMQ). Structure: `app/api/` (cron, media, oauth, webhook), `lib/` (ig, process, queue, engine, matching, messages, crypto, env), `supabase/` (`schema.sql`, `cron.sql`).
- **License:** MIT (Copyright (c) 2026 Chutzpah-Clickesef).
- **Main Features:** Comment-to-DM private replies, optional randomized public replies, story reply handling, basic DM triggers, quick reply buttons with 24-hour window tracking, scheduled followups.
- **Webhook Reception & Signature Verification:** `POST /api/webhook` reads raw request body via `req.text()`, verifies `X-Hub-Signature-256` using `crypto.timingSafeEqual` with buffer length check. Returns 200 immediately and schedules queue drainage via Next.js `after()`.
- **Token Storage & Refresh:** Tokens stored in plain text in `config.access_token`. Implements token refresh via `GET /refresh_access_token?grant_type=ig_refresh_token` against `graph.instagram.com/v25.0`.
- **Queueing & Sending:** Ingestion inserts into Postgres table `queue`. Queue claimed atomically via Postgres RPC `claim_queue(batch_size)` using `FOR UPDATE SKIP LOCKED`. Rate pacing (500 ms spacing), batch size 8.
- **Duplicates & Idempotency:** Partial unique index `queue_private_reply_once` on `queue(comment_id) WHERE kind = 'private_reply'` prevents duplicate enqueueing.
- **Rules & Limits:** Enforces hourly cap (200 sends/hr) by counting `queue` table sends in the past hour. Drops own comments (`commenterId === config.ig_user_id`).
- **Tenant Isolation:** Hardcoded single-tenant! Table `config` is pinned to `id = 1` (`check (id = 1)`). RLS enabled with no policies (accessible exclusively via `service_role`).
- **Coupling & Dependencies:** Zero billing code. Zero external queue systems (no Redis). Very low operational cost.
- **Security Smells:** Plain text access tokens at rest. `requeue_stale()` marks stuck `sending` rows back to `pending`, risking duplicate DMs if worker died mid-send.
- **Test Coverage:** Zero automated tests.

---

### 1.2 `instagram-comment-to-dm-main` (CampaignCue)
- **Stack & Structure:** Next.js 16 (App Router), Prisma ORM, PostgreSQL, BullMQ, ioredis, NextAuth v5, Stripe SDK, Vitest. Structure: `app/api/` (admin, auth, automations, billing, webhook, etc.), `lib/` (meta, queue, utils, billing, tracking, ops), `worker/` (`dm-worker.ts`), `prisma/`.
- **License:** MIT (Copyright (c) 2026 Anish Raj).
- **Main Features:** Instagram comment-to-DM, tracked link generation and click logging, multi-tenant workspace management, Stripe subscription and usage enforcement.
- **Webhook Reception & Signature Verification:** `POST /api/webhook` reads `req.text()`, checks signature with `timingSafeEqual`. Stores raw event in `WebhookEvent` table, enqueues to BullMQ (`getDMQueue().add("process-comment")`).
- **Token Storage & Refresh:** Tokens stored encrypted (AES-256-GCM in `decryptToken`). Long-lived exchange and refresh implemented.
- **Queue & Sending:** BullMQ queue requiring Redis instance. Requires standalone always-on worker process (`tsx worker/dm-worker.ts`). Sliding window rate limiter in Redis.
- **Duplicates & Idempotency:** Unique constraint `@@unique([automationId, commentId])` in `DmLog`. **Flaw:** If multiple automations match one comment, or an automation is recreated, it can trigger multiple private replies to the same comment, violating Meta's one-reply policy.
- **Rules & Limits:** Redis sliding-window hourly limiter. Loops through all matched rules and attempts sends for all.
- **Tenant Isolation:** Multi-tenant database schema (`Workspace`, `WorkspaceMember`), but tenant isolation enforced at application query level without Postgres Row Level Security (RLS).
- **Coupling & Dependencies:** Stripe billing and plan quota checks (`reserveWorkspaceDMSend`) directly coupled inside the queue worker send loop. Requires Redis and always-on worker container ($20-50/month base cost).
- **Security Smells:** Secrets names confusingly reference `FACEBOOK_APP_SECRET` rather than Instagram Login configuration.
- **Test Coverage:** Moderate (13 Vitest test suites covering matcher, OAuth, rate-limiter, webhook, billing).

---

### 1.3 `insta-p8-main`
- **Stack & Structure:** Next.js 16 (App Router), Supabase, Radix UI / shadcn, Groq SDK, Lucide. Structure: `app/api/` (automations, groq, ice-breakers, inbox, instagram), `components/`, `lib/` (instagram-api, ai-reply, etc.).
- **License:** MIT (Copyright (c) 2026 flexhunt).
- **Main Features:** Comment-to-DM, follow-gate check (`is_user_follow_business`), Groq LLM-powered automatic replies, rich card templates, typing indicators.
- **Webhook Reception & Signature Verification:** Accepts either `INSTAGRAM_APP_SECRET` or `META_APP_SECRET`. Includes dangerous bypass flag `DISABLE_WEBHOOK_SIGNATURE_CHECK`. Ingests and executes sends synchronously in-band inside the POST handler!
- **Token Storage & Refresh:** Tokens stored in plain text in Supabase. Token refresh partially implemented.
- **Queue & Sending:** Zero queue! Direct in-band API calls inside the webhook handler with `sleep(delaySeconds * 1000)` and typing indicators. Violates Meta webhook 20s timeout requirement.
- **Duplicates & Idempotency:** None. A duplicate or retried webhook re-runs execution and sends duplicate messages.
- **Rules & Limits:** No hourly or rate cap.
- **Tenant Isolation:** Single-user / creator assumptions mixed with Supabase auth.
- **Coupling & Dependencies:** Groq AI and follow gating mixed into core handler.
- **Security Smells:** `/* @ts-nocheck */` atop 893-line webhook handler, signature check bypass flag, plaintext tokens, unhandled execution timeouts.
- **Test Coverage:** Zero tests.

---

### 1.4 `openreply-main`
- **Stack & Structure:** Next.js 16 (App Router), Prisma, BullMQ, ioredis, NextAuth v5, Vitest. Structure: `app/`, `lib/` (instagram, queue, utils, tracking, zernio), `worker/`.
- **License:** MIT (Copyright (c) 2026 Anish Raj & Diwen Huang).
- **Main Features:** Follow-gate check with delayed re-checks, comment-to-DM, tracked links, robust delivery error classification, production-hardened keyword matcher.
- **Webhook Reception & Signature Verification:** HMAC-SHA256 verification against raw body, BullMQ job enqueueing.
- **Token Storage & Refresh:** AES-256-GCM token encryption, token refresh supported.
- **Queue & Sending:** BullMQ + Redis worker with backoff retry strategy.
- **Duplicates & Idempotency:** `claimCommentDelivery` helper and BullMQ job ID deduplication.
- **Delivery Classification (Key Contribution):** Critical production insight: distinguishes confirmed rejections (e.g. rate limit 368, token expired 190, permissions 100/200) from `unknown_delivery` (Meta code 1, timeouts, 5xx). Meta often delivers DMs even when returning code 1; auto-retrying code 1 sends dozens of duplicate DMs to the same recipient.
- **Keyword Matching (Key Contribution):** Production-tested Unicode-aware matching using `(?<![\p{L}\p{N}])...(?![\\p{L}\\p{N}])` with `u` flag. Latin diacritic folding (`foldDiacritics`) without destroying Devanagari vowel signs (`\p{M}`), Arabic script canonicalization, numeric-like O/0 homoglyph folding.
- **Coupling & Dependencies:** Requires Redis and always-on worker container.
- **Test Coverage:** Comprehensive Vitest tests.

---

## 2. Cross-Repository Comparison Table

| Dimension | `instachat` | `instagram-comment-to-dm` | `insta-p8` | `openreply` | **ANOZIK SOCIAL CONNECT (Target)** |
| :--- | :--- | :--- | :--- | :--- | :--- |
| **Login Flow** | Instagram API with Instagram Login (`graph.instagram.com`) | Facebook Login for Business (`graph.facebook.com`) | Instagram Login (`graph.instagram.com`) | Instagram Login + Facebook Graph mix | **Instagram API with Instagram Login (`graph.instagram.com`)** |
| **Graph API Version** | Pinned `v25.0` (speculative) | Dynamic env, defaults `v21.0` | Pinned `v21.0` | Dynamic env, defaults `v21.0` | **Configurable env, default official baseline (`v22.0`)** |
| **Webhook Signature** | Constant-time `timingSafeEqual` on raw body | `timingSafeEqual` on raw body | `timingSafeEqual` on raw body, has bypass flag | `timingSafeEqual` on raw body | **Strict constant-time HMAC-SHA256, no bypass flag** |
| **Token Storage** | Plain text in DB | AES-256-GCM encrypted | Plain text in DB | AES-256-GCM encrypted | **AES-256-GCM encrypted with key from env, never browser-readable** |
| **Token Refresh** | Refresh endpoint called on cron | Implemented via helper | Incomplete | Implemented via helper | **Automated scheduled token refresh with expiry tracking** |
| **Queue Architecture** | Postgres `SKIP LOCKED` (zero external queue) | BullMQ + Redis + standalone worker | In-band synchronous (no queue) | BullMQ + Redis + standalone worker | **Postgres `FOR UPDATE SKIP LOCKED` (zero Redis, low cost, serverless-friendly)** |
| **Duplicate Guard** | Partial unique index on `queue (comment_id)` | Unique `(automationId, commentId)` (flawed) | None (duplicate webhooks double-send) | BullMQ job deduplication | **Unique constraint `(account_id, comment_id)` at DB level** |
| **1-Reply Policy** | Strictly enforced by unique partial index | Violated if multiple automations match | Not enforced | Enforced in worker logic | **Guaranteed: exactly 1 rule matched per comment, unique DB constraint** |
| **7-Day Window** | Not checked in worker | Not checked in worker | Not checked in worker | Not checked in worker | **Checked in worker: comments > 6.5 days rejected with reason** |
| **Hourly Account Cap** | Yes (counts rows in last hour) | Yes (Redis sliding window) | No | Yes (Redis sliding window) | **Yes (tracked in DB table / throttle logic, delay when capped)** |
| **Loop Guard** | Drops `from.id == account.id` | Drops `from.id == account.id` | Drops `from.id == account.id` | Drops `from.id == account.id` | **Drops own comments AND drops comment replies (V1)** |
| **Multi-Tenancy** | None (single tenant `id = 1`) | Application-level `workspaceId` (no RLS) | Minimal / single user | Application-level `workspaceId` (no RLS) | **Full multi-tenancy: `workspace_id` + Supabase RLS on all tables** |
| **Billing Coupling** | None | High (Stripe reservation inside worker) | None | Medium (workspace usage checks) | **Zero billing in core (pluggable via config/destinations)** |
| **Hidden Costs** | Free/cheap (runs within Vercel + Supabase) | Expensive (requires Redis + always-on worker) | Cheap (but breaks under traffic) | Expensive (requires Redis + always-on worker) | **Free/cheap ($0 idle cost: serverless Next.js + Supabase)** |
| **Error Classification** | Basic 4xx vs 5xx | Maps Meta codes to error classes | Logs error to console | Deep: separates confirmed rejections from `unknown_delivery` | **Deep classification: timeouts & crashes -> `unknown_delivery`, never auto-resent** |
| **Matching Engine** | Basic substring / exact | Word match with basic regex | Substring with regex | Sophisticated Unicode, diacritics & Devanagari support | **Unicode NFKC, Devanagari safe, Latin diacritics, exact/word/contains** |
| **Test Coverage** | 0 tests | 13 test suites | 0 tests | Comprehensive tests | **100% core domain coverage, adapter mock tests, E2E simulated test** |

---

## 3. Findings on Specific Architectural Points

1. **Login Flow:** Older repos mix Facebook Graph API (`graph.facebook.com`) and page-linked accounts. Modern Meta rules require "Instagram API with Instagram Login" (`graph.instagram.com` with `instagram.com/oauth/authorize`), which does not require a Facebook Page or Facebook App Review for basic creator testing.
2. **Graph API Version:** Meta Graph API is currently `v21.0` / `v22.0`. Pinned versions must be controlled via an environment variable (`META_GRAPH_API_VERSION`), isolated in a single API client module.
3. **Webhook Verification:** Signature verification must always consume the unparsed raw request body string. Re-stringifying parsed JSON will fail or introduce vulnerabilities. Comparison must use `crypto.timingSafeEqual` with matching buffer lengths.
4. **Token Encryption:** Storing access tokens in plain text (`instachat`, `insta-p8`) is an unacceptable security hazard. AES-256-GCM encryption with an environment encryption key (`TOKEN_ENCRYPTION_KEY`) must protect tokens at rest.
5. **Idempotency & One-Reply Rule:** Meta strictly enforces one private reply per comment. CampaignCue's `(automationId, commentId)` unique constraint is flawed because two automations matching the same comment will attempt two sends. The database unique constraint must be `(account_id, comment_id)`.
6. **7-Day Window:** Meta rejects private replies to comments older than 7 days. The worker must evaluate comment timestamp and gracefully skip comments older than 6.5 days to avoid Meta API errors.
7. **Loop Guard:** In addition to checking if the commenter is the account itself, V1 must drop comment replies (comments with a `parent_id`), responding only to top-level comments to prevent feedback loops.
8. **Tenant Isolation:** Multi-tenancy must be enforced at the database level using Supabase Postgres Row-Level Security (RLS) linked to `workspace_id`, rather than relying solely on application-level `where` clauses.
9. **Billing Decoupling:** Core messaging and ingestion pipelines must not import Stripe or billing models. Business limits must be injected via `src/config/business.config.ts`.
10. **Zero External Queues:** BullMQ and Redis add unnecessary infrastructure cost ($15–$50/mo) and maintenance overhead. Postgres `FOR UPDATE SKIP LOCKED` natively provides atomic, non-blocking queue leasing suitable for high-throughput serverless architectures.
11. **Delivery Classification:** Worker crashes, timeouts, or Meta generic code 1 errors must transition to `unknown_delivery` and must **never** be auto-retried, avoiding inbox spam storms.

---

## 4. KEEP the Idea, REJECT the Pattern

### KEEP the Idea:
- **`instachat-main` — Postgres `SKIP LOCKED` queueing:** Eliminates Redis and background workers by leveraging relational database concurrency primitives.
- **`instachat-main` — Next.js `after()` queue kick:** Returns HTTP 200 to Meta immediately while initiating asynchronous background sending without holding the HTTP connection.
- **`openreply-main` — `unknown_delivery` error classification:** Treats ambiguous send responses as unconfirmed rather than retrying, preventing duplicate DM spam storms.
- **`openreply-main` — Unicode & Devanagari safe keyword matcher:** Preserves combining marks (`\p{M}`) for non-Latin scripts (Hindi, Devanagari) while folding Latin diacritics.
- **`openreply-main` & `instagram-comment-to-dm-main` — AES-256-GCM token encryption:** Keeps third-party OAuth access tokens encrypted at rest.
- **`instagram-comment-to-dm-main` — Tracked link redirector:** Distinguishes preview crawler bots from human clicks and measures campaign conversion.

### REJECT the Pattern:
- **`instachat-main` — Single-tenant hardcoded schema (`id = 1`):** Rejected because platform must serve multiple creator workspaces seamlessly.
- **`instachat-main` — Stale job reset directly to pending:** Rejected because re-sending after worker crash causes duplicate messages; must transition to `unknown_delivery`.
- **`instachat-main` & `insta-p8-main` — Plain text access tokens:** Rejected due to severe data leak risk if database backups or snapshots are compromised.
- **`instagram-comment-to-dm-main` — Redis + BullMQ infrastructure dependency:** Rejected to minimize moving parts, eliminate server maintenance, and keep hosting costs near zero.
- **`instagram-comment-to-dm-main` — `(automationId, commentId)` unique constraint:** Rejected because it allows multiple automations to double-reply to one comment.
- **`instagram-comment-to-dm-main` — Stripe billing intertwined in worker logic:** Rejected to keep core messaging clean, modular, and reusable across business models.
- **`insta-p8-main` — In-band synchronous sending in webhook POST:** Rejected because network latency and sleep delays trigger Meta 20s timeout and webhook retry storms.
- **`insta-p8-main` — `DISABLE_WEBHOOK_SIGNATURE_CHECK` bypass and `@ts-nocheck`:** Rejected as unacceptable engineering and security practices.
- **All 4 Repos — Hardcoded platform semantics:** Rejected; core domain must remain pure and isolate channel logic behind `ChannelAdapter` and destination logic behind `DestinationProvider`.
