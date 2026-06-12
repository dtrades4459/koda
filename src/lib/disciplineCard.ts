// ═══════════════════════════════════════════════════════════════════════════════
// Kōda · Discipline share card — payload builder
//
// Pure module: turns the user's OWN leaderboard entry into a render-ready
// payload for the canvas renderer (renderDisciplineCard.ts) plus the share
// link/text for the growth loop.
//
// PRIVACY INVARIANT: the payload must NEVER contain cash P&L (dollar amounts,
// account size, pnlPercent). The card is discipline-first by design, and the
// per-circle visibility toggles don't exist yet (Phase B of the 2026-06-12
// circles spec) — so cash simply has no field here. Enforced by test.
//
// REF POLICY (spec Addendum §A): the circle code IS the join code, so a card
// from a PRIVATE circle must not embed it — that would publish the invite key
// of a gated community. Private circles attribute to the sharer instead
// (u_<memberCode>); public circles use their code (discoverable by design).
// ═══════════════════════════════════════════════════════════════════════════════

const APP_URL = "https://kodatrade.co.uk";

const GRADE_LABEL: Record<string, string> = {
  "A+": "Elite",
  A: "Excellent",
  B: "Solid",
  C: "Developing",
  D: "At Risk",
  F: "Off the Rails",
};

/** The subset of a leaderboard entry the card needs. No cash fields on purpose. */
export interface DisciplineCardEntry {
  disciplineScore?: number | null;
  disciplineGrade?: string | null;
  winRate?: number | null;
  total?: number | null;
  streak?: { type: string; count: number } | null;
  topStrategy?: string | null;
}

export interface DisciplineCardInput {
  profile: { name?: string; handle?: string; avatar?: string };
  entry: DisciplineCardEntry;
  circle: { code: string; name: string; privacy: "public" | "private"; emoji?: string };
  memberCode: string;
  /** Leaderboard rank (1-based) — shown on the card when present (comp variant). */
  rank?: number | null;
}

export interface DisciplineCardPayload {
  username: string;
  /** Stored WITH the leading @ — render as-is, never prepend another. */
  handle: string;
  avatar: string;
  circleName: string;
  circleEmoji: string;
  rank: number | null;
  discipline: {
    score: number;
    outOf: 100;
    grade: string;
    label: string;
    /** e.g. "92/100 — Excellent" */
    display: string;
  };
  /** Up to 3 process-first highlight lines ("top followed rules"). */
  highlights: string[];
  /** Percentage, not cash. */
  winRate: number | null;
  ref: string;
  shareUrl: string;
  shareText: string;
}

/** Public circles share their code (it's the discovery mechanism); private
 *  circles attribute to the sharer so the invite key never goes public. */
export function refForCircle(
  circle: { code: string; privacy: "public" | "private" },
  memberCode: string,
): string {
  return circle.privacy === "private" ? `u_${memberCode}` : circle.code;
}

/**
 * Build the card payload, or null when the user has no discipline score yet
 * (<3 tagged trades in the window — calcDisciplineScore's rule).
 */
export function buildDisciplineCard(input: DisciplineCardInput): DisciplineCardPayload | null {
  const { profile, entry, circle, memberCode } = input;

  const score = entry.disciplineScore;
  const grade = entry.disciplineGrade;
  if (score == null || grade == null) return null;

  const label = GRADE_LABEL[grade] ?? grade;

  const highlights: string[] = [];
  if (entry.streak && entry.streak.type === "win" && entry.streak.count >= 2) {
    highlights.push(`${entry.streak.count}-trade win streak`);
  }
  if (entry.topStrategy) highlights.push(`Top setup · ${entry.topStrategy}`);
  if (typeof entry.total === "number" && entry.total > 0) {
    highlights.push(`${entry.total} trade${entry.total === 1 ? "" : "s"} journaled`);
  }

  const ref = refForCircle(circle, memberCode);
  const shareUrl = `${APP_URL}/join?ref=${encodeURIComponent(ref)}&utm_source=share_card`;

  return {
    username: profile.name?.trim() || "Trader",
    handle: profile.handle ?? "",
    avatar: profile.avatar ?? "",
    circleName: circle.name,
    circleEmoji: circle.emoji || "◆",
    rank: input.rank ?? null,
    discipline: {
      score,
      outOf: 100,
      grade,
      label,
      display: `${score}/100 — ${label}`,
    },
    highlights: highlights.slice(0, 3),
    winRate: typeof entry.winRate === "number" ? Math.round(Number(entry.winRate)) : null,
    ref,
    shareUrl,
    shareText: `Discipline ${score}/100 — ${label} on Kōda this week. Process over P&L. ${shareUrl}`,
  };
}
