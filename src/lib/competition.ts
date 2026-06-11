export const COMP_CIRCLE_CODE = "50K-EVAL-2026";

// UIDs of competition staff — shown as referees on the leaderboard, stats not counted.
export const COMP_STAFF_UIDS = new Set([
  "f38aae7d-e953-4a00-a5aa-5370677ca876", // Dylon
  "83583169-6fc4-486a-a371-ae41c3c5f645", // Bruno
  "0f507c1d-770b-4884-b3c2-848701ab2c6d", // Dan
]);
export const COMP_END_TS = new Date("2026-07-15T23:59:59Z").getTime();
export const COMP_START_TS = new Date("2026-06-15T00:00:00Z").getTime();
export const COMP_JOINED_KEY = "koda_comp_2026_joined";

export function isCompetitionActive(): boolean {
  return Date.now() < COMP_END_TS;
}

export function isCompetitionStarted(): boolean {
  return Date.now() >= COMP_START_TS;
}

export function isCompetitionJoined(): boolean {
  try { return localStorage.getItem(COMP_JOINED_KEY) === "1"; } catch { return false; }
}

export function markCompetitionJoined(): void {
  try { localStorage.setItem(COMP_JOINED_KEY, "1"); } catch {}
}

export function compDaysRemaining(): number {
  return Math.max(0, Math.ceil((COMP_END_TS - Date.now()) / 86400000));
}

export function compDaysUntilStart(): number {
  return Math.max(0, Math.ceil((COMP_START_TS - Date.now()) / 86400000));
}

export function compStatusText(memberCount: number): string {
  if (!isCompetitionStarted()) {
    const d = compDaysUntilStart();
    return `Starts in ${d} day${d === 1 ? "" : "s"}`;
  }
  if (isCompetitionActive()) {
    const d = compDaysRemaining();
    return `${d} day${d === 1 ? "" : "s"} remaining · ${memberCount} trader${memberCount === 1 ? "" : "s"}`;
  }
  return "Competition closed · winner announced below";
}

export function shouldShowCompetitionCard(myCircleCodes: string[]): boolean {
  return isCompetitionActive() && !myCircleCodes.includes(COMP_CIRCLE_CODE);
}

// ── Eligibility (published rules: min 10 trades, screenshot on every window trade) ──

export const COMP_MIN_TRADES = 10;

/** True when a trade's date (YYYY-MM-DD form value) falls inside the comp window. */
export function isInCompWindow(dateStr: string): boolean {
  const t = Date.parse(dateStr);
  if (Number.isNaN(t)) return false;
  return t >= COMP_START_TS && t <= COMP_END_TS;
}

export interface CompEligibility {
  /** Trades dated inside the competition window. */
  trades: number;
  /** Window trades with no screenshot attached. */
  missingShots: number;
  eligible: boolean;
}

export function compEligibility(
  trades: Array<{ date: string; screenshot: string }>
): CompEligibility {
  const wt = trades.filter(t => isInCompWindow(t.date));
  const missingShots = wt.filter(t => !t.screenshot).length;
  return {
    trades: wt.length,
    missingShots,
    eligible: wt.length >= COMP_MIN_TRADES && missingShots === 0,
  };
}
