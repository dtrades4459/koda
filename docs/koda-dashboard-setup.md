# Founder dashboard — Dylon's setup todo

The code is shipped. Before you can open `/admin`, three manual steps:

---

## 1 · Apply the SQL migration

The migration lives at `supabase/migrations/20260605_founder_metrics.sql`. It creates:
- `public.founder_metrics` — one-row table for cash/burn input
- `public.get_founder_metrics()` — returns the dashboard JSON

Apply via either:

**Option A · Supabase CLI** (if linked locally)
```sh
supabase db push
```

**Option B · Dashboard SQL editor** (simplest for prod)
1. Open `supabase/migrations/20260605_founder_metrics.sql` in your editor.
2. Copy the whole file.
3. Paste into Supabase dashboard → SQL Editor → Run.

Smoke-test it in SQL editor:
```sql
select public.get_founder_metrics();
```
You should get back a JSON blob with WAJ, activation, retention, etc.

---

## 2 · Add `ADMIN_EMAILS` to Vercel env

```
vercel env add ADMIN_EMAILS production
# Paste: dnyland420@gmail.com
```

Also add to **preview** and **development** scopes if you want `/admin` to work on preview deploys.

If you skip this step, `/api/admin/metrics` returns **503 — Admin allowlist not configured**.

Then redeploy (or wait for the next push to main — Vercel picks up env on next deploy).

---

## 3 · Seed cash + burn (one-time, then update monthly)

In Supabase SQL Editor, run:

```sql
update public.founder_metrics
set cash_in_bank_gbp = 12000,   -- your real cash
    monthly_burn_gbp = 800,     -- your real burn
    updated_at = now()
where id = true;
```

Until you do this, the Runway card shows `∞` (zero burn = infinite runway).
Re-run with new numbers whenever you want the dashboard to reflect reality. There's no UI for editing this yet — by design, so you have to think before lying to yourself about runway.

---

## 4 · Open the dashboard

- **URL:** https://kodatrade.co.uk/admin
- The path-detector swaps it to the founder view on boot, then cleans the URL back to `/`.
- Mobile-first — built to be opened from your phone PWA.
- The "Refresh" button refetches; the serverless function caches the response for 60s on Vercel's edge.

If you ever lose access: check that your account's email matches `ADMIN_EMAILS` (case-insensitive) in Vercel env.

---

## What's still TODO (Phase 2/3 work)

These were intentionally left out of the first ship — pick them up when relevant:

- **Stripe MRR** — Phase 3, once Pro tier is live. The dashboard already has a hidden MRR/Active subs row; flip `revenue.source` to `'stripe'` in the SQL function and fill the numbers either by syncing a `subscriptions` table from a Stripe webhook, or by calling `stripe.subscriptions.list({ status: 'active' })` from `api/admin/[action].ts`.
- **Sentry "unresolved errors, 24h" card** — Phase 3 health check. The `SENTRY_AUTH_TOKEN` is already in env but marked Sensitive. Use the Sentry API from the serverless handler — don't expose the token to the client.
- **Activation threshold ≥3** — Currently 1. Bump the `activation_threshold` constant in `get_founder_metrics()` if/when you decide a single trade is too generous.
- **AI "read" line** — One-line Haiku narration of the finished JSON. Strictly optional. If you add it, the narrative goes through the serverless function — never let the LLM compute a number, only describe one.

---

## Files added in this build

```
supabase/migrations/20260605_founder_metrics.sql   # SQL function + cash/burn table
api/admin/[action].ts                              # /api/admin/metrics endpoint
src/admin/FounderDashboard.tsx                     # UI
src/Koda.tsx                                       # +import, +view branch, +/admin path detector
.env.example                                       # +ADMIN_EMAILS
```
