# CSV Import Audit — Kōda

Scope: end-to-end audit of the CSV/Excel import flow for the Kōda trading journal. Target user is a prop-firm futures trader on Apex/Tradovate/Rithmic/NinjaTrader, importing NQ/ES history into a journal with multiple accounts.

Code under review:
- `src/CsvImportPanel.tsx` — UI + per-row mapping (793 lines)
- `src/lib/csvParser.ts` — tokenizer, broker detection, normalizers, dedup key, point-value table (373 lines)
- `src/DataSourcesScreen.tsx` — Sync tab entry point (~660 lines)
- `src/Koda.tsx` — `handleCsvImport()` at L835, `saveTrades()` at L698
- `src/lib/__fixtures__/*.csv` — 7 broker fixtures
- `src/lib/csvParser.test.ts` + `csvParser.integration.test.ts` — unit + integration tests

This is the activation moment for the product. **Several of the issues below cause silent data corruption (wrong sign on P&L for short trades, wrong root symbol for forex, double-counting if the CSV already includes commissions and the user enters them again later), and the duplicate-detection scheme is fragile by design.** Detail below.

---

## 1. Critical risks (silent data corruption / wrong P&L / duplicate trades)

| # | Risk | File · Line | Why it matters |
|---|------|-------------|----------------|
| C1 | **`computePnlDollar` derives bias from a single text column and silently flips sign if missing.** For Tradovate exports, `bias` is mapped from `B/S` (which means "the side of the *Buy* fill" — every Tradovate round-turn row has both a Buy and a Sell). So `B/S = Sell` (a short trade where the buy was the close) is treated as `Bearish` and the system computes `(exit − entry) × pv × −1`. For a profitable short with entry > exit, the broker-reported P&L is positive but `computePnlDollar` produces a *negative* `pnlDollar`. Both fields live on the trade record and are used by different parts of the dashboard. | `csvParser.ts:333-348`, `CsvImportPanel.tsx:63-72` | **Wrong sign on `pnlDollar` for shorts on Tradovate-style exports.** The Rithmic fixture has the same shape (BuyFillPrice + SellFillPrice columns — no explicit bias) and there is no preset mapping for `bias` on Rithmic, so every Rithmic trade is imported with `bias=""` → defaults to long. |
| C2 | **Tradovate `B/S` semantics are misinterpreted.** For Tradovate's "Trade History" export, `B/S = "Buy"` does NOT mean "this trade was long." It means "the *buy fill* of the round-turn happened first." A `B/S = "Sell"` row is a *short* trade where the sell came first. The current mapping treats it as a generic direction column. (The Tradovate fixture row 2 — `B/S=Sell`, pnl=`62.50`, `Buy Price=20815` > `Sell Price=20790` — is a *profitable short*; `normalizeBias("Sell") → Bearish` happens to be correct here, but only because Tradovate's column already encoded the trade direction. This deserves a comment and a test.) | `CsvImportPanel.tsx:149`, `csvParser.ts:157-162` | Subtle but correct enough by coincidence; needs a regression test so a future "improvement" doesn't break it. |
| C3 | **`pnlDollar` is recomputed locally even when the broker CSV provides a Net P&L.** When the CSV has an authoritative `Net P&L` column (Rithmic, NinjaTrader, TopstepX, Tradovate), `trade.pnl` is taken from the CSV but `trade.pnlDollar` is *also* computed from `(exit − entry) × pointValue × qty × sign`. The two diverge whenever the broker P&L includes commissions/fees or uses tick-rounded prices. Result: two truth-sources stored on the same trade, downstream charts pick one or the other. | `CsvImportPanel.tsx:46-77` | Discrepancies between `pnl` (string, broker truth) and `pnlDollar` (string, recomputed) will surface in totals. Compounded by the "P&L is gross/net" toggle existing only as a UI affordance — it doesn't actually adjust anything. |
| C4 | **"P&L is gross / net" toggle is decorative.** `grossNet` state is read only by the import-preview reveal modal to display a warning banner (`CsvImportPanel.tsx:513-517`). It is never passed into the row→trade conversion. The user selecting "gross" does nothing to the stored figure. | `CsvImportPanel.tsx:276`, `513-517` | The product promises "review pnlDollar after import" but provides no commission column mapping. Net vs gross is unresolvable from the import path. |
| C5 | **Dedup key uses 4 string fields and is highly collision-prone.** `tradeKey` hashes `date|PAIR|entryPrice|pnl` (`csvParser.ts:364-372`). For NQ scalpers running multiple trades at the same fill price (1-tick stops/entries during liquidity events), `entryPrice` + `pnl` can repeat. Re-importing a CSV with the *broker* having added/edited a row will mark legitimate new trades as duplicates. Conversely, an edit to a trade's notes/SL/TP creates a new key and re-import duplicates it. The comment in the code (L361) explicitly says session/sl/tp were *removed* to fix false positives — this trades one failure mode for another. | `csvParser.ts:364-372` | **No use of broker trade IDs** (Rithmic OrderID, NinjaTrader Trade #, TopstepX deal ID, MT5 `Deal`/`External ID` — present in fixtures but unmapped). The MT5 fixture L1 has a `Deal,External ID` column that's never read. |
| C6 | **`pnl` is stored as a 2-decimal string and is the dedup key.** Two trades with `pnl = "412.5"` and `pnl = "412.50"` will hash differently because `parseFloat(parseNum(s)).toFixed(2)` is applied on import but raw CSV values are *not* re-normalised when comparing. If existing trades came from a different code path (manual entry, Tradovate API), the dedup misses. | `CsvImportPanel.tsx:59`, `csvParser.ts:365-371` | Re-import detection is unreliable across import sources. |
| C7 | **No account assignment per import beyond the `accountType` enum.** `accountType` is `"personal" | "funded" | "demo"` — a single flag, not a foreign key to a specific account. A user with two funded Apex evaluations and one personal Tradovate cannot import CSVs into the right account. Imported trades are pooled with all other trades for that type. | `CsvImportPanel.tsx:267-277`, `types.ts:44` | Prop firm traders almost always have multiple concurrent accounts. This is a structural gap, not a bug. |
| C8 | **5,000-row hard cap silently truncates large files.** `MAX_IMPORT_ROWS = 5_000` (`CsvImportPanel.tsx:454`). A trader importing six months of an active prop account hits this. The UI warns *after* parse but still processes only the first 5,000 — by file order, which for some exports is *oldest first* (so newest trades are lost) and for others is *newest first* (so historical context is lost). No way to import in chunks. | `CsvImportPanel.tsx:454-456`, `750-754` | Silent data loss with a warning banner that's easy to dismiss. 10k+ row goal in the spec is unreached. |
| C9 | **`normaliseSymbol` regex misclassifies forex.** Pattern `/^([A-Z]{1,5})[FGHJKMNQUVXZ]\d{1,2}$/` will match e.g. `USDJPY` is 6 chars so safe — but `EURUSD` is 6 chars, also safe. However `AUDH4` (a hypothetical aussie suffix) and any 5-letter symbol ending in one of the 12 month-code letters followed by 1–2 digits will be truncated. Specifically `NZDH4`-style strings or even legitimate equity tickers like `MSFTQ` followed by 2 digits would have their last 2–3 chars stripped. | `csvParser.ts:262-272` | Edge case for stocks/ETFs and 5-char "weekly" forex tickers some brokers emit. Low probability but irreversible (the original is replaced and never stored). |
| C10 | **UTF-16 BOM "0xFE 0xFF" detection is reversed.** The decoder reads `bytes[0] === 0xFE && bytes[1] === 0xFF` as UTF-16 BE and `0xFF 0xFE` as UTF-16 LE. That is correct *by spec* but the comment in `CsvImportPanel.tsx:425-433` says "Excel sometimes exports CSVs as UTF-16 LE" — and indeed Excel's "Unicode Text (.txt)" export is UTF-16 LE with BOM `FF FE`. **Fine as written, but no test fixture covers it.** Flagging because a future "tidy" of the comment might invert the branches. | `CsvImportPanel.tsx:425-434` | Fragile — no test. |
| C11 | **Windows-1252 is not handled.** Some broker desktop apps (older Tradovate, Excel "Save As CSV (MS-DOS)") emit Windows-1252. The decoder falls through to UTF-8, which mangles non-ASCII characters in notes/account names without throwing. The try/catch around `TextDecoder` is *not* present, but UTF-8 decode is lenient and silently produces replacement characters. | `CsvImportPanel.tsx:425-434` | Notes / account names with curly quotes or em-dashes appear as `?` or `�`. Low impact but real. |
| C12 | **Errors in Excel parse path are stringified from `err.message` and shown to the user**, while the catch block in `decodeCsvBuffer` (`CsvImportPanel.tsx:409`) **swallows the original error entirely** with a generic "Couldn't decode the file." No call to `log.error()`, no Sentry breadcrumb. | `CsvImportPanel.tsx:393-414` | Silent failure when a real bug ships; no telemetry to discover it. |
| C13 | **`detectSessionFromDateStr` falls back to a hard-coded `-4` (EDT) for UTC strings missing the date.** The regex at L222 can match a bare time like `T13:30:00Z` and then code at L246-248 applies `(hour - 4 + 24) % 24` — wrong in EST winter (should be -5). The branch is theoretically unreachable for real CSV data (every broker emits a date), but the comment is misleading. | `csvParser.ts:246-248` | Edge case but flagged because the comment claims it handles DST and the code does not. |
| C14 | **No persistence of the original CSV file.** Files are read in-memory and discarded once `onImport` runs. There is no Supabase Storage upload, no import record (file name, row count, timestamp, account, user). Re-import from source is impossible. No undo/rollback. The only audit trail is PostHog `csv_imported` event with `{ count }` (`Koda.tsx:841`). | `CsvImportPanel.tsx:328-415`, `Koda.tsx:835-847` | A bad import is permanent — you can't reproduce what file produced what trades. |
| C15 | **No commissions or fees handling.** NinjaTrader and TopstepX fixtures include a `Commission` column; nothing maps to it. The MT5 fixture includes `Commission` and `Swap`. None are extracted. Net vs gross becomes user guesswork. | All preset definitions in `CsvImportPanel.tsx:138-253` | Material for funded-account P&L; Apex/TopstepX deduct $0.74-$4.18/RT and traders expect net figures to match. |
| C16 | **`handleCsvImport` writes trades to KV with no error rollback.** `saveTrades` catches the storage error and logs it, *then* returns silently (`Koda.tsx:698-713`). The UI toast "Imported N trades" fires regardless of whether the write succeeded. If KV write fails, in-memory state has the imports but Supabase doesn't. Next reload silently loses them. | `Koda.tsx:698-713`, `835-847` | False success messaging on failed import. Top-bar toast lies. |
| C17 | **Prop firm logic is profile-level, not per-trade.** `Profile` has `propFirmBalance`, `propFirmProfitTarget`, `propFirmDailyLossLimit`, `propFirmMaxDrawdown` — a single set of numbers. Imported trades carry only `accountType: "personal" | "funded" | "demo"`. There is no concept of a 6pm-ET daily reset, no trailing drawdown calculation derived from the trades, no consistency-rule violation flags. | `types.ts:69-78`, `EvalAccountScreen.tsx` | Section 15 of the audit spec (prop-firm-specific logic) is essentially un-implemented in the import path. |

