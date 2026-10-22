/**
 * Webhook signature verification using constant-time comparison against raw request bytes.
 */

import { createHmac, timingSafeEqual } from "node:crypto";
import { env } from "@/config/env";

/**
 * Validates Meta's X-Hub-Signature-256 header.
 *
 * @param rawBody - Exact unparsed raw request body string
 * @param signatureHeader - Header value in format "sha256=<hex>"
 * @param secretOverride - Optional app secret override (defaults to env.INSTAGRAM_APP_SECRET)
 */
export function verifyInstagramSignature(
  rawBody: string,
  signatureHeader: string | null,
  secretOverride?: string,
): boolean {
  if (!signatureHeader || !signatureHeader.startsWith("sha256=")) {
    return false;
  }

  const providedHash = signatureHeader.slice("sha256=".length).trim();
  const secret = secretOverride ?? env.INSTAGRAM_APP_SECRET;

  const expectedHash = createHmac("sha256", secret).update(rawBody, "utf8").digest("hex");

  const providedBuf = Buffer.from(providedHash, "hex");
  const expectedBuf = Buffer.from(expectedHash, "hex");

  if (providedBuf.length !== expectedBuf.length || providedBuf.length === 0) {
    return false;
  }

  return timingSafeEqual(providedBuf, expectedBuf);
}
