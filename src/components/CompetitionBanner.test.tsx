import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent, act } from "@testing-library/react";
import { CompetitionBannerContent } from "./CompetitionBanner";
import {
  isCompetitionBannerDismissed,
  markCompetitionBannerDismissed,
  COMP_BANNER_DISMISSED_KEY,
} from "../lib/competition";
import { DARK } from "../theme";

describe("CompetitionBannerContent", () => {
  it("renders the CTA and headline", () => {
    render(<CompetitionBannerContent C={DARK} isMobile onJoin={async () => {}} />);
    expect(screen.getByText(/enter competition/i)).toBeInTheDocument();
    expect(screen.getByText(/top the leaderboard/i)).toBeInTheDocument();
  });

  it("calls onJoin when Enter competition is clicked", async () => {
    const onJoin = vi.fn().mockResolvedValue(undefined);
    render(<CompetitionBannerContent C={DARK} isMobile onJoin={onJoin} />);
    await act(async () => {
      fireEvent.click(screen.getByText(/enter competition/i));
    });
    expect(onJoin).toHaveBeenCalledOnce();
  });
});

describe("competition banner dismiss persistence", () => {
  it("persists dismissal in localStorage", () => {
    localStorage.clear();
    expect(isCompetitionBannerDismissed()).toBe(false);
    markCompetitionBannerDismissed();
    expect(localStorage.getItem(COMP_BANNER_DISMISSED_KEY)).toBe("1");
    expect(isCompetitionBannerDismissed()).toBe(true);
  });
});
