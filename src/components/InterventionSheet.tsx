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
}

export function InterventionSheet({ open, signals, C, isMobile, onContinue, onCancel }: InterventionSheetProps) {
  if (!open) return null;

  const content = (
    <>
      <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 8 }}>
        <span style={{
          width: 8, height: 8, borderRadius: "50%",
          background: C.live, boxShadow: `0 0 10px ${C.live}`,
        }} />
        <span style={{
          fontFamily: MONO, fontSize: 10, letterSpacing: "0.18em",
          textTransform: "uppercase", color: C.live,
        }}>
          Heads up
        </span>
      </div>
      <div style={{
        fontFamily: BODY, fontSize: isMobile ? 14 : 17, fontWeight: 600,
        lineHeight: 1.3, letterSpacing: "-0.01em",
        margin: "4px 0 14px", color: C.text,
      }}>
        {signals.length} tilt signal{signals.length === 1 ? "" : "s"} {signals.length === 1 ? "is" : "are"} active.
      </div>
      <div style={{ borderTop: `1px solid ${C.border}`, paddingTop: 8, marginBottom: 16 }}>
        {signals.map(sig => (
          <div key={sig.id} style={{
            display: "flex", alignItems: "center", gap: 8,
            fontSize: 12, padding: "6px 0", color: C.text,
          }}>
            <span style={{
              width: 6, height: 6, borderRadius: "50%",
              background: C.red, flexShrink: 0,
            }} />
            <span>{sig.label}</span>
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
          Cancel · take a break
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
