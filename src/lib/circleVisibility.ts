// ═══════════════════════════════════════════════════════════════════════════════
// Kōda · per-circle metric visibility ("Hide P&L")
//
// Preferences live in user_kv (private, RLS self-only — zero migration):
//   koda_viz_default        account-wide defaults
//   koda_viz_<CIRCLE_CODE>  per-circle override, merged over the default
//
// Enforcement happens at PUBLISH time (buildLeaderboardEntry): hidden metrics
// are never written to the shared row, so there is no read path — client,
// API, or future bug — that can leak them. See the 2026-06-12 circles spec §1.
//
// Defaults are ALL-VISIBLE so existing leaderboards don't go blank on deploy;
// the feature is the toggle, not a new default.
// ═══════════════════════════════════════════════════════════════════════════════

import { storage } from "./storage";
import { COMP_CIRCLE_CODE } from "./competition";

export interface CircleVisibility {
  /** Absolute cash amounts: totalPnLDollar, weekPnL, pnlPercent.
   *  R-multiples stay visible — they reveal shape, not account size. */
  pnl: boolean;
  winRate: boolean;
  /** disciplineScore + grade + ruleCompliancePct + taggedCount */
  discipline: boolean;
  avgRR: boolean;
  /** Gates sharing trades into the circle feed (circle_shared_trades). */
  tradeLogs: boolean;
}

/** Metrics a circle can force-share (consented at join). tradeLogs is always
 *  the member's choice — sharing a trade is an explicit per-trade action. */
export type RequiredMetric = "pnl" | "winRate" | "discipline" | "avgRR";

export const VIZ_ALL_VISIBLE: CircleVisibility = {
  pnl: true,
  winRate: true,
  discipline: true,
  avgRR: true,
  tradeLogs: true,
};

export const vizKeys = {
  default: () => "koda_viz_default",
  circle: (code: string) => `koda_viz_${code}`,
};

function parseViz(raw: string | null | undefined): Partial<CircleVisibility> {
  if (!raw) return {};
  try {
    const v = JSON.parse(raw);
    return v && typeof v === "object" ? (v as Partial<CircleVisibility>) : {};
  } catch {
    return {};
  }
}

/** Pure merge: all-visible ← account default ← per-circle override. */
export function mergeVisibility(
  defaultRaw: string | null | undefined,
  circleRaw: string | null | undefined,
): CircleVisibility {
  return { ...VIZ_ALL_VISIBLE, ...parseViz(defaultRaw), ...parseViz(circleRaw) };
}

/**
 * Which metrics this circle requires its members to share.
 * The 50K-EVAL-2026 competition is hardcoded — competitors must not be able
 * to blank the board mid-competition. Other circles can declare
 * requiredMetrics on their meta (creator UI lands in Phase D).
 */
export function requiredMetricsFor(
  circleCode: string,
  metaRequired?: RequiredMetric[] | null,
): RequiredMetric[] {
  const required = new Set<RequiredMetric>(metaRequired ?? []);
  if (circleCode === COMP_CIRCLE_CODE) {
    required.add("pnl");
    required.add("winRate");
    required.add("discipline");
  }
  return [...required];
}

/** Pure: force required metrics visible regardless of the user's toggles. */
export function applyRequiredMetrics(
  viz: CircleVisibility,
  circleCode: string,
  metaRequired?: RequiredMetric[] | null,
): CircleVisibility {
  const required = requiredMetricsFor(circleCode, metaRequired);
  if (required.length === 0) return viz;
  const out = { ...viz };
  for (const m of required) out[m] = true;
  return out;
}

/**
 * The user's effective toggles for one circle (BEFORE required-metric
 * overrides — callers that publish must wrap with applyRequiredMetrics).
 * Never throws; unreadable prefs fall back to all-visible, matching the
 * pre-feature behavior.
 */
export async function readVisibility(circleCode: string): Promise<CircleVisibility> {
  try {
    // Concurrent gets coalesce into one user_kv query via the storage shim's
    // in-flight batcher, so the publish fan-out doesn't multiply reads.
    const [def, per] = await Promise.all([
      storage.get(vizKeys.default()),
      storage.get(vizKeys.circle(circleCode)),
    ]);
    return mergeVisibility(def?.value, per?.value);
  } catch {
    return { ...VIZ_ALL_VISIBLE };
  }
}

export async function saveCircleVisibility(
  circleCode: string,
  viz: CircleVisibility,
): Promise<void> {
  await storage.set(vizKeys.circle(circleCode), JSON.stringify(viz));
}
