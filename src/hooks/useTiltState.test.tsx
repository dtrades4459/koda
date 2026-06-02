import { describe, it, expect, vi, beforeEach } from "vitest";
import { renderHook, waitFor } from "@testing-library/react";

const storageGet = vi.fn();
const storageSet = vi.fn();
vi.mock("../lib/storage", () => ({
  storage: {
    get: (...a: unknown[]) => storageGet(...a),
    set: (...a: unknown[]) => storageSet(...a),
  },
}));

import { useTiltState } from "./useTiltState";
import type { Trade, Profile } from "../types";

const PROFILE: Profile = {
  name: "", handle: "", bio: "", avatar: "", broker: "",
  timezone: "UTC", startDate: "", targetRR: "",
  maxTradesPerDay: "",
};

beforeEach(() => {
  storageGet.mockReset();
  storageSet.mockReset();
});

describe("useTiltState", () => {
  it("returns inactive state and no lockout when no cooldown stored", async () => {
    storageGet.mockResolvedValueOnce(null);
    const { result } = renderHook(() => useTiltState({ trades: [] as Trade[], profile: PROFILE }));
    await waitFor(() => expect(result.current.state.active).toBe(false));
    expect(result.current.lockedUntil).toBeNull();
  });

  it("exposes lockedUntil when the stored lockout is still in the future", async () => {
    const future = new Date(Date.now() + 5 * 60 * 1000).toISOString();
    storageGet.mockResolvedValueOnce({ value: JSON.stringify({ until: future }) });
    const { result } = renderHook(() => useTiltState({ trades: [] as Trade[], profile: PROFILE }));
    await waitFor(() => expect(result.current.lockedUntil).not.toBeNull());
    expect(result.current.lockedUntil! > Date.now()).toBe(true);
  });

  it("treats an expired stored lockout as null", async () => {
    const past = new Date(Date.now() - 60 * 1000).toISOString();
    storageGet.mockResolvedValueOnce({ value: JSON.stringify({ until: past }) });
    const { result } = renderHook(() => useTiltState({ trades: [] as Trade[], profile: PROFILE }));
    await waitFor(() => expect(result.current.lockedUntil).toBeNull());
  });
});
