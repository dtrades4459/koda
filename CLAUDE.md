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
| `src/data/chatReads.ts` | `markChatRead(code)` + `getUnreadCounts(codes)` — reads/writes `chat_reads` table for unread chat badges |
| `src/data/notificationFeed.ts` | `listNotifications(limit)` + `markNotificationsRead(ids)` — reads/writes `notification_feed` (in-app inbox) |
| `src/data/notifications.ts` | Client-side `notifyReaction` wrapper for `/api/push?action=notify-reaction` — best-effort fire-and-forget |
| `src/hooks/useUnreadCircles.ts` | Polls per-circle unread counts every 30s; drives both circle-list badges and the Circles nav-tab dot |
| `src/hooks/useUnreadNotifications.ts` | Polls notification_feed unread count every 30s; drives Social nav-tab dot. Returns `{ count, refresh }` |
| `src/components/NotificationFeed.tsx` | Activity inbox UI — kind-specific icons, skeleton loading, error+retry state, optimistic mark-read with 250ms fade |
| `api/ideas.ts` | `?action=list` (paginated, with like counts + `liked_by_me`), `create`, `like` (toggle, fires `notify-like` via `deliverNotification`), `delete` — all auth-gated |
| `api/push.ts` | `?action=subscribe`, `send`, `notify-circle` (chat msg), `notify-follow`, `notify-circle-join`, `notify-reaction`, `notify-like`, `broadcast`. Exports shared `deliverNotification(opts)` helper that writes to `notification_feed` + fans out web push. |
| `api/telegram.ts` | Telegram webhook — admin commands: `/announce <msg>`, `/test`, `/help`; admin ID: `7587404723`; uses `TELEGRAM_BOT_TOKEN2` + `TELEGRAM_WEBHOOK_SECRET` |
| `api/cron.ts` | Cron router. `?job=complete-challenges` (daily), `sync` (5min via GH Action), `daily-digest` (daily), `news-calendar` (daily via Vercel cron, fetches Finnhub economic calendar), `news-headlines` (every 30min via GH Action, fetches Marketaux), `weekly-digest` (Sun 18:00 UTC, aggregates last 7 days of `notification_feed` per user, sends one consolidated push). All gated by `Bearer CRON_SECRET`. |
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
- The old FK from `owner_id` to `auth.users` was **dropped** 2026-06-09 (`20260615_seed_competition_circle.sql`) — sentinel-UUID upserts now work directly. RLS still enforces ownership on writes.

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

### `public.chat_reads` (engagement loop, shipped 2026-06-03)
- `user_id uuid`, `circle_code text`, `last_read_at timestamptz`, composite PK `(user_id, circle_code)`
- Tracks the boundary between read/unread chat messages per user per circle
- RLS: user manages only their own rows (select/insert/update/delete all gated on `auth.uid() = user_id`)
- Powers the unread badge on the circles list, the NEW divider in chat, and the Circles nav-tab dot
- Created via migration `20260603_chat_reads.sql`

