# Pre-Trade Intervention (Trading Session) — Design Spec

**Date:** 2026-06-16
**Status:** Approved — ready for implementation plan
**Sprint:** Garry's 30-day sprint, item #1 (move the intervention pre-trade). See `docs/investors/garry-naval-action-list.md`.

---

## Problem

Kōda's tilt circuit-breaker (`lib/tilt.ts` + `InterventionSheet`) only fires at the **logging moment** — `attemptLog()` evaluates trades *already in the journal*. A tilting trader is executing in their broker (Tradovate etc.) and does not stop to log between revenge trades, so the engine never sees the losses in time to interrupt the next trade. The entire investor thesis ("stops you *before* the trade, not after") is therefore not true in the product today.

## Goal

Make the intervention fire **before the next trade is placed**, using zero broker integration and zero Supabase migrations. This is a **wedge-proof sprint**, not a logging-pipeline rebuild: the success criterion is evidence that interrupting a tilting trader *before* a trade changes behavior.

**Day-30 verdict metric:** of pre-trade interventions that fired, the **% where the trader chose the cooldown instead of trading on**.

## Non-goals (explicit YAGNI cuts)

- No live broker sync / execution-loop integration.
- No writing session taps to `public.trades` (no CSV-dedup or leaderboard pollution).
- No "promote tally to draft trades" flow.
- No emotion-tag input in the tally (the `tilt_emotion` signal stays dormant in session mode).
- No cross-device live session sync beyond the existing storage shim.
- No new server endpoints. No Supabase migration.

---

## Solution overview

A **Trading Session** is an ephemeral, explicitly-armed container for "I'm trading right now." It holds a live tally of wins/losses (+ optional $), feeds the **existing** `evaluateTilt` engine via an adapter, and auto-opens the **existing** `InterventionSheet` the instant a tap crosses into active tilt — before the next trade.

### The live loop (mostly wiring existing parts)

```
[Start session] → PreSessionSheet (EXISTS)        confirm today's loss limit + max trades
       ↓
   session armed → SessionCard tally on Home (NEW)
       ↓
  after each trade: tap + Win / + Loss (+ optional $)   (NEW)
       ↓
  each tap → evaluateTilt(tapsToTrades(...), sessionProfile, now)   (EXISTS engine, unchanged)
       ↓
  if it JUST crossed inactive→active → InterventionSheet auto-opens   (EXISTS sheet)
       ↓
  Continue → logInterventionEvent(choice:"continued")
  Cool off → useTiltState.startCooldown() (EXISTS) + logInterventionEvent(choice:"cancelled")
       ↓
[End session] → PostSessionDebriefSheet (EXISTS)
```

---

## Architecture

### Reuse the tilt engine unchanged via an adapter

`evaluateTilt(trades, profile, now)` reads `outcome`, `pnlDollar`, `exitTime`/`entryTime`, `date`. Each tally tap maps to a minimal `Trade`-shaped object, so **`lib/tilt.ts` is not modified**:

```ts
// tap → Trade
{ date: todayLocal, outcome, pnlDollar: String(pnlDollar ?? 0), exitTime: at, entryTime: at, emotions: "" }
```

- Signals that fire from tally data: `consec_losses`, `trade_cap_at`, `revenge_window`, and — when `$` is entered — `daily_loss_75` / `daily_loss_90` (the *critical* ones).
- `tilt_emotion` cannot fire (no tag input) and is intentionally dormant in session mode.

### Data model — ephemeral, `user_kv` (no migration)

```ts
interface ActiveSession {
  startedAt: string;               // ISO
  maxDailyLoss: number | null;     // captured from PreSessionSheet at arm
  maxTradesPerDay: number | null;
  taps: SessionTap[];
}
interface SessionTap {
  outcome: "Win" | "Loss";
  pnlDollar: number | null;        // optional; unlocks the loss-limit signals
  at: string;                      // ISO timestamp (drives ordering + revenge_window)
}
```

- Stored under a single owned row `koda_active_session` via the existing storage shim (user_kv + localStorage cache) so it survives a mid-session PWA reload.
- **Stale-day guard:** on load, a session whose `startedAt` is not today is discarded — a crash cannot leave a user "armed" forever.
- Cleared on **End session**.

