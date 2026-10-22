/**
 * Instagram Channel Adapter implementing ChannelAdapter interface.
 */

import type {
  ChannelAdapter,
  InboundEvent,
  AccountCredentials,
  SendResult,
  ConnectedAccount,
  RefreshResult,
} from "../types";
import { verifyInstagramSignature } from "./signature";
import { metaClient, MetaApiError } from "./meta-client";
import { instagramWebhookSchema, type InstagramWebhookPayload } from "./schemas";

export class InstagramChannelAdapter implements ChannelAdapter {
  public readonly id = "instagram";

  async verifyAndParse(req: Request): Promise<InstagramWebhookPayload> {
    const rawBody = await req.text();
    const signature = req.headers.get("x-hub-signature-256");

    if (!verifyInstagramSignature(rawBody, signature)) {
      throw new Error("Invalid Meta webhook signature");
    }

    let parsedJson: unknown;
    try {
      parsedJson = JSON.parse(rawBody);
    } catch {
      throw new Error("Invalid JSON webhook payload");
    }

    return instagramWebhookSchema.parse(parsedJson);
  }

  normalize(payload: unknown): InboundEvent[] {
    const data = instagramWebhookSchema.parse(payload);
    const events: InboundEvent[] = [];

    for (const entry of data.entry) {
      const accountId = entry.id;
      for (const change of entry.changes) {
        if (change.field === "comments" && change.value) {
          const val = change.value;
          const commenterId = val.from?.id ?? "";
          const commenterUsername = val.from?.username ?? "";
          const postId = val.media?.id ?? "";
          const commentId = val.id;
          const commentText = val.text ?? "";
          const parentId = val.parent_id ?? null;
          const timestamp = val.created_time ? new Date(val.created_time * 1000) : new Date();

          if (commentId && accountId) {
            events.push({
              channelId: this.id,
              accountId,
              commentId,
              commenterId,
              commenterUsername,
              commentText,
              postId,
              parentId,
              timestamp,
              rawEvent: change,
            });
          }
        }
      }
    }

    return events;
  }

  async send(account: AccountCredentials, event: InboundEvent, text: string): Promise<SendResult> {
    try {
      const res = await metaClient.sendPrivateReply(
        account.accountId,
        event.commentId,
        text,
        account.decryptedAccessToken,
      );
      return {
        type: "sent",
        messageId: res.message_id ?? `msg_${Date.now()}`,
      };
    } catch (err: unknown) {
      if (err instanceof MetaApiError) {
        // Code 190: Token expired or revoked
        if (err.code === 190) {
          return {
            type: "failed",
            permanent: true,
            requiresReauth: true,
            reason: "Instagram access token expired or revoked (Meta 190)",
          };
        }

        // Code 368, 4, 17: Rate limits
        if (err.code === 368 || err.code === 4 || err.code === 17) {
          return {
            type: "retry",
            delaySeconds: 180,
            reason: `Meta rate limit encountered (Code ${err.code})`,
          };
        }

        // Code 100 / Subcode 10900: Comment already replied to
        if (err.code === 100 && (err.subcode === 10900 || err.message.includes("already"))) {
          return {
            type: "failed",
            permanent: true,
            reason: "Comment has already been replied to on Meta platform",
          };
        }

        // Code 1: Generic unconfirmed error (DM might have been delivered)
        if (err.code === 1) {
          return {
            type: "unknown",
            reason: "Meta returned generic code 1; delivery unconfirmed. Resends halted.",
          };
        }
      }

      // Timeouts / Network failures: outcome unconfirmed
      const message = err instanceof Error ? err.message : String(err);
      return {
        type: "unknown",
        reason: `Delivery outcome unconfirmed due to transport failure: ${message}`,
      };
    }
  }

  async replyPublicly?(
    account: AccountCredentials,
    event: InboundEvent,
    text: string,
  ): Promise<SendResult> {
    try {
      const res = await metaClient.replyToCommentPublicly(
        event.commentId,
        text,
        account.decryptedAccessToken,
      );
      return {
        type: "sent",
        messageId: res.id,
      };
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : String(err);
      return {
        type: "failed",
        permanent: false,
        reason: `Public reply failed: ${message}`,
      };
    }
  }

  connectUrl(state: string): string {
    return metaClient.buildAuthorizeUrl(state);
  }

  async completeConnect(code: string): Promise<ConnectedAccount> {
    // 1. Exchange auth code for short token
    const shortTokenRes = await metaClient.exchangeCodeForShortToken(code);

    // 2. Exchange short token for long-lived 60-day token
    const longTokenRes = await metaClient.exchangeShortForLongToken(shortTokenRes.access_token);
    const accessToken = longTokenRes.access_token;

    // 3. Fetch profile
    const profile = await metaClient.getMe(accessToken);

    // 4. Subscribe account to webhooks
    try {
      await metaClient.subscribeAccountToWebhooks(profile.id, accessToken);
    } catch (subErr) {
      console.warn("Subscribed_apps webhook subscription warning:", subErr);
    }

    return {
      platform: this.id,
      accountId: profile.id,
      username: profile.username,
      name: profile.name,
      profilePictureUrl: profile.profile_picture_url,
      accessToken,
      expiresIn: longTokenRes.expires_in,
    };
  }

  async refreshCredentials(account: AccountCredentials): Promise<RefreshResult> {
    try {
      const res = await metaClient.refreshLongToken(account.decryptedAccessToken);
      return {
        success: true,
        newAccessToken: res.access_token,
        expiresIn: res.expires_in,
      };
    } catch (err: unknown) {
      const isAuthError = err instanceof MetaApiError && err.code === 190;
      return {
        success: false,
        requiresReauth: isAuthError,
        reason: err instanceof Error ? err.message : String(err),
      };
    }
  }

  /**
   * Polling fallback for development accounts without live comments webhook approval.
   */
  async pollMediaComments(account: AccountCredentials, mediaId: string): Promise<InboundEvent[]> {
    const res = await metaClient.fetchMediaComments(mediaId, account.decryptedAccessToken);
    return res.data.map((item) => ({
      channelId: this.id,
      accountId: account.accountId,
      commentId: item.id,
      commenterId: item.from?.id ?? "",
      commenterUsername: item.from?.username ?? "",
      commentText: item.text,
      postId: mediaId,
      parentId: item.parent_id ?? null,
      timestamp: new Date(item.timestamp),
    }));
  }
}

export const instagramAdapter = new InstagramChannelAdapter();
