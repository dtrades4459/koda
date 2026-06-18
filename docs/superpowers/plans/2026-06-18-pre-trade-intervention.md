# Pre-Trade Intervention (Trading Session) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make Kōda's tilt circuit-breaker fire *before the next trade is placed* by adding an ephemeral, explicitly-armed "Trading Session" — a live W/L tally on Home that feeds the **existing** `evaluateTilt` engine and auto-opens the **existing** `InterventionSheet` the instant a tap crosses into active tilt.

**Architecture:** Reuse v1 wholesale. A pure session module (`lib/session.ts`) holds taps and adapts them into `Trade`-shaped objects for the unchanged `evaluateTilt`. A hook (`hooks/useTradingSession.ts`) owns persistence (via the `user_kv` storage shim), live tilt evaluation, inactive→active **edge** detection, and bridges to the existing `useTiltState` cooldown. A Home card (`components/SessionCard.tsx`) renders the tally + buttons and mounts the existing `InterventionSheet`, `PreSessionSheet`, and `PostSessionDebriefSheet`. No migration, no broker sync, no new endpoints.

**Tech Stack:** React 19 + TypeScript + Vite, Vitest + @testing-library/react (jsdom), Supabase `user_kv` via the `storage` shim, PostHog via `phCapture`.

## Global Constraints

- **No Supabase migration.** Session state lives in `user_kv` under a single owned row `koda_active_session` via the existing `storage` shim. (Spec §"Data model".)
- **No new server endpoints, no broker integration, no writes to `public.trades`.** (Spec §"Non-goals".)
- **`src/lib/tilt.ts` must NOT be modified.** The tally adapts to `Trade` shape so `evaluateTilt` is reused verbatim. (Spec §"Reuse the tilt engine unchanged".)
- **Reuse the existing `InterventionSheet`, `PreSessionSheet`, `PostSessionDebriefSheet`, and `useTiltState` cooldown verbatim** — props are unchanged.
- **Analytics carry a PostHog `source` property, never a schema column.** Extend `logInterventionEvent` with optional `source?: "log" | "session"` (default `"log"`), passed only to `phCapture`; the DB insert row is unchanged. (Spec §"Analytics".)
- **`choice` enum is reused as-is:** `cancelled` = chose the cooldown (stopped); `continued` = traded on.
- **Solo-first gating:** a single constant `SESSION_PILOT_UIDS: string[]`. Phase 1 = founder uid only. Phase 2 = flip to all beta. No flag *system* is built (`useFlags` does not exist in the repo). The session entry has **no `isPro` check** for the sprint.
- **A tap must never be lost:** update in-memory state first, then persist; a write failure shows a toast but keeps the tally; tilt eval runs off in-memory state.
- **Stale-day guard:** on load, a session whose `startedAt` is not today is discarded.
- TypeScript: no `: any`; any `eslint-disable` must be signed (pre-commit enforces both).
- Tests run under Vitest with `environment: "jsdom"` and `setupFiles: ["@testing-library/jest-dom/vitest", "src/test-setup.ts"]` (already configured in `vite.config.ts`).

---

## File Structure

**Create:**
- `src/lib/session.ts` — pure session logic: `addTap`, `endSession`, `isStale`, `tapsToTrades`, plus the `ActiveSession`/`SessionTap` types and the `koda_active_session` key constant. No React, no storage, no DB.
- `src/lib/session.test.ts` — unit tests for the pure module.
- `src/hooks/useTradingSession.ts` — persistence + live tilt eval + inactive→active edge detection + cooldown bridge.
- `src/hooks/useTradingSession.test.tsx` — hook tests (edge-fire-once, stay-active-no-refire, cooldown-suppresses).
- `src/components/SessionCard.tsx` — Home card: idle/armed states, tally buttons, status chip; mounts the existing sheets.
- `src/components/SessionCard.test.tsx` — component tests (tap updates tally, threshold tap opens sheet, End opens debrief).
- `src/lib/sessionPilot.ts` — the `SESSION_PILOT_UIDS` gate constant + an `isSessionPilot(uid)` helper.

**Modify:**
- `src/data/interventions.ts` — add optional `source` to `LogInterventionArgs` and thread it to `phCapture` only.
- `src/data/interventions.test.ts` — assert the `source` property reaches `phCapture` and is absent from the DB row.
- `src/Koda.tsx` — mount `<SessionCard>` at the top of the Home feed (anchor: `view === "home"` block at ~line 2101) behind the pilot gate.

---

## A note on reused interfaces (read before Task 1)

These already exist on `main` and are consumed unchanged. Exact signatures the plan relies on:

```ts
// src/lib/tilt.ts  (DO NOT MODIFY)
export function evaluateTilt(
  trades: Trade[],
  profile: Pick<Profile, "maxDailyLoss" | "maxTradesPerDay">,
  now: number,
): TiltState;                       // { active, critical, signals, evaluatedAt }
export interface TiltSignal { id: TiltSignalId; label: string; critical: boolean; }

// src/hooks/useTiltState.ts  (reused for cooldown only)
useTiltState({ trades, profile }): {
  state; lockedUntil: number | null; settings: InterventionSettings;
  startCooldown(signals: TiltSignalId[]): Promise<void>;
  clearCooldown(): Promise<void>;
}

// src/components/InterventionSheet.tsx  (reused verbatim)
interface InterventionSheetProps {
  open: boolean; signals: TiltSignal[]; C: Theme; isMobile: boolean;
  onContinue: () => void; onCancel: () => void; cooldownMin?: number;
}

// src/components/PreSessionSheet.tsx  (reused verbatim)
interface PreSessionSheetProps {
  open: boolean; C: Theme; isMobile: boolean;
  maxDailyLoss?: number | null; maxTradesPerDay?: number | null;
  onStart: () => void; onCancel: () => void;
}

// src/data/interventions.ts  (extended in Task 5)
logInterventionEvent(args: LogInterventionArgs): Promise<string | null>;

// src/lib/storage.ts  (used by the hook)
storage.get(key): Promise<{ value: string } | null>;
storage.set(key, value): Promise<boolean>;
storage.del(key): Promise<void>;

// src/lib/posthog.ts
phCapture(event: string, props?: Record<string, unknown>): void;

// Trade shape used by the adapter (src/types.ts) — fields evaluateTilt reads:
//   date: string; outcome: string ("Win"|"Loss"); pnlDollar: string;
//   entryTime?: string; exitTime?: string; emotions: string;
```

---

### Task 1: Pure session module — types, key, `addTap`, `endSession`, `isStale`

**Files:**
- Create: `src/lib/session.ts`
- Test: `src/lib/session.test.ts`

**Interfaces:**
- Consumes: nothing (pure module).
- Produces:
  ```ts
  export const ACTIVE_SESSION_KEY = "koda_active_session";
  export interface SessionTap { outcome: "Win" | "Loss"; pnlDollar: number | null; at: string; }
  export interface ActiveSession {
    startedAt: string;            // ISO
    maxDailyLoss: number | null;
    maxTradesPerDay: number | null;
    taps: SessionTap[];
  }
  export function startSession(args: { startedAt: string; maxDailyLoss: number | null; maxTradesPerDay: number | null }): ActiveSession;
  export function addTap(session: ActiveSession, tap: SessionTap): ActiveSession;   // returns NEW object, taps appended in order
  export function isStale(session: ActiveSession, now: number): boolean;            // true if startedAt is not the local day of `now`
  ```

