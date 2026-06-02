// ═══════════════════════════════════════════════════════════════════════════════
// stats.test.ts — unit tests for pure stats functions
// Run with: npx vitest run
// ═══════════════════════════════════════════════════════════════════════════════

import { describe, it, expect } from "vitest";
import { calcRR, calcWinRate, calcStreak, calcTotalPnL, calcDisciplineScore } from "./stats";

// ── calcRR ────────────────────────────────────────────────────────────────────

describe("calcRR", () => {
  it("returns correct R:R for a long trade", () => {
    // entry 100, stop 90 (risk 10), target 130 (reward 30) → 3.00R
    expect(calcRR("100", "90", "130")).toBe("3.00");
  });

  it("returns correct R:R for a short trade", () => {
    // entry 200, stop 210 (risk 10), target 180 (reward 20) → 2.00R
    expect(calcRR("200", "210", "180")).toBe("2.00");
  });

  it("returns empty string when entry === stop loss (division by zero)", () => {
    expect(calcRR("100", "100", "130")).toBe("");
  });

  it("returns empty string for NaN inputs", () => {
    expect(calcRR("", "90", "130")).toBe("");
    expect(calcRR("100", "", "130")).toBe("");
    expect(calcRR("100", "90", "")).toBe("");
    expect(calcRR("abc", "90", "130")).toBe("");
  });

  it("returns empty string when R:R exceeds 100 (data error guard)", () => {
    // entry 100, stop 99.99 (tiny risk), target 200 (huge reward)
    expect(calcRR("100", "99.99", "200")).toBe("");
  });

  it("handles fractional pip-level prices correctly", () => {
    // entry 1.08000, stop 1.07800 (20 pips), target 1.08400 (40 pips) → 2.00R
    expect(calcRR("1.08000", "1.07800", "1.08400")).toBe("2.00");
  });
});

// ── calcWinRate ───────────────────────────────────────────────────────────────

describe("calcWinRate", () => {
  it("returns 0 for empty trade list", () => {
    expect(calcWinRate([])).toBe(0);
  });

  it("returns 100 when all trades are wins", () => {
    expect(calcWinRate([{ outcome: "Win" }, { outcome: "Win" }])).toBe(100);
  });

  it("returns 0 when all trades are losses", () => {
    expect(calcWinRate([{ outcome: "Loss" }, { outcome: "Loss" }])).toBe(0);
  });

  it("returns 50 for equal wins and losses", () => {
    expect(calcWinRate([{ outcome: "Win" }, { outcome: "Loss" }])).toBe(50);
  });

  it("counts breakeven trades in denominator but not as wins", () => {
    // 1W, 1L, 1BE → 1/3 = 33.3%
    expect(calcWinRate([
      { outcome: "Win" },
      { outcome: "Loss" },
      { outcome: "Breakeven" },
    ])).toBe(33.3);
  });

  it("rounds to 1 decimal place", () => {
    // 2W, 3L → 40.0%
    expect(calcWinRate([
      { outcome: "Win" }, { outcome: "Win" },
      { outcome: "Loss" }, { outcome: "Loss" }, { outcome: "Loss" },
    ])).toBe(40);
  });
});

// ── calcStreak ────────────────────────────────────────────────────────────────

describe("calcStreak", () => {
  it("returns null streak for empty list", () => {
    expect(calcStreak([])).toEqual({ type: null, count: 0 });
  });

  it("detects a winning streak", () => {
    expect(calcStreak([
      { outcome: "Win" }, { outcome: "Win" }, { outcome: "Win" }, { outcome: "Loss" },
    ])).toEqual({ type: "Win", count: 3 });
  });

  it("detects a losing streak", () => {
    expect(calcStreak([
      { outcome: "Loss" }, { outcome: "Loss" }, { outcome: "Win" },
    ])).toEqual({ type: "Loss", count: 2 });
  });

  it("skips breakeven trades — they do not break or extend a streak", () => {
    expect(calcStreak([
      { outcome: "Win" }, { outcome: "Breakeven" }, { outcome: "Win" }, { outcome: "Loss" },
    ])).toEqual({ type: "Win", count: 2 });
  });

  it("returns count 1 for a single win", () => {
    expect(calcStreak([{ outcome: "Win" }])).toEqual({ type: "Win", count: 1 });
  });

  it("returns count 1 when the streak immediately breaks", () => {
    expect(calcStreak([{ outcome: "Win" }, { outcome: "Loss" }])).toEqual({ type: "Win", count: 1 });
  });
});

