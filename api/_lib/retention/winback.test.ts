// api/_lib/retention/winback.test.ts
import { describe, it, expect } from "vitest";
import { isWinbackCandidate, type WinbackProfile } from "./winback.js";

const DAY = 24 * 3600 * 1000;
const NOW = Date.parse("2026-06-16T12:00:00Z");
const daysAgo = (n: number) => new Date(NOW - n * DAY).toISOString();

const base = (o: Partial<WinbackProfile> = {}): WinbackProfile => ({
  last_active_at: daysAgo(10),
  winback_opt_in: true,
  last_winback_at: null,
  ...o,
});

describe("isWinbackCandidate", () => {
  it("selects a user inactive 7–14 days, opted in, never win-backed", () => {
    expect(isWinbackCandidate(base(), NOW)).toBe(true);
  });
  it("rejects users active within 7 days", () => {
    expect(isWinbackCandidate(base({ last_active_at: daysAgo(3) }), NOW)).toBe(false);
  });
  it("rejects users inactive beyond 14 days (already past the window)", () => {
    expect(isWinbackCandidate(base({ last_active_at: daysAgo(20) }), NOW)).toBe(false);
  });
  it("rejects opted-out users", () => {
    expect(isWinbackCandidate(base({ winback_opt_in: false }), NOW)).toBe(false);
  });
  it("rejects users win-backed within the last 30 days", () => {
    expect(isWinbackCandidate(base({ last_winback_at: daysAgo(10) }), NOW)).toBe(false);
  });
  it("rejects users with no recorded activity", () => {
    expect(isWinbackCandidate(base({ last_active_at: null }), NOW)).toBe(false);
  });
});
