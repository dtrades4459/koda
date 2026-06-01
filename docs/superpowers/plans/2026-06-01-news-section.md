# News Section Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a US-market news section to Kōda — economic calendar + headlines — surfaced as a widget on Home and a dedicated page in the Home subnav.

**Architecture:** Two Vercel-Cron-triggered handlers (added to existing `api/cron.ts` router) fetch ForexFactory + Marketaux and cache normalized JSON in Supabase `shared_kv`. Client reads via the existing `window.storage` shim through a `useNews()` hook. Free for all users, server-side keys only.

**Tech Stack:** React 19, TypeScript, Vitest + React Testing Library (unit), Playwright (e2e), Supabase (cache), Vercel Cron + GitHub Actions (refresh), Vite 8 PWA. **Spec:** `docs/superpowers/specs/2026-06-01-news-section-design.md`.

**Notes for the implementer:**
- This repo has **no git repo** — there are no `git commit` steps. After tests pass for a task, move on. Final deploy is `vercel --prod` from `C:\Users\Dylon\OneDrive\Desktop\koda`.
- Pre-commit hook (`husky` + `lint-staged`) rejects `: any` annotations. Use `unknown` + type guards.
- `src/Koda.tsx` is ~4150 lines and lives on OneDrive — use the `Edit` tool for targeted edits, never `Write` (truncation risk).
- Storage access pattern: `await window.storage.get("key", /* shared */ true)` for shared rows.
- Theme type: `import type { Theme } from "./theme"`. Token names: `panel`, `panel2`, `border`, `border2`, `text`, `text2`, `muted`, `accent`, `green`, `red`, `warn`. Fonts: `MONO`, `BODY`, `DISPLAY` from `src/shared.tsx`.

---

## Task 1: Document the new env var

**Files:**
- Modify: `.env.example`
- Modify: `CLAUDE.md` (env table around L125-150)

- [ ] **Step 1: Add `MARKETAUX_API_KEY` to `.env.example`**

Append at the end of `.env.example`:

```
# ── Market news (server-only) ──────────────────────────────────────────────────
# Marketaux free tier (sign up at marketaux.com). 100 reqs/day cap.
MARKETAUX_API_KEY=your-marketaux-api-token-here
```

- [ ] **Step 2: Add a row to the env table in `CLAUDE.md`**

Find the env-var table (currently includes `STRIPE_*`, `RESEND_API_KEY`, etc.) and append a row:

```
| `MARKETAUX_API_KEY` | Marketaux free-tier API token — used by `api/cron.ts` news-headlines job |
```

- [ ] **Step 3: Verify lint + typecheck still pass**

```powershell
npm run lint
npm run typecheck
```

Expected: no errors.

- [ ] **Step 4: Operator action (not code)**

Tell Dylon: "Add `MARKETAUX_API_KEY` in Vercel Dashboard → Project Settings → Environment Variables (Production scope). Get the token from https://www.marketaux.com after signing up for the free tier." Do not block subsequent tasks on this — the cron handler will return a clear error if the key is missing.

---

## Task 2: Types and parsers — `src/lib/news.ts`

**Files:**
- Create: `src/lib/news.ts`
- Create: `src/lib/news.test.ts`

- [ ] **Step 1: Write the failing test**

Create `src/lib/news.test.ts`:

```ts
import { describe, it, expect } from "vitest";
import {
  parseCalendarCache,
  parseHeadlinesCache,
  normaliseImpact,
  deriveCalendarId,
  type CalendarEvent,
  type Headline,
} from "./news";

describe("normaliseImpact", () => {
  it("lowercases known values", () => {
    expect(normaliseImpact("High")).toBe("high");
    expect(normaliseImpact("MEDIUM")).toBe("medium");
    expect(normaliseImpact("Low")).toBe("low");
    expect(normaliseImpact("Holiday")).toBe("holiday");
  });
  it("falls back to 'low' on unknown input", () => {
    expect(normaliseImpact("Tentative")).toBe("low");
    expect(normaliseImpact("")).toBe("low");
    expect(normaliseImpact(null)).toBe("low");
    expect(normaliseImpact(undefined)).toBe("low");
  });
});

describe("deriveCalendarId", () => {
  it("kebab-cases the title and appends YYYY-MM-DD from UTC", () => {
    expect(deriveCalendarId("CPI (YoY)", "2026-06-03T12:30:00.000Z")).toBe(
      "ff-cpi-yoy-2026-06-03",
    );
    expect(deriveCalendarId("ISM Services PMI", "2026-06-03T14:00:00.000Z")).toBe(
      "ff-ism-services-pmi-2026-06-03",
    );
  });
  it("collapses whitespace and strips non-alphanumerics", () => {
    expect(deriveCalendarId("Powell  speaks!", "2026-06-04T18:00:00.000Z")).toBe(
      "ff-powell-speaks-2026-06-04",
    );
  });
});

describe("parseCalendarCache", () => {
  it("returns null on non-object input", () => {
    expect(parseCalendarCache(null)).toBeNull();
    expect(parseCalendarCache("")).toBeNull();
    expect(parseCalendarCache(42)).toBeNull();
    expect(parseCalendarCache([])).toBeNull();
  });
  it("returns null when fetched_at or events is missing", () => {
    expect(parseCalendarCache({ events: [] })).toBeNull();
    expect(parseCalendarCache({ fetched_at: "2026-06-01T00:00:00Z" })).toBeNull();
  });
  it("parses a valid payload and skips malformed events", () => {
    const raw = {
      fetched_at: "2026-06-01T11:00:00.000Z",
      events: [
        {
          id: "ff-cpi-yoy-2026-06-03",
          title: "CPI (YoY)",
          country: "USD",
          time: "2026-06-03T12:30:00.000Z",
          impact: "high",
          forecast: "3.2%",
          previous: "3.4%",
          actual: null,
        },
        { title: "missing fields" },
        null,
      ],
    };
    const out = parseCalendarCache(raw);
    expect(out).not.toBeNull();
    expect(out?.fetchedAt).toBe("2026-06-01T11:00:00.000Z");
    expect(out?.items).toHaveLength(1);
    const ev: CalendarEvent = out!.items[0];
    expect(ev.title).toBe("CPI (YoY)");
    expect(ev.impact).toBe("high");
  });
});

describe("parseHeadlinesCache", () => {
  it("returns null on non-object input", () => {
    expect(parseHeadlinesCache(null)).toBeNull();
    expect(parseHeadlinesCache([])).toBeNull();
  });
  it("parses a valid payload and skips malformed articles", () => {
    const raw = {
      fetched_at: "2026-06-01T11:30:00.000Z",
      articles: [
        {
          id: "uuid-1",
          title: "Fed's Powell: Inflation has slowed",
          source: "Reuters",
          url: "https://reuters.com/a",
          published_at: "2026-06-01T09:14:00.000Z",
          snippet: "Chair Powell said...",
        },
        { title: "no url" },
      ],
    };
    const out = parseHeadlinesCache(raw);
    expect(out?.items).toHaveLength(1);
    const h: Headline = out!.items[0];
    expect(h.url).toBe("https://reuters.com/a");
    expect(h.source).toBe("Reuters");
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

```powershell
npm test -- src/lib/news.test.ts
```

Expected: FAIL with "Cannot find module './news'" or similar.

- [ ] **Step 3: Create `src/lib/news.ts`**

```ts
// ═══════════════════════════════════════════════════════════════════════════════
// Kōda · News types & cache parsers
//
// The news pipeline stores normalized JSON in shared_kv under two keys:
//   - koda_news_calendar  (refreshed daily by Vercel Cron)
//   - koda_news_headlines (refreshed every 30 min by GitHub Actions)
//
// These helpers parse the raw rows defensively so a single malformed item
// doesn't blank the whole feed.
// ═══════════════════════════════════════════════════════════════════════════════

