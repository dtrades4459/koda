# News Widget & Tab Rework Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Move announcement banner above the news widget on the home feed, simplify the widget to a single hero card showing only high/medium impact events, and remove impact filter chips from the news tab (hard-coded to high+medium).

**Architecture:** Three surgical edits to existing files — a JSX reorder in `Koda.tsx`, memo/JSX cleanup in `HomeNewsWidget.tsx`, and state/JSX removal in `NewsScreen.tsx`. No new files, no new abstractions, no data layer changes.

**Tech Stack:** React 19, TypeScript, Vitest + Testing Library (`npm test` to run)

---

### Task 1: HomeNewsWidget — filter to high+medium, remove strip, update label

**Files:**
- Modify: `src/components/HomeNewsWidget.tsx`
- Test: `src/components/HomeNewsWidget.test.tsx`

- [ ] **Step 1: Update the test fixture to include a medium-impact event and update the label assertion**

In `src/components/HomeNewsWidget.test.tsx`, replace the `calendarValue` fixture and update the label test so it reflects the new `NEXT HIGH/MED EVENT` label and verifies medium events are picked as hero:

```tsx
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { DARK } from "../theme";

const soon = new Date(Date.now() + 2 * 60 * 60 * 1000).toISOString();
const later = new Date(Date.now() + 4 * 60 * 60 * 1000).toISOString();
const wayLater = new Date(Date.now() + 6 * 60 * 60 * 1000).toISOString();

const calendarValue = {
  fetched_at: new Date().toISOString(),
  events: [
    {
      id: "ff-medium-event-next",
      title: "ISM Services PMI",
      country: "USD",
      time: soon,
      impact: "medium",
      forecast: null,
      previous: null,
      actual: null,
    },
    {
      id: "ff-high-event-after",
      title: "CPI (YoY)",
      country: "USD",
      time: later,
      impact: "high",
      forecast: "3.2%",
      previous: "3.4%",
      actual: null,
    },
    {
      id: "ff-low-event-ignored",
      title: "Low Impact Event",
      country: "USD",
      time: wayLater,
      impact: "low",
      forecast: null,
      previous: null,
      actual: null,
    },
  ],
};

interface Row { value: unknown }
let rows: Record<string, Row | null> = {};

vi.mock("../lib/supabase", () => ({
  supabase: {
    from: (_table: string) => ({
      select: (_cols: string) => ({
        eq: (_col: string, key: string) => ({
          maybeSingle: async () => ({ data: rows[key] ?? null, error: null }),
        }),
      }),
    }),
  },
}));

import { HomeNewsWidget } from "./HomeNewsWidget";

describe("HomeNewsWidget", () => {
  beforeEach(() => {
    rows = { koda_news_calendar: { value: calendarValue } };
  });

  it("shows the next high-or-medium event as hero with updated label", async () => {
    render(<HomeNewsWidget C={DARK} onOpenNews={() => {}} />);
    // Medium event is soonest — it becomes the hero
    expect(await screen.findByText("ISM Services PMI")).toBeInTheDocument();
    expect(screen.getByText(/NEXT HIGH\/MED EVENT/i)).toBeInTheDocument();
    expect(screen.getByText(/MEDIUM/i)).toBeInTheDocument();
  });

  it("skips low-impact events — they never appear in the widget", async () => {
    render(<HomeNewsWidget C={DARK} onOpenNews={() => {}} />);
    await screen.findByText("ISM Services PMI");
    expect(screen.queryByText("Low Impact Event")).not.toBeInTheDocument();
  });

  it("does not render a horizontal strip", async () => {
    render(<HomeNewsWidget C={DARK} onOpenNews={() => {}} />);
    await screen.findByText("ISM Services PMI");
    expect(screen.queryByTestId("home-news-strip")).not.toBeInTheDocument();
  });

  it("calls onOpenNews when the hero card is tapped", async () => {
    const onOpenNews = vi.fn();
    render(<HomeNewsWidget C={DARK} onOpenNews={onOpenNews} />);
    const card = await screen.findByTestId("home-news-hero");
    await userEvent.click(card);
    expect(onOpenNews).toHaveBeenCalledOnce();
  });

  it("renders empty state when no events cached", async () => {
    rows = {};
    render(<HomeNewsWidget C={DARK} onOpenNews={() => {}} />);
    expect(await screen.findByText(/News loading/i)).toBeInTheDocument();
  });
});
```

