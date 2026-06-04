# Kōda — pickup for next session

**Session closed:** 2026-06-04 (Thursday — afternoon).
**Beta launched:** live at kodatrade.co.uk
**Last pushed commit:** see `git log -1 --format=%h`
**Prior sessions:** 2026-06-02 (in-session intervention v1), 2026-06-03 (engagement loop — chat read/unread, follow notifications, weekly digest), 2026-06-04 (this — pre-flight audit + cleanup).

This doc is the single source of truth for resuming work. Read this first.

---

## 0 · What shipped this session (2026-06-04) — PRE-FLIGHT AUDIT + CLEANUP

A full security / architecture / scope-creep audit of the beta codebase, followed by a focused cleanup sweep.

### Confirmed safe
- **`public.announcements` RLS** — checked live: RLS on, single `announcements_read` SELECT policy (`USING (true)` for authenticated), no INSERT/UPDATE/DELETE policies for authenticated. Writes service-role only. ✅

### Shipped (live on `main`)
- **Backfill of `public.circles` + `public.circle_members`** from KV `koda_circle_*` rows. 1 circle (KODA-GLOBAL), 14 members. KODA-GLOBAL meta row's sentinel UUID owner was rewritten to Dylon's UID.
- **Three triggers on `public.shared_kv`** to keep `circles` and `circle_members` in sync on future create / join / leave. Forward-compat for the eventual strict RLS restore — no client code change needed when the policy is re-applied.
- **`Live Connections` panel in `src/DataSourcesScreen.tsx`** — gated behind `isFlagOn("liveBrokerSync")`. Bundled with three latent client-side bugs fixed (`handleConnect` was sending `name` instead of `username`; `handleDisconnect` was sending `connectionId` instead of `{broker,env}`; success toast was reading non-existent `data.message`). Plus a manual "↻ Sync now" button calling `/api/cron?job=sync`.
- **Lazy-init for `webpush.setVapidDetails`** in `api/push.ts` and `api/telegram.ts`. A missing VAPID env var no longer crashes the whole module on cold start — only the broadcast handlers throw.
- **Dead-code deletes:** `src/PaywallScreen.tsx` (orphan), `src/components/ProGate.tsx` + test (replaced by inline `isPro` + `ProLock`), empty `koda/` subdir at repo root.
- **`.env.example` + `CLAUDE.md` corrected** to drop the vestigial `VITE_BETA_PASSWORD` (the real var is server-only `BETA_PASSWORD`).
- **`CLAUDE.md` migration table refreshed**: announcements ✅, `circle_messages_members_only` reverted with proper fix-path documented, backfill + triggers tracked.

### Attempted and rolled back (with a reason worth remembering)
- **`circle_messages_select` strict policy applied → broke chat → reverted.** Root cause: `cm_read_member` on `public.circle_members` (from migration 002) is recursive. When the strict `circle_messages_select` EXISTS subquery runs, RLS applies to the inner SELECT, recursion is detected, and the inner query silently returns zero rows. Net result: every chat read blocked for every user. The backfill + triggers stay in place because they're correct — only the policy was rolled back. Proper fix (Runbook C, queued): rewrite `cm_read_member` non-recursively + add a `SECURITY DEFINER is_circle_member(text)` helper, then re-apply the strict policy.

### Confirmed dead-end (not a code change — a strategy decision)
- **Tradovate Partner API is not accessible to journaling apps.** Read `partner.tradovate.com/llms-full.txt`. The program is for prop firms and trading platforms that own/manage trader accounts. No self-serve signup, no personal-use tier, gated behind their Eval Support team. Auth flow assumes partners create their own users — random Tradovate-account-owners cannot connect their existing accounts. **Decision:** `liveBrokerSync` flag stays default-off. The Live Connections panel sits ready behind it. CSV import remains the live broker integration. Optional next action: email Tradovate Eval Support to plant the seed.

---

## 0a · Open / Pending — ordered by priority

1. **`circle_messages` strict RLS — Runbook C.** Non-recursive `cm_read_member` + `SECURITY DEFINER is_circle_member(text)` helper + re-apply `20260603_circle_messages_members_only.sql`. ~30-45 min careful work + smoke test.
2. **`trade-screenshots` private bucket — Runbook B.** Bucket is currently `public:true`; any UID can fetch any trader's screenshots via the permanent CDN URL. Approach A from the audit: create `trade-screenshots-private` bucket, dual-write for ~7 days, migrate existing objects + URL rewrites in `public.trades` + the legacy KV `koda_trades` JSON, switch reads to `createSignedUrl()`, then write-disable the public bucket.
3. **`useTradovate` + `api/tradovate.ts` + `src/lib/tradovate.ts` teardown + ~150 lines of dead UI in `Koda.tsx`** (home Tradovate widget + connect sheet). Surgical extraction from the 4,921-line god file — deserves its own focused commit + manual test.
4. **Email Tradovate Eval Support** about Kōda's use case. Free, days-to-weeks reply. Plant the seed even if you don't expect a yes.
5. **CSV import polish as the broker USP**. If broker auto-sync isn't shipping, lean into CSV: better drop-zone, faster broker detection, post-import "you imported N trades — here's your last 7 days" celebration moment.

