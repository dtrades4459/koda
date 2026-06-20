# Mentor Mode — Phase A Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Surface the existing coach/instructor dashboard as "Mentor Mode" and let a mentor leave rated annotations on the trades their students share into the cohort — no billing.

**Architecture:** A mentor cohort is an existing Circle marked `type: "mentor"` in its KV meta blob. The coach dashboard (`TradingCircles.tsx:743`, `instructorRoster.ts`) is reused as-is; only branding/gating is added. Annotations attach to `circle_shared_trades` rows (not the private journal) via a new `trade_annotations` table with role-gated RLS. A "share all my trades to this cohort" action turns manual per-trade sharing into a bulk share.

**Tech Stack:** React 19 + TypeScript + Vite, Supabase (Postgres + RLS), Vitest, shared_kv blobs for circle meta.

## Global Constraints

- Flag `mentorMode` is **off by default** — NOT added to `DEFAULT_ON` in `src/lib/flags.ts`.
- No `: any` and no unsigned `eslint-disable` — the pre-commit hook blocks both. Sign any disable with a reason.
- Real typecheck is `npx tsc -p tsconfig.app.json` (plain `npm run typecheck` passes silently — see memory).
- Run tests with `npx vitest run --maxWorkers=1` (8GB machine; higher worker counts crash).
- Every migration is **additive + idempotent**, includes pre-flight and post-flight SQL comment blocks and a rollback block, and ends with `notify pgrst, 'reload schema';` (follow `20260613_circle_roles_moderator.sql` as the template).
- `/api/*` use the service-role client and bypass RLS; RLS only protects direct client reads/writes.
- Trades: `pnl` = R-multiples, `pnlDollar` = dollars (see memory). Annotations never compute P&L.
- Annotations are gated in the UI by `isFlagOn("mentorMode")` AND coach role; RLS is the security backstop.

---

### Task 1: `mentorMode` flag + `type` on Circle + `isMentorCircle` helper

**Files:**
- Modify: `src/lib/flags.ts` (comment only — confirm `mentorMode` is NOT in `DEFAULT_ON`)
- Modify: `src/types.ts:123-139` (add `type?` to `Circle`)
- Create: `src/lib/mentorCircle.ts`
- Test: `src/lib/mentorCircle.test.ts`

**Interfaces:**
- Produces: `isMentorCircle(circle: Pick<Circle, "type">): boolean`; `MENTOR_CIRCLE_TYPE = "mentor"` constant.

- [ ] **Step 1: Write the failing test**

```ts
// src/lib/mentorCircle.test.ts
import { describe, it, expect } from "vitest";
import { isMentorCircle, MENTOR_CIRCLE_TYPE } from "./mentorCircle";

describe("isMentorCircle", () => {
  it("is true when type is the mentor marker", () => {
    expect(isMentorCircle({ type: MENTOR_CIRCLE_TYPE })).toBe(true);
  });
  it("is false for undefined / other types", () => {
    expect(isMentorCircle({ type: undefined })).toBe(false);
    expect(isMentorCircle({ type: "social" as never })).toBe(false);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/lib/mentorCircle.test.ts --maxWorkers=1`
Expected: FAIL — cannot find module `./mentorCircle`.

- [ ] **Step 3: Add `type` to the Circle interface**

In `src/types.ts`, inside `interface Circle` (after `emoji?: string;` near line 125) add:

```ts
  /** "mentor" marks a coaching cohort — unlocks Mentor Mode UI + annotations.
   *  Absent on ordinary circles. Lives in the KV meta blob; mirrored to the
   *  circles table column for eventual server-side checks. */
  type?: "mentor";
```

- [ ] **Step 4: Write the helper**

```ts
// src/lib/mentorCircle.ts
// ─────────────────────────────────────────────────────────────────────────────
// Kōda · Mentor Mode — circle-type marker.
// A mentor cohort is an ordinary Circle whose KV meta carries type:"mentor".
// ─────────────────────────────────────────────────────────────────────────────

export const MENTOR_CIRCLE_TYPE = "mentor" as const;

export function isMentorCircle(circle: { type?: string | null }): boolean {
  return circle?.type === MENTOR_CIRCLE_TYPE;
}
```

