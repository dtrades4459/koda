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
import { evaluateTilt, type TiltSignal } from "../lib/tilt";
import { useTiltState } from "./useTiltState";
import { logInterventionEvent } from "../data/interventions";
import type { Profile } from "../types";
import {
  ACTIVE_SESSION_KEY, startSession, addTap, isStale, tapsToTrades, tally as computeTally,
  type ActiveSession, type SessionTally,
} from "../lib/session";

function todayLocal(now: number): string {
  const d = new Date(now);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
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

export function useTradingSession({ profile }: { profile: Profile }): UseTradingSession {
  const [session, setSession] = useState<ActiveSession | null>(null);
  const [interventionOpen, setInterventionOpen] = useState(false);
  const [interventionSignals, setInterventionSignals] = useState<TiltSignal[]>([]);
  const prevActive = useRef(false);
  // Guards the async mount-load from clobbering a session armed before the
  // stored row resolves (start() can win the race against storage.get()).
  const hasArmed = useRef(false);

  // Cooldown is owned by the existing useTiltState. We feed it the session's
  // adapted trades so its lockout read/write stays a single source of truth.
  const sessionTrades = session ? tapsToTrades(session.taps, todayLocal(Date.now())) : [];
  const tilt = useTiltState({ trades: sessionTrades, profile });

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
    setSession(next);
    await persist(next);
  }, [persist]);

  const tap = useCallback(async (outcome: "Win" | "Loss", pnlDollar: number | null) => {
    if (!session) return;
    // In-memory state updates first; taps are never lost on a write failure.
    const next = addTap(session, { outcome, pnlDollar, at: new Date().toISOString() });
    const now = Date.now();
    const state = evaluateTilt(tapsToTrades(next.taps, todayLocal(now)), profile, now);
    const locked = tilt.lockedUntil !== null && tilt.lockedUntil > now;
    if (state.active && !prevActive.current && !locked) {
      setInterventionSignals(state.signals);
      setInterventionOpen(true);
    }
    prevActive.current = state.active;
    setSession(next);
    await persist(next);
  }, [session, profile, tilt.lockedUntil, persist]);

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
    await tilt.startCooldown(interventionSignals.map(s => s.id));
  }, [profile.uid, interventionSignals, tilt]);

  const end = useCallback(async () => {
    prevActive.current = false;
    setSession(null);
    setInterventionOpen(false);
    await persist(null);
  }, [persist]);

  return {
    session,
    tally: session ? computeTally(session) : null,
    interventionOpen,
    interventionSignals,
    lockedUntil: tilt.lockedUntil,
    cooldownMin: tilt.settings.cooldownMin,
    start, tap, checkMe, continueTrading, coolOff, end,
  };
}
