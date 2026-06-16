# Kōda Retention — Core Engine (Phase 1)

**Date:** 2026-06-16
**Status:** Design — awaiting review
**Scope:** Cross-session return + win-back, powered by the *existing* (but unwired) email/notification infrastructure.

---

## 1. Problem & Goal

Kōda is a **bursty, trade-day product** — there is no daily in-app habit to lean on. Retention must be **externally triggered** (email/push reaching a user who isn't in the app) and tied to events that matter to the user.

Target retention behaviours (from brainstorm):
- **#2 Cross-session return** — bring a user back for their next trading session.
- **#4 Social pull** — already largely works (real-time social push); the gap is reaching users *without* push.
- (**#3 no-trade-day engagement** is deferred to Phase 2.)

**Key finding from the codebase assessment:** the retention system is ~80% built and mostly *unplugged*. This spec is overwhelmingly **wiring + small additions**, not new infrastructure.

---

## 2. Current State (verified in code)

**Works today**
- `api/push.ts` — full Web Push pipeline (VAPID subscribe, fan-out, dead-endpoint cleanup) + `deliverNotification()` (writes `notification_feed` + fans out push).
- Social triggers (push + in-app): circle message, follow, circle-join, reaction, idea-like — all server-verified.
- `api/cron.ts` — single multi-job function (`?job=…`). Crons in `vercel.json`: `complete-challenges` (daily 00:00), `daily-digest` (07:00), `news-calendar` (11:00), `weekly-digest` (Sun 18:00).
- `weekly-digest` cron — delivers "Your Kōda week" but **push/in-app only** and **social-events only** (skips users with no social activity; never mentions the user's own trading).
- `api/_lib/email.ts` — **Resend** sender (`sendEmail`, from `Kōda <noreply@kodatrade.co.uk>`) + 12 finished templates.

**Built but never called (dead code)**
- `weeklyRecapHtml`, `milestoneEmailHtml`, `monthlySummaryEmailHtml`, `brokerSyncErrorEmailHtml`, `welcomeEmailHtml`, `announcementEmailHtml`.
- `sendEmail` is invoked in only 2 places: waitlist confirm (`api/account.ts`) and payment receipt (`api/stripe.ts`).

**Missing entirely**
- Email-preference flags + a working `/unsubscribe` (templates link to `/unsubscribe` and `/settings`, but neither handles email prefs).
- Any trigger based on the user's **own trading** (all triggers are social).
- Any **inactivity / win-back** detection.
- A reliable **"user came back"** signal (last trade `created_at` is contaminated by Tradovate auto-sync, which writes trades without the user opening the app).

**Schema facts**
- `trades`: `user_id`, `date`, `strategy`, `outcome ∈ {win,loss,be}`, `pnl numeric`, `rr numeric NULL`, `created_at`. `rr` is **null for auto-synced trades**.
- Helper modules live in `api/_lib`. **Vercel Hobby 12-function cap** — no new top-level `api/*` functions; new jobs/actions mount on existing functions.
- Pre-commit blocks `: any` and unsigned `eslint-disable`.

---

## 3. Design

Three components, in build order. **A must ship before B/C** (compliance + don't-spam).

### A. Email preferences + unsubscribe

**Data model** — migration adding to `public.profiles`:
| Column | Type | Default | Purpose |
|---|---|---|---|
| `weekly_recap_opt_in` | boolean | `true` | gates the weekly recap email |
| `winback_opt_in` | boolean | `true` | gates win-back email |
| `product_opt_in` | boolean | `true` | gates announcements (future) |
| `unsubscribe_token` | uuid | `gen_random_uuid()` | stable, used in email links |

Transactional emails (receipt, password reset, verification, payment-failed, account-deletion) are **never gated**.

**Public unsubscribe route** — mounted as `?action=unsubscribe` on `api/account.ts`, to respect the 12-function cap. Note `api/account.ts` is currently **POST-only** (returns 405 otherwise) — the router must special-case `GET` for `action=unsubscribe`:
- `GET /api/account?action=unsubscribe&token=<uuid>&type=<weekly|winback|product|all>`
- Looks up the profile by `unsubscribe_token` (service role), sets the matching opt-in(s) to `false`, returns a minimal styled HTML confirmation page.
- No auth (clicked from email client). Rate-limited via existing `checkRateLimit`. Invalid/unknown token → generic "you're unsubscribed" page (no enumeration).

**Template change** — `emailShell()` currently hardcodes `https://kodatrade.co.uk/unsubscribe`. Change it to accept an `unsubscribeUrl` param; all senders pass a tokenized URL (`…/api/account?action=unsubscribe&token=<token>&type=<type>`). "Manage emails" link → `/settings`.

**Settings UI** — add a "Manage emails" section in `src/SettingsScreen.tsx` with toggles bound to the three opt-in columns (authenticated update of the user's own profile row; existing RLS `trades_self`-style self policy on profiles applies).

### B. Weekly recap email

Extend the existing **Sunday 18:00 `weekly-digest`** job (do not add a cron slot).

**Recipient email sourcing (important):** accounts use **synthetic auth emails** (`<username>@users.kodatrade.co.uk`); the deliverable address is `auth.users.raw_user_meta_data.recovery_email`. The recap/win-back jobs must read the recovery email via the admin client (`.schema("auth").from("users")`), and **skip any user without one** (push-only for those).

**Recipient filter:** has a recovery email, `weekly_recap_opt_in = true`, and the user logged **≥1 trade in the trailing 7 days**. (No trades that week → handled by win-back, not here.)

**Stats (per user, trailing 7 days)** — computed in a new `api/_lib/metrics/weeklyRecap.ts`:
- `tradeCount` = count of trades in window.
- `netDollar` = Σ `pnl` (always available → **headline**).
- `winRate` = wins / (wins+losses) × 100 (exclude `be`).
- `netR` = Σ `rr` over trades where `rr` is not null; shown **only if** ≥1 non-null `rr` exists.
- `bestSetup` = `strategy` with the highest Σ `pnl` (ignore empty-string strategy).

**Template tweak** — `weeklyRecapHtml` currently assumes Net R. Adjust so the primary metric is **net $**, with Net R shown as a secondary stat only when present. Keep design tokens unchanged.

**Send** — `sendEmail({ to, subject, html })` with the tokenized unsubscribe URL.

**Idempotency** — add `last_weekly_recap_at timestamptz` to `profiles`; skip any user already sent within the current week. Update only on successful send (cron-retry safe — mirrors the existing `aggregated_at` pattern in `handleWeeklyDigest`).

### C. Win-back trigger ("you've gone quiet")

**Activity signal (the chosen small addition):** add `profiles.last_active_at timestamptz`. The web app upserts it (throttled, e.g. once per session/day) on load for the authenticated user. This is the only honest "the *user* came back" signal — last-trade `created_at` is contaminated by auto-sync. *(Rejected alternative: `auth.last_sign_in_at` — zero build but imprecise for persistent PWA sessions.)*

**Job** — new `?job=winback` on `api/cron.ts` (no new function). Add a daily cron to `vercel.json` (e.g. `0 16 * * *`).
- Select users where `last_active_at` is **7–14 days ago** (a window → fires once as they cross it), `winback_opt_in = true`, has an email, and no win-back sent in the last 30 days.
- Send `winbackEmailHtml` via `sendEmail`; also `deliverNotification` (push + in-app) if subscribed.
- **Idempotency** — `profiles.last_winback_at timestamptz`; set on send; 30-day cooldown.

**New template** — `winbackEmailHtml({ firstName, lastNetDollar?, appUrl, unsubscribeUrl })` built from existing `emailShell`/`emailH`/`emailCTA` helpers. Tone: "your edge is waiting," light, one CTA. Consistent with the other 12 templates.

---

## 4. Error Handling & Edge Cases

- **Resend failures** — per-user `try/catch`; log and continue; do **not** set the `*_at` idempotency stamp on failure (retry next run). Mirrors `handleWeeklyDigest`'s existing pattern.
- **Resend domain auth** — verify SPF/DKIM for `kodatrade.co.uk` before enabling volume sends (open item §6).
- **Users with no email** — skipped (filter).
- **Push but no email / email but no push** — each channel independent; absence of one never blocks the other.
- **Double-send on cron retry** — prevented by the `*_at` stamps.
- **Unsubscribe idempotency** — flipping an already-false flag is a no-op; always show success.

---

## 5. Testing

- **Unit** — `weeklyRecap.ts` stats math (win rate excludes `be`; `netR` null-safe; `bestSetup` ignores empty strategy; empty-window → not sent). Follow existing `api/_lib/ingest.test.ts` style.
- **Unit** — win-back selection window (7–14d boundary; 30-day cooldown; opt-out excluded).
- **Integration** — unsubscribe route flips the correct flag by token; invalid token still 200s.
- **Manual** — trigger `weekly-digest` and `winback` via authed POST against a seeded test user; confirm Resend delivery + correct unsubscribe link; click unsubscribe → flag flips → next run skips.

---

## 6. Open Items (resolve during planning, not blockers)

1. Confirm Resend domain auth (SPF/DKIM) for `kodatrade.co.uk` is live (a Dylon/ops check, not a code task).
2. ~~Host for unsubscribe route~~ → **resolved:** `api/account.ts`, router special-cased for GET.
3. Decide the `last_active_at` upsert throttle — **plan uses once/day** (localStorage date-guard) to avoid write amplification.
4. ~~profiles RLS~~ → **resolved:** `profiles_self` policy already allows authenticated self-update.

---

## 7. Out of Scope (Phase 2+)

Deferred deliberately: streak/milestone email (`milestoneEmailHtml`), monthly summary (`monthlySummaryEmailHtml`), no-trade-day news-event nudge (built on the existing `news-calendar` data), email fallback for the *social* weekly digest, and broker-sync-error email (`brokerSyncErrorEmailHtml`). All become fast follow-ons once A/B/C light up the rails.

---

## 8. Build Sequence

1. **A** — migration (opt-in cols + token + `last_active_at` + `last_weekly_recap_at` + `last_winback_at`), unsubscribe route, `emailShell` param, Settings UI, `last_active_at` ping.
2. **B** — `weeklyRecap.ts` stats, `weeklyRecapHtml` tweak, wire into `weekly-digest` cron.
3. **C** — `winbackEmailHtml`, `?job=winback`, `vercel.json` cron entry.
