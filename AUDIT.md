# Kōda Codebase Audit

_Generated 2026-05-29. Read-only inspection. No source files modified._

Repo: `C:\Users\Dylon\OneDrive\Desktop\tradr-fresh`
Main entry: `src/Koda.tsx` (4,492 lines), `src/KodaAuth.tsx` (616 lines)
Stack: React 19 · TS · Vite 8 · Supabase · Vercel

---

## 1. Executive Summary — Top 5 Highest-Impact Issues

1. **`src/Koda.tsx` is still a 4.5k-line god component.** It owns ~80 `useState`/`useRef` hooks, every route, the trade-detail card, the strategy editor, the confluence tracker, the Tradovate connect/positions modal, the feedback modal, the share-to-circle picker, the first-session survey, and the entire history detail UI. Extracting at least the history detail card, the Tradovate modal, `StrategyEditor`, `ConfluenceTracker`, and `FirstSessionSurvey` would cut ~1500 lines without behaviour change. **Severity: high. Effort: L.**
2. **Dead `view === "import_legacy_unused"` block (~100 lines, `Koda.tsx:3819-3919`).** Renders a parallel broker-tiles UI that is reachable by no code path. Plus, `view === "import"` (line 3818) is a redirect-only stub. Removing both shrinks the monolith and eliminates two competing broker UI paths. **Severity: high (confuses pre-launch UX work). Effort: S.**
3. **Hardcoded `TRADR…` strings + legacy table coupling during the v2 migration.** `LEGACY_GLOBAL_CODE = "TRADRG-HB1U"` is declared but never referenced (`Koda.tsx:49`). Every persisted storage key still uses the `koda_…` prefix while CLAUDE.md / docstrings refer to `tradr_…` (see "Key storage keys" table). At minimum: delete the unused legacy constant; update CLAUDE.md / `lib/storage.ts` header comment / README to match real keys. **Severity: med-high (migration confusion). Effort: S.**
4. **`Trade` legacy type stores numerics as `string` everywhere** (`form.pnl`, `t.pnl`, `t.pnlDollar`, `t.rr`, `t.entryPrice`, etc. — see ~50 `parseFloat(t.pnl)` calls across `Koda.tsx`). This forces `parseFloat(...) || 0` defensive code throughout, hides bugs (a CSV with empty cells silently becomes 0 P&L), and is the main reason `appTradeToV2Payload` exists (Koda.tsx:674-696). The v2 `Trade` in `src/data/trades.ts` already uses `number` correctly. Until the v2 cutover flips, every stat calculation pays this tax. **Severity: high. Effort: M (typed at boundary, normalise on load).**
5. **Pre-launch blockers in `DataSourcesScreen.tsx`.** The live-broker UI is masked by a "Coming Soon" overlay rendered on top of two fake static cards ("Tradovate — Live", "Rithmic — Demo" with a fabricated "Last sync: 5m ago · syncing…", lines 320-371). Live connections list and connect button are commented-out blocks (lines 374-388). Before launching live sync this must be unhidden + the placeholder cards removed. **Severity: high (blocker). Effort: S.**

---

## 2. Component Map — `src/Koda.tsx`

Top-level export: `default function Koda({ user, jwtPlan })` at **line 197**, closing `}` at **line 4303**.

