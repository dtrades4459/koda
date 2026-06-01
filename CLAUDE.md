# Kōda — Claude Code Operating Rules & Project Context

> Read this file at the start of every session. Follow the Operating Rules without exception, then use the project context below for all decisions.

---

## Operating Rules

### Rule 1 — Plan before code
- Never touch a file before writing a plan.
- Output the plan as a numbered checklist: files to touch, what changes in each, what could break, how you'll verify.
- If anything unexpected happens mid-execution, STOP. Re-plan and show the revised plan before continuing.

### Rule 2 — Offload hard problems to sub-agents
- For any task with multiple independent parts, spawn sub-agents via the Agent tool.
- Keep the main context clean. Sub-agents do deep digging and return summaries.

### Rule 3 — Prove it works
- Nothing is marked done until logs are checked and the change is verified end-to-end.
- "It should work" is not done. "I ran it and here's the output" is done.

### Rule 4 — Autonomous bug fixing
- Reproduce first. Go to logs. Trace to root cause, not first suspect. Fix root cause, not symptom.

---

## What Kōda is

A trading journal PWA for retail futures traders. Log trades, track stats (P&L, win rate, avg R), follow friends, and compete in Trading Circles. Mobile-first, installable as a home screen app on iOS/Android.

**Live URLs:** https://tradrjournal.xyz · https://kodatrade.co.uk (GoDaddy → Vercel)
**Vercel project:** `tradr.dt` (account: `dylnyland4459-1994`)
**Supabase project ID:** `vifwjwsndchnrpvfgrmg`
**No git repo** — deploys are done directly via `vercel --prod` CLI from `C:\Users\Dylon\OneDrive\Desktop\koda`

---

## Stack

- React 19 + TypeScript + Vite (PWA via vite-plugin-pwa)
- Supabase (auth + KV tables + v2 relational schema + Realtime)
- Vercel (hosting + serverless functions in `api/` + Vercel Cron nightly for challenge completion)
- Main app: `src/Koda.tsx` (~4100 lines)
- Auth wrapper: `src/KodaAuth.tsx`
- Storage shim: `src/lib/storage.ts` (wraps Supabase KV + localStorage cache)

---

## Key Files

| File | Purpose |
|------|---------|
| `src/Koda.tsx` | Main app shell — state, routing, all tab screens |
| `src/KodaAuth.tsx` | Supabase auth wrapper, installs storage shim on sign-in |
| `src/lib/storage.ts` | `window.storage` shim: `get(key)`, `set(key, value, shared?)` |
| `src/lib/log.ts` | Centralised logger. Use instead of bare `console.error`. |
| `src/lib/flags.ts` | Feature flag util. `isFlagOn("name")`. Toggle via `window.kodaFlags.enableFlag("name")`. |
| `src/TradingCircles.tsx` | Circles tab — create/join, leaderboard, chat, challenges |
| `src/FriendsFeed.tsx` | Feed tab |
| `src/OnboardingFlow.tsx` | 5-step onboarding flow |
| `src/components/FirstSessionSurvey.tsx` | Post-onboarding survey (prior tool, why they almost stopped) |
| `src/SettingsScreen.tsx` | Settings tab — profile edit, dark mode, export, delete account |
| `src/LogTradeScreen.tsx` | Log tab — trade entry form |
| `src/charts.tsx` | All chart components |
| `src/shared.tsx` | Shared constants, UI primitives |
| `src/types.ts` | Trade, Profile, Circle, EvalAccount interfaces |
| `src/data/circles.ts` | Circles data layer — single source for circle key naming + RLS-safe writes |
| `src/data/trades.ts` | v2 typed CRUD against `public.trades` (behind `newTrades` flag) |
| `src/data/profile.ts` | v2 typed CRUD against `public.profiles` (behind `newProfile` flag) |
| `src/BetaGate.tsx` | Closed-beta password wall — shown before auth if `VITE_BETA_PASSWORD` is set |
| `src/lib/posthog.ts` | PostHog analytics wrapper |
| `api/delete-account.ts` | POST — full user data wipe (broker tokens → trades → profiles → user_kv → shared_kv → auth.users) |
| `api/feedback.ts` | POST → Telegram bot (@Tradrfeedbackbot) |
| `api/broker/[action].ts` | Tradovate connect/disconnect |
| `api/cron/sync.ts` | Broker sync (every 5 min via GitHub Actions) |
| `api/lib/supabaseAdmin.ts` | Service-role Supabase client + JWT verifier |
| `vercel.json` | CSP headers + Vercel Cron config |
| `supabase/migrations/` | All DB migrations (run manually in Supabase SQL Editor) |