- [ ] **Step 2: Run the tests — expect failures on the label and strip assertions**

```
npm test -- HomeNewsWidget
```

Expected: `NEXT HIGH/MED EVENT` assertion fails (label still says `NEXT EVENT`), strip assertion may pass already.

- [ ] **Step 3: Update HomeNewsWidget.tsx — filter, hero, remove strip, update label**

Replace the full content of `src/components/HomeNewsWidget.tsx`:

```tsx
// ═══════════════════════════════════════════════════════════════════════════════
// Kōda · HomeNewsWidget
//
// Hero card (next high-or-medium impact event + countdown).
// Mounted on the main Home feed view. Tapping anywhere opens the full News page.
// ═══════════════════════════════════════════════════════════════════════════════

import { useEffect, useMemo, useState } from "react";
import type { Theme } from "../theme";
import { MONO } from "../shared";
import { useNews } from "../hooks/useNews";
import type { CalendarEvent, Impact } from "../lib/news";

interface Props {
  C: Theme;
  onOpenNews: () => void;
}

function impactColor(C: Theme, impact: Impact): string {
  if (impact === "high")   return C.red;
  if (impact === "medium") return C.warn;
  return C.muted;
}

function formatLocalDayTime(iso: string): string {
  const d = new Date(iso);
  const day = d.toLocaleDateString(undefined, { weekday: "short" }).toUpperCase();
  const time = d.toLocaleTimeString(undefined, { hour: "2-digit", minute: "2-digit" });
  return `${day} ${time}`;
}

function formatCountdown(ms: number): string {
  if (ms <= 0) return "Now";
  const totalMin = Math.floor(ms / 60_000);
  const h = Math.floor(totalMin / 60);
  const m = totalMin % 60;
  if (h >= 24) {
    const days = Math.floor(h / 24);
    const remHours = h % 24;
    return `${days}d ${remHours}h`;
  }
  return `${h}h ${m}m`;
}

export function HomeNewsWidget({ C, onOpenNews }: Props) {
  const { calendar } = useNews();
  const [now, setNow] = useState<number>(() => Date.now());

  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 60_000);
    return () => clearInterval(id);
  }, []);

  const hero = useMemo<CalendarEvent | null>(() => {
    const events = calendar?.items ?? [];
    return (
      events
        .filter(e => e.impact === "high" || e.impact === "medium")
        .filter(e => new Date(e.time).getTime() > now)
        .sort((a, b) => new Date(a.time).getTime() - new Date(b.time).getTime())[0] ?? null
    );
  }, [calendar, now]);

  if (!hero) {
    return (
      <div
        style={{
          padding: "14px",
          background: C.panel,
          border: `1px solid ${C.border}`,
          borderRadius: 12,
          color: C.muted,
          fontFamily: MONO,
          fontSize: 12,
          textAlign: "center",
        }}
      >
        News loading — check back in a few minutes.
      </div>
    );
  }

  const heroColor = impactColor(C, hero.impact);
  const countdownMs = new Date(hero.time).getTime() - now;

  return (
    <button
      type="button"
      data-testid="home-news-hero"
      onClick={onOpenNews}
      style={{
        textAlign: "left",
        background: C.panel,
        border: `1px solid ${C.border}`,
        borderRadius: 12,
        padding: 14,
        cursor: "pointer",
        color: C.text,
        width: "100%",
      }}
    >
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          marginBottom: 6,
        }}
      >
        <span style={{ fontFamily: MONO, fontSize: 9, letterSpacing: "0.1em", color: C.muted }}>
          NEXT HIGH/MED EVENT
        </span>
        <span
          style={{
            fontFamily: MONO,
            fontSize: 9,
            letterSpacing: "0.08em",
            color: heroColor,
          }}
        >
          ● {hero.impact.toUpperCase()}
        </span>
      </div>
      <div style={{ fontSize: 17, fontWeight: 700, marginBottom: 6 }}>{hero.title}</div>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline" }}>
        <span style={{ fontFamily: MONO, fontSize: 22, letterSpacing: "-0.02em" }}>
          {formatCountdown(countdownMs)}
        </span>
        <span style={{ fontSize: 11, color: C.muted }}>
          {formatLocalDayTime(hero.time)}
        </span>
      </div>
    </button>
  );
}
```

- [ ] **Step 4: Run the tests — expect all to pass**

```
npm test -- HomeNewsWidget
```

Expected: all 5 tests PASS.

