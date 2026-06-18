# Pre-Trade + Post-Trade Screenshots Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the single trade screenshot with two labelled slots — Pre-trade and Post-trade — everywhere a trade screenshot is captured or shown, with zero data loss and no DB migration.

**Architecture:** All decision logic (which slot, legacy fallback, eligibility, v2 array mapping) lives in one pure, fully-tested module `src/lib/tradeScreenshots.ts`. The monolith wiring (`Koda.tsx` uploader, `LogTradeScreen` UI, render sites) is thin and verified by `tsc` + `build` — matching how this repo treats the 5k-line `Koda.tsx` (not unit-tested in isolation).

**Tech Stack:** React 19 + TypeScript + Vite, Vitest, Supabase Storage (`trade-screenshots` bucket).

## Global Constraints

- **No DB migration.** Active trades are a schemaless JSON blob `koda_trades` in `user_kv`; new fields are additive. (Spec §Context.)
- **No new Pro gate** — screenshots are free for all today; keep it so. (Spec §Non-goals.)
- **No change to the storage bucket, UID-first path scheme, compression, or `resolveScreenshotUrl`.** (Spec §Non-goals.)
- **Legacy `screenshot: string` stays required** (defaults `""`), is **never written again**, and is read as the Post-trade fallback. (Spec §Data model.)
- TypeScript: no `: any` introduced; any `eslint-disable` must be signed (pre-commit enforces both). Note `Koda.tsx:3303` already casts the uploader prop `as any` — do not add more.
- Pre-commit runs `tsc -p tsconfig.app.json && tsc -p tsconfig.api.json`, so every commit must be type-clean.

---

## File Structure

**Create:**
- `src/lib/tradeScreenshots.ts` — pure helpers: `preShot`, `postShot`, `hasAnyShot`, `shotArray`, `screenshotField`. Single source of truth for slot semantics + legacy fallback.
- `src/lib/tradeScreenshots.test.ts` — unit tests for the helper.

**Modify:**
- `src/types.ts` — add `preTradeScreenshot?: string`, `postTradeScreenshot?: string` to `Trade`.
- `src/Koda.tsx` — generalise `handleScreenshotUpload` / `removeScreenshot` with a `slot` arg; v2 dual-write uses `shotArray`; the trade-list inline "REPLACE" controls gain a slot.
- `src/LogTradeScreen.tsx` — two screenshot sections (Pre / Post); prop signatures gain `slot`; `CompShotWarning` fed `hasAnyShot(form)`.
- `src/trade/TradeScreens.tsx` — trade detail renders both slots, labelled.
- `src/components/SharedTradeCard.tsx` + `src/data/circlesSharedTrades.ts` — card image uses `postShot(trade)`.

---

### Task 1: Pure screenshot helper + Trade type fields

**Files:**
- Modify: `src/types.ts` (add two optional fields to `Trade`)
- Create: `src/lib/tradeScreenshots.ts`
- Test: `src/lib/tradeScreenshots.test.ts`

**Interfaces:**
- Consumes: `Trade` from `src/types.ts`.
- Produces:
  ```ts
  export type ShotSlot = "pre" | "post";
  export function screenshotField(slot: ShotSlot): "preTradeScreenshot" | "postTradeScreenshot";
  export function preShot(t: Pick<Trade, "preTradeScreenshot">): string;                       // "" when none
  export function postShot(t: Pick<Trade, "postTradeScreenshot" | "screenshot">): string;      // falls back to legacy screenshot
  export function hasAnyShot(t: Pick<Trade, "preTradeScreenshot" | "postTradeScreenshot" | "screenshot">): boolean;
  export function shotArray(t: Pick<Trade, "preTradeScreenshot" | "postTradeScreenshot" | "screenshot">): string[]; // [pre, post] dropping empties, post via fallback
  ```

- [ ] **Step 1: Add the Trade fields**

In `src/types.ts`, inside `export interface Trade`, immediately after the `screenshot: string;` line (currently line 30):

```ts
  screenshot: string;
  preTradeScreenshot?: string;
  postTradeScreenshot?: string;
```

- [ ] **Step 2: Write the failing test**

