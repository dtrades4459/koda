import { describe, it, expect } from "vitest";
import { computeIsPro, isGrandfathered, paywallActive, PAYWALL_GO_LIVE } from "./entitlements";

const BEFORE = PAYWALL_GO_LIVE - 1; // a moment before the paywall goes live
const AFTER = PAYWALL_GO_LIVE + 1; // a moment after
const earlyUser = "2026-06-01T12:00:00Z"; // joined during beta
const lateUser = "2026-07-01T12:00:00Z"; // joined after launch

describe("paywallActive", () => {
  it("is off before go-live (beta is open)", () => {
    expect(paywallActive(BEFORE)).toBe(false);
  });
  it("is on at/after go-live", () => {
    expect(paywallActive(AFTER)).toBe(true);
  });
});

describe("isGrandfathered", () => {
  it("true for accounts created before go-live", () => {
    expect(isGrandfathered(earlyUser)).toBe(true);
  });
  it("false for accounts created after go-live", () => {
    expect(isGrandfathered(lateUser)).toBe(false);
  });
  it("false when createdAt is missing or unparseable", () => {
    expect(isGrandfathered(undefined)).toBe(false);
    expect(isGrandfathered("not-a-date")).toBe(false);
  });
});

describe("computeIsPro", () => {
  it("pre-launch: everyone has Pro (beta open)", () => {
    expect(computeIsPro({ plan: "free", createdAt: lateUser, now: BEFORE })).toBe(true);
  });
  it("post-launch: a user who joined before launch keeps Pro free forever", () => {
    expect(computeIsPro({ plan: "free", createdAt: earlyUser, now: AFTER })).toBe(true);
  });
  it("post-launch: a NEW free user is gated (not Pro)", () => {
    expect(computeIsPro({ plan: "free", createdAt: lateUser, now: AFTER })).toBe(false);
  });
  it("post-launch: a new user who PAID is Pro", () => {
    expect(computeIsPro({ plan: "pro", createdAt: lateUser, now: AFTER })).toBe(true);
  });
  it("elite plan is Pro", () => {
    expect(computeIsPro({ plan: "elite", createdAt: lateUser, now: AFTER })).toBe(true);
  });
  it("a founder is always Pro regardless of plan or date", () => {
    expect(computeIsPro({ plan: "free", createdAt: lateUser, isFounder: true, now: AFTER })).toBe(true);
  });
});
