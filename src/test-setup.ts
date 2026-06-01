// Vitest global test setup
// Ensures @testing-library/react cleanup runs before every test to prevent
// stale React roots (React 19 + singleFork) from breaking event delegation.
import { beforeEach } from "vitest";
import { cleanup } from "@testing-library/react";

beforeEach(() => {
  cleanup();
});