- [ ] **Step 5: Commit**

```bash
git add src/components/HomeNewsWidget.tsx src/components/HomeNewsWidget.test.tsx
git commit -m "feat: simplify news widget to hero card, high+medium only"
```

---

### Task 2: NewsScreen — remove impact chips, hard-code high+medium filter

**Files:**
- Modify: `src/NewsScreen.tsx`
- Test: `src/NewsScreen.test.tsx`

- [ ] **Step 1: Delete the failing impact-chip test and add a hard-coded filter test**

In `src/NewsScreen.test.tsx`, delete the test "hides medium-impact events when the MED chip is toggled off" (the last `it(...)` block) and add a replacement that verifies low-impact events never appear:

```tsx
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { DARK } from "./theme";

const today = new Date();
function isoAtHour(hour: number): string {
  const d = new Date(today);
  d.setHours(hour, 0, 0, 0);
  return d.toISOString();
}

const calendarValue = {
  fetched_at: new Date().toISOString(),
  events: [
    {
      id: "ev-today-am",
      title: "Today AM event",
      country: "USD",
      time: isoAtHour(8),
      impact: "high",
      forecast: "3.2%",
      previous: "3.4%",
      actual: null,
    },
    {
      id: "ev-today-pm",
      title: "Today PM event",
      country: "USD",
      time: isoAtHour(14),
      impact: "medium",
      forecast: null,
      previous: null,
      actual: null,
    },
    {
      id: "ev-today-low",
      title: "Today low event",
      country: "USD",
      time: isoAtHour(16),
      impact: "low",
      forecast: null,
      previous: null,
      actual: null,
    },
    {
      id: "ev-next-week",
      title: "Next week event",
      country: "USD",
      time: new Date(today.getTime() + 10 * 24 * 3600 * 1000).toISOString(),
      impact: "low",
      forecast: null,
      previous: null,
      actual: null,
    },
  ],
};

const headlinesValue = {
  fetched_at: new Date().toISOString(),
  articles: [
    {
      id: "a1",
      title: "First headline",
      source: "Reuters",
      url: "https://example.com/a1",
      published_at: new Date(Date.now() - 3600_000).toISOString(),
      snippet: null,
    },
  ],
};

interface Row { value: unknown }
let rows: Record<string, Row | null> = {};

vi.mock("./lib/supabase", () => ({
  supabase: {
    from: (_table: string) => ({
      select: (_cols: string) => ({
        eq: (_col: string, key: string) => ({
          maybeSingle: async () => ({ data: rows[key] ?? null, error: null }),
        }),
      }),
    }),
  },
}));

import { NewsScreen } from "./NewsScreen";

describe("NewsScreen", () => {
  beforeEach(() => {
    rows = {
      koda_news_calendar:  { value: calendarValue },
      koda_news_headlines: { value: headlinesValue },
    };
  });

  it("renders today high and medium events, hides low-impact and next-week events", async () => {
    render(<NewsScreen C={DARK} />);
    expect(await screen.findByText("Today AM event")).toBeInTheDocument();
    expect(screen.getByText("Today PM event")).toBeInTheDocument();
    expect(screen.queryByText("Today low event")).not.toBeInTheDocument();
    expect(screen.queryByText("Next week event")).not.toBeInTheDocument();
  });

  it("switches to Week filter and shows high+medium events within the next 7 days", async () => {
    render(<NewsScreen C={DARK} />);
    await screen.findByText("Today AM event");
    await userEvent.click(screen.getByRole("button", { name: /^WEEK$/i }));
    expect(screen.getByText("Today AM event")).toBeInTheDocument();
    expect(screen.queryByText("Next week event")).not.toBeInTheDocument();
  });

  it("renders the headlines feed", async () => {
    render(<NewsScreen C={DARK} />);
    expect(await screen.findByText("First headline")).toBeInTheDocument();
    const link = screen.getByText("First headline").closest("a");
    expect(link).toHaveAttribute("href", "https://example.com/a1");
    expect(link).toHaveAttribute("target", "_blank");
    expect(link).toHaveAttribute("rel", "noopener noreferrer");
  });

  it("expands forecast/previous/actual when an event card with details is tapped", async () => {
    render(<NewsScreen C={DARK} />);
    expect(await screen.findByText("Today AM event")).toBeInTheDocument();
    expect(screen.queryByText("3.2%")).not.toBeInTheDocument();
    await userEvent.click(screen.getByText("Today AM event"));
    expect(await screen.findByText("3.2%")).toBeInTheDocument();
    expect(screen.getByText("3.4%")).toBeInTheDocument();
    expect(screen.getByText("FORECAST")).toBeInTheDocument();
    expect(screen.getByText("PREVIOUS")).toBeInTheDocument();
    expect(screen.getByText("ACTUAL")).toBeInTheDocument();
  });

  it("does not render impact filter chip buttons", async () => {
    render(<NewsScreen C={DARK} />);
    await screen.findByText("Today AM event");
    expect(screen.queryByRole("button", { name: /HIGH/i, pressed: true })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /MED/i })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /LOW/i })).not.toBeInTheDocument();
  });
});
```

