# TRADR — Project Context for Claude

> Read this file at the start of every session. It covers the full architecture, all decisions made, known issues, and what's next.

---

## What TRADR is

A trading journal PWA for retail traders. Users log trades, track stats (P&L, win rate, avg R), follow friends, and compete in Trading Circles. Built for mobile-first, installable as a home screen app on iOS and Android.

**Live URL:** https://tradrjournal.xyz and https://www.tradrjournal.xyz (both active, custom domain via GoDaddy → Vercel)
**Vercel project:** tradr.dt (dylnyland4459-1994s-projects)
**Supabase project ID:** vifwjwsndchnrpvfgrmg
**GitHub:** public repo, auto-deploys to Vercel on push to main

---

## Stack

- React 19 + TypeScript + Vite
- Supabase (auth + two KV tables: `user_kv` and `shared_kv`)
- Vercel (hosting + serverless functions in `api/`)
- Single-file app: `src/TRADR.tsx` (~5700+ lines, all UI + logic)
- Auth wrapper: `src/TradrAuth.tsx`
- Storage shim: `src/lib/storage.ts` (window.storage — wraps Supabase KV + localStorage cache)

---

## Key Files

| File | Purpose |
|------|---------|
| `src/TRADR.tsx` | Entire app — all screens, state, logic |
| `src/TradrAuth.tsx` | Supabase auth wrapper, installs storage shim after sign-in |
| `src/lib/storage.ts` | `window.storage` shim: `get(key)`, `set(key, value, shared?)` |
| `src/lib/log.ts` | **NEW** Centralized logger — forwards to Sentry if loaded. Use instead of bare `console.error`. |
| `src/lib/sentry.ts` | **NEW** Optional Sentry init. No-op if `VITE_SENTRY_DSN` not set or `@sentry/react` not installed. |
| `src/lib/flags.ts` | **NEW** Feature flag util backed by localStorage. `isFlagOn("name")`. Toggle via `window.tradrFlags.enableFlag("name")`. |
| `src/data/circles.ts` | Circles data layer (existing) — single source for circle key naming + RLS-safe writes. |
| `src/data/follows.ts` | Follows data layer (existing) — per-row follow edges. |
| `src/data/trades.ts` | **NEW (v2 — not wired yet)** Typed CRUD against `public.trades`. Behind `newTrades` flag when ready. |
| `src/data/profile.ts` | **NEW (v2 — not wired yet)** Typed CRUD against `public.profiles`. Behind `newProfile` flag when ready. |
| `src/data/bootstrap.ts` | **NEW (v2 — not wired yet)** Parallel typed loader. Will replace `loadAll()` in `TRADR.tsx`. |
| `src/main.tsx` | Mounts React, installs storage shim before mount, calls `initSentry()`. |
| `api/feedback.ts` | Vercel serverless function — forwards feedback to Telegram |
| `vercel.json` | CSP + security headers |
| `supabase-schema.sql` | **LEGACY** Creates `user_kv` and `shared_kv` tables with RLS. New changes go in `supabase/migrations/` instead. |
| `supabase/migrations/001_rls_cleanup.sql` | **NEW** Removes dead `or like` branches from shared_kv RLS, adds `text_pattern_ops` index for `listByPrefix`. Idempotent. |
| `supabase/migrations/002_v2_schema_additive.sql` | **NEW** Creates v2 tables (`profiles`, `trades`, `circles`, `circle_members`, `follows`) ALONGSIDE the KV tables. No data is migrated. Live app behavior unchanged until flags flip. |
| `.github/workflows/ci.yml` | **NEW** Runs `lint + tsc --noEmit + build` on every PR. Status check should be required for `main`. |
| `DEPLOYMENT.md` | **NEW** Step-by-step runbook for shipping the audit changes safely. |
| `MIGRATION.md` | **NEW** Plan for migrating live data off KV onto v2 tables (dual-write → backfill → flag → cutover). |

---

## Supabase Data Model

### `user_kv` (private per-user)
- `uid` — Supabase auth user ID
- `key` — string key (e.g. `tradr_profile`, `tradr_trades`)
- `value` — JSON blob
- RLS: user can only read/write their own rows

### `shared_kv` (public-readable)
- `key` — string key
- `value` — JSON blob
- RLS: anyone can read, only the owner can write
- Used for: circle data, public profiles (`tradr_profile_pub_{handle}`), friend feeds

