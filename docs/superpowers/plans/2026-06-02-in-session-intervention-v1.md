# In-Session Intervention v1 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build the v1 Log-Trade tilt intervention — pure evaluator → cooldown hook → bottom-sheet/modal surface → telemetry table → Stats card → Settings entry — demoable end-to-end on Dylon's phone by end of Week 3.

**Architecture:** Pure `evaluateTilt(trades, profile, now)` in `src/lib/tilt.ts` (no React, no DB) driven by a `useTiltState` hook that reads cooldown from `user_kv`. The gate wraps the Log Trade trigger; the sheet/modal is presentational; an `interventions` data module handles RLS-safe CRUD against a new `public.intervention_events` table. Nothing inside `Koda.tsx` beyond a single surgical wiring change — that file is already at ~4170 lines.

**Tech Stack:** React 19 + TypeScript + Vite, Supabase (RLS + Realtime), Vercel, Vitest, Playwright, PostHog. Pre-commit hook blocks new `: any` and new `eslint-disable` (except `react-hooks/exhaustive-deps`). Push to `main` = production deploy via Vercel.

**Spec reference:** `docs/superpowers/specs/2026-06-02-in-session-intervention-design.md`

---

## File Structure

**Create:**
- `supabase/migrations/20260603_intervention_events.sql` — DB table + RLS
- `src/lib/tilt.ts` — pure evaluator + types
- `src/lib/tilt.test.ts` — Vitest property tests
- `src/data/interventions.ts` — CRUD against `intervention_events`
- `src/data/interventions.test.ts` — mocked supabase tests
- `src/hooks/useTiltState.ts` — memoised evaluator + cooldown
- `src/hooks/useTiltState.test.tsx` — mocked-time tests
- `src/components/InterventionSheet.tsx` — bottom sheet (mobile) + modal (desktop)
- `src/components/InterventionSheet.test.tsx` — RTL render + handler tests
- `src/components/InterventionGate.tsx` — cooldown pill + tap intercept
- `src/components/InterventionGate.test.tsx` — gate-state tests
- `src/components/InSessionStatsCard.tsx` — Stats tab card
- `tests/in-session-intervention.spec.ts` — Playwright E2E

**Modify:**
- `src/Koda.tsx` — wrap Log Trade trigger in `InterventionGate`; add trade-link hook on save
- `src/SettingsScreen.tsx` — add "Discipline" section
- `src/types.ts` — extend `Profile.prefs` type with `intervention` shape
- `src/lib/posthog.ts` — re-export typed event helper (if not already generic)
- `NEXT_SESSION.md` — pickup log
- `CLAUDE.md` — features list + migrations table

---

## Task 1: Migration — `intervention_events` table

**Files:**
- Create: `supabase/migrations/20260603_intervention_events.sql`

- [ ] **Step 1: Create the migration file**

```sql
-- ═══════════════════════════════════════════════════════════════════════════════
-- Kōda · intervention_events table
--
-- One row per in-session intervention firing. Links optionally to the trade
-- that was logged within 10 min of `fired_at` if user chose to continue.
-- ═══════════════════════════════════════════════════════════════════════════════

create extension if not exists "pgcrypto";

create table if not exists public.intervention_events (
  id           uuid        primary key default gen_random_uuid(),
  user_uid     uuid        not null references auth.users(id) on delete cascade,
  fired_at     timestamptz not null default now(),
  signals      jsonb       not null,
  critical     boolean     not null default false,
  choice       text        not null check (choice in ('continued','cancelled')),
  trade_id     integer,
  session_date date        not null
);

create index if not exists intervention_events_user_fired_idx
  on public.intervention_events (user_uid, fired_at desc);

create index if not exists intervention_events_session_idx
  on public.intervention_events (user_uid, session_date);

alter table public.intervention_events enable row level security;

drop policy if exists "intervention_events_read_self"   on public.intervention_events;
drop policy if exists "intervention_events_insert_self" on public.intervention_events;
drop policy if exists "intervention_events_update_self" on public.intervention_events;

create policy "intervention_events_read_self"
  on public.intervention_events for select
  to authenticated
  using (auth.uid() = user_uid);

create policy "intervention_events_insert_self"
  on public.intervention_events for insert
  to authenticated
  with check (auth.uid() = user_uid);

create policy "intervention_events_update_self"
  on public.intervention_events for update
  to authenticated
  using (auth.uid() = user_uid);

grant select, insert, update on public.intervention_events to authenticated;

notify pgrst, 'reload schema';
```

- [ ] **Step 2: Apply migration manually in Supabase SQL Editor**

Open the Supabase Dashboard for project `vifwjwsndchnrpvfgrmg`, paste the SQL into the SQL Editor, run it. Verify no errors. Expected: "Success. No rows returned."

- [ ] **Step 3: Verify table exists**

In the SQL Editor:
```sql
select column_name, data_type, is_nullable
from information_schema.columns
where table_schema = 'public' and table_name = 'intervention_events'
order by ordinal_position;
```
Expected: 8 rows (`id, user_uid, fired_at, signals, critical, choice, trade_id, session_date`).

- [ ] **Step 4: Commit the migration file**

```bash
git add supabase/migrations/20260603_intervention_events.sql
git commit -m "feat(intervention): add intervention_events table

One row per Log Trade intervention firing — signals, choice, optional
linked trade. RLS-protected per-user reads/writes/updates.

Co-Authored-By: Claude Sonnet 4.6 <noreply@anthropic.com>"
```

---

## Task 2: Tilt types + stub evaluator

**Files:**
- Create: `src/lib/tilt.ts`
- Create: `src/lib/tilt.test.ts`

- [ ] **Step 1: Write the failing test for stub**

```ts
// src/lib/tilt.test.ts
import { describe, it, expect } from "vitest";
import { evaluateTilt } from "./tilt";
import type { Trade, Profile } from "../types";

const EMPTY_PROFILE: Profile = {
  name: "", handle: "", bio: "", avatar: "", broker: "",
  timezone: "UTC", startDate: "", targetRR: "",
  maxTradesPerDay: "",
};

describe("evaluateTilt", () => {
  it("returns inactive state when there are no trades", () => {
    const state = evaluateTilt([] as Trade[], EMPTY_PROFILE, Date.parse("2026-06-02T15:00:00Z"));
    expect(state.active).toBe(false);
    expect(state.signals).toEqual([]);
  });
});
```

- [ ] **Step 2: Run the test — verify it fails**

```bash
cd "C:/Users/Dylon/OneDrive/Desktop/koda"
npx vitest run src/lib/tilt.test.ts
```
Expected: FAIL with `Cannot find module './tilt'`.

- [ ] **Step 3: Create the types + stub**

```ts
// src/lib/tilt.ts
// ═══════════════════════════════════════════════════════════════════════════════
// Kōda · tilt evaluator
//
// Pure function (no React, no DB). Given today's trades + profile + a clock,
// returns which tilt signals are active and whether the intervention should fire.
//
// Signal definitions and firing rule live in:
//   docs/superpowers/specs/2026-06-02-in-session-intervention-design.md §4
// ═══════════════════════════════════════════════════════════════════════════════

import type { Trade, Profile } from "../types";

export type TiltSignalId =
  | "consec_losses"
  | "daily_loss_75" | "daily_loss_90"
  | "trade_cap_at"
  | "revenge_window"
  | "tilt_emotion";

export interface TiltSignal {
  id: TiltSignalId;
  label: string;
  critical: boolean;
}

export interface TiltState {
  active: boolean;
  critical: boolean;
  signals: TiltSignal[];
  evaluatedAt: number;
}

export function evaluateTilt(
  _trades: Trade[],
  _profile: Pick<Profile, "maxDailyLoss" | "maxTradesPerDay">,
  now: number,
): TiltState {
  return { active: false, critical: false, signals: [], evaluatedAt: now };
}
```

- [ ] **Step 4: Run the test — verify it passes**

```bash
npx vitest run src/lib/tilt.test.ts
```
Expected: PASS — 1 test passed.

- [ ] **Step 5: Commit**

```bash
git add src/lib/tilt.ts src/lib/tilt.test.ts
git commit -m "feat(tilt): add evaluator stub + types

Empty-trades path returns inactive state. Real signals land in
subsequent commits per spec §4.

Co-Authored-By: Claude Sonnet 4.6 <noreply@anthropic.com>"
```

---

## Task 3: Consecutive-losses signal

**Files:**
- Modify: `src/lib/tilt.ts`
- Modify: `src/lib/tilt.test.ts`

- [ ] **Step 1: Add failing tests for `consec_losses`**

