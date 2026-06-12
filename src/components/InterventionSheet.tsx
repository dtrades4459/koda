// src/components/InterventionSheet.tsx
// ═══════════════════════════════════════════════════════════════════════════════
// Kōda · InterventionSheet — WEDGE SCREEN
//
// This is the one screen that makes Kōda different from every other trading
// journal. It fires mid-tilt and asks "are you sure?" before a bad trade.
// Visual: glass surface, conic corner glow, editorial display kicker + headline,
// signal pills with critical badges, two ranked CTAs. Mobile = bottom sheet,
// desktop = centred modal.
//
// Presentational only. All state + DB writes are owned by the caller
// (InterventionGate). Props are unchanged from the previous version.
// ═══════════════════════════════════════════════════════════════════════════════

import { MONO, BODY, DISPLAY } from "../shared";
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

export function InterventionSheet({
  open, signals, C, isMobile, onContinue, onCancel, cooldownMin,
}: InterventionSheetProps) {
  if (!open) return null;

  const criticalSignals = signals.filter(s => s.critical);
  const tiltSignals = signals.filter(s => !s.critical);
  const ordered = [...criticalSignals, ...tiltSignals];
  const hasCritical = criticalSignals.length > 0;

  // ── Headline copy (editorial, situation-driven) ──────────────────────────
  const { kicker, title, titleAccent, sub } = (() => {
    if (hasCritical) {
      return {
        kicker: "Heads up · critical",
        title: "Pause.",
        titleAccent: undefined,
        sub: criticalSignals.length === 1
          ? "One critical tilt signal is active. The data says you do worse from here."
          : `${criticalSignals.length} critical signals are active. The data says you do worse from here.`,
      };
    }
    if (tiltSignals.length >= 3) {
      return {
        kicker: "Heads up · tilt",
        title: "Take a",
        titleAccent: "breath.",
        sub: `${tiltSignals.length} tilt signals are stacking. Reset before the next entry.`,
      };
    }
    return {
      kicker: "Heads up · tilt",
      title: "Are you",
      titleAccent: "sure?",
      sub: `${signals.length} tilt signal${signals.length === 1 ? "" : "s"} active. One pause has saved more accounts than any strategy has built.`,
    };
  })();

  const cancelLabel = cooldownMin && cooldownMin > 0
    ? `Cancel · ${cooldownMin}-min break`
    : "Cancel · take a break";

  const accentColor = hasCritical ? C.red : C.live;
  const accentSoft = hasCritical ? C.redSoft : C.liveSoft;

  // ── Inner content (shared between mobile + desktop wrappers) ─────────────
  const content = (
    <>
      {/* Conic corner glow — keyed to severity */}
      <div
        aria-hidden
        style={{
          position: "absolute",
          top: -70, right: -60, width: 240, height: 240,
          borderRadius: "50%", pointerEvents: "none",
          background: hasCritical
            ? `conic-gradient(from 200deg at 50% 50%, ${C.red}, ${C.warn}, ${C.orb2}, ${C.red})`
            : `conic-gradient(from 200deg at 50% 50%, ${C.orb3}, ${C.accent}, ${C.live}, ${C.orb3})`,
          filter: "blur(46px)",
          opacity: hasCritical ? 0.55 : 0.4,
          animation: hasCritical ? "kPulse 2.4s ease-in-out infinite" : undefined,
        }}
      />

      <div style={{ position: "relative", zIndex: 1 }}>
        {/* Kicker — mono small-caps, accent tint */}
        <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 12 }}>
          <span
            style={{
              width: 8, height: 8, borderRadius: "50%",
              background: accentColor,
              boxShadow: `0 0 10px ${accentColor}, 0 0 0 4px color-mix(in oklch, ${accentColor} 18%, transparent)`,
              animation: hasCritical ? "kPulse 1.6s ease-in-out infinite" : undefined,
              flexShrink: 0,
            }}
          />
          <span
            style={{
              fontFamily: MONO, fontSize: "0.625rem", letterSpacing: "0.18em",
              textTransform: "uppercase", color: accentColor, fontWeight: 500,
            }}
          >
            {kicker}
          </span>
        </div>

        {/* Editorial display headline */}
        <div
          style={{
            fontFamily: DISPLAY,
            fontSize: isMobile ? 30 : 36,
            fontWeight: 600,
            letterSpacing: "-0.03em",
            lineHeight: 1.05,
            color: C.text,
            marginBottom: 12,
          }}
        >
          {title}
          {titleAccent && (
            <>
              {" "}
              <span style={{ fontStyle: "italic", fontWeight: 500, color: accentColor }}>
                {titleAccent}
              </span>
            </>
          )}
        </div>

        {/* Sub-line — explains the why */}
        <div
          style={{
            fontFamily: BODY,
            fontSize: "0.84375rem",
            color: C.text2,
            lineHeight: 1.55,
            marginBottom: 22,
            maxWidth: "44ch",
          }}
        >
          {sub}
        </div>

        {/* Signal list */}
        <div
          style={{
            background: C.surfaceHi,
            border: `1px solid ${C.line}`,
            borderRadius: 14,
            padding: "4px 14px",
            marginBottom: 20,
          }}
        >
          {ordered.map((sig, i) => (
            <div
              key={sig.id}
              style={{
                display: "flex", alignItems: "center", gap: 10,
                padding: "11px 0",
                borderTop: i ? `1px solid ${C.line}` : "none",
              }}
            >
              <span
                style={{
                  width: 6, height: 6, borderRadius: "50%",
                  background: sig.critical ? C.red : C.live,
                  flexShrink: 0,
                  boxShadow: sig.critical ? `0 0 6px ${C.red}` : undefined,
                }}
              />
              <span
                style={{
                  flex: 1,
                  fontFamily: BODY,
                  fontSize: "0.8125rem",
                  color: C.text,
                  lineHeight: 1.35,
                }}
              >
                {sig.label}
              </span>
              {sig.critical && (
                <span
                  style={{
                    fontFamily: MONO,
                    fontSize: "0.5625rem",
                    letterSpacing: "0.14em",
                    textTransform: "uppercase",
                    color: C.red,
                    background: C.redSoft,
                    border: `1px solid color-mix(in oklch, ${C.red} 35%, transparent)`,
                    padding: "3px 7px",
                    borderRadius: 999,
                    flexShrink: 0,
                    fontWeight: 600,
                  }}
                >
                  critical
                </span>
              )}
            </div>
          ))}
        </div>

        {/* Actions — ranked: cancel (the better choice) above continue (the override) */}
        <div
          style={{
            display: "flex",
            gap: isMobile ? 10 : 10,
            flexDirection: isMobile ? "column-reverse" : "row-reverse",
          }}
        >
          <button
            onClick={onContinue}
            style={{
              background: "transparent",
              color: C.text2,
              border: `1px solid ${C.border2}`,
              borderRadius: 999,
              padding: "13px 22px",
              fontFamily: BODY,
              fontSize: "0.8125rem",
              fontWeight: 500,
              cursor: "pointer",
              letterSpacing: "0.01em",
              flex: isMobile ? undefined : 1,
              width: isMobile ? "100%" : undefined,
              boxSizing: "border-box",
            }}
          >
            I'm aware — continue
          </button>
          <button
            onClick={onCancel}
            autoFocus
            style={{
              background: accentColor,
              color: "#0A0A0B",
              border: "none",
              borderRadius: 999,
              padding: "13px 22px",
              fontFamily: BODY,
              fontSize: "0.875rem",
              fontWeight: 600,
              cursor: "pointer",
              letterSpacing: "0.01em",
              flex: isMobile ? undefined : 1.4,
              width: isMobile ? "100%" : undefined,
              boxShadow: `0 0 0 4px color-mix(in oklch, ${accentColor} 18%, transparent)`,
              boxSizing: "border-box",
            }}
          >
            {cancelLabel}
          </button>
        </div>

        {/* Soft accent strip — small kicker subliminally re-asserts the wedge */}
        <div
          style={{
            marginTop: 16,
            padding: "10px 14px",
            borderRadius: 10,
            background: accentSoft,
            border: `1px solid color-mix(in oklch, ${accentColor} 22%, transparent)`,
            fontFamily: MONO,
            fontSize: "0.625rem",
            letterSpacing: "0.1em",
            color: accentColor,
            textTransform: "uppercase",
            textAlign: "center",
          }}
        >
          Kōda · in-session intervention
        </div>
      </div>
    </>
  );

  // ─── Mobile: bottom sheet ────────────────────────────────────────────────
  if (isMobile) {
    return (
      <div
        role="dialog"
        aria-modal="true"
        aria-label="In-session intervention"
        onClick={onCancel}
        style={{
          position: "fixed", inset: 0, zIndex: 9500,
          background: "rgba(10,10,11,0.72)",
          backdropFilter: "blur(8px)",
          WebkitBackdropFilter: "blur(8px)",
          display: "flex", alignItems: "flex-end", justifyContent: "center",
          animation: "kFadeIn 0.22s ease-out",
        }}
      >
        <div
          onClick={e => e.stopPropagation()}
          style={{
            background: C.surfaceGlass,
            backdropFilter: "blur(28px) saturate(180%)",
            WebkitBackdropFilter: "blur(28px) saturate(180%)",
            width: "100%",
            maxWidth: 480,
            borderTopLeftRadius: 28,
            borderTopRightRadius: 28,
            padding: "12px 22px calc(28px + env(safe-area-inset-bottom))",
            borderTop: `1px solid ${C.border2}`,
            position: "relative",
            overflow: "hidden",
            animation: "kSlideIn 0.38s cubic-bezier(.2,.8,.2,1)",
            boxShadow: "0 -30px 60px rgba(0,0,0,0.5)",
          }}
        >
          <div
            style={{
              width: 38, height: 4, background: C.line3,
              borderRadius: 999, margin: "0 auto 18px",
            }}
          />
          {content}
        </div>
      </div>
    );
  }

  // ─── Desktop: centred modal ──────────────────────────────────────────────
  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="In-session intervention"
      onClick={onCancel}
      style={{
        position: "fixed", inset: 0, zIndex: 9500,
        background: "rgba(10,10,11,0.72)",
        backdropFilter: "blur(8px)",
        WebkitBackdropFilter: "blur(8px)",
        display: "flex", alignItems: "center", justifyContent: "center",
        padding: 22,
        animation: "kFadeIn 0.22s ease-out",
      }}
    >
      <div
        onClick={e => e.stopPropagation()}
        style={{
          width: "100%",
          maxWidth: 460,
          background: C.surfaceGlass,
          backdropFilter: "blur(28px) saturate(180%)",
          WebkitBackdropFilter: "blur(28px) saturate(180%)",
          border: `1px solid ${C.border2}`,
          borderRadius: 24,
          padding: "30px 30px 28px",
          boxShadow: "0 30px 80px rgba(0,0,0,0.6), inset 0 1px 0 rgba(255,255,255,0.06)",
          position: "relative",
          overflow: "hidden",
          animation: "kRise 0.38s cubic-bezier(.2,.8,.2,1)",
        }}
      >
        {content}
      </div>
    </div>
  );
}