---

## Supabase Data Model

### `user_kv` (private per-user)
- `user_id`, `key`, `value` (JSON)
- RLS: user can only read/write their own rows
- Key keys: `koda_profile`, `koda_trades`, `koda_circles`, `koda_following_{uid}`

### `shared_kv` (public-readable)
- `key`, `value` (JSON), `owner_id`
- RLS: anyone can read, only `auth.uid() = owner_id` can write
- Used for: circle metadata, member rows, leaderboard entries, public profiles
- **`owner_id` is NOT NULL** — system keys use sentinel `'00000000-0000-0000-0000-000000000000'::uuid`

### `public.profiles` (v2 — live but behind `newProfile` flag)
- One row per user: `user_id`, `handle`, `name`, `avatar`, `bio`, `onboarded`, `prefs` (jsonb), etc.

### `public.trades` (v2 — live)
- One row per trade: `user_id`, `client_id`, `external_id`, `source`, `review_status`, etc.

### `public.circle_messages`
- `id`, `circle_code`, `sender_id`, `sender_handle`, `sender_name`, `sender_avatar`, `body`, `created_at`
- Has `REPLICA IDENTITY FULL` and is in `supabase_realtime` publication (migration `20260531_circle_messages_realtime.sql`)

### `public.broker_connections` + `public.sync_events`
- Broker token storage (AES-256-GCM encrypted) + sync audit log

---

## Vercel Environment Variables

| Variable | Purpose |
|----------|---------|
| `VITE_SUPABASE_URL` | Supabase URL (browser) |
| `VITE_SUPABASE_ANON_KEY` | Supabase anon key (browser) |
| `SUPABASE_URL` | Supabase URL (serverless) |
| `SUPABASE_ANON_KEY` | Supabase anon key (serverless) |
| `SUPABASE_SERVICE_ROLE_KEY` | Service role key — bypasses RLS |
| `APP_URL` | e.g. `https://kodatrade.co.uk` — used in CORS, emails |
| `KODA_ENCRYPTION_KEY` | 64 hex chars — AES-256-GCM key for broker tokens |
| `CRON_SECRET` | Auth header for GitHub Actions → `/api/cron/sync` |
| `TRADOVATE_APP_ID` / `TRADOVATE_APP_VERSION` / `TRADOVATE_CID` / `TRADOVATE_SEC` | Tradovate API |
| `TELEGRAM_BOT_TOKEN` | @Tradrfeedbackbot token |
| `TELEGRAM_CHAT_ID` | Feedback group ID (currently `-5187303282`) |
| `STRIPE_SECRET_KEY` / `STRIPE_WEBHOOK_SECRET` / `STRIPE_PRICE_ID_MONTHLY` / `STRIPE_PRICE_ID_ANNUAL` | Stripe billing |
| `STRIPE_PROMO_CODE_ID_K0DA` / `STRIPE_PROMO_CODE_ID_FOUNDERS` / `STRIPE_PROMO_CODE_ID_BETA` | Stripe promos |
| `RESEND_API_KEY` | Transactional email |
| `VAPID_PUBLIC_KEY` / `VAPID_PRIVATE_KEY` / `VAPID_EMAIL` | Web push |
| `VITE_VAPID_PUBLIC_KEY` | Same as VAPID_PUBLIC_KEY — exposed to browser |
| `VITE_SENTRY_DSN` | Optional Sentry DSN (leave blank to disable) |
| `VITE_POSTHOG_KEY` / `VITE_POSTHOG_HOST` | PostHog analytics |
| `VITE_BETA_PASSWORD` | Beta access code (currently `BETA_26`) |
| `VITE_BETA_ENABLED` | Set to `"true"` to show BetaGate |
| `VITE_KODA_ADMIN_UID` | Dylon's UID — gates KODA-GLOBAL challenge creation (`f38aae7d-e953-4a00-a5aa-5370677ca876`) |

