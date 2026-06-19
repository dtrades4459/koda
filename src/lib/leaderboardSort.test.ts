// ═══════════════════════════════════════════════════════════════════════════════
// leaderboardSort.test.ts — view-sorting for circle leaderboards.
// Run with: npm test
// ═══════════════════════════════════════════════════════════════════════════════

import { describe, it, expect } from "vitest";
import { sortLeaderboard, METRIC_VALUE, rankCompByDollar } from "./leaderboardSort";

// Entries arrive in rank order (server order / comp-metric order).
const entries = [
  { memberCode: "AAA", total: 30, winRate: 40, avgRR: 1.2 },
  { memberCode: "BBB", total: 10, winRate: 80, avgRR: 2.5 },
  { memberCode: "CCC", total: 20, winRate: 60, avgRR: 0.8 },
];

describe("METRIC_VALUE", () => {
  it("maps every circle metric to its field with NaN-safe defaults", () => {
    const e = {
      totalPnLDollar: 120, totalPnL: 3.5, total: 7,
      winRate: "60" as unknown as number,  // Supabase numeric-as-string
      avgRR: "—" as unknown as number,     // legacy publish format
      disciplineScore: null,
    };
    expect(METRIC_VALUE.dollar(e)).toBe(120);
    expect(METRIC_VALUE.r(e)).toBe(3.5);
    expect(METRIC_VALUE.winrate(e)).toBe(60);
    expect(METRIC_VALUE.trades(e)).toBe(7);
    expect(METRIC_VALUE.avgr(e)).toBe(0);
    // -1 sentinel keeps null-discipline members below anyone with a real score.
    expect(METRIC_VALUE.discipline(e)).toBe(-1);
  });

  it("coerces string discipline scores and never returns NaN", () => {
    expect(METRIC_VALUE.discipline({ disciplineScore: "85" as unknown as number })).toBe(85);
    expect(METRIC_VALUE.discipline({ disciplineScore: "—" as unknown as number })).toBe(0);
  });
});

