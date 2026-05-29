# Kōda — Full User Lifecycle Funnel Audit
**Date:** 2026-05-29
**Auditor:** Claude (Opus 4.7) for parent orchestrator
**Repo root:** `C:\Users\Dylon\OneDrive\Desktop\tradr-fresh`
**Mode:** READ-ONLY. Part-A code audit only. No external API calls. Global-Circle creation (Phase 2) explicitly NOT executed.

---

## 1. Top 10 highest-impact gaps (ranked)

| # | Gap | Where | Why it matters |
|---|---|---|---|
| 1 | **No real landing page / marketing site.** `index.html` boots the React app; `KodaAuth.tsx::LandingPage` is just a hero + auth card behind the BetaGate. No comparison/competitor section, no testimonials, no founder story, no FAQ link, no pricing page, no "see it in action" demo target, no `/features`, `/pricing`, `/about` routes. Hard to drive cold traffic. | `src/KodaAuth.tsx:294-572`, `index.html` | Top-of-funnel conversion |
| 2 | **`robots.txt` and `sitemap.xml` reference the dead `tradrjournal.xyz` domain**, not the live `kodatrade.co.uk`. Google indexes nothing on the live host; canonical fights itself. | `public/robots.txt:4`, `public/sitemap.xml:3,7` | SEO completely broken |
| 3 | **No cookie-consent banner** anywhere in the codebase. `posthog-js` initialises with `autocapture: true` + `session_recording` + `capture_pageleave: true` BEFORE user interaction. UK PECR / GDPR violation. No Meta/TikTok/Google pixels with consent gating. | `src/lib/posthog.ts:10-23`, `src/main.tsx:21` | UK/EU legal exposure on day 1 |
| 4 | **No global Circle row exists in production-shape `circles` table.** A KV seed row exists in `shared_kv` (`koda_circle_KODA-GLOBAL`) but the v2 schema has `public.circles` and `public.circle_members` and they are NOT used by the live flow yet. Auto-join writes only to legacy `shared_kv`. Migration `20260529_seed_koda_global_circle.sql` only seeds the KV row; there is **no `is_system` / `undeletable` flag, no equivalent row in `public.circles`,** and **no backfill** of existing users into the Global. Users can `leaveCircle("KODA-GLOBAL")` and it deletes their member row with no guard. | `supabase/migrations/20260529_seed_koda_global_circle.sql`, `src/hooks/useCircles.ts:22, 391-413, 437-450` | Phase 2 of the launch plan won't work without a schema-level fix |
| 5 | **Email infrastructure is incomplete.** Resend SDK NOT installed (`package.json` has no `resend` dep — code talks to Resend by raw `fetch`). Templates that exist: **password reset** (`api/reset-password.ts`) and **weekly recap** + **receipt** (`api/lib/email.ts`). Missing: welcome email, account-verification (Supabase magic-link wraps this), trial-ending, payment-failed, win-back, deletion confirmation. **No `api/cron/weekly-recap.ts`** — the weekly-digest template is dead code; PaywallScreen advertises "Weekly Email Digest" as a Pro feature. **No SPF/DKIM/DMARC docs.** No marketing-vs-transactional separation. | `api/lib/email.ts`, `api/reset-password.ts`, `api/stripe-webhook.ts:201-206`, `package.json:20-34`, `src/PaywallScreen.tsx:18` | Trust signal failure + advertised feature missing |
| 6 | **Stripe BETA promo silently fails — user charged full price.** Client validates `BETA_26` (`PaywallScreen.tsx:11`) but server map (`api/stripe-checkout.ts:35-39`) keys `K0DA`/`FOUNDERS`/`BETA`. Server returns no error, just no discount. Also: receipt currency hard-coded as `$` not `£` (`stripe-webhook.ts:198`). No annual-billing path in `UpgradeModal` (always monthly). | `src/PaywallScreen.tsx:11`, `api/stripe-checkout.ts:35-39`, `api/stripe-webhook.ts:198`, `src/UpgradeModal.tsx` | Direct revenue loss + chargeback risk |
| 7 | **Auth UX gaps that will eat conversions.** (a) Email field is actually `username` — `@users.kodatrade.co.uk` synthetic email. Forgot-password assumes a separately-collected `recovery_email`; users who don't enter one are completely locked out (`reset-password.ts:84-87` returns `hasRecoveryEmail: false`). (b) Google/X/Apple OAuth buttons render but Google is not configured in Supabase per CLAUDE.md backlog. (c) No email-verification at all (synthetic email = no inbox to verify). (d) No bot protection (no CAPTCHA, no hCaptcha, no rate limit on sign-up; reset is rate-limited only). | `src/KodaAuth.tsx:44-138`, `api/reset-password.ts`, CLAUDE.md L470 | High lock-out + bot signup risk |
| 8 | **Marketing footer is missing UK Ltd disclosure.** `privacy.html` and `terms.html` describe the operator as "an independent developer (Dylon Nyland)" — no company number, no registered office, no VAT number. README and brief state Kōda is a UK Ltd. ICO registration not referenced. Required by UK Companies Act 2006 s.82. | `public/privacy.html:34`, `public/terms.html:34` | Companies House compliance |
| 9 | **No GDPR data-export endpoint.** Delete-account exists (`api/delete-account.ts`) and is solid. Settings → "Data export" only calls a client-side `exportCSV()` — no JSON-of-everything endpoint, no email-bundle. Marketing opt-in checkbox is missing entirely from sign-up (no separation from T&Cs, no unticked default). | `api/delete-account.ts`, `src/SettingsScreen.tsx:415`, `src/KodaAuth.tsx` (no consent checkboxes) | GDPR Art. 20 portability missing |
| 10 | **No tutorial/sample-data option, no contextual upgrade prompts.** Onboarding is 4 steps then dumps user on `log` view. `TourOverlay` exists but only fires once and is a click-through. No "Try with sample trades" path → first-session activation requires user to have real trades to log. No demo-mode. Upgrade prompts are generic `<ProLock>` with "Pro Feature" label — no context about what they get or why now. | `src/OnboardingFlow.tsx`, `src/Koda.tsx:1513-1553`, `src/components/ProLock.tsx`, `src/components/ProGate.tsx` | Activation cliff |

