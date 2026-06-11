import { MONO } from "../shared";
import type { Theme } from "../theme";
import { isCompetitionJoined, isInCompWindow } from "../lib/competition";

export interface CompShotWarningProps {
  C: Theme;
  /** Trade date from the log form (YYYY-MM-DD, may be empty). */
  date: string;
  hasScreenshot: boolean;
}

/** Soft warning only — never blocks saving (decided 2026-06-11). */
export function CompShotWarning({ C, date, hasScreenshot }: CompShotWarningProps) {
  if (hasScreenshot || !date || !isCompetitionJoined() || !isInCompWindow(date)) return null;
  return (
    <div style={{
      fontFamily: MONO, fontSize: 10, color: C.live,
      letterSpacing: "0.1em", textTransform: "uppercase" as const,
      lineHeight: 1.6, marginTop: 10,
    }}>
      ⚡ Competition trade — a screenshot is required. Entries missing one are disqualified.
    </div>
  );
}
