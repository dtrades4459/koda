# Kōda Retention Core Engine — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Wire Kōda's existing-but-unplugged email/notification infrastructure into a working cross-session retention loop: email preferences + unsubscribe, a weekly trading recap email, and a win-back trigger for lapsed users.

**Architecture:** Phase A adds opt-in/unsubscribe plumbing (DB columns on `profiles`, a public tokenized unsubscribe GET on `api/account.ts`, settings toggles, a once-daily `last_active_at` ping). Phase B computes per-user 7-day trading stats and sends the existing `weeklyRecapHtml` from the existing Sunday `weekly-digest` cron. Phase C adds a daily `?job=winback` that emails users inactive 7–14 days. All new server jobs/actions mount on existing `api/*` functions (Vercel 12-function cap). Recipient email is sourced from `auth.users.raw_user_meta_data.recovery_email` (accounts use synthetic auth emails).

**Tech Stack:** TypeScript, Vercel serverless (`nodejs` runtime), Supabase (Postgres + service-role admin client), Resend (email), web-push, React (Vite), vitest.

**Spec:** `docs/superpowers/specs/2026-06-16-koda-retention-core-engine-design.md`

---

## File Structure

**Create**
- `supabase/migrations/20260616_retention_core_engine.sql` — profiles columns + token index
- `api/_lib/metrics/weeklyRecap.ts` — pure `computeWeeklyRecap()` + `fetchWeeklyRecap()` data wrapper
- `api/_lib/metrics/weeklyRecap.test.ts` — unit tests for the stats math
- `api/_lib/retention/winback.ts` — pure `isWinbackCandidate()` selection logic
- `api/_lib/retention/winback.test.ts` — unit tests for selection
- `src/lib/activity.ts` — `pingLastActive()` once-daily client ping

**Modify**
- `api/_lib/email.ts` — `emailShell` accepts `unsubscribeUrl`; add `buildUnsubscribeUrl()`, `winbackEmailHtml()`; tweak `weeklyRecapHtml` to lead with net $
- `api/account.ts` — special-case GET + `handleUnsubscribe()`
- `api/cron.ts` — extend `handleWeeklyDigest()` to send recap emails; add `handleWinback()` + route
- `vercel.json` — add `winback` daily cron
- `src/SettingsScreen.tsx` — "Manage emails" toggle section
- `src/Koda.tsx` — call `pingLastActive()` when a session is present

---

# Phase A — Email preferences + unsubscribe

## Task 1: DB migration

**Files:**
- Create: `supabase/migrations/20260616_retention_core_engine.sql`

- [ ] **Step 1: Write the migration**

```sql
-- Retention core engine: email prefs, unsubscribe token, activity + idempotency stamps
alter table public.profiles
  add column if not exists weekly_recap_opt_in  boolean not null default true,
  add column if not exists winback_opt_in       boolean not null default true,
  add column if not exists product_opt_in       boolean not null default true,
  add column if not exists unsubscribe_token     uuid    not null default gen_random_uuid(),
  add column if not exists last_active_at        timestamptz,
  add column if not exists last_weekly_recap_at  timestamptz,
  add column if not exists last_winback_at       timestamptz;

create unique index if not exists profiles_unsubscribe_token_idx
  on public.profiles(unsubscribe_token);
```

- [ ] **Step 2: Apply to the dev/prod database**

Apply via the Supabase SQL editor (project `vifwjwsndchnrpvfgrmg`) or the migration pipeline used for prior migrations. Confirm columns exist:

Run (SQL editor): `select weekly_recap_opt_in, unsubscribe_token, last_active_at from public.profiles limit 1;`
Expected: returns columns (defaults populated; `unsubscribe_token` non-null).

- [ ] **Step 3: Commit**

```bash
git add supabase/migrations/20260616_retention_core_engine.sql
git commit -m "feat(retention): profiles columns for email prefs, unsubscribe token, activity stamps"
```

---

## Task 2: Tokenized unsubscribe URL in email shell

**Files:**
- Modify: `api/_lib/email.ts` (`emailShell`, ~line 121; add `buildUnsubscribeUrl`)

- [ ] **Step 1: Add the URL builder and thread `unsubscribeUrl` through `emailShell`**

Add near the top of `email.ts` (after `const FROM = …`):

```ts
const APP_ORIGIN = process.env.APP_URL ?? "https://kodatrade.co.uk";

/** Public, unauthenticated unsubscribe link clicked from an email client. */
export function buildUnsubscribeUrl(token: string, type: "weekly" | "winback" | "product" | "all"): string {
  return `${APP_ORIGIN}/api/account?action=unsubscribe&token=${encodeURIComponent(token)}&type=${type}`;
}
```

