// src/lib/tilt.ts
// ═══════════════════════════════════════════════════════════════════════════════
// Kōda · tilt evaluator
//
// Pure function (no React, no DB). Given today's trades + profile + a clock,
// returns which tilt signals are active and whether the intervention should fire.
//
// Signal definitions and firing rule live in:
//   docs/superpowers/specs/2026-06-02-in-session-intervention-design.md §4
// ═══════════════════════════════════════════════════════════════════════════════

import type { Trade, Profile } from "../types";

export type TiltSignalId =
  | "consec_losses"
  | "daily_loss_75" | "daily_loss_90"
  | "trade_cap_at"
  | "revenge_window"
  | "tilt_emotion";

export interface TiltSignal {
  id: TiltSignalId;
  label: string;
  critical: boolean;
}

export interface TiltState {
  active: boolean;
  critical: boolean;
  signals: TiltSignal[];
  evaluatedAt: number;
}

function todayLocal(now: number): string {
  const d = new Date(now);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

function tradeSortKey(t: Trade): string {
  return t.entryTime ?? t.exitTime ?? "";
}

export function evaluateTilt(
  trades: Trade[],
  _profile: Pick<Profile, "maxDailyLoss" | "maxTradesPerDay">,
  now: number,
): TiltState {
  const today = todayLocal(now);
  const todays = trades
    .filter(t => t.date === today)
    .sort((a, b) => tradeSortKey(a).localeCompare(tradeSortKey(b)));

  const signals: TiltSignal[] = [];

  // ── consec_losses ────────────────────────────────────────────────────────
  let run = 0;
  for (let i = todays.length - 1; i >= 0; i--) {
    if (todays[i].outcome === "Loss") run++;
    else break;
  }
  if (run >= 2) {
    signals.push({
      id: "consec_losses",
      label: `${run} consecutive losses`,
      critical: false,
    });
  }

  // ── daily_loss_75 / daily_loss_90 ────────────────────────────────────────
  const maxLoss = parseFloat(_profile.maxDailyLoss ?? "");
  if (isFinite(maxLoss) && maxLoss > 0) {
    const netPnl = todays.reduce((sum, t) => sum + (parseFloat(t.pnlDollar) || 0), 0);
    if (netPnl < 0) {
      const pctOfLimit = Math.abs(netPnl) / maxLoss;
      if (pctOfLimit >= 0.9) {
        signals.push({
          id: "daily_loss_90",
          label: `-${Math.round(pctOfLimit * 100)}% of daily loss limit`,
          critical: true,
        });
      } else if (pctOfLimit >= 0.75) {
        signals.push({
          id: "daily_loss_75",
          label: `-${Math.round(pctOfLimit * 100)}% of daily loss limit`,
          critical: false,
        });
      }
    }
  }

  // ── trade_cap_at ─────────────────────────────────────────────────────────
  const maxTrades = parseFloat(_profile.maxTradesPerDay ?? "");
  if (isFinite(maxTrades) && maxTrades > 0 && todays.length >= maxTrades) {
    signals.push({
      id: "trade_cap_at",
      label: "Daily trade cap reached",
      critical: true,
    });
  }

  // ── revenge_window ───────────────────────────────────────────────────────────
  const last = todays[todays.length - 1];
  if (last && last.outcome === "Loss") {
    const lastTs = Date.parse(last.exitTime ?? last.entryTime ?? "");
    if (isFinite(lastTs) && now - lastTs <= 10 * 60 * 1000) {
      signals.push({
        id: "revenge_window",
        label: "Within 10 min of a loss",
        critical: false,
      });
    }
  }

  return { active: false, critical: false, signals, evaluatedAt: now };
}