| Symbol | Lines | Kind | What it owns | Extract? |
|--------|-------|------|--------------|----------|
| `LEGACY_GLOBAL_CODE` | 49 | const | Unused legacy `TRADRG-HB1U` string | **DELETE** |
| `DEF_PROFILE` | 54-69 | const | Default Profile object | Move → `src/types.ts` or `src/data/profile.ts` |
| `OUTCOMES`, `REACTIONS`, `TABS`, `STREAK_MILESTONES`, `STREAK_FLAVOUR` | 70-80 | consts | Domain enums | Move → `src/tradeConstants.ts` |
| `StrategyEditor` | 93-194 | sub-component | name/code/setups editor used inside Checklist tab | **YES → `src/components/StrategyEditor.tsx`** |
| `Koda` (default export) | 197-4303 | main component | Everything below | Split incrementally |
| `navigateTo` / `goBack` / `primaryNav` | 205-222 | helpers | View history stack | OK inline OR extract to `useNavStack` hook |
| `loadAll` | 480-622 | helper | Initial KV/v2 fetch, screenshot migration, plan resolve, PostHog identify | Extract to `src/data/bootstrap.ts` (file already exists, only 27 lines) |
| `appTradeToV2Payload` | 674-696 | helper | Translates legacy string-typed Trade → v2 number-typed | Move alongside v2 trades module |
| `saveTrades` / `saveProfile` / `saveStratChecklists` / `saveStratRules` / `saveStratThresholds` / `toggleDark` / `saveCustomStrategies` | 698-892 | helpers | KV mutations + v2 dual-write | Extract to a `useKodaStore` hook |
| `openNewStrategy` / `openEditStrategy` / `saveStrategyDraft` / `deleteCustomStrategy` | 631-671 | helpers | Custom strategy CRUD | Move with `StrategyEditor` extraction |
| Stripe redirect useEffect | 391-421 | effect | `?upgraded=1`, `?cancelled=1`, `?session_id=…` handling | Extract to `useStripeReturn` hook |
| `?join=` deep-link useEffect | 425-437 | effect | Join code URL pre-fill | Extract to `useDeepLink` hook |
| `statsFingerprint` memo | 441-450 | memo | Cheap hash for auto-publish | Keep inline (cheap) |
| `refreshDraftCount` | 460-473 | helper + effects | Inbox badge query | Extract to `useDraftCount(uid, view, loading)` hook |
| `handleChange` / `submitTrade` / `editTrade` / `deleteTrade` / `toggleReaction` / `addComment` / `deleteComment` | 928-1034 | trade CRUD | Form state + saves | Extract to `useTradeForm` hook (LogTradeScreen already exists as sibling — wire form state into it) |
| `handleScreenshotUpload` / `removeScreenshot` / `handleAvatarUpload` | 1037-1104 | image helpers | Supabase Storage upload + base64 fallback | Extract to `src/lib/uploads.ts` |
| Checklist helpers `toggleCheck`/`addCheckItem`/`deleteCheckItem`/etc. | 1107-1117 | helpers | Per-strategy rules + checks | Extract with the checklist UI |
| `getMyCode` | 1126-1142 | helper | Stable rename-safe code | Move → `src/data/profile.ts` |
| `normaliseHandle` / `resolveHandle` / `registerHandle` / `isHandleTaken` | 1156-1195 | helpers | Handle registry in shared_kv | Move → `src/data/handles.ts` (new file) |
| `exportData` / `exportCSV` / `openExportPdf` | 1199-1473 | helpers | Export JSON/CSV/print-PDF | Extract → `src/lib/exports.ts` (note: `openExportPdf` is a 40-line HTML template — major candidate) |
| `submitFeedback` | 1240-1270 | helper | POST `/api/feedback` | Move into Feedback modal extraction |
| `deleteAccount` | 1274-1307 | helper | POST `/api/delete-account` | Move into Settings or `src/data/account.ts` |
| Stats memo (`wins`, `losses`, …) | 1313-1379 | memos | Derived stats | OK to keep but candidate for `useTradeStats(trades)` hook |
| `filteredTrades` memo | 1380-1388 | memo | History filtering | Move with history extraction |
| Splash / loading screen | 1486-1511 | jsx block | First-paint splash | Extract to `<LoadingSplash />` |
| Onboarding-gate render | 1516-1553 | jsx | Conditional on `!profile.onboarded` | Already calls `<OnboardingFlow />`; leave |
| Masthead | 1602-1650 | jsx | Header bar, back button, bell, avatar | Extract → `<Masthead />` |
| Sidebar nav (desktop) | 1654-1683 | jsx | Sidebar | Extract → `<Sidebar />` |
| HOME tab body (`view === "home"`) | 1687-2686 | jsx | ~1000 lines — feed/circles/ai/analytics/rules/checklist/sync/eval/settings + hero card + daily-risk dashboard + monthly report + plan row + data-export + footer | Multiple extractions: `<HeroCard>`, `<DailyRiskDashboard>`, `<MonthlyReportCard>`, `<PlanRow>` |
| Trade-of-the-week subsection | 2178-2215 | jsx | Behind `isFlagOn("socialFeed")` | Extract → `<TradeOfTheWeekCard>` |
| INBOX route | 2689-2698 | jsx | `<ReviewInboxScreen>` wrapper | OK |
| LOG route | 2701-2755 | jsx | Draft banner + `<LogTradeScreen>` wrapper | OK (banner could be in LogTradeScreen) |
| HISTORY route | 2758-3102 | jsx | ~350 lines — list, filters, grouped-by-day, **giant trade-detail expanded card** (lines 2895-3090) | **STRONGEST extract candidate**: `<TradeDetailCard>` (~200 lines) |
| STATS route | 3105-3699 | jsx | Win-rate ring, day-of-week, all stats tabs | Extract per-tab: `<StatsOverview>`, `<StatsPerformance>`, `<StatsCalendar>`, etc. |
| RULES / CHECKLIST route | 3702-3815 | jsx | Strategy header card + pre-trade + rules subtabs | Extract → `<ChecklistScreen>` |
| Dead `import` redirect | 3818 | jsx | One-liner redirect to history | DELETE — handle via real navigation |
| **Dead `import_legacy_unused`** | 3819-3919 | jsx | 100 lines of unreachable broker tile UI | **DELETE** |
| CIRCLES route | 3922-3946 | jsx | `<TradingCircles>` wrapper | OK |
| Bottom nav | 3951-3987 | jsx | Mobile bottom nav + calculator button | Extract → `<BottomNav>` |
| Feedback FAB | 3990-3994 | jsx | Floating "Feedback" button | OK inline |
| Tradovate live modal | 3997-4132 | jsx | Connect form + connected state + positions list | **YES → `<TradovateLiveModal>`** |
| Tour overlay | 4135 | jsx | `<TourOverlay>` wrapper | OK |
| First-session survey | 4137-4148 | jsx | `<FirstSessionSurvey>` wrapper | OK |
| Feedback modal | 4150-4180 | jsx | Textarea + send | Extract → `<FeedbackModal>` |
| Upgrade modal | 4181-4191 | jsx | `<UpgradeModal>` wrapper | OK |
| Profile modal | 4193-4204 | jsx | `<ProfileModal>` wrapper | OK |
| Calculator | 4205-4207 | jsx | `<LotSizeCalculator>` wrapper | OK |
| Notifications drawer | 4208-4214 | jsx | `<NotificationsDrawer>` wrapper | OK |
| Offline banner | 4226-4231 | jsx | Online/offline alert | Extract → `<OfflineBanner>` |
| Circle share picker | 4234-4299 | jsx | Bottom-sheet circle picker | Extract → `<ShareToCircleSheet>` |
| `ConfluenceTracker` (after main) | 4305-4431 | sub-component | Score, threshold slider, must-haves | **YES → `src/components/ConfluenceTracker.tsx`** |
| `PRIOR_TOOL_OPTIONS` + `FirstSessionSurvey` | 4435-4491 | const + sub-component | First-session survey UI | **YES → `src/components/FirstSessionSurvey.tsx`** |

