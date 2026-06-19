// ═══════════════════════════════════════════════════════════════════════════════
// tradeBackfill.test.ts — one-time repair of legacy CSV-imported rows that have
// the broker's DOLLAR P&L stuck in the R field (pnl). See rowToTrade.ts for the
// units contract this restores on already-saved data.
// ═══════════════════════════════════════════════════════════════════════════════

import { describe, it, expect } from "vitest";
import type { Trade } from "../types";
import { backfillCsvImportR } from "./tradeBackfill";

function mk(over: Partial<Trade>): Trade {
  return {
    id: 1, date: "2026-06-10", pair: "NQ", session: "", bias: "", strategy: "",
    setup: "", entryPrice: "", slPrice: "", tpPrice: "", rr: "", outcome: "Win",
    pnl: "", notes: "", emotions: "", screenshot: "", pnlDollar: "",
    comments: [], reactions: {},
    ...over,
  };
}

describe("backfillCsvImportR", () => {
  it("blanks pnl on a buggy csv_import row (dollars duplicated into R), keeping pnlDollar", () => {
    const trades = [mk({ source: "csv_import", pnl: "1129.50", pnlDollar: "1129.50" })];
    const { trades: out, changed } = backfillCsvImportR(trades);
    expect(changed).toBe(true);
    expect(out[0].pnl).toBe("");          // R repaired
    expect(out[0].pnlDollar).toBe("1129.50"); // dollars untouched
  });

  it("leaves manually-logged trades alone (R there is real)", () => {
    const trades = [mk({ source: "manual", pnl: "2.5", pnlDollar: "485.00" })];
    const { trades: out, changed } = backfillCsvImportR(trades);
    expect(changed).toBe(false);
    expect(out[0].pnl).toBe("2.5");
  });

  it("does not clobber a csv_import row whose R was manually edited (pnl != pnlDollar)", () => {
    // Bug signature is pnl === pnlDollar (same dollar string in both). A distinct
    // pnl means the user entered a real R after import — preserve it.
    const trades = [mk({ source: "csv_import", pnl: "1.8", pnlDollar: "1129.50" })];
    const { trades: out, changed } = backfillCsvImportR(trades);
    expect(changed).toBe(false);
    expect(out[0].pnl).toBe("1.8");
  });

  it("is idempotent — a second pass over repaired data changes nothing", () => {
    const trades = [mk({ source: "csv_import", pnl: "1129.50", pnlDollar: "1129.50" })];
    const first = backfillCsvImportR(trades);
    const second = backfillCsvImportR(first.trades);
    expect(second.changed).toBe(false);
  });

  it("reports changed=false (and a stable array) when nothing needs fixing", () => {
    const trades = [
      mk({ source: "csv_import", pnl: "", pnlDollar: "1129.50" }), // already correct
      mk({ source: "manual", pnl: "2.5", pnlDollar: "485.00" }),
    ];
    const { changed } = backfillCsvImportR(trades);
    expect(changed).toBe(false);
  });
});
