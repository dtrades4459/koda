// src/hooks/useTradingSession.ts
// ═══════════════════════════════════════════════════════════════════════════════
// Kōda · useTradingSession
//
// Owns the live Trading Session: persistence (user_kv via the storage shim),
// live tilt evaluation off the tally, inactive→active edge detection that
// auto-opens the existing InterventionSheet, and a bridge to the existing
// useTiltState cooldown. The tilt engine and sheet are reused unchanged.
//
// Spec: docs/superpowers/specs/2026-06-16-pre-trade-intervention-design.md
// ═══════════════════════════════════════════════════════════════════════════════

import { useCallback, useEffect, useRef, useState } from "react";
import { storage } from "../lib/storage";
import { log } from "../lib/log";
import { evaluateTilt, type TiltSignal, type TiltSignalId } from "../lib/tilt";
import { logInterventionEvent } from "../data/interventions";
import { phCapture } from "../lib/posthog";
import type { Profile } from "../types";
import {
  ACTIVE_SESSION_KEY, startSession, addTap, isStale, tapsToTrades, tally as computeTally,
  type ActiveSession, type SessionTally,
} from "../lib/session";

function todayLocal(now: number): string {
  const d = new Date(now);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

// The cooldown lockout is a single app-wide resource (the logging flow and the
// session must observe the *same* lockout, live). Rather than spin a second
// useTiltState — which would give the session its own un-synced copy of the
// lockout — the caller injects the one instance Koda already owns.
export interface TiltCooldownBridge {
  lockedUntil: number | null;
  cooldownMin: number;
  startCooldown: (signals: TiltSignalId[]) => Promise<void>;
}

export interface UseTradingSession {
  session: ActiveSession | null;
  tally: SessionTally | null;
  interventionOpen: boolean;
  interventionSignals: TiltSignal[];
  lockedUntil: number | null;
  cooldownMin: number;
  start(cfg: { maxDailyLoss: number | null; maxTradesPerDay: number | null }): Promise<void>;
  tap(outcome: "Win" | "Loss", pnlDollar: number | null): Promise<void>;
  checkMe(): void;
  continueTrading(): Promise<void>;
  coolOff(): Promise<void>;
  end(): Promise<void>;
}

export function useTradingSession({ profile, cooldown }: { profile: Profile; cooldown: TiltCooldownBridge }): UseTradingSession {
  const [session, setSession] = useState<ActiveSession | null>(null);
  const [interventionOpen, setInterventionOpen] = useState(false);
  const [interventionSignals, setInterventionSignals] = useState<TiltSignal[]>([]);
  const prevActive = useRef(false);
  // Guards the async mount-load from clobbering a session armed before the
  // stored row resolves (start() can win the race against storage.get()).
  const hasArmed = useRef(false);
  // How many times the sheet auto-fired this session (reported on end()).
  const firedCount = useRef(0);

  // ── Load (with stale-day guard) ─────────────────────────────────────────
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const row = await storage.get(ACTIVE_SESSION_KEY);
        if (cancelled || hasArmed.current) return;   // a start() won the race — don't clobber it
        if (!row) { setSession(null); return; }
        const parsed = JSON.parse(row.value) as ActiveSession;
        if (isStale(parsed, Date.now())) {
          setSession(null);
          await storage.del(ACTIVE_SESSION_KEY);
          return;
        }
        setSession(parsed);
      } catch (e) {
        log.error("useTradingSession.load", e);
        setSession(null);
      }
    })();
    return () => { cancelled = true; };
  }, [profile.uid]);

  const persist = useCallback(async (next: ActiveSession | null) => {
    try {
      if (next) await storage.set(ACTIVE_SESSION_KEY, JSON.stringify(next));
      else await storage.del(ACTIVE_SESSION_KEY);
    } catch (e) {
      log.error("useTradingSession.persist", e);  // keep in-memory tally regardless
    }
  }, []);

  const start = useCallback(async (cfg: { maxDailyLoss: number | null; maxTradesPerDay: number | null }) => {
    const next = startSession({ startedAt: new Date().toISOString(), ...cfg });
    prevActive.current = false;
    hasArmed.current = true;
    firedCount.current = 0;
    setSession(next);
    try { phCapture("session_started", { maxDailyLoss: cfg.maxDailyLoss, maxTradesPerDay: cfg.maxTradesPerDay }); } catch { /* posthog optional */ }
    await persist(next);
  }, [persist]);

  const tap = useCallback(async (outcome: "Win" | "Loss", pnlDollar: number | null) => {
    if (!session) return;
    // In-memory state updates first; taps are never lost on a write failure.
    const next = addTap(session, { outcome, pnlDollar, at: new Date().toISOString() });
    const now = Date.now();
    const state = evaluateTilt(tapsToTrades(next.taps, todayLocal(now)), profile, now);
    const locked = cooldown.lockedUntil !== null && cooldown.lockedUntil > now;
    if (state.active && !prevActive.current && !locked) {
      setInterventionSignals(state.signals);
      setInterventionOpen(true);
      firedCount.current += 1;
    }
    prevActive.current = state.active;
    setSession(next);
    await persist(next);
  }, [session, profile, cooldown.lockedUntil, persist]);

  const checkMe = useCallback(() => {
    if (!session) return;
    const now = Date.now();
    const state = evaluateTilt(tapsToTrades(session.taps, todayLocal(now)), profile, now);
    setInterventionSignals(state.signals);
    setInterventionOpen(state.active);   // when inactive the card shows an "in control" confirm
  }, [session, profile]);

  const continueTrading = useCallback(async () => {
    setInterventionOpen(false);
    if (profile.uid) {
      await logInterventionEvent({
        userUid: profile.uid,
        signals: interventionSignals.map(s => s.id),
        critical: interventionSignals.some(s => s.critical),
        choice: "continued",
        sessionDate: todayLocal(Date.now()),
        source: "session",
      });
    }
  }, [profile.uid, interventionSignals]);

  const coolOff = useCallback(async () => {
    setInterventionOpen(false);
    if (profile.uid) {
      await logInterventionEvent({
        userUid: profile.uid,
        signals: interventionSignals.map(s => s.id),
        critical: interventionSignals.some(s => s.critical),
        choice: "cancelled",
        sessionDate: todayLocal(Date.now()),
        source: "session",
      });
    }
    await cooldown.startCooldown(interventionSignals.map(s => s.id));
  }, [profile.uid, interventionSignals, cooldown]);

  const end = useCallback(async () => {
    const t = session ? computeTally(session) : null;
    try {
      phCapture("session_ended", {
        taps: session ? session.taps.length : 0,
        netDollar: t?.netDollar ?? 0,
        interventions: firedCount.current,
      });
    } catch { /* posthog optional */ }
    prevActive.current = false;
    setSession(null);
    setInterventionOpen(false);
    await persist(null);
  }, [session, persist]);

  return {
    session,
    tally: session ? computeTally(session) : null,
    interventionOpen,
    interventionSignals,
    lockedUntil: cooldown.lockedUntil,
    cooldownMin: cooldown.cooldownMin,
    start, tap, checkMe, continueTrading, coolOff, end,
  };
}