describe("sortLeaderboard", () => {
  it("keeps incoming order and assigns rank 1..n for the rank key", () => {
    const out = sortLeaderboard(entries, "rank");
    expect(out.map(e => e.memberCode)).toEqual(["AAA", "BBB", "CCC"]);
    expect(out.map(e => e.rank)).toEqual([1, 2, 3]);
  });

  it("sorts by win rate descending", () => {
    const out = sortLeaderboard(entries, "winrate");
    expect(out.map(e => e.memberCode)).toEqual(["BBB", "CCC", "AAA"]);
  });

  it("sorts by trade count descending", () => {
    const out = sortLeaderboard(entries, "trades");
    expect(out.map(e => e.memberCode)).toEqual(["AAA", "CCC", "BBB"]);
  });

  it("sorts by avg R descending", () => {
    const out = sortLeaderboard(entries, "avgr");
    expect(out.map(e => e.memberCode)).toEqual(["BBB", "AAA", "CCC"]);
  });

  it("pins rank to the incoming order even when the view is re-sorted", () => {
    const out = sortLeaderboard(entries, "winrate");
    const byCode = Object.fromEntries(out.map(e => [e.memberCode, e.rank]));
    // AAA was first in (= rank 1) and must keep rank 1 in any view sort.
    expect(byCode).toEqual({ AAA: 1, BBB: 2, CCC: 3 });
  });

  it("sinks staff rows to the bottom and gives them no rank", () => {
    const withStaff = [
      { memberCode: "REF", total: 99, winRate: 99, avgRR: 9, staff: true },
      ...entries,
    ];
    const out = sortLeaderboard(withStaff, "winrate");
    expect(out[out.length - 1].memberCode).toBe("REF");
    expect(out[out.length - 1].rank).toBeNull();
    // Non-staff ranks are unaffected by the staff row's position in the input.
    expect(out.find(e => e.memberCode === "AAA")?.rank).toBe(1);
  });

  it("re-orders by dollar as a view sort with ranks still pinned", () => {
    // Comp circle: $ is a view sort key here; official rank is decided by
    // rankCompByDollar (also $). The R/$ toggle re-orders the view, ranks pinned.
    const comp = [
      { memberCode: "AAA", total: 3, winRate: 100, totalPnL: 9.0, totalPnLDollar: 50 },
      { memberCode: "BBB", total: 3, winRate: 50, totalPnL: 4.0, totalPnLDollar: 900 },
    ];
    const out = sortLeaderboard(comp, "dollar");
    expect(out.map(e => e.memberCode)).toEqual(["BBB", "AAA"]);
    expect(out.find(e => e.memberCode === "AAA")?.rank).toBe(1);
  });

  it("sinks staff rows to the bottom for the rank key too", () => {
    const withStaff = [
      { memberCode: "AAA", total: 30, winRate: 40, avgRR: 1.2 },
      { memberCode: "REF", total: 99, winRate: 99, avgRR: 9, staff: true },
      { memberCode: "BBB", total: 10, winRate: 80, avgRR: 2.5 },
    ];
    const out = sortLeaderboard(withStaff, "rank");
    expect(out.map(e => e.memberCode)).toEqual(["AAA", "BBB", "REF"]);
    expect(out.map(e => e.rank)).toEqual([1, 2, null]);
  });

  it("treats non-numeric metric values as 0 instead of NaN", () => {
    // Legacy shared_kv rows stored avgRR as the string "—"; Supabase can
    // return numerics as strings. Neither may poison the comparator.
    const dirty = [
      { memberCode: "AAA", total: 5, winRate: "60" as unknown as number, avgRR: "—" as unknown as number },
      { memberCode: "BBB", total: 5, winRate: 50, avgRR: 1.0 },
    ];
    expect(sortLeaderboard(dirty, "avgr").map(e => e.memberCode)).toEqual(["BBB", "AAA"]);
    expect(sortLeaderboard(dirty, "winrate").map(e => e.memberCode)).toEqual(["AAA", "BBB"]);
  });

  it("does not mutate the input array", () => {
    const input = [
      { memberCode: "AAA", total: 30, winRate: 40, avgRR: 1.2 },
      { memberCode: "BBB", total: 10, winRate: 80, avgRR: 2.5 },
    ];
    const snapshot = input.map(e => ({ ...e }));
    sortLeaderboard(input, "winrate");
    expect(input).toEqual(snapshot);
  });

  it("treats missing metric values as 0 and keeps ties in rank order", () => {
    const sparse = [
      { memberCode: "AAA", total: 5, winRate: 50 }, // no avgRR
      { memberCode: "BBB", total: 5, winRate: 50, avgRR: 1.0 },
      { memberCode: "CCC", total: 5, winRate: 50, avgRR: 0 },
    ];
    const out = sortLeaderboard(sparse, "avgr");
    // BBB (1.0) first; AAA and CCC tie at 0 and keep rank order (AAA before CCC).
    expect(out.map(e => e.memberCode)).toEqual(["BBB", "AAA", "CCC"]);
    const wr = sortLeaderboard(sparse, "winrate");
    expect(wr.map(e => e.memberCode)).toEqual(["AAA", "BBB", "CCC"]);
  });
});

describe("rankCompByDollar", () => {
  it("orders the comp leaderboard by dollar P&L descending, not by R", () => {
    // AAA leads on R (9.0R) but BBB leads on dollars ($900). Official comp
    // rank is now dollars, so BBB must come first — this is the regression
    // guard for CSV imports inflating R.
    const comp = [
      { memberCode: "AAA", totalPnL: 9.0, totalPnLDollar: 50 },
      { memberCode: "BBB", totalPnL: 4.0, totalPnLDollar: 900 },
    ];
    expect(rankCompByDollar(comp).map(e => e.memberCode)).toEqual(["BBB", "AAA"]);
  });

  it("treats missing/blank dollar values as 0", () => {
    const comp = [
      { memberCode: "AAA", totalPnLDollar: 0 },
      { memberCode: "BBB" }, // no dollar value
      { memberCode: "CCC", totalPnLDollar: 120 },
    ];
    expect(rankCompByDollar(comp).map(e => e.memberCode)).toEqual(["CCC", "AAA", "BBB"]);
  });

  it("does not mutate the input array", () => {
    const input = [
      { memberCode: "AAA", totalPnLDollar: 50 },
      { memberCode: "BBB", totalPnLDollar: 900 },
    ];
    const snapshot = input.map(e => ({ ...e }));
    rankCompByDollar(input);
    expect(input).toEqual(snapshot);
  });
});