- [ ] **Step 2: Run the tests — expect failures on impact-chip assertions**

```
npm test -- NewsScreen
```

Expected: "does not render impact filter chip buttons" FAILS (chips still exist in the component).

- [ ] **Step 3: Update NewsScreen.tsx — remove impact filter state and chips JSX**

Apply these changes to `src/NewsScreen.tsx`:

**a) Remove `ALL_IMPACTS` constant (line 102):**
```tsx
// DELETE this line:
const ALL_IMPACTS: ReadonlyArray<Impact> = ["high", "medium", "low", "holiday"];
```

**b) Remove `impactFilter` state (line 123) and `toggleImpact` function (lines 147-155):**
```tsx
// DELETE these lines from the component body:
const [impactFilter, setImpactFilter] = useState<Set<Impact>>(() => new Set(ALL_IMPACTS));

function toggleImpact(impact: Impact) {
  setImpactFilter(prev => {
    const next = new Set(prev);
    if (next.has(impact)) next.delete(impact);
    else next.add(impact);
    if (next.size === 0) return prev;
    return next;
  });
}
```

**c) Update `filteredEvents` memo — replace the impact filter line:**

Current:
```tsx
const filteredEvents = useMemo<CalendarEvent[]>(() => {
  const events = calendar?.items ?? [];
  const [from, to] = rangeWindow(range);
  return events
    .filter(e => !usdOnly || e.country === "USD")
    .filter(e => impactFilter.has(e.impact))
    .filter(e => {
      const t = new Date(e.time).getTime();
      return t >= from.getTime() && t <= to.getTime();
    })
    .sort((a, b) => new Date(a.time).getTime() - new Date(b.time).getTime());
}, [calendar, range, impactFilter, usdOnly]);
```

Replace with:
```tsx
const filteredEvents = useMemo<CalendarEvent[]>(() => {
  const events = calendar?.items ?? [];
  const [from, to] = rangeWindow(range);
  return events
    .filter(e => !usdOnly || e.country === "USD")
    .filter(e => e.impact === "high" || e.impact === "medium")
    .filter(e => {
      const t = new Date(e.time).getTime();
      return t >= from.getTime() && t <= to.getTime();
    })
    .sort((a, b) => new Date(a.time).getTime() - new Date(b.time).getTime());
}, [calendar, range, usdOnly]);
```

**d) Remove the impact chips from JSX. Delete the entire `ALL_IMPACTS.map(...)` block inside the filter row div:**

Current (lines ~255–294):
```tsx
{/* Impact + country filter chips */}
<div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
  <button
    type="button"
    aria-pressed={usdOnly}
    onClick={() => setUsdOnly(v => !v)}
    style={{ ... }}
  >
    {usdOnly ? "USD ONLY" : "ALL FX"}
  </button>
  {ALL_IMPACTS.map(imp => {
    const active = impactFilter.has(imp);
    const color = impactColor(C, imp);
    return (
      <button
        key={imp}
        type="button"
        aria-pressed={active}
        onClick={() => toggleImpact(imp)}
        style={{ ... }}
      >
        <span style={{ ... }} />
        {imp.toUpperCase()}
      </button>
    );
  })}
</div>
```

Replace with (keep only the USD toggle, remove the chips map):
```tsx
{/* Country filter */}
<div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
  <button
    type="button"
    aria-pressed={usdOnly}
    onClick={() => setUsdOnly(v => !v)}
    style={{
      display: "inline-flex",
      alignItems: "center",
      gap: 6,
      padding: "5px 10px",
      borderRadius: 999,
      border: `1px solid ${usdOnly ? C.accent : C.border}`,
      background: C.panel,
      color: usdOnly ? C.text : C.muted,
      fontFamily: MONO,
      fontSize: 9,
      letterSpacing: "0.08em",
      fontWeight: 600,
      cursor: "pointer",
      opacity: usdOnly ? 1 : 0.7,
    }}
  >
    {usdOnly ? "USD ONLY" : "ALL FX"}
  </button>
</div>
```

