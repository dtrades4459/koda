# Kōda — UI / UX Audit

**Scope:** Static code audit. Findings cite file paths and approximate line numbers; anything that requires seeing the running app is parked in "Questions for Dylon" (final section). Brand context: mobile-first PWA, dark theme, 480px viewport, futures prop-firm traders, **core differentiator is in-session behavioural intervention**, not post-session journalling.

---

## 1. Executive summary — top 5 UX issues most damaging to the in-session intervention thesis

1. **Daily loss limit / kill switch is invisible from anywhere except Home → Overview.**
   The single behavioural ground truth — "am I close to blowing today?" — lives in one branch of one homeSection (`Koda.tsx` ~1873–1953). On Log, Stats, History, Circles, Sync, Settings, or Eval, mid-session the trader cannot see proximity-to-limit without tabbing back. There is no persistent header band, no nav-pill colour shift, no global ambient signal. **The product thesis fails the moment the user leaves Home.**

2. **There is no pre-trade interventional gate. The "rule confirmation" lives in a separate Checklist tab, not in the Log flow.**
   `LogTradeScreen.tsx` opens directly with `pair / direction / outcome` fields. It surfaces banner warnings for trade-count, loss-streak, and 60%-of-loss-limit (lines 102–134), but those warnings are passive text — the Save button is still enabled at full opacity and the form is otherwise normal. There is no "confirm you ran the checklist," no "your rules say one more loss = stop," no two-stage confirm.

3. **The "Log a live trade" flow is post-hoc only.** The trade entry form (`LogTradeScreen.tsx`) is *journalling* fields (pair, direction, outcome, P&L, R, MAE/MFE, mistake tag, emotional state). There is no quick "I'm about to enter" pre-trade snapshot capture (target, stop, plan, screenshot before entry). For a *behavioural* journal aimed at in-session use, the user is logging what already happened — too late to intervene.

4. **Tap count from open → live trade is too high.** Cold start → splash → unlock BetaGate (if set) → auth → Home → Log tab → fill ~8 required cards (Instrument, Direction, Date, Session, Account toggle, Outcome, R, $, Strategy, Setup, Entry/SL/TP, Bias, Discipline, Emotion, Mistake, MAE/MFE, Notes, Screenshot) → Save → animation. A logged-in returning user is at minimum 1 tap to Log + 5+ required field touches. **For an in-session tool you want one tap → one field (outcome) → autosave.** A "Quick log" 30-second flow does not exist.

5. **Discipline score is retrospective and buried.** Rendered inside the `Psychology` tab of the Stats sub-nav (Koda.tsx ~3260, "Discipline · This month"). It is *not* surfaced at the decision moment (pre-trade), *not* on the bottom nav badge, *not* on the home dashboard hero. It tells you about last month after the fact.

---

## 2. Design system drift

### 2.1 Token integrity

Source-of-truth tokens live in `src/theme.ts` (DARK / LIGHT). `src/shared.tsx` re-declares **MONO/BODY/DISPLAY** font stacks and many components inline their own colour fallbacks (`?? "#22c55e"`, `?? "#ef4444"`, `?? "rgba(28,28,34,0.55)"`, etc.). Drift:

| Concern | Where | Severity |
|---|---|---|
| `CLAUDE.md`/audit brief says brand accent is "baby blue `#89CFF0`". `theme.ts` uses `oklch(0.74 0.16 250)` (electric blue) as `accent`. No `#89CFF0` exists anywhere in `src/`. | `theme.ts:27` + brief | High — brand spec drift |
| Brief says "IBM Plex Mono". `shared.tsx:6` declares `MONO = "'Geist Mono', 'IBM Plex Mono', ui-monospace, monospace"` — Geist Mono is the actual primary; Plex is fallback only. Either the brief is stale or shared.tsx is wrong. | `shared.tsx:6` | Medium |
| Hard-coded warning amber `#f59e0b` used in `EvalAccountScreen.tsx:39, 99, 203, 213` rather than `C.warn` from theme. `C.warn` is `oklch(0.79 0.16 75)` — a visibly different orange. | EvalAccountScreen.tsx | Medium |
| Hard-coded greens `#22c55e` and reds `#ef4444` as fallbacks in `ReviewInboxScreen.tsx:43–45`, `Koda.tsx:2704–2713` (Review Inbox banner) — bypass the theme green/red. | multiple | Medium |
| Toast accent palette (`shared.tsx:119–124`) defines its own `oklch(0.80 0.16 85)` warning yellow, distinct from theme `warn` (`oklch(0.79 0.16 75)`). | shared.tsx | Low |
| EvalAccount `barColor` (`EvalAccountScreen.tsx:37–40`) uses theme `C.green` for OK but `#f59e0b` literal for warn. Inconsistent. | EvalAccountScreen.tsx | Medium |
| `#0A0A0A` literal repeated 5+ times in `LogTradeScreen.tsx:419`, `shared.tsx:522`, `Koda.tsx:3963`, etc. for "text on accent" — should be `C.bg`. | multiple | Low |
| TRADR legacy reference: `Koda.tsx:49` — `const LEGACY_GLOBAL_CODE = "TRADRG-HB1U"`. Only legacy reference left in `src/`. | Koda.tsx:49 | Low (intentional) |
| `README.md` is still titled "TRADR" and references `TRADR.tsx`, `TradrAuth.tsx`, `TRADR-BRAIN.md` files that no longer exist. | README.md:1–39 | Medium — onboarding new contributors |

### 2.2 Typography drift — `fontSize` literals

Sample across `src/` (excluding tests): distinct numeric font-size values include **8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 20, 22, 24, 26, 28, 32, 36, 44, 52, 64, 72, 80**. That is **23+ raw font-size values** used as inline literals. Theme has no exported type scale at all.

