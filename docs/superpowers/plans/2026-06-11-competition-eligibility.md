# Competition Eligibility & Screenshot Enforcement Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Surface and soft-enforce the 50K Eval Challenge eligibility rules (min 10 trades, screenshot on every comp-window trade) before the Mon 2026-06-15 launch.

**Architecture:** Pure helpers in `src/lib/competition.ts` own all eligibility logic. A new `CompShotWarning` presentational component renders the log-form warning. Eligibility data is computed once in `Koda.tsx` and flows two ways: into `useCircles` (published as `shotsMissing` on the KV leaderboard entry) and into `TradingCircles` (self strip). Row markers read published entry data. No migrations.

**Tech Stack:** React 19, TypeScript, Vitest + React Testing Library, Supabase shared_kv, inline styles per DESIGN.md.

**Spec:** `docs/superpowers/specs/2026-06-11-competition-eligibility-design.md`

---

## File Map

| File | Action | Responsibility |
|------|--------|----------------|
| `src/lib/competition.ts` | Modify | Add `COMP_MIN_TRADES`, `isInCompWindow`, `CompEligibility`, `compEligibility` |
| `src/lib/competition.test.ts` | Modify | Unit tests for the new helpers |
| `src/components/CompShotWarning.tsx` | Create | Log-form soft warning (presentational) |
| `src/components/CompShotWarning.test.tsx` | Create | Visibility tests |
| `src/LogTradeScreen.tsx` | Modify | Render warning in the Screenshot card |
| `src/Koda.tsx` | Modify | `myCompEligibility` memo, window-filter cleanup, thread props |
| `src/hooks/useCircles.ts` | Modify | Accept eligibility, publish `shotsMissing`, extend `LeaderboardEntry` |
| `src/TradingCircles.tsx` | Modify | Self strip, INELIGIBLE row markers, referee coverage line (stretch) |

Verification quirk (from project memory): `npm run typecheck` can silently pass — always use `npx tsc -p tsconfig.app.json --noEmit` directly.

---

## Task 1: Eligibility helpers in `src/lib/competition.ts`

**Files:**
- Modify: `src/lib/competition.ts`
- Test: `src/lib/competition.test.ts`

- [ ] **Step 1.1: Write the failing tests**

In `src/lib/competition.test.ts`, extend the import block (lines 2–7) to:

```ts
import {
  COMP_CIRCLE_CODE, COMP_END_TS, COMP_START_TS, COMP_JOINED_KEY, COMP_MIN_TRADES,
  isCompetitionActive, isCompetitionStarted, isCompetitionJoined,
  markCompetitionJoined, compDaysRemaining, compDaysUntilStart,
  compStatusText, shouldShowCompetitionCard,
  isInCompWindow, compEligibility,
} from "./competition";
```

Append this describe block at the end of the file (after the closing `});` of `describe("competition helpers", ...)`):

```ts
describe("eligibility helpers", () => {
  describe("isInCompWindow", () => {
    it("is false the day before the window opens", () => {
      expect(isInCompWindow("2026-06-14")).toBe(false);
    });
    it("is true on the first day", () => {
      expect(isInCompWindow("2026-06-15")).toBe(true);
    });
    it("is true on the last day", () => {
      expect(isInCompWindow("2026-07-15")).toBe(true);
    });
    it("is false the day after the window closes", () => {
      expect(isInCompWindow("2026-07-16")).toBe(false);
    });
    it("is false for empty or garbage dates", () => {
      expect(isInCompWindow("")).toBe(false);
      expect(isInCompWindow("not-a-date")).toBe(false);
    });
  });

  describe("compEligibility", () => {
    const shot = (date: string) => ({ date, screenshot: "trade-screenshots/x.png" });
    const noShot = (date: string) => ({ date, screenshot: "" });

    it("returns zeros for an empty trade list", () => {
      expect(compEligibility([])).toEqual({ trades: 0, missingShots: 0, eligible: false });
    });

    it("ignores trades outside the window", () => {
      const r = compEligibility([shot("2026-06-01"), shot("2026-06-20"), noShot("2026-08-01")]);
      expect(r.trades).toBe(1);
      expect(r.missingShots).toBe(0);
    });

    it("counts missing screenshots inside the window", () => {
      const r = compEligibility([shot("2026-06-16"), noShot("2026-06-17"), noShot("2026-06-18")]);
      expect(r.missingShots).toBe(2);
      expect(r.eligible).toBe(false);
    });

    it("is not eligible at 9 window trades even with full coverage", () => {
      const r = compEligibility(Array.from({ length: 9 }, () => shot("2026-06-20")));
      expect(r.trades).toBe(9);
      expect(r.eligible).toBe(false);
    });

    it("is eligible at 10 window trades with full coverage", () => {
      const r = compEligibility(Array.from({ length: COMP_MIN_TRADES }, () => shot("2026-06-20")));
      expect(r.eligible).toBe(true);
    });

    it("is not eligible at 10 window trades with one missing shot", () => {
      const ts = [...Array.from({ length: 9 }, () => shot("2026-06-20")), noShot("2026-06-21")];
      expect(compEligibility(ts).eligible).toBe(false);
    });
  });
});
```

