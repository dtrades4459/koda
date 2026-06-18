// src/components/SessionCard.tsx
// ═══════════════════════════════════════════════════════════════════════════════
// Kōda · SessionCard — Home entry point for the live Trading Session
//
// Idle: a single Start button. Armed: a live W/L tally + tap buttons + status
// chip. Auto-opens the existing InterventionSheet on the tilt rising edge; Start
// uses PreSessionSheet, End uses PostSessionDebriefSheet. All state lives in
// useTradingSession; this file is presentation + local input state only.
//
// Spec: docs/superpowers/specs/2026-06-16-pre-trade-intervention-design.md
// ═══════════════════════════════════════════════════════════════════════════════

import { useEffect, useState } from "react";
import { MONO, BODY } from "../shared";
import type { Theme } from "../theme";
import type { Profile } from "../types";
import { useTradingSession } from "../hooks/useTradingSession";
import { InterventionSheet } from "./InterventionSheet";
import { PreSessionSheet } from "./PreSessionSheet";
import { PostSessionDebriefSheet } from "./PostSessionDebriefSheet";

export interface SessionCardProps {
  profile: Profile;
  C: Theme;
  isMobile: boolean;
  onToast?: (msg: string) => void;
}

function formatCountdown(msRemaining: number): string {
  const total = Math.max(0, Math.ceil(msRemaining / 1000));
  const m = Math.floor(total / 60);
  const s = total % 60;
  return `${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
}

export function SessionCard({ profile, C, isMobile, onToast }: SessionCardProps) {
  const s = useTradingSession({ profile });
  const [preOpen, setPreOpen] = useState(false);
  const [debriefOpen, setDebriefOpen] = useState(false);
  const [lossDollarOpen, setLossDollarOpen] = useState(false);
  const [lossDollar, setLossDollar] = useState("");
  const [now, setNow] = useState(Date.now());

  const locked = s.lockedUntil !== null && s.lockedUntil > now;

  // Tick the cooldown countdown once a second while locked.
  useEffect(() => {
    if (!locked) return;
    const id = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(id);
  }, [locked]);

  const maxDailyLoss = profile.maxDailyLoss ? parseFloat(profile.maxDailyLoss) : null;
  const maxTradesPerDay = profile.maxTradesPerDay ? parseFloat(profile.maxTradesPerDay) : null;

  // ── Idle ────────────────────────────────────────────────────────────────
  if (!s.session) {
    return (
      <>
        <div style={{ padding: "14px 0" }}>
          <button
            onClick={() => setPreOpen(true)}
            style={{
              width: "100%", padding: "12px 16px", borderRadius: 12,
              border: `1px solid ${C.border}`, background: C.panel, color: C.text,
              fontFamily: MONO, fontSize: "0.8125rem", letterSpacing: "0.04em", cursor: "pointer",
            }}
          >
            Start session
          </button>
        </div>
        <PreSessionSheet
          open={preOpen}
          C={C}
          isMobile={isMobile}
          maxDailyLoss={maxDailyLoss}
          maxTradesPerDay={maxTradesPerDay}
          onStart={() => { setPreOpen(false); void s.start({ maxDailyLoss, maxTradesPerDay }); }}
          onCancel={() => setPreOpen(false)}
        />
      </>
    );
  }

  // ── Armed ─────────────────────────────────────────────────────────────────
  const t = s.tally!;
  const chip = locked
    ? `Cooling off · ${formatCountdown((s.lockedUntil ?? 0) - now)}`
    : t.streakKind === "Loss" && t.streak >= 2
      ? `Warning — ${t.streak} losses`
      : "In control ✓";

  function commitLoss() {
    const parsed = lossDollar.trim() === "" ? null : parseFloat(lossDollar);
    const val = parsed !== null && Number.isFinite(parsed) ? parsed : null;
    void s.tap("Loss", val);
    setLossDollar("");
    setLossDollarOpen(false);
  }

  return (
    <>
      <div style={{
        padding: 16, borderRadius: 14, border: `1px solid ${C.border}`,
        background: C.panel, display: "flex", flexDirection: "column", gap: 12, margin: "14px 0",
      }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <span style={{ fontFamily: MONO, fontSize: "0.6875rem", letterSpacing: "0.08em", textTransform: "uppercase", color: C.dim }}>
            Trading session
          </span>
          <span style={{ fontFamily: MONO, fontSize: "0.6875rem", color: locked ? C.live : t.streak >= 2 && t.streakKind === "Loss" ? C.warn : C.green }}>
            {chip}
          </span>
        </div>

        <div style={{ display: "flex", gap: 18, fontFamily: BODY }}>
          <span style={{ color: C.green }}>W {t.wins}</span>
          <span style={{ color: C.red }}>L {t.losses}</span>
          {t.hasDollar && (
            <span style={{ color: t.netDollar >= 0 ? C.green : C.red }}>
              {t.netDollar >= 0 ? "+" : "−"}${Math.abs(t.netDollar).toFixed(2)}
            </span>
          )}
        </div>

        <div style={{ display: "flex", gap: 10 }}>
          <button onClick={() => void s.tap("Win", null)} disabled={locked}
            style={{ flex: 1, padding: "12px", borderRadius: 10, border: `1px solid ${C.green}`, background: "transparent", color: C.green, fontFamily: MONO, cursor: locked ? "not-allowed" : "pointer" }}>
            + Win
          </button>
          <button onClick={() => setLossDollarOpen(o => !o)} disabled={locked}
            style={{ flex: 1, padding: "12px", borderRadius: 10, border: `1px solid ${C.red}`, background: "transparent", color: C.red, fontFamily: MONO, cursor: locked ? "not-allowed" : "pointer" }}>
            + Loss
          </button>
        </div>

        {lossDollarOpen && (
          <div style={{ display: "flex", gap: 8 }}>
            <input
              autoFocus type="number" inputMode="decimal" placeholder="$ lost (optional)"
              value={lossDollar} onChange={e => setLossDollar(e.target.value)}
              onKeyDown={e => { if (e.key === "Enter") commitLoss(); }}
              style={{ flex: 1, padding: "10px", borderRadius: 8, border: `1px solid ${C.border}`, background: C.bg, color: C.text, fontFamily: MONO }}
            />
            <button onClick={commitLoss}
              style={{ padding: "10px 14px", borderRadius: 8, border: `1px solid ${C.red}`, background: "transparent", color: C.red, fontFamily: MONO, cursor: "pointer" }}>
              Log loss
            </button>
          </div>
        )}

        <div style={{ display: "flex", gap: 10 }}>
          <button onClick={() => { s.checkMe(); if (!s.interventionOpen) onToast?.("You're in control."); }}
            style={{ flex: 1, padding: "10px", borderRadius: 10, border: `1px solid ${C.border}`, background: "transparent", color: C.text, fontFamily: MONO, cursor: "pointer" }}>
            Check me
          </button>
          <button onClick={() => setDebriefOpen(true)}
            style={{ flex: 1, padding: "10px", borderRadius: 10, border: `1px solid ${C.border}`, background: "transparent", color: C.dim, fontFamily: MONO, cursor: "pointer" }}>
            End session
          </button>
        </div>
      </div>

      <InterventionSheet
        open={s.interventionOpen}
        signals={s.interventionSignals}
        C={C}
        isMobile={isMobile}
        cooldownMin={s.cooldownMin}
        onContinue={() => { void s.continueTrading(); }}
        onCancel={() => { void s.coolOff(); }}
      />

      {debriefOpen && (
        <PostSessionDebriefSheet
          open={debriefOpen}
          C={C}
          isMobile={isMobile}
          summary={{
            trades: t.wins + t.losses,
            wins: t.wins,
            losses: t.losses,
            pnlDisplay: t.hasDollar
              ? `${t.netDollar >= 0 ? "+" : "−"}$${Math.abs(t.netDollar).toFixed(2)}`
              : `${t.wins}W / ${t.losses}L`,
            pnlPositive: t.netDollar >= 0,
          }}
          onSave={() => { setDebriefOpen(false); void s.end(); onToast?.("Session ended."); }}
          onDismiss={() => { setDebriefOpen(false); void s.end(); }}
        />
      )}
    </>
  );
}