Recommend introducing a `T` (type-scale) token export in `theme.ts`:

```ts
T.body = 14
T.bodySm = 13
T.label = 11   // form labels
T.kicker = 10  // MONO section labels
T.kickerSm = 9
T.h1 = 26
T.hero = 44
```

### 2.3 Spacing drift — `padding` literals

Inline padding values in `Koda.tsx` alone include `"12px 0"`, `"14px 16px"`, `"10px 14px"`, `"11px 14px"`, `"13px 14px"`, `"16px 18px"`, `"18px 20px"`, `"20px 16px"`, `"24px"`, `"40px 24px"`, `"60px 24px 40px"`. No 4-/8-pt scale enforced.

### 2.4 Border-radius drift

Distinct radii found across `src/`: **2, 3, 4, 6, 7, 8, 10, 11, 12, 14, 16, 18, 20, 22, 24, 50%, 999px**. `shared.tsx:597` has a comment "consistent radius (24px)" for `Card` but cards elsewhere use 22, 20, 16, 14. `EvalAccountScreen.tsx` alone mixes `22`, `16`, `14`, `12`, `3` on adjacent surfaces (lines 169, 240, 244, 270, 44).

The `Card` primitive (`shared.tsx:Card`) hardcodes `borderRadius: 24` but is bypassed throughout `Koda.tsx` and `EvalAccountScreen.tsx` in favour of raw divs with `borderRadius: 22`. The 24 → 22 difference is visible at 480px.

---

## 3. Component variant sprawl

### 3.1 Button variants

| Variant | Defined in | Notes |
|---|---|---|
| `pillPrimary(enabled)` | `theme.ts:118` via `makeStyles` | Mainline primary |
| `pillGhost` | `theme.ts:132` | Mainline secondary |
| `OnboardingFlow.pillPrimary` | `OnboardingFlow.tsx:158` | **Duplicate** — different padding (16/32 vs 14/20), different "disabled" treatment (border2 bg vs transparent + border) |
| `BetaGate` primary | `BetaGate.tsx:237–257` | Hand-rolled, third primary |
| `LogTradeScreen.Save` mega-button | `LogTradeScreen.tsx:398–422` | Unique to this screen, includes inline teal arrow chip |
| `SegBtn` | `LogTradeScreen.tsx:46–59` | Segmented control variant — not reused elsewhere |
| `StrategyPill` | `shared.tsx:250` | Pill variant |
| `Pill` | `shared.tsx:574–594` | Pill variant — different padding from StrategyPill |
| `TealArrowBtn` | `shared.tsx:510` | "Go" CTA circle |
| Bottom-nav button (inline) | `Koda.tsx:3957` | Hand-rolled |
| Feedback floating button (inline) | `Koda.tsx:3989–3993` | Hand-rolled |
| Eval "Edit targets" (inline) | `EvalAccountScreen.tsx:221` | Hand-rolled |
| Kill switch "Override" / "Review Today" (inline) | `Koda.tsx:1896–1903` | Hand-rolled |
| FriendsFeed "+ Follow" toggle (inline) | `FriendsFeed.tsx:114–124` | Hand-rolled |
| Filter pills in History (inline) | `Koda.tsx:2795–2804` | Mixed |
| IconButton | `shared.tsx:689` | 44x44 — used sparingly |
| GearButton | `shared.tsx:378` | 44x44 — used sparingly |

**Verdict:** at minimum **5 button shape systems** in active use; a user sees ~7 different button styles per session. Canonicalise to `Button` (primary | secondary | ghost | destructive) × `(sm | md | lg)` and migrate.

### 3.2 Card variants

| Variant | File | Radius | Padding |
|---|---|---|---|
| `Card` (shared) | `shared.tsx:598` | 24 | `pad` prop (default 18) |
| Eval header panel | `EvalAccountScreen.tsx:169` | 22 | 20 |
| Eval stat card | `EvalAccountScreen.tsx:73` | 14 | "14px 16px" |
| Eval recent trades | `EvalAccountScreen.tsx:269` | 22 | varies |
| Feed post | `FriendsFeed.tsx:281` | 22 | 16 |
| Pre-trade banners | `LogTradeScreen.tsx:104, 112, 120, 128` | 14 | "12px 16px" |
| Settings list rows | `SettingsScreen.tsx:177` | inherits 22 | "14px 18px" |
| Prop firm progress card | `Koda.tsx:3288` | 22 | "18px 20px" |
| Daily risk dashboard (sibling card) | `Koda.tsx:1909` | 10 | 16 |

Same conceptual primitive rendered with 4+ different radii on adjacent screens.

### 3.3 Input variants

- `inp` (returned by `makeStyles`) — borderless bottom-rule, `padding: 12px 0`, font 16, minHeight 44. Used in profile/log/history filters.
- `sel` — same plus `cursor: pointer`. Used for selects.
- `LogTradeScreen.tsx:79` re-implements `inp` inline (identical shape) **and** defines a second `sel` (`LogTradeScreen.tsx:86`) that is *different* — boxed `padding: "11px 14px"`, `border`, `borderRadius: 12`, `fontSize: 13`. Two `sel` styles coexist in one screen.
- `FloatingInput` (`shared.tsx:530`) — entirely different visual: boxed 14-radius card with label-above-value floating composition. Used only in KodaAuth & limited spots.
- `LogTradeScreen.tsx:207–214` overrides `inp` again for the P&L hero inputs (font 28, no border-bottom). Fourth input shape.
- Tradovate connect modal (`Koda.tsx:4032`) hand-rolls a fifth input (boxed `borderRadius: 8`, `padding: 12px 14px`, `background: C.panel`).

