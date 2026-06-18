import { describe, it, expect } from "vitest";
import { isSessionPilot, SESSION_PILOT_UIDS } from "./sessionPilot";

describe("isSessionPilot", () => {
  it("is false for an undefined uid", () => {
    expect(isSessionPilot(undefined)).toBe(false);
  });
  it("is false for a uid not in the pilot list", () => {
    expect(isSessionPilot("not-a-pilot-uid")).toBe(false);
  });
  it("is true for a uid in the pilot cohort", () => {
    // Guards against the cohort being accidentally cleared.
    expect(SESSION_PILOT_UIDS.length).toBeGreaterThan(0);
    expect(isSessionPilot(SESSION_PILOT_UIDS[0])).toBe(true);
  });
});
