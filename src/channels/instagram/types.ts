/**
 * Instagram Channel & Meta Graph API TypeScript interfaces.
 */

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

export interface RawMetaErrorPayload {
  error?: {
    message?: string;
    type?: string;
    code?: number;
    error_subcode?: number;
    fbtrace_id?: string;
  };
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

export interface MetaMediaItem {
  readonly id: string;
  readonly caption?: string;
  readonly media_type?: "IMAGE" | "VIDEO" | "CAROUSEL_ALBUM";
  readonly media_product_type?: "FEED" | "REELS" | "STORY" | "AD";
  readonly media_url?: string;
  readonly thumbnail_url?: string;
  readonly permalink?: string;
  readonly timestamp: string;
  readonly like_count?: number;
  readonly comments_count?: number;
}

export interface MetaMediaResponse {
  readonly data: MetaMediaItem[];
  readonly paging?: {
    readonly cursors?: { readonly before?: string; readonly after?: string };
    readonly next?: string;
    readonly previous?: string;
  };
}
