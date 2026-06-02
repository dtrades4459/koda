import { describe, it, expect, vi } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";

vi.mock("../data/interventions", () => ({
  getInterventionStats: vi.fn(async (userUid: string) =>
    userUid === "user-empty"
      ? { fired: 0, continued: 0, cancelled: 0, postInterventionTrades: 0, postInterventionWins: 0 }
      : { fired: 3, continued: 1, cancelled: 2, postInterventionTrades: 1, postInterventionWins: 0 }
  ),
}));

import { InSessionStatsCard } from "./InSessionStatsCard";
import { DARK } from "../theme";

describe("InSessionStatsCard", () => {
  it("renders fired/continued/cancelled counts", async () => {
    render(<InSessionStatsCard userUid="user-1" trades={[]} C={DARK} />);
    const kicker = await screen.findByText(/in-session check-ins/i);
    const card = kicker.parentElement!;
    expect(card.textContent).toContain("3");
    expect(card.textContent).toContain("fired");
    expect(card.textContent).toContain("1");
    expect(card.textContent).toContain("continued");
    expect(card.textContent).toContain("2");
    expect(card.textContent).toContain("cancelled");
  });

  it("hides itself when no events have fired", async () => {
    const { container } = render(<InSessionStatsCard userUid="user-empty" trades={[]} C={DARK} />);
    await waitFor(() => expect(container.firstChild).toBeNull());
  });
});