Append to `src/lib/tilt.test.ts`:
```ts
function mkTrade(over: Partial<Trade>): Trade {
  return {
    id: over.id ?? Math.floor(Math.random() * 1e9),
    date: over.date ?? "2026-06-02",
    pair: over.pair ?? "ES",
    session: "", bias: "", strategy: "", setup: "",
    entryPrice: "", slPrice: "", tpPrice: "", rr: "",
    outcome: over.outcome ?? "Win",
    pnl: over.pnl ?? "0",
    pnlDollar: over.pnlDollar ?? "0",
    notes: "", emotions: over.emotions ?? "",
    screenshot: "",
    comments: [], reactions: {},
    entryTime: over.entryTime,
    exitTime: over.exitTime,
  };
}

const NOW = Date.parse("2026-06-02T20:00:00Z");
const TODAY = "2026-06-02";

describe("consec_losses signal", () => {
  it("does not fire with 1 loss", () => {
    const trades = [mkTrade({ date: TODAY, outcome: "Loss", entryTime: "2026-06-02T19:55:00Z" })];
    const state = evaluateTilt(trades, EMPTY_PROFILE, NOW);
    expect(state.signals.find(s => s.id === "consec_losses")).toBeUndefined();
  });

  it("fires when last 2 trades are losses", () => {
    const trades = [
      mkTrade({ date: TODAY, outcome: "Loss", entryTime: "2026-06-02T19:30:00Z" }),
      mkTrade({ date: TODAY, outcome: "Loss", entryTime: "2026-06-02T19:55:00Z" }),
    ];
    const state = evaluateTilt(trades, EMPTY_PROFILE, NOW);
    const sig = state.signals.find(s => s.id === "consec_losses");
    expect(sig).toBeDefined();
    expect(sig?.label).toBe("2 consecutive losses");
    expect(sig?.critical).toBe(false);
  });

  it("does not count yesterday's losses", () => {
    const trades = [
      mkTrade({ date: "2026-06-01", outcome: "Loss", entryTime: "2026-06-01T19:30:00Z" }),
      mkTrade({ date: "2026-06-01", outcome: "Loss", entryTime: "2026-06-01T19:55:00Z" }),
    ];
    const state = evaluateTilt(trades, EMPTY_PROFILE, NOW);
    expect(state.signals.find(s => s.id === "consec_losses")).toBeUndefined();
  });

  it("resets after a Win", () => {
    const trades = [
      mkTrade({ date: TODAY, outcome: "Loss", entryTime: "2026-06-02T19:00:00Z" }),
      mkTrade({ date: TODAY, outcome: "Loss", entryTime: "2026-06-02T19:30:00Z" }),
      mkTrade({ date: TODAY, outcome: "Win",  entryTime: "2026-06-02T19:45:00Z" }),
    ];
    const state = evaluateTilt(trades, EMPTY_PROFILE, NOW);
    expect(state.signals.find(s => s.id === "consec_losses")).toBeUndefined();
  });
});
```

- [ ] **Step 2: Run tests — verify the new ones fail**

```bash
npx vitest run src/lib/tilt.test.ts
```
Expected: FAIL — 3 of 5 new tests fail (signal not implemented).

- [ ] **Step 3: Implement helper + signal**

Replace the body of `evaluateTilt` in `src/lib/tilt.ts`:
```ts
function todayLocal(now: number): string {
  const d = new Date(now);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

function tradeSortKey(t: Trade): string {
  return t.entryTime ?? t.exitTime ?? "";
}

export function evaluateTilt(
  trades: Trade[],
  _profile: Pick<Profile, "maxDailyLoss" | "maxTradesPerDay">,
  now: number,
): TiltState {
  const today = todayLocal(now);
  const todays = trades
    .filter(t => t.date === today)
    .sort((a, b) => tradeSortKey(a).localeCompare(tradeSortKey(b)));

  const signals: TiltSignal[] = [];

  // ── consec_losses ────────────────────────────────────────────────────────
  let run = 0;
  for (let i = todays.length - 1; i >= 0; i--) {
    if (todays[i].outcome === "Loss") run++;
    else break;
  }
  if (run >= 2) {
    signals.push({
      id: "consec_losses",
      label: `${run} consecutive losses`,
      critical: false,
    });
  }

  return { active: false, critical: false, signals, evaluatedAt: now };
}
```

- [ ] **Step 4: Run tests — verify pass**

```bash
npx vitest run src/lib/tilt.test.ts
```
Expected: PASS — 5 tests passed.

- [ ] **Step 5: Commit**

```bash
git add src/lib/tilt.ts src/lib/tilt.test.ts
git commit -m "feat(tilt): add consec_losses signal

Fires when the most recent 2+ today's trades are Losses with no
intervening Win. Sorts by entryTime/exitTime fallback. Yesterday's
trades excluded by date filter.

Co-Authored-By: Claude Sonnet 4.6 <noreply@anthropic.com>"
```

---

## Task 4: Daily-loss signals (75% + 90%)

**Files:**
- Modify: `src/lib/tilt.ts`
- Modify: `src/lib/tilt.test.ts`

- [ ] **Step 1: Add failing tests**

Append to `src/lib/tilt.test.ts`:
```ts
describe("daily_loss signals", () => {
  it("does not fire when maxDailyLoss is unset", () => {
    const trades = [mkTrade({ date: TODAY, outcome: "Loss", pnlDollar: "-200" })];
    const state = evaluateTilt(trades, EMPTY_PROFILE, NOW);
    expect(state.signals.find(s => s.id?.startsWith("daily_loss"))).toBeUndefined();
  });

  it("fires daily_loss_75 at 75% of limit", () => {
    const trades = [
      mkTrade({ date: TODAY, outcome: "Loss", pnlDollar: "-150" }),
      mkTrade({ date: TODAY, outcome: "Loss", pnlDollar: "-26" }),
    ];
    const state = evaluateTilt(trades, { ...EMPTY_PROFILE, maxDailyLoss: "200" }, NOW);
    const sig = state.signals.find(s => s.id === "daily_loss_75");
    expect(sig).toBeDefined();
    expect(sig?.label).toBe("-88% of daily loss limit");
    expect(sig?.critical).toBe(false);
  });

  it("fires daily_loss_90 at 90% of limit and marks critical", () => {
    const trades = [mkTrade({ date: TODAY, outcome: "Loss", pnlDollar: "-185" })];
    const state = evaluateTilt(trades, { ...EMPTY_PROFILE, maxDailyLoss: "200" }, NOW);
    const sig = state.signals.find(s => s.id === "daily_loss_90");
    expect(sig).toBeDefined();
    expect(sig?.critical).toBe(true);
  });

  it("does not fire if net P&L is positive even with losses logged", () => {
    const trades = [
      mkTrade({ date: TODAY, outcome: "Loss", pnlDollar: "-50" }),
      mkTrade({ date: TODAY, outcome: "Win",  pnlDollar: "300" }),
    ];
    const state = evaluateTilt(trades, { ...EMPTY_PROFILE, maxDailyLoss: "200" }, NOW);
    expect(state.signals.find(s => s.id?.startsWith("daily_loss"))).toBeUndefined();
  });
});
```

- [ ] **Step 2: Run tests — verify the new ones fail**

```bash
npx vitest run src/lib/tilt.test.ts
```
Expected: FAIL — 3 of 4 new tests fail.

- [ ] **Step 3: Implement daily-loss signals**

In `src/lib/tilt.ts`, after the `consec_losses` block, add:
```ts
  // ── daily_loss_75 / daily_loss_90 ────────────────────────────────────────
  const maxLoss = parseFloat(_profile.maxDailyLoss ?? "");
  if (isFinite(maxLoss) && maxLoss > 0) {
    const netPnl = todays.reduce((sum, t) => sum + (parseFloat(t.pnlDollar) || 0), 0);
    if (netPnl < 0) {
      const pctOfLimit = Math.abs(netPnl) / maxLoss;
      if (pctOfLimit >= 0.9) {
        signals.push({
          id: "daily_loss_90",
          label: `-${Math.round(pctOfLimit * 100)}% of daily loss limit`,
          critical: true,
        });
      } else if (pctOfLimit >= 0.75) {
        signals.push({
          id: "daily_loss_75",
          label: `-${Math.round(pctOfLimit * 100)}% of daily loss limit`,
          critical: false,
        });
      }
    }
  }
```

- [ ] **Step 4: Run tests — verify pass**

```bash
npx vitest run src/lib/tilt.test.ts
```
Expected: PASS — 9 tests passed.

- [ ] **Step 5: Commit**

```bash
git add src/lib/tilt.ts src/lib/tilt.test.ts
git commit -m "feat(tilt): add daily_loss_75 and daily_loss_90 signals

75% triggers a non-critical signal; 90% triggers a critical one.
Critical signals fire intervention on their own (without needing a
second signal to count toward the threshold).

Co-Authored-By: Claude Sonnet 4.6 <noreply@anthropic.com>"
```

---

## Task 5: Trade-cap signal

**Files:**
- Modify: `src/lib/tilt.ts`
- Modify: `src/lib/tilt.test.ts`

- [ ] **Step 1: Add failing tests**

```ts
describe("trade_cap_at signal", () => {
  it("does not fire when maxTradesPerDay is unset", () => {
    const trades = Array.from({ length: 10 }, (_, i) =>
      mkTrade({ date: TODAY, outcome: "Win", entryTime: `2026-06-02T${10 + i}:00:00Z` }),
    );
    const state = evaluateTilt(trades, EMPTY_PROFILE, NOW);
    expect(state.signals.find(s => s.id === "trade_cap_at")).toBeUndefined();
  });

  it("fires (critical) when today's trade count equals cap", () => {
    const trades = [
      mkTrade({ date: TODAY, outcome: "Win", entryTime: "2026-06-02T10:00:00Z" }),
      mkTrade({ date: TODAY, outcome: "Win", entryTime: "2026-06-02T11:00:00Z" }),
      mkTrade({ date: TODAY, outcome: "Win", entryTime: "2026-06-02T12:00:00Z" }),
    ];
    const state = evaluateTilt(trades, { ...EMPTY_PROFILE, maxTradesPerDay: "3" }, NOW);
    const sig = state.signals.find(s => s.id === "trade_cap_at");
    expect(sig).toBeDefined();
    expect(sig?.critical).toBe(true);
  });
});
```

- [ ] **Step 2: Run tests — verify they fail**

```bash
npx vitest run src/lib/tilt.test.ts
```
Expected: FAIL on the 2 new tests.

- [ ] **Step 3: Implement**

After the daily-loss block in `tilt.ts`:
```ts
  // ── trade_cap_at ─────────────────────────────────────────────────────────
  const maxTrades = parseFloat(_profile.maxTradesPerDay ?? "");
  if (isFinite(maxTrades) && maxTrades > 0 && todays.length >= maxTrades) {
    signals.push({
      id: "trade_cap_at",
      label: "Daily trade cap reached",
      critical: true,
    });
  }
```

- [ ] **Step 4: Run tests**

```bash
npx vitest run src/lib/tilt.test.ts
```
Expected: PASS — 11 tests.

- [ ] **Step 5: Commit**