### Key storage keys
| Key | Table | Contents |
|-----|-------|----------|
| `tradr_profile` | user_kv | Full profile (private) |
| `tradr_trades` | user_kv | Trade history |
| `tradr_profile_pub_{handle}` | shared_kv | Public profile (name, handle, avatar, bio, publicTrades flag) |
| `tradr_feed_{uid}` | shared_kv | Published trade feed for social/circles |
| `tradr_circle_{code}` | shared_kv | Circle data + members + leaderboard |
| `tradr_following_{uid}` | user_kv | Who the user follows |

---

## Profile Interface (key fields)

```tsx
interface Profile {
  name: string;
  handle: string;         // @username — auto-filled from name during onboarding
  avatar: string;         // emoji (e.g. "🎯") or data:image/ or https:// URL
  bio: string;
  broker: string;
  timezone: string;
  onboarded: boolean;
  publicTrades?: boolean; // toggle in settings — controls if trades show on public profile
  instruments?: string[]; // futures they trade: ["ES", "NQ", "CL", ...]
  socialLinks?: { twitter?: string }; // social handles collected at onboarding
  uid?: string;
  // ... targets, rules, checklist, etc.
}
```

`DEF_PROFILE` = default profile object with all fields, including `instruments: []` and `socialLinks: {}`.

**AvatarCircle** renders emoji avatars natively — if `avatar` is a short string (≤8 chars) that isn't a URL or data URI, it renders as an emoji at 50% of the circle size.

---

## App Screens (tabs)

- **Home** — dashboard, stats overview
- **Log** — add/view trades
- **Feed** — friend activity feed (FriendsFeed component)
- **Circles** — Trading Circles (leaderboard, chat, join/create)
- **Settings** — profile, preferences, public trades toggle, delete account

---

## Features Built (as of last session)

- Trade logging with P&L, R-multiple, notes, screenshots
- Stats dashboard (win rate, avg R, streak, equity curve)
- Supabase persistence across devices via `window.storage`
- Trading Circles — create/join by code, leaderboard, circle chat
- Friend feed — follow by handle, see friends' trades
- Clickable public profiles — tap any name/avatar to see ProfileModal (stats, trades, follow/unfollow)
- "Public trades" privacy toggle in Settings
- **5-step onboarding** — (1) name + handle (auto-fill + auto-@ fix) + emoji avatar picker, (2) bio + Twitter/X, (3) futures instruments multi-select, (4) strategy + custom strategy option, (5) ready/summary. localStorage backup prevents re-loop on network failure.
- React Error Boundary wrapping the whole app
- Feedback button (floating) → modal → POST `/api/feedback` → Telegram bot
- Custom domain tradrjournal.xyz live via GoDaddy DNS → Vercel
- PWA manifest, icons, iOS/Android installable

---

## Feedback → Telegram

`api/feedback.ts` sends feedback to Dylon's Telegram bot.

**Env vars needed in Vercel dashboard (Settings → Environment Variables):**
- `TELEGRAM_BOT_TOKEN` — your bot token from @BotFather (do NOT paste the real value here)
- `TELEGRAM_CHAT_ID` — your Telegram user/chat numeric ID (do NOT paste the real value here)

> ⚠️ Never commit real credential values to CLAUDE.md or any tracked file. This file is in a public git repo.

**Important:** Dylon must open Telegram, find his bot, and send it `/start` once before messages will deliver.

Runtime config in `api/feedback.ts`:
```ts
export const config = { runtime: "nodejs" }; // NOT "nodejs20.x" — Vercel will reject that
```

---

## DNS Setup (tradrjournal.xyz)

Registrar: GoDaddy  
Nameservers: ns39.domaincontrol.com / ns40.domaincontrol.com

GoDaddy DNS records:
- A record `@` → `76.76.21.21` (Vercel IP)
- CNAME `www` → `f084cb49980fd15b.vercel-dns-017.com` (Vercel CNAME — confirmed working)

Both `tradrjournal.xyz` and `www.tradrjournal.xyz` are verified and live in Vercel.

Vercel project: domain `tradrjournal.xyz` added and verified.

---

## Key Bugs Fixed (history — don't re-introduce)

