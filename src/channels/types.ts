/**
 * Unified channel adapter interface for multi-platform adaptability.
 */

export interface InboundEvent {
  readonly channelId: string;
  readonly accountId: string; // The social account platform ID (e.g. Meta IG ID)
  readonly commentId: string;
  readonly commenterId: string;
  readonly commenterUsername: string;
  readonly commentText: string;
  readonly postId: string;
  readonly parentId?: string | null;
  readonly timestamp: Date;
  readonly rawEvent?: unknown;
}

export interface AccountCredentials {
  readonly id: string;
  readonly workspaceId: string;
  readonly platform: string;
  readonly accountId: string;
  readonly username: string;
  readonly decryptedAccessToken: string;
}

export type SendResult =
  | { readonly type: "sent"; readonly messageId: string }
  | { readonly type: "retry"; readonly delaySeconds: number; readonly reason: string }
  | {
      readonly type: "failed";
      readonly reason: string;
      readonly permanent: boolean;
      readonly requiresReauth?: boolean;
    }
  | { readonly type: "unknown"; readonly reason: string };

export interface ConnectedAccount {
  readonly platform: string;
  readonly accountId: string;
  readonly username: string;
  readonly name?: string;
  readonly profilePictureUrl?: string;
  readonly accessToken: string;
  readonly expiresIn?: number;
}

export type RefreshResult =
  | { readonly success: true; readonly newAccessToken: string; readonly expiresIn?: number }
  | { readonly success: false; readonly reason: string; readonly requiresReauth: boolean };

export interface ChannelAdapter {
  readonly id: string;
  verifyAndParse(req: Request): Promise<unknown>;
  normalize(payload: unknown): InboundEvent[];
  send(account: AccountCredentials, event: InboundEvent, text: string): Promise<SendResult>;
  replyPublicly?(
    account: AccountCredentials,
    event: InboundEvent,
    text: string,
  ): Promise<SendResult>;
  connectUrl(state: string): string;
  completeConnect(code: string): Promise<ConnectedAccount>;
  refreshCredentials(account: AccountCredentials): Promise<RefreshResult>;
}
