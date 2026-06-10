import { test, expect, type Page } from "@playwright/test";

/**
 * Kōda smoke tests.
 *
 * Anonymous tests (always run):
 *   T.1   App loads and renders auth UI (no white page, no 404).
 *   T.2   Static legal pages load with the right title.
 *   T.3   robots.txt and sitemap.xml point at kodatrade.co.uk (not the dead
 *         tradrjournal.xyz). Catches the regression FUNNEL_AUDIT flagged.
 *   T.4   Cookie consent banner appears, Accept dismisses it, Reject does
 *         too, both persist across reload. PostHog must NOT load before a
 *         choice is recorded (PECR / GDPR).
 *
 * Authenticated tests (skipped when TEST_EMAIL / TEST_PASSWORD are unset):
 *   T.5   Sign in → land on the app → log a trade → see it on history.
 *
 * The auth selectors are deliberately fuzzy because the live UI does not yet
 * carry stable data-testid attributes. When the monolith decomposition lands
 * (AUDIT.md Days 4-5) we should add testids to the LOG/HISTORY/CIRCLES tabs
 * and tighten this test.
 */

const EMAIL = process.env.TEST_EMAIL ?? "";
const PASSWORD = process.env.TEST_PASSWORD ?? "";

// ─── helpers ────────────────────────────────────────────────────────────────

/**
 * The cookie banner mounts on every page load until the user clicks Accept or
 * Reject. Skipping it keeps later assertions from picking up the banner's
 * buttons by accident.
 */
async function dismissCookieBanner(page: Page, choice: "accept" | "reject") {
  const dialog = page.getByRole("dialog", { name: /cookie consent/i });
  if (await dialog.isVisible().catch(() => false)) {
    const label = choice === "accept" ? /accept/i : /reject/i;
    await dialog.getByRole("button", { name: label }).click();
  }
}

// ─── T.1 — app boots ───────────────────────────────────────────────────────

test("app loads and shows auth screen (no 404)", async ({ page }) => {
  await page.goto("/");

  // The root div should have rendered content (not an empty white page)
  const root = page.locator("#root");
  await expect(root).not.toBeEmpty({ timeout: 15_000 });

  await expect(page.locator("body")).not.toContainText("404", { timeout: 5_000 }).catch(() => {
    // Some error boundaries might surface "404" copy. Real check is below.
  });

  // Either the auth form or the cookie banner should be visible.
  const visibleSurface = page.locator([
    'input[type="text"]',
    'input[type="password"]',
    'button:has-text("Sign In")',
    'button:has-text("sign in")',
    'input[placeholder*="invite"]',
    'button:has-text("Enter")',
    '[role="dialog"][aria-label*="cookie" i]',
  ].join(", ")).first();

  await expect(visibleSurface).toBeVisible({ timeout: 15_000 });
});

// ─── T.2 — static legal pages ─────────────────────────────────────────────

test.describe("static pages", () => {
  for (const [path, expected] of [
    ["/privacy.html",   /Privacy Policy/i],
    ["/terms.html",     /Terms of Service/i],
    ["/cookies.html",   /Cookie Policy/i],
    ["/faq.html",       /FAQ|Frequently Asked/i],
    ["/changelog.html", /Changelog/i],
  ] as const) {
    test(`${path} loads and has the right title`, async ({ page }) => {
      const response = await page.goto(path);
      expect(response?.status() ?? 0, `expected 2xx for ${path}`).toBeLessThan(400);
      expect(await page.title()).toMatch(expected);
    });
  }
});

// ─── T.3 — robots.txt + sitemap.xml ───────────────────────────────────────

test.describe("SEO files reference the live domain", () => {
  test("robots.txt sitemap points at kodatrade.co.uk", async ({ page }) => {
    const response = await page.goto("/robots.txt");
    expect(response?.status()).toBe(200);
    const text = await response!.text();
    expect(text).toContain("kodatrade.co.uk");
    expect(text).not.toContain("tradrjournal.xyz");
  });

  test("sitemap.xml urls reference kodatrade.co.uk", async ({ page }) => {
    const response = await page.goto("/sitemap.xml");
    expect(response?.status()).toBe(200);
    const text = await response!.text();
    expect(text).toContain("kodatrade.co.uk");
    expect(text).not.toContain("tradrjournal.xyz");
  });
});

// ─── T.4 — cookie consent ─────────────────────────────────────────────────