Change `emailShell`'s signature and footer link. Replace:

```ts
function emailShell({ kicker, title, body }: { kicker: string; title: string; body: string }): string {
```

with:

```ts
function emailShell({ kicker, title, body, unsubscribeUrl }: { kicker: string; title: string; body: string; unsubscribeUrl?: string }): string {
```

and replace the footer `<a … /unsubscribe …>` href:

```ts
  <p style="font-size:11px;color:${EMAIL_MUTE};margin:8px 0 0;line-height:1.6">You're receiving this because you have a Kōda account. <a href="https://kodatrade.co.uk/settings" style="color:${EMAIL_INK2};text-decoration:underline">Manage emails</a> · <a href="${unsubscribeUrl ?? "https://kodatrade.co.uk/settings"}" style="color:${EMAIL_INK2};text-decoration:underline">Unsubscribe</a></p>
```

- [ ] **Step 2: Typecheck**

Run: `npx tsc -p tsconfig.api.json --noEmit`
Expected: PASS (no errors). Existing callers omit `unsubscribeUrl` → still valid (optional).

- [ ] **Step 3: Commit**

```bash
git add api/_lib/email.ts
git commit -m "feat(retention): tokenized unsubscribe url in email shell"
```

---

## Task 3: Public unsubscribe route on api/account.ts

**Files:**
- Modify: `api/account.ts` (router ~line 395; add `handleUnsubscribe`)

- [ ] **Step 1: Add the handler**

Add before the Router section in `api/account.ts`:

```ts
// ══════════════════════════════════════════════════════════════════════════════
// Action: unsubscribe  (public GET — clicked from an email client)
// ══════════════════════════════════════════════════════════════════════════════

const UNSUB_COLUMNS: Record<string, string[]> = {
  weekly:  ["weekly_recap_opt_in"],
  winback: ["winback_opt_in"],
  product: ["product_opt_in"],
  all:     ["weekly_recap_opt_in", "winback_opt_in", "product_opt_in"],
};

function unsubPage(message: string): string {
  return `<!DOCTYPE html><html><head><meta charset="utf-8"/><meta name="viewport" content="width=device-width,initial-scale=1"/><title>Kōda</title></head>
<body style="margin:0;background:#0A0A0B;color:#F2F2EE;font-family:system-ui,sans-serif">
<div style="max-width:480px;margin:80px auto;padding:0 24px;text-align:center">
<p style="font-size:22px;font-weight:600;margin:0 0 12px">${message}</p>
<p style="font-size:13px;color:#A6A6A2;margin:0 0 28px">You can change email preferences anytime in Settings.</p>
<a href="https://kodatrade.co.uk/settings" style="display:inline-block;padding:11px 22px;border-radius:999px;background:#F2F2EE;color:#0A0A0B;text-decoration:none;font-size:13px;font-weight:600">Open Settings →</a>
</div></body></html>`;
}

async function handleUnsubscribe(req: Req, res: Res) {
  const token = (req.query?.token as string | undefined)?.trim() ?? "";
  const type  = ((req.query?.type as string | undefined) ?? "all").trim();
  const cols  = UNSUB_COLUMNS[type] ?? UNSUB_COLUMNS.all;

  res.setHeader("Content-Type", "text/html; charset=utf-8");

  // Always show success (no token enumeration). Only update on a real match.
  if (token) {
    const admin = getAdminClient();
    const patch = Object.fromEntries(cols.map(c => [c, false]));
    await admin.from("profiles").update(patch).eq("unsubscribe_token", token);
  }
  return res.status(200).json(unsubPage("You're unsubscribed."));
}
```

> Note: `res.json` here returns the HTML string with the `text/html` header set above — matches how this file already returns `res.status(n).json(...)`. If the deployed `Res.json` forces `application/json`, switch this call to `res.status(200).end(unsubPage(...))` and widen the local `Res` type's `end()` to accept a string.

- [ ] **Step 2: Allow GET for this action in the router**

In `handler`, replace the method guard + routing block:

```ts
export default async function handler(req: Req, res: Res) {
  cors(req, res);
  if (req.method === "OPTIONS") return res.status(200).end();

  const action = req.query?.action as string | undefined;

  // Public GET-only action (clicked from email) — must bypass the POST guard.
  if (action === "unsubscribe") return handleUnsubscribe(req, res);

  if (req.method !== "POST") return res.status(405).json({ error: "Method not allowed" });

  if (action === "reset-password") return handleResetPassword(req, res);
  if (action === "beta-unlock")    return handleBetaUnlock(req, res);
  if (action === "join-waitlist")  return handleJoinWaitlist(req, res);
  if (action === "feedback")       return handleFeedback(req, res);
  if (action === "delete")         return handleDelete(req, res);

  return res.status(400).json({ error: "?action= required: reset-password | beta-unlock | join-waitlist | feedback | delete" });
}
```

