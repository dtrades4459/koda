import { useState } from "react";
import { MONO, BODY } from "./shared";

// ─── CSV PARSING ──────────────────────────────────────────────────────────────
function parseCSV(text: string): { headers: string[], rows: Record<string, string>[] } {
  const lines: string[][] = [];
  let row: string[] = [], cell = "", inQuote = false;
  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    if (inQuote) {
      if (ch === '"' && text[i + 1] === '"') { cell += '"'; i++; }
      else if (ch === '"') inQuote = false;
      else cell += ch;
    } else {
      if (ch === '"') inQuote = true;
      else if (ch === ",") { row.push(cell); cell = ""; }
      else if (ch === "\n" || ch === "\r") {
        if (ch === "\r" && text[i + 1] === "\n") i++;
        row.push(cell); cell = "";
        if (row.some(v => v.trim() !== "")) lines.push(row);
        row = [];
      } else cell += ch;
    }
  }
  if (cell !== "" || row.length) { row.push(cell); if (row.some(v => v.trim() !== "")) lines.push(row); }
  if (!lines.length) return { headers: [], rows: [] };
  const headers = lines[0].map(h => h.trim());
  const rows = lines.slice(1).map(l => Object.fromEntries(headers.map((h, i) => [h, (l[i] ?? "").trim()])));
  return { headers, rows };
}

// ─── FIELD HINTS + AUTO-DETECT ────────────────────────────────────────────────
const CSV_FIELD_HINTS: { field: string; patterns: RegExp[] }[] = [
  { field: "pair",       patterns: [/^(symbol|ticker|pair|instrument|market|contract|asset|stock|coin)s?$/i, /symbol|ticker|pair|instrument/i] },
  { field: "date",       patterns: [/^(open[_\s]*time|close[_\s]*time|execution[_\s]*time|entry[_\s]*date|trade[_\s]*date|date[_\s]*time|timestamp|date|time)$/i, /entry.*date|date.*time|timestamp/i, /date|time/i] },
  { field: "bias",       patterns: [/^(direction|side|action|type|b\/?s|buy[_\s]*sell|position|long[_\s]*\/?[_\s]*short)$/i, /^(direction|side)$/i, /direction|side/i] },
  { field: "outcome",    patterns: [/^(outcome|result|status|win[_\s]*\/?[_\s]*loss|w\/?l)$/i, /outcome|result|status/i] },
  { field: "pnl",        patterns: [/^(p[\s/]?[&/]?l|pnl|profit|profit[_\s]*loss|net[_\s]*p[\s&/]?[&/]?l|realized[_\s]*p[&/]?l|net|realized|gain)$/i, /net.*p.?l|realized.*p.?l/i, /pnl|profit/i, /p.?l/i] },
  { field: "entryPrice", patterns: [/^(entry[_\s]*price|entry|open[_\s]*price|buy[_\s]*price|avg[_\s]*entry|price[_\s]*in|fill[_\s]*price|buy[_\s]*fill[_\s]*price)$/i, /entry.*price|fill.*price/i, /entry|open.*price/i] },
  { field: "exitPrice",  patterns: [/^(exit[_\s]*price|close[_\s]*price|sell[_\s]*price|sell[_\s]*fill[_\s]*price|exit)$/i, /exit.*price|sell.*fill.*price/i] },
  { field: "slPrice",    patterns: [/^(stop[_\s]*loss|stop|sl|s\/l)$/i, /stop.*loss|stop/i] },
  { field: "tpPrice",    patterns: [/^(take[_\s]*profit|target|tp|t\/p|limit)$/i, /target|take.*profit|tp/i] },
  { field: "qty",        patterns: [/^(qty|quantity|size|volume|contracts?|lots?|shares?)$/i, /^(qty|quantity|size)$/i] },
  { field: "rr",         patterns: [/^(r[_\s/:-]*r|risk[_\s]*reward|r[_\s]*multiple|r[_\s]*value)$/i, /risk.*reward|r:?r/i] },
  { field: "notes",      patterns: [/^(note|notes|comment|comments|description|memo)$/i, /note|comment|memo/i] },
  { field: "session",    patterns: [/^(session|market[_\s]*session)$/i, /session/i] },
];

function autoDetectMapping(headers: string[]): Record<string, string> {
  const m: Record<string, string> = {};
  const used = new Set<string>();
  for (const { field, patterns } of CSV_FIELD_HINTS) {
    for (const pat of patterns) {
      const hit = headers.find(h => !used.has(h) && pat.test(h));
      if (hit) { m[field] = hit; used.add(hit); break; }
    }
  }
  return m;
}