- [ ] **Step 5: Run test to verify it passes**

Run: `npx vitest run src/lib/mentorCircle.test.ts --maxWorkers=1`
Expected: PASS (2 tests).

- [ ] **Step 6: Typecheck + commit**

```bash
npx tsc -p tsconfig.app.json
git add src/lib/mentorCircle.ts src/lib/mentorCircle.test.ts src/types.ts
git commit -m "feat(mentor): add mentorMode marker type + isMentorCircle helper"
```

---

### Task 2: Create circles as mentor cohorts

**Files:**
- Modify: `src/hooks/useCircles.ts:386-421` (`createCircle`, `circleForm` state, reset)
- Modify: `src/TradingCircles.tsx` (create-circle form — add the toggle, gated by `mentorMode`)

**Interfaces:**
- Consumes: `MENTOR_CIRCLE_TYPE` from `src/lib/mentorCircle.ts`.
- Produces: a created circle whose KV blob includes `type: "mentor"` when the form's `isMentor` is set.

- [ ] **Step 1: Extend the create-circle form state**

In `src/hooks/useCircles.ts`, find the two `setCircleForm({ ... })` literals (init ~line 142 and reset ~line 421) and the `circleForm` type. Add `isMentor: false` to both literals, and `isMentor?: boolean` to the form type.

- [ ] **Step 2: Write `type` into the circle blob**

In `createCircle` (line 401), in the `circle` object literal, after the `requiredMetrics` spread (line 412) add:

```ts
        ...(circleForm.isMentor ? { type: "mentor" as const } : {}),
```

Import at top of the spread is unnecessary (literal). The blob is persisted by the existing `storage.set("koda_circle_" + code, ...)` on line 417 — no other change needed.

- [ ] **Step 3: Add the create-form toggle (UI), flag-gated**

In `src/TradingCircles.tsx` create-circle form (near the required-metrics block ~line 1072), add, gated by `isFlagOn("mentorMode")`:

```tsx
{isFlagOn("mentorMode") && (
  <label style={{ display: "flex", gap: 8, alignItems: "center", marginTop: 12 }}>
    <input
      type="checkbox"
      checked={!!circleForm.isMentor}
      onChange={e => setCircleForm({ ...circleForm, isMentor: e.target.checked })}
    />
    <span>Mentor cohort (unlocks the coach dashboard + trade annotations)</span>
  </label>
)}
```

Ensure `isFlagOn` is imported (`import { isFlagOn } from "./lib/flags";`).

- [ ] **Step 4: Manual verification**

Run: `npx tsc -p tsconfig.app.json` (expect no errors). Then in dev: `localStorage.setItem("koda_flags","mentorMode"); location.reload();`, create a circle with the box ticked, and confirm in devtools that `koda_circle_<code>` blob has `"type":"mentor"`.

- [ ] **Step 5: Commit**

```bash
git add src/hooks/useCircles.ts src/TradingCircles.tsx
git commit -m "feat(mentor): create circles as mentor cohorts (flag-gated)"
```

---

### Task 3: `trade_annotations` migration + RLS

**Files:**
- Create: `supabase/migrations/20260619_trade_annotations.sql`

**Interfaces:**
- Produces: table `public.trade_annotations`; helper `public.is_circle_owner(text)`; `circles.type` column; RLS policies.

- [ ] **Step 1: Write the migration**

