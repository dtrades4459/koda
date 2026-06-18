// src/data/interventions.ts
// ═══════════════════════════════════════════════════════════════════════════════
// Kōda · intervention_events CRUD
//
// All reads/writes are RLS-scoped to auth.uid() — see
// supabase/migrations/20260603_intervention_events.sql.
// ═══════════════════════════════════════════════════════════════════════════════

import { supabase } from "../lib/supabase";
import { log } from "../lib/log";
import { phCapture } from "../lib/posthog";
import type { TiltSignalId } from "../lib/tilt";

export type InterventionChoice = "continued" | "cancelled";

export interface InterventionEvent {
  id: string;
  userUid: string;
  firedAt: string;
  signals: TiltSignalId[];
  critical: boolean;
  choice: InterventionChoice;
  tradeId: number | null;
  sessionDate: string;
}

export interface LogInterventionArgs {
  userUid: string;
  signals: TiltSignalId[];
  critical: boolean;
  choice: InterventionChoice;
  sessionDate: string;
  source?: "log" | "session";   // PostHog-only; NOT persisted
}

export async function logInterventionEvent(args: LogInterventionArgs): Promise<string | null> {
  const row = {
    user_uid: args.userUid,
    signals: args.signals,
    critical: args.critical,
    choice: args.choice,
    session_date: args.sessionDate,
  };
  const { data, error } = await supabase
    .from("intervention_events")
    .insert(row)
    .select("id")
    .single();
  if (error) {
    log.error("interventions.log", error, { args });
    return null;
  }
  try {
    phCapture("intervention_fired", {
      signals: args.signals,
      critical: args.critical,
      choice: args.choice,
      session_date: args.sessionDate,
      source: args.source ?? "log",
    });
  } catch { /* posthog optional / not configured */ }
  return (data as { id: string } | null)?.id ?? null;
}

/** Link the newest unlinked intervention event for this user, fired within 10 minutes, to the given trade id. */
export async function linkTradeToRecentIntervention(userUid: string, tradeId: number): Promise<void> {
  const tenMinAgo = new Date(Date.now() - 10 * 60 * 1000).toISOString();
  const { data, error } = await supabase
    .from("intervention_events")
    .select("id")
    .eq("user_uid", userUid)
    .is("trade_id", null)
    .gte("fired_at", tenMinAgo)
    .order("fired_at", { ascending: false })
    .limit(1);
  if (error) {
    log.error("interventions.link.read", error, { userUid, tradeId });
    return;
  }
  const row = (data as Array<{ id: string }> | null)?.[0];
  if (!row) return;
  const { error: updateErr } = await supabase
    .from("intervention_events")
    .update({ trade_id: tradeId })
    .eq("id", row.id);
  if (updateErr) log.error("interventions.link.write", updateErr, { row: row.id, tradeId });
}

export interface InterventionStats {
  fired: number;
  continued: number;
  cancelled: number;
  postInterventionTrades: number;
  postInterventionWins: number;
}

export async function getInterventionStats(userUid: string, sinceISO: string): Promise<InterventionStats> {
  const { data, error } = await supabase
    .from("intervention_events")
    .select("choice, trade_id")
    .eq("user_uid", userUid)
    .gte("fired_at", sinceISO);
  if (error || !data) return { fired: 0, continued: 0, cancelled: 0, postInterventionTrades: 0, postInterventionWins: 0 };
  const rows = data as Array<{ choice: InterventionChoice; trade_id: number | null }>;
  return {
    fired: rows.length,
    continued: rows.filter(r => r.choice === "continued").length,
    cancelled: rows.filter(r => r.choice === "cancelled").length,
    postInterventionTrades: rows.filter(r => r.trade_id !== null).length,
    postInterventionWins: 0, // computed separately by the Stats card which has the trades array
  };
}