---

## 2. Part A findings — by section

### A1. Top of funnel + landing
| Item | Status | Evidence |
|---|---|---|
| Marketing landing page | **MISSING** — `index.html` boots SPA, only LandingPage shows after BetaGate to unauth visitors | `index.html`, `src/KodaAuth.tsx:294-572` |
| Above-the-fold clarity | OK — H1 "The operating system for serious traders", subtitle, pill announcing Tradovate+Rithmic | `KodaAuth.tsx:387-405` |
| Single primary CTA | **CONFLICT** — "Start free trial" pill **and** "See it in action" pill **and** an inline AuthForm card. Three CTAs compete. "Start free trial" pill is non-functional (no `onClick`). | `KodaAuth.tsx:407-429` |
| Trust signals | **MISSING** — no testimonials, no user count, no logos, no press, no security badges, no "X traders trust Kōda", no Trustpilot/G2 | `src/KodaAuth.tsx` |
| Comparison vs TradeZella/TraderSync/Tradervue | **MISSING** entirely (zero grep hits in `src/`) | grep |
| Founder story page | **MISSING** — no `/about`, `/founder`, `/story` route or HTML | `public/`, `src/` |
| OG tags / Twitter card / favicon / app icons | OK on `/` — `og:title`, `og:image=/og-image.svg`, `twitter:card=summary`, `favicon.svg`, `apple-touch-icon.png`, manifest icons all present. **Not present on the static HTML pages** (`faq.html`, `changelog.html`, `privacy.html`, `terms.html`) — they all share `<title>` only, no OG, no canonical, no favicon. | `index.html:6-31`, `public/*.html` |
| `robots.txt` | **WRONG DOMAIN** — `Sitemap: https://tradrjournal.xyz/sitemap.xml` | `public/robots.txt:4` |
| `sitemap.xml` | **WRONG DOMAIN** + only 2 URLs, both `tradrjournal.xyz`. Live URLs `/faq.html`, `/changelog.html`, `/privacy.html`, `/terms.html` not listed. No `lastmod`. | `public/sitemap.xml` |