---

## 2. Format coverage matrix

| Broker / format | Preset | Auto-detect | Test fixture | Status |
|---|---|---|---|---|
| **Tradovate** | ✅ `tradovate` | ✅ | ✅ `tradovate-export.csv` (5 rows) | OK; only maps `Buy Time` — no support for `Sell Time` or distinguishing entry vs exit timestamps |
| **Apex / Rithmic** | ✅ `rithmic` | ✅ (`Buy Fill Price` heuristic) | ✅ `rithmic-export.csv` (3 rows) | No `bias` mapped — every Rithmic import is `Bullish` by default; `pnlDollar` will be wrong for shorts |
| **TopstepX** | ✅ `topstepx` | ✅ | ✅ `topstepx-export.csv` (3 rows) | OK but `Commission` column ignored |
| **NinjaTrader 8** | ✅ `ninjatrader8` | ✅ | ✅ `ninjatrader8-export.csv` (3 rows, with preamble) | Preamble skip works; `Commission` ignored |
| **MT4** | ✅ `mt4` | ✅ | ✅ `mt4-export.csv` (3 rows) | EU date locale; OK |
| **FTMO / MT5** | ✅ `ftmo_mt5` | ✅ | ✅ `ftmo-mt5-export.csv` (3 rows) | OK; `External ID` and `Deal` columns unused for dedup |
| **TradingView** | ✅ `tradingview` | ✅ | ✅ `tradingview-export.csv` | Strategy Tester output; not a live broker — listed but rarely the primary use case for prop-firm traders |
| **FundedNext** | ❌ | ❌ | ❌ | Not covered (MT5 underneath — FTMO preset may work) |
| **MyFundedFutures** | ❌ | ❌ | ❌ | Not covered (Rithmic underneath — Rithmic preset may work) |
| **IBKR** (Interactive Brokers) | ❌ | ❌ | ❌ | Not covered. Activity Statement format is materially different (multi-section, multi-currency, currency-conversion rows) |
| **Tastytrade** | ❌ | ❌ | ❌ | Not covered |
| **Webull** | ❌ | ❌ | ❌ | Not covered |
| **Earn2Trade / E8 Markets** | claimed under Rithmic | partial | ❌ | Hint text claims support but no fixture |
| **Generic CSV with manual mapping** | ✅ | n/a | ❌ no test for the manual-mapping happy path | Works via dropdowns |
| **Excel `.xlsx`** | ✅ (via `xlsx` package) | n/a | ❌ no `.xlsx` fixture | Branch in `handleFile` runs; not exercised by tests |
| **Share to Kōda intent (mobile)** | ❌ | n/a | ❌ | PWA does not register a Web Share Target for files |

