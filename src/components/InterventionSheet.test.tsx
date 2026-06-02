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
});