### New units (small, isolated, testable)

| Unit | Responsibility | Depends on |
|---|---|---|
| `lib/session.ts` | pure: `addTap`, `endSession`, `isStale`, `tapsToTrades` adapter | nothing (pure) |
| `hooks/useTradingSession.ts` | persistence, live tilt eval, inactive→active edge detection, cooldown bridge | `storage`, `evaluateTilt`, `useTiltState` |
| `components/SessionCard.tsx` | Home card: idle/armed states, tally buttons, status chip | theme, the hook |

---

## UI

`SessionCard` mounts at the top of Home.

**Idle:** a single **Start session** button (no clutter; no last-session summary for v1).

**Armed (hero card):**
- Live tally: **W / L** counts, **net $** (when entered), current **streak**.
- Big **+ Win** / **+ Loss** buttons; **+ Loss** reveals a fast optional `$` field.
- Status chip: `In control ✓` / `Warning — N losses` / `Cooling off · MM:SS`.
- **Check me** (manual eval — opens the sheet if active, else a brief "you're in control" confirm).
- **End session**.

**Auto-fire:** on the tap that crosses inactive→active, `InterventionSheet` opens over the card. Reuses the sheet + `useTiltState` cooldown verbatim.

**Edges reused:** Start → `PreSessionSheet`. End → `PostSessionDebriefSheet`.

### Gating

- **Feature flag (solo-first):** a single gate constant `SESSION_PILOT_UIDS`. Phase 1 = founder uid only (dogfood). Phase 2 = all beta (flip the gate to `true`). No flag *system* is built — there is no `useFlags` in the repo despite the README mention.
- **Pro gating:** open to all beta users for the sprint (no `isPro` check on the session entry). Post-sprint decision whether the session becomes Pro.

---

## Analytics (the wedge proof — no DB change)

Reuse `logInterventionEvent` as-is (it already inserts an RLS-scoped `intervention_events` row and captures the PostHog `intervention_fired` event). Add a **`source` property** to the PostHog capture to distinguish pre-trade fires — a PostHog property, **not** a schema column.

| Event | Where | Carries |
|---|---|---|
| `session_started` | PostHog | maxDailyLoss, maxTradesPerDay |
| `intervention_fired` | existing `logInterventionEvent` + new `source: "session"` prop | signals, critical, choice |
| `session_ended` | PostHog | tap count, net result, # interventions fired |

`choice` reuses the existing enum: **`cancelled` = chose the cooldown (stopped)**, **`continued` = traded on**. Day-30 verdict = `% cancelled` among `intervention_fired` where `source = "session"`, read in PostHog.

> Implementation note: `logInterventionEvent` currently captures a fixed PostHog payload. Extend its args with an optional `source?: "log" | "session"` (default `"log"`) and pass it through to `phCapture` only. The DB insert row is unchanged.

---

## Error handling

- **A tap must never be lost:** update in-memory session state first, then persist to `user_kv`. A write failure shows a toast but keeps the tally; tilt eval runs off in-memory state.
- **Stale session:** discarded on load via the date guard.
- `logInterventionEvent` already fails soft (returns `null`; PostHog optional).

---

## Testing

- `lib/session.ts` (pure): `addTap` appends in order; `endSession` clears; `isStale` true for a prior-day session; `tapsToTrades` produces correctly-shaped, time-ordered trades — unit tests.
- `useTradingSession`: **edge-transition auto-fire** — inactive→active fires once; staying active does not re-fire; an active cooldown suppresses the fire — hook tests.
- `SessionCard`: a tap updates the tally; a `+ Loss` that crosses the threshold opens the sheet; **End** opens the debrief — component tests.
- `evaluateTilt` is untouched; its existing suite continues to guard the signal logic.

---

## Rollout

1. Land behind `SESSION_PILOT_UIDS = [founder uid]`. Dogfood 2–3 NY sessions solo.
2. Flip the gate to all beta (25 users). Watch the PostHog `% cancelled (source=session)` at day 7 and day 21.
3. Day-30 verdict per the action list: meaningful cool-off rate + ≥1 genuine "the lock stopped me" → wedge works.
