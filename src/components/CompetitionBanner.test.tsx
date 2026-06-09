import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, fireEvent, act } from "@testing-library/react";
import { CompetitionBanner } from "./CompetitionBanner";
import { COMP_END_TS, COMP_JOINED_KEY, markCompetitionJoined } from "../lib/competition";
import { DARK } from "../theme";

describe("CompetitionBanner", () => {
  beforeEach(() => {
    localStorage.clear();
    vi.useFakeTimers();
    vi.setSystemTime(COMP_END_TS - 86400000); // 1 day before end
  });
  afterEach(() => vi.useRealTimers());

  it("renders when not joined and competition is active", () => {
    render(<CompetitionBanner C={DARK} isMobile onJoin={async () => {}} />);
    expect(screen.getByText(/enter competition/i)).toBeInTheDocument();
  });

  it("does not render when already joined", () => {
    markCompetitionJoined();
    const { container } = render(<CompetitionBanner C={DARK} isMobile onJoin={async () => {}} />);
    expect(container.firstChild).toBeNull();
  });

  it("does not render after competition ends", () => {
    vi.setSystemTime(COMP_END_TS + 1000);
    const { container } = render(<CompetitionBanner C={DARK} isMobile onJoin={async () => {}} />);
    expect(container.firstChild).toBeNull();
  });

  it("calls onJoin when Enter competition is clicked", async () => {
    const onJoin = vi.fn().mockResolvedValue(undefined);
    render(<CompetitionBanner C={DARK} isMobile onJoin={onJoin} />);
    await act(async () => {
      fireEvent.click(screen.getByText(/enter competition/i));
    });
    expect(onJoin).toHaveBeenCalledOnce();
  });

  it("soft-dismisses on × without setting localStorage", () => {
    render(<CompetitionBanner C={DARK} isMobile onJoin={async () => {}} />);
    fireEvent.click(screen.getByRole("button", { name: /dismiss/i }));
    expect(screen.queryByText(/enter competition/i)).not.toBeInTheDocument();
    expect(localStorage.getItem(COMP_JOINED_KEY)).toBeNull();
  });
});
