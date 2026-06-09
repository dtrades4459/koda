import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import {
  COMP_CIRCLE_CODE, COMP_END_TS, COMP_START_TS, COMP_JOINED_KEY,
  isCompetitionActive, isCompetitionStarted, isCompetitionJoined,
  markCompetitionJoined, compDaysRemaining, compDaysUntilStart,
  compStatusText, shouldShowCompetitionCard,
} from "./competition";

describe("competition helpers", () => {
  beforeEach(() => { localStorage.clear(); vi.useFakeTimers(); });
  afterEach(() => vi.useRealTimers());

  it("isCompetitionActive is true before end date", () => {
    vi.setSystemTime(COMP_END_TS - 1000);
    expect(isCompetitionActive()).toBe(true);
  });

  it("isCompetitionActive is false after end date", () => {
    vi.setSystemTime(COMP_END_TS + 1000);
    expect(isCompetitionActive()).toBe(false);
  });

  it("isCompetitionStarted is true after start date", () => {
    vi.setSystemTime(COMP_START_TS + 1000);
    expect(isCompetitionStarted()).toBe(true);
  });

  it("isCompetitionStarted is false before start date", () => {
    vi.setSystemTime(COMP_START_TS - 1000);
    expect(isCompetitionStarted()).toBe(false);
  });

  it("isCompetitionJoined returns false when key absent", () => {
    expect(isCompetitionJoined()).toBe(false);
  });

  it("markCompetitionJoined sets the key; isCompetitionJoined returns true", () => {
    markCompetitionJoined();
    expect(isCompetitionJoined()).toBe(true);
    expect(localStorage.getItem(COMP_JOINED_KEY)).toBe("1");
  });

  it("compDaysRemaining returns days until end", () => {
    vi.setSystemTime(COMP_END_TS - 5 * 86400000);
    expect(compDaysRemaining()).toBe(5);
  });

  it("compDaysRemaining returns 0 after end", () => {
    vi.setSystemTime(COMP_END_TS + 1000);
    expect(compDaysRemaining()).toBe(0);
  });

  it("compDaysUntilStart returns days until start", () => {
    vi.setSystemTime(COMP_START_TS - 3 * 86400000);
    expect(compDaysUntilStart()).toBe(3);
  });

  describe("compStatusText", () => {
    it("shows 'Starts in X days' before start", () => {
      vi.setSystemTime(COMP_START_TS - 3 * 86400000);
      expect(compStatusText(50)).toMatch(/starts in 3 days/i);
    });

    it("shows days remaining and trader count during competition", () => {
      vi.setSystemTime(COMP_END_TS - 7 * 86400000);
      expect(compStatusText(100)).toMatch(/7 days remaining · 100 traders/i);
    });

    it("handles singular 'day' and 'trader'", () => {
      vi.setSystemTime(COMP_END_TS - 86400000);
      expect(compStatusText(1)).toMatch(/1 day remaining · 1 trader/i);
    });

    it("shows closed message after end", () => {
      vi.setSystemTime(COMP_END_TS + 1000);
      expect(compStatusText(0)).toMatch(/competition closed/i);
    });
  });

  describe("shouldShowCompetitionCard", () => {
    it("returns true when not in myCircles and competition active", () => {
      vi.setSystemTime(COMP_END_TS - 1000);
      expect(shouldShowCompetitionCard(["OTHER"])).toBe(true);
    });

    it("returns false when comp circle is in myCircles", () => {
      vi.setSystemTime(COMP_END_TS - 1000);
      expect(shouldShowCompetitionCard([COMP_CIRCLE_CODE])).toBe(false);
    });

    it("returns false after competition ends", () => {
      vi.setSystemTime(COMP_END_TS + 1000);
      expect(shouldShowCompetitionCard([])).toBe(false);
    });
  });
});
