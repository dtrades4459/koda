import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("posthog-js", () => ({ default: { init: vi.fn(), identify: vi.fn(), reset: vi.fn(), capture: vi.fn() } }));

import { hasAnalyticsConsent, COOKIE_CONSENT_KEY } from "./posthog";

// Regression guard: the granular CookieConsent banner writes JSON
// ({ essential, analytics, marketing, ts }) while the original implementation
// only recognised the legacy "accepted" string — which silently disabled
// PostHog for every post-banner user (caught by CI smoke 2026-06-10).
describe("hasAnalyticsConsent", () => {
  beforeEach(() => localStorage.clear());

  it("is false when no choice is stored", () => {
    expect(hasAnalyticsConsent()).toBe(false);
  });

  it("accepts the legacy 'accepted' string", () => {
    localStorage.setItem(COOKIE_CONSENT_KEY, "accepted");
    expect(hasAnalyticsConsent()).toBe(true);
  });

  it("rejects the legacy 'rejected' string", () => {
    localStorage.setItem(COOKIE_CONSENT_KEY, "rejected");
    expect(hasAnalyticsConsent()).toBe(false);
  });

  it("accepts granular JSON with analytics: true", () => {
    localStorage.setItem(COOKIE_CONSENT_KEY, JSON.stringify({ essential: true, analytics: true, marketing: false, ts: Date.now() }));
    expect(hasAnalyticsConsent()).toBe(true);
  });

  it("rejects granular JSON with analytics: false", () => {
    localStorage.setItem(COOKIE_CONSENT_KEY, JSON.stringify({ essential: true, analytics: false, marketing: false, ts: Date.now() }));
    expect(hasAnalyticsConsent()).toBe(false);
  });

  it("is false for malformed values", () => {
    localStorage.setItem(COOKIE_CONSENT_KEY, "{not json");
    expect(hasAnalyticsConsent()).toBe(false);
    localStorage.setItem(COOKIE_CONSENT_KEY, JSON.stringify({ analytics: "yes" }));
    expect(hasAnalyticsConsent()).toBe(false);
  });
});
