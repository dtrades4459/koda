import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { PostSessionDebriefSheet } from "./PostSessionDebriefSheet";
import { DARK } from "../theme";

const SUMMARY = { trades: 3, wins: 2, losses: 1, pnlDisplay: "+$420", pnlPositive: true };

describe("PostSessionDebriefSheet", () => {
  it("renders the summary stats", () => {
    render(
      <PostSessionDebriefSheet
        open
        C={DARK}
        isMobile
        summary={SUMMARY}
        onSave={() => {}}
        onDismiss={() => {}}
      />,
    );
    expect(screen.getByText("3")).toBeInTheDocument();
    expect(screen.getByText("+$420")).toBeInTheDocument();
    expect(screen.getByText(/did you follow your rules/i)).toBeInTheDocument();
  });

  it("Save button is disabled until an answer is selected", () => {
    render(
      <PostSessionDebriefSheet
        open
        C={DARK}
        isMobile
        summary={SUMMARY}
        onSave={() => {}}
        onDismiss={() => {}}
      />,
    );
    const save = screen.getByRole("button", { name: /save debrief/i });
    expect(save).toBeDisabled();
    fireEvent.click(screen.getByRole("button", { name: "Yes" }));
    expect(save).not.toBeDisabled();
  });

  it("onSave is called with the selected answer", () => {
    const onSave = vi.fn();
    render(
      <PostSessionDebriefSheet
        open
        C={DARK}
        isMobile
        summary={SUMMARY}
        onSave={onSave}
        onDismiss={() => {}}
      />,
    );
    fireEvent.click(screen.getByRole("button", { name: "Mostly" }));
    fireEvent.click(screen.getByRole("button", { name: /save debrief/i }));
    expect(onSave).toHaveBeenCalledWith({ rulesFollowed: "mostly", note: undefined });
  });

  it("trims and forwards the optional note", () => {
    const onSave = vi.fn();
    render(
      <PostSessionDebriefSheet
        open
        C={DARK}
        isMobile
        summary={SUMMARY}
        onSave={onSave}
        onDismiss={() => {}}
      />,
    );
    fireEvent.click(screen.getByRole("button", { name: "No" }));
    fireEvent.change(screen.getByPlaceholderText(/one thing to remember/i), { target: { value: "  cap the day at three  " } });
    fireEvent.click(screen.getByRole("button", { name: /save debrief/i }));
    expect(onSave).toHaveBeenCalledWith({ rulesFollowed: "no", note: "cap the day at three" });
  });

  it("onDismiss fires from Skip", () => {
    const onDismiss = vi.fn();
    render(
      <PostSessionDebriefSheet
        open
        C={DARK}
        isMobile
        summary={SUMMARY}
        onSave={() => {}}
        onDismiss={onDismiss}
      />,
    );
    fireEvent.click(screen.getByRole("button", { name: /skip for now/i }));
    expect(onDismiss).toHaveBeenCalledOnce();
  });

  it("does not render when open=false", () => {
    render(
      <PostSessionDebriefSheet
        open={false}
        C={DARK}
        isMobile
        summary={SUMMARY}
        onSave={() => {}}
        onDismiss={() => {}}
      />,
    );
    expect(screen.queryByText(/how did today go/i)).not.toBeInTheDocument();
  });
});