### Proposed target folder layout
```
src/
  Koda.tsx                                  // shell + routing only — target < 800 lines
  hooks/
    useNavStack.ts                          // navigateTo/goBack/primaryNav
    useStripeReturn.ts
    useDeepLink.ts                          // ?join= handler
    useDraftCount.ts
    useTradeStats.ts                        // memos currently inline at 1313-1379
    useTradeForm.ts                         // form state + submitTrade/edit/delete
  data/
    handles.ts                              // resolveHandle / registerHandle / isHandleTaken
    bootstrap.ts                            // expand existing 27-line file with full loadAll
    account.ts                              // deleteAccount
  lib/
    uploads.ts                              // handleScreenshotUpload / handleAvatarUpload
    exports.ts                              // exportData / exportCSV / openExportPdf
  components/
    Masthead.tsx
    Sidebar.tsx
    BottomNav.tsx
    LoadingSplash.tsx
    OfflineBanner.tsx
    StrategyEditor.tsx                      // already extractable from lines 93-194
    ConfluenceTracker.tsx                   // already extractable from lines 4305-4431
    FirstSessionSurvey.tsx                  // already extractable from lines 4440-4491
    FeedbackModal.tsx
    TradovateLiveModal.tsx
    ShareToCircleSheet.tsx
    HomeHeroCard.tsx
    DailyRiskDashboard.tsx
    MonthlyReportCard.tsx
    PlanRow.tsx
    DataExportRow.tsx
    TradeOfTheWeekCard.tsx
    TradeDetailCard.tsx                     // ~200 lines from history route
  screens/
    HistoryScreen.tsx                       // wraps list + filters + TradeDetailCard
    StatsScreen.tsx                         // tabs: Overview/Performance/etc.
    ChecklistScreen.tsx
    HomeScreen.tsx                          // composes feed/circles/ai/analytics/rules/sync/eval/settings sections
```

---

## 3. Findings by Section

### 3.1 Monolith breakdown

| File | Lines | Severity | Recommendation | Effort |
|------|-------|----------|---------------|--------|
| `src/Koda.tsx:3819-3919` | 100 | high | Delete `view === "import_legacy_unused"` route + the `view === "import"` redirect on line 3818. Replace with direct navigation. | S |
| `src/Koda.tsx:2895-3090` | ~200 | high | Extract `<TradeDetailCard trade={t} … />` — the expanded-row UI is the single largest reusable block | M |
| `src/Koda.tsx:93-194` | 102 | med | Extract `StrategyEditor` into `src/components/StrategyEditor.tsx` (it already takes typed props) | S |
| `src/Koda.tsx:4305-4431` | 127 | med | Extract `ConfluenceTracker` (already a function, just move) | S |
| `src/Koda.tsx:4440-4491` | 52 | med | Extract `FirstSessionSurvey` | S |
| `src/Koda.tsx:3997-4132` | 135 | med | Extract `<TradovateLiveModal>` — modal currently inline | S |
| `src/Koda.tsx:1434-1473` | 40 | med | Extract `openExportPdf` into `src/lib/exports.ts` — uses string concatenation HTML, refactor as template | S |
| `src/Koda.tsx:1687-2686` | ~1000 | high | Decompose HOME route into per-section components (`HomeHeroCard`, `MonthlyReportCard`, `PlanRow`, `DailyRiskDashboard`, `TradeOfTheWeekCard`) | L |
| `src/Koda.tsx:3105-3699` | ~600 | high | Decompose STATS route per `statsTab` value (overview / performance / strategies / calendar / weekly / psychology / heatmap / maemfe) | L |
| `src/shared.tsx` | 1014 | med | This file mixes fonts, helpers, 10+ React components, the toast stack, empty-state component, etc. Consider splitting `shared/components/`, `shared/styles.ts`, `shared/icons.tsx`. | M |

