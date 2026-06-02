import { describe, it, expect } from "vitest";
import { evaluateTilt } from "./tilt";
import type { Trade, Profile } from "../types";

const EMPTY_PROFILE: Profile = {
  name: "", handle: "", bio: "", avatar: "", broker: "",
  timezone: "UTC", startDate: "", targetRR: "",
  maxTradesPerDay: "",
};

describe("evaluateTilt", () => {
  it("returns inactive state when there are no trades", () => {
    const state = evaluateTilt([] as Trade[], EMPTY_PROFILE, Date.parse("2026-06-02T15:00:00Z"));
    expect(state.active).toBe(false);
    expect(state.signals).toEqual([]);
  });
});

function mkTrade(over: Partial<Trade>): Trade {
  return {
    id: over.id ?? Math.floor(Math.random() * 1e9),
    date: over.date ?? "2026-06-02",
    pair: over.pair ?? "ES",
    session: "", bias: "", strategy: "", setup: "",
    entryPrice: "", slPrice: "", tpPrice: "", rr: "",
    outcome: over.outcome ?? "Win",
    pnl: over.pnl ?? "0",
    pnlDollar: over.pnlDollar ?? "0",
    notes: "", emotions: over.emotions ?? "",
    screenshot: "",
    comments: [], reactions: {},
    entryTime: over.entryTime,
    exitTime: over.exitTime,
  };
}

const NOW = Date.parse("2026-06-02T20:00:00Z");
const TODAY = "2026-06-02";

describe("consec_losses signal", () => {
  it("does not fire with 1 loss", () => {
    const trades = [mkTrade({ date: TODAY, outcome: "Loss", entryTime: "2026-06-02T19:55:00Z" })];
    const state = evaluateTilt(trades, EMPTY_PROFILE, NOW);
    expect(state.signals.find(s => s.id === "consec_losses")).toBeUndefined();
  });

  it("fires when last 2 trades are losses", () => {
    const trades = [
      mkTrade({ date: TODAY, outcome: "Loss", entryTime: "2026-06-02T19:30:00Z" }),
      mkTrade({ date: TODAY, outcome: "Loss", entryTime: "2026-06-02T19:55:00Z" }),
    ];
    const state = evaluateTilt(trades, EMPTY_PROFILE, NOW);
    const sig = state.signals.find(s => s.id === "consec_losses");
    expect(sig).toBeDefined();
    expect(sig?.label).toBe("2 consecutive losses");
    expect(sig?.critical).toBe(false);
  });

  it("does not count yesterday's losses", () => {
    const trades = [
      mkTrade({ date: "2026-06-01", outcome: "Loss", entryTime: "2026-06-01T19:30:00Z" }),
      mkTrade({ date: "2026-06-01", outcome: "Loss", entryTime: "2026-06-01T19:55:00Z" }),
    ];
    const state = evaluateTilt(trades, EMPTY_PROFILE, NOW);
    expect(state.signals.find(s => s.id === "consec_losses")).toBeUndefined();
  });

  it("resets after a Win", () => {
    const trades = [
      mkTrade({ date: TODAY, outcome: "Loss", entryTime: "2026-06-02T19:00:00Z" }),
      mkTrade({ date: TODAY, outcome: "Loss", entryTime: "2026-06-02T19:30:00Z" }),
      mkTrade({ date: TODAY, outcome: "Win",  entryTime: "2026-06-02T19:45:00Z" }),
    ];
    const state = evaluateTilt(trades, EMPTY_PROFILE, NOW);
    expect(state.signals.find(s => s.id === "consec_losses")).toBeUndefined();
  });
});

describe("daily_loss signals", () => {
  it("does not fire when maxDailyLoss is unset", () => {
    const trades = [mkTrade({ date: TODAY, outcome: "Loss", pnlDollar: "-200" })];
    const state = evaluateTilt(trades, EMPTY_PROFILE, NOW);
    expect(state.signals.find(s => s.id?.startsWith("daily_loss"))).toBeUndefined();
  });

  it("fires daily_loss_75 at 75% of limit", () => {
    const trades = [
      mkTrade({ date: TODAY, outcome: "Loss", pnlDollar: "-150" }),
      mkTrade({ date: TODAY, outcome: "Loss", pnlDollar: "-26" }),
    ];
    const state = evaluateTilt(trades, { ...EMPTY_PROFILE, maxDailyLoss: "200" }, NOW);
    const sig = state.signals.find(s => s.id === "daily_loss_75");
    expect(sig).toBeDefined();
    expect(sig?.label).toBe("-88% of daily loss limit");
    expect(sig?.critical).toBe(false);
  });

  it("fires daily_loss_90 at 90% of limit and marks critical", () => {
    const trades = [mkTrade({ date: TODAY, outcome: "Loss", pnlDollar: "-185" })];
    const state = evaluateTilt(trades, { ...EMPTY_PROFILE, maxDailyLoss: "200" }, NOW);
    const sig = state.signals.find(s => s.id === "daily_loss_90");
    expect(sig).toBeDefined();
    expect(sig?.critical).toBe(true);
  });

  it("does not fire if net P&L is positive even with losses logged", () => {
    const trades = [
      mkTrade({ date: TODAY, outcome: "Loss", pnlDollar: "-50" }),
      mkTrade({ date: TODAY, outcome: "Win",  pnlDollar: "300" }),
    ];
    const state = evaluateTilt(trades, { ...EMPTY_PROFILE, maxDailyLoss: "200" }, NOW);
    expect(state.signals.find(s => s.id?.startsWith("daily_loss"))).toBeUndefined();
  });
});

