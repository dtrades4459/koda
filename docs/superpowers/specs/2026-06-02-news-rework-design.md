# News Widget & Tab Rework

**Date:** 2026-06-02  
**Scope:** HomeNewsWidget, NewsScreen, Koda.tsx home feed order

## Summary

Three surgical changes: (1) move the Kōda Team announcement banner above the news widget on the home feed, (2) simplify the home news widget to a single hero countdown card showing only high/medium impact events, (3) remove the impact filter chips from the news tab and hard-code to high+medium only.

## Changes

### 1. `src/Koda.tsx` — Home feed render order

Swap the JSX order in the `homeSection === "feed"` block so the announcement banner renders before `<HomeNewsWidget>`.

**Before:**
```
<HomeNewsWidget />
{announcement && <AnnouncementBanner />}
```

**After:**
```
{announcement && <AnnouncementBanner />}
<HomeNewsWidget />
```

No logic change. The announcement already has its own dismiss/visibility guard.

### 2. `src/components/HomeNewsWidget.tsx` — Hero card only, high+medium filter

**`upcoming` memo:** Add impact filter — include only `"high"` and `"medium"` events.

**`hero` memo:** Change selection to `upcoming[0]` (the next high-or-medium event). Previously it searched for the next `"high"` event first, falling back to `upcoming[0]`. With the upstream filter applied, `upcoming[0]` is always the right pick.

**`strip` memo:** Delete entirely.

**JSX:** Delete the strip `<div>` and its map. Keep only the hero card button. Update label from `NEXT EVENT` to `NEXT HIGH/MED EVENT`.

**Empty state:** Already handles no-hero gracefully — no change needed.

### 3. `src/NewsScreen.tsx` — Remove impact chips, hard-code high+medium

**State:** Remove `impactFilter` state (`useState<Set<Impact>>`), `toggleImpact` function, and the `ALL_IMPACTS` constant (only used for the chips).

**`filteredEvents` memo:** Replace `.filter(e => impactFilter.has(e.impact))` with `.filter(e => e.impact === "high" || e.impact === "medium")`.

**JSX:** Delete the impact filter chips row (the `ALL_IMPACTS.map(...)` block and its wrapping `<div>`). The USD-only toggle stays in its own `<div>` on the same row, or can be left as-is if it was already separate.

**Keep:** Today/Week range pills, USD-only toggle, timezone picker, stale data badge.

## Out of Scope

- News tab section order (Economic Calendar is already above Headlines — no change)
- Headline/news article display — no changes
- Any data fetching or caching logic
- Test file updates (impact filter removal may require test updates to `NewsScreen.test.tsx` — handle as part of implementation)

## Test Impact

- `HomeNewsWidget.test.tsx`: Strip-related tests (if any exist for the strip) should be deleted. Hero card tests remain valid but may need event fixtures updated to include medium-impact events.
- `NewsScreen.test.tsx`: Tests for impact chip toggling should be deleted. Tests for filtering behavior should be updated to reflect hard-coded high+medium filter.