- [ ] **Step 3: Typecheck**

Run: `npx tsc -p tsconfig.api.json --noEmit`
Expected: PASS.

- [ ] **Step 4: Manual verification**

After deploy (or `vercel dev`): create a test profile, note its `unsubscribe_token`, then open
`/api/account?action=unsubscribe&token=<token>&type=weekly`.
Expected: HTML "You're unsubscribed." page; `select weekly_recap_opt_in from profiles where unsubscribe_token='<token>'` → `false`.
Also open with a junk token → still shows the success page; no row changes.

- [ ] **Step 5: Commit**

```bash
git add api/account.ts
git commit -m "feat(retention): public tokenized unsubscribe route"
```

---

## Task 4: "Manage emails" toggles in Settings

**Files:**
- Modify: `src/SettingsScreen.tsx`

- [ ] **Step 1: Load current prefs**

In `SettingsScreen.tsx`, alongside the existing settings state, add state + a load effect (uses the shared client from `src/lib/supabase.ts` — import it the same way other screens do, e.g. `import { supabase } from "./lib/supabase";` matching the existing import style in this file):

```tsx
const [emailPrefs, setEmailPrefs] = useState<{ weekly: boolean; winback: boolean; product: boolean } | null>(null);

useEffect(() => {
  let alive = true;
  (async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;
    const { data } = await supabase
      .from("profiles")
      .select("weekly_recap_opt_in, winback_opt_in, product_opt_in")
      .eq("user_id", user.id)
      .maybeSingle();
    if (alive && data) {
      setEmailPrefs({
        weekly:  data.weekly_recap_opt_in ?? true,
        winback: data.winback_opt_in ?? true,
        product: data.product_opt_in ?? true,
      });
    }
  })();
  return () => { alive = false; };
}, []);
```

- [ ] **Step 2: Add an update helper + render toggles**

```tsx
async function setEmailPref(key: "weekly" | "winback" | "product", value: boolean) {
  const col = key === "weekly" ? "weekly_recap_opt_in" : key === "winback" ? "winback_opt_in" : "product_opt_in";
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return;
  setEmailPrefs(p => (p ? { ...p, [key]: value } : p));            // optimistic
  const { error } = await supabase.from("profiles").update({ [col]: value }).eq("user_id", user.id);
  if (error) setEmailPrefs(p => (p ? { ...p, [key]: !value } : p)); // revert on failure
}
```

Render a section (match the existing settings-row markup in this file — reuse the same row/label/toggle components already used for other settings rather than inventing new ones):

```tsx
{emailPrefs && (
  <section>
    <h3>Email</h3>
    <label><span>Weekly recap</span>
      <input type="checkbox" checked={emailPrefs.weekly} onChange={e => setEmailPref("weekly", e.target.checked)} /></label>
    <label><span>Win-back nudges</span>
      <input type="checkbox" checked={emailPrefs.winback} onChange={e => setEmailPref("winback", e.target.checked)} /></label>
    <label><span>Product news</span>
      <input type="checkbox" checked={emailPrefs.product} onChange={e => setEmailPref("product", e.target.checked)} /></label>
  </section>
)}
```

> Use the existing toggle component in `SettingsScreen.tsx` if one exists (e.g. the push-notification toggle around line 547) for visual consistency; the raw `<input type="checkbox">` above is a functional fallback only.

- [ ] **Step 3: Typecheck**

Run: `npx tsc -p tsconfig.app.json --noEmit`
Expected: PASS.

- [ ] **Step 4: Commit**

```bash
git add src/SettingsScreen.tsx
git commit -m "feat(retention): manage-emails toggles in settings"
```

---

## Task 5: Once-daily `last_active_at` ping

**Files:**
- Create: `src/lib/activity.ts`
- Modify: `src/Koda.tsx` (auth-state handler ~line 331)

- [ ] **Step 1: Write the helper**

```ts
// src/lib/activity.ts
import { supabase } from "./supabase";

const KEY = "koda_last_active_ping";

/** Update profiles.last_active_at at most once per calendar day per device. */
export async function pingLastActive(userId: string): Promise<void> {
  try {
    const today = new Date().toISOString().slice(0, 10);
    if (localStorage.getItem(KEY) === today) return;
    localStorage.setItem(KEY, today);
    await supabase.from("profiles").update({ last_active_at: new Date().toISOString() }).eq("user_id", userId);
  } catch {
    /* best-effort; never block the app */
  }
}
```

