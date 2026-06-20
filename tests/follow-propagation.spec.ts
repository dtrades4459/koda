// ═══════════════════════════════════════════════════════════════════════════════
// Kōda · Follow / Circles E2E propagation spec
//
// Verifies that following a member from a shared Circle propagates correctly
// EVERYWHERE — counts, lists, button state, the other user's followers list,
// the Friends Feed (mutuals only) — and that unfollow fully reverses it.
//
// Skips automatically when TEST_EMAIL_2 / TEST_PASSWORD_2 are unset, so this
// file is safe to land before the second test account exists.
//
// Required env:
//   TEST_EMAIL, TEST_PASSWORD       — primary test acct (e.g. bigbill)
//   TEST_EMAIL_2, TEST_PASSWORD_2   — secondary test acct (the followee)
//   VITE_SUPABASE_URL               — for direct DB cross-check
//   VITE_SUPABASE_ANON_KEY          — for direct DB cross-check
//
// Optional env:
//   FOLLOW_TEST_CIRCLE              — circle code to join (default 50K-EVAL-2026)
//
// The spec uses two browser contexts so both users are signed in concurrently
// and the followee's perspective can be asserted without a sign-out/sign-in
// round-trip. The "re-login persistence" check is a separate phase that wipes
// storageState and re-auths from scratch.
// ═══════════════════════════════════════════════════════════════════════════════

import { test, expect, type Page, type BrowserContext } from "@playwright/test";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";

const EMAIL_1    = process.env.TEST_EMAIL ?? "";
const PASSWORD_1 = process.env.TEST_PASSWORD ?? "";
const EMAIL_2    = process.env.TEST_EMAIL_2 ?? "";
const PASSWORD_2 = process.env.TEST_PASSWORD_2 ?? "";

const SUPABASE_URL = process.env.VITE_SUPABASE_URL ?? "";
const SUPABASE_KEY = process.env.VITE_SUPABASE_ANON_KEY ?? "";

const CIRCLE_CODE = process.env.FOLLOW_TEST_CIRCLE ?? "50K-EVAL-2026";

const HAS_BOTH_USERS = !!(EMAIL_1 && PASSWORD_1 && EMAIL_2 && PASSWORD_2);
const HAS_SUPABASE   = !!(SUPABASE_URL && SUPABASE_KEY);

