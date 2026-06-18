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

// Params accept partials (the in-progress log `form` is Partial<Trade>); the
// nullish fallbacks below already handle missing fields at runtime.
type ShotFields = Partial<Pick<Trade, "preTradeScreenshot" | "postTradeScreenshot" | "screenshot">>;

export function preShot(t: ShotFields): string {
  return t.preTradeScreenshot ?? "";
}

export function postShot(t: ShotFields): string {
  return t.postTradeScreenshot ?? t.screenshot ?? "";
}

export function hasAnyShot(t: ShotFields): boolean {
  return Boolean(preShot(t) || postShot(t));
}

export function shotArray(t: ShotFields): string[] {
  return [preShot(t), postShot(t)].filter((s): s is string => s.length > 0);
}
