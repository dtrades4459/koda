# Kōda Ideas — Design Spec
**Date:** 2026-06-02  
**Status:** Approved

---

## Overview

An Ideas section for Kōda, inspired by TradingView Ideas. Traders publish pre-trade setups or post-trade breakdowns. All ideas are public (visible to all authenticated Kōda users). Discovery is a chronological feed. Social interaction is likes only.

---

## Navigation

- The existing "Feed" bottom nav tab is renamed to **"Social"**.
- Sub-tabs inside Social: `Friends · Ideas · People` (Ideas is new, slots between Friends and People).
- The Ideas sub-tab renders `<IdeasScreen />`.
- A floating **"+ New Idea"** FAB sits bottom-right of the Ideas tab on both mobile and desktop.

---

## Data Model

### `public.ideas`

| Column | Type | Nullable | Notes |
|---|---|---|---|
| `id` | uuid PK | no | `gen_random_uuid()` |
| `author_uid` | uuid → auth.users | no | |
| `author_handle` | text | no | Denormalised for feed performance |
| `author_name` | text | no | Denormalised |
| `author_avatar` | text | yes | Denormalised |
| `type` | text | no | `'pre' \| 'post'` |
| `title` | text | no | Max 120 chars |
| `body` | text | no | Full analysis write-up |
| `instrument` | text | no | e.g. `NQ`, `ES`, `BTC/USD` |
| `timeframe` | text | yes | e.g. `15m`, `1h`, `Daily` |
| `direction` | text | no | `'long' \| 'short' \| 'neutral'` |
| `entry_price` | text | yes | |
| `stop_price` | text | yes | |
| `target_price` | text | yes | |
| `chart_url` | text | yes | Supabase Storage URL |
| `linked_trade_id` | integer | yes | → public.trades.id |
| `created_at` | timestamptz | no | `now()` |

### `public.idea_likes`

| Column | Type | Notes |
|---|---|---|
| `id` | uuid PK | |
| `idea_id` | uuid → ideas.id | ON DELETE CASCADE |
| `user_uid` | uuid → auth.users | |
| `created_at` | timestamptz | |

Unique constraint: `(idea_id, user_uid)` — one like per user per idea.

### RLS

- `ideas`: SELECT for all authenticated users; INSERT/DELETE for `auth.uid() = author_uid` only.
- `idea_likes`: SELECT for all authenticated; INSERT/DELETE for `auth.uid() = user_uid` only.

---

## API — `api/ideas.ts` (uses serverless slot 10 of 12)

| `?action=` | Method | Auth | Description |
|---|---|---|---|
| `list` | GET | required | Returns 20 ideas per page (`?page=0`), reverse-chronological. Each row includes `like_count` and `liked_by_me` (boolean). |
| `create` | POST | required | Validates `title`, `body`, `instrument`, `direction`, `type`. Inserts idea row. Returns created idea. |
| `like` | POST | required | Toggle — inserts `idea_likes` row or deletes it if already exists. Returns `{ liked: boolean, count: number }`. |
| `delete` | DELETE | required | Deletes idea where `id = ?` AND `author_uid = auth.uid()`. |

**Image upload:** Client-side direct upload to the `trade-screenshots` Supabase Storage bucket. No serverless slot needed.

---

## Frontend Components

### `src/IdeasScreen.tsx`
- Fetches `GET /api/ideas?action=list&page=N` on mount and on infinite scroll trigger.
- Renders `<IdeaCard />` list, `<IdeaComposer />` (modal/sheet), and empty state.
- Manages `ideas[]`, `page`, `hasMore`, `composerOpen` state locally.
- Empty state text: *"No ideas yet — be the first to post."*

### `src/components/IdeaCard.tsx`

**Collapsed (feed) layout:**
- Top row: avatar → handle → type badge (`PRE` / `POST`) → timestamp (right-aligned) → chart thumbnail (if present, 56×56px, rounded)
- Title (bold, 1 line truncated on mobile)
- Body preview (2 lines, truncated with ellipsis)
- Tags row: instrument pill (purple) · direction badge (blue=long / red=short / grey=neutral) · timeframe pill
- Entry / Stop / Target inline row (only rendered if at least one is set)
- Footer: ❤️ like button + count · "Tap to expand" hint

**Expanded (full detail):**
- Same header
- Chart image full-width (if present), tappable to open in lightbox
- Full title + full body
- Full tags + prices
- Linked trade badge (if `linked_trade_id` set): "View trade →"
- Like button

**Desktop:** Card max-width 680px centred. Chart thumbnail expands to 80×80px.

### `src/IdeaComposer.tsx`

Single scrollable form. Fields in order:
1. **Type toggle** — `PRE-TRADE` / `POST-TRADE` (segmented control)
2. **Title** — text input, required, placeholder: *"e.g. NQ break above VWAP"*
3. **Instrument · Direction · Timeframe** — three inputs on one row
4. **Entry · Stop · Target** — three inputs on one row (all optional)
5. **Body** — textarea, required, placeholder: *"Write your analysis..."*
6. **Chart image** — file input, optional, client-side upload to Supabase Storage on post
7. **Link trade** — dropdown of user's 10 most recent trades (post-trade only, optional)
8. **Post Idea** — primary button

**Mobile:** Rendered as a bottom sheet (same pattern as existing Kōda sheets).  
**Desktop:** Centred modal overlay, max-width 560px.

### `src/FriendsFeed.tsx`
- Add `"ideas"` to the tab union type.
- Render `<IdeasScreen />` when tab is `"ideas"`.
- Pass `myUid` and `profile` into `<IdeasScreen />`.

### `src/Koda.tsx`
- Rename Social nav tab label from `"Feed"` (or current label) to `"Social"`.
- No other changes — `myUid` and `profile` are already passed to FriendsFeed.

### `src/types.ts`
Add:
```ts
export interface Idea {
  id: string;
  authorUid: string;
  authorHandle: string;
  authorName: string;
  authorAvatar: string | null;
  type: "pre" | "post";
  title: string;
  body: string;
  instrument: string;
  timeframe: string | null;
  direction: "long" | "short" | "neutral";
  entryPrice: string | null;
  stopPrice: string | null;
  targetPrice: string | null;
  chartUrl: string | null;
  linkedTradeId: number | null;
  createdAt: string;
  likeCount: number;
  likedByMe: boolean;
}
```

---

## Supabase Migration

New file: `supabase/migrations/20260602_ideas.sql`

Creates `ideas` table, `idea_likes` table, RLS policies, and a `NOTIFY pgrst, 'reload schema'` at the end.

---

## Desktop Responsiveness

All new screens use `max-width: 680px; margin: 0 auto` container matching the rest of Kōda's desktop treatment. Composer opens as a centred modal on desktop (not a bottom sheet). IdeaCard chart thumbnails scale to 80×80px on wider viewports.

---

## Out of Scope (v1)

- Comments on ideas
- Trending / popular sort
- Following-only filter
- Pre-trade → linked outcome trade flow
- Editing a published idea
- Idea notifications