- [ ] **Step 1: Write the failing test**

```ts
// src/lib/session.test.ts
import { describe, it, expect } from "vitest";
import { startSession, addTap, isStale, type ActiveSession } from "./session";

const baseISO = "2026-06-18T14:00:00.000Z";

describe("session core", () => {
  it("startSession captures config and an empty tally", () => {
    const s = startSession({ startedAt: baseISO, maxDailyLoss: 500, maxTradesPerDay: 5 });
    expect(s.startedAt).toBe(baseISO);
    expect(s.maxDailyLoss).toBe(500);
    expect(s.maxTradesPerDay).toBe(5);
    expect(s.taps).toEqual([]);
  });

  it("addTap appends in order and does not mutate the input", () => {
    const s0 = startSession({ startedAt: baseISO, maxDailyLoss: null, maxTradesPerDay: null });
    const s1 = addTap(s0, { outcome: "Loss", pnlDollar: -100, at: "2026-06-18T14:05:00.000Z" });
    const s2 = addTap(s1, { outcome: "Win", pnlDollar: 50, at: "2026-06-18T14:10:00.000Z" });
    expect(s0.taps).toHaveLength(0);            // original untouched
    expect(s2.taps.map(t => t.outcome)).toEqual(["Loss", "Win"]);
  });

  it("isStale is false for a session started today, true for a prior day", () => {
    const now = Date.parse("2026-06-18T20:00:00.000Z");
    const today = startSession({ startedAt: "2026-06-18T09:00:00.000Z", maxDailyLoss: null, maxTradesPerDay: null });
    const yesterday = startSession({ startedAt: "2026-06-17T09:00:00.000Z", maxDailyLoss: null, maxTradesPerDay: null });
    expect(isStale(today, now)).toBe(false);
    expect(isStale(yesterday, now)).toBe(true);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/lib/session.test.ts`
Expected: FAIL — cannot find module `./session` / exports not defined.

- [ ] **Step 3: Write minimal implementation**

```ts
// src/lib/session.ts
// ═══════════════════════════════════════════════════════════════════════════════
// Kōda · trading session core
//
// Pure (no React, no storage, no DB). An ephemeral, explicitly-armed container
// for "I'm trading right now": holds a live W/L tally and adapts it into
// Trade-shaped objects so the existing evaluateTilt engine can run unchanged.
//
// Spec: docs/superpowers/specs/2026-06-16-pre-trade-intervention-design.md
// ═══════════════════════════════════════════════════════════════════════════════

import type { Trade } from "../types";

export const ACTIVE_SESSION_KEY = "koda_active_session";

export interface SessionTap {
  outcome: "Win" | "Loss";
  pnlDollar: number | null;   // optional; unlocks daily-loss signals when present
  at: string;                 // ISO timestamp — drives ordering + revenge_window
}

export interface ActiveSession {
  startedAt: string;               // ISO
  maxDailyLoss: number | null;     // captured from PreSessionSheet at arm
  maxTradesPerDay: number | null;
  taps: SessionTap[];
}

function localDay(ms: number): string {
  const d = new Date(ms);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

export function startSession(args: {
  startedAt: string;
  maxDailyLoss: number | null;
  maxTradesPerDay: number | null;
}): ActiveSession {
  return {
    startedAt: args.startedAt,
    maxDailyLoss: args.maxDailyLoss,
    maxTradesPerDay: args.maxTradesPerDay,
    taps: [],
  };
}

export function addTap(session: ActiveSession, tap: SessionTap): ActiveSession {
  return { ...session, taps: [...session.taps, tap] };
}

export function isStale(session: ActiveSession, now: number): boolean {
  return localDay(Date.parse(session.startedAt)) !== localDay(now);
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/lib/session.test.ts`
Expected: PASS (3 tests).

- [ ] **Step 5: Commit**

```bash
git add src/lib/session.ts src/lib/session.test.ts
git commit -m "feat(session): pure session core — startSession, addTap, isStale"
```

---

### Task 2: `tapsToTrades` adapter + derived tally stats

**Files:**
- Modify: `src/lib/session.ts`
- Test: `src/lib/session.test.ts`

**Interfaces:**
- Consumes: `ActiveSession`, `SessionTap` from Task 1.
- Produces:
  ```ts
  export function tapsToTrades(taps: SessionTap[], todayLocal: string): Trade[];
  export interface SessionTally { wins: number; losses: number; netDollar: number; hasDollar: boolean; streak: number; streakKind: "Win" | "Loss" | null; }
  export function tally(session: ActiveSession): SessionTally;
  ```
  `tapsToTrades` maps each tap to a minimal `Trade` with `date=todayLocal`, `outcome`, `pnlDollar=String(pnlDollar ?? 0)`, `entryTime=exitTime=at`, `emotions=""`, and harmless empty strings/zero for the unused required `Trade` fields. `streak` is the length of the trailing run of identical outcomes; `streakKind` is that outcome (or `null` when no taps).

- [ ] **Step 1: Write the failing test**

```ts
// append to src/lib/session.test.ts
import { tapsToTrades, tally } from "./session";
import { evaluateTilt } from "./tilt";
import type { Profile } from "../types";

const PROFILE: Pick<Profile, "maxDailyLoss" | "maxTradesPerDay"> = { maxDailyLoss: "500", maxTradesPerDay: "5" };

describe("tapsToTrades adapter", () => {
  it("produces time-ordered Trade-shaped objects evaluateTilt can read", () => {
    const day = "2026-06-18";
    const taps = [
      { outcome: "Loss" as const, pnlDollar: -200, at: "2026-06-18T14:00:00.000Z" },
      { outcome: "Loss" as const, pnlDollar: -200, at: "2026-06-18T14:05:00.000Z" },
    ];
    const trades = tapsToTrades(taps, day);
    expect(trades).toHaveLength(2);
    expect(trades[0].date).toBe(day);
    expect(trades[0].outcome).toBe("Loss");
    expect(trades[0].pnlDollar).toBe("-200");
    // two consecutive losses → consec_losses active
    const state = evaluateTilt(trades, PROFILE, Date.parse("2026-06-18T14:06:00.000Z"));
    expect(state.signals.some(s => s.id === "consec_losses")).toBe(true);
  });

  it("maps a null pnl tap to '0'", () => {
    const trades = tapsToTrades([{ outcome: "Win", pnlDollar: null, at: "2026-06-18T14:00:00.000Z" }], "2026-06-18");
    expect(trades[0].pnlDollar).toBe("0");
  });
});

describe("tally", () => {
  it("counts wins/losses, nets $, and reports the trailing streak", () => {
    const s = { startedAt: "2026-06-18T09:00:00.000Z", maxDailyLoss: 500, maxTradesPerDay: 5, taps: [
      { outcome: "Win" as const, pnlDollar: 100, at: "a" },
      { outcome: "Loss" as const, pnlDollar: -50, at: "b" },
      { outcome: "Loss" as const, pnlDollar: -50, at: "c" },
    ]};
    const t = tally(s);
    expect(t.wins).toBe(1);
    expect(t.losses).toBe(2);
    expect(t.netDollar).toBe(0);
    expect(t.hasDollar).toBe(true);
    expect(t.streak).toBe(2);
    expect(t.streakKind).toBe("Loss");
  });

  it("hasDollar is false when no tap carries a dollar value", () => {
    const s = { startedAt: "2026-06-18T09:00:00.000Z", maxDailyLoss: null, maxTradesPerDay: null, taps: [
      { outcome: "Win" as const, pnlDollar: null, at: "a" },
    ]};
    expect(tally(s).hasDollar).toBe(false);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/lib/session.test.ts`
