# Competition Circle Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add the 50K Eval Challenge competition — a seeded circle, opt-in home-feed banner, featured card in the Circles tab, and a competition circle screen with R/$ toggle, status bar, and rules footer.

**Architecture:** A shared `src/lib/competition.ts` module owns all constants and pure helpers. `CompetitionBanner` is a presentational component. `TradingCircles.tsx` gets three competition-only additions to its existing detail and list views. `Koda.tsx` wires the join handler. Two DB migrations seed the circle and challenge rows.

**Tech Stack:** React 19, TypeScript, Vitest + React Testing Library, Supabase (shared_kv + circle_challenges), inline styles matching the existing design system.

---

## File Map

| File | Action | Responsibility |
|------|--------|----------------|
| `src/lib/competition.ts` | Create | Constants, pure helpers, status logic |
| `src/lib/competition.test.ts` | Create | Unit tests for all helpers |
| `src/components/CompetitionBanner.tsx` | Create | Home-feed opt-in banner |
| `src/components/CompetitionBanner.test.tsx` | Create | Visibility + interaction tests |
| `supabase/migrations/20260615_seed_competition_circle.sql` | Create | Seeds circle in shared_kv + challenge row |
| `src/Koda.tsx` | Modify | Import banner, add join handler, render in home feed, pass prop to TradingCircles |
| `src/TradingCircles.tsx` | Modify | `onJoinCompetition` prop, featured card, R/$ toggle, status bar, rules footer |
| `public/competition-rules.html` | Create | Static rules page (same style as privacy.html) |

---

## Task 1: Create `src/lib/competition.ts` + tests

**Files:**
- Create: `src/lib/competition.ts`
- Create: `src/lib/competition.test.ts`

- [ ] **Step 1.1: Write the failing tests**

```ts
// src/lib/competition.test.ts
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import {
  COMP_CIRCLE_CODE, COMP_END_TS, COMP_START_TS, COMP_JOINED_KEY,
  isCompetitionActive, isCompetitionStarted, isCompetitionJoined,
  markCompetitionJoined, compDaysRemaining, compDaysUntilStart,
  compStatusText, shouldShowCompetitionCard,
} from "./competition";

describe("competition helpers", () => {
  beforeEach(() => { localStorage.clear(); vi.useFakeTimers(); });
  afterEach(() => vi.useRealTimers());

  it("isCompetitionActive is true before end date", () => {
    vi.setSystemTime(COMP_END_TS - 1000);
    expect(isCompetitionActive()).toBe(true);
  });

  it("isCompetitionActive is false after end date", () => {
    vi.setSystemTime(COMP_END_TS + 1000);
    expect(isCompetitionActive()).toBe(false);
  });

  it("isCompetitionStarted is true after start date", () => {
    vi.setSystemTime(COMP_START_TS + 1000);
    expect(isCompetitionStarted()).toBe(true);
  });

  it("isCompetitionStarted is false before start date", () => {
    vi.setSystemTime(COMP_START_TS - 1000);
    expect(isCompetitionStarted()).toBe(false);
  });

  it("isCompetitionJoined returns false when key absent", () => {
    expect(isCompetitionJoined()).toBe(false);
  });

  it("markCompetitionJoined sets the key; isCompetitionJoined returns true", () => {
    markCompetitionJoined();
    expect(isCompetitionJoined()).toBe(true);
    expect(localStorage.getItem(COMP_JOINED_KEY)).toBe("1");
  });

  it("compDaysRemaining returns days until end", () => {
    vi.setSystemTime(COMP_END_TS - 5 * 86400000);
    expect(compDaysRemaining()).toBe(5);
  });

  it("compDaysRemaining returns 0 after end", () => {
    vi.setSystemTime(COMP_END_TS + 1000);
    expect(compDaysRemaining()).toBe(0);
  });

  it("compDaysUntilStart returns days until start", () => {
    vi.setSystemTime(COMP_START_TS - 3 * 86400000);
    expect(compDaysUntilStart()).toBe(3);
  });

  describe("compStatusText", () => {
    it("shows 'Starts in X days' before start", () => {
      vi.setSystemTime(COMP_START_TS - 3 * 86400000);
      expect(compStatusText(50)).toMatch(/starts in 3 days/i);
    });

    it("shows days remaining and trader count during competition", () => {
      vi.setSystemTime(COMP_END_TS - 7 * 86400000);
      expect(compStatusText(100)).toMatch(/7 days remaining · 100 traders/i);
    });

    it("handles singular 'day' and 'trader'", () => {
      vi.setSystemTime(COMP_END_TS - 86400000);
      expect(compStatusText(1)).toMatch(/1 day remaining · 1 trader/i);
    });

    it("shows closed message after end", () => {
      vi.setSystemTime(COMP_END_TS + 1000);
      expect(compStatusText(0)).toMatch(/competition closed/i);
    });
  });

  describe("shouldShowCompetitionCard", () => {
    it("returns true when not in myCircles and competition active", () => {
      vi.setSystemTime(COMP_END_TS - 1000);
      expect(shouldShowCompetitionCard(["OTHER"])).toBe(true);
    });

    it("returns false when comp circle is in myCircles", () => {
      vi.setSystemTime(COMP_END_TS - 1000);
      expect(shouldShowCompetitionCard([COMP_CIRCLE_CODE])).toBe(false);
    });

    it("returns false after competition ends", () => {
      vi.setSystemTime(COMP_END_TS + 1000);
      expect(shouldShowCompetitionCard([])).toBe(false);
    });
  });
});
```

