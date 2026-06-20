// src/data/shareTally.ts — pure, dependency-free (keep it that way for tests).
export type ShareOutcome = "ok" | "duplicate" | "blocked" | "error";
export interface ShareTally { ok: number; duplicate: number; blocked: number; error: number; }

export function tallyShareResults(results: ShareOutcome[]): ShareTally {
  const t: ShareTally = { ok: 0, duplicate: 0, blocked: 0, error: 0 };
  for (const r of results) t[r] += 1;
  return t;
}
