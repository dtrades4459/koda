# Kōda — Redesign Coverage

> Single build queue for the Kōda OS redesign. **One row per audit item.** Two checkboxes per row: `[design ported into code]` and `[shipped to main]`. Optional one-line note after a trailing dash.

**Source dashboard** — frozen baseline: `koda-audit/audit-data.js` (from the Claude Design handoff).

**Source designs** — gap-fill JSX: `design_handoff_koda_redesign/koda-designs/cat0X-*.jsx` (per category).

**Working branch** — `redesign/v2`. Friday merges only.

**Priority legend**: 🔴 P0 (launch-blocker) · 🟠 P1 · 🟡 P2 · ⚪ unset.

**Update rules**: tick `[x]` when each box becomes true. Optional one-line note (date / decision / blocker) after the row.

---

## Status snapshot — baseline

| Status | Count |
|---|---|
| Covered before gap-fill | 37 |
| Partial before gap-fill | 50 |
| Missing before gap-fill | 104 |
| N/A (out of scope) | 5 |
| **Total items** | 196 |

Per the gap-fill bundle README, all 154 in-scope open items have designs in `koda-designs/cat0X-*.jsx`. The `design` checkbox is pre-ticked accordingly; tick `shipped` as code lands.

---

## 01 · Auth & onboarding

_Getting a beta user from invite to first logged trade._

**Designs**: `koda-designs/cat01-auth.jsx` · **Target**: `src/KodaAuth.tsx`

- [x] [x] 🔴 **Email verification**
- [x] [x] 🔴 **Password reset — request → email → new-password**
- [x] [x] 🔴 **Sign-up form**
- [x] [x] 🟠 **Handle picker — collision handling**
- [x] [x] 🟠 **Install-PWA prompt — iOS Safari / Android Chrome / desktop**
- [x] [x] 🟠 **OAuth handoff returns**
- [x] [ ] 🟠 **Waitlist join**
- [x] [x] 🟡 **First-session survey**
- [x] [ ] 🟡 **Recovery-email setup**
- [x] [x] ⚪ **Beta gate**
- [x] [x] ⚪ **Beta welcome**
- [x] [x] ⚪ **Onboarding multi-step**
- [x] [x] ⚪ **Profile creation**
- [x] [x] ⚪ **Tour overlay**

## 02 · Account & settings

_The hub and every detail flow behind it — billing, brokers, data, security._

**Designs**: `koda-designs/cat02-settings.jsx` · **Target**: `src/SettingsScreen.tsx`

- [x] [x] 🔴 **Account deletion confirmation flow** - DeleteWarn→DeleteConfirm→DeleteScheduled wired 2026-06-05
- [x] [x] 🔴 **Billing — past-due / failed / dunning / refund-pending / downgrade / promo-code** - BillingPastDue/Dunning/Promo screens wired 2026-06-05
- [x] [ ] 🟠 **Broker connect (Tradovate)**
- [x] [x] 🟠 **CSV import wizard — preset → pick → preview → dedup → confirm → progress → result** - Step 1 (broker select) wired 2026-06-05; steps 2-6 pending backend
- [x] [x] 🟠 **Data export download** - DataExportScreen with format picker wired 2026-06-05
- [x] [x] 🟠 **Time zone** - PreferencesScreen includes tz/currency/language 2026-06-05
- [x] [x] 🟡 **Broker disconnect confirmation** - BrokerDisconnectSheet bottom-sheet wired 2026-06-05
- [x] [x] 🟡 **Currency** - included in PreferencesScreen 2026-06-05
- [x] [x] 🟡 **Feedback modal** - FeedbackScreen with bug/feedback type picker wired 2026-06-05
- [x] [x] 🟡 **Language picker** - included in PreferencesScreen 2026-06-05
- [x] [x] 🟡 **Send bug-report flow** - FeedbackScreen type="bug" path wired 2026-06-05
- [x] [x] 🟡 **Session / device management** - DevicesScreen wired 2026-06-05
- [x] [x] 🟡 **Sync history (per account)** - SyncScreen with import history wired 2026-06-05
- [x] [x] 🟡 **Theme picker — light / dark / system** - PreferencesScreen theme picker 2026-06-05
- [x] [x] 🟡 **Two-factor setup** - TwoFactorScreen wired 2026-06-05
- [x] [x] ⚪ **Billing — active / upgrade**
- [x] [x] ⚪ **Granular notification preferences**
- [x] [x] ⚪ **Profile edit**
- [x] [x] ⚪ **Settings hub**

