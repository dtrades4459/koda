import { describe, it, expect } from "vitest";
import { fanOutTrade, tradesForAccount, evalProgress, drawdownProximity, canAddAccount } from "./accounts";
import type { Account, Trade } from "../types";

const t = (over: Partial<Trade> = {}): Trade =>
  ({ id: 1, pair: "ES", pnlDollar: "100", date: "2026-06-01", ...over } as Trade);

const acct = (over: Partial<Account> = {}): Account => ({
  id: "a1", name: "A", type: "eval", drawdownType: "trailing", isArchived: false,
  sortOrder: 0, createdAt: "2026-06-01", startingBalance: 50000, profitTarget: 3000,
  maxDrawdown: 2000, ...over,
});

describe("fanOutTrade", () => {
  it("makes one row per account, each stamped, sharing a groupId", () => {
    const ids = fanOutTrade(t(), ["a1", "a2", "a3"], () => "g1");
    expect(ids).toHaveLength(3);
    expect(ids.map(r => r.accountId)).toEqual(["a1", "a2", "a3"]);
    expect(new Set(ids.map(r => r.groupId)).size).toBe(1);
  });
  it("single account still gets a groupId", () => {
    expect(fanOutTrade(t(), ["a1"], () => "g")[0].groupId).toBe("g");
  });
  it("empty accounts → empty array", () => {
    expect(fanOutTrade(t(), [])).toEqual([]);
  });
});

describe("tradesForAccount", () => {
  const trades = [
    t({ id: 1, accountId: "a1" }),
    t({ id: 2, accountId: "a2" }),
    t({ id: 3, accountId: "a1" }),
  ];
  it("filters by accountId", () => {
    expect(tradesForAccount(trades, "a1").map(x => x.id)).toEqual([1, 3]);
  });
  it("null returns all", () => {
    expect(tradesForAccount(trades, null)).toHaveLength(3);
  });
  it("attributes un-tagged trades to the default account", () => {
    const mixed = [t({ id: 1, accountId: "a1" }), t({ id: 2 }), t({ id: 3 })]; // 2 & 3 have no accountId
    expect(tradesForAccount(mixed, "a1", "a1").map(x => x.id)).toEqual([1, 2, 3]);
    expect(tradesForAccount(mixed, "a2", "a1")).toHaveLength(0);
  });
});

describe("evalProgress", () => {
  it("computes net $ and % to target", () => {
    const r = evalProgress(acct(), [t({ pnlDollar: "1500" }), t({ pnlDollar: "500" })]);
    expect(r.netPnl).toBe(2000);
    expect(r.pct).toBeCloseTo(66.67, 1);
  });
  it("null target → null pct", () => {
    expect(evalProgress(acct({ profitTarget: null }), [t()]).pct).toBeNull();
  });
});

describe("drawdownProximity (trailing)", () => {
  it("drawdown is peak equity minus current equity", () => {
    // equity: 50000 -> 51000 -> 50250 ; peak 51000, current 50250, dd 750
    const r = drawdownProximity(acct(), [t({ pnlDollar: "1000" }), t({ pnlDollar: "-750" })]);
    expect(r.peakEquity).toBe(51000);
    expect(r.currentEquity).toBe(50250);
    expect(r.drawdown).toBe(750);
    expect(r.pct).toBeCloseTo(37.5, 1); // 750 / 2000
  });
  it("null limit → null pct", () => {
    expect(drawdownProximity(acct({ maxDrawdown: null }), [t()]).pct).toBeNull();
  });
});

describe("canAddAccount", () => {
  it("free allows the first account only", () => {
    expect(canAddAccount(0, false)).toBe(true);
    expect(canAddAccount(1, false)).toBe(false);
  });
  it("pro is unlimited", () => {
    expect(canAddAccount(5, true)).toBe(true);
  });
});