### A2. Sign-up
| Item | Status | Evidence |
|---|---|---|
| Auth methods | username+password (synthetic email), Google OAuth (not configured), X/Apple OAuth (wired) | `src/KodaAuth.tsx:75-138, 253-255` |
| Form length | Short — username + password + optional recovery_email (signup only) | `src/KodaAuth.tsx:225-272` |
| Email verification | **NONE** — synthetic `@users.kodatrade.co.uk` email cannot be verified; `signUp` is called without `emailRedirectTo` | `src/KodaAuth.tsx:78-83` |
| Password reset | Exists via `/api/reset-password`; depends on user having entered a `recovery_email`. Falls back to Telegram bot ping to founder if none. **Users without recovery email = silently locked out.** Rate-limited 5/10min/IP. | `api/reset-password.ts:84-174` |
| Account deletion | **GOOD** — `/api/delete-account` cancels Stripe sub, wipes broker_connections, sync_events, trades, profiles, user_kv, shared_kv-by-owner, auth.users. JWT-authenticated. | `api/delete-account.ts` |
| T&Cs / Privacy linked at sign-up | **MISSING** — no checkbox, no inline link in the auth card | `src/KodaAuth.tsx:206-275` |
| Bot protection | **MISSING** — no CAPTCHA, no Turnstile/hCaptcha on sign-up. Reset-password has IP rate-limit only. | `src/KodaAuth.tsx`, `api/reset-password.ts:51-53` |

### A3. Onboarding + activation
| Item | Status | Evidence |
|---|---|---|
| First-run trace | KodaAuth → (BetaGate if set) → LandingPage → sign up → Koda.tsx detects `!profile.onboarded` → `OnboardingFlow` (welcome, instruments, strategy, ready) → `saveProfile` + auto-join Global → set view to `log` → `TourOverlay` | `src/KodaAuth.tsx:592-615`, `src/Koda.tsx:1513-1553`, `src/OnboardingFlow.tsx` |
| Time-to-value | 4 onboarding steps + paywall = roughly 90 seconds to a blank log screen; no first-trade prompt with sample data | `src/OnboardingFlow.tsx`, `Koda.tsx:1547` |
| Prop firm context captured early | **MISSING from onboarding** — collected later in Settings (`SettingsScreen.tsx:370-381`) | `src/OnboardingFlow.tsx`, `src/SettingsScreen.tsx` |
| First-trade prompt | Partial — TourOverlay first step says "Hit LOG to record any trade" but no prefilled or sample trade | `src/OnboardingFlow.tsx:39-58` |
| Tutorial system | `TourOverlay` 3-card walk-through, fires once (localStorage `koda_tour_done`) | `src/OnboardingFlow.tsx:61-103` |
| Sample-data option | **MISSING** | grep |
| BETA-680X flow | Not a code construct — assume = beta wall. BetaGate component exists; activated when `VITE_BETA_PASSWORD` is set. Unlock persists in `localStorage.tradr_beta_unlocked`. | `src/BetaGate.tsx`, `src/KodaAuth.tsx:609` |
| **Global Circle — persistence** | KV row `koda_circle_KODA-GLOBAL` seeded into `shared_kv` via migration; sentinel `owner_id = 00000000…` so no real user mutates it. **No equivalent row in v2 `public.circles`** (the v2 table from migration 002 is unused by the live circles code path). | `supabase/migrations/20260529_seed_koda_global_circle.sql`, `supabase/migrations/002_v2_schema_additive.sql:130-167` |
| **System-owned / undeletable flag** | **MISSING** — no `is_system`, no `undeletable`, no RLS clause that blocks owner from being deleted | `supabase/migrations/20260529_seed_koda_global_circle.sql` |
| **Stable identifier** | `KODA_GLOBAL_CODE = "KODA-GLOBAL"` constant referenced everywhere (slug, not name) — GOOD | `src/hooks/useCircles.ts:22` |
| **Auto-enrol code on every sign-up route** | **PARTIAL** — only fires from `OnboardingFlow.onComplete` (`Koda.tsx:1544`) and a backfill effect in `Koda.tsx:809-833`. **Does NOT run on the auth callback** for email/password, OAuth, or magic link directly — relies on the user reaching onboarding. If onboarding is skipped (e.g. existing user without `onboarded`), the backfill effect handles it, but it depends on `myCircles` having loaded. There's a race-guard ref. | `src/Koda.tsx:797-833, 1544-1546` |
| **Failure modes** | Silent — both call sites use `try/catch { /* silently ignore */ }`. Sign-up still succeeds. No telemetry on failure. | `src/Koda.tsx:1545, 832` |
| **Existing-user backfill count** | Cannot verify without DB access. The backfill effect runs client-side per user on next session. **Users who never log in again are NOT backfilled.** No SQL backfill script exists. | `src/Koda.tsx:797-833`, `supabase/migrations/*` |
| **RLS — leave but not delete** | **VULNERABILITY** — `leaveCircle("KODA-GLOBAL")` runs same path as any other, deleting the user's member row. No check against `KODA_GLOBAL_CODE`. The owner_id sentinel only protects the *circle row*, not membership rows. | `src/hooks/useCircles.ts:437-450` |
| **Membership count surfaced as social proof** | **MISSING** anywhere visible to unauth visitors | grep |