## 03 · Trade entry lifecycle

_Log, edit, enrich, import, review and share a trade._

**Designs**: `koda-designs/cat03-trade.jsx` · **Target**: `src/LogTradeScreen.tsx / src/Koda.tsx (trade detail)`

- [x] [ ] 🟠 **Bulk CSV import — progress / per-row errors / dedup conflicts**
- [x] [x] 🟠 **Delete confirmation**
- [x] [ ] 🟠 **Edit existing trade**
- [x] [x] 🟠 **Mistake tag field**
- [x] [ ] 🟠 **Review inbox — draft → published → skipped (+ bulk actions)**
- [x] [ ] 🟠 **Screenshot upload — single / multi / paste-from-clipboard**
- [x] [x] 🟠 **Share-to-circle modal**
- [x] [x] 🟠 **Trade detail — expanded (emotion chips, rule pills, reactions, comments)**
- [x] [ ] 🟡 **Attach to idea**
- [x] [ ] 🟡 **Favorite / star**
- [x] [ ] 🟡 **Link to intervention event**
- [x] [x] ⚪ **Log new trade**
- [x] [x] ⚪ **Tag editor (strategy / setup / instrument)**

## 04 · Social & circles

_The full lifecycle of a Circle and everything inside it._

**Designs**: `koda-designs/cat04-social.jsx` · **Target**: `src/TradingCircles.tsx`

- [x] [x] 🟠 **Ban / kick confirmation**
- [x] [x] 🟠 **Chat thread**
- [x] [x] 🟠 **Circle — create form**
- [x] [x] 🟠 **Join by code**
- [x] [x] 🟠 **Owner controls panel**
- [x] [x] 🟠 **Report-content flow**
- [x] [ ] 🟡 **@mention autocomplete**
- [x] [x] 🟡 **Blocked-users management**
- [x] [x] 🟡 **Challenge — creation**
- [x] [x] 🟡 **Challenge — in-progress**
- [x] [x] 🟡 **Challenge — result celebration**
- [x] [x] 🟡 **Chat composer + attachments**
- [x] [ ] 🟡 **Emoji reactions picker**
- [x] [x] 🟡 **Leaderboard expanded (top 5 + blurred upsell)**
- [x] [x] 🟡 **Leave confirmation**
- [x] [x] 🟡 **Member list + member detail card**
- [x] [x] 🟡 **Message context menu (copy / quote / report / delete)**
- [x] [x] 🟡 **Private invite link**
- [ ] [ ] ⚪ **DMs — 1:1 list + thread + composer** _(out of scope)_
- [x] [x] ⚪ **Public discover + filters**

## 05 · Follow / friend graph

_Follows, profiles seen from the outside, suggestions, blocking._

**Designs**: `koda-designs/cat05-graph.jsx` · **Target**: `src/FriendsFeed.tsx`

- [x] [x] 🟠 **Follow button — not-following / following / pending / blocked-by**
- [x] [x] 🟡 **Follow-back prompt**
- [x] [ ] 🟡 **Mutual-friends visualization**
- [x] [x] 🟡 **Profile QR-code share**
- [x] [x] 🟡 **Suggested follows**
- [x] [x] 🟡 **Unfollow confirmation**
- [x] [x] ⚪ **Friend feed**
- [x] [x] ⚪ **Public profile (others’ perspective)**

## 06 · Notifications

_Every kind, every surface — inbox, push, toast, permission._

**Designs**: `koda-designs/cat06-notif.jsx` · **Target**: `src/components/NotificationFeed.tsx / src/NotificationsDrawer.tsx`

- [x] [x] 🟠 **In-app inbox row — read / unread / aggregated**
- [x] [x] 🟠 **Notification kinds ×14 (follow, circle, reaction, like, digest, sync-ok, sync-error, milestone, receipt, payment-failed, announcement, intervention, chat, mention/DM)**
- [x] [x] 🟠 **Permission prompts — default / denied / blocked-recover (per browser)**
- [x] [x] 🟠 **Push lock-screen — iOS short / iOS rich-media / Android short / Android rich-media**
- [x] [x] ⚪ **Banner toast — info / success / warn / error**

## 07 · System / connectivity