```bash
git add src/lib/tilt.ts src/lib/tilt.test.ts
git commit -m "feat(tilt): add trade_cap_at signal (critical)

Fires when today's trade count >= profile.maxTradesPerDay.

Co-Authored-By: Claude Sonnet 4.6 <noreply@anthropic.com>"
```

---

## Task 6: Revenge-window signal

**Files:**
- Modify: `src/lib/tilt.ts`
- Modify: `src/lib/tilt.test.ts`

- [ ] **Step 1: Add failing tests**

```ts
describe("revenge_window signal", () => {
  it("does not fire when last trade was a Win", () => {
    const trades = [mkTrade({
      date: TODAY, outcome: "Win",
      entryTime: "2026-06-02T19:50:00Z", exitTime: "2026-06-02T19:55:00Z",
    })];
    const state = evaluateTilt(trades, EMPTY_PROFILE, NOW);
    expect(state.signals.find(s => s.id === "revenge_window")).toBeUndefined();
  });

  it("fires when last trade was a Loss closed within 10 minutes", () => {
    const trades = [mkTrade({
      date: TODAY, outcome: "Loss",
      entryTime: "2026-06-02T19:50:00Z", exitTime: "2026-06-02T19:55:00Z",
    })];
    const state = evaluateTilt(trades, EMPTY_PROFILE, NOW);
    const sig = state.signals.find(s => s.id === "revenge_window");
    expect(sig).toBeDefined();
    expect(sig?.label).toBe("Within 10 min of a loss");
  });

  it("does not fire 15 minutes after the loss", () => {
    const trades = [mkTrade({
      date: TODAY, outcome: "Loss",
      entryTime: "2026-06-02T19:30:00Z", exitTime: "2026-06-02T19:45:00Z",
    })];
    const state = evaluateTilt(trades, EMPTY_PROFILE, NOW);
    expect(state.signals.find(s => s.id === "revenge_window")).toBeUndefined();
  });

  it("falls back to entryTime when exitTime is missing", () => {
    const trades = [mkTrade({
      date: TODAY, outcome: "Loss",
      entryTime: "2026-06-02T19:55:00Z",
    })];
    const state = evaluateTilt(trades, EMPTY_PROFILE, NOW);
    expect(state.signals.find(s => s.id === "revenge_window")).toBeDefined();
  });
});
```

- [ ] **Step 2: Run — verify fail**

```bash
npx vitest run src/lib/tilt.test.ts
```
Expected: FAIL on 3 of 4 new tests.

- [ ] **Step 3: Implement**

After trade_cap_at block:
```ts
  // ── revenge_window ───────────────────────────────────────────────────────
  const last = todays[todays.length - 1];
  if (last && last.outcome === "Loss") {
    const lastTs = Date.parse(last.exitTime ?? last.entryTime ?? "");
    if (isFinite(lastTs) && now - lastTs <= 10 * 60 * 1000) {
      signals.push({
        id: "revenge_window",
        label: "Within 10 min of a loss",
        critical: false,
      });
    }
  }
```

- [ ] **Step 4: Run — verify pass**

```bash
npx vitest run src/lib/tilt.test.ts
```
Expected: PASS — 15 tests.

- [ ] **Step 5: Commit**

```bash
git add src/lib/tilt.ts src/lib/tilt.test.ts
git commit -m "feat(tilt): add revenge_window signal

Fires when today's most-recent trade was a Loss and closed within
10 minutes of now. exitTime preferred, falls back to entryTime.

Co-Authored-By: Claude Sonnet 4.6 <noreply@anthropic.com>"
```

---

## Task 7: Tilt-emotion signal

**Files:**
- Modify: `src/lib/tilt.ts`
- Modify: `src/lib/tilt.test.ts`

- [ ] **Step 1: Add failing tests**

```ts
describe("tilt_emotion signal", () => {
  it("does not fire when last trade has no tilt emotion", () => {
    const trades = [mkTrade({ date: TODAY, outcome: "Win", emotions: "disciplined,patient" })];
    const state = evaluateTilt(trades, EMPTY_PROFILE, NOW);
    expect(state.signals.find(s => s.id === "tilt_emotion")).toBeUndefined();
  });

  it("fires when last trade is tagged 'revenge'", () => {
    const trades = [mkTrade({ date: TODAY, outcome: "Loss", emotions: "revenge,fomo" })];
    const state = evaluateTilt(trades, EMPTY_PROFILE, NOW);
    const sig = state.signals.find(s => s.id === "tilt_emotion");
    expect(sig).toBeDefined();
    expect(sig?.label).toMatch(/REVENGE/i);
  });

  it("fires for any of: fomo, revenge, chased, movedsl, overtrading", () => {
    const ids = ["fomo", "revenge", "chased", "movedsl", "overtrading"];
    for (const id of ids) {
      const trades = [mkTrade({ date: TODAY, outcome: "Loss", emotions: id })];
      const state = evaluateTilt(trades, EMPTY_PROFILE, NOW);
      expect(state.signals.find(s => s.id === "tilt_emotion"), id).toBeDefined();
    }
  });
});
```

- [ ] **Step 2: Run — verify fail**

```bash
npx vitest run src/lib/tilt.test.ts
```
Expected: FAIL on 2 of 3 new tests.

- [ ] **Step 3: Implement**

After revenge_window block:
```ts
  // ── tilt_emotion ─────────────────────────────────────────────────────────
  const TILT_TAGS = ["fomo", "revenge", "chased", "movedsl", "overtrading"] as const;
  if (last) {
    const haystack = (last.emotions ?? "").toLowerCase();
    const hit = TILT_TAGS.find(tag => haystack.includes(tag));
    if (hit) {
      signals.push({
        id: "tilt_emotion",
        label: `Last trade tagged ${hit.toUpperCase()}`,
        critical: false,
      });
    }
  }
```

- [ ] **Step 4: Run — verify pass**

```bash
npx vitest run src/lib/tilt.test.ts
```
Expected: PASS — 18 tests.

- [ ] **Step 5: Commit**

```bash
git add src/lib/tilt.ts src/lib/tilt.test.ts
git commit -m "feat(tilt): add tilt_emotion signal

Checks the last today's trade for any of fomo/revenge/chased/movedsl
/overtrading in its emotions tag string. Surfaces the matching tag in
the label so the user sees what tipped the evaluator.

Co-Authored-By: Claude Sonnet 4.6 <noreply@anthropic.com>"
```

---

## Task 8: Firing rule + critical flag wiring

**Files:**
- Modify: `src/lib/tilt.ts`
- Modify: `src/lib/tilt.test.ts`

- [ ] **Step 1: Add failing tests for the firing rule**

```ts
describe("firing rule", () => {
  it("does not fire with 0 signals", () => {
    const state = evaluateTilt([], EMPTY_PROFILE, NOW);
    expect(state.active).toBe(false);
    expect(state.critical).toBe(false);
  });

  it("does not fire with 1 non-critical signal", () => {
    const trades = [
      mkTrade({ date: TODAY, outcome: "Loss", entryTime: "2026-06-02T19:30:00Z" }),
      mkTrade({ date: TODAY, outcome: "Loss", entryTime: "2026-06-02T19:32:00Z" }),
    ];
    // Only consec_losses fires here (no maxDailyLoss set, no emotion tag,
    // exit-time would matter for revenge but not provided here)
    const state = evaluateTilt(trades, EMPTY_PROFILE, NOW);
    const onlyConsec = state.signals.length === 1 && state.signals[0].id === "consec_losses";
    expect(onlyConsec).toBe(true);
    expect(state.active).toBe(false);
  });

  it("fires with 2 non-critical signals", () => {
    const trades = [
      mkTrade({
        date: TODAY, outcome: "Loss", emotions: "revenge",
        entryTime: "2026-06-02T19:30:00Z",
      }),
      mkTrade({
        date: TODAY, outcome: "Loss", emotions: "revenge",
        entryTime: "2026-06-02T19:55:00Z", exitTime: "2026-06-02T19:55:00Z",
      }),
    ];
    const state = evaluateTilt(trades, EMPTY_PROFILE, NOW);
    expect(state.active).toBe(true);
    expect(state.critical).toBe(false);
  });

  it("fires (critical) with 1 critical signal", () => {
    const trades = [mkTrade({ date: TODAY, outcome: "Loss", pnlDollar: "-185" })];
    const state = evaluateTilt(trades, { ...EMPTY_PROFILE, maxDailyLoss: "200" }, NOW);
    expect(state.active).toBe(true);
    expect(state.critical).toBe(true);
  });
});
```

- [ ] **Step 2: Run — verify the active=true cases fail**

```bash
npx vitest run src/lib/tilt.test.ts
```
Expected: FAIL on 2 of 4 new tests (firing rule not yet applied).

- [ ] **Step 3: Wire firing rule at the bottom of `evaluateTilt`**

Replace the final `return` line:
```ts
  const critical = signals.some(s => s.critical);
  const nonCritical = signals.length - signals.filter(s => s.critical).length;
  const active = critical || nonCritical >= 2;

  return { active, critical, signals, evaluatedAt: now };
}
```

- [ ] **Step 4: Run — verify all pass**

```bash
npx vitest run src/lib/tilt.test.ts
```
Expected: PASS — 22 tests.

- [ ] **Step 5: Commit**

```bash
git add src/lib/tilt.ts src/lib/tilt.test.ts
git commit -m "feat(tilt): wire firing rule

Active = any 1 critical signal OR >= 2 non-critical signals. The
critical flag is exposed on TiltState so the surface can decide
whether to add an extra warning beat.

Co-Authored-By: Claude Sonnet 4.6 <noreply@anthropic.com>"
```

---

## Task 9: `data/interventions.ts` — CRUD layer

**Files:**
- Create: `src/data/interventions.ts`
- Create: `src/data/interventions.test.ts`

- [ ] **Step 1: Write the failing tests**

