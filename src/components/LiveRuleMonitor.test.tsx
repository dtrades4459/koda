import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { LiveRuleMonitor } from "./LiveRuleMonitor";
import { DARK } from "../theme";

describe("LiveRuleMonitor", () => {
  it("renders dollar P&L with limit when useDollar=true and maxLoss set", () => {
    render(
      <LiveRuleMonitor
        C={DARK}
        pnl={-120.5}
        maxLoss={500}
        trades={2}
        maxTrades={5}
        useDollar
      />,
    );
    expect(screen.getByText("−$120.50")).toBeInTheDocument();
    expect(screen.getByText("/ −$500")).toBeInTheDocument();
    expect(screen.getByText("2 / 5")).toBeInTheDocument();
  });

  it("renders R-based P&L when useDollar=false", () => {
    render(
      <LiveRuleMonitor
        C={DARK}
        pnl={2.5}
        maxLoss={3}
        trades={1}
        maxTrades={0}
        useDollar={false}
      />,
    );
    expect(screen.getByText("+2.50R")).toBeInTheDocument();
    expect(screen.getByText("1")).toBeInTheDocument();
  });

  it("shows last-break label when provided", () => {
    render(
      <LiveRuleMonitor
        C={DARK}
        pnl={-50}
        maxLoss={500}
        trades={3}
        maxTrades={5}
        useDollar
        lastBreak="REVENGE"
      />,
    );
    expect(screen.getByText("REVENGE")).toBeInTheDocument();
  });

  it("calls onWrapUp when the Wrap up button is tapped", () => {
    const onWrapUp = vi.fn();
    render(
      <LiveRuleMonitor
        C={DARK}
        pnl={-50}
        maxLoss={500}
        trades={1}
        maxTrades={3}
        useDollar
        onWrapUp={onWrapUp}
      />,
    );
    fireEvent.click(screen.getByRole("button", { name: /wrap up/i }));
    expect(onWrapUp).toHaveBeenCalledOnce();
  });

  it("hides Wrap up button when onWrapUp is not provided", () => {
    render(
      <LiveRuleMonitor
        C={DARK}
        pnl={-50}
        maxLoss={500}
        trades={1}
        maxTrades={3}
        useDollar
      />,
    );
    expect(screen.queryByRole("button", { name: /wrap up/i })).not.toBeInTheDocument();
  });
});