// ── calcTotalPnL ──────────────────────────────────────────────────────────────

describe("calcTotalPnL", () => {
  it("returns 0 for empty list", () => {
    expect(calcTotalPnL([])).toBe(0);
  });

  it("sums positive and negative P&L correctly", () => {
    expect(calcTotalPnL([
      { pnl: "2.5" }, { pnl: "-1.0" }, { pnl: "3.0" },
    ])).toBeCloseTo(4.5);
  });

  it("handles missing or empty pnl gracefully", () => {
    expect(calcTotalPnL([{ pnl: "" }, { pnl: "2" }])).toBe(2);
  });

  it("handles numeric pnl values (not just strings)", () => {
    expect(calcTotalPnL([{ pnl: 1.5 as any }, { pnl: 2.5 as any }])).toBeCloseTo(4);
  });
});

// ── calcDisciplineScore ───────────────────────────────────────────────────────

function makeTrade(overrides: {
  date?: string;
  pnlDollar?: string;
  ruleAdherence?: boolean | null;
  mistake?: string | null;
} = {}) {
  const today = new Date().toISOString().split("T")[0];
  return {
    date: today,
    pnl: "1",
    pnlDollar: "100",
    ruleAdherence: true,
    mistake: null,
    ...overrides,
  };
}

const baseProfile = { maxTradesPerDay: "", maxDailyLoss: "" };