---

## 0b · Backlog (sorted)

- **UI redesign rollout** (next 1-2 weeks). Dylon has built a complete new mockup in Claude design that supersedes `DESIGN.md` for the surfaces it covers. Open problem to solve: how to port the Claude-design output cleanly into Claude Code → production. Documents to merge into a fresh `DESIGN.md` (or successor) coming from Dylon.
- **Split `src/Koda.tsx`** (~4,921 lines). Extract Home, Stats, Settings, Log into their own files following the `TradingCircles.tsx` pattern.
- **v2 dual-write decision.** `src/data/{trades,profile}.ts` are wired but headers say "NOT WIRED INTO Koda.tsx YET." Some writers (broker sync, stripe webhook) hit only one schema. Drift risk. Either finish (backfill + flip read flag + delete KV writers) or roll back the dual-write.
- **Telegram feedback** @Tradrfeedbackbot needs to be added to group `-5187303282`.
- **Engagement loop follow-ups** (per `docs/superpowers/plans/2026-06-03-social-retention-roadmap.md`): moderation, leaderboard integrity, KV→Postgres unification, Ideas→Feed integration, badges, comments, viral invites.
- **Playwright smoke test**: sign in → log trade → join circle — run on every deploy.

---

## Previous sessions (archived context — read only if needed)

## 0 · What shipped this session (2026-06-02 evening) — IN-SESSION INTERVENTION v1

The wedge feature for the 3-week sprint. End-to-end working locally, NOT YET PUSHED — Dylon's call on when to deploy.

### Architecture
- **Pure evaluator** — `src/lib/tilt.ts` returns `TiltState` from `evaluateTilt(trades, profile, now)`. 5 signals: consec_losses, daily_loss_75/90, trade_cap_at, revenge_window, tilt_emotion. Firing rule: any 1 critical OR ≥ 2 non-critical. 22 unit tests.
- **Hook** — `src/hooks/useTiltState.ts` memoises the evaluator and reads/writes cooldown lockout to `user_kv` key `koda_intervention_lockout`. 3 unit tests.
- **Data layer** — `src/data/interventions.ts` — `logInterventionEvent`, `linkTradeToRecentIntervention`, `getInterventionStats`. Emits PostHog `intervention_fired`.
- **Surfaces** — `InterventionSheet.tsx` (mobile bottom-sheet + desktop modal), `InterventionGate.tsx` (reusable but not wired — see note below), `InSessionStatsCard.tsx` (7-day rollup on Stats tab).
- **Wiring in Koda.tsx** — Centralised `attemptLog()` handler replaces 5 direct `navigateTo("log")` entry points (Home QuickAction chip + 4 EmptyState CTAs). `saveTrades()` extended to link new trades to recent unlinked intervention events. **`InterventionGate` component was NOT used** — the bottom nav has no Log tab and wrapping the QuickAction chip would have broken its flex layout. Component is kept for future use.
- **Settings** — `SettingsScreen.tsx` now has a "Discipline" section: enable/disable toggle + cooldown selector (Off / 5 / 15 / 30 min, default 15).
- **DB** — migration `supabase/migrations/20260603_intervention_events.sql` applied by Dylon at session time. Table is live.

### Test status
- 23 test files / **310 passing** (was 272 at session start)
- `npm run typecheck` clean across app + api
- `npm run build` green
- Playwright spec `tests/in-session-intervention.spec.ts` written but only runs when `TEST_EMAIL`/`TEST_PASSWORD` env vars are set

### Spec + plan
- Spec: `docs/superpowers/specs/2026-06-02-in-session-intervention-design.md`
- Plan: `docs/superpowers/plans/2026-06-02-in-session-intervention-v1.md` (all 19 tasks complete)

### Open follow-ups
- **Push to deploy.** All 19 task commits are local-only. Push when ready.
- **Demo recording.** Plan §12 describes the 3-take phone capture for launch content.
- **Future v2 considerations:** explicit "Start session" button, configurable signal thresholds, prop-firm drawdown-breach signal, intervention firing on CSV imports / broker auto-syncs.
- **InterventionGate component is unused.** Either delete it in a future cleanup pass or use it when adding the visible cooldown pill to the bottom nav (currently the cooldown is a toast-only signal).

---

## 1 · What shipped earlier this session (2026-06-02 morning) — Ideas section + follow-system polish

