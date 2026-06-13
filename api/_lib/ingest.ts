// ═══════════════════════════════════════════════════════════════════════════════
// Kōda · trade ingestion core (source-agnostic)
//
// One internal format — StandardizedTrade — and one server-side ingest path that
// every automated source funnels through: CSV (when it moves server-side),
// Tradovate email statements (AutoJournal), aggregator webhooks, direct broker
// API syncs. Parsing/normalization lives in each SOURCE ADAPTER; this module
// owns the database mapping, dedup, and audit. That's the decoupling Bruno's
// brief asked for — parse is separate from map.
//
// Dedup is idempotent by construction: every trade resolves to an external_id
// (the broker/aggregator's own fill ID, or a deterministic hash of the stable
// fields when none is supplied), and writes go through
//   INSERT ... ON CONFLICT (user_id, external_id) DO NOTHING
// against the unique index from migration 005. Re-running a sync inserts zero
// duplicates — the same fill always hashes to the same id.
//
// INERT: nothing imports this yet. It's the spine the email/webhook endpoints
// will call once they land. Wiring it in does not change the live app, which
// still reads trades from the user_kv blob until the v2 read-flip.
// ═══════════════════════════════════════════════════════════════════════════════

import { createHash } from "crypto";
import type { SupabaseClient } from "@supabase/supabase-js";

export type TradeSource = "manual" | "api" | "csv" | "webhook";
export type Outcome = "win" | "loss" | "be";
export type ReviewStatus = "draft" | "published" | "skipped";

/**
 * The unified internal format. Every source adapter (CSV parser, Tradovate PDF
 * parser, SnapTrade/Vezgo webhook mapper, Tradovate API sync) converts its raw
 * payload into this shape before handing it to ingestStandardizedTrades.
 */
export interface StandardizedTrade {
  /**
   * The source's own canonical unique id for this fill/trade (Tradovate
   * fillId, aggregator transaction id, …). When present it is THE dedup key.
   * When null, a deterministic hash of the stable fields is used instead.
   */
  externalId?: string | null;
  /** Symbol / ticker / contract, e.g. "ESU5", "MNQ", "AAPL". Required. */
  symbol: string;
  /** Trade date in YYYY-MM-DD. Required (derive from the fill timestamp). */
  date: string;
  /** Normalized to long/short; buy→long, sell→short. */
  side?: "long" | "short" | "buy" | "sell" | string | null;
  /** Realized P&L in account currency. Drives outcome when outcome is absent. */
  pnl?: number | null;
  /** Win / loss / breakeven. Derived from pnl when omitted. */
  outcome?: Outcome | null;
  entryPrice?: number | null;
  exitPrice?: number | null;   // kept in raw_data — trades has no exit column
  slPrice?: number | null;
  tpPrice?: number | null;
  rr?: number | null;
  qty?: number | null;         // kept in raw_data — trades has no qty column
  strategy?: string | null;
  setup?: string | null;
  session?: string | null;
  notes?: string | null;
  /** ISO timestamp of execution — used for the deterministic hash + ordering. */
  executedAt?: string | null;
  /** The original source payload, stored on trades.raw_data for debugging. */
  raw?: unknown;
}

export interface IngestOptions {
  source: TradeSource;
  /** 'tradovate' | 'rithmic' | 'snaptrade' | … — stamped on every row. */
  broker?: string | null;
  /** Auto-synced trades default to 'draft' (Review Inbox); pass 'published'
   *  to count them immediately. */
  reviewStatus?: ReviewStatus;
  /** Optional broker_connections.id, recorded on the sync_events audit row. */
  connectionId?: string | null;
}

export interface IngestResult {
  /** Raw trades received (before any dedup). */
  found: number;
  /** Net new rows actually written. */
  inserted: number;
  /** Skipped as duplicates (in-batch or already in the DB). */
  duplicates: number;
  /** Dropped for failing validation (no symbol/date). */
  invalid: number;
  syncEventId: string | null;
}

// ── Pure normalization helpers (no DB — unit tested directly) ─────────────────

/** buy/long → long, sell/short → short; anything else passed through lower-cased. */
export function normalizeSide(side: StandardizedTrade["side"]): string | null {
  if (!side) return null;
  const s = String(side).trim().toLowerCase();
  if (s === "buy" || s === "long" || s === "b") return "long";
  if (s === "sell" || s === "short" || s === "s") return "short";
  return s || null;
}

/** Use an explicit outcome when given; otherwise derive from P&L sign. */
export function deriveOutcome(t: Pick<StandardizedTrade, "outcome" | "pnl">): Outcome {
  if (t.outcome === "win" || t.outcome === "loss" || t.outcome === "be") return t.outcome;
  const pnl = typeof t.pnl === "number" ? t.pnl : 0;
  if (pnl > 0) return "win";
  if (pnl < 0) return "loss";
  return "be";
}

