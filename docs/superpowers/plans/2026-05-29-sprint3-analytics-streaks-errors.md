# Sprint 3 — Analytics Tab, Streak Milestones, Circles Error Feedback

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Ship three independent improvements: error toasts in Circles, streak milestone banners, and a wired P&L-by-Setup Analytics tab.

**Architecture:** All changes are confined to three existing files — `src/hooks/useCircles.ts`, `src/TradingCircles.tsx`, and `src/Koda.tsx`. The Analytics section at `Koda.tsx:2303` already exists but is unreachable — we add it to `HOME_SECTIONS` and prepend a P&L by Setup section. No new files created.

**Tech Stack:** React 19, TypeScript, Vite, Supabase KV (`window.storage`), IBM Plex Mono/Sans, OKLCH theme tokens from `src/theme.ts`.

---

## File Map

| File | Change |
|------|--------|
| `src/hooks/useCircles.ts` | Add `showToast` error call in `createCircle` catch; add toast to `joinCircle` catch |
| `src/TradingCircles.tsx` | Add `showToast` call in `sendChatMessage` catch |
| `src/Koda.tsx` | Add `streakBanner` state + milestone check in `saveTrade`; add banner render in Overview; add "Analytics" to `HOME_SECTIONS`; add `setupPeriod`/`setupMetric`/`setupDollar` state; add P&L by Setup section inside existing analytics block |

---

## Task 1: TradingCircles Error Feedback

**Files:**
- Modify: `src/hooks/useCircles.ts` (createCircle ~line 316, joinCircle ~line 380)
- Modify: `src/TradingCircles.tsx` (sendChatMessage ~line 214)

- [ ] **Step 1: Fix `createCircle` — add catch with toast**

In `src/hooks/useCircles.ts`, the `createCircle` function has `try { ... } finally { ... }` with no `catch`. Errors propagate silently. Replace the `finally` block structure to include a `catch`:

Find this block (~line 316):
```ts
    setIsCreatingCircle(true);
    try {
      const code =
```

The try block ends at `showToast("Circle created");` and is followed by `} finally { setIsCreatingCircle(false); }`.

Change the end of the try/finally to:
```ts
      showToast("Circle created");
    } catch {
      showToast("Failed to create circle — try again");
    } finally {
      setIsCreatingCircle(false);
    }
```

- [ ] **Step 2: Fix `joinCircle` — add toast alongside existing circleMsg**

In `src/hooks/useCircles.ts`, the `joinCircle` catch (~line 380) only sets `circleMsg`. Add a `showToast` call:

Find:
```ts
    } catch {
      setCircleMsg("Error joining. Try again.");
      setTimeout(() => setCircleMsg(""), 2500);
    } finally {
```

Replace with:
```ts
    } catch {
      setCircleMsg("Error joining. Try again.");
      setTimeout(() => setCircleMsg(""), 2500);
      showToast("Failed to join circle — check the code and try again");
    } finally {
```

- [ ] **Step 3: Fix `sendChatMessage` — add toast in catch**

In `src/TradingCircles.tsx`, `sendChatMessage` (~line 214) catches errors and restores the input but gives no user feedback. Find:

```ts
    } catch { setChatInput(text); }
```

Replace with:
```ts
    } catch { setChatInput(text); showToast("Message failed to send — try again"); }
```

Note: `showToast` is available in `TradingCircles` because it's destructured from props at line 11.

- [ ] **Step 4: Build and verify no TypeScript errors**

```bash
cd "C:\Users\Dylon\OneDrive\Desktop\tradr-fresh" && npm run build
```

Expected: `✓ built in ~Xs` with no errors.

- [ ] **Step 5: Commit**

```bash
cd "C:\Users\Dylon\OneDrive\Desktop\tradr-fresh"
git add src/hooks/useCircles.ts src/TradingCircles.tsx
git commit -m "fix: add error toasts to circles create/join/chat operations"
```

---

## Task 2: Streak Milestone Banner

**Files:**
- Modify: `src/Koda.tsx`
  - Add state (~line 258 near other celebration state)
  - Add milestone check (~line 913 in saveTrade)
  - Add banner render (~line 1635 in homeSection === "feed" block)

- [ ] **Step 1: Add `STREAK_MILESTONES` constant and `streakBanner` state**

In `src/Koda.tsx`, find the celebration state at ~line 258:
```ts
  const [celebration, setCelebration] = useState<{ kind: "trade" | "streak" | "pro" | "loss" | "streak-loss"; streakCount?: number; tradeStats?: { winRate: number; avgR: number; streak: number } } | null>(null);
```

