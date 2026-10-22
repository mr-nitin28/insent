/**
 * Custom URL destination provider with strict HTTPS enforcement and shortener blocking.
 */

import type { DestinationProvider, DestinationRef, DestinationOption } from "../types";

const BLOCKED_SHORTENER_HOSTS = new Set([
  "bit.ly",
  "tinyurl.com",
  "t.co",
  "ow.ly",
  "is.gd",
  "buff.ly",
  "goo.gl",
  "cutt.ly",
  "rebrand.ly",
]);

export class CustomUrlDestinationProvider implements DestinationProvider {
  public readonly id = "custom-url";
  public readonly label = "Custom Web Link";

  async list(): Promise<DestinationOption[]> {
    return [];
  }

  async resolve(ref: DestinationRef): Promise<{ url: string }> {
    let parsed: URL;
    try {
      parsed = new URL(ref.value);
    } catch {
      throw new Error(`Invalid destination URL: '${ref.value}'`);
    }

    if (parsed.protocol !== "https:") {
      throw new Error("Destination URL must use secure HTTPS protocol");
    }

    const hostname = parsed.hostname.toLowerCase();
    if (BLOCKED_SHORTENER_HOSTS.has(hostname)) {
      throw new Error(`Public URL shortener '${hostname}' is not allowed for security reasons`);
    }

    return { url: parsed.toString() };
  }
}

export const customUrlProvider = new CustomUrlDestinationProvider();
