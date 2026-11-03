/**
 * Dedicated typed HTTP client for Meta Graph API calls.
 * All Meta interactions are funneled through this module with version pinning.
 * Supports both Instagram API (graph.instagram.com) and Meta Business API (graph.facebook.com).
 */

import { env } from "@/config/env";
import {
  MetaApiError,
  type RawMetaErrorPayload,
  type MetaProfileResponse,
  type MetaSendResponse,
  type MetaTokenResponse,
  type MetaCommentItem,
  type MetaMediaItem,
  type MetaMediaResponse,
} from "./types";

export {
  MetaApiError,
  type MetaProfileResponse,
  type MetaSendResponse,
  type MetaTokenResponse,
  type MetaCommentItem,
  type MetaMediaItem,
  type MetaMediaResponse,
};

function getGraphUrl(endpoint: string, token?: string): string {
  const version = env.META_GRAPH_API_VERSION;
  const cleanEndpoint = endpoint.startsWith("/") ? endpoint : `/${endpoint}`;
  // Meta System User / Facebook tokens start with EAA; Instagram User tokens start with IG
  const host =
    token && token.startsWith("EAA") ? "https://graph.facebook.com" : "https://graph.instagram.com";
  return `${host}/${version}${cleanEndpoint}`;
}

async function handleMetaResponse<T>(res: Response, callContext: string): Promise<T> {
  const text = await res.text();
  let json: unknown;
  try {
    json = text ? JSON.parse(text) : {};
  } catch {
    json = { raw: text };
  }

  if (!res.ok) {
    const errorObj = (json as RawMetaErrorPayload)?.error;
    const message = errorObj?.message ?? `Meta API ${res.status}: ${res.statusText}`;
    const code = errorObj?.code;
    const subcode = errorObj?.error_subcode;
    const errorType = errorObj?.type;
    const fbTraceId = errorObj?.fbtrace_id;

    console.error(
      JSON.stringify({
        event: "meta_api_error",
        context: callContext,
        status: res.status,
        code,
        subcode,
        errorType,
        fbTraceId,
        message,
      }),
    );

    throw new MetaApiError(message, res.status, code, subcode, errorType, fbTraceId);
  }

  return json as T;
}

