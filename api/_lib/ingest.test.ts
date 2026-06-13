// @vitest-environment node
import { describe, it, expect } from "vitest";
import type { SupabaseClient } from "@supabase/supabase-js";
import {
  normalizeSide,
  deriveOutcome,
  deriveExternalId,
  isValidTrade,
  standardizedToRow,
  dedupeBatch,
  ingestStandardizedTrades,
  type StandardizedTrade,
  type IngestOptions,
} from "./ingest";

const OPTS: IngestOptions = { source: "webhook", broker: "tradovate" };

function trade(over: Partial<StandardizedTrade> = {}): StandardizedTrade {
  return { symbol: "ESU5", date: "2026-06-13", pnl: 120, externalId: "fill-1", ...over };
}

describe("normalizeSide", () => {
  it("maps buy/long → long and sell/short → short", () => {
    expect(normalizeSide("buy")).toBe("long");
    expect(normalizeSide("B")).toBe("long");
    expect(normalizeSide("LONG")).toBe("long");
    expect(normalizeSide("sell")).toBe("short");
    expect(normalizeSide("S")).toBe("short");
    expect(normalizeSide(null)).toBeNull();
  });
});

describe("deriveOutcome", () => {
  it("uses explicit outcome when valid, else derives from pnl", () => {
    expect(deriveOutcome({ outcome: "win", pnl: -5 })).toBe("win"); // explicit wins
    expect(deriveOutcome({ pnl: 50 })).toBe("win");
    expect(deriveOutcome({ pnl: -50 })).toBe("loss");
    expect(deriveOutcome({ pnl: 0 })).toBe("be");
    expect(deriveOutcome({})).toBe("be");
  });
});

describe("deriveExternalId", () => {
  it("prefers the source's own id", () => {
    expect(deriveExternalId(trade({ externalId: "fill-99" }))).toBe("fill-99");
  });

  it("hashes stable fields deterministically when no id is given", () => {
    const t = trade({ externalId: null, executedAt: "2026-06-13T14:30:00Z", side: "buy", entryPrice: 5400, qty: 2 });
    const a = deriveExternalId(t);
    const b = deriveExternalId({ ...t }); // same inputs → same id
    expect(a).toBe(b);
    expect(a.startsWith("h:")).toBe(true);
  });

  it("editing a volatile field (notes/strategy) does NOT change the hash", () => {
    const base = trade({ externalId: null, executedAt: "2026-06-13T14:30:00Z" });
    const withNote = { ...base, notes: "revenge trade", strategy: "ICT" };
    expect(deriveExternalId(base)).toBe(deriveExternalId(withNote));
  });

  it("a different fill (different price) produces a different hash", () => {
    const a = deriveExternalId(trade({ externalId: null, entryPrice: 5400 }));
    const b = deriveExternalId(trade({ externalId: null, entryPrice: 5401 }));
    expect(a).not.toBe(b);
  });
});

describe("isValidTrade / standardizedToRow", () => {
  it("requires symbol and date", () => {
    expect(isValidTrade(trade())).toBe(true);
    expect(isValidTrade(trade({ symbol: "" }))).toBe(false);
    expect(isValidTrade(trade({ date: "" }))).toBe(false);
  });

  it("maps to a snake_case trades row with source/broker/review stamps", () => {
    const row = standardizedToRow("u-1", trade({ side: "buy", strategy: "ICT", raw: { x: 1 } }), OPTS);
    expect(row).toMatchObject({
      user_id: "u-1",
      external_id: "fill-1",
      source: "webhook",
      broker: "tradovate",
      pair: "ESU5",
      side: "long",
      date: "2026-06-13",
      strategy: "ICT",
      outcome: "win",
      review_status: "draft",     // auto-sync default
      raw_data: { x: 1 },
    });
  });

  it("review_status can be forced to published", () => {
    const row = standardizedToRow("u-1", trade(), { ...OPTS, reviewStatus: "published" });
    expect(row.review_status).toBe("published");
  });
});

describe("dedupeBatch", () => {
  it("drops repeats of the same external_id within one batch (first wins)", () => {
    const rows = [
      { external_id: "a", pnl: 1 },
      { external_id: "b", pnl: 2 },
      { external_id: "a", pnl: 3 },
    ];
    const { rows: out, dropped } = dedupeBatch(rows);
    expect(out).toHaveLength(2);
    expect(dropped).toBe(1);
    expect(out[0]).toEqual({ external_id: "a", pnl: 1 }); // first occurrence kept
  });
});

// ── Orchestration via a fake admin client ─────────────────────────────────────

type Row = Record<string, unknown>;

/** Minimal Supabase-like stub. `insertedExternalIds` simulates which of the
 *  upserted rows were NET NEW (the rest are treated as DB duplicates). */
function fakeAdmin(insertedExternalIds: string[]) {
  const calls: { table: string; rows?: Row[] } = { table: "" };
  const syncRows: Row[] = [];
  const client = {
    from(table: string) {
      if (table === "trades") {
        return {
          upsert(rows: Row[]) {
            calls.table = "trades";
            calls.rows = rows;
            return {
              select: () => Promise.resolve({
                data: rows.filter(r => insertedExternalIds.includes(String(r.external_id))).map(r => ({ id: r.external_id })),
                error: null,
              }),
            };
          },
        };
      }
      // sync_events
      return {
        insert(row: Row) {
          syncRows.push(row);
          return { select: () => ({ single: () => Promise.resolve({ data: { id: "se-1" }, error: null }) }) };
        },
      };
    },
  };
  return { client: client as unknown as SupabaseClient, calls, syncRows };
}

describe("ingestStandardizedTrades", () => {
  it("counts found / inserted / duplicates / invalid and writes a sync_events row", async () => {
    const trades: StandardizedTrade[] = [
      trade({ externalId: "f1" }),
      trade({ externalId: "f2" }),
      trade({ externalId: "f1" }),           // in-batch dup
      trade({ symbol: "", externalId: "f3" }), // invalid (no symbol)
    ];
    // Of the deduped {f1, f2}, say only f1 is net-new (f2 already in DB).
    const { client, calls, syncRows } = fakeAdmin(["f1"]);

    const res = await ingestStandardizedTrades(client, "u-1", trades, OPTS);

    expect(res.found).toBe(4);
    expect(res.invalid).toBe(1);
    expect(res.inserted).toBe(1);            // only f1
    expect(res.duplicates).toBe(2);          // 1 in-batch + 1 db dup
    expect(calls.rows).toHaveLength(2);      // f1, f2 sent to upsert
    expect(syncRows[0]).toMatchObject({ user_id: "u-1", trades_found: 4, trades_new: 1 });
  });

  it("re-running the same sync inserts zero new rows (idempotent)", async () => {
    const trades = [trade({ externalId: "f1" }), trade({ externalId: "f2" })];
    // Second run: the DB already has both → nothing is net-new.
    const { client } = fakeAdmin([]);
    const res = await ingestStandardizedTrades(client, "u-1", trades, OPTS);
    expect(res.inserted).toBe(0);
    expect(res.duplicates).toBe(2);
  });

  it("no-ops cleanly on an empty batch", async () => {
    const { client } = fakeAdmin([]);
    const res = await ingestStandardizedTrades(client, "u-1", [], OPTS);
    expect(res).toMatchObject({ found: 0, inserted: 0, duplicates: 0, invalid: 0 });
  });
});
