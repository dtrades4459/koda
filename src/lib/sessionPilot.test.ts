import { describe, it, expect } from "vitest";
import { isSessionPilot } from "./sessionPilot";

describe("isSessionPilot", () => {
  it("is false for an undefined uid", () => {
    expect(isSessionPilot(undefined)).toBe(false);
  });
  it("is false for a uid not in the pilot list (Phase 1)", () => {
    expect(isSessionPilot("not-a-pilot-uid")).toBe(false);
  });
});