export type Impact = "high" | "medium" | "low" | "holiday";

export interface CalendarEvent {
  id: string;
  title: string;
  country: string;             // "USD" for v1
  time: string;                // ISO UTC
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
  publishedAt: string;         // ISO UTC
  snippet: string | null;
}

export interface NewsCache<T> {
  fetchedAt: string;           // ISO UTC
  items: T[];
}

const IMPACTS: ReadonlySet<Impact> = new Set(["high", "medium", "low", "holiday"]);

export function normaliseImpact(raw: unknown): Impact {
  if (typeof raw !== "string") return "low";
  const lower = raw.trim().toLowerCase();
  return IMPACTS.has(lower as Impact) ? (lower as Impact) : "low";
}

export function deriveCalendarId(title: string, timeIso: string): string {
  const slug = title
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
  const day = timeIso.slice(0, 10);  // "YYYY-MM-DD"
  return `ff-${slug}-${day}`;
}

function isRecord(v: unknown): v is Record<string, unknown> {
  return typeof v === "object" && v !== null && !Array.isArray(v);
}

function asString(v: unknown): string | null {
  return typeof v === "string" && v.length > 0 ? v : null;
}

function parseCalendarEvent(raw: unknown): CalendarEvent | null {
  if (!isRecord(raw)) return null;
  const title = asString(raw.title);
  const country = asString(raw.country);
  const time = asString(raw.time);
  if (!title || !country || !time) return null;
  const id = asString(raw.id) ?? deriveCalendarId(title, time);
  return {
    id,
    title,
    country,
    time,
    impact: normaliseImpact(raw.impact),
    forecast: asString(raw.forecast),
    previous: asString(raw.previous),
    actual: asString(raw.actual),
  };
}

function parseHeadline(raw: unknown): Headline | null {
  if (!isRecord(raw)) return null;
  const title = asString(raw.title);
  const url = asString(raw.url);
  const source = asString(raw.source);
  const publishedAt = asString(raw.published_at);
  if (!title || !url || !source || !publishedAt) return null;
  const id = asString(raw.id) ?? `${source}-${publishedAt}`;
  return {
    id,
    title,
    source,
    url,
    publishedAt,
    snippet: asString(raw.snippet),
  };
}

export function parseCalendarCache(raw: unknown): NewsCache<CalendarEvent> | null {
  if (!isRecord(raw)) return null;
  const fetchedAt = asString(raw.fetched_at);
  const events = raw.events;
  if (!fetchedAt || !Array.isArray(events)) return null;
  const items = events
    .map(parseCalendarEvent)
    .filter((e): e is CalendarEvent => e !== null);
  return { fetchedAt, items };
}

export function parseHeadlinesCache(raw: unknown): NewsCache<Headline> | null {
  if (!isRecord(raw)) return null;
  const fetchedAt = asString(raw.fetched_at);
  const articles = raw.articles;
  if (!fetchedAt || !Array.isArray(articles)) return null;
  const items = articles
    .map(parseHeadline)
    .filter((h): h is Headline => h !== null);
  return { fetchedAt, items };
}
```

- [ ] **Step 4: Run the test to verify it passes**

```powershell
npm test -- src/lib/news.test.ts
```

Expected: PASS, all suites green.

- [ ] **Step 5: Run lint + typecheck**

```powershell
npm run lint
npm run typecheck
```

Expected: no errors.

---

## Task 3: Server handler — `news-calendar`

**Files:**
- Modify: `api/cron.ts` (add handler + router branch)

- [ ] **Step 1: Add the handler near the bottom of `api/cron.ts`, just above the `// Router` comment block (currently around L513)**

