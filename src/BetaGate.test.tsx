import "@testing-library/jest-dom/vitest";
import { describe, it, expect, vi, afterEach } from "vitest";
import { render, screen, cleanup, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { BetaGate } from "./BetaGate";

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

function mockFetch(status: number, body: object) {
  vi.stubGlobal("fetch", vi.fn().mockResolvedValue({
    ok: status >= 200 && status < 300,
    status,
    json: () => Promise.resolve(body),
  }));
}

describe("BetaGate — waitlist form", () => {
  it("renders the waitlist email input in idle state", () => {
    render(<BetaGate onUnlocked={vi.fn()} />);
    expect(screen.getByPlaceholderText("your@email.com")).toBeInTheDocument();
    expect(screen.getByText("Join waitlist →")).toBeInTheDocument();
  });

  it("shows position on successful signup", async () => {
    mockFetch(200, { ok: true, position: 12 });
    render(<BetaGate onUnlocked={vi.fn()} />);
    await userEvent.type(screen.getByPlaceholderText("your@email.com"), "test@example.com");
    await userEvent.click(screen.getByText("Join waitlist →"));
    await waitFor(() => {
      expect(screen.getByText("You're #12 on the list.")).toBeInTheDocument();
      expect(screen.getByText("We'll email you when access opens.")).toBeInTheDocument();
    });
  });

  it("shows already-on-list message for 409", async () => {
    mockFetch(409, { ok: true, position: 5, existing: true });
    render(<BetaGate onUnlocked={vi.fn()} />);
    await userEvent.type(screen.getByPlaceholderText("your@email.com"), "already@example.com");
    await userEvent.click(screen.getByText("Join waitlist →"));
    await waitFor(() => {
      expect(screen.getByText("You're already on the list (#5).")).toBeInTheDocument();
    });
  });

  it("shows error message on server error", async () => {
    mockFetch(500, { error: "Internal error" });
    render(<BetaGate onUnlocked={vi.fn()} />);
    await userEvent.type(screen.getByPlaceholderText("your@email.com"), "bad@example.com");
    await userEvent.click(screen.getByText("Join waitlist →"));
    await waitFor(() => {
      expect(screen.getByText("Something went wrong — try again")).toBeInTheDocument();
    });
  });

  it("shows error message on network failure", async () => {
    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new Error("Network error")));
    render(<BetaGate onUnlocked={vi.fn()} />);
    await userEvent.type(screen.getByPlaceholderText("your@email.com"), "bad@example.com");
    await userEvent.click(screen.getByText("Join waitlist →"));
    await waitFor(() => {
      expect(screen.getByText("Something went wrong — try again")).toBeInTheDocument();
    });
  });

  it("join button is disabled when email is empty", () => {
    render(<BetaGate onUnlocked={vi.fn()} />);
    expect(screen.getByText("Join waitlist →")).toBeDisabled();
  });
});
