import { describe, it, expect } from "vitest";
import { buildImportStoragePath } from "./imports";

const USER = "00000000-0000-0000-0000-000000000abc";
const NOW = new Date("2026-05-29T18:30:00.000Z");

describe("buildImportStoragePath", () => {
  it("starts with the user id as the top-level folder (RLS hinges on this)", () => {
    const path = buildImportStoragePath(USER, "trades.csv", NOW);
    expect(path.split("/")[0]).toBe(USER);
  });

  it("preserves the lowercased file extension", () => {
    expect(buildImportStoragePath(USER, "Export.CSV", NOW)).toMatch(/\.csv$/);
    expect(buildImportStoragePath(USER, "report.xlsx", NOW)).toMatch(/\.xlsx$/);
  });

  it("defaults the extension to csv when the filename has none", () => {
    expect(buildImportStoragePath(USER, "no-extension", NOW)).toMatch(/\.csv$/);
  });

  it("strips non-alphanumerics from the extension (no path traversal smuggling)", () => {
    const path = buildImportStoragePath(USER, "weird.../../etc", NOW);
    expect(path.split("/")).toHaveLength(2);                  // user / filename, no extra segments
    expect(path).toMatch(/\.etc$/);
  });

  it("two calls with the same inputs still differ (random suffix)", () => {
    const a = buildImportStoragePath(USER, "trades.csv", NOW);
    const b = buildImportStoragePath(USER, "trades.csv", NOW);
    expect(a).not.toBe(b);
  });
});
