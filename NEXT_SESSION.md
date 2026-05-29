# Kōda — pickup for next session

**Session closed:** 2026-05-30 (Saturday).
**Beta launch:** 2026-06-01 (Monday).
**Next work day:** 2026-05-31 (Sunday).

This doc is the single source of truth for resuming work. Read this first, then dip into the audit reports as needed.

---

## 1 · What shipped this session

Each commit is on `main`, typecheck-clean, and pushed.

| # | Commit | What |
|---|---|---|
| 1 | `2bfb21c` | **Batch 1** pre-beta correctness — receipt `£`, sitemap domain, v2 outcome casing fix in `appTradeToV2Payload`, `leaveCircle("KODA-GLOBAL")` guard, "Start free trial" → "Get started free" |
| 2 | `1c5a8b8` | **Batch 3** cookie consent banner — `src/CookieConsent.tsx`, gates PostHog behind opt-in, `public/cookies.html` policy page, footer links on privacy/terms |
| 3 | `597841e` | **Batch 4a** CSV parser correctness — `parseNum` EU decimal handling (100× bug), Rithmic side inference from buy/sell timestamps, broker-supplied net P&L preferred over local recompute, `brokerId` dedup. 17 new unit tests. |
| 4 | `514428b` | **Batch 4b** imports audit trail — `supabase/migrations/20260529_imports_audit_trail.sql` + `src/lib/imports.ts` + `CsvImportPanel` wiring. **REQUIRES MIGRATION** (see §3). |
| 5 | `c34eed5` | **PR A** dead code + docs — drop `LEGACY_GLOBAL_CODE`, 100-line `import_legacy_unused` route, `(profile as any).code` cast; rewrite `README.md`; fix `CLAUDE.md` storage keys table (`tradr_*` → `koda_*`) and line counts |
| 6 | `d5f5c13` | **PR B** 5 leaf extractions — `StrategyEditor`, `ConfluenceTracker`, `FirstSessionSurvey`, `LoadingSplash`, `OfflineBanner` to `src/components/` |
| 7 | `6981371` | **PR C** `DataSourcesScreen` cleanup — drop fake "5m ago · syncing" placeholder cards; clean Coming Soon card gated behind `isFlagOn("liveBrokerSync")` |
| 8 | `3e3a3bf` | **Smoke tests** — Playwright suite expanded (static pages, robots/sitemap, cookie consent), local `npm run test:e2e` works via auto-started dev server, CI config fixed (was using WebKit device with Chromium-only install) |
| 9 | `a33d350` | **data-testid pass** — stable selectors on bottom nav (`nav-{id}`), `auth-submit`, `trade-pair`, `trade-pnl-dollar`, `trade-save`. Auth flow smoke test now uses them. |

You also fixed the `BETA_26` promo on your side in `api/stripe-checkout.ts:38` — confirm that's committed before launch.