### 3.4 Modal / Sheet variants

| Variant | Where |
|---|---|
| Bottom sheet (`borderRadius: "20px 20px 0 0"`) | TourOverlay (`OnboardingFlow.tsx:71`), Tradovate modal (`Koda.tsx:3998`), LotSizeCalculator |
| Full-screen overlay with centred card | CelebrationOverlay (`shared.tsx:843`) |
| Inline-expanded section (no overlay) | SettingsScreen.editProfile, Strategy editor in checklist |
| UpgradeModal | `UpgradeModal.tsx` |
| PaywallScreen (full route) | `PaywallScreen.tsx` |
| NotificationsDrawer | `NotificationsDrawer.tsx` |

No shared `BottomSheet` primitive. Each implements its own backdrop, drag handle, max-height.

### 3.5 Toast variants

- `Toast` (legacy single message) — `shared.tsx:99`.
- `ToastStack` + `ToastCard` (v2, 4 kinds, stacked) — `shared.tsx:191`.
- Both are in use simultaneously: `Koda.tsx:263–268` keeps `[toast, setToast]` AND `[toastsV2, setToastsV2]`. The legacy toast is still triggered by `showToast()` everywhere; v2 only via `showToastV2()`. Result: two visual toast styles can appear in the same session depending on the trigger.

### 3.6 Empty / loading / error states

- `EmptyTradesState`, `EmptyCirclesState`, `EmptyInboxState`, `ErrorOfflineState`, `ErrorSyncFailedState`, generic `EmptyState` — all in `shared.tsx:721–1014`. Plus inline empties in `FriendsFeed.tsx:192–217, 446–459` and `History` view (`Koda.tsx:2812–2820`). Inline empties don't match the branded `EmptyState` style.
- `SkeletonBar` exists (`shared.tsx:710`) but is never imported anywhere outside `shared.tsx` — every load is a spinner or blank.

---

## 4. Findings by section

### 4.1 Mobile UX fundamentals

| Screen / component | File | Issue | Severity | Recommended change | Effort |
|---|---|---|---|---|---|
| Viewport meta | `index.html:5` | `maximum-scale=1.0, user-scalable=no` disables pinch-zoom. WCAG 1.4.4 violation; punishes anyone with low vision or who wants to zoom a screenshot. | High | Drop `maximum-scale` and `user-scalable=no`. Keep `viewport-fit=cover`. | XS |
| Bottom nav | `Koda.tsx:3957` | Buttons `minHeight: 48` ✓ but icons are 17×17 with 9px label — text barely scannable. `padding: 8px 2px` — horizontal squeeze when 6 items (5 tabs + calc) compete on 360px iPhone. | Medium | 11px label, 18px icon, drop calc out of main nav. | S |
| Feedback floating button | `Koda.tsx:3989–3993` | `bottom: calc(44px + safe-area + 24px)`, `right: 16px` — overlaps right edge of bottom-nav glass pill on narrow screens. Also competes visually with primary navigation. | High | Move to Settings or only render when an update is available. | S |
| Lot Size Calculator pill | `Koda.tsx:3973–3984` | Calc pill in bottom nav takes 1/6 of persistent nav for a non-navigation action. | Medium | Demote to a FAB on Log only, or inline within Log form between Entry and Stop. | S |
| Pre-trade banners | `LogTradeScreen.tsx:102–134` | Banners render at the very top of the scroll. Once the user fills the form (200px+ down) the warning has scrolled away. | High | Pin loss-limit + trade-count banner sticky to top of form. Or block the Save until dismissed. | S |
| Log Save button | `LogTradeScreen.tsx:399` | Disabled when `pair && date && outcome` missing — fine. **But** ignores `atTradeLimit`, `killSwitchTripped` and `nearDailyLoss`. You can be over your daily loss limit and still tap Save without friction. | High | When `atTradeLimit` or `killSwitchTripped`, require a second confirm modal. | S |
| Input zoom (iOS) | `LogTradeScreen.tsx:84` | `fontSize: 16` ✓ — prevents iOS zoom-on-focus | OK | — | — |
| Form `autocomplete` | grep | Only present on BetaGate, Tradovate connect (Koda.tsx, DataSourcesScreen). Onboarding name/handle, Settings profile name/handle/broker/timezone have **no autocomplete attrs**. | Medium | Add `autocomplete="given-name"` on name, `autocomplete="off"` on handle, `autocomplete="organization"` on broker. | XS |
| Form `inputmode` | `LogTradeScreen.tsx:207, 212, 252–254, 350, 355` | Decimal `inputMode` set on all numeric fields ✓ | OK | — | — |
| Onboarding inputs | `OnboardingFlow.tsx:247, 257` | Name input lacks `autocomplete`/`name`. Handle input lacks `autocapitalize="off"` / `autocorrect="off"`. | Medium | Add the missing attrs. | XS |
| Eval status pill colour | `EvalAccountScreen.tsx:99` | "AT RISK" uses `#f59e0b` with `rgba(245,158,11,0.12)` background; "PASSING" uses `C.green`; "FAILED" uses `C.red`. Inconsistent token sourcing. | Medium | Use `C.warn` and theme green/red. | XS |
| Bottom nav overflow risk | `Koda.tsx:3952` | `width: "calc(100% - 32px)"` floating pill with 6 items. At < 360px labels truncate. No `overflow:hidden`, so they could wrap. | Medium | Smaller padding, drop labels under 360px or remove calc. | S |
| Body padding-bottom | `Koda.tsx:1595` | `paddingBottom: phone||tablet ? "96px" : "32px"` — assumes nav height only. Feedback floating button adds another ~52px above safe area, hiding sticky CTAs. | Medium | Compute from actual stack. | S |
| Horizontal-scroll risk | `FriendsFeed.tsx:223` | Story strip `overflowX: "auto"` ✓. But several rows use `flexWrap: "wrap"` next to `flexShrink: 0` siblings → potential overflow on 320px. | Medium (verify) | — | S |
| Splash background | `Koda.tsx:1485–1511` | Splash always uses `DARK.bg` even in LIGHT mode → light-mode users see a black flash before content. | Low | Use `prefers-color-scheme` for first paint, then switch. | XS |
| Override dialog | `Koda.tsx:1900` | Uses native `confirm("Override kill switch? …")` — unbranded, looks unsafe. | Medium | Replace with branded modal. | S |
| `<h1>`/`<h2>` / heading hierarchy | grep | No semantic heading tags outside Onboarding and PaywallScreen. Everything else is styled `<div>`s. Screen readers cannot navigate by heading. | High | Wrap section labels in proper headings. | M |
| Focus states | `Koda.tsx:1562` | Only `input:focus,textarea:focus,select:focus{border-bottom-color:${C.text}!important;}` — buttons have no visible `:focus`. Keyboard users blind. | High | Add `:focus-visible` outlines globally. | S |
| `:hover` only edit/rm rows | `Koda.tsx:2604–2606, 3748–3749` | `.ca` hidden by `opacity:0` until row hover; `@media(hover:none){.ca{opacity:1!important}}` makes them visible on touch ✓ | OK | — | — |
| Reaction button size | `FriendsFeed.tsx:407–415` | 28×28 — under 44px touch target (six of them stacked, no padding) | High | 36 min, ideally 44 | S |
| Refresh circle button | `FriendsFeed.tsx:110` | 32×32 — under 44px | Medium | — | XS |
| Image alts | `ProfileModal.tsx:105` `alt=""` for the avatar — screen reader can't tell whose profile they're on | Medium | Use the trader's name as alt | XS |