### 3.2 Dead code

| File | Line(s) | Severity | Recommendation | Effort |
|------|---------|----------|---------------|--------|
| `src/Koda.tsx:49` | 1 | med | `LEGACY_GLOBAL_CODE = "TRADRG-HB1U"` is declared but never referenced. Delete. | S |
| `src/Koda.tsx:3818` | 1 | med | `view === "import"` immediately redirects to history. Inline at call sites or remove via real navigation. | S |
| `src/Koda.tsx:3819-3919` | 100 | high | `view === "import_legacy_unused"` route is unreachable. Delete. | S |
| `src/DataSourcesScreen.tsx:374-388` | 15 | low | Multi-line `/* */` comments preserving the future broker-list UI. Either restore behind a flag or delete. | S |
| `tsconfig.app.json:32-35` | 4 | med | `exclude` lists `src/TRADR (1).tsx` … `src/TRADR (4).tsx` — those files no longer exist (`ls src/` confirms). Remove stale excludes. | S |
| `src/shared.tsx:70-83` | 14 | low | `KodaMarkFilled` marked `@deprecated` but still used by `Koda.tsx:1496` (loading splash) and `Koda.tsx:2045` (zero-state CTA). Either un-deprecate or migrate callers to `KodaMark`. | S |
| `src/Koda.tsx:531` | 1 | low | `if (_loadedRef.current) { migrationAlive = true; }` — `migrationAlive` is already `true`; this is a no-op. Remove. | S |
| `package.json` deps: `web-push`, `@types/web-push`, `workbox-*` | n/a | low | Confirm push notifications are actively used. `api/push.ts` does upsert subscriptions, so `web-push` itself is used server-side. The five `workbox-*` packages should be audited against `src/sw.ts` to confirm none are unused. | S |
| Unused npm deps | n/a | med | Run `npx depcheck` once. `xlsx` is in deps but I did not see an import for it in `src/lib/csvParser.ts` — confirm it's used by the CSV importer or remove. | S |

### 3.3 Supabase usage

#### By table (browser-side reads/writes)

| Table | Reads (file:line) | Writes | Issues |
|-------|------------------|--------|--------|
| `user_kv` | `lib/storage.ts:67`, `lib/storage.ts:93` | `lib/storage.ts:118`, `delete` 139 | OK — wrapped in shim. |
| `shared_kv` | `lib/storage.ts:84`, `lib/storage.ts:154` (`listByPrefix`) | `lib/storage.ts:110`, `delete` 133 | OK. |
| `trades` | `Koda.tsx:463` (draft count, head-only), `ReviewInboxScreen.tsx:100/126/153/177`, `data/trades.ts:105/120/140/153/166` | Same | `Koda.tsx:463` uses `.then(…, () => {})` to ignore errors — silent failure is fine for a badge but no telemetry. |
| `profiles` | `data/follows.ts:161`, `data/profile.ts:68/82/96` | Same | Behind `newProfile` flag (ON by default). |
| `follows` | `data/follows.ts:178/192/216/221` | Same | Realtime channel uses `"postgres_changes" as any` (132) — cast because Supabase JS types don't expose it as a string literal. Acceptable. |
| `circle_messages` | `hooks/useCircles.ts:176`, `TradingCircles.tsx:110/184` | `TradingCircles.tsx:166/201`, delete 219 | All have `try/catch` but errors only log to console via `useCircles` realtime path. |
| `circle_challenges` | `TradingCircles.tsx:118`, `data/circlesChallenges.ts:14/24/47` | `data/circlesChallenges.ts:24` | OK. |
| `circle_challenge_results` | `data/circlesChallenges.ts:37` | Same | OK. |
| `circle_shared_trades` | `data/circlesSharedTrades.ts:49` | `data/circlesSharedTrades.ts:19` | OK; reaction toggle uses RPC `toggle_trade_reaction` (65). |
| `broker_connections` | `DataSourcesScreen.tsx:151`, `api/cron/sync.ts:198/224/238/267/301/326/391/416` | Same | Service-role only on server; RLS on client. OK. |
| `sync_events` | `DataSourcesScreen.tsx:162` | `api/cron/sync.ts:271/310/330` | OK. |
| `trade-screenshots` (Storage) | `Koda.tsx:519/1050/1094` | upload `Koda.tsx:514/1048/1092`, delete `1072` | Three separate `upload` call sites with near-identical setup — extract `uploadTradeImage(uid, blob, kind)` helper. |

#### Duplicates / inefficiencies

