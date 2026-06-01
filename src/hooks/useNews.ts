// ═══════════════════════════════════════════════════════════════════════════════
// Kōda · useNews()
//
// Reads the two news cache rows from public.news_cache (public-readable table),
// parses them defensively, and re-fetches when the window regains focus.
// No polling.
// ═══════════════════════════════════════════════════════════════════════════════

import { useCallback, useEffect, useState } from "react";
import { supabase } from "../lib/supabase";
import {
  parseCalendarCache,
  parseHeadlinesCache,
  type CalendarEvent,
  type Headline,
  type NewsCache,
} from "../lib/news";

async function readCache<T>(
  key: string,
  parser: (raw: unknown) => NewsCache<T> | null,
): Promise<NewsCache<T> | null> {
  try {
    const { data, error } = await supabase
      .from("news_cache")
      .select("value")
      .eq("key", key)
      .maybeSingle();
    if (error || !data) return null;
    return parser(data.value);
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
