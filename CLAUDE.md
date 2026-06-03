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

**Live URL:** https://kodatrade.co.uk
**Vercel project:** `tradr.dt` (account: `dylnyland4459-1994`)
**Supabase project ID:** `vifwjwsndchnrpvfgrmg`
**Git repo:** `https://github.com/dtrades4459/koda.git` (`main`). **Pushes to main auto-deploy via Vercel** — `git push origin main` IS the deploy. `npm run build` locally before pushing to catch missing-import failures.
**Working dir:** `C:\Users\Dylon\OneDrive\Desktop\koda`

### Pre-commit hook (`.husky/pre-commit`)

Runs `lint-staged` → `eslint`, then `npm run typecheck`, then a regex check that **blocks** new staged additions matching:
- `: any` annotations (use a proper type or `unknown` + type guard)
- `eslint-disable` comments other than `react-hooks/exhaustive-deps`

Do **not** bypass with `--no-verify`. If the hook fails, fix the underlying issue. Caveat: `git add <file>` stages the **whole** working-tree state of that file — if a file had prior uncommitted edits, run `git diff --staged <file>` before `git commit` to confirm you're only shipping intended changes. (See incident 2026-06-02: stray `IdeasScreen` import bundled into an audit commit broke prod for ~5 min.)

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
| `src/NewsScreen.tsx` | News tab — economic calendar + headlines, filter chips, tz picker, expandable cards |
| `src/components/HomeNewsWidget.tsx` | Hero countdown + week strip widget on Home feed |
| `src/hooks/useNews.ts` | Reads `news_cache` rows via supabase, parses defensively, refetches on visibility change |
| `src/lib/news.ts` | News types (`CalendarEvent`, `Headline`, `Impact`, `NewsCache<T>`) + defensive parsers |
| `src/lib/tilt.ts` | Pure tilt evaluator — `evaluateTilt(trades, profile, now)`. No React, no DB. 5 signals + firing rule. Test in `src/lib/tilt.test.ts` (22 cases). |
| `src/hooks/useTiltState.ts` | Memoised evaluator + cooldown read/write to `koda_intervention_lockout` user_kv key. Reads `profile.prefs.intervention` for settings. |
| `src/data/interventions.ts` | CRUD against `public.intervention_events`. `logInterventionEvent`, `linkTradeToRecentIntervention`, `getInterventionStats`. Emits `intervention_fired` PostHog event. |
| `src/components/InterventionSheet.tsx` | Presentational sheet (mobile) / modal (desktop). Backdrop tap = same as Cancel button. No silent dismiss. |
| `src/components/InterventionGate.tsx` | Reusable gate wrapper — passthrough / cooldown pill / tap intercept. Not yet wired into Koda.tsx (centralised `attemptLog()` handler used instead). |
| `src/components/InSessionStatsCard.tsx` | Stats-tab card showing 7-day intervention rollup. Hides when no events. |
| `src/IdeasScreen.tsx` | Ideas tab feed — paginated list, composer trigger, optimistic likes, chart lightbox |
| `src/IdeaComposer.tsx` | New-idea form (modal on desktop, bottom sheet on mobile) — type toggle, structured fields, optional chart, optional linked trade |
| `src/components/IdeaCard.tsx` | Idea card — collapsed + expanded modes; renders chart thumbnail (collapsed) or full chart (expanded) |
| `api/ideas.ts` | `?action=list` (paginated, with like counts + `liked_by_me`), `create`, `like` (toggle), `delete` — all auth-gated |
| `api/push.ts` | `?action=subscribe` (save sub), `send` (per-user), `notify-circle` (authed, sends to circle members), `broadcast` (cron-secret-gated, sends to all subs) |
| `api/telegram.ts` | Telegram webhook — admin commands: `/announce <msg>`, `/test`, `/help`; admin ID: `7587404723`; uses `TELEGRAM_BOT_TOKEN2` + `TELEGRAM_WEBHOOK_SECRET` |
| `api/cron.ts` | Cron router. `?job=complete-challenges` (daily), `sync` (5min via GH Action), `daily-digest` (daily), `news-calendar` (daily via Vercel cron, fetches ForexFactory), `news-headlines` (every 30min via GH Action, fetches Marketaux). All gated by `Bearer CRON_SECRET`. |
| `api/delete-account.ts` | POST — full user data wipe (broker tokens → trades → profiles → user_kv → shared_kv → auth.users) |
| `api/feedback.ts` | POST → Telegram bot (@Tradrfeedbackbot) |
| `api/broker/[action].ts` | Tradovate connect/disconnect |
| `api/cron/sync.ts` | Broker sync (every 5 min via GitHub Actions) |
| `.github/workflows/news-cron.yml` | Triggers `?job=news-headlines` every 30min; `workflow_dispatch` also refreshes `news-calendar` |
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
- **Gotcha:** `owner_id` has a FK to `auth.users` and the sentinel UUID is NOT in `auth.users` — direct upserts with the sentinel return a FK violation. Rate-limit gets around this via a `SECURITY DEFINER` RPC. For new system-owned cache data, prefer a dedicated table (see `public.news_cache`).

