import { describe, it, expect } from "vitest";
import { applyOptimisticToggle, type ReactionMap } from "./circleMessageReactions";

describe("applyOptimisticToggle", () => {
  it("adds my id to an emoji that has no reactions yet", () => {
    const next = applyOptimisticToggle(undefined, "🔥", "me");
    expect(next).toEqual({ "🔥": ["me"] });
  });

  it("adds my id alongside other users on the same emoji", () => {
    const map: ReactionMap = { "🔥": ["other"] };
    const next = applyOptimisticToggle(map, "🔥", "me");
    expect(next["🔥"]).toEqual(["other", "me"]);
  });

  it("removes my id when I have already reacted with that emoji", () => {
    const map: ReactionMap = { "🔥": ["other", "me"] };
    const next = applyOptimisticToggle(map, "🔥", "me");
    expect(next["🔥"]).toEqual(["other"]);
  });

  it("deletes the emoji bucket entirely when I was the last reactor", () => {
    const map: ReactionMap = { "🔥": ["me"] };
    const next = applyOptimisticToggle(map, "🔥", "me");
    expect(next["🔥"]).toBeUndefined();
    expect(Object.keys(next)).toHaveLength(0);
  });

  it("leaves other emojis untouched", () => {
    const map: ReactionMap = { "🔥": ["me"], "💎": ["other"] };
    const next = applyOptimisticToggle(map, "🔥", "me");
    expect(next["💎"]).toEqual(["other"]);
  });

  it("does not mutate the input map", () => {
    const map: ReactionMap = { "🔥": ["other"] };
    applyOptimisticToggle(map, "🔥", "me");
    expect(map["🔥"]).toEqual(["other"]);
  });
});
