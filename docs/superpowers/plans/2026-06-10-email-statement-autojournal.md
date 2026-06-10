# AutoJournal Email-Statement Ingestion (Tradovate v1) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Ship a forward-and-forget AutoJournal flow where users forward their Tradovate daily PDF statement to a unique Kōda email alias and trades are parsed, deduped, and auto-saved into their journal.

**Architecture:** Postmark Inbound receives the forwarded email and POSTs to `/api/email/inbound`. A provider-agnostic adapter normalizes the payload to `InboundEmail`, the user is identified by a `+token` alias, the PDF is text-extracted via `pdf-parse`, a Tradovate-specific regex parser produces `Trade[]`, dedupe runs against the existing `trades.external_id` unique index, and rows insert with `source='email_statement'` + `import_id`. A top-of-feed `AutoJournalBanner` lets the user review or bulk-undo the latest batch.

**Tech Stack:** TypeScript / Vite / React 19 / Vitest / Playwright / Supabase (Postgres + RLS + Storage) / Vercel functions / Postmark Inbound / `pdf-parse`.

**Spec:** `docs/superpowers/specs/2026-06-10-email-statement-autojournal-design.md`

---

## File Structure

### New (server)

| File | Responsibility |
|---|---|
| `supabase/migrations/20260610_autojournal_email_ingest.sql` | 3 schema changes: `profiles.email_ingest_token`, `imports` source/message-id/review/confidence columns, `trades` import_id/source/auto_logged columns |
| `api/email/inbound.ts` | Webhook entry: routes to provider adapter, calls core ingest |
| `api/email/providers/types.ts` | `InboundEmail` normalized shape |
| `api/email/providers/postmark.ts` | Postmark webhook → `InboundEmail` adapter + HMAC verify |
| `api/email/providers/postfix-shim.ts` | v2 stub — accepts JSON from self-hosted Postfix shim |
| `api/lib/email-ingest.ts` | Core orchestration: token lookup → sender allowlist → PDF extract → parse → dedupe → save → push |
| `api/lib/email-ingest.test.ts` | Vitest unit tests for orchestration |

### New (client)

| File | Responsibility |
|---|---|
| `src/lib/parsers/tradovate-statement.ts` | Pure regex parser. `(text: string) => ParseResult` |
| `src/lib/parsers/tradovate-statement.test.ts` | Vitest cases for parser |
| `src/lib/parsers/__fixtures__/tradovate-statement-mock.txt` | Synthetic text fixture (mirrors PDF layout) |
| `src/lib/parsers/__fixtures__/tradovate-statement-real.pdf` | Real anonymized statement (Dylon provides) |
| `src/data/autoImport.ts` | Client data layer for the banner + settings |
| `src/data/autoImport.test.ts` | Vitest cases |
| `src/screens/AutoImportSettings.tsx` | Settings panel: token display, copy, regenerate, setup steps, send test |
| `src/components/AutoJournalBanner.tsx` | Top-of-feed banner for the latest pending import |
| `src/components/AutoJournalReviewSheet.tsx` | Bottom sheet listing trades in the batch |

### Modified

| File | Change |
|---|---|
| `package.json` | Add `pdf-parse` |
| `src/lib/csvParser.ts` | Export `mapRowToTrade()` helper |
| `src/lib/imports.ts` | Accept `source` + `email_message_id` on `PersistImportArgs` |
| `src/Koda.tsx` | Mount `<AutoJournalBanner />` in Home feed |
| `src/SettingsScreen.tsx` | Add Auto-import section link |
| `.env.example` | Document new env vars |

### Out of scope (deferred to v2)

- `postfix-shim.ts` is scaffolded only (returns 501) — wired up when private mail server lands

---

## Pre-Flight Blockers

**These must be resolved by Dylon before Task 1 begins. Do not start coding until both are green:**

- [ ] **Eval-account email support confirmed.** Log in to Tradovate, find the daily-statement-email toggle, send a test trade, confirm an email arrives next day. If eval accounts do NOT auto-email, this plan ships for live accounts only and the AutoImportSettings UI gains a "Live accounts only — eval coming soon" disclaimer.
- [ ] **Real PDF fixture provided.** Anonymized Tradovate daily statement PDF saved to `src/lib/parsers/__fixtures__/tradovate-statement-real.pdf`. Without this, Task 4 cannot test against ground truth and the parser is built blind. PII to strip: account number, balance, name, address.
- [ ] **Postmark account created + DNS MX record set for `in.kodatrade.co.uk` pointed at Postmark inbound MX.** Postmark webhook URL configured to `https://kodatrade.co.uk/api/email/inbound?provider=postmark`. Webhook HMAC secret saved as `POSTMARK_INBOUND_SECRET` in Vercel env.

---

## Task 1: Add `pdf-parse` dependency and document env vars

**Files:**
- Modify: `package.json`
- Modify: `.env.example`

- [ ] **Step 1: Install `pdf-parse`**

```bash
cd C:\Users\Dylon\OneDrive\Desktop\koda
npm install pdf-parse@^1.1.1
npm install --save-dev @types/pdf-parse@^1.1.4
```

Expected: `package.json` + `package-lock.json` updated, no errors.

- [ ] **Step 2: Add env vars to `.env.example`**

Append to `.env.example`:

```bash

# ── AutoJournal (email-statement ingestion) ──────────────────────────────
# Postmark Inbound webhook signature secret. Get from Postmark dashboard.
POSTMARK_INBOUND_SECRET=

# Shared HMAC secret for v2 self-hosted Postfix shim. Leave blank in v1.
POSTFIX_INBOUND_SECRET=

# Allowlist of original-sender addresses we accept Tradovate statements from.
# Comma-separated. Lowercase.
AUTOJOURNAL_ALLOWED_SENDERS=noreply@tradovate.com,statements@tradovate.com
```

- [ ] **Step 3: Confirm typecheck still passes**

```bash
npm run typecheck
```

Expected: exit 0.

- [ ] **Step 4: Commit**

```bash
git add package.json package-lock.json .env.example
git commit -m "chore(autojournal): add pdf-parse + env var stubs"
```

---

## Task 2: Database migration

**Files:**
- Create: `supabase/migrations/20260610_autojournal_email_ingest.sql`

- [ ] **Step 1: Write the migration**

Create `supabase/migrations/20260610_autojournal_email_ingest.sql`:

```sql
-- ═══════════════════════════════════════════════════════════════════════════════
-- Kōda · AutoJournal email-statement ingestion schema
--
-- WHAT THIS DOES
--   1. profiles.email_ingest_token       — unique per-user routing key for the
--                                          forward-to alias.
--   2. imports.source/email_message_id/  — distinguish manual vs email imports,
--      review_state/parse_confidence       protect against replay, drive the
--                                          AutoJournalBanner UX.
--   3. trades.import_id/source/           — link trades to their import batch,
--      auto_logged                         drive the "auto" badge + bulk Undo.
--
-- WHY THIS IS SAFE
--   Pure additive ALTER TABLE statements with `add column if not exists`.
--   Default values keep all existing rows truthful (`'manual_upload'` /
--   `'manual'` / `false`). No data is modified.
-- ═══════════════════════════════════════════════════════════════════════════════

-- ── profiles.email_ingest_token ──────────────────────────────────────────────
alter table public.profiles
  add column if not exists email_ingest_token text unique;

create index if not exists profiles_email_ingest_token_idx
  on public.profiles (email_ingest_token)
  where email_ingest_token is not null;

-- ── imports (new columns) ────────────────────────────────────────────────────
alter table public.imports
  add column if not exists source           text    not null default 'manual_upload',
  add column if not exists email_message_id text,
  add column if not exists review_state     text    not null default 'pending',
  add column if not exists parse_confidence numeric;

create unique index if not exists imports_email_message_id_uniq
  on public.imports (email_message_id)
  where email_message_id is not null;

-- Existing RLS policies on `imports` are owner-only and already correct — no change.

-- ── trades (new columns) ─────────────────────────────────────────────────────
alter table public.trades
  add column if not exists import_id   uuid references public.imports(id) on delete set null,
  add column if not exists source      text not null default 'manual',
  add column if not exists auto_logged boolean not null default false;

create index if not exists trades_import_idx
  on public.trades (import_id)
  where import_id is not null;

-- Existing RLS policies on `trades` are owner-only and already correct — no change.
```

- [ ] **Step 2: Apply migration to Supabase**

Open Supabase dashboard → SQL Editor → paste the migration → Run.

Expected output: `Success. No rows returned.`

- [ ] **Step 3: Verify in psql/dashboard**

In the SQL Editor run:

```sql
select column_name, data_type, column_default
from information_schema.columns
where table_schema='public' and table_name in ('profiles','imports','trades')
  and column_name in (
    'email_ingest_token','source','email_message_id','review_state',
    'parse_confidence','import_id','auto_logged'
  )
order by table_name, column_name;
```

Expected: 7 rows (1 profiles + 4 imports + 3 trades = 8 — `source` appears twice for imports and trades). Defaults present.

- [ ] **Step 4: Commit**

```bash
git add supabase/migrations/20260610_autojournal_email_ingest.sql
git commit -m "feat(db): autojournal email-ingest schema (profiles, imports, trades)"
```

---

## Task 3: Tradovate statement parser — types and skeleton

**Files:**
- Create: `src/lib/parsers/tradovate-statement.ts`
- Create: `src/lib/parsers/tradovate-statement.test.ts`

- [ ] **Step 1: Write the failing test**

Create `src/lib/parsers/tradovate-statement.test.ts`:

```typescript
import { describe, it, expect } from "vitest";
import { parseTradovateStatement } from "./tradovate-statement";

describe("parseTradovateStatement", () => {
  it("returns empty trades and zero confidence for empty text", () => {
    const result = parseTradovateStatement("");
    expect(result.trades).toEqual([]);
    expect(result.confidence).toBe(0);
    expect(result.warnings).toEqual(["Empty input"]);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

```bash
npm test -- src/lib/parsers/tradovate-statement.test.ts
```

Expected: FAIL — module not found.

- [ ] **Step 3: Write minimal implementation**

Create `src/lib/parsers/tradovate-statement.ts`:

```typescript
export interface ParsedTrade {
  external_id: string;
  symbol: string;
  bias: "long" | "short";
  entry_price: number;
  exit_price: number;
  entry_time: string;
  exit_time: string;
  qty: number;
  pnl: number;
}