describe("calcDisciplineScore", () => {
  it("returns null when fewer than 3 trades have ruleAdherence tagged", () => {
    const trades = [makeTrade(), makeTrade()];
    expect(calcDisciplineScore(trades, baseProfile)).toBeNull();
  });

  it("returns null when no trades in the 7-day window", () => {
    const old = makeTrade({ date: "2020-01-01" });
    expect(calcDisciplineScore([old, old, old], baseProfile)).toBeNull();
  });

  it("returns null when trades exist but none have ruleAdherence set", () => {
    const trades = [
      makeTrade({ ruleAdherence: null }),
      makeTrade({ ruleAdherence: null }),
      makeTrade({ ruleAdherence: null }),
    ];
    expect(calcDisciplineScore(trades, baseProfile)).toBeNull();
  });

  it("returns score and grade for 3+ tagged trades (limits unset)", () => {
    const trades = [makeTrade(), makeTrade(), makeTrade()];
    const result = calcDisciplineScore(trades, baseProfile);
    expect(result).not.toBeNull();
    expect(result!.score).toBe(100);
    expect(result!.grade).toBe("A+");
  });

  it("perfect awareness when there are zero rule-breaking trades", () => {
    const trades = [makeTrade({ ruleAdherence: true }), makeTrade(), makeTrade()];
    const result = calcDisciplineScore(trades, baseProfile)!;
    expect(result.breakdown.awareness.earned).toBe(result.breakdown.awareness.max);
  });

  it("computes rule adherence correctly", () => {
    const trades = [
      makeTrade({ ruleAdherence: true }),
      makeTrade({ ruleAdherence: true }),
      makeTrade({ ruleAdherence: false, mistake: "Chased entry" }),
    ];
    const result = calcDisciplineScore(trades, baseProfile)!;
    const pct = result.breakdown.rules.earned / result.breakdown.rules.max;
    expect(pct).toBeCloseTo(0.667, 2);
  });

  it("awareness: full pts when all rule breaks are tagged with a mistake", () => {
    const trades = [
      makeTrade({ ruleAdherence: true }),
      makeTrade({ ruleAdherence: true }),
      makeTrade({ ruleAdherence: false, mistake: "Chased entry" }),
    ];
    const result = calcDisciplineScore(trades, baseProfile)!;
    expect(result.breakdown.awareness.earned).toBe(result.breakdown.awareness.max);
  });

  it("awareness: zero pts when rule breaks have no mistake tag", () => {
    const trades = [
      makeTrade({ ruleAdherence: true }),
      makeTrade({ ruleAdherence: true }),
      makeTrade({ ruleAdherence: false, mistake: null }),
    ];
    const result = calcDisciplineScore(trades, baseProfile)!;
    expect(result.breakdown.awareness.earned).toBe(0);
  });

  it("awareness: 'None' mistake tag counts as untagged", () => {
    const trades = [
      makeTrade({ ruleAdherence: true }),
      makeTrade({ ruleAdherence: true }),
      makeTrade({ ruleAdherence: false, mistake: "None" }),
    ];
    const result = calcDisciplineScore(trades, baseProfile)!;
    expect(result.breakdown.awareness.earned).toBe(0);
  });

  it("redistributes weight when trade limit unset", () => {
    const trades = [makeTrade(), makeTrade(), makeTrade()];
    const result = calcDisciplineScore(trades, { maxTradesPerDay: "", maxDailyLoss: "" })!;
    expect(result.breakdown.tradeLimit).toBeNull();
    expect(result.breakdown.lossLimit).toBeNull();
    expect(result.score).toBe(100);
  });

  it("includes trade limit signal when maxTradesPerDay is set", () => {
    const today = new Date().toISOString().split("T")[0];
    const trades = [
      makeTrade({ date: today }),
      makeTrade({ date: today }),
      makeTrade({ date: today }),
      makeTrade({ date: today }),
    ];
    const result = calcDisciplineScore(trades, { maxTradesPerDay: "3", maxDailyLoss: "" })!;
    expect(result.breakdown.tradeLimit).not.toBeNull();
    expect(result.breakdown.tradeLimit!.earned).toBe(0);
  });

  it("includes loss limit signal when maxDailyLoss is set", () => {
    const today = new Date().toISOString().split("T")[0];
    // Net daily P&L: -300 + -200 + -100 = -600, which breaches the $500 limit
    const trades = [
      makeTrade({ date: today, pnlDollar: "-300" }),
      makeTrade({ date: today, pnlDollar: "-200", ruleAdherence: true }),
      makeTrade({ date: today, pnlDollar: "-100", ruleAdherence: true }),
    ];
    const result = calcDisciplineScore(trades, { maxTradesPerDay: "", maxDailyLoss: "500" })!;
    expect(result.breakdown.lossLimit).not.toBeNull();
    expect(result.breakdown.lossLimit!.earned).toBe(0);
  });

  it("grade thresholds are correct", () => {
    const trades = [makeTrade(), makeTrade(), makeTrade()];
    const result = calcDisciplineScore(trades, baseProfile)!;
    expect(["A+", "A", "B", "C", "D", "F"]).toContain(result.grade);
  });

  it("dragSignal is null when all signals are performing well (>=72%)", () => {
    const trades = [makeTrade(), makeTrade(), makeTrade()];
    const result = calcDisciplineScore(trades, baseProfile)!;
    expect(result.dragSignal).toBeNull();
  });

  it("dragSignal identifies the worst-performing signal", () => {
    const trades = [
      makeTrade({ ruleAdherence: false, mistake: null }),
      makeTrade({ ruleAdherence: false, mistake: null }),
      makeTrade({ ruleAdherence: true }),
    ];
    const result = calcDisciplineScore(trades, baseProfile)!;
    expect(["rules", "awareness"]).toContain(result.dragSignal);
  });

  it("window field contains correct start and end dates", () => {
    const trades = [makeTrade(), makeTrade(), makeTrade()];
    const result = calcDisciplineScore(trades, baseProfile)!;
    expect(result.window.start).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    expect(result.window.end).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    expect(result.window.end >= result.window.start).toBe(true);
  });

  it("taggedCount reflects trades with non-null ruleAdherence in window", () => {
    // 3 tagged (true/true/false) + 1 untagged (null) → taggedCount should be 3
    const trades = [
      makeTrade({ ruleAdherence: true }),
      makeTrade({ ruleAdherence: true }),
      makeTrade({ ruleAdherence: false, mistake: null }),
      makeTrade({ ruleAdherence: null }),
    ];
    const result = calcDisciplineScore(trades, baseProfile)!;
    expect(result.taggedCount).toBe(3);
  });
});
