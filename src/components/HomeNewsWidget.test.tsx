import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { DARK } from "../theme";
import { HomeNewsWidget } from "./HomeNewsWidget";

type StorageRow = { value: string } | null;

const tomorrowIso = new Date(Date.now() + 4 * 60 * 60 * 1000).toISOString();

const calendarValue = JSON.stringify({
  fetched_at: new Date().toISOString(),
  events: [
    {
      id: "ff-high-event-future",
      title: "CPI (YoY)",
      country: "USD",
      time: tomorrowIso,
      impact: "high",
      forecast: "3.2%",
      previous: "3.4%",
      actual: null,
    },
  ],
});

function mockStorage(rows: Record<string, StorageRow>) {
  (window as unknown as { storage: { get: (k: string) => Promise<StorageRow> } }).storage = {
    get: vi.fn(async (key: string) => rows[key] ?? null),
  };
}

describe("HomeNewsWidget", () => {
  beforeEach(() => {
    mockStorage({ koda_news_calendar: { value: calendarValue } });
  });
  afterEach(() => {
    delete (window as unknown as { storage?: unknown }).storage;
  });

  it("shows the next high-impact event with title and label", async () => {
    render(<HomeNewsWidget C={DARK} onOpenNews={() => {}} />);
    expect(await screen.findByText("CPI (YoY)")).toBeInTheDocument();
    expect(screen.getByText(/NEXT EVENT/i)).toBeInTheDocument();
    expect(screen.getByText(/HIGH/i)).toBeInTheDocument();
  });

  it("calls onOpenNews when the hero card is tapped", async () => {
    const onOpenNews = vi.fn();
    render(<HomeNewsWidget C={DARK} onOpenNews={onOpenNews} />);
    const card = await screen.findByTestId("home-news-hero");
    await userEvent.click(card);
    expect(onOpenNews).toHaveBeenCalledOnce();
  });

  it("renders empty state when no events cached", async () => {
    mockStorage({});
    render(<HomeNewsWidget C={DARK} onOpenNews={() => {}} />);
    expect(
      await screen.findByText(/News loading/i),
    ).toBeInTheDocument();
  });
});
