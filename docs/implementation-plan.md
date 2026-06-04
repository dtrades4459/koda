# Kōda OS — Redesign Implementation Plan

> Master plan for porting the Claude Design handoff into the live codebase. **Read this first** at the start of any redesign session.

**Created:** 2026-06-04
**Sprint window:** 2026-06-08 → ~2026-07-10 (5 weeks)
**Working branch:** `redesign/v2`
**Merge cadence:** Friday morning, `redesign/v2` → `main`

---

## 1 · Goal

Ship the full Kōda OS visual + structural redesign to production. The design system, brand identity, all in-scope features, every state, every platform variant — pixel-accurate to the Claude Design bundle, integrated with the existing React 19 + TypeScript + Vite + Supabase stack.

**Exit criteria for the sprint as a whole:**
- All 12 P0 launch-blockers shipped to `main`
- All 61 P1 items shipped to `main`
- States / motion / a11y / microcopy passes complete across every touched surface
- Beta users see the new design with zero regressions on the core loop (auth → log trade → join circle → view stats)

---

## 2 · Sources of truth

| What | Where | Notes |
|---|---|---|
| **Audit baseline** | `koda-audit/audit-data.js` in the handoff bundle | Frozen 196-item snapshot. Don't try to update it — use design-coverage.md as the live tracker. |
| **Gap-fill designs** | `koda-designs/cat0X-*.jsx` in the handoff bundle | 115 new screens across 20 categories. Each file has named React components for individual screens. |
| **Existing visual system** | `existing-handoff/redesign/README.md` (47KB) | Canonical design tokens, type stack, motion catalog, screen→code mapping table. |
| **Token + atom kit** | `koda-designs/koda-kit.jsx` | Shared `Phone`, `Card`, `Btn`, `Field`, `Mark`, `THEME` — port these once into the codebase, reuse everywhere. |
| **Live coverage tracker** | `docs/design-coverage.md` | 196 items × 2 checkboxes (designed / shipped). The build queue. |
| **Phase 1 day-by-day** | `docs/phase-1-runbook.md` | Daily P0 walkthrough — file paths, backend wiring, acceptance criteria. |

**Handoff bundle root path:** `C:\Users\Dylon\Downloads\KodaOS-handoff-extracted\kodaos\project\` (or wherever Dylon last extracted it — confirm before each session).

---

## 3 · Phases

### Phase 1 — P0 launch-blockers (~2 weeks)

**12 items, days 1–10.** See `phase-1-runbook.md` for day-by-day breakdown.

Categories touched: Auth & onboarding · Account & settings · System / connectivity · Marketing site (cookie consent) · Email templates · A11y (focus states).

**Backend work needed:** ~6 items (enable Supabase email confirmation, surface subscription status to JWT, wire 4 email templates, account-deletion email trigger). ~5h total.

**Exit:** all 12 P0s ticked `shipped` in `design-coverage.md`. Beta users unaffected because flag-gated where needed; the visible changes (auth UI, settings copy, focus rings) are non-disruptive.

### Phase 2 — P1 features (~2 weeks)

**61 items, days 11–20.** Sequenced by category (one category per day or two, batched to maximise context):

| Days | Category batch | Why batched |
|---|---|---|
| 11–12 | Social & circles (owner controls, moderation surfaces) | Same file (`TradingCircles.tsx`), shared mental model |
| 13 | Settings billing P1 polish + 2FA + device management | Settings doesn't ship piecemeal |
| 14 | Trade lifecycle P1 (mistake tag, comments, share-to-circle) | Core loop polish |
| 15 | Follow graph P1 (follow-back, mutual viz, QR share) | Smallest category, cleanup day |
| 16 | Notifications + system states | Tight coupling between push payload + inbox UI |
| 17 | Discipline + power features P1 | Self-contained feature islands |
| 18 | Marketing site P1 + brand assets P1 | Static work, low risk |
| 19 | Email template P1s | Resend templates batch nicely |
| 20 | Buffer + QA pass | Catch what slipped |

**Backend work needed:** ~12 items (data export endpoint, mistake tag column, trade comments table + RLS, content reports table, user blocks, kick/ban endpoint, etc.). ~16h total — spread across these days.

### Phase 3 — Polish + launch (~1 week)

**81 P2 items + the 5 NA's reviewed.** Days 21–25.

- States coverage audit (every screen × 4 moods)
- Motion catalog completeness
- Microcopy library finalised
- Mobile/desktop/PWA patterns layered in
- Accessibility passes (keyboard nav, SR scripts, reduced-motion)
- Final launch checklist
- Coordinated push to production + announcement

---

## 4 · Branching + merge cadence

```
main                  ────●────────●────●─────●─►   (production)
                          ▲        ▲    ▲     ▲
                          │ Fri    │ Fri │   Fri
                          │ wk 1   │ wk 2│   wk 3...
                          │        │    │
redesign/v2     ──●──●─●─●──●──●─●─●──●─●─►   (preview)
                  ▲  ▲ ▲ ▲  daily commits as P0s land
                  │  │ │ │
                  │  │ │ Block 2 wiring
                  │  │ Block 1 screen ports
                  │  Sunday plan
                  Mon kick-off