| # | What | Notes |
|---|------|-------|
| 1 | **Ideas section** | New 5th nav tab `Social` → sub-tabs `Friends · Ideas · People`. Pre-trade setups and post-trade breakdowns. Fully structured: title, body, instrument, direction, timeframe, entry/stop/target, optional chart image, optional linked trade. Public chronological feed with like-only social. Desktop modal composer, mobile bottom sheet. |
| 2 | **Ideas DB** | `public.ideas` + `public.idea_likes` tables with full RLS. Migration `supabase/migrations/20260602_ideas.sql` (manually applied via Supabase SQL Editor). |
| 3 | **Ideas API** | New serverless function `api/ideas.ts` — `?action=list \| create \| like \| delete`. Auth via Bearer JWT. List action joins like counts + `liked_by_me`. |
| 4 | **Ideas frontend** | `src/IdeasScreen.tsx` (feed list + paging + composer trigger + chart lightbox), `src/IdeaComposer.tsx` (form modal/sheet), `src/components/IdeaCard.tsx` (collapsed + expanded modes). Chart uploads go client-side direct to existing `trade-screenshots` bucket (path `ideas/`). |
| 5 | **Idea unit test** | `src/IdeasScreen.test.tsx` — empty state + card render via mocked `fetch` and Supabase client. Both pass. |
| 6 | **Spec + plan** | `docs/superpowers/specs/2026-06-02-ideas-design.md`, `docs/superpowers/plans/2026-06-02-ideas-section.md`. |
| 7 | **Follow system — 6 bugs fixed** | (a) "Follow back" button no longer suffers a state-race; calls `followUser` directly with the row's name/handle. (b) Following list now shows real names + `@handles` not codes — `followUser` writes target info into the follow edge row. (c) Followers list same — follower edge row now carries the follower's name/handle. (d) Feed auto-refresh now gates on `friends.length \|\| following.length` (was `friends.length` only — follow-only users had stale feeds). (e) "Already following" toast distinct from "Following". (f) Optimistic enrichment of `followingProfiles` on follow so name appears immediately. Files: `src/data/follows.ts`, `src/hooks/useFollows.ts`, `src/hooks/useFeed.ts`, `src/Koda.tsx`, `src/FriendsFeed.tsx`. Backward-compatible — old follow rows fall back to code-as-name. |

### Afternoon — Circles + Social audit pass (commits `a05c9e3` + `85b5041`)

| # | What | Notes |
|---|------|-------|
| 1 | **`TradingCircles.tsx` typed** | Replaced `: any` props with full `TradingCirclesProps` interface (+ `LeaderboardEntry`, `CircleFormShape`). One known carve-out: `activeCircle` typed as `Circle \| null \| any` because two internals (line ~408 leaderboard fetch, ~861 setActiveCircle updater) reject strict null narrowing; full clean-up belongs in the [[KodaContext refactor]] (see §5). |
| 2 | **Circles browse — stale rank badge** | Removed `#myRank` chip from the featured browse card — `leaderboard` state was only populated after entering a detail view, so the badge was always stale or empty on first paint. |
| 3 | **Circles Leave dialog** | Replaced `window.confirm` with a bottom sheet (matches existing challenge-creation sheet pattern, uses `kRise` keyframe). |
| 4 | **Circles chat scroll** | `maxHeight: 420px` → `min(60dvh, 520px)` for mobile keyboards. |
| 5 | **Circles dead `blur` param** | Removed from `renderRow` and 3 call sites in the leaderboard — never wired up. |
| 6 | **Circles Members tab — View Profile** | Avatar + name now tap-opens the profile when the member has a `handle`; surfaces `@handle` in place of the opaque `alias`. |
| 7 | **Trophy gold const** | Hardcoded `#A88C50` → `TROPHY_GOLD` constant at top of `TradingCircles.tsx`. |
| 8 | **Loading skeletons** | Bare `"Loading…"` text in Circle Feed / Leaderboard / Chat / Trophies / Members replaced with shimmer skeletons (reuses existing `kShimmer` keyframe from `index.css`). |
| 9 | **Social header rename** | `"What your circle is trading"` → `"What your network is trading"` — resolves naming clash with the Circles tab. |
| 10 | **Social reaction double-render** | Ghost reaction picker now only renders when post has **zero** reactions AND user hasn't reacted; previously duplicated when others reacted but user hadn't. |
| 11 | **Social dead UI removed** | Stripped the no-handler 3-dot kebab on feed posts and the misplaced "Publish feed" button from the Follow panel (useFeed auto-publishes on debounce). |

### Deploy incident worth remembering