export interface ParseResult {
  trades: ParsedTrade[];
  confidence: number;
  warnings: string[];
}

export function parseTradovateStatement(text: string): ParseResult {
  if (!text || text.trim().length === 0) {
    return { trades: [], confidence: 0, warnings: ["Empty input"] };
  }
  return { trades: [], confidence: 0, warnings: [] };
}
```

- [ ] **Step 4: Run test to verify it passes**

```bash
npm test -- src/lib/parsers/tradovate-statement.test.ts
```

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/lib/parsers/tradovate-statement.ts src/lib/parsers/tradovate-statement.test.ts
git commit -m "feat(parser): tradovate statement parser skeleton + types"
```

---

## Task 4: Tradovate parser — fixture-driven full parse

**Files:**
- Create: `src/lib/parsers/__fixtures__/tradovate-statement-mock.txt`
- Modify: `src/lib/parsers/tradovate-statement.ts`
- Modify: `src/lib/parsers/tradovate-statement.test.ts`

> **Note:** This is the parser's main implementation task. The mock fixture mirrors the structure of a real Tradovate PDF (extracted to text) so we can build without waiting on the real fixture; the real fixture validates in Task 5.

- [ ] **Step 1: Create the mock text fixture**

Create `src/lib/parsers/__fixtures__/tradovate-statement-mock.txt` with this content:

```
Tradovate Daily Account Statement
Account: DEMO12345
Statement Date: 2026-06-09

Filled Orders

Order ID     Symbol  B/S   Qty  Entry Time            Entry Price  Exit Time             Exit Price   P&L
TVE-9001     MESZ4   Buy   1    2026-06-09 09:35:00   5920.25      2026-06-09 09:52:00   5928.50      41.25
TVE-9002     MNQZ4   Sell  1    2026-06-09 10:10:00   20815.00     2026-06-09 10:30:00   20790.00     62.50
TVE-9003     MESZ4   Buy   2    2026-06-09 13:05:00   5935.00      2026-06-09 13:22:00   5930.75      -21.25

End of Statement
```

- [ ] **Step 2: Write the failing test**

Replace the contents of `src/lib/parsers/tradovate-statement.test.ts`:

```typescript
import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { parseTradovateStatement } from "./tradovate-statement";

const FIXTURE_DIR = join(dirname(fileURLToPath(import.meta.url)), "__fixtures__");
const mockText = readFileSync(join(FIXTURE_DIR, "tradovate-statement-mock.txt"), "utf8");

describe("parseTradovateStatement", () => {
  it("returns empty trades + warning for empty input", () => {
    const result = parseTradovateStatement("");
    expect(result.trades).toEqual([]);
    expect(result.confidence).toBe(0);
    expect(result.warnings).toEqual(["Empty input"]);
  });

  it("parses the mock fixture into 3 trades", () => {
    const result = parseTradovateStatement(mockText);
    expect(result.trades).toHaveLength(3);
    expect(result.confidence).toBeGreaterThanOrEqual(0.85);
  });

  it("extracts the first trade with all fields", () => {
    const { trades } = parseTradovateStatement(mockText);
    expect(trades[0]).toEqual({
      external_id: "TVE-9001",
      symbol: "MESZ4",
      bias: "long",
      entry_price: 5920.25,
      exit_price: 5928.50,
      entry_time: "2026-06-09T09:35:00.000Z",
      exit_time: "2026-06-09T09:52:00.000Z",
      qty: 1,
      pnl: 41.25,
    });
  });

  it("maps 'Sell' to short bias", () => {
    const { trades } = parseTradovateStatement(mockText);
    expect(trades[1].bias).toBe("short");
  });

  it("captures negative P&L", () => {
    const { trades } = parseTradovateStatement(mockText);
    expect(trades[2].pnl).toBe(-21.25);
  });

  it("skips garbage rows and warns instead of throwing", () => {
    const garbageRow = "BADROW-999 BADSYM Buy x 2026-13-99 nope nope nope nope";
    const result = parseTradovateStatement(mockText + "\n" + garbageRow);
    expect(result.trades).toHaveLength(3);
    expect(result.warnings.some((w) => /skipped/i.test(w))).toBe(true);
  });

  it("synthesises an external_id when the Order ID column is missing", () => {
    const noIdText = mockText.replace(/TVE-900\d/g, "").replace(/Order ID\s+/, "");
    const result = parseTradovateStatement(noIdText);
    expect(result.trades).toHaveLength(3);
    expect(result.trades[0].external_id).toMatch(/^tradovate:MESZ4:/);
    expect(result.warnings.some((w) => /synthetic/i.test(w))).toBe(true);
  });
});
```

- [ ] **Step 3: Run tests to verify they fail**

```bash
npm test -- src/lib/parsers/tradovate-statement.test.ts
```

Expected: FAIL — 6 of 7 cases fail (only the empty-input case passes).

- [ ] **Step 4: Implement the parser**

Replace `src/lib/parsers/tradovate-statement.ts`:

```typescript
// ─── Tradovate Daily Statement parser ────────────────────────────────────────
// Pure function: text-extracted PDF in, ParseResult out. No I/O.
//
// Expected text layout (one trade per line in the "Filled Orders" block):
//   <order_id>  <symbol>  <Buy|Sell>  <qty>  <entry_time>  <entry_price>  <exit_time>  <exit_price>  <pnl>
// Whitespace can be runs of spaces or tabs.
// Times are local exchange time (CT) — we treat as UTC ISO for v1; timezone
// normalization is a v2 concern.

export interface ParsedTrade {
  external_id: string;
  symbol: string;
  bias: "long" | "short";
  entry_price: number;
  exit_price: number;
  entry_time: string;
  exit_time: string;
  qty: number;
  pnl: number;
}

export interface ParseResult {
  trades: ParsedTrade[];
  confidence: number;
  warnings: string[];
}

const TS = String.raw`\d{4}-\d{2}-\d{2}\s\d{2}:\d{2}:\d{2}`;
const NUM = String.raw`-?\d+(?:\.\d+)?`;

// Full-row regex when the Order ID column is present.
const ROW_WITH_ID = new RegExp(
  String.raw`^\s*(?<id>[A-Z]{2,}-\d+)\s+(?<sym>[A-Z]{1,6}\d?[A-Z0-9]{0,3})\s+(?<bs>Buy|Sell)\s+(?<qty>\d+)\s+(?<et>${TS})\s+(?<ep>${NUM})\s+(?<xt>${TS})\s+(?<xp>${NUM})\s+(?<pnl>${NUM})\s*$`,
  "i",
);

// Same row without an ID — synthesises external_id.
const ROW_NO_ID = new RegExp(
  String.raw`^\s*(?<sym>[A-Z]{1,6}\d?[A-Z0-9]{0,3})\s+(?<bs>Buy|Sell)\s+(?<qty>\d+)\s+(?<et>${TS})\s+(?<ep>${NUM})\s+(?<xt>${TS})\s+(?<xp>${NUM})\s+(?<pnl>${NUM})\s*$`,
  "i",
);

function toIso(localTs: string): string {
  // "2026-06-09 09:35:00" → "2026-06-09T09:35:00.000Z" (UTC stamp, no offset adjust)
  return new Date(localTs.replace(" ", "T") + "Z").toISOString();
}

function tryRow(line: string, hasIdColumn: boolean): { trade: ParsedTrade | null; matched: boolean } {
  const re = hasIdColumn ? ROW_WITH_ID : ROW_NO_ID;
  const m = line.match(re);
  if (!m || !m.groups) return { trade: null, matched: false };
  const g = m.groups;
  const symbol = g.sym.toUpperCase();
  const entryIso = toIso(g.et);
  const exitIso = toIso(g.xt);
  const qty = Number(g.qty);
  const pnl = Number(g.pnl);

  const external_id = hasIdColumn
    ? g.id
    : `tradovate:${symbol}:${entryIso}:${qty}:${pnl}`;

  return {
    trade: {
      external_id,
      symbol,
      bias: g.bs.toLowerCase() === "buy" ? "long" : "short",
      entry_price: Number(g.ep),
      exit_price: Number(g.xp),
      entry_time: entryIso,
      exit_time: exitIso,
      qty,
      pnl,
    },
    matched: true,
  };
}

export function parseTradovateStatement(text: string): ParseResult {
  if (!text || text.trim().length === 0) {
    return { trades: [], confidence: 0, warnings: ["Empty input"] };
  }

  const lines = text.split(/\r?\n/);
  const hasIdColumn = /Order\s*ID/i.test(text);
  const trades: ParsedTrade[] = [];
  const warnings: string[] = [];
  let candidateRows = 0;

  for (const raw of lines) {
    const line = raw.trim();
    if (!line) continue;
    // Skip non-row lines (headers, totals, account info).
    if (!/Buy|Sell/i.test(line)) continue;
    if (/B\/S/i.test(line)) continue;
    candidateRows++;
    const { trade, matched } = tryRow(line, hasIdColumn);
    if (matched && trade) {
      trades.push(trade);
    } else {
      warnings.push(`Skipped row: ${line.slice(0, 80)}`);
    }
  }

  if (!hasIdColumn && trades.length > 0) {
    warnings.push("Order ID column missing — used synthetic external_id");
  }

  const confidence = candidateRows === 0 ? 0 : trades.length / candidateRows;
  return { trades, confidence, warnings };
}
```

- [ ] **Step 5: Run tests to verify they pass**

```bash
npm test -- src/lib/parsers/tradovate-statement.test.ts
```

Expected: PASS — all 7 cases green.

- [ ] **Step 6: Run typecheck**

```bash
npm run typecheck
```

