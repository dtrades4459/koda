import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { BannerStack, type BannerStackItem } from "./BannerStack";
import { DARK } from "../theme";

function items(over: Partial<BannerStackItem>[] = []): BannerStackItem[] {
  const base: BannerStackItem[] = [
    { id: "alpha", priority: 100, ariaLabel: "Alpha", dismissible: true, children: <div>Alpha body</div> },
    { id: "beta", priority: 50, ariaLabel: "Beta", dismissible: true, children: <div>Beta body</div> },
  ];
  return base.map((b, i) => ({ ...b, ...over[i] }));
}

describe("BannerStack", () => {
  it("renders nothing when empty", () => {
    const { container } = render(<BannerStack C={DARK} items={[]} />);
    expect(container.firstChild).toBeNull();
  });

  it("shows a single banner with no count control", () => {
    render(<BannerStack C={DARK} items={[items()[0]]} />);
    expect(screen.getByText("Alpha body")).toBeInTheDocument();
    expect(screen.queryByText(/of/)).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /show next/i })).not.toBeInTheDocument();
  });

  it("puts the highest-priority banner on top and shows the count", () => {
    render(<BannerStack C={DARK} items={items()} />);
    // Live region announces the current top.
    expect(screen.getByText("1 of 2")).toBeInTheDocument();
    const live = document.querySelector('[aria-live="polite"]');
    expect(live?.textContent).toBe("Alpha");
  });

  it("cycles rear banners to the top", () => {
    render(<BannerStack C={DARK} items={items()} />);
    fireEvent.click(screen.getByRole("button", { name: /show next/i }));
    expect(screen.getByText("2 of 2")).toBeInTheDocument();
    const live = document.querySelector('[aria-live="polite"]');
    expect(live?.textContent).toBe("Beta");
  });

  it("calls onDismiss when the top card's dismiss is clicked", () => {
    const onDismiss = vi.fn();
    render(<BannerStack C={DARK} items={items([{ onDismiss }])} />);
    // The top card is rendered first; its dismiss button is the first one.
    fireEvent.click(screen.getAllByLabelText("Dismiss")[0]);
    expect(onDismiss).toHaveBeenCalledOnce();
  });
});