- **Duplicate per-circle latest message query in `hooks/useCircles.ts:172-187`**: fires N queries in `Promise.all` every time the user navigates to home/circles. Recommend creating a Postgres view `latest_circle_message_per_circle` or RPC `get_latest_messages(codes text[])` and a single query. (Already noted in CLAUDE.md backlog as "Replace N+1 `fetchCircleLeaderboard`…".)
- **`Koda.tsx:463-467` draft count** uses `head: true` count query on every navigation to `log`/`inbox` — minor; could be subscribed via realtime instead of polling.
- **`saveTrades` (`Koda.tsx:698-713`) v2 dual-write** loops over the entire trades array and fires N parallel upserts on every save — works but expensive. Once `newTrades` flag flips, replace with a per-trade write.

#### Missing error handling
- `Koda.tsx:282-287` Supabase auth session subscribe — no error path; `data.session` could be null on failure but we silently set `""`.
- `Koda.tsx:1071-1074` storage delete `await supabase.storage.from("trade-screenshots").remove([storagePath])` wrapped in bare `try { … } catch {}` with `/* non-fatal */` comment — fine for a screenshot, but means orphaned storage objects accumulate. Consider a nightly storage cleanup job.
- `useCircles.ts:182-184` per-circle message fetch swallows errors — acceptable for non-critical UI, but no telemetry.

#### Lingering TRADR / v1 references
- `Koda.tsx:49` `const LEGACY_GLOBAL_CODE = "TRADRG-HB1U";` — **dead, delete**.
- `README.md` first line is literally `# TRADR`; description references `src/TRADR.tsx`. **Update entire README** (Kōda branding, current file names).
- `CLAUDE.md:135-141` "Key storage keys" table lists `tradr_profile`, `tradr_trades`, `tradr_profile_pub_{handle}`, `tradr_feed_{uid}`, `tradr_circle_{code}`, `tradr_following_{uid}` — but real keys (grep-confirmed) are `koda_profile`, `koda_trades`, `koda_profile_pub_…`, `koda_feed_…`, `koda_circle_…`, `koda_following_…`. **CLAUDE.md is wrong / stale.**
- Migration `20260524000000_rename_tradr_kv_keys.sql` was already run (renamed legacy data to `koda_*`). CLAUDE.md was not updated to match.
- `Koda.tsx:330` `Bug: Onboarding loop … "tradr_onboarded"` comment is stale; actual key on line 1524 is `koda_onboarded`.

### 3.4 Type safety

| File | Line(s) | Issue | Severity | Recommendation | Effort |
|------|---------|-------|----------|---------------|--------|
| Project-wide | n/a | **134 occurrences of `: any` / `as any`** across 24 files (grep count) | high | Triage in 3 waves: (1) `Koda.tsx` JSX prop casts at component boundaries (`C as any`, `friendFeed as any`, `setForm as any` — lines 2273-2281, 2734-2738, 3727) — fix by lifting `Theme` type from `theme.ts` everywhere; (2) `shared.tsx:99,210,234,240,250,276,334,378` — every shared component takes `: any` props, replace with typed interfaces; (3) error catches `e: any` in `KodaAuth.tsx:85,112,126` and `DataSourcesScreen.tsx:209` — replace with `unknown` + type guard. | L |
| `src/shared.tsx:99-101, 141` | 2 | `// eslint-disable-next-line react-hooks/exhaustive-deps` on `Toast` and another effect | low | Add the deps the effect actually uses, or wrap in `useEffectEvent` if available | S |
| `src/Koda.tsx:421` | 1 | `// eslint-disable-line react-hooks/exhaustive-deps` on Stripe redirect effect | low | Effect is meant to run once. Move into `useEffectEvent` or rename refs to make intent explicit. | S |
| `src/hooks/useFeed.ts:131, 259, 268` | 3 | Three more `react-hooks/exhaustive-deps` disables | med | Audit each — sync-loops typically should keep `loading` in deps but use refs for callbacks. | M |
| `src/Koda.tsx:965, 969` | 2 | Bypasses storage shim with `(window as any).storage.get(…)` instead of imported `storage.get(…)` already in scope | low | Replace with `await storage.get("koda_streak_milestones")`. | S |
| `src/Koda.tsx:1127-1128` | 2 | `(profile as any).code` — `Profile` type is missing `code?: string` | med | Add `code?: string` to `Profile` in `src/types.ts`. | S |
| `src/data/trades.ts:53`, `src/data/profile.ts:30` | 2 | `function fromRow(r: any)` | low | Either type as `Record<string, unknown>` and guard, or generate types via `supabase gen types`. | M |
| `src/data/follows.ts:165, 227, 231` | 3 | `(data as any)?.user_id`, `(r: any) => r.profiles?.member_code` | low | Same — generate Database types and drop casts. | M |
| No `@ts-ignore` or `@ts-expect-error` found in src/ or api/ | — | Good. | — | — | — |
| Missing return types | many | `function StrategyEditor`, `function FirstSessionSurvey`, etc. | low | TS infers fine here; not a real issue. | — |

### 3.5 State and effects

