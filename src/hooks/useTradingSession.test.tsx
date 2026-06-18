import { describe, it, expect, vi, beforeEach } from "vitest";
import { renderHook, act, waitFor } from "@testing-library/react";
import type { Profile } from "../types";

const storageGet = vi.fn();
const storageSet = vi.fn();
vi.mock("../lib/storage", () => ({
  storage: {
    get: (...a: unknown[]) => storageGet(...a),
    set: (...a: unknown[]) => storageSet(...a),
    del: vi.fn(),
  },
}));
const logEvent = vi.fn();
vi.mock("../data/interventions", () => ({ logInterventionEvent: (...a: unknown[]) => logEvent(...a) }));
const phCaptureMock = vi.fn();
vi.mock("../lib/posthog", () => ({ phCapture: (...a: unknown[]) => phCaptureMock(...a) }));
vi.mock("../lib/log", () => ({ log: { error: vi.fn() } }));

import { useTradingSession } from "./useTradingSession";

const PROFILE: Profile = {
  name: "", handle: "", bio: "", avatar: "", broker: "",
  timezone: "UTC", startDate: "", targetRR: "", maxTradesPerDay: "5",
  uid: "u1", maxDailyLoss: "500",
};

beforeEach(() => {
  storageGet.mockReset().mockResolvedValue(null);  // start idle
  storageSet.mockReset().mockResolvedValue(true);
  logEvent.mockReset().mockResolvedValue("evt_1");
  phCaptureMock.mockReset();
});

describe("useTradingSession", () => {
  it("starts idle and arms a session on start()", async () => {
    const { result } = renderHook(() => useTradingSession({ profile: PROFILE }));
    await waitFor(() => expect(result.current.session).toBeNull());
    await act(async () => { await result.current.start({ maxDailyLoss: 500, maxTradesPerDay: 5 }); });
    expect(result.current.session).not.toBeNull();
    expect(storageSet).toHaveBeenCalled();
  });

  it("auto-opens the sheet once on the inactive→active edge, not again while active", async () => {
    const { result } = renderHook(() => useTradingSession({ profile: PROFILE }));
    await act(async () => { await result.current.start({ maxDailyLoss: 500, maxTradesPerDay: 5 }); });
    await act(async () => { await result.current.tap("Loss", -100); });
    expect(result.current.interventionOpen).toBe(false);          // 1 loss — inactive
    await act(async () => { await result.current.tap("Loss", -100); });
    expect(result.current.interventionOpen).toBe(true);           // 2nd loss — rising edge fires
    await act(async () => { await result.current.continueTrading(); });
    expect(result.current.interventionOpen).toBe(false);
    await act(async () => { await result.current.tap("Loss", -100); });
    expect(result.current.interventionOpen).toBe(false);          // still active — does NOT re-fire
  });

  it("coolOff logs a cancelled session event", async () => {
    const { result } = renderHook(() => useTradingSession({ profile: PROFILE }));
    await act(async () => { await result.current.start({ maxDailyLoss: 500, maxTradesPerDay: 5 }); });
    await act(async () => { await result.current.tap("Loss", -100); });
    await act(async () => { await result.current.tap("Loss", -100); });
    await act(async () => { await result.current.coolOff(); });
    expect(logEvent).toHaveBeenCalledWith(expect.objectContaining({ choice: "cancelled", source: "session" }));
  });

  it("discards a stale (prior-day) session on load", async () => {
    storageGet.mockResolvedValue({ value: JSON.stringify({
      startedAt: "2000-01-01T09:00:00.000Z", maxDailyLoss: null, maxTradesPerDay: null, taps: [],
    }) });
    const { result } = renderHook(() => useTradingSession({ profile: PROFILE }));
    await waitFor(() => expect(result.current.session).toBeNull());
  });

  it("fires session_started on start and session_ended on end", async () => {
    const { result } = renderHook(() => useTradingSession({ profile: PROFILE }));
    await act(async () => { await result.current.start({ maxDailyLoss: 500, maxTradesPerDay: 5 }); });
    expect(phCaptureMock).toHaveBeenCalledWith("session_started", expect.objectContaining({ maxDailyLoss: 500, maxTradesPerDay: 5 }));
    await act(async () => { await result.current.tap("Win", 100); });
    await act(async () => { await result.current.end(); });
    expect(phCaptureMock).toHaveBeenCalledWith("session_ended", expect.objectContaining({ taps: 1 }));
  });
});