- [ ] **Step 2: Call it when a session is present**

In `src/Koda.tsx`, import and invoke inside the existing auth-state subscription (the `onAuthStateChange` handler near line 331) and on initial session load:

```tsx
import { pingLastActive } from "./lib/activity";
// inside the auth handler, when a session/user is available:
if (session?.user) void pingLastActive(session.user.id);
```

- [ ] **Step 3: Typecheck**

Run: `npx tsc -p tsconfig.app.json --noEmit`
Expected: PASS.

- [ ] **Step 4: Manual verification**

Load the app signed-in. Confirm `select last_active_at from profiles where user_id='<me>'` is recent, and that a second reload the same day does **not** issue another update (network tab shows no second PATCH; localStorage `koda_last_active_ping` set).

- [ ] **Step 5: Commit**

```bash
git add src/lib/activity.ts src/Koda.tsx
git commit -m "feat(retention): once-daily last_active_at ping"
```

---

# Phase B — Weekly recap email

## Task 6: Weekly recap stats module (TDD)

**Files:**
- Create: `api/_lib/metrics/weeklyRecap.ts`
- Test: `api/_lib/metrics/weeklyRecap.test.ts`

- [ ] **Step 1: Write the failing test**

```ts
// api/_lib/metrics/weeklyRecap.test.ts
import { describe, it, expect } from "vitest";
import { computeWeeklyRecap, type RecapTrade } from "./weeklyRecap.js";

const t = (o: Partial<RecapTrade>): RecapTrade =>
  ({ pnl: 0, rr: null, outcome: "be", strategy: "", ...o });

describe("computeWeeklyRecap", () => {
  it("returns zeros for an empty week", () => {
    const r = computeWeeklyRecap([]);
    expect(r).toEqual({ tradeCount: 0, netDollar: 0, winRate: 0, netR: null, bestSetup: "" });
  });

  it("win rate excludes break-even trades", () => {
    const r = computeWeeklyRecap([
      t({ outcome: "win" }), t({ outcome: "loss" }), t({ outcome: "be" }),
    ]);
    expect(r.tradeCount).toBe(3);
    expect(r.winRate).toBe(50); // 1 win / (1 win + 1 loss)
  });

  it("netDollar sums pnl; netR is null when no rr present", () => {
    const r = computeWeeklyRecap([t({ pnl: 120 }), t({ pnl: -40 })]);
    expect(r.netDollar).toBe(80);
    expect(r.netR).toBeNull();
  });

  it("netR sums only non-null rr, rounded to 1dp", () => {
    const r = computeWeeklyRecap([t({ rr: 1.5 }), t({ rr: -0.5 }), t({ rr: null })]);
    expect(r.netR).toBe(1);
  });

  it("bestSetup is the strategy with the highest net pnl, ignoring blanks", () => {
    const r = computeWeeklyRecap([
      t({ strategy: "ORB", pnl: 200 }),
      t({ strategy: "ORB", pnl: -50 }),
      t({ strategy: "Reversal", pnl: 100 }),
      t({ strategy: "", pnl: 999 }),
    ]);
    expect(r.bestSetup).toBe("ORB"); // 150 vs 100
  });
});
```

- [ ] **Step 2: Run it to verify it fails**

Run: `npx vitest run api/_lib/metrics/weeklyRecap.test.ts`
Expected: FAIL — cannot find module `./weeklyRecap.js`.

- [ ] **Step 3: Implement the module**