```ts
// ══════════════════════════════════════════════════════════════════════════════
// Job: news-calendar  (ForexFactory → shared_kv)
// ══════════════════════════════════════════════════════════════════════════════

const FF_URL = "https://nfs.faireconomy.media/ff_calendar_thisweek.json";
const NEWS_OWNER_ID = "00000000-0000-0000-0000-000000000000";

type FFEvent = {
  title?: string;
  country?: string;
  date?: string;
  impact?: string;
  forecast?: string;
  previous?: string;
  actual?: string;
};

function kebab(s: string): string {
  return s.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "");
}

function normaliseFFEvent(raw: FFEvent): Record<string, unknown> | null {
  if (!raw.title || !raw.country || !raw.date) return null;
  const time = raw.date;
  const impactRaw = (raw.impact ?? "").toLowerCase();
  const impact = ["high", "medium", "low", "holiday"].includes(impactRaw)
    ? impactRaw
    : "low";
  const day = time.slice(0, 10);
  const id = `ff-${kebab(raw.title)}-${day}`;
  return {
    id,
    title: raw.title,
    country: raw.country,
    time,
    impact,
    forecast: raw.forecast ?? null,
    previous: raw.previous ?? null,
    actual: raw.actual ?? null,
  };
}

async function handleNewsCalendar(req: Req, res: Res) {
  if (!isCronAuthed(req)) return res.status(401).json({ error: "Unauthorized" });

  try {
    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), 10_000);
    const upstream = await fetch(FF_URL, { signal: ctrl.signal });
    clearTimeout(timer);

    if (!upstream.ok) {
      console.error("[news-calendar] upstream non-200:", upstream.status);
      return res.status(200).json({ ok: false, reason: `upstream ${upstream.status}` });
    }
    const raw = (await upstream.json()) as unknown;
    if (!Array.isArray(raw) || raw.length === 0) {
      console.error("[news-calendar] upstream returned empty/invalid array");
      return res.status(200).json({ ok: false, reason: "empty upstream" });
    }

    const events: Record<string, unknown>[] = [];
    for (const item of raw) {
      const ev = normaliseFFEvent(item as FFEvent);
      if (ev) events.push(ev);
    }
    if (events.length === 0) {
      console.error("[news-calendar] no valid events after normalization");
      return res.status(200).json({ ok: false, reason: "no valid events" });
    }

    const admin = getAdminClient();
    const value = { fetched_at: new Date().toISOString(), events };
    const { error } = await admin.from("shared_kv").upsert({
      key: "koda_news_calendar",
      value,
      owner_id: NEWS_OWNER_ID,
    });
    if (error) {
      console.error("[news-calendar] upsert error:", error);
      return res.status(500).json({ error: error.message });
    }

    return res.status(200).json({ ok: true, count: events.length });
  } catch (err) {
    console.error("[news-calendar] failed:", err);
    return res.status(200).json({ ok: false, reason: "exception" });
  }
}
```

- [ ] **Step 2: Add the router branch**

In the `handler` function at the bottom of `api/cron.ts`, find the line:

```ts
if (job === "sync")                return handleSync(req, res);
```

Insert immediately after it:

```ts
  if (job === "news-calendar")       return handleNewsCalendar(req, res);
```

Then update the error message at the end of the handler:

```ts
  return res.status(400).json({ error: "?job= required: complete-challenges | sync | daily-digest | news-calendar | news-headlines" });
```

- [ ] **Step 3: Run lint + typecheck**

```powershell
npm run lint
npm run typecheck
```

Expected: no errors.

- [ ] **Step 4: Smoke test locally**

The handler runs in Vercel's Node runtime; it can be smoke-tested on the deployed preview after Task 5. Don't deploy yet — keep going.

---

## Task 4: Server handler — `news-headlines`

**Files:**
- Modify: `api/cron.ts` (add handler + router branch)

- [ ] **Step 1: Add the handler in `api/cron.ts`, immediately below `handleNewsCalendar`**

```ts
// ══════════════════════════════════════════════════════════════════════════════
// Job: news-headlines  (Marketaux → shared_kv)
// ══════════════════════════════════════════════════════════════════════════════

const MARKETAUX_URL = "https://api.marketaux.com/v1/news/all";

type MarketauxArticle = {
  uuid?: string;
  title?: string;
  description?: string;
  url?: string;
  source?: string;
  published_at?: string;
};

function normaliseMarketauxArticle(raw: MarketauxArticle): Record<string, unknown> | null {
  if (!raw.title || !raw.url || !raw.source || !raw.published_at) return null;
  return {
    id: raw.uuid ?? `${raw.source}-${raw.published_at}`,
    title: raw.title,
    source: raw.source,
    url: raw.url,
    published_at: raw.published_at,
    snippet: raw.description ?? null,
  };
}

async function handleNewsHeadlines(req: Req, res: Res) {
  if (!isCronAuthed(req)) return res.status(401).json({ error: "Unauthorized" });

  const apiKey = process.env.MARKETAUX_API_KEY;
  if (!apiKey) {
    console.error("[news-headlines] MARKETAUX_API_KEY not set");
    return res.status(200).json({ ok: false, reason: "no api key" });
  }

  try {
    const url = `${MARKETAUX_URL}?countries=us&language=en&limit=20&api_token=${apiKey}`;
    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), 10_000);
    const upstream = await fetch(url, { signal: ctrl.signal });
    clearTimeout(timer);

    if (!upstream.ok) {
      console.error("[news-headlines] upstream non-200:", upstream.status);
      return res.status(200).json({ ok: false, reason: `upstream ${upstream.status}` });
    }
    const body = (await upstream.json()) as unknown;
    if (
      typeof body !== "object" ||
      body === null ||
      !Array.isArray((body as { data?: unknown[] }).data)
    ) {
      console.error("[news-headlines] invalid response shape");
      return res.status(200).json({ ok: false, reason: "bad shape" });
    }
    const rawArticles = (body as { data: MarketauxArticle[] }).data;

    const articles: Record<string, unknown>[] = [];
    for (const item of rawArticles) {
      const a = normaliseMarketauxArticle(item);
      if (a) articles.push(a);
    }
    if (articles.length === 0) {
      console.error("[news-headlines] no valid articles after normalization");
      return res.status(200).json({ ok: false, reason: "no valid articles" });
    }

    const admin = getAdminClient();
    const value = { fetched_at: new Date().toISOString(), articles };
    const { error } = await admin.from("shared_kv").upsert({
      key: "koda_news_headlines",
      value,
      owner_id: NEWS_OWNER_ID,
    });
    if (error) {
      console.error("[news-headlines] upsert error:", error);
      return res.status(500).json({ error: error.message });
    }

    return res.status(200).json({ ok: true, count: articles.length });
  } catch (err) {
    console.error("[news-headlines] failed:", err);
    return res.status(200).json({ ok: false, reason: "exception" });
  }
}
```

- [ ] **Step 2: Add the router branch**

Immediately below the `news-calendar` branch added in Task 3:

```ts
  if (job === "news-headlines")      return handleNewsHeadlines(req, res);
```

- [ ] **Step 3: Run lint + typecheck**

```powershell
npm run lint
npm run typecheck
```

Expected: no errors.

---

## Task 5: Schedules — Vercel Cron + GitHub Actions

