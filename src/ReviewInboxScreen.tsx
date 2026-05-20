// ── ReviewInboxScreen ──────────────────────────────────────────────────────────
// Shows trades that auto-synced from a broker but haven't been reviewed yet
// (review_status = 'draft' in public.trades).
//
// Publish → sets review_status='published' + adds trade to KV journal
// Skip    → sets review_status='skipped'  (hidden from inbox, not journaled)
// ─────────────────────────────────────────────────────────────────────────────
import { useState, useEffect, useCallback } from "react";
import { supabase } from "./lib/supabase";
import { log } from "./lib/log";
import type { Trade } from "./types";
import { MONO, BODY, DISPLAY } from "./shared";

// ── Types ─────────────────────────────────────────────────────────────────────

interface DraftRow {
  id: string;          // uuid PK in public.trades
  pair: string;
  side: string | null; // 'long' | 'short'
  date: string;        // YYYY-MM-DD
  pnl: number;
  outcome: string;     // 'win' | 'loss' | 'be'
  entry_price: number | null;
  strategy: string | null;
  notes: string | null;
  broker: string;
  external_id: string;
  created_at: string;
}

export interface ReviewInboxScreenProps {
  userId: string;
  trades: Trade[];
  saveTrades: (t: Trade[]) => Promise<void>;
  onCountChange: (n: number) => void;
  C: Record<string, string>;
  navigateTo: (view: string) => void;
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function outcomeColor(outcome: string, C: Record<string, string>): string {
  if (outcome === "win")  return C.green  ?? "#22c55e";
  if (outcome === "loss") return C.red    ?? "#ef4444";
  return C.muted ?? "#888";
}

function draftToTrade(row: DraftRow, baseId: number): Trade {
  const pnl = parseFloat(String(row.pnl ?? 0));
  return {
    id:          baseId,
    date:        row.date ?? new Date().toISOString().split("T")[0],
    pair:        row.pair ?? "",
    session:     "",
    bias:        "",
    strategy:    row.strategy ?? "",
    setup:       "",
    entryPrice:  row.entry_price != null ? String(row.entry_price) : "",
    slPrice:     "",
    tpPrice:     "",
    rr:          "",
    outcome:     row.outcome ?? "be",
    pnl:         String(pnl),
    notes:       row.notes ?? `Auto-imported from ${row.broker ?? "broker"}`,
    emotions:    "",
    screenshot:  "",
    pnlDollar:   String(pnl),
    direction:   row.side === "long" ? "Long" : row.side === "short" ? "Short" : "",
    comments:    [],
    reactions:   {},
    source:      "api",
    createdAt:   new Date().toISOString(),
  };
}

// ── Component ─────────────────────────────────────────────────────────────────

export function ReviewInboxScreen({ userId, trades, saveTrades, onCountChange, C, navigateTo }: ReviewInboxScreenProps) {
  const [drafts, setDrafts]         = useState<DraftRow[]>([]);
  const [loading, setLoading]       = useState(true);
  const [acting, setActing]         = useState<Set<string>>(new Set()); // row IDs currently processing
  const [publishingAll, setPublishingAll] = useState(false);

  // ── Load drafts ────────────────────────────────────────────────────────────

  const loadDrafts = useCallback(async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from("trades")
        .select("id, pair, side, date, pnl, outcome, entry_price, strategy, notes, broker, external_id, created_at")
        .eq("user_id", userId)
        .eq("review_status", "draft")
        .order("date", { ascending: false });

      if (error) throw error;
      const rows = (data ?? []) as DraftRow[];
      setDrafts(rows);
      onCountChange(rows.length);
    } catch (e) {
      log.error("ReviewInbox.load", e);
    } finally {
      setLoading(false);
    }
  }, [userId, onCountChange]);

  useEffect(() => { if (userId) loadDrafts(); }, [userId, loadDrafts]);

  // ── Actions ────────────────────────────────────────────────────────────────

  async function publishOne(row: DraftRow) {
    if (acting.has(row.id)) return;
    setActing(prev => new Set(prev).add(row.id));
    try {
      const { error } = await supabase
        .from("trades")
        .update({ review_status: "published" })
        .eq("id", row.id)
        .eq("user_id", userId);
      if (error) throw error;

      // Add to KV journal
      const maxId = trades.reduce((m, t) => Math.max(m, t.id), 0);
      const newTrade = draftToTrade(row, maxId + 1);
      await saveTrades([newTrade, ...trades]);

      setDrafts(prev => {
        const next = prev.filter(d => d.id !== row.id);
        onCountChange(next.length);
        return next;
      });
    } catch (e) {
      log.error("ReviewInbox.publish", e);
    } finally {
      setActing(prev => { const s = new Set(prev); s.delete(row.id); return s; });
    }
  }

  async function skipOne(row: DraftRow) {
    if (acting.has(row.id)) return;
    setActing(prev => new Set(prev).add(row.id));
    try {
      const { error } = await supabase
        .from("trades")
        .update({ review_status: "skipped" })
        .eq("id", row.id)
        .eq("user_id", userId);
      if (error) throw error;

      setDrafts(prev => {
        const next = prev.filter(d => d.id !== row.id);
        onCountChange(next.length);
        return next;
      });
    } catch (e) {
      log.error("ReviewInbox.skip", e);
    } finally {
      setActing(prev => { const s = new Set(prev); s.delete(row.id); return s; });
    }
  }

  async function publishAll() {
    if (publishingAll || drafts.length === 0) return;
    setPublishingAll(true);
    try {
      const ids = drafts.map(d => d.id);
      const { error } = await supabase
        .from("trades")
        .update({ review_status: "published" })
        .in("id", ids)
        .eq("user_id", userId);
      if (error) throw error;

      // Convert all to Trade objects with sequential IDs
      const maxId = trades.reduce((m, t) => Math.max(m, t.id), 0);
      const newTrades = drafts.map((row, i) => draftToTrade(row, maxId + 1 + i));
      await saveTrades([...newTrades, ...trades]);

      setDrafts([]);
      onCountChange(0);
    } catch (e) {
      log.error("ReviewInbox.publishAll", e);
    } finally {
      setPublishingAll(false);
    }
  }

  // ── Styles ─────────────────────────────────────────────────────────────────

  const card: React.CSSProperties = {
    background: C.panel,
    border: `1px solid ${C.border}`,
    borderRadius: "12px",
    padding: "16px",
    marginBottom: "10px",
    display: "flex",
    flexDirection: "column",
    gap: "10px",
  };

  const btnBase: React.CSSProperties = {
    border: "none",
    borderRadius: "999px",
    fontFamily: MONO,
    fontSize: "10px",
    letterSpacing: "0.1em",
    textTransform: "uppercase" as const,
    cursor: "pointer",
    padding: "7px 14px",
    fontWeight: 600,
    transition: "opacity 0.15s",
  };

  const btnPublish: React.CSSProperties = {
    ...btnBase,
    background: C.text,
    color: C.bg,
  };

  const btnSkip: React.CSSProperties = {
    ...btnBase,
    background: "transparent",
    color: C.muted ?? "#888",
    border: `1px solid ${C.border2 ?? C.border}`,
  };

  const btnPublishAll: React.CSSProperties = {
    ...btnBase,
    background: C.green ?? "#22c55e",
    color: "#0A0A0A",
    fontSize: "11px",
    padding: "10px 20px",
  };

  // ── Render ─────────────────────────────────────────────────────────────────

  return (
    <div style={{ padding: "20px 20px 40px", fontFamily: BODY, maxWidth: "480px", margin: "0 auto" }}>

      {/* Header */}
      <div style={{ marginBottom: "24px" }}>
        <p style={{ fontFamily: MONO, fontSize: "10px", letterSpacing: "0.14em", textTransform: "uppercase", color: C.muted ?? "#888", marginBottom: "6px" }}>
          Sync · Review Inbox
        </p>
        <h1 style={{ fontFamily: DISPLAY, fontSize: "22px", fontWeight: 700, color: C.text, letterSpacing: "-0.02em", lineHeight: 1.2 }}>
          {loading ? "Loading…" : drafts.length === 0 ? "All caught up" : `${drafts.length} trade${drafts.length !== 1 ? "s" : ""} to review`}
        </h1>
        <p style={{ fontSize: "13px", color: C.muted ?? "#888", marginTop: "6px", lineHeight: 1.5 }}>
          {drafts.length === 0 && !loading
            ? "Auto-synced trades will appear here for you to publish to your journal."
            : "Auto-synced from your broker. Publish trades you want in your journal, skip the rest."}
        </p>
      </div>

      {/* Publish All */}
      {drafts.length > 1 && (
        <div style={{ marginBottom: "20px" }}>
          <button
            style={{ ...btnPublishAll, opacity: publishingAll ? 0.5 : 1 }}
            onClick={publishAll}
            disabled={publishingAll}
          >
            {publishingAll ? "Publishing…" : `Publish All ${drafts.length} Trades`}
          </button>
        </div>
      )}

      {/* Loading skeleton */}
      {loading && (
        <div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
          {[1, 2, 3].map(i => (
            <div key={i} style={{ ...card, opacity: 0.4, minHeight: "88px" }} />
          ))}
        </div>
      )}

      {/* Empty state */}
      {!loading && drafts.length === 0 && (
        <div style={{ textAlign: "center", padding: "48px 0" }}>
          <div style={{ fontSize: "36px", marginBottom: "12px" }}>✓</div>
          <p style={{ fontFamily: MONO, fontSize: "11px", letterSpacing: "0.1em", textTransform: "uppercase", color: C.muted ?? "#888" }}>
            Inbox empty
          </p>
          <button
            style={{ ...btnBase, background: "transparent", border: `1px solid ${C.border2 ?? C.border}`, color: C.text, marginTop: "20px" }}
            onClick={() => navigateTo("log")}
          >
            ← Back to Log
          </button>
        </div>
      )}

      {/* Draft trade cards */}
      {!loading && drafts.map(row => {
        const pnl    = parseFloat(String(row.pnl ?? 0));
        const pnlPos = pnl >= 0;
        const busy   = acting.has(row.id);

        return (
          <div key={row.id} style={{ ...card, opacity: busy ? 0.5 : 1 }}>

            {/* Top row: symbol + direction + P&L */}
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
              <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                <span style={{ fontFamily: DISPLAY, fontSize: "16px", fontWeight: 700, color: C.text, letterSpacing: "-0.01em" }}>
                  {row.pair}
                </span>
                {row.side && (
                  <span style={{
                    fontFamily: MONO, fontSize: "9px", letterSpacing: "0.1em",
                    fontWeight: 700, textTransform: "uppercase",
                    color: row.side === "long" ? (C.green ?? "#22c55e") : (C.red ?? "#ef4444"),
                    background: row.side === "long"
                      ? `color-mix(in oklch, ${C.green ?? "#22c55e"} 15%, transparent)`
                      : `color-mix(in oklch, ${C.red ?? "#ef4444"} 15%, transparent)`,
                    padding: "2px 7px", borderRadius: "4px",
                  }}>
                    {row.side}
                  </span>
                )}
                <span style={{
                  fontFamily: MONO, fontSize: "9px", letterSpacing: "0.08em",
                  color: C.muted ?? "#888",
                  textTransform: "uppercase",
                  background: `color-mix(in oklch, ${C.muted ?? "#888"} 12%, transparent)`,
                  padding: "2px 6px", borderRadius: "4px",
                }}>
                  {row.broker ?? "broker"}
                </span>
              </div>
              <span style={{
                fontFamily: MONO, fontSize: "15px", fontWeight: 700,
                fontVariantNumeric: "tabular-nums",
                color: outcomeColor(row.outcome, C),
              }}>
                {pnlPos ? "+" : ""}{pnl.toFixed(2)}
              </span>
            </div>

            {/* Date + notes */}
            <div style={{ display: "flex", flexDirection: "column", gap: "3px" }}>
              <span style={{ fontFamily: MONO, fontSize: "11px", color: C.muted ?? "#888" }}>
                {row.date}
                {row.entry_price != null && (
                  <span style={{ marginLeft: "10px" }}>@ {row.entry_price}</span>
                )}
              </span>
              {row.notes && (
                <span style={{ fontSize: "12px", color: C.text2 ?? C.muted, lineHeight: 1.4, opacity: 0.75 }}>
                  {row.notes}
                </span>
              )}
            </div>

            {/* Actions */}
            <div style={{ display: "flex", gap: "8px", marginTop: "2px" }}>
              <button
                style={{ ...btnPublish, opacity: busy ? 0.5 : 1 }}
                onClick={() => publishOne(row)}
                disabled={busy}
              >
                {busy ? "…" : "Publish"}
              </button>
              <button
                style={{ ...btnSkip, opacity: busy ? 0.5 : 1 }}
                onClick={() => skipOne(row)}
                disabled={busy}
              >
                Skip
              </button>
            </div>
          </div>
        );
      })}
    </div>
  );
}
