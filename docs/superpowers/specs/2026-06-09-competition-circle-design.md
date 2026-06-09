# Competition Circle — Design Spec
**Date:** 2026-06-09  
**Feature:** 50K Eval Challenge — in-app competition banner + circle  
**Status:** Approved for implementation

---

## Overview

A 30-day opt-in trading competition tied to the June 15 launch. Users join via a home-feed banner or a featured card in the Circles tab. Joining adds them to a dedicated competition circle with an R-multiple leaderboard (togglable to net P&L $). A rules page is linked at the bottom of the circle.

**Competition window:** June 15, 2026 00:00 UTC – July 15, 2026 23:59 UTC  
**Circle code:** `50K-EVAL-2026`  
**Primary metric:** R-multiple (togglable to dollar P&L)

---

## 1. Data Layer

### Migration 1 — Seed competition circle in `shared_kv`

```sql
INSERT INTO shared_kv (key, value, owner_id)
VALUES (
  'koda_circle_50K-EVAL-2026',
  '{
    "id": 2,
    "code": "50K-EVAL-2026",
    "name": "50K Eval Challenge",
    "description": "30-day prop eval challenge. Best R-multiple wins.",
    "strategy": "",
    "privacy": "public",
    "emoji": "⚡",
    "metric": "r",
    "createdBy": "Kōda",
    "createdAt": "2026-06-15T00:00:00.000Z"
  }',
  '00000000-0000-0000-0000-000000000000'::uuid
)
ON CONFLICT (key) DO NOTHING;
```

Same sentinel UUID pattern as `KODA-GLOBAL`. Safely re-runnable.

### Migration 2 — Insert challenge row in `circle_challenges`

```sql
INSERT INTO circle_challenges (circle_code, title, metric, started_at, ends_at, created_by, status)
VALUES (
  '50K-EVAL-2026',
  '50K Eval — June 2026',
  'r',
  '2026-06-15T00:00:00.000Z',
  '2026-07-15T23:59:59.000Z',
  'Kōda',
  'active'
);
```

### Leaderboard entry schema change

Each `shared_kv` entry for this circle (`koda_circle_entry_50K-EVAL-2026_{memberCode}`) must store **both** metrics so the toggle can re-sort client-side:

```json
{
  "memberCode": "...",
  "name": "...",
  "handle": "...",
  "r": 12.4,
  "dollar": 2340.00,
  "trades": 18,
  "updatedAt": "..."
}
```

The existing leaderboard writer for this circle must always write both `r` and `dollar`. Other circles are unaffected.

---

## 2. `CompetitionBanner` Component

**File:** `src/components/CompetitionBanner.tsx`

### Visibility rules (all must be true to show)
- `localStorage.getItem("koda_comp_2026_joined") !== "1"` (not already joined)
- `Date.now() < 1752624000000` (before July 15 2026 23:59 UTC — hardcoded constant)
- User is logged in (caller responsibility — banner is only rendered inside the authenticated app)

### Layout
Rendered in the home feed above the existing `announcement` card.

```
┌─────────────────────────────────────────────┐
│ ⚡ 50K EVAL CHALLENGE · JUNE 15 – JULY 15   │  ← mono kicker, mint/accent
│                                             │
│ Trade your eval.                            │  ← display headline
│ Win the leaderboard.                        │
│                                             │
│ 30-day R-multiple competition. Free to      │  ← body, text2
│ enter.                                      │
│                                             │
│ [ Enter competition ▶ ]         [ × ]       │  ← primary CTA + dismiss
└─────────────────────────────────────────────┘
```

Glass surface (`C.surfaceGlass`), accent border (`color-mix(in oklch, C.live 25%, transparent)`), `borderRadius: 16`, padding `18px 20px`.

### Behaviour
- **"Enter competition"**: calls `joinCircleByCode("50K-EVAL-2026")`, sets `localStorage("koda_comp_2026_joined", "1")`, navigates to Circles tab with the competition circle selected. Button shows spinner during the async call. On error: shows toast "Couldn't join — try again."
- **"×"**: soft dismiss (local state only — does not set the localStorage flag, so it reappears next session until the user joins).

### Props
```ts
interface CompetitionBannerProps {
  C: Theme;
  isMobile: boolean;
  onJoin: () => Promise<void>;   // caller wraps joinCircleByCode + navigation
  onDismiss: () => void;
}
```

---

## 3. Circles Tab — Featured Card

Non-members see a "Featured" card pinned above their joined circles list.

