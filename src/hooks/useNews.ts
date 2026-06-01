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