- [ ] **Step 1.2: Run tests — expect all to fail**

```
cd koda && npx vitest run src/lib/competition.test.ts
```

Expected: `Cannot find module './competition'`

- [ ] **Step 1.3: Create the module**

```ts
// src/lib/competition.ts

export const COMP_CIRCLE_CODE = "50K-EVAL-2026";
export const COMP_END_TS = new Date("2026-07-15T23:59:59Z").getTime();
export const COMP_START_TS = new Date("2026-06-15T00:00:00Z").getTime();
export const COMP_JOINED_KEY = "koda_comp_2026_joined";

export function isCompetitionActive(): boolean {
  return Date.now() < COMP_END_TS;
}

export function isCompetitionStarted(): boolean {
  return Date.now() >= COMP_START_TS;
}

export function isCompetitionJoined(): boolean {
  try { return localStorage.getItem(COMP_JOINED_KEY) === "1"; } catch { return false; }
}

export function markCompetitionJoined(): void {
  try { localStorage.setItem(COMP_JOINED_KEY, "1"); } catch {}
}

export function compDaysRemaining(): number {
  return Math.max(0, Math.ceil((COMP_END_TS - Date.now()) / 86400000));
}

export function compDaysUntilStart(): number {
  return Math.max(0, Math.ceil((COMP_START_TS - Date.now()) / 86400000));
}

export function compStatusText(memberCount: number): string {
  if (!isCompetitionStarted()) {
    const d = compDaysUntilStart();
    return `Starts in ${d} day${d === 1 ? "" : "s"}`;
  }
  if (isCompetitionActive()) {
    const d = compDaysRemaining();
    return `${d} day${d === 1 ? "" : "s"} remaining · ${memberCount} trader${memberCount === 1 ? "" : "s"}`;
  }
  return "Competition closed · winner announced below";
}

export function shouldShowCompetitionCard(myCircleCodes: string[]): boolean {
  return isCompetitionActive() && !myCircleCodes.includes(COMP_CIRCLE_CODE);
}
```

- [ ] **Step 1.4: Run tests — expect all to pass**

```
npx vitest run src/lib/competition.test.ts
```

Expected: all green, 0 failed.

- [ ] **Step 1.5: Commit**

```bash
git add src/lib/competition.ts src/lib/competition.test.ts
git commit -m "feat(competition): add shared competition constants and helpers"
```

---

## Task 2: DB migration — seed competition circle + challenge

**Files:**
- Create: `supabase/migrations/20260615_seed_competition_circle.sql`

- [ ] **Step 2.1: Write the migration**