Audit commit `a05c9e3` pushed to main → Vercel went `● Error` in 7s with `UNRESOLVED_IMPORT — Could not resolve './IdeasScreen' in src/FriendsFeed.tsx`. Root cause: `git add src/FriendsFeed.tsx` scooped up a prior **uncommitted** `import { IdeasScreen } from "./IdeasScreen"` line; the IdeasScreen module was still untracked locally. Recovery: bundled the full Ideas feature set into a follow-up commit (`85b5041 — feat(ideas+social): ship Ideas section and wire Social tab end-to-end`, 11 files / +1258 / −23). Prod went green 30s later. **Lesson:** when committing a file that had prior local edits, `git diff --staged <file>` before `git commit`.

All deployed to production (READY).

---

## 2 · CRITICAL OUTSTANDING ACTIONS

None currently. The `announcements` SQL, the Stripe webhook URL, and the `ideas` SQL migration are all confirmed applied.

---

## 3 · Serverless function inventory (10 / 12 Hobby limit)

| File | Routes |
|---|---|
| `api/account.ts` | `?action=reset-password`, `beta-unlock`, `join-waitlist`, `feedback`, `delete` |
| `api/stripe.ts` | `?action=checkout`, `portal`, `webhook` |
| `api/cron.ts` | `?job=complete-challenges`, `sync`, `daily-digest`, `news-calendar`, `news-headlines` |
| `api/auth.ts` | (unchanged) |
| `api/tradovate.ts` | (unchanged) |
| `api/circles.ts` | (unchanged) |
| `api/og.ts` | (unchanged) |
| `api/push.ts` | `?action=subscribe`, `send`, `notify-circle`, `broadcast` |
| `api/telegram.ts` | Telegram webhook — `/announce`, `/test`, `/help` |
| `api/ideas.ts` | `?action=list`, `create`, `like`, `delete` |

2 slots free.

---

## 4 · Batch 2 — sign-up compliance (still outstanding)

Needs UK Ltd details. Per `FUNNEL_AUDIT.md` §A2 + §A9:
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

- **M2**: Switch `trade-screenshots` bucket from public → private; replace `getPublicUrl()` with signed URLs (Ideas chart uploads use the same bucket — they'll need signed URLs too)
- The 134 `: any` / `as any` cleanup across 24 files (TradingCircles was tightened 2026-06-02 PM — still has a small `Circle | null | any` carve-out and ~25 inner-render `any` warnings; full pass needs Context refactor)
- `Trade` numeric-type refactor
- **`TradingCircles` → `KodaContext`** — props are typed (`TradingCirclesProps`) but still drilled 30+ deep from `Koda.tsx`. Move to a Context so we can drop the `Circle | null | any` carve-out and stop manual prop threading. (Same pattern needed for `FriendsFeed`.)
- Marketing landing site
- Resend SDK + transactional emails + weekly recap cron
- Meta / TikTok / Google pixels
- Referral programme
- `VITE_KODA_ADMIN_UID` — already in CLAUDE.md env vars; wire up challenge creation guard in `TradingCircles.tsx`
- **Ideas v2** — comments, trending/popular sort, following-only filter, pre-trade → linked outcome trade flow, idea edit, push notifications on new ideas from people you follow
- **Social feed dollar P&L** — `FriendsFeed` always renders trade P&L as R-multiples (`${item.pnl}R`). Dollar-mode traders look broken to their followers. Fix: add `pnlDollar?: string` to `useFeed.FeedItem`, populate from `t.pnlDollar` in `publishFeed`, branch display in `FriendsFeed.tsx`. Migration-free since old rows just won't have the field.
- **Social pull-to-refresh** — `useFeed` already auto-refreshes every 2 min; pull-to-refresh would be the polish layer (gesture or refresh-on-tab-focus).

---

## 6 · Quick reference

```bash
# Dev
npm run dev                  # http://localhost:5173
npm run typecheck            # tsc --noEmit (composite — silently passes child errors; use `npx tsc -p tsconfig.app.json` for strict app check)
npm run lint
npm test -- --run            # unit tests
npm run test:e2e             # Playwright, auto-starts dev server

# Deploy
vercel              # preview (gated by Vercel SSO)
vercel --prod       # production → kodatrade.co.uk
```

**Stable selectors:**
- Bottom nav: `[data-testid="nav-home"]` / `nav-news` / `nav-stats` / `nav-circles` / `nav-social`
- Auth: `[data-testid="auth-submit"]`
- Trade form: `[data-testid="trade-pair"]` / `trade-pnl-dollar` / `trade-save`
- Ideas: `[data-testid="ideas-screen"]` / `idea-fab-new` / `idea-composer` / `idea-card-{id}` / `idea-like-{id}` / `idea-chart-thumb-{id}`

**OneDrive warning still in force.** Large writes to `Koda.tsx` should use Edit, not Write — file is ~4150 lines and can truncate on direct overwrite.