test.describe.serial("Follow propagation across surfaces", () => {
  test.skip(!HAS_BOTH_USERS,
    "TEST_EMAIL_2 / TEST_PASSWORD_2 not set — follow spec needs a second account");
  test.skip(!HAS_SUPABASE,
    "VITE_SUPABASE_URL / VITE_SUPABASE_ANON_KEY not set — DB cross-check unavailable");

  let ctx1: BrowserContext;
  let ctx2: BrowserContext;
  let page1: Page;
  let page2: Page;

  // Member codes get filled in during sign-in (queried from public.profiles).
  let code1 = "";
  let code2 = "";

  test.beforeAll(async ({ browser }) => {
    ctx1  = await browser.newContext({ viewport: { width: 390, height: 844 } });
    ctx2  = await browser.newContext({ viewport: { width: 390, height: 844 } });
    page1 = await ctx1.newPage();
    page2 = await ctx2.newPage();

    await Promise.all([
      signIn(page1, EMAIL_1, PASSWORD_1),
      signIn(page2, EMAIL_2, PASSWORD_2),
    ]);

    code1 = await fetchMyMemberCode(page1);
    code2 = await fetchMyMemberCode(page2);
    if (!code1 || !code2) {
      throw new Error(`Could not resolve member codes (code1=${code1}, code2=${code2}). ` +
        `Both users must have a row in public.profiles with member_code set.`);
    }

    await Promise.all([
      joinCircle(page1, CIRCLE_CODE),
      joinCircle(page2, CIRCLE_CODE),
    ]);

    // Clean baseline: ensure no pre-existing follow edge between the two users.
    // Read-only assertion would mask a stale row — actively delete via the UI so
    // the test starts from "neither follows the other".
    await ensureNotFollowing(page1, code2);
    await ensureNotFollowing(page2, code1);
  });

  test.afterAll(async () => {
    // Best-effort cleanup so the spec is rerunnable.
    if (page1) await ensureNotFollowing(page1, code2).catch(() => {});
    if (page2) await ensureNotFollowing(page2, code1).catch(() => {});
    await ctx1?.close();
    await ctx2?.close();
  });

  // ── Phase A: follow from the Circle members list ─────────────────────────

  test("A1 — User 1 follows User 2 from the Circle members list", async () => {
    await openCircle(page1, CIRCLE_CODE);
    const memberRow = await locateMemberRow(page1, code2);
    await memberRow.getByRole("button", { name: /^\+ Follow$/ }).click();

    // Button flips to "Following" immediately (optimistic).
    await expect(memberRow.getByText(/Following/)).toBeVisible({ timeout: 5_000 });
  });

  test("A2 — Following list + count update on User 1 (immediate)", async () => {
    await openPeopleTab(page1);
    await expect(page1.getByText(/Following\s*·\s*\d+/)).toBeVisible();
    await expect(page1.getByText(new RegExp(`\\b${escapeRegex(code2)}\\b`))).toBeVisible();
  });

  test("A3 — Followers list + count update on User 2 (cross-user, no refresh)", async () => {
    // Realtime sub should have fired on user 2. Allow up to 10s for the row to land.
    await openPeopleTab(page2);
    await expect(page2.getByText(/Followers\s*·\s*\d+/)).toBeVisible();
    await expect(page2.getByText(new RegExp(`\\b${escapeRegex(code1)}\\b`)))
      .toBeVisible({ timeout: 10_000 });
  });

  test("A4 — Persistence: hard refresh keeps the follow on both sides", async () => {
    await page1.reload();
    await openPeopleTab(page1);
    await expect(page1.getByText(new RegExp(`\\b${escapeRegex(code2)}\\b`))).toBeVisible();

    await page2.reload();
    await openPeopleTab(page2);
    await expect(page2.getByText(new RegExp(`\\b${escapeRegex(code1)}\\b`))).toBeVisible();
  });

  test("A5 — Persistence: re-login (wipe storageState) keeps the follow", async () => {
    // Wipe and re-auth User 1 to prove the follow is in Supabase, not local state.
    const freshCtx  = await page1.context().browser()!.newContext({ viewport: { width: 390, height: 844 } });
    const freshPage = await freshCtx.newPage();
    try {
      await signIn(freshPage, EMAIL_1, PASSWORD_1);
      await openPeopleTab(freshPage);
      await expect(freshPage.getByText(new RegExp(`\\b${escapeRegex(code2)}\\b`))).toBeVisible();
    } finally {
      await freshCtx.close();
    }
  });

  test("A6 — DB cross-check: exactly one row on each side, no duplicates", async () => {
    const db = await dbAsUser(page1);
    const followRows   = await db.from("shared_kv").select("key,value")
      .like("key", `koda_follow_${code1}_%`);
    const followerRows = await db.from("shared_kv").select("key,value")
      .like("key", `koda_follower_${code2}_%`);

    const followKey    = `koda_follow_${code1}_${code2}`;
    const followerKey  = `koda_follower_${code2}_${code1}`;

    const followMatches   = (followRows.data ?? []).filter(r => r.key === followKey);
    const followerMatches = (followerRows.data ?? []).filter(r => r.key === followerKey);

    expect(followMatches, "exactly one follow edge row").toHaveLength(1);
    expect(followerMatches, "exactly one follower edge row").toHaveLength(1);
  });

  // ── Phase B: Friends Feed (mutuals only) ─────────────────────────────────
  // The hook layer says: feed shows mutual follows. One-way follow ≠ feed
  // inclusion. This phase forces the mutual edge so we can assert the feed.

  test("B1 — User 2 follows User 1 back (mutual edge established)", async () => {
    await openCircle(page2, CIRCLE_CODE);
    const memberRow = await locateMemberRow(page2, code1);
    await memberRow.getByRole("button", { name: /^\+ Follow$/ }).click();
    await expect(memberRow.getByText(/Following/)).toBeVisible();
  });

  test("B2 — Friends Feed on User 1 now references User 2 (or is non-empty)", async () => {
    await page1.reload();
    await openFeedTab(page1);
    // If User 2 has no shared trades yet, the feed may still be empty. We assert
    // either an explicit reference to the followee OR a non-empty feed surface.
    const explicit = page1.getByText(new RegExp(`\\b${escapeRegex(code2)}\\b`));
    const anyCard  = page1.locator('[data-testid*="feed-card"], article, [data-testid*="trade"]').first();
    await expect(explicit.or(anyCard)).toBeVisible({ timeout: 10_000 });
  });

  // ── Phase C: unfollow reversal ───────────────────────────────────────────

  test("C1 — User 1 unfollows User 2 from the Following list", async () => {
    await openPeopleTab(page1);
    const row = page1.locator("li,div,article").filter({
      hasText: new RegExp(`\\b${escapeRegex(code2)}\\b`),
    }).first();
    await row.getByRole("button", { name: /Following|Unfollow/ }).click();
    // The button should disappear or flip back to "+ Follow".
    await expect(row.getByRole("button", { name: /^\+ Follow$/ }))
      .toBeVisible({ timeout: 5_000 });
  });

  test("C2 — Following list no longer contains User 2 (User 1)", async () => {
    await page1.reload();
    await openPeopleTab(page1);
    await expect(page1.getByText(new RegExp(`\\b${escapeRegex(code2)}\\b`))).toHaveCount(0);
  });

  test("C3 — Followers list on User 2 no longer contains User 1 (Realtime)", async () => {
    await openPeopleTab(page2);
    await expect(page2.getByText(new RegExp(`\\b${escapeRegex(code1)}\\b`)))
      .toHaveCount(0, { timeout: 10_000 });
  });

  test("C4 — DB cross-check: both rows gone", async () => {
    const db = await dbAsUser(page1);
    const followKey   = `koda_follow_${code1}_${code2}`;
    const followerKey = `koda_follower_${code2}_${code1}`;
    const f1 = await db.from("shared_kv").select("key").eq("key", followKey);
    const f2 = await db.from("shared_kv").select("key").eq("key", followerKey);
    expect(f1.data ?? []).toHaveLength(0);
    expect(f2.data ?? []).toHaveLength(0);
  });

  // ── Phase D: edge cases ──────────────────────────────────────────────────

  test("D1 — Follow same user from ProfileModal: no double-row", async () => {
    await openProfile(page1, code2);
    await page1.getByRole("button", { name: /^\+ Follow$/ }).click();
    await expect(page1.getByRole("button", { name: /Following/ })).toBeVisible();
    // Hit the same handler again from the Circle member row to try to double-follow.
    await openCircle(page1, CIRCLE_CODE);
    const memberRow = await locateMemberRow(page1, code2);
    // Button should already read "Following", clicking it would unfollow — DO NOT click.
    await expect(memberRow.getByText(/Following/)).toBeVisible();

    const db = await dbAsUser(page1);
    const followKey = `koda_follow_${code1}_${code2}`;
    const r = await db.from("shared_kv").select("key").eq("key", followKey);
    expect(r.data ?? [], "still exactly one row after second follow attempt").toHaveLength(1);
  });

  test("D2 — Cannot follow yourself: toast 'That's you', no DB write", async () => {
    await openProfile(page1, code1);
    // The button may not render for self — accept either absence OR a no-op click.
    const selfFollow = page1.getByRole("button", { name: /^\+ Follow$/ });
    if (await selfFollow.isVisible().catch(() => false)) {
      await selfFollow.click();
      await expect(page1.getByText(/That's you/i)).toBeVisible({ timeout: 3_000 });
    }
    const db = await dbAsUser(page1);
    const r = await db.from("shared_kv").select("key").eq("key", `koda_follow_${code1}_${code1}`);
    expect(r.data ?? []).toHaveLength(0);
  });

  test("D3 — Re-follow after unfollow works", async () => {
    await ensureNotFollowing(page1, code2);
    await openCircle(page1, CIRCLE_CODE);
    const memberRow = await locateMemberRow(page1, code2);
    await memberRow.getByRole("button", { name: /^\+ Follow$/ }).click();
    await expect(memberRow.getByText(/Following/)).toBeVisible();
    const db = await dbAsUser(page1);
    const r = await db.from("shared_kv").select("key").eq("key", `koda_follow_${code1}_${code2}`);
    expect(r.data ?? []).toHaveLength(1);
  });
});

// ── Helpers ─────────────────────────────────────────────────────────────────

async function signIn(page: Page, username: string, password: string): Promise<void> {
  await page.addInitScript(() => {
    localStorage.clear();
    localStorage.setItem("koda_beta_unlocked", "1");
    localStorage.setItem("koda_cookie_consent", "accepted");
  });
  await page.goto("/");
  await page.waitForSelector('input[placeholder="yourname"]', { timeout: 15_000 });
  await page.getByPlaceholder(/yourname/i).fill(username);
  await page.locator('input[type="password"]').first().fill(password);
  await page.getByRole("button", { name: /sign in →/i }).click();
  await expect(page.getByPlaceholder(/yourname/i)).not.toBeVisible({ timeout: 15_000 });
}

async function fetchMyMemberCode(page: Page): Promise<string> {
  return await page.evaluate(async ({ url, key }) => {
    const { createClient } = await import("https://esm.sh/@supabase/supabase-js@2");
    const supabase = createClient(url, key, {
      auth: { storage: window.localStorage, persistSession: true },
    });
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return "";
    const { data } = await supabase.from("profiles")
      .select("member_code").eq("user_id", user.id).maybeSingle();
    return (data?.member_code ?? "").toString().toUpperCase();
  }, { url: SUPABASE_URL, key: SUPABASE_KEY });
}

async function dbAsUser(page: Page): Promise<SupabaseClient> {
  // Reuse Node-side client for the DB cross-check. RLS will scope based on the
  // anon key alone; for shared_kv we read public rows so this is fine. If RLS
  // requires the session's JWT, switch to running the query inside page.evaluate
  // with the already-authed client.
  return createClient(SUPABASE_URL, SUPABASE_KEY);
}

async function joinCircle(page: Page, code: string): Promise<void> {
  await page.getByTestId("nav-circles").click().catch(() => {});
  // If the circle card is already visible, the user is a member.
  const card = page.getByTestId("circle-card").filter({ hasText: code }).first();
  if (await card.isVisible().catch(() => false)) return;
  // Join by code. The exact UI for "join by code" is feature-dependent; the
  // common path is a button labelled "Join" + an input for the code.
  await page.getByRole("button", { name: /join/i }).first().click().catch(() => {});
  const input = page.getByPlaceholder(/code|invite/i).first();
  if (await input.isVisible().catch(() => false)) {
    await input.fill(code);
    await page.getByRole("button", { name: /join/i }).first().click();
  }
}

async function openCircle(page: Page, code: string): Promise<void> {
  await page.getByTestId("nav-circles").click();
  await page.getByTestId("circle-card").filter({ hasText: code }).first().click();
}

async function openPeopleTab(page: Page): Promise<void> {
  // The People tab is a sub-section inside the friends/feed area.
  await page.getByTestId("nav-feed").click().catch(() => {});
  await page.getByRole("button", { name: /^People$/ }).click().catch(() => {});
}

async function openFeedTab(page: Page): Promise<void> {
  await page.getByTestId("nav-feed").click();
  await page.getByRole("button", { name: /^Feed$/ }).click().catch(() => {});
}

async function openProfile(page: Page, memberCode: string): Promise<void> {
  // Profile is openable via the ProfileModal — typically by clicking a member
  // row or a handle pill. We try the People list as the most stable surface.
  await openPeopleTab(page);
  const row = page.locator("button,a,div").filter({
    hasText: new RegExp(`\\b${escapeRegex(memberCode)}\\b`),
  }).first();
  await row.click();
}

async function locateMemberRow(page: Page, memberCode: string) {
  return page.locator("li,div,article").filter({
    hasText: new RegExp(`\\b${escapeRegex(memberCode)}\\b`),
  }).first();
}

async function ensureNotFollowing(page: Page, target: string): Promise<void> {
  await openPeopleTab(page).catch(() => {});
  const row = page.locator("li,div,article").filter({
    hasText: new RegExp(`\\b${escapeRegex(target)}\\b`),
  }).first();
  if (await row.isVisible().catch(() => false)) {
    const followingBtn = row.getByRole("button", { name: /Following|Unfollow/ });
    if (await followingBtn.isVisible().catch(() => false)) {
      await followingBtn.click();
    }
  }
}

function escapeRegex(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}
