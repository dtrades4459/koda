import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("../lib/supabase", () => ({
  supabase: {
    from: vi.fn(),
    auth: { getUser: vi.fn() },
  },
}));

import { supabase } from "../lib/supabase";
import { markChatRead } from "./chatReads";

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