---

## 3. Findings by section

### Section 1 — Format coverage

| Area | Current state | Gap | Severity | Effort | Recommended action |
|---|---|---|---|---|---|
| Apex-on-Tradovate | Tradovate preset works for Tradovate's own CSV | Apex traders also export via *Rithmic R\|Trader* and *TradovateTrader* — header sets differ | high | M | Add an explicit "Apex (Rithmic export)" alias of the Rithmic preset, with `accountType: "funded"` default |
| FundedNext / MyFundedFutures | No explicit preset | Both are MT5 / Rithmic under the hood, but the column names diverge (FundedNext uses lowercase `time`, mff uses `Account` first column) | med | S | Add fixtures + adjust fallbacks |
| IBKR / Tastytrade / Webull | Not in scope today | Equities + options + multi-currency complicate parsing | low (for prop-firm focus) | L | Park until non-futures users complain |
| Excel `.xlsx` | Reads with `xlsx` package | No fixture, no test, no progress indicator on large files (xlsx is sync) | med | S | Add a fixture + an integration test using `xlsx.write` |
| Auto-detection | `detectBroker` covers 7 brokers | When 0 match, falls back to autoDetectMapping silently — no UX hint that detection failed | low | XS | Show a small "Detected: Generic CSV — please verify mapping" line |
| Fallback for unrecognised format | Auto-mapping by regex | Works for ~80% of headers; manual mapping still required for unusual names | low | n/a | Keep as-is |

