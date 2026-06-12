// ═══════════════════════════════════════════════════════════════════════════════
// Kōda · leaderboard entry builder
//
// Pure extraction of the entry construction that lived inline in
// useCircles.publishToCircle, so the privacy filtering is unit-testable:
// hidden metrics are published as null — they never reach shared_kv at all.
//
// null means "withheld by the user" (the viz flags echo which); the UI shows
// "Private", not 0. Entries published before this change carry no viz field —
// readers treat absent viz as all-visible.
// ═══════════════════════════════════════════════════════════════════════════════

import type { CircleVisibility } from "./circleVisibility";

/** Structural subset of useCircles' CircleStats that the builder needs. */
export interface EntryStats {
  wins: number;
  losses: number;
  total: number;
  winRate: string | number;
  totalPnL: string;
  totalPnlDollar: number;
  weekPnL: number;
  avgRR: string;
  streak: { type: string | null; count: number };
  stratStats: Record<string, { w: number; l: number; be: number; pnl: number; count: number }>;
  disciplineScore: number | null;
  disciplineGrade: string | null;
  ruleCompliancePct?: number | null;
  taggedCount?: number | null;
}

export interface EntryIdentity {
  memberCode: string;
  name: string;
  handle: string;
  avatar: string;
  alias: string;
}

/** Echoed toggles so the UI can distinguish "Private" from "no data yet". */
export interface PublishedVizFlags {
  pnl: boolean;
  winRate: boolean;
  discipline: boolean;
  avgRR: boolean;
}

export interface PublishedLeaderboardEntry {
  memberCode: string;
  name: string;
  handle: string;
  avatar: string;
  alias: string;
  wins: number;
  losses: number;
  total: number;
  winRate: string | number | null;
  /** R-units — not cash; never hidden by the pnl toggle. */
  totalPnL: number;
  totalPnLDollar: number | null;
  weekPnL: number | null;
  pnlPercent: number | null;
  avgRR: number | null;
  streak: { type: string; count: number } | null;
  topStrategy: string | null;
  disciplineScore: number | null;
  disciplineGrade: string | null;
  ruleCompliancePct: number | null;
  taggedCount: number | null;
  viz: PublishedVizFlags;
  updatedAt: string;
  shotsMissing?: number;
  staff?: true;
}

export function buildLeaderboardEntry(input: {
  me: EntryIdentity;
  stats: EntryStats;
  viz: CircleVisibility;
  /** Funded/account balance used for pnlPercent; 0 = unknown. */
  accountSize: number;
  extras?: { shotsMissing?: number; staff?: true };
}): PublishedLeaderboardEntry {
  const { me, stats: s, viz, accountSize, extras } = input;

  const pnlPercent =
    accountSize > 0 && s.totalPnlDollar !== 0
      ? (s.totalPnlDollar / accountSize) * 100
      : null;

  const topStrategy =
    Object.entries(s.stratStats).sort(
      (a, b) =>
        b[1].w / Math.max(b[1].count, 1) - a[1].w / Math.max(a[1].count, 1)
    )[0]?.[0] || null;

  return {
    memberCode: me.memberCode,
    name: me.name,
    handle: me.handle,
    avatar: me.avatar,
    alias: me.alias,
    // Counts are process metrics — visible like streak/topStrategy.
    wins: s.wins,
    losses: s.losses,
    total: s.total,
    winRate: viz.winRate ? s.winRate : null,
    totalPnL: parseFloat(s.totalPnL),
    totalPnLDollar: viz.pnl ? s.totalPnlDollar : null,
    weekPnL: viz.pnl ? s.weekPnL : null,
    pnlPercent: viz.pnl ? pnlPercent : null,
    avgRR: viz.avgRR ? (s.avgRR === "—" ? 0 : parseFloat(s.avgRR)) : null,
    streak:
      s.streak.count > 0 && s.streak.type
        ? { type: s.streak.type, count: s.streak.count }
        : null,
    topStrategy,
    disciplineScore: viz.discipline ? s.disciplineScore : null,
    disciplineGrade: viz.discipline ? s.disciplineGrade : null,
    ruleCompliancePct: viz.discipline ? s.ruleCompliancePct ?? null : null,
    taggedCount: viz.discipline ? s.taggedCount ?? null : null,
    viz: {
      pnl: viz.pnl,
      winRate: viz.winRate,
      discipline: viz.discipline,
      avgRR: viz.avgRR,
    },
    updatedAt: new Date().toISOString(),
    ...(extras?.shotsMissing !== undefined ? { shotsMissing: extras.shotsMissing } : {}),
    ...(extras?.staff ? { staff: true as const } : {}),
  };
}
