import { describe, it, expect, vi, beforeEach } from "vitest";
import { renderHook, waitFor } from "@testing-library/react";

const calendarValue = {
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
};

const headlinesValue = {
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

import { useNews } from "./useNews";

describe("useNews", () => {
  beforeEach(() => {
    rows = {
      koda_news_calendar:  { value: calendarValue },
      koda_news_headlines: { value: headlinesValue },
    };
  });

  it("loads and parses both caches", async () => {
    const { result } = renderHook(() => useNews());
    await waitFor(() => expect(result.current.isLoading).toBe(false));
    expect(result.current.calendar?.items[0].title).toBe("CPI (YoY)");
    expect(result.current.headlines?.items[0].source).toBe("Reuters");
  });

  it("returns null caches when rows are missing", async () => {
    rows = {};
    const { result } = renderHook(() => useNews());
    await waitFor(() => expect(result.current.isLoading).toBe(false));
    expect(result.current.calendar).toBeNull();
    expect(result.current.headlines).toBeNull();
  });

  it("returns null when stored value is malformed", async () => {
    rows = {
      koda_news_calendar:  { value: { unrelated: "shape" } },
      koda_news_headlines: { value: 42 },
    };
    const { result } = renderHook(() => useNews());
    await waitFor(() => expect(result.current.isLoading).toBe(false));
    expect(result.current.calendar).toBeNull();
    expect(result.current.headlines).toBeNull();
  });
});