> Never commit real credential values to CLAUDE.md or any tracked file.

---

## People / Beta Team

| Person | Email | Role |
|--------|-------|------|
| Dylon Nyland | dnyland420@gmail.com | Founder / developer. Supabase UID: `f38aae7d-e953-4a00-a5aa-5370677ca876`, handle: `@dylontrades` |
| Bruno Lopes | Bmlopes1986@gmail.com | Beta tester |
| Dan Arnold | dannyarnold0509@gmail.com | Beta tester |

---

## Deploying

**No git repo** — deploy directly via Vercel CLI:

```powershell
cd "C:\Users\Dylon\OneDrive\Desktop\koda"
vercel --prod
```

Rollback: Vercel Dashboard → Deployments → previous green deploy → Promote to Production.

**After any Supabase schema change**, run the migration SQL manually in Supabase SQL Editor, then run `NOTIFY pgrst, 'reload schema';` to flush the PostgREST schema cache.

---

## App Screens

- **Home** — dashboard, P&L, stats, streaks
- **Log** — add/view/edit trades, Review Inbox for auto-synced drafts
- **Feed** — friend activity
- **Circles** — Trading Circles (leaderboard, chat, challenges, join/create)
- **Sync** — broker connections (Tradovate) + CSV import + audit log
- **Settings** — profile, dark mode, export, delete account

---

## Features

- Trade logging with P&L, R-multiple, notes, screenshots, emotional state, rule adherence
- Stats dashboard (win rate, avg R, streak, equity curve, MAE/MFE, session heatmaps, day-of-week)
- Supabase persistence across devices
- Trading Circles — create/join by code, leaderboard (top 5 visible, rest blurred), live chat, challenges
- Friend feed — follow by handle, see friends' trades
- Public profiles — ProfileModal with stats + follow/unfollow
- 5-step onboarding + post-onboarding survey (prior tool, almost-stopped reason)
- First-session survey (shown after onboarding, before main app)
- Stripe billing (Free / Pro / Elite)
- Tradovate live sync — encrypted token storage, FIFO fill matching, idempotent upsert
- CSV import — 7 broker presets (Tradovate, Rithmic, TradingView, MT4/MT5, NinjaTrader 8, TopstepX, FTMO/MT5)
- Lot Size Calculator — 16 futures contracts, floating button
- PostHog analytics — EU cloud
- Beta access wall (BetaGate) — `VITE_BETA_PASSWORD` env var controlled
- Prop firm eval mode — profit target, daily loss limit, max drawdown tracking
- Feedback button → Telegram bot (@Tradrfeedbackbot)
- PWA — installable on iOS/Android

---

## Key Bugs Fixed (don't re-introduce)

| Bug | Fix |
|-----|-----|
| `React is not defined` at runtime | Used `React.useState` instead of imported `useState` |
| Onboarding loop for new users | Write `localStorage.setItem("koda_onboarded_${uid}", "1")` immediately in `onComplete`, before async Supabase save |
| `isJoiningCircle is not defined` | State in Koda.tsx wasn't passed as prop to TradingCircles — add to JSX call and function signature |
| ProfileModal "Profile not found" | Fall back to feed data (authorName/authorAvatar) when `profile_pub` not found |
| Vercel runtime error `nodejs20.x` | Change all `api/*.ts` config to `runtime: "nodejs"` |
| Koda.tsx truncated to 0 bytes | OneDrive write race — always use atomic write (write to `.tmp`, then `os.replace()`) |
| `Stripe.LatestApiVersion` TS error | Replace `as Stripe.LatestApiVersion` with `as any` |
| `isOwner` crash for KODA-GLOBAL users | `isPro` was passed as prop to TradingCircles but never destructured — added to function signature |
| Re-signup onboarding skipped | `clearStorageCache()` didn't clear `koda_onboarded_*` keys — now it does |
| `delete-account` profiles not deleted | `col: "id"` should be `col: "user_id"` for profiles table |
| `check_and_increment_rate_limit` failing | `shared_kv.owner_id` is NOT NULL — use sentinel UUID `'00000000-0000-0000-0000-000000000000'::uuid` |
| Circle chat send `PGRST204` | `sender_handle` column was missing — added via `ALTER TABLE circle_messages ADD COLUMN IF NOT EXISTS sender_handle text` |
| Circle chat messages not live | `circle_messages` wasn't in `supabase_realtime` publication — added via migration + 8s poll fallback |
| Feedback button intercepting chat Send | FAB positioned over Send on mobile — hidden when `view === "circles"` |
| PostgrestError swallowed in chat | Not `instanceof Error` — extract `.message` from any object shape |