```ts
// src/lib/tradeScreenshots.test.ts
import { describe, it, expect } from "vitest";
import { screenshotField, preShot, postShot, hasAnyShot, shotArray } from "./tradeScreenshots";

describe("screenshotField", () => {
  it("maps slots to the matching Trade field", () => {
    expect(screenshotField("pre")).toBe("preTradeScreenshot");
    expect(screenshotField("post")).toBe("postTradeScreenshot");
  });
});

describe("postShot (legacy fallback)", () => {
  it("prefers postTradeScreenshot when present", () => {
    expect(postShot({ postTradeScreenshot: "new.jpg", screenshot: "old.jpg" })).toBe("new.jpg");
  });
  it("falls back to the legacy screenshot when post is absent", () => {
    expect(postShot({ screenshot: "old.jpg" })).toBe("old.jpg");
  });
  it("returns '' when neither is present", () => {
    expect(postShot({ screenshot: "" })).toBe("");
  });
});

describe("preShot", () => {
  it("returns the pre field or ''", () => {
    expect(preShot({ preTradeScreenshot: "pre.jpg" })).toBe("pre.jpg");
    expect(preShot({})).toBe("");
  });
});

describe("hasAnyShot", () => {
  it("is true for pre-only, post-only, and legacy-only; false for none", () => {
    expect(hasAnyShot({ preTradeScreenshot: "p.jpg", screenshot: "" })).toBe(true);
    expect(hasAnyShot({ postTradeScreenshot: "q.jpg", screenshot: "" })).toBe(true);
    expect(hasAnyShot({ screenshot: "legacy.jpg" })).toBe(true);
    expect(hasAnyShot({ screenshot: "" })).toBe(false);
  });
});

describe("shotArray", () => {
  it("returns [pre, post] dropping empties, post via fallback, order preserved", () => {
    expect(shotArray({ preTradeScreenshot: "p.jpg", postTradeScreenshot: "q.jpg", screenshot: "" })).toEqual(["p.jpg", "q.jpg"]);
    expect(shotArray({ screenshot: "legacy.jpg" })).toEqual(["legacy.jpg"]);          // legacy → post slot
    expect(shotArray({ preTradeScreenshot: "p.jpg", screenshot: "" })).toEqual(["p.jpg"]);
    expect(shotArray({ screenshot: "" })).toEqual([]);
  });
});
```

- [ ] **Step 3: Run test to verify it fails**

Run: `npx vitest run src/lib/tradeScreenshots.test.ts`
Expected: FAIL — cannot find module `./tradeScreenshots`.

- [ ] **Step 4: Write the implementation**

```ts
// src/lib/tradeScreenshots.ts
// ═══════════════════════════════════════════════════════════════════════════════
// Kōda · trade screenshot slots (pure)
//
// Single source of truth for the two screenshot slots and the legacy fallback.
// A trade once had a single `screenshot`; that value is now read as the
// Post-trade shot (most legacy shots are results). Nothing writes `screenshot`
// again. See docs/superpowers/specs/2026-06-18-pre-post-trade-screenshots-design.md
// ═══════════════════════════════════════════════════════════════════════════════

import type { Trade } from "../types";

export type ShotSlot = "pre" | "post";

export function screenshotField(slot: ShotSlot): "preTradeScreenshot" | "postTradeScreenshot" {
  return slot === "pre" ? "preTradeScreenshot" : "postTradeScreenshot";
}

export function preShot(t: Pick<Trade, "preTradeScreenshot">): string {
  return t.preTradeScreenshot ?? "";
}

export function postShot(t: Pick<Trade, "postTradeScreenshot" | "screenshot">): string {
  return t.postTradeScreenshot ?? t.screenshot ?? "";
}

export function hasAnyShot(
  t: Pick<Trade, "preTradeScreenshot" | "postTradeScreenshot" | "screenshot">,
): boolean {
  return Boolean(preShot(t) || postShot(t));
}

export function shotArray(
  t: Pick<Trade, "preTradeScreenshot" | "postTradeScreenshot" | "screenshot">,
): string[] {
  return [preShot(t), postShot(t)].filter((s): s is string => s.length > 0);
}
```

- [ ] **Step 5: Run test to verify it passes**

Run: `npx vitest run src/lib/tradeScreenshots.test.ts`
Expected: PASS (all describe blocks).

- [ ] **Step 6: Typecheck + commit**

Run: `npx tsc -p tsconfig.app.json --noEmit` → no errors.
```bash
git add src/types.ts src/lib/tradeScreenshots.ts src/lib/tradeScreenshots.test.ts
git commit -m "feat(screenshots): pure pre/post slot helper + Trade fields"
```

---

### Task 2: Generalise the uploader in Koda.tsx (slot routing + v2 mapping)

**Files:**
- Modify: `src/Koda.tsx` — `handleScreenshotUpload` (~line 1335), `removeScreenshot`, and the v2 dual-write of trades.

