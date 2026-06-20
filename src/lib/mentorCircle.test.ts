import { describe, it, expect } from "vitest";
import { isMentorCircle, MENTOR_CIRCLE_TYPE } from "./mentorCircle";

describe("isMentorCircle", () => {
  it("is true when type is the mentor marker", () => {
    expect(isMentorCircle({ type: MENTOR_CIRCLE_TYPE })).toBe(true);
  });
  it("is false for undefined / other types", () => {
    expect(isMentorCircle({ type: undefined })).toBe(false);
    expect(isMentorCircle({ type: "social" as never })).toBe(false);
  });
});
