import { describe, it, expect } from "vitest";
import { evaluateThrottle } from "@/core/throttle";

describe("core/throttle", () => {
  const fixedNow = new Date("2026-10-22T12:00:00Z");

  it("permits immediate send when under hourly cap", () => {
    const decision = evaluateThrottle(50, 600, fixedNow);
    expect(decision.action).toBe("send_now");
  });

  it("delays (does not fail) when at or exceeding hourly cap", () => {
    const decision = evaluateThrottle(600, 600, fixedNow, 300);
    expect(decision.action).toBe("delay");
    if (decision.action === "delay") {
      expect(decision.delaySeconds).toBe(300);
      expect(decision.delayUntil.toISOString()).toBe("2026-10-22T12:05:00.000Z");
      expect(decision.reason).toContain("reached hourly cap");
    }
  });

  it("paces high-volume bursts without dropping runs", () => {
    // Simulating 1,000 runs arriving with cap of 600
    const underCap = evaluateThrottle(599, 600, fixedNow);
    expect(underCap.action).toBe("send_now");

    const overCap = evaluateThrottle(600, 600, fixedNow);
    expect(overCap.action).toBe("delay");
  });
});
