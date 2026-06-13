// ═══════════════════════════════════════════════════════════════════════════════
// Kōda · Instructor Dashboard — roster projection
//
// Pure re-projection of the leaderboard entries a circle already fetches, into
// the coach's process-first view: members ranked by DISCIPLINE, not profit.
// No $ field exists here by design — a coach circle is about rule-following.
//
// "withheld" vs "no data": an entry whose viz.discipline === false hid their
// score (visible non-compliance the coach can act on); an entry with a null
// score and no viz flag simply hasn't tagged 3+ trades yet.
// ═══════════════════════════════════════════════════════════════════════════════

export interface RosterEntryInput {
  memberCode: string;
  name: string;
  handle?: string;
  alias?: string;
  total?: number | null;
  disciplineScore?: number | null;
  disciplineGrade?: string | null;
  ruleCompliancePct?: number | null;
  taggedCount?: number | null;
  streak?: { type: string; count: number } | null;
  updatedAt?: string | null;
  viz?: { pnl: boolean; winRate: boolean; discipline: boolean; avgRR: boolean };
  staff?: boolean;
}

export interface RosterRow {
  memberCode: string;
  name: string;
  handle: string;
  /** null when withheld or not enough tagged trades. */
  disciplineScore: number | null;
  disciplineGrade: string | null;
  ruleCompliancePct: number | null;
  taggedCount: number | null;
  totalTrades: number | null;
  streak: { type: string; count: number } | null;
  updatedAt: string | null;
  /** Member actively hid their discipline score from this circle. */
  withheld: boolean;
  /** No discipline score AND didn't withhold — just hasn't tagged enough yet. */
  notPublishing: boolean;
}

export interface RosterSummary {
  memberCount: number;
  /** Members with a real published discipline score. */
  publishingCount: number;
  withheldCount: number;
  notPublishingCount: number;
  /** Median discipline across publishing members, or null if none. */
  medianDiscipline: number | null;
  /** Count of publishing members scoring >= 70 ("on track"). */
  aboveThresholdCount: number;
  threshold: 70;
}

export interface Roster {
  rows: RosterRow[];
  summary: RosterSummary;
}

function median(values: number[]): number | null {
  if (values.length === 0) return null;
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 === 0
    ? Math.round((sorted[mid - 1] + sorted[mid]) / 2)
    : sorted[mid];
}

/**
 * Build the instructor roster. Staff/referee rows (comp circle) are excluded —
 * they aren't students. Sort: discipline desc, then rule-compliance desc, then
 * name; withheld/not-publishing sink below anyone with a real score.
 */
export function buildRoster(entries: RosterEntryInput[]): Roster {
  const rows: RosterRow[] = entries
    .filter(e => !e.staff)
    .map(e => {
      const withheld = e.viz?.discipline === false;
      const hasScore = typeof e.disciplineScore === "number";
      return {
        memberCode: e.memberCode,
        name: e.name || "Trader",
        handle: e.handle ?? "",
        disciplineScore: hasScore ? (e.disciplineScore as number) : null,
        disciplineGrade: hasScore ? e.disciplineGrade ?? null : null,
        ruleCompliancePct:
          typeof e.ruleCompliancePct === "number" ? e.ruleCompliancePct : null,
        taggedCount: typeof e.taggedCount === "number" ? e.taggedCount : null,
        totalTrades: typeof e.total === "number" ? e.total : null,
        streak: e.streak ?? null,
        updatedAt: e.updatedAt ?? null,
        withheld,
        notPublishing: !hasScore && !withheld,
      };
    });

  rows.sort((a, b) => {
    // Real scores first; among them, higher discipline then higher compliance.
    const as = a.disciplineScore ?? -1;
    const bs = b.disciplineScore ?? -1;
    if (as !== bs) return bs - as;
    const ac = a.ruleCompliancePct ?? -1;
    const bc = b.ruleCompliancePct ?? -1;
    if (ac !== bc) return bc - ac;
    return a.name.localeCompare(b.name);
  });

  const scores = rows
    .map(r => r.disciplineScore)
    .filter((n): n is number => typeof n === "number");

  const summary: RosterSummary = {
    memberCount: rows.length,
    publishingCount: scores.length,
    withheldCount: rows.filter(r => r.withheld).length,
    notPublishingCount: rows.filter(r => r.notPublishing).length,
    medianDiscipline: median(scores),
    aboveThresholdCount: scores.filter(s => s >= 70).length,
    threshold: 70,
  };

  return { rows, summary };
}

/** CSV for coaches who live in spreadsheets. Header + one row per member. */
export function rosterToCsv(roster: Roster): string {
  const esc = (v: string | number | null): string => {
    if (v === null) return "";
    const s = String(v);
    return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
  };
  const header = [
    "name", "handle", "discipline_score", "grade", "rule_compliance_pct",
    "tagged_trades", "total_trades", "streak", "last_active", "status",
  ];
  const lines = [header.join(",")];
  for (const r of roster.rows) {
    const status = r.withheld ? "withheld" : r.notPublishing ? "not_publishing" : "active";
    const streak = r.streak ? `${r.streak.count}${r.streak.type === "win" ? "W" : "L"}` : "";
    lines.push([
      esc(r.name), esc(r.handle), esc(r.disciplineScore), esc(r.disciplineGrade),
      esc(r.ruleCompliancePct), esc(r.taggedCount), esc(r.totalTrades),
      esc(streak), esc(r.updatedAt), esc(status),
    ].join(","));
  }
  return lines.join("\n");
}
