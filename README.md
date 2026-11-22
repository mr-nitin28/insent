# INSENT — Universal Instagram Automation Platform (Insta-Auto)

<div align="center">

[![TypeScript](https://img.shields.io/badge/TypeScript-5.9-blue.svg?style=flat-square&logo=typescript)](https://www.typescriptlang.org/)
[![Next.js](<https://img.shields.io/badge/Next.js-16.2_(App_Router)-black.svg?style=flat-square&logo=next.js>)](https://nextjs.org/)
[![React](https://img.shields.io/badge/React-19.2-61dafb.svg?style=flat-square&logo=react)](https://react.dev/)
[![Supabase](https://img.shields.io/badge/Supabase-PostgreSQL_RLS-3ECF8E.svg?style=flat-square&logo=supabase)](https://supabase.com/)
[![Tailwind CSS](https://img.shields.io/badge/Tailwind_CSS-v4.0-38B2AC.svg?style=flat-square&logo=tailwind-css)](https://tailwindcss.com/)
[![Vitest](https://img.shields.io/badge/Tests-73%20Passing-brightgreen.svg?style=flat-square&logo=vitest)](https://vitest.dev/)
[![Meta Graph API](https://img.shields.io/badge/Meta_Graph_API-v22.0-0081FB.svg?style=flat-square&logo=meta)](https://developers.facebook.com/docs/instagram-platform)
[![License](https://img.shields.io/badge/License-MIT-purple.svg?style=flat-square)](LICENSE)

**A modular, high-performance, universal social engagement and automation engine for Instagram.**  
Turns comments on Reels, Posts, and Carousels into personalized direct messages, dynamic shortlinks, and verifiable sales conversions.

[Architecture](#-universal-architecture-by-design) •
[Key Features](#-core-platform-features) •
[Quickstart](#-15-minute-local-quickstart) •
[Adaptation Guide](#-adapting-to-any-business-model) •
[Meta Compliance](#-meta-compliance--anti-spam-guardrails) •
[Documentation](#-in-depth-documentation)

</div>

---

## 💡 What is INSENT?

**INSENT** (Universal Insta-Auto) is an enterprise-ready, open-architecture Instagram Comment-to-DM and engagement automation engine. Unlike brittle scripts or single-brand bots, INSENT is engineered as a **truly universal automation backbone** that can be deployed for **any business, creator, agency, e-commerce brand, or SaaS** with zero core code changes.

Built from first principles on Meta's official **Instagram Graph API with Instagram Login** standards:

- 💰 **$0 Idle Compute Cost:** Replaces heavy Redis/BullMQ clusters with atomic PostgreSQL `FOR UPDATE SKIP LOCKED` queues.
- 🛡️ **Zero Spam Bans:** Anti-spam Spintax generator, strict 6.5-day messaging window filters, loop guards, and an idempotent crash-proof state machine.
- 🎯 **Pinpoint Targeting:** Global account-wide triggers or post-specific campaigns selected via a visual Meta Media Picker.
- 🔒 **Zero Data Leakage:** Built-in multi-tenancy backed by Supabase PostgreSQL Row-Level Security (RLS) on every table.
- 📈 **Full-Funnel Attribution:** Built-in click shortener `/r/[code]`, bot detection, and conversion tracking tied directly to individual comments and reels.

---

## 🌟 Universal Architecture by Design

INSENT is architected with strict hexagonal separation of concerns: **the pure domain core knows nothing about the database, network, or brand identity.**

```
┌────────────────────────────────────────────────────────────────────────┐
│                   WEBHOOK INGESTION (Next.js Edge)                     │
│  Meta Webhook POST ──> HMAC-SHA256 Signature Verify (timingSafeEqual)   │
│                    ──> Loop & Self-Comment Filter (Drop bot loops)     │
│                    ──> Pure In-Memory Keyword Matcher                  │
│                    ──> Idempotent DB Write (UNIQUE account + comment)  │
│                    ──> Fast Return HTTP 200 OK (< 200ms)               │
└───────────────────────────────────┬────────────────────────────────────┘
                                    │ Non-blocking trigger / cron
                                    ▼
┌────────────────────────────────────────────────────────────────────────┐
│             ATOMIC QUEUE ENGINE (Supabase / PostgreSQL)                │
│    Zero Redis / BullMQ ──> claim_pending_runs() [FOR UPDATE SKIP LOCKED]│
│                        ──> reap_stuck_runs()   [Orphan sweeper > 5m]   │
└───────────────────────────────────┬────────────────────────────────────┘
                                    │ Leased execution batch
                                    ▼
┌────────────────────────────────────────────────────────────────────────┐
│                 WORKER PIPELINE & DISPATCH ENGINE                      │
│   • Throttle & Rate Guard  (Enforces per-account hourly limit)         │
│   • 6.5-Day Window Check   (Drops comments older than Meta policy)     │
│   • Spintax Parser         ({Hey|Hi|Hello} anti-spam variety)          │
│   • Shortlink Generator    (Resolves destination -> generates /r/code) │
│   • Meta API Client        (Sends private DM via Graph API v22.0)      │
│   • Result Classifier      (sent | retry | unknown_delivery)           │
└───────────────────────────────────┬────────────────────────────────────┘
                                    │
                                    ▼
┌────────────────────────────────────────────────────────────────────────┐
│              CLICK ATTRIBUTION & CONVERSION FUNNEL                     │
│  User Clicks /r/[code] ──> Bot Filter (Drop crawlers)                  │
│                        ──> SHA-256 IP Hash + User-Agent logged         │
│                        ──> 302 Redirect to Destination URL             │
│                        ──> Conversion logged & attributed to run       │
└────────────────────────────────────────────────────────────────────────┘
```

### Architectural Invariants

1. **Pure Core (`src/core/`):** 100% pure functions (matching, status machine, spintax parsing, throttling algorithms). Zero database calls, zero fetch requests, zero external dependencies.
2. **Pluggable Channels (`src/channels/`):** Implements `ChannelAdapter`. Swap or add Instagram, Threads, Facebook, or TikTok without touching business services.
3. **Pluggable Destinations (`src/destinations/`):** Implements `DestinationProvider`. Built-in `custom-url` maps to any external shop, Calendly, or Stripe checkout.
4. **Single Source of Business Truth (`src/config/business.config.ts`):** Complete brand identity, channel limits, and default templates live in one strongly-typed Zod configuration.
5. **Strict File & Boundary Budgets:** No file exceeds 250 lines; zero circular dependencies enforced automatically by `scripts/check-dependencies.ts`.

---

## ⚡ Core Platform Features

### 1. Zero Redis, Zero BullMQ ($0 Idle Cost)

Traditional automation systems require constantly-running Redis, Celery, or BullMQ servers. INSENT leverages PostgreSQL's native **`FOR UPDATE SKIP LOCKED`** concurrency primitive:

- Multiple serverless instances claim non-overlapping run batches atomically.
- Zero race conditions, zero duplicate sends, and **$0 idle server costs**.
- Handled via custom SQL functions: `claim_pending_runs(batch_size)` and `reap_stuck_runs(timeout_seconds)`.

### 2. Meta Compliance & Anti-Spam Guardrails

- **Recursive Spintax Engine:** Write templates like `{Hey|Hi|Hello} @{username}! {Here is|Check out} your link: {link}` to generate thousands of unique phrasing combinations, protecting your Instagram accounts from automated spam flags.
- **Strict 6.5-Day Messaging Window:** Automatically validates comment timestamps against `maxCommentAgeSeconds: 561600` (6.5 days) to ensure strict adherence to Meta's 7-day API policy before attempting dispatch.
- **Rate Limit & Throttling Caps:** Enforces strict per-account hourly limits (default: 600 DMs/hr) and per-rule daily limits.
- **Loop Guards:** Automatically drops comments authored by the connected account itself and ignores comment replies, eliminating bot-on-bot recursion loops.
- **Mandatory Compliance Disclosure:** Appends customizable automated response disclaimers to outgoing DMs.

### 3. Post-Specific & Global Automation Scoping

- **Global Scope:** Run automation across every Reel, Feed Post, and Carousel on the connected account.
- **Post-Specific Targeting:** Restrict an automation rule to a single post or reel using the integrated visual **Meta Media Picker** or by pasting an Instagram Post URL.

### 4. Advanced Unicode & Multilingual Matching Engine

The matching engine normalizes input strings with full international awareness:

- **Unicode NFKC normalization:** Standardizes full-width and compatibility characters.
- **Latin diacritic folding:** Matches `crème` with `creme`, `café` with `cafe`.
- **Script preservation:** Accurately retains Devanagari, Thai, Arabic, and other non-Latin combining marks.
- **Emoji and edge punctuation stripping:** Cleans noise while preserving internal message structure.
- **3 Match Modes:** `exact`, `whole_word`, and `contains`.
- **Deterministic Collision Resolution:** Priority score -> Match strictness (`exact` > `whole_word` > `contains`) -> Earliest keyword character index.

### 5. Crash-Resilient State Machine

Every automation run executes within a deterministic Finite State Machine:
`pending` ➔ `sending` ➔ `sent` | `skipped` | `failed` | `unknown_delivery`.

- **Ambiguous Meta Delivery Protection:** If a network timeout, gateway 504, or generic Meta code 1 error occurs during dispatch, the run transitions to `unknown_delivery` and is **never auto-retried**, completely eliminating catastrophic double-DM spam storms.
- **Orphan Job Reaper:** Runs left in `sending` for > 5 minutes (due to unhandled worker termination) are automatically swept and marked `unknown_delivery`.
- **Instant Kill Switches:** Global and per-workspace kill switches can instantly halt all outgoing messaging in under 1 second.

### 6. Built-in Link Tracking & Conversion Attribution

- Built-in high-throughput shortlink redirector at `/r/[code]`.
- Bot filtering for known crawlers (Googlebot, Meta, Twitterbot, etc.).
- GDPR-friendly anonymized tracking using SHA-256 IP hashing + User-Agent parsing.
- Full conversion attribution: associate downstream sales, signups, or bookings directly with the originating comment, reel, and automation rule.

---

## 📁 Project Directory Structure

```
insent/
├── .github/workflows/       # CI verification pipeline (typecheck, lint, test, build)
├── docs/                    # Deep-dive architecture and operational guides
│   ├── ADAPTING.md          # Multi-business adaptation guide with 3 case studies
│   ├── ARCHITECTURE.md      # Detailed system specifications and boundary rules
│   ├── AUDIT.md             # Analysis of reference projects & architectural pitfalls
│   ├── META_API_NOTES.md    # Meta Graph API v22 baseline notes & permissions
│   ├── RUNBOOK.md           # Operational runbook, incident triage, and kill switches
│   └── FUTURE.md            # Roadmap, channel expansions, and backlog
├── scripts/
│   ├── check-dependencies.ts # Enforces zero circular deps & pure core boundary
│   ├── seed.ts              # Seeds sample workspaces, accounts, rules, and runs
│   └── simulate-webhook.ts  # End-to-end pipeline simulator (zero Meta credentials needed)
├── src/
│   ├── app/                 # Next.js 16 App Router endpoints & Creator Dashboard
│   │   ├── api/
│   │   │   ├── accounts/    # Social account management & media picker endpoints
│   │   │   ├── automations/ # Rule CRUD & post-scope configuration
│   │   │   ├── cron/        # Scheduled worker triggers
│   │   │   ├── dashboard/   # Real-time analytics, queue depth & stats
│   │   │   ├── oauth/       # Meta Instagram Login OAuth handshake & token exchange
│   │   │   ├── settings/    # Emergency kill-switch API
│   │   │   ├── webhooks/    # Instagram webhook ingestion (HMAC validation)
│   │   │   └── worker/      # Queue drain & job batch processing
│   │   ├── components/      # Responsive UI components (Media picker, rules, stats)
│   │   └── r/[code]/        # High-performance click redirector & attribution engine
│   ├── channels/            # Channel adapters (Instagram Graph API, AES-256-GCM crypto)
│   ├── config/              # business.config.ts (the ONLY brand file) & env.ts
│   ├── core/                # PURE domain logic: matching, rules, templates, throttle, FSM
│   ├── destinations/        # Destination providers (custom-url, anozik, etc.)
│   ├── lib/                 # Supabase client helpers & workspace context
│   └── modules/             # Business services: accounts, automations, runs, links, retention
├── supabase/migrations/     # 0001_init.sql (Postgres schema, RLS policies, SKIP LOCKED queue)
└── tests/                   # 73 unit, integration, RLS security, and burst test suites
```

---

## 🚀 15-Minute Local Quickstart

### Prerequisites

- **Node.js**: `>= 20.0.0`
- **Package Manager**: `pnpm` (`npm install -g pnpm`)
- **Database**: A free [Supabase](https://supabase.com) project or local PostgreSQL instance.

---

### Step 1: Clone & Install Dependencies

```bash
git clone https://github.com/mr-nitin28/insent.git
cd insent
pnpm install
```

---

### Step 2: Configure Environment Variables

Create your local `.env.local` from the example template:

```bash
cp .env.example .env.local
```

Configure the following values in `.env.local`:

```env
# App Environment
NODE_ENV=development
NEXT_PUBLIC_APP_URL=http://localhost:3000

# Meta Instagram Graph API
META_GRAPH_API_VERSION=v22.0
INSTAGRAM_APP_ID=your_instagram_app_id
INSTAGRAM_APP_SECRET=your_instagram_app_secret
INSTAGRAM_WEBHOOK_VERIFY_TOKEN=your_custom_webhook_verify_token

# Security: 32-byte hex string (64 characters) for AES-256-GCM token encryption at rest
TOKEN_ENCRYPTION_KEY=0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef

# Internal Cron / Worker Secret
INTERNAL_CRON_SECRET=your_internal_cron_secret

# Supabase PostgreSQL Configuration
NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your_supabase_anon_key
SUPABASE_SERVICE_ROLE_KEY=your_supabase_service_role_key
```

> **Generating a Secure Encryption Key:**
> Run `node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"` to create a valid 64-character hex key.

---

### Step 3: Run Database Migrations

Open the **SQL Editor** in your Supabase dashboard and execute the SQL file:

```sql
-- Run the contents of supabase/migrations/0001_init.sql
```

This creates the tables (`workspaces`, `social_accounts`, `automation_rules`, `automation_runs`, `tracked_links`, `app_settings`), configures Row-Level Security (RLS), and installs the `claim_pending_runs` and `reap_stuck_runs` queue functions.

---

### Step 4: Seed Development Data

Seed a development workspace with demo accounts, sample rules, and test runs:

```bash
pnpm seed
```

---

### Step 5: Start Local Development Server

```bash
pnpm dev
```

Navigate to **[http://localhost:3000](http://localhost:3000)** to access the Creator Operations Dashboard:

- Review connected Instagram accounts.
- Inspect active and paused automation rules.
- Test post-specific automations with live/mock media.
- Monitor real-time queue depth and execution telemetry.

---

### Step 6: Simulate the End-to-End Pipeline (No Meta Account Needed!)

INSENT includes a built-in offline pipeline simulator. It signs mock Instagram webhook events using HMAC-SHA256, verifies signatures, executes normalization, resolves keyword matching, writes to PostgreSQL, and invokes the worker drain:

```bash
pnpm simulate
```

You will see the complete simulation output:

```
🚀 INSENT Pipeline Simulation Starting...
  Step 1: HMAC Signature verification... [PASSED]
  Step 2: Normalizing inbound comment payload... [PASSED]
  Step 3: Checking loop guards (self-comment & replies)... [PASSED]
  Step 4: Evaluating keyword matching rules... [MATCHED]
  Step 5: Writing idempotent run to PostgreSQL... [INSERTED]
  Step 6: Executing worker queue via FOR UPDATE SKIP LOCKED... [CLAIMED]
  Step 7: Parsing spintax & rendering template... [RENDERED]
  Step 8: Simulating dispatch & status transition... [SENT]
✨ Full pipeline simulation completed successfully with zero errors!
```

---

### Step 7: Run Full Verification Suite

Run all automated checks before deploying:

```bash
pnpm verify
```

This single command executes:

1. `pnpm typecheck` — Strict TypeScript compilation (`noEmit`).
2. `pnpm lint` — ESLint 9 checks for Next.js App Router.
3. `pnpm format:check` — Prettier code style validation.
4. `pnpm check-deps` — Boundary check: 0 circular dependencies, 100% pure core domain, and < 250 line file limit.
5. `pnpm test` — 73 automated Vitest tests (unit, integration, RLS security, burst traffic).
6. `pnpm build` — Full Next.js production compilation.

---

## 🛠️ Adapting to Any Business Model

INSENT was created to be adapted to **any business model or niche in under 15 minutes** simply by modifying `src/config/business.config.ts`. The core automation engine remains 100% untouched.

```typescript
// src/config/business.config.ts
import { businessConfigSchema, type BusinessConfig } from "./types";

export const defaultBusinessConfig: BusinessConfig = businessConfigSchema.parse({
  brand: {
    name: "YourBrand",
    domain: "yourbrand.com",
    supportEmail: "support@yourbrand.com",
  },
  channels: {
    enabled: ["instagram"],
    defaultChannel: "instagram",
  },
  destinations: {
    enabled: ["custom-url"],
    defaultProvider: "custom-url",
  },
  templates: {
    defaultCommentDm: "{Hey|Hi|Hello} @{username}! 🎁 {Here is|Grab} your link: {link}",
    defaultPublicReply: "Sent to your DMs! Check message requests if you don't follow us. ✨",
    disclosureText: "Automated response via YourBrand Social Connect.",
  },
  limits: {
    hourlyCapPerAccount: 600, // Max DMs per hour per account
    dailyCapPerRule: 5000, // Max triggers per rule daily
    maxSendAttempts: 4, // Exponential backoff retry ceiling
    retentionDays: 30, // Auto-delete processed runs older than 30 days
    maxMessageLength: 1000, // Meta character safety ceiling
    maxCommentAgeSeconds: 561600, // 6.5 days in seconds
  },
  features: {
    enablePublicReplies: true,
    enableLinkTracking: true,
    enableBotFiltering: true,
    enableDataRetentionCleanup: true,
  },
});
```

### Use Case Configurations

| Use Case                   | Recommended Destination Provider        | Typical Keywords                 | Example Template                                                        |
| :------------------------- | :-------------------------------------- | :------------------------------- | :---------------------------------------------------------------------- |
| **DTC E-Commerce**         | `custom-url` (Shopify / WooCommerce)    | `BUY`, `PRICE`, `SIZE`, `LINK`   | `{Hey                                                                   | Hi} @{username}! 🛍️ Here is the direct checkout link: {link}` |
| **Creators & Influencers** | `custom-url` (Gumroad / Stan / Beacons) | `FREE`, `GUIDE`, `PRESET`, `PDF` | `Hey @{username}! 🚀 Download your free guide here: {link}`             |
| **Consultants & Coaches**  | `custom-url` (Calendly / Cal.com)       | `CALL`, `GROWTH`, `APPLY`        | `Hello @{username}, schedule your 1-on-1 strategy session here: {link}` |
| **SaaS & Agencies**        | `custom-url` (Demo / Signup)            | `DEMO`, `ACCESS`, `SCALE`        | `Hi @{username}! Claim your exclusive beta access link: {link}`         |

_(See [docs/ADAPTING.md](docs/ADAPTING.md) for full walkthroughs of each vertical)._

---

## 🛡️ Meta Compliance & Anti-Spam Guardrails

Operating automated messaging on Meta platforms requires strict adherence to the [Meta Platform Terms](https://developers.facebook.com/terms) and [Instagram Messaging Policy](https://developers.facebook.com/docs/instagram-platform/instagram-api-with-instagram-login/messaging-api). INSENT has these guardrails hardcoded at the architecture level:

### 1. The 7-Day / 24-Hour Messaging Window

- Meta permits automated direct messages in response to public comments **only within 7 days** of the comment creation timestamp.
- INSENT enforces an internal 6.5-day ceiling (`561600` seconds). Any comment older than 6.5 days is marked `skipped` with the reason `comment_exceeds_messaging_window`, preventing API errors and account penalties.

### 2. Spintax Randomization

- Sending identical repetitive text across hundreds of DMs triggers Meta's automated spam filters.
- INSENT includes a built-in recursive Spintax parser:
  ```text
  {Hey|Hi|Hello} @{username}! {Here is|Check out|Grab} the link: {link}
  ```
  Every recipient receives a uniquely randomized permutation.

### 3. Inbound Loop Suppression

- Automatically inspects the author of incoming comments. If `commenter_id == account_id`, the comment is discarded immediately.
- Filters out comment replies to prevent infinite recursive loops between automated bots.

### 4. Exponential Backoff & Unknown Delivery

- **Transient Failures (Rate Limits, HTTP 500):** Retried with exponential backoff up to 4 attempts.
- **Ambiguous Failures (Timeouts, HTTP 504, Meta Code 1):** Instantly marked `unknown_delivery`. These runs are **never** auto-retried to guarantee that a user is never sent a duplicate message.

### 5. Automated Response Disclosure

- All direct messages automatically append the configured transparency notice:
  ```text
  Automated response via YourBrand Social Connect.
  ```

---

## 🚢 Meta App Setup & Production Launch

To connect live Instagram accounts in production, set up a Meta Developer App:

### 1. Create a Meta Developer App

1. Go to the [Meta Developer Portal](https://developers.facebook.com/).
2. Click **Create App** and select **Other** ➔ **Business**.
3. Add the **Instagram** and **Webhooks** products to your app.

### 2. Configure Instagram Login & Webhooks

1. In the Instagram product settings, configure the OAuth Redirect URI:
   ```
   https://your-domain.com/api/oauth/callback
   ```
2. In Webhooks, select the **Instagram** category:
   - **Callback URL:** `https://your-domain.com/api/webhooks/instagram`
   - **Verify Token:** The value set in `INSTAGRAM_WEBHOOK_VERIFY_TOKEN`.
   - **Subscribe to fields:** `comments`, `messages`.

### 3. Required Meta Permissions

For full Comment-to-DM functionality, submit your app for App Review with the following permissions:

- `instagram_basic` — Access basic profile information.
- `instagram_manage_comments` — Read comments on posts and reply publicly.
- `instagram_manage_messages` — Send direct messages in response to comments.
- `pages_show_list` — Enumerate linked Facebook Pages (if using legacy Graph API).

---

## ⚡ Deployment Guide

### Deploying on Vercel

[![Deploy with Vercel](https://vercel.com/button)](https://vercel.com/new)

1. Push your repository to GitHub.
2. Import the project into Vercel.
3. Configure all environment variables from `.env.local` in your Vercel Project Settings.
4. Set up a Vercel Cron Job in `vercel.json` to drain the queue periodically:

```json
{
  "crons": [
    {
      "path": "/api/cron",
      "schedule": "* * * * *"
    }
  ]
}
```

### Self-Hosting (Docker / Node.js)

```bash
# Build the production application
pnpm build

# Start the Next.js server
pnpm start
```

Use any standard cron runner (e.g., system crontab, GitHub Actions, or Cloudflare Workers) to ping `/api/cron` every 30-60 seconds with the `x-cron-secret` header.

---

## 🧪 Comprehensive Verification & QA

| Command           | Description                                                                                                     |
| :---------------- | :-------------------------------------------------------------------------------------------------------------- |
| `pnpm verify`     | Full verification pipeline: typecheck, lint, format check, architecture rules, all 73 tests, and Next.js build. |
| `pnpm test`       | Runs the full Vitest suite (unit, integration, RLS security, burst traffic).                                    |
| `pnpm test:watch` | Starts Vitest in interactive watch mode for active TDD.                                                         |
| `pnpm simulate`   | Runs the local end-to-end pipeline simulator with signed payloads.                                              |
| `pnpm check-deps` | Verifies zero circular dependencies, pure core isolation, and file line limits.                                 |
| `pnpm typecheck`  | Strict TypeScript compilation check (`tsc --noEmit`).                                                           |
| `pnpm lint`       | ESLint 9 validation for Next.js App Router.                                                                     |
| `pnpm format`     | Auto-formats code with Prettier.                                                                                |
| `pnpm seed`       | Populates the database with local development seed data.                                                        |

---

## 📜 In-Depth Documentation

For complete technical specifications, see the dedicated documentation in the `docs/` folder:

- [Architecture Specification](docs/ARCHITECTURE.md) — Comprehensive design rules, invariants, and state machine diagrams.
- [Multi-Business Adaptation Guide](docs/ADAPTING.md) — Step-by-step guides for E-Commerce, Creators, and Agencies.
- [Meta Graph API Notes](docs/META_API_NOTES.md) — Technical notes on Graph API endpoints, payloads, and tokens.
- [Operational Runbook](docs/RUNBOOK.md) — Incident response, kill switches, queue monitoring, and recovery steps.
- [Repository Audit & Pitfalls](docs/AUDIT.md) — Audit of community alternatives and why SKIP LOCKED outclasses Redis queues.
- [Future Scope & Roadmap](docs/FUTURE.md) — Upcoming channel expansions and feature pipeline.

---

## 🤝 Contributing

Contributions are welcome! Please follow these rules:

1. Ensure `src/core/` remains **100% pure** (no database, no fetch, no external imports).
2. Keep all files strictly under 250 lines.
3. Add unit and integration tests for any new features.
4. Verify that `pnpm verify` passes with 0 warnings before opening a pull request.

---

## 📄 License

Distributed under the **MIT License**. See `LICENSE` for details.