**Interfaces:**
- Consumes: `screenshotField`, `shotArray` from Task 1.
- Produces: `handleScreenshotUpload(e, tradeId: number | null, slot: ShotSlot)` and `removeScreenshot(tradeId: number | null, slot: ShotSlot)` — consumed by Task 3/4.

- [ ] **Step 1: Import the helper**

At the top of `src/Koda.tsx`, with the other `./lib` imports:

```ts
import { screenshotField, shotArray, type ShotSlot } from "./lib/tradeScreenshots";
```

- [ ] **Step 2: Route the upload to the chosen slot**

Replace the body of `handleScreenshotUpload` (currently sets `screenshot`) so the field is chosen by `slot`. The current function (Koda.tsx ~1335-1358) ends by setting `screenshot`; change its signature and the two set sites:

```ts
async function handleScreenshotUpload(e: React.ChangeEvent<HTMLInputElement>, tradeId: number | null, slot: ShotSlot) {
  const file = e.target.files?.[0]; if (!file) return;
  if (file.size > 15 * 1024 * 1024) { showToast("Image too large — max 15MB"); return; }
  if (!file.type.startsWith("image/")) { showToast("File must be an image"); return; }
  const field = screenshotField(slot);
  showToast("Uploading screenshot…");
  try {
    const dataUri = await compressImage(file, 800);
    const res = await fetch(dataUri);
    const blob = await res.blob();
    const uid = profile?.uid || "anon";
    const path = `${uid}/${Date.now()}_${Math.random().toString(36).slice(2)}.jpg`;
    const { error } = await supabase.storage.from("trade-screenshots").upload(path, blob, { contentType: "image/jpeg", upsert: false });
    if (error) throw error;
    const { data: urlData } = supabase.storage.from("trade-screenshots").getPublicUrl(path);
    const screenshotUrl = urlData.publicUrl;
    if (tradeId) { const u = trades.map(t => t.id === tradeId ? { ...t, [field]: screenshotUrl } : t); await saveTrades(u); }
    else setForm((f) => ({ ...f, [field]: screenshotUrl }));
    showToast("Screenshot saved");
  } catch (err) {
    log.error("screenshot.upload", err);
    const compressed = await compressImage(file, 800);
    if (tradeId) { const u = trades.map(t => t.id === tradeId ? { ...t, [field]: compressed } : t); await saveTrades(u); }
    else setForm((f) => ({ ...f, [field]: compressed }));
    showToast("Saved locally (Storage unavailable)");
  }
}
```

- [ ] **Step 3: Route removal to the chosen slot**

Find `removeScreenshot` (grep `function removeScreenshot` in `src/Koda.tsx`). Change its signature to `(tradeId: number | null, slot: ShotSlot)` and clear `screenshotField(slot)` instead of `screenshot`. If it currently also deletes the storage object for the old value, read the old value from `t[screenshotField(slot)]` (or `form[field]`) rather than `t.screenshot`.

```ts
function removeScreenshot(tradeId: number | null, slot: ShotSlot) {
  const field = screenshotField(slot);
  if (tradeId) { const u = trades.map(t => t.id === tradeId ? { ...t, [field]: "" } : t); void saveTrades(u); }
  else setForm((f) => ({ ...f, [field]: "" }));
}
```

(Keep any existing storage-object cleanup the current `removeScreenshot` performs, retargeted to `field`.)

- [ ] **Step 4: Feed both slots into the v2 dual-write**

Find where `upsertTradeV2` is called (grep `upsertTradeV2(` in `src/Koda.tsx`). In the payload it builds, set the v2 `screenshots` array from the helper instead of the single value:

```ts
screenshots: shotArray(t),   // [pre, post] in order, empties dropped
```

(If the call currently passes `screenshots: t.screenshot ? [t.screenshot] : []` or similar, replace that expression with `shotArray(t)`.)

- [ ] **Step 5: Typecheck (call sites in Koda will error until Task 3 — scope the check)**

Run: `npx tsc -p tsconfig.app.json --noEmit 2>&1 | grep -E "Koda.tsx|tradeScreenshots" | grep -v "3303"`
Expected: the only remaining errors reference `handleScreenshotUpload` / `removeScreenshot` **call sites** (they pass 2 args, need 3) — those are fixed in Tasks 3–4. No errors inside the function bodies themselves.

- [ ] **Step 6: Commit**

```bash
git add src/Koda.tsx
git commit -m "feat(screenshots): slot-aware uploader + v2 shotArray mapping"
```

---

### Task 3: LogTradeScreen — two slots + eligibility

**Files:**
- Modify: `src/LogTradeScreen.tsx` (prop types ~24-26; screenshot section ~426-454)

