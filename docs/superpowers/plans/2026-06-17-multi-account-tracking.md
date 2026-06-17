# Multi-Account Tracking Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans (inline) or superpowers:subagent-driven-development. Steps use checkbox (`- [ ]`) syntax.

**Goal:** Let traders track multiple accounts — log a trade once and attribute it to several accounts — with per-account P&L, eval progress, and drawdown, gated free=1/pro=unlimited.

**Architecture:** A new `public.accounts` registry; trades gain `accountId` + `groupId`; "log once, tick N accounts" fans out to N identical rows sharing a `groupId`; per-account stats reuse the existing client-side stats engine by filtering on `accountId`. An Accounts dashboard plus a global account switcher consume the same filter.

**Tech Stack:** React 19 + TS + Vite, Supabase (Postgres + RLS), Vitest. Trades currently read from the `user_kv` blob and dual-write to `public.trades`.

## Global Constraints

- TypeScript strict; pre-commit blocks bare `: any` and unsigned `eslint-disable`.
- No new top-level `api/*` functions (Vercel Hobby 12-function cap).
- Pro gate must reuse `computeIsPro` from `src/lib/entitlements.ts`.
- Colors per DESIGN.md: green/red for outcomes only; blue for computed; mint for actions.
- Run unit tests with `npx vitest run <file> --maxWorkers=1` (low-RAM machine).
- Typecheck with `npx tsc -p tsconfig.app.json --noEmit` (default `typecheck` script masks app errors).

---

### Task 1: Types — Account model + Trade attribution fields

**Files:**
- Modify: `src/types.ts`

**Interfaces:**
- Produces: `Account` interface; `Trade.accountId?: string`; `Trade.groupId?: string`.

- [ ] **Step 1: Add the `Account` interface and extend `Trade`**

```ts
// src/types.ts
export type AccountType = "eval" | "funded" | "personal" | "demo";
export type DrawdownType = "trailing" | "eod" | "static";

export interface Account {
  id: string;
  name: string;
  type: AccountType;
  propFirm?: string | null;
  accountSize?: number | null;
  startingBalance?: number | null;
  profitTarget?: number | null;
  maxDrawdown?: number | null;
  drawdownType: DrawdownType;
  isArchived: boolean;
  sortOrder: number;
  createdAt: string;
}
```
Add to the existing `Trade` interface: `accountId?: string;` and `groupId?: string;`.

- [ ] **Step 2: Typecheck**

Run: `npx tsc -p tsconfig.app.json --noEmit`
Expected: exit 0 (fields are optional — no existing code breaks).

- [ ] **Step 3: Commit**

```bash
git add src/types.ts
git commit -m "feat(accounts): Account type + Trade.accountId/groupId"
```

---

### Task 2: Pure account logic (`src/lib/accounts.ts`) — TDD

**Files:**
- Create: `src/lib/accounts.ts`
- Test: `src/lib/accounts.test.ts`

**Interfaces:**
- Consumes: `Account`, `Trade`, `AccountType` from `src/types.ts`.
- Produces:
  - `fanOutTrade(base: Trade, accountIds: string[], genId?: () => string): Trade[]`
  - `tradesForAccount(trades: Trade[], accountId: string | null): Trade[]` (null/"all" → all)
  - `evalProgress(account: Account, accountTrades: Trade[]): { netPnl: number; target: number | null; pct: number | null }`
  - `drawdownProximity(account: Account, accountTrades: Trade[]): { currentEquity: number; peakEquity: number; drawdown: number; limit: number | null; pct: number | null }`
  - `canAddAccount(accountCount: number, isPro: boolean): boolean`
- Note: net P&L per trade is read via existing helper `tradePnl(t)` if present; otherwise use `Number(t.pnl ?? 0)`. Confirm the trade P&L field name in `src/types.ts`/`src/lib/stats.ts` during Step 1 and use it consistently.

- [ ] **Step 1: Write failing tests**