- [ ] **Step 1.2: Run tests — expect failure**

Run: `npx vitest run src/lib/competition.test.ts`
Expected: FAIL — `"isInCompWindow" is not exported`.

- [ ] **Step 1.3: Implement the helpers**

Append to `src/lib/competition.ts`:

```ts
// ── Eligibility (published rules: min 10 trades, screenshot on every window trade) ──

export const COMP_MIN_TRADES = 10;

/** True when a trade's date (YYYY-MM-DD form value) falls inside the comp window. */
export function isInCompWindow(dateStr: string): boolean {
  const t = Date.parse(dateStr);
  if (Number.isNaN(t)) return false;
  return t >= COMP_START_TS && t <= COMP_END_TS;
}

export interface CompEligibility {
  /** Trades dated inside the competition window. */
  trades: number;
  /** Window trades with no screenshot attached. */
  missingShots: number;
  eligible: boolean;
}

export function compEligibility(
  trades: Array<{ date: string; screenshot: string }>
): CompEligibility {
  const wt = trades.filter(t => isInCompWindow(t.date));
  const missingShots = wt.filter(t => !t.screenshot).length;
  return {
    trades: wt.length,
    missingShots,
    eligible: wt.length >= COMP_MIN_TRADES && missingShots === 0,
  };
}
```

- [ ] **Step 1.4: Run tests — expect pass**

Run: `npx vitest run src/lib/competition.test.ts`
Expected: PASS, 0 failed (existing + new tests).

- [ ] **Step 1.5: Commit**

```bash
git add src/lib/competition.ts src/lib/competition.test.ts
git commit -m "feat(competition): eligibility helpers — window check + min-trades/screenshot coverage"
```

---

## Task 2: `CompShotWarning` component + wire into `LogTradeScreen`

**Files:**
- Create: `src/components/CompShotWarning.tsx`
- Test: `src/components/CompShotWarning.test.tsx`
- Modify: `src/LogTradeScreen.tsx` (imports ~line 15, Screenshot card ~line 425)

- [ ] **Step 2.1: Write the failing tests**

```tsx
// src/components/CompShotWarning.test.tsx
import { describe, it, expect, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import { CompShotWarning } from "./CompShotWarning";
import { markCompetitionJoined } from "../lib/competition";
import { DARK } from "../theme";

const IN_WINDOW = "2026-06-20";
const OUT_WINDOW = "2026-06-01";

describe("CompShotWarning", () => {
  beforeEach(() => localStorage.clear());

  it("shows when joined + window date + no screenshot", () => {
    markCompetitionJoined();
    render(<CompShotWarning C={DARK} date={IN_WINDOW} hasScreenshot={false} />);
    expect(screen.getByText(/screenshot is required/i)).toBeInTheDocument();
  });

  it("hidden when not joined", () => {
    const { container } = render(<CompShotWarning C={DARK} date={IN_WINDOW} hasScreenshot={false} />);
    expect(container.firstChild).toBeNull();
  });

  it("hidden when trade date is outside the window", () => {
    markCompetitionJoined();
    const { container } = render(<CompShotWarning C={DARK} date={OUT_WINDOW} hasScreenshot={false} />);
    expect(container.firstChild).toBeNull();
  });

  it("hidden when a screenshot is attached", () => {
    markCompetitionJoined();
    const { container } = render(<CompShotWarning C={DARK} date={IN_WINDOW} hasScreenshot={true} />);
    expect(container.firstChild).toBeNull();
  });

  it("hidden when date is empty", () => {
    markCompetitionJoined();
    const { container } = render(<CompShotWarning C={DARK} date="" hasScreenshot={false} />);
    expect(container.firstChild).toBeNull();
  });
});
```

- [ ] **Step 2.2: Run tests — expect failure**

Run: `npx vitest run src/components/CompShotWarning.test.tsx`
Expected: FAIL — `Cannot find module './CompShotWarning'`.

