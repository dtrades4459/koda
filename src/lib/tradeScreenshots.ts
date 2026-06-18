// ═══════════════════════════════════════════════════════════════════════════════
// Kōda · trade screenshot slots (pure)
//
// Single source of truth for the two screenshot slots and the legacy fallback.
// A trade once had a single `screenshot`; that value is now read as the
// Post-trade shot (most legacy shots are results). Nothing writes `screenshot`
// again. See docs/superpowers/specs/2026-06-18-pre-post-trade-screenshots-design.md
// ═══════════════════════════════════════════════════════════════════════════════

import type { Trade } from "../types";

export type ShotSlot = "pre" | "post";

export function screenshotField(slot: ShotSlot): "preTradeScreenshot" | "postTradeScreenshot" {
  return slot === "pre" ? "preTradeScreenshot" : "postTradeScreenshot";
}

export function preShot(t: Pick<Trade, "preTradeScreenshot">): string {
  return t.preTradeScreenshot ?? "";
}

export function postShot(t: Pick<Trade, "postTradeScreenshot" | "screenshot">): string {
  return t.postTradeScreenshot ?? t.screenshot ?? "";
}

export function hasAnyShot(
  t: Pick<Trade, "preTradeScreenshot" | "postTradeScreenshot" | "screenshot">,
): boolean {
  return Boolean(preShot(t) || postShot(t));
}

export function shotArray(
  t: Pick<Trade, "preTradeScreenshot" | "postTradeScreenshot" | "screenshot">,
): string[] {
  return [preShot(t), postShot(t)].filter((s): s is string => s.length > 0);
}