```ts
// src/lib/accounts.test.ts
import { describe, it, expect } from "vitest";
import { fanOutTrade, tradesForAccount, evalProgress, drawdownProximity, canAddAccount } from "./accounts";
import type { Account, Trade } from "../types";

const t = (over: Partial<Trade> = {}): Trade => ({ id: 1, symbol: "ES", broker: "x", createdAt: "2026-06-01", pnl: 100, ...over } as Trade);
const acct = (over: Partial<Account> = {}): Account => ({ id: "a1", name: "A", type: "eval", drawdownType: "trailing", isArchived: false, sortOrder: 0, createdAt: "2026-06-01", startingBalance: 50000, profitTarget: 3000, maxDrawdown: 2000, ...over });

describe("fanOutTrade", () => {
  it("makes one row per account, each stamped, sharing a groupId", () => {
    let n = 0; const ids = fanOutTrade(t(), ["a1", "a2", "a3"], () => `g${++n}`);
    expect(ids).toHaveLength(3);
    expect(ids.map(r => r.accountId)).toEqual(["a1", "a2", "a3"]);
    expect(new Set(ids.map(r => r.groupId)).size).toBe(1);
  });
  it("single account still gets a groupId", () => {
    expect(fanOutTrade(t(), ["a1"], () => "g")[0].groupId).toBe("g");
  });
  it("empty accounts → empty array", () => {
    expect(fanOutTrade(t(), [])).toEqual([]);
  });
});

describe("tradesForAccount", () => {
  const trades = [t({ id: 1, accountId: "a1" }), t({ id: 2, accountId: "a2" }), t({ id: 3, accountId: "a1" })];
  it("filters by accountId", () => expect(tradesForAccount(trades, "a1").map(x => x.id)).toEqual([1, 3]));
  it("null returns all", () => expect(tradesForAccount(trades, null)).toHaveLength(3));
});

describe("evalProgress", () => {
  it("computes net P&L and % to target", () => {
    const r = evalProgress(acct(), [t({ pnl: 1500 }), t({ pnl: 500 })]);
    expect(r.netPnl).toBe(2000); expect(r.pct).toBeCloseTo(66.67, 1);
  });
  it("null target → null pct", () => {
    expect(evalProgress(acct({ profitTarget: null }), [t()]).pct).toBeNull();
  });
});

describe("drawdownProximity (trailing)", () => {
  it("drawdown is peak equity minus current equity", () => {
    // equity: 50000 -> 51000 -> 50250 ; peak 51000, current 50250, dd 750
    const r = drawdownProximity(acct(), [t({ pnl: 1000 }), t({ pnl: -750 })]);
    expect(r.peakEquity).toBe(51000); expect(r.currentEquity).toBe(50250);
    expect(r.drawdown).toBe(750); expect(r.pct).toBeCloseTo(37.5, 1); // 750/2000
  });
  it("null limit → null pct", () => {
    expect(drawdownProximity(acct({ maxDrawdown: null }), [t()]).pct).toBeNull();
  });
});

describe("canAddAccount", () => {
  it("free allows the first account only", () => {
    expect(canAddAccount(0, false)).toBe(true);
    expect(canAddAccount(1, false)).toBe(false);
  });
  it("pro is unlimited", () => {
    expect(canAddAccount(5, true)).toBe(true);
  });
});
```

- [ ] **Step 2: Run tests, verify they fail**

Run: `npx vitest run src/lib/accounts.test.ts --maxWorkers=1`
Expected: FAIL (module not found / functions undefined).

- [ ] **Step 3: Implement `src/lib/accounts.ts`**

```ts
import type { Account, Trade } from "../types";

const pnlOf = (t: Trade): number => Number((t as { pnl?: unknown }).pnl ?? 0) || 0;
const uuid = () => (globalThis.crypto?.randomUUID?.() ?? `${Date.now()}-${Math.random().toString(16).slice(2)}`);

export function fanOutTrade(base: Trade, accountIds: string[], genId: () => string = uuid): Trade[] {
  if (accountIds.length === 0) return [];
  const groupId = genId();
  return accountIds.map(accountId => ({ ...base, accountId, groupId }));
}

export function tradesForAccount(trades: Trade[], accountId: string | null): Trade[] {
  if (!accountId) return trades;
  return trades.filter(t => t.accountId === accountId);
}

export function evalProgress(account: Account, accountTrades: Trade[]) {
  const netPnl = accountTrades.reduce((s, t) => s + pnlOf(t), 0);
  const target = account.profitTarget ?? null;
  const pct = target && target > 0 ? (netPnl / target) * 100 : null;
  return { netPnl, target, pct };
}

export function drawdownProximity(account: Account, accountTrades: Trade[]) {
  const start = account.startingBalance ?? account.accountSize ?? 0;
  let equity = start, peak = start, maxDd = 0;
  for (const t of accountTrades) {
    equity += pnlOf(t);
    if (equity > peak) peak = equity;
    maxDd = Math.max(maxDd, peak - equity);
  }
  const limit = account.maxDrawdown ?? null;
  const drawdown = peak - equity;
  const pct = limit && limit > 0 ? (drawdown / limit) * 100 : null;
  return { currentEquity: equity, peakEquity: peak, drawdown, limit, pct };
}

export function canAddAccount(accountCount: number, isPro: boolean): boolean {
  return isPro || accountCount < 1;
}
```

- [ ] **Step 4: Run tests, verify pass**

Run: `npx vitest run src/lib/accounts.test.ts --maxWorkers=1`
Expected: PASS (all). If `pnl` is not the field name, adjust `pnlOf` to the real field and the tests' `t()` helper.

- [ ] **Step 5: Typecheck + commit**

