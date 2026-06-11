# Competition Eligibility & Screenshot Enforcement — Design

**Date:** 2026-06-11
**Context:** The 50K Eval Challenge launches Mon 2026-06-15. The published rules
(`public/competition-rules.html`) commit to two eligibility requirements the app
neither enforces nor surfaces: **minimum 10 trades** and **a screenshot attached
to every trade in the competition window (Jun 15 – Jul 15) — missing screenshots
disqualify the entry**. Without product support, entrants will be silently DQ'd
and Bruno (referee) has no triage signal.

**Decisions made with Dylon (2026-06-11):**
1. Scope = screenshot soft-warning at log time + eligibility visibility on the
   comp leaderboard. Referee coverage line is a stretch goal.
2. Enforcement = **soft warning** — entrants can always save; the warning makes
   the DQ rule impossible to miss.
3. Leaderboard = **self strip + row markers** — your own eligibility shown in
   full; other rows get a subtle INELIGIBLE tag only when published data proves
   ineligibility.

---

## 1. Architecture

All eligibility logic lives in `src/lib/competition.ts` as pure, unit-tested
helpers (no React, no DB) — same pattern as the existing comp helpers. Coverage
data travels on the existing self-published KV leaderboard entry
(`koda_circle_entry_50K-EVAL-2026_{member}`), exactly how every other metric is
shipped (see CLAUDE.md: leaderboard is KV; new metrics need no migration).

Trust model is unchanged: entries are self-reported, Bruno's manual
verification is the integrity backstop, and the rules already state Kōda's
decision is final. A tampered `shotsMissing` is no different from a tampered
P&L — out of scope.

## 2. New helpers — `src/lib/competition.ts`

```ts
export const COMP_MIN_TRADES = 10;

/** True when a trade's date (YYYY-MM-DD form value) falls inside the comp window. */
export function isInCompWindow(dateStr: string): boolean
// Date-only strings parse as UTC midnight: "2026-06-15" >= COMP_START_TS ✓,
// "2026-07-15" (00:00) < COMP_END_TS (23:59:59) ✓. Invalid/empty → false.

export interface CompEligibility {
  trades: number;        // trades dated inside the window
  missingShots: number;  // window trades with empty `screenshot`
  eligible: boolean;     // trades >= COMP_MIN_TRADES && missingShots === 0
}
export function compEligibility(
  trades: Array<{ date: string; screenshot: string }>
): CompEligibility
```

Unit tests in `src/lib/competition.test.ts` cover: window boundaries (Jun 14 /
Jun 15 / Jul 15 / Jul 16, empty/invalid date), counting, and the eligible flag
(9 vs 10 trades, 0 vs 1 missing shot).

## 3. Soft warning — `src/LogTradeScreen.tsx`

In the Screenshot section (the `{form.screenshot ? ... : ...}` block, ~line 398),
when **all** of: `isCompetitionJoined()` · `form.date` is set ·
`isInCompWindow(form.date)` · `form.screenshot` is empty — render an inline
notice under the upload button:

> ⚡ COMPETITION TRADE — A SCREENSHOT IS REQUIRED. ENTRIES MISSING ONE ARE DISQUALIFIED.

Mono small-caps, 10px, `C.live` accent (matches comp branding elsewhere; green/red
stay reserved for outcomes per DESIGN.md). Saving stays enabled — purely
informational. Applies to both new trades and edits (the edit path is how an
entrant repairs a missing screenshot). No state, no new props beyond the imports.

## 4. Publish coverage — `Koda.tsx` → `src/hooks/useCircles.ts`

`Koda.tsx` already computes `compCircleStats` from `trades` (~line 858) and
passes it into `useCircles` as `compStats`. Mirror that exactly:

- `Koda.tsx`: `const myCompEligibility = useMemo(() => compEligibility(trades), [trades])`,
  passed into `useCircles` as a new optional `compEligibility` param (held in a
  ref like `compStatsRef`) **and** down to `<TradingCircles>` as a prop for the
  self strip (§5).
- `useCircles.publishToCircle`: when publishing the comp circle, attach
  `shotsMissing: compEligibilityRef.current?.missingShots` to the entry JSON.
  `total` already carries the window trade count; no second field needed.
- While here: switch `compCircleStats`'s inline date filter to the new
  `isInCompWindow` helper so the window definition has one source of truth.

## 5. Leaderboard display — `src/TradingCircles.tsx` (comp circle only)

**Self strip** — rendered above the board for members. `TradingCircles` does
not receive raw trades, so it takes the precomputed `myCompEligibility` prop
from `Koda.tsx` (§4) — always fresh, independent of publish staleness. Copy,
mono small-caps, `C.muted`:
- Not yet eligible: `7/10 TRADES · 1 MISSING SCREENSHOT`
- Eligible: `ELIGIBLE · 12 TRADES · ALL SCREENSHOTS ATTACHED`

**Row markers** — on each non-staff row, show a small `INELIGIBLE` tag
(mono 8px, `C.muted`, bordered pill) when the published entry proves it:
`entry.total < COMP_MIN_TRADES || (entry.shotsMissing ?? 0) > 0`.
**Backwards compatibility rule:** entries published before this change lack
`shotsMissing` — `undefined` must never flag a row on its own; only `total`
(always present) can flag such rows for the min-trades half.

## 6. Stretch — referee coverage line

If time remains today: for staff viewers (`COMP_STAFF_UIDS` has own uid), each
row additionally shows `N trades · M missing shots` from the published entry,
giving Bruno a triage signal for who to spot-check. Pure render addition —
no new data. Skipped without consequence if time runs out (Bruno can review
manually via the circle).

## 7. Error handling

- `isInCompWindow`: invalid `Date.parse` → `false` (never warn on garbage dates).
- `compEligibility` on empty array → `{ trades: 0, missingShots: 0, eligible: false }`.
- Leaderboard rows with malformed/missing coverage fields render as today (no tag).
- localStorage access already try/caught in `isCompetitionJoined`.

## 8. Testing

- TDD per superpowers:test-driven-development.
- Unit: new helpers in `src/lib/competition.test.ts` (boundaries, counts, flag).
- Component: LogTradeScreen warning visibility (joined+window+no shot → shown;
  any condition false → hidden; save button unaffected) — follows the existing
  `CompetitionBanner.test.tsx` pattern with fake timers + localStorage.
- `publishToCircle` / leaderboard render verified via typecheck
  (`tsc -p tsconfig.app.json`) + manual browser pass, consistent with how the
  existing circle features are verified.

## 9. Out of scope

- Server-side/tamper-proof eligibility (waits for v2 trades read-flip, post-launch)
- Hard blocking saves
- Daily P&L screenshot upload (not in published rules)
- Public landing page
- Automatic DQ — Bruno/Dylon decide; the app only surfaces data