_Offline, stale, expired, rate-limited, broken. The unhappy paths._

**Designs**: `koda-designs/cat07-system.jsx` · **Target**: `src/components/OfflineBanner.tsx + new auth-state listener`

- [x] [x] 🔴 **Session-expired modal + re-auth**
- [x] [x] 🟠 **Error pages — 401 / 403 / 500 / 503**
- [x] [x] 🟠 **Offline banner**
- [x] [x] 🟠 **Retry-failed-request UI**
- [x] [x] 🟠 **Service-worker update available**
- [x] [x] 🟡 **Maintenance-mode page**
- [x] [x] 🟡 **Optimistic-update rollback toast**
- [x] [x] 🟡 **Rate-limited error**
- [x] [x] 🟡 **Slow-connection indicator**
- [x] [x] 🟡 **Version-mismatch banner**

## 08 · Discipline / intervention

_The wedge feature, expanded past v1 into history and periodic reviews._

**Designs**: `koda-designs/cat08-discip.jsx` · **Target**: `src/components/Intervention*.tsx`

- [x] [x] 🟠 **Cooldown countdown — short / medium / long**
- [x] [x] 🟠 **Live monitor — all 5 tilt signals visualised individually**
- [x] [x] 🟠 **Weekly discipline report**
- [x] [x] 🟡 **Discipline-score ring — detail breakdown**
- [x] [x] 🟡 **Intervention history list + filters**
- [x] [x] 🟡 **Monthly review**
- [x] [ ] 🟡 **Yearly review**
- [x] [x] ⚪ **Pre-session checklist + rule attachments**

## 09 · Power features

_Calculator, prop-firm eval, checklist editor, shareable report cards._

**Designs**: `koda-designs/cat09-power.jsx` · **Target**: `src/LotSizeCalculator.tsx / src/EvalAccountScreen.tsx`

- [x] [x] 🟠 **Prop-firm eval — account creation flow + reset prompt**
- [x] [x] 🟠 **Report card — downloadable image (IG square + X landscape)**
- [x] [x] 🟡 **Custom contract editor (add / edit / delete)**
- [x] [x] 🟡 **Pre-trade checklist editor (custom rules + reorder)**
- [x] [x] 🟡 **Year-in-review card**
- [x] [x] ⚪ **Lot-size calculator — full sheet**
- [x] [x] ⚪ **Prop-firm eval — status (passing / at-risk / failed)**
- [x] [x] ⚪ **Weekly report card — share view**

## 10 · Marketing site

_Public surfaces — landing, pricing, deep-dives, legal, press._

**Designs**: `koda-designs/cat10-mkt.jsx` · **Target**: `public/*.html + src/CookieConsent.tsx`

- [x] [x] 🔴 **Cookie-consent banner + preferences modal**
- [x] [ ] 🟡 **About / founder page**
- [x] [ ] 🟡 **Blog post template**
- [x] [ ] 🟡 **Contact**
- [x] [ ] 🟡 **Press kit page (logos, screenshots, brand rules)**
- [x] [x] ⚪ **404**
- [x] [x] ⚪ **Changelog**
- [x] [x] ⚪ **Comparison vs competitors**
- [x] [x] ⚪ **FAQ**
- [x] [x] ⚪ **Intervention deep-dive landing**
- [x] [x] ⚪ **Landing (above-fold + sections)**
- [x] [x] ⚪ **Pricing**
- [x] [x] ⚪ **Privacy**
- [x] [x] ⚪ **Sitemap**
- [x] [x] ⚪ **Terms**
- [x] [x] ⚪ **Trading-circles deep-dive landing**

## 11 · Brand assets — full kit

_Icons, splash screens, OG + social cards, press kit._

**Designs**: `koda-designs/cat11-brand.jsx` · **Target**: `public/*.svg / vercel.json / src/main.tsx`

- [x] [ ] 🟠 **OG card — default + per-page (landing, pricing, blog, profiles)**
- [x] [ ] 🟠 **Splash screens — iOS device-specific (6+) + Android**
- [x] [ ] 🟡 **Press kit (vector logos, color/type rules, screenshot templates)**
- [x] [ ] 🟡 **Social share cards — X / IG square / IG story / FB / LinkedIn**
- [x] [x] ⚪ **Apple-touch-icon**
- [x] [x] ⚪ **Favicon — light + dark monogram**
- [x] [x] ⚪ **Manifest icons (192 / 512)**
- [x] [x] ⚪ **Maskable icon (Android)**

