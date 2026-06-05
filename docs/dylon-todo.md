# Dylon's running TODO — end-of-session state

> Sprint state at the end of the 2026-06-05 push. **183 / 191 in-scope items shipped (95.8%)**.
> Eight items left, listed below by reason. None are blockers for the Friday merge.

---

## 🟠 Decisions only you can make (5 items)

Each unlocks 1 cat12 email or 1 cat03/04/05 feature.

- [ ] **Account deletion: immediate or 14-day grace?** Current `api/account?action=delete` is immediate. The cat12 deletion email is designed for a grace-period flow. Pick one. → unlocks: `accountDeletionEmailHtml` + grace-period UI.
- [ ] **Beta-unlock email capture: yes or no?** Current `BetaGate` validates a code without capturing an email. To send the `betaUnlockEmailHtml` we need to also collect their address at the gate. Worth the friction? → unlocks: `betaUnlockEmailHtml`.
- [ ] **Email verification: override or keep Supabase default?** Override means custom SMTP / Supabase webhook-hook so the branded `emailVerificationHtml` is used. Default = ship as-is. → unlocks: cat12 P0 row "Email verification".
- [ ] **Waitlist promotion mechanism: add or defer?** Without a way to "remove from waitlist" (or "mark promoted"), position never changes and the cat12 `waitlistPositionEmailHtml` cron has nothing to send. Minimal version = a `removed_at` column + admin endpoint. → unlocks: weekly waitlist-movement cron.

---

## 🔵 Small features you (or I) could build (4 items)

These are unblocked. Listed in increasing effort. Tell me which to do, or do them yourself.

- [ ] **@mention autocomplete in Circle chat composer** — small (~150 LOC). Detect `@` in composer, query circle members, show floating dropdown, insert on Enter. Touches `TradingCircles.tsx` composer.
- [ ] **Emoji reactions picker (full grid)** — small (~100 LOC). Existing chip-row is fixed-set; the picker is a sheet with the 64 standard reaction emoji. Touches `TradingCircles.tsx` reactions.
- [ ] **Mutual-friends visualization** — medium (~150 LOC). On a public profile, compute shared circles + intersecting follows, display as "You both follow @x, @y · You're both in {circle}". Touches `FriendsFeed.tsx` profile view.
- [ ] **Attach trade to existing idea** — medium (~120 LOC). In trade-actions sheet, add an "Attach to idea" row that opens a picker of recent ideas. Touches `Koda.tsx` trade-actions + `data/ideas.ts`.

---

## 🔴 Verify-before-merge — do in one focused block before Fri 2026-06-12

### Env + secrets
- [ ] **Confirm `RESEND_API_KEY` is set in Vercel preview + prod env**. `npx vercel env ls`. All 7 wired emails fail silently without it.
- [ ] **Confirm `ADMIN_EMAILS` is set in Vercel** (comma-separated allowlist). Required for the new `/api/admin/broadcast` endpoint.

### End-to-end email tests (preview deployment)
- [ ] **Password reset** → forgot-password flow on test account with `recovery_email` set.
- [ ] **Welcome** → `POST /api/account?action=welcome` with a Bearer JWT.
- [ ] **Payment failed** → `stripe trigger invoice.payment_failed` against the preview webhook.
- [ ] **Subscription cancelled** → `stripe trigger customer.subscription.deleted`.
- [ ] **Broker sync-error** → corrupt a refresh token in DB, let cron run.
- [ ] **Streak milestones** → `curl -H "Authorization: Bearer $CRON_SECRET" $PREVIEW/api/cron?job=streak-milestones` on a user with 7+ consecutive trading days.
- [ ] **Monthly summary** → same pattern but `?job=monthly-summary`. Mid-month run aggregates prior-month data.
- [ ] **Announcement broadcast** → `POST /api/admin/broadcast` with `dryRun:true` first to see the recipient count.