```sql
-- supabase/migrations/20260615_seed_competition_circle.sql
-- Seeds the 50K Eval Challenge circle and its challenge row.
-- ON CONFLICT clauses make this safely re-runnable.

INSERT INTO shared_kv (key, value, owner_id)
VALUES (
  'koda_circle_50K-EVAL-2026',
  '{"id":2,"code":"50K-EVAL-2026","name":"50K Eval Challenge","description":"30-day prop eval challenge. Best R-multiple wins.","strategy":"","privacy":"public","emoji":"⚡","metric":"r","createdBy":"Kōda","createdAt":"2026-06-15T00:00:00.000Z"}',
  '00000000-0000-0000-0000-000000000000'::uuid
)
ON CONFLICT (key) DO NOTHING;

INSERT INTO circle_challenges (circle_code, title, metric, started_at, ends_at, created_by, status)
VALUES (
  '50K-EVAL-2026',
  '50K Eval — June 2026',
  'r',
  '2026-06-15T00:00:00.000Z',
  '2026-07-15T23:59:59.000Z',
  'Kōda',
  'active'
)
ON CONFLICT DO NOTHING;
```

- [ ] **Step 2.2: Apply to local Supabase**

```bash
npx supabase db push
```

Or if you apply manually in the Supabase SQL editor, paste the two INSERT statements.

- [ ] **Step 2.3: Verify in Supabase**

Run in the SQL editor:
```sql
SELECT key FROM shared_kv WHERE key = 'koda_circle_50K-EVAL-2026';
SELECT title, metric, status FROM circle_challenges WHERE circle_code = '50K-EVAL-2026';
```

Expected: one row each.

- [ ] **Step 2.4: Commit**

```bash
git add supabase/migrations/20260615_seed_competition_circle.sql
git commit -m "feat(competition): seed 50K-EVAL-2026 circle and challenge in DB"
```

---

## Task 3: `CompetitionBanner` component + tests

**Files:**
- Create: `src/components/CompetitionBanner.tsx`
- Create: `src/components/CompetitionBanner.test.tsx`

- [ ] **Step 3.1: Write the failing tests**

```tsx
// src/components/CompetitionBanner.test.tsx
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { CompetitionBanner } from "./CompetitionBanner";
import { COMP_END_TS, COMP_JOINED_KEY, markCompetitionJoined } from "../lib/competition";
import { DARK } from "../theme";

describe("CompetitionBanner", () => {
  beforeEach(() => {
    localStorage.clear();
    vi.useFakeTimers();
    vi.setSystemTime(COMP_END_TS - 86400000); // 1 day before end
  });
  afterEach(() => vi.useRealTimers());

  it("renders when not joined and competition is active", () => {
    render(<CompetitionBanner C={DARK} isMobile onJoin={async () => {}} />);
    expect(screen.getByText(/enter competition/i)).toBeInTheDocument();
  });

  it("does not render when already joined", () => {
    markCompetitionJoined();
    const { container } = render(<CompetitionBanner C={DARK} isMobile onJoin={async () => {}} />);
    expect(container.firstChild).toBeNull();
  });

  it("does not render after competition ends", () => {
    vi.setSystemTime(COMP_END_TS + 1000);
    const { container } = render(<CompetitionBanner C={DARK} isMobile onJoin={async () => {}} />);
    expect(container.firstChild).toBeNull();
  });

  it("calls onJoin when Enter competition is clicked", async () => {
    const onJoin = vi.fn().mockResolvedValue(undefined);
    render(<CompetitionBanner C={DARK} isMobile onJoin={onJoin} />);
    fireEvent.click(screen.getByText(/enter competition/i));
    await waitFor(() => expect(onJoin).toHaveBeenCalledOnce());
  });

  it("soft-dismisses on × without setting localStorage", () => {
    render(<CompetitionBanner C={DARK} isMobile onJoin={async () => {}} />);
    fireEvent.click(screen.getByRole("button", { name: /dismiss/i }));
    expect(screen.queryByText(/enter competition/i)).not.toBeInTheDocument();
    expect(localStorage.getItem(COMP_JOINED_KEY)).toBeNull();
  });
});
```

- [ ] **Step 3.2: Run tests — expect all to fail**

