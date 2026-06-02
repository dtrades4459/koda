# In-Session Intervention v1 — Design

**Status:** approved (Dylon, 2026-06-02)
**Sprint window:** Week 2 build, Week 3 polish (3-week plan, Beta launch sprint)
**Owner:** Dylon (solo build, AI-assisted)
**Stakeholder:** Dan (CMO, launch content), Bruno (COO, compliance)

---

## 1 · Summary

A mid-session circuit breaker that intercepts the **Log Trade** action when the user is showing signs of tilt — consecutive losses, daily-loss approach, revenge-window, tilt-emotion on the prior trade. The intervention surfaces as a bottom sheet (mobile) or centred modal (desktop) listing the active signals. The user either continues (record event, tag next trade) or cancels into a user-configurable cooldown lockout (default 15 min).

The feature is the wedge no rival in this space has — every competitor is a post-trade journal. Until a Kōda user can feel the app stop them mid-tilt, the product is undifferentiated.

---

## 2 · Goals & non-goals

### Goals (v1)
- Stop the next trade in **provably high-tilt states** without requiring live broker data.
- Make the intervention **demoable on a phone** in 3 weeks — single user logging trades manually.
- Generate **telemetry** that powers a Stats card and Dylon's launch content ("you ignored 7 of 10 warnings this week").
- **Lean on existing infra** — `calcDisciplineScore`, `EMOTION_TAGS`, `MISTAKE_TAGS`, `Profile.maxDailyLoss`, `Profile.maxTradesPerDay`, `user_kv`, push system. No new third-party services.

### Non-goals (v1)
- Live broker fill hooks (Tradovate dormant — credentials gated by cost).
- Push notifications outside the app ("we cooled you off, come back").
- Per-strategy intervention overrides.
- Social / Circles surfacing of intervention state.
- A/B test harness for tilt thresholds — constants in v1, iterate later.
- Prop-firm-specific signals (drawdown breach proximity) — phase 2.
- Trade-replay tie-in — parking lot.

---

## 3 · UX

### Trigger
The intervention only intercepts the **Log Trade** entry point (top-level nav tab + any inline "Log" CTA). It does not fire on edits, CSV imports, or broker auto-syncs (when they exist).

### Surface — mobile (bottom sheet)
- Slides up from bottom over a dimmed Log Trade form
- Sheet handle, then mono kicker "⚠ HEADS UP" in `C.live` (mint/cyan)
- Title: "**N tilt signals are active.**" (N = count of active signals)
- Signal list — one row per active signal, red dot + plain-English label
- Primary CTA: `I'm aware — continue` (mint pill)
- Secondary CTA: `Cancel · take a break` (ghost pill)
- Reuses the existing `kRise` keyframe animation pattern (Leave-circle sheet)

### Surface — desktop (centred modal)
- Backdrop dim (rgba(0,0,0,0.62) with 2px blur)
- 380px modal, panel background, 18px border-radius, 1px border2
- Subtle 200ms rise+scale animation
- Cyan-pulse glow dot next to kicker
- Same content and buttons; horizontal button-row (1.5:1 ratio)

### Cooldown pill (when locked)
- Replaces the Log Trade button entirely
- Visual: cyan-pulse ring border, mono text **`COOLING OFF · 12:34`**
- Tap → toast: "Locked for cooling-off — 12:34 remaining. Adjust in Settings."
- Bottom-nav badge: small cyan dot on Home tab while locked (so it's visible from any tab)
- Auto-reverts to normal Log Trade button when countdown hits 00:00

### Settings entry — new "Discipline" section
Between Profile and Export in SettingsScreen.
```
DISCIPLINE
☑ In-session intervention            [ ON  ]
  Cooldown when cancelled:
    ○ Off    ○ 5 min   ● 15 min   ○ 30 min
```

### Stats insight — new card on Stats tab
Place near the existing Discipline Score card.
```
IN-SESSION CHECK-INS · LAST 7d
─────────────────────────────────
3 fired   1 continued   2 cancelled
Post-intervention win rate: 0%
```
Post-intervention win rate is computed from trades tagged with the linked intervention event id. If `continued` count = 0, the card hides the win-rate line.

---

## 4 · Tilt evaluator — signal definitions

Pure function `evaluateTilt(trades, profile, now): TiltState`.

A signal is `active` when its condition holds for **today's trades** (calendar-day in user's local timezone).

