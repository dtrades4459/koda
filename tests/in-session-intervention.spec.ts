import { test, expect, type Page } from "@playwright/test";

/**
 * Kōda · in-session intervention E2E
 *
 * Verifies the wedge feature ships and the gating path is wired.
 *
 * Anonymous (always runs):
 *   I.1  Auth screen renders normally — gate does not fire on signed-out users.
 *
 * Authenticated (skipped when TEST_EMAIL / TEST_PASSWORD are unset):
 *   I.2  After 2 losing trades on the same day, tapping Log Trade opens the
 *        intervention sheet. Tapping "Cancel · take a break" closes the sheet.
 *
 * Manual demo (NOT run by Playwright — for the launch recording):
 *   1. Log a winning trade — no intervention
 *   2. Log a Loss tagged "revenge" — no intervention (1 of 5 signals)
 *   3. Log a second Loss — intervention fires (consec_losses + tilt_emotion)
 *   4. Tap Cancel — cooldown toast appears, locked for 15 min
 *   5. Switch to Stats tab — "IN-SESSION CHECK-INS · LAST 7d" card visible
 */

const EMAIL    = process.env.TEST_EMAIL    ?? "";
const PASSWORD = process.env.TEST_PASSWORD ?? "";

async function dismissCookieBanner(page: Page) {
  const dialog = page.getByRole("dialog", { name: /cookie consent/i });
  if (await dialog.isVisible().catch(() => false)) {
    await dialog.getByRole("button", { name: /accept/i }).click();
  }
}

// ─── I.1 — anonymous: auth screen ─────────────────────────────────────────

test("anonymous: auth screen does not show intervention sheet", async ({ page }) => {
  await page.goto("/");
  await dismissCookieBanner(page);

  // Whether the auth form or the cookie banner is up — none of
  // them should be the intervention sheet.
  await expect(page.getByText(/tilt signal/i)).not.toBeVisible();
  await expect(page.getByRole("button", { name: /i'm aware/i })).not.toBeVisible();
});

// ─── I.2 — authenticated: tilt-active sheet opens ─────────────────────────

test.describe("authenticated intervention flow", () => {
  test.skip(!EMAIL || !PASSWORD, "TEST_EMAIL / TEST_PASSWORD not set — skipping");

  test("after 2 losing trades, tapping Log opens the sheet; Cancel dismisses", async ({ page }) => {
    await page.goto("/");
    await dismissCookieBanner(page);

    // ── Auth ──────────────────────────────────────────────────────────────
    await page.locator('input[type="text"]').first().fill(EMAIL);
    await page.locator('input[type="password"]').fill(PASSWORD);
    await page.getByTestId("auth-submit").click();

    const navLog = page.getByTestId("nav-log");
    await expect(navLog).toBeVisible({ timeout: 15_000 });

    // ── Seed 2 losses ─────────────────────────────────────────────────────
    for (let i = 0; i < 2; i++) {
      await navLog.click();
      const pairInput = page.getByTestId("trade-pair");
      await expect(pairInput).toBeVisible({ timeout: 10_000 });
      await pairInput.fill(`NQ${i}`);
      await page.getByRole("button", { name: /^loss$/i }).first().click();
      await page.getByTestId("trade-pnl-dollar").fill("-50");
      const save = page.getByTestId("trade-save");
      await expect(save).toBeEnabled();
      await save.click();
      // Wait for the save to settle (the form usually navigates back).
      await page.waitForTimeout(500);
    }

    // ── Tap Log Trade a 3rd time — intervention sheet should appear ──────
    await navLog.click();
    await expect(page.getByText(/tilt signal/i)).toBeVisible({ timeout: 10_000 });
    await expect(page.getByRole("button", { name: /i'm aware/i })).toBeVisible();
    await expect(page.getByRole("button", { name: /cancel/i })).toBeVisible();

    // ── Cancel ────────────────────────────────────────────────────────────
    await page.getByRole("button", { name: /cancel/i }).click();
    await expect(page.getByText(/tilt signal/i)).not.toBeVisible();
  });
});
