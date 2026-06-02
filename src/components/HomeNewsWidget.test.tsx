import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { DARK } from "../theme";

const soon = new Date(Date.now() + 2 * 60 * 60 * 1000).toISOString();
const later = new Date(Date.now() + 4 * 60 * 60 * 1000).toISOString();
const wayLater = new Date(Date.now() + 6 * 60 * 60 * 1000).toISOString();

const calendarValue = {
  fetched_at: new Date().toISOString(),
  events: [
    {
      id: "ff-medium-event-next",
      title: "ISM Services PMI",
      country: "USD",
      time: soon,
      impact: "medium",
      forecast: null,
      previous: null,
      actual: null,
    },
    {
      id: "ff-high-event-after",
      title: "CPI (YoY)",
      country: "USD",
      time: later,
      impact: "high",
      forecast: "3.2%",
      previous: "3.4%",
      actual: null,
    },
    {
      id: "ff-low-event-ignored",
      title: "Low Impact Event",
      country: "USD",
      time: wayLater,
      impact: "low",
      forecast: null,
      previous: null,
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

  it("shows the next high-or-medium event as hero with updated label", async () => {
    render(<HomeNewsWidget C={DARK} onOpenNews={() => {}} />);
    // Medium event is soonest — it becomes the hero
    expect(await screen.findByText("ISM Services PMI")).toBeInTheDocument();
    expect(screen.getByText(/NEXT HIGH\/MED EVENT/i)).toBeInTheDocument();
    expect(screen.getByText(/MEDIUM/i)).toBeInTheDocument();
  });

  it("skips low-impact events — they never appear in the widget", async () => {
    render(<HomeNewsWidget C={DARK} onOpenNews={() => {}} />);
    await screen.findByText("ISM Services PMI");
    expect(screen.queryByText("Low Impact Event")).not.toBeInTheDocument();
  });

  it("does not render a horizontal strip", async () => {
    render(<HomeNewsWidget C={DARK} onOpenNews={() => {}} />);
    await screen.findByText("ISM Services PMI");
    expect(screen.queryByTestId("home-news-strip")).not.toBeInTheDocument();
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