```
npx vitest run src/components/CompetitionBanner.test.tsx
```

Expected: `Cannot find module './CompetitionBanner'`

- [ ] **Step 3.3: Create the component**

```tsx
// src/components/CompetitionBanner.tsx
import { useState } from "react";
import { BODY, MONO, DISPLAY } from "../shared";
import type { Theme } from "../theme";
import { isCompetitionActive, isCompetitionJoined } from "../lib/competition";

export interface CompetitionBannerProps {
  C: Theme;
  isMobile: boolean;
  onJoin: () => Promise<void>;
}

export function CompetitionBanner({ C, isMobile, onJoin }: CompetitionBannerProps) {
  const [dismissed, setDismissed] = useState(false);
  const [joining, setJoining] = useState(false);

  if (dismissed || isCompetitionJoined() || !isCompetitionActive()) return null;

  async function handleJoin() {
    setJoining(true);
    try { await onJoin(); } finally { setJoining(false); }
  }

  return (
    <div
      style={{
        background: C.surfaceGlass,
        backdropFilter: "blur(20px) saturate(160%)",
        WebkitBackdropFilter: "blur(20px) saturate(160%)",
        border: `1px solid color-mix(in oklch, ${C.live} 25%, transparent)`,
        borderRadius: 16,
        padding: "18px 20px",
        marginBottom: 16,
      }}
    >
      <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 8 }}>
        <div style={{ flex: 1 }}>
          <div style={{
            fontFamily: MONO, fontSize: 10, color: C.live,
            letterSpacing: "0.16em", textTransform: "uppercase" as const,
            fontWeight: 700, marginBottom: 10,
          }}>
            ⚡ 50K EVAL CHALLENGE · JUNE 15 – JULY 15
          </div>
          <div style={{
            fontFamily: DISPLAY, fontSize: isMobile ? 22 : 26,
            fontWeight: 600, letterSpacing: "-0.02em",
            lineHeight: 1.1, color: C.text, marginBottom: 8,
          }}>
            Trade your eval.<br />Win the leaderboard.
          </div>
          <div style={{
            fontFamily: BODY, fontSize: 13, color: C.text2,
            lineHeight: 1.5, marginBottom: 14,
          }}>
            30-day R-multiple competition. Free to enter.
          </div>
          <button
            onClick={handleJoin}
            disabled={joining}
            style={{
              background: C.live, color: "#0A0A0A", border: "none",
              borderRadius: 999, padding: "11px 22px",
              fontFamily: BODY, fontSize: 13, fontWeight: 600,
              cursor: joining ? "default" : "pointer",
              opacity: joining ? 0.7 : 1,
            }}
          >
            {joining ? "Joining…" : "Enter competition"}
          </button>
        </div>
        <button
          onClick={() => setDismissed(true)}
          aria-label="Dismiss"
          style={{
            background: "none", border: "none", color: C.muted,
            cursor: "pointer", fontSize: 20, padding: "0 0 0 8px",
            lineHeight: 1, flexShrink: 0,
          }}
        >
          ×
        </button>
      </div>
    </div>
  );
}
```

- [ ] **Step 3.4: Run tests — expect all to pass**

```
npx vitest run src/components/CompetitionBanner.test.tsx
```

Expected: 5 passed.

- [ ] **Step 3.5: Commit**

```bash
git add src/components/CompetitionBanner.tsx src/components/CompetitionBanner.test.tsx
git commit -m "feat(competition): add CompetitionBanner component"
```

---

## Task 4: Wire `CompetitionBanner` in `Koda.tsx`

**Files:**
- Modify: `src/Koda.tsx`

- [ ] **Step 4.1: Add the import at the top of `src/Koda.tsx`**

Find the existing import block (around line 65 where `OfflineBanner` is imported) and add:

```ts
import { CompetitionBanner } from "./components/CompetitionBanner";
import { COMP_CIRCLE_CODE, markCompetitionJoined } from "./lib/competition";
```

- [ ] **Step 4.2: Add the `handleJoinCompetition` function**

Find `function attemptLog()` (around line 215) and add this function just before it:

```ts
async function handleJoinCompetition(): Promise<void> {
  await joinCircleByCode(COMP_CIRCLE_CODE);
  markCompetitionJoined();
  navigateTo("circles");
}
```

- [ ] **Step 4.3: Render the banner in the home feed**

Find the announcement card block in the home feed (around line 1991):

```tsx
{announcement && announcement.id !== announcementDismissedId && (
  <div style={{ ... }}>
```

Add `<CompetitionBanner>` immediately BEFORE that block:

```tsx
<CompetitionBanner
  C={C}
  isMobile={isMobile}
  onJoin={handleJoinCompetition}
/>
{announcement && announcement.id !== announcementDismissedId && (
```

- [ ] **Step 4.4: Run typecheck**

```
npx tsc -p tsconfig.app.json --noEmit
```

Expected: no new errors.

- [ ] **Step 4.5: Start the dev server and verify**

```
npm run dev
```

Open http://localhost:5173, sign in, go to Home → Feed. The competition banner should appear. Tap ×  — it should disappear for the session but reappear on reload. Tapping "Enter competition" should call the join flow and navigate to Circles.

- [ ] **Step 4.6: Commit**

```bash
git add src/Koda.tsx
git commit -m "feat(competition): wire CompetitionBanner into home feed"
```

---

## Task 5: Featured card + `onJoinCompetition` prop in `TradingCircles.tsx`

**Files:**
- Modify: `src/TradingCircles.tsx`
- Modify: `src/Koda.tsx` (pass prop)

- [ ] **Step 5.1: Add `onJoinCompetition` to `TradingCirclesProps`**

In `src/TradingCircles.tsx`, find the `TradingCirclesProps` interface (line ~41) and add:

```ts
onJoinCompetition: () => Promise<void>;
```

- [ ] **Step 5.2: Destructure the prop in `TradingCircles`**

Find the destructured props in `function TradingCircles({...})` (line ~102) and add `onJoinCompetition` to the list.

- [ ] **Step 5.3: Add competition state + member-count fetch**

After the existing `const [lbSort, setLbSort]` state line, add:

```ts
const [compMemberCount, setCompMemberCount] = useState<number | null>(null);
```

After the `sortedCircles` computation (line ~611), add:

```ts
const myCircleCodes = myCircles.map(c => c.code);
const showCompCard = shouldShowCompetitionCard(myCircleCodes);
```

At the top of `src/TradingCircles.tsx`, add to the existing imports:

```ts
import { COMP_CIRCLE_CODE, shouldShowCompetitionCard } from "./lib/competition";
import { supabase } from "./lib/supabase";
```

Add this effect (after the existing chat/leaderboard effects):

```tsx
useEffect(() => {
  if (!showCompCard) return;
  supabase
    .from("shared_kv")
    .select("*", { count: "exact", head: true })
    .ilike("key", `koda_circle_entry_${COMP_CIRCLE_CODE}_%`)
    .then(({ count }) => { if (count !== null) setCompMemberCount(count); });
}, [showCompCard]);
```

- [ ] **Step 5.4: Add the featured card in the browse view**

Find the pill tabs section in the browse view (around line 632, after the `</div>` that closes the pill tabs). Add the featured card between the pill tabs and the `{sortedCircles.length > 0 ? ...}` block:

```tsx
{showCompCard && (
  <div
    style={{
      background: C.surfaceGlass,
      backdropFilter: "blur(20px) saturate(160%)",
      WebkitBackdropFilter: "blur(20px) saturate(160%)",
      border: `1px solid color-mix(in oklch, ${C.live} 25%, transparent)`,
      borderRadius: 16,
      padding: "16px 18px",
      marginBottom: 12,
      position: "relative",
      zIndex: 2,
    }}
  >
    <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 10 }}>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{
          fontFamily: MONO, fontSize: 9, color: C.live,
          letterSpacing: "0.16em", textTransform: "uppercase" as const,
          fontWeight: 700, marginBottom: 6,
        }}>
          ⚡ Featured Competition
        </div>
        <div style={{
          fontFamily: DISPLAY, fontSize: 16, fontWeight: 600,
          color: C.text, letterSpacing: "-0.01em", marginBottom: 2,
        }}>
          50K Eval Challenge
        </div>
        <div style={{ fontFamily: MONO, fontSize: 10, color: C.muted, letterSpacing: "0.06em" }}>
          June 15 – July 15 · R-multiple leaderboard
          {compMemberCount !== null && ` · ${compMemberCount} trader${compMemberCount === 1 ? "" : "s"} entered`}
        </div>
      </div>
      <button
        onClick={onJoinCompetition}
        style={{
          background: C.live, color: "#0A0A0A", border: "none",
          borderRadius: 999, padding: "9px 18px",
          fontFamily: BODY, fontSize: 12, fontWeight: 600,
          cursor: "pointer", flexShrink: 0, whiteSpace: "nowrap" as const,
        }}
      >
        Enter ▶
      </button>
    </div>
  </div>
)}
```

