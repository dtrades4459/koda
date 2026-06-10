# Kōda — STATE

> One-page pickup card. Read first. Heavier rolling context: `NEXT_SESSION.md`. Operating rules + file map: `CLAUDE.md`. Per-session journals: `docs/superpowers/sessions/`.

**Updated:** 2026-06-10 (Wed, security sprint)
**On `main`:** `85134f3` — feat(security): render screenshots via short-lived signed URLs (Runbook B step 1)
**Prod:** https://kodatrade.co.uk · auto-deploys on push to main
**Stage:** Closed beta · ~14 members in KODA-GLOBAL · Monday dogfood + TikTok push imminent

---

## Just shipped (2026-06-10)

- **Runbook C closed** — `circle_messages` strict members-only RLS live in prod (`20260610_circle_messages_strict_rls.sql`): non-recursive `cm_read_member` + `SECURITY DEFINER is_circle_member()`. Verified: stranger sees 0 rows, member sees all, chat loads.
- **Runbook B closed** — `trade-screenshots` bucket is now PRIVATE. All renders go through signed URLs (`lib/screenshots.ts` + `useSignedUrl` + `SignedImg`, commit `85134f3`). Verified: 5 surfaces load, logged-out CDN URL fails.

## Previously shipped (2026-06-07)

- 4 social bugs from QA audit (NaN% AVG WR · `@@@handle` · chat input covered · losses missing minus sign)
- Mobile sub-nav dropdowns added where missing: Social, History, Checklist, Circles detail
- Circle detail header de-cluttered (~520px → ~280px; killed redundant Top-3 mini-board, Your-rank callout, 4-col publish grid, 🏆 emoji)
- News test suite fixed — `useNews` refactor to `/api/news` had broken the supabase mocks; 333/333 green now

## Next highest-leverage move

**Run the 14-day dogfood. No new features. No TikTok. No JARVIS. No redesign.**
Use Kōda every NY AM as a real trader. Log every trade in-app. Day 7 + Day 14 check-ins on the one metric: % of dogfood users (n=14) who log a trade on day 21. >50% = wedge works, <30% = wedge wrong (re-interview). Full verdict: `docs/superpowers/sessions/2026-06-07-garry-verdict.md` (will move to vault).

## Open threads (priority order)

1. **30-day dogfood, starts Mon 2026-06-08** — daily NY AM use of Kōda as a real trader. Gates the TikTok distribution push.
2. **Deploy-gating smoke test** — ci.yml exists but SMOKE_TEST_* secrets unset (auth'd smoke never runs), e2e is continue-on-error, and direct pushes bypass the "build" protection rule. In progress 2026-06-10.
3. **v2 dual-write decision** — finish or roll back `newTrades`/`newProfile`. Verify `trade-gate` counts cover KV-only users (free-limit enforcement gap).
4. **Tradovate dead-code teardown** — `useTradovate` + `api/tradovate.ts` + `src/lib/tradovate.ts` + ~150 lines of dead UI in `Koda.tsx`. `liveBrokerSync` flag stays default-off.
5. **`Koda.tsx` split** — ~4,950 lines. Extract Home / Stats / Settings / Log per `TradingCircles.tsx` pattern.

## Active flags

- `liveBrokerSync` — OFF (Tradovate Partner API not self-serve)
- `newTrades` / `newProfile` — dual-write to v2 relational schema (decide: finish or roll back)

## Team

- **Dylon** — founder, only code-toucher. Backend-light; lean on Claude Code for infra/SQL.
- **Bruno** — COO, ops/business. Non-technical.
- **Dan** — distribution/growth. Non-technical.
- No internal code reviewer. External review or simplification preferred over "ask Dan."

## Daily routine (calendar-synced 2026-06-04)

06:45 wake · 08:30–10:30 Kōda block · 13:00–16:00 NY AM trading · 17:00–19:00 Kōda block · 20:00 nightly platform call · Sun = plan/review

## Pointers

| Need | Read |
|------|------|
| Operating rules, stack, file map | `CLAUDE.md` |
| Deeper rolling pickup | `NEXT_SESSION.md` |
| Per-session journals | `docs/superpowers/sessions/` |
| Plans / specs | `docs/superpowers/{plans,specs}/` |
| Design system | `DESIGN.md` |
| Durable lessons | `lessons.md` |
