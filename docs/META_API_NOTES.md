# Meta Graph API Baseline Notes

This document captures verified facts and operational baselines for the Meta Instagram Graph API as of October 2026. Every item reflects official Meta Developer documentation for **Instagram API with Instagram Login** (`graph.instagram.com`).

---

## 1. Authentication & OAuth Flow

- **Protocol:** Instagram API with Instagram Login (independent of Facebook Pages and Facebook Login for Business).
- **Authorization Endpoint:** `https://www.instagram.com/oauth/authorize`
  - Required parameters: `client_id`, `redirect_uri`, `response_type=code`, `scope`, `state`.
  - State parameter: Cryptographically random string stored in secure cookie for CSRF validation.
- **Short-Lived Token Exchange:** `POST https://api.instagram.com/oauth/access_token`
  - Parameters: `client_id`, `client_secret`, `grant_type=authorization_code`, `redirect_uri`, `code`.
  - Returns: `{ access_token, user_id }`.
  - Validity: 1 hour.
- **Long-Lived Token Exchange:** `GET https://graph.instagram.com/access_token`
  - Parameters: `grant_type=ig_exchange_token`, `client_secret`, `access_token` (short-lived token).
  - Returns: `{ access_token, token_type: "bearer", expires_in: 5184000 }` (~60 days).
  - Validity: 60 days.
- **Token Refresh:** `GET https://graph.instagram.com/refresh_access_token`
  - Parameters: `grant_type=ig_refresh_token`, `access_token` (current valid long-lived token).
  - Returns: `{ access_token, token_type: "bearer", expires_in: 5184000 }`.
  - Condition: Can be refreshed when at least 24 hours old and before expiry.
- **Verified Scope List (V1):**
  - `instagram_business_basic`: Read profile information (`id, username, name, profile_picture_url`) and media.
  - `instagram_business_manage_comments`: Read comments and reply publicly or privately.
  - `instagram_business_manage_messages`: Required only for direct DM conversations, inbox sync, and follow-ups outside private replies.

---

## 2. Profile & Webhook Subscription

- **User Profile:** `GET https://graph.instagram.com/{graph-version}/me?fields=id,username,name,profile_picture_url&access_token={token}`
  - Verified fact: The returned `id` (Instagram Scoped User ID) matches the webhook `entry[].id`.
- **Subscribe Account to Webhooks:** `POST https://graph.instagram.com/{graph-version}/{ig-user-id}/subscribed_apps`
  - Body: `subscribed_fields=comments,messages`
  - Header/Param: `access_token`
  - Verified fact: Must be called upon connecting an account to receive comment and messaging webhooks for that Instagram creator.

---

## 3. Webhook Delivery & Verification

- **GET Handshake (Verification):**
  - Query parameters: `hub.mode`, `hub.verify_token`, `hub.challenge`.
  - If `hub.mode === 'subscribe'` and `hub.verify_token === WEBHOOK_VERIFY_TOKEN`, return `hub.challenge` with HTTP 200.
- **POST Event Signature:**
  - Header: `X-Hub-Signature-256: sha256=<hex_digest>`
  - Key: Instagram App Secret (`INSTAGRAM_APP_SECRET`).
  - Input: Raw UTF-8 request body bytes.
  - Algorithm: HMAC-SHA256 compared using `crypto.timingSafeEqual` over identical length buffers.
- **Payload Schema:**
  - `object: "instagram"`
  - `entry[].id`: Instagram Account ID
  - `entry[].changes[].field === "comments"`
  - `entry[].changes[].value`: `{ id: "<comment_id>", text: "<text>", from: { id: "<user_id>", username: "<username>" }, media: { id: "<media_id>" }, parent_id?: "<parent_comment_id>" }`
- **Loop Guard Rule:**
  - Drop if `from.id === entry.id` (own comment).
  - Drop if `parent_id` is present (comment reply rather than top-level comment) in V1.
