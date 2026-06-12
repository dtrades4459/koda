// src/components/InterventionGate.tsx
// ═══════════════════════════════════════════════════════════════════════════════
// Kōda · InterventionGate
//
// Wraps the Log Trade trigger. Three render branches:
//   1. locked       — render cooldown pill instead of the child
//   2. tilt active  — render child with click intercepted by the sheet
//   3. otherwise    — render child as-is
// ═══════════════════════════════════════════════════════════════════════════════

import React, { useEffect, useState } from "react";
import { MONO } from "../shared";
import type { Theme } from "../theme";
import type { TiltState } from "../lib/tilt";
import { InterventionSheet } from "./InterventionSheet";
import type { InterventionSettings } from "../hooks/useTiltState";

export interface InterventionGateProps {
  state: TiltState;
  lockedUntil: number | null;
  settings: InterventionSettings;
  isMobile: boolean;
  C: Theme;
  children: React.ReactNode;
  onContinue: () => void;
  onCancel: () => void;
}

function formatCountdown(msRemaining: number): string {
  const total = Math.max(0, Math.ceil(msRemaining / 1000));
  const m = Math.floor(total / 60);
  const s = total % 60;
  return `${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
}

export function InterventionGate({
  state, lockedUntil, settings, isMobile, C, children, onContinue, onCancel,
}: InterventionGateProps) {
  const [now, setNow] = useState(Date.now());
  const [open, setOpen] = useState(false);

  // Re-render once a second while locked so the countdown ticks
  useEffect(() => {
    if (lockedUntil === null) return;
    const id = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(id);
  }, [lockedUntil]);

  // ── Branch 1: locked ──────────────────────────────────────────────────
  if (lockedUntil !== null && lockedUntil > now) {
    return (
      <div style={{
        display: "inline-flex", alignItems: "center", gap: 8,
        border: `1px solid ${C.live}`,
        borderRadius: 999, padding: "8px 14px",
        background: "transparent",
        color: C.live, fontFamily: MONO, fontSize: "0.6875rem",
        letterSpacing: "0.08em", textTransform: "uppercase",
        boxShadow: `0 0 12px ${C.live}33`,
      }}>
        <span style={{ width: 6, height: 6, borderRadius: "50%", background: C.live }} />
        Cooling off · {formatCountdown(lockedUntil - now)}
      </div>
    );
  }

  // ── Branch 2/3: tap intercept or passthrough ──────────────────────────
  const handleTap: React.MouseEventHandler = e => {
    if (!settings.enabled || !state.active) {
      onContinue();
      return;
    }
    e.preventDefault();
    e.stopPropagation();
    setOpen(true);
  };

  return (
    <>
      <span onClickCapture={handleTap}>{children}</span>
      <InterventionSheet
        open={open}
        signals={state.signals}
        C={C}
        isMobile={isMobile}
        onContinue={() => { setOpen(false); onContinue(); }}
        onCancel={()  => { setOpen(false); onCancel();  }}
      />
    </>
  );
}
