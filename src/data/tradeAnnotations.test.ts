import { describe, it, expect } from "vitest";
import { rowToAnnotation, ANNOTATION_GRADES } from "./tradeAnnotations";

describe("rowToAnnotation", () => {
  it("maps snake_case row to camelCase annotation", () => {
    const a = rowToAnnotation({
      id: "a1", shared_trade_id: "st1", mentor_uid: "m1",
      grade: "B", note: "Cut this earlier.",
      created_at: "2026-06-19T00:00:00Z", updated_at: "2026-06-19T00:00:00Z",
    });
    expect(a).toEqual({
      id: "a1", sharedTradeId: "st1", mentorUid: "m1",
      grade: "B", note: "Cut this earlier.",
      createdAt: "2026-06-19T00:00:00Z", updatedAt: "2026-06-19T00:00:00Z",
    });
  });
  it("coerces a missing grade to null", () => {
    const a = rowToAnnotation({ id: "a", shared_trade_id: "s", mentor_uid: "m", note: "x" });
    expect(a.grade).toBeNull();
  });
  it("exposes the A–F grade scale", () => {
    expect(ANNOTATION_GRADES).toEqual(["A", "B", "C", "D", "F"]);
  });
});