**Files:**
- Modify: `vercel.json`
- Create: `.github/workflows/news-cron.yml`

- [ ] **Step 1: Add a cron entry to `vercel.json`**

Inside the existing `crons` array, append:

```json
    {
      "path": "/api/cron?job=news-calendar",
      "schedule": "0 11 * * *"
    }
```

The final `crons` array should read:

```json
"crons": [
  { "path": "/api/cron?job=complete-challenges", "schedule": "0 0 * * *" },
  { "path": "/api/cron?job=sync",                "schedule": "0 6 * * *" },
  { "path": "/api/cron?job=daily-digest",        "schedule": "0 7 * * *" },
  { "path": "/api/cron?job=news-calendar",       "schedule": "0 11 * * *" }
]
```

- [ ] **Step 2: Create the GitHub Actions workflow**

Create `.github/workflows/news-cron.yml`:

```yaml
name: news-headlines-cron

# Runs every 30 minutes and hits the news-headlines refresh endpoint.
# Sub-daily schedules require GitHub Actions because Vercel Hobby cron is daily-only.
# Mirrors .github/workflows/sync-cron.yml.
#
# Required GitHub secret:
#   CRON_SECRET — same value as the CRON_SECRET env var in Vercel

on:
  schedule:
    - cron: "*/30 * * * *"
  workflow_dispatch:

jobs:
  refresh:
    runs-on: ubuntu-latest
    timeout-minutes: 2

    steps:
      - name: Trigger news-headlines refresh
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

- [ ] **Step 3: Deploy the server changes**

```powershell
vercel --prod
```

Expected: build succeeds, deployment URL printed.

- [ ] **Step 4: Smoke test the two endpoints from a terminal**

Replace `<CRON_SECRET>` with the value from Vercel env vars.

```powershell
curl -H "Authorization: Bearer <CRON_SECRET>" "https://kodatrade.co.uk/api/cron?job=news-calendar"
curl -H "Authorization: Bearer <CRON_SECRET>" "https://kodatrade.co.uk/api/cron?job=news-headlines"
```

Expected: each returns `{"ok":true,"count":<n>}` with n ≥ 1.

- [ ] **Step 5: Verify rows in Supabase**

Open Supabase SQL Editor and run:

```sql
select key, jsonb_typeof(value), value->'fetched_at' as fetched_at,
       jsonb_array_length(value->'events')    as event_count,
       jsonb_array_length(value->'articles')  as article_count
from public.shared_kv
where key in ('koda_news_calendar', 'koda_news_headlines');
```

Expected: two rows, both with `fetched_at` set to a timestamp from the last few seconds, and non-zero array lengths for their respective payloads.

---

## Task 6: Client hook — `useNews`

**Files:**
- Create: `src/hooks/useNews.ts`
- Create: `src/hooks/useNews.test.tsx`

- [ ] **Step 1: Write the failing test**

Create `src/hooks/useNews.test.tsx`:

```tsx
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { renderHook, waitFor } from "@testing-library/react";
import { useNews } from "./useNews";

type StorageRow = { value: string } | null;

const calendarValue = JSON.stringify({
  fetched_at: "2026-06-01T11:00:00.000Z",
  events: [
    {
      id: "ff-cpi-yoy-2026-06-03",
      title: "CPI (YoY)",
      country: "USD",
      time: "2026-06-03T12:30:00.000Z",
      impact: "high",
      forecast: "3.2%",
      previous: "3.4%",
      actual: null,
    },
  ],
});

const headlinesValue = JSON.stringify({
  fetched_at: "2026-06-01T11:30:00.000Z",
  articles: [
    {
      id: "a1",
      title: "Fed's Powell speaks",
      source: "Reuters",
      url: "https://reuters.com/a1",
      published_at: "2026-06-01T09:14:00.000Z",
      snippet: null,
    },
  ],
});

function mockStorage(rows: Record<string, StorageRow>) {
  (window as unknown as { storage: { get: (k: string) => Promise<StorageRow> } }).storage = {
    get: vi.fn(async (key: string) => rows[key] ?? null),
  };
}

describe("useNews", () => {
  beforeEach(() => {
    mockStorage({
      koda_news_calendar:  { value: calendarValue },
      koda_news_headlines: { value: headlinesValue },
    });
  });
  afterEach(() => {
    delete (window as unknown as { storage?: unknown }).storage;
  });

  it("loads and parses both caches", async () => {
    const { result } = renderHook(() => useNews());
    await waitFor(() => expect(result.current.isLoading).toBe(false));
    expect(result.current.calendar?.items[0].title).toBe("CPI (YoY)");
    expect(result.current.headlines?.items[0].source).toBe("Reuters");
  });

  it("returns null caches when storage rows are missing", async () => {
    mockStorage({});
    const { result } = renderHook(() => useNews());
    await waitFor(() => expect(result.current.isLoading).toBe(false));
    expect(result.current.calendar).toBeNull();
    expect(result.current.headlines).toBeNull();
  });

  it("returns null when stored value is malformed JSON", async () => {
    mockStorage({
      koda_news_calendar:  { value: "{not json" },
      koda_news_headlines: { value: "{not json" },
    });
    const { result } = renderHook(() => useNews());
    await waitFor(() => expect(result.current.isLoading).toBe(false));
    expect(result.current.calendar).toBeNull();
    expect(result.current.headlines).toBeNull();
  });
});
```

- [ ] **Step 2: Run the test, verify it fails**

```powershell
npm test -- src/hooks/useNews.test.tsx
```

Expected: FAIL — `Cannot find module './useNews'`.

- [ ] **Step 3: Create `src/hooks/useNews.ts`**

```ts
// ═══════════════════════════════════════════════════════════════════════════════
// Kōda · useNews()
//
// Reads the two news cache rows from window.storage (shared_kv), parses them
// defensively, and re-fetches when the window regains focus. No polling.
// ═══════════════════════════════════════════════════════════════════════════════

import { useCallback, useEffect, useState } from "react";
import {
  parseCalendarCache,
  parseHeadlinesCache,
  type CalendarEvent,
  type Headline,
  type NewsCache,
} from "../lib/news";

type StorageRow = { value: string } | null;
type StorageShim = { get: (key: string, shared?: boolean) => Promise<StorageRow> };