`Koda.tsx` is now **4067 lines** (was 4492 — that's −425, ~9.5%).

---

## 2 · Audits on disk

These are the source-of-truth for everything that was found, not just what's shipped:

- `AUDIT_INDEX.md` — orchestrator summary + cross-audit dependencies + three-phase sequencing (now annotated with what's shipped)
- `AUDIT.md` — codebase audit (monolith map, dead code, type safety, mobile, pre-launch)
- `DEV_ENV_AUDIT.md` — package mgmt, tsconfig, lint, git hygiene, CI, editor
- `UX_AUDIT.md` — design system drift, behavioural design gaps, mobile UX
- `FUNNEL_AUDIT.md` — landing, sign-up, onboarding, monetization, compliance
- `CSV_IMPORT_AUDIT.md` — format coverage, parsing robustness, P&L formulas, dedup, prop-firm logic

---

## 3 · BLOCKING for Monday beta — do these tomorrow

These are non-negotiable for launch.

### 3.1 Run the Supabase migration (5 min)
The imports audit trail code (commit `514428b`) calls a bucket + table that don't exist in prod yet. Until this runs, every CSV import silently logs `[koda imports] persist failed` — trades still save, but you lose the audit row + file.

1. Supabase dashboard → SQL Editor → New query
2. Paste contents of `supabase/migrations/20260529_imports_audit_trail.sql`
3. Run
4. Verify: `select count(*) from public.imports` returns 0 (table exists)
5. Verify: Storage page shows a `trade-imports` bucket (private, 10 MB limit)

### 3.2 Verify BETA_26 promo (2 min)
The fix is a one-line server map change in `api/stripe-checkout.ts:38`. Confirm:

```bash
git log --oneline -- api/stripe-checkout.ts | head -5
```

Should show a recent commit. If not, the fix is:
```ts
// Before
BETA: process.env.STRIPE_PROMO_CODE_ID_BETA,
// After
BETA_26: process.env.STRIPE_PROMO_CODE_ID_BETA,
```
Plus drop `"BETA26"` from `VALID_PROMO_CODES` in `src/PaywallScreen.tsx:11` so only `"BETA_26"` is advertised.

### 3.3 Batch 2 — sign-up compliance polish (1–2 h)
**The remaining Phase A pre-beta item.** Needs your UK Ltd details to land.

What's missing per `FUNNEL_AUDIT.md` §A2 + §A9:
- T&Cs + Privacy + unticked marketing-opt-in checkboxes on `src/KodaAuth.tsx` sign-up form
- UK Ltd disclosure (company number + registered office) in:
  - `public/privacy.html` footer + section "Who we are"
  - `public/terms.html` footer
  - `public/cookies.html` footer
  - `src/KodaAuth.tsx` landing footer

**I need from you (write the answers below before tomorrow):**
- Registered company name: ____________________________________
- Companies House number: ____________________________________
- Registered office (single line): ____________________________________
- VAT number (if registered): ____________________________________
- ICO data-protection registration ref (if registered): ____________________________________

Once those are filled, Batch 2 is mechanical — ~30 min for the footer disclosure, ~45 min for the checkboxes + state plumbing in `KodaAuth.tsx`.

### 3.4 Pre-flight smoke (10 min)
After the above:
1. `npm run typecheck`
2. `npm test -- --run`
3. `npm run test:e2e` (unauth tests will pass; the auth flow test skips unless `TEST_EMAIL` is set locally — that's fine, it runs in CI on push)
4. Open `kodatrade.co.uk` in incognito on a phone. Walk through: cookie banner → sign up → onboarding → log a trade → see it on history → check footer links to privacy/terms/cookies all work.

If anything's red, fix before flipping the beta password.

---

## 4 · Safe next steps for Sunday (testid net is in place)

These are the audit-blessed "Day 3+" extractions that the new smoke tests give us cover for. Pick whichever feels right; they're independent.

| # | Task | Effort | Why |
|---|---|---|---|
| A | Extract `<TradeDetailCard>` from history route (`Koda.tsx:2895-3090`, ~200 lines) | M | Audit §3.1 — single largest reusable block; isolates the history detail UI |
| B | Decompose HOME route (`Koda.tsx:1687-2686`, ~1000 lines) into `HomeHeroCard` + `DailyRiskDashboard` + `MonthlyReportCard` + `PlanRow` | L (multi-PR) | The biggest monolith remaining; unlocks future kill-switch glanceability work |
| C | Extract `<TradovateLiveModal>` (~135 lines, `Koda.tsx` modal section) | S | Already a clear seam; modal state is mostly self-contained |
| D | Extract effects into hooks: `useStripeReturn`, `useDeepLink`, `useDraftCount` | S–M each | Audit §2 component map; reduces god-component effect count |
| E | Add `SegBtn` `testId` prop so outcome buttons get stable selectors in the smoke test | S | One-line API extension + 3 callsites |
| F | Generate Supabase types (`supabase gen types typescript --project-id <id> > src/lib/database.types.ts`) | S | Unblocks dropping `: any` casts in `src/data/*.ts` |

**My recommendation if you only do ONE thing Sunday:** task A. Lifting `TradeDetailCard` is the highest-leverage safe extraction — it's a leaf in the JSX tree, the props it needs are well-defined, and the smoke test will catch any regression at the page level. After that, B can run in parallel PRs (one per HOME section) without re-blocking the file.

**Process for any of these:**
1. Branch from `main` (or just keep working on main since this is a solo project — your call)
2. Use the OneDrive-safe pattern: small atomic edits, run `wc -l src/Koda.tsx` after each big delete to catch truncation
3. After every component move: `npm run typecheck && npm test -- --run`
4. Before pushing: `npm run test:e2e` against `localhost:5173`
5. The auth E2E test runs automatically on push to `main` via GitHub Actions — that's your final canary

---

## 5 · Deferred (don't worry about for launch)

These are flagged in the audits but don't need to land before Monday. Schedule for the post-launch sprint.

- The 134 `: any` / `as any` cleanup across 24 files (`AUDIT.md` §3.4)
- `Trade` numeric-type refactor — form fields stored as `string`, forcing `parseFloat` everywhere (`AUDIT.md` §1.4)
- `TradingCircles` 29-prop drilling → `KodaContext` (`AUDIT.md` §3.5)
- Marketing landing site, founder story, comparison vs TradeZella/TraderSync/Tradervue (`FUNNEL_AUDIT.md` Phase C)
- Resend SDK install + welcome / payment-failed / win-back emails + weekly recap cron (`FUNNEL_AUDIT.md` §A10)
- Meta / TikTok / Google pixels + consent-gated CAPI (`FUNNEL_AUDIT.md` Phase C)
- Referral programme + shareable rank card OG-image endpoint (`FUNNEL_AUDIT.md` §A6)
- Dev-env cleanup: Prettier install, `noUncheckedIndexedAccess` migration, Sentry sourcemaps, OneDrive relocation (`DEV_ENV_AUDIT.md`)
- UX behavioural design: glanceable kill-switch across every screen, prop-firm setup in onboarding, design-system collapse of 23 font-sizes / 17 border-radii (`UX_AUDIT.md`)

---

## 6 · Quick reference

```bash
# Dev
npm run dev                  # http://localhost:5173
npm run typecheck            # tsc --noEmit (also runs on pre-commit)
npm run lint
npm test -- --run            # 171 unit tests, ~8s
npm run test:e2e             # 11 unauth Playwright tests, ~14s, auto-starts dev server

# Smoke an arbitrary URL (e.g. a Vercel preview)
BASE_URL=https://koda-pr-123.vercel.app npx playwright test

# Smoke prod with auth (matches CI config)
TEST_EMAIL=... TEST_PASSWORD=... BASE_URL=https://kodatrade.co.uk npx playwright test
```

**Stable selectors now in the app** (for future tests):
- Bottom nav: `[data-testid="nav-home"]` / `nav-log` / `nav-history` / `nav-stats` / `nav-circles`
- Auth: `[data-testid="auth-submit"]`
- Trade form: `[data-testid="trade-pair"]` / `trade-pnl-dollar` / `trade-save`

**OneDrive warning still in force.** `CLAUDE.md` documents this — large writes to `Koda.tsx` can be truncated. If you see suspicious 0-byte files, `wc -l` immediately.

---

## 7 · TL;DR for tomorrow morning

1. Run the Supabase migration (`§3.1`)
2. Fill in the UK Ltd details (`§3.3`) so Batch 2 can be done
3. Land Batch 2 (sign-up checkboxes + UK Ltd footer)
4. Optional: extract `<TradeDetailCard>` (`§4 task A`) if you have time
5. Pre-flight smoke (`§3.4`)
6. Monday: flip the beta password, ship 🚀