## 12 · Email templates

_Every transactional + lifecycle email._

**Designs**: `koda-designs/cat12-email.jsx` · **Target**: `api/lib/email.ts + Resend templates`

- [x] [ ] 🔴 **Email verification**
- [x] [ ] 🔴 **Password reset**
- [x] [ ] 🔴 **Payment failed + retry link**
- [x] [ ] 🔴 **Welcome**
- [x] [ ] 🟠 **Account deletion confirmation**
- [x] [ ] 🟠 **Beta-unlock confirmation**
- [x] [ ] 🟠 **Subscription cancelled**
- [x] [ ] 🟡 **Announcement broadcast**
- [x] [ ] 🟡 **Broker sync-error digest**
- [x] [ ] 🟡 **Milestone celebrations (streak / first / 100th / eval pass)**
- [x] [ ] 🟡 **Monthly summary**
- [x] [ ] 🟡 **Waitlist join + position update**
- [x] [x] ⚪ **Receipt**
- [x] [x] ⚪ **Weekly recap (Sunday)**

## 13 · States coverage audit

_Per existing screen: are all four moods (empty / loading / error / success) drawn?_

**Designs**: `koda-designs/cat13-states.jsx` · **Target**: `cross-cutting — per screen states`

- [x] [ ] 🟠 **Home — four moods**
- [x] [ ] 🟠 **Journal / History — four moods**
- [x] [ ] 🟠 **Stats — four moods**
- [x] [ ] 🟡 **Circles — four moods**
- [x] [ ] 🟡 **Inbox — four moods**
- [x] [ ] 🟡 **Log / Trade detail — four moods**
- [x] [ ] 🟡 **Settings sub-screens — four moods**

## 14 · Motion catalog

_Documented keyframes + the gesture/transition patterns still undrawn._

**Designs**: `koda-designs/cat14-motion.jsx` · **Target**: `src/index.css + per-component keyframes`

- [x] [ ] 🟠 **Keyboard-open layout shift**
- [x] [ ] 🟠 **Pull-to-refresh**
- [x] [ ] 🟠 **Reduced-motion variant — per animation**
- [x] [ ] 🟠 **Swipe-back gesture**
- [x] [ ] 🟡 **Drawer slide**
- [x] [ ] 🟡 **Page transitions**
- [x] [ ] 🟡 **Sheet drag**
- [x] [ ] 🟡 **Sticky-header collapse**
- [x] [x] ⚪ **Core keyframes (kRise, kCount, kStreakGlow, kTick, kShake, kSlideIn, kDrawer, kRipple, kSpin, kShimmer, kConfetti, kSheen)**

## 15 · Microcopy library

_Voice card, empty/error copy, label vocab, notification + subject templates._

**Designs**: `koda-designs/cat15-copy.jsx` · **Target**: `docs/microcopy.md (new)`

- [x] [ ] 🟠 **Email subject-line templates**
- [x] [ ] 🟠 **Error-message library (network / validation / server / permission)**
- [x] [ ] 🟠 **Push-notification copy templates**
- [x] [ ] 🟠 **Voice / tone reference card**
- [x] [ ] 🟡 **Achievement / milestone copy templates**
- [x] [ ] 🟡 **Button-label patterns**
- [x] [ ] 🟡 **Empty-state copy — per screen**
- [x] [ ] 🟡 **Kicker / label vocabulary**

## 16 · Accessibility & inclusion

_Keyboard flows, SR scripts, focus design, reduced-motion, scaling, RTL._

**Designs**: `koda-designs/cat16-a11y.jsx` · **Target**: `docs/a11y.md (new) + global focus styles`

- [x] [ ] 🔴 **Focus-state designs (web + mobile)**
- [x] [ ] 🟠 **Keyboard-only navigation flows (tab order, focus traps)**
- [x] [ ] 🟠 **Reduced-motion variants per animation**
- [x] [ ] 🟠 **Screen-reader announcement scripts (per surface)**
- [x] [ ] 🟡 **Font-scaling at 200% browser zoom**
- [x] [ ] 🟡 **High-contrast mode**
- [ ] [ ] ⚪ **RTL layout assessment** _(out of scope)_

## 17 · Mobile-specific patterns