### Section 2 — Upload UX

| Area | Current state | Gap | Severity | Effort | Recommended action |
|---|---|---|---|---|---|
| Drag-drop | None — file picker only | No `onDragOver` / `onDrop` on the dashed label | low | XS | Add drag listeners |
| Mobile file picker | Native `<input type="file">` works | Works but the label says "Click to select" — should say "Tap to select" on touch | trivial | XS | Detect coarse pointer |
| Share-to-Kōda intent | Not registered | PWA `manifest.webmanifest` does not declare `share_target` | med | S | Declare `share_target` with `enctype: multipart/form-data` and accept `.csv` / `.xlsx` |
| Size limit | 10 MB client; no server limit because no server | OK but no warning before parse | trivial | XS | Show file size next to filename |
| Progress indicator | None for parsing | parseCSV is sync, blocks UI on large files | med | M | Move parse to a Web Worker; report progress per N rows |
| Cancellation | None | Cannot abort a 5,000-row parse | low | M | Worker-based parse with `terminate()` |
| Multi-file support | No | Multiple imports require multiple selections | low | M | Iterate `e.target.files`, queue parses |

### Section 3 — Parsing robustness

| Area | Current state | Gap | Severity | Effort | Recommended action |
|---|---|---|---|---|---|
| UTF-8 BOM | Stripped in `parseCSV` | ✅ tested | — | — | — |
| UTF-16 LE/BE BOM | Detected in `decodeCsvBuffer` | No tests, no fixture; reversed comment risk (C10) | low | S | Add a binary fixture + decode test |
| Windows-1252 | Not handled | Silently produces replacement chars (C11) | low | M | Add a charset-detection step (`chardet`-lite) before TextDecoder |
| Line endings | CR / LF / CRLF handled in tokenizer | ✅ | — | — | — |
| Delimiters | `,` `\t` `;` detected | `|` mentioned in error message (L338) but not in `detectDelimiter` | low | XS | Add pipe support |
| Quoted fields | RFC 4180 handled | ✅ tested | — | — | — |
| Embedded newlines in quoted fields | The tokenizer ignores `\n` inside `inQuote` — actually appends it to `cell` via `cell += ch` only for non-newline chars; **newlines inside quotes are dropped silently** | The `inQuote` branch (L93-96) only handles `"` — `\n` and `\r` fall through and are *not* added to the cell | **high** | S | Add `else cell += ch` covering newlines in the quoted branch — currently `cell += ch` only runs when `ch !== '"'` in the inQuote block, but the assignment IS there at L95 (`else cell += ch`). Re-reading: the `else` does catch newline chars. **Correction:** OK as written. Add a test for `"line one\nline two"` to lock behaviour. |
| Empty cells / null literals | Trimmed, treated as missing | "null", "NaN", "--" stay as-is and fall to parseNum (which strips most) | low | XS | Add explicit recognition for `null`, `n/a`, `--`, `-` |
| Whitespace | Trimmed on headers and row cells | ✅ | — | — | — |
| Multi-row headers | Not handled | Brokers like IBKR put a section header above the data header; only first 10 rows scanned | med | M | Increase scan window + handle "section break" rows |
| Preamble rows | `findHeaderRowIndex` scans 10 rows | ✅ tested | — | — | — |
| Trailing summary rows | `isSummarySymbol` filters by symbol cell | ✅ tested | — | — | — |

### Section 4 — Date and time

