// api/_lib/metrics/weeklyRecap.test.ts
import { describe, it, expect } from "vitest";
import { computeWeeklyRecap, type RecapTrade } from "./weeklyRecap.js";

const t = (o: Partial<RecapTrade>): RecapTrade =>
  ({ pnl: 0, rr: null, outcome: "be", strategy: "", ...o });

describe("computeWeeklyRecap", () => {
  it("returns zeros for an empty week", () => {
    const r = computeWeeklyRecap([]);
    expect(r).toEqual({ tradeCount: 0, netDollar: 0, winRate: 0, netR: null, bestSetup: "" });
  });

  it("win rate excludes break-even trades", () => {
    const r = computeWeeklyRecap([
      t({ outcome: "win" }), t({ outcome: "loss" }), t({ outcome: "be" }),
    ]);
    expect(r.tradeCount).toBe(3);
    expect(r.winRate).toBe(50); // 1 win / (1 win + 1 loss)
  });

  it("netDollar sums pnl; netR is null when no rr present", () => {
    const r = computeWeeklyRecap([t({ pnl: 120 }), t({ pnl: -40 })]);
    expect(r.netDollar).toBe(80);
    expect(r.netR).toBeNull();
  });

  it("netR sums only non-null rr, rounded to 1dp", () => {
    const r = computeWeeklyRecap([t({ rr: 1.5 }), t({ rr: -0.5 }), t({ rr: null })]);
    expect(r.netR).toBe(1);
  });

  it("bestSetup is the strategy with the highest net pnl, ignoring blanks", () => {
    const r = computeWeeklyRecap([
      t({ strategy: "ORB", pnl: 200 }),
      t({ strategy: "ORB", pnl: -50 }),
      t({ strategy: "Reversal", pnl: 100 }),
      t({ strategy: "", pnl: 999 }),
    ]);
    expect(r.bestSetup).toBe("ORB"); // 150 vs 100
  });
});