| Bug | Fix |
|-----|-----|
| `React is not defined` at runtime | `deleteConfirm` / `deletingAccount` used `React.useState` — changed to `useState` |
| Onboarding loop for new users | Write `localStorage.setItem("tradr_onboarded", "1")` immediately in `onComplete`, before async Supabase save |
| `isJoiningCircle is not defined` | State existed in Tradr but wasn't passed as prop to TradingCircles — add to JSX call and function signature. Same fix for `isCreatingCircle` |
| ProfileModal "Profile not found" | Users hadn't re-saved since `profile_pub` key was added. Fall back to feed data (authorName/authorAvatar) when `profile_pub` not found |
| Vercel runtime error `nodejs20.x` | Change `api/feedback.ts` config to `runtime: "nodejs"` |
| Fragment crash in TradingCircles | Stray `</>` inserted by Python rfind in wrong component — removed |
| Unterminated string in CSV export | Literal newline inside join — changed to `"\\n"` |

---

## Code Patterns

### Writing to Python (large file edits)
TRADR.tsx is ~7400+ lines. OneDrive can truncate large writes. Always use Python atomic writes:
**IMPORTANT:** The file has already been truncated once (May 2026 — recovered via git). After any large write, verify `wc -l src/TRADR.tsx` is ~7400+ and `npm run build` passes (use `--outDir /tmp/tradr-dist --emptyOutDir` to avoid the locked `dist/` folder).
```python
import os, tempfile
tmp = path + ".tmp"
with open(tmp, "w", encoding="utf-8") as f:
    f.write(content)
os.replace(tmp, path)
```

### Storage reads/writes (legacy KV — current prod code path)
```tsx
// Private (user only)
const data = await (window as any).storage.get("tradr_profile");
await (window as any).storage.set("tradr_profile", JSON.stringify(profile));

// Public (shared_kv)
await (window as any).storage.set("tradr_profile_pub_handle", JSON.stringify(pubProfile), true);
```

### Public profile written on every saveProfile
```tsx
const norm = u.handle.replace(/^@/, "").toLowerCase();
await (window as any).storage.set(
  `tradr_profile_pub_${norm}`,
  JSON.stringify({ name, handle: norm, avatar, bio, publicTrades }),
  true
);
```

### Logging (use this instead of console.error)
```tsx
import { log, safe } from "./lib/log";

// Instead of: console.error("[TRADR][bla]", err);
log.error("loadAll.trades", err, { userId });

// At an effect boundary, wrap with `safe` to log + return a fallback:
const trades = await safe("loadAll.trades", () => listTrades(uid), [] as Trade[]);
```

### Feature flags (for v2 cutovers)
```tsx
import { isFlagOn } from "./lib/flags";

if (isFlagOn("newTrades")) {
  // new code path (v2 data layer)
} else {
  // existing KV code path
}

// Toggle from devtools:
//   window.tradrFlags.enableFlag("newTrades"); location.reload();
```

### v2 data modules (when wiring in)
Do NOT replace existing reads. Add a flagged branch alongside them, ship behind the flag, flip on for one user (yourself), confirm, then promote. See `MIGRATION.md` for the per-resource plan.

---

## Feedback Button (current state)

States: `feedbackOpen`, `feedbackText`, `feedbackSending`, `feedbackSent`

On success: sets `feedbackSent(true)`, button turns green and shows "Sent! ✓", then after 1500ms closes modal and resets all state.

---

## What's Next / Backlog

### Audit follow-ups

**Phase 1 — shipped**
- [x] `src/lib/log.ts`, `sentry.ts`, `flags.ts` added; main.tsx wires Sentry init
- [x] `.github/workflows/ci.yml` runs lint+tsc+build on PRs
- [x] `supabase/migrations/001_rls_cleanup.sql` + `002_v2_schema_additive.sql` written
- [x] Typed v2 modules: `src/data/trades.ts`, `profile.ts`, `bootstrap.ts`

**Phase 2 — shipped (behind feature flag, default off)**
- [x] `loadAll()` silent catches replaced with `log.error("loadAll.<scope>", e)` — every load step is now traceable
- [x] `loadAll()` reads from `public.profiles` when `isFlagOn("newProfile")`, falls back to KV when not found
- [x] `saveProfile()` always writes legacy KV row, additionally upserts to `public.profiles` when flag is on (dual-write)
- [x] V2 prefs column round-trips every legacy Profile field (targets, rules, checklist, alias, etc.) so flag-off clients see no data loss

**Phase 2 — to run / verify**
- [x] Run migration `001_rls_cleanup.sql` in Supabase ✓ (ran May 2026)
- [ ] Run migration `002_v2_schema_additive.sql` in Supabase — SQL is in clipboard, open SQL editor at https://supabase.com/dashboard/project/vifwjwsndchnrpvfgrmg/sql/new and paste + run
- [ ] Verify v2 profile path on yourself: `localStorage.tradr_flags = "newProfile"; location.reload();` then save profile, check `select * from profiles;`
- [ ] Set up branch protection on `main` (require CI `build` status check)
- [ ] (Optional) Install `@sentry/react` + set `VITE_SENTRY_DSN` in Vercel

