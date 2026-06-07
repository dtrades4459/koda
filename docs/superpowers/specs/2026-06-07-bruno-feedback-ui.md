# Kōda — Bruno Feedback UI Changes
**Date:** 2026-06-07  
**Scope:** 4 UI changes from beta feedback session with Bruno

---

## 1. Equity Curve — Dollar Display

**Current state:** `PnLChart` in `src/charts.tsx` always renders cumulative R P&L. Displayed on the home screen at 320×96px.

**Change:** Keep size unchanged. When at least one trade in the dataset has a non-zero dollar `pnl` value, render the chart using cumulative dollar P&L instead of R. If no dollar data exists, fall back to R (current behaviour). The Y-axis label and tooltip values update accordingly (`+$1,240` vs `+3.2R`).

**Why:** Users who manually enter dollar P&L can see their actual equity curve. No broker connection required — works with existing trade data.

**Files:** `src/charts.tsx` (PnLChart component), `src/Koda.tsx` (call site passing trades).

---

## 2. Calendar — FFF Prop Firm Style + Default Stats View

**Current state:** `CalendarView` in `src/charts.tsx` renders a compact grid with small cells and single-letter day headers. Lives under Stats → calendar sub-tab. Default stats tab is "performance".

### Visual changes to CalendarView

**Stat strip** (above the month grid):
- 4 tiles in a row: Days Traded / Win Days / Loss Days / Month P&L
- Win Days tile: green tint. Loss Days tile: red tint. Month P&L: green/red based on sign.
- Calculated from the currently displayed month's trades.

**Day cells** (larger, more data-forward):
- Height increases from current compact size to ~56px
- Each traded day shows: dollar P&L (large, coloured) + trade count (small, muted)
- Win days: dark green background tint + subtle green border
- Loss days: dark red background tint + subtle red border
- No-trade days: flat dark background, dimmed day number
- Today: brighter border highlight + "TODAY" micro-label above the P&L value
- Weekends (Sat/Sun): slightly darker background, dimmed headers

**Day headers:** Full abbreviations — MON TUE WED THU FRI SAT SUN (replacing M T W T F S S)

**Dollar vs R toggle:** Keep existing toggle, but default to dollar if dollar data exists.

**Default stats view:** Change the initial value of `statsTab` in `Koda.tsx` from `"performance"` to `"calendar"`.

**Files:** `src/charts.tsx` (CalendarView), `src/Koda.tsx` (statsTab default value + CalendarView call site).

---

## 3. Session Performance — Reduce Spacing

**Current state:** The SESSION PERFORMANCE section in the home analytics view (`homeSection === "analytics"` in `Koda.tsx`) renders each session row with excessive vertical padding, making the section take up disproportionate space.

**Change:** Reduce row padding from current values to compact equivalents matching the density of other analytics rows. Target: each session row ~32px tall. No functional change.

**Files:** `src/Koda.tsx` (inline styles on session performance rows, around lines 2765–2779).

---

## 4. Rules & Checklist — Side by Side with Daily Checklist

**Current state:** `homeSection === "rules"` in `Koda.tsx` renders a single-column numbered rules list with inline editing.

### Layout change

Split the rules section into a two-panel horizontal layout:
- **Left panel (Rules):** Existing rules list — numbered, editable, strategy-filtered. No functional change.
- **Right panel (Pre-session Checklist):** New feature — see below.

Both panels sit under the existing strategy selector. On desktop (`isDesktop === true`) they render side by side. On mobile they stack vertically — Rules first, Checklist below.

### New: Pre-session Checklist

A daily tick-off checklist separate from the rules list.

**Data model:**
- `checklistItems`: `{id: number, text: string}[]` — user-defined items, persisted in `user_kv` under key `checklist_items` (same pattern as rules).
- `checklistTicks`: `Set<number>` — which item IDs are ticked today. Persisted in `user_kv` under key `checklist_ticks_{YYYY-MM-DD}`. Resets automatically each calendar day (a new date key means a fresh set).

**Behaviour:**
- Tapping a checklist item toggles its ticked state.
- Ticked items show a green checkmark and strikethrough text.
- Items can be added and deleted (same UX pattern as rules).
- No "edit" on checklist items — just add/delete to keep it simple.
- Daily reset is automatic: if the stored date key doesn't match today, ticks start empty.

**Files:** `src/Koda.tsx` (rules section JSX, state, persistence logic). No new files needed — stays inline with existing pattern.

---

## Out of Scope (This PR)

- **P&L by Setup wrong info** — parked pending Bruno's clarification on what's incorrect.
- **Equity curve account size** — dollar display above covers this; full account-balance curve deferred until broker sync is live.
- **Sync/Log manual entry** — explicitly dropped by Dylon.

---

## Testing Checklist

- [ ] Equity curve shows `$` values when trades have dollar P&L; shows `R` when they don't
- [ ] Calendar opens by default when navigating to Stats
- [ ] Calendar stat strip shows correct monthly counts
- [ ] Day cells show dollar P&L + trade count; today is highlighted
- [ ] Session performance rows are visually compact
- [ ] Rules panel still works (add, edit, delete, strategy filter)
- [ ] Checklist panel appears next to rules
- [ ] Checklist items persist across reloads
- [ ] Checklist ticks reset when the date changes
- [ ] Mobile layout doesn't break (panels stack vertically on small screens)
