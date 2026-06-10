import { describe, it, expect, vi, beforeEach } from "vitest";

const createSignedUrl = vi.fn();

vi.mock("./supabase", () => ({
  supabase: {
    storage: {
      from: vi.fn(() => ({ createSignedUrl })),
    },
  },
}));

const PUBLIC_URL =
  "https://vifwjwsndchnrpvfgrmg.supabase.co/storage/v1/object/public/trade-screenshots/uid-123/trade-1.jpg";

describe("extractStoragePath", () => {
  beforeEach(() => vi.resetModules());

  it("extracts the path from a public bucket URL", async () => {
    const { extractStoragePath } = await import("./screenshots");
    expect(extractStoragePath(PUBLIC_URL)).toBe("uid-123/trade-1.jpg");
  });

  it("extracts the path from a signed URL (re-resolving an already-signed value)", async () => {
    const { extractStoragePath } = await import("./screenshots");
    expect(
      extractStoragePath(
        "https://x.supabase.co/storage/v1/object/sign/trade-screenshots/uid/t.jpg?token=abc"
      )
    ).toBe("uid/t.jpg");
  });

  it("decodes URL-encoded segments", async () => {
    const { extractStoragePath } = await import("./screenshots");
    expect(
      extractStoragePath("https://x.supabase.co/storage/v1/object/public/trade-screenshots/uid/my%20chart.jpg")
    ).toBe("uid/my chart.jpg");
  });

  it("returns null for data: URIs", async () => {
    const { extractStoragePath } = await import("./screenshots");
    expect(extractStoragePath("data:image/jpeg;base64,/9j/4AAQ")).toBeNull();
  });

  it("returns null for external URLs", async () => {
    const { extractStoragePath } = await import("./screenshots");
    expect(extractStoragePath("https://example.com/img.png")).toBeNull();
  });

  it("returns null for other buckets", async () => {
    const { extractStoragePath } = await import("./screenshots");
    expect(
      extractStoragePath("https://x.supabase.co/storage/v1/object/public/avatars/uid/a.jpg")
    ).toBeNull();
  });
});

describe("resolveScreenshotUrl", () => {
  beforeEach(() => {
    vi.resetModules();
    createSignedUrl.mockReset();
  });

  it("passes non-bucket values through untouched without calling storage", async () => {
    const { resolveScreenshotUrl } = await import("./screenshots");
    expect(await resolveScreenshotUrl("data:image/jpeg;base64,abc")).toBe("data:image/jpeg;base64,abc");
    expect(await resolveScreenshotUrl("")).toBe("");
    expect(createSignedUrl).not.toHaveBeenCalled();
  });

  it("resolves bucket URLs to signed URLs", async () => {
    createSignedUrl.mockResolvedValue({ data: { signedUrl: "https://signed/u" }, error: null });
    const { resolveScreenshotUrl } = await import("./screenshots");
    expect(await resolveScreenshotUrl(PUBLIC_URL)).toBe("https://signed/u");
    expect(createSignedUrl).toHaveBeenCalledWith("uid-123/trade-1.jpg", 3600);
  });

  it("caches: second resolve of the same path does not re-sign", async () => {
    createSignedUrl.mockResolvedValue({ data: { signedUrl: "https://signed/u" }, error: null });
    const { resolveScreenshotUrl } = await import("./screenshots");
    await resolveScreenshotUrl(PUBLIC_URL);
    await resolveScreenshotUrl(PUBLIC_URL);
    expect(createSignedUrl).toHaveBeenCalledTimes(1);
  });

  it("deduplicates concurrent resolves of the same path", async () => {
    createSignedUrl.mockResolvedValue({ data: { signedUrl: "https://signed/u" }, error: null });
    const { resolveScreenshotUrl } = await import("./screenshots");
    await Promise.all([resolveScreenshotUrl(PUBLIC_URL), resolveScreenshotUrl(PUBLIC_URL)]);
    expect(createSignedUrl).toHaveBeenCalledTimes(1);
  });

  it("falls back to the stored value when signing fails", async () => {
    createSignedUrl.mockResolvedValue({ data: null, error: new Error("boom") });
    const { resolveScreenshotUrl } = await import("./screenshots");
    expect(await resolveScreenshotUrl(PUBLIC_URL)).toBe(PUBLIC_URL);
  });
});
