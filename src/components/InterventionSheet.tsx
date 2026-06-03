// src/components/InterventionSheet.tsx
// ═══════════════════════════════════════════════════════════════════════════════
// Kōda · InterventionSheet
//
// Presentational. Bottom sheet on mobile, centred modal on desktop.
// All state + DB writes are owned by the caller (InterventionGate).
// ═══════════════════════════════════════════════════════════════════════════════

import { MONO, BODY } from "../shared";
import type { Theme } from "../theme";
import type { TiltSignal } from "../lib/tilt";

export interface InterventionSheetProps {
  open: boolean;
  signals: TiltSignal[];
  C: Theme;
  isMobile: boolean;
  onContinue: () => void;
  onCancel: () => void;
  cooldownMin?: number;
}

export function InterventionSheet({ open, signals, C, isMobile, onContinue, onCancel, cooldownMin }: InterventionSheetProps) {
  if (!open) return null;

  const criticalSignals = signals.filter(s => s.critical);
  const tiltSignals = signals.filter(s => !s.critical);
  const ordered = [...criticalSignals, ...tiltSignals];
  const hasCritical = criticalSignals.length > 0;

  const headline = (() => {
    if (criticalSignals.length > 0 && tiltSignals.length === 0) {
      return `${criticalSignals.length} critical tilt signal${criticalSignals.length === 1 ? "" : "s"} ${criticalSignals.length === 1 ? "is" : "are"} active.`;
    }
    if (criticalSignals.length > 0 && tiltSignals.length > 0) {
      return `${criticalSignals.length} critical · ${tiltSignals.length} tilt signal${signals.length === 1 ? "" : "s"} active.`;
    }
    return `${signals.length} tilt signal${signals.length === 1 ? "" : "s"} ${signals.length === 1 ? "is" : "are"} active.`;
  })();

  const cancelLabel = cooldownMin && cooldownMin > 0
    ? `Cancel · ${cooldownMin}-min break`
    : "Cancel · take a break";

  const content = (
    <>
      <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 8 }}>
        <span style={{
          width: 8, height: 8, borderRadius: "50%",
          background: hasCritical ? C.red : C.live,
          boxShadow: `0 0 10px ${hasCritical ? C.red : C.live}`,
        }} />
        <span style={{
          fontFamily: MONO, fontSize: 10, letterSpacing: "0.18em",
          textTransform: "uppercase", color: hasCritical ? C.red : C.live,
        }}>
          {hasCritical ? "Heads up — critical" : "Heads up"}
        </span>
      </div>
      <div style={{
        fontFamily: BODY, fontSize: isMobile ? 14 : 17, fontWeight: 600,
        lineHeight: 1.3, letterSpacing: "-0.01em",
        margin: "4px 0 14px", color: C.text,
      }}>
        {headline}
      </div>
      <div style={{ borderTop: `1px solid ${C.border}`, paddingTop: 8, marginBottom: 16 }}>
        {ordered.map(sig => (
          <div key={sig.id} style={{
            display: "flex", alignItems: "center", gap: 8,
            fontSize: 12, padding: "6px 0", color: C.text,
          }}>
            <span style={{
              width: 6, height: 6, borderRadius: "50%",
              background: sig.critical ? C.red : C.live,
              flexShrink: 0,
            }} />
            <span style={{ flex: 1 }}>{sig.label}</span>
            {sig.critical && (
              <span style={{
                fontFamily: MONO, fontSize: 9, letterSpacing: "0.12em",
                textTransform: "uppercase", color: C.red,
                border: `1px solid ${C.red}55`,
                background: `${C.red}10`,
                padding: "2px 6px", borderRadius: 999,
                flexShrink: 0,
              }}>
                critical
              </span>
            )}
          </div>
        ))}
      </div>
      <div style={{ display: "flex", gap: isMobile ? 0 : 10, flexDirection: isMobile ? "column" : "row" }}>
        <button
          onClick={onContinue}
          style={{
            background: C.live, color: "#0A0A0E", border: "none",
            borderRadius: 999, padding: "12px 20px",
            fontWeight: 600, fontSize: 12, fontFamily: BODY,
            cursor: "pointer", letterSpacing: "0.02em",
            flex: isMobile ? undefined : 1.5,
            width: isMobile ? "100%" : undefined,
            marginBottom: isMobile ? 8 : 0,
          }}
        >
          I'm aware — continue
        </button>
        <button
          onClick={onCancel}
          style={{
            background: "transparent", color: C.text2,
            border: `1px solid ${C.border2}`, borderRadius: 999,
            padding: "12px 20px",
            fontSize: 11, fontFamily: MONO,
            cursor: "pointer", letterSpacing: "0.06em", textTransform: "uppercase",
            flex: isMobile ? undefined : 1,
            width: isMobile ? "100%" : undefined,
          }}
        >
          {cancelLabel}
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
        width: 380, background: C.panel,
        border: `1px solid ${C.border2}`, borderRadius: 18,
        padding: "24px 26px 22px",
        boxShadow: "0 30px 80px rgba(0,0,0,0.55)",
      }}>
        {content}
      </div>
    </div>
  );
}