export const metaClient = {
  buildAuthorizeUrl(state: string): string {
    const params = new URLSearchParams({
      client_id: env.INSTAGRAM_APP_ID,
      redirect_uri: `${env.NEXT_PUBLIC_APP_URL}/api/oauth/callback`,
      response_type: "code",
      scope: "instagram_business_basic,instagram_business_manage_comments",
      state,
    });
    return `https://www.instagram.com/oauth/authorize?${params.toString()}`;
  },

  async exchangeCodeForShortToken(code: string): Promise<MetaTokenResponse> {
    const form = new URLSearchParams({
      client_id: env.INSTAGRAM_APP_ID,
      client_secret: env.INSTAGRAM_APP_SECRET,
      grant_type: "authorization_code",
      redirect_uri: `${env.NEXT_PUBLIC_APP_URL}/api/oauth/callback`,
      code,
    });
    const res = await fetch("https://api.instagram.com/oauth/access_token", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: form.toString(),
    });
    return handleMetaResponse<MetaTokenResponse>(res, "exchangeCodeForShortToken");
  },

  async exchangeShortForLongToken(shortToken: string): Promise<MetaTokenResponse> {
    const params = new URLSearchParams({
      grant_type: "ig_exchange_token",
      client_secret: env.INSTAGRAM_APP_SECRET,
      access_token: shortToken,
    });
    const res = await fetch(`${getGraphUrl("/access_token", shortToken)}?${params.toString()}`);
    return handleMetaResponse<MetaTokenResponse>(res, "exchangeShortForLongToken");
  },

  async refreshLongToken(longToken: string): Promise<MetaTokenResponse> {
    const params = new URLSearchParams({
      grant_type: "ig_refresh_token",
      access_token: longToken,
    });
    const res = await fetch(
      `${getGraphUrl("/refresh_access_token", longToken)}?${params.toString()}`,
    );
    return handleMetaResponse<MetaTokenResponse>(res, "refreshLongToken");
  },

  async getMe(accessToken: string): Promise<MetaProfileResponse> {
    // If Facebook Graph API token (EAA...)
    if (accessToken.startsWith("EAA")) {
      try {
        const pagesRes = await fetch(
          `${getGraphUrl("/me/accounts", accessToken)}?fields=id,name,instagram_business_account{id,username,name,profile_picture_url}&access_token=${accessToken}`,
        );
        const pagesJson = (await pagesRes.json()) as {
          data?: Array<{
            instagram_business_account?: {
              id: string;
              username: string;
              name?: string;
              profile_picture_url?: string;
            };
          }>;
        };
        const pageWithIg = pagesJson.data?.find((p) => p.instagram_business_account?.id);
        if (pageWithIg?.instagram_business_account) {
          const ig = pageWithIg.instagram_business_account;
          return {
            id: ig.id,
            username: ig.username,
            name: ig.name,
            profile_picture_url: ig.profile_picture_url,
          };
        }
      } catch {}
    }

    const params = new URLSearchParams({
      fields: "id,username,name,profile_picture_url",
      access_token: accessToken,
    });
    const res = await fetch(`${getGraphUrl("/me", accessToken)}?${params.toString()}`);
    return handleMetaResponse<MetaProfileResponse>(res, "getMe");
  },

  async subscribeAccountToWebhooks(igUserId: string, token: string): Promise<{ success: boolean }> {
    const form = new URLSearchParams({
      subscribed_fields: "comments,messages",
      access_token: token,
    });
    const res = await fetch(getGraphUrl(`/${igUserId}/subscribed_apps`, token), {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: form.toString(),
    });
    return handleMetaResponse<{ success: boolean }>(res, "subscribeAccountToWebhooks");
  },

  async sendPrivateReply(
    igUserId: string,
    commentId: string,
    text: string,
    accessToken: string,
  ): Promise<MetaSendResponse> {
    const res = await fetch(getGraphUrl(`/${igUserId}/messages`, accessToken), {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${accessToken}` },
      body: JSON.stringify({ recipient: { comment_id: commentId }, message: { text } }),
    });
    return handleMetaResponse<MetaSendResponse>(res, "sendPrivateReply");
  },

  async replyToCommentPublicly(
    commentId: string,
    message: string,
    accessToken: string,
  ): Promise<{ id: string }> {
    const form = new URLSearchParams({ message, access_token: accessToken });
    const res = await fetch(getGraphUrl(`/${commentId}/replies`, accessToken), {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: form.toString(),
    });
    return handleMetaResponse<{ id: string }>(res, "replyToCommentPublicly");
  },

  async fetchMediaComments(mediaId: string, token: string): Promise<{ data: MetaCommentItem[] }> {
    const params = new URLSearchParams({
      fields: "id,text,timestamp,from,parent_id",
      access_token: token,
    });
    const res = await fetch(`${getGraphUrl(`/${mediaId}/comments`, token)}?${params.toString()}`);
    return handleMetaResponse<{ data: MetaCommentItem[] }>(res, "fetchMediaComments");
  },

  async fetchUserMedia(
    igUserId: string,
    token: string,
    limit = 24,
    after?: string,
  ): Promise<MetaMediaResponse> {
    const params = new URLSearchParams({
      fields:
        "id,caption,media_type,media_product_type,media_url,thumbnail_url,permalink,timestamp,like_count,comments_count",
      access_token: token,
      limit: String(limit),
    });
    if (after) {
      params.set("after", after);
    }
    const res = await fetch(`${getGraphUrl(`/${igUserId}/media`, token)}?${params.toString()}`);
    return handleMetaResponse<MetaMediaResponse>(res, "fetchUserMedia");
  },

  async fetchUserStories(igUserId: string, token: string): Promise<MetaMediaResponse> {
    const params = new URLSearchParams({
      fields: "id,caption,media_type,media_url,permalink,timestamp",
      access_token: token,
    });
    const res = await fetch(`${getGraphUrl(`/${igUserId}/stories`, token)}?${params.toString()}`);
    return handleMetaResponse<MetaMediaResponse>(res, "fetchUserStories");
  },
};