**Interfaces:**
- Consumes: `handleScreenshotUpload(e, id, slot)`, `removeScreenshot(id, slot)` (Task 2); `preShot`, `postShot`, `hasAnyShot` (Task 1).

- [ ] **Step 1: Import the helper + update prop types**

Add import near the top of `src/LogTradeScreen.tsx`:

```ts
import { preShot, postShot, hasAnyShot, type ShotSlot } from "./lib/tradeScreenshots";
```

Update the two prop signatures (currently lines ~25-26):

```ts
  handleScreenshotUpload: (e: React.ChangeEvent<HTMLInputElement>, id: string | null, slot: ShotSlot) => void;
  removeScreenshot: (id: string | null, slot: ShotSlot) => void;
```

- [ ] **Step 2: Replace the single Screenshot card with two slots**

Replace the entire `{/* ── Screenshot ── */}` Card block (currently ~426-454) with two cards built from a small inline renderer. Use the existing styles verbatim; only the value, labels, slot arg, and input ids change:

```tsx
{/* ── Screenshots: pre-trade + post-trade ── */}
{(["pre", "post"] as ShotSlot[]).map((slot) => {
  const value = slot === "pre" ? preShot(form) : postShot(form);
  const label = slot === "pre" ? "Pre-trade screenshot" : "Post-trade screenshot";
  const inputId = slot === "pre" ? "ssUploadPre" : "ssUploadPost";
  return (
    <Card C={T} pad={16} key={slot}>
      <Kicker C={T}>{label}</Kicker>
      {value ? (
        <div style={{ position: "relative", marginTop: 8 }}>
          <SignedImg src={value} alt={label}
            style={{ width: "100%", border: `1px solid ${C.border}`, borderRadius: 12, display: "block", maxHeight: 200, objectFit: "cover" }} loading="lazy" />
          <button onClick={() => removeScreenshot(null, slot)}
            style={{ position: "absolute", top: 8, right: 8, background: C.bg, border: `1px solid ${C.border2}`, borderRadius: 999, color: C.text, padding: "4px 10px", cursor: "pointer", fontSize: "0.625rem", fontFamily: MONO, letterSpacing: "0.08em" }}>
            REMOVE
          </button>
        </div>
      ) : (
        <label htmlFor={inputId} style={{ display: "flex", alignItems: "center", justifyContent: "center", border: `1px dashed ${C.border2}`, borderRadius: 14, padding: 20, cursor: "pointer", color: C.muted, fontSize: "0.75rem", fontFamily: MONO, letterSpacing: "0.08em", textTransform: "uppercase", marginTop: 8 }}>
          Upload {slot === "pre" ? "pre-trade" : "post-trade"} screenshot
          <input id={inputId} type="file" accept="image/jpeg,image/png"
            onChange={e => handleScreenshotUpload(e, null, slot)} style={{ display: "none" }} />
        </label>
      )}
      {slot === "post" && <CompShotWarning C={T} date={form.date || ""} hasScreenshot={hasAnyShot(form)} />}
    </Card>
  );
})}
```

(The `CompShotWarning` renders once, under the Post card, fed `hasAnyShot(form)` so either slot satisfies it.)

- [ ] **Step 3: Typecheck + build**

Run: `npx tsc -p tsconfig.app.json --noEmit 2>&1 | grep "LogTradeScreen" || echo "LogTradeScreen clean"`
Expected: `LogTradeScreen clean`.

- [ ] **Step 4: Commit**

```bash
git add src/LogTradeScreen.tsx
git commit -m "feat(screenshots): pre/post upload slots in LogTradeScreen"
```

---

### Task 4: Remaining render + share sites

**Files:**
- Modify: `src/Koda.tsx` (trade-list inline REPLACE controls ~3550 — the `handleScreenshotUpload(e, t.id)` call sites)
- Modify: `src/trade/TradeScreens.tsx` (trade detail screenshot render)
- Modify: `src/components/SharedTradeCard.tsx` (card image)
- Modify: `src/data/circlesSharedTrades.ts` (shared row mapping)

**Interfaces:**
- Consumes: `preShot`, `postShot` (Task 1); `handleScreenshotUpload(e, id, slot)` (Task 2).

- [ ] **Step 1: Trade-list inline controls (Koda.tsx ~3548-3558)**

The two `handleScreenshotUpload(e, t.id)` call sites (REPLACE + empty-state upload) each need a slot. Render a pre and a post control. Minimal change: duplicate the existing control for each slot, labelling them, and pass the slot:

