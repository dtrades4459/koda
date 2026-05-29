# Kōda Full Audit — Index

**Audit date:** 2026-05-29
**Last status update:** 2026-05-30
**Orchestrator:** Claude (Opus 4.7)
**Mode:** READ-ONLY across all agents. Phase 2 (global Circle creation) explicitly disabled.

> **Status for Monday beta launch (2026-06-01):**
> Phase A pre-beta lock list — **12 of 14 items shipped** (see §4 below).
> Outstanding: (a) run the Supabase migration for the imports audit trail, (b) Batch 2 sign-up compliance + UK Ltd footer.
> Pickup doc: **[`NEXT_SESSION.md`](./NEXT_SESSION.md)** — read that first tomorrow.

---

## 1. Run summary

| # | Audit | Output file | Status | Elapsed | Notes |
|---|---|---|---|---|---|
| 1 | Codebase | `AUDIT.md` | ✅ Completed (on retry) | ~19m + ~6m | First attempt socket-killed at ~19m (73 tool uses, no file written). Retry succeeded — 327 lines. |
| 2 | Dev environment | `DEV_ENV_AUDIT.md` | ✅ Completed (parent-persisted) | ~17m | Sub-agent's Write tool was sandbox-denied; full content returned inline; parent orchestrator persisted to disk. |
| 3 | UI/UX | `UX_AUDIT.md` | ✅ Completed (on retry) | ~19m + ~13m | First attempt socket-killed at ~19m (63 tool uses, no file written; stale 14:57 copy remained). Retry overwrote it. |
| 4 | Funnel / lifecycle | `FUNNEL_AUDIT.md` | ✅ Completed (on retry, parent-persisted) | ~23m + ~6m | First attempt was sandbox-denied on Write AND returned only a 9-finding summary, not full content. Retry instructed to dump full markdown inline; parent persisted. |
| 5 | CSV import | `CSV_IMPORT_AUDIT.md` | ✅ Completed (on retry) | ~18m + ~6m | First attempt socket-killed at ~18m (41 tool uses). Retry wrote file directly. |

**Pattern observed:** Long-running sub-agents (>~17m) hit two failure modes on this Windows / Anthropic API setup: (a) socket-close on the longest runs, (b) `Write` denials in some sandbox states (Bash/PowerShell fallbacks also denied). Mitigation that worked: tighter scoping + "write report file early, revise" instruction; falling back to inline-markdown output when Write is denied and persisting from the parent.

---

## 2. Headline findings (one per audit)

| Audit | Top item |
|---|---|
| **Codebase** | `appTradeToV2Payload` (`src/Koda.tsx:676`) compares `outcome === "win"` lowercase, but live `Trade` uses capitalised `"Win" / "Loss" / "Breakeven"` — the v2 dual-write (flag on by default) likely classifies every trade as **breakeven**. Silent data corruption. |
| **Dev env** | Repo lives under `C:\Users\Dylon\OneDrive\…` — OneDrive has already truncated `Koda.tsx` to 0 bytes once (per `CLAUDE.md`). Plus `noUncheckedIndexedAccess` is off and `tsconfig.api.json` is orphaned from the project references. |
| **UI/UX** | The daily loss-limit / kill switch is only visible on Home → Overview. The whole in-session intervention thesis collapses the moment the user navigates to Log/History/Circles. Pinch-zoom is disabled in `index.html`. ~23 distinct font-size literals, ~17 distinct border-radius values — no enforced scale. |
| **Funnel / lifecycle** | No marketing site — `index.html` boots the SPA, the "landing" is the auth card behind BetaGate. `robots.txt` + `sitemap.xml` still point at the dead `tradrjournal.xyz` domain. PostHog autocapture + session-recording fire **before** any consent → UK PECR / GDPR exposure on day 1. |
| **CSV import** | `parseNum` (`s.replace(/[^0-9.\-()/]/g, "")`) strips commas indiscriminately — European decimal `"27,50"` becomes `2750`, a **100× error**. Plus `pnlDollar` is recomputed locally even when the broker provides authoritative net P&L, and side is inferred from a single text column that defaults **long** for Rithmic/Apex shorts. Trade-side sign errors at scale. |

---

## 3. Cross-audit dependencies

