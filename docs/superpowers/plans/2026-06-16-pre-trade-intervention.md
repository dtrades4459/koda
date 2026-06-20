# Pre-Trade Intervention (Trading Session) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make Kōda's tilt intervention fire *before the next trade is placed* by adding a lightweight, explicitly-armed "Trading Session" that tallies wins/losses and feeds the existing tilt engine live.

**Architecture:** Three small new units (`lib/session.ts` pure, `hooks/useTradingSession.ts`, `components/SessionCard.tsx`) wired into the **existing** `evaluateTilt` engine, `InterventionSheet`, `useTiltState` cooldown, `PreSessionSheet`, and `PostSessionDebriefSheet`. State is ephemeral in `user_kv` via the existing `storage` shim — no Supabase migration, no broker sync. Analytics reuse `logInterventionEvent` with one new PostHog `source` property.

**Tech Stack:** React 19 + TypeScript + Vite, Vitest + @testing-library/react, Supabase (untouched here), PostHog.

**Spec:** `docs/superpowers/specs/2026-06-16-pre-trade-intervention-design.md` (Approved). Sprint: Garry's 30-day sprint item #1.

---

## ⚠️ Environment note (this machine)

The dev box is 8GB soldered RAM and OOMs under parallel test runs. Before executing:
1. **Reboot first** so the fixed page file (set 2026-06-16) is active.
2. Run vitest **one file at a time** with `--maxWorkers=1`. Never run the full suite in parallel here.
3. A garbled/partial vitest summary on this box is the environment, not the code — re-run before investigating. See memory `project_koda_dev_env_crashes`.

Test command shape used throughout: `npx vitest run <file> --maxWorkers=1`

---

## Verified reuse points (do not modify these)

- `src/lib/tilt.ts` → `evaluateTilt(trades: Trade[], profile: Pick<Profile,"maxDailyLoss"|"maxTradesPerDay">, now: number): TiltState` where `TiltState = { active, critical, signals: TiltSignal[], evaluatedAt }`. **`maxDailyLoss`/`maxTradesPerDay` are `string`** on `Profile`.
- `src/hooks/useTiltState.ts` → `useTiltState({trades,profile})` returns `{ state, lockedUntil, settings, startCooldown(signals), clearCooldown }`. Cooldown lives in `user_kv` key `koda_intervention_lockout`.
- `src/data/interventions.ts` → `logInterventionEvent(args: LogInterventionArgs): Promise<string|null>`; `LogInterventionArgs = { userUid, signals: TiltSignalId[], critical, choice: "continued"|"cancelled", sessionDate }`. `choice: "cancelled"` = stopped, `"continued"` = traded on.
- `src/components/InterventionSheet.tsx` → props `{ open, signals, C, isMobile, onContinue, onCancel, cooldownMin? }` (presentational).
- `src/components/PreSessionSheet.tsx` → props `{ open, C, isMobile, maxDailyLoss?, maxTradesPerDay?, onStart, onCancel }`.
- `src/components/PostSessionDebriefSheet.tsx` → props `{ open, C, isMobile, summary: DebriefSummary, onSave, onDismiss }`; `DebriefSummary = { trades, wins, losses, pnlDisplay, pnlPositive }`.
- `src/lib/storage.ts` → `storage.get(key): Promise<{value:string}|null>`, `storage.set(key, value:string): Promise<void>` (user_kv + localStorage shim).
- `src/lib/posthog.ts` → `phCapture(event: string, props?: Record<string, unknown>)`.
- `src/lib/team.ts` → `isFounder(uid?: string): boolean`. Used as the phase-1 pilot gate.

---

## File structure

| File | New/Modify | Responsibility |
|---|---|---|
| `src/lib/session.ts` | Create | Pure: `ActiveSession`/`SessionTap` types, `addTap`, `clearSession`, `isStale`, `tapsToTrades` adapter, `sessionProfile` adapter |
| `src/lib/session.test.ts` | Create | Unit tests for the pure module |
| `src/hooks/useTradingSession.ts` | Create | Persistence, live tilt eval, inactive→active edge detection, cooldown bridge |
| `src/hooks/useTradingSession.test.tsx` | Create | Hook tests (edge auto-fire, cooldown suppression, stale discard) |
| `src/components/SessionCard.tsx` | Create | Home card: idle/armed UI, tally buttons, status chip, auto-fire sheet, start/end edges |
| `src/components/SessionCard.test.tsx` | Create | Component tests (tap updates tally, threshold opens sheet, End opens debrief) |
| `src/data/interventions.ts` | Modify | Add optional `source` prop to `logInterventionEvent` → PostHog only |
| `src/data/interventions.test.ts` | Modify | Assert `source` reaches `phCapture`, defaults to `"log"`, DB row unchanged |
| `src/Koda.tsx` | Modify | Mount `<SessionCard>` at top of Home, gated by `isFounder(profile.uid)`; emit `session_started`/`session_ended` |

---

## Task 1: Add `source` to `logInterventionEvent` (PostHog only)

**Files:**
- Modify: `src/data/interventions.ts:27-61`
- Test: `src/data/interventions.test.ts`