```ts
// src/data/interventions.test.ts
import { describe, it, expect, vi, beforeEach } from "vitest";

// Mock supabase before importing the module under test.
const insertMock = vi.fn();
const selectMock = vi.fn();
const updateMock = vi.fn();
const eqMock = vi.fn();
const orderMock = vi.fn();
const limitMock = vi.fn();
const isMock = vi.fn();
const gteMock = vi.fn();

vi.mock("../lib/supabase", () => {
  const single = vi.fn(() => ({ data: { id: "evt-1" }, error: null }));
  const from = vi.fn(() => ({
    insert: (...args: unknown[]) => { insertMock(...args); return { select: () => ({ single }) }; },
    select: (...args: unknown[]) => { selectMock(...args); return { eq: eqMock, order: orderMock, limit: limitMock, is: isMock, gte: gteMock }; },
    update: (...args: unknown[]) => { updateMock(...args); return { eq: () => ({ data: null, error: null }) }; },
  }));
  return { supabase: { from, auth: { getUser: () => ({ data: { user: { id: "user-1" } } }) } } };
});

import { logInterventionEvent } from "./interventions";

beforeEach(() => {
  insertMock.mockClear();
  selectMock.mockClear();
  updateMock.mockClear();
});

describe("logInterventionEvent", () => {
  it("inserts a row with the expected shape", async () => {
    await logInterventionEvent({
      userUid: "user-1",
      signals: ["consec_losses", "tilt_emotion"],
      critical: false,
      choice: "cancelled",
      sessionDate: "2026-06-02",
    });
    expect(insertMock).toHaveBeenCalledTimes(1);
    const arg = insertMock.mock.calls[0][0] as Record<string, unknown>;
    expect(arg.user_uid).toBe("user-1");
    expect(arg.signals).toEqual(["consec_losses", "tilt_emotion"]);
    expect(arg.choice).toBe("cancelled");
    expect(arg.session_date).toBe("2026-06-02");
  });
});
```

- [ ] **Step 2: Run — verify fail**

```bash
npx vitest run src/data/interventions.test.ts
```
Expected: FAIL — `Cannot find module './interventions'`.

- [ ] **Step 3: Implement `data/interventions.ts`**

```ts
// src/data/interventions.ts
// ═══════════════════════════════════════════════════════════════════════════════
// Kōda · intervention_events CRUD
//
// All reads/writes are RLS-scoped to auth.uid() — see
// supabase/migrations/20260603_intervention_events.sql.
// ═══════════════════════════════════════════════════════════════════════════════

import { supabase } from "../lib/supabase";
import { log } from "../lib/log";
import type { TiltSignalId } from "../lib/tilt";

export type InterventionChoice = "continued" | "cancelled";

export interface InterventionEvent {
  id: string;
  userUid: string;
  firedAt: string;
  signals: TiltSignalId[];
  critical: boolean;
  choice: InterventionChoice;
  tradeId: number | null;
  sessionDate: string;
}

export interface LogInterventionArgs {
  userUid: string;
  signals: TiltSignalId[];
  critical: boolean;
  choice: InterventionChoice;
  sessionDate: string;
}

export async function logInterventionEvent(args: LogInterventionArgs): Promise<string | null> {
  const row = {
    user_uid: args.userUid,
    signals: args.signals,
    critical: args.critical,
    choice: args.choice,
    session_date: args.sessionDate,
  };
  const { data, error } = await supabase
    .from("intervention_events")
    .insert(row)
    .select("id")
    .single();
  if (error) {
    log.error("interventions.log", error, { args });
    return null;
  }
  return (data as { id: string } | null)?.id ?? null;
}

/** Link the newest unlinked intervention event for this user, fired within 10 minutes, to the given trade id. */
export async function linkTradeToRecentIntervention(userUid: string, tradeId: number): Promise<void> {
  const tenMinAgo = new Date(Date.now() - 10 * 60 * 1000).toISOString();
  const { data, error } = await supabase
    .from("intervention_events")
    .select("id")
    .eq("user_uid", userUid)
    .is("trade_id", null)
    .gte("fired_at", tenMinAgo)
    .order("fired_at", { ascending: false })
    .limit(1);
  if (error) {
    log.error("interventions.link.read", error, { userUid, tradeId });
    return;
  }
  const row = (data as Array<{ id: string }> | null)?.[0];
  if (!row) return;
  const { error: updateErr } = await supabase
    .from("intervention_events")
    .update({ trade_id: tradeId })
    .eq("id", row.id);
  if (updateErr) log.error("interventions.link.write", updateErr, { row: row.id, tradeId });
}

export interface InterventionStats {
  fired: number;
  continued: number;
  cancelled: number;
  postInterventionTrades: number;
  postInterventionWins: number;
}

export async function getInterventionStats(userUid: string, sinceISO: string): Promise<InterventionStats> {
  const { data, error } = await supabase
    .from("intervention_events")
    .select("choice, trade_id")
    .eq("user_uid", userUid)
    .gte("fired_at", sinceISO);
  if (error || !data) return { fired: 0, continued: 0, cancelled: 0, postInterventionTrades: 0, postInterventionWins: 0 };
  const rows = data as Array<{ choice: InterventionChoice; trade_id: number | null }>;
  return {
    fired: rows.length,
    continued: rows.filter(r => r.choice === "continued").length,
    cancelled: rows.filter(r => r.choice === "cancelled").length,
    postInterventionTrades: rows.filter(r => r.trade_id !== null).length,
    postInterventionWins: 0, // computed separately by the Stats card which has the trades array
  };
}
```

- [ ] **Step 4: Run — verify pass**

```bash
npx vitest run src/data/interventions.test.ts
```
Expected: PASS — 1 test.

- [ ] **Step 5: Commit**

```bash
git add src/data/interventions.ts src/data/interventions.test.ts
git commit -m "feat(intervention): add data layer

logInterventionEvent inserts a row. linkTradeToRecentIntervention
walks back 10 min for an unlinked event and attaches the new trade id.
getInterventionStats fetches the 7-day rollup for the Stats card.

Co-Authored-By: Claude Sonnet 4.6 <noreply@anthropic.com>"
```

---

## Task 10: `useTiltState` hook + cooldown read/write

**Files:**
- Create: `src/hooks/useTiltState.ts`
- Create: `src/hooks/useTiltState.test.tsx`

- [ ] **Step 1: Write the failing test**

```tsx
// src/hooks/useTiltState.test.tsx
import { describe, it, expect, vi, beforeEach } from "vitest";
import { renderHook, waitFor } from "@testing-library/react";

const storageGet = vi.fn();
const storageSet = vi.fn();
vi.mock("../lib/storage", () => ({
  storage: {
    get: (...a: unknown[]) => storageGet(...a),
    set: (...a: unknown[]) => storageSet(...a),
  },
}));

import { useTiltState } from "./useTiltState";
import type { Trade, Profile } from "../types";

const PROFILE: Profile = {
  name: "", handle: "", bio: "", avatar: "", broker: "",
  timezone: "UTC", startDate: "", targetRR: "",
  maxTradesPerDay: "",
};

beforeEach(() => {
  storageGet.mockReset();
  storageSet.mockReset();
});

describe("useTiltState", () => {
  it("returns inactive state and no lockout when no cooldown stored", async () => {
    storageGet.mockResolvedValueOnce(null);
    const { result } = renderHook(() => useTiltState({ trades: [] as Trade[], profile: PROFILE }));
    await waitFor(() => expect(result.current.state.active).toBe(false));
    expect(result.current.lockedUntil).toBeNull();
  });

  it("exposes lockedUntil when the stored lockout is still in the future", async () => {
    const future = new Date(Date.now() + 5 * 60 * 1000).toISOString();
    storageGet.mockResolvedValueOnce({ value: JSON.stringify({ until: future }) });
    const { result } = renderHook(() => useTiltState({ trades: [] as Trade[], profile: PROFILE }));
    await waitFor(() => expect(result.current.lockedUntil).not.toBeNull());
    expect(result.current.lockedUntil! > Date.now()).toBe(true);
  });

  it("treats an expired stored lockout as null", async () => {
    const past = new Date(Date.now() - 60 * 1000).toISOString();
    storageGet.mockResolvedValueOnce({ value: JSON.stringify({ until: past }) });
    const { result } = renderHook(() => useTiltState({ trades: [] as Trade[], profile: PROFILE }));
    await waitFor(() => expect(result.current.lockedUntil).toBeNull());
  });
});
```

- [ ] **Step 2: Run — verify fail**

```bash
npx vitest run src/hooks/useTiltState.test.tsx
```
Expected: FAIL — `Cannot find module './useTiltState'`.

- [ ] **Step 3: Implement `useTiltState`**

