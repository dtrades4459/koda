import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { DARK } from "../theme";

const tomorrowIso = new Date(Date.now() + 4 * 60 * 60 * 1000).toISOString();

const calendarValue = {
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

import { HomeNewsWidget } from "./HomeNewsWidget";

describe("HomeNewsWidget", () => {
  beforeEach(() => {
    rows = { koda_news_calendar: { value: calendarValue } };
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
    rows = {};
    render(<HomeNewsWidget C={DARK} onOpenNews={() => {}} />);
    expect(await screen.findByText(/News loading/i)).toBeInTheDocument();
  });
});