Expected: exit 0.

- [ ] **Step 7: Commit**

```bash
git add src/lib/parsers/
git commit -m "feat(parser): tradovate statement parser with confidence + synthesis fallback"
```

---

## Task 5: Real-PDF integration test (gated on Dylon's fixture)

**Files:**
- Create: `src/lib/parsers/tradovate-statement.integration.test.ts`

> **Blocker:** Requires `src/lib/parsers/__fixtures__/tradovate-statement-real.pdf`. If the fixture is not yet provided, skip this task and revisit when it lands.

- [ ] **Step 1: Write the integration test**

Create `src/lib/parsers/tradovate-statement.integration.test.ts`:

```typescript
import { describe, it, expect } from "vitest";
import { readFileSync, existsSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import pdfParse from "pdf-parse";
import { parseTradovateStatement } from "./tradovate-statement";

const FIXTURE = join(
  dirname(fileURLToPath(import.meta.url)),
  "__fixtures__",
  "tradovate-statement-real.pdf",
);

const exists = existsSync(FIXTURE);
const maybeIt = exists ? it : it.skip;

describe("parseTradovateStatement (real PDF)", () => {
  maybeIt("parses Dylon's real anonymized statement", async () => {
    const buf = readFileSync(FIXTURE);
    const pdf = await pdfParse(buf);
    const result = parseTradovateStatement(pdf.text);

    // Don't pin trade count — Dylon's fixture will vary. Pin the qualitative bar.
    expect(result.trades.length).toBeGreaterThan(0);
    expect(result.confidence).toBeGreaterThanOrEqual(0.85);
    expect(result.warnings.filter((w) => /skipped/i.test(w))).toHaveLength(0);

    // Spot-check first trade has all required fields populated.
    const first = result.trades[0];
    expect(first.symbol).toMatch(/^[A-Z]/);
    expect(first.bias).toMatch(/^(long|short)$/);
    expect(first.qty).toBeGreaterThan(0);
    expect(Number.isFinite(first.entry_price)).toBe(true);
    expect(Number.isFinite(first.exit_price)).toBe(true);
    expect(Number.isFinite(first.pnl)).toBe(true);
  });
});
```

- [ ] **Step 2: Run the test**

```bash
npm test -- src/lib/parsers/tradovate-statement.integration.test.ts
```

Expected if fixture exists: PASS. Expected if not: 1 skipped, 0 failed.

- [ ] **Step 3: If parse_confidence < 0.85 on real fixture**

The Task 4 regex is wrong for the real Tradovate layout. Refine `ROW_WITH_ID` / `ROW_NO_ID` regexes in `tradovate-statement.ts` until the real fixture passes. Re-run Task 4 unit tests after each change to ensure the mock fixture still passes.

- [ ] **Step 4: Commit**

```bash
git add src/lib/parsers/
git commit -m "test(parser): integration test against real anonymized tradovate PDF"
```

---

## Task 6: Export `mapRowToTrade` helper from existing CSV parser

**Files:**
- Modify: `src/lib/csvParser.ts`

> Spec §6 reuses the existing CSV parser's row-mapping logic. We need to expose the helper that turns a parsed-row object into a `Trade`. Inspect `csvParser.ts` first to find the existing helper — it may already be exported or inlined.

- [ ] **Step 1: Locate the row-to-trade helper in `csvParser.ts`**

```bash
grep -n "function.*Trade\|export" src/lib/csvParser.ts
```

Expected: identify the function (likely named `rowToTrade` or inlined inside `parseCSV`). Note its current name and signature.

- [ ] **Step 2: If inlined, extract it as a top-level exported function**

If `parseCSV` builds trades inline, refactor to extract the row-to-trade logic as an exported function. Keep the same call sites; just add the `export` keyword. If already exported, skip to Step 4.

Example refactor pattern (adapt to actual code):

```typescript
// Before: inline inside parseCSV
// After:
export function mapRowToTrade(row: Record<string, string>, mapping: Mapping): Trade {
  // ... existing body
}
```

- [ ] **Step 3: Run existing CSV parser tests**

```bash
npm test -- src/lib/csvParser
```

Expected: all existing tests pass — refactor must be behavior-preserving.

- [ ] **Step 4: Commit**

```bash
git add src/lib/csvParser.ts
git commit -m "refactor(csv): export mapRowToTrade for reuse by email-statement parser"
```

---

## Task 7: `InboundEmail` type definition

**Files:**
- Create: `api/email/providers/types.ts`

- [ ] **Step 1: Write the type definition**

Create `api/email/providers/types.ts`:

```typescript
// ─── Normalized inbound email envelope ───────────────────────────────────────
// Every provider adapter (Postmark v1, Postfix v2) maps to this shape.
// /api/email/inbound is provider-agnostic past this boundary.

export interface InboundAttachment {
  filename: string;
  contentType: string;
  contentBase64: string;
}

export interface InboundEmail {
  /** RFC 5322 Message-ID, used for replay protection. */
  messageId: string;
  /** Routing address — carries the `+token` alias. */
  to: string;
  /** Best-effort original sender (unwrapped from Gmail forwarding when possible). */
  from: string;
  subject: string;
  /** ISO 8601 UTC timestamp when the provider received the email. */
  receivedAt: string;
  attachments: InboundAttachment[];
  /** Full raw header map for fallback parsing of forwarded sender info. */
  rawHeaders: Record<string, string>;
}

export interface ProviderAdapter {
  /** Provider name for logging. */
  name: string;
  /** Verify signature/HMAC against raw body. Throws on rejection. */
  verify(rawBody: string, headers: Record<string, string>): void;
  /** Parse the provider's JSON into our normalized shape. */
  toInboundEmail(parsedBody: unknown): InboundEmail;
}
```

- [ ] **Step 2: Run typecheck**

```bash
npm run typecheck
```

Expected: exit 0.

- [ ] **Step 3: Commit**

```bash
git add api/email/providers/types.ts
git commit -m "feat(autojournal): inbound email type definition (provider-agnostic)"
```

---

## Task 8: Postmark adapter

**Files:**
- Create: `api/email/providers/postmark.ts`
- Create: `api/email/providers/postmark.test.ts`

- [ ] **Step 1: Write the failing tests**

Create `api/email/providers/postmark.test.ts`:

```typescript
import { describe, it, expect } from "vitest";
import { postmarkAdapter } from "./postmark";

const validBody = {
  MessageID: "msg-abc-123",
  To: "statements+abc123@in.kodatrade.co.uk",
  From: "user@example.com",
  Subject: "Fwd: Tradovate Daily Statement",
  Date: "2026-06-10T06:00:00Z",
  Headers: [
    { Name: "Reply-To", Value: "noreply@tradovate.com" },
  ],
  Attachments: [
    {
      Name: "statement.pdf",
      ContentType: "application/pdf",
      Content: "JVBERi0xLjQK", // base64 PDF magic bytes
    },
  ],
};

describe("postmarkAdapter.toInboundEmail", () => {
  it("maps a valid Postmark payload to InboundEmail", () => {
    const email = postmarkAdapter.toInboundEmail(validBody);
    expect(email.messageId).toBe("msg-abc-123");
    expect(email.to).toBe("statements+abc123@in.kodatrade.co.uk");
    expect(email.from).toBe("user@example.com");
    expect(email.subject).toBe("Fwd: Tradovate Daily Statement");
    expect(email.attachments).toHaveLength(1);
    expect(email.attachments[0].filename).toBe("statement.pdf");
    expect(email.attachments[0].contentType).toBe("application/pdf");
    expect(email.attachments[0].contentBase64).toBe("JVBERi0xLjQK");
    expect(email.rawHeaders["Reply-To"]).toBe("noreply@tradovate.com");
  });

  it("rejects payload with missing MessageID", () => {
    const bad = { ...validBody, MessageID: undefined };
    expect(() => postmarkAdapter.toInboundEmail(bad)).toThrow(/MessageID/);
  });
});

describe("postmarkAdapter.verify", () => {
  it("throws when signature header is missing", () => {
    expect(() => postmarkAdapter.verify("{}", {})).toThrow(/signature/i);
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

```bash
npm test -- api/email/providers/postmark.test.ts
```

Expected: FAIL — module not found.

- [ ] **Step 3: Implement the Postmark adapter**

Create `api/email/providers/postmark.ts`:

```typescript
import { createHmac, timingSafeEqual } from "node:crypto";
import type { InboundEmail, ProviderAdapter } from "./types";

interface PostmarkInboundPayload {
  MessageID: string;
  To: string;
  From: string;
  Subject: string;
  Date: string;
  Headers?: Array<{ Name: string; Value: string }>;
  Attachments?: Array<{ Name: string; ContentType: string; Content: string }>;
}

function isPayload(obj: unknown): obj is PostmarkInboundPayload {
  if (!obj || typeof obj !== "object") return false;
  const o = obj as Record<string, unknown>;
  return (
    typeof o.MessageID === "string" &&
    typeof o.To === "string" &&
    typeof o.From === "string" &&
    typeof o.Subject === "string" &&
    typeof o.Date === "string"
  );
}

function flattenHeaders(headers?: Array<{ Name: string; Value: string }>): Record<string, string> {
  const out: Record<string, string> = {};
  for (const h of headers ?? []) out[h.Name] = h.Value;
  return out;
}