function getStorage(): StorageShim | null {
  const w = window as unknown as { storage?: StorageShim };
  return w.storage ?? null;
}

async function readCache<T>(
  key: string,
  parser: (raw: unknown) => NewsCache<T> | null,
): Promise<NewsCache<T> | null> {
  const storage = getStorage();
  if (!storage) return null;
  try {
    const row = await storage.get(key, true);
    if (!row) return null;
    const parsed: unknown = JSON.parse(row.value);
    return parser(parsed);
  } catch {
    return null;
  }
}

export interface UseNews {
  calendar: NewsCache<CalendarEvent> | null;
  headlines: NewsCache<Headline> | null;
  isLoading: boolean;
  refresh: () => Promise<void>;
}

export function useNews(): UseNews {
  const [calendar, setCalendar] = useState<NewsCache<CalendarEvent> | null>(null);
  const [headlines, setHeadlines] = useState<NewsCache<Headline> | null>(null);
  const [isLoading, setLoading] = useState(true);

  const refresh = useCallback(async () => {
    const [cal, hl] = await Promise.all([
      readCache("koda_news_calendar", parseCalendarCache),
      readCache("koda_news_headlines", parseHeadlinesCache),
    ]);
    setCalendar(cal);
    setHeadlines(hl);
    setLoading(false);
  }, []);

  useEffect(() => {
    let alive = true;
    (async () => {
      const [cal, hl] = await Promise.all([
        readCache("koda_news_calendar", parseCalendarCache),
        readCache("koda_news_headlines", parseHeadlinesCache),
      ]);
      if (!alive) return;
      setCalendar(cal);
      setHeadlines(hl);
      setLoading(false);
    })();
    const onFocus = () => { if (document.visibilityState === "visible") void refresh(); };
    document.addEventListener("visibilitychange", onFocus);
    return () => {
      alive = false;
      document.removeEventListener("visibilitychange", onFocus);
    };
  }, [refresh]);

  return { calendar, headlines, isLoading, refresh };
}
```

- [ ] **Step 4: Run the test, verify it passes**

```powershell
npm test -- src/hooks/useNews.test.tsx
```

Expected: PASS, 3/3 green.

- [ ] **Step 5: Run lint + typecheck**

```powershell
npm run lint
npm run typecheck
```

Expected: no errors.

---

## Task 7: Home widget — `HomeNewsWidget`

**Files:**
- Create: `src/components/HomeNewsWidget.tsx`
- Create: `src/components/HomeNewsWidget.test.tsx`

- [ ] **Step 1: Write the failing test**

Create `src/components/HomeNewsWidget.test.tsx`:

```tsx
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { DARK } from "../theme";
import { HomeNewsWidget } from "./HomeNewsWidget";

type StorageRow = { value: string } | null;

const tomorrowIso = new Date(Date.now() + 4 * 60 * 60 * 1000).toISOString();

const calendarValue = JSON.stringify({
  fetched_at: new Date().toISOString(),
  events: [
    {
      id: "ff-high-event-future",
      title: "CPI (YoY)",
      country: "USD",
      time: tomorrowIso,
      impact: "high",
      forecast: "3.2%",
      previous: "3.4%",
      actual: null,
    },
  ],
});

function mockStorage(rows: Record<string, StorageRow>) {
  (window as unknown as { storage: { get: (k: string) => Promise<StorageRow> } }).storage = {
    get: vi.fn(async (key: string) => rows[key] ?? null),
  };
}

describe("HomeNewsWidget", () => {
  beforeEach(() => {
    mockStorage({ koda_news_calendar: { value: calendarValue } });
  });
  afterEach(() => {
    delete (window as unknown as { storage?: unknown }).storage;
  });

  it("shows the next high-impact event with title and label", async () => {
    render(<HomeNewsWidget C={DARK} onOpenNews={() => {}} />);
    expect(await screen.findByText("CPI (YoY)")).toBeInTheDocument();
    expect(screen.getByText(/NEXT EVENT/i)).toBeInTheDocument();
    expect(screen.getByText(/HIGH/i)).toBeInTheDocument();
  });

  it("calls onOpenNews when the hero card is tapped", async () => {
    const onOpenNews = vi.fn();
    render(<HomeNewsWidget C={DARK} onOpenNews={onOpenNews} />);
    const card = await screen.findByTestId("home-news-hero");
    await userEvent.click(card);
    expect(onOpenNews).toHaveBeenCalledOnce();
  });

  it("renders empty state when no events cached", async () => {
    mockStorage({});
    render(<HomeNewsWidget C={DARK} onOpenNews={() => {}} />);
    expect(
      await screen.findByText(/News loading/i),
    ).toBeInTheDocument();
  });
});
```

- [ ] **Step 2: Run the test, verify it fails**

```powershell
npm test -- src/components/HomeNewsWidget.test.tsx
```

Expected: FAIL — `Cannot find module './HomeNewsWidget'`.

- [ ] **Step 3: Create `src/components/HomeNewsWidget.tsx`**

```tsx
// ═══════════════════════════════════════════════════════════════════════════════
// Kōda · HomeNewsWidget
//
// Hero card (next high-impact event + countdown) + horizontal week strip.
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

