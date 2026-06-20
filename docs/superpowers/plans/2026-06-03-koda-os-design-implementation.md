# Plan — Kōda OS design implementation

**Date:** 2026-06-03
**Source bundle:** `C:\Users\Dylon\Downloads\KodaOS-handoff (1).zip` (extracted to `KodaOS-handoff-extracted/kodaos/`)
**Canvas:** `kodaos/project/TRADR Redesign.html` (filename is legacy — content is the Kōda OS design exploration)
**Branch:** `feat/koda-os-design-pass`

The bundle is **two handoffs** layered together:
1. `design_handoff_koda_redesign/README.md` — the visual-system v2 pass from May 2026 (already mostly executed in repo).
2. `design_handoff_new_features/README.md` — three Jun 2026 feature designs (intervention restyle, ideas restyle, nav restructure) over the same visual system.
3. `koda-launch.jsx` / `koda-launch2.jsx` — launch-readiness surfaces (motion, system states, toasts, celebrations, FAQ/Changelog/404, OG, weekly recap + receipt emails).

`TRADR Redesign.html` is the design-canvas page that loads all of them into one viewer. There is no separate "TRADR Redesign" feature — the file is the index, and the content is what we already know as the Kōda OS design system.

---

## 0 · What's already in place (do **not** redo)

Audit of `C:\Users\Dylon\OneDrive\Desktop\koda` against the handoff:

| Area | Status |
|---|---|
| `TRADR → Kōda` rename across `src/`, `index.html`, manifest | **Done.** `grep -rE 'TRADR\|tradr_' src` returns nothing. Identifiers, storage keys, CSS classes correctly preserved. |
| `theme.ts` extracted, coffee-warm dark `#13110E` canon | **Done.** Matches the newer `DESIGN.md` / new-features README spec (overrides the v1 handoff's `#0A0A0B`). |
| Editorial atoms in `shared.tsx` | **Done.** `GlassOrb` (~L405), `CornerGlow` (~L421), `GhostWord` (~L442), `TickMotif` (~L469), `TealArrowBtn` (~L510), `FloatingInput` (~L530), `Kicker` (~L620), `SectionKicker` (~L240). |
| 12-keyframe motion system | **Done.** 13 `k*` keyframes already in `src/index.css`. |
| 4-tier viewport hook | **Done.** `src/hooks/useViewport.ts` returns `phone \| tablet \| desktop \| wide`. Hook exists; **wiring into `Koda.tsx` page-frame is incomplete** — see §3.6. |
| Brand mark (4 chevrons, no rounded square in-app) | **Done.** `public/icon.svg`, `favicon.svg`, `apple-touch-icon.svg`, `icon-maskable.svg`, `og-image.svg`, `og-image.png` all present. Recipe matches handoff. |
| `index.html` meta tags (OG png, theme-color `#13110E`, 1200×630) | **Done.** |
| Marketing pages: `faq.html`, `changelog.html`, `404.html`, `cookies.html`, `comparison.html`, `in-session-intervention.html`, `trading-circles.html` | **Done.** |
| Intervention plumbing (`tilt.ts`, `useTiltState.ts`, `intervention_events` migration, `InterventionSheet.tsx`, `PreSessionSheet.tsx`, `PostSessionDebriefSheet.tsx`, `LiveRuleMonitor.tsx`, `InSessionStatsCard.tsx`, `ConfluenceTracker.tsx`) | **Done — functional.** Visual treatment is the older pass; needs restyle to match `koda-discipline.jsx`. |
| Ideas plumbing (`IdeasScreen.tsx`, `IdeaComposer.tsx`, `IdeaCard.tsx`, `api/ideas.ts`, `ideas` + `idea_likes` tables, `trade-screenshots/ideas/` bucket path) | **Done — functional.** Visual treatment close to spec; gaps: no `Friends/Ideas/People` pill row at screen top, card chrome doesn't exactly match. |
| Notification feed (in-app inbox) + push subscriptions | **Done — backend.** UI treatment needs the design's row pattern. |
| Toast helper | **Single-arg `showToast(msg: string)`** in `Koda.tsx`. **Needs upgrade** to `(kind, title, body?)` per F2. |
| `mistake` tag field on trades | **Not present.** Build per F4a. |

Implication: most of §6 / §6.5 of the v1 handoff README is already shipped. The plan below skips those and focuses on what's actually outstanding.

---

## 1 · Outstanding work, grouped

### A · Navigation restructure (Priority 2 from 31 Apr meeting — **not yet shipped**)
The 5-tab bottom-nav (`home, news, stats, circles, social`) and the home/stats/social sub-section logic are in `Koda.tsx` at ~L1554–1646. Meeting outputs + `koda-discipline.jsx → NavRestructureShell` define the target.

### B · Visual restyle on existing surfaces
Functionality is in place — apply the editorial system from `_shared/koda-discipline.jsx` (intervention, ideas) and `koda-screens.jsx` (motifs from the v1 pass that didn't fully land).

### C · New screens implied by the canvas
- `WebIntervention` modal (desktop overlay variant of `InterventionSheet`).
- `WebIdeas` desktop layout (sidebar + masonry + "Who to follow" rail).
- Floating chat bubble (Messenger-style FAB).
- Discipline-settings sub-screen UI inside Settings.

### D · Launch readiness gaps
- Toast system upgrade (4 kinds + stacked + left accent bar).
- Celebration moments (TradeLogged, StreakHit, ProUpgraded).
- System-state consolidation (Empty/Skeleton/Error per screen — some exist ad-hoc, some don't).
- F14 fluid responsive scaling — `useViewport` exists but the page-frame in `Koda.tsx` still uses `useIsDesktop(900)` binary branching.
- Web Pricing page (Forma-style) — confirm whether `/pricing.html` exists; the canvas has it but I didn't find a route.

### E · Functional gaps required by the design
- `trade.mistake` field (F4a).
- Prop-firm onboarding UI in EditProfile (verify; eval branch exists in HOME_SECTIONS at `Koda.tsx:1569`).
- Reset-password card polish to match `SignInCard`.
- Weekly recap email (F6) — verify; `api/cron.ts` exists but no `weekly-recap.ts`.
- Receipt email custom template (F7) — verify Stripe webhook.

### F · Bundled meeting fixes
Per `MEETING_CHANGES_310426.md` Priority 3/4:
- Move MAE/MFE block off Circles page.
- Google sign-in must route through onboarding.
- Visual separation between **Logout** and **Delete account** in Settings.
- Surface the **circle invite code / ID** in Profile or Chat tab.

### G · Brand identity additions from the canvas
- `LogoCard` (four-pillar row: 01 discipline / 02 momentum / 03 progress / 04 success) — quietly used on Welcome or About surfaces.
- `ManifestoCard` ("Four points forward. One edge.") — same use.

---

## 2 · Phased rollout

Single sprint, **multi-PR**, branch off `main`. The work is too large for one PR (Dylon's hook regex would also flag any drift in any of the 60+ touched files).

### PR 1 — Nav restructure + meeting bug bundle (Priority A + F)
Smallest blast-radius, ships visible value, and unblocks PR 2/3 because the new nav contains the targets we restyle.

1. **`Koda.tsx` NAV_TABS** (~L1554): replace `circles` label with `Chat`, keep `id=circles` so storage/test IDs don't break. Update icon path to the chat-bubble glyph from `koda-discipline.jsx → NavRestructureShell`.
2. **Sub-section merges:**
   - `HOME_SECTIONS` (~L1564): keep `analytics`, **rename `rules` label → "Rules & Checklists"** (already merged), keep `sync`, `journal`, `eval`. Confirm Log entry is reachable from Sync sub-section (it is — the home `sync` block at ~L2994 currently houses the CSV importer + log; verify manual-log entry sits there too).
   - `STATS_SECTIONS` (~L1571): already contains `insights`. **No structural change**; add NEW badge to insights item via a new prop.
3. **Collapsible Stats:** the `SubNavDropdown` currently always-renders when `view === "stats"`. Add `statsOpen: boolean` state (default `true`); the desktop sidebar Stats entry toggles it. On collapse, the sub-section list disappears (the active sub-tab persists so re-opening shows the same view).
4. **Floating chat bubble (`<FloatingChat />`)** — new component in `src/components/FloatingChat.tsx`. Fixed `bottom: 18px + safe-area`, `right: 16px`, 60px circle, `bg: C.live`, glyph in `C.bg`. Opens a chat panel/popover layered over current screen *without navigating away* (Bruno's ask — use a Portal + the existing `TradingCircles` chat rendering for the active circle). Hide on phone when bottom-nav is showing (would overlap). Show on `tablet+`.
5. **Mobile parity:** the bottom-nav at ~L4466 is the mobile rendering of NAV_TABS — already uses the same data structure, so the Circles → Chat rename propagates for free. Test IDs (`nav-home`, `nav-circles`, etc.) stay stable.
6. **Bundled fixes:**
   - MAE/MFE block: search `Koda.tsx` for the `maemfe` rendering inside the circles view; relocate it to `view === "stats" && statsTab === "maemfe"` (it's likely already there — confirm the duplicate on Circles is removed).
   - Google sign-in routes through onboarding: `KodaAuth.tsx` — after Google session establishes, check `profile.onboarded`; if false, mount `OnboardingFlow` (this is the same gate as email signup at `Koda.tsx:1653`; verify the Google path hits it).
   - Settings: `SettingsScreen.tsx` — wrap **Delete account** in its own card with a `border-color: C.red` hairline, separate from the Logout row.
   - Circle invite code: surface `profile.code` (or current-circle code) in `ProfileModal.tsx` as a mono row with a tap-to-copy. Already partially there in `TradingCircles.tsx` — copy the pattern.

**Smoke tests:** `npm run build`, `npm run typecheck`, manually walk: bottom-nav 5 tabs render, Chat label visible, Stats collapses, floating bubble opens chat without route change, MAE/MFE only appears under Stats.

### PR 2 — Discipline visual restyle (Priority B, sub-area: intervention)
Restyle the four sheets + two cards to match `_shared/koda-discipline.jsx`. No logic change — pure visual port.

| Component | Source | Critical changes |
|---|---|---|
| `src/components/PreSessionSheet.tsx` | `PreSessionScreen` | Mint dot + `PRE-SESSION CHECK` kicker (`C.live`); title "Ready to trade?" Geist 24px; row layout (label `text2` left, value mono 600 `text` right, `C.border` divider); **Start session** filled `C.live` / `#0A0A0E` text / flex 1.5; **Not yet** ghost. |
| `src/components/LiveRuleMonitor.tsx` | `LiveMonitorScreen` | Card `1px solid live33` + **3px solid live left border**; pulsing dot via `kPulse`; `SESSION LIVE` kicker; 3-col grid (P&L · Trades · Last break) split by `C.border`; severity coloring at 75% (`C.warn`) / 90% (`C.red`) — already partially implemented in `severity()`; **Wrap up** ghost pill top-right. |
| `src/components/InterventionSheet.tsx` | `InterventionScreen` | **Critical present → dot + label `C.red`, label "HEADS UP — CRITICAL"**, dot pulses. Else `C.live` + "HEADS UP". Headline copy template `{c} critical · {t} tilt signals active.` Signal rows: dot (red/live) + label + `critical` chip (1px red55 border, red10 bg). Buttons: **I'm aware — continue** filled live flex 1.5, **Cancel · {n}-min break** ghost. |
| `src/components/PostSessionDebriefSheet.tsx` | `DebriefScreen` | `accent` dot + `WRAP UP` kicker; "How did today go?" title; summary strip (4% fill, line border) — TRADES / W·L / P&L with mono 9px labels + 16px values; segmented Yes / Mostly / No (selected = filled `C.text` bg / `C.bg` label); optional note input (line2 border, radius 10); Save filled text/bg, disabled until selection; Skip ghost. |
| `src/components/InSessionStatsCard.tsx` | `InSessionStatsScreen` | Three figures split by dividers — `fired` (text) / `continued` (accent) / `cancelled` (live); footer line `Post-intervention trades: N · win rate X%`; hides when `fired === 0`. |
| `src/components/ConfluenceTracker.tsx` | confluence card in `InSessionStatsScreen` | Hairline 1px bar, big `N / total`, `Min required: X`, status `CLEAR TO ENTER` (green) / `BELOW THRESHOLD` (warn), threshold tick mark. |
| `src/SettingsScreen.tsx` — Discipline section | `DisciplineSettingsScreen` | Pill toggle (on = `C.live`, 46×26, focus ring `live 22%`); cooldown segmented pills `Off · 5 · 15 · 30`; "Signals Kōda watches" legend (critical = red dot, tilt = mint dot); firing-rule footnote. |
| **NEW** `src/components/WebIntervention.tsx` | `WebIntervention` | Desktop modal variant — 420px centred over `rgba(0,0,0,0.62) + blur(8px)` scrim. Same content as mobile sheet. Used when `useViewport() === "desktop" \| "wide"`. |

**Smoke tests:** open intervention with mocked tilt state at every severity; verify desktop modal centres; verify cooldown lockout still writes `koda_intervention_lockout`.

### PR 3 — Ideas + Social visual restyle (Priority B + C)

| Component | Source | Changes |
|---|---|---|
| `src/IdeasScreen.tsx` (~L124) | `IdeasFeedScreen` | Header is **inside the screen** today; the design wraps the screen in `Friends · Ideas · People` sub-tab pills. The sub-tabs already exist as `SOCIAL_SECTIONS` in `Koda.tsx:1627`. **Move the sub-tab pill row up** so it's visible above the screen body; align to feed/ideas/people. Keep the `Activity` 4th entry (it's not in the design but it's been shipped and is in use). Refresh button stays. |
| `src/components/IdeaCard.tsx` | `IdeaCardX` | 32px avatar with seeded gradient; `@handle` mono 12px 600; **type pill** `PRE` (live tint) / `POST` (green tint), mono 10px uppercase; 56×56 chart thumbnail at right when collapsed, full-width when expanded (max-h 360px); body 13px `text2`, clamp 2 lines collapsed; tag row (`instrument` live · `direction` green/red/muted · `timeframe` muted); price strip (entry text · stop red · target green, mono 11px on 4% fill); footer with like + `Tap to expand →`. |
| `src/IdeaComposer.tsx` | `IdeaComposerScreen` | Title "New idea" + Cancel; PRE/POST segmented control (active = filled text/bg); title underline-input; body textarea radius 12 / line2 border; meta grid 2-col (Instrument · Direction tinted · Timeframe · Entry/Stop/Target); footer `＋ Chart` ghost + `Post idea` filled `C.live` flex 1.6; optional link-trade chip. |
| **NEW** `src/WebIdeas.tsx` (or branched inside `IdeasScreen`) | `WebIdeas` | Two-column masonry of cards inside `WebShell`; right rail "Who to follow" (avatar + name + `@handle · style` + Follow pill). Header has 3 sub-tab pills + `+ New idea` filled `C.live` button. Hooked up via `useViewport() === "desktop" \| "wide"`. |

**Smoke tests:** Friends/Ideas/People pills tab between views correctly; like animation uses optimistic-then-server reconcile (already there); chart upload + lightbox still work; FAB stays above bottom-nav on phone.

### PR 4 — Launch-readiness surfaces (Priority D)

1. **Toast upgrade (F2).** Replace `showToast(msg: string)` with `showToast(kind: 'success'|'info'|'warn'|'error', title: string, body?: string)`. Stack rendering (max 3 visible, queue beyond). Each toast: left accent bar (4px, color by kind), circular icon chip (tinted bg), title + optional body, mono timestamp top-right, auto-dismiss success/info @3s, warn/error require dismiss. New file: `src/components/ToastStack.tsx`. Migrate existing call-sites — `grep -n 'showToast(' src` reveals all (likely ~30 sites). Provide a compat wrapper that maps string → `('info', str)` so the migration can be incremental.
2. **Celebration moments (F3).** New file `src/components/Celebration.tsx` exporting `<TradeLoggedConfetti />`, `<StreakHitMilestone count={n} />`, `<ProUpgradedWelcome />`. Triggers:
   - `saveTrade()` resolve → fire `TradeLoggedConfetti`, auto-dismiss 2.5s.
   - `streakCount` increments AND `count ∈ {3,7,14,30,100}` AND not previously fired (key `koda_streak_celebrated_${count}` in `user_kv`).
   - Stripe return URL `?upgraded=1` OR JWT plan transition free → pro.
3. **System states (F4).** Add `<EmptyTrades />`, `<EmptyCircles />`, `<EmptyInbox />`, `<SkeletonHome />`, `<SkeletonStats />`, `<ErrorOffline />`, `<ErrorSyncFailed />` to `src/components/States.tsx`. Wire into the existing screens (replace ad-hoc empty handlers). `<ErrorOffline />` is shell-wide: wrap `<App />` in an online/offline check via `navigator.onLine` + `window.addEventListener('online'/'offline')`.
4. **F14 responsive scaling.** Edit `Koda.tsx` page-frame (`<div className="koda-app">` — find via grep; was at ~L1353 per handoff README; verify) — replace the hard `maxWidth: 480px` cap with the tiered values from the handoff §F14 recipe. Drop hard side-borders on `phone` and `wide`. Bump card padding on `wide`. Sidebar `220px → 260px` at `wide`. Modal sheet `maxWidth: 520px → clamp(0, 100%, min(560px, 92vw))`. Use `useViewport()` (already exists). Verify `100dvh` everywhere — grep `100vh`.
5. **Pricing page.** Check `public/comparison.html` — likely the Forma-style pricing surface already exists. If not, build it from `koda-web2.jsx → WebPricing`.
6. **Weekly recap + receipt email (F6/F7).** Verify `api/cron.ts` has a `?job=weekly-recap` branch (it lists 5 jobs in NEXT_SESSION; recap is not one of them). If missing: add the cron job (Sunday 20:00 UTC), an HTML email body matching `EmailWeeklyRecap` design, wire through Resend or Postmark (Resend default — cheapest). Stripe receipt: confirm `api/stripe.ts` webhook handles `invoice.paid` and that we want to override the default Stripe receipt; if not, leave Stripe's default and skip F7.

**Smoke tests:** trigger every toast kind, simulate offline (DevTools), force a celebration fire, resize 320 → 2560 in DevTools and confirm no horizontal scroll appears at any tier.

### PR 5 — Functional gaps + brand identity (Priority E + G)

1. **`mistake` tag field (F4a).** Add to `Trade` in `src/types.ts`. Chip-picker in `LogTradeScreen.tsx` (suggested set: `None, Chased entry, Moved stop, Oversized, Revenge trade, Cut winner early, Held loser too long, Broke a rule, Other`). Display on trade detail. Monthly rollup card on Stats > Psychology. Backfill = null.
2. **Reset password card polish.** `KodaAuth.tsx` reset-password sub-state — match `SignInCard` design: warm dark card, mono kicker `RESET PASSWORD`, floating-label input.
3. **LogoCard & ManifestoCard.** Lift from `TRADR Redesign.html:88–281` into `src/components/BrandHero.tsx` and use on:
   - The first-run `BetaWelcome.tsx` (already exists) as the hero card.
   - Optionally on `kodatrade.co.uk/` landing (Marketing).

---

## 3 · Per-screen → file map (consolidated cheat sheet)

| Design artboard (in canvas) | Live file to edit | Status |
|---|---|---|
| Pre-session check | `src/components/PreSessionSheet.tsx` | restyle |
| Live monitor card | `src/components/LiveRuleMonitor.tsx` | restyle |
| Intervention sheet | `src/components/InterventionSheet.tsx` | restyle |
| Intervention web modal | **NEW** `src/components/WebIntervention.tsx` | new |
| Debrief sheet | `src/components/PostSessionDebriefSheet.tsx` | restyle |
| Stats discipline rollup | `src/components/InSessionStatsCard.tsx` + `ConfluenceTracker.tsx` | restyle |
| Settings · Discipline | `src/SettingsScreen.tsx` (Discipline section) | restyle / verify |
| Ideas feed | `src/IdeasScreen.tsx` | sub-tab pills + chrome |
| Idea card | `src/components/IdeaCard.tsx` | restyle |
| Idea composer | `src/IdeaComposer.tsx` | restyle |
| Ideas — web | **NEW** `src/WebIdeas.tsx` or desktop branch in `IdeasScreen.tsx` | new |
| Nav restructure | `src/Koda.tsx` NAV_TABS / sub-section maps | rename + collapsible |
| Floating chat bubble | **NEW** `src/components/FloatingChat.tsx` | new |
| Toast stack | **NEW** `src/components/ToastStack.tsx` (replaces inline `showToast`) | new |
| Celebrations | **NEW** `src/components/Celebration.tsx` | new |
| System states | **NEW** `src/components/States.tsx` | new |
| Mistake tag picker | `src/LogTradeScreen.tsx` | new field |
| Weekly recap email | `api/cron.ts` (`?job=weekly-recap`) + `src/lib/email.ts` | new |
| Brand hero | **NEW** `src/components/BrandHero.tsx` | new |

---

## 4 · Order of execution

```
PR 1 (nav + meeting fixes)        ── 1 working session
PR 2 (intervention restyle)       ── 1 session, parallelizable with PR 3
PR 3 (ideas restyle)              ── 1 session, parallelizable with PR 2
PR 4 (launch-readiness)           ── 1–2 sessions, biggest
PR 5 (mistake tag + brand hero)   ── 0.5 session
```

PRs 2 and 3 can ship in parallel (different files), but they both depend on PR 1 landing (the nav restructure renames the screen they live on).

PR 4 is the most invasive (touches `Koda.tsx` toast call-sites and adds the responsive cap) so it should land last to avoid blocking the others on merge conflicts.

---

## 5 · Risks

1. **Big `Koda.tsx` churn.** The file is 4921 lines today and many PRs touch it. The pre-commit hook (`: any`, `eslint-disable`) is strict. Mitigation: stage in chunks, run `git diff --staged Koda.tsx` before commit per the [[koda-staging incident]] (2026-06-02).
2. **Bottom-nav drift breaks Cypress / Playwright test IDs.** The handoff says keep `nav-circles` even when relabeled to Chat — that holds for both nav-bar render sites (~L1845 and ~L4466). Re-grep both to make sure id stays `circles`.
3. **Floating chat bubble z-index against bottom-sheet modals.** Intervention/Calculator/Pricing modals must out-z the bubble. Set bubble z to `40`, modals stay at `200+`.
4. **Email pipeline (F6) adds a paid dep.** Resend free tier covers it but requires `RESEND_API_KEY` in Vercel env. Confirm with Dylon before adding the dep; he authorised email providers in v1 handoff §6.5.
5. **Toast migration is wide.** ~30 call-sites of `showToast(string)`. Ship the compat wrapper in PR 4 step 1; migrate sites incrementally over the next sprint rather than in the same PR.
6. **Mistake tag field adds a column.** `Trade` type lives in `src/types.ts` *and* in Supabase. If trades are persisted to the `public.trades` v2 table, the migration needs a column add. Since v2 trades are gated behind `newTrades` flag (per CLAUDE.md), the migration can be additive-only and flag-gated.

---

## 6 · Test plan

- `npm run lint && npm run build && npx tsc --noEmit` after every PR.
- `npm test` after PR 2 (intervention has 22 + 3 + N tests) and PR 3 (IdeasScreen has render tests).
- Manual smoke walk per PR — listed inline above.
- Playwright `tests/in-session-intervention.spec.ts` (env-gated) for PR 2.
- DevTools resize ladder for PR 4 step 4: 320 / 375 / 430 / 744 / 1024 / 1280 / 1600 / 2560 px — no horizontal scroll at any width.

---

## 7 · Out of scope (defer)

- `koda-posts.jsx` Instagram artboards (marketing assets, not shippable in-app).
- AI Insights desktop screen — already gated behind Pro, can stay as-is for now.
- Tradovate live broker UI — gated by partner API credentials per CLAUDE.md.
- v2 typed CRUD cutover — handled by flagged migration, not this design pass.

---

## 8 · Open questions for Dylon

1. **Email provider:** Resend (recommended), Postmark, SES — which?
2. **Floating chat bubble on phone:** the design shows it desktop+. Confirm it should hide on `phone` (bottom-nav conflict).
3. **PR splitting:** ship all 5 PRs back-to-back, or land PR 1 + 2 + 3 and review before launching PR 4 + 5?
4. **Mistake tag set:** lock the 9-tag list above, or adjust?
5. **LogoCard / ManifestoCard surfacing:** keep as quiet additions to `BetaWelcome` and the landing hero, or skip entirely (focused product surfaces only)?

---

*Plan author: Claude · 2026-06-03. Source bundle: `KodaOS-handoff (1).zip`.*