---

## Code Patterns

### Storage (current prod path)
```tsx
// Private
const data = await storage.get("koda_profile");
await storage.set("koda_profile", JSON.stringify(profile));

// Shared (shared_kv)
await storage.set("koda_circle_XXXX", JSON.stringify(meta), true);
```

### Feature flags
```tsx
import { isFlagOn } from "./lib/flags";
if (isFlagOn("newProfile")) { /* v2 */ } else { /* legacy KV */ }
// Toggle: window.kodaFlags.enableFlag("newProfile"); location.reload();
```

### KODA-GLOBAL
- Circle code: `KODA_GLOBAL_CODE = "KODA-GLOBAL"` (from `src/hooks/useCircles.ts`)
- `owner_id` in shared_kv is sentinel UUID — no real user owns it
- Challenge creation gated on `VITE_KODA_ADMIN_UID` env var matching `profile.uid`

### Writing large files
Koda.tsx is ~4100 lines. OneDrive can truncate large writes. Use Edit tool for targeted changes. Verify build passes after any large edit.

---

## Migrations Applied (Supabase)

| File | Description | Status |
|------|-------------|--------|
| `001_rls_cleanup.sql` | RLS policy cleanup + indexes | ✅ |
| `002_v2_schema_additive.sql` | v2 tables: profiles, trades, circles, circle_members, follows | ✅ |
| `003_storage_bucket.sql` | Trade screenshot storage bucket | ✅ |
| `004_plan_jwt_claims.sql` | JWT plan claim hook for Stripe | ✅ |
| `005_broker_sync.sql` | broker_connections + sync_events tables | ✅ |
| `20260523_atomic_rate_limit.sql` | `check_and_increment_rate_limit` function | ✅ |
| `20260524_user_kv_rls.sql` | user_kv RLS hardening + shared_kv owner_id NOT NULL | ✅ |
| `20260531_circle_messages_realtime.sql` | circle_messages → REPLICA IDENTITY FULL + supabase_realtime | ✅ |
| `20260531_fix_rate_limit_owner_id.sql` | Fix rate limit to use sentinel owner_id | ✅ |

---

## Open / Pending

- **Telegram feedback**: @Tradrfeedbackbot needs to be added to group `-5187303282`. Even with correct chat ID, bot must be a group member to send messages. Verify by forwarding a message from the group to `@userinfobot` to confirm the group ID matches.
- **v2 data migration**: profiles, follows, circles, trades all still reading from KV. Migration plan: dual-write behind feature flag, backfill, flip flag, delete old path. Do profile first (smallest blast radius), trades last.
- **Split Koda.tsx**: ~4100 lines — extract remaining inline screens to reduce file size.
- **Playwright smoke test**: sign in → log trade → join circle — run on every deploy.

---

## Backlog

**Sprint 4 — Advanced Analytics**
- [ ] MAE/MFE per trade (broker data available)
- [ ] Commission/fee tracking (gross vs net P&L)
- [ ] Drill-down to individual trades per setup
- [ ] Custom date range picker

**Sprint 5 — Monetisation**
- [ ] Basic AI insights ("You make 80% of profit before 11am ET")
- [ ] TradingView chart embed on trade detail

**Other**
- [ ] Push notifications for circle activity
- [ ] Google OAuth (wired, not configured in Supabase — remove button or configure)
- [ ] Multiple accounts (prop eval 1, prop eval 2, personal)
- [ ] Rithmic / NinjaTrader 8 / TopstepX live API connections
