import { describe, it, expect } from "vitest";
import { trialGate, trialBlockMessage } from "../src/lib/trial";

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