### Visibility
Same two conditions as the banner: not joined + before July 15.

### Layout
```
┌─────────────────────────────────────────────┐
│ ⚡ FEATURED COMPETITION          [Enter ▶]  │
│ 50K Eval Challenge                          │
│ June 15 – July 15 · R-multiple leaderboard  │
│ 142 traders entered                         │
└─────────────────────────────────────────────┘
```

Member count is fetched via a Supabase count query: `shared_kv` rows where `key ilike 'koda_circle_entry_50K-EVAL-2026_%'` with `{ count: 'exact', head: true }`. Displayed as-is up to 999, then `"1000+ traders"`.

Join button uses identical mechanics to the banner (same `onJoin` callback pattern, same localStorage flag, same error toast).

### Already-joined display
The competition circle appears in the normal joined circles list with a `⚡` badge on its emoji avatar. No other special treatment.

---

## 4. Competition Circle Screen

The existing circle screen is used as-is with three additions:

### 4a. R / $ Toggle Pill
- Positioned top-right of the leaderboard header row
- Two segments: `R` (default) and `$`
- Switching re-sorts the leaderboard entries by `r` or `dollar` respectively, client-side
- Selected segment uses `C.live` background; unselected is ghost

### 4b. Competition Status Bar
Rendered below the circle name, above the leaderboard:

| Condition | Copy |
|-----------|------|
| `now < Jun 15` | `"Starts in X days"` |
| `Jun 15 ≤ now ≤ Jul 15` | `"X days remaining · Y traders"` |
| `now > Jul 15` | `"Competition closed · winner announced below"` |

Mono small-caps, `C.muted` colour, centred.

### 4c. Rules Link Footer
Pinned to the absolute bottom of the circle screen scroll area. Styled identically to the privacy notice footer:

```
View competition rules →
```

Links to `/competition-rules.html` (static page, same build pattern as `/privacy.html`).

---

## 5. Static Rules Page

**File:** `public/competition-rules.html`

Contains the following rules (styled to match `/privacy.html`):

**50K Eval Challenge — Official Rules**

- **Period:** June 15, 2026 00:00 UTC – July 15, 2026 23:59 UTC
- **Entry:** Free. Open to all Kōda users who join the circle before the competition closes. One entry per account.
- **Scoring:** Total R-multiple across all trades logged in Kōda during the window. Minimum 10 trades required to be eligible.
- **Tiebreaker:** Highest net dollar P&L if R-multiple is equal.
- **Evidence:** A screenshot must be attached to every trade logged during the window. Entries missing screenshots on any trade will be disqualified.
- **Prize:** 1× funded evaluation account at 50k account size, free of charge. Winner must pass the eval under the firm's standard rules to receive a funded account. No cash alternative.
- **Winner announcement:** On or before July 18, 2026 via the Kōda app and the competition circle.
- **Fair play:** Trades must reflect real activity. Kōda reserves the right to disqualify accounts showing signs of manipulation or backdating. Kōda's decision is final.
- **Eligibility:** 18+. Void where prohibited.

> **TODO before publish:** Replace "the firm" with the prop firm's name once confirmed.

---

## 6. localStorage Keys

| Key | Value | Purpose |
|-----|-------|---------|
| `koda_comp_2026_joined` | `"1"` | Suppresses banner + featured card permanently after join |

---

## 7. Hardcoded Constants (in `CompetitionBanner.tsx`)

```ts
const COMP_CIRCLE_CODE = "50K-EVAL-2026";
const COMP_END_TS = 1752624000000; // 2026-07-15T23:59:00Z
const COMP_JOINED_KEY = "koda_comp_2026_joined";
```

---

## 8. Files Changed / Created

| File | Action |
|------|--------|
| `supabase/migrations/20260615_seed_competition_circle.sql` | New — seeds circle + challenge |
| `src/components/CompetitionBanner.tsx` | New |
| `src/Koda.tsx` | Edit — render `CompetitionBanner` in home feed; wire `onJoin` |
| `src/TradingCircles.tsx` | Edit — featured card in circles list; R/$ toggle; status bar; rules link footer; dual-metric leaderboard writer |
| `public/competition-rules.html` | New — static rules page |

---

## 9. Out of Scope

- Push notifications for competition start/end
- Admin dashboard for manual disqualification
- Automatic winner announcement — Dylon announces manually via the competition circle chat
- Late-joiner pro-rating (all trades from the window count regardless of join date)