### A4. Engagement + retention
| Item | Status | Evidence |
|---|---|---|
| Push notification opt-in | "Enable" button in Settings; calls `navigator.serviceWorker.pushManager.subscribe` → `POST /api/push?action=subscribe` with VAPID keys. **No proactive prompt** — buried in Settings. | `src/SettingsScreen.tsx:388-413`, `api/push.ts` |
| Push triggers | `/api/push?action=send` exists but is **never called** anywhere — no cron, no event hook, no Stripe webhook trigger | `api/push.ts:40-58`, grep |
| Weekly email digest | Template `weeklyRecapHtml` exists in `api/lib/email.ts:21-56` BUT **no cron sends it.** Listed as Pro feature in PaywallScreen. **Dead promise.** | `api/lib/email.ts:21-56`, `src/PaywallScreen.tsx:18`, `vercel.json:5-10` (only cron is `complete-challenges`) |
| Streaks | YES — `streakBanner` fires at 3/7/14/30/100-day win streaks, deduped in `koda_streak_milestones` KV key | `src/Koda.tsx:265-268, 962-973, 1700-1714` |
| Daily check-in | **MISSING** | grep |
| Discipline score on home | Exists in Psychology stats tab (Pro-gated) | `src/Koda.tsx:3486-3624` |
| Dormant-user detection | **MISSING** | grep |
| Cohort tracking events | PostHog events captured: `trade_logged`, `trade_edited`, `csv_imported`, `calculator_opened`. **No sign-up event**, no `onboarding_completed`, no `paywall_viewed`, no `checkout_started`, no `subscription_activated`. `phIdentify` runs on session load with handle/plan/prior_tool/UTMs. | `src/Koda.tsx:577-583, 841, 950, 3770, 3974, 4144` |

### A5. Monetization
| Item | Status | Evidence |
|---|---|---|
| Free vs Pro gating — Pro-gated features | AI Insights, Charts/Advanced Analysis, Psychology Stats, Session Heatmaps, MAE/MFE Analysis (all wrapped in `<ProLock>`), Export CSV (behind `paywall` flag), unlimited Circles (free = 1 non-Global). Pro detection: `profile.plan === "pro" || "elite"`. | `src/Koda.tsx:248, 2507-3665`, `src/SettingsScreen.tsx:415`, `src/hooks/useCircles.ts:311, 358` |
| Soft vs hard paywall | Soft — `<ProLock>` blurs underlying content with overlay CTA. Hard mandatory upgrade can be triggered (`mandatoryUpgrade` state) but not seen on a default code path. | `src/components/ProLock.tsx`, `src/Koda.tsx:344, 4188` |
| Pricing page (monthly/annual/lifetime) | Inline `PaywallScreen` only — £24.99/mo or £199/yr. **No standalone `/pricing` HTML page**. **No lifetime SKU** in code (promo codes `K0DA`/`FOUNDERS`/`BETA_26` apply 100% discount but still recurring). | `src/PaywallScreen.tsx:200-211`, `api/stripe-checkout.ts:35-39` |
| Stripe checkout + webhooks | Solid — `api/stripe-checkout.ts` JWT-verifies caller, creates customer, applies promo, returns session URL. Webhook handles `checkout.session.completed`, `customer.subscription.updated`, `customer.subscription.deleted`, `invoice.paid`, `invoice.payment_failed`. Writes plan to BOTH user_kv profile AND auth `app_metadata` (JWT claim). | `api/stripe-checkout.ts`, `api/stripe-webhook.ts` |
| Failed payment recovery | **NONE** — `invoice.payment_failed` only logs a warning, no email, no plan-downgrade-warning | `api/stripe-webhook.ts:209-212` |
| Trial mechanics | **MISSING** — `subscription_data` has no `trial_period_days`. Landing says "Start free trial" but checkout has no trial. | `api/stripe-checkout.ts:170-180`, `src/KodaAuth.tsx:414` |
| Upgrade prompts | Generic `<ProLock>` "Pro feature" overlay everywhere | `src/components/ProLock.tsx` |
| Refund handling | **No refund webhook handling**, no refund email, no in-app refund request UI. Terms state "no refunds for partial months". | `api/stripe-webhook.ts`, `public/terms.html:64` |

