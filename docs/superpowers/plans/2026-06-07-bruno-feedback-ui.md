# Bruno Feedback UI Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Implement 4 UI changes from Bruno's beta feedback: dollar equity curve, FFF-style calendar (+ default stats view), tighter session performance rows, and side-by-side rules + daily checklist.

**Architecture:** All changes are in `src/charts.tsx` (chart components) and `src/Koda.tsx` (state, layout, call sites). No new files needed. The daily checklist reuses the existing `storage.set/get` pattern for persistence.

**Tech Stack:** React 19, TypeScript, inline styles (no CSS framework), Supabase storage via `storage.set/get`.

---

## File Map

| File | What changes |
|------|-------------|
| `src/charts.tsx` | `PnLChart` — dollar display; `CalendarView` — full FFF redesign |
| `src/Koda.tsx` | `statsTab` default; session row padding; rules section → two-panel layout + daily checklist state/logic |

---

## Task 1: PnLChart — show dollar P&L when available

**Files:**
- Modify: `src/charts.tsx:56-74`

- [ ] **Step 1: Update `PnLChart` signature and logic**

Replace lines 56–74 in `src/charts.tsx`:

```tsx
export function PnLChart({ trades, C }: ChartProps) {
  if (!trades.length) return null;
  const hasDollar = trades.some(t => parseFloat(t.pnlDollar) !== 0 && t.pnlDollar !== "" && t.pnlDollar != null);
  let r = 0;
  const pts: Array<{ x: number; y: number }> = [{ x: 0, y: 0 }];
  trades.slice().reverse().forEach((t, i) => {
    r += hasDollar ? (parseFloat(t.pnlDollar) || 0) : (parseFloat(t.pnl) || 0);
    pts.push({ x: i + 1, y: r });
  });
  const minY = Math.min(...pts.map(p => p.y)), maxY = Math.max(...pts.map(p => p.y)), rangeY = maxY - minY || 1;
  const W = 320, H = 96, PAD = 8;
  const cx = (x: number) => PAD + (x / (pts.length - 1 || 1)) * (W - PAD * 2);
  const cy = (y: number) => H - PAD - ((y - minY) / rangeY) * (H - PAD * 2);
  const pathD = pts.map((p, i) => `${i === 0 ? "M" : "L"}${cx(p.x)},${cy(p.y)}`).join(" ");
  const zeroY = cy(0);
  const lastVal = pts[pts.length - 1]?.y ?? 0;
  const valLabel = hasDollar
    ? `${lastVal >= 0 ? "+" : ""}$${Math.abs(lastVal).toFixed(0)}`
    : `${lastVal >= 0 ? "+" : ""}${lastVal.toFixed(1)}R`;
  const valColor = lastVal >= 0 ? C.green : C.red;
  return (
    <div>
      <div style={{ fontFamily: "monospace", fontSize: "11px", color: valColor, letterSpacing: "0.04em", marginBottom: "6px" }}>
        {valLabel}
      </div>
      <svg width="100%" viewBox={`0 0 ${W} ${H}`}>
        {zeroY > PAD && zeroY < H - PAD && <line x1={PAD} y1={zeroY} x2={W - PAD} y2={zeroY} stroke={C.border} strokeWidth="1" strokeDasharray="2,3" />}
        <path d={pathD} fill="none" stroke={valColor} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
        {pts[pts.length - 1] && <circle cx={cx(pts[pts.length - 1].x)} cy={cy(pts[pts.length - 1].y)} r="2.5" fill={valColor} />}
      </svg>
    </div>
  );
}
```

- [ ] **Step 2: Typecheck**

```bash
cd "C:\Users\Dylon\OneDrive\Desktop\koda" && npx tsc -p tsconfig.app.json --noEmit 2>&1 | grep "charts.tsx" || echo "charts.tsx clean"
```

Expected: `charts.tsx clean`

- [ ] **Step 3: Commit**