| Pattern | Location | Severity | Recommendation | Effort |
|---------|----------|----------|---------------|--------|
| ~80 useState calls in `Koda` | `Koda.tsx:198-348` | high | Group related state into reducer-driven hooks: `useTradeForm`, `useChecklistEditor`, `useCirclesUI`, `useCalculator`, `useFeedbackModal`. Reduces re-renders + simplifies prop signatures. | L |
| `useEffect(…, [])` with `// eslint-disable-line react-hooks/exhaustive-deps` | `Koda.tsx:421`, `useFeed.ts:131/259/268`, `shared.tsx:101` | med | See 3.4 — root cause is effects reading from `state` they didn't list. Switch to refs (already done in `useCircles.ts:193-194` for `publishToCircle`). | M |
| Derived state stored in state (instead of memo) | `Koda.tsx:333` `const allStrategyNames = [...STRATEGY_NAMES, ...customStrategies.map(...)]` recomputed every render | low | Wrap in `useMemo([customStrategies])`. | S |
| Prop drilling > 2 levels | `Koda → TradingCircles` (29 props, lines 3923-3945); `Koda → LogTradeScreen` (~15 props, lines 2732-2752); `Koda → CsvImportPanel` (~10 props, twice — lines 2782-2792 and inside DataSourcesScreen) | high | Introduce a small `KodaContext` (theme `C`, profile, showToast, navigateTo) — removes ~10 props from every child. Heaviest offender is `TradingCircles`. | M |
| Derived `allSetups` recomputed via `useMemo` correctly | `Koda.tsx:1395-1398` | — | OK. | — |
| `kodaGlobalBackfillRef` race-guard pattern | `Koda.tsx:808-833` | low | Works but complex. Consider moving into `useCircles` hook as its own effect, since that's where the circle state lives. | S |
| `_publishRef.current = publishToCircle` ref-mirror | `useCircles.ts:193-194`, comment 198 explains | — | Good pattern, already documented. | — |
| `EMPTY_TRADE` import for form reset | `tradeConstants.ts` | — | OK. | — |
| `useCallback` usage | Several callbacks not wrapped (`exportData`, `exportCSV`, `openExportPdf`, `submitFeedback`) | low | Wrap them once extracted to avoid re-creating per render when passed to memoised children. | S |

### 3.6 Mobile constraints

CLAUDE.md says mobile-first capped at 480px, but the live code uses a 4-tier viewport scheme via `useViewport` and the mobile cap appears to be ~720px (see `Koda.tsx:1591` `maxWidth: … "720px"`) and bottom-nav `460px` (line 3952). The 480px cap mentioned in the audit prompt is not present in this codebase.

| Issue | Location | Severity | Recommendation | Effort |
|-------|----------|----------|---------------|--------|
| Fixed pixel widths in modals | `Koda.tsx:3952` bottom nav `maxWidth: "460px"`; share sheet `4242` `maxWidth: 420`; Tradovate modal `4000` `maxWidth: "clamp(0px, 100%, min(560px, 92vw))"` (good); feedback modal `4154` (good) | low | Standardise on `clamp()` everywhere. | S |
| Sub-44px tap target candidates | `Koda.tsx:2607` rule edit/rm buttons `padding: "8px 10px"` with explicit `minHeight: "44px"` (good); `Koda.tsx:1707` streak banner close-button (`padding: "4px"`, no minHeight) — **violates 44px**; `Koda.tsx:3052` comment delete `x` button (`background:none, border:none, fontSize:10`) — likely sub-44; `Koda.tsx:3082` `pillGhost` buttons in trade-detail actions — `padding: "8px 14px"` no minHeight | med | Audit all `<button>` without `minHeight: 44`. Likely 30+ instances. | M |
| Hard-coded pixel widths for icon containers | `Koda.tsx:1641` settings avatar `width:36 height:36` — OK touch target since it sits in a button; `Koda.tsx:2023` Tradovate icon `38x38`; many `20x20` checkbox circles — but wrapped in 44x44 hit-area divs (`Koda.tsx:3736-3737`), which is correct | low | Existing pattern is OK; ensure consistency across all checkboxes. | — |
| Bottom-nav viewport scaling | `Koda.tsx:3952` `maxWidth: "460px"` for the floating glass pill | low | Already inside `(100% - 32px)`; fine. | — |
| Splash screen has `width: "96px"` fixed | `Koda.tsx:1494` | low | Acceptable — splash is non-interactive. | — |
| `Koda.tsx:4154`, `4042`, `4032` form inputs `boxSizing: "border-box"` set inline per input | low | Move to a single `input[type=text]{box-sizing:border-box;}` style block | S |

### 3.7 Config and env

