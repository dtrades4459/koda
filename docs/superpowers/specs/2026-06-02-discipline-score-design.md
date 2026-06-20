# Discipline Score System — Design Spec

**Date:** 2026-06-02  
**Status:** Approved  
**Author:** Dylon Nyland

---

## Overview

A rolling 7-day discipline score (0–100) with a letter grade (A+–F) that gives traders a clear, motivating signal about how well they're following their own rules — independent of P&L. Tagline: *"Graded on your rules — not your P&L."*

**Primary goal:** Motivation / gamification — reward consistent behaviour and give traders a number they want to improve.  
**Secondary:** Lightweight insight into which discipline signal is dragging the score.

---

## Signals & Scoring Formula

Four signals combine into a composite 0–100 score over a rolling 7-day window.

| Signal | Max pts | Source |
|---|---|---|
| Rule Adherence | 40 | `trade.ruleAdherence` (already logged per trade) |
| Trade Limit | 25 | Days within `profile.maxTradesPerDay` |
| Loss Limit | 25 | Days that respected `profile.maxDailyLoss` |
| Mistake Awareness | 10 | Of rule breaks, % where `trade.mistake` was tagged |

### Signal calculations

**Rule Adherence (40 pts)**  
`(trades where ruleAdherence === true) / (trades where ruleAdherence !== null)` × 40  
Only trades tagged with a non-null `ruleAdherence` count.

**Trade Limit (25 pts)**  
`(trading days where trade count ≤ maxTradesPerDay) / (days with ≥1 trade in window)` × 25  
"Trading days" = calendar days with at least one logged trade. Days with no trades are excluded — they can't breach a limit.  
Skipped entirely if `profile.maxTradesPerDay` is unset or falsy.

**Loss Limit (25 pts)**  
`(trading days where daily dollar PnL ≥ −maxDailyLoss) / (days with ≥1 trade in window)` × 25  
Same definition of "trading days" as above.  
Skipped entirely if `profile.maxDailyLoss` is unset or falsy.

**Mistake Awareness (10 pts)**  
`(rule-breaking trades with a non-null mistake tag) / (trades where ruleAdherence === false)` × 10  
If there are zero rule-breaking trades in the window, award full 10 pts.

### Weight redistribution

If Trade Limit or Loss Limit is skipped (unset in profile), their weight redistributes proportionally across the remaining signals. E.g. if both are unset: Rule Adherence → 80 pts, Awareness → 20 pts.

### Grade thresholds

| Grade | Score |
|---|---|
| A+ | 95–100 |
| A | 85–94 |
| B | 70–84 |
| C | 55–69 |
| D | 40–54 |
| F | 0–39 |

### Minimum data threshold

A score is only shown when ≥ 3 trades have `ruleAdherence !== null` within the 7-day window. Below this threshold, both the Home card and Discipline tab show an empty state: *"Tag rule adherence on 3+ trades this week to unlock your score."*

---

## Data Model

### `DisciplineScore` (computed, not persisted)

```ts
interface DisciplineScore {
  score: number;           // 0–100, rounded to nearest integer
  grade: string;           // "A+" | "A" | "B" | "C" | "D" | "F"
  breakdown: {
    rules:     { earned: number; max: number };
    tradeLimit: { earned: number; max: number } | null; // null if signal skipped
    lossLimit:  { earned: number; max: number } | null;
    awareness:  { earned: number; max: number };
  };
  dragSignal: "rules" | "tradeLimit" | "lossLimit" | "awareness" | null; // lowest-scoring signal
  window: { start: string; end: string };  // YYYY-MM-DD
  taggedCount: number;     // trades with non-null ruleAdherence in window
}
```

### `DisciplineLogEntry` (persisted in `user_kv`)

```ts
interface DisciplineLogEntry {
  date: string;   // YYYY-MM-DD — the day this snapshot was taken
  score: number;
  grade: string;
}
```

Stored at key `koda_discipline_log` as `DisciplineLogEntry[]`, max 30 entries (FIFO — oldest dropped when full). Written once per calendar day on app load, only if a valid score can be computed.

---

## Pure Calculation Function