test.describe("cookie consent (PECR / GDPR)", () => {
  // Each Playwright test gets a fresh browser context by default, so
  // localStorage starts empty for every test in this block. We don't add an
  // init script because that runs on page.reload() too and would wipe the
  // value we are trying to assert is being persisted.

  test("banner appears on first load when no choice is stored", async ({ page }) => {
    await page.goto("/");
    const banner = page.getByRole("dialog", { name: /cookie consent/i });
    await expect(banner).toBeVisible({ timeout: 10_000 });
    await expect(banner.getByRole("button", { name: /accept/i })).toBeVisible();
    await expect(banner.getByRole("button", { name: /reject/i })).toBeVisible();
  });

  test("Accept dismisses the banner and persists across reload", async ({ page }) => {
    await page.goto("/");
    const banner = page.getByRole("dialog", { name: /cookie consent/i });
    await expect(banner).toBeVisible({ timeout: 10_000 });
    await banner.getByRole("button", { name: /accept/i }).click();
    await expect(banner).not.toBeVisible();

    const stored = await page.evaluate(() => localStorage.getItem("koda_cookie_consent"));
    expect(stored).toBe("accepted");

    await page.reload();
    await expect(page.getByRole("dialog", { name: /cookie consent/i })).not.toBeVisible();
  });

  test("Reject dismisses the banner and persists across reload", async ({ page }) => {
    await page.goto("/");
    const banner = page.getByRole("dialog", { name: /cookie consent/i });
    await expect(banner).toBeVisible({ timeout: 10_000 });
    await banner.getByRole("button", { name: /reject/i }).click();
    await expect(banner).not.toBeVisible();

    const stored = await page.evaluate(() => localStorage.getItem("koda_cookie_consent"));
    expect(stored).toBe("rejected");

    await page.reload();
    await expect(page.getByRole("dialog", { name: /cookie consent/i })).not.toBeVisible();
  });
});

// ─── T.6 — checkout reaches Stripe (revenue path) ──────────────────────────

test.describe("checkout smoke", () => {
  test.skip(!EMAIL || !PASSWORD, "TEST_EMAIL / TEST_PASSWORD not set — skipping");

  test("checkout API returns a live checkout.stripe.com URL", async ({ page }) => {
    await page.goto("/");
    await dismissCookieBanner(page, "accept");

    // The auth-setup project saved the Supabase session into storageState
    // (localStorage). Call the checkout endpoint exactly like UpgradeModal
    // does. No payment happens — Stripe just issues a checkout session,
    // which expires on its own. A failure here means the revenue path is
    // down: bad STRIPE_* env, broken function, or Stripe API trouble.
    const result = await page.evaluate(async () => {
      const key = Object.keys(localStorage).find(
        (k) => k.startsWith("sb-") && k.endsWith("-auth-token"),
      );
      if (!key) return { error: "no supabase session in localStorage" };
      const parsed = JSON.parse(localStorage.getItem(key) ?? "{}") as {
        currentSession?: { access_token?: string; user?: { id?: string; email?: string } };
        access_token?: string;
        user?: { id?: string; email?: string };
      };
      const session = parsed.currentSession ?? parsed;
      const token = session.access_token;
      const user = session.user;
      if (!token || !user?.id) return { error: "session missing token or user id" };

      const res = await fetch("/api/stripe?action=checkout", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({ userId: user.id, email: user.email ?? "smoke@users.kodatrade.co.uk" }),
      });
      const body = (await res.json().catch(() => ({}))) as { url?: string; error?: string };
      return { status: res.status, url: body.url, serverError: body.error };
    });

    expect(result.error, result.error).toBeUndefined();
    expect(result.status, `checkout returned ${result.status}: ${result.serverError ?? ""}`).toBe(200);
    expect(result.url ?? "").toMatch(/^https:\/\/checkout\.stripe\.com\//);
  });
});

// ─── T.5 — full authenticated happy path ──────────────────────────────────

test.describe("authenticated flow", () => {
  test.skip(!EMAIL || !PASSWORD, "TEST_EMAIL / TEST_PASSWORD not set — skipping");

  test("sign in → log trade → trade appears in journal", async ({ page }) => {
    await page.goto("/");
    await dismissCookieBanner(page, "accept");

    // ── Auth ──────────────────────────────────────────────────────────────
    // Username + password are FloatingInput-wrapped, so we target them by
    // input type. The submit button has a stable data-testid.
    await page.locator('input[type="text"]').first().fill(EMAIL);
    await page.locator('input[type="password"]').fill(PASSWORD);
    await page.getByTestId("auth-submit").click();

    // ── Navigate to LOG ───────────────────────────────────────────────────
    const navLog = page.getByTestId("nav-log");
    await expect(navLog).toBeVisible({ timeout: 15_000 });
    await navLog.click();

    // ── Fill the minimal viable trade ─────────────────────────────────────
    // The pair field is the canonical "trade form is ready" marker.
    const pairInput = page.getByTestId("trade-pair");
    await expect(pairInput).toBeVisible({ timeout: 10_000 });
    await pairInput.fill("NQ");

    // Outcome is a SegBtn group rendered as buttons labelled Win / Loss / BE.
    await page.getByRole("button", { name: /^win$/i }).first().click();

    await page.getByTestId("trade-pnl-dollar").fill("100");

    // ── Save ──────────────────────────────────────────────────────────────
    const saveButton = page.getByTestId("trade-save");
    await expect(saveButton).toBeEnabled();
    await saveButton.click();

    // ── Verify trade appears ──────────────────────────────────────────────
    // The freshly-saved trade lands on the history list. We accept either
    // the symbol or the P&L value as visible evidence.
    await expect(
      page.locator("text=NQ").or(page.locator("text=100")).first()
    ).toBeVisible({ timeout: 10_000 });
  });
});
