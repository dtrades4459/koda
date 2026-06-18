// src/lib/sessionPilot.ts
// ═══════════════════════════════════════════════════════════════════════════════
// Kōda · Trading Session pilot gate
//
// Solo-first rollout for the pre-trade intervention sprint. Phase 1: founder uid
// only (dogfood). Phase 2: flip SESSION_PILOT_ALL to true to open to all beta.
// No flag *system* — there is no useFlags in the repo.
// Spec: docs/superpowers/specs/2026-06-16-pre-trade-intervention-design.md
// ═══════════════════════════════════════════════════════════════════════════════

// TODO(dylon): paste the founder Supabase auth uid here before dogfooding.
export const SESSION_PILOT_UIDS: string[] = [];

// Phase 2 switch: flip to true to enable the session for every beta user.
export const SESSION_PILOT_ALL = false;

export function isSessionPilot(uid: string | undefined): boolean {
  if (SESSION_PILOT_ALL) return true;
  if (!uid) return false;
  return SESSION_PILOT_UIDS.includes(uid);
}