export const postmarkAdapter: ProviderAdapter = {
  name: "postmark",

  verify(rawBody: string, headers: Record<string, string>): void {
    const sig = headers["x-postmark-signature"] ?? headers["X-Postmark-Signature"];
    if (!sig) throw new Error("Postmark signature header missing");
    const secret = process.env.POSTMARK_INBOUND_SECRET;
    if (!secret) throw new Error("POSTMARK_INBOUND_SECRET not configured");

    const expected = createHmac("sha256", secret).update(rawBody).digest("base64");
    const a = Buffer.from(sig);
    const b = Buffer.from(expected);
    if (a.length !== b.length || !timingSafeEqual(a, b)) {
      throw new Error("Postmark signature mismatch");
    }
  },

  toInboundEmail(parsedBody: unknown): InboundEmail {
    if (!isPayload(parsedBody)) {
      throw new Error("Postmark payload missing required fields (MessageID/To/From/Subject/Date)");
    }
    return {
      messageId: parsedBody.MessageID,
      to: parsedBody.To,
      from: parsedBody.From,
      subject: parsedBody.Subject,
      receivedAt: parsedBody.Date,
      attachments: (parsedBody.Attachments ?? []).map((a) => ({
        filename: a.Name,
        contentType: a.ContentType,
        contentBase64: a.Content,
      })),
      rawHeaders: flattenHeaders(parsedBody.Headers),
    };
  },
};
```

- [ ] **Step 4: Run tests to verify they pass**

```bash
npm test -- api/email/providers/postmark.test.ts
```

Expected: PASS — all 3 cases.

- [ ] **Step 5: Commit**

```bash
git add api/email/providers/
git commit -m "feat(autojournal): postmark inbound adapter + HMAC verify"
```

---

## Task 9: Postfix shim adapter stub (v2 scaffold)

**Files:**
- Create: `api/email/providers/postfix-shim.ts`

> Stub-only for v1. Returns a 501 when invoked. The real implementation lands when Dylon's private mail server is live.

- [ ] **Step 1: Write the stub**

Create `api/email/providers/postfix-shim.ts`:

```typescript
import type { InboundEmail, ProviderAdapter } from "./types";

/**
 * v2 self-hosted Postfix adapter. The companion Postfix-to-webhook shim
 * (lives on Dylon's private box, not in this repo) POSTs JSON shaped like
 * InboundEmail directly. Verification is a shared HMAC secret.
 *
 * v1 status: not in service. The /api/email/inbound endpoint should never
 * route here yet — but if env var POSTFIX_INBOUND_SECRET is set, this is
 * the adapter that gets used.
 */
export const postfixShimAdapter: ProviderAdapter = {
  name: "postfix-shim",

  verify(_rawBody: string, headers: Record<string, string>): void {
    const sig = headers["x-postfix-signature"] ?? headers["X-Postfix-Signature"];
    if (!sig) throw new Error("Postfix shim signature header missing");
    // Full HMAC implementation lands when the private server goes live.
    // For v1, this adapter is unreachable because the route is gated on
    // POSTFIX_INBOUND_SECRET being set.
    throw new Error("Postfix shim not yet implemented");
  },

  toInboundEmail(parsedBody: unknown): InboundEmail {
    if (!parsedBody || typeof parsedBody !== "object") {
      throw new Error("Postfix shim payload must be a JSON object");
    }
    return parsedBody as InboundEmail; // already in normalized shape
  },
};
```

- [ ] **Step 2: Typecheck**

```bash
npm run typecheck
```

Expected: exit 0.

- [ ] **Step 3: Commit**

```bash
git add api/email/providers/postfix-shim.ts
git commit -m "feat(autojournal): postfix shim adapter stub for v2 swap"
```

---

## Task 10: Email ingest core — token lookup and replay protection

**Files:**
- Create: `api/lib/email-ingest.ts`
- Create: `api/lib/email-ingest.test.ts`

- [ ] **Step 1: Write the failing tests**

Create `api/lib/email-ingest.test.ts`:

```typescript
import { describe, it, expect, vi, beforeEach } from "vitest";
import { ingestEmail } from "./email-ingest";
import type { InboundEmail } from "../email/providers/types";

const baseEmail: InboundEmail = {
  messageId: "msg-1",
  to: "statements+token123@in.kodatrade.co.uk",
  from: "noreply@tradovate.com",
  subject: "Tradovate Daily Statement",
  receivedAt: "2026-06-10T06:00:00Z",
  attachments: [],
  rawHeaders: {},
};

// Mock supabaseAdmin
const mockProfileSelect = vi.fn();
const mockImportInsert = vi.fn();
const mockImportSelect = vi.fn();

vi.mock("./supabaseAdmin", () => ({
  supabaseAdmin: {
    from: (table: string) => {
      if (table === "profiles") {
        return {
          select: () => ({
            eq: (..._args: unknown[]) => ({
              maybeSingle: () => mockProfileSelect(),
            }),
          }),
        };
      }
      if (table === "imports") {
        return {
          select: () => ({
            eq: (..._args: unknown[]) => ({
              maybeSingle: () => mockImportSelect(),
            }),
          }),
          insert: (row: unknown) => ({
            select: () => ({
              single: () => mockImportInsert(row),
            }),
          }),
        };
      }
      throw new Error(`Unmocked table: ${table}`);
    },
  },
}));

beforeEach(() => {
  mockProfileSelect.mockReset();
  mockImportInsert.mockReset();
  mockImportSelect.mockReset();
  process.env.AUTOJOURNAL_ALLOWED_SENDERS = "noreply@tradovate.com";
});

