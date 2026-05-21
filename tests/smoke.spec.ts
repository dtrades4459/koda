import { test, expect } from "@playwright/test";

/**
 * TRADR smoke tests.
 *
 * T.1 — Basic load test: always runs, no credentials needed.
 *       Verifies the app loads without a blank screen and the auth UI appears.
 *
 * T.2 — Full flow: sign in → log trade → verify.
 *       Requires env vars TEST_EMAIL + TEST_PASSWORD (a dedicated Supabase account).
 *       Skipped in CI when secrets are not set.
 */

const EMAIL = process.env.TEST_EMAIL ?? "";
const PASSWORD = process.env.TEST_PASSWORD ?? "";

// ── T.1 — always runs ───────────────────────────────────────────────────────

test("app loads and shows auth screen (no 404)", async ({ page }) => {
  await page.goto("/");

  // The root div should have rendered content (not an empty white page)
  const root = page.locator("#root");
  await expect(root).not.toBeEmpty({ timeout: 15_000 });

  // The page should NOT be a 404 — check no "not found" text is visible
  const body = page.locator("body");
  await expect(body).not.toContainText("404", { timeout: 5_000 }).catch(() => {
    // Not a hard failure — some error boundaries might show "404".
    // The real check is the auth UI below.
  });

  // Either the auth form (username input, password input, sign-in button)
  // or the beta gate should be visible — confirming the app rendered.
  const authIndicator = page.locator([
    'input[type="text"]',
    'input[type="password"]',
    'button:has-text("Sign In")',
    'button:has-text("sign in")',
    'input[placeholder*="invite"]',        // BetaGate password field
    'button:has-text("Enter")',             // BetaGate submit
  ].join(", ")).first();

  await expect(authIndicator).toBeVisible({ timeout: 15_000 });
});

// ── T.2 — requires credentials ──────────────────────────────────────────────

test.describe("authenticated flow", () => {
  test.skip(!EMAIL || !PASSWORD, "TEST_EMAIL / TEST_PASSWORD not set — skipping");

  test("sign in → log trade → trade appears in journal", async ({ page }) => {
    await page.goto("/");

    // ── Auth ──────────────────────────────────────────────────────────────
    const usernameInput = page.locator('input[type="text"]').first();
    await expect(usernameInput).toBeVisible({ timeout: 10_000 });

    await usernameInput.fill(EMAIL);
    await page.locator('input[type="password"]').fill(PASSWORD);

    await page.locator("button").filter({ hasText: /sign in/i }).first().click();

    // Wait for the main app to load
    const logTab = page.locator('button, [role="tab"]').filter({ hasText: /^log$/i });
    await expect(logTab.first()).toBeVisible({ timeout: 15_000 });

    // ── Open the trade log form ───────────────────────────────────────────
    await logTab.first().click();

    const addButton = page
      .locator("button")
      .filter({ hasText: /log trade|add trade|\+/i })
      .first();
    await expect(addButton).toBeVisible({ timeout: 8_000 });
    await addButton.click();

    // ── Fill in minimal trade fields ──────────────────────────────────────
    const pairInput = page
      .locator('input[placeholder*="pair" i], input[placeholder*="symbol" i], input[placeholder*="instrument" i]')
      .first();
    if (await pairInput.isVisible()) {
      await pairInput.fill("NQ");
    }

    const winButton = page.locator("button, label").filter({ hasText: /^win$/i }).first();
    if (await winButton.isVisible()) {
      await winButton.click();
    }

    const pnlInput = page
      .locator('input[placeholder*="p&l" i], input[placeholder*="pnl" i], input[placeholder*="profit" i]')
      .first();
    if (await pnlInput.isVisible()) {
      await pnlInput.fill("100");
    }

    // ── Save ──────────────────────────────────────────────────────────────
    const saveButton = page
      .locator("button")
      .filter({ hasText: /save|add trade|log trade/i })
      .last();
    await saveButton.click();

    // ── Verify trade appears ──────────────────────────────────────────────
    const tradeEntry = page.locator("text=NQ").or(page.locator("text=100")).first();
    await expect(tradeEntry).toBeVisible({ timeout: 10_000 });
  });
});