### A6. Referral + virality
| Item | Status | Evidence |
|---|---|---|
| Circle invite flow | Users share `code` manually (8-char code from `createCircle`) — no shareable URL, no invite link | `src/hooks/useCircles.ts:317-339` |
| Referral programme | **MISSING** entirely | grep |
| Public leaderboard / shareable rank card | Public profile pages exist via `koda_profile_pub_*` KV keys; ProfileModal shows stats. No standalone public leaderboard. | `src/Koda.tsx:855-862`, `src/ProfileModal.tsx` |
| Generated share images | `WeeklyReportCard.tsx` exists — in-app card with "Share/Download" — but no server-side OG-image generator, no /api/share-image endpoint | `src/WeeklyReportCard.tsx`, grep |

### A7. Support + trust
| Item | Status | Evidence |
|---|---|---|
| Help centre / FAQ | `public/faq.html` — 8 questions only, no search, no categories | `public/faq.html` |
| Contact method | `mailto:support@kodatrade.co.uk` in privacy/faq + Telegram feedback bot via in-app modal → `/api/feedback` | `public/privacy.html:34`, `api/feedback.ts` |
| Privacy / T&Cs / Cookie Policy current with UK Ltd | **NO** — both describe operator as "independent developer", not UK Ltd. **No Cookie Policy page exists.** Last-updated 5 May 2026. | `public/privacy.html:34`, `public/terms.html:34`, `public/*.html` |
| Refund policy | Terms say "no refunds for partial months" — no UK 14-day cooling-off statement, which is required for digital goods unless explicitly waived at checkout | `public/terms.html:64` |
| Status page | **MISSING** — no statuspage, no /status, no uptime indicator | grep |

### A8. Analytics
| Item | Status | Evidence |
|---|---|---|
| Tool installed | PostHog (`posthog-js@1.240.6`), Sentry (`@sentry/react@8`) — both no-op if env vars unset | `package.json:21,23`, `src/lib/posthog.ts`, `src/lib/sentry.ts` |
| Event tracking grouped by AARRR | **WEAK** — only `trade_logged`, `trade_edited`, `csv_imported`, `calculator_opened` captured. Activation/Revenue/Referral events absent. Autocapture catches clicks but not labelled. | `src/Koda.tsx` (5 phCapture sites only) |
| `identify()` on sign-up/login | YES — `phIdentify(p.uid, { handle, plan, prior_tool, almost_stopped_reason, ...utm })` runs in `loadAll` | `src/Koda.tsx:577-583` |
| Server-side events from Stripe webhook | **MISSING** — webhook does not send `subscription_started` / `subscription_cancelled` to PostHog | `api/stripe-webhook.ts` |
| UTM capture + persistence | YES — `captureUtm()` in `main.tsx:24`, persists to sessionStorage, attached to identify | `src/lib/utm.ts`, `src/main.tsx:24` |
| Meta / TikTok / Google pixels + CAPI | **MISSING** entirely | grep |

### A9. Compliance
| Item | Status | Evidence |
|---|---|---|
| Cookie consent banner | **MISSING** — PostHog fires immediately on app boot with autocapture + session_recording | `src/main.tsx:21`, `src/lib/posthog.ts:10-23` |
| GDPR export endpoint | **MISSING** — only client-side CSV/JSON export from Settings | `src/SettingsScreen.tsx:415`, `api/` |
| GDPR delete endpoint | YES — `/api/delete-account` | `api/delete-account.ts` |
| Marketing opt-in separate, unticked | **MISSING** — no marketing checkbox at sign-up | `src/KodaAuth.tsx` |
| Unsubscribe in marketing emails | **BROKEN** — weekly recap template has `Unsubscribe` link pointing to homepage, not an unsubscribe handler | `api/lib/email.ts:52` |
| Footer company details (UK Companies Act s.82) | **MISSING** — company number, registered office, VAT not shown anywhere | `public/*.html`, `src/KodaAuth.tsx` (footer) |