Add immediately after it:
```ts
  const STREAK_MILESTONES = [3, 7, 14, 30, 100];
  const STREAK_FLAVOUR: Record<number, string> = {
    3: "Three days of discipline.",
    7: "One week of consistent execution.",
    14: "Two weeks in. The habit is forming.",
    30: "A full month. This is who you are now.",
    100: "One hundred days. Exceptional.",
  };
  const [streakBanner, setStreakBanner] = useState<{ streakCount: number } | null>(null);
```

- [ ] **Step 2: Add milestone check in `saveTrade`**

In `src/Koda.tsx`, find the TODO comment at ~line 913:
```ts
      // TODO: streak celebration — fire when streakCount hits 3/7/14/30/100 milestone (needs user_kv dedup)
      setCelebration({ kind: "trade", tradeStats: { winRate: wrSaved, avgR: avgRSaved, streak: calcStreak(u).count } });
```

Replace with:
```ts
      const newStreak = calcStreak(u).count;
      // Check for milestone (3/7/14/30/100) — deduplicated via user_kv
      const hitMilestone = STREAK_MILESTONES.find(m => m === newStreak);
      if (hitMilestone) {
        const raw = await (window as any).storage.get("koda_streak_milestones");
        const shown: number[] = raw ? JSON.parse(raw) : [];
        if (!shown.includes(hitMilestone)) {
          await (window as any).storage.set("koda_streak_milestones", JSON.stringify([...shown, hitMilestone]));
          setStreakBanner({ streakCount: hitMilestone });
        }
      }
      setCelebration({ kind: "trade", tradeStats: { winRate: wrSaved, avgR: avgRSaved, streak: newStreak } });
```

- [ ] **Step 3: Render the streak banner in the Overview tab**

In `src/Koda.tsx`, find the start of the `homeSection === "feed"` block (~line 1635):
```ts
              {homeSection === "feed" && (
                <div>
                  {/* Glass hero card */}
```

Add the banner immediately after the opening `<div>`, before the `{/* Glass hero card */}` comment:
```tsx
                  {streakBanner && (
                    <div style={{ display: "flex", alignItems: "center", gap: "12px", background: C.panel, border: `1px solid ${C.green}44`, borderLeft: `3px solid ${C.green}`, borderRadius: "12px", padding: "12px 14px", marginBottom: "20px" }}>
                      <span style={{ fontSize: "20px" }}>🔥</span>
                      <div style={{ flex: 1 }}>
                        <div style={{ fontFamily: MONO, fontSize: "9px", color: C.green, letterSpacing: "0.14em", textTransform: "uppercase" as const, marginBottom: "2px" }}>{streakBanner.streakCount}-Day Streak Milestone</div>
                        <div style={{ fontFamily: BODY, fontSize: "13px", color: C.text }}>{STREAK_FLAVOUR[streakBanner.streakCount] ?? "Keep going."}</div>
                      </div>
                      <button onClick={() => setStreakBanner(null)} style={{ background: "none", border: "none", color: C.muted, cursor: "pointer", fontSize: "16px", padding: "4px", lineHeight: 1 }}>×</button>
                    </div>
                  )}
```

- [ ] **Step 4: Build and verify**

```bash
cd "C:\Users\Dylon\OneDrive\Desktop\tradr-fresh" && npm run build
```

Expected: `✓ built in ~Xs` with no TypeScript errors.

- [ ] **Step 5: Commit**

```bash
cd "C:\Users\Dylon\OneDrive\Desktop\tradr-fresh"
git add src/Koda.tsx
git commit -m "feat: streak milestone banner at 3/7/14/30/100 days with user_kv dedup"
```

---

## Task 3: Analytics Tab — Wire to Nav + Add P&L by Setup

**Files:**
- Modify: `src/Koda.tsx`
  - Add 3 state vars for controls (~line 291 near other analytics state)
  - Add "Analytics" to `HOME_SECTIONS` (~line 1351)
  - Add P&L by Setup section to existing analytics block (~line 2305)

- [ ] **Step 1: Add analytics control state**

In `src/Koda.tsx`, find (~line 291):
```ts
  const [statsTab, setStatsTab] = useState("overview");
```

Add immediately after:
```ts
  const [setupPeriod, setSetupPeriod] = useState<"month" | "all">("month");
  const [setupMetric, setSetupMetric] = useState<"pnl" | "winrate" | "trades">("pnl");
  const [setupDollar, setSetupDollar] = useState(false);
```

- [ ] **Step 2: Add "Analytics" to HOME_SECTIONS**

