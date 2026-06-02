import { describe, it, expect } from "vitest";
import { evaluateTilt } from "./tilt";
import type { Trade, Profile } from "../types";

const EMPTY_PROFILE: Profile = {
  name: "", handle: "", bio: "", avatar: "", broker: "",
  timezone: "UTC", startDate: "", targetRR: "",
  maxTradesPerDay: "",
};

describe("evaluateTilt", () => {
  it("returns inactive state when there are no trades", () => {
    const state = evaluateTilt([] as Trade[], EMPTY_PROFILE, Date.parse("2026-06-02T15:00:00Z"));
    expect(state.active).toBe(false);
    expect(state.signals).toEqual([]);
  });
});
