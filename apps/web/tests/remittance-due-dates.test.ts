/**
 * Wave 2 remittance wiring — CRA due-date rules in the shared module.
 *
 * PR #14 FLAG B closure: the Remittances page used to compute its due date
 * inline, shifting Saturday BACK to the Friday 14th. CRA's rule is the
 * NEXT business day. These tests pin the shared-module behaviour the page
 * now consumes (remittanceDueDateFor), for every remitter type.
 *
 * Weekdays verified against the calendar:
 *   2026-02-15 Sun, 2026-04-15 Wed, 2026-08-15 Sat, 2026-10-10 Sat,
 *   2026-01-31 Sat.
 */
import { describe, it, expect } from "vitest";
import {
  adjustToNextBusinessDay,
  addBusinessDays,
  remittanceDueDateFor,
} from "../src/lib/remittance/aggregate";

describe("adjustToNextBusinessDay — CRA next-business-day rule", () => {
  it("Saturday → Monday the 17th (never back to Friday the 14th)", () => {
    expect(adjustToNextBusinessDay("2026-08-15")).toBe("2026-08-17");
  });

  it("Sunday → Monday the 16th", () => {
    expect(adjustToNextBusinessDay("2026-02-15")).toBe("2026-02-16");
  });

  it("weekday is unchanged", () => {
    expect(adjustToNextBusinessDay("2026-04-15")).toBe("2026-04-15");
  });
});

describe("remittanceDueDateFor — REGULAR", () => {
  it("15th on a Saturday → Monday 17th", () => {
    // Period July 2026 → nominal due 2026-08-15 (Sat)
    expect(remittanceDueDateFor("2026-07", "REGULAR")).toBe("2026-08-17");
  });

  it("15th on a Sunday → Monday 16th", () => {
    // Period January 2026 → nominal due 2026-02-15 (Sun)
    expect(remittanceDueDateFor("2026-01", "REGULAR")).toBe("2026-02-16");
  });

  it("15th on a weekday is unchanged", () => {
    // Period March 2026 → due 2026-04-15 (Wed)
    expect(remittanceDueDateFor("2026-03", "REGULAR")).toBe("2026-04-15");
  });

  it("null / unset remitter type behaves as REGULAR", () => {
    expect(remittanceDueDateFor("2026-07", null)).toBe("2026-08-17");
    expect(remittanceDueDateFor("2026-07", undefined)).toBe("2026-08-17");
  });
});

describe("remittanceDueDateFor — QUARTERLY", () => {
  it("is the 15th of the month after the quarter ends", () => {
    expect(remittanceDueDateFor("2026-Q1", "QUARTERLY")).toBe("2026-04-15");
    expect(remittanceDueDateFor("2026-Q4", "QUARTERLY")).toBe("2027-01-15");
  });

  it("maps a monthly key to its quarter", () => {
    expect(remittanceDueDateFor("2026-02", "QUARTERLY")).toBe("2026-04-15");
  });
});

describe("remittanceDueDateFor — ACCELERATED1 (Threshold 1)", () => {
  it("final deadline is the 10th of the following month, adjusted", () => {
    // Period September 2026 → nominal 2026-10-10 (Sat) → Monday 12th
    expect(remittanceDueDateFor("2026-09", "ACCELERATED1")).toBe("2026-10-12");
    // Period March 2026 → 2026-04-10 (Fri) unchanged
    expect(remittanceDueDateFor("2026-03", "ACCELERATED1")).toBe("2026-04-10");
  });
});

describe("remittanceDueDateFor — ACCELERATED2 (Threshold 2)", () => {
  it("is 3 business days after period end, skipping the weekend", () => {
    // January 2026 ends Sat Jan 31 → Mon Feb 2 (1), Tue Feb 3 (2), Wed Feb 4 (3)
    expect(remittanceDueDateFor("2026-01", "ACCELERATED2")).toBe("2026-02-04");
  });

  it("counts business days only from a weekday period end", () => {
    // March 2026 ends Tue Mar 31 → Apr 1 (1), Apr 2 (2), Apr 3 (3)
    expect(remittanceDueDateFor("2026-03", "ACCELERATED2")).toBe("2026-04-03");
  });
});

describe("addBusinessDays", () => {
  it("skips weekends", () => {
    // Fri 2026-01-30 + 1 business day = Mon 2026-02-02
    expect(addBusinessDays("2026-01-30", 1)).toBe("2026-02-02");
    expect(addBusinessDays("2026-01-31", 3)).toBe("2026-02-04");
  });
});
