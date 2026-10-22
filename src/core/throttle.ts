/**
 * Pure core throttle decision engine.
 */

export type ThrottleAction =
  | { readonly action: "send_now" }
  | {
      readonly action: "delay";
      readonly delayUntil: Date;
      readonly delaySeconds: number;
      readonly reason: string;
    };

/**
 * Evaluates whether an account is permitted to send a DM now or must be throttled.
 *
 * @param sendsInLastHour - Number of messages already dispatched by this account in the past 60 minutes
 * @param hourlyCap - Maximum permitted sends per rolling hour
 * @param now - Current reference timestamp (defaults to new Date())
 * @param backoffSeconds - Duration in seconds to delay if cap is reached (defaults to 300s / 5 mins)
 */
export function evaluateThrottle(
  sendsInLastHour: number,
  hourlyCap: number,
  now = new Date(),
  backoffSeconds = 300
): ThrottleAction {
  if (sendsInLastHour < hourlyCap) {
    return { action: "send_now" };
  }

  const delayUntil = new Date(now.getTime() + backoffSeconds * 1000);
  return {
    action: "delay",
    delayUntil,
    delaySeconds: backoffSeconds,
    reason: `Account reached hourly cap (${sendsInLastHour}/${hourlyCap} sends in the last hour)`,
  };
}
