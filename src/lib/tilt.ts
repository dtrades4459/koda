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

export function evaluateTilt(
  _trades: Trade[],
  _profile: Pick<Profile, "maxDailyLoss" | "maxTradesPerDay">,
  now: number,
): TiltState {
  return { active: false, critical: false, signals: [], evaluatedAt: now };
}
