import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { InterventionSheet } from "./InterventionSheet";
import { DARK } from "../theme";

const SIGNALS = [
  { id: "consec_losses" as const, label: "2 consecutive losses", critical: false },
  { id: "tilt_emotion"  as const, label: "Last trade tagged REVENGE", critical: false },
];

describe("InterventionSheet", () => {
  it("renders title with signal count", () => {
    render(<InterventionSheet open signals={SIGNALS} C={DARK} isMobile onContinue={() => {}} onCancel={() => {}} />);
    expect(screen.getByText(/2 tilt signals/i)).toBeInTheDocument();
  });

  it("renders one row per signal", () => {
    render(<InterventionSheet open signals={SIGNALS} C={DARK} isMobile onContinue={() => {}} onCancel={() => {}} />);
    expect(screen.getByText("2 consecutive losses")).toBeInTheDocument();
    expect(screen.getByText("Last trade tagged REVENGE")).toBeInTheDocument();
  });

  it("calls onContinue when 'I'm aware' is tapped", () => {
    const onContinue = vi.fn();
    render(<InterventionSheet open signals={SIGNALS} C={DARK} isMobile onContinue={onContinue} onCancel={() => {}} />);
    fireEvent.click(screen.getByRole("button", { name: /aware/i }));
    expect(onContinue).toHaveBeenCalledOnce();
  });

  it("calls onCancel when 'Cancel' is tapped", () => {
    const onCancel = vi.fn();
    render(<InterventionSheet open signals={SIGNALS} C={DARK} isMobile onContinue={() => {}} onCancel={onCancel} />);
    fireEvent.click(screen.getByRole("button", { name: /cancel/i }));
    expect(onCancel).toHaveBeenCalledOnce();
  });

  it("does not render when open=false", () => {
    render(<InterventionSheet open={false} signals={SIGNALS} C={DARK} isMobile onContinue={() => {}} onCancel={() => {}} />);
    expect(screen.queryByText(/tilt signals/i)).not.toBeInTheDocument();
  });

  it("tags critical signals with a 'critical' badge", () => {
    const mix = [
      { id: "consec_losses" as const, label: "2 consecutive losses", critical: false },
      { id: "daily_loss_90" as const, label: "−92% of daily loss limit", critical: true },
    ];
    render(<InterventionSheet open signals={mix} C={DARK} isMobile onContinue={() => {}} onCancel={() => {}} />);
    expect(screen.getAllByText(/critical/i).length).toBeGreaterThanOrEqual(2);
    expect(screen.getByText("−92% of daily loss limit")).toBeInTheDocument();
  });

  it("uses critical-tone headline when only critical signals are active", () => {
    const crit = [
      { id: "trade_cap_at" as const, label: "Daily trade cap reached", critical: true },
    ];
    render(<InterventionSheet open signals={crit} C={DARK} isMobile onContinue={() => {}} onCancel={() => {}} />);
    // New editorial copy: kicker reads "Heads up · critical", sub explains the signal count.
    expect(screen.getByText(/heads up · critical/i)).toBeInTheDocument();
    expect(screen.getByText(/one critical tilt signal is active/i)).toBeInTheDocument();
  });

  it("shows configured cooldown duration on the Cancel button", () => {
    render(<InterventionSheet open signals={SIGNALS} C={DARK} isMobile cooldownMin={15} onContinue={() => {}} onCancel={() => {}} />);
    expect(screen.getByRole("button", { name: /15-min break/i })).toBeInTheDocument();
  });

  it("falls back to generic cancel label when cooldownMin is 0", () => {
    render(<InterventionSheet open signals={SIGNALS} C={DARK} isMobile cooldownMin={0} onContinue={() => {}} onCancel={() => {}} />);
    expect(screen.getByRole("button", { name: /take a break/i })).toBeInTheDocument();
  });
});
