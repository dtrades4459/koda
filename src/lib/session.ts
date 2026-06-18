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
