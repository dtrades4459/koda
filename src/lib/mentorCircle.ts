// ─────────────────────────────────────────────────────────────────────────────
// Kōda · Mentor Mode — circle-type marker.
// A mentor cohort is an ordinary Circle whose KV meta carries type:"mentor".
// ─────────────────────────────────────────────────────────────────────────────

export const MENTOR_CIRCLE_TYPE = "mentor" as const;

export function isMentorCircle(circle: { type?: string | null }): boolean {
  return circle?.type === MENTOR_CIRCLE_TYPE;
}
