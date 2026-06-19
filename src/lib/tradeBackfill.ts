// ═══════════════════════════════════════════════════════════════════════════════
// tradeBackfill.ts — one-time repair of legacy CSV-imported rows.
//
// Before the rowToTrade units fix, a broker CSV import wrote the broker's DOLLAR
// P&L into BOTH pnlDollar and pnl (R). That made e.g. a $1,129.50 import read as
// +1129.5R on leaderboards and in lifetime stats. New imports are fixed; this
// repairs rows already saved in each user's koda_trades blob.
//
// Runs client-side on load (see Koda.loadAll), per-user under their own RLS —
// the same pattern as the screenshot→storage migration. Pure + idempotent.
// ═══════════════════════════════════════════════════════════════════════════════

import type { Trade } from "../types";

/**
 * Strip the duplicated dollar value out of the R field (pnl) on CSV-imported
 * trades, leaving pnlDollar intact.
 *
 * Bug signature: source === "csv_import" AND pnl is non-empty AND pnl ===
 * pnlDollar (the buggy importer wrote the identical dollar string into both).
 * We deliberately key on that equality so we never clobber a row where the user
 * manually entered a real R after import (pnl !== pnlDollar).
 *
 * Returns the (possibly new) array plus a `changed` flag so callers only resave
 * when something was actually repaired.
 */
export function backfillCsvImportR(trades: Trade[]): { trades: Trade[]; changed: boolean } {
  let changed = false;
  const out = trades.map(t => {
    if (t.source === "csv_import" && t.pnl !== "" && t.pnl === t.pnlDollar) {
      changed = true;
      return { ...t, pnl: "" };
    }
    return t;
  });
  return { trades: changed ? out : trades, changed };
}