// ─── BROKER AUTO-DETECTION ────────────────────────────────────────────────────
function detectBroker(headers: string[]): string | null {
  const h = new Set(headers.map(s => s.toLowerCase().trim()));
  const has = (patterns: RegExp[]) => headers.some(col => patterns.some(p => p.test(col)));
  // NinjaTrader 8 — "Instrument" + "Entry time" / "Entry price" + "Direction"
  if (h.has("instrument") && (h.has("entry time") || h.has("entry price")) && h.has("direction")) return "ninjatrader8";
  if (h.has("instrument") && h.has("entry time") && (h.has("profit") || h.has("net profit"))) return "ninjatrader8";
  // TopstepX — "Instrument" + "Entry Date" + "Side" + "Net P&L"
  if (h.has("instrument") && h.has("entry date") && (h.has("side") || h.has("net p&l"))) return "topstepx";
  // FTMO / MT5 — "Open Time" + "Close Price" + "Volume" + "Symbol" (Close Price distinguishes from MT4)
  if ((h.has("open time") || h.has("open_time")) && (h.has("close price") || h.has("stop loss")) && h.has("volume")) return "ftmo_mt5";
  // Rithmic
  if (has([/net.*p.?l/i, /buy.*fill.*price/i, /sell.*fill.*price/i])) return "rithmic";
  if (h.has("net p&l") || h.has("buy fill price") || h.has("buy fill time")) return "rithmic";
  // Tradovate
  if ((h.has("b/s") || h.has("buy time")) && (h.has("p&l") || h.has("p / l"))) return "tradovate";
  // TradingView
  if (h.has("profit") && (h.has("date/time") || h.has("datetime")) && h.has("type")) return "tradingview";
  // MT4 (fallback — "S / L" or "Stop Loss" without Close Price)
  if ((h.has("open time") || h.has("open_time")) && (h.has("s / l") || h.has("stop loss"))) return "mt4";
  return null;
}

// ─── SESSION AUTO-TAGGING ─────────────────────────────────────────────────────
// Detects NY / London / Asia from a raw datetime string.
// Time zones: if no tz info we treat the hour as ET (most futures platforms use local or ET).
// NY open = 09:30-16:00 ET, London open = 03:00-08:30 ET, Asia = 20:00-02:00 ET.
function detectSessionFromDateStr(raw: string): string {
  if (!raw) return "";
  // Extract time component: matches "09:30", "09:30:00", "9:30 AM", with optional UTC/Z offset
  const m = raw.match(/[T\s](\d{1,2}):(\d{2})(?::\d{2})?(?:\s*(AM|PM))?(?:\s*([+-]\d{2}:?\d{2}|UTC|Z))?/i);
  if (!m) return "";
  let hour = parseInt(m[1], 10);
  const min = parseInt(m[2], 10);
  const ampm = (m[3] || "").toUpperCase();
  const tz = (m[4] || "").toUpperCase();

  if (ampm === "PM" && hour !== 12) hour += 12;
  if (ampm === "AM" && hour === 12) hour = 0;

  // Adjust UTC -> ET (EDT = UTC-4; approximate — good enough for session labelling)
  if (tz === "Z" || tz === "UTC" || tz === "+00:00") hour = (hour - 4 + 24) % 24;

  const t = hour * 60 + min; // minutes since midnight ET
  if (t >= 570 && t < 960)  return "NY";      // 09:30-16:00
  if (t >= 180 && t < 510)  return "London";  // 03:00-08:30
  if (t >= 1200 || t < 120) return "Asia";    // 20:00-02:00
  return "";
}

// ─── NORMALISE HELPERS ────────────────────────────────────────────────────────
function normalizeBias(raw: string): string {
  const v = raw.toLowerCase();
  if (/long|buy|bull/.test(v)) return "Bullish";
  if (/short|sell|bear/.test(v)) return "Bearish";
  return "";
}

function normalizeOutcome(raw: string, pnl: number): string {
  const v = (raw || "").toLowerCase();
  if (/win|profit|tp[_\s]*hit|target/.test(v)) return "Win";
  if (/loss|lose|sl[_\s]*hit|stop/.test(v)) return "Loss";
  if (/break[_\s]*even|be|flat/.test(v)) return "Breakeven";
  if (pnl > 0) return "Win";
  if (pnl < 0) return "Loss";
  if (raw || !isNaN(pnl)) return "Breakeven";
  return "";
}

function parseNum(s: string): number {
  if (!s) return NaN;
  const n = s.replace(/[^0-9.\-()]/g, "").replace(/\((.*)\)/, "-$1");
  return parseFloat(n);
}

function normalizeDate(s: string): string {
  if (!s) return new Date().toISOString().split("T")[0];
  const iso = s.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (iso) return `${iso[1]}-${iso[2]}-${iso[3]}`;
  const slash = s.match(/^(\d{1,2})[/.](\d{1,2})[/.](\d{2,4})/);
  if (slash) {
    const [, a, b] = slash;
    let y = slash[3];
    if (y.length === 2) y = "20" + y;
    const aN = parseInt(a), bN = parseInt(b);
    const mm = aN > 12 ? bN : aN;
    const dd = aN > 12 ? aN : bN;
    return `${y}-${String(mm).padStart(2, "0")}-${String(dd).padStart(2, "0")}`;
  }
  const d = new Date(s);
  if (!isNaN(d.getTime())) return d.toISOString().split("T")[0];
  return new Date().toISOString().split("T")[0];
}

function calcRR(e: any, s: any, t: any): string {
  const ev = parseFloat(e), sv = parseFloat(s), tv = parseFloat(t);
  if (isNaN(ev) || isNaN(sv) || isNaN(tv)) return "";
  const risk = Math.abs(ev - sv);
  if (risk === 0) return "";
  const reward = Math.abs(tv - ev);
  const rr = reward / risk;
  if (!isFinite(rr) || rr > 100) return "";
  return rr.toFixed(2);
}

function _djb2(s: string): string {
  let h = 5381;
  for (let i = 0; i < s.length; i++) h = ((h << 5) + h) ^ s.charCodeAt(i);
  return (h >>> 0).toString(36);
}

