// ═══════════════════════════════════════════════════════════════════════════════
// leaderboardSort.ts — view-sorting for circle leaderboards.
//
// Input entries MUST already be in rank order (server order for normal circles,
// metric-sorted for the comp circle). Rank is assigned from that order and stays
// pinned to it: re-sorting the view by win rate or trades must never move medals
// or rank numbers — competition rank is decided by the primary metric only.
// Staff/referee rows get no rank and always sink to the bottom.
// ═══════════════════════════════════════════════════════════════════════════════

export type LeaderboardSortKey = "rank" | "winrate" | "trades" | "avgr" | "dollar";

export type CircleMetric = "dollar" | "r" | "winrate" | "trades" | "avgr" | "discipline";

export interface LeaderboardSortable {
  winRate?: number | null;
  total?: number | null;
  avgRR?: number | null;
  totalPnL?: number | null;
  totalPnLDollar?: number | null;
  disciplineScore?: number | null;
  staff?: boolean;
}

// Single metric→value map shared by the view sort below, the circle-metric
// ranking in useCircles, and metricDisplay in TradingCircles. `|| 0` (not
// `?? 0`) so NaN from legacy string values ("—", Supabase numerics-as-strings)
// sorts as 0 instead of poisoning the comparator. Discipline keeps its -1
// sentinel so null-discipline members rank below anyone with a real score.
export const METRIC_VALUE: Record<CircleMetric, (e: LeaderboardSortable) => number> = {
  dollar: e => Number(e.totalPnLDollar) || 0,
  r: e => Number(e.totalPnL) || 0,
  winrate: e => Number(e.winRate) || 0,
  trades: e => Number(e.total) || 0,
  avgr: e => Number(e.avgRR) || 0,
  discipline: e => e.disciplineScore == null ? -1 : Number(e.disciplineScore) || 0,
};

export type Ranked<T> = T & { rank: number | null };

export function sortLeaderboard<T extends LeaderboardSortable>(
  entries: T[],
  key: LeaderboardSortKey,
): Ranked<T>[] {
  let nextRank = 1;
  const ranked: Ranked<T>[] = entries.map(e => ({
    ...e,
    rank: e.staff ? null : nextRank++,
  }));

  // .sort() is stable, so ties — and the whole list under the "rank" key —
  // keep their rank order.
  return ranked.sort((a, b) => {
    if (a.staff && !b.staff) return 1;
    if (!a.staff && b.staff) return -1;
    if (key === "rank") return 0;
    return METRIC_VALUE[key](b) - METRIC_VALUE[key](a);
  });
}