### A10. Email infrastructure
| Item | Status | Evidence |
|---|---|---|
| Resend SDK installed | **NO** — `package.json` has no `resend` dependency; code uses raw `fetch` to `api.resend.com/emails` | `package.json:20-34`, `api/lib/email.ts:9-13` |
| Templates present | Welcome — **MISSING**; Email-verification — **N/A** (synthetic email auth bypasses); Password reset — **YES** (`reset-password.ts`); Weekly digest — **TEMPLATE ONLY, NO SENDER**; Trial-ending — **MISSING**; Payment-failed — **MISSING**; Win-back — **MISSING**; Deletion confirmation — **MISSING**; Receipt — **YES** (`stripe-webhook` invoice.paid) | `api/lib/email.ts`, `api/reset-password.ts`, `api/stripe-webhook.ts:175-207` |
| Transactional vs marketing separation | **NONE** — single `from: "Kōda <noreply@kodatrade.co.uk>"`. No segregated marketing domain. | `api/lib/email.ts:5`, `api/reset-password.ts:122` |
| SPF / DKIM / DMARC docs/code | **MISSING** — no doc or `dns-records.md` | grep |

### A11. SEO + technical foundations
| Item | Status | Evidence |
|---|---|---|
| SSR / SSG for marketing | **NO** — Vite SPA, no prerender, no Next.js. Landing only renders client-side after JS boots. | `vite.config.ts`, `index.html:34-36` |
| Unique meta titles per route | **NO** — only `index.html` has tags; static pages (faq, changelog, privacy, terms) have basic `<title>` only, no OG, no canonical | `public/*.html` |
| Structured data (JSON-LD) | **MISSING** — zero `application/ld+json` blocks | grep |
| Bundle size / lazy-loading | `Koda.tsx` is ~4300 lines, single bundle; no `React.lazy` import seen | grep |
| Canonical URLs | Only `index.html` has `<link rel="canonical" href="https://kodatrade.co.uk/">`. Static pages don't. | `index.html:31`, `public/*.html` |
| CSP / security headers | GOOD — `vercel.json` ships full CSP, X-Frame-Options DENY, Permissions-Policy. PostHog hosts whitelisted. | `vercel.json:11-36` |

---

## 3. Part B — Checklist for Dylon

Mark each: **Done / Not done / Unsure**.

### Paid acquisition
- [ ] Meta Ads Manager account created and billing set
- [ ] Meta Pixel installed via Tag Manager (currently no pixel in code)
- [ ] Meta CAPI server-to-server events (`InitiateCheckout`, `Subscribe`)
- [ ] TikTok Ads account and Pixel
- [ ] TikTok Events API server-side
- [ ] Google Ads account + Google tag (gtag) + Enhanced Conversions
- [ ] UTM naming convention documented (e.g. `utm_source/utm_medium/utm_campaign/utm_content`)
- [ ] At least 5 creative variants per network ready to test
- [ ] Daily budget caps configured per platform

### Organic + content
- [ ] @dylontrades CTA in bio (link in bio + pinned post pointing to kodatrade.co.uk)
- [ ] Content arc planned (e.g. "From £5k blown to first prop payout" thread series)
- [ ] SEO keyword list: "trading journal for futures", "prop firm tracker UK", "TopstepX journal", "Tradovate auto-import", "trading discipline app"
- [ ] Pillar blog post or YouTube video for each keyword
- [ ] Discord / X community presence with regular posts
- [ ] Affiliate outreach list (futures YouTubers, prop firm review channels)
- [ ] Reddit AMAs scheduled in r/Daytrading, r/FuturesTrading, r/propfirms

### Email marketing
- [ ] Resend DNS records added (SPF, DKIM, return-path, DMARC) for kodatrade.co.uk
- [ ] Resend domain status = "verified"
- [ ] Welcome email series (day 0, day 1, day 3, day 7)
- [ ] Win-back sequence for users dormant 14+ days
- [ ] Broadcast sender configured (separate from `noreply@`, e.g. `hi@kodatrade.co.uk`)
- [ ] List-growth mechanism on marketing site (newsletter signup, lead magnet PDF)
- [ ] Marketing list managed in Resend Audiences with opt-in tagging

### Analytics dashboards
- [ ] North-star metric chosen and tracked (suggest: weekly active loggers)
- [ ] Acquisition dashboard (sources, costs, CPA)
- [ ] Activation dashboard (sign-up → first trade %, time-to-first-trade)
- [ ] Retention cohort tables (D1/D7/D30 by sign-up week)
- [ ] Revenue (MRR, churn, LTV, ARPU) — PostHog Cohorts + Stripe Sigma
- [ ] Referral (invite sends, accepted invites, referred LTV)