### `public.profiles` (v2 — live but behind `newProfile` flag)
- One row per user: `user_id`, `handle`, `name`, `avatar`, `bio`, `onboarded`, `prefs` (jsonb), etc.

### `public.trades` (v2 — live)
- One row per trade: `user_id`, `client_id`, `external_id`, `source`, `review_status`, etc.

### `public.circle_messages`
- `id`, `circle_code`, `sender_id`, `sender_handle`, `sender_name`, `sender_avatar`, `body`, `created_at`
- Has `REPLICA IDENTITY FULL` and is in `supabase_realtime` publication (migration `20260531_circle_messages_realtime.sql`)

### `public.notification_subscriptions`
- `user_id`, `endpoint`, `p256dh`, `auth_key`
- Upsert on conflict `(user_id, endpoint)` — keeps latest subscription per browser/device
- 410/404 expired subs are pruned automatically during broadcasts

### `public.announcements`
- `id`, `message`, `created_at`, `is_active`
- Inserted/managed by Telegram admin bot `/announce` command
- Frontend reads latest `WHERE is_active = true`; dismissal stored in `localStorage` keyed by `id`
- **Requires migration** — see NEXT_SESSION.md §2A if not yet created

### `public.news_cache`
- `key text primary key`, `value jsonb`, `updated_at timestamptz`
- One row per source: `koda_news_calendar` (ForexFactory), `koda_news_headlines` (Marketaux)
- Refreshed by `api/cron.ts` jobs `news-calendar` (Vercel daily cron) and `news-headlines` (GitHub Actions every 30min)
- RLS: public select; writes via service role only (no insert policy needed)
- Created via migration `20260601_news_cache.sql`

### `public.ideas`
- One row per published Idea (pre-trade setup or post-trade breakdown)
- Columns: `id uuid`, `author_uid uuid → auth.users`, denorm `author_handle/name/avatar`, `type 'pre'|'post'`, `title` (≤120), `body` (≤4000), `instrument` (≤32), `timeframe`, `direction 'long'|'short'|'neutral'`, `entry_price/stop_price/target_price/chart_url/linked_trade_id`, `created_at`
- Indexes: `created_at desc`, `author_uid`
- RLS: all authenticated read; insert/delete only where `auth.uid() = author_uid`
- Created via migration `20260602_ideas.sql`

