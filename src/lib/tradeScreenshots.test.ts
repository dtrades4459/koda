import { describe, it, expect } from "vitest";
import { screenshotField, preShot, postShot, hasAnyShot, shotArray } from "./tradeScreenshots";

describe("screenshotField", () => {
  it("maps slots to the matching Trade field", () => {
    expect(screenshotField("pre")).toBe("preTradeScreenshot");
    expect(screenshotField("post")).toBe("postTradeScreenshot");
  });
});

describe("postShot (legacy fallback)", () => {
  it("prefers postTradeScreenshot when present", () => {
    expect(postShot({ postTradeScreenshot: "new.jpg", screenshot: "old.jpg" })).toBe("new.jpg");
  });
  it("falls back to the legacy screenshot when post is absent", () => {
    expect(postShot({ screenshot: "old.jpg" })).toBe("old.jpg");
  });
  it("returns '' when neither is present", () => {
    expect(postShot({ screenshot: "" })).toBe("");
  });
});

describe("preShot", () => {
  it("returns the pre field or ''", () => {
    expect(preShot({ preTradeScreenshot: "pre.jpg" })).toBe("pre.jpg");
    expect(preShot({})).toBe("");
  });
});

describe("hasAnyShot", () => {
  it("is true for pre-only, post-only, and legacy-only; false for none", () => {
    expect(hasAnyShot({ preTradeScreenshot: "p.jpg", screenshot: "" })).toBe(true);
    expect(hasAnyShot({ postTradeScreenshot: "q.jpg", screenshot: "" })).toBe(true);
    expect(hasAnyShot({ screenshot: "legacy.jpg" })).toBe(true);
    expect(hasAnyShot({ screenshot: "" })).toBe(false);
  });
});

describe("shotArray", () => {
  it("returns [pre, post] dropping empties, post via fallback, order preserved", () => {
    expect(shotArray({ preTradeScreenshot: "p.jpg", postTradeScreenshot: "q.jpg", screenshot: "" })).toEqual(["p.jpg", "q.jpg"]);
    expect(shotArray({ screenshot: "legacy.jpg" })).toEqual(["legacy.jpg"]);
    expect(shotArray({ preTradeScreenshot: "p.jpg", screenshot: "" })).toEqual(["p.jpg"]);
    expect(shotArray({ screenshot: "" })).toEqual([]);
  });
});