### Trust + social proof
- [ ] Trustpilot business profile claimed, first 5 reviews requested from beta users
- [ ] G2 / Product Hunt scheduled
- [ ] 3-5 testimonial videos / quote cards in hand
- [ ] Press kit (logo, screenshots, founder photo, one-pager) on `/press`
- [ ] Beta-tester count / "X traders logged Y trades this week" auto-populated on landing

### Customer support
- [ ] Inbox SLA committed (e.g. 24h business days) and posted in FAQ
- [ ] Help docs structured (Categories: Getting Started, Sync, Billing, Circles)
- [ ] Discord channel + role for support tickets
- [ ] Status page (`status.kodatrade.co.uk`) live

### Legal + ops
- [ ] Privacy + T&Cs lawyer-reviewed for UK Ltd structure
- [ ] Footer updated with UK Ltd company number + registered office (Companies Act s.82)
- [ ] ICO registration paid + reference in privacy policy
- [ ] Public-liability + cyber-liability insurance quoted
- [ ] P&L screenshot disclaimer in user agreement ("trades shown may be selected by users; not indicative of typical results")
- [ ] Cookie Policy page drafted

### Revenue ops
- [ ] Stripe Tax enabled for UK/EU/US
- [ ] Annual plan SKU live in Stripe with `STRIPE_PRICE_ID_ANNUAL`
- [ ] Lifetime deal price calculated (suggest LTV × discount factor) + Stripe one-time SKU
- [ ] Failed payment flow tested end-to-end (test card 4000 0000 0000 0341)
- [ ] Cancellation reason survey (in Stripe Customer Portal or in-app)
- [ ] VAT rules verified (digital goods, place of supply, MOSS / UK-only)

---

## 4. Suggested sequencing

### Phase A — Pre-launch blockers (must fix before any paid traffic)
1. **Fix `robots.txt` + `sitemap.xml`** to point at `kodatrade.co.uk` and add `/faq.html`, `/changelog.html`, `/privacy.html`, `/terms.html`. (S)
2. **Add cookie-consent banner** + gate PostHog autocapture + session_recording behind consent (defer `initPostHog`). (M)
3. **Update privacy + terms** with UK Ltd details (company number, registered office, ICO ref) and put company line in landing footer + every static HTML page. (S, legal review required)
4. **Fix `BETA_26` promo bug** (server `PROMO_CODE_MAP`) + Stripe receipt currency `£`. (S)
5. **Run Phase 2** — Create `public.circles` row for Global + add `is_system` column + RLS DELETE-on-self block when `circle_code = 'KODA-GLOBAL'`; add SQL backfill `INSERT INTO circle_members SELECT id, 'KODA-GLOBAL' FROM auth.users WHERE NOT EXISTS …`. (M) **NOT EXECUTED IN THIS AUDIT.**
6. **Add T&Cs + Privacy + marketing-opt-in checkboxes** to sign-up form. (S)
7. **Guard `leaveCircle("KODA-GLOBAL")`** — refuse with toast "You can't leave the Kōda community." (S)
8. **Auth fixes** — `<input type="password">` on the password floating input; show a sensible error for users with no recovery email at password-reset time; remove or configure Google OAuth button. (S)
9. **Stripe trial vs no-trial** — either remove "Start free trial" copy from landing or add `trial_period_days` to checkout session. (S)

### Phase B — Launch-week essentials
10. **Build a real marketing landing site** (Next.js subdomain or extract to static pages): hero, social proof bar, problem/solution, comparison table vs TradeZella/TraderSync/Tradervue, founder story, pricing page, FAQ, footer. (L)
11. **Welcome email** on sign-up via Resend (install SDK as `resend` dep). Include "what to expect" and link to Sync tab. (S)
12. **Weekly recap cron** — wire `weeklyRecapHtml` to a Vercel Cron Monday 0700 UTC; needs Pro plan + correct unsubscribe handler. (M)
13. **`/api/email-unsubscribe?token=…`** signed-token endpoint that flips `profile.weeklyEmail = false`. (M)
14. **Payment-failed email** in `invoice.payment_failed` handler. (S)
15. **Onboarding step 0** — prop-firm questions (firm name, account size, profit target, daily loss limit) so Eval dashboard is populated immediately. (M)
16. **Tutorial: "Try with sample data"** path — seeds 10 demo trades + walks user through stats. (M)
17. **AARRR event coverage in PostHog** — `signed_up`, `onboarding_completed`, `paywall_viewed`, `checkout_started`, `subscription_activated`, `subscription_cancelled` (server-side from webhook). (M)
18. **Server-side Stripe → PostHog** events using `posthog-node`. (S)
19. **Membership count surfaced** — "X traders in Kōda" on landing, pulled from `select count(*) from circle_members where circle_code='KODA-GLOBAL'`. (S)
20. **Push-notification trigger plumbing** — connect circle activity / streak milestones to `/api/push?action=send`. (M)
21. **Footer with UK Ltd disclosure** on every page including the auth gate. (S)
22. **Cookie policy page** + add a `Cookies` link to footer. (S)
23. **Annual plan visibility** in `UpgradeModal` (currently monthly-only). (S)