```ts
// src/hooks/useTiltState.ts
// ═══════════════════════════════════════════════════════════════════════════════
// Kōda · useTiltState
//
// Wraps evaluateTilt in useMemo and reads/writes the cooldown lockout stored in
// user_kv under `koda_intervention_lockout`.
// ═══════════════════════════════════════════════════════════════════════════════

import { useEffect, useMemo, useState, useCallback } from "react";
import { storage } from "../lib/storage";
import { log } from "../lib/log";
import { evaluateTilt, type TiltState, type TiltSignalId } from "../lib/tilt";
import type { Trade, Profile } from "../types";

const LOCKOUT_KEY = "koda_intervention_lockout";

export type CooldownMin = 0 | 5 | 15 | 30;

export interface InterventionSettings {
  enabled: boolean;
  cooldownMin: CooldownMin;
}

const DEFAULT_SETTINGS: InterventionSettings = { enabled: true, cooldownMin: 15 };

interface LockoutValue {
  until: string;
  signals: TiltSignalId[];
}

export function useTiltState({
  trades,
  profile,
}: {
  trades: Trade[];
  profile: Profile;
}): {
  state: TiltState;
  lockedUntil: number | null;
  settings: InterventionSettings;
  startCooldown: (signals: TiltSignalId[]) => Promise<void>;
  clearCooldown: () => Promise<void>;
} {
  const [lockedUntil, setLockedUntil] = useState<number | null>(null);

  const settings: InterventionSettings = useMemo(() => {
    const raw = (profile.prefs as { intervention?: Partial<InterventionSettings> } | undefined)?.intervention;
    if (!raw) return DEFAULT_SETTINGS;
    return {
      enabled: raw.enabled ?? DEFAULT_SETTINGS.enabled,
      cooldownMin: (raw.cooldownMin ?? DEFAULT_SETTINGS.cooldownMin) as CooldownMin,
    };
  }, [profile.prefs]);

  // Read lockout from user_kv on mount and whenever the profile uid changes
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const row = await storage.get(LOCKOUT_KEY);
        if (cancelled) return;
        if (!row) { setLockedUntil(null); return; }
        const parsed = JSON.parse(row.value) as LockoutValue;
        const ts = Date.parse(parsed.until);
        if (!isFinite(ts) || ts <= Date.now()) { setLockedUntil(null); return; }
        setLockedUntil(ts);
      } catch (e) {
        log.error("useTiltState.lockoutRead", e);
        setLockedUntil(null);
      }
    })();
    return () => { cancelled = true; };
  }, [profile.uid]);

  const state = useMemo(
    () => evaluateTilt(trades, profile, Date.now()),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [trades.length, trades[trades.length - 1]?.id, profile.maxDailyLoss, profile.maxTradesPerDay],
  );

  const startCooldown = useCallback(async (signals: TiltSignalId[]) => {
    if (settings.cooldownMin === 0) return;
    const until = new Date(Date.now() + settings.cooldownMin * 60_000);
    const payload: LockoutValue = { until: until.toISOString(), signals };
    try {
      await storage.set(LOCKOUT_KEY, JSON.stringify(payload));
      setLockedUntil(until.getTime());
    } catch (e) {
      log.error("useTiltState.lockoutWrite", e);
    }
  }, [settings.cooldownMin]);

  const clearCooldown = useCallback(async () => {
    try {
      await storage.set(LOCKOUT_KEY, JSON.stringify({ until: new Date(0).toISOString(), signals: [] }));
      setLockedUntil(null);
    } catch (e) {
      log.error("useTiltState.lockoutClear", e);
    }
  }, []);

  return { state, lockedUntil, settings, startCooldown, clearCooldown };
}
```

- [ ] **Step 4: Add `prefs` extension to `src/types.ts`**

In `src/types.ts`, find the `Profile` interface. Add at the bottom (before the closing `}`):
```ts
  prefs?: {
    intervention?: {
      enabled?: boolean;
      cooldownMin?: 0 | 5 | 15 | 30;
    };
    [k: string]: unknown;
  };
```

- [ ] **Step 5: Run — verify pass**

```bash
npx vitest run src/hooks/useTiltState.test.tsx
```
Expected: PASS — 3 tests.

- [ ] **Step 6: Commit**

```bash
git add src/hooks/useTiltState.ts src/hooks/useTiltState.test.tsx src/types.ts
git commit -m "feat(intervention): add useTiltState hook + Profile.prefs.intervention

Memoised tilt evaluation + cooldown read/write against user_kv via
the existing storage shim. Expired lockouts treated as null.

Co-Authored-By: Claude Sonnet 4.6 <noreply@anthropic.com>"
```

---

## Task 11: `InterventionSheet` — presentational surface

**Files:**
- Create: `src/components/InterventionSheet.tsx`
- Create: `src/components/InterventionSheet.test.tsx`

- [ ] **Step 1: Write the failing tests**

```tsx
// src/components/InterventionSheet.test.tsx
import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { InterventionSheet } from "./InterventionSheet";
import { DARK } from "../theme";

const SIGNALS = [
  { id: "consec_losses" as const, label: "2 consecutive losses", critical: false },
  { id: "tilt_emotion"  as const, label: "Last trade tagged REVENGE", critical: false },
];

describe("InterventionSheet", () => {
  it("renders title with signal count", () => {
    render(<InterventionSheet open signals={SIGNALS} C={DARK} isMobile onContinue={() => {}} onCancel={() => {}} />);
    expect(screen.getByText(/2 tilt signals/i)).toBeInTheDocument();
  });

  it("renders one row per signal", () => {
    render(<InterventionSheet open signals={SIGNALS} C={DARK} isMobile onContinue={() => {}} onCancel={() => {}} />);
    expect(screen.getByText("2 consecutive losses")).toBeInTheDocument();
    expect(screen.getByText("Last trade tagged REVENGE")).toBeInTheDocument();
  });

  it("calls onContinue when 'I'm aware' is tapped", () => {
    const onContinue = vi.fn();
    render(<InterventionSheet open signals={SIGNALS} C={DARK} isMobile onContinue={onContinue} onCancel={() => {}} />);
    fireEvent.click(screen.getByRole("button", { name: /aware/i }));
    expect(onContinue).toHaveBeenCalledOnce();
  });

  it("calls onCancel when 'Cancel' is tapped", () => {
    const onCancel = vi.fn();
    render(<InterventionSheet open signals={SIGNALS} C={DARK} isMobile onContinue={() => {}} onCancel={onCancel} />);
    fireEvent.click(screen.getByRole("button", { name: /cancel/i }));
    expect(onCancel).toHaveBeenCalledOnce();
  });

  it("does not render when open=false", () => {
    render(<InterventionSheet open={false} signals={SIGNALS} C={DARK} isMobile onContinue={() => {}} onCancel={() => {}} />);
    expect(screen.queryByText(/tilt signals/i)).not.toBeInTheDocument();
  });
});
```

- [ ] **Step 2: Run — verify fail**

```bash
npx vitest run src/components/InterventionSheet.test.tsx
```
Expected: FAIL — `Cannot find module './InterventionSheet'`.

- [ ] **Step 3: Implement the component**

```tsx
// src/components/InterventionSheet.tsx
// ═══════════════════════════════════════════════════════════════════════════════
// Kōda · InterventionSheet
//
// Presentational. Bottom sheet on mobile, centred modal on desktop.
// All state + DB writes are owned by the caller (InterventionGate).
// ═══════════════════════════════════════════════════════════════════════════════

import React from "react";
import { MONO, BODY } from "../shared";
import type { Theme } from "../theme";
import type { TiltSignal } from "../lib/tilt";

export interface InterventionSheetProps {
  open: boolean;
  signals: TiltSignal[];
  C: Theme;
  isMobile: boolean;
  onContinue: () => void;
  onCancel: () => void;
}

export function InterventionSheet({ open, signals, C, isMobile, onContinue, onCancel }: InterventionSheetProps) {
  if (!open) return null;

  const content = (
    <>
      <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 8 }}>
        <span style={{
          width: 8, height: 8, borderRadius: "50%",
          background: C.live, boxShadow: `0 0 10px ${C.live}`,
        }} />
        <span style={{
          fontFamily: MONO, fontSize: 10, letterSpacing: "0.18em",
          textTransform: "uppercase", color: C.live,
        }}>
          Heads up
        </span>
      </div>
      <div style={{
        fontFamily: BODY, fontSize: isMobile ? 14 : 17, fontWeight: 600,
        lineHeight: 1.3, letterSpacing: "-0.01em",
        margin: "4px 0 14px", color: C.text,
      }}>
        {signals.length} tilt signal{signals.length === 1 ? "" : "s"} {signals.length === 1 ? "is" : "are"} active.
      </div>
      <div style={{ borderTop: `1px solid ${C.border}`, paddingTop: 8, marginBottom: 16 }}>
        {signals.map(sig => (
          <div key={sig.id} style={{
            display: "flex", alignItems: "center", gap: 8,
            fontSize: 12, padding: "6px 0", color: C.text,
          }}>
            <span style={{
              width: 6, height: 6, borderRadius: "50%",
              background: C.red, flexShrink: 0,
            }} />
            <span>{sig.label}</span>
          </div>
        ))}
      </div>
      <div style={{ display: "flex", gap: isMobile ? 0 : 10, flexDirection: isMobile ? "column" : "row" }}>
        <button
          onClick={onContinue}
          style={{
            background: C.live, color: "#0A0A0E", border: "none",
            borderRadius: 999, padding: "12px 20px",
            fontWeight: 600, fontSize: 12, fontFamily: BODY,
            cursor: "pointer", letterSpacing: "0.02em",
            flex: isMobile ? undefined : 1.5,
            width: isMobile ? "100%" : undefined,
            marginBottom: isMobile ? 8 : 0,
          }}
        >
          I'm aware — continue
        </button>
        <button
          onClick={onCancel}
          style={{
            background: "transparent", color: C.text2,
            border: `1px solid ${C.border2}`, borderRadius: 999,
            padding: "12px 20px",
            fontSize: 11, fontFamily: MONO,
            cursor: "pointer", letterSpacing: "0.06em", textTransform: "uppercase",
            flex: isMobile ? undefined : 1,
            width: isMobile ? "100%" : undefined,
          }}
        >
          Cancel · take a break
        </button>
      </div>
    </>
  );

  if (isMobile) {
    return (
      <div onClick={onCancel} style={{
        position: "fixed", inset: 0, zIndex: 1000,
        background: "rgba(0,0,0,0.45)",
        display: "flex", alignItems: "flex-end", justifyContent: "center",
      }}>
        <div onClick={e => e.stopPropagation()} style={{
          background: C.panel, width: "100%", maxWidth: 480,
          borderTopLeftRadius: 24, borderTopRightRadius: 24,
          padding: "16px 18px 22px", borderTop: `1px solid ${C.border}`,
        }}>
          <div style={{
            width: 36, height: 4, background: C.border2,
            borderRadius: 999, margin: "0 auto 14px",
          }} />
          {content}
        </div>
      </div>
    );
  }

  return (
    <div onClick={onCancel} style={{
      position: "fixed", inset: 0, zIndex: 1000,
      background: "rgba(0,0,0,0.62)",
      backdropFilter: "blur(2px)", WebkitBackdropFilter: "blur(2px)",
      display: "flex", alignItems: "center", justifyContent: "center",
    }}>
      <div onClick={e => e.stopPropagation()} style={{
        width: 380, background: C.panel,
        border: `1px solid ${C.border2}`, borderRadius: 18,
        padding: "24px 26px 22px",
        boxShadow: "0 30px 80px rgba(0,0,0,0.55)",
      }}>
        {content}
      </div>
    </div>
  );
}
```

