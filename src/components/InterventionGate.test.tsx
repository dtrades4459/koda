import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { InterventionGate } from "./InterventionGate";
import { DARK } from "../theme";

const NO_SIGNALS = { active: false, critical: false, signals: [], evaluatedAt: 0 };
const ACTIVE_STATE = {
  active: true, critical: false, evaluatedAt: 0,
  signals: [{ id: "consec_losses" as const, label: "2 consecutive losses", critical: false }],
};

describe("InterventionGate", () => {
  it("renders the child Log Trade button as-is when tilt is inactive and no lockout", () => {
    const onProceed = vi.fn();
    render(
      <InterventionGate
        state={NO_SIGNALS} lockedUntil={null} settings={{ enabled: true, cooldownMin: 15 }}
        isMobile C={DARK} onContinue={onProceed} onCancel={() => {}}
      >
        <button>Log Trade</button>
      </InterventionGate>,
    );
    fireEvent.click(screen.getByText("Log Trade"));
    expect(onProceed).toHaveBeenCalledOnce();
  });

  it("renders the cooldown pill in place of the child when locked", () => {
    const future = Date.now() + 5 * 60 * 1000;
    render(
      <InterventionGate
        state={NO_SIGNALS} lockedUntil={future} settings={{ enabled: true, cooldownMin: 15 }}
        isMobile C={DARK} onContinue={() => {}} onCancel={() => {}}
      >
        <button>Log Trade</button>
      </InterventionGate>,
    );
    expect(screen.queryByText("Log Trade")).not.toBeInTheDocument();
    expect(screen.getByText(/cooling off/i)).toBeInTheDocument();
  });

  it("opens the sheet when child is tapped and tilt is active", () => {
    render(
      <InterventionGate
        state={ACTIVE_STATE} lockedUntil={null} settings={{ enabled: true, cooldownMin: 15 }}
        isMobile C={DARK} onContinue={() => {}} onCancel={() => {}}
      >
        <button>Log Trade</button>
      </InterventionGate>,
    );
    fireEvent.click(screen.getByText("Log Trade"));
    expect(screen.getByText(/tilt signal/i)).toBeInTheDocument();
  });

  it("calls onContinue when sheet's continue is tapped", () => {
    const onContinue = vi.fn();
    render(
      <InterventionGate
        state={ACTIVE_STATE} lockedUntil={null} settings={{ enabled: true, cooldownMin: 15 }}
        isMobile C={DARK} onContinue={onContinue} onCancel={() => {}}
      >
        <button>Log Trade</button>
      </InterventionGate>,
    );
    fireEvent.click(screen.getByText("Log Trade"));
    fireEvent.click(screen.getByRole("button", { name: /aware/i }));
    expect(onContinue).toHaveBeenCalledOnce();
  });

  it("bypasses gating when settings.enabled = false", () => {
    const onContinue = vi.fn();
    render(
      <InterventionGate
        state={ACTIVE_STATE} lockedUntil={null} settings={{ enabled: false, cooldownMin: 15 }}
        isMobile C={DARK} onContinue={onContinue} onCancel={() => {}}
      >
        <button>Log Trade</button>
      </InterventionGate>,
    );
    fireEvent.click(screen.getByText("Log Trade"));
    expect(onContinue).toHaveBeenCalledOnce();
  });
});