**Phase 3 — pending**
- [ ] Wire follows v2 behind `newFollows` flag (uses `public.follows` table)
- [ ] Wire circles v2 behind `newCircles` flag (uses `circles` + `circle_members`)
- [ ] Wire trades v2 behind `newTrades` flag — riskiest, do last
- [ ] Backfill script for trades (template in MIGRATION.md)
- [x] Replace remaining silent `try { } catch { }` blocks in `TRADR.tsx` — `kickMember`, `feedback.send`, `deleteAccount` now log via `log.error()`
- [ ] Split `TRADR.tsx` — start with `SettingsScreen.tsx`, one screen per PR
- [ ] Move screenshots from base64-in-trade to Supabase Storage URLs
- [ ] Replace N+1 `fetchCircleLeaderboard` (TRADR.tsx:1607) with a single SQL query against the v2 schema
- [ ] Add a Playwright smoke test (sign in → log trade → join circle) that runs on every preview deploy

### Competitive roadmap (from `COMPETITIVE_ANALYSIS.md` — May 2026)

Key competitors: TraderSync ($30–80/mo), Tradezella ($29–89/mo), Edgewonk ($197/yr), TradesViz ($0–30/mo).
TRADR target pricing: Free tier · Pro $24.99/mo.

**Sprint 1 — Close the core gap**
- [ ] Wire Tradovate auto-import UI — `api/tradovate.ts` proxy is already built; need account connect screen + fill → trade sync
- [ ] Rithmic CSV parser — covers Apex, TopstepX, most US prop firm accounts without full API
- [x] Session time-of-day heatmap + day-of-week breakdown — `TimeOfDayChart` + `DayOfWeekChart` added to Stats → Heatmap tab

**Sprint 2 — Psychology + Prop Firm**
- [ ] Per-trade emotional state field (Calm / FOMO / Revenge / Confident) + rule-adherence Y/N + mistake tag
- [ ] Prop firm account mode — evaluation targets (profit target, daily loss limit, max drawdown), live progress bars
- [ ] Discipline score card — "You followed your rules on 71% of trades this month"

**Sprint 3 — Advanced Analytics**
- [ ] Setup P&L breakdown — which setups actually make money
- [ ] MAE/MFE per trade (needs broker data — wire after Tradovate/Rithmic)
- [ ] Commission/fee tracking — gross vs. net P&L
- [ ] Weekly report card — in-app summary, shareable image

**Sprint 4 — Monetisation**
- [ ] Stripe billing integration — Free / Pro / Elite tiers
- [ ] Basic AI insights — rule-based pattern detection ("You make 80% of profit before 11am ET")
- [ ] TradingView chart embed on trade detail view (entry/exit markers)

### Other backlog

- Real-time circle updates (Supabase broadcast — currently manual refresh)
- Push notifications / email for circle activity
- Google OAuth (wired but not configured in Supabase — remove button or configure)
- Landing on Circles tab by default (change `useState("home")` → `useState("circles")`)
- Multiple accounts (prop eval 1, prop eval 2, personal)
- Weekly/monthly auto-generated report card (shareable)

---

## Deploying

**Never push directly to `main` again.** Use feature branches + PRs so the
Vercel preview URL becomes your staging environment.

```powershell
# From C:\Users\Dylon\OneDrive\Desktop\tradr
git checkout -b feat/short-description
git add .
git commit -m "describe change"
git push -u origin feat/short-description
```

GitHub will print a PR URL. Open it. CI runs (`lint + tsc + build`).
Vercel posts a preview URL — open that on phone + desktop, smoke-test
sign-in, log a trade, join/leave a circle. If clean, **Merge** in GitHub.
Vercel auto-deploys to prod on merge.

Rollback: Vercel → Deployments → click previous green deploy → Promote to Production.

Branch protection is set on `main` — required status check is the `build`
job from `.github/workflows/ci.yml`. If CI is red, the PR can't merge.

See `DEPLOYMENT.md` for the full runbook including running Supabase
migrations and turning on Sentry.

---

## People

- **Dylon** — founder/developer
- **Bruno** — early tester, helped test circles/onboarding