- [ ] **Step 1: Write the failing test**

Add to `src/data/interventions.test.ts` (mirror the existing mock of `phCapture`/`supabase` in that file):

```ts
it("passes source to PostHog but not to the DB row, defaulting to 'log'", async () => {
  await logInterventionEvent({
    userUid: "u1", signals: ["consec_losses"], critical: false,
    choice: "cancelled", sessionDate: "2026-06-16", source: "session",
  });
  expect(phCaptureMock).toHaveBeenCalledWith("intervention_fired",
    expect.objectContaining({ choice: "cancelled", source: "session" }));
  // DB insert row must NOT contain source
  expect(insertMock).toHaveBeenCalledWith(expect.not.objectContaining({ source: expect.anything() }));

  phCaptureMock.mockClear();
  await logInterventionEvent({
    userUid: "u1", signals: [], critical: false, choice: "continued", sessionDate: "2026-06-16",
  });
  expect(phCaptureMock).toHaveBeenCalledWith("intervention_fired",
    expect.objectContaining({ source: "log" }));
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/data/interventions.test.ts --maxWorkers=1`
Expected: FAIL — `source` not present in phCapture payload (and TS error: `source` not on `LogInterventionArgs`).

- [ ] **Step 3: Implement the minimal change**

In `src/data/interventions.ts`, extend the args type and the capture call only:

```ts
export interface LogInterventionArgs {
  userUid: string;
  signals: TiltSignalId[];
  critical: boolean;
  choice: InterventionChoice;
  sessionDate: string;
  source?: "log" | "session";
}
```

Inside `logInterventionEvent`, leave the `row` and `insert` untouched. Change only the `phCapture` call:

```ts
    phCapture("intervention_fired", {
      signals: args.signals,
      critical: args.critical,
      choice: args.choice,
      session_date: args.sessionDate,
      source: args.source ?? "log",
    });
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/data/interventions.test.ts --maxWorkers=1`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/data/interventions.ts src/data/interventions.test.ts
git commit -m "feat(session): add source prop to logInterventionEvent (PostHog only)"
```

---

## Task 2: `lib/session.ts` — pure session module

**Files:**
- Create: `src/lib/session.ts`
- Test: `src/lib/session.test.ts`

- [ ] **Step 1: Write the failing tests**

Create `src/lib/session.test.ts`:

```ts
import { describe, it, expect } from "vitest";
import { addTap, clearSession, isStale, tapsToTrades, sessionProfile, type ActiveSession } from "./session";

const baseSession = (startedAt: string): ActiveSession => ({
  startedAt, maxDailyLoss: 500, maxTradesPerDay: 5, taps: [],
});

describe("addTap", () => {
  it("appends a tap in order without mutating the input", () => {
    const s0 = baseSession("2026-06-16T13:00:00.000Z");
    const s1 = addTap(s0, { outcome: "Loss", pnlDollar: -100, at: "2026-06-16T13:05:00.000Z" });
    const s2 = addTap(s1, { outcome: "Win", pnlDollar: 80, at: "2026-06-16T13:10:00.000Z" });
    expect(s0.taps).toHaveLength(0);            // original untouched
    expect(s2.taps.map(t => t.outcome)).toEqual(["Loss", "Win"]);
  });
});

describe("clearSession", () => {
  it("returns null", () => {
    expect(clearSession()).toBeNull();
  });
});

describe("isStale", () => {
  it("is true when startedAt is a prior local day", () => {
    const s = baseSession("2026-06-15T13:00:00.000Z");
    const now = Date.parse("2026-06-16T09:00:00.000Z");
    expect(isStale(s, now)).toBe(true);
  });
  it("is false when startedAt is today", () => {
    const s = baseSession("2026-06-16T08:00:00.000Z");
    const now = Date.parse("2026-06-16T20:00:00.000Z");
    expect(isStale(s, now)).toBe(false);
  });
});

describe("tapsToTrades", () => {
  it("maps taps to time-ordered, Trade-shaped objects the tilt engine can read", () => {
    let s = baseSession("2026-06-16T13:00:00.000Z");
    s = addTap(s, { outcome: "Loss", pnlDollar: -100, at: "2026-06-16T13:05:00.000Z" });
    s = addTap(s, { outcome: "Win", pnlDollar: null, at: "2026-06-16T13:10:00.000Z" });
    const trades = tapsToTrades(s);
    expect(trades).toHaveLength(2);
    expect(trades[0].outcome).toBe("Loss");
    expect(trades[0].date).toBe("2026-06-16");
    expect(trades[0].entryTime).toBe("2026-06-16T13:05:00.000Z");
    expect(trades[0].pnlDollar).toBe("-100");
    expect(trades[1].pnlDollar).toBe("0");      // null → "0"
  });
});

