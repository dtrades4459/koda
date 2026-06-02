// ═══════════════════════════════════════════════════════════════════════════════
// Kōda · stats.ts
//
// Pure calculation functions for trade statistics.
// No React, no side-effects — safe to unit-test in isolation.
// ═══════════════════════════════════════════════════════════════════════════════

import type { Trade, Profile } from "../types";

// ── R:R calculator ────────────────────────────────────────────────────────────

/**
 * Calculate risk/reward ratio from entry, stop-loss, and take-profit prices.
 * Returns a formatted string (e.g. "2.50") or "" if the inputs are invalid.
 */
export function calcRR(entry: string, stopLoss: string, takeProfit: string): string {
  const ev = parseFloat(entry);
  const sv = parseFloat(stopLoss);
  const tv = parseFloat(takeProfit);
  if (isNaN(ev) || isNaN(sv) || isNaN(tv)) return "";
  const risk = Math.abs(ev - sv);
  if (risk === 0) return ""; // entry === stop loss → undefined R:R
  const reward = Math.abs(tv - ev);
  const rr = reward / risk;
  // Sanity-cap: anything above 100R is almost certainly a data error.
  if (!isFinite(rr) || rr > 100) return "";
  return rr.toFixed(2);
}

// ── Win rate ──────────────────────────────────────────────────────────────────

/** Returns win rate as a percentage (0–100), rounded to 1 decimal place. */
export function calcWinRate(trades: Pick<Trade, "outcome">[]): number {
  const total = trades.length;
  if (total === 0) return 0;
  const wins = trades.filter(t => t.outcome === "Win").length;
  return parseFloat(((wins / total) * 100).toFixed(1));
}

// ── Current streak ────────────────────────────────────────────────────────────

export interface Streak {
  type: "Win" | "Loss" | null;
  count: number;
}

/**
 * Returns the current consecutive streak from the most recent trades.
 * Trades are expected newest-first (as stored in the app).
 * Breakeven trades are skipped — they don't break or extend a streak.
 */
export function calcStreak(trades: Pick<Trade, "outcome">[]): Streak {
  if (!trades.length) return { type: null, count: 0 };
  let count = 0;
  let type: "Win" | "Loss" | null = null;
  for (const t of trades) {
    if (t.outcome !== "Win" && t.outcome !== "Loss") continue; // skip BE
    if (type === null) {
      type = t.outcome as "Win" | "Loss";
      count = 1;
    } else if (t.outcome === type) {
      count++;
    } else {
      break;
    }
  }
  return { type, count };
}

// ── Weekly P&L ────────────────────────────────────────────────────────────────

/** Sum P&L (in R) for trades in the current calendar week (Mon–Sun). */
export function calcWeeklyPnL(trades: Pick<Trade, "date" | "pnl">[]): number {
  const now = new Date();
  const day = now.getDay(); // 0 = Sun
  const monday = new Date(now);
  monday.setDate(now.getDate() - ((day + 6) % 7));
  monday.setHours(0, 0, 0, 0);
  return trades
    .filter(t => t.date && new Date(t.date + "T12:00:00") >= monday)
    .reduce((sum, t) => sum + (parseFloat(t.pnl as string) || 0), 0);
}

// ── Total P&L ─────────────────────────────────────────────────────────────────

/** Sum P&L (in R) across all trades. */
export function calcTotalPnL(trades: Pick<Trade, "pnl">[]): number {
  return trades.reduce((sum, t) => sum + (parseFloat(t.pnl as string) || 0), 0);
}

// ── Weekly recap ──────────────────────────────────────────────────────────────

/** Returns the Monday at 00:00 of the ISO week containing `d` (in local time). */
export function isoWeekStart(d: Date): Date {
  const out = new Date(d);
  const dow = out.getDay(); // 0 = Sun
  out.setDate(out.getDate() - ((dow + 6) % 7));
  out.setHours(0, 0, 0, 0);
  return out;
}

const DOW_LABELS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

export interface WeeklyRecap {
  weekStart: string;       // YYYY-MM-DD (Mon)
  weekEnd: string;         // YYYY-MM-DD (Sun)
  count: number;
  wins: number;
  losses: number;
  winRate: number | null;  // 0–100, null if count === 0
  netR: number;
  netDollar: number;
  bestSetup: { name: string; netR: number } | null;
  worstSetup: { name: string; netR: number } | null;
  bestDay: { label: string; date: string; netDollar: number } | null;
  worstDay: { label: string; date: string; netDollar: number } | null;
  ruleAdherencePct: number | null;  // null if no trades tagged
  taggedCount: number;     // trades with ruleAdherence !== null
}

/**
 * Compute a weekly recap for the Mon–Sun week containing `weekStart`.
 * `weekStart` should be a Monday at 00:00 local; if not, it's normalised.
 */
