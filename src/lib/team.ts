// Kōda · internal team
//
// The founders get Pro-tier capabilities (unlimited circles, etc.) regardless
// of their billing plan. UIDs are stable auth ids — they never change, unlike
// handles. These are the same three accounts listed as competition staff in
// competition.ts (kept separate because "founder" is a billing concept, not a
// comp-referee one).

export const FOUNDER_UIDS = new Set([
  "f38aae7d-e953-4a00-a5aa-5370677ca876", // Dylon
  "83583169-6fc4-486a-a371-ae41c3c5f645", // Bruno
  "0f507c1d-770b-4884-b3c2-848701ab2c6d", // Dan
]);

export function isFounder(uid: string | undefined): boolean {
  return !!uid && FOUNDER_UIDS.has(uid);
}