### 4.2 State coverage (loading / empty / error / offline / success)

| Component | Loading | Empty | Error | Offline | Success | Gap |
|---|---|---|---|---|---|---|
| Home Overview | ⚠ no skeleton, just blank | ✅ `EmptyTradesState` | ❌ no error state | ❌ no global offline indicator | ✅ stat cards | If `loadAll` fails it just renders blank state forever. |
| Log | n/a | n/a | ⚠ toast only | ❌ no offline check at submit | ✅ `CelebrationOverlay` | Submit offline → KV-only save → toast "Save failed". No queued-trade indicator. |
| Stats / Calendar / charts | ❌ no skeleton | ⚠ "no trades" string | ❌ | ❌ | ✅ chart | `SkeletonBar` exists but unused. |
| History | ❌ blank → renders | ✅ `EmptyTradesState` (`Koda.tsx:2815`) | ❌ | ❌ | ✅ | — |
| FriendsFeed | ⚠ no loader during `refreshFeed` | ✅ two inline empties | ❌ silent | ❌ | ✅ | — |
| TradingCircles | ✅ `loadingLB`, `chatLoading`, `feedLoading` | ✅ `EmptyCirclesState` | ⚠ `lbError` only on leaderboard | ❌ | ✅ | Chat send error: catch silently restores text — no toast. |
| ReviewInbox | ✅ `loading` | ✅ `EmptyInboxState` | ❌ swallows errors | ❌ | ✅ | — |
| EvalAccount | n/a | ✅ "No eval targets" (`EvalAccountScreen.tsx:147–161`) | ❌ | ❌ | ✅ | — |
| Settings | n/a | n/a | ⚠ toast on save fail | ❌ | ⚠ toast | — |
| Sync / DataSources | partial | ✅ | ⚠ inline sync_events error | ❌ | ✅ | — |
| LotSizeCalculator | n/a | ✅ shows hints | n/a | n/a | ✅ | — |
| Onboarding | ⚠ `saving` flag on final step only | n/a | ⚠ inline only on name | ❌ — fails silently on network | ✅ | If network drops mid-onboarding, `localStorage.koda_onboarded` is set immediately (`Koda.tsx:1524`) so user is forced through — but Supabase write may have failed. Profile may be incomplete. |
| Auth | ✅ `loading` | n/a | ✅ inline error | ❌ | ✅ | — |
| Onboarding handle uniqueness | `OnboardingFlow.tsx` | — | ❌ not validated at sign-up | — | — | Two users can pick the same handle. Settings has `isHandleTaken` but onboarding does not call it. |

**Universal gap:** offline detection is wired (`Koda.tsx:233–239` sets `isOnline`) but never *rendered* outside the dedicated `ErrorOfflineState` component, which is only used by `EmptyTradesState` indirectly. Most screens never show an offline indicator.

### 4.3 Information hierarchy

| Screen | Most-important element | Visual dominance | Issue |
|---|---|---|---|
| Home Overview | Total P&L, win-rate, today's loss-limit proximity | Mixed — hero is total P&L; today loss-limit only appears in the kill-switch sub-section | Daily limit should be the hero on Home if user has `propFirmMode` or `maxDailyLoss` set. |
| Log | Save button + P&L outcome | Save dominant ✓ | Pre-trade banners are equal weight to neutral cards — warnings get lost. |
| Stats Overview | Equity curve | ✓ | OK |
| Stats Psychology | Discipline % | ✓ (large coloured ring) | Buried two taps deep (Stats → Psychology sub-tab). |
| History | Day groupings with daily net | ✓ (`Koda.tsx:2834`) | OK |
| FriendsFeed | Latest peer trade | ⚠ — feed posts give equal weight to story strip, author name (13px) vs P&L number (14px) | The trade numbers should dominate, not the author. |
| Eval | Status badge (`PASSING/AT RISK/FAILED`) | Small (font 9 weight 700 in 999 pill) vs the $44 balance | The status should be hero. A trader needs "am I still passing" first, not "what's my balance." |

