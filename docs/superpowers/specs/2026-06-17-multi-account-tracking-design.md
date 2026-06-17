# Design: Multi-Account Tracking — 2026-06-17

**Status:** APPROVED (brainstorm 2026-06-17)
**Repo:** dtrades4459/koda
**Branch:** `feat/multi-account-tracking`

---

## Problem

Prop traders run multiple accounts at once (e.g. three Apex evals). Today a trade
carries only a coarse `accountType` tag (`personal`/`funded`/`demo`) and **no link
to a specific account** — so three funded evals collapse into one "funded" bucket
and pool together. Traders can't see per-account P&L, eval progress, or drawdown —
the things that actually decide whether an eval passes.

This is **tracking, not copy-trading.** When the same setup is taken across several
accounts, the trader logs it once and ticks the accounts it applied to.

## Decisions (locked with Dylon, 2026-06-17)

1. **Log once, tick accounts.** One entry → recorded against each ticked account.
2. **Eval-aware accounts.** Each account carries name, type, prop firm, size,
   profit target, max drawdown — enabling per-account eval progress + drawdown.
3. **Both views.** An Accounts dashboard (card per account) **and** a global
   account filter on journal + stats.
4. **Pro gate.** Free = 1 account; multiple accounts require Pro.
5. **Storage = fan-out (Approach A).** Ticking N accounts writes N identical trade
   rows linked by a `groupId`. Per-account stats reuse the existing client-side
   stats engine by filtering on `accountId` — no rewrite of the stats layer.

## Non-goals (Phase 2, explicitly not now)

- Per-account sizing / divergent results (the "edit each account's copy" path).
- Linking synced `broker_connections` to registry accounts.
- Live in-session drawdown-proximity intervention.
- Exact per-prop-firm drawdown rule engines (intraday-trailing vs EOD vs static).

---

## Architecture

### Data model

**New table `public.accounts`** (RLS: owner-only, `user_id = auth.uid()`):

| column | type | notes |
|---|---|---|
| `id` | uuid pk | `gen_random_uuid()` |
| `user_id` | uuid | FK auth.users, indexed |
| `name` | text not null | e.g. "Apex #1" |
| `type` | text not null | `eval` \| `funded` \| `personal` \| `demo` |
| `prop_firm` | text null | e.g. "Apex" |
| `account_size` | numeric null | nominal account size |
| `starting_balance` | numeric null | for the equity curve (defaults to `account_size`) |
| `profit_target` | numeric null | eval target ($) |
| `max_drawdown` | numeric null | drawdown limit ($) |
| `drawdown_type` | text not null default `'trailing'` | `trailing` \| `eod` \| `static` |
| `is_archived` | boolean not null default false | soft delete |
| `sort_order` | int not null default 0 | dashboard ordering |
| `created_at` | timestamptz not null default now() | |

**`Trade` gains two fields** (`src/types.ts`), propagated to the `user_kv` trades
blob (current read source) and the `public.trades` dual-write:

- `accountId?: string` — which account this row belongs to.
- `groupId?: string` — shared across the fanned-out copies of one logical trade
  (drives group-aware edit/delete). A single-account trade still gets a `groupId`.

The coarse `Trade.accountType` is retained for back-compat but superseded by the
linked account's `type`.

### Components (each independently testable)

- **`src/lib/accounts.ts`** — account registry domain logic:
  - `fanOutTrade(base, accountIds): Trade[]` — one logical trade + N accountIds →
    N trade objects sharing a fresh `groupId`.
  - `tradesForAccount(trades, accountId): Trade[]` — filter (the heart of stat reuse).
  - `evalProgress(account, accountTrades): { netPnl, target, pct }`.
  - `drawdownProximity(account, accountTrades): { peakEquity, currentEquity, drawdown, limit, pct }`
    — running equity = `starting_balance + cumulative net P&L`; trailing drawdown =
    peak-to-current.
  - `canAddAccount(accountCount, isPro): boolean` — free = 1, pro = unlimited.
- **`src/data/accounts.ts`** — Supabase CRUD for `public.accounts` + `ensureDefaultAccount(userId, trades)`
  (first-load backfill, below).
- **`AccountsScreen.tsx`** — dashboard: card per account (P&L, win rate, R, trade
  count, eval-progress bar, drawdown-proximity meter) + "Add account" CTA (free
  user's 2nd → UpgradeModal) + account create/edit sheet + archive.
- **Account picker** in `LogTradeScreen.tsx` (multi-select for Pro, single for
  free) and `CsvImportPanel.tsx` (single account per import).
- **Global account switcher** (`All accounts ▾`) wired into journal + stats; the
  selection scopes the trades array fed to the existing stats engine. Persisted
  per-device (same pattern as `flags.ts`).

### Data flow

**Logging:** user fills trade → ticks accounts → `fanOutTrade` → N rows written to
KV (+ dual-write `public.trades`). Edit/delete resolves the `groupId` and applies
across all rows in the group.

**Viewing:** global switcher sets `activeAccountId` (or "all"). Journal + stats +
discipline score consume `tradesForAccount(trades, activeAccountId)` (or all
trades). Existing `calcRR` / `calcStreak` / `calcDisciplineScore` / net-$ run
unchanged over the filtered list.

**Accounts dashboard:** for each account, `tradesForAccount` → existing stat calcs
+ `evalProgress` + `drawdownProximity`.

### Existing trades — no breakage

On first load after ship, `ensureDefaultAccount`:
1. If the user has zero accounts, create one ("My Account", type from their profile
   or `personal`).
2. Stamp every trade missing an `accountId` with that account's id (and a per-trade
   `groupId`).

Everyone lands with their full history on one account — free-tier-compatible.

### Pro gating

`canAddAccount(count, isPro)` gates account creation; multi-select in the log
picker is Pro-only. `isPro` comes from the existing **`computeIsPro`**
(`src/lib/entitlements.ts`). Enforced client-side, consistent with the app's
current gating model (`ProLock`/`isPro`).

### Error handling

- Account create/edit failures surface a toast; no partial writes (single insert).
- Fan-out write is all-or-nothing per logical trade; on partial failure, roll back
  the group locally and toast.
- Deleting an account: blocked while it holds trades unless the user chooses
  "archive" (soft) or "reassign to…"; archived accounts hide from pickers but keep
  history.
- Missing eval fields (`profit_target`/`max_drawdown` null) → progress/drawdown UI
  renders "—" rather than dividing by zero.

### Testing (TDD — write tests first)

Pure functions in `src/lib/accounts.ts` get unit tests before implementation:
fan-out (0/1/N accounts, shared groupId), `tradesForAccount` filter, `evalProgress`
(incl. null target), `drawdownProximity` (rising equity, drawdown breach, null
limit), `canAddAccount` (free=1, pro=unlimited). Component wiring verified manually
via the running app.

## Scope summary

**v1:** accounts table + CRUD, eval-aware fields, log-once/tick-accounts fan-out,
Accounts dashboard (eval progress + drawdown), global filter, default-account
backfill, Pro gate, full unit tests on the pure layer.

**Phase 2:** per-account sizing, broker-sync↔account linking, live drawdown
intervention, per-firm drawdown rules.