### Phase C — Post-launch growth foundations
24. **SSG/SSR marketing site** (Astro or Next.js) — current SPA-only hurts SEO. (L)
25. **JSON-LD** (`Product`, `Organization`, `FAQPage`, `Review`) on landing + FAQ. (S)
26. **Meta + TikTok + Google pixels with consent gating** + CAPI server-side. (M each)
27. **Founder story page** + comparison page vs TradeZella/TraderSync/Tradervue + pricing page. (M each)
28. **Referral system** — `users.referral_code`, `users.referred_by`, Stripe 1-month-free credit logic. (L)
29. **Shareable rank card** — `/api/share-image?uid=…&period=week` returning OG-image. (M)
30. **Win-back email** at day 14/30 dormant detected by lack of `trade_logged` events. (M)
31. **Trustpilot integration** + on-site review widget. (S)
32. **Status page** + uptime monitor. (S)
33. **GDPR `/api/export-data`** endpoint returning ZIP of all user_kv + trades + circles. (M)
34. **OneTrust-style preference centre** for granular cookie / email opts. (M)
35. **Branch protection** + Playwright smoke test (sign-up → log trade → join circle) on every preview deploy. (M)

---

## 5. Questions for Dylon

1. **Global Circle Phase 2** — schema choice: do you want the Global stored only in `shared_kv` (current KV path, easier) or migrated to `public.circles` + `public.circle_members` (v2 schema, requires flipping `newCircles` flag and a backfill SQL)? Phase 2 is on hold per the audit brief.
2. **Authentication direction** — are you keeping the synthetic-email username flow (`@users.kodatrade.co.uk`) or moving to real-email + email verification? The current scheme breaks password reset for anyone without a recovery email and prevents marketing emails entirely.
3. **UK Ltd registration** — what is the company name, company number, registered office, and VAT number? Needed for footer disclosures, Stripe Tax, and privacy/terms. Also: ICO data-protection registration reference?
4. **Trial mechanics** — landing says "Start free trial" but Stripe checkout has no `trial_period_days`. Do you want 7-day trial, 14-day trial, or remove the copy?
5. **Pricing** — Terms still say "£5.99/month" (line 63) while PaywallScreen shows £24.99. Which is the live SKU? Is there a lifetime deal? Annual price live in Stripe?
6. **Email sender** — `noreply@kodatrade.co.uk` is used for everything. Do you want to split transactional (`noreply@`) vs marketing (`hi@`)? Resend DKIM/SPF/DMARC live?
7. **Push notifications** — VAPID keys configured? Which triggers do you want first: circle activity, streak milestones, weekly recap, daily check-in?
8. **PostHog cohort plan** — EU host (`eu.i.posthog.com`) per CLAUDE.md; want me to wire AARRR events and define cohorts (activated, engaged, paying, churned)?
9. **OAuth provider state** — Google button is shown on the landing card but not configured in Supabase per backlog. Remove the button or configure? Same Q for Apple + X.
10. **Refund policy under UK distance-selling rules** — current terms refuse partial-month refunds; UK Consumer Contracts Regulations require either a 14-day cooling-off OR explicit waiver at point of sale. Which path?
11. **Marketing analytics** — Meta / TikTok / Google ads planned? If yes, do you have pixel accounts ready and want CAPI/Events-API server-side?
12. **Backfill scope** — Should existing users who never log in again still be auto-joined to Kōda Global (requires SQL backfill executed in Supabase) or only on next sign-in (client-side backfill effect already in place)?

---

**End of audit.** All findings are read-only observations; no code, schemas, or external systems were modified.