### `public.notification_feed` (engagement loop, shipped 2026-06-03)
- `id uuid PK`, `user_id uuid`, `kind text` (check: follow / circle_join / reaction / idea_like / digest), `data jsonb`, `created_at timestamptz`, `read_at timestamptz`, `aggregated_at timestamptz`
- Paper trail for the in-app Activity inbox. Every push notification also writes a row here.
- Partial indexes: `(user_id, created_at desc) WHERE read_at is null` for nav badge; `(user_id, created_at) WHERE aggregated_at is null` for weekly digest cron
- RLS: select + update for owner only. NO insert/delete by authenticated users — all writes via service role (`api/push.ts`, `api/cron.ts`)
- Created via migration `20260603_notification_feed.sql`

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
| `BETA_PASSWORD` | Beta access code (server-only — currently `BETA_26`; verified by `api/account.ts handleBetaUnlock`) |
| `VITE_BETA_ENABLED` | Set to `"true"` to show BetaGate UI |
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
- **Social** — `Feed` / `Ideas` / `People` / `Activity` sub-tabs. Feed/Ideas/People render `src/FriendsFeed.tsx` (tab state is lifted into `src/Koda.tsx`'s `socialSection` and passed in as `section` + `onSectionChange` props). Activity renders `src/components/NotificationFeed.tsx` (the in-app inbox). Social nav tab gets an unread dot driven by `useUnreadNotifications`.
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
- Push notifications — OS-level; Settings toggle; circle messages trigger push to all other members. **Engagement loop** (shipped 2026-06-03) also fires pushes on: someone follows you, someone joins a circle you own, someone reacts to your feed trade or shared trade, someone likes your idea. Every push also writes a row to `notification_feed` so the in-app Activity inbox shows the same activity. Weekly digest cron (Sunday 18:00 UTC) sends one consolidated summary push per active user.
- Unread chat state — chat tab open marks `chat_reads.last_read_at`, badge on each circle in the list shows unread count, NEW divider appears in chat above the first unread message, Circles nav-tab gets a small unread dot. Polled every 30s as a backstop for missed realtime events.
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
| Chat messages stopped loading after applying the members-only RLS | The codebase only writes circle membership to KV (`koda_circle_member_*`), not to `public.circle_members`. The new strict policy required a row in `circle_members`, which was empty → every read blocked. **Temporary unblock:** revert the policy to `USING (true)`. **Proper fix:** backfill `circles` and `circle_members` from the KV rows, then re-apply the strict policy. Tracked on whiteboard 2026-06-03. |

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
| `20260601_announcements.sql` | `announcements` table + RLS — verified 2026-06-04: RLS enabled, single `announcements_read` policy (`USING (true)` for authenticated, writes service-role only). Safe. | ✅ |
| `20260601_news_cache.sql` | `news_cache` table (public read, service-role writes) for the News section | ✅ |
| `20260603_intervention_events.sql` | `intervention_events` table + RLS for in-session intervention v1 | ✅ |
| `20260603_circle_messages_members_only.sql` | Strict `circle_messages` SELECT policy. Applied + reverted 2026-06-04 (recursive `cm_read_member` zeroed the EXISTS). Superseded by `20260610_circle_messages_strict_rls.sql`. | ⛔ superseded |
| `20260610_circle_messages_strict_rls.sql` | Runbook C closed: `SECURITY DEFINER is_circle_member(text)` helper + non-recursive `cm_read_member` + strict members-only `circle_messages` SELECT. Applied + verified 2026-06-10. | ✅ |
| `20260603_chat_reads.sql` | `chat_reads` table for engagement loop unread tracking | ✅ |
| `20260603_notification_feed.sql` | `notification_feed` table for engagement loop in-app inbox + weekly digest | ✅ |
| `20260604_backfill_circles_and_members.sql` (applied as SQL paste) | Backfilled `public.circles` (1 row: KODA-GLOBAL) and `public.circle_members` (14 rows) from `koda_circle_*` KV rows. Sentinel-UUID-owned KODA-GLOBAL maps to Dylon's UID. | ✅ |
| `20260604_shared_kv_circle_sync_triggers.sql` (applied as SQL paste) | Three triggers on `public.shared_kv` keep `public.circles` and `public.circle_members` in sync with `koda_circle_*` / `koda_circle_member_*` writes/deletes. Forward-compat for the eventual strict RLS restore — no client-code change required when it lands. | ✅ |

---

## Open / Pending

- **Telegram feedback**: @Tradrfeedbackbot needs to be added to group `-5187303282`. Even with correct chat ID, bot must be a group member to send messages. Verify by forwarding a message from the group to `@userinfobot` to confirm the group ID matches.
- **v2 data migration**: profiles, follows, circles, trades all still reading from KV. Migration plan: dual-write behind feature flag, backfill, flip flag, delete old path. Do profile first (smallest blast radius), trades last.
- ~~**`circle_messages` strict RLS restore**~~ — CLOSED 2026-06-10 via `20260610_circle_messages_strict_rls.sql`. Chat reads are members-only; banned members excluded.
- **`trade-screenshots` bucket is PRIVATE** (since 2026-06-10): never render a stored screenshot URL with a bare `<img src>` — always go through `SignedImg` / `useSignedUrl` / `resolveScreenshotUrl` (`src/lib/screenshots.ts`). Stored values stay as legacy public-URL strings; they are path identifiers now.
- **Broker auto-sync (Tradovate) — `liveBrokerSync` flag gated**: Live Connections panel + connect/disconnect/manual-sync wiring shipped 2026-06-04 in `src/DataSourcesScreen.tsx`. Gated behind `isFlagOn("liveBrokerSync")` because Tradovate's Partner API requires partner-program approval (not self-serve) — confirmed from `partner.tradovate.com/llms-full.txt`. Path forward is either (a) email Tradovate Eval Support to apply, or (b) lean into CSV as the live broker integration. Old `useTradovate` hook + `api/tradovate.ts` proxy + `src/lib/tradovate.ts` + ~150 lines of dead UI in `Koda.tsx` (home widget + connect sheet) are still wired but non-functional — queued for a focused removal session.
- **Engagement loop follow-ups** (per `docs/superpowers/plans/2026-06-03-social-retention-roadmap.md`): moderation, leaderboard integrity, KV→Postgres unification, Ideas→Feed integration, badges, comments, viral invites. Sequenced; ship moderation before badges/comments/viral.
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
- [x] News calendar source: ForexFactory → Finnhub (FF feed never populated actuals) ✅ shipped 2026-06-03
- [x] Engagement loop — read/unread chat, follow/join/reaction/like push notifications, weekly digest, Activity inbox ✅ shipped 2026-06-03 (PR #23 merged as `b3cb61c`)
- [x] Deterministic-Stats UI — reusable `<ComputedBadge/>` component, deployed on home stats + discipline card + PDF footer ✅ shipped 2026-06-03
- [ ] Google OAuth (wired, not configured in Supabase — remove button or configure)
- [ ] Multiple accounts (prop eval 1, prop eval 2, personal)
- [ ] Rithmic / NinjaTrader 8 / TopstepX live API connections

---

## Skill routing

When the user's request matches an available skill, invoke it via the Skill tool. When in doubt, invoke the skill.

Key routing rules:
- Product ideas/brainstorming → invoke /office-hours
- Strategy/scope → invoke /plan-ceo-review
- Architecture → invoke /plan-eng-review
- Design system/plan review → invoke /design-consultation or /plan-design-review
- Full review pipeline → invoke /autoplan
- Bugs/errors → invoke /investigate
- QA/testing site behavior → invoke /qa or /qa-only
- Code review/diff check → invoke /review
- Visual polish → invoke /design-review
- Ship/deploy/PR → invoke /ship or /land-and-deploy
- Save progress → invoke /context-save
- Resume context → invoke /context-restore
- Author a backlog-ready spec/issue → invoke /spec

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