function formatLocalTime(iso: string): string {
  return new Date(iso).toLocaleTimeString(undefined, {
    hour: "2-digit",
    minute: "2-digit",
  });
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

  const upcoming = useMemo<CalendarEvent[]>(() => {
    const events = calendar?.items ?? [];
    return events
      .filter(e => new Date(e.time).getTime() > now)
      .sort((a, b) => new Date(a.time).getTime() - new Date(b.time).getTime());
  }, [calendar, now]);

  const hero = useMemo<CalendarEvent | null>(() => {
    const high = upcoming.find(e => e.impact === "high");
    return high ?? upcoming[0] ?? null;
  }, [upcoming]);

  const strip = useMemo<CalendarEvent[]>(() => {
    if (!hero) return [];
    return upcoming.filter(e => e.id !== hero.id).slice(0, 6);
  }, [upcoming, hero]);

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
    <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
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
            NEXT EVENT
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

      {strip.length > 0 && (
        <div
          data-testid="home-news-strip"
          onClick={onOpenNews}
          style={{
            display: "flex",
            gap: 6,
            overflowX: "auto",
            paddingBottom: 4,
            cursor: "pointer",
          }}
        >
          {strip.map(ev => {
            const c = impactColor(C, ev.impact);
            return (
              <div
                key={ev.id}
                style={{
                  minWidth: 88,
                  background: C.panel,
                  border: `1px solid ${C.border}`,
                  borderTop: `2px solid ${c}`,
                  borderRadius: 8,
                  padding: 8,
                  color: C.text,
                }}
              >
                <div style={{ fontFamily: MONO, fontSize: 9, color: C.muted }}>
                  {formatLocalDayTime(ev.time)}
                </div>
                <div style={{ fontSize: 10, marginTop: 4, lineHeight: 1.2, fontWeight: 600 }}>
                  {ev.title}
                </div>
                <div
                  style={{
                    fontSize: 8,
                    marginTop: 6,
                    letterSpacing: "0.08em",
                    color: c,
                  }}
                >
                  {ev.impact.toUpperCase()}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
```

- [ ] **Step 4: Run the test, verify it passes**

```powershell
npm test -- src/components/HomeNewsWidget.test.tsx
```

Expected: PASS, 3/3 green.

- [ ] **Step 5: Run lint + typecheck**

```powershell
npm run lint
npm run typecheck
```

Expected: no errors.

---

## Task 8: Full News page — `NewsScreen`

**Files:**
- Create: `src/NewsScreen.tsx`
- Create: `src/NewsScreen.test.tsx`

- [ ] **Step 1: Write the failing test**

Create `src/NewsScreen.test.tsx`:

```tsx
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { DARK } from "./theme";
import { NewsScreen } from "./NewsScreen";

type StorageRow = { value: string } | null;

const today = new Date();
function isoAtHour(hour: number): string {
  const d = new Date(today);
  d.setHours(hour, 0, 0, 0);
  return d.toISOString();
}

const calendarValue = JSON.stringify({
  fetched_at: new Date().toISOString(),
  events: [
    {
      id: "ev-today-am",
      title: "Today AM event",
      country: "USD",
      time: isoAtHour(8),
      impact: "high",
      forecast: null,
      previous: null,
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
});

const headlinesValue = JSON.stringify({
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
});

function mockStorage(rows: Record<string, StorageRow>) {
  (window as unknown as { storage: { get: (k: string) => Promise<StorageRow> } }).storage = {
    get: vi.fn(async (key: string) => rows[key] ?? null),
  };
}

describe("NewsScreen", () => {
  beforeEach(() => {
    mockStorage({
      koda_news_calendar:  { value: calendarValue },
      koda_news_headlines: { value: headlinesValue },
    });
  });
  afterEach(() => {
    delete (window as unknown as { storage?: unknown }).storage;
  });

  it("renders today's events by default and hides next week", async () => {
    render(<NewsScreen C={DARK} />);
    expect(await screen.findByText("Today AM event")).toBeInTheDocument();
    expect(screen.getByText("Today PM event")).toBeInTheDocument();
    expect(screen.queryByText("Next week event")).not.toBeInTheDocument();
  });

  it("switches to Month filter and shows next week event", async () => {
    render(<NewsScreen C={DARK} />);
    await screen.findByText("Today AM event");
    await userEvent.click(screen.getByRole("button", { name: /MONTH/i }));
    expect(await screen.findByText("Next week event")).toBeInTheDocument();
  });

  it("renders the headlines feed", async () => {
    render(<NewsScreen C={DARK} />);
    expect(await screen.findByText("First headline")).toBeInTheDocument();
    const link = screen.getByText("First headline").closest("a");
    expect(link).toHaveAttribute("href", "https://example.com/a1");
    expect(link).toHaveAttribute("target", "_blank");
    expect(link).toHaveAttribute("rel", "noopener noreferrer");
  });
});
```

- [ ] **Step 2: Run the test, verify it fails**

```powershell
npm test -- src/NewsScreen.test.tsx
```

Expected: FAIL — `Cannot find module './NewsScreen'`.

- [ ] **Step 3: Create `src/NewsScreen.tsx`**

```tsx
// ═══════════════════════════════════════════════════════════════════════════════
// Kōda · NewsScreen
//
// Full News page reached via the Home subnav. Today / Week / Month filter pills,
// calendar list, headlines feed.
// ═══════════════════════════════════════════════════════════════════════════════

import { useMemo, useState } from "react";
import type { Theme } from "./theme";
import { MONO, BODY } from "./shared";
import { useNews } from "./hooks/useNews";
import type { CalendarEvent, Headline, Impact } from "./lib/news";

type Range = "today" | "week" | "month";

interface Props {
  C: Theme;
}

function impactColor(C: Theme, impact: Impact): string {
  if (impact === "high")   return C.red;
  if (impact === "medium") return C.warn;
  return C.muted;
}

function startOfDay(d: Date): Date {
  const x = new Date(d);
  x.setHours(0, 0, 0, 0);
  return x;
}

function endOfDay(d: Date): Date {
  const x = new Date(d);
  x.setHours(23, 59, 59, 999);
  return x;
}

function rangeWindow(range: Range): [Date, Date] {
  const now = new Date();
  if (range === "today") return [startOfDay(now), endOfDay(now)];
  if (range === "week") {
    const end = new Date(now);
    end.setDate(now.getDate() + 7);
    return [startOfDay(now), endOfDay(end)];
  }
  const end = new Date(now);
  end.setDate(now.getDate() + 30);
  return [startOfDay(now), endOfDay(end)];
}

function relativeAgo(iso: string): string {
  const ms = Date.now() - new Date(iso).getTime();
  if (ms < 0) return "just now";
  const min = Math.floor(ms / 60_000);
  if (min < 60) return `${min}m ago`;
  const hr = Math.floor(min / 60);
  if (hr < 24) return `${hr}h ago`;
  const day = Math.floor(hr / 24);
  return `${day}d ago`;
}

function formatTime(iso: string): string {
  return new Date(iso).toLocaleTimeString(undefined, {
    hour: "2-digit",
    minute: "2-digit",
  });
}

function staleHours(fetchedAtIso: string): number {
  return (Date.now() - new Date(fetchedAtIso).getTime()) / 3600_000;
}

export function NewsScreen({ C }: Props) {
  const { calendar, headlines } = useNews();
  const [range, setRange] = useState<Range>("today");

  const filteredEvents = useMemo<CalendarEvent[]>(() => {
    const events = calendar?.items ?? [];
    const [from, to] = rangeWindow(range);
    return events
      .filter(e => {
        const t = new Date(e.time).getTime();
        return t >= from.getTime() && t <= to.getTime();
      })
      .sort((a, b) => new Date(a.time).getTime() - new Date(b.time).getTime());
  }, [calendar, range]);

  const articles = headlines?.items ?? [];

  return (
    <div
      style={{
        padding: 14,
        fontFamily: BODY,
        color: C.text,
        display: "flex",
        flexDirection: "column",
        gap: 14,
      }}
    >
      {/* Range pills */}
      <div style={{ display: "flex", gap: 4 }}>
        {(["today", "week", "month"] as Range[]).map(r => {
          const active = range === r;
          return (
            <button
              key={r}
              type="button"
              onClick={() => setRange(r)}
              style={{
                flex: 1,
                padding: 8,
                borderRadius: 6,
                border: active ? "none" : `1px solid ${C.border}`,
                background: active ? C.text : C.panel,
                color:      active ? C.bg   : C.muted,
                fontFamily: MONO,
                fontSize: 10,
                fontWeight: 600,
                letterSpacing: "0.05em",
                cursor: "pointer",
              }}
            >
              {r.toUpperCase()}
            </button>
          );
        })}
      </div>

      {/* Calendar section */}
      <section>
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            marginBottom: 8,
          }}
        >
          <span style={{ fontFamily: MONO, fontSize: 9, letterSpacing: "0.1em", color: C.muted }}>
            ECONOMIC CALENDAR
          </span>
          {calendar && staleHours(calendar.fetchedAt) > 24 && (
            <span style={{ fontFamily: MONO, fontSize: 9, color: C.warn }}>
              Last updated {Math.round(staleHours(calendar.fetchedAt))}h ago
            </span>
          )}
        </div>

        {filteredEvents.length === 0 ? (
          <div
            style={{
              padding: 16,
              borderRadius: 8,
              background: C.panel,
              color: C.muted,
              fontSize: 12,
              textAlign: "center",
            }}
          >
            {range === "today"
              ? "No US events today — quiet session ahead."
              : "No events in this range."}
          </div>
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
            {filteredEvents.map(ev => {
              const c = impactColor(C, ev.impact);
              const past = new Date(ev.time).getTime() < Date.now();
              return (
                <div
                  key={ev.id}
                  style={{
                    padding: 9,
                    background: C.panel,
                    border: `1px solid ${C.border}`,
                    borderLeft: `3px solid ${c}`,
                    borderRadius: 6,
                    opacity: past ? 0.55 : 1,
                  }}
                >
                  <div style={{ display: "flex", justifyContent: "space-between", fontSize: 11 }}>
                    <span>{ev.title}</span>
                    <span style={{ fontFamily: MONO, color: C.muted }}>{formatTime(ev.time)}</span>
                  </div>
                  {(ev.forecast || ev.previous || ev.actual) && (
                    <div style={{ fontSize: 9, color: C.muted, marginTop: 3 }}>
                      {ev.forecast && `Forecast: ${ev.forecast}`}
                      {ev.forecast && ev.previous && " · "}
                      {ev.previous && `Prev: ${ev.previous}`}
                      {ev.actual && ` · Actual: ${ev.actual}`}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </section>

      {/* Headlines section */}
      <section>
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            marginBottom: 8,
          }}
        >
          <span style={{ fontFamily: MONO, fontSize: 9, letterSpacing: "0.1em", color: C.muted }}>
            HEADLINES
          </span>
          {headlines && staleHours(headlines.fetchedAt) > 24 && (
            <span style={{ fontFamily: MONO, fontSize: 9, color: C.warn }}>
              Last updated {Math.round(staleHours(headlines.fetchedAt))}h ago
            </span>
          )}
        </div>

        {articles.length === 0 ? (
          <div
            style={{
              padding: 16,
              borderRadius: 8,
              background: C.panel,
              color: C.muted,
              fontSize: 12,
              textAlign: "center",
            }}
          >
            Headlines loading — check back in a few minutes.
          </div>
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: 5 }}>
            {articles.map((a: Headline) => (
              <a
                key={a.id}
                href={a.url}
                target="_blank"
                rel="noopener noreferrer"
                style={{
                  display: "block",
                  padding: 9,
                  background: C.panel,
                  border: `1px solid ${C.border}`,
                  borderRadius: 6,
                  color: C.text,
                  textDecoration: "none",
                }}
              >
                <div style={{ fontSize: 11, lineHeight: 1.3 }}>{a.title}</div>
                <div style={{ fontSize: 9, color: C.muted, marginTop: 3 }}>
                  {a.source} · {relativeAgo(a.publishedAt)}
                </div>
              </a>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
```

- [ ] **Step 4: Run the test, verify it passes**

```powershell
npm test -- src/NewsScreen.test.tsx
```

Expected: PASS, 3/3 green.

- [ ] **Step 5: Run lint + typecheck**

```powershell
npm run lint
npm run typecheck
```

Expected: no errors.

---

## Task 9: Wire News into `Koda.tsx`

**Files:**
- Modify: `src/Koda.tsx` (3 edits)

> Reminder: `Koda.tsx` is ~4150 lines, lives on OneDrive — use the `Edit` tool for surgical edits, never `Write`.

- [ ] **Step 1: Add an import for the two new components**

Find the existing top-of-file imports block. Add these lines next to other component imports (e.g., near where `OnboardingFlow` or `SettingsScreen` is imported):

```tsx
import { HomeNewsWidget } from "./components/HomeNewsWidget";
import { NewsScreen } from "./NewsScreen";
```

- [ ] **Step 2: Add `"news"` to `HOME_SECTIONS` (currently at L1369)**

Find:

```tsx
const HOME_SECTIONS = [
  { id: "analytics", label: "Analytics" },
  { id: "rules", label: "Rules & Checklist" },
  { id: "sync", label: "Sync & Log" },
  { id: "journal", label: "Journal" },
  ...(profile.propFirmMode ? [{ id: "eval", label: "Eval" }] : []),
];
```

Replace with:

```tsx
const HOME_SECTIONS = [
  { id: "analytics", label: "Analytics" },
  { id: "rules", label: "Rules & Checklist" },
  { id: "sync", label: "Sync & Log" },
  { id: "journal", label: "Journal" },
  { id: "news", label: "News" },
  ...(profile.propFirmMode ? [{ id: "eval", label: "Eval" }] : []),
];
```

- [ ] **Step 3: Mount the `<HomeNewsWidget />` inside the feed block (currently at L1679)**

Locate the line:

```tsx
{homeSection === "feed" && (
```

The block immediately after it is a JSX fragment / container. Mount the widget as the very first child of the feed section, so it appears at the top of the page above existing P&L/stats cards. Insert this directly after the opening of the feed block:

```tsx
<HomeNewsWidget C={C} onOpenNews={() => setHomeSection("news")} />
```

If the feed block opens with a wrapping `<div>` or fragment, place the widget as the first JSX child of that wrapper. The exact existing markup is what determines insertion — keep it the topmost visual element of the feed view.

- [ ] **Step 4: Add the `homeSection === "news"` render block**

Find the existing `homeSection === "settings"` render block (currently around L2644). Immediately after the closing of that block, add a new sibling block:

```tsx
{homeSection === "news" && (
  <NewsScreen C={C} />
)}
```

- [ ] **Step 5: Run lint + typecheck**

```powershell
npm run lint
npm run typecheck
```

Expected: no errors.

- [ ] **Step 6: Run all unit tests to confirm nothing regressed**

```powershell
npm test
```

Expected: every suite passes — including pre-existing CSV / stats / etc.

- [ ] **Step 7: Run the dev server and visually confirm**

```powershell
npm run dev
```

Open `http://localhost:5173`, sign in. On Home you should see the hero countdown widget at the top, followed by your existing dashboard. From the Home subnav dropdown, select **News** — the calendar list + headlines feed should render with Today/Week/Month pills. Tap a headline to confirm it opens externally.

If the cron has not yet populated `shared_kv`, you'll see the empty states ("News loading — check back in a few minutes"). That's fine; Task 5's smoke step should have populated it by now.

---

## Task 10: Playwright smoke test

**Files:**
- Create: `tests/news.spec.ts`

- [ ] **Step 1: Write the smoke test**

Create `tests/news.spec.ts`. Use the existing auth setup pattern from `tests/auth.setup.ts`.

`SubNavDropdown` (`src/shared.tsx:330`) is a custom button-based dropdown: a trigger button shows the current section label (uppercase, e.g., "ANALYTICS"); clicking opens a panel of section buttons. Drive it as a button click, not `selectOption`.

```ts
import { test, expect } from "@playwright/test";

test.describe("News section", () => {
  test("widget appears on Home and subnav opens full News page", async ({ page }) => {
    await page.goto("/");

    // Widget on Home feed
    const hero = page.getByTestId("home-news-hero");
    await expect(hero).toBeVisible({ timeout: 15_000 });

    // Open the Home subnav dropdown (its trigger shows the current section label).
    // The default homeSection is "feed", but the dropdown shows the label of one
    // of HOME_SECTIONS — open by clicking whichever section button is currently
    // visible. Simplest: click the dropdown's chevron-bearing trigger by locating
    // the button that contains the ▾ glyph.
    await page.locator("button", { hasText: "▾" }).first().click();

    // Click the "NEWS" item in the open panel
    await page.getByRole("button", { name: /^NEWS$/i }).click();

    // Range pills present
    await expect(page.getByRole("button", { name: /TODAY/i })).toBeVisible();
    await expect(page.getByRole("button", { name: /WEEK/i })).toBeVisible();
    await expect(page.getByRole("button", { name: /MONTH/i })).toBeVisible();

    // Section labels
    await expect(page.getByText(/ECONOMIC CALENDAR/i)).toBeVisible();
    await expect(page.getByText(/HEADLINES/i)).toBeVisible();
  });
});
```

- [ ] **Step 2: Run the test**

```powershell
npm run test:e2e -- tests/news.spec.ts
```

Expected: PASS.

---

## Task 11: Production verification

- [ ] **Step 1: Deploy**

```powershell
vercel --prod
```

Expected: successful build, deployment URL printed.

- [ ] **Step 2: Manual smoke on production (kodatrade.co.uk)**

Walk through the §9 verification checklist in the spec:

1. Load Home → widget shows next event + live countdown ticks every 60s.
2. Tap widget → routes to News page.
3. Switch Today / Week / Month — calendar list updates.
4. Tap a headline → external link opens in new tab.
5. DevTools Network → Offline reload → cached data still renders.
6. In Supabase, manually update `koda_news_calendar.value.fetched_at` to a 2-days-ago ISO timestamp → reload, confirm the stale indicator appears.

- [ ] **Step 3: Confirm GitHub Actions cron runs**

In the GitHub repo Actions tab, trigger `news-headlines-cron` via `workflow_dispatch`. Confirm it logs HTTP 200. Then wait for the next scheduled `*/30` run and confirm it succeeds.

- [ ] **Step 4: Confirm Vercel daily cron runs**

After 24h, in Vercel Dashboard → Cron Jobs, confirm the `news-calendar` job has a green run at the scheduled time.

- [ ] **Step 5: Update CLAUDE.md backlog**

Open `CLAUDE.md` and add a `✅ shipped 2026-06-0X` note under "Other" in the Backlog section:

```
- News section (economic calendar + headlines) ✅ shipped 2026-06-0X
```

Also add a row to the Migrations Applied / Features table noting the two new cron jobs and the new env var.

---

## Self-review notes (for the implementer)

- All steps include exact paths, exact commands, exact code.
- No `: any` annotations used (pre-commit hook would reject).
- Storage shape matches the existing `window.storage.get(key, shared=true)` pattern.
- `api/cron.ts` reuses existing helpers (`isCronAuthed`, `getAdminClient`, `NEWS_OWNER_ID` mirrors the announcements/KODA-GLOBAL sentinel pattern).
- Function count is unchanged at 10/12; news handlers live inside `api/cron.ts`.
- Three Koda.tsx edits are surgical and use the `Edit` tool — important on OneDrive.
