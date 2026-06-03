import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { PreSessionSheet } from "./PreSessionSheet";
import { DARK } from "../theme";

describe("PreSessionSheet", () => {
  it("renders both limits when both are set", () => {
    render(
      <PreSessionSheet
        open
        C={DARK}
        isMobile
        maxDailyLoss={500}
        maxTradesPerDay={3}
        onStart={() => {}}
        onCancel={() => {}}
      />,
    );
    expect(screen.getByText("Daily loss limit")).toBeInTheDocument();
    expect(screen.getByText("$500")).toBeInTheDocument();
    expect(screen.getByText("Max trades today")).toBeInTheDocument();
    expect(screen.getByText("3")).toBeInTheDocument();
  });

  it("hides limit rows when value is null or zero", () => {
    render(
      <PreSessionSheet
        open
        C={DARK}
        isMobile
        maxDailyLoss={null}
        maxTradesPerDay={5}
        onStart={() => {}}
        onCancel={() => {}}
      />,
    );
    expect(screen.queryByText("Daily loss limit")).not.toBeInTheDocument();
    expect(screen.getByText("Max trades today")).toBeInTheDocument();
  });

  it("calls onStart when 'Start session' is tapped", () => {
    const onStart = vi.fn();
    render(
      <PreSessionSheet
        open
        C={DARK}
        isMobile
        maxDailyLoss={500}
        maxTradesPerDay={null}
        onStart={onStart}
        onCancel={() => {}}
      />,
    );
    fireEvent.click(screen.getByRole("button", { name: /start session/i }));
    expect(onStart).toHaveBeenCalledOnce();
  });

  it("calls onCancel when 'Not yet' is tapped", () => {
    const onCancel = vi.fn();
    render(
      <PreSessionSheet
        open
        C={DARK}
        isMobile
        maxDailyLoss={500}
        maxTradesPerDay={null}
        onStart={() => {}}
        onCancel={onCancel}
      />,
    );
    fireEvent.click(screen.getByRole("button", { name: /not yet/i }));
    expect(onCancel).toHaveBeenCalledOnce();
  });

  it("does not render when open=false", () => {
    render(
      <PreSessionSheet
        open={false}
        C={DARK}
        isMobile
        maxDailyLoss={500}
        maxTradesPerDay={3}
        onStart={() => {}}
        onCancel={() => {}}
      />,
    );
    expect(screen.queryByText(/ready to trade/i)).not.toBeInTheDocument();
  });
});