export function computeWeeklyRecap(
  trades: Pick<Trade, "date" | "pnl" | "pnlDollar" | "outcome" | "setup" | "ruleAdherence">[],
  weekStart: Date,
): WeeklyRecap {
  const start = isoWeekStart(weekStart);
  const end = new Date(start);
  end.setDate(start.getDate() + 6);

  const fmt = (d: Date) => {
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, "0");
    const day = String(d.getDate()).padStart(2, "0");
    return `${y}-${m}-${day}`;
  };

  const startStr = fmt(start);
  const endStr = fmt(end);

  const inWeek = trades.filter(t => t.date && t.date >= startStr && t.date <= endStr);

  const wins = inWeek.filter(t => t.outcome === "Win").length;
  const losses = inWeek.filter(t => t.outcome === "Loss").length;
  const winRate = wins + losses > 0 ? parseFloat(((wins / (wins + losses)) * 100).toFixed(1)) : null;

  const netR = inWeek.reduce((s, t) => s + (parseFloat(t.pnl as string) || 0), 0);
  const netDollar = inWeek.reduce((s, t) => s + (parseFloat(t.pnlDollar as string) || 0), 0);

  // Setup grouping — skip empty setups
  const bySetup: Record<string, number> = {};
  for (const t of inWeek) {
    const s = (t.setup ?? "").trim();
    if (!s) continue;
    bySetup[s] = (bySetup[s] ?? 0) + (parseFloat(t.pnl as string) || 0);
  }
  const setupEntries = Object.entries(bySetup).sort((a, b) => b[1] - a[1]);
  const bestSetup = setupEntries.length ? { name: setupEntries[0][0], netR: setupEntries[0][1] } : null;
  const worstSetup =
    setupEntries.length > 1 && setupEntries[setupEntries.length - 1][1] < setupEntries[0][1]
      ? { name: setupEntries[setupEntries.length - 1][0], netR: setupEntries[setupEntries.length - 1][1] }
      : null;

  // Day-of-week grouping
  const byDay: Record<string, number> = {};
  for (const t of inWeek) {
    if (!t.date) continue;
    byDay[t.date] = (byDay[t.date] ?? 0) + (parseFloat(t.pnlDollar as string) || 0);
  }
  const dayEntries = Object.entries(byDay).sort((a, b) => b[1] - a[1]);
  const dayToObj = (e: [string, number]) => {
    const d = new Date(e[0] + "T12:00:00");
    return { label: DOW_LABELS[d.getDay()], date: e[0], netDollar: e[1] };
  };
  const bestDay = dayEntries.length ? dayToObj(dayEntries[0]) : null;
  const worstDay =
    dayEntries.length > 1 && dayEntries[dayEntries.length - 1][1] < dayEntries[0][1]
      ? dayToObj(dayEntries[dayEntries.length - 1])
      : null;

  // Rule adherence
  const tagged = inWeek.filter(t => t.ruleAdherence === true || t.ruleAdherence === false);
  const followed = tagged.filter(t => t.ruleAdherence === true).length;
  const ruleAdherencePct = tagged.length ? Math.round((followed / tagged.length) * 100) : null;

  return {
    weekStart: startStr,
    weekEnd: endStr,
    count: inWeek.length,
    wins,
    losses,
    winRate,
    netR,
    netDollar,
    bestSetup,
    worstSetup,
    bestDay,
    worstDay,
    ruleAdherencePct,
    taggedCount: tagged.length,
  };
}

// ── Discipline score ──────────────────────────────────────────────────────────

export interface DisciplineScore {
  score: number;
  grade: string;
  breakdown: {
    rules:      { earned: number; max: number };
    tradeLimit: { earned: number; max: number } | null;
    lossLimit:  { earned: number; max: number } | null;
    awareness:  { earned: number; max: number };
  };
  dragSignal: "rules" | "tradeLimit" | "lossLimit" | "awareness" | null;
  window: { start: string; end: string };
  taggedCount: number;
}

export interface DisciplineLogEntry {
  date:  string;
  score: number;
  grade: string;
}

