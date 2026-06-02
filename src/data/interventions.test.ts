import { describe, it, expect, vi, beforeEach } from "vitest";

// Mock supabase before importing the module under test.
const insertMock = vi.fn();
const selectMock = vi.fn();
const updateMock = vi.fn();
const eqMock = vi.fn();
const orderMock = vi.fn();
const limitMock = vi.fn();
const isMock = vi.fn();
const gteMock = vi.fn();

vi.mock("../lib/supabase", () => {
  const single = vi.fn(() => ({ data: { id: "evt-1" }, error: null }));
  const from = vi.fn(() => ({
    insert: (...args: unknown[]) => { insertMock(...args); return { select: () => ({ single }) }; },
    select: (...args: unknown[]) => { selectMock(...args); return { eq: eqMock, order: orderMock, limit: limitMock, is: isMock, gte: gteMock }; },
    update: (...args: unknown[]) => { updateMock(...args); return { eq: () => ({ data: null, error: null }) }; },
  }));
  return { supabase: { from, auth: { getUser: () => ({ data: { user: { id: "user-1" } } }) } } };
});

import { logInterventionEvent } from "./interventions";

beforeEach(() => {
  insertMock.mockClear();
  selectMock.mockClear();
  updateMock.mockClear();
});

describe("logInterventionEvent", () => {
  it("inserts a row with the expected shape", async () => {
    await logInterventionEvent({
      userUid: "user-1",
      signals: ["consec_losses", "tilt_emotion"],
      critical: false,
      choice: "cancelled",
      sessionDate: "2026-06-02",
    });
    expect(insertMock).toHaveBeenCalledTimes(1);
    const arg = insertMock.mock.calls[0][0] as Record<string, unknown>;
    expect(arg.user_uid).toBe("user-1");
    expect(arg.signals).toEqual(["consec_losses", "tilt_emotion"]);
    expect(arg.choice).toBe("cancelled");
    expect(arg.session_date).toBe("2026-06-02");
  });
});