| Area | Current state | Gap | Severity | Effort | Recommended action |
|---|---|---|---|---|---|
| Format detection (US/EU/ISO) | ISO and slash-delimited; user toggle for US/EU | Dot-delimited (`2024.03.15`) accepted by the slash regex via `[/.]`; ✅ | — | — | — |
| 12h vs 24h | `detectSessionFromDateStr` handles AM/PM | Date-only fields (no time) get no session — fine | — | — | — |
| Source timezone | Only "UTC vs naive" detected | Most broker CSVs emit *exchange* time (CT for CME) or *broker server* time (varies). User cannot specify | **high** | M | Add a "Source timezone" dropdown (CT, ET, UTC, broker default per preset) and convert all times to UTC before storing |
| DST transitions | Uses `Intl.DateTimeFormat` with `America/New_York` for UTC→ET | ✅ but only for UTC inputs; naive inputs assumed to be ET already | med | S | Document assumption; add a test for a March DST-transition timestamp |
| User display TZ | No conversion | Session is the only TZ-derived field; date stored as raw `YYYY-MM-DD` from the source | low | n/a | Acceptable for journal use |
| Session classification | NY (09:30-16:00 ET), London (03:00-08:30 ET), Asia (20:00-02:00 ET) | "NY PM" / "NY AM" not distinguished; no London close session | low | S | Split NY into NY AM (09:30-12:00) / NY PM (13:00-16:00) per spec |

### Section 5 — Number and currency parsing

| Area | Current state | Gap | Severity | Effort | Recommended action |
|---|---|---|---|---|---|
| Decimal separator | `parseNum` strips everything except `0-9.\-()/` | **European decimal-comma (`27,50`) becomes `2750`** — silent 100× error | **critical** | S | If semicolon delimiter detected, treat `,` as decimal separator |
| Thousands separator | Stripped (commas removed) | Works for US format; collides with EU decimal-comma | critical | S | Same fix |
| Negative formats | Minus and parentheses both handled | ✅ tested | — | — | — |
| Currency symbols | Stripped | ✅ tested with `$1,250.50` | — | — | — |
| Tick-based prices | No normalisation | Some brokers emit `5920'25` (5920 + 25/32 ticks) — `parseNum` returns NaN-ish | low | M | Skip for now; futures CME emits decimal |

### Section 6 — Symbol mapping

| Area | Current state | Gap | Severity | Effort | Recommended action |
|---|---|---|---|---|---|
| Futures month codes | `normaliseSymbol` strips F G H J K M N Q U V X Z + 1-2 digit year | ✅ tested | — | — | — |
| NT8 format `NQ 03-25` | Handled by second regex | ✅ tested | — | — | — |
| Micro vs full | `MNQ → MNQ`, `NQ → NQ` — kept distinct in `FUTURES_POINT_VALUE` | ✅ | — | — | — |
| Continuous contracts | `NQ1!` / `ESH2024` / `ES=F` (Yahoo) not handled | TradingView emits `NQ1!` and `ES=F`, normaliseSymbol leaves them alone → pointValue lookup fails | med | S | Pre-strip `!`, `=F`, `_F` |
| Point/multiplier table | 31 contracts hard-coded in `FUTURES_POINT_VALUE` | No user-editable override; `BTC` (Bitcoin futures) absent; `MET`/`MYM` mappings present | med | M | Allow user override per symbol, persist in KV |
| Unknown symbol | `getPointValue` returns null → `pnlDollar = ""` | Silent — no UI signal that pnlDollar wasn't computed | med | XS | Show a chip "pnlDollar not computed — unknown symbol" on the preview row |
| Forex pairs | Left unchanged by `normaliseSymbol` | ✅ tested; but no pointValue → no `pnlDollar` ever | low (futures focus) | — | — |

### Section 7 — Trade aggregation

| Area | Current state | Gap | Severity | Effort | Recommended action |
|---|---|---|---|---|---|
| Fills vs round-turn | All presets assume **round-turn rows** (one row per closed trade) | If user exports *fill-level* data (Tradovate "Order History", Rithmic "Order Detail") — every row is a partial fill and we'd treat each as a complete trade | **high** | L | Detect fill-level export, FIFO-match like `useTradovate.ts` does for live sync |
| Scaling in/out | No aggregation | Same as above | high | L | Same fix |
| Partial fills | No detection | Same | high | L | Same |
| Reversals | Not handled | A position flip would produce two close-then-open in one row | med | L | Out of scope for v1 |
| Hedged positions | Not handled | Long + short on same symbol same day produces two rows treated independently | low | M | Document |
| Stop-out / forced liquidation | Not detected | The "Exit name" field in NT8 contains `Stop market`, etc. — could map to `outcome` for forced liquidation, but isn't | low | S | Pattern-match exit name → annotation |

### Section 8 — Financial calculations