function tradeKey(t: any): string {
  const content = [t.date ?? "", (t.pair ?? "").toUpperCase(), t.entryPrice ?? "", t.slPrice ?? "", t.tpPrice ?? "", t.pnl ?? "", t.session ?? ""].join("|");
  return _djb2(content);
}

function rowToTrade(row: Record<string, string>, mapping: Record<string, string>, defaultStrategy: string) {
  const get = (f: string) => mapping[f] ? row[mapping[f]] : "";
  const rawDate = get("date");
  const pnl = parseNum(get("pnl"));
  const qty = get("qty") ? parseNum(get("qty")) : NaN;
  // Session: prefer mapped column, fall back to auto-detection from timestamp
  const session = get("session") || detectSessionFromDateStr(rawDate);
  const trade: any = {
    id: Date.now() * 1000 + Math.floor(Math.random() * 999),
    date: normalizeDate(rawDate),
    pair: (get("pair") || "").toUpperCase(),
    session,
    bias: normalizeBias(get("bias")),
    strategy: defaultStrategy || "",
    setup: "",
    entryPrice: get("entryPrice"),
    exitPrice: get("exitPrice"),
    slPrice: get("slPrice"),
    tpPrice: get("tpPrice"),
    qty: isNaN(qty) ? "" : String(qty),
    rr: get("rr") || (get("entryPrice") && get("slPrice") && get("tpPrice") ? calcRR(get("entryPrice"), get("slPrice"), get("tpPrice")) : ""),
    outcome: normalizeOutcome(get("outcome"), pnl),
    pnl: isNaN(pnl) ? "" : pnl.toFixed(2),
    notes: get("notes"),
    emotions: "",
    screenshot: "",
    comments: [],
    reactions: {},
  };
  return trade;
}

// ─── ANALYTICS ────────────────────────────────────────────────────────────────
interface ImportStats {
  tradeCount: number;
  withPnl: number;
  totalPnl: number | null;
  winRate: number | null;
  profitFactor: number | null;
  avgRR: number | null;
  best: number | null;
  worst: number | null;
  sessionBreakdown: Record<string, number>;
}

function computeImportStats(trades: any[]): ImportStats {
  const withPnl = trades.filter(t => t.pnl !== "" && !isNaN(parseFloat(t.pnl)));
  const totalPnl = withPnl.length ? withPnl.reduce((s, t) => s + parseFloat(t.pnl), 0) : null;
  const wins = withPnl.filter(t => parseFloat(t.pnl) > 0);
  const losses = withPnl.filter(t => parseFloat(t.pnl) < 0);
  const winRate = withPnl.length ? (wins.length / withPnl.length) * 100 : null;
  const grossWin = wins.reduce((s, t) => s + parseFloat(t.pnl), 0);
  const grossLoss = Math.abs(losses.reduce((s, t) => s + parseFloat(t.pnl), 0));
  const profitFactor = grossLoss > 0 ? grossWin / grossLoss : null;
  const withRR = trades.filter(t => t.rr && !isNaN(parseFloat(t.rr)));
  const avgRR = withRR.length ? withRR.reduce((s, t) => s + parseFloat(t.rr), 0) / withRR.length : null;
  const pnls = withPnl.map(t => parseFloat(t.pnl));
  const best = pnls.length ? Math.max(...pnls) : null;
  const worst = pnls.length ? Math.min(...pnls) : null;
  const sessionBreakdown: Record<string, number> = {};
  for (const t of trades) {
    if (t.session) sessionBreakdown[t.session] = (sessionBreakdown[t.session] || 0) + 1;
  }
  return { tradeCount: trades.length, withPnl: withPnl.length, totalPnl, winRate, profitFactor, avgRR, best, worst, sessionBreakdown };
}

// ─── IMPORT TEMPLATES (localStorage) ─────────────────────────────────────────
const TPL_KEY = "tradr_csv_templates";
interface ImportTemplate {
  label: string;
  broker: string | null;
  mapping: Record<string, string>;
  strategy: string;
}

function loadTemplates(): Record<string, ImportTemplate> {
  try { return JSON.parse(localStorage.getItem(TPL_KEY) || "{}"); } catch { return {}; }
}
function persistTemplate(name: string, tpl: ImportTemplate) {
  const all = loadTemplates();
  all[name] = tpl;
  localStorage.setItem(TPL_KEY, JSON.stringify(all));
}
function removeTemplate(name: string) {
  const all = loadTemplates();
  delete all[name];
  localStorage.setItem(TPL_KEY, JSON.stringify(all));
}