/**
 * Resolve the dedup id. Prefer the source's own id; otherwise hash the STABLE
 * fields so the same fill always produces the same id across re-syncs. Volatile
 * fields (notes, strategy, review status) are deliberately excluded — editing a
 * note must not make a trade look new.
 */
export function deriveExternalId(t: StandardizedTrade): string {
  const explicit = t.externalId != null ? String(t.externalId).trim() : "";
  if (explicit) return explicit;
  const canonical = [
    t.symbol?.trim().toUpperCase() ?? "",
    t.executedAt ?? t.date ?? "",
    t.side ? normalizeSide(t.side) : "",
    t.entryPrice ?? "",
    t.exitPrice ?? "",
    t.qty ?? "",
    t.pnl ?? "",
  ].join("|");
  return "h:" + createHash("sha256").update(canonical).digest("hex").slice(0, 32);
}

/** A trade is ingestible only if it has a symbol and a date. */
export function isValidTrade(t: StandardizedTrade): boolean {
  return !!t.symbol?.trim() && !!t.date?.trim();
}

/** Map one StandardizedTrade to a public.trades insert row (snake_case). */
export function standardizedToRow(
  userId: string,
  t: StandardizedTrade,
  opts: IngestOptions,
): Record<string, unknown> {
  return {
    user_id: userId,
    external_id: deriveExternalId(t),
    source: opts.source,
    broker: opts.broker ?? null,
    pair: t.symbol.trim(),
    side: normalizeSide(t.side ?? null),
    date: t.date,
    session: t.session ?? null,
    strategy: t.strategy ?? "",
    setup: t.setup ?? null,
    outcome: deriveOutcome(t),
    entry_price: t.entryPrice ?? null,
    sl_price: t.slPrice ?? null,
    tp_price: t.tpPrice ?? null,
    pnl: typeof t.pnl === "number" ? t.pnl : 0,
    rr: t.rr ?? null,
    notes: t.notes ?? null,
    raw_data: t.raw ?? null,
    review_status: opts.reviewStatus ?? "draft",
  };
}

/**
 * Collapse duplicates WITHIN a single batch by external_id (an aggregator can
 * repeat a fill inside one payload). First occurrence wins. Returns the deduped
 * rows plus how many in-batch dupes were dropped.
 */
export function dedupeBatch(
  rows: Array<Record<string, unknown>>,
): { rows: Array<Record<string, unknown>>; dropped: number } {
  const seen = new Set<string>();
  const out: Array<Record<string, unknown>> = [];
  for (const r of rows) {
    const id = String(r.external_id);
    if (seen.has(id)) continue;
    seen.add(id);
    out.push(r);
  }
  return { rows: out, dropped: rows.length - out.length };
}

// ── Ingest (DB) ───────────────────────────────────────────────────────────────

/**
 * Standardized trades → public.trades, idempotently. Writes with the service
 * role (RLS bypassed) so the caller MUST have already authenticated the user
 * and resolved `userId` itself — never trust a user id from a webhook body.
 *
 * Returns a count summary and records one sync_events audit row.
 */
export async function ingestStandardizedTrades(
  admin: SupabaseClient,
  userId: string,
  trades: StandardizedTrade[],
  opts: IngestOptions,
): Promise<IngestResult> {
  const startedAt = new Date().toISOString();
  const found = trades.length;

  const valid = trades.filter(isValidTrade);
  const invalid = found - valid.length;

  const mapped = valid.map(t => standardizedToRow(userId, t, opts));
  const { rows: deduped, dropped: inBatchDupes } = dedupeBatch(mapped);

  let inserted = 0;
  let dbDupes = 0;
  let error: string | null = null;

  if (deduped.length > 0) {
    // ignoreDuplicates → INSERT ... ON CONFLICT (user_id, external_id) DO NOTHING.
    // .select() then returns ONLY the rows that were actually inserted, so the
    // difference is the count of trades already in the DB from a prior sync.
    const { data, error: upsertErr } = await admin
      .from("trades")
      .upsert(deduped, { onConflict: "user_id,external_id", ignoreDuplicates: true })
      .select("id");
    if (upsertErr) {
      error = upsertErr.message;
    } else {
      inserted = data?.length ?? 0;
      dbDupes = deduped.length - inserted;
    }
  }

  const duplicates = inBatchDupes + dbDupes;

  // Audit row — best-effort; never let an audit failure mask a successful write.
  let syncEventId: string | null = null;
  try {
    const { data: ev } = await admin
      .from("sync_events")
      .insert({
        user_id: userId,
        connection_id: opts.connectionId ?? null,
        broker: opts.broker ?? opts.source,
        started_at: startedAt,
        completed_at: new Date().toISOString(),
        trades_found: found,
        trades_new: inserted,
        error,
      })
      .select("id")
      .single();
    syncEventId = (ev?.id as string) ?? null;
  } catch {
    /* audit is non-critical */
  }

  if (error) throw new Error(`ingest failed: ${error}`);

  return { found, inserted, duplicates, invalid, syncEventId };
}