| Area | Current state | Gap | Severity | Effort | Recommended action |
|---|---|---|---|---|---|
| Gross P&L formula | `qty × (exit − entry) × pv × sign` in `computePnlDollar` | Formula correct **only for futures**; sign depends on bias which is unreliable (C1) | **high** | M | Tighten bias derivation: use price asymmetry as a tiebreaker when bias missing |
| Commissions | Not extracted (C15) | NT8 `Commission`, TopstepX `Commission`, MT5 `Commission` + `Swap` all available | high | M | Map commission → `commission` field, store on trade, subtract from `pnlDollar` when "gross" toggle is set |
| Exchange / NFA / clearing fees | Not extracted | Usually rolled into Commission column | med | M | Same as above |
| Net P&L | Whatever the CSV's P&L column says | No reconciliation against entry/exit × pv | high | S | When `Net P&L` is present, verify `\|csvNet − computedGross\| < $5`; if not, flag the row |
| Currency conversion | None | EUR-denominated FTMO accounts produce EUR P&L; stored as-is | low | M | Add account currency field |
| R-multiple calc | `calcRR(entry, sl, tp)` from `stats.ts` — only if all three present | Most broker CSVs lack `Stop Loss` and `Take Profit` (only MT4/MT5/FTMO presets include them) | med | n/a | Document gap |

### Section 9 — Validation and error reporting

| Area | Current state | Gap | Severity | Effort | Recommended action |
|---|---|---|---|---|---|
| Per-row validation | Bad row returns `null` from `rowToTrade`; `invalidCount` counted | ✅ doesn't kill import | — | — | — |
| Errors with row number | "N rows skipped — missing symbol or unparseable date" | No row numbers, no example, no way to inspect which rows failed | med | S | Capture skipped rows + first 3 failed-row payloads, surface in a collapsible panel |
| Required fields | `date` and `pair` required; UI disables Import button if unmapped | ✅ | — | — | — |
| Range checks | None | A negative qty or future-dated trade is accepted | low | XS | Add sanity bounds |
| Preview before commit | Reveal modal shows stats summary | Modal shows aggregates, not individual rows; can't spot a single bad trade | med | S | Add an expand-to-rows section in the modal |
| Edit-on-error without re-upload | Not supported | Once parsed, cannot modify a row before commit | low | M | Inline edit in preview table |

### Section 10 — Duplicate detection

| Area | Current state | Gap | Severity | Effort | Recommended action |
|---|---|---|---|---|---|
| Trade fingerprint fields | `date | pair | entryPrice | pnl` (C5/C6) | Collision-prone; format-sensitive | **high** | S | Add a quarter-second-resolution `entryTime` to the key when available; fall back to current key |
| Re-import of same file | Detected only if fingerprint matches; cross-source fragile | C5/C6 | high | S | Same fix |
| Overlapping date ranges | No special handling | Re-importing a date range overlap relies on per-row dedup | med | n/a | Acceptable if dedup is fixed |
| Broker trade IDs | **Not used.** MT5 `Deal` + `External ID` columns exist in fixture, never mapped. Rithmic/Tradovate exports include order IDs. | C5 | high | M | Add `external_id` field on Trade; map per-preset; prefer over hash when present |

### Section 11 — Account assignment

| Area | Current state | Gap | Severity | Effort | Recommended action |
|---|---|---|---|---|---|
| Account per import | `accountType: personal/funded/demo` (C7) | Single enum, no FK | **high** | L | Add `EvalAccount[]` collection, allow CSV to be imported "into" a specific account |
| Multiple accounts per user | `EvalAccount` type exists but is screen-only | The screen doesn't persist multi-account ownership of trades | high | L | Same fix |
| Prop firm context | Only at profile level | Per-trade firm/account/phase missing | high | L | Same fix |
| Account creation from import screen | No | User must leave the import screen to create an account | med | S | "+ New account" link in the account selector |

### Section 12 — Performance

| Area | Current state | Gap | Severity | Effort | Recommended action |
|---|---|---|---|---|---|
| 10,000+ row handling | Hard-capped at 5,000 (C8) | Silent truncation | high | M | Remove cap; move to streamed parse |
| Client vs server parsing | All client-side, sync | UI blocks during parse | med | M | Web Worker |
| Chunked / streamed | No | `parseCSV` reads whole file into memory + walks char-by-char | med | M | Use `papaparse` worker mode |
| Batched DB inserts | `saveTrades` writes the *entire* trades array as a single JSON blob to KV (`storage.set("koda_trades", JSON.stringify(u))`) | 5,000 trades × ~1 KB each = 5 MB JSON blob written on every import. KV row size limit + Supabase request size | **high** | M | Migrate to `public.trades` table writes per the v2 plan; flag-gated |
| Memory profile on mobile | Untested | iPhone Safari would struggle with 5 MB JSON.parse | med | S | Test, measure |
| Background processing | None | All in-tab | med | L | Edge function: upload file → parse → upsert → notify |

### Section 13 — Storage and audit trail