export function calcDisciplineScore(
  trades: Pick<Trade, "date" | "pnl" | "pnlDollar" | "ruleAdherence" | "mistake">[],
  profile: Pick<Profile, "maxTradesPerDay" | "maxDailyLoss">,
  windowStart?: Date,
): DisciplineScore | null {
  const end = new Date();
  end.setHours(23, 59, 59, 999);
  const start = windowStart ? new Date(windowStart) : new Date(end);
  if (!windowStart) start.setDate(end.getDate() - 6);
  start.setHours(0, 0, 0, 0);

  const fmt = (d: Date) =>
    `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;

  const startStr = fmt(start);
  const endStr   = fmt(end);

  const windowTrades = trades.filter(t => t.date && t.date >= startStr && t.date <= endStr);
  const tagged = windowTrades.filter(t => t.ruleAdherence !== null && t.ruleAdherence !== undefined);

  if (tagged.length < 3) return null;

  // ── Rule Adherence (max 40) ──
  const RULES_MAX = 40;
  const rulesEarned = (tagged.filter(t => t.ruleAdherence === true).length / tagged.length) * RULES_MAX;

  // ── Trading days (days with ≥1 trade) ──
  const tradingDays = [...new Set(windowTrades.map(t => t.date).filter(Boolean))] as string[];

  // ── Trade Limit (max 25) ──
  const TRADE_MAX = 25;
  const maxTrades = parseFloat(profile.maxTradesPerDay ?? "");
  const tradeLimitOn = !isNaN(maxTrades) && maxTrades > 0;
  let tradeLimitEarned = 0;

  if (tradeLimitOn) {
    const countByDay: Record<string, number> = {};
    windowTrades.forEach(t => { if (t.date) countByDay[t.date] = (countByDay[t.date] ?? 0) + 1; });
    const within = tradingDays.filter(d => (countByDay[d] ?? 0) <= maxTrades).length;
    tradeLimitEarned = tradingDays.length > 0 ? (within / tradingDays.length) * TRADE_MAX : TRADE_MAX;
  }

  // ── Loss Limit (max 25) ──
  const LOSS_MAX = 25;
  const maxLoss = parseFloat(profile.maxDailyLoss ?? "");
  const lossLimitOn = !isNaN(maxLoss) && maxLoss > 0;
  let lossLimitEarned = 0;

  if (lossLimitOn) {
    const pnlByDay: Record<string, number> = {};
    windowTrades.forEach(t => {
      if (t.date) pnlByDay[t.date] = (pnlByDay[t.date] ?? 0) + (parseFloat(t.pnlDollar as string) || 0);
    });
    const respected = tradingDays.filter(d => (pnlByDay[d] ?? 0) >= -maxLoss).length;
    lossLimitEarned = tradingDays.length > 0 ? (respected / tradingDays.length) * LOSS_MAX : LOSS_MAX;
  }

  // ── Mistake Awareness (max 10) ──
  const AWARE_MAX = 10;
  const broke = tagged.filter(t => t.ruleAdherence === false);
  const awarenessEarned = broke.length === 0
    ? AWARE_MAX
    : (broke.filter(t => t.mistake && t.mistake !== "None").length / broke.length) * AWARE_MAX;

  // ── Weight redistribution ──
  const totalMax = RULES_MAX + (tradeLimitOn ? TRADE_MAX : 0) + (lossLimitOn ? LOSS_MAX : 0) + AWARE_MAX;
  const scale = 100 / totalMax;

  const score = Math.min(100, Math.round(
    rulesEarned * scale +
    (tradeLimitOn ? tradeLimitEarned : 0) * scale +
    (lossLimitOn  ? lossLimitEarned  : 0) * scale +
    awarenessEarned * scale
  ));

  // ── Grade ──
  const grade =
    score >= 95 ? "A+" :
    score >= 85 ? "A"  :
    score >= 70 ? "B"  :
    score >= 55 ? "C"  :
    score >= 40 ? "D"  : "F";

  // ── Drag signal ──
  const candidates: Array<{ key: NonNullable<DisciplineScore["dragSignal"]>; pct: number }> = [
    { key: "rules",    pct: rulesEarned    / RULES_MAX },
    { key: "awareness", pct: awarenessEarned / AWARE_MAX },
  ];
  if (tradeLimitOn) candidates.push({ key: "tradeLimit", pct: tradeLimitEarned / TRADE_MAX });
  if (lossLimitOn)  candidates.push({ key: "lossLimit",  pct: lossLimitEarned  / LOSS_MAX  });
  candidates.sort((a, b) => a.pct - b.pct);
  const dragSignal = candidates[0].pct < 0.72 ? candidates[0].key : null;

  return {
    score,
    grade,
    breakdown: {
      rules:      { earned: parseFloat(rulesEarned.toFixed(2)),      max: RULES_MAX },
      tradeLimit: tradeLimitOn ? { earned: parseFloat(tradeLimitEarned.toFixed(2)), max: TRADE_MAX } : null,
      lossLimit:  lossLimitOn  ? { earned: parseFloat(lossLimitEarned.toFixed(2)),  max: LOSS_MAX  } : null,
      awareness:  { earned: parseFloat(awarenessEarned.toFixed(2)),  max: AWARE_MAX },
    },
    dragSignal,
    window: { start: startStr, end: endStr },
    taggedCount: tagged.length,
  };
}