// ─── CSV PRESETS ──────────────────────────────────────────────────────────────
const CSV_PRESETS: Record<string, { label: string; hint: string; mapping: Record<string, string>; fallbacks?: Record<string, string[]> }> = {
  tradovate: {
    label: "Tradovate",
    hint: "Tradovate account statement CSV (Account -> Statements -> Trade History)",
    mapping: { pair: "Symbol", date: "Buy Time", bias: "B/S", pnl: "P&L", entryPrice: "Buy Price", notes: "Account" },
  },
  rithmic: {
    label: "Rithmic",
    hint: "Apex / TopstepX / Earn2Trade prop firm CSV (Rithmic Trade Route statement)",
    mapping: { pair: "Symbol", date: "Entry Date/Time", bias: "Buy/Sell", pnl: "Net P&L", entryPrice: "Buy Fill Price", exitPrice: "Sell Fill Price", qty: "Qty", notes: "Account" },
    fallbacks: {
      date:       ["Date", "Entry Time", "Trade Date"],
      bias:       ["Side", "B/S", "Direction"],
      entryPrice: ["Fill Price", "Entry Price", "Price"],
      exitPrice:  ["Exit Price", "Close Price"],
      qty:        ["Quantity", "Size", "Contracts"],
    },
  },
  tradingview: {
    label: "TradingView",
    hint: "TradingView Trade List export (Strategy Tester -> List of Trades -> Export)",
    mapping: { pair: "Symbol", date: "Date/Time", bias: "Type", pnl: "Profit", entryPrice: "Price", rr: "Run-up" },
  },
  mt4: {
    label: "MT4 / MT5",
    hint: "MetaTrader account history export",
    mapping: { pair: "Symbol", date: "Open Time", bias: "Type", pnl: "Profit", entryPrice: "Open Price", slPrice: "S / L", tpPrice: "T / P", notes: "Comment" },
  },
  ninjatrader8: {
    label: "NinjaTrader 8",
    hint: "NinjaTrader 8 Trade Performance export (Account Performance Report → Export → CSV)",
    mapping: {
      pair:       "Instrument",
      date:       "Entry time",
      bias:       "Direction",
      pnl:        "Profit",
      entryPrice: "Entry price",
      exitPrice:  "Exit price",
      qty:        "Qty",
      notes:      "Entry name",
    },
    fallbacks: {
      pair:       ["Market", "Symbol"],
      date:       ["Entry Time", "Entry Date", "Time"],
      bias:       ["Action", "Side", "Type"],
      pnl:        ["Net profit", "Net Profit", "P&L"],
      entryPrice: ["Entry Price", "Open Price"],
      exitPrice:  ["Exit Price", "Close Price"],
      qty:        ["Quantity", "Size", "Contracts"],
      notes:      ["Exit name", "Comment", "Setup"],
    },
  },
  topstepx: {
    label: "TopstepX",
    hint: "TopstepX Combine or Funded account trade history CSV export",
    mapping: {
      pair:       "Instrument",
      date:       "Entry Date",
      bias:       "Side",
      pnl:        "Net P&L",
      entryPrice: "Entry Price",
      exitPrice:  "Exit Price",
      qty:        "Size",
    },
    fallbacks: {
      pair:       ["Symbol", "Market", "Contract"],
      date:       ["Entry DateTime", "Entry Time", "Open Time", "Date"],
      bias:       ["Direction", "Type", "Buy/Sell"],
      pnl:        ["P&L", "Profit", "Net Profit", "Gain/Loss"],
      entryPrice: ["Open Price", "Fill Price", "Buy Fill Price"],
      exitPrice:  ["Close Price", "Sell Fill Price"],
      qty:        ["Quantity", "Contracts", "Volume", "Lots"],
    },
  },
  ftmo_mt5: {
    label: "FTMO / MT5",
    hint: "FTMO or any MT5 broker — Account History → Save as Report → open in Excel → save as CSV",
    mapping: {
      pair:       "Symbol",
      date:       "Open Time",
      bias:       "Type",
      pnl:        "Profit",
      entryPrice: "Open Price",
      exitPrice:  "Close Price",
      slPrice:    "Stop Loss",
      tpPrice:    "Take Profit",
      qty:        "Volume",
      notes:      "Comment",
    },
    fallbacks: {
      date:       ["Time", "Open time", "Entry Time", "Open_Time"],
      bias:       ["Direction", "Side", "Action"],
      pnl:        ["Net Profit", "P&L", "Gain"],
      entryPrice: ["Price", "Entry Price"],
      exitPrice:  ["Close Price", "Exit Price"],
      slPrice:    ["S / L", "SL", "S/L"],
      tpPrice:    ["T / P", "TP", "T/P"],
      qty:        ["Lots", "Size", "Contracts", "Lot"],
      notes:      ["comment", "Memo"],
    },
  },
};