```sql
-- ═══════════════════════════════════════════════════════════════════════════════
-- Kōda · trade_annotations — mentor rated notes on shared trades (Mentor Mode A)
--
-- WHAT THIS DOES (additive)
--   1. Adds circles.type text (mirrors the KV meta marker; live app reads KV).
--   2. Creates public.is_circle_owner(text) — SECURITY DEFINER, non-recursive,
--      true when auth.uid() is the OWNER of the circle (mirrors the
--      is_circle_member helper from 20260610). Owner-only on purpose (see below).
--   3. Creates public.trade_annotations, one row per (shared_trade, mentor),
--      FK to circle_shared_trades(id) ON DELETE CASCADE.
--   4. RLS: the circle owner writes; the shared trade's author OR the owner
--      reads. Mentor-type gating is enforced in the app/UI for Phase A — RLS
--      enforces the security-critical part (only the owner writes, only
--      author+owner read), not the product gate.
--
-- IDEMPOTENT — safe to re-run.
-- ═══════════════════════════════════════════════════════════════════════════════

-- 1. circles.type (additive; default null = ordinary circle).
alter table public.circles
  add column if not exists type text;

-- 2. Owner helper. SECURITY DEFINER bypasses RLS → no circle_members recursion.
--    PHASE A IS OWNER-ONLY ON PURPOSE: moderator-coaches live in the KV blob
--    koda_circle_mods_<code> (member CODES, not uids) because the mirror trigger
--    clobbers circle_members.role — see TradingCircles.tsx:744. Only role='owner'
--    is authoritative in circle_members, so RLS gates on owner. The pilot mentor
--    IS the cohort owner, so this fully covers Phase A. Moderator-coach writes
--    are deferred to the mentor API endpoint (Brick B), which can read the KV
--    mods list authoritatively via service-role.
create or replace function public.is_circle_owner(p_circle_code text)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.circle_members cm
    where cm.circle_code = p_circle_code
      and cm.user_id = auth.uid()
      and cm.role = 'owner'
  );
$$;
grant execute on function public.is_circle_owner(text) to authenticated;

-- 3. Table.
create table if not exists public.trade_annotations (
  id              uuid primary key default gen_random_uuid(),
  shared_trade_id uuid not null references public.circle_shared_trades(id) on delete cascade,
  mentor_uid      uuid not null references auth.users(id) on delete cascade,
  grade           text check (grade in ('A','B','C','D','F')),
  note            text not null check (char_length(note) between 1 and 2000),
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now(),
  unique (shared_trade_id, mentor_uid)
);

create index if not exists trade_annotations_shared_trade_idx
  on public.trade_annotations (shared_trade_id);

alter table public.trade_annotations enable row level security;

-- 4. RLS. circle_code for a shared trade is fetched via a scalar subquery.
drop policy if exists "trade_annotations_select" on public.trade_annotations;
create policy "trade_annotations_select" on public.trade_annotations
  for select to authenticated
  using (
    exists (
      select 1 from public.circle_shared_trades st
      where st.id = trade_annotations.shared_trade_id
        and (
          st.author_uid = auth.uid()
          or public.is_circle_owner(st.circle_code)
        )
    )
  );

drop policy if exists "trade_annotations_write" on public.trade_annotations;
create policy "trade_annotations_write" on public.trade_annotations
  for insert to authenticated
  with check (
    mentor_uid = auth.uid()
    and exists (
      select 1 from public.circle_shared_trades st
      where st.id = trade_annotations.shared_trade_id
        and public.is_circle_owner(st.circle_code)
    )
  );

drop policy if exists "trade_annotations_update" on public.trade_annotations;
create policy "trade_annotations_update" on public.trade_annotations
  for update to authenticated
  using (mentor_uid = auth.uid() and exists (
    select 1 from public.circle_shared_trades st
    where st.id = trade_annotations.shared_trade_id
      and public.is_circle_owner(st.circle_code)
  ))
  with check (mentor_uid = auth.uid());

notify pgrst, 'reload schema';

-- ═══════════════════════════════════════════════════════════════════════════════
-- POST-FLIGHT VERIFICATION (run AFTER applying, in SQL editor)
-- ═══════════════════════════════════════════════════════════════════════════════
-- 1. Table + policies exist:
--   select policyname from pg_policies where tablename = 'trade_annotations';
--   (expect: trade_annotations_select, _write, _update)
-- 2. Helper compiles:
--   select public.is_circle_owner('NONEXISTENT-CODE');  -- expect: false
-- 3. Negative read (user in no circles sees no annotations):
--   begin;
--   set local role authenticated;
--   set local request.jwt.claims = '{"sub":"00000000-0000-0000-0000-000000000001","role":"authenticated"}';
--   select count(*) from public.trade_annotations;  -- expect: 0
--   rollback;
--
-- ═══════════════════════════════════════════════════════════════════════════════
-- ROLLBACK
-- ═══════════════════════════════════════════════════════════════════════════════
--   drop table if exists public.trade_annotations;
--   drop function if exists public.is_circle_owner(text);
--   -- leave circles.type (dropping a populated column is the real risk)
--   notify pgrst, 'reload schema';
```