### `public.idea_likes`
- One row per (idea, user) like — UNIQUE `(idea_id, user_uid)`
- FK cascade on both `idea_id` and `user_uid`
- RLS: all authenticated read; insert/delete only own rows
- Toggle behaviour lives in `api/ideas.ts?action=like` — inserts or deletes the row, returns `{liked, count}`
- Created via migration `20260602_ideas.sql`

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
| `TELEGRAM_BOT_TOKEN2` | Kōda admin bot token (distinct from feedback bot) |
| `TELEGRAM_WEBHOOK_SECRET` | `x-telegram-bot-api-secret-token` verification value |
| `VITE_SENTRY_DSN` | Optional Sentry DSN (leave blank to disable) |
| `VITE_POSTHOG_KEY` / `VITE_POSTHOG_HOST` | PostHog analytics |
| `VITE_BETA_PASSWORD` | Beta access code (currently `BETA_26`) |
| `VITE_BETA_ENABLED` | Set to `"true"` to show BetaGate |
| `VITE_KODA_ADMIN_UID` | Dylon's UID — gates KODA-GLOBAL challenge creation (`f38aae7d-e953-4a00-a5aa-5370677ca876`) |
| `MARKETAUX_API_KEY` | Marketaux free-tier API token — used by `api/cron.ts` news-headlines job |

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

- **Home** — dashboard, P&L, stats, streaks, news widget at top
- **News** — top-level tab; US economic calendar (Today/Week) + headlines feed; impact + USD-only + timezone filters
- **Log** — add/view/edit trades, Review Inbox for auto-synced drafts
- **Circles** — Trading Circles (leaderboard, chat, challenges, join/create)
- **Social** — `Feed` / `Ideas` / `People` sub-tabs (renders `src/FriendsFeed.tsx`). Feed is the follow-graph activity stream; Ideas is the chronological public Ideas board (renders `src/IdeasScreen.tsx` embedded); People is following/followers management.
- **Sync** — broker connections (Tradovate) + CSV import + audit log
- **Settings** — profile, dark mode, export, delete account