```bash
npx tsc -p tsconfig.app.json --noEmit
git add src/lib/accounts.ts src/lib/accounts.test.ts
git commit -m "feat(accounts): pure logic — fan-out, per-account filter, eval progress, drawdown, gate"
```

---

### Task 3: DB migration — `public.accounts`

**Files:**
- Create: `supabase/migrations/20260617_accounts.sql`

**Interfaces:**
- Produces: `public.accounts` table with owner-only RLS. Applied by Dylon in the Supabase SQL editor before the data layer ships.

- [ ] **Step 1: Write the migration**

```sql
-- Multi-account registry
create table if not exists public.accounts (
  id               uuid primary key default gen_random_uuid(),
  user_id          uuid not null references auth.users(id) on delete cascade,
  name             text not null,
  type             text not null default 'personal',
  prop_firm        text,
  account_size     numeric,
  starting_balance numeric,
  profit_target    numeric,
  max_drawdown     numeric,
  drawdown_type    text not null default 'trailing',
  is_archived      boolean not null default false,
  sort_order       int not null default 0,
  created_at       timestamptz not null default now()
);
create index if not exists accounts_user_idx on public.accounts(user_id);
alter table public.accounts enable row level security;
create policy accounts_owner_all on public.accounts
  for all using (user_id = auth.uid()) with check (user_id = auth.uid());
```

- [ ] **Step 2: Commit (apply in Supabase is a Dylon step at deploy)**

```bash
git add supabase/migrations/20260617_accounts.sql
git commit -m "feat(accounts): accounts table + owner RLS migration"
```

---

### Task 4: Data layer (`src/data/accounts.ts`)

**Files:**
- Create: `src/data/accounts.ts`
- Reference: `src/lib/supabase.ts`, an existing `src/data/*.ts` for the row↔camelCase mapping pattern.

**Interfaces:**
- Consumes: `Account` type, supabase client.
- Produces: `listAccounts(): Promise<Account[]>`, `createAccount(input): Promise<Account>`, `updateAccount(id, patch): Promise<void>`, `archiveAccount(id): Promise<void>`, `ensureDefaultAccount(trades: Trade[]): Promise<{ account: Account; stampedTrades: Trade[] }>`.

- [ ] **Step 1: Implement CRUD + default-account backfill**

Map snake_case rows ↔ the camelCase `Account` (follow the existing data-module pattern). `ensureDefaultAccount`: if `listAccounts()` is empty, `createAccount({ name: "My Account", type: "personal" })`, then return that account plus `trades.map(t => t.accountId ? t : { ...t, accountId: account.id, groupId: t.groupId ?? uuid() })`. Caller persists `stampedTrades` to the KV blob.

```ts
import { supabase } from "../lib/supabase";
import type { Account, Trade } from "../types";

const fromRow = (r: Record<string, unknown>): Account => ({
  id: r.id as string, name: r.name as string, type: r.type as Account["type"],
  propFirm: (r.prop_firm as string) ?? null, accountSize: (r.account_size as number) ?? null,
  startingBalance: (r.starting_balance as number) ?? null, profitTarget: (r.profit_target as number) ?? null,
  maxDrawdown: (r.max_drawdown as number) ?? null, drawdownType: (r.drawdown_type as Account["drawdownType"]) ?? "trailing",
  isArchived: Boolean(r.is_archived), sortOrder: (r.sort_order as number) ?? 0, createdAt: r.created_at as string,
});

export async function listAccounts(): Promise<Account[]> {
  const { data, error } = await supabase.from("accounts").select("*").order("sort_order");
  if (error) throw error;
  return (data ?? []).map(fromRow);
}
// createAccount / updateAccount / archiveAccount: insert/update/{is_archived:true}; map fields to snake_case.
// ensureDefaultAccount(trades): see prose above.
```

- [ ] **Step 2: Typecheck + commit**

```bash
npx tsc -p tsconfig.app.json --noEmit
git add src/data/accounts.ts
git commit -m "feat(accounts): supabase CRUD + default-account backfill"
```

---

### Task 5: Log flow — account picker + fan-out + group edit/delete

**Files:**
- Modify: `src/LogTradeScreen.tsx` (replace the `accountType` selector ~line 73/190 with an account picker; multi-select when `isPro`), and the trade-save handler in `src/Koda.tsx` (apply `fanOutTrade` on create; resolve `groupId` on edit/delete).

**Interfaces:**
- Consumes: `fanOutTrade`, accounts list + `activeAccountId` from `Koda.tsx` state, `isPro`.
- Produces: trades written with `accountId`/`groupId`.