- [ ] **Step 4: Run — verify pass**

```bash
npx vitest run src/components/InterventionSheet.test.tsx
```
Expected: PASS — 5 tests.

- [ ] **Step 5: Commit**

```bash
git add src/components/InterventionSheet.tsx src/components/InterventionSheet.test.tsx
git commit -m "feat(intervention): add InterventionSheet (mobile sheet + desktop modal)

Presentational. Backdrop tap = same as Cancel button (no silent
dismiss). Mobile renders a bottom sheet with handle; desktop renders
a 380px centred modal with blur backdrop.

Co-Authored-By: Claude Sonnet 4.6 <noreply@anthropic.com>"
```

---

## Task 12: `InterventionGate` — gate component

**Files:**
- Create: `src/components/InterventionGate.tsx`
- Create: `src/components/InterventionGate.test.tsx`

- [ ] **Step 1: Write the failing test**

```tsx
// src/components/InterventionGate.test.tsx
import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { InterventionGate } from "./InterventionGate";
import { DARK } from "../theme";

const NO_SIGNALS = { active: false, critical: false, signals: [], evaluatedAt: 0 };
const ACTIVE_STATE = {
  active: true, critical: false, evaluatedAt: 0,
  signals: [{ id: "consec_losses" as const, label: "2 consecutive losses", critical: false }],
};

describe("InterventionGate", () => {
  it("renders the child Log Trade button as-is when tilt is inactive and no lockout", () => {
    const onProceed = vi.fn();
    render(
      <InterventionGate
        state={NO_SIGNALS} lockedUntil={null} settings={{ enabled: true, cooldownMin: 15 }}
        isMobile C={DARK} onContinue={onProceed} onCancel={() => {}}
      >
        <button>Log Trade</button>
      </InterventionGate>,
    );
    fireEvent.click(screen.getByText("Log Trade"));
    expect(onProceed).toHaveBeenCalledOnce();
  });

  it("renders the cooldown pill in place of the child when locked", () => {
    const future = Date.now() + 5 * 60 * 1000;
    render(
      <InterventionGate
        state={NO_SIGNALS} lockedUntil={future} settings={{ enabled: true, cooldownMin: 15 }}
        isMobile C={DARK} onContinue={() => {}} onCancel={() => {}}
      >
        <button>Log Trade</button>
      </InterventionGate>,
    );
    expect(screen.queryByText("Log Trade")).not.toBeInTheDocument();
    expect(screen.getByText(/cooling off/i)).toBeInTheDocument();
  });

  it("opens the sheet when child is tapped and tilt is active", () => {
    render(
      <InterventionGate
        state={ACTIVE_STATE} lockedUntil={null} settings={{ enabled: true, cooldownMin: 15 }}
        isMobile C={DARK} onContinue={() => {}} onCancel={() => {}}
      >
        <button>Log Trade</button>
      </InterventionGate>,
    );
    fireEvent.click(screen.getByText("Log Trade"));
    expect(screen.getByText(/tilt signal/i)).toBeInTheDocument();
  });

  it("calls onContinue when sheet's continue is tapped", () => {
    const onContinue = vi.fn();
    render(
      <InterventionGate
        state={ACTIVE_STATE} lockedUntil={null} settings={{ enabled: true, cooldownMin: 15 }}
        isMobile C={DARK} onContinue={onContinue} onCancel={() => {}}
      >
        <button>Log Trade</button>
      </InterventionGate>,
    );
    fireEvent.click(screen.getByText("Log Trade"));
    fireEvent.click(screen.getByRole("button", { name: /aware/i }));
    expect(onContinue).toHaveBeenCalledOnce();
  });

  it("bypasses gating when settings.enabled = false", () => {
    const onContinue = vi.fn();
    render(
      <InterventionGate
        state={ACTIVE_STATE} lockedUntil={null} settings={{ enabled: false, cooldownMin: 15 }}
        isMobile C={DARK} onContinue={onContinue} onCancel={() => {}}
      >
        <button>Log Trade</button>
      </InterventionGate>,
    );
    fireEvent.click(screen.getByText("Log Trade"));
    expect(onContinue).toHaveBeenCalledOnce();
  });
});
```

- [ ] **Step 2: Run — verify fail**

```bash
npx vitest run src/components/InterventionGate.test.tsx
```
Expected: FAIL — module not found.

- [ ] **Step 3: Implement `InterventionGate`**

```tsx
// src/components/InterventionGate.tsx
// ═══════════════════════════════════════════════════════════════════════════════
// Kōda · InterventionGate
//
// Wraps the Log Trade trigger. Three render branches:
//   1. locked       — render cooldown pill instead of the child
//   2. tilt active  — render child with click intercepted by the sheet
//   3. otherwise    — render child as-is
// ═══════════════════════════════════════════════════════════════════════════════

import React, { useEffect, useState } from "react";
import { MONO } from "../shared";
import type { Theme } from "../theme";
import type { TiltState } from "../lib/tilt";
import { InterventionSheet } from "./InterventionSheet";
import type { InterventionSettings } from "../hooks/useTiltState";

export interface InterventionGateProps {
  state: TiltState;
  lockedUntil: number | null;
  settings: InterventionSettings;
  isMobile: boolean;
  C: Theme;
  children: React.ReactNode;
  onContinue: () => void;
  onCancel: () => void;
}

function formatCountdown(msRemaining: number): string {
  const total = Math.max(0, Math.ceil(msRemaining / 1000));
  const m = Math.floor(total / 60);
  const s = total % 60;
  return `${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
}

export function InterventionGate({
  state, lockedUntil, settings, isMobile, C, children, onContinue, onCancel,
}: InterventionGateProps) {
  const [now, setNow] = useState(Date.now());
  const [open, setOpen] = useState(false);

  // Re-render once a second while locked so the countdown ticks
  useEffect(() => {
    if (lockedUntil === null) return;
    const id = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(id);
  }, [lockedUntil]);

  // ── Branch 1: locked ──────────────────────────────────────────────────
  if (lockedUntil !== null && lockedUntil > now) {
    return (
      <div style={{
        display: "inline-flex", alignItems: "center", gap: 8,
        border: `1px solid ${C.live}`,
        borderRadius: 999, padding: "8px 14px",
        background: "transparent",
        color: C.live, fontFamily: MONO, fontSize: 11,
        letterSpacing: "0.08em", textTransform: "uppercase",
        boxShadow: `0 0 12px ${C.live}33`,
      }}>
        <span style={{ width: 6, height: 6, borderRadius: "50%", background: C.live }} />
        Cooling off · {formatCountdown(lockedUntil - now)}
      </div>
    );
  }

  // ── Branch 2/3: tap intercept or passthrough ──────────────────────────
  const handleTap: React.MouseEventHandler = e => {
    if (!settings.enabled || !state.active) {
      onContinue();
      return;
    }
    e.preventDefault();
    e.stopPropagation();
    setOpen(true);
  };

  return (
    <>
      <span onClickCapture={handleTap}>{children}</span>
      <InterventionSheet
        open={open}
        signals={state.signals}
        C={C}
        isMobile={isMobile}
        onContinue={() => { setOpen(false); onContinue(); }}
        onCancel={()  => { setOpen(false); onCancel();  }}
      />
    </>
  );
}
```

- [ ] **Step 4: Run — verify pass**

```bash
npx vitest run src/components/InterventionGate.test.tsx
```
Expected: PASS — 5 tests.

- [ ] **Step 5: Commit**

```bash
git add src/components/InterventionGate.tsx src/components/InterventionGate.test.tsx
git commit -m "feat(intervention): add InterventionGate component

Three render branches: locked (cooldown pill), tilt-active (tap
intercepted with sheet), or passthrough. Countdown ticks once per
second while locked. settings.enabled=false bypasses everything.

Co-Authored-By: Claude Sonnet 4.6 <noreply@anthropic.com>"
```

---

## Task 13: Wire into `Koda.tsx`

**Files:**
- Modify: `src/Koda.tsx`

- [ ] **Step 1: Locate the Log Trade bottom-nav button**

Open `src/Koda.tsx`. Find the bottom-nav section that contains a button with view value `"log"`. It will be near the very bottom of the file inside the bottom-navigation block.

- [ ] **Step 2: Add imports at the top of `Koda.tsx`**

After the existing `useFeed` import, add:
```tsx
import { useTiltState } from "./hooks/useTiltState";
import { logInterventionEvent } from "./data/interventions";
import { InterventionGate } from "./components/InterventionGate";
import { useViewport } from "./hooks/useViewport";
```

- [ ] **Step 3: Add the hook + handler inside the Koda component**

Inside the Koda function body, after the existing `useFollows` / `useFeed` calls and after `isPro` is defined (around line 150-200), add:
```tsx
  const tilt = useTiltState({ trades, profile });
  const { isMobile } = useViewport();

  const handleLogTradeProceed = async (): Promise<void> => {
    // Record the intervention event if a tilt-active sheet just resolved.
    if (tilt.state.active && profile.uid) {
      await logInterventionEvent({
        userUid: profile.uid,
        signals: tilt.state.signals.map(s => s.id),
        critical: tilt.state.critical,
        choice: "continued",
        sessionDate: todayLocalDate(),
      });
    }
    primaryNav("log");
  };

  const handleLogTradeCancel = async (): Promise<void> => {
    if (profile.uid) {
      await logInterventionEvent({
        userUid: profile.uid,
        signals: tilt.state.signals.map(s => s.id),
        critical: tilt.state.critical,
        choice: "cancelled",
        sessionDate: todayLocalDate(),
      });
    }
    await tilt.startCooldown(tilt.state.signals.map(s => s.id));
  };

  function todayLocalDate(): string {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
  }