- [ ] **Step 2: Apply + verify in Supabase**

Apply via Supabase SQL editor (keys are Sensitive; `vercel env pull` returns blank — see memory). Run the POST-FLIGHT block; confirm all three checks pass.

- [ ] **Step 3: Commit**

```bash
git add supabase/migrations/20260619_trade_annotations.sql
git commit -m "feat(mentor): trade_annotations table + role-gated RLS"
```

---

### Task 4: Annotation data layer

**Files:**
- Create: `src/data/tradeAnnotations.ts`
- Test: `src/data/tradeAnnotations.test.ts`

**Interfaces:**
- Consumes: `supabase` from `src/lib/supabase`.
- Produces:
  - `interface TradeAnnotation { id: string; sharedTradeId: string; mentorUid: string; grade: AnnotationGrade | null; note: string; createdAt: string; updatedAt: string; }`
  - `type AnnotationGrade = "A" | "B" | "C" | "D" | "F"`; `ANNOTATION_GRADES: readonly AnnotationGrade[]`
  - `rowToAnnotation(row: Record<string, unknown>): TradeAnnotation`
  - `upsertAnnotation(input: { sharedTradeId: string; mentorUid: string; grade: AnnotationGrade | null; note: string }): Promise<"ok" | "error">`
  - `fetchAnnotationsForCircle(circleCode: string): Promise<Record<string, TradeAnnotation>>` keyed by `sharedTradeId`

- [ ] **Step 1: Write the failing test**

```ts
// src/data/tradeAnnotations.test.ts
import { describe, it, expect } from "vitest";
import { rowToAnnotation, ANNOTATION_GRADES } from "./tradeAnnotations";

describe("rowToAnnotation", () => {
  it("maps snake_case row to camelCase annotation", () => {
    const a = rowToAnnotation({
      id: "a1", shared_trade_id: "st1", mentor_uid: "m1",
      grade: "B", note: "Cut this earlier.",
      created_at: "2026-06-19T00:00:00Z", updated_at: "2026-06-19T00:00:00Z",
    });
    expect(a).toEqual({
      id: "a1", sharedTradeId: "st1", mentorUid: "m1",
      grade: "B", note: "Cut this earlier.",
      createdAt: "2026-06-19T00:00:00Z", updatedAt: "2026-06-19T00:00:00Z",
    });
  });
  it("coerces a missing grade to null", () => {
    const a = rowToAnnotation({ id: "a", shared_trade_id: "s", mentor_uid: "m", note: "x" });
    expect(a.grade).toBeNull();
  });
  it("exposes the A–F grade scale", () => {
    expect(ANNOTATION_GRADES).toEqual(["A", "B", "C", "D", "F"]);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/data/tradeAnnotations.test.ts --maxWorkers=1`
Expected: FAIL — cannot find module `./tradeAnnotations`.

- [ ] **Step 3: Write the data layer**