```ts
// api/_lib/metrics/weeklyRecap.ts
import { getAdminClient } from "../supabaseAdmin.js";

export interface RecapTrade {
  pnl: number;
  rr: number | null;
  outcome: "win" | "loss" | "be";
  strategy: string;
}

export interface WeeklyRecap {
  tradeCount: number;
  netDollar: number;
  winRate: number;       // integer %, excludes break-even
  netR: number | null;   // null when no rr data
  bestSetup: string;     // "" when no named strategy
}

export function computeWeeklyRecap(trades: RecapTrade[]): WeeklyRecap {
  const tradeCount = trades.length;
  const netDollar = trades.reduce((s, t) => s + (t.pnl ?? 0), 0);

  const wins = trades.filter(t => t.outcome === "win").length;
  const losses = trades.filter(t => t.outcome === "loss").length;
  const decided = wins + losses;
  const winRate = decided === 0 ? 0 : Math.round((wins / decided) * 100);

  const rTrades = trades.filter(t => t.rr !== null && t.rr !== undefined);
  const netR = rTrades.length === 0
    ? null
    : Math.round(rTrades.reduce((s, t) => s + (t.rr as number), 0) * 10) / 10;

  const byStrat: Record<string, number> = {};
  for (const t of trades) {
    const s = (t.strategy ?? "").trim();
    if (!s) continue;
    byStrat[s] = (byStrat[s] ?? 0) + (t.pnl ?? 0);
  }
  let bestSetup = "";
  let bestVal = -Infinity;
  for (const [s, v] of Object.entries(byStrat)) {
    if (v > bestVal) { bestVal = v; bestSetup = s; }
  }

  return { tradeCount, netDollar, winRate, netR, bestSetup };
}

/** Fetch a user's trailing-7-day trades and compute their recap. */
export async function fetchWeeklyRecap(userId: string): Promise<WeeklyRecap> {
  const since = new Date(Date.now() - 7 * 24 * 3600 * 1000).toISOString().slice(0, 10);
  const admin = getAdminClient();
  const { data } = await admin
    .from("trades")
    .select("pnl, rr, outcome, strategy")
    .eq("user_id", userId)
    .gte("date", since);
  const rows = (data ?? []) as RecapTrade[];
  return computeWeeklyRecap(rows);
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx vitest run api/_lib/metrics/weeklyRecap.test.ts`
Expected: PASS (5 tests).

- [ ] **Step 5: Commit**

```bash
git add api/_lib/metrics/weeklyRecap.ts api/_lib/metrics/weeklyRecap.test.ts
git commit -m "feat(retention): weekly recap stats with tests"
```

---

## Task 7: Recap template leads with net $

**Files:**
- Modify: `api/_lib/email.ts` (`weeklyRecapHtml`, ~line 30)

- [ ] **Step 1: Replace `weeklyRecapHtml` signature + body**

```ts
export function weeklyRecapHtml({
  name, netDollar, winRate, netR, bestSetup, tradeCount, weekLabel, unsubscribeUrl,
}: {
  name: string; netDollar: number; winRate: number; netR: number | null;
  bestSetup: string; tradeCount: number; weekLabel: string; unsubscribeUrl?: string;
}) {
  const positive = netDollar >= 0;
  const color = positive ? "oklch(0.78 0.18 152)" : "oklch(0.70 0.21 25)";
  const dollarStr = `${positive ? "+" : "-"}$${Math.abs(Math.round(netDollar))}`;
  const secondLabel = netR === null ? "Win Rate" : "Net R";
  const secondValue = netR === null ? `${winRate}%` : `${netR >= 0 ? "+" : ""}${netR}R`;
  const body = `
${emailH({ title: "Your week in review,", accent: `${esc(name)}.` })}
${emailP(`${esc(weekLabel)} · ${tradeCount} trade${tradeCount === 1 ? "" : "s"} logged`)}
<table width="100%" cellpadding="0" cellspacing="0" style="margin:22px 0">
  <tr>
    <td style="padding-right:6px">${emailPanel(`<p style="font-family:'Geist Mono',monospace;font-size:9px;letter-spacing:0.12em;color:${EMAIL_MUTE};text-transform:uppercase;margin:0">Net</p><p style="font-size:28px;font-weight:600;color:${color};margin:6px 0 0">${dollarStr}</p>`, "text-align:center")}</td>
    <td style="padding-left:6px">${emailPanel(`<p style="font-family:'Geist Mono',monospace;font-size:9px;letter-spacing:0.12em;color:${EMAIL_MUTE};text-transform:uppercase;margin:0">${secondLabel}</p><p style="font-size:28px;font-weight:600;color:${EMAIL_INK};margin:6px 0 0">${secondValue}</p>`, "text-align:center")}</td>
  </tr>
</table>
${bestSetup ? emailP(`Best setup this week: <strong style="color:${EMAIL_INK}">${esc(bestSetup)}</strong>`) : ""}
<div style="margin:24px 0">${emailCTA({ label: "Open Kōda →", href: "https://kodatrade.co.uk" })}</div>`;
  return emailShell({ kicker: `${weekLabel} · Weekly Recap`, title: "Your Kōda week", body, unsubscribeUrl });
}
```

> This rewrites the old `weeklyRecapHtml` (which assumed `netR` and used a standalone HTML doc) to use the shared `emailShell` helpers — consistent with templates 1–12. The old signature had no callers, so nothing else breaks.

- [ ] **Step 2: Typecheck**

Run: `npx tsc -p tsconfig.api.json --noEmit`
Expected: PASS.