Numeric scannability: P&L numbers are MONO with `fontVariantNumeric: tabular-nums` on some surfaces (`FriendsFeed.tsx:361`, `LogTradeScreen.tsx:213`) but **missing** on Home stat cards (`Koda.tsx:1862`) and Eval cards (`EvalAccountScreen.tsx:75`). When digit count changes (e.g., `+$485` vs `+$1,205`) the layout jumps.

Colour coding:
- Win = green, Loss = red, BE = muted — consistent ✓
- Warning state mixed: amber `#f59e0b` vs `C.warn` (orange) vs `C.red` at 75% threshold. Inconsistent escalation between Home daily dashboard, Eval, and Log pre-trade banners.

### 4.4 Information hierarchy — daily limit is rendered four times, four ways

| Surface | File | Unit | Threshold for red | Bar/visual |
|---|---|---|---|---|
| Home daily risk dashboard | `Koda.tsx:1909–1953` | R | 75% | text-only |
| Home kill switch | `Koda.tsx:1886–1906` | R | 100% | red panel |
| Home prop firm card | `Koda.tsx:3302–3311` | $ | 75% | progress bar |
| Eval account screen | `EvalAccountScreen.tsx:37–40` | $ | 50%/75% (escalating) | progress bar |
| Log pre-trade banner | `LogTradeScreen.tsx:127–134` | R | 60% (yellow then red) | banner |

Five formulas, three thresholds, two unit systems (R vs $). **The system is incoherent.**

### 4.5 Accessibility basics

| Concern | Where | Severity | Fix |
|---|---|---|---|
| Pinch zoom disabled | `index.html:5` | High | Drop `maximum-scale` and `user-scalable=no` |
| Image alts | `FriendsFeed.tsx:296` decorative `alt=""` (OK). `ProfileModal.tsx:105` `alt=""` for avatar — should be the trader's name | Medium | Use name |
| Focus states | `Koda.tsx:1562` only sets border-bottom on input focus. **No visible focus on buttons.** | High | Add `:focus-visible` outlines globally |
| Tap-target audit | Bottom nav 48 ✓. Pills 44 ✓. Many small "edit/rm" buttons in checklist (`Koda.tsx:2605–2606, 3748–3749`) have `minHeight: 44` ✓. | OK | — |
| Reaction buttons | `FriendsFeed.tsx:407–415` 28×28 | High | Increase to 36 minimum |
| Refresh circle button | `FriendsFeed.tsx:110` 32×32 | Medium | Increase |
| Heading hierarchy | grep | High | Add semantic `<h1>` to `<h3>` |
| `role="alert"` | Present on pre-trade banners ✓ | OK | — |
| `aria-label` | Used on `IconButton`/`GearButton` ✓; bottom-nav icon-only buttons rely on visible label `<span>` | Low | Add `aria-label` for redundancy |
| Contrast — `C.text` on `C.bg` | ~17:1 ✓ | OK | — |
| Contrast — `C.text2` on `C.bg` | ~7.5:1 ✓ | OK | — |
| Contrast — `C.muted` (`#65655F`) on `C.bg` (`#0A0A0B`) | ~3.7:1 — **fails WCAG AA for body text** (4.5:1). Used extensively for labels, sub-labels, "by strategy" rows. | High | Raise `muted` lightness |
| Contrast — `C.dim` (`#45453F`) on `C.bg` | ~1.9:1 — well below AA. Used for placeholder text (`Koda.tsx:1561`) | High (placeholder) | Replace placeholder colour |
| Dynamic type | `Koda.tsx:349` `fontScale` slider applied via `document.documentElement.style.fontSize` ✓, but components use `px` literals everywhere — won't scale. The slider is half-broken. | High | Use `rem` for type or apply scale via CSS variables |

### 4.6 Behavioural design gaps — see Section 5 (its own section)

### 4.7 Onboarding and first-run

Trace from sign-up:

1. **BetaGate** (if env set) — invite code prompt. Footer says "DM `@dylon.trades` on Instagram for an invite." Friction acceptable for closed beta, **but** no URL param read — a user clicking a unique invite link still has to type the code. (`BetaGate.tsx:209`.)
2. **Auth** (`KodaAuth.tsx`) — username + password, with Google/X/Apple OAuth buttons. *Google is wired but not configured in Supabase* (per CLAUDE.md backlog); clicking it will fail.
3. **Onboarding 4 steps** — `OnboardingFlow.tsx`. Step 1 name + avatar (16 pre-defined emojis, no custom upload), Step 2 instruments, Step 3 strategy (6 buckets), Step 4 ready. **Missing for prop-firm thesis:** never asks "are you on a funded account?", never asks "what's your daily loss limit?", never asks "what's your daily target?". User lands on Log with `propFirmMode: false` and zero rules configured.
4. **Auto-join Kōda Global circle** — `Koda.tsx:1544` runs `joinCircleByCode(KODA_GLOBAL_CODE)` silently ✓.
5. **First-session survey** — `Koda.tsx:792–795` triggers `showFirstSessionSurvey` if user has no `priorTool`. Captures `priorTool` and `almostStoppedReason` for PostHog. *But this can fire immediately after onboarding — before the user has tried to log a trade.* Likely abandons.
6. **Tour overlay** — `OnboardingFlow.tsx:39–58` 3 steps (Log / Stats / Circles). Generic — does not call out the kill switch, discipline score, or eval mode.

