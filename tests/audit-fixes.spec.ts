import { test, expect, type Page } from "@playwright/test";

/**
 * Kōda audit-fixes smoke tests.
 *
 * Covers every change shipped in the 2026-05-30 audit sprint:
 *
 * Anonymous:
 *   R.1  Reset password — "Forgot password" link is present on auth screen.
 *   R.2  Reset password — entering an email shows confirmation copy.
 *
 * Authenticated (skipped when TEST_EMAIL / TEST_PASSWORD not set):
 *   I.1  Kill switch: banner visible when daily loss limit exceeded.
 *   I.2  Kill switch: Save button is disabled (not just a warning).
 *   I.3  Trade limit: banner visible when at max-trades-per-day.
 *   I.4  Trade limit: Save button is disabled.
 *   I.5  Regression — normal logging still works with no limits set.
 *   C.1  Circles: "Discover" pill tab is absent from the browse screen.
 *   C.2  Circles: "ALL TIME" / "THIS WEEK" sort buttons are present on the leaderboard.
 */

const EMAIL    = process.env.TEST_EMAIL    ?? "";
const PASSWORD = process.env.TEST_PASSWORD ?? "";
const TODAY    = new Date().toISOString().split("T")[0];

// ─── helpers ────────────────────────────────────────────────────────────────

async function dismissCookieBanner(page: Page) {
  const dialog = page.getByRole("dialog", { name: /cookie consent/i });
  if (await dialog.isVisible().catch(() => false)) {
    await dialog.getByRole("button", { name: /accept/i }).click();
  }
}