- [ ] **Step 5.5: Pass `onJoinCompetition` from `Koda.tsx` to `TradingCircles`**

In `src/Koda.tsx`, find the `<TradingCircles ... />` render (around line 4599) and add:

```tsx
onJoinCompetition={handleJoinCompetition}
```

- [ ] **Step 5.6: Run typecheck**

```
npx tsc -p tsconfig.app.json --noEmit
```

Expected: no errors.

- [ ] **Step 5.7: Verify in the browser**

Open the Circles tab while not yet joined to `50K-EVAL-2026`. The featured card should appear above the joined circles list with the member count (or blank while loading). Clicking "Enter ▶" should join and navigate.

Once joined, the featured card should disappear.

- [ ] **Step 5.8: Commit**

```bash
git add src/TradingCircles.tsx src/Koda.tsx
git commit -m "feat(competition): add featured card in circles list for non-members"
```

---

## Task 6: R/$ toggle, status bar, and rules footer in the circle detail view

**Files:**
- Modify: `src/TradingCircles.tsx`

- [ ] **Step 6.1: Add `lbMetric` state**

After the existing `const [lbSort, setLbSort]` line, add:

```ts
const [lbMetric, setLbMetric] = useState<"r" | "dollar">("r");
```

- [ ] **Step 6.2: Compute `displayLeaderboard`**

Just before the leaderboard `renderRow` function (around line 1159), add:

```ts
const isCompCircle = activeCircle?.code === COMP_CIRCLE_CODE;
const displayLeaderboard = isCompCircle
  ? [...leaderboard].sort((a, b) =>
      lbMetric === "dollar"
        ? ((b.totalPnLDollar ?? 0) - (a.totalPnLDollar ?? 0))
        : (b.totalPnL - a.totalPnL)
    )
  : leaderboard;
```

- [ ] **Step 6.3: Replace `leaderboard.map` with `displayLeaderboard.map`**

In the leaderboard tab content (around line 1237), change:

```tsx
{leaderboard.map((entry, i) => renderRow(entry, i))}
```

to:

```tsx
{displayLeaderboard.map((entry, i) => renderRow(entry, i))}
```

- [ ] **Step 6.4: Add R/$ toggle buttons in the leaderboard header**

Find the leaderboard tab header (around line 1017):

```tsx
{circleTab === "leaderboard" && (
  <div style={{ display: "flex", gap: "6px", alignItems: "center", justifyContent: "flex-end", paddingTop: "10px" }}>
    {(["all", "week"] as const).map(s => (
```

Add the toggle AFTER the existing ALL TIME / THIS WEEK buttons and refresh button, inside the same `div`, but only for the competition circle. Add it before the closing `</div>` of the controls row:

```tsx
{isCompCircle && (
  <div style={{ display: "flex", gap: 2, marginLeft: 8 }}>
    {(["r", "dollar"] as const).map(m => (
      <button
        key={m}
        onClick={() => setLbMetric(m)}
        style={{
          background: lbMetric === m ? C.live : "transparent",
          color: lbMetric === m ? "#0A0A0A" : C.muted,
          border: `1px solid ${lbMetric === m ? C.live : C.border2}`,
          borderRadius: 999, padding: "4px 10px",
          cursor: "pointer", fontFamily: MONO,
          fontSize: "10px", letterSpacing: "0.08em",
          textTransform: "uppercase" as const,
          fontWeight: lbMetric === m ? 700 : 400,
        }}
      >
        {m === "r" ? "R" : "$"}
      </button>
    ))}
  </div>
)}
```

