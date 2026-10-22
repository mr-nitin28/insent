/**
 * Links service for tracked link generation, redirect resolution, and crawler bot filtering.
 */

import { randomBytes, createHash } from "node:crypto";
import { supabaseAdmin } from "@/lib/supabase";
import { destinationRegistry } from "@/destinations/registry";
import type { DestinationRef } from "@/destinations/types";

const BOT_USER_AGENTS = [
  /facebookexternalhit/i,
  /facebot/i,
  /whatsapp/i,
  /twitterbot/i,
  /linkedinbot/i,
  /telegrambot/i,
  /discordbot/i,
  /slackbot/i,
  /pinterest/i,
  /googlebot/i,
  /bingbot/i,
  /applebot/i,
];

export interface TrackedLinkRecord {
  readonly id: string;
  readonly workspace_id: string;
  readonly slug: string;
  readonly destination_url: string;
  readonly click_count: number;
}

export const linksService = {
  isCrawlerBot(userAgent: string | null): boolean {
    if (!userAgent) return false;
    return BOT_USER_AGENTS.some((pattern) => pattern.test(userAgent));
  },

  hashIp(ip: string | null): string | null {
    if (!ip) return null;
    return createHash("sha256").update(ip).digest("hex").slice(0, 16);
  },

  async createTrackedLink(
    workspaceId: string,
    ruleId: string,
    destinationRef: DestinationRef,
  ): Promise<{ slug: string; targetUrl: string }> {
    const provider = destinationRegistry.get(destinationRef.providerId);
    const { url: targetUrl } = await provider.resolve(destinationRef);

    const slug = randomBytes(4).toString("hex"); // 8 chars

    const { error } = await supabaseAdmin.from("tracked_links").insert({
      workspace_id: workspaceId,
      rule_id: ruleId,
      slug,
      destination_url: targetUrl,
      click_count: 0,
    });

    if (error) {
      throw new Error(`Failed to create tracked link: ${error.message}`);
    }

    return { slug, targetUrl };
  },

  async recordClickAndResolve(
    slug: string,
    userAgent: string | null,
    ip: string | null,
    referrer: string | null,
  ): Promise<{ destinationUrl: string } | null> {
    const { data: link, error } = await supabaseAdmin
      .from("tracked_links")
      .select("id, workspace_id, slug, destination_url, click_count")
      .eq("slug", slug)
      .maybeSingle();

    if (error || !link) {
      return null;
    }

    const isBot = this.isCrawlerBot(userAgent);
    const ipHash = this.hashIp(ip);

    // Record the raw click event
    await supabaseAdmin.from("link_clicks").insert({
      workspace_id: link.workspace_id,
      tracked_link_id: link.id,
      is_bot: isBot,
      user_agent: userAgent?.slice(0, 300) ?? null,
      ip_hash: ipHash,
      referrer: referrer?.slice(0, 300) ?? null,
    });

    // Only increment human clicks
    if (!isBot) {
      await supabaseAdmin
        .from("tracked_links")
        .update({
          click_count: link.click_count + 1,
          updated_at: new Date().toISOString(),
        })
        .eq("id", link.id);
    }

    return { destinationUrl: link.destination_url };
  },
};
