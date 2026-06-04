# Kōda OS — Sprint Schedule (one category per day)

> Calendar-style schedule for the redesign. **Cadence: one design category per day minimum.** Big categories spill across multiple days. Small categories finish early; use the remainder for backend wiring or the next category.

**Created:** 2026-06-04
**Sprint start:** Fri 2026-06-05 (tomorrow)
**Sprint end:** ~Fri 2026-07-03 (4 weeks)
**Branch:** `redesign/v2`
**Tracker:** `docs/design-coverage.md`

---

## TL;DR — the plan

20 design categories from the Claude Design gap-fill bundle. One per day minimum. Daily structure follows your calendar:

- **Block 1 (08:30–10:30)** — read the design, port the first screen(s) of the day's category
- **Block 2 (17:00–19:00)** — finish remaining screens, wire backend if needed, push to preview
- **Friday Block 1** — finish the week's last category + QA in preview
- **Friday 11:00–12:00** — merge `redesign/v2` → `main`

Saturdays off. Sundays: Weekly Review (08:30) + Week Ahead Planning (14:30) — use the planning slot to pick the next week's category order.

---

## Week-by-week schedule

### Week 1 — Auth + Settings + Trade core (2026-06-05 → 2026-06-12)

| Day | Date | Category | Screens | Notes |
|---|---|---|---|---|
| **Fri** | 2026-06-05 | **cat01 Auth & onboarding** | 14 (big — likely spills) | Day 1. Token resolution first (kit.jsx → theme.ts). Then `SignUp` + `SignUpError`. |
| Sat | 2026-06-06 | OFF | — | Sacred off. 30-second beta health glance only. |
| Sun | 2026-06-07 | Weekly Review + Plan | — | 08:30 review · 14:30 pick next week's category order, confirm Auth status |
| Mon | 2026-06-08 | **cat01 finish + cat02 Settings start** | ~10 | Auth finish: ResetRequest, ResetSent, NewPassword, Expired, EmailVerifyPending, OAuth return, Handle collision, Recovery email, Install PWA × 2, First-session survey, Waitlist joined |
| Tue | 2026-06-09 | **cat02 Settings (full)** | 10 | Billing dunning, account deletion 3-step, data export, 2FA, devices, broker disconnect, etc. |
| Wed | 2026-06-10 | **cat03 Trade lifecycle** | 8 | Edit dirty, delete confirm, screenshot multi, share-to-circle, mistake tag, comments, review inbox, CSV dedup |
| Thu | 2026-06-11 | **cat04 Social & circles** | 12 (big — may spill) | Create circle, invalid join, owner controls, ban, leaderboard expanded, challenges, chat reactions, @mention, report, blocked users, invite link |
| **Fri** | 2026-06-12 | **cat04 finish + QA + merge** | — | Block 1: finish Social. 11:00 merge `redesign/v2` → `main`. Week 1 ships. |

### Week 2 — Follow + Notifications + System + Discipline (2026-06-15 → 2026-06-19)

| Day | Date | Category | Screens | Notes |
|---|---|---|---|---|
| Mon | 2026-06-15 | **cat05 Follow graph** + start **cat06 Notifications** | 5 + part | Follow is small — finish + start notifications |
| Tue | 2026-06-16 | **cat06 Notifications finish + cat07 System** | 6 + 6 | Push rich media, inbox states, permission flows + offline/reconnect/session-expired/SW update/rate-limited/version mismatch |
| Wed | 2026-06-17 | **cat08 Discipline / intervention** | 7 | Live monitor 5 signals, cooldowns, intervention history, weekly/monthly reviews, score breakdown |
| Thu | 2026-06-18 | **cat09 Power features** | 7 | Custom contract editor, eval creation + reset, checklist editor, share cards (IG + X), year in review |
| **Fri** | 2026-06-19 | **QA + merge** | — | Week 2 ships. |

### Week 3 — Marketing + Brand + Email (2026-06-22 → 2026-06-26)

