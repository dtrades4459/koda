# Kōda

Mobile-first trading journal + social platform, delivered as an installable PWA. Live at [kodatrade.co.uk](https://kodatrade.co.uk).

**Stack:** React 19 · TypeScript · Vite · Supabase · Vercel · Stripe · Resend

---

## Dev

```bash
npm install
npm run dev        # localhost:5173
npm run typecheck  # tsc --noEmit (also wired into pre-commit)
npm run lint       # eslint (flat config)
npm test           # vitest unit tests
```

Vercel handles production builds on push to `main`. CI runs lint + typecheck + tests on every PR.

---

## Project structure

```
src/
  main.tsx              entry: mounts KodaAuth + CookieConsent, boots Sentry/PostHog
  KodaAuth.tsx          Supabase auth gate (sign-in / sign-up / password reset)
  Koda.tsx              the app — routes, screens, modals, state shell
  CookieConsent.tsx     bottom banner; gates PostHog behind opt-in (PECR/GDPR)
  ErrorBoundary.tsx     class component fallback UI for uncaught runtime errors
  CsvImportPanel.tsx    CSV/XLSX import flow + broker presets
  TradingCircles.tsx    social: leaderboards, chat, challenges
  ...                   screens, modals, components
  hooks/                useCircles, useFeed, useViewport, useFlags, etc.
  data/                 v2 schema modules (trades, profiles, follows, circles)
  lib/
    supabase.ts         Supabase client (env-driven)
    storage.ts          window.storage shim: user_kv + shared_kv + localStorage cache
    csvParser.ts        broker-agnostic CSV parsing (parseNum, dedup, broker detect)
    imports.ts          persists original CSV + audit row on import
    posthog.ts          analytics wrapper, consent-gated
    sentry.ts           error monitoring
    utm.ts              UTM persistence across OAuth round-trip
    stats.ts            P&L / win-rate / R-multiple math
    leaderboardSort.ts  circle leaderboard view-sort (pinned ranks, METRIC_VALUE map)
api/                    Vercel serverless functions (Stripe, Resend, cron, push)
public/                 static HTML pages (privacy, terms, cookies, faq, changelog) + PWA assets
supabase/migrations/    SQL migrations (run via Supabase dashboard, idempotent)
```

---

## The RLS pattern (important)

Every row in `shared_kv` is owned by exactly one user (`owner_id = auth.uid()`). Writes only succeed for the row's owner.

Rules that flow from this:
- **Following:** writer creates both `koda_follow_<me>_<them>` and `koda_follower_<them>_<me>`, both owned by the follower.
- **Joining a circle:** joiner creates `koda_circle_member_<CIRCLE>_<me>`, owned by themselves.
- **Publishing leaderboard stats:** member creates `koda_circle_entry_<CIRCLE>_<me>`, owned by themselves.
- **Kicking a member:** circle owner writes `koda_circle_bans_<CIRCLE>` (a row they own); members are filtered on read — never try to delete another user's row.

If you need to modify a row owned by someone else, stop — add a new row you own instead.

---

## Audits & open work

See `AUDIT_INDEX.md` at the repo root for the most recent codebase / dev-env / UX / funnel / CSV-import audits and their phased fix list. The audits flag concrete file/line targets — work them in the order suggested.

---

## Known issues

- **Monolithic `Koda.tsx`** (~4.5k lines). Component extraction in progress — see `AUDIT.md` for the target folder layout.
- **OneDrive corruption risk.** This working tree lives under `C:\Users\Dylon\OneDrive\…`. Large writes can be truncated by OneDrive sync. After any big write to `Koda.tsx` verify `wc -l src/Koda.tsx` is sane.
- **Live broker sync UI is gated.** `DataSourcesScreen.tsx` still shows a "Coming Soon" overlay until live connections roll out properly.
