// src/hooks/useSessionDebrief.ts
// ═══════════════════════════════════════════════════════════════════════════════
// Kōda · useSessionDebrief
//
// End-of-day reflection. Offers a debrief modal once per day after the user has
// finished trading. Conditions:
//   • At least 1 trade logged today
//   • Most recent trade was more than IDLE_MIN minutes ago
//   • Today's debrief hasn't already been completed
//
// State is persisted in user_kv:
//   koda_debrief_log = DebriefEntry[]  (FIFO, capped 30)
// ═══════════════════════════════════════════════════════════════════════════════

import { useCallback, useEffect, useMemo, useState } from "react";
import { storage } from "../lib/storage";
import { log } from "../lib/log";
import type { Trade } from "../types";

const LOG_KEY = "koda_debrief_log";
const MAX_ENTRIES = 30;
const IDLE_MIN = 60;

export type RulesFollowed = "yes" | "mostly" | "no";

export interface DebriefEntry {
  /** YYYY-MM-DD */
  date: string;
  rulesFollowed: RulesFollowed;
  note?: string;
  /** ISO timestamp the debrief was saved */
  savedAt: string;
}

function todayLocalDate(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

function lastTradeTimeMs(trades: Trade[], today: string): number | null {
  let latest: number | null = null;
  for (const t of trades) {
    if (t.date !== today) continue;
    // Prefer exitTime when present, fall back to date.
    const candidates = [t.exitTime, t.entryTime, t.date].filter(Boolean) as string[];
    for (const cand of candidates) {
      const ms = Date.parse(cand.includes("T") ? cand : `${today}T${cand}`);
      if (Number.isFinite(ms) && (latest === null || ms > latest)) latest = ms;
    }
  }
  return latest;
}

export interface SessionDebriefState {
  /** True if the debrief banner/card should be offered on Home. */
  shouldOffer: boolean;
  /** Today's debrief has been completed. */
  doneToday: boolean;
  /** Persist today's debrief entry. */
  markDone: (entry: { rulesFollowed: RulesFollowed; note?: string }) => Promise<void>;
}

export function useSessionDebrief({ trades }: { trades: Trade[] }): SessionDebriefState {
  const [entries, setEntries] = useState<DebriefEntry[]>([]);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const row = await storage.get(LOG_KEY);
        if (cancelled) return;
        if (!row) { setEntries([]); setLoaded(true); return; }
        const parsed = JSON.parse(row.value) as DebriefEntry[];
        setEntries(Array.isArray(parsed) ? parsed : []);
      } catch (e) {
        log.error("useSessionDebrief.read", e);
        setEntries([]);
      } finally {
        if (!cancelled) setLoaded(true);
      }
    })();
    return () => { cancelled = true; };
  }, []);

  const today = todayLocalDate();
  const doneToday = useMemo(() => entries.some(e => e.date === today), [entries, today]);

  const shouldOffer = useMemo(() => {
    if (!loaded || doneToday) return false;
    const todayTrades = trades.filter(t => t.date === today);
    if (todayTrades.length === 0) return false;
    const lastMs = lastTradeTimeMs(trades, today);
    if (lastMs === null) return false;
    return Date.now() - lastMs >= IDLE_MIN * 60_000;
  }, [loaded, doneToday, trades, today]);

  const markDone = useCallback(async (entry: { rulesFollowed: RulesFollowed; note?: string }) => {
    const next: DebriefEntry = {
      date: today,
      rulesFollowed: entry.rulesFollowed,
      note: entry.note?.trim() || undefined,
      savedAt: new Date().toISOString(),
    };
    const merged = [...entries.filter(e => e.date !== today), next].slice(-MAX_ENTRIES);
    setEntries(merged);
    try {
      await storage.set(LOG_KEY, JSON.stringify(merged));
    } catch (e) {
      log.error("useSessionDebrief.write", e);
    }
  }, [entries, today]);

  return { shouldOffer, doneToday, markDone };
}
