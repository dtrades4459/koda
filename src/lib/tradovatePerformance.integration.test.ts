// ═══════════════════════════════════════════════════════════════════════════════
// tradovatePerformance.integration.test.ts
//
// Regression guard built from a REAL user upload (Performance19.1.csv) — the
// Tradovate "Performance" export that surfaced the +1129.5R leaderboard bug.
// This file runs the actual import pipeline (parseCSV → autoDetectMapping →
// rowToTrade) end-to-end and locks in two things:
//   1. Per-row dates parse correctly (they're all 2026-06-19 because the trader
//      genuinely scalped that day — NOT a date-collapse bug).
//   2. The broker's DOLLAR pnl lands in pnlDollar; the R field stays blank.
// ═══════════════════════════════════════════════════════════════════════════════

import { describe, it, expect } from "vitest";
import { readFileSync } from "fs";
import { join } from "path";
import { parseCSV, autoDetectMapping, detectBroker } from "./csvParser";
import { rowToTrade, type RowContext } from "./rowToTrade";

const csv = readFileSync(
  join(__dirname, "__fixtures__", "tradovate-performance-export.csv"),
  "utf-8",
);
const { headers, rows } = parseCSV(csv);
const mapping = autoDetectMapping(headers);
const ctx: RowContext = { decimalSeparator: "auto" };
const trades = rows
  .map(r => rowToTrade(r, mapping, "", "us", "personal", ctx))
  .filter((t): t is NonNullable<typeof t> => t !== null);

describe("Tradovate Performance export — real upload", () => {
  it("is detected as the tradovate_performance broker preset", () => {
    expect(detectBroker(headers)).toBe("tradovate_performance");
  });

  it("infers Short on row 1 from buy/sell timestamp order (no Side column)", () => {
    // The Performance export has no direction column. The preset infers it from
    // boughtTimestamp vs soldTimestamp. Row 1: sold 03:03:02 BEFORE bought
    // 03:03:47 → entered short. (Sold 4202.1, bought back 4203.3 → -$12, checks out.)
    const ctxBias: RowContext = {
      decimalSeparator: "auto",
      biasInferenceColumns: { buyTime: "boughtTimestamp", sellTime: "soldTimestamp" },
    };
    const t = rowToTrade(rows[0], mapping, "", "us", "personal", ctxBias)!;
    expect(t.bias).toBe("Bearish");
    expect(t.direction).toBe("Short");
  });

  it("auto-maps the lowercase Performance columns", () => {
    expect(mapping.pair).toBe("symbol");
    expect(mapping.date).toBe("boughtTimestamp");
    expect(mapping.pnl).toBe("pnl");
    expect(mapping.entryPrice).toBe("buyPrice");
    expect(mapping.qty).toBe("qty");
  });

  it("imports every data row (none silently dropped)", () => {
    expect(trades).toHaveLength(rows.length);
    expect(trades.length).toBeGreaterThan(0);
  });

  it("DATE: every trade gets its real per-row date (2026-06-19), not a collapse", () => {
    // The proof the 'all on one day' worry was the data, not a bug: the trader
    // placed all these scalps on 06/19/2026, and each row carries that date.
    expect(trades.every(t => t.date === "2026-06-19")).toBe(true);
  });

  it("UNITS: broker dollars land in pnlDollar, R field stays blank", () => {
    // The big winner: $1,708.00 → pnlDollar "1708.00", pnl (R) "".
    const big = trades.find(t => t.pnlDollar === "1708.00");
    expect(big).toBeDefined();
    expect(big!.pnl).toBe(""); // never +1708R

    // Parenthesised loss: $(12.00) → -12.00 in dollars, blank R.
    const loss = trades.find(t => t.pnlDollar === "-12.00");
    expect(loss).toBeDefined();
    expect(loss!.pnl).toBe("");

    // No trade carries an R value sourced from dollars.
    expect(trades.every(t => t.pnl === "")).toBe(true);
  });

  it("the leaderboard R total for this import is 0 (was the inflated dollar sum)", () => {
    const totalR = trades.reduce((s, t) => s + (parseFloat(t.pnl) || 0), 0);
    expect(totalR).toBe(0);
  });
});
