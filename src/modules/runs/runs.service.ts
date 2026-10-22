/**
 * Runs service for queue management, atomic claim via SKIP LOCKED, and status updates.
 */

import { supabaseAdmin } from "@/lib/supabase";
import type { RunStatus } from "@/core/status-machine";

export interface AutomationRunRow {
  readonly id: string;
  readonly workspace_id: string;
  readonly account_id: string;
  readonly rule_id: string | null;
  readonly comment_id: string;
  readonly commenter_id: string | null;
  readonly commenter_username: string | null;
  readonly comment_text: string | null;
  readonly post_id: string;
  readonly status: RunStatus;
  readonly reason: string | null;
  readonly attempts: number;
  readonly run_at: string;
  readonly claimed_at: string | null;
  readonly sent_at: string | null;
  readonly message_id: string | null;
  readonly created_at: string;
}

export interface EnqueueRunInput {
  readonly workspaceId: string;
  readonly accountId: string;
  readonly ruleId: string;
  readonly commentId: string;
  readonly commenterId: string;
  readonly commenterUsername: string;
  readonly commentText: string;
  readonly postId: string;
  readonly runAt?: Date;
}

export const runsService = {
  async enqueueRun(input: EnqueueRunInput): Promise<boolean> {
    const { error } = await supabaseAdmin.from("automation_runs").insert({
      workspace_id: input.workspaceId,
      account_id: input.accountId,
      rule_id: input.ruleId,
      comment_id: input.commentId,
      commenter_id: input.commenterId,
      commenter_username: input.commenterUsername,
      comment_text: input.commentText,
      post_id: input.postId,
      status: "pending",
      attempts: 0,
      run_at: (input.runAt ?? new Date()).toISOString(),
    });

    if (error) {
      // 23505 is PostgreSQL unique_violation: already enqueued for this (account_id, comment_id)
      if (error.code === "23505") {
        return false;
      }
      throw new Error(`Failed to enqueue automation run: ${error.message}`);
    }

    return true;
  },

  async claimBatch(batchSize = 10, maxAgeSeconds = 561600): Promise<AutomationRunRow[]> {
    const { data, error } = await supabaseAdmin.rpc("claim_pending_runs", {
      batch_size: batchSize,
      max_age_seconds: maxAgeSeconds,
    });

    if (error) {
      throw new Error(`Failed to claim pending runs: ${error.message}`);
    }

    return (data as AutomationRunRow[]) ?? [];
  },

  async reapStuckRuns(timeoutSeconds = 300): Promise<number> {
    const { data, error } = await supabaseAdmin.rpc("reap_stuck_runs", {
      timeout_seconds: timeoutSeconds,
    });

    if (error) {
      throw new Error(`Failed to reap stuck runs: ${error.message}`);
    }

    return Number(data ?? 0);
  },

  async markRunOutcome(
    runId: string,
    status: RunStatus,
    attempts: number,
    options?: {
      reason?: string | null;
      messageId?: string | null;
      nextRunAt?: Date | null;
    },
  ): Promise<void> {
    const now = new Date().toISOString();
    const updatePayload: Record<string, unknown> = {
      status,
      attempts,
      updated_at: now,
      reason: options?.reason ?? null,
      message_id: options?.messageId ?? null,
    };

    if (status === "sent") {
      updatePayload.sent_at = now;
      updatePayload.claimed_at = null;
    } else if (status === "pending") {
      updatePayload.claimed_at = null;
      if (options?.nextRunAt) {
        updatePayload.run_at = options.nextRunAt.toISOString();
      }
    } else {
      updatePayload.claimed_at = null;
    }

    const { error } = await supabaseAdmin
      .from("automation_runs")
      .update(updatePayload)
      .eq("id", runId);

    if (error) {
      throw new Error(`Failed to update run outcome: ${error.message}`);
    }
  },
};