New export in `src/lib/stats.ts`:

```ts
export function calcDisciplineScore(
  trades: Pick<Trade, "date" | "pnl" | "pnlDollar" | "ruleAdherence" | "mistake">[],
  profile: Pick<Profile, "maxTradesPerDay" | "maxDailyLoss">,
  windowStart?: Date,   // defaults to 7 days ago (rolling)
): DisciplineScore | null   // null = not enough data
```

This is a pure function with no side effects — safe to unit test in isolation. The KV snapshot write happens in the app shell (`Koda.tsx`), not inside this function.

---

## UI — Where It Lives

### 1. Home Tab — Compact Card (all users, free)

Replaces the existing "Discipline · This month" card.

- **Ring** — SVG circular progress showing score/100, coloured by grade (green A+/A, accent B, warn C, red D/F)
- **Headline** — "Rules followed on X% of trades — grade B this week."
- **Signal pills** — four small pills: Rules ✓/✗, Trades ✓/✗, Loss limit ✓/✗, Awareness N/M. Coloured green/amber/red by performance.
- **Desktop layout** — ring floats right, info expands left (wider panel).
- **Empty state** — ring shown empty with `—` inside, prompt to tag rule adherence.

### 2. Stats Tab → Discipline Sub-nav (all users, free)

New 9th entry in `STATS_SECTIONS`: `{ id: "discipline", label: "Discipline" }`.

Sections in order:
1. **Score hero** — large score + grade + progress bar + trade count label
2. **"Dragging your score" callout** — red-tinted card identifying the worst-performing signal and its cost in points. Hidden if all signals are performing well (>72% of their max).
3. **Signal Breakdown** — four rows, each with name, description, blue bar, and colour-coded earned/max number (red < 45%, amber 45–72%, green > 72%)
4. **7-day trend** — sparkline of daily score snapshots from `koda_discipline_log`, with area fill and today's dot highlighted. Shows delta vs the average of the 7 entries preceding the current 7 ("+ 12 vs last week"). Hidden if log has < 2 entries.

**No Pro gate** — the full Discipline tab is available to all users. A Pro gate may be introduced in a future release via feature flag.

### 3. Psychology Tab

The existing "RULE ADHERENCE" section and "MISTAKE FREQUENCY" section remain in the Psychology tab unchanged. The Discipline tab is additive — it does not remove content from Psychology.

---

## Implementation Plan (files to touch)

| File | Change |
|---|---|
| `src/lib/stats.ts` | Add `calcDisciplineScore()`, `DisciplineScore` type, `DisciplineLogEntry` type |
| `src/Koda.tsx` | (1) Replace Home discipline card. (2) Add `"discipline"` to `STATS_SECTIONS`. (3) Add `statsTab === "discipline"` render block. (4) Add KV snapshot write on app load. |
| `src/types.ts` | Export `DisciplineScore`, `DisciplineLogEntry` interfaces (or keep in stats.ts — decide at implementation) |
| `src/lib/stats.test.ts` | Unit tests for `calcDisciplineScore` — empty state, weight redistribution, grade thresholds, awareness edge cases |

No new Supabase tables. No migrations. No API changes.

---

## Edge Cases

| Case | Behaviour |
|---|---|
| No trades in 7-day window | Score hidden (null) |
| < 3 tagged trades | Score hidden, empty state shown |
| `maxTradesPerDay` unset | Trade Limit signal skipped, weight redistributed |
| `maxDailyLoss` unset | Loss Limit signal skipped, weight redistributed |
| Both limit signals unset | Score computed from Rule Adherence (80%) + Awareness (20%) only |
| Zero rule-breaking trades | Awareness = full 10 pts |
| Score tied between drag signals | Pick the one with the highest max pts (most impactful) |
| KV log full (30 entries) | Drop oldest entry before appending new one |
| Same calendar day, app reloaded | Skip KV write — already written today (check last entry date) |

---

## Out of Scope (this release)

- Public profile discipline score display
- Circle discipline leaderboard
- Pro gate on Discipline tab (future)
- Server-side score persistence (`discipline_scores` table — v2)
- Push notification when score drops below a threshold
