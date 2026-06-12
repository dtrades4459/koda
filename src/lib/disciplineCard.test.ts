import { describe, it, expect } from "vitest";
import { buildDisciplineCard, refForCircle, type DisciplineCardInput } from "./disciplineCard";

function input(overrides: Partial<DisciplineCardInput> = {}): DisciplineCardInput {
  return {
    profile: { name: "Dylon", handle: "@dylon", avatar: "" },
    entry: {
      disciplineScore: 92,
      disciplineGrade: "A",
      winRate: 61.5,
      total: 14,
      streak: { type: "win", count: 3 },
      topStrategy: "London Sweep",
    },
    circle: { code: "LONDON-X3K2", name: "London Killzone", privacy: "public", emoji: "▲" },
    memberCode: "KT-9F2A",
    ...overrides,
  };
}

describe("buildDisciplineCard", () => {
  it("builds the display string the share copy depends on", () => {
    const p = buildDisciplineCard(input());
    expect(p).not.toBeNull();
    expect(p!.discipline.display).toBe("92/100 — Excellent");
    expect(p!.discipline.grade).toBe("A");
    expect(p!.shareText).toContain("92/100 — Excellent");
    expect(p!.shareText).toContain(p!.shareUrl);
  });

  it("returns null when the discipline score is missing (<3 tagged trades)", () => {
    expect(buildDisciplineCard(input({
      entry: { disciplineScore: null, disciplineGrade: null },
    }))).toBeNull();
  });

  it("NEVER includes cash P&L fields anywhere in the payload", () => {
    // The privacy invariant: even if callers pass a full leaderboard entry,
    // nothing dollar-shaped may survive into the payload.
    const entryWithCash = {
      ...input().entry,
      totalPnLDollar: 4200, weekPnL: 800, pnlPercent: 4.2, totalPnL: 12.5,
    };
    const p = buildDisciplineCard(input({ entry: entryWithCash }));
    const json = JSON.stringify(p);
    expect(json).not.toMatch(/pnl/i);
    expect(json).not.toContain("4200");
    expect(json).not.toContain("$");
  });

  it("uses the circle code as ref for PUBLIC circles", () => {
    const p = buildDisciplineCard(input());
    expect(p!.ref).toBe("LONDON-X3K2");
    expect(p!.shareUrl).toBe(
      "https://kodatrade.co.uk/join?ref=LONDON-X3K2&utm_source=share_card"
    );
  });

  it("attributes to the sharer for PRIVATE circles — the code is the invite key", () => {
    const p = buildDisciplineCard(input({
      circle: { code: "SECRET-AB12", name: "Paid Group", privacy: "private" },
    }));
    expect(p!.ref).toBe("u_KT-9F2A");
    expect(JSON.stringify(p)).not.toContain("SECRET-AB12");
  });

  it("keeps the stored handle as-is — no second @ (the @@x bug class)", () => {
    const p = buildDisciplineCard(input());
    expect(p!.handle).toBe("@dylon");
  });

  it("rounds win rate and tolerates string-ish legacy values", () => {
    const p = buildDisciplineCard(input());
    expect(p!.winRate).toBe(62);
    const noWr = buildDisciplineCard(input({ entry: { ...input().entry, winRate: null } }));
    expect(noWr!.winRate).toBeNull();
  });

  it("caps highlights at 3 process-first lines", () => {
    const p = buildDisciplineCard(input());
    expect(p!.highlights.length).toBeLessThanOrEqual(3);
    expect(p!.highlights).toContain("3-trade win streak");
    expect(p!.highlights).toContain("Top setup · London Sweep");
  });
});

describe("refForCircle", () => {
  it("public → code, private → u_<memberCode>", () => {
    expect(refForCircle({ code: "ABC-1234", privacy: "public" }, "KT-1")).toBe("ABC-1234");
    expect(refForCircle({ code: "ABC-1234", privacy: "private" }, "KT-1")).toBe("u_KT-1");
  });
});
