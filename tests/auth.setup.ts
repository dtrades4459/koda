import { test as setup, expect } from "@playwright/test";
import { join } from "path";

const authFile = join(process.cwd(), "playwright", ".auth", "user.json");

/**
 * Sign in with TEST_EMAIL + TEST_PASSWORD and save the auth state so all
 * subsequent Playwright tests start already logged in.
 *
 * Kōda uses username-based auth. Internally the form converts <username> →
 * <username>@users.kodatrade.co.uk, so TEST_EMAIL is the username only.
 *
 * Add to your .env:
 *   TEST_EMAIL=yourusername
 *   TEST_PASSWORD=yourpassword
 */
setup("sign in", async ({ page }) => {
  const username = process.env.TEST_EMAIL!;
  const password = process.env.TEST_PASSWORD!;

  // Bypass beta gate before navigation so the auth form actually renders.
  await page.addInitScript(() => {
    localStorage.setItem("koda_beta_unlocked", "1");
  });

  await page.goto("/");

  // Dismiss cookie banner if present.
  const cookieDialog = page.getByRole("dialog", { name: /cookie consent/i });
  if (await cookieDialog.isVisible().catch(() => false)) {
    await cookieDialog.getByRole("button", { name: /accept/i }).click();
  }

  // Wait for the Kōda auth screen — username field with placeholder "yourname".
  await page.waitForSelector('input[placeholder="yourname"]', { timeout: 15_000 });

  await page.getByPlaceholder(/yourname/i).fill(username);
  await page.locator('input[type="password"]').first().fill(password);
  await page.getByRole("button", { name: /sign in →/i }).click();

  // Wait until the username field disappears — confirms we left the auth screen.
  await expect(page.getByPlaceholder(/yourname/i)).not.toBeVisible({ timeout: 15_000 });

  // Save auth cookies + localStorage so other tests reuse this session.
  await page.context().storageState({ path: authFile });
});