| Day | Date | Category | Screens | Notes |
|---|---|---|---|---|
| Mon | 2026-06-22 | **cat10 Marketing site** | 5 | Cookie consent + prefs, about, contact, blog, press kit |
| Tue | 2026-06-23 | **cat11 Brand assets** | 6 | App icons, iOS splash, OG default + profile, IG story, X/LinkedIn |
| Wed | 2026-06-24 | **cat12 Email templates (part 1)** | 6 of 12 | Welcome, password reset, email verify, payment failed, sub cancelled, account deletion |
| Thu | 2026-06-25 | **cat12 Email templates (part 2)** | 6 of 12 | Milestone, broker sync errors, broadcast, beta unlock, waitlist, monthly summary |
| **Fri** | 2026-06-26 | **QA + merge** | — | Week 3 ships. |

### Week 4 — Docs + Patterns + Admin (2026-06-29 → 2026-07-03)

| Day | Date | Category | Screens | Notes |
|---|---|---|---|---|
| Mon | 2026-06-29 | **cat13 / 14 / 15 — States / Motion / Copy** | 0 artboards (docs) | These are reference docs in the bundle, not artboards. Write `docs/states-library.md`, `docs/motion-catalog.md`, `docs/microcopy.md`. |
| Tue | 2026-06-30 | **cat16 Accessibility** | 3 | Focus spec, keyboard nav, reduced-motion + SR + scaling. Apply globally. |
| Wed | 2026-07-01 | **cat17 Mobile patterns** | 4 | Pull-to-refresh, swipe actions, long-press, share + haptics |
| Thu | 2026-07-02 | **cat18 Desktop patterns** | 4 | Command palette, shortcuts, drag-drop CSV, sidebar collapse |
| **Fri** | 2026-07-03 | **cat19 PWA + cat20 Admin + QA + final merge** | 4 + 2 | App shortcuts, badging, share target, file handler. Admin = report queue, audit log. **Phase complete. Launch ready.** |

---

## How to use this doc each morning (Block 1 prep)

1. Look up today's category in the table above
2. Open `koda-designs/cat0X-<key>.jsx` in the handoff bundle
3. Read all the screen components in that file (~5–14 of them)
4. Open `docs/design-coverage.md` and find the category section — see which P0s/P1s/P2s are in scope
5. Open the target source file in `src/` (existing-handoff/redesign/README.md §3.4 has the mapping)
6. Port the first screen. Push to preview. Tick the box. Repeat.

End of Block 2: every day, before logging off:
- `npm run typecheck && npm run build`
- `git push`
- Update `docs/design-coverage.md` ticks
- One-line note in design-coverage.md "Notes & decisions log" if anything notable

---

## When a category spills

Some categories are too big for one day:
- **cat01 Auth** (14 screens) — likely 1.5–2 days
- **cat04 Social** (12 screens) — likely 1.5 days
- **cat12 Email** (12 templates) — 2 days

That's already baked into the schedule. If something else spills unexpectedly:
1. Don't panic — pull the leftover into the next day's Block 2
2. If still incomplete by Friday, document the gap in `docs/design-coverage.md`, ship what's done, slot the rest into the next week's Block 2
3. **Never push half-ported screens to main.** They stay on `redesign/v2`.

---

## When a category finishes early

Small categories like cat05 (5 screens) or cat20 (2 screens) might leave you with 1–2 hours of Block 2 unused. Options in priority order:

1. **Start tomorrow's category** — get a head start. Your future self thanks you.
2. **Backend wiring** — pull a wiring task forward (see `implementation-plan.md` §3 Phase 2 backend list).
3. **`src/Koda.tsx` split** — the 4921-line god file. Whiteboard item. Extract one screen into its own file.
4. **Design QA in preview** — walk through everything shipped so far, catch regressions.

Don't context-switch to ads or other ventures inside Block 2. That's what the 13:30–15:00 calendar block is for.

---

## Alternative: P0-first path

If you'd rather ship the launch-blockers fastest (regardless of category), `docs/phase-1-runbook.md` has the P0-priority sequence. **Don't mix the two approaches.** Pick one and stay with it; the cognitive switching cost is real.

This doc (category-per-day) is the chosen path per Dylon's 2026-06-04 decision.

---

## Done-criteria reminder (every screen)

A screen ships only when:
- Visual matches the gap-fill JSX reference
- Tokens from `theme.ts`, no hardcoded colors
- Dark + light parity
- States covered (idle + at minimum loading + error)
- Backend wiring done if required
- `typecheck` + `build` clean
- Preview URL smoke-tested
- `docs/design-coverage.md` ticked
