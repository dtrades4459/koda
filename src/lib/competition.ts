export const COMP_CIRCLE_CODE = "50K-EVAL-2026";
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