- [ ] **Step 2.3: Create the component**

```tsx
// src/components/CompShotWarning.tsx
import { MONO } from "../shared";
import type { Theme } from "../theme";
import { isCompetitionJoined, isInCompWindow } from "../lib/competition";

export interface CompShotWarningProps {
  C: Theme;
  /** Trade date from the log form (YYYY-MM-DD, may be empty). */
  date: string;
  hasScreenshot: boolean;
}

/** Soft warning only — never blocks saving (decided 2026-06-11). */
export function CompShotWarning({ C, date, hasScreenshot }: CompShotWarningProps) {
  if (hasScreenshot || !date || !isCompetitionJoined() || !isInCompWindow(date)) return null;
  return (
    <div style={{
      fontFamily: MONO, fontSize: 10, color: C.live,
      letterSpacing: "0.1em", textTransform: "uppercase" as const,
      lineHeight: 1.6, marginTop: 10,
    }}>
      ⚡ Competition trade — a screenshot is required. Entries missing one are disqualified.
    </div>
  );
}
```

- [ ] **Step 2.4: Run tests — expect pass**

Run: `npx vitest run src/components/CompShotWarning.test.tsx`
Expected: 5 passed.

- [ ] **Step 2.5: Wire into `LogTradeScreen.tsx`**

Add to the imports (after line 15, `import { SignedImg } ...`):

```ts
import { CompShotWarning } from "./components/CompShotWarning";
```

In the Screenshot card, insert the warning between the `{form.screenshot ? (...) : (...)}` conditional's closing `)}` and the card's `</Card>` (currently lines 424–425):

```tsx
        )}
        <CompShotWarning C={T} date={form.date || ""} hasScreenshot={!!form.screenshot} />
      </Card>
```

(`T` is the `Theme`-cast of `C` already defined at line 70.)

- [ ] **Step 2.6: Typecheck**

Run: `npx tsc -p tsconfig.app.json --noEmit`
Expected: no errors.

- [ ] **Step 2.7: Commit**

```bash
git add src/components/CompShotWarning.tsx src/components/CompShotWarning.test.tsx src/LogTradeScreen.tsx
git commit -m "feat(competition): soft screenshot warning on comp-window trades in log form"
```

---

## Task 3: Compute eligibility in `Koda.tsx`, publish `shotsMissing` via `useCircles`

**Files:**
- Modify: `src/Koda.tsx` (import line 68, comp stats memo ~858, `useCircles` call ~909)
- Modify: `src/hooks/useCircles.ts` (`LeaderboardEntry` ~28, params ~96, refs ~135, `publishToCircle` ~527)

- [ ] **Step 3.1: Extend the `Koda.tsx` competition import (line 68)**

```ts
import { COMP_CIRCLE_CODE, COMP_START_TS, COMP_END_TS, markCompetitionJoined, compEligibility, isInCompWindow } from "./lib/competition";
```