// ─── COMPONENT ────────────────────────────────────────────────────────────────
export function CsvImportPanel({ existingTrades, onImport, onClose, allStrategyNames, C, inp, sel, lbl }: any) {
  const [fileName, setFileName] = useState("");
  const [headers, setHeaders] = useState<string[]>([]);
  const [rows, setRows] = useState<Record<string, string>[]>([]);
  const [mapping, setMapping] = useState<Record<string, string>>({});
  const [defaultStrategy, setDefaultStrategy] = useState("");
  const [error, setError] = useState("");
  const [activePreset, setActivePreset] = useState<string | null>(null);
  // Analytics reveal
  const [revealStats, setRevealStats] = useState<ImportStats | null>(null);
  const [revealTrades, setRevealTrades] = useState<any[]>([]);
  // Templates
  const [templates, setTemplates] = useState<Record<string, ImportTemplate>>(() => loadTemplates());
  const [saveTemplateName, setSaveTemplateName] = useState("");
  const [showSaveTemplate, setShowSaveTemplate] = useState(false);

  function refreshTemplates() { setTemplates(loadTemplates()); }

  function applyPreset(presetKey: string) {
    const preset = CSV_PRESETS[presetKey];
    if (!preset) return;
    const resolved: Record<string, string> = {};
    for (const [field, col] of Object.entries(preset.mapping)) {
      let hit = headers.find(h => h.toLowerCase() === col.toLowerCase());
      const fbs = (preset as any).fallbacks?.[field] as string[] | undefined;
      if (!hit && fbs) {
        for (const fb of fbs) { hit = headers.find(h => h.toLowerCase() === fb.toLowerCase()); if (hit) break; }
      }
      if (hit) resolved[field] = hit;
    }
    setMapping(prev => ({ ...prev, ...resolved }));
    setActivePreset(presetKey);
  }

  function applyTemplate(name: string) {
    const tpl = templates[name];
    if (!tpl) return;
    setMapping(tpl.mapping);
    setDefaultStrategy(tpl.strategy);
    if (tpl.broker) setActivePreset(tpl.broker);
  }

  function handleSaveTemplate() {
    const name = saveTemplateName.trim();
    if (!name) return;
    const tpl: ImportTemplate = { label: name, broker: activePreset, mapping, strategy: defaultStrategy };
    persistTemplate(name, tpl);
    refreshTemplates();
    setSaveTemplateName("");
    setShowSaveTemplate(false);
  }

  function handleDeleteTemplate(name: string) {
    removeTemplate(name);
    refreshTemplates();
  }

  function handleFile(e: any) {
    const file = e.target.files?.[0];
    if (!file) return;
    setFileName(file.name);
    setActivePreset(null);
    const reader = new FileReader();
    reader.onload = () => {
      try {
        const text = String(reader.result);
        const { headers: h, rows: r } = parseCSV(text);
        if (!h.length || !r.length) { setError("CSV looks empty. Double-check the file."); return; }
        setHeaders(h);
        setRows(r);
        const autoMap = autoDetectMapping(h);
        const broker = detectBroker(h);
        if (broker) {
          const preset = CSV_PRESETS[broker];
          const presetMap: Record<string, string> = {};
          for (const [field, col] of Object.entries(preset.mapping)) {
            let hit = h.find(hh => hh.toLowerCase() === col.toLowerCase());
            const fbs = (preset as any).fallbacks?.[field] as string[] | undefined;
            if (!hit && fbs) {
              for (const fb of fbs) { hit = h.find(hh => hh.toLowerCase() === fb.toLowerCase()); if (hit) break; }
            }
            if (hit) presetMap[field] = hit;
          }
          setMapping({ ...autoMap, ...presetMap });
          setActivePreset(broker);
        } else {
          setMapping(autoMap);
        }
        setError("");
      } catch (err: any) { setError("Couldn't parse CSV: " + (err?.message || "unknown error")); }
    };
    reader.readAsText(file);
  }

  const fields = [
    { key: "date",       label: "Date",           required: true },
    { key: "pair",       label: "Pair / Symbol",   required: true },
    { key: "outcome",    label: "Outcome",          required: false },
    { key: "pnl",        label: "P&L",              required: false },
    { key: "entryPrice", label: "Entry price",      required: false },
    { key: "exitPrice",  label: "Exit price",       required: false },
    { key: "qty",        label: "Qty / Contracts",  required: false },
    { key: "slPrice",    label: "Stop loss",        required: false },
    { key: "tpPrice",    label: "Take profit",      required: false },
    { key: "rr",         label: "R:R",              required: false },
    { key: "bias",       label: "Direction / side", required: false },
    { key: "session",    label: "Session",          required: false },
    { key: "notes",      label: "Notes",            required: false },
  ];

  const existingKeys = new Set(existingTrades.map(tradeKey));
  const previewTrades = rows.map(r => rowToTrade(r, mapping, defaultStrategy));
  const uniquePreview = previewTrades.filter(t => !existingKeys.has(tradeKey(t)));
  const dupCount = previewTrades.length - uniquePreview.length;
  const canImport = !!mapping.date && !!mapping.pair && uniquePreview.length > 0;

  function doImport() {
    if (!canImport) return;
    // Show analytics reveal before committing
    setRevealStats(computeImportStats(uniquePreview));
    setRevealTrades(uniquePreview);
  }

  function confirmImport() {
    onImport(revealTrades);
    setRevealStats(null);
    setRevealTrades([]);
  }

  function cancelReveal() {
    setRevealStats(null);
    setRevealTrades([]);
  }

  const pnlColor = (v: number | null) => v === null ? C.muted : v >= 0 ? C.green : C.red;
  const fmt$ = (v: number | null) => v === null ? "--" : `${v >= 0 ? "+" : ""}$${Math.abs(v).toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
  const fmtPct = (v: number | null) => v === null ? "--" : `${v.toFixed(1)}%`;
  const fmtR = (v: number | null) => v === null ? "--" : `${v.toFixed(2)}R`;

  // ── Analytics Reveal Modal ──────────────────────────────────────────────────
  if (revealStats) {
    const s = revealStats;
    const sessionEntries = Object.entries(s.sessionBreakdown).sort((a, b) => b[1] - a[1]);
    const sessionAutoTagged = revealTrades.filter(t => t.session).length;
    return (
      <div style={{ border: `1px solid ${C.border2}`, borderRadius: "14px", padding: "24px", background: C.panel, display: "flex", flexDirection: "column", gap: "20px", marginBottom: "20px" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <div style={{ fontFamily: MONO, fontSize: "11px", color: C.muted, letterSpacing: "0.12em", textTransform: "uppercase" }}>Import preview</div>
          <button onClick={cancelReveal} style={{ background: "none", border: "none", color: C.muted, cursor: "pointer", fontFamily: MONO, fontSize: "14px" }}>x</button>
        </div>

        <div style={{ textAlign: "center" }}>
          <div style={{ fontFamily: MONO, fontSize: "28px", fontWeight: 700, color: C.text, letterSpacing: "-0.02em" }}>{s.tradeCount}</div>
          <div style={{ fontFamily: MONO, fontSize: "10px", color: C.muted, letterSpacing: "0.1em", textTransform: "uppercase", marginTop: "2px" }}>trades ready to import</div>
        </div>

        {/* Stats grid */}
        {s.withPnl > 0 && (
          <div style={{ display: "grid", gridTemplateColumns: "repeat(2, 1fr)", gap: "10px" }}>
            {[
              { label: "Total P&L",      value: fmt$(s.totalPnl),      color: pnlColor(s.totalPnl) },
              { label: "Win Rate",       value: fmtPct(s.winRate),     color: s.winRate !== null && s.winRate >= 50 ? C.green : C.red },
              { label: "Profit Factor",  value: s.profitFactor !== null ? s.profitFactor.toFixed(2) : "--", color: s.profitFactor !== null && s.profitFactor >= 1 ? C.green : C.red },
              { label: "Avg R:R",        value: fmtR(s.avgRR),         color: C.text },
            ].map(({ label, value, color }) => (
              <div key={label} style={{ background: C.bg, border: `1px solid ${C.border}`, borderRadius: "10px", padding: "14px 16px" }}>
                <div style={{ fontFamily: MONO, fontSize: "9px", color: C.muted, letterSpacing: "0.1em", textTransform: "uppercase", marginBottom: "6px" }}>{label}</div>
                <div style={{ fontFamily: MONO, fontSize: "20px", fontWeight: 700, color, letterSpacing: "-0.01em" }}>{value}</div>
              </div>
            ))}
          </div>
        )}

        {/* Best / worst */}
        {s.best !== null && (
          <div style={{ display: "flex", gap: "10px" }}>
            <div style={{ flex: 1, background: C.bg, border: `1px solid ${C.border}`, borderRadius: "10px", padding: "12px 14px" }}>
              <div style={{ fontFamily: MONO, fontSize: "9px", color: C.muted, letterSpacing: "0.1em", textTransform: "uppercase", marginBottom: "4px" }}>Best trade</div>
              <div style={{ fontFamily: MONO, fontSize: "16px", fontWeight: 700, color: C.green }}>{fmt$(s.best)}</div>
            </div>
            <div style={{ flex: 1, background: C.bg, border: `1px solid ${C.border}`, borderRadius: "10px", padding: "12px 14px" }}>
              <div style={{ fontFamily: MONO, fontSize: "9px", color: C.muted, letterSpacing: "0.1em", textTransform: "uppercase", marginBottom: "4px" }}>Worst trade</div>
              <div style={{ fontFamily: MONO, fontSize: "16px", fontWeight: 700, color: C.red }}>{fmt$(s.worst)}</div>
            </div>
          </div>
        )}

        {/* Session breakdown */}
        {sessionEntries.length > 0 && (
          <div>
            <div style={{ fontFamily: MONO, fontSize: "9px", color: C.muted, letterSpacing: "0.1em", textTransform: "uppercase", marginBottom: "8px" }}>
              Session breakdown
              {sessionAutoTagged > 0 && <span style={{ color: C.muted, fontWeight: 400 }}> — {sessionAutoTagged} auto-tagged from timestamp</span>}
            </div>
            <div style={{ display: "flex", gap: "8px", flexWrap: "wrap" }}>
              {sessionEntries.map(([sess, count]) => (
                <div key={sess} style={{ padding: "6px 12px", border: `1px solid ${C.border2}`, borderRadius: "999px", fontFamily: MONO, fontSize: "10px", color: C.text, display: "flex", gap: "6px", alignItems: "center" }}>
                  <span>{sess}</span>
                  <span style={{ color: C.muted }}>{count}</span>
                </div>
              ))}
            </div>
          </div>
        )}

        <div style={{ display: "flex", gap: "10px", justifyContent: "flex-end" }}>
          <button onClick={cancelReveal} style={{ background: "transparent", border: `1px solid ${C.border2}`, borderRadius: "999px", padding: "10px 18px", cursor: "pointer", fontFamily: MONO, fontSize: "11px", letterSpacing: "0.08em", textTransform: "uppercase", color: C.muted }}>Go back</button>
          <button onClick={confirmImport} style={{ background: C.text, color: C.bg, border: "none", borderRadius: "999px", padding: "10px 22px", cursor: "pointer", fontFamily: MONO, fontSize: "11px", letterSpacing: "0.08em", textTransform: "uppercase", fontWeight: 600 }}>
            Confirm import
          </button>
        </div>
      </div>
    );
  }

  // ── Main panel ──────────────────────────────────────────────────────────────
  return (
    <div style={{ border: `1px solid ${C.border2}`, borderRadius: "14px", padding: "20px", background: C.panel, display: "flex", flexDirection: "column", gap: "18px", marginBottom: "20px" }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: "12px" }}>
        <div style={{ fontFamily: MONO, fontSize: "11px", color: C.muted, letterSpacing: "0.12em", textTransform: "uppercase" }}>Import CSV</div>
        <button onClick={onClose} style={{ background: "none", border: "none", color: C.muted, cursor: "pointer", fontFamily: MONO, fontSize: "14px" }}>x</button>
      </div>

      {/* Saved templates */}
      {Object.keys(templates).length > 0 && (
        <div>
          <div style={{ fontFamily: MONO, fontSize: "10px", color: C.muted, letterSpacing: "0.08em", textTransform: "uppercase", marginBottom: "8px" }}>Saved templates</div>
          <div style={{ display: "flex", gap: "8px", flexWrap: "wrap" }}>
            {Object.entries(templates).map(([name]) => (
              <div key={name} style={{ display: "flex", alignItems: "center", gap: "0px", border: `1px solid ${C.border2}`, borderRadius: "999px", overflow: "hidden" }}>
                <button onClick={() => applyTemplate(name)}
                  style={{ padding: "6px 12px 6px 14px", background: "transparent", border: "none", color: C.text, cursor: "pointer", fontFamily: MONO, fontSize: "10px", letterSpacing: "0.06em" }}>
                  {name}
                </button>
                <button onClick={() => handleDeleteTemplate(name)}
                  style={{ padding: "6px 10px 6px 4px", background: "transparent", border: "none", color: C.muted, cursor: "pointer", fontFamily: MONO, fontSize: "11px", lineHeight: 1 }}>
                  x
                </button>
              </div>
            ))}
          </div>
        </div>
      )}

      {!headers.length && (
        <div>
          <label htmlFor="csv-file" style={{ display: "block", border: `1px dashed ${C.border2}`, padding: "28px 16px", borderRadius: "10px", cursor: "pointer", textAlign: "center", color: C.muted, fontFamily: MONO, fontSize: "11px", letterSpacing: "0.1em", textTransform: "uppercase" }}>
            {fileName || "Click to select a CSV file"}
            <input id="csv-file" type="file" accept=".csv,text/csv" onChange={handleFile} style={{ display: "none" }} />
          </label>
          <div style={{ fontFamily: BODY, fontSize: "12px", color: C.muted, marginTop: "10px", lineHeight: 1.5 }}>
            Works with Rithmic (Apex, TopstepX, Earn2Trade), MT4/MT5, TradingView, ThinkorSwim, and most crypto exchange CSVs. Load your file, then pick a broker preset or map columns manually.
          </div>
        </div>
      )}

      {error && <div style={{ fontFamily: BODY, fontSize: "12px", color: C.red }}>{error}</div>}

      {headers.length > 0 && (
        <>
          <div style={{ fontFamily: BODY, fontSize: "12px", color: C.muted }}>
            <span style={{ color: C.text }}>{fileName}</span> — {rows.length} row{rows.length === 1 ? "" : "s"} detected.
            {activePreset && <span style={{ color: C.muted, marginLeft: "8px" }}>Auto-detected: <span style={{ color: C.text }}>{CSV_PRESETS[activePreset]?.label}</span></span>}
          </div>

          {/* Broker presets */}
          <div>
            <div style={{ fontFamily: MONO, fontSize: "10px", color: C.muted, letterSpacing: "0.08em", textTransform: "uppercase", marginBottom: "8px" }}>
              Broker preset <span style={{ color: C.dim, fontWeight: 400 }}>(optional — snaps column mapping)</span>
            </div>
            <div style={{ display: "flex", gap: "8px", flexWrap: "wrap" }}>
              {Object.entries(CSV_PRESETS).map(([key, preset]) => (
                <button key={key} onClick={() => applyPreset(key)}
                  title={preset.hint}
                  style={{ padding: "7px 14px", border: `1px solid ${activePreset === key ? C.text : C.border2}`, borderRadius: "999px", background: activePreset === key ? C.text : "transparent", color: activePreset === key ? C.bg : C.muted, cursor: "pointer", fontFamily: MONO, fontSize: "10px", letterSpacing: "0.08em", textTransform: "uppercase", transition: "all 0.15s" }}>
                  {preset.label}
                </button>
              ))}
            </div>
            {activePreset && (
              <div style={{ fontFamily: BODY, fontSize: "11px", color: C.muted, marginTop: "6px", lineHeight: 1.4 }}>
                {CSV_PRESETS[activePreset].hint}. Unmapped fields will use auto-detection.
              </div>
            )}
          </div>

          <div>
            <label style={lbl}>Column mapping</label>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(140px, 1fr))", gap: "10px 14px", marginTop: "8px" }}>
              {fields.map(f => (
                <div key={f.key}>
                  <div style={{ fontFamily: MONO, fontSize: "10px", color: C.muted, letterSpacing: "0.08em", textTransform: "uppercase", marginBottom: "2px" }}>
                    {f.label}{f.required && <span style={{ color: C.red, marginLeft: "4px" }}>*</span>}
                  </div>
                  <select value={mapping[f.key] || ""} onChange={e => setMapping((m: any) => ({ ...m, [f.key]: e.target.value }))} style={sel}>
                    <option value="">-- skip --</option>
                    {headers.map(h => <option key={h} value={h}>{h}</option>)}
                  </select>
                </div>
              ))}
            </div>
          </div>

          <div>
            <label style={lbl}>Default strategy (applied to every row)</label>
            <select value={defaultStrategy} onChange={e => setDefaultStrategy(e.target.value)} style={sel}>
              <option value="">-- none --</option>
              {allStrategyNames.map((s: string) => <option key={s} value={s}>{s}</option>)}
            </select>
          </div>

          {/* Preview table */}
          <div>
            <label style={lbl}>Preview (first 5 rows)</label>
            <div style={{ border: `1px solid ${C.border}`, borderRadius: "10px", overflow: "auto", marginTop: "8px" }}>
              <table style={{ width: "100%", borderCollapse: "collapse", fontFamily: MONO, fontSize: "11px" }}>
                <thead>
                  <tr style={{ background: C.panel2 }}>
                    {["Date", "Pair", "Bias", "Session", "Outcome", "P&L", "R:R"].map(h => (
                      <th key={h} style={{ textAlign: "left", padding: "8px 10px", color: C.muted, letterSpacing: "0.08em", fontWeight: 500, borderBottom: `1px solid ${C.border}` }}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {previewTrades.slice(0, 5).map((t: any, i: number) => {
                    const dup = existingKeys.has(tradeKey(t));
                    return (
                      <tr key={i} style={{ opacity: dup ? 0.5 : 1 }}>
                        <td style={{ padding: "8px 10px", color: C.text,  borderBottom: `1px solid ${C.border}` }}>{t.date}</td>
                        <td style={{ padding: "8px 10px", color: C.text,  borderBottom: `1px solid ${C.border}` }}>{t.pair || "--"}</td>
                        <td style={{ padding: "8px 10px", color: C.text2, borderBottom: `1px solid ${C.border}` }}>{t.bias || "--"}</td>
                        <td style={{ padding: "8px 10px", color: t.session ? C.text2 : C.muted, borderBottom: `1px solid ${C.border}`, fontSize: "10px" }}>{t.session || "--"}</td>
                        <td style={{ padding: "8px 10px", color: t.outcome === "Win" ? C.green : t.outcome === "Loss" ? C.red : C.text2, borderBottom: `1px solid ${C.border}` }}>{t.outcome || "--"}</td>
                        <td style={{ padding: "8px 10px", color: C.text2, borderBottom: `1px solid ${C.border}` }}>{t.pnl || "--"}</td>
                        <td style={{ padding: "8px 10px", color: C.text2, borderBottom: `1px solid ${C.border}` }}>{t.rr || "--"}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
            {dupCount > 0 && (
              <div style={{ fontFamily: MONO, fontSize: "10px", color: C.muted, letterSpacing: "0.08em", textTransform: "uppercase", marginTop: "8px" }}>
                {dupCount} duplicate{dupCount === 1 ? "" : "s"} will be skipped.
              </div>
            )}
          </div>

          {/* Save template */}
          <div>
            {showSaveTemplate ? (
              <div style={{ display: "flex", gap: "8px", alignItems: "center" }}>
                <input value={saveTemplateName} onChange={e => setSaveTemplateName(e.target.value)}
                  placeholder="Template name..."
                  onKeyDown={e => { if (e.key === "Enter") handleSaveTemplate(); if (e.key === "Escape") setShowSaveTemplate(false); }}
                  style={{ ...inp, flex: 1, fontSize: "12px" }} />
                <button onClick={handleSaveTemplate} disabled={!saveTemplateName.trim()}
                  style={{ padding: "8px 14px", border: "none", borderRadius: "999px", background: saveTemplateName.trim() ? C.text : C.border2, color: saveTemplateName.trim() ? C.bg : C.muted, cursor: saveTemplateName.trim() ? "pointer" : "not-allowed", fontFamily: MONO, fontSize: "10px", letterSpacing: "0.08em", textTransform: "uppercase" }}>
                  Save
                </button>
                <button onClick={() => setShowSaveTemplate(false)}
                  style={{ padding: "8px 14px", border: `1px solid ${C.border2}`, borderRadius: "999px", background: "transparent", color: C.muted, cursor: "pointer", fontFamily: MONO, fontSize: "10px", letterSpacing: "0.08em", textTransform: "uppercase" }}>
                  Cancel
                </button>
              </div>
            ) : (
              <button onClick={() => setShowSaveTemplate(true)}
                style={{ padding: "7px 14px", border: `1px solid ${C.border2}`, borderRadius: "999px", background: "transparent", color: C.muted, cursor: "pointer", fontFamily: MONO, fontSize: "10px", letterSpacing: "0.08em", textTransform: "uppercase" }}>
                + Save as template
              </button>
            )}
          </div>

          <div style={{ display: "flex", gap: "10px", justifyContent: "flex-end" }}>
            <button onClick={onClose} style={{ background: "transparent", border: `1px solid ${C.border2}`, borderRadius: "999px", padding: "10px 18px", cursor: "pointer", fontFamily: MONO, fontSize: "11px", letterSpacing: "0.08em", textTransform: "uppercase", color: C.muted }}>Cancel</button>
            <button onClick={doImport} disabled={!canImport} style={{ background: canImport ? C.text : C.border2, color: canImport ? C.bg : C.muted, border: "none", borderRadius: "999px", padding: "10px 18px", cursor: canImport ? "pointer" : "not-allowed", fontFamily: MONO, fontSize: "11px", letterSpacing: "0.08em", textTransform: "uppercase" }}>
              Import {uniquePreview.length} trade{uniquePreview.length === 1 ? "" : "s"}
            </button>
          </div>
        </>
      )}
    </div>
  );
}
