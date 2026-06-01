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