- **HTTP Response Window:**
  - Return HTTP 200 within 5 seconds. If server times out (>20s) or returns 5xx, Meta retries with exponential backoff up to 24-36 hours.

---

## 4. Private Reply API

- **Endpoint:** `POST https://graph.instagram.com/{graph-version}/{ig-user-id}/messages`
  - Headers: `Content-Type: application/json`, `Authorization: Bearer {access_token}`
  - Body:
    ```json
    {
      "recipient": { "comment_id": "<comment_id>" },
      "message": { "text": "<message_text>" }
    }
    ```
- **Meta Policy & Hard Limits:**
  - **Single Reply:** Exactly **one** private reply is permitted per comment. Additional calls return error code 10900 or 100 ("Comment already replied to").
  - **7-Day Eligibility Window:** Private reply can only be sent within 7 days of comment creation. Calls after 7 days fail. Worker checks `timestamp <= 6.5 days` to avoid boundary failures.
  - **Rate Cap:** Approximately 750 private replies per hour per Instagram account for posts and reels. Default safety cap configured at 600/hour.
  - **Inbox Requests Folder:** If the commenter does not follow the business account, the DM lands in their "Message Requests" folder. This must be surfaced in user-facing UI copy.

---

## 5. Public Comment Reply API

- **Endpoint:** `POST https://graph.instagram.com/{graph-version}/{comment-id}/replies`
  - Body: `message=<text>&access_token={token}`
  - Optional enhancement: Public reply failure must never fail or block the private DM delivery status.

---

## 6. Polling Fallback (Development & Testing)

- **Requirement:** Meta requires Advanced Access (App Review) to receive live `comments` webhooks for accounts not designated as App Testers.
- **Fallback Implementation:** `GET https://graph.instagram.com/{graph-version}/{media-id}/comments?fields=id,text,from,timestamp&access_token={token}`
  - Ingests comments through the exact same normalization pipeline.
  - The database unique constraint `(account_id, comment_id)` guarantees zero duplicates between polling and webhooks.

---

## 7. Error Classification & Meta Status Mapping

| Meta Code         | Subcode | Nature                                | Classification         | Action                                          |
| :---------------- | :------ | :------------------------------------ | :--------------------- | :---------------------------------------------- |
| **190**           | -       | Invalid OAuth / Token Expired         | `FAILED_AUTH`          | Mark account `needs_reauth`, pause active rules |
| **368**           | -       | Meta Platform Rate Limit              | `RETRYABLE_RATE_LIMIT` | Delay queue item with exponential backoff       |
| **4 / 17**        | -       | Application Rate Limit                | `RETRYABLE_RATE_LIMIT` | Delay queue item with exponential backoff       |
| **100**           | 10900   | Comment already replied to            | `SKIPPED_DUPLICATE`    | Mark run `skipped` (terminal)                   |
| **100**           | -       | Invalid Parameter / Comment not found | `FAILED_PERMANENT`     | Mark run `failed` (terminal)                    |
| **1**             | -       | Generic OAuth Exception (Unconfirmed) | `UNKNOWN_DELIVERY`     | **NEVER** retry. DM may have been delivered.    |
| **5xx / Timeout** | -       | Network / Upstream failure mid-flight | `UNKNOWN_DELIVERY`     | **NEVER** auto-retry. Mark `unknown_delivery`.  |

---

## 8. Open Items Requiring Live Meta Sandbox Checklist (`VERIFY`)

- [ ] `[VERIFY]` Test token refresh window on actual long-lived token (confirm minimum age before refresh call succeeds).
- [ ] `[VERIFY]` Verify whether `subscribed_apps` call returns `{ success: true }` under Instagram API with Instagram Login.
- [ ] `[VERIFY]` Confirm error subcode for comments older than 7 days when private reply is attempted.
- [ ] `[VERIFY]` Validate behavior of `is_user_follow_business` on Instagram Scoped User ID when follow-gate check is queried.