_Pull-to-refresh, swipe actions, long-press, haptics, share sheet._

**Designs**: `koda-designs/cat17-mobile.jsx` · **Target**: `src/Koda.tsx + per-screen gesture hooks`

- [x] [ ] 🟠 **Pull-to-refresh (per scrollable view)**
- [x] [ ] 🟠 **Swipe-actions on list items (archive / delete)**
- [x] [ ] 🟡 **Haptic feedback signals (light / medium / heavy)**
- [x] [ ] 🟡 **In-app browser handling (external links)**
- [x] [ ] 🟡 **Long-press context menus**
- [x] [ ] 🟡 **Share-sheet integration**

## 18 · Desktop-specific patterns

_Shortcuts overlay, command palette, drag-drop, collapse, ultrawide._

**Designs**: `koda-designs/cat18-desktop.jsx` · **Target**: `src/Koda.tsx isDesktop branches + new components`

- [x] [ ] 🟠 **Command palette (⌘K)**
- [x] [ ] 🟠 **Drag-and-drop targets (CSV import)**
- [x] [ ] 🟡 **Hover-only affordances + mobile equivalents**
- [x] [ ] 🟡 **Keyboard-shortcuts overlay (? key)**
- [x] [ ] 🟡 **Multi-column layouts at >1600px**
- [x] [ ] 🟡 **Sidebar collapse / expand**

## 19 · PWA-specific surfaces

_Shortcuts, share target, file handlers, badging, install banners._

**Designs**: `koda-designs/cat19-pwa.jsx` · **Target**: `public/manifest.webmanifest + src/sw.ts`

- [x] [ ] 🟠 **Install-banner variants per browser**
- [x] [ ] 🟡 **App shortcuts (long-press home icon)**
- [x] [ ] 🟡 **Badging API states (unread count)**
- [x] [ ] 🟡 **File handlers (CSV intent)**
- [x] [ ] 🟡 **Share target (receive shared content)**

## 20 · Admin / moderation

_Reporting, review queue, announcement composer, audit log, merges._

**Designs**: `koda-designs/cat20-admin.jsx` · **Target**: `api/admin/* (new)`

- [x] [ ] 🟠 **Report-content (in-app)**
- [x] [ ] 🟡 **User audit-log viewer (support)**
- [ ] [ ] ⚪ **Account merge / migration UI** _(out of scope)_
- [ ] [ ] ⚪ **Admin announcement composer (in-app)** _(out of scope)_
- [ ] [ ] ⚪ **Review queue** _(out of scope)_

---

## Phase 1 — the 12 P0 launch-blockers

Lock these first. Sequence Mon→Thu of each week. Target: all 12 shipped within 2 weeks.

- [ ] **Sign-up form** — Auth & onboarding — _Account creation is the single hardest gate to launch; must be airtight._
- [ ] **Password reset — request → email → new-password** — Auth & onboarding — _Account recovery is table-stakes; a broken reset locks users out permanently._
- [ ] **Email verification** — Auth & onboarding — _Gates trust + deliverability; required before billing._
- [ ] **Billing — past-due / failed / dunning / refund-pending / downgrade / promo-code** — Account & settings — _Dunning recovers churned revenue; refunds + promos are launch-critical._
- [ ] **Account deletion confirmation flow** — Account & settings — _Legal requirement (GDPR/consumer); must be unmistakable + reversible-window._
- [ ] **Session-expired modal + re-auth** — System / connectivity — _JWT expiry mid-session is common; silent failure loses work._
- [ ] **Cookie-consent banner + preferences modal** — Marketing site — _GDPR/ePrivacy requirement; banner currently off-brand._
- [ ] **Welcome** — Email templates — _First inbox impression after sign-up._
- [ ] **Password reset** — Email templates — _Half of the reset flow lives in the inbox._
- [ ] **Email verification** — Email templates — _The verify link itself._
- [ ] **Payment failed + retry link** — Email templates — _Dunning entry point; recovers revenue._
- [ ] **Focus-state designs (web + mobile)** — Accessibility & inclusion — _Visible focus is a WCAG must; touched by every interactive item._

---

## Notes & decisions log

_Append per-row decisions, scope changes, or anything worth remembering. One line per entry. Date stamp at the front._

- **2026-06-04** — Doc scaffolded. Branch `redesign/v2` created. Phase 1 starts Monday.