```tsx
onChange={e => handleScreenshotUpload(e, t.id, "pre")}   // pre control
onChange={e => handleScreenshotUpload(e, t.id, "post")}  // post control
```

Give the two `<input>`s distinct ids (`ss-pre-${t.id}` / `ss-post-${t.id}`) and labels ("PRE" / "POST"). Any image preview in this row that currently reads `t.screenshot` becomes two previews: `preShot(t)` and `postShot(t)` (skip an empty one).

- [ ] **Step 2: Trade detail (TradeScreens.tsx)**

Find the screenshot render (grep `screenshot` in `src/trade/TradeScreens.tsx`). Replace the single `<SignedImg src={trade.screenshot}>` with two labelled previews using `preShot(trade)` and `postShot(trade)`, each rendered only when non-empty:

```tsx
{preShot(trade) && <><div className="kicker">Pre-trade</div><SignedImg src={preShot(trade)} alt="pre-trade screenshot" /></>}
{postShot(trade) && <><div className="kicker">Post-trade</div><SignedImg src={postShot(trade)} alt="post-trade screenshot" /></>}
```

(Match the file's existing label/markup style; the key change is the two `preShot`/`postShot` values.)

- [ ] **Step 3: Shared card image (SharedTradeCard.tsx ~85)**

```tsx
{postShot(trade) && (
  <SignedImg src={postShot(trade)} alt="trade screenshot" style={{ width: "100%", borderRadius: 7, maxHeight: 200, objectFit: "cover" }} />
)}
```

Import `postShot` at the top. (The card shows the result; if a trade has only a pre-trade shot, swap to `postShot(trade) || preShot(trade)`.)

- [ ] **Step 4: Shared-row mapping (circlesSharedTrades.ts ~40)**

```ts
screenshot: postShot(trade) || preShot(trade) || null,
```

Import `postShot`, `preShot`. (Shared trades keep a single image; show the result, else the setup.)

- [ ] **Step 5: Typecheck + build**

Run: `npx tsc -p tsconfig.app.json --noEmit && npm run build`
Expected: typecheck clean (all uploader call sites now pass a slot), build succeeds.

- [ ] **Step 6: Commit**

```bash
git add src/Koda.tsx src/trade/TradeScreens.tsx src/components/SharedTradeCard.tsx src/data/circlesSharedTrades.ts
git commit -m "feat(screenshots): render pre/post at trade list, detail, and shared cards"
```

---

### Task 5: Full verification

**Files:** none.

- [ ] **Step 1: Full test suite** — `npx vitest run` → all pass (incl. `tradeScreenshots.test.ts` and the existing `CompShotWarning.test.tsx`).
- [ ] **Step 2: Typecheck** — `npx tsc -p tsconfig.app.json --noEmit && npx tsc -p tsconfig.api.json --noEmit` → clean.
- [ ] **Step 3: Lint** — `npm run lint` → 0 errors (no new `: any`, no unsigned `eslint-disable`).
- [ ] **Step 4: Build** — `npm run build` → succeeds.
- [ ] **Step 5: Legacy-read sanity (grep)** — `git grep -n "\.screenshot\b" src/ | grep -v "preTradeScreenshot\|postTradeScreenshot\|tradeScreenshots\|\.test\."` — every remaining direct `.screenshot` read should be inside the helper or an intentional legacy path; confirm none are user-facing render sites that bypass `postShot`.
- [ ] **Step 6: Commit any fixups** — `git add -A && git commit -m "chore(screenshots): verification pass"`.

---

## Self-Review Notes

- **Spec coverage:** two slots (T3), no migration / additive fields (T1), legacy→post fallback via `postShot` (T1, used T3/T4), slot-aware upload + base64 fallback preserved (T2), v2 array mapping via `shotArray` (T2), competition eligibility = pre OR post via `hasAnyShot` (T3), shared cards show post→pre (T4), no new Pro gate / no bucket change (untouched). All spec sections map to a task.
- **Type consistency:** `screenshotField`/`preShot`/`postShot`/`hasAnyShot`/`shotArray`/`ShotSlot` defined in T1 and consumed unchanged in T2–T4; uploader signature `(e, id|tradeId, slot)` defined T2 and matched in the LogTradeScreen prop type + call sites T3/T4.
- **Testing realism:** all branching logic lives in the pure helper (fully TDD'd, T1). `Koda.tsx` / `LogTradeScreen` wiring is verified by `tsc` + `build` — consistent with the repo, which does not unit-test the monolith. A live smoke is available via the pre-trade pilot accounts after deploy.