- [ ] **Step 3: Commit**

```bash
git add api/_lib/email.ts
git commit -m "feat(retention): weekly recap email leads with net $, R when present"
```

---

## Task 8: Send recap emails from the weekly-digest cron

**Files:**
- Modify: `api/cron.ts` (`handleWeeklyDigest`, ~line 719)

- [ ] **Step 1: Add imports + a recipient-email helper**

At the top of `api/cron.ts` add to the imports:

```ts
import { sendEmail, weeklyRecapHtml, buildUnsubscribeUrl } from "./_lib/email.js";
import { fetchWeeklyRecap } from "./_lib/metrics/weeklyRecap.js";
```

Add a helper above `handleWeeklyDigest`:

```ts
/** Real deliverable email for a user: recovery_email from auth metadata, or null. */
async function recoveryEmailForUid(admin: ReturnType<typeof getAdminClient>, uid: string): Promise<string | null> {
  const { data } = await admin.schema("auth").from("users")
    .select("raw_user_meta_data").eq("id", uid).maybeSingle();
  const meta = (data as { raw_user_meta_data?: { recovery_email?: string } } | null)?.raw_user_meta_data;
  const email = meta?.recovery_email?.trim();
  return email && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) ? email : null;
}
```

- [ ] **Step 2: Append the recap-email pass to `handleWeeklyDigest`**

Just before `return res.status(200).json({ ok: true, users: userCount });` in `handleWeeklyDigest`, insert:

```ts
  // ── Weekly trading recap email (separate from the social digest above) ──
  const weekStart = new Date(Date.now() - 7 * 24 * 3600 * 1000);
  const weekLabel = `${weekStart.toLocaleDateString("en-GB", { day: "numeric", month: "short" })}–${new Date().toLocaleDateString("en-GB", { day: "numeric", month: "short" })}`;
  const thisWeekIso = new Date(Date.now() - 6.5 * 24 * 3600 * 1000).toISOString(); // already-sent guard

  const { data: optedIn } = await admin
    .from("profiles")
    .select("user_id, name, unsubscribe_token, last_weekly_recap_at")
    .eq("weekly_recap_opt_in", true);

  let recapsSent = 0;
  for (const p of optedIn ?? []) {
    const prof = p as { user_id: string; name: string; unsubscribe_token: string; last_weekly_recap_at: string | null };
    if (prof.last_weekly_recap_at && prof.last_weekly_recap_at > thisWeekIso) continue; // already sent this week

    const recap = await fetchWeeklyRecap(prof.user_id);
    if (recap.tradeCount < 1) continue; // empty week → win-back's job, not the recap's

    const email = await recoveryEmailForUid(admin, prof.user_id);
    if (!email) continue; // no deliverable address → skip (push handled elsewhere)

    try {
      await sendEmail({
        to: email,
        subject: `Your Kōda week: ${recap.netDollar >= 0 ? "+" : "-"}$${Math.abs(Math.round(recap.netDollar))}`,
        html: weeklyRecapHtml({
          name: prof.name || "Trader",
          netDollar: recap.netDollar, winRate: recap.winRate, netR: recap.netR,
          bestSetup: recap.bestSetup, tradeCount: recap.tradeCount, weekLabel,
          unsubscribeUrl: buildUnsubscribeUrl(prof.unsubscribe_token, "weekly"),
        }),
      });
      await admin.from("profiles").update({ last_weekly_recap_at: new Date().toISOString() }).eq("user_id", prof.user_id);
      recapsSent++;
    } catch (err) {
      console.error("[weekly-digest] recap email failed for", prof.user_id, err);
      // leave last_weekly_recap_at untouched → retried next run
    }
  }

  return res.status(200).json({ ok: true, users: userCount, recapsSent });
```

Delete the original `return res.status(200).json({ ok: true, users: userCount });` line that followed the social loop (replaced above).

- [ ] **Step 3: Typecheck**

Run: `npx tsc -p tsconfig.api.json --noEmit`
Expected: PASS.

- [ ] **Step 4: Manual verification**

With `CRON_SECRET` set, trigger the job and confirm a seeded test user (opted-in, recovery_email set, ≥1 trade in last 7d) receives the recap:

Run: `curl -H "Authorization: Bearer $CRON_SECRET" "$APP_URL/api/cron?job=weekly-digest"`
Expected: `{"ok":true,...,"recapsSent":1}`; email arrives; `last_weekly_recap_at` updated; a second immediate call → `recapsSent:0`.

- [ ] **Step 5: Commit**

```bash
git add api/cron.ts
git commit -m "feat(retention): send weekly recap emails from weekly-digest cron"
```