```

**Rules:**
1. **Never push to `main` during the redesign sprint** except on Friday merge.
2. Every Block 1 + Block 2 ends with `git push` to `redesign/v2`. Auto-deploys to preview URL.
3. Friday 11:00–12:00 is the merge window. Only what's been smoke-tested in preview lands on main.
4. If a Friday merge would break beta users, hold and ship a fix on Monday — don't merge under pressure.

---

## 5 · Daily structure (mapped to calendar)

| Block | Calendar event | Time | Redesign role |
|---|---|---|---|
| **Block 1** | ⚙️ Kōda Deep Work — Block 1 | 08:30–10:30 | Primary work. **One P0 screen design → ported → pushed.** |
| Trading | 📈 NY AM Trading Session | 13:00–16:00 | Dogfooding the live monitor + intervention. |
| Journal | 📝 Post-session journal in Kōda | 16:00–16:30 | Real trades into Kōda — UX feedback. |
| **Block 2** | ⚙️ Kōda Deep Work — Block 2 | 17:00–19:00 | Backend wiring for Block 1's screen, design QA in preview, or one smaller follow-up. |
| Platform call | 📞 Kōda Nightly Platform Call | 20:00–21:00 | Review the day. Update `design-coverage.md` tick boxes. |

**End-of-block ritual (both blocks):**
1. `npm run typecheck && npm run build` (must be green)
2. `git push` (auto-deploys to preview)
3. Screenshot the preview URL for QA notes
4. Update `docs/design-coverage.md` — tick the boxes
5. One-line entry in design-coverage.md "Notes & decisions log" if anything notable happened

---

## 6 · Definition of done — per item

A row in `design-coverage.md` is **shipped** only when ALL of these are true:

- [ ] Visual matches the gap-fill JSX reference (pixel-accurate where reasonable)
- [ ] Tokens reused from `theme.ts` — no hardcoded colours
- [ ] Dark + light parity (both themes render correctly)
- [ ] States covered: idle / loading / error / success at minimum (some need empty / disabled / hover too)
- [ ] Backend wiring complete if the design requires it (e.g., email triggers send actual emails)
- [ ] `npm run typecheck` clean
- [ ] `npm run build` clean (no new warnings beyond pre-existing chunk-size)
- [ ] Preview URL smoke-tested — the screen actually loads + functions
- [ ] Merged to `main` via Friday merge

---

## 7 · Risks + mitigations

| Risk | Likelihood | Impact | Mitigation |
|---|---|---|---|
| Phase 1 slips past 2 weeks | Medium | Phase 2 starts late, launch slips | Hard stop on P0 #6 (session-expired) if it hits 5h — defer to Phase 2 buffer |
| Beta users hit production bugs during sprint | Low–Medium | Trust damage | Strict Friday merge window; pre-merge smoke test in preview; rollback plan = `git revert` on main |
| Supabase email confirmation flag breaks existing signups | Low | Auth outage | Test in preview with a throwaway email before enabling on prod project |
| Design fidelity drift (codebase tokens vs design tokens) | High | Inconsistent look | Port `koda-kit.jsx` atoms once into `src/shared.tsx` (or new `src/design-kit.tsx`), reuse across screens |
| Token conflicts with existing `theme.ts` `DARK`/`LIGHT` | Medium | Wrong colours mid-port | Diff `theme.ts` against `koda-kit.jsx` THEME constants on Day 1; resolve before any port |
| `src/Koda.tsx` (4921 lines) becomes the merge battleground | High | Conflict hell + bugs | Extract Home/Stats/Settings tabs into separate files at start of Phase 2 (parked on whiteboard) |
| Tradovate Partner doesn't come through | Low (it's in flight as a side bet) | Broker auto-sync stays gated | CSV path remains the live broker integration. UI panel stays behind `liveBrokerSync` flag. |

---

## 8 · Working principles

1. **One P0 per Block 1.** Better to ship one well than half-ship three.
2. **Designs are references, not gospel.** Where the design conflicts with existing accessibility, performance, or data shape — pick the codebase's reality and note the deviation in `design-coverage.md`.
3. **Tokens before screens.** Resolve `koda-kit.jsx` → `theme.ts` on Day 1. Any later token conflict costs ~5× more to fix.
4. **Backend wiring is part of "shipped".** A design without working backend = a lie to the user.
5. **Dogfood every day.** The 13:00–16:00 trading block is the most reliable QA loop you have. If something breaks during trading, fix it next Block 2 — don't carry it.
6. **Stop coding at 19:00.** Block 2 ends; the editor closes. Beta survives.

---

## 9 · Whiteboard items that intersect with the sprint

(See `MEMORY/project_koda_whiteboard.md` for full list. Items below are pulled in because they're either prerequisites or natural Phase 2 fits.)

- **`circle_members` non-recursive RLS proper fix (Runbook C)** — block 2 task in Phase 2, week 4
- **Trade-screenshots private bucket (Runbook B)** — block 2 task in Phase 2, week 4
- **`useTradovate` + `api/tradovate.ts` teardown** — block 2 task once Block 1 frees up
- **Tradovate Eval Support email** — Dylon-only task, not blocking
- **v2 dual-write rollback or finish** — separate decision day, not in Phase 1
- **Splitting `src/Koda.tsx`** — block 2 task early in Phase 2 to prevent merge conflict hell

---

## 10 · When in doubt

1. Open `docs/design-coverage.md` — what's next on Phase 1?
2. Open the matching `koda-designs/cat0X-*.jsx` — read the named component.
3. Open `existing-handoff/redesign/README.md` §3.4 — find the screen→code mapping.
4. Open the target `src/*.tsx` file — port the design, keep the logic.
5. Push to `redesign/v2`. Screenshot the preview. Tick the box. Move on.

That's the entire job, 196 times.
