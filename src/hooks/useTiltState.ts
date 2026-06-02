// src/hooks/useTiltState.ts
// ═══════════════════════════════════════════════════════════════════════════════
// Kōda · useTiltState
//
// Wraps evaluateTilt in useMemo and reads/writes the cooldown lockout stored in
// user_kv under `koda_intervention_lockout`.
// ═══════════════════════════════════════════════════════════════════════════════

import { useEffect, useMemo, useState, useCallback } from "react";
import { storage } from "../lib/storage";
import { log } from "../lib/log";
import { evaluateTilt, type TiltState, type TiltSignalId } from "../lib/tilt";
import type { Trade, Profile } from "../types";

const LOCKOUT_KEY = "koda_intervention_lockout";

export type CooldownMin = 0 | 5 | 15 | 30;

export interface InterventionSettings {
  enabled: boolean;
  cooldownMin: CooldownMin;
}

const DEFAULT_SETTINGS: InterventionSettings = { enabled: true, cooldownMin: 15 };

interface LockoutValue {
  until: string;
  signals: TiltSignalId[];
}

export function useTiltState({
  trades,
  profile,
}: {
  trades: Trade[];
  profile: Profile;
}): {
  state: TiltState;
  lockedUntil: number | null;
  settings: InterventionSettings;
  startCooldown: (signals: TiltSignalId[]) => Promise<void>;
  clearCooldown: () => Promise<void>;
} {
  const [lockedUntil, setLockedUntil] = useState<number | null>(null);

  const settings: InterventionSettings = useMemo(() => {
    const raw = (profile.prefs as { intervention?: Partial<InterventionSettings> } | undefined)?.intervention;
    if (!raw) return DEFAULT_SETTINGS;
    return {
      enabled: raw.enabled ?? DEFAULT_SETTINGS.enabled,
      cooldownMin: (raw.cooldownMin ?? DEFAULT_SETTINGS.cooldownMin) as CooldownMin,
    };
  }, [profile.prefs]);

  // Read lockout from user_kv on mount and whenever the profile uid changes
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const row = await storage.get(LOCKOUT_KEY);
        if (cancelled) return;
        if (!row) { setLockedUntil(null); return; }
        const parsed = JSON.parse(row.value) as LockoutValue;
        const ts = Date.parse(parsed.until);
        if (!isFinite(ts) || ts <= Date.now()) { setLockedUntil(null); return; }
        setLockedUntil(ts);
      } catch (e) {
        log.error("useTiltState.lockoutRead", e);
        setLockedUntil(null);
      }
    })();
    return () => { cancelled = true; };
  }, [profile.uid]);

  const state = useMemo(
    () => evaluateTilt(trades, profile, Date.now()),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [trades.length, trades[trades.length - 1]?.id, profile.maxDailyLoss, profile.maxTradesPerDay],
  );

  const startCooldown = useCallback(async (signals: TiltSignalId[]) => {
    if (settings.cooldownMin === 0) return;
    const until = new Date(Date.now() + settings.cooldownMin * 60_000);
    const payload: LockoutValue = { until: until.toISOString(), signals };
    try {
      await storage.set(LOCKOUT_KEY, JSON.stringify(payload));
      setLockedUntil(until.getTime());
    } catch (e) {
      log.error("useTiltState.lockoutWrite", e);
    }
  }, [settings.cooldownMin]);

  const clearCooldown = useCallback(async () => {
    try {
      await storage.set(LOCKOUT_KEY, JSON.stringify({ until: new Date(0).toISOString(), signals: [] }));
      setLockedUntil(null);
    } catch (e) {
      log.error("useTiltState.lockoutClear", e);
    }
  }, []);

  return { state, lockedUntil, settings, startCooldown, clearCooldown };
}
