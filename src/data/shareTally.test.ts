import { describe, it, expect } from "vitest";
import { tallyShareResults } from "./shareTally";

describe("tallyShareResults", () => {
  it("counts each outcome", () => {
    expect(tallyShareResults(["ok", "ok", "duplicate", "blocked", "error"])).toEqual({
      ok: 2, duplicate: 1, blocked: 1, error: 1,
    });
  });
  it("is all-zero for an empty list", () => {
    expect(tallyShareResults([])).toEqual({ ok: 0, duplicate: 0, blocked: 0, error: 0 });
  });
});