In `src/Koda.tsx`, find `HOME_SECTIONS` (~line 1351):
```ts
  const HOME_SECTIONS = [
    { id: "feed", label: "Overview" },
    { id: "circles", label: "Circles" },
    { id: "ai", label: "Execution" },
    { id: "rules", label: "Rules" },
```

Replace with:
```ts
  const HOME_SECTIONS = [
    { id: "feed", label: "Overview" },
    { id: "circles", label: "Circles" },
    { id: "ai", label: "Execution" },
    { id: "analytics", label: "Analytics" },
    { id: "rules", label: "Rules" },
```

- [ ] **Step 3: Add P&L by Setup section inside the existing analytics block**

In `src/Koda.tsx`, find the start of the analytics block (~line 2303):
```tsx
              {homeSection === "analytics" && (
                <div style={{ display: "flex", flexDirection: "column", gap: "clamp(40px, 6vw, 56px)", marginTop: "clamp(24px, 5vw, 40px)" }}>
                  <section>
                    <SectionKicker label="WIN RATE BY STRATEGY" C={C} />
```

Insert a new `<section>` block at the top of that `<div>`, before the existing `<section>` for "WIN RATE BY STRATEGY":

```tsx
              {homeSection === "analytics" && (
                <div style={{ display: "flex", flexDirection: "column", gap: "clamp(40px, 6vw, 56px)", marginTop: "clamp(24px, 5vw, 40px)" }}>
                  {/* P&L BY SETUP */}
                  <section>
                    <SectionKicker label="P&L BY SETUP" C={C} />
                    {(() => {
                      const now = new Date();
                      const filtered = setupPeriod === "month"
                        ? trades.filter((t: Trade) => { const d = new Date(t.date + "T12:00:00"); return d.getFullYear() === now.getFullYear() && d.getMonth() === now.getMonth(); })
                        : trades;
                      const stats: Record<string, { pnl: number; dollar: number; wins: number; total: number }> = {};
                      filtered.forEach((t: Trade) => {
                        if (!t.strategy) return;
                        if (!stats[t.strategy]) stats[t.strategy] = { pnl: 0, dollar: 0, wins: 0, total: 0 };
                        stats[t.strategy].pnl += parseFloat(t.pnl) || 0;
                        stats[t.strategy].dollar += parseFloat(t.pnlDollar) || 0;
                        stats[t.strategy].wins += t.outcome === "Win" ? 1 : 0;
                        stats[t.strategy].total++;
                      });
                      const rows = Object.entries(stats).map(([name, s]) => ({
                        name,
                        pnl: s.pnl,
                        dollar: s.dollar,
                        winRate: s.total > 0 ? (s.wins / s.total) * 100 : 0,
                        trades: s.total,
                      })).sort((a, b) => {
                        if (setupMetric === "pnl") return (setupDollar ? b.dollar : b.pnl) - (setupDollar ? a.dollar : a.pnl);
                        if (setupMetric === "winrate") return b.winRate - a.winRate;
                        return b.trades - a.trades;
                      });
                      const maxAbs = Math.max(...rows.map(r => {
                        if (setupMetric === "pnl") return Math.abs(setupDollar ? r.dollar : r.pnl);
                        if (setupMetric === "winrate") return r.winRate;
                        return r.trades;
                      }), 1);
                      return (
                        <div style={{ marginTop: "16px" }}>
                          {/* Controls */}
                          <div style={{ display: "flex", gap: "8px", flexWrap: "wrap" as const, marginBottom: "20px" }}>
                            {/* Period toggle */}
                            {(["month", "all"] as const).map(p => (
                              <button key={p} onClick={() => setSetupPeriod(p)} style={{ fontFamily: MONO, fontSize: "10px", letterSpacing: "0.08em", padding: "5px 12px", borderRadius: "999px", border: `1px solid ${setupPeriod === p ? C.text : C.border}`, background: setupPeriod === p ? C.text : "transparent", color: setupPeriod === p ? C.bg : C.muted, cursor: "pointer" }}>
                                {p === "month" ? "THIS MONTH" : "ALL TIME"}
                              </button>
                            ))}
                            <div style={{ width: "1px", background: C.border, margin: "0 2px" }} />
                            {/* Metric toggle */}
                            {(["pnl", "winrate", "trades"] as const).map(m => (
                              <button key={m} onClick={() => setSetupMetric(m)} style={{ fontFamily: MONO, fontSize: "10px", letterSpacing: "0.08em", padding: "5px 12px", borderRadius: "999px", border: `1px solid ${setupMetric === m ? C.text : C.border}`, background: setupMetric === m ? C.text : "transparent", color: setupMetric === m ? C.bg : C.muted, cursor: "pointer" }}>
                                {m === "pnl" ? "P&L" : m === "winrate" ? "WIN RATE" : "TRADES"}
                              </button>
                            ))}
                            {/* R/$ toggle — only when metric = P&L and dollar data exists */}
                            {setupMetric === "pnl" && hasDollarData && (
                              <>
                                <div style={{ width: "1px", background: C.border, margin: "0 2px" }} />
                                {(["R", "$"] as const).map(unit => (
                                  <button key={unit} onClick={() => setSetupDollar(unit === "$")} style={{ fontFamily: MONO, fontSize: "10px", letterSpacing: "0.08em", padding: "5px 12px", borderRadius: "999px", border: `1px solid ${(unit === "$") === setupDollar ? C.text : C.border}`, background: (unit === "$") === setupDollar ? C.text : "transparent", color: (unit === "$") === setupDollar ? C.bg : C.muted, cursor: "pointer" }}>
                                    {unit}
                                  </button>
                                ))}
                              </>
                            )}
                          </div>
                          {/* Bar chart */}
                          {rows.length === 0
                            ? <div style={{ fontFamily: BODY, fontSize: "13px", color: C.muted }}>No trades with a strategy tagged in this period.</div>
                            : <div style={{ display: "flex", flexDirection: "column" as const, gap: "14px" }}>
                                {rows.map(r => {
                                  const val = setupMetric === "pnl" ? (setupDollar ? r.dollar : r.pnl) : setupMetric === "winrate" ? r.winRate : r.trades;
                                  const isPos = setupMetric !== "pnl" || val >= 0;
                                  const barPct = (Math.abs(val) / maxAbs) * 100;
                                  const label = setupMetric === "pnl"
                                    ? (setupDollar ? `${val >= 0 ? "+" : ""}$${Math.abs(val).toFixed(0)}` : `${val >= 0 ? "+" : ""}${val.toFixed(1)}R`)
                                    : setupMetric === "winrate" ? `${val.toFixed(0)}%`
                                    : `${val}`;
                                  return (
                                    <div key={r.name}>
                                      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", marginBottom: "5px" }}>
                                        <span style={{ fontFamily: BODY, fontSize: "13px", color: C.text }}>{r.name}</span>
                                        <span style={{ fontFamily: MONO, fontSize: "11px", color: isPos ? C.green : C.red, letterSpacing: "0.04em" }}>{label}</span>
                                      </div>
                                      <div style={{ background: C.panel2, borderRadius: "3px", height: "6px" }}>
                                        <div style={{ width: `${barPct}%`, height: "100%", borderRadius: "3px", background: isPos ? C.green : C.red, transition: "width 0.3s ease" }} />
                                      </div>
                                    </div>
                                  );
                                })}
                              </div>
                          }
                        </div>
                      );
                    })()}
                  </section>
                  <section>
                    <SectionKicker label="WIN RATE BY STRATEGY" C={C} />
```