---

# Phase C — Win-back trigger

## Task 9: Win-back email template

**Files:**
- Modify: `api/_lib/email.ts` (add `winbackEmailHtml`)

- [ ] **Step 1: Add the template**

```ts
// 13 · Win-back — re-engage a lapsed user
export function winbackEmailHtml({
  firstName = "Trader", appUrl = "https://kodatrade.co.uk", unsubscribeUrl,
}: { firstName?: string; appUrl?: string; unsubscribeUrl?: string }): string {
  const body = `
${emailH({ title: "Your edge is", accent: "waiting." })}
${emailP(`Hey ${esc(firstName)} — it's been a minute. Your journal, your rules and your stats are exactly where you left them. One logged trade and Kōda picks the thread back up.`)}
<div style="margin:24px 0">${emailCTA({ label: "Pick up where you left off →", href: `${appUrl}/?screen=log` })}</div>
${emailPanel(`<p style="font-size:12.5px;color:${EMAIL_INK2};margin:0">Traders who journal consistently break fewer rules. Don't let the streak go cold.</p>`)}`;
  return emailShell({ kicker: "We miss you", title: "Your Kōda edge is waiting", body, unsubscribeUrl });
}
```

- [ ] **Step 2: Typecheck**

Run: `npx tsc -p tsconfig.api.json --noEmit`
Expected: PASS.

- [ ] **Step 3: Commit**

```bash
git add api/_lib/email.ts
git commit -m "feat(retention): win-back email template"
```

---

## Task 10: Win-back selection logic (TDD)

**Files:**
- Create: `api/_lib/retention/winback.ts`
- Test: `api/_lib/retention/winback.test.ts`

- [ ] **Step 1: Write the failing test**

```ts
// api/_lib/retention/winback.test.ts
import { describe, it, expect } from "vitest";
import { isWinbackCandidate, type WinbackProfile } from "./winback.js";

const DAY = 24 * 3600 * 1000;
const NOW = Date.parse("2026-06-16T12:00:00Z");
const daysAgo = (n: number) => new Date(NOW - n * DAY).toISOString();

const base = (o: Partial<WinbackProfile> = {}): WinbackProfile => ({
  last_active_at: daysAgo(10),
  winback_opt_in: true,
  last_winback_at: null,
  ...o,
});

describe("isWinbackCandidate", () => {
  it("selects a user inactive 7–14 days, opted in, never win-backed", () => {
    expect(isWinbackCandidate(base(), NOW)).toBe(true);
  });
  it("rejects users active within 7 days", () => {
    expect(isWinbackCandidate(base({ last_active_at: daysAgo(3) }), NOW)).toBe(false);
  });
  it("rejects users inactive beyond 14 days (already past the window)", () => {
    expect(isWinbackCandidate(base({ last_active_at: daysAgo(20) }), NOW)).toBe(false);
  });
  it("rejects opted-out users", () => {
    expect(isWinbackCandidate(base({ winback_opt_in: false }), NOW)).toBe(false);
  });
  it("rejects users win-backed within the last 30 days", () => {
    expect(isWinbackCandidate(base({ last_winback_at: daysAgo(10) }), NOW)).toBe(false);
  });
  it("rejects users with no recorded activity", () => {
    expect(isWinbackCandidate(base({ last_active_at: null }), NOW)).toBe(false);
  });
});
```

- [ ] **Step 2: Run it to verify it fails**

Run: `npx vitest run api/_lib/retention/winback.test.ts`
Expected: FAIL — cannot find module `./winback.js`.

- [ ] **Step 3: Implement**

```ts
// api/_lib/retention/winback.ts
export interface WinbackProfile {
  last_active_at: string | null;
  winback_opt_in: boolean;
  last_winback_at: string | null;
}

const DAY = 24 * 3600 * 1000;
const INACTIVE_MIN_DAYS = 7;
const INACTIVE_MAX_DAYS = 14;
const COOLDOWN_DAYS = 30;

export function isWinbackCandidate(p: WinbackProfile, now: number = Date.now()): boolean {
  if (!p.winback_opt_in) return false;
  if (!p.last_active_at) return false;

  const idleDays = (now - Date.parse(p.last_active_at)) / DAY;
  if (idleDays < INACTIVE_MIN_DAYS || idleDays > INACTIVE_MAX_DAYS) return false;

  if (p.last_winback_at) {
    const sinceWinback = (now - Date.parse(p.last_winback_at)) / DAY;
    if (sinceWinback < COOLDOWN_DAYS) return false;
  }
  return true;
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx vitest run api/_lib/retention/winback.test.ts`
Expected: PASS (6 tests).

