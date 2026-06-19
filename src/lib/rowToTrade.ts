// ═══════════════════════════════════════════════════════════════════════════════
// rowToTrade.ts — pure row → Trade mapping for CSV/Excel import.
// Extracted from CsvImportPanel.tsx so the mapping (and especially the
// pnl/pnlDollar units contract) can be unit-tested without React.
//
// UNITS CONTRACT:
//   Trade.pnl       = result in R (R-multiples). Summed + displayed as "R"
//                     everywhere in the app and on circle leaderboards.
//   Trade.pnlDollar = result in dollars.
// Broker CSV exports carry DOLLAR P&L, not R — that dollar value belongs in
// pnlDollar only.
// ═══════════════════════════════════════════════════════════════════════════════

import type { Trade } from "../types";
import {
  detectSessionFromDateStr,
  normalizeBias,
  normalizeOutcome,
  parseNum,
  normalizeDate,
  normaliseSymbol,
  computePnlDollar,
  inferBiasFromTimes,
} from "./csvParser";
import { calcRR } from "./stats";

export interface RowContext {
  /** Decimal separator hint derived from the file's column delimiter. */
  decimalSeparator: "," | "." | "auto";
  /** Columns used to infer Bullish/Bearish from buy/sell timestamps when no Side column exists. */
  biasInferenceColumns?: { buyTime: string; sellTime: string };
  /** Column holding a broker-supplied unique trade/order ID (used as the preferred dedup key). */
  brokerIdColumn?: string;
}

export function rowToTrade(
  row: Record<string, string>,
  mapping: Record<string, string>,
  defaultStrategy: string,
  dateLocale: "us" | "eu",
  defaultAccountType: Trade["accountType"],
  ctx: RowContext,
): Trade | null {
  const sepOpts = { decimalSeparator: ctx.decimalSeparator } as const;
  const get = (f: string) => mapping[f] ? row[mapping[f]] : "";
  const rawDate = get("date");
  const date = normalizeDate(rawDate, dateLocale);
  const pair = normaliseSymbol((get("pair") || "").toUpperCase());

  // Reject rows with no parseable date or no symbol — they're summary/header rows
  if (!date || !pair) return null;

  const pnl = parseNum(get("pnl"), sepOpts);
  const qty = parseNum(get("qty"), sepOpts);
  const session = get("session") || detectSessionFromDateStr(rawDate);
  const entryPrice = get("entryPrice");
  const exitPrice = get("exitPrice");
  const slPrice = get("slPrice");
  const tpPrice = get("tpPrice");

  // Direction: prefer explicit Side/B-S column when mapped. For broker formats
  // that omit it (Rithmic / Apex web export) fall back to comparing buy/sell
  // timestamps so shorts aren't silently logged as longs.
  let bias = normalizeBias(get("bias"));
  if (!bias && ctx.biasInferenceColumns) {
    const buyRaw = row[ctx.biasInferenceColumns.buyTime] ?? "";
    const sellRaw = row[ctx.biasInferenceColumns.sellTime] ?? "";
    bias = inferBiasFromTimes(buyRaw, sellRaw);
  }

  // The broker's net P&L is a DOLLAR figure — it belongs in pnlDollar, never in
  // the R field. Trust it when present (it bakes in commissions, partial fills,
  // and tick rounding); only recompute from entry × exit × tick value when the
  // broker omitted P&L entirely.
  const pnlDollarStr = (() => {
    if (pnl !== null) return pnl.toFixed(2);
    const dollars = computePnlDollar({
      symbol: pair,
      entryPrice: parseNum(entryPrice, sepOpts),
      exitPrice: parseNum(exitPrice, sepOpts),
      qty,
      bias,
    });
    return dollars === null ? "" : dollars.toFixed(2);
  })();

  const brokerId = ctx.brokerIdColumn ? (row[ctx.brokerIdColumn] ?? "").trim() : "";

  const trade: Trade = {
    id: Date.now() * 1000 + Math.floor(Math.random() * 999),
    date,
    pair,
    session,
    bias,
    // direction mirrors bias so imported trades render the LONG/SHORT pill
    // alongside manually-logged ones (Koda.tsx renders the pill from t.direction).
    direction: bias === "Bullish" ? "Long" : bias === "Bearish" ? "Short" : "",
    strategy: defaultStrategy || "",
    setup: "",
    entryPrice,
    slPrice,
    tpPrice,
    rr: get("rr") || (entryPrice && slPrice && tpPrice ? calcRR(entryPrice, slPrice, tpPrice) : ""),
    outcome: normalizeOutcome(get("outcome"), pnl ?? 0),
    // pnl is the trade's realized result in R. A broker export carries dollars,
    // not R, and rarely a risk basis to derive R from — so R stays blank and the
    // dollar result lives in pnlDollar. Writing dollars here is what made a
    // $1,129.50 import read as +1129.5R on the leaderboard.
    pnl: "",
    notes: get("notes"),
    emotions: "",
    screenshot: "",
    pnlDollar: pnlDollarStr,
    comments: [],
    reactions: {},
    source: "csv_import",
    accountType: defaultAccountType,
    ...(brokerId ? { brokerId } : {}),
  };
  return trade;
}
