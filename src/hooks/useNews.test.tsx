import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
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

let apiBody: { calendar: unknown; headlines: unknown } = { calendar: null, headlines: null };

import { useNews } from "./useNews";

describe("useNews", () => {
  beforeEach(() => {
    apiBody = { calendar: calendarValue, headlines: headlinesValue };
    vi.stubGlobal("fetch", vi.fn(async () => ({
      ok: true,
      json: async () => apiBody,
    } as Response)));
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("loads and parses both caches", async () => {
    const { result } = renderHook(() => useNews());
    await waitFor(() => expect(result.current.isLoading).toBe(false));
    expect(result.current.calendar?.items[0].title).toBe("CPI (YoY)");
    expect(result.current.headlines?.items[0].source).toBe("Reuters");
  });

  it("returns null caches when API body has nulls", async () => {
    apiBody = { calendar: null, headlines: null };
    const { result } = renderHook(() => useNews());
    await waitFor(() => expect(result.current.isLoading).toBe(false));
    expect(result.current.calendar).toBeNull();
    expect(result.current.headlines).toBeNull();
  });

  it("returns null when stored value is malformed", async () => {
    apiBody = { calendar: { unrelated: "shape" }, headlines: 42 };
    const { result } = renderHook(() => useNews());
    await waitFor(() => expect(result.current.isLoading).toBe(false));
    expect(result.current.calendar).toBeNull();
    expect(result.current.headlines).toBeNull();
  });
});