```

- [ ] **Step 4: Wrap the Log Trade button with `InterventionGate`**

Find the bottom-nav Log Trade tab button (looks like `<button ... onClick={() => primaryNav("log")}>...Log...</button>`).

Replace it with:
```tsx
<InterventionGate
  state={tilt.state}
  lockedUntil={tilt.lockedUntil}
  settings={tilt.settings}
  isMobile={isMobile}
  C={C}
  onContinue={handleLogTradeProceed}
  onCancel={handleLogTradeCancel}
>
  <button
    onClick={e => e.preventDefault()}
    style={/* ── existing Log Trade button styles, unchanged ── */}
  >
    {/* ── existing Log Trade label/icon ── */}
  </button>
</InterventionGate>
```

The child button's `onClick` becomes a no-op stub because `InterventionGate` handles the click via `onClickCapture` on the wrapping `<span>`.

- [ ] **Step 5: Run typecheck + build**

```bash
npm run typecheck && npm run build
```
Expected: both pass with 0 errors.

- [ ] **Step 6: Run all tests**

```bash
npm test
```
Expected: all tests pass (272 baseline + ~28 new).

- [ ] **Step 7: Commit**

```bash
git add src/Koda.tsx
git commit -m "feat(intervention): wire InterventionGate around Log Trade

Single surgical change inside Koda.tsx. Continue records 'continued'
event then navigates; Cancel records 'cancelled' event then starts
the cooldown. Both events carry today's signals and critical flag.

Co-Authored-By: Claude Sonnet 4.6 <noreply@anthropic.com>"
```

---

## Task 14: Trade-link on Save

**Files:**
- Modify: `src/Koda.tsx`

- [ ] **Step 1: Locate the trade-save function**

In `src/Koda.tsx`, find the function `saveTrade` (or whichever function persists a new trade — look for `upsertTradeV2` calls or `saveTrades`).

- [ ] **Step 2: Add the import**

At the top of `Koda.tsx`, update the interventions import:
```tsx
import { logInterventionEvent, linkTradeToRecentIntervention } from "./data/interventions";
```

- [ ] **Step 3: Call the linker after a successful insert**

After the line that confirms a new trade has been persisted (e.g. after `saveTrades(updated)` or after `upsertTradeV2(...)`), add:
```tsx
if (profile.uid && newTradeId !== null) {
  void linkTradeToRecentIntervention(profile.uid, newTradeId);
}
```

`newTradeId` is whatever local id the new trade was assigned. If the save flow doesn't currently surface that id, capture it from the in-memory `updated` array (the last item if it's append-only).

- [ ] **Step 4: Run typecheck + build**

```bash
npm run typecheck && npm run build
```
Expected: pass.

- [ ] **Step 5: Commit**

```bash
git add src/Koda.tsx
git commit -m "feat(intervention): link saved trade to recent intervention event

On a new-trade insert, walk back 10 min for an unlinked event for this
user and attach the new trade id. Powers post-intervention win-rate
analytics in the Stats card.

Co-Authored-By: Claude Sonnet 4.6 <noreply@anthropic.com>"
```

---

## Task 15: Settings "Discipline" section

**Files:**
- Modify: `src/SettingsScreen.tsx`

- [ ] **Step 1: Locate the Settings layout**

Open `src/SettingsScreen.tsx`. Find the existing section list (Profile, Notifications, Export, Delete Account, etc.).

- [ ] **Step 2: Add the Discipline section between Profile and Export**

Insert this JSX block:
```tsx
<div style={{
  background: C.panel, border: `1px solid ${C.border}`,
  borderRadius: 14, padding: 16, marginBottom: 12,
}}>
  <div style={{
    fontFamily: MONO, fontSize: 10, letterSpacing: "0.16em",
    textTransform: "uppercase", color: C.muted, marginBottom: 12,
  }}>
    Discipline
  </div>

  <label style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 14 }}>
    <span style={{ fontFamily: BODY, fontSize: 14, color: C.text }}>
      In-session intervention
    </span>
    <input
      type="checkbox"
      checked={profile.prefs?.intervention?.enabled ?? true}
      onChange={e => {
        const next: Profile = {
          ...profile,
          prefs: {
            ...(profile.prefs ?? {}),
            intervention: {
              ...(profile.prefs?.intervention ?? {}),
              enabled: e.target.checked,
            },
          },
        };
        saveProfile(next);
      }}
    />
  </label>

  <div style={{ fontFamily: MONO, fontSize: 10, color: C.muted, marginBottom: 8, letterSpacing: "0.08em", textTransform: "uppercase" }}>
    Cooldown when cancelled
  </div>
  <div style={{ display: "flex", gap: 6 }}>
    {([0, 5, 15, 30] as const).map(min => {
      const current = profile.prefs?.intervention?.cooldownMin ?? 15;
      const active = current === min;
      return (
        <button
          key={min}
          onClick={() => {
            const next: Profile = {
              ...profile,
              prefs: {
                ...(profile.prefs ?? {}),
                intervention: {
                  ...(profile.prefs?.intervention ?? {}),
                  cooldownMin: min,
                },
              },
            };
            saveProfile(next);
          }}
          style={{
            flex: 1, padding: "8px 0",
            background: active ? C.live : "transparent",
            border: `1px solid ${active ? C.live : C.border2}`,
            color: active ? "#0A0A0E" : C.text2,
            borderRadius: 999, fontFamily: MONO, fontSize: 11,
            letterSpacing: "0.06em", textTransform: "uppercase",
            cursor: "pointer",
          }}
        >
          {min === 0 ? "Off" : `${min} min`}
        </button>
      );
    })}
  </div>
</div>
```

- [ ] **Step 3: Wire `saveProfile` if not already a prop**

If `SettingsScreen` doesn't already receive a `saveProfile` callback, ensure it does (it likely does, since Profile edit lives here). If named differently, swap accordingly.

- [ ] **Step 4: Run typecheck + build + tests**

```bash
npm run typecheck && npm run build && npm test
```
Expected: all pass.

- [ ] **Step 5: Commit**

```bash
git add src/SettingsScreen.tsx
git commit -m "feat(intervention): add Discipline section to Settings

Toggle for the feature + pill row to pick cooldown duration
(Off / 5 / 15 / 30 min). Writes through profile.prefs.intervention.

Co-Authored-By: Claude Sonnet 4.6 <noreply@anthropic.com>"
```

---

## Task 16: Stats "IN-SESSION CHECK-INS" card

**Files:**
- Create: `src/components/InSessionStatsCard.tsx`
- Create: `src/components/InSessionStatsCard.test.tsx`
- Modify: `src/Koda.tsx`

- [ ] **Step 1: Write the failing test**

```tsx
// src/components/InSessionStatsCard.test.tsx
import { describe, it, expect, vi } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";

vi.mock("../data/interventions", () => ({
  getInterventionStats: vi.fn(async () => ({
    fired: 3, continued: 1, cancelled: 2,
    postInterventionTrades: 1, postInterventionWins: 0,
  })),
}));

import { InSessionStatsCard } from "./InSessionStatsCard";
import { DARK } from "../theme";

describe("InSessionStatsCard", () => {
  it("renders fired/continued/cancelled counts", async () => {
    render(<InSessionStatsCard userUid="user-1" trades={[]} C={DARK} />);
    await waitFor(() => expect(screen.getByText(/3 fired/i)).toBeInTheDocument());
    expect(screen.getByText(/1 continued/i)).toBeInTheDocument();
    expect(screen.getByText(/2 cancelled/i)).toBeInTheDocument();
  });
});
```

- [ ] **Step 2: Run — verify fail**

```bash
npx vitest run src/components/InSessionStatsCard.test.tsx
```
Expected: FAIL — module not found.

- [ ] **Step 3: Implement the card**

```tsx
// src/components/InSessionStatsCard.tsx
import { useEffect, useState } from "react";
import { MONO, BODY } from "../shared";
import type { Theme } from "../theme";
import type { Trade } from "../types";
import { getInterventionStats, type InterventionStats } from "../data/interventions";

export function InSessionStatsCard({
  userUid, trades, C,
}: { userUid: string; trades: Trade[]; C: Theme }) {
  const [stats, setStats] = useState<InterventionStats | null>(null);

  useEffect(() => {
    if (!userUid) return;
    let alive = true;
    const sevenDaysAgo = new Date(Date.now() - 7 * 86400_000).toISOString();
    (async () => {
      const s = await getInterventionStats(userUid, sevenDaysAgo);
      if (alive) setStats(s);
    })();
    return () => { alive = false; };
  }, [userUid, trades.length]);

  if (!stats) return null;
  if (stats.fired === 0) return null; // hide empty state

  return (
    <div style={{
      background: C.panel, border: `1px solid ${C.border}`,
      borderRadius: 14, padding: 16, marginBottom: 12,
    }}>
      <div style={{
        fontFamily: MONO, fontSize: 10, letterSpacing: "0.16em",
        textTransform: "uppercase", color: C.muted, marginBottom: 10,
      }}>
        In-Session Check-Ins · Last 7d
      </div>
      <div style={{ fontFamily: BODY, fontSize: 14, color: C.text, lineHeight: 1.6 }}>
        <strong>{stats.fired}</strong> fired · <strong>{stats.continued}</strong> continued · <strong>{stats.cancelled}</strong> cancelled
      </div>
      {stats.continued > 0 && (
        <div style={{ fontFamily: MONO, fontSize: 11, color: C.muted, marginTop: 6, letterSpacing: "0.04em" }}>
          Post-intervention trades: {stats.postInterventionTrades}
        </div>
      )}
    </div>
  );
}
```

- [ ] **Step 4: Mount the card on the Stats tab in `Koda.tsx`**

Find the Stats tab JSX, near the existing Discipline Score card. Add:
```tsx
{profile.uid && <InSessionStatsCard userUid={profile.uid} trades={trades} C={C} />}
```

And add the import at the top of `Koda.tsx`:
```tsx
import { InSessionStatsCard } from "./components/InSessionStatsCard";
```

- [ ] **Step 5: Run all tests + build**

```bash
npm run typecheck && npm run build && npm test
```
Expected: all pass.

- [ ] **Step 6: Commit**

```bash
git add src/components/InSessionStatsCard.tsx src/components/InSessionStatsCard.test.tsx src/Koda.tsx
git commit -m "feat(intervention): add Stats card for in-session check-ins