- **Funnel Phase 2 (Global Circle hardening) ↔ Codebase circles refactor.** The funnel report's recommended `is_system` flag + `leaveCircle` guard + SQL backfill all sit inside `src/hooks/useCircles.ts` — order: codebase audit's "extract `useCircles.ts` to its own concerns" first, then funnel's schema work.
- **Funnel analytics events ↔ Codebase monolith extraction.** The funnel report's AARRR event coverage (sign-up, paywall_viewed, checkout_started, subscription_activated) needs hook points in routes still buried inside the 4,492-line `Koda.tsx`. Extract the auth/onboarding/paywall surfaces first so events can be emitted at clear seams.
- **UX kill-switch visibility ↔ Codebase HOME-route + monolith.** Making the kill switch glanceable from every screen means lifting Prop Firm Mode state out of HOME-route locals and into a shared store. That refactor is on the codebase audit's extraction list.
- **CSV `parseNum` bug ↔ Codebase type safety.** The CSV report's EU-decimal and side-bias bugs are exactly the class of error that `noUncheckedIndexedAccess` + stricter `as any` removal (dev env + codebase audits) would surface earlier. Promote those TS flags before re-running the CSV parser tests so new fixtures fail loudly.
- **UX UK Ltd footer ↔ Funnel UK Ltd disclosure.** Both audits flag the same gap; fix once in the shared footer.
- **CSV silent catches ↔ Funnel silent auto-enrol catches.** Same anti-pattern (`try { … } catch { /* ignore */ }`) shows up across CSV import, global-Circle auto-join, and Stripe webhook telemetry. Address with a single "no swallowed errors" lint rule + Sentry breadcrumbs.
- **Dev env Prettier + ESLint promotion ↔ Codebase monolith extraction.** Run Prettier + promote rules from `warn` → `error` BEFORE the big extraction, otherwise the extraction PR carries a thousand churn lines.
- **Dev env Sentry sourcemaps ↔ Codebase silent-bug discoverability.** The v2 outcome-lowercase bug and the parseNum bug will both surface in production as wrong-number anomalies, not exceptions — they won't be caught by Sentry unless the codebase audit's "throw on unexpected outcome" hardening lands first. Sourcemaps are still required so the line numbers line up when something *does* throw.

---

## 4. Recommended sequencing across all audits

### Phase A — Pre-beta lock (must fix before any beta user touches it)
Pulled from CSV import critical risks and funnel sign-up / onboarding findings only.

Status as of 2026-05-30: **12 of 14 shipped.** Item 5 needs the Supabase migration run; items 11+13 need Dylon's UK Ltd details (Batch 2). See `NEXT_SESSION.md` §3.

1. ✅ **CSV: fix `parseNum` for EU decimals** — shipped in `597841e` (Batch 4a). Per-value heuristic; explicit override available. [CSV §critical]
2. ✅ **CSV: fix side-bias inference** — shipped in `597841e`. `inferBiasFromTimes` + Rithmic preset uses Buy/Sell Fill Time. [CSV §critical]
3. ✅ **CSV: stop overwriting broker-supplied net P&L with local recompute** — shipped in `597841e`. `rowToTrade` now prefers broker `pnl` for `pnlDollar`. [CSV §critical]
4. ✅ **CSV: add broker trade IDs to dedup hash** — shipped in `597841e`. `Trade.brokerId` field; MT4/5 + Rithmic presets capture; `tradeKey` prefers when present. [CSV §critical]
5. ⚠️ **CSV: persist original CSV to Supabase Storage** + audit row — code shipped in `514428b` (Batch 4b). **Migration not yet run in prod** — see `NEXT_SESSION.md` §3.1. [CSV §13]
6. ✅ **Codebase: fix `appTradeToV2Payload` outcome-lowercase bug** — shipped in `2bfb21c` (Batch 1). Now maps capitalised live shape, throws on unknown. [AUDIT §pre-launch]
7. ✅ **Funnel: fix `BETA_26` promo code mismatch** — Dylon fixed server-side in own commit; verify with `git log -- api/stripe-checkout.ts`. [FUNNEL §6]
8. ✅ **Funnel: receipt currency `$` → `£`** — shipped in `2bfb21c` (`api/stripe-webhook.ts:198`). [FUNNEL §6]
9. ✅ **Funnel: cookie consent banner** + gate PostHog — shipped in `1c5a8b8` (Batch 3). `src/CookieConsent.tsx`, `public/cookies.html`. [FUNNEL §3]
10. ✅ **Funnel: `robots.txt` + `sitemap.xml`** — shipped in `2bfb21c`. Both reference `kodatrade.co.uk`, sitemap lists all static pages. [FUNNEL §2]
11. ⏳ **Funnel: T&Cs / Privacy / marketing-opt-in checkboxes on sign-up.** Blocking item — **Batch 2 / Sunday work.** [FUNNEL §A2]
12. ✅ **Funnel: guard `leaveCircle("KODA-GLOBAL")`** — shipped in `2bfb21c`. Early-return with toast in `useCircles.ts:438`. [FUNNEL §A3 vuln]
13. ⏳ **Funnel: UK Ltd footer disclosure** — Blocking item — **Batch 2 / Sunday work.** Needs Dylon's company number + registered office. [FUNNEL §8]
14. ✅ **Funnel: align "Start free trial" copy with Stripe checkout** — shipped in `2bfb21c`. Copy now reads "Get started free". [FUNNEL §A5]

