import { describe, it, expect } from "vitest";
import {
  mergeVisibility,
  applyRequiredMetrics,
  requiredMetricsFor,
  VIZ_ALL_VISIBLE,
} from "./circleVisibility";
import { COMP_CIRCLE_CODE } from "./competition";

describe("mergeVisibility", () => {
  it("defaults to all-visible (pre-feature behavior preserved)", () => {
    expect(mergeVisibility(null, null)).toEqual(VIZ_ALL_VISIBLE);
  });

  it("account default applies when no per-circle override", () => {
    const v = mergeVisibility(JSON.stringify({ pnl: false }), null);
    expect(v.pnl).toBe(false);
    expect(v.winRate).toBe(true);
  });

  it("per-circle override beats the account default", () => {
    const v = mergeVisibility(
      JSON.stringify({ pnl: false, winRate: false }),
      JSON.stringify({ pnl: true }),
    );
    expect(v.pnl).toBe(true);       // circle re-enables
    expect(v.winRate).toBe(false);  // default still applies
  });

  it("malformed JSON rows are treated as unset, not as errors", () => {
    expect(mergeVisibility("{nope", "also nope")).toEqual(VIZ_ALL_VISIBLE);
    expect(mergeVisibility(JSON.stringify("a string"), null)).toEqual(VIZ_ALL_VISIBLE);
  });
});

describe("requiredMetricsFor / applyRequiredMetrics", () => {
  it("normal circles require nothing by default", () => {
    expect(requiredMetricsFor("LONDON-X3K2")).toEqual([]);
    const hidden = { ...VIZ_ALL_VISIBLE, pnl: false };
    expect(applyRequiredMetrics(hidden, "LONDON-X3K2")).toEqual(hidden);
  });

  it("the competition circle force-shares pnl, winRate, discipline — competitors cannot blank the board", () => {
    const allHidden = { pnl: false, winRate: false, discipline: false, avgRR: false, tradeLogs: false };
    const v = applyRequiredMetrics(allHidden, COMP_CIRCLE_CODE);
    expect(v.pnl).toBe(true);
    expect(v.winRate).toBe(true);
    expect(v.discipline).toBe(true);
    expect(v.avgRR).toBe(false);    // not comp-required
    expect(v.tradeLogs).toBe(false); // never force-shareable
  });

  it("circle meta requiredMetrics are honored (Phase D creator UI)", () => {
    const v = applyRequiredMetrics(
      { ...VIZ_ALL_VISIBLE, discipline: false },
      "COACH-AB12",
      ["discipline"],
    );
    expect(v.discipline).toBe(true);
  });

  it("does not mutate the input", () => {
    const input = { ...VIZ_ALL_VISIBLE, pnl: false };
    applyRequiredMetrics(input, COMP_CIRCLE_CODE);
    expect(input.pnl).toBe(false);
  });
});
