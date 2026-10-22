# Adapting ANOZIK Social Connect to Any Business

ANOZIK Social Connect is designed so that adapting the platform to a new business model, brand identity, or vertical requires editing a single configuration file (`src/config/business.config.ts`) and adding an optional destination provider under `src/destinations/`, with **zero modifications to core logic or ingestion pipelines**.

---

## 1. Case Study 1: Creator Marketplace (Anozik Default)

### Business Context:

A platform where creators, mentors, and developers sell one-page profiles, bookings, and digital assets.

### Adaptation Steps (Time: ~15 minutes):

1. **Configure Business Identity (`src/config/business.config.ts`):**
   ```ts
   brand: {
     name: "Anozik",
     domain: "anozik.com",
     supportEmail: "support@anozik.com",
   },
   channels: {
     enabled: ["instagram"],
     defaultChannel: "instagram",
   },
   destinations: {
     enabled: ["anozik", "custom-url"],
     defaultProvider: "anozik",
   },
   templates: {
     defaultCommentDm: "Hey @{username}, here is the link you requested: {link}",
     defaultPublicReply: "Sent to your DMs! Check message requests if you don't follow us. ✨",
     disclosureText: "Automated response via Anozik Social Connect.",
   }
   ```
2. **Destination Resolution:**
   The Anozik provider (`src/destinations/anozik/provider.ts`) maps destination references (`nitin/portfolio`) to canonical URLs (`https://anozik.com/u/nitin/portfolio`).
3. **Run Verification:** `pnpm verify`.

---

## 2. Case Study 2: Direct-to-Consumer E-Commerce Store (LuxeCart)

### Business Context:

A luxury fashion and apparel brand driving sales through Instagram Reels by asking commenters to comment "SIZE", "BUY", or "PRICE" to receive instantaneous checkout links.

### Adaptation Steps (Time: ~25 minutes):

1. **Configure Business Identity (`src/config/business.config.ts`):**
   ```ts
   brand: {
     name: "LuxeCart",
     domain: "luxecart.shop",
     supportEmail: "orders@luxecart.shop",
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
     defaultCommentDm: "Hey @{username}! 🛍️ Here is the direct checkout link for this look: {link}",
     defaultPublicReply: "Sent the product link to your DMs! Check requests if you don't follow. 💫",
     disclosureText: "Automated customer assistance from LuxeCart.",
   },
   limits: {
     hourlyCapPerAccount: 750, // High-volume campaign limit
     dailyCapPerRule: 10000,
     maxSendAttempts: 4,
     retentionDays: 14,
     maxMessageLength: 1000,
     maxCommentAgeSeconds: 561600,
   }
   ```
2. **Rules Configuration:**
   Creators link specific product URLs (`https://luxecart.shop/products/summer-silk-dress`) using the `custom-url` destination provider.
3. **Verify:** Run sample test `tests/integration/config.test.ts`.

---

## 3. Case Study 3: High-Ticket Executive Coaching Business (PeakCoach)

### Business Context:

A private executive coaching consultancy using Instagram authority content to book strategy sessions and discovery calls via Calendly.

### Adaptation Steps (Time: ~30 minutes):

1. **Configure Business Identity:**
   ```ts
   brand: {
     name: "PeakCoach",
     domain: "peakcoach.io",
     supportEmail: "concierge@peakcoach.io",
   },
   destinations: {
     enabled: ["custom-url"],
     defaultProvider: "custom-url",
   },
   templates: {
     defaultCommentDm: "Hi @{username}, thank you for your interest in our executive cohort. You can reserve your 1-on-1 strategy call here: {link}",
     defaultPublicReply: "Invitation link dispatched to your DMs! 🎯",
     disclosureText: "Sent on behalf of PeakCoach Executive Advisory.",
   },
   limits: {
     hourlyCapPerAccount: 300, // Focused, conservative delivery
     dailyCapPerRule: 1000,
     maxSendAttempts: 4,
     retentionDays: 90,
     maxMessageLength: 1000,
     maxCommentAgeSeconds: 561600,
   }
   ```
2. **Tracked Calendly Integration:**
   Rules target booking pages (`https://calendly.com/peakcoach/discovery-session`). Tracked links ensure click-through conversion rates can be measured.
3. **Verify:** `pnpm verify`.

---

## 4. Adding a New Messaging Channel (e.g. WhatsApp, Telegram)

To add another messaging channel without breaking existing pipelines:

1. Create `src/channels/<channel-name>/adapter.ts` implementing `ChannelAdapter`.
2. Register the new adapter with one line in `src/channels/registry.ts`:
   ```ts
   import { whatsAppAdapter } from "./whatsapp/adapter";
   this.register(whatsAppAdapter);
   ```
3. Add `"whatsapp"` to `channels.enabled` in `src/config/business.config.ts`.
4. Done. Core domain matching, queue leases, and status machine automatically apply.