### Phase B — In-parallel with beta (fix while beta runs)
Codebase, dev env, UX.

15. **Dev env: move repo out of OneDrive** (or exclude). 20 min, prevents recurrence of the 0-byte truncation. [DEV §quick-wins]
16. **Dev env: install Prettier + `format` / `format:check` scripts**, wire into lint-staged + CI. Do this before any monolith extraction lands. [DEV §quick-wins]
17. **Dev env: enable `noUncheckedIndexedAccess`** in `tsconfig.json` and fix the resulting 50–200 errors in a focused branch. Catches the parseNum-style bugs. [DEV §2.2]
18. **Dev env: wire `tsconfig.api.json` into project refs + add `typecheck:api` script + CI step.** Currently orphaned. [DEV §2.2]
19. **Dev env: add `build.sourcemap: "hidden"` + `@sentry/vite-plugin`** so silent data bugs that *do* throw can be located. [DEV §2.7]
20. **Codebase: extract `useCircles.ts` cleanly** (it's already mostly isolated); unblocks funnel Phase 2 schema work. [AUDIT component map]
21. **Codebase: extract `TradeDetailCard` (history route 2895-3090) and the HOME-route 1000-line block** from `Koda.tsx`. [AUDIT §monolith]
22. **Codebase: kill dead code** — the `view === "import_legacy_unused"` 100-line block, `view === "import"` redirect stub, `LEGACY_GLOBAL_CODE = "TRADRG-HB1U"`, stale `TRADR (n).tsx` excludes. [AUDIT §dead code]
23. **Codebase: clean up 134 `: any` / `as any` instances** and the six `eslint-disable react-hooks/exhaustive-deps`. Triage by file. [AUDIT §type safety]
24. **Codebase: collapse `TradingCircles` prop drilling** (29 props passed down). [AUDIT §state]
25. **UX: lift kill-switch / daily-loss tracker into a global glanceable banner** that escalates calm → warning → danger on every route, not just HOME → Overview. [UX §executive, §behavioural]
26. **UX: move prop-firm rule setup from Settings into onboarding step 0.** [UX §onboarding]
27. **UX: surface discipline score at decision moments** (pre-trade, post-loss), not only retrospectively in the Pro Psychology tab. [UX §behavioural]
28. **UX: re-enable pinch-zoom** in `index.html`. [UX §accessibility]
29. **UX: design-system pass** — collapse the 23 font-size literals into the scale; collapse the 17 border-radius values; fix `C.muted` contrast for WCAG AA. [UX §drift tables]
30. **CSV: format-coverage expansion** — confirm parsers for Tradovate, TopstepX, FundedNext, MyFundedFutures + add the test fixtures listed in the audit's fixture-gap table. [CSV §2 + §17]
31. **CSV: remove the 5,000-row silent cap** and confirm chunked / streamed handling for 10k+ rows. [CSV §12]
32. **CSV: per-account assignment beyond the 3-value enum.** [CSV §11]
33. **CSV: false-success toast on KV write failure** — fix the swallowed error. [CSV §critical]

### Phase C — Pre-paid-launch (everything else flagged high severity)
Everything still on the table once beta is stable.

34. **Funnel: real marketing site (SSG)** — hero, comparison vs TradeZella/TraderSync/Tradervue, founder story, pricing, FAQ. [FUNNEL §A1, §11]
35. **Funnel: install Resend SDK** + welcome email, weekly-recap cron, payment-failed email, win-back. [FUNNEL §A10]
36. **Funnel: `/api/email-unsubscribe`** signed-token endpoint. [FUNNEL §Phase B]
37. **Funnel: AARRR event coverage in PostHog** + server-side Stripe → PostHog via `posthog-node`. [FUNNEL §A8]
38. **Funnel: membership count surfaced** on landing as social proof. [FUNNEL §A3]
39. **Funnel: push trigger plumbing** — `/api/push?action=send` is wired but never called. [FUNNEL §A4]
40. **Funnel: annual plan visibility** in `UpgradeModal`. [FUNNEL §Phase B]
41. **Funnel: JSON-LD + OG tags on static pages + canonical URLs.** [FUNNEL §A11]
42. **Funnel: Meta / TikTok / Google pixels** with consent gating + CAPI server-side. [FUNNEL §Phase C]
43. **Funnel: referral programme + shareable rank card OG-image endpoint.** [FUNNEL §A6]
44. **Funnel: GDPR `/api/export-data` endpoint** returning full ZIP. [FUNNEL §A9]
45. **Funnel: Trustpilot + status page + cookie policy page.** [FUNNEL §A7, §A9]
46. **CSV: behavioural data backfill** — make imported pre-Kōda trades flow into discipline score / streaks / Prop Firm Mode metrics. [CSV §16]
47. **CSV: prop-firm-specific logic** — daily reset boundary, trailing drawdown, consistency rule, max-loss-day breach. [CSV §15]
48. **Dev env: branch + CI cleanup** — prune 35+ remotes, switch CI `npm install` → `npm ci`, promote ESLint rules `warn` → `error`. [DEV §sequencing H]
49. **Dev env: env-var Zod validation module** (optional). [DEV §sequencing I]
50. **Codebase: tighten Supabase response handling** — every query group from the codebase audit's table-by-table list. [AUDIT §supabase]

---

## 5. Next prompts to request from Claude

Paste the relevant report back into chat with the request alongside.

1. **`AUDIT.md` → monolith extraction plan.**
   *"Plan the `Koda.tsx` extraction. Order components by dependency, propose PR-sized chunks, flag which extractions unblock the UX kill-switch refactor and the funnel auto-enrol fix."*
2. **`CSV_IMPORT_AUDIT.md` → correctness fixes as one bundled PR.**
   *"Plan a single 'CSV correctness' PR: `parseNum` EU-decimal fix, side-bias inference fix, broker-net-P&L respect, dedup with broker trade IDs. Include test fixtures and a migration plan for already-imported corrupted data."*
3. **`FUNNEL_AUDIT.md` → "launch-ready" PR scope.**
   *"From the Pre-launch blockers in Phase A, scope a single 'launch-ready' PR covering: `BETA_26` promo, receipt currency, cookie consent, robots/sitemap, T&Cs/Privacy checkboxes, leaveCircle guard, UK Ltd footer, trial-copy alignment. Identify what needs design / legal review before merge."*
4. **`UX_AUDIT.md` → kill-switch glanceability refactor.**
   *"Plan the kill-switch / daily-loss glanceable banner refactor: where the state lives, how it propagates, the visual escalation thresholds, and which screens it pins to. Include the discipline-score-at-decision-moment work since they share the same surface."*
5. **`DEV_ENV_AUDIT.md` → strict TS + Prettier rollout.**
   *"Plan the dev-env tightening as a sequence: OneDrive relocation, Prettier install + first reformat commit, `noUncheckedIndexedAccess` migration in a focused branch, `tsconfig.api.json` wiring, Sentry sourcemaps. Estimate each session and flag which must finish before the codebase monolith extraction starts."*

Optional combined prompt once Phase A is queued: *"Audit the Phase A PRs against the originating audit reports — what did we miss, what slipped scope, and what's the smallest safe set we can ship before opening beta?"*
