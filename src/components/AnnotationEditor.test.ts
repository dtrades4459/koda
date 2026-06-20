import { describe, it, expect } from "vitest";
import { gradeOptions } from "./AnnotationEditor";

describe("gradeOptions", () => {
  it("offers a blank 'no grade' first, then A–F", () => {
    expect(gradeOptions()).toEqual([
      { value: "", label: "No grade" },
      { value: "A", label: "A" }, { value: "B", label: "B" },
      { value: "C", label: "C" }, { value: "D", label: "D" },
      { value: "F", label: "F" },
    ]);
  });
});
