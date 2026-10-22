# ANOZIK Social Connect

A clean, production-grade social automation platform that turns social engagement (such as Instagram comments) into personalized direct messages and tracked destination conversions.

Built from scratch based on Meta's official **Instagram API with Instagram Login** standards, with zero external Redis queues, full multi-tenant Row-Level Security, and a pure functional core.

---

## 🌟 Key Architecture Highlights

- **Zero Redis, Zero BullMQ ($0 Idle Cost):** Leverages PostgreSQL `FOR UPDATE SKIP LOCKED` for atomic, non-blocking queue processing directly inside Supabase.
- **Pure Core Domain:** 100% of business rules (Unicode NFKC matching, Latin diacritic folding, rule precedence hierarchy, message templates, throttling, and status machines) are pure functions with zero I/O and zero external dependencies.
- **Strict Multi-Tenancy:** Every table carries `workspace_id` backed by Supabase Postgres Row-Level Security (RLS).
- **Hardened Security:** Tokens encrypted at rest with AES-256-GCM. Webhooks verified with constant-time HMAC-SHA256.
- **Crash & Loop Resilience:** Timeouts and ambiguous Meta responses transition to `unknown_delivery` and are **never** auto-retried, completely eliminating duplicate DM spam loops.
- **Pluggable & Adaptable:** Adapting to any new business or brand requires updating only `src/config/business.config.ts` without touching core logic.

---

## 🚀 15-Minute Local Quickstart

### 1. Install Dependencies

```bash
pnpm install
```

### 2. Configure Environment Variables

Copy `.env.example` to `.env.local`:

```bash
cp .env.example .env.local
```

Provide your Supabase URL, service role key, and Meta credentials (or leave defaults for local simulation).

### 3. Run Database Migrations

Execute `supabase/migrations/0001_init.sql` in your Supabase SQL Editor or local Postgres instance.

### 4. Seed Development Data

```bash
pnpm seed
```

### 5. Run the Local Development Server

```bash
pnpm dev
```

Open [http://localhost:3000](http://localhost:3000) to view the creator dashboard and queue telemetry.

### 6. Simulate the Pipeline (No Meta Account Needed!)

Test HMAC signature validation, loop guards, rule matching, link generation, and worker queue execution locally:

```bash
pnpm simulate
```

### 7. Run Full Production Verification

Verify typecheck, ESLint, Prettier format check, test suites (55 tests), and Next.js production compilation:

```bash
pnpm verify
```

---

## 📁 Project Structure

```
anozik-social-connect/
├── docs/                # AUDIT, ARCHITECTURE, META_API_NOTES, ADAPTING, RUNBOOK, FUTURE
├── supabase/migrations/ # 0001_init.sql (Postgres schema, RLS, SKIP LOCKED claim function)
├── scripts/             # simulate-webhook.ts (full pipeline simulator), seed.ts
├── src/
│   ├── config/          # business.config.ts (the single place for brand identity & limits), env.ts
│   ├── core/            # PURE domain logic: matching, rules, templates, throttle, status-machine, errors
│   ├── channels/        # Channel adapters (types.ts, registry.ts, instagram/)
│   ├── destinations/    # Destination providers (types.ts, registry.ts, anozik/, custom-url/)
│   ├── modules/         # Application services: accounts, automations, runs, links, analytics, retention
│   └── app/             # Thin Next.js App Router routes (/api/webhooks, /api/worker, /r/[code])
└── tests/               # Unit, integration, and E2E simulation test suites
```

---

## 🛠️ Verification & Quality Assurance Commands

| Command             | Purpose                                                                       |
| :------------------ | :---------------------------------------------------------------------------- |
| `pnpm verify`       | Runs strict typecheck, ESLint, format check, all 55 tests, and Next.js build  |
| `pnpm simulate`     | Runs the full pipeline simulation with signed payloads and status progression |
| `pnpm test`         | Runs the Vitest test suite                                                    |
| `pnpm typecheck`    | Strict TypeScript compiler check (`noEmit`)                                   |
| `pnpm lint`         | ESLint 9 checks for Next.js App Router                                        |
| `pnpm format:check` | Prettier code style validation                                                |

---

## 📜 Documentation

- [Audit of Reference Repositories](docs/AUDIT.md)
- [Architecture Specification](docs/ARCHITECTURE.md)
- [Meta Graph API Baseline Notes](docs/META_API_NOTES.md)
- [Business Adaptation Guide](docs/ADAPTING.md)
- [Operational Runbook](docs/RUNBOOK.md)
- [Future Scope Backlog](docs/FUTURE.md)
- [Third-Party Notices](THIRD_PARTY_NOTICES.md)
