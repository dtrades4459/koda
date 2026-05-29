# Sprint 3 Design — Analytics Tab, Streak Milestones, Circles Error Feedback

**Date:** 2026-05-29  
**Status:** Approved  
**Scope:** Three independent features shipped as a focused batch.

---

## 1. Analytics Tab — P&L by Setup

### Placement
New "Analytics" tab added to the home sub-nav in `Koda.tsx`, between "Execution" and "Rules".

### New file
`src/AnalyticsTab.tsx` — extracted component following the same pattern as `DataSourcesScreen.tsx`, `LogTradeScreen.tsx`, etc.

### Props
```ts
interface AnalyticsTabProps {
  trades: Trade[];
  C: typeof DARK;
  STRATEGY_NAMES: string[];
  hasDollarData: boolean;
}
```

### Layout (top to bottom)
1. **Period picker** — pill toggle: "This month" | "All time". Default: this month.
2. **Metric picker** — segmented control: "P&L" | "Win Rate" | "Trades". Default: P&L.
3. **R/$ toggle** — visible only when metric = P&L and `hasDollarData` is true. Matches CalendarView toggle pattern.
4. **Ranked bar chart** — one row per strategy with ≥1 trade in the selected period:
   - Bar width = value as % of the maximum value in the set
   - Green bar if positive P&L / win rate ≥ 50%; red otherwise
   - Strategy name on the left, formatted value on the right
   - Sorted descending by selected metric
5. **Empty state** — "No trades with a strategy tagged in this period." shown when no data.

### Stat computations
All derived client-side from the `trades` prop — no new API calls or DB queries.

```
Group trades by trade.strategy (exclude null/blank/"")
Per group:
  totalR       = sum of parseFloat(trade.pnl)
  totalDollar  = sum of trade.pnlDollar (if hasDollarData)
  wins         = count where trade.outcome === "win"
  total        = count
  winRate      = (wins / total) * 100
Sort by selected metric descending
```

### Period filter logic
- "This month" = trades where `localDateStr(trade.date)` falls within the current calendar month
- "All time" = all trades (no filter)

### What could break
- `trade.strategy` may be undefined/null on old trades — guard with `if (!t.strategy) continue`
- Dollar P&L requires `hasDollarData` flag — hide R/$ toggle if false
- Empty strategy list renders empty state, not a crash

---

## 2. Streak Milestone Banner

### Trigger
After any trade is logged, the existing streak calculation in `Koda.tsx` runs. If the resulting streak count equals a milestone value **and** that milestone has not been shown before, set `streakBanner`.

**Milestone values:** 3, 7, 14, 30, 100

### Deduplication
- Storage key: `koda_streak_milestones` in `user_kv`
- Value: array of milestone numbers already shown, e.g. `[3, 7]`
- Before firing: load this array, check if current milestone is included
- After firing: append milestone to array and save back

### State
```ts
// Added to Koda.tsx state
const [streakBanner, setStreakBanner] = useState<{ streakCount: number } | null>(null);
```

### Banner UI
Rendered at the top of the home overview, above the main stats grid. Dismissible.

```
🔥  [X]-Day Streak Milestone        ×
    [flavour text]
```

Flavour text per milestone:
- 3 → "Three days of discipline."
- 7 → "One week of consistent execution."
- 14 → "Two weeks in. The habit is forming."
- 30 → "A full month. This is who you are now."
- 100 → "One hundred days. Exceptional."

Dismissing calls `setStreakBanner(null)`. No re-save needed — dedup already written to KV when banner was shown.

### Styling
Matches existing card style: `background: C.panel`, `border: 1px solid C.border`, `borderRadius: 12px`. Green left border (`3px solid C.green`). Uses `MONO` font for milestone label, `BODY` for flavour text.

### What could break
- KV load is async — banner must not flash before load completes. Guard: only fire after `loadAll()` resolves.
- Streak resets: only fire if streak >= milestone, not on exact match only (edge case: streak goes 6→7 in one trade — fires correctly).

---

## 3. TradingCircles Error Feedback

### Problem
Three operations in `TradingCircles.tsx` fail silently — the user sees nothing if the network call errors.

### Operations to fix
| Operation | Current | Fix |
|-----------|---------|-----|
| Create circle | `async` call, no catch UI | Wrap in try/catch, call `showToast("Failed to create circle — try again")` |
| Join circle | `async` call, no catch UI | Wrap in try/catch, call `showToast("Failed to join circle — check the code and try again")` |
| Send chat message | `async` call, no catch UI | Wrap in try/catch, call `showToast("Message failed to send — try again")` |

### Approach
- `showToast` is already passed as a prop to `TradingCircles`
- Wrap the existing `async` logic in each handler with `try { ... } catch { showToast(...) }`
- No structural changes — purely defensive wrapping

### What could break
- None — additive change only. Existing success path unchanged.

---

## Implementation order
1. **TradingCircles error feedback** — smallest, independent, fixes a live UX gap (~10 lines)
2. **Streak milestone banner** — self-contained in `Koda.tsx`, no new files
3. **Analytics tab** — largest, new file, new sub-nav entry

---

## Out of scope for this sprint
- MAE/MFE analytics (Analytics tab v2)
- Commission/fee tracking
- Drill-down to individual trades per setup
- Custom date range picker
