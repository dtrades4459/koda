import { describe, it, expect } from "vitest";
import { startSession, addTap, isStale, tapsToTrades, tally, type ActiveSession } from "./session";
import { evaluateTilt } from "./tilt";
import type { Profile } from "../types";

const baseISO = "2026-06-18T14:00:00.000Z";
const PROFILE: Pick<Profile, "maxDailyLoss" | "maxTradesPerDay"> = { maxDailyLoss: "500", maxTradesPerDay: "5" };

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

describe("tapsToTrades adapter", () => {
  it("produces time-ordered Trade-shaped objects evaluateTilt can read", () => {
    const day = "2026-06-18";
    const taps = [
      { outcome: "Loss" as const, pnlDollar: -200, at: "2026-06-18T14:00:00.000Z" },
      { outcome: "Loss" as const, pnlDollar: -200, at: "2026-06-18T14:05:00.000Z" },
    ];
    const trades = tapsToTrades(taps, day);
    expect(trades).toHaveLength(2);
    expect(trades[0].date).toBe(day);
    expect(trades[0].outcome).toBe("Loss");
    expect(trades[0].pnlDollar).toBe("-200");
    // two consecutive losses → consec_losses active
    const state = evaluateTilt(trades, PROFILE, Date.parse("2026-06-18T14:06:00.000Z"));
    expect(state.signals.some(s => s.id === "consec_losses")).toBe(true);
  });

  it("maps a null pnl tap to '0'", () => {
    const trades = tapsToTrades([{ outcome: "Win", pnlDollar: null, at: "2026-06-18T14:00:00.000Z" }], "2026-06-18");
    expect(trades[0].pnlDollar).toBe("0");
  });
});

describe("tally", () => {
  it("counts wins/losses, nets $, and reports the trailing streak", () => {
    const s: ActiveSession = { startedAt: "2026-06-18T09:00:00.000Z", maxDailyLoss: 500, maxTradesPerDay: 5, taps: [
      { outcome: "Win", pnlDollar: 100, at: "a" },
      { outcome: "Loss", pnlDollar: -50, at: "b" },
      { outcome: "Loss", pnlDollar: -50, at: "c" },
    ]};
    const t = tally(s);
    expect(t.wins).toBe(1);
    expect(t.losses).toBe(2);
    expect(t.netDollar).toBe(0);
    expect(t.hasDollar).toBe(true);
    expect(t.streak).toBe(2);
    expect(t.streakKind).toBe("Loss");
  });

  it("hasDollar is false when no tap carries a dollar value", () => {
    const s: ActiveSession = { startedAt: "2026-06-18T09:00:00.000Z", maxDailyLoss: null, maxTradesPerDay: null, taps: [
      { outcome: "Win", pnlDollar: null, at: "a" },
    ]};
    expect(tally(s).hasDollar).toBe(false);
  });
});