describe("trade_cap_at signal", () => {
  it("does not fire when maxTradesPerDay is unset", () => {
    const trades = Array.from({ length: 10 }, (_, i) =>
      mkTrade({ date: TODAY, outcome: "Win", entryTime: `2026-06-02T${10 + i}:00:00Z` }),
    );
    const state = evaluateTilt(trades, EMPTY_PROFILE, NOW);
    expect(state.signals.find(s => s.id === "trade_cap_at")).toBeUndefined();
  });

  it("fires (critical) when today's trade count equals cap", () => {
    const trades = [
      mkTrade({ date: TODAY, outcome: "Win", entryTime: "2026-06-02T10:00:00Z" }),
      mkTrade({ date: TODAY, outcome: "Win", entryTime: "2026-06-02T11:00:00Z" }),
      mkTrade({ date: TODAY, outcome: "Win", entryTime: "2026-06-02T12:00:00Z" }),
    ];
    const state = evaluateTilt(trades, { ...EMPTY_PROFILE, maxTradesPerDay: "3" }, NOW);
    const sig = state.signals.find(s => s.id === "trade_cap_at");
    expect(sig).toBeDefined();
    expect(sig?.critical).toBe(true);
  });
});

describe("revenge_window signal", () => {
  it("does not fire when last trade was a Win", () => {
    const trades = [mkTrade({
      date: TODAY, outcome: "Win",
      entryTime: "2026-06-02T19:50:00Z", exitTime: "2026-06-02T19:55:00Z",
    })];
    const state = evaluateTilt(trades, EMPTY_PROFILE, NOW);
    expect(state.signals.find(s => s.id === "revenge_window")).toBeUndefined();
  });

  it("fires when last trade was a Loss closed within 10 minutes", () => {
    const trades = [mkTrade({
      date: TODAY, outcome: "Loss",
      entryTime: "2026-06-02T19:50:00Z", exitTime: "2026-06-02T19:55:00Z",
    })];
    const state = evaluateTilt(trades, EMPTY_PROFILE, NOW);
    const sig = state.signals.find(s => s.id === "revenge_window");
    expect(sig).toBeDefined();
    expect(sig?.label).toBe("Within 10 min of a loss");
  });

  it("does not fire 15 minutes after the loss", () => {
    const trades = [mkTrade({
      date: TODAY, outcome: "Loss",
      entryTime: "2026-06-02T19:30:00Z", exitTime: "2026-06-02T19:45:00Z",
    })];
    const state = evaluateTilt(trades, EMPTY_PROFILE, NOW);
    expect(state.signals.find(s => s.id === "revenge_window")).toBeUndefined();
  });

  it("falls back to entryTime when exitTime is missing", () => {
    const trades = [mkTrade({
      date: TODAY, outcome: "Loss",
      entryTime: "2026-06-02T19:55:00Z",
    })];
    const state = evaluateTilt(trades, EMPTY_PROFILE, NOW);
    expect(state.signals.find(s => s.id === "revenge_window")).toBeDefined();
  });
});

describe("tilt_emotion signal", () => {
  it("does not fire when last trade has no tilt emotion", () => {
    const trades = [mkTrade({ date: TODAY, outcome: "Win", emotions: "disciplined,patient" })];
    const state = evaluateTilt(trades, EMPTY_PROFILE, NOW);
    expect(state.signals.find(s => s.id === "tilt_emotion")).toBeUndefined();
  });

  it("fires when last trade is tagged 'revenge'", () => {
    const trades = [mkTrade({ date: TODAY, outcome: "Loss", emotions: "revenge,fomo" })];
    const state = evaluateTilt(trades, EMPTY_PROFILE, NOW);
    const sig = state.signals.find(s => s.id === "tilt_emotion");
    expect(sig).toBeDefined();
    expect(sig?.label).toMatch(/REVENGE/i);
  });

  it("fires for any of: fomo, revenge, chased, movedsl, overtrading", () => {
    const ids = ["fomo", "revenge", "chased", "movedsl", "overtrading"];
    for (const id of ids) {
      const trades = [mkTrade({ date: TODAY, outcome: "Loss", emotions: id })];
      const state = evaluateTilt(trades, EMPTY_PROFILE, NOW);
      expect(state.signals.find(s => s.id === "tilt_emotion"), id).toBeDefined();
    }
  });
});