**Drop-off risks:**
- Steps 2 and 3 have "Skip →" — empty user lands on Log with no instruments and the default strategy.
- Step 4 CTA "Log my first trade →" routes to Log, but the Log form opens cold. Better: a "first trade" lite flow (just outcome + R).
- **No "set up your daily loss limit" step** — the single most important behavioural lever is buried in Settings.

### 4.8 Social features

| Concern | Where | Severity | Note |
|---|---|---|---|
| `publicTrades` default | `Koda.tsx:65` `publicTrades: false` ✓ | OK | Privacy-safe default |
| Auto-join global circle | `Koda.tsx:1544` | OK | Silent on failure |
| Circle privacy / leaderboard transparency | `TradingCircles.tsx` | Medium | No tooltip explaining what `metricDisplay` is calculated from (is `$ P&L` net of commission?) |
| Beta wall vs circles | Prior `FUNNEL_AUDIT.md` clarifies "BETA-680X" refers to the BetaGate password flow, **not** circles. Circles join via `joinCircleByCode(code)`. BetaGate friction: code typed once, persisted to `localStorage.tradr_beta_unlocked`. Could add `?code=…` URL param → auto-fill. See Questions. | Medium | Add URL-param prefill to BetaGate. |
| Empty states in circles | `EmptyCirclesState` from shared ✓ | OK | — |
| Profile visibility | Public profile created on save when handle exists (`Koda.tsx:855–862`) ✓ | OK | — |
| Follow defaults | per-row in shared_kv, RLS-bound ✓ | OK | — |
| Twitter share auto-includes `#Kōda` (macron) | `Koda.tsx:3355`, `FriendsFeed.tsx:424` | Low | Some clients mishandle macron in URLs |
| Follow flow error states | `FriendsFeed.tsx:177–183` inline red ✓; loading `…` ✓ | OK | — |
| Reactions tap target | `FriendsFeed.tsx:386–415` | Medium | 28×28 fails tap-target test |

### 4.9 Copy and microcopy

| Concern | Where | Note |
|---|---|---|
| "TRADR" references in `src/` | only `LEGACY_GLOBAL_CODE = "TRADRG-HB1U"` in `Koda.tsx:49` (constant, not user-visible) | clean |
| `README.md` still titled "TRADR", references deleted files | README.md:1–39 | Update |
| Tone: "Your edge starts here" / "Your journal awaits" | `Koda.tsx:2047`, `shared.tsx:732` | ✓ on brand |
| Pre-trade: "Last trade of the day. Make it count." | `LogTradeScreen.tsx:115` | ✓ |
| Streak banner: "Two weeks in. The habit is forming." | `Koda.tsx:78` | ✓ |
| Toast: "Save failed — check your connection" | `Koda.tsx:367` | ✓ actionable |
| Button verbs: action-led ✓ | — | — |
| Placeholder vs label: e.g. `placeholder="ES"` with label "Pair / Instrument" — placeholders are examples, not labels ✓ | `LogTradeScreen.tsx:142` | — |
| Notes textarea placeholder: "What did price do? Why did you enter?" — questions, turns the field into an interview | `LogTradeScreen.tsx:365` | ✓ great |
| Tour copy: "STATS breaks down your win rate" — uppercase tab name reads like shouting | `OnboardingFlow.tsx:49` | Low — use sentence case |
| BetaGate footer: "No code? DM …" with Instagram link | `BetaGate.tsx:294` | ✓ on brand |
| Override kill switch dialog: native `confirm("Override kill switch? Only do this if this was a data entry error.")` | `Koda.tsx:1900` | Medium — replace with proper branded modal |

### 4.10 Performance-felt UX

| Concern | Where | Note |
|---|---|---|
| Skeleton vs spinner | `SkeletonBar` exists but unused; every load is a spinner or blank | Adopt skeletons on Home overview, Stats charts, History list |
| Splash | `Koda.tsx:1485–1511` | Animated, branded ✓ |
| Optimistic updates | `Koda.tsx:saveTrades` writes KV then v2 — UI updates immediately via `setTrades(u)` ✓ | Good |
| UI blocked during Supabase calls | `Koda.tsx:saveProfile` awaits, but no progress shown (toast on failure only); `savingTrade` boolean exists ✓ | OK |
| `_loadedRef` guards double-load | `Koda.tsx:375–380` | ✓ |
| Image migration during loadAll | `Koda.tsx:498–533` | Fire-and-forget ✓, but could race if user edits during migration |
| 4292-line `Koda.tsx` | code organisation only | Continue extraction |
| Web fonts via Google Fonts | `index.html:10` | Blocking but `display=swap` set ✓ |

---

## 5. Behavioural design gaps — every missed intervention moment

This is the section that matters most for the in-session-intervention thesis. Each gap below is a concrete moment where the app *could* be intervening but currently isn't.

### Pre-trade moments (decision is being made now)