async function signIn(page: Page) {
  await page.goto("/");
  await dismissCookieBanner(page);
  await page.locator('input[type="text"]').first().fill(EMAIL);
  await page.locator('input[type="password"]').fill(PASSWORD);
  await page.getByTestId("auth-submit").click();

  // New accounts land in the onboarding flow — skip it by patching the profile.
  const navLog = page.getByTestId("nav-log");
  const onboarding = page.getByText(/step 1 of|let's set up/i).first();
  await Promise.race([
    navLog.waitFor({ timeout: 20_000 }),
    onboarding.waitFor({ timeout: 20_000 }),
  ]);
  if (await onboarding.isVisible().catch(() => false)) {
    await patchProfile(page, { onboarded: true, priorTool: "other" });
    await page.reload();
    await expect(navLog).toBeVisible({ timeout: 20_000 });
  }

  // Wait for the Supabase profile sync to settle, then re-stamp the bypass fields
  // so any subsequent page.reload() in the test doesn't revert to onboarding or
  // show the first-session survey (which blocks tab navigation).
  await page.waitForTimeout(3_000);
  await patchProfile(page, { onboarded: true, priorTool: "other" });
}

/** Extract the koda userId from any existing koda__user__ localStorage key. */
function getUserId(page: Page): Promise<string | null> {
  return page.evaluate(() => {
    for (let i = 0; i < localStorage.length; i++) {
      const k = localStorage.key(i);
      if (k?.startsWith("koda__user__")) {
        const parts = k.split("__");
        if (parts.length >= 3) return parts[2];
      }
    }
    return null;
  });
}

/**
 * Patch the cached profile AND register an addInitScript so the patch
 * re-applies on the next page.reload() BEFORE the app's own JS runs.
 * This beats the storage layer's background Supabase refresh.
 */
async function patchProfile(page: Page, updates: Record<string, unknown>): Promise<void> {
  const patcher = (u: Record<string, unknown>) => {
    for (let i = 0; i < localStorage.length; i++) {
      const k = localStorage.key(i);
      if (!k?.includes("koda_profile") || !k?.startsWith("koda__user__")) continue;
      try {
        const obj = JSON.parse(localStorage.getItem(k)!) ?? {};
        localStorage.setItem(k, JSON.stringify({ ...obj, ...u }));
        return;
      } catch { /* skip */ }
    }
  };
  await page.evaluate(patcher, updates);
  await page.addInitScript(patcher, updates);
}

/**
 * Prepend a fake trade to the cached trades array in localStorage.
 * Creates the key (from userId) if the account has no trades yet.
 * Also registers an addInitScript so the prepend survives page.reload().
 */
async function prependTrade(page: Page, trade: Record<string, unknown>): Promise<void> {
  const userId = await getUserId(page);
  if (!userId) throw new Error("prependTrade: no userId found in localStorage");

  const prepender = (args: { userId: string; trade: Record<string, unknown> }) => {
    const tradesKey = `koda__user__${args.userId}__koda_trades`;
    const current: unknown[] = JSON.parse(localStorage.getItem(tradesKey) || "[]") ?? [];
    if (!current.find((x: unknown) => (x as Record<string, unknown>).id === args.trade.id)) {
      localStorage.setItem(tradesKey, JSON.stringify([args.trade, ...current]));
    }
  };
  await page.evaluate(prepender, { userId, trade });
  await page.addInitScript(prepender, { userId, trade });
}

/** Navigate to the Log screen and wait for the trade form to be ready. */
async function goToLogScreen(page: Page) {
  await page.getByTestId("nav-log").click();
  await expect(page.getByTestId("trade-pair")).toBeVisible({ timeout: 10_000 });
}

// ─── R — Reset password ───────────────────────────────────────────────────

test.describe("Reset password", () => {
  test("R.1 — Forgot password link is visible on the auth screen", async ({ page }) => {
    await page.goto("/");
    await dismissCookieBanner(page);

    // The auth form should be visible before we look for the link.
    await expect(page.locator('input[type="text"]').first()).toBeVisible({ timeout: 15_000 });

    // Accept any of the common labels used for the forgot-password flow.
    const forgotLink = page
      .getByRole("button", { name: /forgot.?password|reset.?password/i })
      .or(page.getByText(/forgot.?password|reset.?password/i).first());

    await expect(forgotLink).toBeVisible({ timeout: 5_000 });
  });

  test("R.2 — Entering a username submits and shows reset confirmation", async ({ page }) => {
    await page.goto("/");
    await dismissCookieBanner(page);

    await expect(page.locator('input[type="text"]').first()).toBeVisible({ timeout: 15_000 });

    // Open the forgot-password flow.
    const forgotLink = page
      .getByRole("button", { name: /forgot.?password|reset.?password/i })
      .or(page.getByText(/forgot.?password|reset.?password/i).first());
    await forgotLink.click();

    // The reset form shows a USERNAME field (Kōda uses username-based auth, not email).
    const usernameInput = page.locator('input[type="text"]').first();
    await expect(usernameInput).toBeVisible({ timeout: 5_000 });

    // Use a valid username format (alphanumeric, no @ or dots — those fail USERNAME_RE).
    await usernameInput.fill("smoketestuser");

    // Stub the reset-password API so the UI transitions to "reset-sent" regardless
    // of whether the test-environment email service is configured.
    await page.route("**/api/reset-password", (route) =>
      route.fulfill({ status: 200, body: JSON.stringify({ ok: true }) })
    );

    // Click the specific "Send reset link" button (not the OAuth buttons).
    await page.getByRole("button", { name: /send reset link/i }).click();

    // The confirmation screen (mode === "reset-sent") shows "Check your recovery email".
    await expect(
      page.getByText(/check your recovery email/i)
    ).toBeVisible({ timeout: 10_000 });
  });
});

// ─── I — Intervention layer ───────────────────────────────────────────────

test.describe("Intervention layer", () => {
  test.skip(!EMAIL || !PASSWORD, "TEST_EMAIL / TEST_PASSWORD not set — skipping");

  test.beforeEach(async ({ page }) => {
    await signIn(page);
  });

  // ── Kill switch ──────────────────────────────────────────────────────────

  test("I.1 — Kill switch banner visible when daily loss exceeded", async ({ page }) => {
    // Set the daily loss limit to 1R and inject a trade that lost 5R today.
    await patchProfile(page, { maxDailyLoss: "1" });
    await prependTrade(page, {
      id: 999_001, date: TODAY, pair: "NQ", outcome: "Loss",
      pnl: "-5", pnlDollar: "-500", session: "", bias: "",
      strategy: "", setup: "", entryPrice: "", slPrice: "",
      tpPrice: "", rr: "", notes: "", emotions: "", screenshot: "",
      comments: [], reactions: {},
    });

    await page.reload();
    await expect(page.getByTestId("nav-log")).toBeVisible({ timeout: 20_000 });
    await goToLogScreen(page);

    await expect(
      page.getByRole("alert").filter({ hasText: /kill switch/i })
    ).toBeVisible({ timeout: 5_000 });
  });

  test("I.2 — Save is disabled when kill switch is active", async ({ page }) => {
    await patchProfile(page, { maxDailyLoss: "1" });
    await prependTrade(page, {
      id: 999_002, date: TODAY, pair: "NQ", outcome: "Loss",
      pnl: "-5", pnlDollar: "-500", session: "", bias: "",
      strategy: "", setup: "", entryPrice: "", slPrice: "",
      tpPrice: "", rr: "", notes: "", emotions: "", screenshot: "",
      comments: [], reactions: {},
    });

    await page.reload();
    await expect(page.getByTestId("nav-log")).toBeVisible({ timeout: 20_000 });
    await goToLogScreen(page);

    // Fill the minimum fields so the button would normally become enabled.
    await page.getByTestId("trade-pair").fill("NQ");
    await page.getByRole("button", { name: /^win$/i }).first().click();

    const saveBtn = page.getByTestId("trade-save");
    await expect(saveBtn).toBeDisabled({ timeout: 3_000 });
  });

  // ── Trade limit ──────────────────────────────────────────────────────────

  test("I.3 — Trade limit banner visible when at max trades per day", async ({ page }) => {
    await patchProfile(page, { maxTradesPerDay: "1" });
    await prependTrade(page, {
      id: 999_003, date: TODAY, pair: "ES", outcome: "Win",
      pnl: "1", pnlDollar: "50", session: "", bias: "",
      strategy: "", setup: "", entryPrice: "", slPrice: "",
      tpPrice: "", rr: "", notes: "", emotions: "", screenshot: "",
      comments: [], reactions: {},
    });

    await page.reload();
    await expect(page.getByTestId("nav-log")).toBeVisible({ timeout: 20_000 });
    await goToLogScreen(page);

    await expect(
      page.getByRole("alert").filter({ hasText: /trade limit|limit reached/i })
    ).toBeVisible({ timeout: 5_000 });
  });

  test("I.4 — Save is disabled at the trade limit", async ({ page }) => {
    await patchProfile(page, { maxTradesPerDay: "1" });
    await prependTrade(page, {
      id: 999_004, date: TODAY, pair: "ES", outcome: "Win",
      pnl: "1", pnlDollar: "50", session: "", bias: "",
      strategy: "", setup: "", entryPrice: "", slPrice: "",
      tpPrice: "", rr: "", notes: "", emotions: "", screenshot: "",
      comments: [], reactions: {},
    });

    await page.reload();
    await expect(page.getByTestId("nav-log")).toBeVisible({ timeout: 20_000 });
    await goToLogScreen(page);

    await page.getByTestId("trade-pair").fill("NQ");
    await page.getByRole("button", { name: /^win$/i }).first().click();

    const saveBtn = page.getByTestId("trade-save");
    await expect(saveBtn).toBeDisabled({ timeout: 3_000 });
  });

  // ── Regression ───────────────────────────────────────────────────────────

  test("I.5 — Save is enabled normally when no limits are set", async ({ page }) => {
    // Ensure both limits are cleared.
    await patchProfile(page, { maxDailyLoss: "", maxTradesPerDay: "" });

    await page.reload();
    await expect(page.getByTestId("nav-log")).toBeVisible({ timeout: 20_000 });
    await goToLogScreen(page);

    await page.getByTestId("trade-pair").fill("NQ");
    await page.getByRole("button", { name: /^win$/i }).first().click();

    const saveBtn = page.getByTestId("trade-save");
    await expect(saveBtn).toBeEnabled({ timeout: 3_000 });
  });
});

// ─── C — Circles UI ──────────────────────────────────────────────────────

test.describe("Circles UI", () => {
  test.skip(!EMAIL || !PASSWORD, "TEST_EMAIL / TEST_PASSWORD not set — skipping");

  test.beforeEach(async ({ page }) => {
    await signIn(page);
  });

  async function goToCircles(page: Page) {
    // The bottom nav renders Home, Stats, Circles tabs.
    const circlesTab = page.getByTestId("nav-circles")
      .or(page.getByRole("button", { name: /^circles$/i }))
      .or(page.locator("[data-tab='circles']"))
      .first();
    await circlesTab.click();
    // Wait for the circles browse screen.
    await expect(
      page.getByText(/trading circles/i).or(page.getByRole("button", { name: /new/i })).first()
    ).toBeVisible({ timeout: 10_000 });

    // Dismiss the notifications drawer — Escape is the most reliable method since
    // the drawer listens for keydown Escape to close.
    await page.keyboard.press("Escape");
    await page.waitForTimeout(600);

    const notifDialog = page.getByRole("dialog", { name: /notifications/i });
    if (await notifDialog.isVisible({ timeout: 1_000 }).catch(() => false)) {
      await notifDialog.getByRole("button", { name: "Close" }).click().catch(async () => {
        await page.mouse.click(10, 450);
      });
      await notifDialog.waitFor({ state: "hidden", timeout: 4_000 }).catch(() => {});
    }
  }

  test("C.1 — Discover pill tab is absent from the Circles browse screen", async ({ page }) => {
    await goToCircles(page);

    // The Discover tab was a fake button — it should no longer exist in any form.
    const discoverBtn = page.getByRole("button", { name: /^discover$/i });
    await expect(discoverBtn).not.toBeVisible();
  });

  test("C.2 — Leaderboard sort buttons present inside a circle", async ({ page }) => {
    await goToCircles(page);

    // Open the first circle in the list (or skip if no circles joined yet).
    const firstCircleCard = page.getByTestId("circle-card").first();
    const hasCircle = await firstCircleCard.isVisible().catch(() => false);

    if (!hasCircle) {
      test.skip(); // No circles joined — can't test leaderboard. Skip gracefully.
      return;
    }

    await firstCircleCard.click();

    // Navigate to the Board (leaderboard) tab.
    const boardTab = page.getByRole("button", { name: /board|leaderboard/i }).first();
    await expect(boardTab).toBeVisible({ timeout: 8_000 });
    await boardTab.click();

    // Both sort controls should now be visible.
    await expect(page.getByRole("button", { name: /all time/i })).toBeVisible({ timeout: 5_000 });
    await expect(page.getByRole("button", { name: /this week/i })).toBeVisible({ timeout: 5_000 });

    // Clicking "THIS WEEK" should not crash the app.
    await page.getByRole("button", { name: /this week/i }).click();

    // The leaderboard container should still be present after the re-fetch.
    await expect(
      page.getByRole("button", { name: /all time/i })
    ).toBeVisible({ timeout: 8_000 });
  });
});
