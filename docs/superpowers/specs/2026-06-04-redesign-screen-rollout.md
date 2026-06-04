# Kōda OS Redesign — Screen-by-screen rollout

**Created:** 2026-06-04
**Branch:** `redesign/v2`
**Tracker:** `docs/design-coverage.md`
**Design source:** `C:\Users\Dylon\Downloads\KodaOS-handoff-v2\kodaos\project\koda-designs\`

---

## Goal

Port the full Claude Design handoff into the live codebase. Every in-scope item in
`design-coverage.md` (196 items across 20 categories) shipped to `redesign/v2` and
merged to `main` on the Friday cadence.

---

## Phase 0 — Token reconciliation (one-time, ~30–45 min)

**Problem:** `koda-kit.jsx` uses token names (`t.ink`, `t.line2`, `t.surface`) that
differ from the codebase (`C.text`, `C.border2`, `C.panel`). Every screen port would
require a mental translation otherwise.

**Fix:**
1. Add alias keys to `DARK` + `LIGHT` in `src/theme.ts`:
   - `surface` → same value as `panel`
   - `surfaceHi` → same value as `panel2`
   - `ink` → same value as `text`
   - `ink2` → same value as `text2`
   - `line` → same value as `border`
   - `line2` → same value as `border2`
   - `line3` → new: `rgba(255,255,255,0.20)` dark / `rgba(10,10,10,0.22)` light
2. Add missing semantic tokens to both themes:
   - `greenSoft` — `oklch(0.78 0.18 152 / 0.15)` dark / `oklch(0.55 0.18 152 / 0.12)` light
   - `redSoft` — `oklch(0.70 0.21 25 / 0.15)` dark / `oklch(0.55 0.22 25 / 0.12)` light
   - `warnSoft` — `oklch(0.79 0.16 75 / 0.15)` dark / `oklch(0.68 0.16 75 / 0.14)` light
3. Fix stale bundle path in `docs/implementation-plan.md` §2: `KodaOS-handoff-extracted` → `KodaOS-handoff-v2`

**Risk:** Zero — aliases are additive. Existing code using `C.text` / `C.panel` is untouched.

---

## Phase 1 — P0 launch-blockers (12 items)

Implement in this order (P0s across all categories, highest user-impact first):

| # | Item | Target file | Category |
|---|------|-------------|----------|
| 1 | Sign-up form | `src/KodaAuth.tsx` | cat01 |
| 2 | Password reset (request → sent → new-password) | `src/KodaAuth.tsx` | cat01 |
| 3 | Email verification | `src/KodaAuth.tsx` | cat01 |
| 4 | Session-expired modal + re-auth | new `src/components/SessionExpiredModal.tsx` | cat07 |
| 5 | Cookie-consent banner + preferences modal | `src/CookieConsent.tsx` | cat10 |
| 6 | Account deletion confirmation flow | `src/SettingsScreen.tsx` | cat02 |
| 7 | Billing dunning / failed / refund states | `src/SettingsScreen.tsx` | cat02 |
| 8 | Focus-state designs (web + mobile) | `src/index.css` | cat16 |
| 9 | Email: Welcome | `api/lib/email.ts` (Resend template) | cat12 |
| 10 | Email: Password reset | `api/lib/email.ts` | cat12 |
| 11 | Email: Email verification | `api/lib/email.ts` | cat12 |
| 12 | Email: Payment failed + retry | `api/lib/email.ts` | cat12 |

---

## Phase 2 — P1 features (61 items, category by category)

cat01 → cat02 → cat03 → cat04 → cat05 → cat06 → cat07 → cat08 → cat09 → cat10 → cat11 → cat12 → cat16 → cat17 → cat18 → cat19 → cat20

Full list in `design-coverage.md`.

---

## Phase 3 — P2 polish + docs (81 items)

States coverage · Motion catalog · Microcopy · A11y passes. Final launch checklist.

---

## Done criteria (every screen)

- Visual matches `cat0X-*.jsx` reference
- All colours from `theme.ts` tokens — zero hardcoded hex/oklch inline
- Dark **and** light parity
- Idle + loading + error states all handled
- `npm run typecheck && npm run build` clean
- `docs/design-coverage.md` `shipped` checkbox ticked

---

## Assumptions

- Keep `bg: "#13110E"` (warm dark) — kit uses `#0A0A0B` but DESIGN.md and beta user feedback confirm the warm tone
- Token aliases are additive — no renames to existing consumers
- Email templates (cat12) require Resend SDK; scaffold HTML strings now, wire SDK when Resend is set up
- DB migrations required by some P1 items (mistake tag column, comments table, content reports) are flagged inline and skipped until Dylon approves
- `redesign/v2` → `main` Friday merge cadence unchanged
