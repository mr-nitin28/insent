import { describe, it, expect } from "vitest";
import {
  transitionRunStatus,
  calculateRetryPlan,
  classifyChannelOutcome,
} from "@/core/status-machine";
import { InvalidStateTransitionError } from "@/core/errors";

describe("core/status-machine", () => {
  describe("legal and illegal transitions", () => {
    it("allows legal progression pending -> sending -> sent", () => {
      expect(transitionRunStatus("pending", "sending")).toBe("sending");
      expect(transitionRunStatus("sending", "sent")).toBe("sent");
    });

    it("allows sending -> unknown_delivery on mid-send timeout or crash", () => {
      expect(transitionRunStatus("sending", "unknown_delivery")).toBe("unknown_delivery");
    });

    it("blocks illegal transition from terminal state sent -> pending", () => {
      expect(() => transitionRunStatus("sent", "pending")).toThrow(
        InvalidStateTransitionError
      );
    });

    it("blocks illegal transition from terminal unknown_delivery -> pending", () => {
      expect(() => transitionRunStatus("unknown_delivery", "pending")).toThrow(
        InvalidStateTransitionError
      );
    });

    it("blocks illegal transition from terminal skipped -> sending", () => {
      expect(() => transitionRunStatus("skipped", "sending")).toThrow(
        InvalidStateTransitionError
      );
    });
  });

  describe("retry calculation with backoff", () => {
    it("plans retries up to maxAttempts (4)", () => {
      const attempt1 = calculateRetryPlan(1, 4, 60, 0.5);
      expect(attempt1.shouldRetry).toBe(true);
      expect(attempt1.nextAttempt).toBe(2);
      expect(attempt1.delaySeconds).toBe(60);

      const attempt2 = calculateRetryPlan(2, 4, 60, 0.5);
      expect(attempt2.shouldRetry).toBe(true);
      expect(attempt2.nextAttempt).toBe(3);
      expect(attempt2.delaySeconds).toBe(120);

      const attempt3 = calculateRetryPlan(3, 4, 60, 0.5);
      expect(attempt3.shouldRetry).toBe(true);
      expect(attempt3.nextAttempt).toBe(4);
      expect(attempt3.delaySeconds).toBe(240);

      // Attempt 4 is the last attempt: no further retry
      const attempt4 = calculateRetryPlan(4, 4, 60, 0.5);
      expect(attempt4.shouldRetry).toBe(false);
    });
  });

  describe("channel outcome classification", () => {
    it("classifies timeout_or_crash as unknown_delivery and never retryable", () => {
      const outcome = classifyChannelOutcome("timeout_or_crash", 1, 4);
      expect(outcome.status).toBe("unknown_delivery");
      expect(outcome.retryable).toBe(false);
      expect(outcome.reason).toContain("automatic resend halted");
    });

    it("classifies unconfirmed outcome as unknown_delivery", () => {
      const outcome = classifyChannelOutcome("unconfirmed_outcome", 1, 4);
      expect(outcome.status).toBe("unknown_delivery");
      expect(outcome.retryable).toBe(false);
    });

    it("classifies transient error as retryable pending when attempts remain", () => {
      const outcome = classifyChannelOutcome("transient_network_error", 2, 4);
      expect(outcome.status).toBe("pending");
      expect(outcome.retryable).toBe(true);
    });

    it("classifies auth_expired as failed requiring reauthentication", () => {
      const outcome = classifyChannelOutcome("auth_expired", 1, 4);
      expect(outcome.status).toBe("failed");
      expect(outcome.retryable).toBe(false);
      expect(outcome.reason).toContain("reauthentication required");
    });

    it("classifies duplicate_rejected as skipped", () => {
      const outcome = classifyChannelOutcome("duplicate_rejected", 1, 4);
      expect(outcome.status).toBe("skipped");
      expect(outcome.retryable).toBe(false);
    });
  });
});
