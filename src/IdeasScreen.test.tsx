import { describe, it, expect, vi, afterEach } from "vitest";
import { render, screen, cleanup, waitFor } from "@testing-library/react";
import type { CSSProperties } from "react";
import { DARK } from "./theme";
import type { Idea } from "./types";

vi.mock("@supabase/supabase-js", () => ({
  createClient: () => ({
    auth: {
      getSession: async () => ({ data: { session: { access_token: "fake-token" } } }),
      onAuthStateChange: () => ({ data: { subscription: { unsubscribe: () => {} } } }),
    },
    storage: {
      from: () => ({
        upload: async () => ({ error: null }),
        getPublicUrl: () => ({ data: { publicUrl: "" } }),
      }),
    },
  }),
}));

import { IdeasScreen } from "./IdeasScreen";

const sampleIdea: Idea = {
  id: "idea-1",
  authorUid: "u1",
  authorHandle: "trader",
  authorName: "Test Trader",
  authorAvatar: null,
  type: "post",
  title: "NQ test breakout",
  body: "Took the entry above VWAP and held the runner.",
  instrument: "NQ",
  timeframe: "15m",
  direction: "long",
  entryPrice: "21420",
  stopPrice: "21380",
  targetPrice: "21520",
  chartUrl: null,
  linkedTradeId: null,
  createdAt: new Date().toISOString(),
  likeCount: 3,
  likedByMe: false,
};

const C = DARK as unknown as Record<string, string>;
const inp: CSSProperties = {};
const pillPrimary = (): CSSProperties => ({});

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

describe("IdeasScreen", () => {
  it("renders empty state when no ideas", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: true,
        json: () => Promise.resolve({ ideas: [], hasMore: false }),
      }),
    );

    render(
      <IdeasScreen
        myUid="u1"
        recentTrades={[]}
        C={C}
        inp={inp}
        pillPrimary={pillPrimary}
        isDesktop={false}
      />,
    );

    await waitFor(() => {
      expect(screen.getByText(/Nothing posted yet today/i)).toBeInTheDocument();
    });
  });

  it("renders idea card from API response", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: true,
        json: () => Promise.resolve({ ideas: [sampleIdea], hasMore: false }),
      }),
    );

    render(
      <IdeasScreen
        myUid="u1"
        recentTrades={[]}
        C={C}
        inp={inp}
        pillPrimary={pillPrimary}
        isDesktop={false}
      />,
    );

    await waitFor(() => {
      expect(screen.getByTestId("idea-card-idea-1")).toBeInTheDocument();
      expect(screen.getByText("NQ test breakout")).toBeInTheDocument();
    });
  });
});
