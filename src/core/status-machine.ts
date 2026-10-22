/**
 * Pure core finite state machine and retry calculation for automation runs.
 */

import { InvalidStateTransitionError } from "./errors";

export type RunStatus =
  | "pending"
  | "sending"
  | "sent"
  | "skipped"
  | "failed"
  | "unknown_delivery";

const VALID_TRANSITIONS: Record<RunStatus, readonly RunStatus[]> = {
  pending: ["sending", "skipped"],
  sending: ["sent", "skipped", "failed", "pending", "unknown_delivery"],
  sent: [],
  skipped: [],
  failed: [],
  unknown_delivery: [],
};

/**
 * Validates and executes a state transition.
 * Throws InvalidStateTransitionError on illegal moves.
 */
export function transitionRunStatus(current: RunStatus, target: RunStatus): RunStatus {
  if (current === target) {
    return current;
  }

  const allowed = VALID_TRANSITIONS[current];
  if (!allowed.includes(target)) {
    throw new InvalidStateTransitionError(current, target);
  }

  return target;
}

export interface RetryPlan {
  readonly shouldRetry: boolean;
  readonly nextAttempt?: number;
  readonly delaySeconds?: number;
}

/**
 * Calculates exponential backoff with deterministic pseudo-jitter.
 * Formula: baseDelay * 2^(attempts-1) + jitter, capped by maxAttempts.
 */
export function calculateRetryPlan(
  currentAttempts: number,
  maxAttempts = 4,
  baseDelaySeconds = 60,
  jitterSeed = 0.5
): RetryPlan {
  if (currentAttempts >= maxAttempts) {
    return { shouldRetry: false };
  }

  const nextAttempt = currentAttempts + 1;
  const exponential = baseDelaySeconds * Math.pow(2, currentAttempts - 1);
  // Jitter +/- 20%
  const jitterRange = exponential * 0.2;
  const jitterOffset = (jitterSeed * 2 - 1) * jitterRange;
  const delaySeconds = Math.max(10, Math.round(exponential + jitterOffset));

  return {
    shouldRetry: true,
    nextAttempt,
    delaySeconds,
  };
}

export type ChannelOutcomeType =
  | "sent"
  | "rate_limited"
  | "auth_expired"
  | "duplicate_rejected"
  | "permanent_error"
  | "transient_network_error"
  | "timeout_or_crash"
  | "unconfirmed_outcome";

export interface OutcomeClassification {
  readonly status: RunStatus;
  readonly retryable: boolean;
  readonly reason: string;
}

/**
 * Maps external channel execution outcomes to deterministic internal run states.
 * CRITICAL: Timeouts, worker crashes, and unconfirmed responses map to 'unknown_delivery'
 * and are NEVER auto-resent.
 */
export function classifyChannelOutcome(
  outcomeType: ChannelOutcomeType,
  currentAttempts: number,
  maxAttempts = 4
): OutcomeClassification {
  switch (outcomeType) {
    case "sent":
      return { status: "sent", retryable: false, reason: "Successfully delivered" };

    case "duplicate_rejected":
      return {
        status: "skipped",
        retryable: false,
        reason: "Comment has already been replied to on Meta platform",
      };

    case "auth_expired":
      return {
        status: "failed",
        retryable: false,
        reason: "Account OAuth credentials expired or revoked; reauthentication required",
      };

    case "permanent_error":
      return {
        status: "failed",
        retryable: false,
        reason: "Unrecoverable Meta API error (invalid parameters or media deleted)",
      };

    case "rate_limited":
    case "transient_network_error": {
      const plan = calculateRetryPlan(currentAttempts, maxAttempts);
      if (plan.shouldRetry) {
        return {
          status: "pending",
          retryable: true,
          reason: `Transient error (${outcomeType}); will retry with backoff`,
        };
      }
      return {
        status: "failed",
        retryable: false,
        reason: `Exhausted maximum retry attempts (${maxAttempts}) after transient errors`,
      };
    }

    case "timeout_or_crash":
    case "unconfirmed_outcome":
      return {
        status: "unknown_delivery",
        retryable: false,
        reason: "Execution timed out or returned unconfirmed status; automatic resend halted",
      };
  }
}