- [ ] **Step 6.5: Add competition status bar in circle header**

Find the circle description block in the detail view (around line 898):

```tsx
{activeCircle.description && (
  <div style={{ fontFamily: BODY, fontSize: "14px", ... }}>{activeCircle.description}</div>
)}
```

Add the status bar immediately AFTER it:

```tsx
{activeCircle.code === COMP_CIRCLE_CODE && (
  <div style={{
    fontFamily: MONO, fontSize: 10, color: C.muted,
    letterSpacing: "0.1em", textTransform: "uppercase" as const,
    textAlign: "center" as const,
    padding: "8px 0 14px",
  }}>
    {compStatusText(activeCircle.members?.length ?? 0)}
  </div>
)}
```

Add the import at the top of `TradingCircles.tsx`:

```ts
import { COMP_CIRCLE_CODE, shouldShowCompetitionCard, compStatusText } from "./lib/competition";
```

(Replace the earlier partial import from Task 5.)

- [ ] **Step 6.6: Add rules link footer**

Find the end of the circle detail view — just before `{/* Leave circle confirmation sheet */}` (around line 1492). Add:

```tsx
{activeCircle?.code === COMP_CIRCLE_CODE && (
  <div style={{
    textAlign: "center" as const,
    padding: "24px 0 12px",
    borderTop: `1px solid ${C.border}`,
    marginTop: 8,
  }}>
    <a
      href="/competition-rules.html"
      target="_blank"
      rel="noopener noreferrer"
      style={{
        fontFamily: MONO, fontSize: 10, color: C.muted,
        letterSpacing: "0.08em", textDecoration: "none",
        textTransform: "uppercase" as const,
      }}
    >
      View competition rules →
    </a>
  </div>
)}
```

- [ ] **Step 6.7: Run typecheck**

```
npx tsc -p tsconfig.app.json --noEmit
```

Expected: no errors.

- [ ] **Step 6.8: Verify in the browser**

Join the `50K-EVAL-2026` circle (via banner or featured card). Open the circle detail. Verify:
- Status bar appears below the description with the correct copy
- Leaderboard tab shows R and $ toggle buttons
- Clicking $ re-sorts by `totalPnLDollar`; clicking R re-sorts by `totalPnL`
- "View competition rules →" link appears at the bottom

- [ ] **Step 6.9: Commit**

```bash
git add src/TradingCircles.tsx
git commit -m "feat(competition): R/\$ toggle, status bar, rules footer in circle detail"
```

---

## Task 7: Static rules page

**Files:**
- Create: `public/competition-rules.html`

- [ ] **Step 7.1: Create the page**

