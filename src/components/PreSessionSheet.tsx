// src/components/PreSessionSheet.tsx
// ═══════════════════════════════════════════════════════════════════════════════
// Kōda · PreSessionSheet
//
// Presentational. Bottom sheet on mobile, centred modal on desktop.
// Shown on the first Log Trade tap of the day when the user has daily limits
// configured. Confirms the limits before the trading session begins.
// ═══════════════════════════════════════════════════════════════════════════════

import { MONO, BODY, DISPLAY } from "../shared";
import type { Theme } from "../theme";

export interface PreSessionSheetProps {
  open: boolean;
  C: Theme;
  isMobile: boolean;
  maxDailyLoss?: number | null;
  maxTradesPerDay?: number | null;
  onStart: () => void;
  onCancel: () => void;
}

function fmtDollar(n: number): string {
  return `$${n.toLocaleString(undefined, { maximumFractionDigits: 2 })}`;
}

export function PreSessionSheet({
  open,
  C,
  isMobile,
  maxDailyLoss,
  maxTradesPerDay,
  onStart,
  onCancel,
}: PreSessionSheetProps) {
  if (!open) return null;

  const rows: Array<{ label: string; value: string }> = [];
  if (Number.isFinite(maxDailyLoss) && maxDailyLoss && maxDailyLoss > 0) {
    rows.push({ label: "Daily loss limit", value: fmtDollar(maxDailyLoss) });
  }
  if (Number.isFinite(maxTradesPerDay) && maxTradesPerDay && maxTradesPerDay > 0) {
    rows.push({ label: "Max trades today", value: String(maxTradesPerDay) });
  }

  const today = new Date().toLocaleDateString(undefined, {
    weekday: "long",
    month: "short",
    day: "numeric",
  });

  const content = (
    <>
      <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 8 }}>
        <span style={{
          width: 8, height: 8, borderRadius: "50%",
          background: C.live, boxShadow: `0 0 10px ${C.live}`,
        }} />
        <span style={{
          fontFamily: MONO, fontSize: "0.625rem", letterSpacing: "0.18em",
          textTransform: "uppercase", color: C.live,
        }}>
          Pre-session check
        </span>
      </div>
      <div style={{
        fontFamily: DISPLAY, fontSize: isMobile ? 18 : 22, fontWeight: 600,
        lineHeight: 1.2, letterSpacing: "-0.02em",
        margin: "4px 0 4px", color: C.text,
      }}>
        Ready to trade?
      </div>
      <div style={{ fontFamily: BODY, fontSize: "0.8125rem", color: C.text2, marginBottom: 14 }}>
        {today} — your limits for today:
      </div>
      <div style={{ borderTop: `1px solid ${C.border}`, paddingTop: 6, marginBottom: 16 }}>
        {rows.map(r => (
          <div key={r.label} style={{
            display: "flex", justifyContent: "space-between", alignItems: "center",
            padding: "10px 0", borderBottom: `1px solid ${C.border}`,
          }}>
            <span style={{ fontFamily: BODY, fontSize: "0.8125rem", color: C.text2 }}>{r.label}</span>
            <span style={{ fontFamily: MONO, fontSize: "0.8125rem", color: C.text, fontWeight: 600 }}>
              {r.value}
            </span>
          </div>
        ))}
      </div>
      <div style={{ display: "flex", gap: isMobile ? 0 : 10, flexDirection: isMobile ? "column" : "row" }}>
        <button
          onClick={onStart}
          style={{
            background: C.live, color: "#0A0A0E", border: "none",
            borderRadius: 999, padding: "12px 20px",
            fontWeight: 600, fontSize: "0.75rem", fontFamily: BODY,
            cursor: "pointer", letterSpacing: "0.02em",
            flex: isMobile ? undefined : 1.5,
            width: isMobile ? "100%" : undefined,
            marginBottom: isMobile ? 8 : 0,
          }}
        >
          Start session
        </button>
        <button
          onClick={onCancel}
          style={{
            background: "transparent", color: C.text2,
            border: `1px solid ${C.border2}`, borderRadius: 999,
            padding: "12px 20px",
            fontSize: "0.6875rem", fontFamily: MONO,
            cursor: "pointer", letterSpacing: "0.06em", textTransform: "uppercase",
            flex: isMobile ? undefined : 1,
            width: isMobile ? "100%" : undefined,
          }}
        >
          Not yet
        </button>
      </div>
    </>
  );

  if (isMobile) {
    return (
      <div onClick={onCancel} style={{
        position: "fixed", inset: 0, zIndex: 1000,
        background: "rgba(0,0,0,0.45)",
        display: "flex", alignItems: "flex-end", justifyContent: "center",
      }}>
        <div onClick={e => e.stopPropagation()} style={{
          background: C.panel, width: "100%", maxWidth: 480,
          borderTopLeftRadius: 24, borderTopRightRadius: 24,
          padding: "16px 18px 22px", borderTop: `1px solid ${C.border}`,
        }}>
          <div style={{
            width: 36, height: 4, background: C.border2,
            borderRadius: 999, margin: "0 auto 14px",
          }} />
          {content}
        </div>
      </div>
    );
  }

  return (
    <div onClick={onCancel} style={{
      position: "fixed", inset: 0, zIndex: 1000,
      background: "rgba(0,0,0,0.62)",
      backdropFilter: "blur(2px)", WebkitBackdropFilter: "blur(2px)",
      display: "flex", alignItems: "center", justifyContent: "center",
    }}>
      <div onClick={e => e.stopPropagation()} style={{
        width: 400, background: C.panel,
        border: `1px solid ${C.border2}`, borderRadius: 18,
        padding: "24px 26px 22px",
        boxShadow: "0 30px 80px rgba(0,0,0,0.55)",
      }}>
        {content}
      </div>
    </div>
  );
}
