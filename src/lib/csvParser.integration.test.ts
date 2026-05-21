// ═══════════════════════════════════════════════════════════════════════════════
// csvParser integration tests — parse real CSV fixtures end-to-end and verify
// that broker detection, field mapping, and normalization produce correct trade
// fields ready for import into the journal.
// ═══════════════════════════════════════════════════════════════════════════════

import { describe, it, expect } from "vitest";
import { readFileSync } from "fs";
import { join } from "path";
import {
  parseCSV,
  detectBroker,
  autoDetectMapping,
  normalizeBias,
  normalizeOutcome,
  normalizeDate,
  parseNum,
  detectSessionFromDateStr,
} from "./csvParser";

/** Helper: load a fixture file from the __fixtures__ directory. */
function loadFixture(name: string): string {
  return readFileSync(join(__dirname, "__fixtures__", name), "utf-8");
}

/** Apply the full mapping pipeline to a parsed row, just like CsvImportPanel does. */
function mapRow(
  row: Record<string, string>,
  mapping: Record<string, string>
): {
  pair: string;
  date: string;
  bias: string;
  outcome: string;
  pnl: number;
  entryPrice: number;
  exitPrice: number;
  qty: number;
  session: string;
} {
  const pnlRaw = mapping.pnl ? row[mapping.pnl] ?? "" : "";
  const pnl = parseNum(pnlRaw);
  return {
    pair: mapping.pair ? (row[mapping.pair] ?? "") : "",
    date: normalizeDate(mapping.date ? (row[mapping.date] ?? "") : ""),
    bias: normalizeBias(mapping.bias ? (row[mapping.bias] ?? "") : ""),
    outcome: normalizeOutcome(mapping.outcome ? (row[mapping.outcome] ?? "") : "", pnl),
    pnl,
    entryPrice: parseNum(mapping.entryPrice ? (row[mapping.entryPrice] ?? "") : ""),
    exitPrice: parseNum(mapping.exitPrice ? (row[mapping.exitPrice] ?? "") : ""),
    qty: parseNum(mapping.qty ? (row[mapping.qty] ?? "") : ""),
    session: detectSessionFromDateStr(mapping.date ? (row[mapping.date] ?? "") : ""),
  };
}

// ── Tradovate fixture ────────────────────────────────────────────────────────

describe("Tradovate CSV integration", () => {
  const csv = loadFixture("tradovate-export.csv");
  const { headers, rows } = parseCSV(csv);

  it("parses all 5 data rows", () => {
    expect(rows).toHaveLength(5);
  });

  it("detects broker as tradovate", () => {
    expect(detectBroker(headers)).toBe("tradovate");
  });

  it("auto-maps all expected fields", () => {
    const m = autoDetectMapping(headers);
    expect(m.pair).toBe("Symbol");
    expect(m.date).toBe("Buy Time");
    expect(m.pnl).toBe("P&L");
    expect(m.entryPrice).toBe("Buy Price");
    expect(m.qty).toBe("Qty");
  });

  it("maps first row (MES win) correctly", () => {
    const m = autoDetectMapping(headers);
    const trade = mapRow(rows[0], m);

    expect(trade.pair).toBe("MESZ4");
    expect(trade.date).toBe("2024-11-18");
    expect(trade.pnl).toBeCloseTo(41.25);
    expect(trade.entryPrice).toBeCloseTo(5920.25);
    expect(trade.outcome).toBe("Win");
    expect(trade.qty).toBe(1);
    expect(trade.session).toBe("NY");
  });

  it("maps third row (MES loss) correctly", () => {
    const m = autoDetectMapping(headers);
    const trade = mapRow(rows[2], m);

    expect(trade.pair).toBe("MESZ4");
    expect(trade.pnl).toBeCloseTo(-21.25);
    expect(trade.outcome).toBe("Loss");
  });

  it("maps fifth row (MNQ breakeven) correctly", () => {
    const m = autoDetectMapping(headers);
    const trade = mapRow(rows[4], m);

    expect(trade.pair).toBe("MNQZ4");
    expect(trade.pnl).toBeCloseTo(0);
    expect(trade.outcome).toBe("Breakeven");
  });
});

// ── Rithmic fixture ──────────────────────────────────────────────────────────

describe("Rithmic CSV integration", () => {
  const csv = loadFixture("rithmic-export.csv");
  const { headers, rows } = parseCSV(csv);

  it("parses all 3 data rows", () => {
    expect(rows).toHaveLength(3);
  });

  it("detects broker as rithmic", () => {
    expect(detectBroker(headers)).toBe("rithmic");
  });

  it("auto-maps pair and pnl fields", () => {
    const m = autoDetectMapping(headers);
    expect(m.pair).toBe("Symbol");
    expect(m.pnl).toBe("Net P&L");
    expect(m.entryPrice).toBe("Buy Fill Price");
  });

  it("parses currency-formatted P&L correctly", () => {
    const m = autoDetectMapping(headers);
    const trade1 = mapRow(rows[0], m);
    const trade2 = mapRow(rows[1], m);

    // "$412.50" → 412.5
    expect(trade1.pnl).toBeCloseTo(412.5);
    expect(trade1.outcome).toBe("Win");

    // "($500.00)" → -500
    expect(trade2.pnl).toBeCloseTo(-500);
    expect(trade2.outcome).toBe("Loss");
  });

  it("detects session from timestamps", () => {
    const m = autoDetectMapping(headers);
    const trade1 = mapRow(rows[0], m);
    const trade3 = mapRow(rows[2], m);

    expect(trade1.session).toBe("NY"); // 09:35
    expect(trade3.session).toBe("NY"); // 13:05
  });
});
