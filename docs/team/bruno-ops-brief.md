# Bruno — COO ops brief

**Created:** 2026-06-04 · **For:** Bruno (COO, Kōda Group LTD) · **From:** Dylon (CEO)

This doc settles the polish-vs-priorities debate by giving you ownership of everything that *isn't* the next product bet. Below is your scope for the next 4 weeks. Once these are humming, we can talk about expanding into product roadmap input.

---

## Why this brief exists

We had a recurring debate about whether to invest the next sprint in UI polish or in something else. The short version of where I land:

- **Polish is real, but not the wedge.** I'm protecting the founder time for the things only I can do (product strategy, intervention feature evolution, founder content).
- **Three screens are getting polished anyway** — the intervention sheet, the discipline score, and the weekly report card. That's the wedge surface. Everything else stays rough until paying users tell us which screen to fix next.
- **Your job is to run the company around the wedge, not set the wedge.** Below is a real list of things that make us a £24.99/mo product instead of a side project. Pick them up.

If this scope doesn't fit, we sit down and rescope before you start. Not after.

---

## Your ownership — 4 weeks

### 1. Stripe + billing reliability (week 1)

The webhook flow is shipped but I haven't seen it tested under failure modes. Own this stack:

- [ ] Set up a Stripe test-mode dunning flow and run it end-to-end: create a customer, attach a card that succeeds → swap to a card that fails on the next renewal → verify our 3-attempt retry → verify the `payment_failed` email fires from `api/lib/email.ts` → verify the in-app dunning banner appears (uses `BillingDunningScreen` from `src/settings/SettingsScreens.tsx`).
- [ ] Document the runbook in `docs/runbooks/billing.md` so this isn't tribal knowledge.
- [ ] Set up a weekly Stripe report (revenue, MRR, churn, dunning state) — paste it into our Telegram chat every Monday morning.
- [ ] Verify the new `subscriptionCancelledEmailHtml` and `paymentFailedEmailHtml` templates render correctly in Gmail + Outlook + Apple Mail. Litmus or Email on Acid are the right tools — pick one and expense it.

### 2. Email plumbing (week 1–2)

I built 12 transactional + lifecycle templates in `api/lib/email.ts`. They're not wired to triggers yet. You own the wire-up.

| Template | Trigger | Where |
|---|---|---|
| `welcomeEmailHtml` | Sign-up success | `api/account.ts` after `auth.signUp` |
| `passwordResetEmailHtml` | Reset request | `api/account.ts?action=reset-password` |
| `emailVerificationHtml` | Supabase email confirmation | Supabase Auth Hook → our endpoint |
| `paymentFailedEmailHtml` | Stripe `invoice.payment_failed` | `api/stripe.ts?action=webhook` |
| `subscriptionCancelledEmailHtml` | Stripe `customer.subscription.deleted` | `api/stripe.ts?action=webhook` |
| `accountDeletionEmailHtml` | Account deletion request | `api/account.ts?action=delete` |
| `milestoneEmailHtml` | 30-day / 100-trade streak | nightly cron — `api/cron.ts?job=milestones` (new) |
| `brokerSyncErrorEmailHtml` | Tradovate sync failure (`liveBrokerSync`) | `api/cron.ts?job=sync` |
| `announcementEmailHtml` | Manual via `/announce` Telegram cmd | `api/telegram.ts` |
| `betaUnlockEmailHtml` | Beta seat opens | `api/account.ts?action=beta-unlock` (already) |
| `waitlistPositionEmailHtml` | Weekly waitlist position update | cron — needs new job |
| `monthlySummaryEmailHtml` | 1st of month, 9am UTC | cron — needs new job |

Estimate: 1 hour each. ~12 hours total. You don't have to do them all week 1 — pick the top 4 (welcome / payment failed / cancelled / verify) for week 1, the rest by end of week 2.

### 3. Legal + compliance (week 2)

- [ ] **Companies House filings** — confirm next confirmation statement date for Kōda Group Ltd and put it on your calendar.
- [ ] **VAT registration** — we hit the threshold at £90k/year. We're not there yet, but you should know what the trigger looks like and have the registration steps in a doc so we don't trip into a fine.
- [ ] **ICO registration** — UK GDPR requires data-protection registration. £40/year. Get it done if not done already. ICO website handles it.
- [ ] **Batch 2 compliance** (still on the whiteboard): T&Cs + Privacy + unticked marketing-opt-in checkboxes on `src/KodaAuth.tsx`, UK Ltd disclosure in footer of `privacy.html`/`terms.html`/`cookies.html`/`KodaAuth.tsx`. Reference: `FUNNEL_AUDIT.md` §A2 + §A9. Doable in a day with the Companies House number.
- [ ] **Trade-screenshots bucket → private** — this is a security item (currently public, any UID can pull screenshots by URL). Runbook B in `NEXT_SESSION.md`. Coordinate with me on the migration window.

