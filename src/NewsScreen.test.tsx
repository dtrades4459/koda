import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { DARK } from "./theme";

const today = new Date();
function isoAtHour(hour: number): string {
  const d = new Date(today);
  d.setHours(hour, 0, 0, 0);
  return d.toISOString();
}

const calendarValue = {
  fetched_at: new Date().toISOString(),
  events: [
    {
      id: "ev-today-am",
      title: "Today AM event",
      country: "USD",
      time: isoAtHour(8),
      impact: "high",
      forecast: "3.2%",
      previous: "3.4%",
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
      id: "ev-today-low",
      title: "Today low event",
      country: "USD",
      time: isoAtHour(16),
      impact: "low",
      forecast: null,
      previous: null,
      actual: null,
    },
    {
      id: "ev-soon-low",
      title: "Soon low event",
      country: "USD",
      time: new Date(today.getTime() + 3 * 24 * 3600 * 1000).toISOString(),
      impact: "low",
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
};

const headlinesValue = {
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
};

interface Row { value: unknown }
let rows: Record<string, Row | null> = {};

vi.mock("./lib/supabase", () => ({
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

import { NewsScreen } from "./NewsScreen";

describe("NewsScreen", () => {
  beforeEach(() => {
    rows = {
      koda_news_calendar:  { value: calendarValue },
      koda_news_headlines: { value: headlinesValue },
    };
  });

  it("renders today high and medium events, hides low-impact and next-week events", async () => {
    render(<NewsScreen C={DARK} />);
    expect(await screen.findByText("Today AM event")).toBeInTheDocument();
    expect(screen.getByText("Today PM event")).toBeInTheDocument();
    expect(screen.queryByText("Today low event")).not.toBeInTheDocument();
    expect(screen.queryByText("Next week event")).not.toBeInTheDocument();
  });

  it("switches to Week filter and shows high+medium events within the next 7 days", async () => {
    render(<NewsScreen C={DARK} />);
    await screen.findByText("Today AM event");
    await userEvent.click(screen.getByRole("button", { name: /^WEEK$/i }));
    expect(screen.getByText("Today AM event")).toBeInTheDocument();
    // "Soon low event" is within 7 days but excluded by the impact filter
    expect(screen.queryByText("Soon low event")).not.toBeInTheDocument();
    // "Next week event" is beyond 7 days and also excluded
    expect(screen.queryByText("Next week event")).not.toBeInTheDocument();
  });

  it("renders the headlines feed", async () => {
    render(<NewsScreen C={DARK} />);
    expect(await screen.findByText("First headline")).toBeInTheDocument();
    const link = screen.getByText("First headline").closest("a");
    expect(link).toHaveAttribute("href", "https://example.com/a1");
    expect(link).toHaveAttribute("target", "_blank");
    expect(link).toHaveAttribute("rel", "noopener noreferrer");
  });

  it("expands forecast/previous/actual when an event card with details is tapped", async () => {
    render(<NewsScreen C={DARK} />);
    expect(await screen.findByText("Today AM event")).toBeInTheDocument();
    expect(screen.queryByText("3.2%")).not.toBeInTheDocument();
    await userEvent.click(screen.getByText("Today AM event"));
    expect(await screen.findByText("3.2%")).toBeInTheDocument();
    expect(screen.getByText("3.4%")).toBeInTheDocument();
    expect(screen.getByText("FORECAST")).toBeInTheDocument();
    expect(screen.getByText("PREVIOUS")).toBeInTheDocument();
    expect(screen.getByText("ACTUAL")).toBeInTheDocument();
  });

  it("does not render impact filter chip buttons", async () => {
    render(<NewsScreen C={DARK} />);
    await screen.findByText("Today AM event");
    expect(screen.queryByRole("button", { name: /HIGH/i, pressed: true })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /MED/i })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /LOW/i })).not.toBeInTheDocument();
  });
});