### PWA cat19 verification
- [ ] **Install banner** — on Android Chrome, leave the app open 60s without dismissing → confirm the install banner appears with working Install button.
- [ ] **App shortcuts** — install the PWA, long-press the icon → confirm 4 shortcuts open the right screen via `?screen=` router.
- [ ] **Badging** — set draftCount > 0 → check OS shelf badge mirrors it (Chromium PWAs only).
- [ ] **File handlers** — on a Chromium PWA, right-click a `.csv` file → "Open with Kōda" should land on `?screen=import` with the CSV form open.
- [ ] **Share target** — share a screenshot from any Android app → Kōda → should land on `?screen=share-receive` with the screenshot previewed and an "Attach to a new trade" CTA that fills the log form.

### Client wiring (one-line task)
- [ ] **Call `/api/account?action=welcome` from onboarding completion**. Single `fetch`, idempotent. Find the onboarding-done point in `OnboardingFlow.tsx` or `BetaWelcome.tsx`.

### Marketing pages
- [ ] **Smoke-check the 4 new public pages** — about.html / blog.html / contact.html / press.html. Visual review + link audit.

### Brand assets
- [ ] **Export the SVG sources to PNG** when ready to ship marketing. `npx svgexport` commands listed inline in each SVG and in `docs/brand-assets.md`.

---

## 🟡 Housekeeping — whenever

- [ ] **Commit `.env.example`** changes (was bundled into commit `ee0bc37` along with my marketing-pages commit — see note below).
- [ ] **Commit `api/cron.ts` `timingSafeEqual`** security fix as its own commit. Still uncommitted in the working tree.

---

## ⚠️ Commit bundling note (heads-up for the diff review)

Commit `ee0bc37 cat10: Marketing pages — 4 rows shipped` ended up bundling
more than the marketing pages. The full list of files actually changed in
that commit:

```
.env.example                                     (your earlier work)
api/admin/[action].ts                            (your founder-dashboard admin endpoint)
docs/design-coverage.md                          (cat10 tick updates)
docs/koda-dashboard-setup.md                     (your dashboard setup doc)
public/about.html                                (my cat10)
public/blog.html                                 (my cat10)
public/contact.html                              (my cat10)
public/press.html                                (my cat10)
src/Koda.tsx                                     (small misc edit, ~14 lines)
src/admin/FounderDashboard.tsx                   (your founder dashboard UI)
supabase/migrations/20260605_founder_metrics.sql (your get_founder_metrics RPC)
```

I think the lint-staged hook picked up uncommitted modifications when I
staged my cat10 files. Net effect: your founder-dashboard work landed
inside a commit titled "cat10: Marketing pages". The work is in the repo,
just under a misleading commit title. You can leave it or split with
`git rebase -i` before pushing.

---

## 📊 Progress

- **Shipped this session**: 50 rows (+50). Started at 133 / 191, finished at **183 / 191 (95.8%)**.
- **Branch**: `redesign/v2` (15 commits ahead of origin)
- **Merge to main**: Fri 2026-06-12 (one week away)
- **Per-cat completion** — see `docs/coverage.html` for the visual board:
  - Fully shipped ✓: cat01, cat02, cat06, cat07, cat09, cat10, cat11, cat13, cat14, cat15, cat16, cat17, cat18, cat19, cat20
  - 5 of 14: cat12 (5 blocked on decisions)
  - 11–12 of 13: cat03 / cat04 / cat05 / cat08 (single trailing 🟡 each)

---

## Log — what landed this session

- `b4c14fd` — cat07 System states (10 rows)
- `99e1920` — cat12 first 5 email wirings
- `3199ed3` — cat12 +2 crons (streak + monthly)
- `01328de` — cat15 microcopy library (8 rows)
- `ad71265` — cat19 PWA (5 rows)
- `7312a2f` — cat18 Desktop (6 rows)
- `fe86633` — cat17 Mobile (6 rows)
- `139f715` — cat16 A11y (4 rows)
- `fb28be4` — cat13 States (7 rows)
- `ee0bc37` — cat10 Marketing + (bundled founder dashboard work, see note)
- `a0e6ff3` — cat01-08 drift ticks (5 rows)
- `beca7d8` — cat12 admin broadcast endpoint (1 row)
- (final commit) — coverage.html + dylon-todo.md final update