- [ ] **Step 4: Run the tests — expect all to pass**

```
npm test -- NewsScreen
```

Expected: all 5 tests PASS.

- [ ] **Step 5: Commit**

```bash
git add src/NewsScreen.tsx src/NewsScreen.test.tsx
git commit -m "feat: remove impact filter chips from news tab, hard-code high+medium"
```

---

### Task 3: Koda.tsx — swap announcement above HomeNewsWidget

**Files:**
- Modify: `src/Koda.tsx`

*Note: Koda.tsx has no unit test coverage for render order (it's the full app shell). This change is a JSX block swap only — no logic change. Verify visually in the browser after this commit.*

- [ ] **Step 1: Swap the JSX render order in the home feed**

In `src/Koda.tsx`, find the `homeSection === "feed"` block (around line 1714). The current order is `<HomeNewsWidget>` then announcement. Swap them:

Current:
```tsx
{homeSection === "feed" && (
  <div>
    <HomeNewsWidget C={C} onOpenNews={() => primaryNav("news")} />
    {announcement && announcement.id !== announcementDismissedId && (
      <div style={{ display: "flex", alignItems: "flex-start", gap: "12px", background: `color-mix(in oklch, ${C.accent ?? "#60a5fa"} 8%, ${C.panel})`, border: `1px solid color-mix(in oklch, ${C.accent ?? "#60a5fa"} 25%, transparent)`, borderRadius: "12px", padding: "14px 16px", marginBottom: "16px" }}>
        <div style={{ flex: 1 }}>
          <div style={{ fontFamily: MONO, fontSize: "9px", color: C.accent ?? "#60a5fa", letterSpacing: "0.14em", textTransform: "uppercase" as const, fontWeight: 700, marginBottom: "4px" }}>Kōda Team</div>
          <div style={{ fontFamily: BODY, fontSize: "13px", color: C.text, lineHeight: 1.5 }}>{announcement.message}</div>
        </div>
        <button onClick={() => {
          try { localStorage.setItem("koda_announcement_dismissed", announcement.id); } catch {}
          setAnnouncementDismissedId(announcement.id);
        }} style={{ background: "none", border: "none", color: C.muted, cursor: "pointer", fontSize: "18px", padding: "0 0 0 4px", lineHeight: 1, flexShrink: 0 }}>×</button>
      </div>
    )}
```

Replace with:
```tsx
{homeSection === "feed" && (
  <div>
    {announcement && announcement.id !== announcementDismissedId && (
      <div style={{ display: "flex", alignItems: "flex-start", gap: "12px", background: `color-mix(in oklch, ${C.accent ?? "#60a5fa"} 8%, ${C.panel})`, border: `1px solid color-mix(in oklch, ${C.accent ?? "#60a5fa"} 25%, transparent)`, borderRadius: "12px", padding: "14px 16px", marginBottom: "16px" }}>
        <div style={{ flex: 1 }}>
          <div style={{ fontFamily: MONO, fontSize: "9px", color: C.accent ?? "#60a5fa", letterSpacing: "0.14em", textTransform: "uppercase" as const, fontWeight: 700, marginBottom: "4px" }}>Kōda Team</div>
          <div style={{ fontFamily: BODY, fontSize: "13px", color: C.text, lineHeight: 1.5 }}>{announcement.message}</div>
        </div>
        <button onClick={() => {
          try { localStorage.setItem("koda_announcement_dismissed", announcement.id); } catch {}
          setAnnouncementDismissedId(announcement.id);
        }} style={{ background: "none", border: "none", color: C.muted, cursor: "pointer", fontSize: "18px", padding: "0 0 0 4px", lineHeight: 1, flexShrink: 0 }}>×</button>
      </div>
    )}
    <HomeNewsWidget C={C} onOpenNews={() => primaryNav("news")} />
```

- [ ] **Step 2: Run the full test suite to confirm no regressions**

```
npm test
```

Expected: all tests PASS.

- [ ] **Step 3: Commit**

```bash
git add src/Koda.tsx
git commit -m "feat: show announcement banner above news widget on home feed"
```
