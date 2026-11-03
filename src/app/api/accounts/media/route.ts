/**
 * Accounts Media API: Supports ?accountId=... or ?id=... with in-memory caching.
 */

import { NextResponse } from "next/server";
import { accountsService } from "@/modules/accounts/accounts.service";
import { metaClient, MetaApiError, type MetaMediaItem } from "@/channels/instagram/meta-client";
import { resolveInstagramAccountId } from "@/channels/instagram/account-resolver";

export const runtime = "nodejs";

interface CacheEntry {
  readonly timestamp: number;
  readonly data: {
    media: MetaMediaItem[];
    paging?: {
      cursors?: { before?: string; after?: string };
      next?: string;
      previous?: string;
    };
  };
}

const mediaCache = new Map<string, CacheEntry>();
const CACHE_TTL_MS = 60 * 1000;

export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const accountId = searchParams.get("accountId") ?? searchParams.get("id");
    const type = searchParams.get("type") ?? "all";
    const limit = Math.min(Number(searchParams.get("limit")) || 24, 50);
    const after = searchParams.get("after") ?? undefined;

    if (!accountId) {
      return NextResponse.json({ error: "accountId query parameter is required" }, { status: 400 });
    }

    const cacheKey = `${accountId}:${type}:${limit}:${after ?? ""}`;
    const cached = mediaCache.get(cacheKey);
    if (cached && Date.now() - cached.timestamp < CACHE_TTL_MS) {
      return NextResponse.json({ ...cached.data, cached: true });
    }

    const account = await accountsService.findById(accountId);
    if (!account) {
      return NextResponse.json({ error: "Connected account not found" }, { status: 404 });
    }

    let mediaItems: MetaMediaItem[] = [];
    let paging: CacheEntry["data"]["paging"];
    let targetIgId = account.accountId;

    async function executeFetch(igId: string) {
      if (type === "stories") {
        const response = await metaClient.fetchUserStories(igId, account!.decryptedAccessToken);
        return {
          media: response.data.map((item) => ({ ...item, media_product_type: "STORY" as const })),
          paging: response.paging,
        };
      }
      const response = await metaClient.fetchUserMedia(
        igId,
        account!.decryptedAccessToken,
        limit,
        after,
      );
      let items = response.data;
      if (type === "reels") {
        items = items.filter((item) => item.media_product_type === "REELS");
      } else if (type === "posts") {
        items = items.filter(
          (item) => item.media_product_type === "FEED" || !item.media_product_type,
        );
      }
      return { media: items, paging: response.paging };
    }

    try {
      const fetched = await executeFetch(targetIgId);
      mediaItems = fetched.media;
      paging = fetched.paging;
    } catch (fetchErr: unknown) {
      const isFieldErr =
        fetchErr instanceof MetaApiError &&
        (fetchErr.code === 100 || fetchErr.message.includes("nonexisting field"));

      if (isFieldErr) {
        const autoResolvedId = await resolveInstagramAccountId(
          account.decryptedAccessToken,
          account.accountId,
          account.id,
        );
        if (autoResolvedId && autoResolvedId !== targetIgId) {
          targetIgId = autoResolvedId;
          const retry = await executeFetch(targetIgId);
          mediaItems = retry.media;
          paging = retry.paging;
        } else {
          throw fetchErr;
        }
      } else {
        throw fetchErr;
      }
    }

    const result = { media: mediaItems, paging };
    mediaCache.set(cacheKey, { timestamp: Date.now(), data: result });
    return NextResponse.json({ ...result, cached: false });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    console.error("Error fetching account media from Meta:", message);
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