### 4. Operations infrastructure (week 2–3)

- [ ] **Sentry** — review error volume weekly. Anything firing > 5/day, file a ticket and assign it. We currently have ~29 `[object Object]` errors getting de-prioritised (now fixed) — that pattern of "ignoring noise" is how regressions slip in.
- [ ] **Uptime monitoring** — Pingdom or UptimeRobot on `kodatrade.co.uk`, `kodatrade.co.uk/api/cron`, and the Supabase status endpoint. Set up SMS + Telegram alerts.
- [ ] **Backup strategy for Supabase** — verify daily backups are running, document recovery procedure, and do a dry-run restore to a staging project. If a paying user loses 1000 trades because we don't have a tested backup, we're refunding everyone.
- [ ] **Status page** — `status.kodatrade.co.uk` (referenced in the new error pages I built but doesn't exist yet). Statuspage.io is free for our size; set it up.

### 5. Customer onboarding ops (week 3–4)

- [ ] **Beta-user check-in cadence** — 13 users now. Personally reach out (via Telegram or email) to each one once a month. Ask: what did you do this week that needed Kōda? Where did Kōda get in the way? Pipe the answers into a shared doc — that's our real product roadmap input, not Garry's lens or my gut.
- [ ] **Support email** (`support@kodatrade.co.uk`) — currently unmonitored. Either you or a part-time VA monitors it. SLA: 24h response, 72h resolution. Document common issues in `docs/support/playbook.md`.
- [ ] **Onboarding optimisation** — measure the funnel from sign-up → first trade logged → 7-day-retained. Currently we have PostHog but no defined funnel. Set up the funnel, ship a weekly report. *Don't* propose UI fixes for drop-off until we have 100+ users in the funnel — too noisy below that.

### 6. Vendor + infrastructure cost control (ongoing)

- [ ] Audit every paid service monthly. Currently: Vercel, Supabase (free tier), PostHog (EU free tier), Resend, Sentry (free tier), Stripe (fee per transaction), Telegram (free), GitHub (free).
- [ ] As we add users, flag when we'll hit each tier ceiling. Vercel Hobby is 12 serverless function limit — we're at 10/12 (`docs/NEXT_SESSION.md`). Plan the upgrade window before we hit it.
- [ ] Negotiate annual contracts where it makes sense (Stripe doesn't offer them, but Sentry and Resend do at ~20% off).

---

## What's NOT in your scope (for now)

- **Product roadmap.** I own it. You can challenge it — that's how we get better — but the decision sits with me.
- **UI polish beyond the 3 wedge screens.** Auth, Settings, Trade log, Circles, Stats — they stay as-is until paying users complain or until we hit a quarterly polish sprint.
- **Hiring.** When we get to needing it, we'll do it together.
- **Founder content.** Dan owns content (CMO). I'm in those videos.

---

## What you should escalate to me immediately

- Security incident
- Beta user threatens to leave
- A vendor outage > 30 min on `kodatrade.co.uk`
- Legal letter or compliance notice
- Cash balance projection drops below 3-month runway
- A decision that would change our pricing, plan, or wedge feature

---

## Cadence

- **Monday 9am UK:** weekly metrics dump in Telegram (revenue, MRR, churn, support volume, Sentry top errors, beta-user check-ins done)
- **Thursday 6pm UK:** 30-min sync with me — what's done, what's blocked, what's next week
- **Anytime:** Telegram for blockers

---

## If we disagree

You will sometimes disagree with my product calls. That's expected and good. The rule:

1. **Sparring partner mode is welcome.** Tell me you think I'm wrong, in writing or voice, before the decision lands.
2. **Once the decision is made, execute.** The worst possible state is two senior people half-executing a half-decision.
3. **If you fundamentally disagree with the strategic direction, we have a different conversation.** That's not for the day-to-day.

---

## Signed off

**Dylon (CEO):** Yes, this is the scope.
**Bruno (COO):** [sign here when you've read and agreed]

Date: __________