| Signal id | Plain label | Condition | Critical? |
|---|---|---|---|
| `consec_losses` | "N consecutive losses" | ≥ 2 most recent today's trades have `outcome === "Loss"`. N = run length. | no |
| `daily_loss_75` | "−N% of daily loss limit" | `profile.maxDailyLoss` is set AND today's net P&L ≤ −75% of it. N = current %. | no |
| `daily_loss_90` | "−N% of daily loss limit" | Same as above but threshold ≥ 90%. | **yes** |
| `trade_cap_at` | "Daily trade cap reached" | `profile.maxTradesPerDay` is set AND today's trade count ≥ cap. | **yes** |
| `revenge_window` | "Within 10 min of a loss" | The most recent today's trade has `outcome === "Loss"` AND its `exitTime` (fallback `entryTime`) is within 10 minutes of `now`. | no |
| `tilt_emotion` | "Last trade tagged X" | The most recent today's trade contains any of: `fomo`, `revenge`, `chased`, `movedsl`, `overtrading` in `emotions`. X = first match. | no |

### Firing rule
The intervention fires when **any 1 critical signal is active** OR **≥ 2 non-critical signals are active**. The active signal list passed to the sheet/modal includes all currently-active signals (not just the ones that caused the firing).

### TiltState type
```ts
export type TiltSignalId =
  | "consec_losses"
  | "daily_loss_75" | "daily_loss_90"
  | "trade_cap_at"
  | "revenge_window"
  | "tilt_emotion";

export interface TiltSignal {
  id: TiltSignalId;
  label: string;       // plain-English, with interpolated value
  critical: boolean;
}

export interface TiltState {
  active: boolean;     // true if firing rule is satisfied
  critical: boolean;   // true if any signal is critical
  signals: TiltSignal[];
  evaluatedAt: number; // Date.now() at evaluation
}
```

---

## 5 · Architecture

Four files. No code lives in `Koda.tsx`.

```
src/lib/tilt.ts                       — pure evaluator + types (no React, no DB)
src/hooks/useTiltState.ts             — useMemo wrapper + cooldown read
src/components/InterventionGate.tsx   — guard around Log Trade button
src/components/InterventionSheet.tsx  — surface (mobile sheet + desktop modal)
src/data/interventions.ts             — RLS-safe CRUD against public.intervention_events
```

### Interfaces

**`tilt.ts`** — exports `evaluateTilt`, `TiltState`, `TiltSignal`, `TiltSignalId`. No imports from `react` or `supabase`. Depends only on `Trade`, `Profile` types from `./types`.

**`useTiltState.ts`** — hook signature:
```ts
useTiltState({ trades, profile }): {
  state: TiltState;
  lockedUntil: number | null;      // epoch ms, or null
  settings: { enabled: boolean; cooldownMin: 0|5|15|30 };
  startCooldown(): Promise<void>;
  clearCooldown(): Promise<void>;
}
```
Reads `koda_intervention_lockout` from `user_kv` via existing `storage.get`. Memoised over `trades.length`, `trades[last].id`, `profile.maxDailyLoss`, `profile.maxTradesPerDay`, `profile.prefs?.intervention?.*`.

**`InterventionGate.tsx`** — replaces the existing Log Trade JSX in `Koda.tsx`. Props: `{ children, onProceed, tiltState, lockedUntil, settings, onCancel }`. Renders one of: cooldown pill (lockedUntil > now), trigger child wrapped in a tap-intercept (state.active), or the trigger child as-is.

**`InterventionSheet.tsx`** — presentational. Props: `{ open, signals, onContinue, onCancel, isMobile }`. Backdrop tap calls the same `onCancel` as the explicit Cancel button — no silent-dismiss escape hatch. No DB calls inside. Reuses existing `MONO`, `BODY`, theme colors from `./shared` / `./theme`.

