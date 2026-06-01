# Kōda — pickup for next session

**Session closed:** 2026-06-01 (Monday — beta launch day).
**Beta launched:** live at kodatrade.co.uk

This doc is the single source of truth for resuming work. Read this first.

---

## 1 · What shipped this session

| # | Commit | What |
|---|---|---|
| 1 | `8868c8d` | Fix `api/cron.ts` cors origin header cast — all 3 API files now type-clean |
| prev | (consolidation) | **API consolidation** — 12 serverless functions → 7; merged `cron/complete-challenges + cron/sync → api/cron.ts`, `stripe-checkout + stripe-portal + stripe-webhook → api/stripe.ts`, `reset-password + feedback + delete-account → api/account.ts`; all call sites updated |
| prev | (telegram fix) | **Feedback → Telegram group** — `TELEGRAM_CHAT_ID` updated to group chat ID `-4755923562` in Vercel env |

All deployed to production (READY, no TS errors in build output).

---

## 2 · CRITICAL OUTSTANDING ACTION — do this NOW

### Update Stripe Dashboard webhook URL

The webhook URL changed when `api/stripe-webhook.ts` was merged into `api/stripe.ts`.

**Old URL:** `https://kodatrade.co.uk/api/stripe-webhook`
**New URL:** `https://kodatrade.co.uk/api/stripe?action=webhook`

Until this is updated in the Stripe Dashboard, **subscription events and payment confirmations will silently fail**.

Steps:
1. Stripe Dashboard → Developers → Webhooks
2. Find the existing webhook pointing to `/api/stripe-webhook`
3. Edit → update endpoint URL to `https://kodatrade.co.uk/api/stripe?action=webhook`
4. Save
5. Send a test event to verify 200 response

---

## 3 · Serverless function inventory (7 / 12 Hobby limit)

| File | Routes |
|---|---|
| `api/account.ts` | `?action=reset-password`, `beta-unlock`, `join-waitlist`, `feedback`, `delete` |
| `api/stripe.ts` | `?action=checkout`, `portal`, `webhook` |
| `api/cron.ts` | `?job=complete-challenges`, `sync` |
| `api/auth.ts` | (unchanged) |
| `api/tradovate.ts` | (unchanged) |
| `api/circles.ts` | (unchanged) |
| `api/og.ts` | (unchanged) |

5 slots free for future features.

---

## 4 · Batch 2 — sign-up compliance (still outstanding)

Needs UK Ltd details to land. Per `FUNNEL_AUDIT.md` §A2 + §A9:
- T&Cs + Privacy + unticked marketing-opt-in checkboxes on `src/KodaAuth.tsx`
- UK Ltd disclosure in `public/privacy.html`, `public/terms.html`, `public/cookies.html`, `src/KodaAuth.tsx` footer

**Fill these in before working on Batch 2:**
- Registered company name: ____________________________________
- Companies House number: ____________________________________
- Registered office (single line): ____________________________________
- VAT number (if registered): ____________________________________
- ICO data-protection registration ref (if registered): ____________________________________

---

## 5 · Deferred post-launch

- **M2**: Switch `trade-screenshots` bucket from public → private; replace `getPublicUrl()` with signed URLs
- **M7**: Circle messages sender trigger
- The 134 `: any` / `as any` cleanup across 24 files
- `Trade` numeric-type refactor
- `TradingCircles` 29-prop drilling → `KodaContext`
- Marketing landing site
- Resend SDK + transactional emails + weekly recap cron
- Meta / TikTok / Google pixels
- Referral programme

---

## 6 · Quick reference

```bash
# Dev
npm run dev                  # http://localhost:5173
npm run typecheck            # tsc --noEmit (also runs on pre-commit)
npm run lint
npm test -- --run            # unit tests
npm run test:e2e             # Playwright, auto-starts dev server
```

**Stable selectors:**
- Bottom nav: `[data-testid="nav-home"]` / `nav-log` / `nav-history` / `nav-stats` / `nav-circles`
- Auth: `[data-testid="auth-submit"]`
- Trade form: `[data-testid="trade-pair"]` / `trade-pnl-dollar` / `trade-save`

**OneDrive warning still in force.** Large writes to `Koda.tsx` can be truncated — `wc -l` after big deletes.