```html
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>Competition Rules — Kōda</title>
  <style>
    :root { --bg: #0C0C0B; --text: #EDEDE8; --text2: #BCBCB4; --muted: #8A8A82; --border: #2A2A24; --green: #00C96B; }
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body { background: var(--bg); color: var(--text); font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif; font-size: 15px; line-height: 1.7; padding: 0 20px; }
    .wrap { max-width: 720px; margin: 0 auto; padding: 60px 0 100px; }
    .logo { font-family: "SF Mono", "Fira Code", monospace; font-size: 13px; letter-spacing: 0.2em; color: var(--green); text-decoration: none; display: inline-block; margin-bottom: 48px; }
    h1 { font-size: 28px; font-weight: 600; color: var(--text); margin-bottom: 8px; letter-spacing: -0.02em; }
    .meta { font-size: 12px; color: var(--muted); font-family: "SF Mono", monospace; letter-spacing: 0.08em; margin-bottom: 48px; }
    h2 { font-size: 14px; font-weight: 600; color: var(--text); letter-spacing: 0.08em; text-transform: uppercase; margin: 40px 0 12px; padding-top: 40px; border-top: 1px solid var(--border); }
    h2:first-of-type { border-top: none; padding-top: 0; }
    p { color: var(--text2); margin-bottom: 14px; }
    ul { color: var(--text2); padding-left: 20px; margin-bottom: 14px; }
    li { margin-bottom: 8px; }
    strong { color: var(--text); }
    a { color: var(--green); text-decoration: none; }
    a:hover { text-decoration: underline; }
    .footer { margin-top: 60px; padding-top: 24px; border-top: 1px solid var(--border); display: flex; gap: 20px; font-size: 12px; color: var(--muted); font-family: "SF Mono", monospace; letter-spacing: 0.06em; }
    .footer a { color: var(--muted); }
    .footer a:hover { color: var(--text); }
  </style>
</head>
<body>
  <div class="wrap">
    <a href="/" class="logo">KŌDA</a>
    <h1>50K Eval Challenge</h1>
    <div class="meta">OFFICIAL RULES · JUNE 2026</div>

    <h2>Competition Period</h2>
    <p>June 15, 2026 00:00 UTC – July 15, 2026 23:59 UTC.</p>

    <h2>Entry</h2>
    <p>Free. Open to all Kōda users who join the 50K Eval Challenge circle before the competition closes. One entry per account.</p>

    <h2>Scoring</h2>
    <p>Total R-multiple across all trades logged in Kōda during the competition window. Only trades with a date of June 15–July 15 count. <strong>Minimum 10 trades required to be eligible for the prize.</strong></p>

    <h2>Evidence Requirement</h2>
    <p><strong>A screenshot must be attached to every trade logged during the competition window.</strong> Entries missing screenshots on any trade will be disqualified.</p>

    <h2>Tiebreaker</h2>
    <p>Highest net dollar P&amp;L if R-multiple is equal at the end of the competition.</p>

    <h2>Prize</h2>
    <p>1&times; funded evaluation account at 50k account size, free of charge. The winner receives the evaluation pass but must meet the firm's standard rules to receive a funded account. No cash alternative is available.</p>

    <h2>Winner Announcement</h2>
    <p>On or before July 18, 2026 via the Kōda app and the competition circle.</p>

    <h2>Fair Play</h2>
    <p>Trades must reflect real activity. Kōda reserves the right to disqualify accounts showing signs of manipulation, backdating, or any other form of gaming the leaderboard. Kōda's decision is final.</p>

    <h2>Eligibility</h2>
    <p>Open to participants aged 18 and over. Void where prohibited by local law.</p>

    <div class="footer">
      <a href="/">← Back to Kōda</a>
      <a href="/privacy.html">Privacy</a>
      <a href="/terms.html">Terms</a>
    </div>
  </div>
</body>
</html>
```

- [ ] **Step 7.2: Verify the page renders correctly**

```
npm run dev
```

Open http://localhost:5173/competition-rules.html — verify it matches the style of `/privacy.html`.

- [ ] **Step 7.3: Commit**

```bash
git add public/competition-rules.html
git commit -m "feat(competition): add static competition rules page"
```

---

## Self-Review Checklist

- [x] **Spec coverage:**
  - §1 Data layer → Tasks 1 + 2 ✓
  - §2 CompetitionBanner → Task 3 + 4 ✓
  - §3 Featured card → Task 5 ✓
  - §4a R/$ toggle → Task 6.1–6.4 ✓
  - §4b Status bar → Task 6.5 ✓
  - §4c Rules link footer → Task 6.6 ✓
  - §5 Static rules page → Task 7 ✓
  - §6 localStorage key (`koda_comp_2026_joined`) → competition.ts ✓
  - §7 Constants (`COMP_CIRCLE_CODE`, `COMP_END_TS`) → competition.ts ✓

- [x] **Type consistency:** `COMP_CIRCLE_CODE` used everywhere as imported from `competition.ts`. `onJoinCompetition: () => Promise<void>` matches `handleJoinCompetition` signature in Koda.tsx.

- [x] **No placeholders** — every step has real code.

- [x] **`isCompCircle` declared before use** — added in Step 6.2 before the first reference in 6.3.

- [x] **Import consolidation** — Step 6.5 replaces the partial import from Task 5 with the full import including `compStatusText`.