**`data/interventions.ts`** — exports `logInterventionEvent(args)`, `linkTradeToIntervention(tradeId, eventId)`, `getLastInterventionEventForLink()`, `getInterventionStatsForRange(days)`. Same patterns as `data/ideas.ts`.

### Wiring in Koda.tsx
Single surgical change: wrap the existing Log Trade nav handler in `InterventionGate`. Goal: minimal diff against the already-bloated file. No business logic added inside `Koda.tsx`.

---

## 6 · Data model

### New table: `public.intervention_events`
```sql
create table public.intervention_events (
  id            uuid primary key default gen_random_uuid(),
  user_uid      uuid not null references auth.users(id) on delete cascade,
  fired_at      timestamptz not null default now(),
  signals       jsonb not null,        -- array of TiltSignalId strings
  critical      boolean not null default false,
  choice        text not null check (choice in ('continued','cancelled')),
  trade_id      uuid null,             -- linked to public.trades.id if user continued and saved a new trade within 10 min of fired_at
  session_date  date not null          -- denormalised for fast stats queries
);

create index intervention_events_user_fired_idx
  on public.intervention_events (user_uid, fired_at desc);
create index intervention_events_session_idx
  on public.intervention_events (user_uid, session_date);

alter table public.intervention_events enable row level security;

create policy "Users read own events"
  on public.intervention_events for select
  using (auth.uid() = user_uid);

create policy "Users insert own events"
  on public.intervention_events for insert
  with check (auth.uid() = user_uid);

create policy "Users update own events"
  on public.intervention_events for update
  using (auth.uid() = user_uid);
```

**Migration filename:** `supabase/migrations/20260603_intervention_events.sql`

### user_kv (existing table, new key)
`koda_intervention_lockout` → `{ until: <ISO timestamp>, signals: [TiltSignalId, ...] }`. Cleared when timer expires (lazy: read-time check vs `Date.now()`; explicit delete on `clearCooldown`). Ephemeral — never read on a fresh device, the user just gets the next intervention if signals are still active.

### Profile prefs (no migration — uses existing `prefs` jsonb)
```ts
profile.prefs?.intervention?.enabled       // default true
profile.prefs?.intervention?.cooldownMin   // default 15
```

---

## 7 · State machine

```
                 [user taps Log Trade]
                          │
                          ▼
              ┌──────────────────────────┐
              │ read lockedUntil         │
              │ from user_kv             │
              └──────────────────────────┘
                          │
                ┌─────────┴──────────┐
            now < lockedUntil    now ≥ lockedUntil
                │                     │
                ▼                     ▼
      render cooldown pill     evaluateTilt(trades, profile)
      tap → toast "locked"             │
                              ┌────────┴────────┐
                          active=false       active=true
                              │                 │
                              ▼                 ▼
                         open Log         show InterventionSheet
                         Trade form              │
                                        ┌────────┴────────┐
                                  Continue              Cancel
                                  (button)              (button OR backdrop tap)
                                        │                  │
                                        ▼                  ▼
                                  insert evt           insert evt
                                  choice=              choice=
                                  'continued'          'cancelled'
                                        │                  │
                                        │                  ▼
                                        │              write user_kv:
                                        │              lockout = now +
                                        │              cooldownMin*60_000
                                        │              (skip if cooldownMin=0)
                                        ▼
                                   open Log Trade form
                                        │
                                        ▼
                              [user saves trade]
                                        │
                                        ▼
                              find newest intervention event for this user
                              with trade_id IS NULL AND
                              (now - fired_at) ≤ 10 min;
                              if found, set its trade_id = new trade's id
```

---

## 8 · Telemetry / events

- **PostHog**: emit `intervention_fired` (props: `signals`, `critical`, `choice`) on every event insert. Use existing `src/lib/posthog.ts`.
- **Sentry**: any error in `evaluateTilt` or storage write goes through `log.error` (now repaired to extract real messages per commit `f8f74bb`).
- **Stats card** queries `intervention_events` for `user_uid + fired_at >= now - 7d`.

