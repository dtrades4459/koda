// src/components/PostSessionDebriefSheet.tsx
// ═══════════════════════════════════════════════════════════════════════════════
// Kōda · PostSessionDebriefSheet
//
// End-of-day reflection sheet. Bottom sheet on mobile, centred modal on desktop.
// One question (rules followed?) plus an optional one-line note. The act of
// answering is the point — the data is secondary.
// ═══════════════════════════════════════════════════════════════════════════════

import { useState } from "react";
import { MONO, BODY, DISPLAY } from "../shared";
import type { Theme } from "../theme";
import type { RulesFollowed } from "../hooks/useSessionDebrief";

export interface DebriefSummary {
  trades: number;
  wins: number;
  losses: number;
  pnlDisplay: string;
  pnlPositive: boolean;
}

export interface PostSessionDebriefSheetProps {
  open: boolean;
  C: Theme;
  isMobile: boolean;
  summary: DebriefSummary;
  onSave: (answer: { rulesFollowed: RulesFollowed; note?: string }) => void;
  onDismiss: () => void;
}

const ANSWERS: Array<{ id: RulesFollowed; label: string }> = [
  { id: "yes", label: "Yes" },
  { id: "mostly", label: "Mostly" },
  { id: "no", label: "No" },
];

export function PostSessionDebriefSheet({
  open,
  C,
  isMobile,
  summary,
  onSave,
  onDismiss,
}: PostSessionDebriefSheetProps) {
  const [rulesFollowed, setRulesFollowed] = useState<RulesFollowed | null>(null);
  const [note, setNote] = useState("");

  if (!open) return null;

  function handleSave() {
    if (!rulesFollowed) return;
    onSave({ rulesFollowed, note: note.trim() || undefined });
    setRulesFollowed(null);
    setNote("");
  }

  const content = (
    <>
      <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 8 }}>
        <span style={{
          width: 8, height: 8, borderRadius: "50%",
          background: C.accent ?? C.live,
          boxShadow: `0 0 10px ${C.accent ?? C.live}`,
        }} />
        <span style={{
          fontFamily: MONO, fontSize: "0.625rem", letterSpacing: "0.18em",
          textTransform: "uppercase", color: C.accent ?? C.live,
        }}>
          Wrap up
        </span>
      </div>
      <div style={{
        fontFamily: DISPLAY, fontSize: isMobile ? 18 : 22, fontWeight: 600,
        lineHeight: 1.2, letterSpacing: "-0.02em",
        margin: "4px 0 4px", color: C.text,
      }}>
        How did today go?
      </div>
      <div style={{ fontFamily: BODY, fontSize: "0.8125rem", color: C.text2, marginBottom: 14 }}>
        Sixty seconds of reflection beats none.
      </div>

      {/* Summary row */}
      <div style={{
        display: "flex", gap: 8, marginBottom: 16,
        padding: "12px 14px", borderRadius: 12,
        background: `color-mix(in srgb, ${C.text} 4%, transparent)`,
        border: `1px solid ${C.border}`,
      }}>
        <div style={{ flex: 1 }}>
          <div style={{ fontFamily: MONO, fontSize: "0.5625rem", letterSpacing: "0.14em", color: C.muted, marginBottom: 4 }}>TRADES</div>
          <div style={{ fontFamily: MONO, fontSize: 16, color: C.text, fontWeight: 600 }}>{summary.trades}</div>
        </div>
        <div style={{ flex: 1, borderLeft: `1px solid ${C.border}`, paddingLeft: 12 }}>
          <div style={{ fontFamily: MONO, fontSize: "0.5625rem", letterSpacing: "0.14em", color: C.muted, marginBottom: 4 }}>W / L</div>
          <div style={{ fontFamily: MONO, fontSize: 16, color: C.text, fontWeight: 600 }}>
            <span style={{ color: C.green }}>{summary.wins}</span>
            <span style={{ color: C.muted }}> / </span>
            <span style={{ color: C.red }}>{summary.losses}</span>
          </div>
        </div>
        <div style={{ flex: 1, borderLeft: `1px solid ${C.border}`, paddingLeft: 12 }}>
          <div style={{ fontFamily: MONO, fontSize: "0.5625rem", letterSpacing: "0.14em", color: C.muted, marginBottom: 4 }}>P&amp;L</div>
          <div style={{
            fontFamily: MONO, fontSize: 16, fontWeight: 600,
            color: summary.pnlPositive ? C.green : C.red,
          }}>{summary.pnlDisplay}</div>
        </div>
      </div>

      {/* Question */}
      <div style={{ fontFamily: BODY, fontSize: "0.8125rem", color: C.text, marginBottom: 10, fontWeight: 600 }}>
        Did you follow your rules today?
      </div>
      <div style={{ display: "flex", gap: 8, marginBottom: 14 }}>
        {ANSWERS.map(a => {
          const active = rulesFollowed === a.id;
          return (
            <button
              key={a.id}
              onClick={() => setRulesFollowed(a.id)}
              style={{
                flex: 1, padding: "10px 12px",
                borderRadius: 10,
                border: `1px solid ${active ? C.text : C.border2}`,
                background: active ? C.text : "transparent",
                color: active ? C.bg : C.text,
                fontFamily: BODY, fontSize: "0.8125rem", fontWeight: 600,
                cursor: "pointer", transition: "all 120ms ease",
              }}
            >
              {a.label}
            </button>
          );
        })}
      </div>

      {/* Optional note */}
      <textarea
        value={note}
        onChange={e => setNote(e.target.value)}
        placeholder="One thing to remember for tomorrow (optional)…"
        maxLength={200}
        rows={2}
        style={{
          width: "100%", boxSizing: "border-box",
          background: "transparent", color: C.text,
          border: `1px solid ${C.border2}`, borderRadius: 10,
          padding: "10px 12px", fontFamily: BODY, fontSize: "0.8125rem",
          resize: "none", outline: "none", marginBottom: 16,
        }}
      />

      <div style={{ display: "flex", gap: isMobile ? 0 : 10, flexDirection: isMobile ? "column" : "row" }}>
        <button
          onClick={handleSave}
          disabled={!rulesFollowed}
          style={{
            background: rulesFollowed ? C.text : C.panel,
            color: rulesFollowed ? C.bg : C.muted,
            border: rulesFollowed ? "none" : `1px solid ${C.border2}`,
            borderRadius: 999, padding: "12px 20px",
            fontWeight: 600, fontSize: "0.75rem", fontFamily: BODY,
            cursor: rulesFollowed ? "pointer" : "not-allowed",
            letterSpacing: "0.02em",
            flex: isMobile ? undefined : 1.5,
            width: isMobile ? "100%" : undefined,
            marginBottom: isMobile ? 8 : 0,
          }}
        >
          Save debrief
        </button>
        <button
          onClick={onDismiss}
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
          Skip for now
        </button>
      </div>
    </>
  );

  if (isMobile) {
    return (
      <div onClick={onDismiss} style={{
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
    <div onClick={onDismiss} style={{
      position: "fixed", inset: 0, zIndex: 1000,
      background: "rgba(0,0,0,0.62)",
      backdropFilter: "blur(2px)", WebkitBackdropFilter: "blur(2px)",
      display: "flex", alignItems: "center", justifyContent: "center",
    }}>
      <div onClick={e => e.stopPropagation()} style={{
        width: 420, background: C.panel,
        border: `1px solid ${C.border2}`, borderRadius: 18,
        padding: "24px 26px 22px",
        boxShadow: "0 30px 80px rgba(0,0,0,0.55)",
      }}>
        {content}
      </div>
    </div>
  );
}