```ts
// src/data/tradeAnnotations.ts
// ─────────────────────────────────────────────────────────────────────────────
// Kōda · Mentor Mode — annotation data layer (annotations on shared trades).
// ─────────────────────────────────────────────────────────────────────────────
import { supabase } from "../lib/supabase";
import { log } from "../lib/log";

export type AnnotationGrade = "A" | "B" | "C" | "D" | "F";
export const ANNOTATION_GRADES: readonly AnnotationGrade[] = ["A", "B", "C", "D", "F"];

export interface TradeAnnotation {
  id: string;
  sharedTradeId: string;
  mentorUid: string;
  grade: AnnotationGrade | null;
  note: string;
  createdAt: string;
  updatedAt: string;
}

export function rowToAnnotation(row: Record<string, unknown>): TradeAnnotation {
  return {
    id: row.id as string,
    sharedTradeId: row.shared_trade_id as string,
    mentorUid: row.mentor_uid as string,
    grade: (row.grade as AnnotationGrade | null) ?? null,
    note: (row.note as string) ?? "",
    createdAt: row.created_at as string,
    updatedAt: row.updated_at as string,
  };
}

export async function upsertAnnotation(input: {
  sharedTradeId: string;
  mentorUid: string;
  grade: AnnotationGrade | null;
  note: string;
}): Promise<"ok" | "error"> {
  const { error } = await supabase
    .from("trade_annotations")
    .upsert(
      {
        shared_trade_id: input.sharedTradeId,
        mentor_uid: input.mentorUid,
        grade: input.grade,
        note: input.note,
        updated_at: new Date().toISOString(),
      },
      { onConflict: "shared_trade_id,mentor_uid" },
    );
  if (error) {
    log.error("tradeAnnotations.upsertAnnotation", error, { sharedTradeId: input.sharedTradeId });
    return "error";
  }
  return "ok";
}

export async function fetchAnnotationsForCircle(
  circleCode: string,
): Promise<Record<string, TradeAnnotation>> {
  // Inner-join shared trades of this circle; RLS already restricts visibility.
  const { data, error } = await supabase
    .from("trade_annotations")
    .select("*, circle_shared_trades!inner(circle_code)")
    .eq("circle_shared_trades.circle_code", circleCode);
  if (error) {
    log.error("tradeAnnotations.fetchAnnotationsForCircle", error, { circleCode });
    return {};
  }
  const out: Record<string, TradeAnnotation> = {};
  for (const row of data ?? []) {
    const a = rowToAnnotation(row as Record<string, unknown>);
    out[a.sharedTradeId] = a; // one mentor in Phase A → last write wins
  }
  return out;
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/data/tradeAnnotations.test.ts --maxWorkers=1`
Expected: PASS (3 tests).

- [ ] **Step 5: Typecheck + commit**

```bash
npx tsc -p tsconfig.app.json
git add src/data/tradeAnnotations.ts src/data/tradeAnnotations.test.ts
git commit -m "feat(mentor): trade-annotation data layer + tests"
```

---

### Task 5: "Share all my trades to this cohort"