describe("ingestEmail — gating", () => {
  it("rejects when To address has no +token segment", async () => {
    const email = { ...baseEmail, to: "statements@in.kodatrade.co.uk" };
    const result = await ingestEmail(email);
    expect(result.status).toBe("rejected");
    expect(result.reason).toMatch(/token/i);
  });

  it("rejects when token does not match any profile", async () => {
    mockProfileSelect.mockResolvedValue({ data: null, error: null });
    const result = await ingestEmail(baseEmail);
    expect(result.status).toBe("rejected");
    expect(result.reason).toMatch(/unknown token/i);
  });

  it("rejects when sender is not allowlisted", async () => {
    mockProfileSelect.mockResolvedValue({ data: { id: "user-1" }, error: null });
    const email = { ...baseEmail, from: "phisher@evil.com" };
    const result = await ingestEmail(email);
    expect(result.status).toBe("rejected");
    expect(result.reason).toMatch(/sender/i);
  });

  it("rejects replay when email_message_id already exists", async () => {
    mockProfileSelect.mockResolvedValue({ data: { id: "user-1" }, error: null });
    mockImportSelect.mockResolvedValue({ data: { id: "existing-import" }, error: null });
    const result = await ingestEmail(baseEmail);
    expect(result.status).toBe("rejected");
    expect(result.reason).toMatch(/replay/i);
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

```bash
npm test -- api/lib/email-ingest.test.ts
```

Expected: FAIL — module not found.

- [ ] **Step 3: Implement the gating layer**

Create `api/lib/email-ingest.ts`:

```typescript
import { supabaseAdmin } from "./supabaseAdmin";
import type { InboundEmail } from "../email/providers/types";

export type IngestResult =
  | { status: "rejected"; reason: string }
  | { status: "no_trades"; reason: string; importId: string }
  | { status: "ok"; importId: string; tradeCount: number; duplicateCount: number };

function extractToken(to: string): string | null {
  // statements+abc123@in.kodatrade.co.uk → abc123
  const m = to.match(/^[^+]+\+([a-z0-9]+)@/i);
  return m ? m[1].toLowerCase() : null;
}

function unwrapSender(email: InboundEmail): string {
  // Gmail forwarding rewrites From: to the forwarder. Original sender
  // lives in Reply-To (or X-Forwarded-For). Postmark gives us both as
  // headers and as From if not forwarded.
  const replyTo = email.rawHeaders["Reply-To"] ?? email.rawHeaders["reply-to"];
  if (replyTo) return replyTo.toLowerCase().trim();
  return email.from.toLowerCase().trim();
}

function isAllowedSender(sender: string): boolean {
  const list = (process.env.AUTOJOURNAL_ALLOWED_SENDERS ?? "")
    .split(",")
    .map((s) => s.trim().toLowerCase())
    .filter(Boolean);
  return list.includes(sender);
}

export async function ingestEmail(email: InboundEmail): Promise<IngestResult> {
  // Gate 1: token in To address
  const token = extractToken(email.to);
  if (!token) return { status: "rejected", reason: "No +token segment in To address" };

  // Gate 2: token resolves to a user
  const { data: profile } = await supabaseAdmin
    .from("profiles")
    .select("id")
    .eq("email_ingest_token", token)
    .maybeSingle();
  if (!profile) return { status: "rejected", reason: "Unknown token" };

  // Gate 3: sender allowlist
  const sender = unwrapSender(email);
  if (!isAllowedSender(sender)) {
    return { status: "rejected", reason: `Sender not allowlisted: ${sender}` };
  }

  // Gate 4: replay protection
  const { data: existing } = await supabaseAdmin
    .from("imports")
    .select("id")
    .eq("email_message_id", email.messageId)
    .maybeSingle();
  if (existing) return { status: "rejected", reason: "Replay — message_id already processed" };

  // TODO Task 11+: PDF extract → parse → dedupe → save
  return { status: "no_trades", reason: "Pipeline not yet implemented", importId: "" };
}
```

- [ ] **Step 4: Run tests to verify they pass**

```bash
npm test -- api/lib/email-ingest.test.ts
```

Expected: PASS — all 4 gating cases.

- [ ] **Step 5: Commit**

```bash
git add api/lib/email-ingest.ts api/lib/email-ingest.test.ts
git commit -m "feat(autojournal): email ingest gating (token, sender, replay)"
```

---

## Task 11: Email ingest — PDF extraction and parser delegation

**Files:**
- Modify: `api/lib/email-ingest.ts`
- Modify: `api/lib/email-ingest.test.ts`

- [ ] **Step 1: Add failing tests**

Append to `api/lib/email-ingest.test.ts` (inside the file, after the existing `describe("ingestEmail — gating")` block):

```typescript
describe("ingestEmail — PDF extraction", () => {
  it("rejects when no PDF attachment is present", async () => {
    mockProfileSelect.mockResolvedValue({ data: { id: "user-1" }, error: null });
    mockImportSelect.mockResolvedValue({ data: null, error: null });
    const result = await ingestEmail(baseEmail);
    expect(result.status).toBe("rejected");
    expect(result.reason).toMatch(/pdf/i);
  });
});
```

- [ ] **Step 2: Run to verify it fails**

```bash
npm test -- api/lib/email-ingest.test.ts
```

Expected: 1 fail (new case), 4 pass.

- [ ] **Step 3: Add PDF extraction to email-ingest.ts**

In `api/lib/email-ingest.ts`, replace the `// TODO Task 11+:` section with:

```typescript
  // Gate 5: PDF attachment present
  const pdfAttachment = email.attachments.find(
    (a) => a.contentType === "application/pdf" || a.filename.toLowerCase().endsWith(".pdf"),
  );
  if (!pdfAttachment) return { status: "rejected", reason: "No PDF attachment" };

  // Extract text
  const pdfBuffer = Buffer.from(pdfAttachment.contentBase64, "base64");
  // Lazy-import pdf-parse so the test mock doesn't have to deal with the constructor.
  const pdfParse = (await import("pdf-parse")).default;
  const pdf = await pdfParse(pdfBuffer);

  // Parse
  const { parseTradovateStatement } = await import("../../src/lib/parsers/tradovate-statement");
  const parsed = parseTradovateStatement(pdf.text);

  if (parsed.trades.length === 0) {
    return { status: "no_trades", reason: "Parser returned zero trades", importId: "" };
  }

  // TODO Task 12+: dedupe + save trades + insert imports row
  return { status: "no_trades", reason: "Save not yet implemented", importId: "" };
```

- [ ] **Step 4: Run all tests**

```bash
npm test -- api/lib/email-ingest.test.ts
```

Expected: PASS — all 5 cases.

- [ ] **Step 5: Commit**

```bash
git add api/lib/email-ingest.ts api/lib/email-ingest.test.ts
git commit -m "feat(autojournal): PDF extract + tradovate parser delegation"
```

---

## Task 12: Email ingest — dedupe + save

**Files:**
- Modify: `api/lib/email-ingest.ts`
- Modify: `api/lib/email-ingest.test.ts`

- [ ] **Step 1: Add failing test**

Append to `api/lib/email-ingest.test.ts` — also extend the mock to cover trade-insert. Replace the `vi.mock("./supabaseAdmin", ...)` block with this fuller version:

```typescript
const mockTradeInsert = vi.fn();
const mockExistingTradeIds = vi.fn();

vi.mock("./supabaseAdmin", () => ({
  supabaseAdmin: {
    from: (table: string) => {
      if (table === "profiles") {
        return {
          select: () => ({
            eq: () => ({ maybeSingle: () => mockProfileSelect() }),
          }),
        };
      }
      if (table === "imports") {
        return {
          select: () => ({
            eq: () => ({ maybeSingle: () => mockImportSelect() }),
          }),
          insert: (row: unknown) => ({
            select: () => ({ single: () => mockImportInsert(row) }),
          }),
        };
      }
      if (table === "trades") {
        return {
          select: () => ({
            eq: () => ({ in: () => mockExistingTradeIds() }),
          }),
          insert: (rows: unknown) => mockTradeInsert(rows),
        };
      }
      throw new Error(`Unmocked table: ${table}`);
    },
  },
}));
```

Add to the `beforeEach`:

```typescript
  mockTradeInsert.mockReset();
  mockExistingTradeIds.mockReset();
```

Add a new describe block at the end:

```typescript
describe("ingestEmail — save path", () => {
  // Minimal PDF that pdf-parse will accept (real test will be integration).
  // For unit purposes, we stub pdf-parse via the parser module.
  it("saves trades and returns ok status", async () => {
    mockProfileSelect.mockResolvedValue({ data: { id: "user-1" }, error: null });
    mockImportSelect.mockResolvedValue({ data: null, error: null });
    mockExistingTradeIds.mockResolvedValue({ data: [], error: null });
    mockImportInsert.mockResolvedValue({ data: { id: "import-1" }, error: null });
    mockTradeInsert.mockResolvedValue({ data: null, error: null });

    // Stub pdf-parse + parser via vi.mock for this test alone:
    vi.doMock("pdf-parse", () => ({
      default: vi.fn().mockResolvedValue({
        text:
          "Order ID Symbol B/S Qty Entry Time Entry Price Exit Time Exit Price P&L\n" +
          "TVE-9001 MESZ4 Buy 1 2026-06-09 09:35:00 5920.25 2026-06-09 09:52:00 5928.50 41.25",
      }),
    }));

    const email: InboundEmail = {
      ...baseEmail,
      attachments: [{ filename: "s.pdf", contentType: "application/pdf", contentBase64: "JVBERi0=" }],
    };

    const result = await ingestEmail(email);
    expect(result.status).toBe("ok");
    if (result.status === "ok") {
      expect(result.importId).toBe("import-1");
      expect(result.tradeCount).toBe(1);
      expect(result.duplicateCount).toBe(0);
    }
    expect(mockTradeInsert).toHaveBeenCalledOnce();
  });

  it("skips duplicates already present in trades", async () => {
    mockProfileSelect.mockResolvedValue({ data: { id: "user-1" }, error: null });
    mockImportSelect.mockResolvedValue({ data: null, error: null });
    mockExistingTradeIds.mockResolvedValue({
      data: [{ external_id: "TVE-9001" }],
      error: null,
    });
    mockImportInsert.mockResolvedValue({ data: { id: "import-2" }, error: null });
    mockTradeInsert.mockResolvedValue({ data: null, error: null });

    const email: InboundEmail = {
      ...baseEmail,
      messageId: "msg-2",
      attachments: [{ filename: "s.pdf", contentType: "application/pdf", contentBase64: "JVBERi0=" }],
    };

    const result = await ingestEmail(email);
    expect(result.status).toBe("ok");
    if (result.status === "ok") {
      expect(result.tradeCount).toBe(0);
      expect(result.duplicateCount).toBe(1);
    }
  });
});
```

- [ ] **Step 2: Run to verify failures**

```bash
npm test -- api/lib/email-ingest.test.ts
```

Expected: 2 fail (new cases), 5 pass.

- [ ] **Step 3: Implement save path**

In `api/lib/email-ingest.ts`, replace the `// TODO Task 12+:` section with:

```typescript
  // Dedupe against existing trades for this user
  const externalIds = parsed.trades.map((t) => t.external_id);
  const { data: existingTrades } = await supabaseAdmin
    .from("trades")
    .select("external_id")
    .eq("user_id", profile.id)
    .in("external_id", externalIds);

  const existingSet = new Set((existingTrades ?? []).map((r: { external_id: string }) => r.external_id));
  const newTrades = parsed.trades.filter((t) => !existingSet.has(t.external_id));
  const duplicateCount = parsed.trades.length - newTrades.length;

  // Insert the import row first so trades can FK to it
  const { data: importRow, error: importErr } = await supabaseAdmin
    .from("imports")
    .insert({
      user_id: profile.id,
      filename: pdfAttachment.filename,
      storage_path: "", // populated in Task 13 when raw PDF uploads
      broker: "tradovate",
      account_type: null,
      row_count: parsed.trades.length,
      imported_count: newTrades.length,
      duplicate_count: duplicateCount,
      file_size_bytes: pdfBuffer.length,
      source: "email_statement",
      email_message_id: email.messageId,
      review_state: "pending",
      parse_confidence: parsed.confidence,
    })
    .select("id")
    .single();

  if (importErr || !importRow) {
    return { status: "rejected", reason: `Import insert failed: ${importErr?.message}` };
  }

  // Insert trades (skip when nothing new)
  if (newTrades.length > 0) {
    const rows = newTrades.map((t) => ({
      user_id: profile.id,
      external_id: t.external_id,
      pair: t.symbol,
      bias: t.bias,
      entry_price: t.entry_price,
      exit_price: t.exit_price,
      qty: t.qty,
      pnl: t.pnl,
      date: t.entry_time,
      import_id: importRow.id,
      source: "email_statement",
      auto_logged: true,
    }));
    const { error: tradesErr } = await supabaseAdmin.from("trades").insert(rows);
    if (tradesErr) {
      return { status: "rejected", reason: `Trade insert failed: ${tradesErr.message}` };
    }
  }

  return {
    status: "ok",
    importId: importRow.id,
    tradeCount: newTrades.length,
    duplicateCount,
  };
```

- [ ] **Step 4: Run all tests**

```bash
npm test -- api/lib/email-ingest.test.ts
```

Expected: PASS — all 7 cases.

- [ ] **Step 5: Run typecheck**

```bash
npm run typecheck
```

Expected: exit 0.

- [ ] **Step 6: Commit**

```bash
git add api/lib/email-ingest.ts api/lib/email-ingest.test.ts
git commit -m "feat(autojournal): dedupe + save path for email-statement ingest"
```

---

## Task 13: Email ingest — raw PDF storage upload

**Files:**
- Modify: `api/lib/email-ingest.ts`

> Store the raw PDF in the existing `trade-imports` bucket under the user's folder, then update the imports row with the path. Same bucket as manual CSV uploads — RLS is already correct.

- [ ] **Step 1: Add upload step**

In `api/lib/email-ingest.ts`, after the `importRow` is inserted and before the `trades` insert, add:

```typescript
  // Upload raw PDF to existing private bucket
  const storagePath = `${profile.id}/email/${importRow.id}.pdf`;
  const { error: uploadErr } = await supabaseAdmin.storage
    .from("trade-imports")
    .upload(storagePath, pdfBuffer, {
      contentType: "application/pdf",
      upsert: false,
    });
  if (uploadErr) {
    // Non-fatal — log via warning, continue with trade save.
    console.warn("[autojournal] raw PDF upload failed:", uploadErr.message);
  } else {
    await supabaseAdmin
      .from("imports")
      .update({ storage_path: storagePath })
      .eq("id", importRow.id);
  }
```

- [ ] **Step 2: Add storage mock for tests**

In `api/lib/email-ingest.test.ts`, extend the supabaseAdmin mock to handle `.storage.from(...).upload(...)`:

```typescript
const mockStorageUpload = vi.fn();
```

Update the `vi.mock("./supabaseAdmin", ...)` factory to add a `storage` key:

```typescript
vi.mock("./supabaseAdmin", () => ({
  supabaseAdmin: {
    from: (table: string) => {
      /* existing handlers */
    },
    storage: {
      from: () => ({
        upload: () => mockStorageUpload(),
      }),
    },
  },
}));
```

Add `mockStorageUpload.mockReset(); mockStorageUpload.mockResolvedValue({ data: { path: "x" }, error: null });` to the existing `beforeEach`. Also handle the new `.update().eq()` on imports — update the imports handler in the mock factory to:

```typescript
      if (table === "imports") {
        return {
          select: () => ({
            eq: () => ({ maybeSingle: () => mockImportSelect() }),
          }),
          insert: (row: unknown) => ({
            select: () => ({ single: () => mockImportInsert(row) }),
          }),
          update: () => ({ eq: () => Promise.resolve({ data: null, error: null }) }),
        };
      }
```

- [ ] **Step 3: Run tests**

```bash
npm test -- api/lib/email-ingest.test.ts
```

Expected: PASS — all 7 cases.

- [ ] **Step 4: Commit**

```bash
git add api/lib/email-ingest.ts api/lib/email-ingest.test.ts
git commit -m "feat(autojournal): upload raw PDF to trade-imports bucket"
```

---

## Task 14: Email ingest — push notification on success

**Files:**
- Modify: `api/lib/email-ingest.ts`

- [ ] **Step 1: Locate existing push helper**

```bash
grep -rn "webpush.sendNotification\|export.*push\|sendPush" api/lib/ api/push.ts
```

Expected: identify the existing send function in `api/push.ts` (used by chat/circle features). Note its signature.

- [ ] **Step 2: Wire push send**

Just before the final `return { status: "ok", ...}` in `email-ingest.ts`, add:

```typescript
  // Best-effort push notification — never fails the ingest path.
  try {
    const { sendPushToUser } = await import("../push");
    await sendPushToUser(profile.id, {
      title: "Kōda AutoJournal",
      body:
        newTrades.length === 1
          ? "1 trade auto-logged from your Tradovate statement."
          : `${newTrades.length} trades auto-logged from your Tradovate statement.`,
      url: "/?banner=autoimport",
    });
  } catch (err) {
    console.warn("[autojournal] push notification failed:", (err as Error).message);
  }
```

> **If `sendPushToUser` does not exist** in `api/push.ts` with this signature, adapt to the existing API. Search for how `circle_messages` triggers a push and mirror that pattern.

- [ ] **Step 3: Run tests**

```bash
npm test -- api/lib/email-ingest.test.ts
```

Expected: PASS — still 7 cases (push is best-effort and try/catch'd, no new tests needed since failure is silent).

- [ ] **Step 4: Commit**

```bash
git add api/lib/email-ingest.ts
git commit -m "feat(autojournal): push notify user when trades are auto-logged"
```

---

## Task 15: Inbound webhook endpoint

**Files:**
- Create: `api/email/inbound.ts`

- [ ] **Step 1: Write the endpoint**

Create `api/email/inbound.ts`:

```typescript
import type { VercelRequest, VercelResponse } from "@vercel/node";
import { postmarkAdapter } from "./providers/postmark";
import { postfixShimAdapter } from "./providers/postfix-shim";
import type { ProviderAdapter } from "./providers/types";
import { ingestEmail } from "../lib/email-ingest";
import * as Sentry from "@sentry/node";

function pickAdapter(req: VercelRequest): ProviderAdapter {
  const fromQuery = (req.query.provider as string | undefined)?.toLowerCase();
  if (fromQuery === "postmark") return postmarkAdapter;
  if (fromQuery === "postfix") return postfixShimAdapter;
  return postmarkAdapter; // v1 default
}

function normalizeHeaders(raw: VercelRequest["headers"]): Record<string, string> {
  const out: Record<string, string> = {};
  for (const [k, v] of Object.entries(raw)) {
    if (typeof v === "string") out[k] = v;
    else if (Array.isArray(v)) out[k] = v[0];
  }
  return out;
}

export default async function handler(req: VercelRequest, res: VercelResponse): Promise<void> {
  if (req.method !== "POST") {
    res.status(405).json({ error: "Method not allowed" });
    return;
  }

  const adapter = pickAdapter(req);
  const rawBody =
    typeof req.body === "string" ? req.body : JSON.stringify(req.body ?? {});
  const headers = normalizeHeaders(req.headers);

  try {
    adapter.verify(rawBody, headers);
  } catch (err) {
    // Don't leak details to caller; capture for our debugging.
    Sentry.captureException(err, { extra: { adapter: adapter.name } });
    res.status(401).json({ error: "Signature verification failed" });
    return;
  }

  let email;
  try {
    email = adapter.toInboundEmail(typeof req.body === "object" ? req.body : JSON.parse(rawBody));
  } catch (err) {
    Sentry.captureException(err, { extra: { adapter: adapter.name } });
    res.status(400).json({ error: "Malformed payload" });
    return;
  }

  try {
    const result = await ingestEmail(email);
    // Always 200 to the provider so they don't retry. Failures are user-facing
    // via push / email reply (handled inside ingestEmail eventually).
    res.status(200).json({ status: result.status });
    if (result.status === "rejected") {
      Sentry.addBreadcrumb({ category: "autojournal", message: `Rejected: ${result.reason}` });
    }
  } catch (err) {
    Sentry.captureException(err, { extra: { messageId: email.messageId } });
    res.status(500).json({ error: "Ingest failed" });
  }
}
```

- [ ] **Step 2: Typecheck**

```bash
npm run typecheck
```

Expected: exit 0.

- [ ] **Step 3: Commit**

```bash
git add api/email/inbound.ts
git commit -m "feat(autojournal): /api/email/inbound webhook entry point"
```

---

## Task 16: Client data layer — pending imports + token

**Files:**
- Create: `src/data/autoImport.ts`
- Create: `src/data/autoImport.test.ts`

- [ ] **Step 1: Write the failing tests**

Create `src/data/autoImport.test.ts`:

```typescript
import { describe, it, expect, vi, beforeEach } from "vitest";
import {
  getPendingImport,
  markReviewed,
  undoImport,
  ensureIngestToken,
  buildForwardingAddress,
} from "./autoImport";

vi.mock("../lib/supabase", () => ({
  supabase: {
    auth: { getUser: vi.fn() },
    from: vi.fn(),
    rpc: vi.fn(),
  },
}));

import { supabase } from "../lib/supabase";

beforeEach(() => {
  vi.clearAllMocks();
});

describe("buildForwardingAddress", () => {
  it("returns null when no token", () => {
    expect(buildForwardingAddress(null)).toBeNull();
  });
  it("builds statements+token@in.kodatrade.co.uk", () => {
    expect(buildForwardingAddress("abc123")).toBe("statements+abc123@in.kodatrade.co.uk");
  });
});

describe("getPendingImport", () => {
  it("returns null when no pending row", async () => {
    (supabase.auth.getUser as ReturnType<typeof vi.fn>).mockResolvedValue({
      data: { user: { id: "u1" } },
      error: null,
    });
    (supabase.from as ReturnType<typeof vi.fn>).mockReturnValue({
      select: () => ({
        eq: () => ({
          eq: () => ({
            order: () => ({
              limit: () => ({
                maybeSingle: () => Promise.resolve({ data: null, error: null }),
              }),
            }),
          }),
        }),
      }),
    });
    const result = await getPendingImport();
    expect(result).toBeNull();
  });
});
```

- [ ] **Step 2: Run to verify failure**

```bash
npm test -- src/data/autoImport.test.ts
```

Expected: FAIL — module not found.

- [ ] **Step 3: Implement the data layer**

Create `src/data/autoImport.ts`:

```typescript
import { supabase } from "../lib/supabase";

export interface PendingImport {
  id: string;
  created_at: string;
  imported_count: number;
  duplicate_count: number;
  parse_confidence: number | null;
}

export function buildForwardingAddress(token: string | null): string | null {
  if (!token) return null;
  return `statements+${token}@in.kodatrade.co.uk`;
}

export async function getPendingImport(): Promise<PendingImport | null> {
  const { data: userData } = await supabase.auth.getUser();
  const userId = userData.user?.id;
  if (!userId) return null;

  const { data, error } = await supabase
    .from("imports")
    .select("id, created_at, imported_count, duplicate_count, parse_confidence")
    .eq("user_id", userId)
    .eq("review_state", "pending")
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (error || !data) return null;
  return data as PendingImport;
}

export async function markReviewed(importId: string): Promise<void> {
  await supabase
    .from("imports")
    .update({ review_state: "reviewed" })
    .eq("id", importId);
}

export async function undoImport(importId: string): Promise<{ deleted: number }> {
  const { data: userData } = await supabase.auth.getUser();
  const userId = userData.user?.id;
  if (!userId) return { deleted: 0 };

  // Delete trades first (FK is on delete set null, so this is for cleanliness).
  const { data: deleted } = await supabase
    .from("trades")
    .delete()
    .eq("user_id", userId)
    .eq("import_id", importId)
    .select("id");

  await supabase
    .from("imports")
    .update({ review_state: "undone" })
    .eq("id", importId);

  return { deleted: (deleted ?? []).length };
}

export async function ensureIngestToken(): Promise<string | null> {
  const { data: userData } = await supabase.auth.getUser();
  const userId = userData.user?.id;
  if (!userId) return null;

  const { data: profile } = await supabase
    .from("profiles")
    .select("email_ingest_token")
    .eq("id", userId)
    .maybeSingle();

  if (profile?.email_ingest_token) return profile.email_ingest_token as string;

  // Generate 8 hex chars client-side. Token is never sensitive — sender allowlist
  // is the real auth gate. Client-side is fine and avoids a round trip.
  const token = Array.from(crypto.getRandomValues(new Uint8Array(4)))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");

  const { error } = await supabase
    .from("profiles")
    .update({ email_ingest_token: token })
    .eq("id", userId);

  if (error) return null;
  return token;
}

export async function regenerateIngestToken(): Promise<string | null> {
  const { data: userData } = await supabase.auth.getUser();
  const userId = userData.user?.id;
  if (!userId) return null;

  const token = Array.from(crypto.getRandomValues(new Uint8Array(4)))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");

  const { error } = await supabase
    .from("profiles")
    .update({ email_ingest_token: token })
    .eq("id", userId);
  if (error) return null;
  return token;
}
```

- [ ] **Step 4: Run tests**

```bash
npm test -- src/data/autoImport.test.ts
```

Expected: PASS — all 3 cases.

- [ ] **Step 5: Commit**

```bash
git add src/data/autoImport.ts src/data/autoImport.test.ts
git commit -m "feat(autojournal): client data layer (pending import, undo, token mgmt)"
```

---

## Task 17: AutoImportSettings screen

**Files:**
- Create: `src/screens/AutoImportSettings.tsx`

- [ ] **Step 1: Build the component**

Create `src/screens/AutoImportSettings.tsx`:

```typescript
import { useEffect, useState } from "react";
import {
  buildForwardingAddress,
  ensureIngestToken,
  regenerateIngestToken,
} from "../data/autoImport";
import { trackEvent } from "../lib/posthog";

export function AutoImportSettings(): JSX.Element {
  const [token, setToken] = useState<string | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [copied, setCopied] = useState<boolean>(false);

  useEffect(() => {
    let cancelled = false;
    ensureIngestToken().then((t) => {
      if (cancelled) return;
      setToken(t);
      setLoading(false);
      if (t) trackEvent("autoimport_setup_started");
    });
    return () => {
      cancelled = true;
    };
  }, []);

  const address = buildForwardingAddress(token);

  async function copy(): Promise<void> {
    if (!address) return;
    await navigator.clipboard.writeText(address);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  }

  async function regenerate(): Promise<void> {
    if (!confirm("Regenerate? Your current forwarding alias will stop working.")) return;
    setLoading(true);
    const next = await regenerateIngestToken();
    setToken(next);
    setLoading(false);
  }

  if (loading) return <div className="p-6 text-sm opacity-60">Loading…</div>;
  if (!address) {
    return (
      <div className="p-6 text-sm opacity-60">
        Sign in to set up Auto-import.
      </div>
    );
  }

  return (
    <div className="p-6 space-y-6">
      <header>
        <h1 className="text-xl font-semibold">Auto-import</h1>
        <p className="text-sm opacity-70 mt-1">
          Forward your Tradovate daily statement to the address below. We'll
          parse it and auto-log every trade.
        </p>
      </header>

      <section className="rounded-xl border border-white/10 bg-white/5 p-4">
        <label className="text-xs uppercase tracking-wide opacity-60">
          Your forwarding address
        </label>
        <div className="mt-2 flex items-center gap-2">
          <code className="flex-1 break-all font-mono text-sm">{address}</code>
          <button
            type="button"
            onClick={copy}
            className="px-3 py-1.5 rounded-md bg-white/10 hover:bg-white/20 text-sm"
          >
            {copied ? "Copied" : "Copy"}
          </button>
        </div>
        <button
          type="button"
          onClick={regenerate}
          className="mt-3 text-xs opacity-60 hover:opacity-100 underline"
        >
          Regenerate (breaks current forwarding)
        </button>
      </section>

      <section className="rounded-xl border border-white/10 bg-white/5 p-4 space-y-3">
        <h2 className="font-medium text-sm">Setup in 3 steps</h2>
        <ol className="text-sm space-y-2 list-decimal pl-5 opacity-90">
          <li>
            In Tradovate → <strong>Account → Notifications</strong>, toggle
            "Email daily statement" ON.
          </li>
          <li>
            In Gmail → <strong>Settings → Filters</strong>, create: From{" "}
            <code className="text-xs">noreply@tradovate.com</code> → Forward to{" "}
            <code className="text-xs break-all">{address}</code>.
          </li>
          <li>
            Done. Tomorrow's statement will auto-log your trades.
          </li>
        </ol>
      </section>
    </div>
  );
}
```

- [ ] **Step 2: Typecheck**

```bash
npm run typecheck
```

Expected: exit 0.

- [ ] **Step 3: Commit**

```bash
git add src/screens/AutoImportSettings.tsx
git commit -m "feat(autojournal): Auto-import settings screen"
```

---

## Task 18: AutoJournalBanner component

**Files:**
- Create: `src/components/AutoJournalBanner.tsx`

- [ ] **Step 1: Build the component**

Create `src/components/AutoJournalBanner.tsx`:

```typescript
import { useEffect, useState } from "react";
import {
  getPendingImport,
  markReviewed,
  undoImport,
  type PendingImport,
} from "../data/autoImport";
import { trackEvent } from "../lib/posthog";

interface Props {
  onReview: (importId: string) => void;
}

export function AutoJournalBanner({ onReview }: Props): JSX.Element | null {
  const [pending, setPending] = useState<PendingImport | null>(null);
  const [busy, setBusy] = useState<boolean>(false);

  useEffect(() => {
    let cancelled = false;
    getPendingImport().then((p) => {
      if (!cancelled) {
        setPending(p);
        if (p) trackEvent("autoimport_banner_viewed");
      }
    });
    return () => {
      cancelled = true;
    };
  }, []);

  if (!pending) return null;

  async function handleReview(): Promise<void> {
    trackEvent("autoimport_batch_reviewed");
    onReview(pending!.id);
    await markReviewed(pending!.id);
    setPending(null);
  }

  async function handleUndo(): Promise<void> {
    if (!confirm(`Undo all ${pending!.imported_count} auto-logged trades?`)) return;
    setBusy(true);
    trackEvent("autoimport_batch_undone");
    await undoImport(pending!.id);
    setBusy(false);
    setPending(null);
  }

  async function handleDismiss(): Promise<void> {
    await markReviewed(pending!.id);
    setPending(null);
  }

  const lowConfidence =
    pending.parse_confidence !== null && pending.parse_confidence < 0.7;

  return (
    <div
      className={`rounded-xl border p-3 mb-3 ${
        lowConfidence
          ? "border-amber-500/40 bg-amber-500/10"
          : "border-white/10 bg-white/5"
      }`}
    >
      <div className="text-sm">
        <strong>{pending.imported_count}</strong>{" "}
        {pending.imported_count === 1 ? "trade" : "trades"} auto-logged from your
        Tradovate statement
        {pending.duplicate_count > 0 && (
          <span className="opacity-60"> (+{pending.duplicate_count} dupes skipped)</span>
        )}
        {lowConfidence && (
          <span className="block text-amber-400 text-xs mt-1">
            Parse quality low — please review.
          </span>
        )}
      </div>
      <div className="mt-2 flex gap-2 text-sm">
        <button
          type="button"
          disabled={busy}
          onClick={handleReview}
          className="px-3 py-1.5 rounded-md bg-white/10 hover:bg-white/20"
        >
          Review
        </button>
        <button
          type="button"
          disabled={busy}
          onClick={handleUndo}
          className="px-3 py-1.5 rounded-md hover:bg-white/10 opacity-70"
        >
          Undo all
        </button>
        <button
          type="button"
          disabled={busy}
          onClick={handleDismiss}
          className="ml-auto px-3 py-1.5 rounded-md hover:bg-white/10 opacity-50 text-xs"
        >
          Dismiss
        </button>
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Typecheck**

```bash
npm run typecheck
```

Expected: exit 0.

- [ ] **Step 3: Commit**

```bash
git add src/components/AutoJournalBanner.tsx
git commit -m "feat(autojournal): top-of-feed banner with review/undo/dismiss"
```

---

## Task 19: AutoJournalReviewSheet

**Files:**
- Create: `src/components/AutoJournalReviewSheet.tsx`

- [ ] **Step 1: Build the component**

Create `src/components/AutoJournalReviewSheet.tsx`:

```typescript
import { useEffect, useState } from "react";
import { supabase } from "../lib/supabase";

interface TradeRow {
  id: string;
  pair: string;
  bias: string;
  entry_price: number;
  exit_price: number;
  qty: number;
  pnl: number;
  date: string;
}

interface Props {
  importId: string;
  onClose: () => void;
}

export function AutoJournalReviewSheet({ importId, onClose }: Props): JSX.Element {
  const [rows, setRows] = useState<TradeRow[]>([]);
  const [loading, setLoading] = useState<boolean>(true);

  useEffect(() => {
    let cancelled = false;
    supabase
      .from("trades")
      .select("id, pair, bias, entry_price, exit_price, qty, pnl, date")
      .eq("import_id", importId)
      .order("date", { ascending: true })
      .then(({ data }) => {
        if (!cancelled) {
          setRows((data ?? []) as TradeRow[]);
          setLoading(false);
        }
      });
    return () => {
      cancelled = true;
    };
  }, [importId]);

  return (
    <div
      className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/60"
      onClick={onClose}
    >
      <div
        className="w-full max-w-lg max-h-[80vh] overflow-y-auto bg-zinc-950 rounded-t-2xl sm:rounded-2xl p-4"
        onClick={(e) => e.stopPropagation()}
      >
        <header className="flex items-center justify-between mb-3">
          <h2 className="font-semibold">Review auto-logged trades</h2>
          <button type="button" onClick={onClose} className="opacity-60 hover:opacity-100">
            Close
          </button>
        </header>

        {loading ? (
          <div className="text-sm opacity-60">Loading…</div>
        ) : rows.length === 0 ? (
          <div className="text-sm opacity-60">No trades in this batch.</div>
        ) : (
          <ul className="space-y-2">
            {rows.map((t) => (
              <li
                key={t.id}
                className="rounded-md border border-white/10 p-2 text-sm flex justify-between"
              >
                <div>
                  <div className="font-mono">
                    {t.pair} · {t.bias === "long" ? "LONG" : "SHORT"} · {t.qty}
                  </div>
                  <div className="text-xs opacity-60">
                    {t.entry_price} → {t.exit_price} ·{" "}
                    {new Date(t.date).toLocaleString()}
                  </div>
                </div>
                <div
                  className={`font-mono ${
                    t.pnl >= 0 ? "text-emerald-400" : "text-rose-400"
                  }`}
                >
                  {t.pnl >= 0 ? "+" : ""}
                  {t.pnl.toFixed(2)}
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Typecheck**

```bash
npm run typecheck
```

Expected: exit 0.

- [ ] **Step 3: Commit**

```bash
git add src/components/AutoJournalReviewSheet.tsx
git commit -m "feat(autojournal): review sheet listing trades in a batch"
```

---

## Task 20: Wire banner into Home feed + Settings link

**Files:**
- Modify: `src/Koda.tsx`
- Modify: `src/SettingsScreen.tsx`

> Both files are large. Skim the existing structure first to find the right insertion points.

- [ ] **Step 1: Find Home feed mount point in `src/Koda.tsx`**

```bash
grep -n "function Home\|HomeScreen\|<Home" src/Koda.tsx | head
```

Note the line where the Home screen renders its top-level content.

- [ ] **Step 2: Wire the banner**

In `src/Koda.tsx`, at the top of the Home view body (above the existing first feed element), insert:

```typescript
import { AutoJournalBanner } from "./components/AutoJournalBanner";
import { AutoJournalReviewSheet } from "./components/AutoJournalReviewSheet";
import { useState } from "react"; // (if not already imported)
```

Then in the Home component:

```typescript
const [reviewingImportId, setReviewingImportId] = useState<string | null>(null);
```

And at the top of the rendered JSX:

```tsx
<AutoJournalBanner onReview={setReviewingImportId} />
{reviewingImportId && (
  <AutoJournalReviewSheet
    importId={reviewingImportId}
    onClose={() => setReviewingImportId(null)}
  />
)}
```

- [ ] **Step 3: Find Settings menu structure in `src/SettingsScreen.tsx`**

```bash
grep -n "Discipline\|Account\|Profile" src/SettingsScreen.tsx | head
```

Locate the existing section list pattern.

- [ ] **Step 4: Add Auto-import row**

In `src/SettingsScreen.tsx`, add a new section row near the top (above Discipline) that navigates to the AutoImportSettings screen. Mirror the pattern of the existing rows. Add the route in whichever routing pattern `Koda.tsx` uses (likely a `navigateTo("auto-import")` style call).

Required: import the screen.

```typescript
import { AutoImportSettings } from "./screens/AutoImportSettings";
```

Wire whatever switch/case in `Koda.tsx` renders settings sub-screens to render `<AutoImportSettings />` when the route is `auto-import`.

- [ ] **Step 5: Manual smoke test**

```bash
npm run dev
```

In a browser at `http://localhost:5173`, sign in, open Settings → Auto-import. Confirm:
- Forwarding address renders
- Copy button works
- Regenerate button changes the address

- [ ] **Step 6: Run typecheck + tests**

```bash
npm run typecheck
npm test
```

Expected: both exit 0.

- [ ] **Step 7: Commit**

```bash
git add src/Koda.tsx src/SettingsScreen.tsx
git commit -m "feat(autojournal): wire banner into Home + Settings link"
```

---

## Task 21: PostHog telemetry events

**Files:**
- Modify: `api/lib/email-ingest.ts` (server-side analytics)

> Client events (`autoimport_setup_started`, `autoimport_banner_viewed`, `autoimport_batch_reviewed`, `autoimport_batch_undone`) are already fired by Tasks 17–18. Add the two server-side events.

- [ ] **Step 1: Check PostHog server-side capture pattern**

```bash
grep -rn "posthog.capture\|trackServer" api/lib/ api/
```

Note the existing pattern (if any). If there's no server-side PostHog, log a console event and create a follow-up task.

- [ ] **Step 2: Wire `autoimport_email_received` and `autoimport_parse_success`/`_failure`**

In `api/lib/email-ingest.ts`, at the very start of `ingestEmail`:

```typescript
  console.info("[autojournal] event=autoimport_email_received messageId=" + email.messageId);
```

Just before each terminal return:

```typescript
  // rejected branch
  console.info(
    `[autojournal] event=autoimport_parse_failure reason=${result.reason ?? "unknown"}`,
  );
  // ok branch
  console.info(
    `[autojournal] event=autoimport_parse_success tradeCount=${newTrades.length}`,
  );
```

(If server-side PostHog is wired up, swap the `console.info` for `posthog.capture(...)` per the existing pattern.)

- [ ] **Step 3: Commit**

```bash
git add api/lib/email-ingest.ts
git commit -m "feat(autojournal): server-side telemetry events"
```

---

## Task 22: Playwright smoke test

**Files:**
- Create: `tests/autojournal.spec.ts`

- [ ] **Step 1: Write the smoke test**

Create `tests/autojournal.spec.ts`:

```typescript
import { test, expect } from "@playwright/test";

test.describe("AutoJournal", () => {
  test("Auto-import settings shows a forwarding address", async ({ page }) => {
    await page.goto("/");
    // Reuse the project's signed-in storage state (set up in auth.setup.ts).
    await page.getByRole("link", { name: /settings/i }).click();
    await page.getByText(/Auto-import/i).click();
    await expect(page.locator("text=Your forwarding address")).toBeVisible();
    await expect(page.locator("code", { hasText: /@in\.kodatrade\.co\.uk$/ })).toBeVisible();
  });

  test("Copy button copies the address to clipboard", async ({ page, context }) => {
    await context.grantPermissions(["clipboard-write", "clipboard-read"]);
    await page.goto("/");
    await page.getByRole("link", { name: /settings/i }).click();
    await page.getByText(/Auto-import/i).click();
    await page.getByRole("button", { name: /^copy$/i }).click();
    await expect(page.getByRole("button", { name: /copied/i })).toBeVisible();
    const handle = await page.evaluateHandle(() => navigator.clipboard.readText());
    const text = (await handle.jsonValue()) as string;
    expect(text).toMatch(/@in\.kodatrade\.co\.uk$/);
  });
});
```

- [ ] **Step 2: Run Playwright**

```bash
npm run test:e2e -- tests/autojournal.spec.ts --workers=1
```

> `--workers=1` per the memory note on OOMs in this dev env.

Expected: PASS.

- [ ] **Step 3: Commit**

```bash
git add tests/autojournal.spec.ts
git commit -m "test(autojournal): playwright smoke for settings panel"
```

---

## Task 23: End-to-end manual test (Dylon)

> No code. Pre-launch validation that all the wiring works against a real Postmark account.

- [ ] **Step 1: Verify env vars in Vercel**

In Vercel dashboard → Project → Settings → Environment Variables, confirm:
- `POSTMARK_INBOUND_SECRET` is set
- `AUTOJOURNAL_ALLOWED_SENDERS` is set to `noreply@tradovate.com,statements@tradovate.com`

- [ ] **Step 2: Verify Postmark inbound stream**

Postmark dashboard → Servers → Kōda Inbound → Inbound webhook is configured to:
`https://kodatrade.co.uk/api/email/inbound?provider=postmark`

- [ ] **Step 3: Verify DNS MX record**

```bash
nslookup -type=mx in.kodatrade.co.uk
```

Expected: MX records point to Postmark's inbound servers (typically `inbound.postmarkapp.com.`).

- [ ] **Step 4: Send a test forward**

Forward a real Tradovate daily statement email from Dylon's Gmail to his own Kōda alias.

Expected within 60 seconds:
- Open Kōda → AutoJournalBanner shows N trades
- Stats view reflects the new trades
- Review sheet renders all N rows
- Undo all removes them cleanly

- [ ] **Step 5: 7-day soak**

Forward statements daily for 7 days. Track:
- p10 `parse_confidence` across batches (target: ≥ 0.85)
- Any parse failures (target: 0)
- Any duplicates after a CSV re-import (target: 0)

If any of those fail, file a follow-up ticket; do not announce to other users until the 7-day clean run is achieved.

---

## Post-implementation memory entry

After Task 23 passes, save a project memory entry recording:
- AutoJournal v1 shipped (date, commit range)
- Postmark account in use + DNS state
- Open: postfix shim for v2 when private mail server is stable

---

## Self-Review

**Spec coverage check:**
| Spec section | Task(s) |
|---|---|
| §3a One-time setup | 17 |
| §3b Daily run | 10–15 |
| §3c Failure flow | 10, 11, 14 (push), 15 (Sentry breadcrumbs) |
| §4 Architecture | 7–15 |
| §4a Provider-agnostic boundary | 7, 8, 9, 15 |
| §5 Data model | 2 |
| §6 Components and files | 8, 9, 10, 15, 16, 17, 18, 19, 20 |
| §6 csvParser refactor | 6 |
| §6 imports.ts touch | covered by Task 12's direct write to imports table |
| §7 Parse pipeline | 4, 5, 11–13 |
| §8 Dedupe (replay + trade-level) | 10, 12 |
| §9 Error handling + Sentry | 15 |
| §10 Security (HMAC, allowlist, token rotation) | 8, 9, 10, 16 |
| §11 Cost | n/a (ops) |
| §12 Testing strategy | 3, 4, 5, 10–13, 16, 22 |
| §13 PostHog events | 17, 18, 21 |
| §14 Open questions | Listed in Pre-Flight Blockers |
| §14a Migration path | 9 (stub), spec-only otherwise |

**Placeholder scan:** No "TBD", "TODO" in step bodies. Every step has explicit code or commands.

**Type consistency:** `ParsedTrade`, `ParseResult`, `InboundEmail`, `PendingImport`, `IngestResult` names match across tasks. `external_id`, `import_id`, `source`, `auto_logged` column names match between migration (Task 2) and TypeScript usage.

**Known minor decisions documented inline:**
- Task 6 refactor depth depends on actual `csvParser.ts` shape — flagged as inspect-first.
- Task 14 push helper signature depends on existing `api/push.ts` — flagged as inspect-first.
- Task 20 Settings routing pattern depends on existing `Koda.tsx` switch — flagged as mirror-existing-pattern.
