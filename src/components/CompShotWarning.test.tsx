import { describe, it, expect, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import { CompShotWarning } from "./CompShotWarning";
import { markCompetitionJoined } from "../lib/competition";
import { DARK } from "../theme";

const IN_WINDOW = "2026-06-20";
const OUT_WINDOW = "2026-06-01";

describe("CompShotWarning", () => {
  beforeEach(() => localStorage.clear());

  it("shows when joined + window date + no screenshot", () => {
    markCompetitionJoined();
    render(<CompShotWarning C={DARK} date={IN_WINDOW} hasScreenshot={false} />);
    expect(screen.getByText(/screenshot is required/i)).toBeInTheDocument();
  });

  it("hidden when not joined", () => {
    const { container } = render(<CompShotWarning C={DARK} date={IN_WINDOW} hasScreenshot={false} />);
    expect(container.firstChild).toBeNull();
  });

  it("hidden when trade date is outside the window", () => {
    markCompetitionJoined();
    const { container } = render(<CompShotWarning C={DARK} date={OUT_WINDOW} hasScreenshot={false} />);
    expect(container.firstChild).toBeNull();
  });

  it("hidden when a screenshot is attached", () => {
    markCompetitionJoined();
    const { container } = render(<CompShotWarning C={DARK} date={IN_WINDOW} hasScreenshot={true} />);
    expect(container.firstChild).toBeNull();
  });

  it("hidden when date is empty", () => {
    markCompetitionJoined();
    const { container } = render(<CompShotWarning C={DARK} date="" hasScreenshot={false} />);
    expect(container.firstChild).toBeNull();
  });
});
