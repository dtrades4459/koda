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