- [ ] **Step 5: Commit**

```bash
git add api/_lib/retention/winback.ts api/_lib/retention/winback.test.ts
git commit -m "feat(retention): win-back candidate selection with tests"
```

---

## Task 11: Win-back cron job + schedule

**Files:**
- Modify: `api/cron.ts` (add `handleWinback` + route)
- Modify: `vercel.json` (add cron)

- [ ] **Step 1: Add imports**

Extend the `api/cron.ts` imports:

```ts
import { winbackEmailHtml } from "./_lib/email.js";
import { isWinbackCandidate } from "./_lib/retention/winback.js";
```

(`sendEmail`, `buildUnsubscribeUrl`, `recoveryEmailForUid`, `deliverNotification` are already imported/defined from Task 8 and existing code.)

- [ ] **Step 2: Add the handler**

Add before the Router section in `api/cron.ts`:

```ts
// ══════════════════════════════════════════════════════════════════════════════
// Job: winback  (daily — re-engage users idle 7–14 days)
// ══════════════════════════════════════════════════════════════════════════════

async function handleWinback(req: Req, res: Res) {
  if (!isCronAuthed(req)) return res.status(401).json({ error: "Unauthorized" });
  const admin = getAdminClient();

  const { data: profiles } = await admin
    .from("profiles")
    .select("user_id, name, unsubscribe_token, last_active_at, winback_opt_in, last_winback_at");

  let sent = 0;
  for (const row of profiles ?? []) {
    const p = row as {
      user_id: string; name: string; unsubscribe_token: string;
      last_active_at: string | null; winback_opt_in: boolean; last_winback_at: string | null;
    };
    if (!isWinbackCandidate(
      { last_active_at: p.last_active_at, winback_opt_in: p.winback_opt_in, last_winback_at: p.last_winback_at },
    )) continue;

    const email = await recoveryEmailForUid(admin, p.user_id);

    try {
      if (email) {
        await sendEmail({
          to: email,
          subject: "Your Kōda edge is waiting",
          html: winbackEmailHtml({
            firstName: p.name || "Trader",
            unsubscribeUrl: buildUnsubscribeUrl(p.unsubscribe_token, "winback"),
          }),
        });
      }
      // Best-effort push too (no-op if not subscribed)
      await deliverNotification({
        targetUid: p.user_id,
        kind: "digest",
        title: "Your edge is waiting",
        body: "It's been a minute — log a trade and pick the thread back up.",
        data: { reason: "winback" },
      }).catch(() => {});

      await admin.from("profiles").update({ last_winback_at: new Date().toISOString() }).eq("user_id", p.user_id);
      sent++;
    } catch (err) {
      console.error("[winback] failed for", p.user_id, err);
      // leave last_winback_at untouched → retried next run
    }
  }

  return res.status(200).json({ ok: true, sent });
}
```

- [ ] **Step 3: Route it**

In the `handler` router in `api/cron.ts`, add alongside the other jobs:

```ts
  if (job === "winback") return handleWinback(req, res);
```

and add `winback` to the final error string's job list.

- [ ] **Step 4: Schedule it**

In `vercel.json`, add to the `crons` array:

```json
    {
      "path": "/api/cron?job=winback",
      "schedule": "0 16 * * *"
    }
```

- [ ] **Step 5: Typecheck**

Run: `npx tsc -p tsconfig.api.json --noEmit`
Expected: PASS.

- [ ] **Step 6: Manual verification**

Seed a test user with `last_active_at` = 10 days ago, `winback_opt_in=true`, recovery_email set, `last_winback_at=null`.

Run: `curl -H "Authorization: Bearer $CRON_SECRET" "$APP_URL/api/cron?job=winback"`
Expected: `{"ok":true,"sent":1}`; email arrives; `last_winback_at` set; a second immediate call → `sent:0` (30-day cooldown).

- [ ] **Step 7: Commit**

```bash
git add api/cron.ts vercel.json
git commit -m "feat(retention): daily win-back cron job"
```

---

## Final verification

- [ ] **Run the full test suite**

Run: `npx vitest run`
Expected: PASS (existing + the 11 new tests across `weeklyRecap.test.ts` and `winback.test.ts`).

- [ ] **Full typecheck**

Run: `npx tsc -p tsconfig.app.json --noEmit && npx tsc -p tsconfig.api.json --noEmit`
Expected: PASS.

- [ ] **Confirm function count** — no new top-level `api/*.ts` files were added (unsubscribe → `account.ts`, winback → `cron.ts`), so the Vercel Hobby 12-function cap is respected.
