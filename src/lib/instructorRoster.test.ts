import { describe, it, expect } from "vitest";
import { buildRoster, rosterToCsv, type RosterEntryInput } from "./instructorRoster";

const base: RosterEntryInput[] = [
  { memberCode: "A", name: "Ana", disciplineScore: 88, disciplineGrade: "A", ruleCompliancePct: 90, taggedCount: 9, total: 12, streak: { type: "win", count: 3 } },
  { memberCode: "B", name: "Ben", disciplineScore: 95, disciplineGrade: "A+", ruleCompliancePct: 80, taggedCount: 10, total: 10 },
  { memberCode: "C", name: "Cy",  disciplineScore: 88, disciplineGrade: "A", ruleCompliancePct: 96, taggedCount: 8, total: 8 },
  { memberCode: "D", name: "Dee", disciplineScore: null, disciplineGrade: null }, // not enough tagged
  { memberCode: "E", name: "Eve", disciplineScore: null, viz: { pnl: true, winRate: true, discipline: false, avgRR: true } }, // withheld
];

describe("buildRoster", () => {
  it("ranks by discipline desc, then rule-compliance desc, then name", () => {
    const { rows } = buildRoster(base);
    expect(rows.map(r => r.memberCode)).toEqual(["B", "C", "A", "D", "E"]);
    //                                            95   88(96) 88(90) null null
  });

  it("distinguishes withheld from not-publishing", () => {
    const { rows } = buildRoster(base);
    const eve = rows.find(r => r.memberCode === "E")!;
    const dee = rows.find(r => r.memberCode === "D")!;
    expect(eve.withheld).toBe(true);
    expect(eve.notPublishing).toBe(false);
    expect(dee.notPublishing).toBe(true);
    expect(dee.withheld).toBe(false);
  });

  it("excludes staff/referee rows from the roster", () => {
    const withStaff = [...base, { memberCode: "REF", name: "Ref", disciplineScore: 100, staff: true }];
    const { rows, summary } = buildRoster(withStaff);
    expect(rows.find(r => r.memberCode === "REF")).toBeUndefined();
    expect(summary.memberCount).toBe(5);
  });

  it("summary: median over publishing members only, threshold count, withheld/not-publishing", () => {
    const { summary } = buildRoster(base);
    expect(summary.memberCount).toBe(5);
    expect(summary.publishingCount).toBe(3);     // A,B,C
    expect(summary.withheldCount).toBe(1);        // E
    expect(summary.notPublishingCount).toBe(1);   // D
    expect(summary.medianDiscipline).toBe(88);    // median(88,95,88) = 88
    expect(summary.aboveThresholdCount).toBe(3);  // all >= 70
    expect(summary.belowThresholdCount).toBe(0);  // none below default 70
    expect(summary.threshold).toBe(70);           // default
  });

  it("respects a coach-set threshold for above/below counts and per-row flags", () => {
    const { rows, summary } = buildRoster(base, 90);
    expect(summary.threshold).toBe(90);
    expect(summary.aboveThresholdCount).toBe(1);  // B(95)
    expect(summary.belowThresholdCount).toBe(2);  // A(88), C(88)
    expect(rows.find(r => r.memberCode === "A")!.belowThreshold).toBe(true);
    expect(rows.find(r => r.memberCode === "B")!.belowThreshold).toBe(false);
    // No score → never flagged (nothing for the coach to act on yet).
    expect(rows.find(r => r.memberCode === "D")!.belowThreshold).toBe(false);
  });

  it("never exposes a dollar field", () => {
    const json = JSON.stringify(buildRoster(base));
    expect(json).not.toMatch(/pnl|dollar|\$/i);
  });

  it("handles an all-empty roster", () => {
    const { rows, summary } = buildRoster([]);
    expect(rows).toEqual([]);
    expect(summary.medianDiscipline).toBeNull();
    expect(summary.publishingCount).toBe(0);
  });

  it("even-count median averages the two middles", () => {
    const { summary } = buildRoster([
      { memberCode: "1", name: "One", disciplineScore: 60 },
      { memberCode: "2", name: "Two", disciplineScore: 80 },
    ]);
    expect(summary.medianDiscipline).toBe(70);
  });
});

describe("rosterToCsv", () => {
  it("emits a header + one row per member with status", () => {
    const csv = rosterToCsv(buildRoster(base));
    const lines = csv.split("\n");
    expect(lines[0]).toContain("discipline_score");
    expect(lines).toHaveLength(6); // header + 5
    expect(csv).toContain("withheld");
    expect(csv).toContain("not_publishing");
  });

  it("marks below_threshold status when scoring under the coach threshold", () => {
    const csv = rosterToCsv(buildRoster(base, 90));
    expect(csv).toContain("below_threshold");
  });

  it("escapes commas/quotes in names", () => {
    const csv = rosterToCsv(buildRoster([
      { memberCode: "X", name: 'Smith, "Ace"', disciplineScore: 70 },
    ]));
    expect(csv).toContain('"Smith, ""Ace"""');
  });
});
