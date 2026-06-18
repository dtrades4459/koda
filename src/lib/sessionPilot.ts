// src/lib/sessionPilot.ts
// ═══════════════════════════════════════════════════════════════════════════════
// Kōda · Trading Session pilot gate
//
// Solo-first rollout for the pre-trade intervention sprint. Phase 1: founder uid
// only (dogfood). Phase 2: flip SESSION_PILOT_ALL to true to open to all beta.
// No flag *system* — there is no useFlags in the repo.
// Spec: docs/superpowers/specs/2026-06-16-pre-trade-intervention-design.md
// ═══════════════════════════════════════════════════════════════════════════════

// Pilot cohort (Supabase auth uids). Phase 1 dogfood — add/remove names here.
export const SESSION_PILOT_UIDS: string[] = [
  "f38aae7d-e953-4a00-a5aa-5370677ca876", // Dylon Nyla
  "83583169-6fc4-486a-a371-ae41c3c5f645", // Bruno Lope
  "0f507c1d-770b-4884-b3c2-848701ab2c6d", // xDnii
];

// Phase 2 switch: flip to true to enable the session for every beta user.
export const SESSION_PILOT_ALL = false;

export function isSessionPilot(uid: string | undefined): boolean {
  if (SESSION_PILOT_ALL) return true;
  if (!uid) return false;
  return SESSION_PILOT_UIDS.includes(uid);
}