Expected: FAIL — `tapsToTrades` / `tally` not exported.

- [ ] **Step 3: Write minimal implementation**

```ts
// append to src/lib/session.ts

export function tapsToTrades(taps: SessionTap[], todayLocal: string): Trade[] {
  return [...taps]
    .sort((a, b) => a.at.localeCompare(b.at))
    .map((tap, i) => ({
      id: i + 1,
      date: todayLocal,
      pair: "", session: "", bias: "", strategy: "", setup: "",
      entryPrice: "", slPrice: "", tpPrice: "", rr: "",
      outcome: tap.outcome,
      pnl: "",
      notes: "",
      emotions: "",
      screenshot: "",
      pnlDollar: String(tap.pnlDollar ?? 0),
      entryTime: tap.at,
      exitTime: tap.at,
      comments: [],
      reactions: {},
    }));
}

export interface SessionTally {
  wins: number;
  losses: number;
  netDollar: number;
  hasDollar: boolean;
  streak: number;
  streakKind: "Win" | "Loss" | null;
}

export function tally(session: ActiveSession): SessionTally {
  const taps = session.taps;
  const wins = taps.filter(t => t.outcome === "Win").length;
  const losses = taps.filter(t => t.outcome === "Loss").length;
  const hasDollar = taps.some(t => t.pnlDollar !== null);
  const netDollar = taps.reduce((sum, t) => sum + (t.pnlDollar ?? 0), 0);

  let streak = 0;
  let streakKind: "Win" | "Loss" | null = null;
  for (let i = taps.length - 1; i >= 0; i--) {
    if (streakKind === null) { streakKind = taps[i].outcome; streak = 1; }
    else if (taps[i].outcome === streakKind) { streak++; }
    else break;
  }

  return { wins, losses, netDollar, hasDollar, streak, streakKind };
}
```

Note: `reactions: {}` matches the `ReactionMap` type (a record). If `tsc` complains about its shape, use `reactions: {} as Trade["reactions"]` with a signed disable is **not** needed — an empty object satisfies a record type.

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/lib/session.test.ts`
Expected: PASS (all tests in file).

- [ ] **Step 5: Typecheck the new module**

Run: `npx tsc -p tsconfig.app.json --noEmit`
Expected: no errors referencing `src/lib/session.ts`. (Per repo memory, `npm run typecheck` can silently pass — use the app project directly.)

- [ ] **Step 6: Commit**

```bash
git add src/lib/session.ts src/lib/session.test.ts
git commit -m "feat(session): tapsToTrades adapter + derived tally"
```

---

### Task 3: `source` property on `logInterventionEvent`

**Files:**
- Modify: `src/data/interventions.ts`
- Test: `src/data/interventions.test.ts`

**Interfaces:**
- Consumes: existing `LogInterventionArgs`.
- Produces: `LogInterventionArgs` gains `source?: "log" | "session"`. The PostHog `intervention_fired` capture gains a `source` property (default `"log"`). The DB insert row is unchanged.

- [ ] **Step 1: Write the failing test**

```ts
// append to src/data/interventions.test.ts (mirror its existing supabase + posthog mocks)
import { describe, it, expect, vi, beforeEach } from "vitest";

const insertSingle = vi.fn();
vi.mock("../lib/supabase", () => ({
  supabase: {
    from: () => ({
      insert: () => ({ select: () => ({ single: (...a: unknown[]) => insertSingle(...a) }) }),
    }),
  },
}));
const phCaptureMock = vi.fn();
vi.mock("../lib/posthog", () => ({ phCapture: (...a: unknown[]) => phCaptureMock(...a) }));
vi.mock("../lib/log", () => ({ log: { error: vi.fn() } }));

import { logInterventionEvent } from "./interventions";

beforeEach(() => {
  insertSingle.mockReset();
  phCaptureMock.mockReset();
  insertSingle.mockResolvedValue({ data: { id: "evt_1" }, error: null });
});

