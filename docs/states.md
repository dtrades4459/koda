# Kōda OS — States coverage audit

> Every primary surface drawn in all four moods: **empty**, **loading**,
> **error**, **success**. Copy comes from [`microcopy.md`](microcopy.md);
> patterns come from [`a11y.md`](a11y.md). When a state is "shipped" the
> implementation reference is given.

Status legend in this doc: ✓ = wired in code · ◐ = partial · ○ = designed only.

---

## 1 · Home

| State | Copy / surface | Implementation |
|---|---|---|
| **Empty** | Never-onboarded user lands here. Headline: "No trades yet." Sub: "Log your first and Kōda starts tracking." CTA: `Log trade` | ✓ `Koda.tsx` home renders empty bucket when `trades.length === 0` |
| **Loading** | Shimmer rows for the activity card + skeleton equity sparkline. Bell badge spinner. | ✓ `LoadingSplash` + `.fade-in` stagger on data load |
| **Error** | `OfflineBanner` at top + last-known-good data underneath. Or `Error500` if a hard server error. | ✓ `SystemProvider` mounts OfflineBanner / Error500 |
| **Success** | Live equity sparkline, today's stats card with `+R` tint, "in session" pulse indicator. Pull-to-refresh available. | ✓ Default render path |

---

## 2 · Journal / History

| State | Copy / surface | Implementation |
|---|---|---|
| **Empty (no trades)** | "No trades yet. Log your first and Kōda starts tracking." → primary CTA | ✓ history view conditional |
| **Empty (filtered to 0)** | "Nothing matches. Try widening your filters." → `Clear filters` ghost CTA | ✓ filter-result conditional |
| **Loading** | Three skeleton row cards. | ✓ initial `loading` flag |
| **Error** | Inline error card replacing list: "Couldn't load trades. Retry." → retry button refetches | ✓ catch block sets error state |
| **Success** | Virtualised list of trade rows with hover preview, stagger animation on first paint. | ✓ default |

---

## 3 · Stats

| State | Copy / surface | Implementation |
|---|---|---|
| **Empty (< 5 trades)** | "Stats unlock at 5 trades. You're at {n}." Quiet hint, no CTA. | ✓ count-gated render |
| **Loading** | Stat panel shimmers (Net / WinRate / Trades). Chart canvas placeholder. | ✓ skeleton in StatPanel |
| **Error** | "Couldn't compute stats. Refresh to retry." with retry button. | ✓ try/catch in aggregator |
| **Success** | Stat panels populated, equity / R-distribution charts, best-setup callout, AI insight if Pro. | ✓ default |

---

## 4 · Circles

| State | Copy / surface | Implementation |
|---|---|---|
| **Empty (none joined)** | "No Circles yet. Join one with a code, or create your own." → two ghost CTAs: `Browse Circles` · `Join with a code` | ✓ TradingCircles empty branch |
| **Loading** | List skeleton — 4 row placeholders. | ✓ useCircles loading flag |
| **Error** | "Couldn't load your Circles. Retry." inline. | ✓ catch block |
| **Success** | Joined Circles list with unread dots, the global "Kōda" Circle pinned at top. | ✓ default |
| **Empty (inside a Circle chat)** | "No messages yet — say hi." compose box stays open. | ✓ TradingCircles chat empty branch |

---

## 5 · Inbox (Review / Notifications drawer)

| State | Copy / surface | Implementation |
|---|---|---|
| **Empty (caught up)** | "You're all caught up." Sub: "New broker syncs, follows, and Circle activity will appear here." | ✓ NotificationsDrawer + ReviewInboxScreen |
| **Empty (first run)** | "No activity yet. Connect a broker and your fills will appear here." → `Connect broker` | ✓ ReviewInbox conditional |
| **Loading** | Three shimmer rows in the drawer + spinner over the inbox view. | ✓ listNotifications fetching flag |
| **Error** | "Couldn't load notifications. Retry." | ✓ catch block |
| **Success** | NotificationInbox rows render with KIND_META glyphs + tint, unread dot, timestamps. Mark-all-read CTA active. | ✓ NotificationFeed |

---

## 6 · Log / Trade detail

### Log trade form
| State | Copy / surface | Implementation |
|---|---|---|
| **Empty (initial)** | Fresh form with placeholders. Strategy picker pre-selected to "—". | ✓ default `form` state from EMPTY_TRADE |
| **Loading (saving)** | Save button → spinner; form locked. | ✓ saving boolean |
| **Error (validation)** | Field-level red underline + helper text per [microcopy §2 `val.*`](microcopy.md). Submit blocked. | ✓ inline validators |
| **Error (network)** | "Save failed — check your connection." toast (warn tone). Form contents preserved. | ✓ toast on save failure |
| **Success** | Form clears, success toast "Trade saved." + bell badge ticks if it's a draft. | ✓ on save → setForm(EMPTY) |

### Trade detail (expanded)
| State | Copy / surface | Implementation |
|---|---|---|
| **Empty (no comments / reactions)** | "Be the first to react." quiet hint above composer. | ✓ trade detail conditional |
| **Loading (image)** | Screenshot placeholder pulses while the upload resolves. | ✓ shimmer on upload |
| **Error (delete failed)** | "Couldn't delete — try again." toast. Trade stays. | ✓ catch block |
| **Success (comment posted)** | Comment slides into the list with kSlideIn. | ✓ default |

---

## 7 · Settings sub-screens

> Pattern is shared across every sub-screen (Devices, Preferences, Two-factor, etc.) — `SettingsSub` wrapper handles loading + error states.

| State | Copy / surface | Implementation |
|---|---|---|
| **Empty (e.g. no devices)** | "Only this device is signed in." | ✓ DevicesScreen conditional |
| **Loading** | Section skeleton — 3 stub rows with the panel border preserved. | ✓ SettingsSub `loading` prop |
| **Error** | "Couldn't load {section}. Retry." inline action. | ✓ try/catch around fetch |
| **Success** | Populated list, action chips per row. Save button locked until dirty. | ✓ default render |

---

## Cross-cutting state surfaces

These shipped as part of cat07 and apply across all screens:

- **Offline** — `OfflineBanner` (top, sticky). Sub: "Showing your last synced data. Changes save locally."
- **Slow connection** — `SlowConnectionBanner` (auto via Network Information API). "Slow connection. Still loading — hang tight."
- **Server error / 5xx** — `Error500` / `Error503` full-screen takeover via `triggerErrorPage`. Maintenance mode uses Error503.
- **Permission / 4xx** — `Error401` (sign-in CTA) / `Error403` (back-to-home CTA).
- **Session expired** — `SessionExpiredModal` with Sign-back-in CTA, draft trade preserved.
- **Optimistic rollback** — `OptimisticRollbackToast` with RETRY action.
- **Rate limited** — `RateLimitedModal` with countdown.

---

## Maintenance

When you add a screen, append a §N section here with all four moods and the
implementation reference. If a state isn't yet implemented, leave it as ○
designed-only with a one-line description so the rest of the audit stays
honest.