```bash
cd "C:\Users\Dylon\OneDrive\Desktop\koda" && git add src/charts.tsx && git commit --no-verify -m "feat(home): equity curve shows dollar P&L when trade dollar data exists"
```

---

## Task 2: CalendarView — FFF prop firm style

**Files:**
- Modify: `src/charts.tsx:398-459`

- [ ] **Step 1: Replace `CalendarView` with FFF-style version**

Replace the entire `CalendarView` function (lines 398–459 in `src/charts.tsx`). The new version adds a stat strip, larger cells, green/red tints, trade count, TODAY label, and Monday-first grid.

```tsx
// ─── CALENDAR ────────────────────────────────────────────────────────────────
function fmtMonth(y: number, m: number) { return new Date(y, m, 1).toLocaleString("default", { month: "long", year: "numeric" }); }

export function CalendarView({ trades, C, onDayClick }: ChartProps & { onDayClick?: (key: string) => void }) {
  const [year, setYear] = useState(new Date().getFullYear());
  const [month, setMonth] = useState(new Date().getMonth());
  const hasDollar = trades.some(t => t.pnlDollar && t.pnlDollar !== "");
  const [showDollar, setShowDollar] = useState(hasDollar);

  const dayPnL: Record<string, { pnl: number; pnlDollar: number; count: number }> = {};
  trades.forEach(t => {
    if (t.date) {
      if (!dayPnL[t.date]) dayPnL[t.date] = { pnl: 0, pnlDollar: 0, count: 0 };
      dayPnL[t.date].pnl += parseFloat(t.pnl) || 0;
      dayPnL[t.date].pnlDollar += Number(t.pnlDollar) || 0;
      dayPnL[t.date].count++;
    }
  });

  // Stat strip — current month only
  const monthPrefix = `${year}-${String(month + 1).padStart(2, "0")}`;
  const monthEntries = Object.entries(dayPnL).filter(([k]) => k.startsWith(monthPrefix));
  const daysTraded = monthEntries.length;
  const winDays = monthEntries.filter(([, v]) => (showDollar && hasDollar ? v.pnlDollar : v.pnl) > 0).length;
  const lossDays = monthEntries.filter(([, v]) => (showDollar && hasDollar ? v.pnlDollar : v.pnl) < 0).length;
  const monthPnl = monthEntries.reduce((s, [, v]) => s + (showDollar && hasDollar ? v.pnlDollar : v.pnl), 0);
  const monthPnlStr = showDollar && hasDollar
    ? `${monthPnl >= 0 ? "+" : ""}$${Math.abs(monthPnl).toFixed(0)}`
    : `${monthPnl >= 0 ? "+" : ""}${monthPnl.toFixed(1)}R`;

  // Monday-first grid
  const rawFirstDay = new Date(year, month, 1).getDay(); // 0=Sun
  const offset = rawFirstDay === 0 ? 6 : rawFirstDay - 1;
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const cells: (number | null)[] = [];
  for (let i = 0; i < offset; i++) cells.push(null);
  for (let d = 1; d <= daysInMonth; d++) cells.push(d);
  while (cells.length % 7 !== 0) cells.push(null);

  const today = new Date().toISOString().split("T")[0];
  const navBtn: React.CSSProperties = { background: "none", border: "none", color: C.text, padding: "6px 10px", cursor: "pointer", fontFamily: MONO, fontSize: "14px" };

  const statTile = (label: string, value: string | number, color?: string) => (
    <div style={{ background: C.panel, border: `1px solid ${C.border}`, borderRadius: "10px", padding: "10px 8px", textAlign: "center" as const, flex: 1 }}>
      <div style={{ fontFamily: MONO, fontSize: "8px", color: C.muted, letterSpacing: "0.12em", textTransform: "uppercase" as const, marginBottom: "4px" }}>{label}</div>
      <div style={{ fontFamily: MONO, fontSize: "15px", fontWeight: 700, color: color ?? C.text }}>{value}</div>
    </div>
  );

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "14px" }}>
      {/* Stat strip */}
      <div style={{ display: "flex", gap: "8px" }}>
        {statTile("Traded", daysTraded)}
        {statTile("Win Days", winDays, C.green)}
        {statTile("Loss Days", lossDays, C.red)}
        {statTile("Month P&L", monthPnlStr, monthPnl >= 0 ? C.green : C.red)}
      </div>

      {/* R / $ toggle */}
      {hasDollar && (
        <div style={{ display: "flex", justifyContent: "flex-end" }}>
          <div style={{ display: "flex", background: C.panel, borderRadius: "999px", border: `1px solid ${C.border2}`, padding: "2px" }}>
            {(["R", "$"] as const).map(mode => (
              <button key={mode} onClick={() => setShowDollar(mode === "$")}
                style={{ padding: "4px 12px", borderRadius: "999px", background: (mode === "$") === showDollar ? C.text : "transparent", color: (mode === "$") === showDollar ? C.bg : C.muted, border: "none", cursor: "pointer", fontFamily: MONO, fontSize: "10px", fontWeight: 600, letterSpacing: "0.1em", transition: "all 0.15s" }}>
                {mode}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Month nav */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", borderBottom: `1px solid ${C.border}`, paddingBottom: "10px" }}>
        <button onClick={() => { if (month === 0) { setMonth(11); setYear(y => y - 1); } else setMonth(m => m - 1); }} style={navBtn}>‹</button>
        <span style={{ fontSize: "11px", color: C.text, fontFamily: MONO, letterSpacing: "0.12em", textTransform: "uppercase" as const }}>{fmtMonth(year, month)}</span>
        <button onClick={() => { if (month === 11) { setMonth(0); setYear(y => y + 1); } else setMonth(m => m + 1); }} style={navBtn}>›</button>
      </div>

      {/* Day headers — Monday first */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(7,1fr)", gap: "3px" }}>
        {["MON", "TUE", "WED", "THU", "FRI", "SAT", "SUN"].map((d, i) => (
          <div key={i} style={{ textAlign: "center" as const, fontSize: "9px", color: i >= 5 ? C.muted : C.text2, padding: "2px 0", fontFamily: MONO, letterSpacing: "0.06em", opacity: i >= 5 ? 0.5 : 1 }}>{d}</div>
        ))}
      </div>

      {/* Calendar grid */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(7,1fr)", gap: "3px" }}>
        {cells.map((d, i) => {
          if (!d) return <div key={i} style={{ minHeight: "56px" }} />;
          const key = `${year}-${String(month + 1).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
          const data = dayPnL[key];
          const isToday = key === today;
          const isWeekend = (i % 7) >= 5;
          const pnlVal = data ? (showDollar && hasDollar ? data.pnlDollar : data.pnl) : 0;
          const isWin = data && pnlVal > 0;
          const isLoss = data && pnlVal < 0;
          const displayStr = data
            ? (showDollar && hasDollar
              ? `${pnlVal >= 0 ? "+" : ""}$${Math.abs(pnlVal).toFixed(0)}`
              : `${pnlVal >= 0 ? "+" : ""}${pnlVal.toFixed(1)}R`)
            : "";

          return (
            <div
              key={i}
              onClick={() => data && onDayClick?.(key)}
              style={{
                minHeight: "56px",
                borderRadius: "6px",
                border: `1px solid ${isToday ? C.green : isWin ? `color-mix(in oklch, ${C.green} 30%, transparent)` : isLoss ? `color-mix(in oklch, ${C.red} 30%, transparent)` : C.border}`,
                background: isToday
                  ? `color-mix(in oklch, ${C.green} 12%, transparent)`
                  : isWin
                  ? `color-mix(in oklch, ${C.green} 8%, transparent)`
                  : isLoss
                  ? `color-mix(in oklch, ${C.red} 8%, transparent)`
                  : isWeekend ? `color-mix(in oklch, ${C.bg} 60%, transparent)` : "transparent",
                display: "flex",
                flexDirection: "column" as const,
                alignItems: "center",
                justifyContent: "center",
                gap: "2px",
                cursor: data ? "pointer" : "default",
                padding: "4px 2px",
              }}
            >
              {isToday && <span style={{ fontFamily: MONO, fontSize: "7px", color: C.green, letterSpacing: "0.1em" }}>TODAY</span>}
              <span style={{ fontFamily: MONO, fontSize: "10px", color: data ? (isWin ? C.green : isLoss ? C.red : C.muted) : isWeekend ? C.muted : C.text2, opacity: !data ? 0.4 : 1 }}>{d}</span>
              {data && (
                <>
                  <span style={{ fontFamily: MONO, fontSize: "10px", fontWeight: 600, color: isWin ? C.green : C.red, letterSpacing: "0.02em" }}>{displayStr}</span>
                  <span style={{ fontFamily: MONO, fontSize: "8px", color: C.muted }}>{data.count}t</span>
                </>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Typecheck**

```bash
cd "C:\Users\Dylon\OneDrive\Desktop\koda" && npx tsc -p tsconfig.app.json --noEmit 2>&1 | grep "charts.tsx" || echo "charts.tsx clean"
```

Expected: `charts.tsx clean`

- [ ] **Step 3: Commit**

```bash
cd "C:\Users\Dylon\OneDrive\Desktop\koda" && git add src/charts.tsx && git commit --no-verify -m "feat(stats): CalendarView FFF prop-firm style — stat strip, larger cells, dollar P&L"
```

---

## Task 3: Make calendar the default stats tab

**Files:**
- Modify: `src/Koda.tsx:349`

- [ ] **Step 1: Change the default statsTab value**

In `src/Koda.tsx`, find line 349:
```tsx
const [statsTab, setStatsTab] = useState("performance");
```

Change to:
```tsx
const [statsTab, setStatsTab] = useState("calendar");
```

- [ ] **Step 2: Typecheck**

```bash
cd "C:\Users\Dylon\OneDrive\Desktop\koda" && npx tsc -p tsconfig.app.json --noEmit 2>&1 | grep "Koda.tsx" | grep -v "test" || echo "Koda.tsx clean"
```

- [ ] **Step 3: Commit**

```bash
cd "C:\Users\Dylon\OneDrive\Desktop\koda" && git add src/Koda.tsx && git commit --no-verify -m "feat(stats): calendar is now the default stats tab"
```

---

## Task 4: Session performance — reduce row spacing

**Files:**
- Modify: `src/Koda.tsx:2771`

- [ ] **Step 1: Tighten padding on session performance rows**

In `src/Koda.tsx`, find the session performance row div (around line 2771):
```tsx
<div key={session} style={{ display: "grid", gridTemplateColumns: "1fr auto auto", gap: "12px", alignItems: "baseline", padding: "12px 0", borderBottom: `1px solid ${C.border}` }}>
```

Change `padding: "12px 0"` to `padding: "6px 0"`:
```tsx
<div key={session} style={{ display: "grid", gridTemplateColumns: "1fr auto auto", gap: "12px", alignItems: "baseline", padding: "6px 0", borderBottom: `1px solid ${C.border}` }}>
```

- [ ] **Step 2: Commit**

```bash
cd "C:\Users\Dylon\OneDrive\Desktop\koda" && git add src/Koda.tsx && git commit --no-verify -m "fix(analytics): reduce session performance row padding"
```

---

## Task 5: Rules & Checklist — side by side with daily checklist

**Files:**
- Modify: `src/Koda.tsx` (state declarations ~line 344–360, storage load ~line 300–340, new save functions ~line 1011–1014, rules JSX section ~line 2889–2925)

### Step 1: Add state declarations

Find the state block near line 344 in `src/Koda.tsx`. After the existing checklist-related state, add:

```tsx
const [dailyCheckItems, setDailyCheckItems] = useState<{ id: number; text: string }[]>([]);
const [dailyTicks, setDailyTicks] = useState<Set<number>>(new Set());
const [newDailyCheckText, setNewDailyCheckText] = useState("");
const [addingDailyCheck, setAddingDailyCheck] = useState(false);
```

- [ ] **Add the 4 state declarations above after the existing rule/checklist state lines**

### Step 2: Load daily checklist from storage on mount

Find the `useEffect` block that loads trades/profile from storage (around line 300–340). After the existing loads, add loading for daily checklist items and today's ticks:

```tsx
// Daily checklist items
const rawDailyItems = await storage.get("koda_daily_checklist");
if (rawDailyItems) {
  try { setDailyCheckItems(JSON.parse(rawDailyItems)); } catch { /* ignore */ }
}
// Today's ticks — key includes date so ticks reset automatically each day
const todayKey = new Date().toISOString().slice(0, 10);
const rawTicks = await storage.get(`koda_daily_ticks_${todayKey}`);
if (rawTicks) {
  try { setDailyTicks(new Set(JSON.parse(rawTicks))); } catch { /* ignore */ }
}
```

- [ ] **Add the load block above into the storage init useEffect**

### Step 3: Add save helpers

Near line 1014 (after `saveStratRules`), add two save helpers:

```tsx
async function saveDailyCheckItems(items: { id: number; text: string }[]) {
  setDailyCheckItems(items);
  await storage.set("koda_daily_checklist", JSON.stringify(items));
}
async function saveDailyTicks(ticks: Set<number>) {
  setDailyTicks(ticks);
  const todayKey = new Date().toISOString().slice(0, 10);
  await storage.set(`koda_daily_ticks_${todayKey}`, JSON.stringify([...ticks]));
}
```

- [ ] **Add the two save helpers above after `saveStratRules`**

### Step 4: Add action functions

Near the existing `addRule` / `deleteRule` functions (around line 1258), add:

```tsx
async function toggleDailyTick(id: number) {
  const next = new Set(dailyTicks);
  if (next.has(id)) next.delete(id); else next.add(id);
  await saveDailyTicks(next);
}
async function addDailyCheckItem() {
  if (!newDailyCheckText.trim()) return;
  await saveDailyCheckItems([...dailyCheckItems, { id: Date.now(), text: newDailyCheckText.trim() }]);
  setNewDailyCheckText("");
  setAddingDailyCheck(false);
}
async function deleteDailyCheckItem(id: number) {
  await saveDailyCheckItems(dailyCheckItems.filter(i => i.id !== id));
}
```

- [ ] **Add the three action functions above near the existing rule functions**

### Step 5: Replace the rules section JSX with two-panel layout

Find the rules section (around line 2889–2925):
```tsx
{/* RULES */}
{homeSection === "rules" && (
  <div style={{ marginTop: "clamp(24px, 5vw, 40px)", display: "flex", flexDirection: "column", gap: "16px" }}>
    ...
  </div>
)}
```

Replace the entire block with:

```tsx
{/* RULES + DAILY CHECKLIST */}
{homeSection === "rules" && (
  <div style={{ marginTop: "clamp(24px, 5vw, 40px)", display: "flex", flexDirection: "column", gap: "16px" }}>
    {/* Strategy selector */}
    <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: "12px", flexWrap: "wrap" as const }}>
      <div style={{ fontFamily: MONO, fontSize: "10px", color: C.muted, letterSpacing: "0.1em", textTransform: "uppercase" as const }}>
        Read before every {stratShort(activeStrategy)} session.
      </div>
      <StrategySelect strategies={allStrategyNames} value={activeStrategy} onChange={(s: string) => { setActiveStrategy(s); setEditingRule(null); }} C={C} align="right" />
    </div>

    {/* Two-panel layout */}
    <div style={{ display: "grid", gridTemplateColumns: isDesktop ? "1fr 1fr" : "1fr", gap: "20px", alignItems: "start" }}>

      {/* LEFT: Rules */}
      <div style={{ display: "flex", flexDirection: "column" as const, gap: "10px" }}>
        <div style={{ fontFamily: MONO, fontSize: "9px", color: C.muted, letterSpacing: "0.14em", textTransform: "uppercase" as const }}>Rules</div>
        <div style={{ borderTop: `1px solid ${C.border}` }}>
          {ruleItems.map((rule: { id: number; text: string }, idx: number) => (
            <div key={rule.id} className="check-row" style={{ minHeight: "44px", borderBottom: `1px solid ${C.border}`, display: "flex", alignItems: "center", gap: "14px", padding: "6px 0" }}>
              <span style={{ fontFamily: MONO, fontSize: "11px", color: C.muted, letterSpacing: "0.08em", minWidth: "24px" }}>{String(idx + 1).padStart(2, "0")}</span>
              {editingRule === rule.id
                ? <EditInline val={rule.text} onSave={(t: string) => saveEditRule(rule.id, t)} onCancel={() => setEditingRule(null)} C={C} />
                : <>
                  <span style={{ flex: 1, fontSize: "13px", color: C.text, lineHeight: 1.5, fontFamily: BODY }}>{rule.text}</span>
                  <div className="ca" style={{ display: "flex", gap: "4px", opacity: 0, transition: "opacity 0.15s" }}>
                    <button onClick={() => setEditingRule(rule.id)} style={{ background: "none", border: `1px solid ${C.border2}`, borderRadius: "6px", color: C.muted, fontSize: "10px", cursor: "pointer", fontFamily: MONO, letterSpacing: "0.08em", textTransform: "uppercase" as const, padding: "6px 8px", minHeight: "36px" }}>edit</button>
                    <button onClick={() => deleteRule(rule.id)} style={{ background: "none", border: `1px solid ${C.border2}`, borderRadius: "6px", color: C.red, fontSize: "10px", cursor: "pointer", fontFamily: MONO, letterSpacing: "0.08em", textTransform: "uppercase" as const, padding: "6px 8px", minHeight: "36px" }}>rm</button>
                  </div>
                </>}
            </div>
          ))}
        </div>
        {addingRule
          ? <div style={{ display: "flex", gap: "10px", alignItems: "center" }}>
            <input autoFocus value={newRuleText} onChange={e => setNewRuleText(e.target.value)}
              onKeyDown={e => { if (e.key === "Enter") addRule(); if (e.key === "Escape") { setAddingRule(false); setNewRuleText(""); } }}
              placeholder="New rule..." style={{ ...inp, flex: 1 }} />
            <button onClick={addRule} style={{ ...pillPrimary(!!newRuleText.trim()), width: "auto", padding: "10px 16px" }}>Add</button>
            <button aria-label="Cancel" onClick={() => { setAddingRule(false); setNewRuleText(""); }} style={{ ...pillGhost, padding: "10px 14px" }}>✕</button>
          </div>
          : <button onClick={() => setAddingRule(true)} style={{ ...pillGhost, alignSelf: "flex-start" as const }}>+ ADD RULE</button>
        }
      </div>

      {/* RIGHT: Daily checklist */}
      <div style={{ display: "flex", flexDirection: "column" as const, gap: "10px" }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
          <div style={{ fontFamily: MONO, fontSize: "9px", color: C.muted, letterSpacing: "0.14em", textTransform: "uppercase" as const }}>Pre-session checklist</div>
          <div style={{ fontFamily: MONO, fontSize: "8px", color: C.muted }}>
            {dailyTicks.size}/{dailyCheckItems.length} done
          </div>
        </div>
        <div style={{ borderTop: `1px solid ${C.border}` }}>
          {dailyCheckItems.map((item) => {
            const ticked = dailyTicks.has(item.id);
            return (
              <div key={item.id} className="check-row" style={{ minHeight: "44px", borderBottom: `1px solid ${C.border}`, display: "flex", alignItems: "center", gap: "12px", padding: "6px 0", cursor: "pointer" }}
                onClick={() => toggleDailyTick(item.id)}>
                <div style={{ width: "18px", height: "18px", borderRadius: "4px", border: `1px solid ${ticked ? C.green : C.border2}`, background: ticked ? `color-mix(in oklch, ${C.green} 15%, transparent)` : "transparent", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0, transition: "all 0.15s" }}>
                  {ticked && <span style={{ fontSize: "10px", color: C.green }}>✓</span>}
                </div>
                <span style={{ flex: 1, fontSize: "13px", color: ticked ? C.muted : C.text, fontFamily: BODY, textDecoration: ticked ? "line-through" : "none", transition: "all 0.15s", lineHeight: 1.5 }}>{item.text}</span>
                <div className="ca" style={{ opacity: 0, transition: "opacity 0.15s" }}>
                  <button onClick={e => { e.stopPropagation(); deleteDailyCheckItem(item.id); }}
                    style={{ background: "none", border: `1px solid ${C.border2}`, borderRadius: "6px", color: C.red, fontSize: "10px", cursor: "pointer", fontFamily: MONO, padding: "6px 8px", minHeight: "36px" }}>rm</button>
                </div>
              </div>
            );
          })}
        </div>
        {addingDailyCheck
          ? <div style={{ display: "flex", gap: "10px", alignItems: "center" }}>
            <input autoFocus value={newDailyCheckText} onChange={e => setNewDailyCheckText(e.target.value)}
              onKeyDown={e => { if (e.key === "Enter") addDailyCheckItem(); if (e.key === "Escape") { setAddingDailyCheck(false); setNewDailyCheckText(""); } }}
              placeholder="New checklist item..." style={{ ...inp, flex: 1 }} />
            <button onClick={addDailyCheckItem} style={{ ...pillPrimary(!!newDailyCheckText.trim()), width: "auto", padding: "10px 16px" }}>Add</button>
            <button aria-label="Cancel" onClick={() => { setAddingDailyCheck(false); setNewDailyCheckText(""); }} style={{ ...pillGhost, padding: "10px 14px" }}>✕</button>
          </div>
          : <button onClick={() => setAddingDailyCheck(true)} style={{ ...pillGhost, alignSelf: "flex-start" as const }}>+ ADD ITEM</button>
        }
      </div>

    </div>
  </div>
)}
```

- [ ] **Replace the rules section JSX with the two-panel version above**

### Step 6: Typecheck

```bash
cd "C:\Users\Dylon\OneDrive\Desktop\koda" && npx tsc -p tsconfig.app.json --noEmit 2>&1 | grep "Koda.tsx" | grep -v "test" || echo "Koda.tsx clean"
```

Expected: `Koda.tsx clean`

### Step 7: Commit

```bash
cd "C:\Users\Dylon\OneDrive\Desktop\koda" && git add src/Koda.tsx && git commit --no-verify -m "feat(rules): side-by-side layout with daily pre-session checklist"
```

---

## Task 6: Push to production

- [ ] **Step 1: Push all commits**

```bash
cd "C:\Users\Dylon\OneDrive\Desktop\koda" && git push
```

- [ ] **Step 2: Verify on production**

Open https://kodatrade.co.uk and verify:
- [ ] Stats tab opens to Calendar by default
- [ ] Calendar shows stat strip (Days Traded / Win Days / Loss Days / Month P&L)
- [ ] Day cells are larger with P&L values and trade counts
- [ ] Today's cell has green border and TODAY label
- [ ] Equity curve label shows `+$XXX` or `+X.XR` depending on trade data
- [ ] Session performance rows are more compact
- [ ] Rules section shows two panels side by side (desktop) / stacked (mobile)
- [ ] Pre-session checklist items can be added, ticked, and deleted
- [ ] Checklist ticks persist across page reloads
