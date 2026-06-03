// src/hooks/usePreSession.ts
// ═══════════════════════════════════════════════════════════════════════════════
// Kōda · usePreSession
//
// First-Log-of-the-day acknowledgment. Reads/writes a date string at
// user_kv["koda_session_started"]. If today's date matches the stored value,
// the user has already started today's session and the check does not fire.
//
// Pre-session check only fires when the user has at least one daily limit
// configured (maxDailyLoss or maxTradesPerDay) — otherwise there's nothing to
// confirm and the check is a friction without payoff.
// ═══════════════════════════════════════════════════════════════════════════════

import { useCallback, useEffect, useState } from "react";
import { storage } from "../lib/storage";
import { log } from "../lib/log";
import type { Profile } from "../types";

const SESSION_KEY = "koda_session_started";

export function todayLocalDate(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

function hasDailyLimits(profile: Profile): boolean {
  const maxLoss = parseFloat(profile.maxDailyLoss ?? "");
  const maxTrades = parseFloat(profile.maxTradesPerDay ?? "");
  return (Number.isFinite(maxLoss) && maxLoss > 0) || (Number.isFinite(maxTrades) && maxTrades > 0);
}

export interface PreSessionState {
  /** Today's session has been started — pre-session check is satisfied for the day. */
  startedToday: boolean;
  /** The profile has at least one daily limit configured — there is something to confirm. */
  hasLimits: boolean;
  /** True if the pre-session sheet should be shown on the next Log Trade tap. */
  needsCheck: boolean;
  /** Mark today's session started — writes today's date to user_kv. */
  markStarted: () => Promise<void>;
}

export function usePreSession({ profile }: { profile: Profile }): PreSessionState {
  const [startedOn, setStartedOn] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const row = await storage.get(SESSION_KEY);
        if (cancelled) return;
        if (!row) { setStartedOn(null); return; }
        const parsed = JSON.parse(row.value) as { date?: string };
        setStartedOn(parsed.date ?? null);
      } catch (e) {
        log.error("usePreSession.read", e);
        setStartedOn(null);
      }
    })();
    return () => { cancelled = true; };
  }, [profile.uid]);

  const today = todayLocalDate();
  const startedToday = startedOn === today;
  const hasLimits = hasDailyLimits(profile);
  const needsCheck = hasLimits && !startedToday;

  const markStarted = useCallback(async () => {
    const date = todayLocalDate();
    try {
      await storage.set(SESSION_KEY, JSON.stringify({ date }));
      setStartedOn(date);
    } catch (e) {
      log.error("usePreSession.write", e);
    }
  }, []);

  return { startedToday, hasLimits, needsCheck, markStarted };
}
