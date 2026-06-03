// src/components/LiveRuleMonitor.tsx
// ═══════════════════════════════════════════════════════════════════════════════
// Kōda · LiveRuleMonitor
//
// Live status card shown on Home while a trading session is in progress
// (pre-session check started, at least one trade logged today, debrief not yet
// saved). Renders the user's current P&L vs daily loss limit and trade count
// vs daily cap with traffic-light colouring.
// ═══════════════════════════════════════════════════════════════════════════════

import { MONO, BODY } from "../shared";
import type { Theme } from "../theme";

export interface LiveRuleMonitorProps {
  C: Theme;
  /** Today's net P&L. R-multiples if useDollar is false, dollars otherwise. */
  pnl: number;
  /** Daily loss limit in the same units as pnl. 0 = no limit configured. */
  maxLoss: number;
  /** Today's trade count. */
  trades: number;
  /** Max trades per day. 0 = no cap. */
  maxTrades: number;
  /** True if pnl/maxLoss are dollars; false if R-multiples. */
  useDollar: boolean;
  /** Label for the most recent rule break today, if any. */
  lastBreak?: string | null;
  /** Tap handler to open the debrief sheet manually. */
  onWrapUp?: () => void;
}

function pctOfLimit(pnl: number, limit: number): number {
  if (limit <= 0 || pnl >= 0) return 0;
  return Math.min(100, Math.round((Math.abs(pnl) / limit) * 100));
}

function severity(pct: number): "ok" | "warn" | "alert" {
  if (pct >= 90) return "alert";
  if (pct >= 75) return "warn";
  return "ok";
}

export function LiveRuleMonitor({
  C,
  pnl,
  maxLoss,
  trades,
  maxTrades,
  useDollar,
  lastBreak,
  onWrapUp,
}: LiveRuleMonitorProps) {
  const lossPct = pctOfLimit(pnl, maxLoss);
  const lossSev = severity(lossPct);
  const lossColor = lossSev === "alert" ? C.red : lossSev === "warn" ? (C.warn ?? C.red) : C.text;

  const tradeColor = maxTrades > 0 && trades >= maxTrades
    ? C.red
    : maxTrades > 0 && trades >= maxTrades - 1
      ? (C.warn ?? C.red)
      : C.text;

  const pnlSign = pnl >= 0 ? "+" : "−";
  const pnlAbs = Math.abs(pnl);
  const pnlText = useDollar
    ? `${pnlSign}$${pnlAbs.toFixed(2)}`
    : `${pnl >= 0 ? "+" : ""}${pnl.toFixed(2)}R`;
  const limitText = maxLoss > 0
    ? (useDollar ? ` / −$${maxLoss.toFixed(0)}` : ` / −${maxLoss.toFixed(0)}R`)
    : "";
  const tradeText = maxTrades > 0 ? `${trades} / ${maxTrades}` : String(trades);

  return (
    <div
      data-testid="live-rule-monitor"
      style={{
        background: C.panel,
        border: `1px solid ${C.live}33`,
        borderLeft: `3px solid ${C.live}`,
        borderRadius: "12px",
        padding: "12px 14px",
        marginBottom: "20px",
      }}
    >
      <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 10 }}>
        <span style={{
          width: 8, height: 8, borderRadius: "50%",
          background: C.live, boxShadow: `0 0 10px ${C.live}`,
          animation: "kPulse 1.6s ease-in-out infinite",
        }} />
        <span style={{
          fontFamily: MONO, fontSize: 9, letterSpacing: "0.18em",
          textTransform: "uppercase", color: C.live, fontWeight: 700,
        }}>
          Session live
        </span>
        {onWrapUp && (
          <button
            onClick={onWrapUp}
            style={{
              marginLeft: "auto",
              background: "transparent", color: C.muted,
              border: `1px solid ${C.border2}`, borderRadius: 999,
              padding: "4px 10px",
              fontFamily: MONO, fontSize: 9, letterSpacing: "0.12em",
              textTransform: "uppercase", cursor: "pointer",
            }}>
            Wrap up
          </button>
        )}
      </div>

      <div style={{ display: "flex", gap: 8 }}>
        <div style={{ flex: 1 }}>
          <div style={{ fontFamily: MONO, fontSize: 9, letterSpacing: "0.14em", color: C.muted, marginBottom: 4 }}>P&amp;L</div>
          <div style={{ fontFamily: MONO, fontSize: 14, color: lossColor, fontWeight: 600 }}>
            {pnlText}
            <span style={{ color: C.muted, fontWeight: 400 }}>{limitText}</span>
          </div>
        </div>
        <div style={{ flex: 1, borderLeft: `1px solid ${C.border}`, paddingLeft: 12 }}>
          <div style={{ fontFamily: MONO, fontSize: 9, letterSpacing: "0.14em", color: C.muted, marginBottom: 4 }}>Trades</div>
          <div style={{ fontFamily: MONO, fontSize: 14, color: tradeColor, fontWeight: 600 }}>
            {tradeText}
          </div>
        </div>
        {lastBreak && (
          <div style={{ flex: 1, borderLeft: `1px solid ${C.border}`, paddingLeft: 12 }}>
            <div style={{ fontFamily: MONO, fontSize: 9, letterSpacing: "0.14em", color: C.muted, marginBottom: 4 }}>Last break</div>
            <div style={{ fontFamily: BODY, fontSize: 12, color: C.red, fontWeight: 600 }}>
              {lastBreak}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