**Files:**
- Create: `src/data/shareTally.ts` (pure — no supabase import, so it's test-safe)
- Test: `src/data/shareTally.test.ts`
- Modify: `src/data/circlesSharedTrades.ts` (add `shareAllTrades`, importing the tally)
- Modify: `src/TradingCircles.tsx` (button, flag + mentor-circle gated)

**Interfaces:**
- Consumes: existing `shareTrade(circleCode, author, trade)`.
- Produces:
  - `type ShareOutcome = "ok" | "duplicate" | "blocked" | "error"` and
    `interface ShareTally { ok; duplicate; blocked; error }` in `shareTally.ts`
  - `tallyShareResults(results: ShareOutcome[]): ShareTally` (pure)
  - `shareAllTrades(circleCode, author, trades): Promise<ShareTally>`

- [ ] **Step 1: Write the failing test (against the pure module)**

```ts
// src/data/shareTally.test.ts
import { describe, it, expect } from "vitest";
import { tallyShareResults } from "./shareTally";

describe("tallyShareResults", () => {
  it("counts each outcome", () => {
    expect(tallyShareResults(["ok", "ok", "duplicate", "blocked", "error"])).toEqual({
      ok: 2, duplicate: 1, blocked: 1, error: 1,
    });
  });
  it("is all-zero for an empty list", () => {
    expect(tallyShareResults([])).toEqual({ ok: 0, duplicate: 0, blocked: 0, error: 0 });
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/data/shareTally.test.ts --maxWorkers=1`
Expected: FAIL — cannot find module `./shareTally`.

- [ ] **Step 3: Write the pure tally module + wire `shareAllTrades`**

```ts
// src/data/shareTally.ts — pure, dependency-free (keep it that way for tests).
export type ShareOutcome = "ok" | "duplicate" | "blocked" | "error";
export interface ShareTally { ok: number; duplicate: number; blocked: number; error: number; }

export function tallyShareResults(results: ShareOutcome[]): ShareTally {
  const t: ShareTally = { ok: 0, duplicate: 0, blocked: 0, error: 0 };
  for (const r of results) t[r] += 1;
  return t;
}
```

Append to `src/data/circlesSharedTrades.ts` (import the tally at the top:
`import { tallyShareResults, type ShareOutcome, type ShareTally } from "./shareTally";`):

```ts
/** Bulk-share every trade into a cohort. Sequential to respect the per-circle
 *  tradeLogs gate inside shareTrade and avoid hammering the DB on 8GB boxes. */
export async function shareAllTrades(
  circleCode: string,
  author: Pick<Profile, "name" | "handle" | "avatar" | "code">,
  trades: Trade[],
): Promise<ShareTally> {
  const results: ShareOutcome[] = [];
  for (const trade of trades) {
    results.push(await shareTrade(circleCode, author, trade));
  }
  return tallyShareResults(results);
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/data/shareTally.test.ts --maxWorkers=1`
Expected: PASS (2 tests).

- [ ] **Step 5: Add the button (UI), gated**

In `src/TradingCircles.tsx`, within an active circle view where `isMentorCircle(activeCircle)` and `isFlagOn("mentorMode")`, add a "Share all my trades to this cohort" button (for the student/member) that calls `shareAllTrades(activeCircle.code, myMemberRecord(), myTrades)` and toasts the tally (e.g. `Shared ${t.ok}, skipped ${t.duplicate} duplicates`). If the tally is all-zero/blocked, toast that the per-circle "Trade sharing" toggle is off. Import `shareAllTrades` and `isMentorCircle`.

- [ ] **Step 6: Typecheck + commit**

```bash
npx tsc -p tsconfig.app.json
git add src/data/shareTally.ts src/data/shareTally.test.ts src/data/circlesSharedTrades.ts src/TradingCircles.tsx
git commit -m "feat(mentor): share-all-trades bulk action + tally"
```

---

### Task 6: Annotate from inside the dashboard (per-student drill-in)

Annotations live in the Mentor Mode dashboard, not the feed (decision 2026-06-19:
"mentor mode = the dashboard"). The owner clicks a student in the discipline
roster → a panel lists that student's shared trades → owner grades/notes each.
A reusable annotation editor keeps the panel and any future surface DRY.

**Files:**
- Create: `src/components/AnnotationEditor.tsx` (presentational; no data deps)
- Create: `src/mentor/StudentTradesPanel.tsx` (a roster-row drill-in)
- Modify: `src/TradingCircles.tsx` (roster rows ~line 1913 become clickable when owner+mentor+flag; render the panel; load annotations)

**Interfaces:**
- Consumes: `TradeAnnotation`, `AnnotationGrade`, `ANNOTATION_GRADES`, `upsertAnnotation`, `fetchAnnotationsForCircle` (Task 4); `fetchSharedTrades` (existing); `isMentorCircle` (Task 1); `canInstruct` (existing, `TradingCircles.tsx:750`).
- Produces:
  - `AnnotationEditor` props: `{ value: { grade: AnnotationGrade | null; note: string }; onSave: (grade, note) => void; saving?: boolean; C: ThemeTokens }`
  - `StudentTradesPanel` props: `{ circleCode: string; student: { code: string; name: string }; annotations: Record<string, TradeAnnotation>; onSaved: () => void; myUid: string; C: ThemeTokens }`

- [ ] **Step 1: Write the failing test for the editor's pure bits**

The editor is mostly presentational; unit-test the one pure helper it needs — a
grade-options builder — so the grade list stays in sync with the data layer.

```ts
// src/components/AnnotationEditor.test.ts
import { describe, it, expect } from "vitest";
import { gradeOptions } from "./AnnotationEditor";

describe("gradeOptions", () => {
  it("offers a blank 'no grade' first, then A–F", () => {
    expect(gradeOptions()).toEqual([
      { value: "", label: "No grade" },
      { value: "A", label: "A" }, { value: "B", label: "B" },
      { value: "C", label: "C" }, { value: "D", label: "D" },
      { value: "F", label: "F" },
    ]);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/components/AnnotationEditor.test.ts --maxWorkers=1`
Expected: FAIL — cannot find module `./AnnotationEditor`.

- [ ] **Step 3: Build `AnnotationEditor`**

```tsx
// src/components/AnnotationEditor.tsx
import { useState } from "react";
import { ANNOTATION_GRADES, type AnnotationGrade } from "../data/tradeAnnotations";

export function gradeOptions(): { value: string; label: string }[] {
  return [{ value: "", label: "No grade" },
    ...ANNOTATION_GRADES.map(g => ({ value: g, label: g }))];
}

interface Props {
  value: { grade: AnnotationGrade | null; note: string };
  onSave: (grade: AnnotationGrade | null, note: string) => void;
  saving?: boolean;
  C: { text2: string; muted: string; surface?: string };
}

export function AnnotationEditor({ value, onSave, saving, C }: Props) {
  const [grade, setGrade] = useState<string>(value.grade ?? "");
  const [note, setNote] = useState<string>(value.note ?? "");
  return (
    <div style={{ display: "grid", gap: 6 }}>
      <select value={grade} onChange={e => setGrade(e.target.value)}>
        {gradeOptions().map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
      </select>
      <textarea
        value={note} maxLength={2000} placeholder="Note for this trade…"
        onChange={e => setNote(e.target.value)} rows={3}
      />
      <button
        disabled={saving || note.trim().length === 0}
        onClick={() => onSave((grade || null) as AnnotationGrade | null, note.trim())}
      >
        {saving ? "Saving…" : "Save annotation"}
      </button>
    </div>
  );
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/components/AnnotationEditor.test.ts --maxWorkers=1`
Expected: PASS (1 test).

- [ ] **Step 5: Build `StudentTradesPanel`**

Create `src/mentor/StudentTradesPanel.tsx`. On mount, `fetchSharedTrades(circleCode)` and keep only rows where `authorCode === student.code`. For each, show the trade summary + the existing `annotations[sharedTradeId]` (if any) and an `AnnotationEditor` whose `onSave` calls `upsertAnnotation({ sharedTradeId, mentorUid: myUid, grade, note })`, then calls `onSaved()` (parent refetches annotations) on `"ok"`. No new data-layer code — reuse Task 4.

- [ ] **Step 6: Wire the drill-in into the dashboard**

In `src/TradingCircles.tsx`, when `canInstruct && isMentorCircle(activeCircle) && isFlagOn("mentorMode")`: (a) on entering the dashboard, `fetchAnnotationsForCircle(activeCircle.code)` into state; (b) make each roster row (~line 1913) clickable to set `selectedStudent`; (c) render `<StudentTradesPanel circleCode={activeCircle.code} student={selectedStudent} annotations={annotations} onSaved={refetchAnnotations} myUid={myUid} C={C} />` when a student is selected. Source `myUid` from the existing profile ref.

- [ ] **Step 7: Manual verification (two accounts)**

Flag on. As a student, share a trade (or use "share all" from Task 5) into a mentor circle. As the **owner**, open the Mentor Mode dashboard, click that student, grade + note a trade; confirm it saves. As the student, confirm the grade + note appear on your shared trade. As a plain member, confirm you cannot open the drill-in.

- [ ] **Step 8: Typecheck + commit**

```bash
npx tsc -p tsconfig.app.json
git add src/components/AnnotationEditor.tsx src/components/AnnotationEditor.test.ts src/mentor/StudentTradesPanel.tsx src/TradingCircles.tsx
git commit -m "feat(mentor): annotate students' trades from the dashboard"
```

---

### Task 7: Brand the coach dashboard as "Mentor Mode"

**Files:**
- Modify: `src/TradingCircles.tsx` (dashboard heading/labels ~line 743+ and ~1913 roster block)

**Interfaces:**
- Consumes: `isMentorCircle` (Task 1), `isFlagOn` (existing).

- [ ] **Step 1: Conditional labels**

Where the instructor dashboard heading renders, when `isMentorCircle(activeCircle) && isFlagOn("mentorMode")` show "Mentor Mode" / "Mentees" copy; otherwise keep the existing "Instructor"/"Coach" copy unchanged. Do not alter `canInstruct`, roster math, or CSV — branding only.

- [ ] **Step 2: Manual verification**

With the flag on, a mentor circle shows "Mentor Mode" headings; an ordinary coach circle is unchanged; with the flag off, nothing changes anywhere.

- [ ] **Step 3: Typecheck + commit**

```bash
npx tsc -p tsconfig.app.json
git add src/TradingCircles.tsx
git commit -m "feat(mentor): brand coach dashboard as Mentor Mode (flag + type gated)"
```

---

## Self-Review

**Spec coverage (Phase A section of the design spec):**
1. `mentorMode` flag + `type:"mentor"` marker → Task 1 (flag/type/helper), Task 2 (create), Task 3 (circles.type column). ✅
2. Surface coach dashboard as Mentor Mode → Task 7. ✅
3. Annotations on shared trades (migration + RLS + UI + read view) → Task 3 (DB), Task 4 (data), Task 6 (UI). ✅
4. "Share all" toggle → Task 5. ✅
5. No billing/seats/Stripe → nothing in this plan touches `api/stripe.ts` or entitlements. ✅

**Placeholder scan:** No TBD/TODO; every code step has concrete code. UI steps in the 2000-line `TradingCircles.tsx` specify component, props, gating, and the snippet to add (exact surrounding lines can't be reproduced but anchors are given). ✅

**Type consistency:** `MENTOR_CIRCLE_TYPE`/`isMentorCircle` (Task 1) reused in 2/5/6/7; `TradeAnnotation`/`AnnotationGrade`/`ANNOTATION_GRADES`/`upsertAnnotation`/`fetchAnnotationsForCircle` defined in Task 4 and consumed in Task 6; `ShareOutcome`/`ShareTally` in `shareTally.ts`, `shareAllTrades` in `circlesSharedTrades.ts` (Task 5). RLS helper `is_circle_owner` (Task 3) is the security backstop for Task 4/6 writes. ✅

## Known Phase-A limitations (documented, not bugs)

- **Owner-only annotation writes.** RLS gates writes on `circle_members.role='owner'` — the only authoritative role in that table. Moderator-coaches (KV `koda_circle_mods_<code>`) can read the dashboard and annotations but cannot *write* annotations in Phase A. Moderator writes land with the Brick B mentor API endpoint (service-role can read the KV mods list authoritatively). The pilot mentor is the cohort owner, so this fully covers Phase A.
- **Fresh-circle owner-row lag.** `circle_members` mirrors KV via a trigger that can briefly lag right after circle creation; a brand-new owner could be denied annotation writes for a few seconds. The pilot cohort is set up ahead of time, so this is not a pilot blocker.
- **Mentor-type gating is app/UI-level**, not RLS (RLS enforces owner-role + author-read only). Server-side mentor-type enforcement lands with Brick B when `circles.type` is reliably populated. Note: Phase A writes `circles.type` *nowhere* (createCircle writes only the KV blob), so that column stays inert until Brick B.
- **Trade privacy: cohort-visible (deferred decision, owner delegated 2026-06-19).** In a mentor circle, shared trades remain visible to all members (current `is_circle_member` RLS), so "share all" exposes a student's shared history to peers, not just the mentor. Mentor+author-only visibility is a fast-follow tied to Brick B's `circles.type` population. Acceptable for a peer-learning cohort; revisit if pilots object.
- `fetchAnnotationsForCircle` keeps one annotation per shared trade (single mentor assumed in Phase A).
- Pilot mentor's Pro is hand-set via the existing admin path; no seat billing.