- [ ] **Step 1:** Add account chips to LogTradeScreen (single-select for free, multi for Pro). Default selection = `activeAccountId` or first account.
- [ ] **Step 2:** On save (new trade), call `fanOutTrade(base, selectedAccountIds)` and append all rows; on edit, update every trade sharing the `groupId`; on delete, delete the whole group.
- [ ] **Step 3:** Manual verify in the running app (`npm run dev` → log a trade across 2 accounts → 2 rows appear; edit/delete affects both).
- [ ] **Step 4: Commit** `git commit -m "feat(accounts): log-once/tick-accounts fan-out + group edit/delete"`

---

### Task 6: CSV import targets one account

**Files:**
- Modify: `src/CsvImportPanel.tsx` (replace `accountType` chip ~line 361/900 with an account picker; single account per import; stamp `accountId` + a fresh `groupId` per row in `rowToTrade`/the import builder ~line 659).

- [ ] **Step 1:** Add account selector to the import panel header.
- [ ] **Step 2:** Stamp imported rows with the chosen `accountId` + a per-row `groupId`.
- [ ] **Step 3:** Manual verify: import a CSV into Account B → those trades show only under B.
- [ ] **Step 4: Commit** `git commit -m "feat(accounts): CSV import targets a chosen account"`

---

### Task 7: Global account switcher + scoping

**Files:**
- Modify: `src/Koda.tsx` (add `activeAccountId` state, persisted per-device like `flags.ts`; feed `tradesForAccount(trades, activeAccountId)` into the journal + stats + discipline-score computations), and the journal/stats header to render the `All accounts ▾` selector.

- [ ] **Step 1:** Add `activeAccountId` state + persistence (localStorage `koda_active_account`).
- [ ] **Step 2:** Replace the trades source for journal/stats/discipline with `tradesForAccount(trades, activeAccountId)`; "all" = unfiltered.
- [ ] **Step 3:** Render the selector (accounts + "All accounts").
- [ ] **Step 4:** Manual verify: switching scopes journal + stats + discipline score.
- [ ] **Step 5: Commit** `git commit -m "feat(accounts): global account switcher scopes journal + stats"`

---

### Task 8: Accounts dashboard screen

**Files:**
- Create: `src/AccountsScreen.tsx`
- Modify: `src/Koda.tsx` (route/nav entry), nav config.

- [ ] **Step 1:** Build the screen: for each non-archived account render a card using `tradesForAccount` + existing stat calcs + `evalProgress` + `drawdownProximity`. Eval-progress bar (mint) and drawdown-proximity meter (neutral→red as `pct`→100). "—" when target/limit null.
- [ ] **Step 2:** Account create/edit sheet (name, type chips, prop firm, size, starting balance, target, max drawdown, drawdown type) → `createAccount`/`updateAccount`. Archive action → `archiveAccount`.
- [ ] **Step 3:** "Add account" CTA gated by `canAddAccount(accounts.length, isPro)`; blocked → open `UpgradeModal`.
- [ ] **Step 4:** Add nav entry; tap a card → set `activeAccountId` + go to journal.
- [ ] **Step 5:** Manual verify with 3 accounts: cards show correct per-account P&L, eval %, drawdown; free user blocked at 2nd account.
- [ ] **Step 6: Commit** `git commit -m "feat(accounts): accounts dashboard with eval progress + drawdown"`

---

### Task 9: Wire-up, backfill on load, final verification

**Files:**
- Modify: `src/Koda.tsx` (call `ensureDefaultAccount` after trades load; persist stamped trades to KV).

- [ ] **Step 1:** On app load after trades are available and accounts listed, run `ensureDefaultAccount(trades)`; if it stamped trades, write them back to the KV blob (existing save path).
- [ ] **Step 2:** Full app typecheck `npx tsc -p tsconfig.app.json --noEmit` and `npx vitest run src/lib/accounts.test.ts --maxWorkers=1`.
- [ ] **Step 3:** Manual end-to-end: fresh-ish account → existing trades land on "My Account"; create 2 more (Pro); log once across all 3; dashboard + filter correct.
- [ ] **Step 4: Commit + open PR.**

---

## Self-Review

**Spec coverage:** accounts table (T3), Trade fields (T1), fan-out (T2/T5), per-account stats reuse (T2/T7), eval progress + drawdown (T2/T8), dashboard (T8), global filter (T7), log picker (T5), CSV import (T6), default-account backfill (T4/T9), Pro gate (T2/T8). All covered.

**Placeholders:** pure-logic + migration + data tasks carry full code; UI tasks (T5–T9) give exact files, line anchors, and concrete steps verified against the running app (UI is not unit-tested here, matching the codebase convention where `src/lib/*` is tested and components are verified live).

**Type consistency:** `Account`/`Trade.accountId`/`groupId` defined in T1; `fanOutTrade`/`tradesForAccount`/`evalProgress`/`drawdownProximity`/`canAddAccount` signatures consistent across T2→T5–T9. Confirm the real per-trade P&L field name in T2 Step 1 and use it everywhere.
