# Kōda — News Section Design

**Date:** 2026-06-01
**Author:** brainstorming session with Dylon
**Status:** Approved design, ready for implementation plan

---

## 1. Goal

Add a market-news section to Kōda that helps US futures traders see what economic events are coming and what headlines are moving the market. Free for all users; surfaces as a widget on the main Home dashboard and a dedicated page in the Home subnav.

## 2. Scope

### In scope
- US economic calendar (all USD events, all impact levels) — from ForexFactory free JSON feed
- US market headlines — from Marketaux free tier (100 reqs/day)
- Home widget: hero countdown (next high-impact event) + horizontal week strip
- Full News page accessed via Home subnav, with Today / Week / Month filter
- Server-side cache in Supabase (`shared_kv`) refreshed by Vercel Cron + GitHub Actions
- Free for all plans (Free / Pro / Elite)

### Out of scope (deferred)
- Push notifications for upcoming high-impact events
- Per-user filtering (region/impact/symbol-tied)
- In-app article reader (links open external for MVP)
- Earnings calendar
- Symbol-tagged headlines (NQ, ES, CL filtering)
- Paid data tiers
- Pro-gating

## 3. UX decisions

### Placement
- **News** added as a new entry in `HOME_SECTIONS` (Home tab's subnav dropdown), alongside Analytics, Rules & Checklist, Sync & Log, Journal.
- **Home widget** lives at the top of the main Home view (`homeSection === "feed"`).
- No new top-level tab. No change to bottom nav.

### Home widget — "Hero + strip" (option D)
- A prominent card on top: next high-impact US event, name, local time, **live countdown** ticking every 60s.
- Below: horizontal scrollable strip of the next 4-6 upcoming events with day/time/impact color.
- Tapping anywhere on the widget calls `setHomeSection("news")` → opens the full News page.

### Full News page — "Stacked with filter" (option A)
- Top: pill toggle — **Today** (default) / **Week** / **Month**.
- Section 1: **Economic calendar** — list of events for the chosen window, with time (local), title, impact bar (left border), forecast / previous / actual when present.
- Section 2: **Headlines** — feed of recent articles, each with title, source, "Xh ago", tap → external URL in new tab.
- Single vertical scroll. Mobile-first.

### Impact colors
- High: red close to `#FF4D4D` (match existing danger usage in codebase)
- Medium: amber `#FFA500`
- Low: `C.muted`

### Time display
- All times stored in UTC.
- Display in the user's local timezone via `Intl.DateTimeFormat(undefined, { hour: "2-digit", minute: "2-digit" })`.
- Countdown is `eventTimeUTC - now()`, ticking every 60s via `setInterval` (cleared on unmount).

## 4. Data sources

| Source | Endpoint | Auth | Rate limit | Refresh cadence |
|--------|----------|------|------------|-----------------|
| ForexFactory (calendar) | `https://nfs.faireconomy.media/ff_calendar_thisweek.json` | none | none published | once daily |
| Marketaux (headlines)   | `https://api.marketaux.com/v1/news/all?countries=us&limit=20&language=en&api_token=<KEY>` | API key | 100 reqs/day free | every 30 min (≈48/day) |

Both upstreams are accessed **only from the server**. The client never sees keys or hits external endpoints.

## 5. Architecture

```
ForexFactory JSON  ─┐                           Marketaux  ─┐
                    │                                       │
              (daily)│                              (every 30m)│
                    ▼                                       ▼
       Vercel Cron ─►  GET /api/cron?job=news-calendar      │
                                                            │
       GitHub Actions ─►  GET /api/cron?job=news-headlines ◄┘
                              │
                              ▼ validate + upsert
                       Supabase shared_kv
                       ├─ koda_news_calendar
                       └─ koda_news_headlines
                              │
                              ▼ read (RLS: public select)
                       Client (Koda.tsx)
                       ├─ <HomeNewsWidget /> on home feed
                       └─ <NewsScreen /> when homeSection === "news"
```

Function count: stays at **10/12**. No new `api/*.ts` file — both refresh routes are added to the existing `api/cron.ts` router.

## 6. Server side

### 6.1 Routes added to `api/cron.ts`

Both follow the existing `daily-digest` pattern:

```ts
// Inside the router (current default handler at L517 onward)
if (job === "news-calendar")  return handleNewsCalendar(req, res);
if (job === "news-headlines") return handleNewsHeadlines(req, res);
```

Each handler:
1. Gate with `isCronAuthed(req)` — same `Bearer CRON_SECRET` check used elsewhere.
2. `fetch()` the upstream URL with a 10s timeout (`AbortController`).
3. Parse + validate the response (see §6.4).
4. On valid payload: `getAdminClient().from("shared_kv").upsert({ key, value, owner_id })`.
5. On validation failure: log via `console.error`, return `200 { ok: false, reason }`, **do not overwrite the cache**.
6. Return `200 { ok: true, count: events.length }`.

### 6.2 Vercel Cron — `vercel.json`

Add one entry:

```json
{ "path": "/api/cron?job=news-calendar", "schedule": "0 11 * * *" }
```

`0 11 * * *` = 11:00 UTC daily ≈ 6:00am ET, before US session opens (calendar items don't change minute-to-minute; daily refresh is enough; gives traders fresh data each morning).

### 6.3 GitHub Actions — `.github/workflows/news-cron.yml`

Modeled directly on `.github/workflows/sync-cron.yml`:

```yaml
name: news-headlines-cron
on:
  schedule:
    - cron: "*/30 * * * *"
  workflow_dispatch:
jobs:
  refresh:
    runs-on: ubuntu-latest
    timeout-minutes: 2
    steps:
      - name: Trigger news refresh
        run: |
          STATUS=$(curl -s -o /dev/null -w "%{http_code}" \
            -X GET "https://kodatrade.co.uk/api/cron?job=news-headlines" \
            -H "Authorization: Bearer ${{ secrets.CRON_SECRET }}" \
            --max-time 60)
          echo "Response status: $STATUS"
          if [ "$STATUS" -lt 200 ] || [ "$STATUS" -ge 300 ]; then
            echo "News refresh returned $STATUS — failing the job"
            exit 1
          fi
```

Uses the existing `CRON_SECRET` GitHub Action secret.

### 6.4 Validation rules

Refuse to overwrite the cache unless **all** are true:

- Response is HTTP 200.
- Response body parses as JSON.
- Body is the expected shape (array for ForexFactory; object with `data: []` for Marketaux).
- Array is non-empty.
- Every item has the required fields (calendar: `title`, `country`, `date`, `impact`; headlines: `title`, `url`, `published_at`, `source`).

ForexFactory `impact` is one of `"High" | "Medium" | "Low" | "Holiday"` — normalize to lowercase. Any unexpected value falls back to `"low"`.

### 6.5 Cache shape — `shared_kv`

Both keys owned by sentinel UUID `'00000000-0000-0000-0000-000000000000'::uuid` (same pattern as announcements / KODA-GLOBAL).

**`koda_news_calendar`:**
```json
{
  "fetched_at": "2026-06-01T11:00:00.000Z",
  "events": [
    {
      "id": "ff-cpi-yoy-2026-06-03",
      "title": "CPI (YoY)",
      "country": "USD",
      "time": "2026-06-03T12:30:00.000Z",
      "impact": "high",
      "forecast": "3.2%",
      "previous": "3.4%",
      "actual": null
    }
  ]
}
```

ForexFactory doesn't expose stable event IDs. The cron job derives `id` as `ff-<kebab-cased-title>-<YYYY-MM-DD>` — stable across refreshes so React keys + dismissals (future enhancement) work correctly.

**`koda_news_headlines`:**
```json
{
  "fetched_at": "2026-06-01T11:30:00.000Z",
  "articles": [
    {
      "id": "marketaux-uuid",
      "title": "Fed's Powell: Inflation progress has slowed",
      "source": "Reuters",
      "url": "https://reuters.com/…",
      "published_at": "2026-06-01T09:14:00.000Z",
      "snippet": "Chair Powell said the central bank…"
    }
  ]
}
```

Impact values normalized to lowercase: `"high" | "medium" | "low" | "holiday"`.

### 6.6 New env vars

| Name | Where | Purpose |
|------|-------|---------|
| `MARKETAUX_API_KEY` | Vercel (server-only — not `VITE_*`) | Marketaux API token |

Must also be added to `.env.example` and to the env table in `CLAUDE.md`.

## 7. Client side

### 7.1 New files

```
src/
├── hooks/
│   └── useNews.ts          ─ data hook (load, parse, refresh)
├── components/
│   └── HomeNewsWidget.tsx  ─ hero + week strip on Home feed
├── lib/
│   └── news.ts             ─ types + parse helpers
└── NewsScreen.tsx          ─ full News page
```

### 7.2 `src/lib/news.ts` — types & parse helpers

```ts
export type Impact = "high" | "medium" | "low" | "holiday";

export interface CalendarEvent {
  id: string;
  title: string;
  country: string;            // "USD" for v1
  time: string;               // ISO UTC
  impact: Impact;
  forecast: string | null;
  previous: string | null;
  actual: string | null;
}

export interface Headline {
  id: string;
  title: string;
  source: string;
  url: string;
  publishedAt: string;        // ISO UTC
  snippet: string | null;
}

export interface NewsCache<T> {
  fetchedAt: string;          // ISO UTC
  items: T[];
}

// Type-guard parsers — never throw, return null on bad input.
export function parseCalendarCache(raw: unknown): NewsCache<CalendarEvent> | null { … }
export function parseHeadlinesCache(raw: unknown): NewsCache<Headline> | null { … }
```

No `: any`. Use `unknown` + explicit guards (codebase pre-commit hook rejects `: any`).

### 7.3 `src/hooks/useNews.ts`

```ts
export interface UseNews {
  calendar: NewsCache<CalendarEvent> | null;
  headlines: NewsCache<Headline> | null;
  isLoading: boolean;
  refresh: () => Promise<void>;
}

export function useNews(): UseNews { … }
```

Behavior:
- On mount, calls `storage.get("koda_news_calendar")` and `storage.get("koda_news_headlines")` in parallel.
- Parses with the helpers from §7.2. Bad data → `null` for that slice (UI shows empty state).
- Re-fetches when the window regains focus (`visibilitychange` event), so users opening the PWA after a break see fresh data.
- No polling. No Realtime subscription (data changes at most once every 30 min).
- `alive` guard pattern (already used throughout `Koda.tsx`) so unmount doesn't set state on a stale promise.

### 7.4 `src/components/HomeNewsWidget.tsx`

Props: `{ onOpenNews: () => void; C: Theme }`.

Renders:
- **Hero card** — preferred: next event where `impact === "high"` and `time > now`. Fallback if no upcoming high-impact event in the cached window: next event of any impact. Shows: small `NEXT EVENT · <IMPACT>` label colored by impact, event title, live countdown (`Xh Ym`), event local time. Tapping the card calls `onOpenNews()`.
- **Week strip** — horizontal scroll of the next 4-6 upcoming events (any impact). Each card: day/time, short title, impact color on top border.
- **Empty state** — if `calendar === null` or no upcoming events, render a single muted line: `"News loading — check back in a few minutes."`
- **Countdown** — `useEffect` with `setInterval(tick, 60_000)`. Tick computes `eventTime - now()` and re-renders. Clean up on unmount.

### 7.5 `src/NewsScreen.tsx`

Props: `{ C: Theme }`.

Renders:
- **Filter pills** — Today / Week / Month. Default: Today. State held locally.
- **Calendar section** — filtered list. Each row: time (left, monospace), title, impact bar (left border), forecast / previous / actual when present. Past events get reduced opacity.
- **Headlines section** — under the calendar. List of `Headline` rows. Each row: title, source · "Xh ago", tap → `window.open(url, "_blank", "noopener,noreferrer")`.
- **Empty states:**
  - Today filter with no events → "No US events today — quiet session ahead."
  - No headlines cached → "Headlines loading — check back in a few minutes."
- **Stale indicator** — if `Date.now() - fetchedAt > 24h`, show small `Last updated Xh ago` under the section header in a muted color.
- **Pull-to-refresh** — out of scope for v1. `refresh()` is exposed by the hook but not wired to gesture.

### 7.6 Wiring in `src/Koda.tsx`

Three edits:

1. **`HOME_SECTIONS` (currently L1369)** — add `{ id: "news", label: "News" }` between `Analytics` and `Rules & Checklist`.

2. **Inside `homeSection === "feed"` block (currently around L1679)** — mount the widget near the top of the feed view, before the existing P&L / stats cards:
   ```tsx
   <HomeNewsWidget onOpenNews={() => setHomeSection("news")} C={C} />
   ```

3. **Add a new render block** after the existing `homeSection === "settings"` block:
   ```tsx
   {homeSection === "news" && <NewsScreen C={C} />}
   ```

That's the entire UI integration. No tab-bar change, no router change.

## 8. Empty / error states summary

| State | UI |
|-------|-----|
| No cache (first deploy, before first cron run) | "News loading — check back in a few minutes." |
| Today filter, no events for today | "No US events today — quiet session ahead." |
| `fetched_at` older than 24h | Subtle "Last updated Xh ago" muted text under section header. Data still renders. |
| Upstream returned malformed payload (server) | Cron job logs error, returns 200, **does not overwrite cache**. Client keeps showing previous data. |
| Single record fails to parse (client) | Skip it, render the rest. |
| Network offline | localStorage fallback in `storage.ts` shim continues to serve last cached payload. |

## 9. Verification plan

Per CLAUDE.md Rule 3 — "Prove it works." Before marking the feature done:

1. **Server smoke:**
   - `curl -H "Authorization: Bearer $CRON_SECRET" https://kodatrade.co.uk/api/cron?job=news-calendar` → 200 with `{ ok: true, count: N }`.
   - Same for `news-headlines`.
   - Verify both `shared_kv` rows exist via Supabase SQL Editor.
2. **Cron sanity:**
   - Manually trigger the GitHub Action via `workflow_dispatch`; verify it returns 2xx in the Actions log.
   - Inspect the Vercel cron run log for `news-calendar`.
3. **Client smoke (mobile + desktop browsers):**
   - Load Home — widget shows next event + countdown ticks every minute.
   - Tap widget → routes to News page.
   - Switch Today / Week / Month filters — calendar list updates correctly.
   - Tap a headline → external link opens in new tab.
   - Force-reload with DevTools Network → Offline — cached data still renders.
4. **Failure modes:**
   - Manually set `koda_news_calendar` to `{}` in `shared_kv` — client shows empty state, doesn't crash.
   - Manually set `fetched_at` to 2 days ago — client shows stale indicator.

## 10. Implementation order (suggested)

1. Add `MARKETAUX_API_KEY` to Vercel + `.env.example` + CLAUDE.md env table.
2. Add the two route handlers + helpers to `api/cron.ts`. Manually trigger each to populate the cache.
3. Add `vercel.json` cron entry for calendar and deploy; confirm scheduled run.
4. Add `.github/workflows/news-cron.yml` and `CRON_SECRET` secret; trigger workflow_dispatch.
5. Build `src/lib/news.ts` (types + parsers).
6. Build `src/hooks/useNews.ts`.
7. Build `src/components/HomeNewsWidget.tsx`.
8. Build `src/NewsScreen.tsx`.
9. Wire into `src/Koda.tsx` (3 edits in §7.6).
10. Run the §9 verification.

## 11. Open trade-offs (for record)

- **Cron uses Vercel daily + GitHub Actions sub-daily.** Same pattern as broker sync. Adds one more workflow file to maintain.
- **No Realtime.** Client reads cache on mount/focus. If a user keeps the app open during a refresh window they won't see new data until focus. Acceptable for v1.
- **API keys + Marketaux quota.** 100 reqs/day = ~48 reqs at 30-min cadence with margin. If quota becomes a concern, drop cadence to every 60 min (24/day).
- **Function slot pressure.** Reusing `api/cron.ts` avoids hitting 11/12. If the cron file ever gets unwieldy, the news jobs can be split out later.
- **ForexFactory schema.** Third-party feed could change without notice. Defensive validation + cache-keeps-previous-on-failure mitigates.