(`COMP_START_TS`/`COMP_END_TS` stay — they're still used elsewhere in the file.)

- [ ] **Step 3.2: Switch the comp window filter to the shared helper**

In the `compCircleStats` memo (~line 859), replace:

```ts
    const wt = trades.filter(t => {
      const d = new Date(t.date).getTime();
      return d >= COMP_START_TS && d <= COMP_END_TS;
    });
```

with:

```ts
    const wt = trades.filter(t => isInCompWindow(t.date));
```

- [ ] **Step 3.3: Add the eligibility memo**

Immediately after the `compCircleStats` memo closes (`}, [trades]);` at ~line 895), add:

```ts
  // Eligibility per the published competition rules: min 10 window trades,
  // screenshot on every window trade. Self strip + published shotsMissing.
  const myCompEligibility = useMemo(() => compEligibility(trades), [trades]);
```

- [ ] **Step 3.4: Accept eligibility in `useCircles`**

In `src/hooks/useCircles.ts`:

(a) Extend the lib import (line 19):

```ts
import { COMP_CIRCLE_CODE, COMP_STAFF_UIDS, type CompEligibility } from "../lib/competition";
```

(b) Add to `UseCirclesParams` directly under the `compStats?: CircleStats;` member (~line 97):

```ts
  /** Competition eligibility snapshot — published as shotsMissing on the comp entry. */
  compEligibility?: CompEligibility;
```

(c) Add `compEligibility,` to the destructured params (after `compStats,` at ~line 111).

(d) Add the ref next to `compStatsRef` (~line 136):

```ts
  const compEligibilityRef = useRef(compEligibility);
  compEligibilityRef.current = compEligibility;
```

(e) In `publishToCircle`'s `entry` object literal, directly above the `...(isCompStaff ? ...)` spread (~line 551), add:

```ts
      ...(circleCode === COMP_CIRCLE_CODE && compEligibilityRef.current
        ? { shotsMissing: compEligibilityRef.current.missingShots }
        : {}),
```

(f) Add to the `LeaderboardEntry` interface, after `staff?: true;` (~line 51):

```ts
  /** Comp-window trades missing a screenshot. Absent on entries published before 2026-06-11. */
  shotsMissing?: number;
```

- [ ] **Step 3.5: Pass it from `Koda.tsx`**

In the `useCircles({ ... })` call (~line 916), directly under `compStats: compCircleStats,` add:

```ts
    compEligibility: myCompEligibility,
```

- [ ] **Step 3.6: Typecheck + full test run**

Run: `npx tsc -p tsconfig.app.json --noEmit`
Expected: no errors.
Run: `npx vitest run`
Expected: all suites pass (no behavior change to existing tests).

- [ ] **Step 3.7: Commit**

```bash
git add src/Koda.tsx src/hooks/useCircles.ts
git commit -m "feat(competition): publish shotsMissing on comp leaderboard entries"
```

---

## Task 4: Self strip + INELIGIBLE row markers in `TradingCircles.tsx`

**Files:**
- Modify: `src/TradingCircles.tsx` (import line 5, props ~42, destructure ~104, leaderboard tab ~1254, `renderRow` ~1296)
- Modify: `src/Koda.tsx` (`<TradingCircles>` render ~4579)

- [ ] **Step 4.1: Extend the lib import (line 5)**

```ts
import { COMP_CIRCLE_CODE, COMP_MIN_TRADES, shouldShowCompetitionCard, compStatusText, type CompEligibility } from "./lib/competition";
```

- [ ] **Step 4.2: Add the prop**

In `TradingCirclesProps`, after `onJoinCompetition: () => Promise<void>;` (~line 91):

```ts
  /** Viewer's own comp eligibility — drives the self strip on the comp leaderboard. */
  myCompEligibility: CompEligibility;
```

Add `myCompEligibility` to the destructured props (after `onJoinCompetition,` at ~line 114).

- [ ] **Step 4.3: Render the self strip**

In the leaderboard tab — directly after `{circleTab === "leaderboard" && (` and its opening `<div>` (~line 1254), before the `{lbError && ...}` block — add:

```tsx
                {isCompCircle && (() => {
                  const e = myCompEligibility;
                  const head = e.eligible
                    ? `ELIGIBLE · ${e.trades} TRADES`
                    : `${e.trades}/${COMP_MIN_TRADES} TRADES`;
                  const tail = e.missingShots > 0
                    ? `${e.missingShots} MISSING SCREENSHOT${e.missingShots === 1 ? "" : "S"}`
                    : "ALL SCREENSHOTS ATTACHED";
                  return (
                    <div style={{ fontFamily: MONO, fontSize: 10, color: C.muted, letterSpacing: "0.1em", textTransform: "uppercase" as const, textAlign: "center" as const, padding: "6px 0 14px" }}>
                      {head} · {tail}
                    </div>
                  );
                })()}
```

- [ ] **Step 4.4: Add the INELIGIBLE row marker**

In `renderRow`, directly after the REFEREE badge span (~line 1296, inside the name/badges flex row), add:

```tsx
                                  {isCompCircle && !isStaffRow && (entry.total < COMP_MIN_TRADES || (entry.shotsMissing ?? 0) > 0) && (
                                    <span style={{ fontFamily: MONO, fontSize: "9px", color: C.muted, letterSpacing: "0.12em", textTransform: "uppercase" as const, border: `1px solid ${C.border2}`, borderRadius: 4, padding: "1px 5px" }}>INELIGIBLE</span>
                                  )}
```

Backwards-compat note baked into the condition: `entry.shotsMissing ?? 0` means entries published before Task 3 (no field) can only be flagged via `entry.total` — `undefined` never flags on its own.

- [ ] **Step 4.5: Pass the prop from `Koda.tsx`**

In the `<TradingCircles ... />` render, after `onJoinCompetition={handleJoinCompetition}` (~line 4579):

```tsx
              myCompEligibility={myCompEligibility}
```

- [ ] **Step 4.6: Typecheck**

Run: `npx tsc -p tsconfig.app.json --noEmit`
Expected: no errors.

- [ ] **Step 4.7: Manual browser check**

Run: `npm run dev` → open http://localhost:5173 → Circles → 50K Eval Challenge → Board tab.
- Self strip appears above the board (e.g. `0/10 TRADES · ALL SCREENSHOTS ATTACHED`).
- Non-staff rows with `total < 10` show the INELIGIBLE pill; referee rows never do.
- A non-comp circle's board is unchanged (no strip, no pills).

- [ ] **Step 4.8: Commit**

```bash
git add src/TradingCircles.tsx src/Koda.tsx
git commit -m "feat(competition): eligibility self strip + INELIGIBLE markers on comp leaderboard"
```

---

## Task 5 (STRETCH — skip without consequence if time runs out): Referee coverage line

**Files:**
- Modify: `src/TradingCircles.tsx` (import line 5, `isCompCircle` block ~631, `renderRow` stats row ~1299–1304)

- [ ] **Step 5.1: Extend the lib import (line 5)**

```ts
import { COMP_CIRCLE_CODE, COMP_MIN_TRADES, COMP_STAFF_UIDS, shouldShowCompetitionCard, compStatusText, type CompEligibility } from "./lib/competition";
```

- [ ] **Step 5.2: Identify staff viewers**

Directly under `const isCompCircle = ...` (~line 631):

```ts
  const viewerIsStaff = COMP_STAFF_UIDS.has(profile.uid ?? "");
```

- [ ] **Step 5.3: Add the coverage span**

In `renderRow`'s `{!isStaffRow && (...)}` stats row (the flex div containing `<span>{entry.total} trades</span>`, ~lines 1299–1304), add as the last child span:

```tsx
                                    {isCompCircle && viewerIsStaff && (
                                      <span style={{ color: (entry.shotsMissing ?? 0) > 0 ? C.text : C.muted, fontWeight: (entry.shotsMissing ?? 0) > 0 ? 700 : 400 }}>
                                        {entry.shotsMissing != null ? `${entry.shotsMissing} missing shots` : "shots n/a"}
                                      </span>
                                    )}
```

(`shots n/a` covers entries published before `shotsMissing` existed.)

- [ ] **Step 5.4: Typecheck**

Run: `npx tsc -p tsconfig.app.json --noEmit`
Expected: no errors.

- [ ] **Step 5.5: Commit**

```bash
git add src/TradingCircles.tsx
git commit -m "feat(competition): referee-only screenshot coverage line on comp leaderboard"
```

---

## Task 6: Final verification

- [ ] **Step 6.1: Full test suite**

Run: `npx vitest run`
Expected: all suites pass.

- [ ] **Step 6.2: Both typecheck configs**

Run: `npx tsc -p tsconfig.app.json --noEmit`
Run: `npx tsc -p tsconfig.api.json --noEmit`
Expected: no errors from either.

- [ ] **Step 6.3: Manual end-to-end pass**

With `npm run dev` (PWA caveat from project memory: if testing a deployed build later, use incognito to dodge the stale service worker):
1. Join the competition (banner or featured card) if not already joined.
2. Log tab → set date 2026-06-20 → no screenshot → warning appears; Save stays enabled.
3. Attach a screenshot → warning disappears.
4. Set date 2026-06-01 → warning stays hidden.
5. Circles → comp circle → Board: self strip reflects your real counts; publish stats and confirm the KV entry gains `shotsMissing` (Supabase: `SELECT value FROM shared_kv WHERE key LIKE 'koda_circle_entry_50K-EVAL-2026_%'`).

---

## Self-Review Checklist

- [x] **Spec coverage:** §2 helpers → Task 1 ✓ · §3 soft warning → Task 2 ✓ · §4 publish path + `isInCompWindow` cleanup → Task 3 ✓ · §5 self strip + row markers + backwards-compat rule → Task 4 ✓ · §6 referee stretch → Task 5 ✓ · §7 error handling → covered by Task 1 tests (garbage dates, empty list) and `?? 0` guards ✓ · §8 testing → TDD in Tasks 1–2, typecheck+manual for wiring ✓
- [x] **No placeholders** — every step has real code and exact commands.
- [x] **Type consistency:** `CompEligibility` shape `{ trades, missingShots, eligible }` used identically in Tasks 1, 3, 4. `myCompEligibility` name matches across Koda.tsx (3.3, 3.5, 4.5) and TradingCircles (4.2, 4.3). `shotsMissing?: number` on `LeaderboardEntry` (3.4f) matches reads in 4.4 and 5.3.