describe("logInterventionEvent source property", () => {
  it("passes source to phCapture when provided", async () => {
    await logInterventionEvent({
      userUid: "u1", signals: ["consec_losses"], critical: false,
      choice: "cancelled", sessionDate: "2026-06-18", source: "session",
    });
    expect(phCaptureMock).toHaveBeenCalledWith("intervention_fired", expect.objectContaining({ source: "session" }));
  });

  it("defaults source to 'log' when omitted", async () => {
    await logInterventionEvent({
      userUid: "u1", signals: ["consec_losses"], critical: false,
      choice: "continued", sessionDate: "2026-06-18",
    });
    expect(phCaptureMock).toHaveBeenCalledWith("intervention_fired", expect.objectContaining({ source: "log" }));
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/data/interventions.test.ts -t "source property"`
Expected: FAIL — `source` is not a valid `LogInterventionArgs` field (type error) and/or `phCapture` payload lacks `source`.

- [ ] **Step 3: Write minimal implementation**

In `src/data/interventions.ts`, extend the args interface:

```ts
export interface LogInterventionArgs {
  userUid: string;
  signals: TiltSignalId[];
  critical: boolean;
  choice: InterventionChoice;
  sessionDate: string;
  source?: "log" | "session";   // PostHog-only; NOT persisted
}
```

And in the body, change the `phCapture` call (the DB `row` is unchanged):

```ts
  try {
    phCapture("intervention_fired", {
      signals: args.signals,
      critical: args.critical,
      choice: args.choice,
      session_date: args.sessionDate,
      source: args.source ?? "log",
    });
  } catch { /* posthog optional / not configured */ }
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/data/interventions.test.ts`
Expected: PASS (new tests + any pre-existing tests in the file).

- [ ] **Step 5: Commit**

```bash
git add src/data/interventions.ts src/data/interventions.test.ts
git commit -m "feat(interventions): optional source prop on logInterventionEvent (posthog-only)"
```

---

### Task 4: Pilot gate constant

**Files:**
- Create: `src/lib/sessionPilot.ts`
- Test: covered inline in Task 6's component gate; no standalone test file (trivial constant + predicate). A one-liner unit test is included here to lock the predicate.
- Test: `src/lib/sessionPilot.test.ts`

**Interfaces:**
- Produces:
  ```ts
  export const SESSION_PILOT_UIDS: string[];
  export const SESSION_PILOT_ALL = false;     // Phase 2 switch — flip to true for all beta
  export function isSessionPilot(uid: string | undefined): boolean;
  ```

- [ ] **Step 1: Write the failing test**

```ts
// src/lib/sessionPilot.test.ts
import { describe, it, expect } from "vitest";
import { isSessionPilot } from "./sessionPilot";

describe("isSessionPilot", () => {
  it("is false for an undefined uid", () => {
    expect(isSessionPilot(undefined)).toBe(false);
  });
  it("is false for a uid not in the pilot list (Phase 1)", () => {
    expect(isSessionPilot("not-a-pilot-uid")).toBe(false);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/lib/sessionPilot.test.ts`
Expected: FAIL — module not found.

- [ ] **Step 3: Write minimal implementation**

```ts
// src/lib/sessionPilot.ts
// ═══════════════════════════════════════════════════════════════════════════════
// Kōda · Trading Session pilot gate
//
// Solo-first rollout for the pre-trade intervention sprint. Phase 1: founder uid
// only (dogfood). Phase 2: flip SESSION_PILOT_ALL to true to open to all beta.
// No flag *system* — there is no useFlags in the repo.
// Spec: docs/superpowers/specs/2026-06-16-pre-trade-intervention-design.md
// ═══════════════════════════════════════════════════════════════════════════════

// TODO(dylon): paste the founder Supabase auth uid here before dogfooding.
export const SESSION_PILOT_UIDS: string[] = [];

// Phase 2 switch: flip to true to enable the session for every beta user.
export const SESSION_PILOT_ALL = false;

export function isSessionPilot(uid: string | undefined): boolean {
  if (SESSION_PILOT_ALL) return true;
  if (!uid) return false;
  return SESSION_PILOT_UIDS.includes(uid);
}
```

> **Pre-flight (Dylon):** before dogfooding, paste the founder auth uid into `SESSION_PILOT_UIDS`. This is the only manual step; the empty list keeps the card hidden for everyone until then.

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/lib/sessionPilot.test.ts`
Expected: PASS (2 tests).

- [ ] **Step 5: Commit**

```bash
git add src/lib/sessionPilot.ts src/lib/sessionPilot.test.ts
git commit -m "feat(session): solo-first pilot gate constant"
```

---

### Task 5: `useTradingSession` hook — persistence, live eval, edge-fire, cooldown bridge

**Files:**
- Create: `src/hooks/useTradingSession.ts`
- Test: `src/hooks/useTradingSession.test.tsx`

**Interfaces:**
- Consumes: `ActiveSession`, `SessionTap`, `startSession`, `addTap`, `isStale`, `tapsToTrades`, `tally`, `ACTIVE_SESSION_KEY` (Tasks 1–2); `evaluateTilt`, `TiltSignal` (`lib/tilt`); `useTiltState` (`hooks/useTiltState`); `logInterventionEvent` (Task 3); `storage` (`lib/storage`); `phCapture` (`lib/posthog`).
- Produces:
  ```ts
  export interface UseTradingSession {
    session: ActiveSession | null;            // null = idle
    tally: SessionTally | null;
    interventionOpen: boolean;
    interventionSignals: TiltSignal[];
    lockedUntil: number | null;
    cooldownMin: number;
    start(cfg: { maxDailyLoss: number | null; maxTradesPerDay: number | null }): Promise<void>;
    tap(outcome: "Win" | "Loss", pnlDollar: number | null): Promise<void>;
    checkMe(): void;                          // manual eval — opens sheet if active
    continueTrading(): Promise<void>;         // sheet "Continue"
    coolOff(): Promise<void>;                 // sheet "Cancel · break"
    end(): Promise<void>;                     // clears session (caller opens debrief)
  }
  export function useTradingSession(args: { profile: Profile }): UseTradingSession;
  ```

**Behaviour the tests pin down:**
1. On `tap`, in-memory state updates first, then persists to `user_kv` (`storage.set(ACTIVE_SESSION_KEY, ...)`).
2. After each tap, `evaluateTilt(tapsToTrades(taps, today), profile, now)` runs. The sheet auto-opens **only on the inactive→active rising edge** (compare to the previous eval's `active`), and **not** if a cooldown is currently locked.
3. Staying active across taps does not re-open the sheet.
4. `coolOff` logs `{ choice: "cancelled", source: "session" }` and calls the existing `startCooldown`. `continueTrading` logs `{ choice: "continued", source: "session" }`.

- [ ] **Step 1: Write the failing test**

```tsx
// src/hooks/useTradingSession.test.tsx
import { describe, it, expect, vi, beforeEach } from "vitest";
import { renderHook, act, waitFor } from "@testing-library/react";
import type { Profile } from "../types";

const storageGet = vi.fn();
const storageSet = vi.fn();
vi.mock("../lib/storage", () => ({
  storage: {
    get: (...a: unknown[]) => storageGet(...a),
    set: (...a: unknown[]) => storageSet(...a),
    del: vi.fn(),
  },
}));
const logEvent = vi.fn();
vi.mock("../data/interventions", () => ({ logInterventionEvent: (...a: unknown[]) => logEvent(...a) }));
vi.mock("../lib/posthog", () => ({ phCapture: vi.fn() }));
vi.mock("../lib/log", () => ({ log: { error: vi.fn() } }));

import { useTradingSession } from "./useTradingSession";

const PROFILE: Profile = {
  name: "", handle: "", bio: "", avatar: "", broker: "",
  timezone: "UTC", startDate: "", targetRR: "", maxTradesPerDay: "5",
  uid: "u1", maxDailyLoss: "500",
};

beforeEach(() => {
  storageGet.mockReset().mockResolvedValue(null);  // start idle
  storageSet.mockReset().mockResolvedValue(true);
  logEvent.mockReset().mockResolvedValue("evt_1");
});

describe("useTradingSession", () => {
  it("starts idle and arms a session on start()", async () => {
    const { result } = renderHook(() => useTradingSession({ profile: PROFILE }));
    await waitFor(() => expect(result.current.session).toBeNull());
    await act(async () => { await result.current.start({ maxDailyLoss: 500, maxTradesPerDay: 5 }); });
    expect(result.current.session).not.toBeNull();
    expect(storageSet).toHaveBeenCalled();
  });

  it("auto-opens the sheet once on the inactive→active edge, not again while active", async () => {
    const { result } = renderHook(() => useTradingSession({ profile: PROFILE }));
    await act(async () => { await result.current.start({ maxDailyLoss: 500, maxTradesPerDay: 5 }); });
    await act(async () => { await result.current.tap("Loss", -100); });
    expect(result.current.interventionOpen).toBe(false);          // 1 loss — inactive
    await act(async () => { await result.current.tap("Loss", -100); });
    expect(result.current.interventionOpen).toBe(true);           // 2nd loss — rising edge fires
    await act(async () => { await result.current.continueTrading(); });
    expect(result.current.interventionOpen).toBe(false);
    await act(async () => { await result.current.tap("Loss", -100); });
    expect(result.current.interventionOpen).toBe(false);          // still active — does NOT re-fire
  });

  it("coolOff logs a cancelled session event", async () => {
    const { result } = renderHook(() => useTradingSession({ profile: PROFILE }));
    await act(async () => { await result.current.start({ maxDailyLoss: 500, maxTradesPerDay: 5 }); });
    await act(async () => { await result.current.tap("Loss", -100); });
    await act(async () => { await result.current.tap("Loss", -100); });
    await act(async () => { await result.current.coolOff(); });
    expect(logEvent).toHaveBeenCalledWith(expect.objectContaining({ choice: "cancelled", source: "session" }));
  });

  it("discards a stale (prior-day) session on load", async () => {
    storageGet.mockResolvedValue({ value: JSON.stringify({
      startedAt: "2000-01-01T09:00:00.000Z", maxDailyLoss: null, maxTradesPerDay: null, taps: [],
    }) });
    const { result } = renderHook(() => useTradingSession({ profile: PROFILE }));
    await waitFor(() => expect(result.current.session).toBeNull());
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/hooks/useTradingSession.test.tsx`
Expected: FAIL — module not found.

- [ ] **Step 3: Write minimal implementation**

```tsx
// src/hooks/useTradingSession.ts
// ═══════════════════════════════════════════════════════════════════════════════
// Kōda · useTradingSession
//
// Owns the live Trading Session: persistence (user_kv via the storage shim),
// live tilt evaluation off the tally, inactive→active edge detection that
// auto-opens the existing InterventionSheet, and a bridge to the existing
// useTiltState cooldown. The tilt engine and sheet are reused unchanged.
//
// Spec: docs/superpowers/specs/2026-06-16-pre-trade-intervention-design.md
// ═══════════════════════════════════════════════════════════════════════════════

import { useCallback, useEffect, useRef, useState } from "react";
import { storage } from "../lib/storage";
import { log } from "../lib/log";
import { evaluateTilt, type TiltSignal } from "../lib/tilt";
import { useTiltState } from "./useTiltState";
import { logInterventionEvent } from "../data/interventions";
import type { Profile } from "../types";
import {
  ACTIVE_SESSION_KEY, startSession, addTap, isStale, tapsToTrades, tally as computeTally,
  type ActiveSession, type SessionTally,
} from "../lib/session";

function todayLocal(now: number): string {
  const d = new Date(now);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

export interface UseTradingSession {
  session: ActiveSession | null;
  tally: SessionTally | null;
  interventionOpen: boolean;
  interventionSignals: TiltSignal[];
  lockedUntil: number | null;
  cooldownMin: number;
  start(cfg: { maxDailyLoss: number | null; maxTradesPerDay: number | null }): Promise<void>;
  tap(outcome: "Win" | "Loss", pnlDollar: number | null): Promise<void>;
  checkMe(): void;
  continueTrading(): Promise<void>;
  coolOff(): Promise<void>;
  end(): Promise<void>;
}

export function useTradingSession({ profile }: { profile: Profile }): UseTradingSession {
  const [session, setSession] = useState<ActiveSession | null>(null);
  const [interventionOpen, setInterventionOpen] = useState(false);
  const [interventionSignals, setInterventionSignals] = useState<TiltSignal[]>([]);
  const prevActive = useRef(false);

  // Cooldown is owned by the existing useTiltState. We feed it the session's
  // adapted trades so its lockout read/write stays a single source of truth.
  const sessionTrades = session ? tapsToTrades(session.taps, todayLocal(Date.now())) : [];
  const tilt = useTiltState({ trades: sessionTrades, profile });

  // ── Load (with stale-day guard) ─────────────────────────────────────────
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const row = await storage.get(ACTIVE_SESSION_KEY);
        if (cancelled) return;
        if (!row) { setSession(null); return; }
        const parsed = JSON.parse(row.value) as ActiveSession;
        if (isStale(parsed, Date.now())) {
          setSession(null);
          await storage.del(ACTIVE_SESSION_KEY);
          return;
        }
        setSession(parsed);
      } catch (e) {
        log.error("useTradingSession.load", e);
        setSession(null);
      }
    })();
    return () => { cancelled = true; };
  }, [profile.uid]);

  const persist = useCallback(async (next: ActiveSession | null) => {
    try {
      if (next) await storage.set(ACTIVE_SESSION_KEY, JSON.stringify(next));
      else await storage.del(ACTIVE_SESSION_KEY);
    } catch (e) {
      log.error("useTradingSession.persist", e);  // keep in-memory tally regardless
    }
  }, []);

  const start = useCallback(async (cfg: { maxDailyLoss: number | null; maxTradesPerDay: number | null }) => {
    const next = startSession({ startedAt: new Date().toISOString(), ...cfg });
    prevActive.current = false;
    setSession(next);
    await persist(next);
  }, [persist]);

  const tap = useCallback(async (outcome: "Win" | "Loss", pnlDollar: number | null) => {
    setSession(prev => {
      if (!prev) return prev;
      const next = addTap(prev, { outcome, pnlDollar, at: new Date().toISOString() });
      // Evaluate off the NEW in-memory state (taps are never lost on write failure).
      const now = Date.now();
      const state = evaluateTilt(tapsToTrades(next.taps, todayLocal(now)), profile, now);
      const locked = tilt.lockedUntil !== null && tilt.lockedUntil > now;
      if (state.active && !prevActive.current && !locked) {
        setInterventionSignals(state.signals);
        setInterventionOpen(true);
      }
      prevActive.current = state.active;
      void persist(next);
      return next;
    });
  }, [profile, tilt.lockedUntil, persist]);

  const checkMe = useCallback(() => {
    if (!session) return;
    const now = Date.now();
    const state = evaluateTilt(tapsToTrades(session.taps, todayLocal(now)), profile, now);
    setInterventionSignals(state.signals);
    setInterventionOpen(state.active);   // when inactive the card shows an "in control" confirm
  }, [session, profile]);

  const continueTrading = useCallback(async () => {
    setInterventionOpen(false);
    if (profile.uid) {
      await logInterventionEvent({
        userUid: profile.uid,
        signals: interventionSignals.map(s => s.id),
        critical: interventionSignals.some(s => s.critical),
        choice: "continued",
        sessionDate: todayLocal(Date.now()),
        source: "session",
      });
    }
  }, [profile.uid, interventionSignals]);

  const coolOff = useCallback(async () => {
    setInterventionOpen(false);
    if (profile.uid) {
      await logInterventionEvent({
        userUid: profile.uid,
        signals: interventionSignals.map(s => s.id),
        critical: interventionSignals.some(s => s.critical),
        choice: "cancelled",
        sessionDate: todayLocal(Date.now()),
        source: "session",
      });
    }
    await tilt.startCooldown(interventionSignals.map(s => s.id));
  }, [profile.uid, interventionSignals, tilt]);

  const end = useCallback(async () => {
    prevActive.current = false;
    setSession(null);
    setInterventionOpen(false);
    await persist(null);
  }, [persist]);

  return {
    session,
    tally: session ? computeTally(session) : null,
    interventionOpen,
    interventionSignals,
    lockedUntil: tilt.lockedUntil,
    cooldownMin: tilt.settings.cooldownMin,
    start, tap, checkMe, continueTrading, coolOff, end,
  };
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/hooks/useTradingSession.test.tsx`
Expected: PASS (4 tests). If the "edge fires once" test flakes, confirm `prevActive` is a ref (not state) so it updates synchronously within the same `tap`.

- [ ] **Step 5: Typecheck**

Run: `npx tsc -p tsconfig.app.json --noEmit`
Expected: no errors in the new hook.

- [ ] **Step 6: Commit**

```bash
git add src/hooks/useTradingSession.ts src/hooks/useTradingSession.test.tsx
git commit -m "feat(session): useTradingSession — persistence, edge-fire, cooldown bridge"
```

---

### Task 6: `SessionCard` component — idle/armed UI + mounted sheets

**Files:**
- Create: `src/components/SessionCard.tsx`
- Test: `src/components/SessionCard.test.tsx`

**Interfaces:**
- Consumes: `useTradingSession` (Task 5); `InterventionSheet`, `PreSessionSheet`, `PostSessionDebriefSheet` (existing); `Theme` (`../theme`); `Profile` (`../types`); `isSessionPilot` is applied by the **caller** (Koda.tsx, Task 7), not inside the card.
- Produces:
  ```ts
  export interface SessionCardProps {
    profile: Profile;
    C: Theme;
    isMobile: boolean;
    onToast?: (msg: string) => void;
  }
  export function SessionCard(props: SessionCardProps): JSX.Element;
  ```

**UI states (spec §UI):**
- **Idle:** a single **Start session** button. Tapping it opens `PreSessionSheet`; its `onStart` calls `start(...)`.
- **Armed (hero card):** live tally `W / L`, net `$` (only when `tally.hasDollar`), current streak; big **+ Win** / **+ Loss** buttons (**+ Loss** reveals an optional `$` field); a status chip (`In control ✓` / `Warning — N losses` / `Cooling off · MM:SS`); a **Check me** button; an **End session** button. **End** opens `PostSessionDebriefSheet`.
- **Auto-fire:** `InterventionSheet` is mounted with `open={interventionOpen}`, wired to `continueTrading` / `coolOff`.

- [ ] **Step 1: Write the failing test**

```tsx
// src/components/SessionCard.test.tsx
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { DARK } from "../theme";
import type { Profile } from "../types";

// Drive the card through a controllable fake hook.
const hookState: any = {};
vi.mock("../hooks/useTradingSession", () => ({
  useTradingSession: () => hookState,
}));

import { SessionCard } from "./SessionCard";

const PROFILE: Profile = {
  name: "", handle: "", bio: "", avatar: "", broker: "",
  timezone: "UTC", startDate: "", targetRR: "", maxTradesPerDay: "5",
  uid: "u1", maxDailyLoss: "500",
};

function baseHook() {
  return {
    session: null, tally: null, interventionOpen: false, interventionSignals: [],
    lockedUntil: null, cooldownMin: 15,
    start: vi.fn().mockResolvedValue(undefined),
    tap: vi.fn().mockResolvedValue(undefined),
    checkMe: vi.fn(),
    continueTrading: vi.fn().mockResolvedValue(undefined),
    coolOff: vi.fn().mockResolvedValue(undefined),
    end: vi.fn().mockResolvedValue(undefined),
  };
}

beforeEach(() => { Object.assign(hookState, baseHook()); });

describe("SessionCard", () => {
  it("idle: shows Start session and opens the pre-session sheet", () => {
    render(<SessionCard profile={PROFILE} C={DARK} isMobile />);
    const start = screen.getByRole("button", { name: /start session/i });
    fireEvent.click(start);
    expect(screen.getByText(/loss limit|max trades|start/i)).toBeInTheDocument();
  });

  it("armed: a + Loss tap calls the hook's tap()", () => {
    Object.assign(hookState, {
      session: { startedAt: new Date().toISOString(), maxDailyLoss: 500, maxTradesPerDay: 5, taps: [] },
      tally: { wins: 0, losses: 0, netDollar: 0, hasDollar: false, streak: 0, streakKind: null },
    });
    render(<SessionCard profile={PROFILE} C={DARK} isMobile />);
    fireEvent.click(screen.getByRole("button", { name: /\+ loss/i }));
    expect(hookState.tap).toHaveBeenCalledWith("Loss", null);
  });

  it("armed: End session opens the debrief sheet", async () => {
    Object.assign(hookState, {
      session: { startedAt: new Date().toISOString(), maxDailyLoss: 500, maxTradesPerDay: 5, taps: [] },
      tally: { wins: 1, losses: 2, netDollar: -50, hasDollar: true, streak: 2, streakKind: "Loss" },
    });
    render(<SessionCard profile={PROFILE} C={DARK} isMobile />);
    fireEvent.click(screen.getByRole("button", { name: /end session/i }));
    await waitFor(() => expect(screen.getByText(/debrief|how did|save/i)).toBeInTheDocument());
  });

  it("renders the intervention sheet when interventionOpen is true", () => {
    Object.assign(hookState, {
      session: { startedAt: new Date().toISOString(), maxDailyLoss: 500, maxTradesPerDay: 5, taps: [] },
      tally: { wins: 0, losses: 2, netDollar: -200, hasDollar: true, streak: 2, streakKind: "Loss" },
      interventionOpen: true,
      interventionSignals: [{ id: "consec_losses", label: "2 consecutive losses", critical: false }],
    });
    render(<SessionCard profile={PROFILE} C={DARK} isMobile />);
    expect(screen.getByText(/sure\?|pause|breath/i)).toBeInTheDocument();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/components/SessionCard.test.tsx`
Expected: FAIL — module not found.

- [ ] **Step 3: Write minimal implementation**

```tsx
// src/components/SessionCard.tsx
// ═══════════════════════════════════════════════════════════════════════════════
// Kōda · SessionCard — Home entry point for the live Trading Session
//
// Idle: a single Start button. Armed: a live W/L tally + tap buttons + status
// chip. Auto-opens the existing InterventionSheet on the tilt rising edge; Start
// uses PreSessionSheet, End uses PostSessionDebriefSheet. All state lives in
// useTradingSession; this file is presentation + local input state only.
//
// Spec: docs/superpowers/specs/2026-06-16-pre-trade-intervention-design.md
// ═══════════════════════════════════════════════════════════════════════════════

import { useState } from "react";
import { MONO, BODY } from "../shared";
import type { Theme } from "../theme";
import type { Profile } from "../types";
import { useTradingSession } from "../hooks/useTradingSession";
import { InterventionSheet } from "./InterventionSheet";
import { PreSessionSheet } from "./PreSessionSheet";
import { PostSessionDebriefSheet } from "./PostSessionDebriefSheet";

export interface SessionCardProps {
  profile: Profile;
  C: Theme;
  isMobile: boolean;
  onToast?: (msg: string) => void;
}

function formatCountdown(msRemaining: number): string {
  const total = Math.max(0, Math.ceil(msRemaining / 1000));
  const m = Math.floor(total / 60);
  const s = total % 60;
  return `${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
}

export function SessionCard({ profile, C, isMobile, onToast }: SessionCardProps) {
  const s = useTradingSession({ profile });
  const [preOpen, setPreOpen] = useState(false);
  const [debriefOpen, setDebriefOpen] = useState(false);
  const [lossDollarOpen, setLossDollarOpen] = useState(false);
  const [lossDollar, setLossDollar] = useState("");
  const [now, setNow] = useState(Date.now());

  const locked = s.lockedUntil !== null && s.lockedUntil > now;

  // tick the cooldown countdown
  if (locked) {
    // lightweight: schedule a re-render every second while locked
    setTimeout(() => setNow(Date.now()), 1000);
  }

  const maxDailyLoss = profile.maxDailyLoss ? parseFloat(profile.maxDailyLoss) : null;
  const maxTradesPerDay = profile.maxTradesPerDay ? parseFloat(profile.maxTradesPerDay) : null;

  // ── Idle ────────────────────────────────────────────────────────────────
  if (!s.session) {
    return (
      <>
        <div style={{ padding: "14px 0" }}>
          <button
            onClick={() => setPreOpen(true)}
            style={{
              width: "100%", padding: "12px 16px", borderRadius: 12,
              border: `1px solid ${C.border}`, background: C.card, color: C.text,
              fontFamily: MONO, fontSize: "0.8125rem", letterSpacing: "0.04em", cursor: "pointer",
            }}
          >
            Start session
          </button>
        </div>
        <PreSessionSheet
          open={preOpen}
          C={C}
          isMobile={isMobile}
          maxDailyLoss={maxDailyLoss}
          maxTradesPerDay={maxTradesPerDay}
          onStart={() => { setPreOpen(false); void s.start({ maxDailyLoss, maxTradesPerDay }); }}
          onCancel={() => setPreOpen(false)}
        />
      </>
    );
  }

  // ── Armed ─────────────────────────────────────────────────────────────────
  const t = s.tally!;
  const chip = locked
    ? `Cooling off · ${formatCountdown((s.lockedUntil ?? 0) - now)}`
    : t.streakKind === "Loss" && t.streak >= 2
      ? `Warning — ${t.streak} losses`
      : "In control ✓";

  function commitLoss() {
    const val = lossDollar.trim() === "" ? null : parseFloat(lossDollar);
    void s.tap("Loss", Number.isFinite(val as number) ? (val as number) : null);
    setLossDollar("");
    setLossDollarOpen(false);
  }

  return (
    <>
      <div style={{
        padding: 16, borderRadius: 14, border: `1px solid ${C.border}`,
        background: C.card, display: "flex", flexDirection: "column", gap: 12, margin: "14px 0",
      }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <span style={{ fontFamily: MONO, fontSize: "0.6875rem", letterSpacing: "0.08em", textTransform: "uppercase", color: C.dim }}>
            Trading session
          </span>
          <span style={{ fontFamily: MONO, fontSize: "0.6875rem", color: locked ? C.live : t.streak >= 2 && t.streakKind === "Loss" ? C.warn : C.green }}>
            {chip}
          </span>
        </div>

        <div style={{ display: "flex", gap: 18, fontFamily: BODY }}>
          <span style={{ color: C.green }}>W {t.wins}</span>
          <span style={{ color: C.red }}>L {t.losses}</span>
          {t.hasDollar && (
            <span style={{ color: t.netDollar >= 0 ? C.green : C.red }}>
              {t.netDollar >= 0 ? "+" : "−"}${Math.abs(t.netDollar).toFixed(2)}
            </span>
          )}
        </div>

        <div style={{ display: "flex", gap: 10 }}>
          <button onClick={() => void s.tap("Win", null)} disabled={locked}
            style={{ flex: 1, padding: "12px", borderRadius: 10, border: `1px solid ${C.green}`, background: "transparent", color: C.green, fontFamily: MONO, cursor: locked ? "not-allowed" : "pointer" }}>
            + Win
          </button>
          <button onClick={() => setLossDollarOpen(o => !o)} disabled={locked}
            style={{ flex: 1, padding: "12px", borderRadius: 10, border: `1px solid ${C.red}`, background: "transparent", color: C.red, fontFamily: MONO, cursor: locked ? "not-allowed" : "pointer" }}>
            + Loss
          </button>
        </div>

        {lossDollarOpen && (
          <div style={{ display: "flex", gap: 8 }}>
            <input
              autoFocus type="number" inputMode="decimal" placeholder="$ lost (optional)"
              value={lossDollar} onChange={e => setLossDollar(e.target.value)}
              onKeyDown={e => { if (e.key === "Enter") commitLoss(); }}
              style={{ flex: 1, padding: "10px", borderRadius: 8, border: `1px solid ${C.border}`, background: C.bg, color: C.text, fontFamily: MONO }}
            />
            <button onClick={commitLoss}
              style={{ padding: "10px 14px", borderRadius: 8, border: `1px solid ${C.red}`, background: "transparent", color: C.red, fontFamily: MONO, cursor: "pointer" }}>
              Log loss
            </button>
          </div>
        )}

        <div style={{ display: "flex", gap: 10 }}>
          <button onClick={() => { s.checkMe(); if (!s.interventionOpen) onToast?.("You're in control."); }}
            style={{ flex: 1, padding: "10px", borderRadius: 10, border: `1px solid ${C.border}`, background: "transparent", color: C.text, fontFamily: MONO, cursor: "pointer" }}>
            Check me
          </button>
          <button onClick={() => setDebriefOpen(true)}
            style={{ flex: 1, padding: "10px", borderRadius: 10, border: `1px solid ${C.border}`, background: "transparent", color: C.dim, fontFamily: MONO, cursor: "pointer" }}>
            End session
          </button>
        </div>
      </div>

      <InterventionSheet
        open={s.interventionOpen}
        signals={s.interventionSignals}
        C={C}
        isMobile={isMobile}
        cooldownMin={s.cooldownMin}
        onContinue={() => { void s.continueTrading(); }}
        onCancel={() => { void s.coolOff(); }}
      />

      {debriefOpen && (
        <PostSessionDebriefSheet
          open={debriefOpen}
          C={C}
          isMobile={isMobile}
          summary={{
            trades: t.wins + t.losses,
            wins: t.wins,
            losses: t.losses,
            pnlDisplay: t.hasDollar
              ? `${t.netDollar >= 0 ? "+" : "−"}$${Math.abs(t.netDollar).toFixed(2)}`
              : `${t.wins}W / ${t.losses}L`,
            pnlPositive: t.netDollar >= 0,
          }}
          onSave={() => { setDebriefOpen(false); void s.end(); onToast?.("Session ended."); }}
          onDismiss={() => { setDebriefOpen(false); void s.end(); }}
        />
      )}
    </>
  );
}
```

> **Implementation note for the worker:** the `setTimeout` countdown above is intentionally simple to keep the card self-contained. If the existing repo uses a `useInterval`/`useEffect` tick pattern (grep `setInterval` in `InterventionGate.tsx`), prefer mirroring that with a `useEffect` so React doesn't warn about a state update during render. Replace the inline `if (locked) setTimeout(...)` with a `useEffect(() => { if (!locked) return; const id = setInterval(() => setNow(Date.now()), 1000); return () => clearInterval(id); }, [locked])`. Do this before committing.

- [ ] **Step 4: Apply the `useEffect` countdown fix noted above, then run tests**

Run: `npx vitest run src/components/SessionCard.test.tsx`
Expected: PASS (4 tests). If `PostSessionDebriefSheet`'s `summary` prop type differs from the shape used here, align this object to the real `PostSessionDebriefSheetProps` (read `src/components/PostSessionDebriefSheet.tsx`) — the fields used in `Koda.tsx:4931` are `{ trades, wins, losses, pnlDisplay, pnlPositive }`.

- [ ] **Step 5: Typecheck**

Run: `npx tsc -p tsconfig.app.json --noEmit`
Expected: no errors in `SessionCard.tsx`.

- [ ] **Step 6: Commit**

```bash
git add src/components/SessionCard.tsx src/components/SessionCard.test.tsx
git commit -m "feat(session): SessionCard — idle/armed tally UI + mounted sheets"
```

---

### Task 7: Mount `SessionCard` on Home behind the pilot gate

**Files:**
- Modify: `src/Koda.tsx` (Home feed block — `view === "home"` at ~line 2101; the feed renders under `homeSection === "feed"` at ~line 2112).

**Interfaces:**
- Consumes: `SessionCard` (Task 6), `isSessionPilot` (Task 4). In-scope Koda.tsx values: `profile`, `C`, `isDesktop`, `showToast`.

- [ ] **Step 1: Add imports**

Near the other component imports at the top of `src/Koda.tsx` (alongside the `PreSessionSheet`/`PostSessionDebriefSheet` imports around lines 21–22):

```tsx
import { SessionCard } from "./components/SessionCard";
import { isSessionPilot } from "./lib/sessionPilot";
```

- [ ] **Step 2: Render the card at the top of the Home feed**

Inside the `homeSection === "feed"` block (just after the opening `<div>` at ~line 2112, before the `bannerItems` IIFE), insert:

```tsx
{isSessionPilot(profile.uid) && (
  <SessionCard profile={profile} C={C} isMobile={!isDesktop} onToast={showToast} />
)}
```

- [ ] **Step 3: Typecheck + full test run**

Run: `npx tsc -p tsconfig.app.json --noEmit && npx vitest run`
Expected: typecheck clean; all suites pass (the new session suites + the untouched `tilt`, `useTiltState`, `InterventionGate`, `InterventionSheet` suites).

- [ ] **Step 4: Manual smoke (gate is empty, so card is hidden)**

Confirm the app builds and Home renders unchanged for non-pilot users:

Run: `npm run build`
Expected: build succeeds. (With `SESSION_PILOT_UIDS` empty, the card does not render for anyone — this is the intended pre-dogfood state.)

- [ ] **Step 5: Commit**

```bash
git add src/Koda.tsx
git commit -m "feat(session): mount SessionCard on Home behind pilot gate"
```

---

### Task 8: PostHog session lifecycle events

**Files:**
- Modify: `src/hooks/useTradingSession.ts`
- Test: `src/hooks/useTradingSession.test.tsx`

**Interfaces:**
- Consumes: `phCapture` (`lib/posthog`). No new exports.

**Behaviour:** `start()` fires `phCapture("session_started", { maxDailyLoss, maxTradesPerDay })`. `end()` fires `phCapture("session_ended", { taps, netDollar, interventions })` where `interventions` counts how many times the sheet auto-opened this session (track with a `firedCount` ref). (`intervention_fired` with `source:"session"` already flows through Task 5's `logInterventionEvent` calls.)

- [ ] **Step 1: Write the failing test**

```tsx
// append to src/hooks/useTradingSession.test.tsx
import { phCapture } from "../lib/posthog";

it("fires session_started on start and session_ended on end", async () => {
  const { result } = renderHook(() => useTradingSession({ profile: PROFILE }));
  await act(async () => { await result.current.start({ maxDailyLoss: 500, maxTradesPerDay: 5 }); });
  expect(phCapture).toHaveBeenCalledWith("session_started", expect.objectContaining({ maxDailyLoss: 500, maxTradesPerDay: 5 }));
  await act(async () => { await result.current.tap("Win", 100); });
  await act(async () => { await result.current.end(); });
  expect(phCapture).toHaveBeenCalledWith("session_ended", expect.objectContaining({ taps: 1 }));
});
```

Update the existing `phCapture` mock at the top of the file so it is a spy you can assert on:

```tsx
const phCaptureMock = vi.fn();
vi.mock("../lib/posthog", () => ({ phCapture: (...a: unknown[]) => phCaptureMock(...a) }));
```
…and reference `phCaptureMock` in the new test (and `phCaptureMock.mockReset()` in `beforeEach`).

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/hooks/useTradingSession.test.tsx -t "session_started"`
Expected: FAIL — `phCapture` not called with these events.

- [ ] **Step 3: Write minimal implementation**

In `useTradingSession.ts`, import `phCapture` and add a fired-count ref:

```tsx
import { phCapture } from "../lib/posthog";
// …
  const firedCount = useRef(0);
```

In `start`, after `setSession(next)`:

```tsx
    firedCount.current = 0;
    try { phCapture("session_started", { maxDailyLoss: cfg.maxDailyLoss, maxTradesPerDay: cfg.maxTradesPerDay }); } catch { /* optional */ }
```

In `tap`, where the sheet auto-opens (inside the `if (state.active && !prevActive.current && !locked)` block), increment:

```tsx
        firedCount.current += 1;
```

In `end`, before `setSession(null)`:

```tsx
    const t = session ? computeTally(session) : null;
    try {
      phCapture("session_ended", {
        taps: session ? session.taps.length : 0,
        netDollar: t?.netDollar ?? 0,
        interventions: firedCount.current,
      });
    } catch { /* optional */ }
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/hooks/useTradingSession.test.tsx`
Expected: PASS (all tests in file).

- [ ] **Step 5: Commit**

```bash
git add src/hooks/useTradingSession.ts src/hooks/useTradingSession.test.tsx
git commit -m "feat(session): session_started / session_ended posthog events"
```

---

### Task 9: Full verification pass

**Files:** none (verification only).

- [ ] **Step 1: Full test suite**

Run: `npx vitest run`
Expected: all suites pass, including untouched `src/lib/tilt.test.ts` (proves the engine was not modified).

- [ ] **Step 2: Typecheck the app project**

Run: `npx tsc -p tsconfig.app.json --noEmit`
Expected: zero errors.

- [ ] **Step 3: Lint (catches unsigned `eslint-disable` / `: any` the pre-commit hook blocks)**

Run: `npm run lint`
Expected: clean.

- [ ] **Step 4: Production build**

Run: `npm run build`
Expected: build succeeds.

- [ ] **Step 5: Confirm the tilt engine diff is empty**

Run: `git diff main...HEAD -- src/lib/tilt.ts`
Expected: no output (engine untouched — Global Constraint).

- [ ] **Step 6: Final commit (if any lint/format fixups were needed)**

```bash
git add -A
git commit -m "chore(session): verification pass — tests, types, lint, build"
```

---

## Rollout (post-merge, Dylon-owned)

1. Paste the founder auth uid into `SESSION_PILOT_UIDS` (Task 4). Dogfood 2–3 NY sessions solo.
2. Flip `SESSION_PILOT_ALL = true` (or add all beta uids) to open to the 25 beta users. Watch the PostHog `% cancelled` among `intervention_fired` where `source = "session"` at day 7 and day 21.
3. **Day-30 verdict:** a meaningful cool-off rate + ≥1 genuine "the lock stopped me" → the pre-trade wedge works.

---

## Self-Review Notes

- **Spec coverage:** Trading Session container (T1), `tapsToTrades` adapter feeding unchanged `evaluateTilt` (T2), ephemeral `user_kv` persistence + stale-day guard (T5), inactive→active edge auto-fire (T5), reused `InterventionSheet`/`PreSessionSheet`/`PostSessionDebriefSheet`/cooldown (T6), `source` PostHog prop with no schema change (T3), solo-first `SESSION_PILOT_UIDS` gate with no `isPro` check (T4/T7), `session_started`/`session_ended`/`intervention_fired(source=session)` analytics (T3/T5/T8), tap-never-lost + write-failure-tolerant (T5). All spec sections map to a task.
- **YAGNI cuts honoured:** no migration, no broker sync, no `public.trades` writes, no emotion-tag input (so `tilt_emotion` stays dormant), no cross-device live sync beyond the storage shim, no new endpoints.
- **Type consistency:** `ActiveSession`/`SessionTap`/`SessionTally` defined in T1–T2 and consumed unchanged in T5–T6; `logInterventionEvent` `source` field defined in T3 and used in T5; `useTradingSession` return shape defined in T5 and consumed in T6; `InterventionSheet`/`PreSessionSheet`/`PostSessionDebriefSheet` props matched against the real call sites in `Koda.tsx`.