Bottom-nav tabs (mobile): Home / News / Stats / Circles / Social. Sub-sections under Home accessed via the dropdown (Analytics, Rules & Checklist, Sync & Log, Journal).

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
- Push notifications — OS-level; Settings toggle; circle messages trigger push to all other members
- Telegram admin bot — `/announce <msg>` broadcasts push to all subscribers + shows in-app banner; `/test`, `/help`
- In-app announcement banner — dismissible; fetches from `announcements` table; triggered by Telegram `/announce`
- News section — economic calendar (ForexFactory) + headlines feed (Marketaux). Free for all users. Home widget shows next high-impact event + week strip. Full page has Today/Week range pills, impact filter chips, USD-only/all-FX toggle, timezone picker (Local/ET/London/UTC), tap-to-expand cards with FORECAST/PREVIOUS/ACTUAL.
- **In-session intervention v1** — Log Trade tap intercepted when tilt signals are active. 5 signals: `consec_losses`, `daily_loss_75`/`90`, `trade_cap_at`, `revenge_window`, `tilt_emotion`. Firing rule: 1 critical OR 2+ non-critical. Surface: bottom-sheet (mobile) / centred modal (desktop). Cancel starts a user-configurable cooldown (default 15 min, off/5/15/30). All events recorded in `public.intervention_events`; PostHog event `intervention_fired`; 7-day Stats card surfaces fired/continued/cancelled rollup. Settings: SettingsScreen "Discipline" section. Spec + plan: `docs/superpowers/{specs,plans}/2026-06-02-in-session-intervention-*.md`.
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
| `serviceWorker.ready` hanging on iOS | `.ready` never resolves if SW not active → use `getRegistration()` + explicit `register('/sw.js')` fallback |
| `applicationServerKey` rejected by browser | Must be `Uint8Array`, not raw base64url string → `vapidKey()` function in SettingsScreen converts correctly |
| Push subscribe 500 (server) | `SUPABASE_ANON_KEY` not set in Vercel → use service-role client's `auth.getUser(token)` instead |
| `notify-circle` wrong member lookup | Was querying `shared_kv` with key prefix → use `circle_members` table |
| Telegram webhook 307 redirect | `kodatrade.co.uk` → `www.kodatrade.co.uk` 307; Telegram doesn't follow → webhook URL must use `www.` |
| Telegram function dying before work | `res.status(200).json()` called before awaits — Vercel terminates function after response → moved all awaits before final res.json |
| iOS P&L minus key missing | `inputMode="decimal"` has no `−` key on iOS → `type="text"` + `+/−` toggle buttons |
| News cron returned 500 (FK violation) | `shared_kv.owner_id` has FK to `auth.users`; sentinel UUID isn't there. Created dedicated `news_cache` table instead. |
| GH Actions news cron hit 307 redirect | `kodatrade.co.uk` → `www.kodatrade.co.uk` 307; bare-domain curl fails. Workflow uses `www.kodatrade.co.uk/api/cron?job=...`. |
| Vercel prod build `UNRESOLVED_IMPORT ./IdeasScreen` after audit commit `a05c9e3` | `git add src/FriendsFeed.tsx` staged the whole working-tree state, including a prior local-only `import { IdeasScreen }` line whose target wasn't in git yet. Fixed by committing the full Ideas feature set (`85b5041`). Always `git diff --staged` after `git add` when the file had prior local edits. |
| Members tab "Follow" button broke build with `no-unused-expressions` lint error | Used a ternary expression as a statement: `isFollowing ? unfollowUser(c) : followUser(c);` — convert to `if/else` instead. |
| `circle_messages` SELECT policy was `USING (true)` — any auth'd user could dump every circle's chat | Use a membership-gated `EXISTS (SELECT 1 FROM circle_members cm WHERE cm.circle_code = circle_messages.circle_code AND cm.user_id = auth.uid())` policy. Fixed in `20260603_circle_messages_members_only.sql`. When adding a new policy on a per-circle table, copy the `cm_read_member` pattern from `circle_members`, NOT the `shared_kv_select` pattern (which is intentionally `USING (true)` for the leaderboard use case). |

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
| `20260601_notification_subscriptions.sql` | `notification_subscriptions` table (created manually in SQL Editor) | ✅ |
| `20260601_announcements.sql` | `announcements` table + RLS (see NEXT_SESSION.md §2A — **run if not done**) | ⚠️ pending |
| `20260601_news_cache.sql` | `news_cache` table (public read, service-role writes) for the News section | ✅ |
| `20260603_intervention_events.sql` | `intervention_events` table + RLS for in-session intervention v1 | ✅ |
| `20260603_circle_messages_members_only.sql` | Restrict `circle_messages` SELECT to circle members (was `USING (true)`) — closes the cross-circle read documented in `.gstack/security-reports/2026-06-03-cso-audit.md` Finding 1 | ✅ |

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
- [x] Push notifications for circle activity ✅ shipped 2026-06-01
- [x] News section — economic calendar + headlines ✅ shipped 2026-06-01
- [ ] Google OAuth (wired, not configured in Supabase — remove button or configure)
- [ ] Multiple accounts (prop eval 1, prop eval 2, personal)
- [ ] Rithmic / NinjaTrader 8 / TopstepX live API connections

---

## Design System

Always read `DESIGN.md` before making any visual or UI decisions.
All font choices, colors, spacing, and aesthetic direction are defined there.
Do not deviate without explicit user approval.

Key rules:
- Dark mode is primary. `#13110E` background, not `#000` or `#111`.
- Accent is blue (`oklch(0.74 0.16 250)`), CTAs use `live` (mint). Green/red are outcomes only — never use green as a brand or action color.
- All labels, kickers, nav items, and metadata: Geist Mono, uppercase, wide-tracked.
- All inputs: `font-size: 16px` (iOS zoom prevention), transparent bg, border-bottom only.
- Minimum touch target: 44px height.
- In QA mode, flag any code that deviates from DESIGN.md without a documented reason.
