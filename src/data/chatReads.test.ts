import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("../lib/supabase", () => ({
  supabase: {
    from: vi.fn(),
    auth: { getUser: vi.fn() },
  },
}));

vi.mock("../lib/log", () => ({
  log: { error: vi.fn() },
}));

import { supabase } from "../lib/supabase";
import { markChatRead, getUnreadCounts } from "./chatReads";

describe("markChatRead", () => {
  beforeEach(() => vi.clearAllMocks());

  it("upserts a row with the current user_id and now() last_read_at", async () => {
    (supabase.auth.getUser as any).mockResolvedValue({
      data: { user: { id: "user-1" } },
    });
    const upsert = vi.fn().mockResolvedValue({ error: null });
    (supabase.from as any).mockReturnValue({ upsert });

    await markChatRead("KODA-ABC1");

    expect(supabase.from).toHaveBeenCalledWith("chat_reads");
    expect(upsert).toHaveBeenCalledWith(
      expect.objectContaining({ user_id: "user-1", circle_code: "KODA-ABC1" }),
      expect.objectContaining({ onConflict: "user_id,circle_code" })
    );
  });
});

describe("getUnreadCounts", () => {
  beforeEach(() => vi.clearAllMocks());

  it("returns {} immediately when circleCodes is empty (no Supabase calls)", async () => {
    const result = await getUnreadCounts([]);
    expect(result).toEqual({});
    expect(supabase.from).not.toHaveBeenCalled();
  });

  it("returns {} when no authenticated user is present (no further queries)", async () => {
    (supabase.auth.getUser as any).mockResolvedValue({
      data: { user: null },
    });

    const result = await getUnreadCounts(["KODA-A"]);
    expect(result).toEqual({});
    expect(supabase.from).not.toHaveBeenCalled();
  });

  it("returns counts of messages newer than last_read_at per circle", async () => {
    (supabase.auth.getUser as any).mockResolvedValue({
      data: { user: { id: "user-1" } },
    });

    // Track which circle_messages query we're building so the thenable can
    // return the right count.  The first .from() call is always chat_reads;
    // subsequent calls are circle_messages (one per circle, in order).
    let callIndex = 0;

    (supabase.from as any).mockImplementation((table: string) => {
      callIndex++;

      if (table === "chat_reads") {
        return {
          select: () => ({
            eq: () => ({
              in: () =>
                Promise.resolve({
                  data: [
                    { circle_code: "KODA-A", last_read_at: "2026-06-01T00:00:00Z" },
                  ],
                  error: null,
                }),
            }),
          }),
        };
      }

      // circle_messages count chain — must be thenable so `await q` resolves.
      // The .gt() filter is only called when last_read_at exists (KODA-A).
      // KODA-A is the 2nd .from() call (callIndex === 2), KODA-B is 3rd.
      const isKodaA = callIndex === 2;
      const chain: Record<string, unknown> = {
        select: () => chain,
        eq: () => chain,
        gt: () => chain,
        then: (resolve: (v: unknown) => void, _reject: unknown) =>
          resolve({ count: isKodaA ? 3 : 5, error: null }),
      };
      return chain;
    });

    const result = await getUnreadCounts(["KODA-A", "KODA-B"]);
    expect(result).toEqual({ "KODA-A": 3, "KODA-B": 5 });
  });
});