| Area | Current state | Gap | Severity | Effort | Recommended action |
|---|---|---|---|---|---|
| Original CSV persisted | **No** (C14) | Can't reproduce a bad import | high | M | Upload to `koda-csvimports` Supabase Storage bucket |
| Import record in DB | **No** | No history of imports | high | M | New `csv_imports` table: id, user_id, account_id, file_url, row_count, imported_count, duplicate_count, error_count, created_at |
| Re-import from source | Not possible | C14 | high | M | Same fix |
| Undo / rollback | None | Once imported, only manual deletion | high | M | Tag every imported trade with `csv_import_id` to allow bulk rollback |

### Section 14 — Post-import flow

| Area | Current state | Gap | Severity | Effort | Recommended action |
|---|---|---|---|---|---|
| Summary screen | Reveal modal with stats | No "errors" tab, no duplicates list, no drill-down | med | S | Add tabs to reveal modal |
| Drill into errors | No | Skipped rows are counted but discarded | med | S | Keep failed-row payloads in state until import confirmed |
| Recalculation triggers | `saveTrades` updates `trades` state, all `useMemo` chains depending on `trades` re-fire | ✅ but discipline-score / streak code paths are scattered | low | n/a | Acceptable |
| Notification on async completion | n/a (sync) | If we add Edge Function processing, need this | low | M | Push notification on import done |

### Section 15 — Prop-firm-specific logic

| Area | Current state | Gap | Severity | Effort | Recommended action |
|---|---|---|---|---|---|
| Daily P&L reset at firm boundary | None | Apex/TopstepX use 6pm ET reset | high | M | Add per-firm boundary; group trades by firm session day |
| Trailing drawdown calc | `propFirmMaxDrawdown` is a static number; no running peak | C17 | high | M | Compute running peak balance from sorted trades; flag breaches |
| Consistency rule violations | Not flagged | Apex consistency rule = no day > 30% of total profit | med | M | Post-import analysis pass |
| Max loss day breach | Not detected | `propFirmDailyLossLimit` not checked against imported trades | high | S | Per-day P&L roll-up; flag any day exceeding limit |
| Account balance reconciliation | None | MT5 has running `Balance` column; could verify our calc matches | low | S | Use `Balance` column when present to cross-check |

### Section 16 — Behavioural data backfill

| Area | Current state | Gap | Severity | Effort | Recommended action |
|---|---|---|---|---|---|
| Daily loss limit history | Not backfilled | Imported trades flow into `trades` but the daily-loss-limit feature reads `tradr_daily_state` keys, not historical trades | med | M | Backfill `tradr_daily_state` from imports |
| Discipline score | Computed from `ruleAdherence` field — CSV imports never set it | All imported trades count as `null` adherence, polluting the metric | high | S | Either exclude `source: csv_import` trades from discipline score or surface a UI flag |
| Streaks | Computed from outcomes | Should work; not verified | low | XS | Add an integration test |
| Historical session classification | Set per-row via `detectSessionFromDateStr` | ✅ | — | — | — |
| Bulk setup-type tagging | `defaultStrategy` field applies one strategy to all rows | No setup-level (ICT / S&D / Wyckoff / ORB) tagging | med | S | Add `defaultSetup` dropdown alongside `defaultStrategy` |
| Pre-Kōda trades distinguished | `source: "csv_import"` on every trade | ✅ field exists; not surfaced in UI | low | XS | Show a "imported" badge on the trade card |

### Section 17 — Testing coverage

| Area | Current state | Gap | Severity | Effort | Recommended action |
|---|---|---|---|---|---|
| Unit tests per parser | `csvParser.test.ts` 412 lines — covers helpers | ✅ thorough on helpers | — | — | — |
| Integration tests | `csvParser.integration.test.ts` — 7 broker fixtures parsed end-to-end | ✅ but only happy path | — | — | — |
| Edge case fixtures | None | Empty file, single row, malformed quotes, header-only, all-duplicates, BOM mismatch, semicolon-EU-decimal, NT8-mid-month-rollover, 10k-row | **high** | S | Add `edge/*.csv` fixtures |
| End-to-end UI test (Playwright) | `tests/smoke.spec.ts` exists | Doesn't cover CSV import flow | med | M | Add a Playwright test: load file → preview → confirm → assert journal contains row |

---

## 4. Sample fixture gaps

Formats with a preset / claim of support but **no test CSV in the repo**:

