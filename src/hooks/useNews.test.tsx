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
