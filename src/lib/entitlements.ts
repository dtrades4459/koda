// ═══════════════════════════════════════════════════════════════════════════════
// Kōda · entitlements — who gets Pro, and when the paywall turns on.
//
// Launch model (decided 2026-06-17):
//   • The paywall auto-activates at PAYWALL_GO_LIVE. Before then, beta is open —
//     everyone has full access.
//   • Anyone whose account was created BEFORE PAYWALL_GO_LIVE is grandfathered:
//     free Pro forever, no expiry. (No DB writes — it's a pure function of the
//     account's created_at.)
//   • After go-live, NEW users are free-tier and hit the paywall until they pay
//     (profile.plan flips to "pro"/"elite" via the Stripe webhook).
//   • The "paywall" feature flag is a manual override to force the gate on early
//     (e.g. for testing on your own device).
// ═══════════════════════════════════════════════════════════════════════════════

import { isFlagOn } from "./flags";

// Midnight, 30 June 2026, Europe/London (BST = UTC+1). Revenue starts on the 30th;
// anyone who joined before this instant keeps Pro free.
export const PAYWALL_GO_LIVE = Date.parse("2026-06-30T00:00:00+01:00");

/** Is the paywall live? Off during beta, on from go-live — or forced on via the flag. */
export function paywallActive(now: number = Date.now()): boolean {
  if (isFlagOn("paywall")) return true; // manual override for testing
  return now >= PAYWALL_GO_LIVE;
}

/** Accounts created before go-live keep Pro free forever. */
export function isGrandfathered(createdAt?: string | null): boolean {
  if (!createdAt) return false;
  const t = Date.parse(createdAt);
  if (!Number.isFinite(t)) return false;
  return t < PAYWALL_GO_LIVE;
}

export interface ProInputs {
  /** profile.plan / JWT app_metadata plan claim. */
  plan?: string | null;
  /** Supabase auth user.created_at (ISO string). */
  createdAt?: string | null;
  /** Founder/staff override, computed by the caller (e.g. by email). */
  isFounder?: boolean;
  now?: number;
}

/** Single source of truth for "does this user have Pro access right now?" */
export function computeIsPro(opts: ProInputs): boolean {
  const now = opts.now ?? Date.now();
  if (opts.isFounder) return true; // founders/staff
  if (opts.plan === "pro" || opts.plan === "elite") return true; // paying or DB-granted
  if (isGrandfathered(opts.createdAt)) return true; // joined before launch → free forever
  if (!paywallActive(now)) return true; // pre-launch beta → everyone has access
  return false; // post-launch free user → show the paywall
}
