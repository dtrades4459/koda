import "@testing-library/jest-dom/vitest";
import { describe, it, expect, vi, afterEach } from "vitest";
import { render, screen, cleanup } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { ProGate } from "./ProGate";

afterEach(cleanup);

const C = { muted: "#999" };

describe("ProGate", () => {
  it("renders children directly for pro user", () => {
    render(
      <ProGate plan="pro" C={C} onUpgrade={vi.fn()}>
        <div>secret chart</div>
      </ProGate>
    );
    expect(screen.getByText("secret chart")).toBeInTheDocument();
    expect(screen.queryByText("Upgrade →")).not.toBeInTheDocument();
  });

  it("renders children directly for elite user", () => {
    render(
      <ProGate plan="elite" C={C} onUpgrade={vi.fn()}>
        <div>elite content</div>
      </ProGate>
    );
    expect(screen.getByText("elite content")).toBeInTheDocument();
    expect(screen.queryByText("Upgrade →")).not.toBeInTheDocument();
  });

  it("renders lock overlay for free user", () => {
    render(
      <ProGate plan="free" C={C} onUpgrade={vi.fn()}>
        <div>secret chart</div>
      </ProGate>
    );
    expect(screen.getByText("Upgrade →")).toBeInTheDocument();
    expect(screen.getByText("Pro feature")).toBeInTheDocument();
  });

  it("renders custom label when provided", () => {
    render(
      <ProGate plan="free" C={C} onUpgrade={vi.fn()} label="MAE / MFE — Pro feature">
        <div>content</div>
      </ProGate>
    );
    expect(screen.getByText("MAE / MFE — Pro feature")).toBeInTheDocument();
  });

  it("calls onUpgrade when Upgrade button clicked", async () => {
    const onUpgrade = vi.fn();
    render(
      <ProGate plan="free" C={C} onUpgrade={onUpgrade}>
        <div>content</div>
      </ProGate>
    );
    await userEvent.click(screen.getByText("Upgrade →"));
    expect(onUpgrade).toHaveBeenCalledOnce();
  });
});