1. **No "I'm about to enter" capture.** The user has a setup in front of them, they're sizing a position, deciding stop. The app offers no surface for "I'm thinking about taking this — does it pass my checklist?" The Checklist tab exists but lives at Home → Checklist (`Koda.tsx:1474–1477`), 3+ taps away. Recommend a single "Pre-trade gate" sheet accessible from the LotSizeCalculator and from a top-bar "▶ Take a trade" button.
2. **No rules confirmation on Log open.** Log opens directly to fields. Rules (`stratRules`) are loaded and tied per-strategy. Show today's selected-strategy rules as the first card with "✓ I've checked all" required before P&L fields enable.
3. **LotSizeCalculator is decoupled from rules.** `LotSizeCalculator.tsx` outputs contract size but never asks "does this risk amount stay under your daily loss?" or "this position size + your existing day P&L is X% of daily limit." The calculator is the natural place to surface proximity-to-limit before the trade is taken.
4. **No max-trades-hit hard stop.** `LogTradeScreen.tsx:103–110` shows the banner "Trade limit reached" but the Save button still works at full opacity. A trader at limit is not blocked — they're gently nudged. For prop-firm rules where a deviation costs the eval, this should be a hard modal.
5. **No pre-trade loss-streak intervention.** `LogTradeScreen.tsx:119–126` shows banner if `lossStreak >= 2`. Banner only. No cooldown timer. No "you should stop now" hard stop. No "take a 15-minute break."
6. **No 60%-of-limit "warning at the door."** `nearDailyLoss` triggers at 60% (`LogTradeScreen.tsx:77, 127`). The user sees text. They don't see the Save button change colour, they don't see the bottom nav glow red, they don't see anything outside the Log form.
7. **No emotional-state pre-trade prompt.** Emotional state lives in the *Log* form (`LogTradeScreen.tsx:300–323`) as a post-hoc tag. Before the trade, ask: "How are you feeling right now? [Calm / FOMO / Revenge / Confident]" and warn or block if Revenge.

### During-session ambient signals (always-on)

8. **No persistent daily-limit indicator.** The kill switch only renders on Home tab. From Stats, Circles, Settings, Log, etc., the trader has no visual signal they're at 90% of daily loss. **This is the single biggest gap.** Recommend a thin top status strip across all routes: `[12:34 ET] · Today -2.1R / -3R · 70% used · 1 trade left`.
9. **No bottom-nav escalation.** Nav pill is identical at +5R or -2.9R out of -3R. The pill background colour or border could escalate red as proximity to limit increases.
10. **No timer-based session boundaries.** Many futures traders trade specific sessions (London open, NY open, Lunch, PM). The app knows `session` per trade but doesn't surface "you're now in NY Lunch — your historical NY Lunch win rate is 32%, consider skipping." This is exactly the intervention Kōda exists to make.
11. **No "stop right now" CTA.** Even at kill-switch, the only actions are "Review Today" or "Override." No "Lock the app for 15 min" / "Lock until tomorrow."
12. **Notifications are wired but not used for behavioural nudges.** Push subscription exists at `SettingsScreen.tsx:388–413` — opt-in button that subscribes via VAPID. Server route `/api/push?action=subscribe` exists. **But:** copy says "New circle activity, AI insights" — no behavioural triggers ("you have 1 trade left", "you crossed 50% of daily loss"). Also: opt-in is buried in Settings, not prompted contextually at moments where it would matter (e.g., when the user crosses 50% of daily loss for the first time, ask: "Want a push when you're 1 trade away from your limit?").

### Post-trade (decision is over, but the next one is imminent)

13. **Celebration overlay on a loss says "Stay disciplined. Review what happened." (`shared.tsx:950`)** and auto-dismisses in 2.5s. For a loss-streak this should be a longer, mandatory acknowledgement.
14. **Streak-loss overlay fires at 3+ losses** (`Koda.tsx:958`) — wired ✓. **But** the overlay is dismissable by tapping anywhere (`shared.tsx:858`, "Understood" button) and gives no cooldown. After dismissal the next Log form opens as if nothing happened. Should freeze the Log form for N minutes or require the user to manually unfreeze with a typed acknowledgement.
15. **No "30-min cooldown" after a loss.** Once a trade is logged loss, the next Log form opens identically. A behaviour-first journal would insert a cooldown: "You logged a loss 4 min ago. Take a breath before the next entry. [Continue in 26 min] [Override]."
16. **No discipline-score nudge after a rule break.** When user toggles "Rules broken ✗" (`LogTradeScreen.tsx:284`), nothing happens beyond storing the value. Could prompt: "What rule was broken? [select]" and route to the Rules tab.
17. **Mistake tag is optional and post-hoc.** Should be required when `ruleAdherence === false`.

### Strategic / weekly (decision will be made tomorrow)

18. **Discipline score is monthly only.** `Koda.tsx:3262` shows "Discipline · This month". No today, no this-week, no trend. A daily score would create the feedback loop.
19. **No "your discipline is dropping" alert.** If `followedPct` falls from 80% to 60% week over week, the app does nothing.
20. **No daily review wrap-up.** End-of-session, no "Today: 3 trades, +1.5R, 100% rules followed. Review session →." The user must navigate to Stats themselves.

### Onboarding to behavioural mode

21. **`propFirmMode` opt-in is buried in Settings.** The single biggest behavioural feature (`EvalAccountScreen`) is hidden behind a toggle the user must discover. Should be asked during onboarding step 4: "Are you trading a funded account?"
22. **No "rules first" onboarding.** Onboarding asks instruments and strategy but never asks max-daily-loss-R, max-trades-per-day, or target-R. These three values gate every behavioural feature.

---

## 6. Suggested sequencing — prioritise in-session use fixes first

### P0 (this sprint — protect the trader mid-session)

1. **Persistent daily-limit status strip across all routes.** New `<SessionStatusBar>` above main content. Reads `todayPnl`, `maxDailyLoss`, `todayTradeCount`, `maxTradesPerDay`. Escalates: green → amber at 50% → red at 75% → blocking at 100%. Visible on Home, Log, Stats, History, Circles, Sync, Settings. **Effort: M.**
2. **Hard-block Save at kill switch and at trade limit.** Replace soft banner with a confirm modal: "You're at your daily loss limit. Saving this trade overrides your rule. [Override] [Cancel]." Replace native `confirm()` with branded modal. **Effort: S.**
3. **Move `propFirmMode` setup into onboarding step 4 (or new step 5).** New users with funded accounts enter target/limit/maxDD on day 1. **Effort: S.**
4. **Drop `maximum-scale=1, user-scalable=no` from index.html.** **Effort: XS.**
5. **Fix bottom-nav clutter at 360px.** Move LotSizeCalc out of nav. **Effort: XS.**

