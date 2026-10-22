# Third-Party Notices and Intellectual Property Acknowledgements

This document provides formal licensing attributions for open-source reference material studied during the development of ANOZIK Social Connect. All code in this project was newly implemented from scratch to adhere to modern Meta API guidelines, multi-tenancy requirements, and zero-external-queue architecture.

---

## 1. Reference Repositories Audited

The following open-source projects were studied as architectural and behavioral reference material:

1. **`instachat`**
   - **Copyright:** (c) 2026 Chutzpah-Clickesef
   - **License:** MIT License
   - **Conceptual Contributions Kept:** Single-query atomic queue claiming with PostgreSQL `FOR UPDATE SKIP LOCKED`, Next.js `after()` queue kick pattern, and basic single-comment deduplication index.
   - **Patterns Rejected:** Single-tenant database schema (`id = 1`), plaintext access token storage, reset of stale jobs directly to `pending`.

2. **`instagram-comment-to-dm` (CampaignCue)**
   - **Copyright:** (c) 2026 Anish Raj
   - **License:** MIT License
   - **Conceptual Contributions Kept:** AES-256-GCM token encryption, tracked redirect link structure, and hourly sliding-window account rate limiting.
   - **Patterns Rejected:** Redis & BullMQ infrastructure overhead, Stripe billing coupled inside worker dispatch loops, flawed `(automationId, commentId)` uniqueness constraint.

3. **`insta-p8`**
   - **Copyright:** (c) 2026 flexhunt
   - **License:** MIT License
   - **Conceptual Contributions Kept:** Multi-secret HMAC signature checking concept.
   - **Patterns Rejected:** Direct synchronous execution inside webhook HTTP handlers with artificial delays, bypass flags (`DISABLE_WEBHOOK_SIGNATURE_CHECK`), and lack of queueing or duplicate guards.

4. **`openreply`**
   - **Copyright:** (c) 2026 Anish Raj & Diwen Huang
   - **License:** MIT License
   - **Conceptual Contributions Kept:** Production-proven error classification distinguishing confirmed rejections from `unknown_delivery` (Meta Code 1) to halt double-DM storms; Unicode property escapes and Latin diacritic folding algorithm that preserves Devanagari combining marks (`\p{M}`).
   - **Patterns Rejected:** Redis and BullMQ external server dependencies.

---

## 2. Direct Code Attribution Statement

**No proprietary, open-core, or dual-licensed code was copied into this project.** All core domain algorithms (Unicode matching, template substitution, status machine transitions, throttle decisions), channel adapters, and Supabase migrations were authored natively for ANOZIK Social Connect.

Conceptual influences from the MIT-licensed repositories above are recognized with gratitude in accordance with the MIT License terms.
