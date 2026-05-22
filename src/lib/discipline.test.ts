import { describe, it, expect } from "vitest";
import { computeDisciplineScore } from "./discipline";
import type { Trade } from "../types";

const base: Partial<Trade> = {
  id: 1, date: "2026-05-01", pair: "ES", session: "", bias: "", strategy: "",
  setup: "", entryPrice: "", slPrice: "", tpPrice: "", rr: "", outcome: "win",
  pnl: "1", notes: "", emotions: "", screenshot: "", pnlDollar: "100",
  comments: [], reactions: {},
};

function t(ruleAdherence: boolean | null | undefined, daysAgo = 0): Trade {
  const d = new Date("2026-05-22");
  d.setDate(d.getDate() - daysAgo);
  return { ...base, id: Math.random(), date: d.toISOString().split("T")[0], ruleAdherence } as Trade;
}

describe("computeDisciplineScore", () => {
  it("returns null when no trades have ruleAdherence logged", () => {
    expect(computeDisciplineScore([t(null), t(undefined)], "2026-05-22")).toBeNull();
  });

  it("calculates 100% when all trades followed rules", () => {
    const result = computeDisciplineScore([t(true), t(true), t(true)], "2026-05-22");
    expect(result?.pct).toBe(100);
    expect(result?.followed).toBe(3);
    expect(result?.total).toBe(3);
  });

  it("calculates 50% with mixed adherence", () => {
    const result = computeDisciplineScore([t(true), t(false)], "2026-05-22");
    expect(result?.pct).toBe(50);
  });

  it("only counts trades within the last 30 days", () => {
    const result = computeDisciplineScore([t(true, 0), t(true, 29), t(false, 31)], "2026-05-22");
    expect(result?.total).toBe(2);
    expect(result?.pct).toBe(100);
  });

  it("ignores trades where ruleAdherence is null", () => {
    const result = computeDisciplineScore([t(true), t(null), t(false)], "2026-05-22");
    expect(result?.total).toBe(2);
    expect(result?.pct).toBe(50);
  });
});
