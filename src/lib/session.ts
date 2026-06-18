// src/lib/session.ts
// ═══════════════════════════════════════════════════════════════════════════════
// Kōda · trading session core
//
// Pure (no React, no storage, no DB). An ephemeral, explicitly-armed container
// for "I'm trading right now": holds a live W/L tally and adapts it into
// Trade-shaped objects so the existing evaluateTilt engine can run unchanged.
//
// Spec: docs/superpowers/specs/2026-06-16-pre-trade-intervention-design.md
// ═══════════════════════════════════════════════════════════════════════════════

import type { Trade } from "../types";

export const ACTIVE_SESSION_KEY = "koda_active_session";

export interface SessionTap {
  outcome: "Win" | "Loss";
  pnlDollar: number | null;   // optional; unlocks daily-loss signals when present
  at: string;                 // ISO timestamp — drives ordering + revenge_window
}

export interface ActiveSession {
  startedAt: string;               // ISO
  maxDailyLoss: number | null;     // captured from PreSessionSheet at arm
  maxTradesPerDay: number | null;
  taps: SessionTap[];
}

function localDay(ms: number): string {
  const d = new Date(ms);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

export function startSession(args: {
  startedAt: string;
  maxDailyLoss: number | null;
  maxTradesPerDay: number | null;
}): ActiveSession {
  return {
    startedAt: args.startedAt,
    maxDailyLoss: args.maxDailyLoss,
    maxTradesPerDay: args.maxTradesPerDay,
    taps: [],
  };
}

export function addTap(session: ActiveSession, tap: SessionTap): ActiveSession {
  return { ...session, taps: [...session.taps, tap] };
}

export function isStale(session: ActiveSession, now: number): boolean {
  return localDay(Date.parse(session.startedAt)) !== localDay(now);
}

export function tapsToTrades(taps: SessionTap[], todayLocal: string): Trade[] {
  return [...taps]
    .sort((a, b) => a.at.localeCompare(b.at))
    .map((tap, i) => ({
      id: i + 1,
      date: todayLocal,
      pair: "", session: "", bias: "", strategy: "", setup: "",
      entryPrice: "", slPrice: "", tpPrice: "", rr: "",
      outcome: tap.outcome,
      pnl: "",
      notes: "",
      emotions: "",
      screenshot: "",
      pnlDollar: String(tap.pnlDollar ?? 0),
      entryTime: tap.at,
      exitTime: tap.at,
      comments: [],
      reactions: {},
    }));
}

export interface SessionTally {
  wins: number;
  losses: number;
  netDollar: number;
  hasDollar: boolean;
  streak: number;
  streakKind: "Win" | "Loss" | null;
}

export function tally(session: ActiveSession): SessionTally {
  const taps = session.taps;
  const wins = taps.filter(t => t.outcome === "Win").length;
  const losses = taps.filter(t => t.outcome === "Loss").length;
  const hasDollar = taps.some(t => t.pnlDollar !== null);
  const netDollar = taps.reduce((sum, t) => sum + (t.pnlDollar ?? 0), 0);

  let streak = 0;
  let streakKind: "Win" | "Loss" | null = null;
  for (let i = taps.length - 1; i >= 0; i--) {
    if (streakKind === null) { streakKind = taps[i].outcome; streak = 1; }
    else if (taps[i].outcome === streakKind) { streak++; }
    else break;
  }

  return { wins, losses, netDollar, hasDollar, streak, streakKind };
}
