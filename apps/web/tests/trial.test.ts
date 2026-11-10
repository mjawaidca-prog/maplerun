import { describe, it, expect } from "vitest";
import {
  trialGate,
  trialBlockMessage,
  hasActiveSubscription,
} from "../src/lib/trial";

const NOW = new Date("2026-10-27T12:00:00Z");
const FUTURE = new Date("2026-11-10T12:00:00Z");
const PAST = new Date("2026-10-20T12:00:00Z");

describe("trialGate", () => {
  it("promo accounts (trialEndsAt null) are never gated", () => {
    expect(trialGate({ trialEndsAt: null, freePayRunsUsed: 99, maxFreePayRuns: 2 }, NOW)).toEqual({ state: "none" });
  });

  it("an ended trial reports ended even with runs left", () => {
    expect(trialGate({ trialEndsAt: PAST, freePayRunsUsed: 0, maxFreePayRuns: 2 }, NOW).state).toBe("ended");
  });

  it("a live trial at the cap reports exhausted with the counts", () => {
    expect(trialGate({ trialEndsAt: FUTURE, freePayRunsUsed: 2, maxFreePayRuns: 2 }, NOW)).toEqual({
      state: "exhausted",
      used: 2,
      max: 2,
    });
    expect(trialGate({ trialEndsAt: FUTURE, freePayRunsUsed: 3, maxFreePayRuns: 2 }, NOW).state).toBe("exhausted");
  });

  it("a live trial under the cap reports active", () => {
    const gate = trialGate({ trialEndsAt: FUTURE, freePayRunsUsed: 1, maxFreePayRuns: 2 }, NOW);
    expect(gate.state).toBe("active");
  });
});

describe("trialBlockMessage", () => {
  it("is null when finalizing is allowed", () => {
    expect(trialBlockMessage({ state: "none" })).toBeNull();
    expect(
      trialBlockMessage({ state: "active", used: 0, max: 2, trialEndsAt: FUTURE }),
    ).toBeNull();
  });

  it("explains an ended trial", () => {
    expect(trialBlockMessage({ state: "ended", trialEndsAt: PAST })).toMatch(/trial has ended/i);
  });

  it("explains exhaustion with the counts and the way out", () => {
    const msg = trialBlockMessage({ state: "exhausted", used: 2, max: 2 });
    expect(msg).toContain("2/2");
    expect(msg).toMatch(/upgrade/i);
  });
});

describe("trialGate with a recorded subscription (billing webhook state)", () => {
  const base = { freePayRunsUsed: 0, maxFreePayRuns: 2 };

  it("a paid subscription overrides an ended trial clock", () => {
    expect(
      trialGate({ ...base, trialEndsAt: PAST, subscriptionStatus: "active" }, NOW),
    ).toEqual({ state: "none" });
  });

  it("past_due still counts as paid while Stripe retries", () => {
    expect(
      trialGate({ ...base, trialEndsAt: null, subscriptionStatus: "past_due" }, NOW).state,
    ).toBe("none");
  });

  it("a cancelled subscription blocks again even with the trial cleared", () => {
    const gate = trialGate(
      { ...base, trialEndsAt: null, subscriptionStatus: "canceled" },
      NOW,
    );
    expect(gate).toEqual({ state: "subscription_inactive", status: "canceled" });
    expect(trialBlockMessage(gate)).toMatch(/no longer active/i);
    expect(trialBlockMessage(gate)).toMatch(/resubscribe/i);
  });

  it("an unpaid subscription blocks", () => {
    expect(
      trialGate({ ...base, trialEndsAt: null, subscriptionStatus: "unpaid" }, NOW).state,
    ).toBe("subscription_inactive");
  });

  it("no recorded status (null) keeps pure trial semantics — promo stays ungated", () => {
    expect(
      trialGate({ ...base, trialEndsAt: null, subscriptionStatus: null }, NOW),
    ).toEqual({ state: "none" });
    expect(
      trialGate({ ...base, trialEndsAt: PAST, subscriptionStatus: null }, NOW).state,
    ).toBe("ended");
  });
});

describe("hasActiveSubscription", () => {
  it("is true only for recorded good-standing statuses", () => {
    expect(hasActiveSubscription({ subscriptionStatus: "active" })).toBe(true);
    expect(hasActiveSubscription({ subscriptionStatus: "trialing" })).toBe(true);
    expect(hasActiveSubscription({ subscriptionStatus: "past_due" })).toBe(true);
    expect(hasActiveSubscription({ subscriptionStatus: "canceled" })).toBe(false);
    expect(hasActiveSubscription({ subscriptionStatus: "unpaid" })).toBe(false);
    expect(hasActiveSubscription({ subscriptionStatus: null })).toBe(false);
    expect(hasActiveSubscription({})).toBe(false);
  });
});