| Issue | Location | Severity | Recommendation | Effort |
|-------|----------|----------|---------------|--------|
| `tsconfig.app.json:32-35` excludes 4 non-existent `TRADR (n).tsx` files | `tsconfig.app.json` | med | Remove stale excludes. | S |
| `src/lib/supabase.ts:6-8` throws on missing env vars | OK — but message references `[KODA] Missing Supabase env vars`. | low | Confirm test/jsdom setup provides these or mocks the client. | S |
| Hardcoded magic strings | `Koda.tsx:1281` `if (deleteConfirm.toUpperCase() !== "DELETE")`; `Koda.tsx:1407` `STREAK_MILESTONES = [3, 7, 14, 30, 100]`; `Koda.tsx:49` `LEGACY_GLOBAL_CODE`; `KodaAuth.tsx:44` `USERNAME_DOMAIN = "users.kodatrade.co.uk"` (good — already named) | low | Move all to `src/lib/constants.ts`. | S |
| Path aliases | None configured — every import is relative (`./`, `../`). | low | Optional: add `"@/*": ["./src/*"]` in `tsconfig.app.json` + `vite.config.ts` resolve.alias to flatten 3-level imports. Cosmetic. | S |
| `index.html` not inspected | n/a | — | No findings. | — |
| `vercel.json` referenced in CLAUDE.md but not audited here | n/a | low | Confirm CSP allows `eu.i.posthog.com` and Sentry. | S |
| `.env.example` matches CLAUDE.md env table | OK | — | — | — |

### 3.8 Pre-launch blockers

| Blocker | Location | Severity | Recommendation | Effort |
|---------|----------|----------|---------------|--------|
| **Placeholder broker tiles + fake "5m ago · syncing…"** | `DataSourcesScreen.tsx:331-371` | high | Remove fake static cards. Hide "Coming Soon" overlay behind a flag (`isFlagOn("liveBrokerSync")`) so it disappears the moment real connections exist. | S |
| **Commented-out connections list** | `DataSourcesScreen.tsx:374-388` | high | Decide: ship live or delete. | S |
| **Beta paywall gate** | `src/BetaGate.tsx` controlled by `VITE_BETA_PASSWORD` | low | This is intentional and well-documented in CLAUDE.md. No action — just confirm Vercel env var is unset (or `removed`) at public launch. | S |
| Dead `view === "import_legacy_unused"` UI surfaces stale broker UX | `Koda.tsx:3819-3919` | high | Delete (see 3.2). | S |
| Stripe `paywall` flag DEFAULT_ON | `lib/flags.ts:29` | med | This **enforces** the 20-trade cap + Pro gates. If launch is "open free tier", confirm this is the intended default; if "everyone gets full features for now", flip default off. | S |
| TODO/FIXME comments | None found in `src/` or `api/` (apart from one `XXX` in `Koda.tsx:424` — a literal join-code example, not a TODO) | — | Good — codebase has no rotting TODOs. | — |
| README.md still says "TRADR" + describes 3600-line `src/TRADR.tsx` | `README.md` | high | Replace with Kōda README. | S |
| CLAUDE.md storage keys table out of sync with reality | `CLAUDE.md:134-141` | med | Update to `koda_*` keys (migration `20260524000000_rename_tradr_kv_keys.sql` already ran). | S |
| `Trade.outcome` mixed casing | `EMPTY_TRADE` likely sets `""` but stats compare to `"Win"`/`"Loss"`/`"Breakeven"` (capitalised) while v2 `outcome: "win" | "loss" | "be"` — `appTradeToV2Payload` (Koda.tsx:676) translates "win"/"loss" lowercase even when source is capitalised, so the mapping at the boundary actually silently coerces capitalised values to `"be"` (line 676 checks `=== "win"`, falls through to `"be"`). | high | Make `appTradeToV2Payload` case-insensitive: `t.outcome?.toLowerCase()`. This is a **silent data-corruption bug** when v2 dual-write is on (which it is — flag default ON). | S |

---

## 4. Suggested Sequencing — 1-3 day chunks in dependency order

### Day 1 — Dead-code cleanup + documentation truth (low-risk)
- Delete `LEGACY_GLOBAL_CODE` (`Koda.tsx:49`).
- Delete dead `view === "import_legacy_unused"` route (`Koda.tsx:3819-3919`) and stub `view === "import"` redirect (line 3818) — replace any caller with `navigateTo("history")` + `setShowCsvImport(true)`.
- Remove stale `tsconfig.app.json` excludes for `TRADR (n).tsx`.
- Update `README.md` (Kōda, current architecture).
- Update CLAUDE.md "Key storage keys" table to `koda_*`.
- Update CLAUDE.md "What Kōda is" section to reflect `Koda.tsx` is 4492 lines, not "~4300".

### Day 2 — Fix the case-sensitivity bug + type the form
- Fix `appTradeToV2Payload` outcome case (`Koda.tsx:676`).
- Add `code?: string` to `Profile`; drop `(profile as any).code` casts (`Koda.tsx:1127`).
- Type all numeric form fields in legacy `Trade`: either accept `string | number` everywhere or normalise at boundary (recommend the latter — keep wire format strings, convert once in `useTradeStats`).
- Run `npx tsc --noEmit` to catch fallout; aim for zero new errors.

