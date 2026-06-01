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
