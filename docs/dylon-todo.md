# Dylon's running TODO

> Maintained by Claude across the redesign sprint. Three sections:
> **decisions** (block downstream work), **verify-before-merge** (do in one
> focused block before Friday 2026-06-12), and **housekeeping** (whenever).
>
> Each item lists *why it can't be done by Claude* in italics.

---

## 🟠 Decisions — answer when you have a minute (each unblocks more code)

- [ ] **Account deletion: immediate or 14-day grace?** _Backend is currently immediate; cat12 deletion email is designed for grace-period. Pick a model so I can wire to match._ → unblocks: `accountDeletionEmailHtml` shipping + grace-period UI flow.
- [ ] **Beta-unlock email capture: yes or no?** _Current beta gate just validates a code. To send the cat12 beta-unlock email we need to also capture the user's email at the gate._ → unblocks: `betaUnlockEmailHtml` shipping + beta gate UX change.
- [ ] **Email verification: override or keep Supabase default?** _Override means custom SMTP / Supabase webhook-hook setup so the branded `emailVerificationHtml` is used. Default is what ships today._ → unblocks: cat12 P0 row "Email verification".

---

## 🔴 Verify-before-merge — batch into one block before Fri 2026-06-12

### Env + secrets
- [ ] **Confirm `RESEND_API_KEY` is set in Vercel preview + prod env**. Run `npx vercel env ls`. All 5 wired emails fail silently without it.

### End-to-end email tests (preview deployment)
- [ ] **Password reset** → trigger `Forgot password?` on a test account that has a `recovery_email` set in user metadata. Check the branded template lands.
- [ ] **Welcome** → call `POST /api/account?action=welcome` with a Bearer JWT. Confirm one-time send (re-call should return `{ ok: true, alreadySent: true }`).
- [ ] **Payment failed** → `stripe trigger invoice.payment_failed` against the preview webhook URL. Confirm email arrives with correct card last4 + retry date.
- [ ] **Subscription cancelled** → `stripe trigger customer.subscription.deleted`. Confirm period-end date renders.
- [ ] **Broker sync-error** → on a test Tradovate connection, manually corrupt the encrypted refresh token in the DB → let cron run → confirm one email per error transition (not per cron tick).

### Client wiring (one-line tasks)
- [ ] **Call `/api/account?action=welcome` from onboarding completion handler** — single `fetch` call, idempotent, harmless if duplicated. Find the onboarding-done point in `src/OnboardingFlow.tsx` or `src/BetaWelcome.tsx`.

### New cron jobs to test (just shipped)
- [ ] **Streak milestones cron** (`/api/cron?job=streak-milestones`, daily 08:00 UTC) — manually trigger with `curl -H "Authorization: Bearer $CRON_SECRET" https://<preview>/api/cron?job=streak-milestones`. Verify it returns `{ ok: true, sent: N }`. Then check a test user with 7+ consecutive trading days got the email. Re-run should report `skipped` for that user (idempotency via koda_milestone_<N> kv).
- [ ] **Monthly summary cron** (`/api/cron?job=monthly-summary`, 1st of month 09:00 UTC) — trigger manually mid-month to verify. Should report 0 sends until June 1 fires for real (since prior-month aggregation will be May, which started before the redesign branch). Re-run should idempotent-skip via koda_monthly_email_<YYYY-MM> kv.

---

## 🟡 Housekeeping — whenever

- [ ] **Commit `.env.example`** changes (currently uncommitted in working tree). Decide what was added and write a commit message.
- [ ] **Commit `api/cron.ts` `timingSafeEqual` security fix** as its own commit. Small + good; just been sitting in the working tree.

---

## 📊 Progress at a glance

> Updated by Claude as new items get wired. See `docs/coverage.html` for the
> visual dashboard.

- **Last session boundary**: 2026-06-05 EOD
- **Shipped**: 133 / 191 in-scope (69.6%)
- **In-progress this sprint**: cat12 (9 of 14 rows shipped; 5 remaining blocked)
- **Remaining cat12 blockers**: email-verify SMTP override · grace-period delete · beta-unlock email capture · admin broadcast endpoint · waitlist removal/promotion flow
- **Next targets** (subject to your steer): cat15 microcopy · cat13 states · cat19 PWA

---

## Log — what's landed since the sprint started

- **2026-06-05** — cat07 System (10 rows). SystemProvider extended with SlowConnection / OptimisticRollback / RateLimited / Error40x-50x / Maintenance, all triggerable via window events. Commit `b4c14fd`.
- **2026-06-05** — cat12 Email templates (5 of 14 rows shipped). Wired `passwordReset`, `paymentFailed`, `welcome`, `subscriptionCancelled`, `brokerSyncError` into live API call sites. Commit `99e1920`. 7 rows annotated as designed-only with the specific infra each needs.
- **2026-06-05** — cat12 +2 (now 9 of 14). `streak-milestones` daily cron and `monthly-summary` 1st-of-month cron added to api/cron.ts + vercel.json. Both idempotent via user_kv flags. Waitlist-position-update deferred (logged as blocked on waitlist promotion/removal flow).
