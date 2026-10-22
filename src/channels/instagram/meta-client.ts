/**
 * Dedicated typed HTTP client for Meta Graph API calls.
 * All Meta interactions are funneled through this module with version pinning.
 */

import { env } from "@/config/env";

export class MetaApiError extends Error {
  constructor(
    message: string,
    public readonly status: number,
    public readonly code?: number,
    public readonly subcode?: number,
    public readonly errorType?: string,
    public readonly fbTraceId?: string,
  ) {
    super(message);
    this.name = "MetaApiError";
  }
}

interface RawMetaErrorPayload {
  error?: {
    message?: string;
    type?: string;
    code?: number;
    error_subcode?: number;
    fbtrace_id?: string;
  };
}

function getGraphUrl(endpoint: string): string {
  const version = env.META_GRAPH_API_VERSION;
  const cleanEndpoint = endpoint.startsWith("/") ? endpoint : `/${endpoint}`;
  return `https://graph.instagram.com/${version}${cleanEndpoint}`;
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

export interface MetaProfileResponse {
  readonly id: string;
  readonly username: string;
  readonly name?: string;
  readonly profile_picture_url?: string;
}

export interface MetaSendResponse {
  readonly recipient_id?: string;
  readonly message_id?: string;
}

export interface MetaTokenResponse {
  readonly access_token: string;
  readonly token_type?: string;
  readonly expires_in?: number;
  readonly user_id?: string;
}

export interface MetaCommentItem {
  readonly id: string;
  readonly text: string;
  readonly timestamp: string;
  readonly from?: { readonly id: string; readonly username: string };
  readonly parent_id?: string;
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
    const res = await fetch(`${getGraphUrl("/access_token")}?${params.toString()}`);
    return handleMetaResponse<MetaTokenResponse>(res, "exchangeShortForLongToken");
  },

  async refreshLongToken(longToken: string): Promise<MetaTokenResponse> {
    const params = new URLSearchParams({
      grant_type: "ig_refresh_token",
      access_token: longToken,
    });
    const res = await fetch(`${getGraphUrl("/refresh_access_token")}?${params.toString()}`);
    return handleMetaResponse<MetaTokenResponse>(res, "refreshLongToken");
  },

  async getMe(accessToken: string): Promise<MetaProfileResponse> {
    const params = new URLSearchParams({
      fields: "id,username,name,profile_picture_url",
      access_token: accessToken,
    });
    const res = await fetch(`${getGraphUrl("/me")}?${params.toString()}`);
    return handleMetaResponse<MetaProfileResponse>(res, "getMe");
  },

  async subscribeAccountToWebhooks(igUserId: string, token: string): Promise<{ success: boolean }> {
    const form = new URLSearchParams({
      subscribed_fields: "comments,messages",
      access_token: token,
    });
    const res = await fetch(getGraphUrl(`/${igUserId}/subscribed_apps`), {
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
    const res = await fetch(getGraphUrl(`/${igUserId}/messages`), {
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
    const res = await fetch(getGraphUrl(`/${commentId}/replies`), {
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
    const res = await fetch(`${getGraphUrl(`/${mediaId}/comments`)}?${params.toString()}`);
    return handleMetaResponse<{ data: MetaCommentItem[] }>(res, "fetchMediaComments");
  },
};
