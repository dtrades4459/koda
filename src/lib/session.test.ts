import { describe, it, expect } from "vitest";
import { startSession, addTap, isStale, type ActiveSession } from "./session";

const baseISO = "2026-06-18T14:00:00.000Z";

describe("session core", () => {
  it("startSession captures config and an empty tally", () => {
    const s = startSession({ startedAt: baseISO, maxDailyLoss: 500, maxTradesPerDay: 5 });
    expect(s.startedAt).toBe(baseISO);
    expect(s.maxDailyLoss).toBe(500);
    expect(s.maxTradesPerDay).toBe(5);
    expect(s.taps).toEqual([]);
  });

  it("addTap appends in order and does not mutate the input", () => {
    const s0 = startSession({ startedAt: baseISO, maxDailyLoss: null, maxTradesPerDay: null });
    const s1 = addTap(s0, { outcome: "Loss", pnlDollar: -100, at: "2026-06-18T14:05:00.000Z" });
    const s2 = addTap(s1, { outcome: "Win", pnlDollar: 50, at: "2026-06-18T14:10:00.000Z" });
    expect(s0.taps).toHaveLength(0);            // original untouched
    expect(s2.taps.map(t => t.outcome)).toEqual(["Loss", "Win"]);
  });

  it("isStale is false for a session started today, true for a prior day", () => {
    const now = Date.parse("2026-06-18T20:00:00.000Z");
    const today: ActiveSession = startSession({ startedAt: "2026-06-18T09:00:00.000Z", maxDailyLoss: null, maxTradesPerDay: null });
    const yesterday: ActiveSession = startSession({ startedAt: "2026-06-17T09:00:00.000Z", maxDailyLoss: null, maxTradesPerDay: null });
    expect(isStale(today, now)).toBe(false);
    expect(isStale(yesterday, now)).toBe(true);
  });
});
