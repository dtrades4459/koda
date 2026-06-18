import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { DARK } from "../theme";
import type { Profile } from "../types";

// Drive the card through a controllable fake hook.
const hookState: Record<string, unknown> = {};
vi.mock("../hooks/useTradingSession", () => ({
  useTradingSession: () => hookState,
}));

import { SessionCard } from "./SessionCard";

const PROFILE: Profile = {
  name: "", handle: "", bio: "", avatar: "", broker: "",
  timezone: "UTC", startDate: "", targetRR: "", maxTradesPerDay: "5",
  uid: "u1", maxDailyLoss: "500",
};

// useTradingSession is mocked, so the bridge is inert here — it only needs to
// satisfy the prop type.
const COOLDOWN = { lockedUntil: null, cooldownMin: 15, startCooldown: vi.fn() };

function baseHook() {
  return {
    session: null, tally: null, interventionOpen: false, interventionSignals: [],
    lockedUntil: null, cooldownMin: 15,
    start: vi.fn().mockResolvedValue(undefined),
    tap: vi.fn().mockResolvedValue(undefined),
    checkMe: vi.fn(),
    continueTrading: vi.fn().mockResolvedValue(undefined),
    coolOff: vi.fn().mockResolvedValue(undefined),
    end: vi.fn().mockResolvedValue(undefined),
  };
}

beforeEach(() => {
  for (const k of Object.keys(hookState)) delete hookState[k];
  Object.assign(hookState, baseHook());
});

describe("SessionCard", () => {
  it("idle: shows Start session and opens the pre-session sheet", () => {
    render(<SessionCard profile={PROFILE} C={DARK} isMobile cooldown={COOLDOWN} />);
    const start = screen.getByRole("button", { name: /start session/i });
    fireEvent.click(start);
    // PreSessionSheet renders the captured limits — unique to the sheet.
    expect(screen.getByText(/daily loss limit/i)).toBeInTheDocument();
  });

  it("armed: + Loss reveals the $ field, then Log loss taps with null when blank", () => {
    Object.assign(hookState, {
      session: { startedAt: new Date().toISOString(), maxDailyLoss: 500, maxTradesPerDay: 5, taps: [] },
      tally: { wins: 0, losses: 0, netDollar: 0, hasDollar: false, streak: 0, streakKind: null },
    });
    render(<SessionCard profile={PROFILE} C={DARK} isMobile cooldown={COOLDOWN} />);
    fireEvent.click(screen.getByRole("button", { name: /\+ loss/i }));
    fireEvent.click(screen.getByRole("button", { name: /log loss/i }));
    expect(hookState.tap).toHaveBeenCalledWith("Loss", null);
  });

  it("armed: a $ amount typed as a positive number is stored as a NEGATIVE loss", () => {
    Object.assign(hookState, {
      session: { startedAt: new Date().toISOString(), maxDailyLoss: 500, maxTradesPerDay: 5, taps: [] },
      tally: { wins: 0, losses: 0, netDollar: 0, hasDollar: false, streak: 0, streakKind: null },
    });
    render(<SessionCard profile={PROFILE} C={DARK} isMobile cooldown={COOLDOWN} />);
    fireEvent.click(screen.getByRole("button", { name: /\+ loss/i }));
    fireEvent.change(screen.getByPlaceholderText(/\$ lost/i), { target: { value: "200" } });
    fireEvent.click(screen.getByRole("button", { name: /log loss/i }));
    // critical: evaluateTilt only fires daily-loss signals when netPnl < 0
    expect(hookState.tap).toHaveBeenCalledWith("Loss", -200);
  });

  it("armed: a negative number typed is normalised to a single negative loss", () => {
    Object.assign(hookState, {
      session: { startedAt: new Date().toISOString(), maxDailyLoss: 500, maxTradesPerDay: 5, taps: [] },
      tally: { wins: 0, losses: 0, netDollar: 0, hasDollar: false, streak: 0, streakKind: null },
    });
    render(<SessionCard profile={PROFILE} C={DARK} isMobile cooldown={COOLDOWN} />);
    fireEvent.click(screen.getByRole("button", { name: /\+ loss/i }));
    fireEvent.change(screen.getByPlaceholderText(/\$ lost/i), { target: { value: "-150" } });
    fireEvent.click(screen.getByRole("button", { name: /log loss/i }));
    expect(hookState.tap).toHaveBeenCalledWith("Loss", -150);
  });

  it("armed: + Win taps immediately with null", () => {
    Object.assign(hookState, {
      session: { startedAt: new Date().toISOString(), maxDailyLoss: 500, maxTradesPerDay: 5, taps: [] },
      tally: { wins: 0, losses: 0, netDollar: 0, hasDollar: false, streak: 0, streakKind: null },
    });
    render(<SessionCard profile={PROFILE} C={DARK} isMobile cooldown={COOLDOWN} />);
    fireEvent.click(screen.getByRole("button", { name: /\+ win/i }));
    expect(hookState.tap).toHaveBeenCalledWith("Win", null);
  });

  it("armed: End session opens the debrief sheet", async () => {
    Object.assign(hookState, {
      session: { startedAt: new Date().toISOString(), maxDailyLoss: 500, maxTradesPerDay: 5, taps: [] },
      tally: { wins: 1, losses: 2, netDollar: -50, hasDollar: true, streak: 2, streakKind: "Loss" },
    });
    render(<SessionCard profile={PROFILE} C={DARK} isMobile cooldown={COOLDOWN} />);
    fireEvent.click(screen.getByRole("button", { name: /end session/i }));
    await waitFor(() => expect(screen.getByText(/follow your rules/i)).toBeInTheDocument());
  });

  it("renders the intervention sheet when interventionOpen is true", () => {
    Object.assign(hookState, {
      session: { startedAt: new Date().toISOString(), maxDailyLoss: 500, maxTradesPerDay: 5, taps: [] },
      tally: { wins: 0, losses: 2, netDollar: -200, hasDollar: true, streak: 2, streakKind: "Loss" },
      interventionOpen: true,
      interventionSignals: [{ id: "consec_losses", label: "2 consecutive losses", critical: false }],
    });
    render(<SessionCard profile={PROFILE} C={DARK} isMobile cooldown={COOLDOWN} />);
    expect(screen.getByText(/heads up/i)).toBeInTheDocument();
  });
});