### Day 3 — Extract leaf components (no behaviour change)
- Move `StrategyEditor` → `src/components/StrategyEditor.tsx`.
- Move `ConfluenceTracker` → `src/components/ConfluenceTracker.tsx`.
- Move `FirstSessionSurvey` → `src/components/FirstSessionSurvey.tsx`.
- Move `TradovateLiveModal` (`Koda.tsx:3997-4132`) → `src/components/TradovateLiveModal.tsx`.
- Move `FeedbackModal` (`Koda.tsx:4150-4180`) → `src/components/FeedbackModal.tsx`.
- Move `ShareToCircleSheet` (`Koda.tsx:4234-4299`) → `src/components/ShareToCircleSheet.tsx`.
- Move splash screen jsx (`Koda.tsx:1486-1511`) → `src/components/LoadingSplash.tsx`.
- Move offline banner (`Koda.tsx:4226-4231`) → `src/components/OfflineBanner.tsx`.

### Day 4-5 — Extract big routes
- Carve out `<TradeDetailCard>` from history (`Koda.tsx:2895-3090`, ~200 lines).
- Create `src/screens/HistoryScreen.tsx` that owns filter state + grouped list and renders `<TradeDetailCard>` on expand. Replace history block in `Koda.tsx` with a one-line `<HistoryScreen … />`.
- Create `src/screens/StatsScreen.tsx` with per-tab subcomponents.

### Day 6 — Extract effects + helpers
- `useStripeReturn` (`Koda.tsx:391-421`)
- `useDeepLink` (`Koda.tsx:425-437`)
- `useDraftCount` (`Koda.tsx:460-478`)
- `src/lib/uploads.ts` (screenshot + avatar uploads)
- `src/lib/exports.ts` (CSV / JSON / PDF print HTML)

### Day 7 — Pre-launch polish
- Fix DataSourcesScreen "Coming Soon" placeholder cards (remove fake data; gate behind `liveBrokerSync` flag).
- Audit all `<button>` tap targets for 44px.
- Decide on `paywall` flag default-on stance for launch.
- Confirm CLAUDE.md backlog matches actual repo state (per `project_koda_backlog_drift.md` user memory).

### Day 8+ — Type-safety push
- Generate Supabase Database types: `supabase gen types typescript --project-id vifwjwsndchnrpvfgrmg > src/lib/database.types.ts`.
- Drop `: any` from `data/follows.ts`, `data/trades.ts`, `data/profile.ts`.
- Type all of `src/shared.tsx` component props.
- Type modal/component `C: any` props as `C: Theme`.

---

## 5. Questions for Dylon

1. **Beta paywall flag (`paywall` default-on)**: at public launch, do free users still hit the 20-trade cap and Pro feature gates? Or should `paywall` default off and ratchet on later?
2. **CLAUDE.md backlog drift** (already in your auto-memory): the keys table at lines 134-141 lists `tradr_*` keys but real keys are `koda_*`. Do you want me to (a) just update CLAUDE.md to match reality, or (b) keep CLAUDE.md as "what is, today" and add a separate "migration history" section?
3. **Live broker UI in `DataSourcesScreen`**: are the two fake "Last sync: 5m ago · syncing…" tiles intentional design marketing for landing-page screenshots, or leftover dev placeholder? If the latter — safe to delete?
4. **`view === "import"` redirect (`Koda.tsx:3818`)**: I see calls to `setView("import")` were already replaced by `navigateTo("history") + setShowCsvImport(true)` — do you want me to grep the codebase and confirm there are zero remaining callers before deleting?
5. **`appTradeToV2Payload` outcome case bug**: this only manifests when `newTrades` flag is on (which it is per `flags.ts:28`). Have you noticed any "everything is a breakeven" issues in `public.trades`? If yes — confirms the bug. If no — perhaps the legacy `Trade` already stores lowercased outcomes somewhere I missed; want me to add a one-shot dataset audit.
6. **Mobile cap = 480px or 720px?** The audit prompt said 480px but the code uses 720px on tablet and unbounded on phone/desktop/wide. Which is the design source of truth?
7. **`TradingCircles.tsx` prop count (29)**: are you comfortable introducing a `KodaContext` to remove the `C`, `profile`, `getMyCode`, `showToast`, `following`, `followUser`, `unfollowUser`, `openProfile` props, or do you prefer keeping props explicit for testability?
8. **`src/sw.ts` + workbox-* deps**: I did not inspect the service worker. Want me to include it in a follow-up audit pass?
9. **No automated tests for `Koda.tsx` paths** beyond `csvParser.test.ts`, `stats.test.ts`, and `ProGate.test.tsx`. Before any of the extractions above, do you want me to write a Playwright smoke flow first (sign in → log trade → view history → join circle) so refactors have a safety net? It's already in your backlog ("Add Playwright smoke test on every preview deploy").
10. **OneDrive write-corruption risk** (from CLAUDE.md history): are you OK with me refactoring `Koda.tsx` in many small atomic-write chunks over several PRs rather than one big extraction PR?