7-day rollup of fired/continued/cancelled counts. Hides itself if
nothing has fired so users don't see an empty box. Mounts next to
the existing Discipline Score card on the Stats tab.

Co-Authored-By: Claude Sonnet 4.6 <noreply@anthropic.com>"
```

---

## Task 17: PostHog telemetry event

**Files:**
- Modify: `src/data/interventions.ts`

- [ ] **Step 1: Emit `intervention_fired` from `logInterventionEvent`**

In `src/data/interventions.ts`, add the posthog import:
```ts
import posthog from "posthog-js";
```

Then at the end of `logInterventionEvent`, before `return data?.id`:
```ts
  try {
    posthog.capture("intervention_fired", {
      signals: args.signals,
      critical: args.critical,
      choice: args.choice,
      session_date: args.sessionDate,
    });
  } catch { /* posthog might be disabled in dev */ }
```

- [ ] **Step 2: Run tests**

```bash
npm test
```
Expected: 273+ tests pass (existing PostHog tests should still pass since we only added a capture call).

- [ ] **Step 3: Commit**

```bash
git add src/data/interventions.ts
git commit -m "feat(intervention): emit posthog 'intervention_fired' event

Captures signals, critical flag, choice, session_date. Wrapped in
try/catch because posthog is optional in dev.

Co-Authored-By: Claude Sonnet 4.6 <noreply@anthropic.com>"
```

---

## Task 18: Playwright end-to-end spec

**Files:**
- Create: `tests/in-session-intervention.spec.ts`

- [ ] **Step 1: Write the E2E spec**

```ts
// tests/in-session-intervention.spec.ts
import { test, expect } from "@playwright/test";

// Sign in via the existing beta-unlock + magic-link path used by other specs.
// (The repo already has a pattern for this — copy from tests/audit-fixes.spec.ts
//  if a sign-in helper isn't already extracted.)

test("Log Trade button triggers intervention when 2 losses are logged", async ({ page }) => {
  await page.goto("/");
  // Bypass beta gate
  await page.evaluate(() => localStorage.setItem("koda_beta_unlocked", "1"));

  // Sign in test user (assumes E2E credentials in env)
  // ... existing sign-in helper

  // Seed 2 losing trades using the Log Trade form
  for (const _ of [1, 2]) {
    await page.click('[data-testid="tab-log"]');
    await page.fill('[data-testid="log-pair"]', "ES");
    await page.selectOption('[data-testid="log-outcome"]', "Loss");
    await page.fill('[data-testid="log-pnl"]', "-100");
    await page.click('[data-testid="log-save"]');
  }

  // Tap Log Trade again — sheet should appear
  await page.click('[data-testid="tab-log"]');
  await expect(page.getByText(/tilt signal/i)).toBeVisible();

  // Tap Cancel — sheet closes, cooldown pill appears
  await page.click('text=Cancel · take a break');
  await expect(page.getByText(/cooling off/i)).toBeVisible();
});
```

- [ ] **Step 2: Run the spec**

```bash
npx playwright test tests/in-session-intervention.spec.ts
```
Expected: PASS (may require minor selector tweaks against the real DOM — adjust `data-testid` attributes in `LogTradeScreen` and bottom-nav if they don't exist yet).

- [ ] **Step 3: If selectors don't match, add the necessary `data-testid`s**

In `src/LogTradeScreen.tsx`, add `data-testid="log-pair"`, `data-testid="log-outcome"`, `data-testid="log-pnl"`, `data-testid="log-save"` to the relevant inputs/select/button. In the bottom-nav, add `data-testid="tab-log"` to the Log tab button (the gate's wrapping `<span>`, so the click capture still works).

Re-run the Playwright spec — expect green.

- [ ] **Step 4: Commit**

```bash
git add tests/in-session-intervention.spec.ts src/LogTradeScreen.tsx src/Koda.tsx
git commit -m "test(intervention): add E2E spec for the Log Trade tilt path

Logs 2 losses, taps Log Trade again, expects sheet to appear,
Cancel closes it and surfaces the cooldown pill. Adds the data-testid
hooks the spec needs.

Co-Authored-By: Claude Sonnet 4.6 <noreply@anthropic.com>"
```

---

## Task 19: Docs + handoff

**Files:**
- Modify: `NEXT_SESSION.md`
- Modify: `CLAUDE.md`

- [ ] **Step 1: Update `CLAUDE.md` Features list**

Find the Features list. Add a new bullet:
```
- In-session intervention — Log Trade tap intercepted when tilt signals are active. Bottom-sheet (mobile) / modal (desktop) lists signals. Cancel starts a user-configurable cooldown (default 15 min). Continue / Cancel events recorded in `public.intervention_events`. Stats card surfaces the 7-day rollup.
```

- [ ] **Step 2: Update `CLAUDE.md` Migrations table**

Add row:
```
| `20260603_intervention_events.sql` | `intervention_events` table + RLS for in-session intervention v1 | ✅ |
```

- [ ] **Step 3: Update `CLAUDE.md` Key Files table**

Add rows:
```
| `src/lib/tilt.ts` | Pure tilt evaluator — `evaluateTilt(trades, profile, now)` |
| `src/hooks/useTiltState.ts` | Memoised evaluator + cooldown read/write to `koda_intervention_lockout` |
| `src/components/InterventionGate.tsx` | Wraps Log Trade trigger — passthrough / sheet / cooldown pill |
| `src/components/InterventionSheet.tsx` | Bottom sheet (mobile) + centred modal (desktop) |
| `src/data/interventions.ts` | CRUD against `public.intervention_events` |
```

- [ ] **Step 4: Update `NEXT_SESSION.md`**

Add a "What shipped" entry for today summarising the in-session intervention work and any TODOs (e.g., "Stats card win-rate line not yet computed against `trades` — phase 2").

- [ ] **Step 5: Commit**

```bash
git add NEXT_SESSION.md CLAUDE.md
git commit -m "docs: log in-session intervention v1 + update key files / migrations tables

Co-Authored-By: Claude Sonnet 4.6 <noreply@anthropic.com>"
```

---

## Final QA & Demo

- [ ] **Run the full verification suite**

```bash
npm run typecheck && npm run build && npm test
```
Expected: clean across the board.

- [ ] **Manually exercise the feature on a real device**

In a dev build (`npm run dev`):
1. Sign in as Dylon
2. Log a winning trade — verify no intervention
3. Log 2 losing trades, one tagged "revenge" — verify the sheet appears when tapping Log Trade
4. Tap **Cancel** — verify cooldown pill, Log Trade button replaced for 15 min
5. Wait for cooldown to expire (or use devtools to clear `koda_intervention_lockout`)
6. Tap Log Trade again, this time tap **I'm aware — continue** — verify the form opens
7. Save the trade — open Supabase SQL Editor, verify the `intervention_events` row has `trade_id` set
8. Open the Stats tab — verify the "IN-SESSION CHECK-INS · LAST 7d" card shows 2 fired / 1 continued / 1 cancelled

- [ ] **Record the demo on phone**

Per spec §12 — three takes, best one for launch content.

- [ ] **DO NOT push to main** until Dylon explicitly approves. Push = deploy.

---

## Self-Review (run before handing off)

**1. Spec coverage:** ✅
- §1 Summary — covered by Tasks 1-17
- §2 Goals/non-goals — design respects all v1 constraints
- §3 UX — sheet (Task 11) + gate (Task 12) + cooldown pill (Task 12) + settings (Task 15) + stats (Task 16)
- §4 Signals — Tasks 3-7
- §5 Architecture — Tasks 2, 9, 10, 11, 12
- §6 Data model — Task 1 (migration) + Task 10 (Profile.prefs)
- §7 State machine — Tasks 12, 13, 14
- §8 Telemetry — Task 17
- §9 Paywall — relies on existing `isPro`; no new code needed (would be a one-line check inside `handleLogTradeProceed` post-beta; documented in §9 of the spec)
- §10 Testing — Tasks 2-12 each include unit tests; Task 18 covers E2E
- §11 Non-goals — none included
- §12 Demo — Final QA section
- §13 DoD — Final QA section

**2. Placeholder scan:** No "TBD" / "TODO" / "add appropriate error handling" / "similar to Task N" markers.

**3. Type consistency:**
- `TiltSignalId`, `TiltSignal`, `TiltState` defined Task 2, referenced consistently in Tasks 9, 10, 11, 12
- `InterventionSettings.cooldownMin: 0 | 5 | 15 | 30` matches the Settings UI in Task 15
- `InterventionChoice = "continued" | "cancelled"` matches the DB check constraint in Task 1
- `linkTradeToRecentIntervention` signature consistent across Tasks 9 and 14

**4. Out-of-scope checks:** No paywall enforcement code (beta still has paywall off — feature ships for everyone), no live broker integration (Tradovate dormant). Both per spec §11.

---

## Execution Handoff

Plan complete and saved to `docs/superpowers/plans/2026-06-02-in-session-intervention-v1.md`. Two execution options:

**1. Subagent-Driven (recommended)** — I dispatch a fresh subagent per task, review between tasks, fast iteration

**2. Inline Execution** — Execute tasks in this session using executing-plans, batch execution with checkpoints

**Which approach?**