---

## 9 · Paywall / feature flagging

- **During beta** (current state, `isFlagOn("paywall") === false`): every signed-in user has `isPro === true`, intervention fires for everyone, gives Dylon real-world signal on threshold tuning.
- **Post-paywall flip**: `InterventionGate` checks `isPro`. Free users get the normal Log flow with no interception. Settings entry shows a `PRO` badge for `plan === "free"`; tap opens existing `UpgradeModal`.
- **No new feature flag** — relies entirely on existing `isPro` and `paywall` mechanisms. One less knob to forget.

---

## 10 · Testing strategy

| Layer | Tool | Coverage |
|---|---|---|
| `evaluateTilt` | Vitest property tests | Each signal in isolation; firing-rule truth table; tz edge cases (midnight boundary); empty `trades` array |
| `useTiltState` cooldown logic | Vitest with mocked `Date.now()` | Lockout active / expired / about-to-expire; settings disabled bypasses everything |
| `InterventionSheet` | React Testing Library | Renders signal list; calls right handler per button; respects `isMobile` for layout |
| `data/interventions.ts` | Vitest with mocked supabase | RLS happy/sad paths; link-trade-to-event correctness |
| End-to-end | Playwright | Log 2 losing trades, tap Log Trade, expect sheet, tap Cancel, expect cooldown pill |

Target: ≥ 90% line coverage on `tilt.ts` (pure function, easy to test exhaustively). All tests pass `npm test` (current baseline: 272/272 passing).

---

## 11 · Out of scope (parking lot)

- Live broker fill triggers (waiting on Tradovate credentials budget)
- Push notification: "your cooldown is over, you can trade again"
- Customisable signal thresholds in Settings (constants in v1)
- Custom message per signal type ("Hey, you've moved your stop 3 times today" etc.)
- Coach feature integration (coach itself not designed)
- Intervention firing on CSV imports / broker auto-syncs (out of scope while broker is dormant)
- "You vs your past self" comparison in the Stats card
- Sharing intervention stats in Circles

---

## 12 · Demo plan (Week 3)

Dylon records a phone-screen capture:

1. Open Kōda, log a winning trade (no intervention)
2. Log a losing trade (no intervention)
3. Log a second losing trade tagged "revenge" (now 2 of 5 signals)
4. Tap Log Trade — **sheet rises** — pause for camera
5. Tap **Cancel · take a break** — cooldown pill appears
6. Show bottom-nav cyan dot — switch to Stats tab — show new check-ins card

Voiceover hook: *"This is the only journal that stops you from taking the trade. Every other tool waits till you've already lost the money."*

Three takes, best one becomes the launch content. Dan co-edits.

---

## 13 · Definition of done (v1)

- [ ] `src/lib/tilt.ts` lands with TiltState type + evaluateTilt + 90%+ coverage
- [ ] `src/hooks/useTiltState.ts` lands with cooldown read/write
- [ ] `src/components/InterventionGate.tsx` + `InterventionSheet.tsx` land
- [ ] `src/data/interventions.ts` lands with full CRUD + tests
- [ ] Migration `20260603_intervention_events.sql` applied in Supabase
- [ ] Profile prefs default reads work (no NPE on null `prefs`)
- [ ] Settings "Discipline" section visible and wired
- [ ] Stats "In-session check-ins · last 7d" card visible and wired
- [ ] PostHog event `intervention_fired` shows up in PostHog dashboard
- [ ] Playwright spec passes
- [ ] One real demo recording captured on Dylon's phone — feature works end-to-end against a real Supabase row
- [ ] `npm run typecheck`, `npm run build`, `npm test` all green
- [ ] No new `: any` annotations (per pre-commit hook in `.husky/pre-commit`)
- [ ] PR merged and deployed to prod (push to main = deploy)
- [ ] `NEXT_SESSION.md` updated; `CLAUDE.md` features list updated
