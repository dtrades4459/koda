// ═══════════════════════════════════════════════════════════════════════════════
// rowToTrade.test.ts — the pnl (R) vs pnlDollar units contract for CSV import.
//
// Regression guard for the leaderboard bug where a $1,129.50 broker import
// rendered as +1129.5R because the broker's DOLLAR P&L was written into the
// R field. Broker dollars must land in pnlDollar; R stays blank (we have no
// risk basis to compute realized R from a broker export).
// ═══════════════════════════════════════════════════════════════════════════════

import { describe, it, expect } from "vitest";
import { rowToTrade, type RowContext } from "./rowToTrade";

const ctx: RowContext = { decimalSeparator: "auto" };

// A typical futures-broker export row: P&L is a DOLLAR figure.
const mapping = { date: "Date", pair: "Symbol", pnl: "P&L", bias: "Side" };
const baseRow = { Date: "2026-06-10", Symbol: "NQ", "P&L": "1129.50", Side: "Buy" };

describe("rowToTrade — pnl/pnlDollar units contract", () => {
  it("writes broker dollar P&L into pnlDollar, never into pnl (R)", () => {
    const t = rowToTrade(baseRow, mapping, "", "us", "personal", ctx)!;
    expect(t).not.toBeNull();
    expect(t.pnlDollar).toBe("1129.50"); // dollars land here
    expect(t.pnl).toBe("");              // R stays blank — not 1129.50
  });

  it("keeps R blank for a losing dollar import too (no sign leaks into R)", () => {
    const t = rowToTrade(
      { ...baseRow, "P&L": "(500.00)" }, // parenthesised negative
      mapping, "", "us", "personal", ctx,
    )!;
    expect(t.pnlDollar).toBe("-500.00");
    expect(t.pnl).toBe("");
  });

  it("does not derive R from a planned R:R column (ratio is not realized R)", () => {
    // A file that carries an R:R ratio column populates rr, but realized R
    // (pnl) is still unknown — a 2.5 R:R trade that lost is -1R, not +2.5R.
    const t = rowToTrade(
      { ...baseRow, "R:R": "2.5" },
      { ...mapping, rr: "R:R" }, "", "us", "personal", ctx,
    )!;
    expect(t.rr).toBe("2.5"); // planned ratio preserved
    expect(t.pnl).toBe("");   // realized R still blank
  });

  it("still rejects rows with no parseable date or symbol", () => {
    expect(rowToTrade({ ...baseRow, Date: "" }, mapping, "", "us", "personal", ctx)).toBeNull();
    expect(rowToTrade({ ...baseRow, Symbol: "" }, mapping, "", "us", "personal", ctx)).toBeNull();
  });
});