describe("sessionProfile", () => {
  it("converts numeric limits to the string-typed shape evaluateTilt expects", () => {
    const s = baseSession("2026-06-16T13:00:00.000Z");
    expect(sessionProfile(s)).toEqual({ maxDailyLoss: "500", maxTradesPerDay: "5" });
  });
  it("emits empty strings when limits are null", () => {
    const s: ActiveSession = { ...baseSession("2026-06-16T13:00:00.000Z"), maxDailyLoss: null, maxTradesPerDay: null };
    expect(sessionProfile(s)).toEqual({ maxDailyLoss: "", maxTradesPerDay: "" });
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx vitest run src/lib/session.test.ts --maxWorkers=1`
Expected: FAIL — `./session` cannot be resolved.

- [ ] **Step 3: Write minimal implementation**

Create `src/lib/session.ts`:

```ts
// src/lib/session.ts
// ═══════════════════════════════════════════════════════════════════════════════
// Kōda · Trading Session (pure)
//
// Ephemeral container for "I'm trading right now". Holds a live tally of taps and
// adapts them into Trade-shaped objects for the existing evaluateTilt engine.
// No React, no storage, no DB.
// ═══════════════════════════════════════════════════════════════════════════════

import type { Trade, Profile } from "../types";

export interface SessionTap {
  outcome: "Win" | "Loss";
  pnlDollar: number | null; // optional; when present, unlocks daily-loss signals
  at: string;               // ISO timestamp — drives ordering + revenge_window
}

export interface ActiveSession {
  startedAt: string;            // ISO
  maxDailyLoss: number | null;  // captured from PreSessionSheet at arm
  maxTradesPerDay: number | null;
  taps: SessionTap[];
}

function localDay(ms: number): string {
  const d = new Date(ms);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

/** Append a tap, returning a new session (no mutation). */
export function addTap(session: ActiveSession, tap: SessionTap): ActiveSession {
  return { ...session, taps: [...session.taps, tap] };
}

/** Clearing a session is represented as the absence of one. */
export function clearSession(): null {
  return null;
}

/** A session that wasn't started on the current local day must be discarded. */
export function isStale(session: ActiveSession, now: number): boolean {
  return localDay(Date.parse(session.startedAt)) !== localDay(now);
}

/** Adapt taps → minimal full Trade objects readable by evaluateTilt. */
export function tapsToTrades(session: ActiveSession): Trade[] {
  return session.taps.map(tap => {
    const day = localDay(Date.parse(tap.at));
    return {
      id: Date.parse(tap.at),
      date: day,
      pair: "",
      session: "",
      bias: "",
      strategy: "",
      setup: "",
      entryPrice: "",
      slPrice: "",
      tpPrice: "",
      rr: "",
      outcome: tap.outcome,
      pnl: tap.pnlDollar === null ? "" : String(tap.pnlDollar),
      notes: "",
      emotions: "",
      screenshot: "",
      pnlDollar: String(tap.pnlDollar ?? 0),
      entryTime: tap.at,
      exitTime: tap.at,
      comments: [],
      reactions: {},
      source: "session_tap",
    };
  });
}

/** Build the string-typed profile slice evaluateTilt reads. */
export function sessionProfile(session: ActiveSession): Pick<Profile, "maxDailyLoss" | "maxTradesPerDay"> {
  return {
    maxDailyLoss: session.maxDailyLoss === null ? "" : String(session.maxDailyLoss),
    maxTradesPerDay: session.maxTradesPerDay === null ? "" : String(session.maxTradesPerDay),
  };
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx vitest run src/lib/session.test.ts --maxWorkers=1`
Expected: PASS (all 7 assertions).

- [ ] **Step 5: Commit**

```bash
git add src/lib/session.ts src/lib/session.test.ts
git commit -m "feat(session): pure Trading Session module + tilt adapter"
```

---

## Task 3: `hooks/useTradingSession.ts` — persistence + live tilt + edge auto-fire

**Files:**
- Create: `src/hooks/useTradingSession.ts`
- Test: `src/hooks/useTradingSession.test.tsx`

Design: the hook owns the `ActiveSession`, persists it to `user_kv` key `koda_active_session`, recomputes tilt on every tap via `evaluateTilt(tapsToTrades(s), sessionProfile(s), Date.now())`, and exposes an `interventionOpen` flag that flips to `true` only on the **inactive→active edge** (not while already active, and not while a cooldown lock is held).

- [ ] **Step 1: Write the failing tests**

Create `src/hooks/useTradingSession.test.tsx`:

```tsx
import { describe, it, expect, vi, beforeEach } from "vitest";
import { act, renderHook, waitFor } from "@testing-library/react";

// in-memory storage mock
const mem = new Map<string, string>();
vi.mock("../lib/storage", () => ({
  storage: {
    get: vi.fn(async (k: string) => (mem.has(k) ? { value: mem.get(k)! } : null)),
    set: vi.fn(async (k: string, v: string) => { mem.set(k, v); }),
  },
}));

import { useTradingSession } from "./useTradingSession";

const profile = { uid: "u1", maxDailyLoss: "", maxTradesPerDay: "", prefs: {} } as never;

beforeEach(() => { mem.clear(); vi.clearAllMocks(); });

describe("useTradingSession", () => {
  it("arms a session and records taps", async () => {
    const { result } = renderHook(() => useTradingSession({ profile, lockedUntil: null }));
    await act(async () => { await result.current.start({ maxDailyLoss: 500, maxTradesPerDay: 5 }); });
    await act(async () => { await result.current.tapLoss(-100); });
    expect(result.current.session?.taps).toHaveLength(1);
  });

  it("auto-fires the intervention once on the inactive→active edge, not again while active", async () => {
    const { result } = renderHook(() => useTradingSession({ profile, lockedUntil: null }));
    await act(async () => { await result.current.start({ maxDailyLoss: null, maxTradesPerDay: null }); });
    // 3 consecutive losses trips consec_losses (active)
    await act(async () => { await result.current.tapLoss(null); });
    await act(async () => { await result.current.tapLoss(null); });
    await act(async () => { await result.current.tapLoss(null); });
    expect(result.current.interventionOpen).toBe(true);
    expect(result.current.activeSignals.length).toBeGreaterThan(0);
    // dismiss via continue → another loss while already-active must NOT re-open
    await act(async () => { await result.current.continueTrading(); });
    expect(result.current.interventionOpen).toBe(false);
    await act(async () => { await result.current.tapLoss(null); });
    expect(result.current.interventionOpen).toBe(false);
  });

  it("suppresses auto-fire while a cooldown lock is held", async () => {
    const future = Date.now() + 10 * 60_000;
    const { result } = renderHook(() => useTradingSession({ profile, lockedUntil: future }));
    await act(async () => { await result.current.start({ maxDailyLoss: null, maxTradesPerDay: null }); });
    await act(async () => { await result.current.tapLoss(null); });
    await act(async () => { await result.current.tapLoss(null); });
    await act(async () => { await result.current.tapLoss(null); });
    expect(result.current.interventionOpen).toBe(false);
  });

  it("discards a stale (prior-day) persisted session on load", async () => {
    mem.set("koda_active_session", JSON.stringify({
      startedAt: "2020-01-01T10:00:00.000Z", maxDailyLoss: null, maxTradesPerDay: null,
      taps: [{ outcome: "Loss", pnlDollar: null, at: "2020-01-01T10:05:00.000Z" }],
    }));
    const { result } = renderHook(() => useTradingSession({ profile, lockedUntil: null }));
    await waitFor(() => expect(result.current.session).toBeNull());
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx vitest run src/hooks/useTradingSession.test.tsx --maxWorkers=1`
Expected: FAIL — `./useTradingSession` cannot be resolved.

- [ ] **Step 3: Write minimal implementation**

Create `src/hooks/useTradingSession.ts`:

```ts
// src/hooks/useTradingSession.ts
// ═══════════════════════════════════════════════════════════════════════════════
// Kōda · useTradingSession
//
// Owns the ephemeral Trading Session, persists it to user_kv, evaluates tilt live
// on every tap, and opens the InterventionSheet on the inactive→active edge —
// before the next trade. Reuses evaluateTilt + the cooldown lock (lockedUntil).
// ═══════════════════════════════════════════════════════════════════════════════

import { useCallback, useEffect, useRef, useState } from "react";
import { storage } from "../lib/storage";
import { log } from "../lib/log";
import { evaluateTilt, type TiltSignal } from "../lib/tilt";
import {
  addTap, clearSession, isStale, tapsToTrades, sessionProfile,
  type ActiveSession, type SessionTap,
} from "../lib/session";
import type { Profile } from "../types";

const SESSION_KEY = "koda_active_session";

interface Args {
  profile: Profile;
  /** Cooldown lock end (ms) from useTiltState; suppresses auto-fire while held. */
  lockedUntil: number | null;
}

export interface TradingSessionApi {
  session: ActiveSession | null;
  interventionOpen: boolean;
  activeSignals: TiltSignal[];
  critical: boolean;
  start: (limits: { maxDailyLoss: number | null; maxTradesPerDay: number | null }) => Promise<void>;
  tapWin: (pnlDollar: number | null) => Promise<void>;
  tapLoss: (pnlDollar: number | null) => Promise<void>;
  continueTrading: () => void;
  coolOff: () => void;
  checkMe: () => void;
  end: () => Promise<void>;
  dismissIntervention: () => void;
}

export function useTradingSession({ profile, lockedUntil }: Args): TradingSessionApi {
  const [session, setSession] = useState<ActiveSession | null>(null);
  const [interventionOpen, setInterventionOpen] = useState(false);
  const [activeSignals, setActiveSignals] = useState<TiltSignal[]>([]);
  const [critical, setCritical] = useState(false);
  // tracks whether tilt was active on the previous evaluation (edge detection)
  const wasActive = useRef(false);

  // Load persisted session on mount; discard if stale.
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const row = await storage.get(SESSION_KEY);
        if (cancelled) return;
        if (!row) return;
        const parsed = JSON.parse(row.value) as ActiveSession | null;
        if (!parsed) return;
        if (isStale(parsed, Date.now())) { await storage.set(SESSION_KEY, "null"); return; }
        setSession(parsed);
        wasActive.current = evaluateTilt(tapsToTrades(parsed), sessionProfile(parsed), Date.now()).active;
      } catch (e) {
        log.error("useTradingSession.load", e);
      }
    })();
    return () => { cancelled = true; };
  }, [profile.uid]);

  const persist = useCallback(async (next: ActiveSession | null) => {
    try { await storage.set(SESSION_KEY, JSON.stringify(next)); }
    catch (e) { log.error("useTradingSession.persist", e); } // tally already updated in memory
  }, []);

  // Apply a new session state, evaluate tilt, and fire on the rising edge.
  const applyAndEvaluate = useCallback((next: ActiveSession) => {
    setSession(next);
    void persist(next);
    const tilt = evaluateTilt(tapsToTrades(next), sessionProfile(next), Date.now());
    setActiveSignals(tilt.signals);
    setCritical(tilt.critical);
    const locked = lockedUntil !== null && lockedUntil > Date.now();
    if (tilt.active && !wasActive.current && !locked) {
      setInterventionOpen(true);
    }
    wasActive.current = tilt.active;
  }, [lockedUntil, persist]);

  const start = useCallback(async (limits: { maxDailyLoss: number | null; maxTradesPerDay: number | null }) => {
    const next: ActiveSession = {
      startedAt: new Date().toISOString(),
      maxDailyLoss: limits.maxDailyLoss,
      maxTradesPerDay: limits.maxTradesPerDay,
      taps: [],
    };
    wasActive.current = false;
    setInterventionOpen(false);
    setActiveSignals([]);
    setCritical(false);
    setSession(next);
    await persist(next);
  }, [persist]);

  const tap = useCallback((outcome: SessionTap["outcome"], pnlDollar: number | null) => {
    if (!session) return Promise.resolve();
    const next = addTap(session, { outcome, pnlDollar, at: new Date().toISOString() });
    applyAndEvaluate(next);
    return Promise.resolve();
  }, [session, applyAndEvaluate]);

  const tapWin = useCallback((pnlDollar: number | null) => tap("Win", pnlDollar), [tap]);
  const tapLoss = useCallback((pnlDollar: number | null) => tap("Loss", pnlDollar), [tap]);

  const dismissIntervention = useCallback(() => setInterventionOpen(false), []);
  const continueTrading = useCallback(() => setInterventionOpen(false), []);
  const coolOff = useCallback(() => setInterventionOpen(false), []);
  const checkMe = useCallback(() => {
    if (activeSignals.length > 0) setInterventionOpen(true);
  }, [activeSignals.length]);

  const end = useCallback(async () => {
    setSession(clearSession());
    setInterventionOpen(false);
    setActiveSignals([]);
    setCritical(false);
    wasActive.current = false;
    await persist(null);
  }, [persist]);

  return {
    session, interventionOpen, activeSignals, critical,
    start, tapWin, tapLoss, continueTrading, coolOff, checkMe, end, dismissIntervention,
  };
}
```

> Note: `continueTrading`/`coolOff` here only manage sheet visibility. The DB log + the actual cooldown start are wired by `SessionCard` in Task 4 (it has `logInterventionEvent` + `startCooldown`). Keeping the hook free of DB/Supabase keeps it unit-testable without mocking Supabase.

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx vitest run src/hooks/useTradingSession.test.tsx --maxWorkers=1`
Expected: PASS (4 tests). If `consec_losses` needs a different count than 3 to go active, read `src/lib/tilt.ts` §consec_losses and adjust the number of `tapLoss` calls in the test to match — the engine is the source of truth.

- [ ] **Step 5: Commit**

```bash
git add src/hooks/useTradingSession.ts src/hooks/useTradingSession.test.tsx
git commit -m "feat(session): useTradingSession hook with edge-triggered auto-fire"
```

---

## Task 4: `components/SessionCard.tsx` — Home card + wiring

**Files:**
- Create: `src/components/SessionCard.tsx`
- Test: `src/components/SessionCard.test.tsx`

SessionCard owns the DB/cooldown side-effects (so the hook stays pure-ish): on continue → `logInterventionEvent({choice:"continued", source:"session"})`; on cool off → `logInterventionEvent({choice:"cancelled", source:"session"})` + `startCooldown(signalIds)`. It renders `PreSessionSheet` (start), `InterventionSheet` (auto-fire), and `PostSessionDebriefSheet` (end).

- [ ] **Step 1: Write the failing tests**

Create `src/components/SessionCard.test.tsx`:

```tsx
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";

const mem = new Map<string, string>();
vi.mock("../lib/storage", () => ({
  storage: {
    get: vi.fn(async (k: string) => (mem.has(k) ? { value: mem.get(k)! } : null)),
    set: vi.fn(async (k: string, v: string) => { mem.set(k, v); }),
  },
}));
const logInterventionEvent = vi.fn(async () => "id1");
vi.mock("../data/interventions", () => ({ logInterventionEvent }));

import { SessionCard } from "./SessionCard";
import { theme } from "../theme";

const C = theme("dark");
const profile = { uid: "u1", maxDailyLoss: "", maxTradesPerDay: "", prefs: {} } as never;
const noopCooldown = { lockedUntil: null, startCooldown: vi.fn(async () => {}) };

beforeEach(() => { mem.clear(); vi.clearAllMocks(); });

it("shows Start session when idle, and a tally once armed", async () => {
  render(<SessionCard C={C} isMobile={true} profile={profile} {...noopCooldown} />);
  fireEvent.click(screen.getByText(/start session/i));
  // PreSessionSheet → confirm start
  fireEvent.click(await screen.findByRole("button", { name: /start|begin|confirm/i }));
  expect(await screen.findByText(/\+ ?win/i)).toBeInTheDocument();
  expect(screen.getByText(/\+ ?loss/i)).toBeInTheDocument();
});

it("opens the intervention sheet when losses cross the threshold and logs the choice", async () => {
  render(<SessionCard C={C} isMobile={true} profile={profile} {...noopCooldown} />);
  fireEvent.click(screen.getByText(/start session/i));
  fireEvent.click(await screen.findByRole("button", { name: /start|begin|confirm/i }));
  const lossBtn = await screen.findByText(/\+ ?loss/i);
  fireEvent.click(lossBtn); fireEvent.click(lossBtn); fireEvent.click(lossBtn);
  // InterventionSheet auto-opens (its kicker text contains "Heads up")
  expect(await screen.findByText(/heads up/i)).toBeInTheDocument();
  // cool off → logs cancelled with source session + starts cooldown
  fireEvent.click(screen.getByText(/cancel/i));
  await waitFor(() => expect(logInterventionEvent).toHaveBeenCalledWith(
    expect.objectContaining({ choice: "cancelled", source: "session" })));
  expect(noopCooldown.startCooldown).toHaveBeenCalled();
});

it("opens the debrief on End session", async () => {
  render(<SessionCard C={C} isMobile={true} profile={profile} {...noopCooldown} />);
  fireEvent.click(screen.getByText(/start session/i));
  fireEvent.click(await screen.findByRole("button", { name: /start|begin|confirm/i }));
  fireEvent.click(await screen.findByText(/end session/i));
  // PostSessionDebriefSheet asks the rules-followed question
  expect(await screen.findByText(/rules/i)).toBeInTheDocument();
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx vitest run src/components/SessionCard.test.tsx --maxWorkers=1`
Expected: FAIL — `./SessionCard` cannot be resolved.

- [ ] **Step 3: Write minimal implementation**

Create `src/components/SessionCard.tsx`:

```tsx
// src/components/SessionCard.tsx
// ═══════════════════════════════════════════════════════════════════════════════
// Kōda · SessionCard — pre-trade intervention surface
//
// Mounts at the top of Home. Idle = "Start session". Armed = live tally with
// + Win / + Loss taps that feed the tilt engine; the InterventionSheet auto-opens
// before the next trade when tilt goes active. Reuses Pre/Post session sheets.
// ═══════════════════════════════════════════════════════════════════════════════

import { useState } from "react";
import { MONO, BODY } from "../shared";
import type { Theme } from "../theme";
import type { Profile } from "../types";
import { useTradingSession } from "../hooks/useTradingSession";
import { InterventionSheet } from "./InterventionSheet";
import { PreSessionSheet } from "./PreSessionSheet";
import { PostSessionDebriefSheet, type DebriefSummary } from "./PostSessionDebriefSheet";
import { logInterventionEvent } from "../data/interventions";
import { phCapture } from "../lib/posthog";
import type { CooldownMin } from "../hooks/useTiltState";

interface Props {
  C: Theme;
  isMobile: boolean;
  profile: Profile;
  lockedUntil: number | null;
  startCooldown: (signals: import("../lib/tilt").TiltSignalId[]) => Promise<void>;
  cooldownMin?: CooldownMin;
}

function todayLocalDate(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

export function SessionCard({ C, isMobile, profile, lockedUntil, startCooldown, cooldownMin }: Props) {
  const ts = useTradingSession({ profile, lockedUntil });
  const [showPre, setShowPre] = useState(false);
  const [showDebrief, setShowDebrief] = useState(false);
  const [lossDollar, setLossDollar] = useState("");

  const limits = {
    maxDailyLoss: profile.maxDailyLoss ? parseFloat(profile.maxDailyLoss) : null,
    maxTradesPerDay: profile.maxTradesPerDay ? parseFloat(profile.maxTradesPerDay) : null,
  };

  const wins = ts.session?.taps.filter(t => t.outcome === "Win").length ?? 0;
  const losses = ts.session?.taps.filter(t => t.outcome === "Loss").length ?? 0;
  const net = (ts.session?.taps ?? []).reduce((s, t) => s + (t.pnlDollar ?? 0), 0);

  async function onStartConfirmed() {
    setShowPre(false);
    await ts.start(limits);
    phCapture("session_started", { maxDailyLoss: limits.maxDailyLoss, maxTradesPerDay: limits.maxTradesPerDay });
  }

  async function onContinue() {
    ts.continueTrading();
    if (profile.uid) {
      await logInterventionEvent({
        userUid: profile.uid, signals: ts.activeSignals.map(s => s.id),
        critical: ts.critical, choice: "continued", sessionDate: todayLocalDate(), source: "session",
      });
    }
  }

  async function onCoolOff() {
    const signalIds = ts.activeSignals.map(s => s.id);
    ts.coolOff();
    await startCooldown(signalIds);
    if (profile.uid) {
      await logInterventionEvent({
        userUid: profile.uid, signals: signalIds,
        critical: ts.critical, choice: "cancelled", sessionDate: todayLocalDate(), source: "session",
      });
    }
  }

  async function onEnd() {
    phCapture("session_ended", { taps: (ts.session?.taps.length ?? 0), net, interventions: 0 });
    await ts.end();
    setShowDebrief(true);
  }

  const debriefSummary: DebriefSummary = {
    trades: wins + losses, wins, losses,
    pnlDisplay: `${net >= 0 ? "+" : "-"}$${Math.abs(net).toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`,
    pnlPositive: net >= 0,
  };

  const card: React.CSSProperties = {
    border: `1px solid ${C.border2}`, borderRadius: 14, padding: 20, background: C.panel, marginBottom: 20,
  };
  const kicker: React.CSSProperties = {
    fontFamily: MONO, fontSize: "0.625rem", color: C.muted, letterSpacing: "0.12em", textTransform: "uppercase",
  };

  return (
    <div style={card}>
      {!ts.session ? (
        <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
          <div style={kicker}>Trading session</div>
          <button onClick={() => setShowPre(true)}
            style={{ background: C.live, color: C.bg, border: "none", borderRadius: 999, padding: "12px 20px", cursor: "pointer", fontFamily: MONO, fontSize: "0.75rem", letterSpacing: "0.06em", textTransform: "uppercase", fontWeight: 600 }}>
            Start session
          </button>
        </div>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <div style={kicker}>Session live</div>
            <div style={{ fontFamily: MONO, fontSize: "0.625rem", color: ts.activeSignals.length ? C.warn : C.live }}>
              {ts.activeSignals.length ? `Warning — ${losses} losses` : "In control ✓"}
            </div>
          </div>
          <div style={{ display: "flex", gap: 16, fontFamily: MONO }}>
            <span style={{ color: C.green }}>{wins}W</span>
            <span style={{ color: C.red }}>{losses}L</span>
            <span style={{ color: net >= 0 ? C.green : C.red }}>{debriefSummary.pnlDisplay}</span>
          </div>
          <div style={{ display: "flex", gap: 10 }}>
            <button onClick={() => ts.tapWin(null)}
              style={{ flex: 1, background: "transparent", color: C.green, border: `1px solid ${C.border2}`, borderRadius: 999, padding: "12px", cursor: "pointer", fontFamily: MONO, fontSize: "0.75rem", textTransform: "uppercase" }}>
              + Win
            </button>
            <button onClick={() => ts.tapLoss(lossDollar ? -Math.abs(parseFloat(lossDollar)) : null).then(() => setLossDollar(""))}
              style={{ flex: 1, background: "transparent", color: C.red, border: `1px solid ${C.border2}`, borderRadius: 999, padding: "12px", cursor: "pointer", fontFamily: MONO, fontSize: "0.75rem", textTransform: "uppercase" }}>
              + Loss
            </button>
          </div>
          <input value={lossDollar} onChange={e => setLossDollar(e.target.value)} placeholder="Loss $ (optional)"
            inputMode="decimal" style={{ background: "transparent", border: "none", borderBottom: `1px solid ${C.border2}`, color: C.text, padding: "8px 0", fontFamily: MONO, fontSize: 16 }} />
          <div style={{ display: "flex", gap: 10 }}>
            <button onClick={ts.checkMe}
              style={{ flex: 1, background: "transparent", color: C.muted, border: `1px solid ${C.border2}`, borderRadius: 999, padding: "10px", cursor: "pointer", fontFamily: MONO, fontSize: "0.6875rem", textTransform: "uppercase" }}>
              Check me
            </button>
            <button onClick={onEnd}
              style={{ flex: 1, background: "transparent", color: C.muted, border: `1px solid ${C.border2}`, borderRadius: 999, padding: "10px", cursor: "pointer", fontFamily: MONO, fontSize: "0.6875rem", textTransform: "uppercase" }}>
              End session
            </button>
          </div>
          {ts.activeSignals.length === 0 && (
            <div style={{ fontFamily: BODY, fontSize: "0.6875rem", color: C.muted }}>Tap after each trade. We watch for tilt.</div>
          )}
        </div>
      )}

      <PreSessionSheet open={showPre} C={C} isMobile={isMobile}
        maxDailyLoss={limits.maxDailyLoss} maxTradesPerDay={limits.maxTradesPerDay}
        onStart={onStartConfirmed} onCancel={() => setShowPre(false)} />

      <InterventionSheet open={ts.interventionOpen} signals={ts.activeSignals} C={C} isMobile={isMobile}
        cooldownMin={cooldownMin} onContinue={onContinue} onCancel={onCoolOff} />

      <PostSessionDebriefSheet open={showDebrief} C={C} isMobile={isMobile} summary={debriefSummary}
        onSave={() => setShowDebrief(false)} onDismiss={() => setShowDebrief(false)} />
    </div>
  );
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx vitest run src/components/SessionCard.test.tsx --maxWorkers=1`
Expected: PASS (3 tests). If a button accessible-name in `PreSessionSheet`/`PostSessionDebriefSheet` differs, open that component's JSX and align the test's `name:` regex to the real label (the component is the source of truth — do not change the component to fit the test).

- [ ] **Step 5: Commit**

```bash
git add src/components/SessionCard.tsx src/components/SessionCard.test.tsx
git commit -m "feat(session): SessionCard with auto-fire intervention + start/end edges"
```

---

## Task 5: Mount in Home, founder-gated

**Files:**
- Modify: `src/Koda.tsx` (Home render region; the file already imports `useTiltState` and renders the journal Home)

- [ ] **Step 1: Locate the integration point**

Run: `git grep -n "useTiltState\|isFounder\|function Home\|Home(" src/Koda.tsx`
Identify (a) where `useTiltState({trades, profile})` is already called (reuse its `lockedUntil`, `startCooldown`, `settings.cooldownMin`), and (b) the top of the Home view JSX.

- [ ] **Step 2: Add the import and mount**

At the imports:

```ts
import { SessionCard } from "./components/SessionCard";
import { isFounder } from "./lib/team";
```

At the top of the Home content JSX (above the existing first card), using the `useTiltState` values already in scope:

```tsx
{isFounder(profile.uid) && (
  <SessionCard
    C={C}
    isMobile={isMobile}
    profile={profile}
    lockedUntil={lockedUntil}
    startCooldown={startCooldown}
    cooldownMin={settings.cooldownMin}
  />
)}
```

If `lockedUntil`/`startCooldown`/`settings` are not already destructured from the existing `useTiltState(...)` call, destructure them there (do not add a second `useTiltState` call).

- [ ] **Step 3: Typecheck (no new test — this is wiring)**

Run: `npx tsc -p tsconfig.app.json --noEmit`
Expected: no new errors. (Per memory, `npm run typecheck` can pass falsely — use the app tsconfig directly.)

- [ ] **Step 4: Manual smoke (after reboot)**

Run the app, sign in as a founder account, confirm SessionCard renders at the top of Home, Start → Pre-session → tally → 3 losses → InterventionSheet appears. Non-founder account: card absent.

- [ ] **Step 5: Commit**

```bash
git add src/Koda.tsx
git commit -m "feat(session): mount SessionCard on Home behind founder pilot gate"
```

---

## Task 6: Full verification + branch wrap

- [ ] **Step 1: Run the three new suites individually**

```bash
npx vitest run src/lib/session.test.ts --maxWorkers=1
npx vitest run src/hooks/useTradingSession.test.tsx --maxWorkers=1
npx vitest run src/components/SessionCard.test.tsx --maxWorkers=1
npx vitest run src/data/interventions.test.ts --maxWorkers=1
```
Expected: all PASS.

- [ ] **Step 2: Typecheck the app project**

Run: `npx tsc -p tsconfig.app.json --noEmit` → no errors.

- [ ] **Step 3: Confirm no `: any` / unsigned eslint-disable** (pre-commit hook enforces this; if it blocks, fix the underlying type rather than disabling).

- [ ] **Step 4: Push the branch and open a draft PR**

```bash
git push -u origin session/pre-trade-intervention
gh pr create --draft --title "feat: pre-trade intervention (Trading Session)" --body "Garry sprint #1. Founder-gated pilot. No migration. Day-30 metric: % cancelled (source=session) in PostHog."
```

---

## Self-Review (run against the spec)

**Spec coverage:**
- Fire before the next trade → Task 3 edge auto-fire + Task 4 sheet wiring ✓
- Reuse tilt engine via adapter, tilt.ts unmodified → Task 2 `tapsToTrades`/`sessionProfile` ✓
- Ephemeral `user_kv`, single owned row, no migration → Task 3 `koda_active_session` ✓
- Stale-day guard → Task 2 `isStale` + Task 3 load discard ✓
- Tap never lost (memory-first, persist after) → Task 3 `applyAndEvaluate` updates state then persists ✓
- Reuse Pre/Post session sheets + InterventionSheet → Task 4 ✓
- Cooldown reuse via `startCooldown` → Task 4 `onCoolOff` ✓
- Analytics: `session_started`, `intervention_fired` w/ `source`, `session_ended` → Task 1 + Task 4 ✓
- Founder-first gate, no flag system built → Task 5 `isFounder` ✓
- Pro-open for sprint (no isPro check on entry) → Task 5 mount has no isPro ✓
- Tests for pure module, hook edge-transition, component → Tasks 2/3/4 ✓

**Known follow-ups (out of scope, per spec non-goals):** session_ended `interventions` count is stubbed `0` (PostHog already counts `intervention_fired` separately); phase-2 gate flip (`isFounder` → all-beta) is a one-line change; emotion-tag, broker sync, promote-to-draft all explicitly cut.

**Type consistency:** `ActiveSession`/`SessionTap` identical across Tasks 2–4; `source: "log"|"session"` identical in Tasks 1 & 4; hook API (`start/tapWin/tapLoss/continueTrading/coolOff/checkMe/end`) matches SessionCard usage; `DebriefSummary` shape matches the real component prop.
