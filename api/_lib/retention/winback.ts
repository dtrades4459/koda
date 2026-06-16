// api/_lib/retention/winback.ts
export interface WinbackProfile {
  last_active_at: string | null;
  winback_opt_in: boolean;
  last_winback_at: string | null;
}

const DAY = 24 * 3600 * 1000;
const INACTIVE_MIN_DAYS = 7;
const INACTIVE_MAX_DAYS = 14;
const COOLDOWN_DAYS = 30;

export function isWinbackCandidate(p: WinbackProfile, now: number = Date.now()): boolean {
  if (!p.winback_opt_in) return false;
  if (!p.last_active_at) return false;

  const idleDays = (now - Date.parse(p.last_active_at)) / DAY;
  if (idleDays < INACTIVE_MIN_DAYS || idleDays > INACTIVE_MAX_DAYS) return false;

  if (p.last_winback_at) {
    const sinceWinback = (now - Date.parse(p.last_winback_at)) / DAY;
    if (sinceWinback < COOLDOWN_DAYS) return false;
  }
  return true;
}