- **Apex / TopstepX / Earn2Trade** specific variants — only one generic `rithmic-export.csv` and one `topstepx-export.csv` (each 3 rows). Apex's actual NinjaTrader-flavoured Rithmic export differs from R\|Trader Pro's.
- **TradingView Strategy Tester real export** — the `tradingview-export.csv` fixture exists but I didn't inspect its row structure; the integration test only checks one exit row. TradingView's real export has interleaved enter/exit rows and the "first exit row" heuristic in the test (L313-321) is fragile.
- **Tradovate "Order History"** (fill-level) — not covered. Users *will* export this by mistake.
- **MT5 with European decimal-comma + semicolon delimiter** — high failure mode (see C2 in section 5), no fixture.
- **Excel `.xlsx`** — code path exists, no fixture, no test.
- **NinjaTrader 8 "Trade Performance" export with multiple-section header** — actual NT8 reports often include several CSV "tables" stacked. Only single-section fixture.
- **Windows-1252 encoded file** — no fixture.
- **UTF-16 LE file with BOM** — no fixture (code path exists).
- **10,000-row stress fixture** — none; cap is hit but not tested.
- **All-duplicates file** — none.
- **Header-only / empty file** — handled in code (L342-345) but no test fixture.
- **File with embedded newlines inside quoted notes field** — no fixture.
- **Negative P&L using accounting parentheses** — only Rithmic fixture row 2 covers this (`($500.00)`); no NT8 / TopstepX equivalent.

---

## 5. Suggested sequencing

### Phase A — Correctness (ship before next user)

1. **Fix dedup to use broker trade IDs when present** (C5). Add `external_id?: string` to `Trade`. Map from MT5 `Deal`, NT8 row index, TopstepX deal ID, Tradovate fill IDs. Hash falls back when missing.
2. **Fix European decimal-comma handling** (Section 5). When delimiter is `;`, treat `,` as decimal separator in `parseNum`.
3. **Resolve `pnl` vs `pnlDollar` divergence** (C3). Prefer broker `Net P&L` column when present; only fall back to `computePnlDollar` when the CSV has no P&L column. Store both, but flag mismatch > $5.
4. **Fix bias derivation** (C1). When bias is empty AND entry/exit are present, infer direction from price asymmetry vs sign of broker P&L.
5. **Stop silent truncation at 5,000 rows** (C8). Either remove the cap and warn at parse time before showing the import button, or chunk into multiple imports with a progress bar.
6. **Stop the false success toast** (C16). Await the KV write; surface failures as a red toast.
7. **Add edge-case fixtures + tests** for: EU decimal, all-duplicates, embedded newlines, empty file, 10k-row stress.

### Phase B — Coverage (next 2–3 weeks)

8. **Persist the original CSV + import record** (C14, Section 13).
9. **Add per-account assignment** (C7, Section 11). Requires extending `Trade` schema + EvalAccount FK.
10. **Map commissions** (C15, Section 8). Add `commission?: number` to `Trade`.
11. **Add Apex-on-Rithmic preset alias + FundedNext / MyFundedFutures presets.**
12. **Add `share_target` to manifest** for mobile share-to-Kōda.
13. **Add a Source Timezone dropdown** (Section 4).

### Phase C — Polish (after activation problems are gone)

14. **Drag-and-drop, multi-file, progress indicator, cancellation** (Section 2).
15. **Web Worker parsing** (Section 12).
16. **Undo/rollback per import** (Section 13).
17. **Prop-firm-specific 6pm-ET reset + trailing drawdown + consistency rule violations** (Section 15).
18. **Drill into errors** (Section 9).
19. **Behavioural data backfill — daily-loss-state, exclude imports from discipline score** (Section 16).

---

## 6. Questions for Dylon

1. **What does the typical Apex/TopstepX user actually export?** R\|Trader Pro CSV, NinjaTrader Trade Performance, or the prop firm's web dashboard export? Each is structurally different and the current fixtures may not match what users in the wild produce.
2. **Should `pnlDollar` ever override the broker's `Net P&L`?** Currently both are stored. Recommendation: broker P&L wins when present, locally-computed value is metadata.
3. **Multiple accounts — is the design "EvalAccount per import target" or "tag every trade with an account_id"?** The data model implies the latter; the import UI implies the former. We need a single answer before doing Section 11 work.
4. **The 5,000-row cap — why?** Is this a known KV-row-size constraint, or an arbitrary safety limit? If it's tied to JSON blob size, removing the cap requires the v2 trades-table cutover.
5. **Are CSV-imported trades supposed to count toward discipline / rule-adherence stats?** Currently they're included as `null` adherence, dragging the metric down silently. Exclude them, or surface a "tag your imports" prompt?
6. **Excel `.xlsx` — is anyone actually using it?** No fixture, no test. Worth keeping if it's working; worth dropping if it's not exercised.
7. **What's the source-timezone story?** Tradovate web UI shows trades in user-selected TZ. Rithmic shows CT. NT8 shows local. Users currently rely on the implicit "naive timestamp" handling. If they import from one broker, then another, sessions will misalign. Do we want to ask source TZ at import time?
8. **Original CSV in Supabase Storage — privacy / cost considerations?** A user with daily 10MB exports = 300MB/mo. Bucket lifecycle policy?
9. **Should the "gross/net" toggle do something or be removed?** As-is it lies.
10. **MFF / FundedNext / E8 Markets / Maven Trading** — which prop firms are highest priority? The current preset set skews to legacy retail (MT4/MT5, TradingView) rather than current prop-futures.
