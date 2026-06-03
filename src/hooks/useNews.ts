import { useCallback, useEffect, useState } from "react";
import {
  parseCalendarCache,
  parseHeadlinesCache,
  type CalendarEvent,
  type Headline,
  type NewsCache,
} from "../lib/news";

async function fetchNews(): Promise<{
  calendar: NewsCache<CalendarEvent> | null;
  headlines: NewsCache<Headline> | null;
}> {
  try {
    const r = await fetch("/api/news");
    if (!r.ok) return { calendar: null, headlines: null };
    const body = (await r.json()) as { calendar: unknown; headlines: unknown };
    return {
      calendar:  parseCalendarCache(body.calendar),
      headlines: parseHeadlinesCache(body.headlines),
    };
  } catch {
    return { calendar: null, headlines: null };
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
    const { calendar: cal, headlines: hl } = await fetchNews();
    setCalendar(cal);
    setHeadlines(hl);
    setLoading(false);
  }, []);

  useEffect(() => {
    let alive = true;
    (async () => {
      const { calendar: cal, headlines: hl } = await fetchNews();
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
