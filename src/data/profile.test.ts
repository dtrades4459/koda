import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("../lib/supabase", () => ({
  supabase: {
    from: vi.fn(),
    auth: { getUser: vi.fn() },
  },
}));

vi.mock("../lib/log", () => ({
  log: { info: vi.fn(), warn: vi.fn(), error: vi.fn() },
}));

import { supabase } from "../lib/supabase";
import { log } from "../lib/log";
import { upsertProfile } from "./profile";

// Builds the supabase.from("profiles").upsert(...).select().single() chain,
// returning each response in `responses` for successive upsert calls.
function mockUpsertChain(...responses: { data?: unknown; error?: unknown }[]) {
  const upsert = vi.fn();
  for (const r of responses) {
    upsert.mockReturnValueOnce({
      select: () => ({ single: () => Promise.resolve({ data: r.data ?? null, error: r.error ?? null }) }),
    });
  }
  (supabase.from as any).mockReturnValue({ upsert });
  return upsert;
}

const USER_ID = "3f5af3f1-e05b-4b94-88aa-f84df1fc64e4";
const ROW = {
  user_id: USER_ID, handle: "user_3f5af3f1", name: "T", avatar: "", bio: "",
  broker: "", timezone: "UTC", member_code: "", is_public: true,
  public_trades: false, onboarded: true, prefs: {}, created_at: "", updated_at: "",
};

const COLLISION = {
  error: { code: "23505", message: 'duplicate key value violates unique constraint "profiles_handle_key"' },
};

function mockAuthEmail(email: string | null) {
  (supabase.auth.getUser as any).mockResolvedValue({
    data: { user: email ? { id: USER_ID, email } : null },
  });
}

describe("upsertProfile", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockAuthEmail(null);
  });

  it("falls back to the email prefix on a 23505 handle collision (KODA-TT-T)", async () => {
    mockAuthEmail("Trader.Joe+koda@gmail.com");
    const upsert = mockUpsertChain(COLLISION, { data: ROW });

    const result = await upsertProfile({ userId: USER_ID, handle: "trader" });

    expect(upsert).toHaveBeenCalledTimes(2);
    expect(upsert.mock.calls[1][0]).toMatchObject({ handle: "traderjoe" });
    expect(result).not.toBeNull();
    // Collisions are handled, not exceptional — must not reach Sentry as warn/error.
    expect(log.warn).not.toHaveBeenCalled();
    expect(log.error).not.toHaveBeenCalled();
  });

  it("falls back to user_<uid8> when the email prefix is also taken", async () => {
    mockAuthEmail("trader.joe@gmail.com");
    const upsert = mockUpsertChain(COLLISION, COLLISION, { data: ROW });

    const result = await upsertProfile({ userId: USER_ID, handle: "trader" });

    expect(upsert).toHaveBeenCalledTimes(3);
    expect(upsert.mock.calls[2][0]).toMatchObject({ handle: `user_${USER_ID.slice(0, 8)}` });
    expect(result).not.toBeNull();
    expect(log.error).not.toHaveBeenCalled();
  });

  it("falls back to user_<uid8> directly when no email is available", async () => {
    const upsert = mockUpsertChain(COLLISION, { data: ROW });

    const result = await upsertProfile({ userId: USER_ID, handle: "trader" });

    expect(upsert).toHaveBeenCalledTimes(2);
    expect(upsert.mock.calls[1][0]).toMatchObject({ handle: `user_${USER_ID.slice(0, 8)}` });
    expect(result).not.toBeNull();
  });

  it("skips the email prefix when it equals the handle that just collided", async () => {
    mockAuthEmail("trader@gmail.com");
    const upsert = mockUpsertChain(COLLISION, { data: ROW });

    const result = await upsertProfile({ userId: USER_ID, handle: "trader" });

    expect(upsert).toHaveBeenCalledTimes(2);
    expect(upsert.mock.calls[1][0]).toMatchObject({ handle: `user_${USER_ID.slice(0, 8)}` });
    expect(result).not.toBeNull();
  });

  it("logs transient network failures as info, not error (KODA-TT-V)", async () => {
    mockUpsertChain({ error: { code: "", message: "TypeError: Load failed", details: "", hint: "" } });

    const result = await upsertProfile({ userId: USER_ID, handle: "trader" });

    expect(result).toBeNull();
    expect(log.error).not.toHaveBeenCalled();
    expect(log.info).toHaveBeenCalled();
  });

  it("still logs genuine failures as error", async () => {
    mockUpsertChain({ error: { code: "42501", message: "permission denied for table profiles" } });

    const result = await upsertProfile({ userId: USER_ID, handle: "trader" });

    expect(result).toBeNull();
    expect(log.error).toHaveBeenCalled();
  });

  it("returns the profile on a clean upsert", async () => {
    mockUpsertChain({ data: ROW });

    const result = await upsertProfile({ userId: USER_ID, handle: "user_3f5af3f1" });

    expect(result?.userId).toBe(USER_ID);
    expect(log.error).not.toHaveBeenCalled();
  });
});
