# Pre-Trade + Post-Trade Screenshots — Design Spec

**Date:** 2026-06-18
**Status:** Approved — ready for implementation plan
**Source:** user feedback — traders want to attach both a pre-trade (setup/entry) and a post-trade (result) screenshot to a journal entry.

---

## Problem

A trade can hold exactly one screenshot today (`Trade.screenshot: string`). Traders want to capture **two** distinct moments: the chart *before* entering (the thesis/setup) and *after* closing (the result). One slot forces them to choose.

## Goal

Replace the single screenshot with two labelled slots — **Pre-trade** and **Post-trade** — everywhere a trade screenshot is captured or displayed, without losing any existing screenshot data and without a database migration.

## Non-goals (YAGNI)

- No broker-image auto-capture, no OCR, no chart embedding.
- No more than two slots.
- No new Pro gate (screenshots are free for all today — keep it that way).
- No change to the storage bucket, path scheme, compression, or signed-URL resolver.

---

## Context / current architecture

- **Active persistence:** trades are a schemaless JSON blob `koda_trades` in `user_kv` (loaded in `Koda.tsx` `loadAll`). `Trade.screenshot: string` lives in `src/types.ts`. **Because the blob is schemaless, adding fields needs no migration.**
- **Dormant v2 layer:** `src/data/trades.ts` (one row per trade in `public.trades`) already models screenshots as `screenshots: string[]` and is dual-written from `Koda.tsx` (`upsertTradeV2`), but is **not** the read source yet. We map into its array for forward-compat; we do not flip reads.
- **Upload:** `handleScreenshotUpload(e, tradeId)` in `Koda.tsx` compresses the image, uploads to the `trade-screenshots` bucket at `{uid}/{ts}_{rand}.jpg` (UID-first path — RLS convention), stores the public URL, and falls back to a compressed base64 data-URI if Storage is unavailable. New-trade uploads set `form.screenshot`; existing-trade uploads patch the trade and `saveTrades`.
- **Render:** `SignedImg` → `resolveScreenshotUrl` turns a stored bucket URL into a short-lived signed URL at render time. Unchanged by this work.
- **Competition:** `CompShotWarning` takes `hasScreenshot: boolean`; during a competition window a trade with no screenshot is flagged as disqualified.
- **Sharing:** `SharedTradeCard` renders `trade.screenshot`; `circlesSharedTrades.ts` maps `trade.screenshot` into the shared row.

---

## Solution

### Data model (`src/types.ts` `Trade`)

```ts
preTradeScreenshot?: string;   // setup / entry thesis (new, optional)
postTradeScreenshot?: string;  // result / outcome (new, optional)
screenshot: string;            // LEGACY — kept as-is (required, defaults "") for back-compat reads;
                               // never written again. Keeping it required avoids retyping every reader.
```

**Back-compat read shim:** a trade with no `postTradeScreenshot` but a legacy `screenshot` is treated as having that value in the Post-trade slot. A small helper makes this the single source of truth for "what's in each slot":

```ts
// src/lib/tradeScreenshots.ts (new, pure)
export function preShot(t: Pick<Trade, "preTradeScreenshot">): string;          // "" when none
export function postShot(t: Pick<Trade, "postTradeScreenshot" | "screenshot">): string; // falls back to legacy
export function hasAnyShot(t): boolean;                                          // pre OR post (incl. legacy)
export function shotArray(t): string[];                                          // [pre, post] non-empty, in order — for v2 dual-write
```

No write ever populates legacy `screenshot` again; it is read-only history. Existing trades therefore render their old image under Post-trade with zero data loss and no migration.

### Upload (`Koda.tsx`)

Generalise the uploader with a slot argument:

```ts
handleScreenshotUpload(e, tradeId: number | null, slot: "pre" | "post")
removeScreenshot(tradeId: number | null, slot: "pre" | "post")
```

Same bucket, UID-first path, compression, and Storage-unavailable base64 fallback. Sets `preTradeScreenshot` or `postTradeScreenshot` on `form` (new) or the patched trade (existing). The v2 dual-write payload uses `shotArray(trade)`.

### UI

- **`LogTradeScreen`** — the single "Screenshot" section becomes two stacked sections, **Pre-trade screenshot** and **Post-trade screenshot**, each with the existing upload / replace / remove affordance and `SignedImg` preview. `CompShotWarning` is fed `hasAnyShot(form)`.
- **Trade-list inline replace** (`Koda.tsx`) and **trade detail view** (`TradeScreens.tsx`) — render both slots, each labelled; replace/remove per slot.
- **`SharedTradeCard` / `circlesSharedTrades`** — the card image is `postShot(trade)` (the result), so existing shared cards are unchanged; if a trade has only a pre-trade shot, that is used.

### Competition eligibility

`CompShotWarning` keeps its boolean prop; callers pass `hasAnyShot(trade)`. A trade is eligible if it has a pre **or** post screenshot (legacy `screenshot` counts via `postShot`), preserving today's behaviour.

---

## Error handling

Unchanged from the current uploader: >15 MB or non-image rejected with a toast; Storage failure falls back to a compressed base64 data-URI stored in the same field; signed-URL resolution failure shows a broken image rather than crashing (existing `resolveScreenshotUrl` behaviour). A per-slot upload failure never affects the other slot.

## Testing

- **Pure (`src/lib/tradeScreenshots.test.ts`):** `postShot` falls back to legacy `screenshot` when `postTradeScreenshot` is absent and prefers `postTradeScreenshot` when both exist; `preShot` returns `""` when absent; `hasAnyShot` is true for pre-only, post-only, and legacy-only, false for none; `shotArray` returns `[pre, post]` dropping empties and preserving order.
- **Component (`LogTradeScreen`):** uploading into the Pre slot sets `preTradeScreenshot` and not `postTradeScreenshot`, and vice-versa; removing one slot leaves the other intact; `CompShotWarning` hides once either slot is filled.

## Rollout

Pure additive change behind no flag — ships to all users on deploy. Existing trades immediately show their legacy screenshot under Post-trade. No migration, no backfill, no bucket change.