- [ ] **Step 4: Build and verify**

```bash
cd "C:\Users\Dylon\OneDrive\Desktop\tradr-fresh" && npm run build
```

Expected: `✓ built in ~Xs` with no TypeScript errors.

- [ ] **Step 5: Smoke test in browser**

```bash
cd "C:\Users\Dylon\OneDrive\Desktop\tradr-fresh" && npm run dev
```

Open `http://localhost:5173`, navigate to Home → "Analytics" tab (should now appear in sub-nav). Verify:
- P&L by Setup section renders at top with controls
- Period toggle switches between This Month / All Time
- Metric toggle switches P&L / Win Rate / Trades — bars update
- R/$ toggle appears only if dollar data exists on trades
- Empty state shows "No trades with a strategy tagged" when no tagged trades in period

- [ ] **Step 6: Commit**

```bash
cd "C:\Users\Dylon\OneDrive\Desktop\tradr-fresh"
git add src/Koda.tsx
git commit -m "feat: wire Analytics tab to home nav; add P&L by Setup ranked bar chart"
```

---

## Notes

- `C.panel2` — used for bar track background. The theme has `panel` and `panel2` (confirmed in CLAUDE.md architecture notes).
- `hasDollarData` — already computed in `Koda.tsx:1278` and in scope inside the `homeSection === "analytics"` render block.
- `STREAK_MILESTONES` and `STREAK_FLAVOUR` are defined as plain object/array inside the component — not hooks, so placement inside the component body is fine.
- `window.storage.get` returns the raw stored string or null — always parse with `JSON.parse(raw ?? "[]")`.
- All three tasks are independent — if Task 3 fails TypeScript, Tasks 1 and 2 can still be committed and deployed.