### P1 (next sprint — make behavioural the default)

6. **Pre-trade gate sheet.** Full-screen sheet accessible from a "▶ Take a trade" button on Home and Log. Shows rules checklist for active strategy, today's proximity-to-limit, last trade outcome + cooldown timer, emotional-state picker. "Confirm → Log trade" routes to Log pre-filled. **Effort: L.**
7. **30-min cooldown after a loss.** After a logged loss, the Log form is read-only with a countdown until the user can save a new trade. Override available but tracked in `mistake` tags. **Effort: M.**
8. **Discipline score on Home hero strip.** Today's discipline %, not last month. **Effort: S.**
9. **Required mistake tag when `ruleAdherence === false`.** **Effort: XS.**
10. **Behavioural push triggers.** Push subscription is already wired (`SettingsScreen.tsx:388–413`); add server-side cron pings for: "You're 1 trade from limit", "Discipline dropped to 60% this week", "You haven't logged today" (if session active). **Effort: M.**

### P2 (design system clean-up — pays back forever)

11. **Token scale audit:** introduce `T` type scale, `S` space scale, `R` radius scale in `theme.ts`. Migrate inline literals. **Effort: L.**
12. **Canonical `Button` primitive.** Migrate all hand-rolled inline buttons. **Effort: L.**
13. **Canonical `BottomSheet` primitive.** Migrate Tour, Tradovate connect, LotSizeCalculator, NotificationsDrawer. **Effort: M.**
14. **Single toast system.** Kill legacy `Toast`, only use `ToastStack`. Migrate `showToast` to `showToastV2` with `kind`. **Effort: S.**
15. **Use `SkeletonBar` everywhere it's appropriate.** **Effort: S.**
16. **Raise `C.muted` lightness to pass WCAG AA.** **Effort: XS.**
17. **Add `:focus-visible` outlines to all buttons.** **Effort: S.**
18. **Semantic `<h1>`–`<h3>` for screens and sections.** **Effort: M.**
19. **Update README.md — TRADR → Kōda, file paths.** **Effort: XS.**

### P3 (behavioural depth)

20. **Session-aware nudges:** at NY Lunch with historical 32% win rate, banner "Your NY Lunch win rate is 32% — consider skipping."
21. **Auto-pause Log after streak-loss.**
22. **Daily review wrap-up at session end.**

---

## 7. Questions for Dylon (need screenshots, real device, or product call)

1. **Brand colour:** brief says baby-blue `#89CFF0`, `theme.ts` uses an electric oklch blue. Which is current truth? Are there mocks?
2. **`maximum-scale=1, user-scalable=no` in index.html** — intentional for PWA feel, or carry-over? Recommend removing.
3. **Bottom nav with Calc pill** — please screenshot on iPhone SE 1st gen / 360px width. Suspect overflow.
4. **Feedback floating button placement** — does it overlap the right edge of the bottom nav on real device?
5. **Discipline ring (`Koda.tsx:3260`)** — does the gradient look right against `C.panel` in both dark and light mode?
6. **Lot Size Calculator in `Koda.tsx:3973`** — should it be in the nav at all? Or moved to Log screen header / inline in form?
7. **The `BETA-680X` flow** — based on prior `FUNNEL_AUDIT.md` at repo root, this is the beta-wall / BetaGate code, not a circles flow. Confirm: current closed-beta password is set via `VITE_BETA_PASSWORD`; user types code at `BetaGate.tsx`; unlock persists in `localStorage.tradr_beta_unlocked`. Any plans to deep-link an invite (?code=BETA-680X in URL) to auto-fill BetaGate so users on Instagram DMs don't have to re-type?
8. **PostHog `priorTool` and `almostStoppedReason` first-session survey** — at what moment does it render? Does the user have to dismiss it before logging? Need to see.
9. **Tour overlay timing** — does it fire on tab change to Log, or full-screen-overlay at first sign-in? Suspect it overlaps with first-session survey.
10. **Splash colour vs LIGHT mode** — at first paint splash uses `DARK.bg`. Does a light-mode user see a black flash?
11. **Eval status badge size** — visually appears small relative to the $balance hero. Should it be the dominant element instead?
12. **Streak-loss overlay** — at how many consecutive losses does it fire? Verify in browser. (Component is defined at `shared.tsx:954–968` but I did not find the trigger in `Koda.tsx`.)
13. **Animations / perceived speed** — splash, celebration, toast transitions all need on-device verification.
14. **Push notifications** — wired in `SettingsScreen.tsx:388–413`. What server-side triggers are firing them? Is `/api/push` actually sending anything yet, or just a subscription registry?
15. **iOS Safari keyboard covering Notes textarea** — need device test for Log form bottom on iPhone with keyboard up.
16. **Dynamic-type slider (`fontScale`)** — does it actually scale anything? Inline `px` units suggest not. Need device test at 200%.
17. **Stats tab vs Home → Overview** — both surface KPIs. Reason for the split, or could one merge?
18. **`vercel.json` CSP** — is it permissive enough for the inline `<style>` blocks in `Koda.tsx:1557–1585`? Need verification.

---

*Audit prepared by static codebase review. All file paths absolute under `C:\Users\Dylon\OneDrive\Desktop\tradr-fresh\`.*
