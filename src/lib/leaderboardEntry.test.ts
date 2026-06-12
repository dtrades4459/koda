import { describe, it, expect } from "vitest";
import { buildLeaderboardEntry, type EntryStats, type EntryIdentity } from "./leaderboardEntry";
import { VIZ_ALL_VISIBLE } from "./circleVisibility";

const me: EntryIdentity = {
  memberCode: "KT-9F2A",
  name: "Dylon",
  handle: "@dylon",
  avatar: "a.png",
  alias: "KT-9F2A",
};

function stats(overrides: Partial<EntryStats> = {}): EntryStats {
  return {
    wins: 8,
    losses: 5,
    total: 13,
    winRate: "61.5",
    totalPnL: "12.40",
    totalPnlDollar: 842,
    weekPnL: 3.2,
    avgRR: "1.85",
    streak: { type: "win", count: 3 },
    stratStats: {
      "London Sweep": { w: 5, l: 1, be: 0, pnl: 9, count: 6 },
      "NY Reversal": { w: 3, l: 4, be: 0, pnl: 3.4, count: 7 },
    },
    disciplineScore: 92,
    disciplineGrade: "A",
    ruleCompliancePct: 94,
    taggedCount: 11,
    ...overrides,
  };
}

describe("buildLeaderboardEntry — all visible (legacy parity)", () => {
  it("publishes the same shape publishToCircle always wrote, plus viz/compliance", () => {
    const e = buildLeaderboardEntry({ me, stats: stats(), viz: VIZ_ALL_VISIBLE, accountSize: 10_000 });
    expect(e.memberCode).toBe("KT-9F2A");
    expect(e.winRate).toBe("61.5");
    expect(e.totalPnL).toBeCloseTo(12.4);
    expect(e.totalPnLDollar).toBe(842);
    expect(e.weekPnL).toBeCloseTo(3.2);
    expect(e.pnlPercent).toBeCloseTo(8.42);
    expect(e.avgRR).toBeCloseTo(1.85);
    expect(e.streak).toEqual({ type: "win", count: 3 });
    expect(e.topStrategy).toBe("London Sweep"); // best win ratio
    expect(e.disciplineScore).toBe(92);
    expect(e.ruleCompliancePct).toBe(94);
    expect(e.viz).toEqual({ pnl: true, winRate: true, discipline: true, avgRR: true });
  });

  it("pnlPercent null when account size unknown; avgRR em-dash → 0", () => {
    const e = buildLeaderboardEntry({
      me, stats: stats({ avgRR: "—" }), viz: VIZ_ALL_VISIBLE, accountSize: 0,
    });
    expect(e.pnlPercent).toBeNull();
    expect(e.avgRR).toBe(0);
  });

  it("comp extras pass through untouched", () => {
    const e = buildLeaderboardEntry({
      me, stats: stats(), viz: VIZ_ALL_VISIBLE, accountSize: 0,
      extras: { shotsMissing: 2, staff: true },
    });
    expect(e.shotsMissing).toBe(2);
    expect(e.staff).toBe(true);
    const none = buildLeaderboardEntry({ me, stats: stats(), viz: VIZ_ALL_VISIBLE, accountSize: 0 });
    expect("shotsMissing" in none).toBe(false);
    expect("staff" in none).toBe(false);
  });
});

describe("buildLeaderboardEntry — privacy filtering", () => {
  it("hide pnl: every cash field is null, R-multiples and counts survive", () => {
    const e = buildLeaderboardEntry({
      me, stats: stats(), viz: { ...VIZ_ALL_VISIBLE, pnl: false }, accountSize: 10_000,
    });
    expect(e.totalPnLDollar).toBeNull();
    expect(e.weekPnL).toBeNull();
    expect(e.pnlPercent).toBeNull();
    expect(e.totalPnL).toBeCloseTo(12.4); // R — not cash
    expect(e.wins).toBe(8);
    expect(e.viz.pnl).toBe(false);
    // The serialized row (what actually lands in shared_kv) carries no cash:
    expect(JSON.stringify(e)).not.toContain("842");
  });

  it("hide discipline: score, grade, compliance, and tag count all null", () => {
    const e = buildLeaderboardEntry({
      me, stats: stats(), viz: { ...VIZ_ALL_VISIBLE, discipline: false }, accountSize: 0,
    });
    expect(e.disciplineScore).toBeNull();
    expect(e.disciplineGrade).toBeNull();
    expect(e.ruleCompliancePct).toBeNull();
    expect(e.taggedCount).toBeNull();
  });

  it("hide winRate / avgRR independently", () => {
    const e = buildLeaderboardEntry({
      me, stats: stats(), viz: { ...VIZ_ALL_VISIBLE, winRate: false, avgRR: false }, accountSize: 0,
    });
    expect(e.winRate).toBeNull();
    expect(e.avgRR).toBeNull();
    expect(e.disciplineScore).toBe(92);
  });
});
