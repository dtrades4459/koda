# Phase 1 — P0 Runbook

> Day-by-day walkthrough for the 12 launch-blockers. **Open this at the start of every Block 1.**

**Window:** Mon 2026-06-08 → Fri 2026-06-19 (10 working days)
**Branch:** `redesign/v2`
**Tracker:** `docs/design-coverage.md` — tick boxes as each item ships.

---

## Pre-flight (do once, before Day 1)

**Day 0 / Sunday evening (1h, during Week Ahead Planning calendar block):**

1. Confirm handoff bundle path. Default: `C:\Users\Dylon\Downloads\KodaOS-handoff-extracted\kodaos\project\`. If moved, update this doc + `implementation-plan.md`.
2. Open `existing-handoff/redesign/README.md` and skim §3.2 (the seven moves). Memory refresh.
3. Open `koda-designs/koda-kit.jsx`. Compare its `THEME` constants to `src/theme.ts` `DARK` / `LIGHT`. Note any token deltas in a one-liner — resolve on Day 1.
4. Confirm `redesign/v2` branch is checked out: `git status` → on `redesign/v2`.
5. Sanity: `npm run typecheck && npm run build` clean from last Friday's merge.

---

## Week 1 — Auth + email foundations (Days 1–5)

### Day 1 — Mon 2026-06-08 · Sign-up form

**Block 1 (08:30–10:30) — P0 #1: Sign-up form**

- Design ref: `koda-designs/cat01-auth.jsx` → `SignUp` + `SignUpError` components (top of file, ~lines 37–55)
- Target: `src/KodaAuth.tsx` — the `AuthForm` component (~line 47 onward)
- Tokens: port `THEME.dark` / `THEME.light` from `koda-kit.jsx` into `src/theme.ts` (deltas only — don't break existing)
- Atom port: `Phone`, `Card`, `Btn`, `Field`, `Kicker`, `Orb`, `Ghost`, `OrSplit`, `OAuthRow` from `koda-designs/koda-kit.jsx` → new `src/design-kit.tsx` (or extend `src/shared.tsx`)
- States to cover: idle / validation error / loading / success
- Backend: ✅ already wired (`supabase.auth.signUp`)

**Block 2 (17:00–19:00) — P0 #2: Password reset, screens 1–2**

- Design ref: `cat01-auth.jsx` → `ResetRequest` + `ResetSent` components
- Target: `src/KodaAuth.tsx` — replace existing reset flow UI (currently `mode === 'reset' | 'reset-sent'`)
- Backend: ✅ `api/account.ts handleResetPassword` already works — visual port only

**End of day acceptance:**
- [ ] Sign-up form renders pixel-accurate on the preview URL
- [ ] Validation errors fire on bad email + short password
- [ ] Real new signup works (test with a throwaway email)
- [ ] Reset request + sent screens render
- [ ] `docs/design-coverage.md` ticked for both items

---

### Day 2 — Tue 2026-06-09 · Password reset + Welcome email

**Block 1 — P0 #2 finish: New password + expired link**

- Design ref: `cat01-auth.jsx` → `ResetNewPassword` + `ResetExpired` components
- Target: same `src/KodaAuth.tsx` flow (`mode === 'new-password'` + new `'expired'` state)
- Backend: Supabase Auth handles token validity natively; on invalid/expired token, the `updateUser` call returns an error — render the expired screen on error.

**Block 2 — P0 #8: Welcome email**

- Design ref: `cat12-email.jsx` → `WelcomeEmail` component
- Target: `api/lib/email.ts` — add `welcomeHtml({ name, handle })` helper following the existing `receiptHtml` / `waitlistConfirmHtml` pattern
- Wire: hook into the auth signup flow. Options:
  - (a) Supabase Auth webhook → trigger Resend send (cleanest, requires Supabase webhook config)
  - (b) Detect first signin on client → `POST /api/account?action=welcome-email` (simpler, less reliable)
  - Pick (a). Set up Supabase Auth webhook `user.created` → new endpoint `/api/auth-hook?event=user-created` → Resend send.

**End of day acceptance:**
- [ ] All 4 password reset screens render + work end-to-end with a real email
- [ ] Signing up with a new account triggers the welcome email within 1 minute
- [ ] Welcome email renders in Gmail dark + light correctly

---

### Day 3 — Wed 2026-06-10 · Email verification

**Block 1 — P0 #3: Email verification UI**

- Design ref: `cat01-auth.jsx` → `EmailVerifyPending` component
- Target: `src/KodaAuth.tsx` — new `mode === 'verify-pending'` state shown after signup if email unconfirmed
- Backend prep: in Supabase dashboard → Authentication → Providers → Email → **enable "Confirm email"** (toggle). Note: this changes existing signup flow — test in preview first; do not enable on prod yet.
- Auth flow change: after `supabase.auth.signUp`, check `data.user.email_confirmed_at`. If null, render the verify-pending screen.

**Block 2 — P0 #10: Email verification email**

- Design ref: `cat12-email.jsx` → `EmailVerifyEmail` component
- Target: customise Supabase Auth's "Confirm signup" email template via dashboard → Authentication → Email Templates. Paste the rendered HTML from the design.
- Alternative if dashboard template is too constrained: disable Supabase's default email, send custom via Resend in the same Auth webhook from Day 2 (`event=user-created` branches by `email_confirmed_at`).

**13:00–16:00 — Trading + Customer Dev block on Wed**

- Customer Dev event (16:00–17:00) is Wed-only. Use it to ask 2–3 beta users about the signup experience you just shipped. Listen for friction.

**End of day acceptance:**
- [ ] New signups land on the verify-pending screen
- [ ] Verification email arrives within 1 minute
- [ ] Clicking the verify link confirms the account + redirects to the app

---

### Day 4 — Thu 2026-06-11 · Password reset email + Focus states

**Block 1 — P0 #9: Password reset email**

- Design ref: `cat12-email.jsx` → `PasswordResetEmail` component
- Target: `api/account.ts handleResetPassword` — replace the inline HTML (~lines 113–124) with a `resetPasswordHtml({ username, resetLink })` helper from `api/lib/email.ts`
- Also: update Supabase Auth's "Reset password" email template via dashboard, in case OAuth-account users trigger it via Supabase directly (not via your `/api/account` endpoint).

**Block 2 — P0 #12: Focus-state designs**

- Design ref: `cat16-a11y.jsx` → focus-state reference board
- Target: `src/index.css` — global `:focus-visible` rules. Tokens from `koda-kit.jsx` THEME.
- Apply to: all buttons, inputs, links, interactive cards. Use `outline: 2px solid t.accent; outline-offset: 2px;` baseline; refine per atom in `src/design-kit.tsx`.
- Smoke test: tab through KodaAuth + SettingsScreen with keyboard. Every interactive element visibly focuses.

**End of day acceptance:**
- [ ] Password reset email matches design in Gmail dark + light
- [ ] Every focus state on KodaAuth + Settings renders the new ring
- [ ] No focus regressions on existing screens (keyboard tab through Koda.tsx Home)

---

### Day 5 — Fri 2026-06-12 · Week 1 QA + merge

**Block 1 (08:30–10:30) — QA in preview**

- Open preview URL. Walk through every P0 shipped this week:
  1. Sign up (new email) → verify pending → email confirm → into app
  2. Forgot password → email → reset link → new password → sign in
  3. Tab focus across every form
- Capture any bugs in `docs/design-coverage.md` Notes log.

**11:00–12:00 — Merge `redesign/v2` → `main`**

```powershell
cd "C:\Users\Dylon\OneDrive\Desktop\koda"
git checkout main
git pull
git merge redesign/v2 --no-ff -m "Merge redesign/v2: Phase 1 Week 1 (auth + email foundations)"
git push
git checkout redesign/v2
```

Vercel auto-deploys to prod. Watch the deploy. If green, **5 P0s shipped.** 7 to go.

**Afternoon — your normal trading + content + Block 2 cadence**, except Block 2 is decompression today.

---

## Week 2 — Billing + system + cookies (Days 6–10)

### Day 6 — Mon 2026-06-15 · Billing dunning UI + backend

**Block 1 — P0 #4 (UI): Billing edge cases**

- Design ref: `cat02-settings.jsx` → `BillingPastDue` + `BillingDunning` + `BillingPromo` components
- Target: `src/SettingsScreen.tsx` — the billing section. Render different cards based on `subscriptionStatus`.
- Currently `SettingsScreen` only knows `plan: 'free' | 'pro' | 'elite'`. Needs new prop `subscriptionStatus: 'active' | 'past_due' | 'incomplete' | 'cancelled' | null` from Koda.tsx.

**Block 2 — P0 #4 (backend): Surface subscription status to JWT**

- Target: `api/stripe.ts handleWebhook` — extend `setUserPlan` to write `subscription_status` to `app_metadata` alongside `plan`:

```ts
await db.auth.admin.updateUserById(userId, {
  app_metadata: { plan, subscription_status: sub.status },
});
```

- Update `supabase/migrations/004_plan_jwt_claims.sql` (or follow-up migration) — JWT hook reads + stamps `subscription_status` into claims.
- Client (`src/Koda.tsx` or `src/KodaAuth.tsx`) reads `subscription_status` from JWT claims, passes to `SettingsScreen`.

**End of day acceptance:**
- [ ] Test webhook event (Stripe CLI `stripe trigger invoice.payment_failed`) → `subscription_status: 'past_due'` appears in JWT
- [ ] SettingsScreen renders the past-due card when status = past_due
- [ ] Active subscription still renders normal billing card

---

### Day 7 — Tue 2026-06-16 · Payment failed email + Account deletion UI

**Block 1 — P0 #11: Payment failed email**

- Design ref: `cat12-email.jsx` → `PaymentFailedEmail` component
- Target: `api/stripe.ts handleWebhook` — extend `invoice.payment_failed` branch (currently logs only, line 365) to call `sendEmail({ to, subject, html: paymentFailedHtml(...) })`
- Helper: add `paymentFailedHtml({ amount, retryUrl })` to `api/lib/email.ts`
- `retryUrl` = Stripe customer portal URL (use `stripe.billingPortal.sessions.create`)

**Block 2 — P0 #5 (UI part): Account deletion 3-step flow**

- Design ref: `cat02-settings.jsx` → `AccountDeleteStep1Warning` + `AccountDeleteStep2Confirm` + `AccountDeleteScheduled` components
- Target: `src/SettingsScreen.tsx` — replace existing delete confirmation modal with the 3-step flow
- States: warning → confirm (with typed "DELETE" check) → scheduled (7-day reversible window)
- Backend wiring is Day 8.

---

### Day 8 — Wed 2026-06-17 · Account deletion backend + Session expired

**Block 1 — P0 #5 (backend): Account deletion completion**

- Target: `api/account.ts handleDelete` —
  - Send account deletion email via Resend before wiping (use `accountDeletionHtml({ name, scheduledFor })` helper)
  - Optionally implement 7-day grace window: schedule actual deletion via a cron job (`api/cron.ts?job=process-pending-deletions`) instead of immediate wipe. Adds a `deletion_scheduled_at` column to `auth.users.raw_user_meta_data` or `public.profiles`. Trade-off: more complex but matches design intent.
  - Decision: ship immediate-delete-with-grace-warning for now; full grace window in Phase 2.

**Block 2 — P0 #6: Session-expired modal**

- Design ref: `cat07-system.jsx` → `SessionExpiredModal` component
- Target: new file `src/components/SessionExpiredModal.tsx` + wiring in `src/Koda.tsx` or `src/KodaAuth.tsx`
- Trigger: subscribe to `supabase.auth.onAuthStateChange`. When `event === 'SIGNED_OUT'` and current view isn't auth, show the modal. Also: detect failed token refresh by checking `getSession()` periodically (every 5 min) — if it returns null while UI assumes signed-in, show modal.
- Modal action: "Sign in again" → resets auth state, navigates to KodaAuth without losing the current view (preserve in localStorage so post-reauth they land back).

---

### Day 9 — Thu 2026-06-18 · Cookie consent + buffer

**Block 1 — P0 #7: Cookie consent + preferences**

- Design ref: `cat10-marketing.jsx` → `CookieConsentBanner` + `CookiePreferencesModal` components
- Target: `src/CookieConsent.tsx` — replace existing banner with the new design
- New: preferences modal with Analytics / Functional / Necessary toggles. Wire Analytics toggle to PostHog opt-out (`posthog.opt_out_capturing()`).

**Block 2 — Buffer**

- Pick up any P0 that ran long
- Hit any QA bugs from preview testing
- Update `docs/design-coverage.md` notes log with anything notable from the week

---

### Day 10 — Fri 2026-06-19 · Phase 1 QA + merge

**Block 1 (08:30–10:30) — Phase 1 full QA in preview**

Walk every P0 end-to-end:

1. Sign up + verify email + sign in
2. Forgot password + reset
3. Settings billing → simulate past-due via Stripe CLI
4. Trigger an account deletion (use a test account)
5. Force a session expiry (revoke session in Supabase dashboard) — modal fires
6. Open in incognito → cookie banner → preferences → opt-out → PostHog respects it
7. Keyboard-tab through everything new → focus rings visible

**11:00–12:00 — Merge `redesign/v2` → `main`**

Same merge script as Day 5. **Phase 1 complete. 12 P0s shipped.**

Update `docs/design-coverage.md` — every Phase 1 row should be `[x] [x]`.

**Afternoon — celebrate small.** You crossed the launch-blocker line.

---

## Things to watch for across all 10 days

- **Token drift**: every screen you port should use `theme.ts` tokens, not hardcoded values. If you find yourself reaching for `#13110E` or an oklch literal, add it to the token table instead.
- **`src/Koda.tsx` merge battles**: if you have to touch the 4921-line god file more than once a day, queue the file split as a Block 2 task in Phase 2 week 1.
- **Email rendering**: test every email template in Gmail (dark + light), iCloud Mail, and Outlook web. Litmus or mail-tester.com if budget allows; otherwise just send to your own multiple-provider accounts.
- **Supabase dashboard changes** (email confirm toggle, email templates): document each change in `docs/design-coverage.md` notes log with date + dashboard path. If the project gets reset, you need to redo them; the log is the recovery script.

---

## If you fall behind

P0s in rough order of "must ship before any non-beta user touches the app":

1. Email verification + Welcome + Password reset email (auth trust)
2. Sign-up form (first impression)
3. Billing dunning + Payment failed email (revenue protection)
4. Account deletion (GDPR legal exposure)
5. Session-expired modal (silent data loss prevention)
6. Cookie consent (GDPR legal exposure)
7. Focus states (a11y compliance)

If Day 10 arrives and 2–3 items aren't done, ship what's done, document the gap in `docs/design-coverage.md`, and slot the leftovers into Phase 2 Week 1 Block 2. **Don't drag Phase 1 into Week 3.** Phase 2 has its own scope.

---

## When this runbook ends

After Day 10, switch to `implementation-plan.md` §3 for Phase 2 sequencing. Phase 2 doesn't have a day-by-day runbook (61 items × 10 days = too granular to preplan). It runs on category batches — pick the category at the start of each day during your 22:30 Tomorrow Plan ritual.
