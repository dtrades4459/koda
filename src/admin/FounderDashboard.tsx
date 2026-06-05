// ═══════════════════════════════════════════════════════════════════════════════
// Kōda · Founder Dashboard
//
// Private /admin view. Renders a single JSON blob returned by
//   GET /api/admin/metrics
// — every number is computed deterministically in Postgres
// (see supabase/migrations/20260605_founder_metrics.sql and docs/koda-dashboard-brief.md).
//
// Mobile-first. Uses the existing Kōda design tokens. Color-by-good/bad: a
// falling "at-risk" number is green, not red.
// ═══════════════════════════════════════════════════════════════════════════════

import { useCallback, useEffect, useMemo, useState } from "react";
import type { Theme } from "../theme";
import { MONO, BODY, DISPLAY, Card } from "../shared";
import { supabase } from "../lib/supabase";

// ──────────────────────────────────────────────────────────────────────────────
// Types
// ──────────────────────────────────────────────────────────────────────────────

type RetentionRow = {
  cohort_week: string;
  cohort_size: number;
  retained_w1: number;
  pct: number;
};

type SparklinePoint = { week_start: string; waj: number };

type Runway = {
  cash_in_bank_gbp: number;
  monthly_burn_gbp: number;
  runway_months: number | null;
  updated_at: string;
} | null;

type Metrics = {
  generated_at: string;
  activation_threshold: number;
  signups:    { total: number; last_7d: number; prev_7d: number };
  waitlist:   { total: number; last_7d: number };
  activation: { activated_total: number; signups_total: number; pct: number };
  waj:        { this_week: number; last_week: number };
  trades:     { last_7d: number; prev_7d: number };
  dormant_activated: number;
  retention:  RetentionRow[];
  waj_sparkline: SparklinePoint[];
  runway:     Runway;
  revenue:    { active_subs: number; mrr_gbp: number; source: string };
};

// ──────────────────────────────────────────────────────────────────────────────
// Utils
// ──────────────────────────────────────────────────────────────────────────────

function fmtPct(n: number): string {
  if (!Number.isFinite(n)) return "—";
  return `${n.toFixed(n >= 10 ? 0 : 1)}%`;
}

function fmtInt(n: number): string {
  return Number.isFinite(n) ? n.toLocaleString("en-GB") : "—";
}

function fmtGbp(n: number): string {
  if (!Number.isFinite(n)) return "—";
  return `£${n.toLocaleString("en-GB", { maximumFractionDigits: 0 })}`;
}

function fmtTime(iso: string): string {
  try {
    return new Date(iso).toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit", timeZone: "Europe/London" });
  } catch { return ""; }
}

// "good direction" = up | down | none — color WoW delta accordingly.
type Direction = "up" | "down" | "none";

function pctDelta(curr: number, prev: number): number | null {
  if (prev === 0) {
    if (curr === 0) return 0;
    return null; // undefined (∞ growth) — render as "new"
  }
  return ((curr - prev) / prev) * 100;
}

// ──────────────────────────────────────────────────────────────────────────────
// Cards
// ──────────────────────────────────────────────────────────────────────────────

function DeltaPill({ C, delta, good }: { C: Theme; delta: number | null; good: Direction }) {
  if (delta === null) {
    return (
      <span style={{
        fontFamily: MONO, fontSize: 10, letterSpacing: "0.08em",
        textTransform: "uppercase", color: C.live, padding: "3px 8px",
        background: C.liveSoft, borderRadius: 999,
      }}>NEW</span>
    );
  }
  const abs = Math.abs(delta);
  const positive = delta > 0;
  const isGood =
    good === "none" ? null :
    good === "up"   ? positive :
                      !positive;
  const color =
    isGood === null ? C.text2 :
    isGood          ? C.green : C.red;
  const arrow = delta === 0 ? "·" : positive ? "↑" : "↓";
  return (
    <span style={{
      fontFamily: MONO, fontSize: 10.5, fontWeight: 500,
      letterSpacing: "0.04em", color, whiteSpace: "nowrap",
    }}>
      {arrow} {abs.toFixed(abs >= 10 ? 0 : 1)}%
    </span>
  );
}

function MetricCard({
  C, label, value, sub, delta, good = "up",
}: {
  C: Theme; label: string; value: string; sub?: string;
  delta?: number | null; good?: Direction;
}) {
  return (
    <Card C={C} pad={16}>
      <div style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between", gap: 8 }}>
        <div style={{
          fontFamily: MONO, fontSize: 9.5, letterSpacing: "0.12em",
          textTransform: "uppercase", color: C.muted,
        }}>
          {label}
        </div>
        {delta !== undefined && <DeltaPill C={C} delta={delta} good={good} />}
      </div>
      <div style={{
        fontFamily: DISPLAY, fontSize: 30, fontWeight: 600, letterSpacing: "-0.02em",
        color: C.text, marginTop: 8, lineHeight: 1.1,
      }}>
        {value}
      </div>
      {sub && (
        <div style={{ fontFamily: BODY, fontSize: 12, color: C.text2, marginTop: 4 }}>
          {sub}
        </div>
      )}
    </Card>
  );
}

function Sparkline({ C, points }: { C: Theme; points: SparklinePoint[] }) {
  if (!points.length) return null;
  const w = 280;
  const h = 56;
  const max = Math.max(1, ...points.map(p => p.waj));
  const stepX = points.length > 1 ? w / (points.length - 1) : 0;
  const ptsStr = points.map((p, i) => {
    const x = i * stepX;
    const y = h - (p.waj / max) * (h - 6) - 3;
    return `${x.toFixed(1)},${y.toFixed(1)}`;
  }).join(" ");
  return (
    <svg viewBox={`0 0 ${w} ${h}`} preserveAspectRatio="none" style={{ width: "100%", height: h, display: "block", marginTop: 12 }}>
      <polyline
        points={ptsStr}
        fill="none"
        stroke={C.accent}
        strokeWidth={1.8}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function HeroCard({ C, m }: { C: Theme; m: Metrics }) {
  const delta = pctDelta(m.waj.this_week, m.waj.last_week);
  return (
    <Card C={C} pad={22}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12 }}>
        <div style={{
          fontFamily: MONO, fontSize: 10, letterSpacing: "0.14em",
          textTransform: "uppercase", color: C.accent,
        }}>
          Weekly Active Journalers
        </div>
        <DeltaPill C={C} delta={delta} good="up" />
      </div>
      <div style={{
        fontFamily: DISPLAY, fontSize: 56, fontWeight: 600, letterSpacing: "-0.03em",
        color: C.text, marginTop: 8, lineHeight: 1,
      }}>
        {fmtInt(m.waj.this_week)}
      </div>
      <div style={{ fontFamily: BODY, fontSize: 13, color: C.text2, marginTop: 6 }}>
        {fmtInt(m.trades.last_7d)} trades logged · vs {fmtInt(m.waj.last_week)} last week
      </div>
      <Sparkline C={C} points={m.waj_sparkline} />
    </Card>
  );
}

function RetentionCard({ C, rows }: { C: Theme; rows: RetentionRow[] }) {
  if (!rows.length) {
    return (
      <Card C={C} pad={16}>
        <div style={{ fontFamily: MONO, fontSize: 9.5, letterSpacing: "0.12em", textTransform: "uppercase", color: C.muted, marginBottom: 12 }}>
          W1 retention by cohort
        </div>
        <div style={{ fontFamily: BODY, fontSize: 13, color: C.text2 }}>
          Not enough data yet.
        </div>
      </Card>
    );
  }
  return (
    <Card C={C} pad={16}>
      <div style={{ fontFamily: MONO, fontSize: 9.5, letterSpacing: "0.12em", textTransform: "uppercase", color: C.muted, marginBottom: 12 }}>
        W1 retention by cohort
      </div>
      <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
        {rows.map(r => {
          const date = new Date(r.cohort_week);
          const label = date.toLocaleDateString("en-GB", { day: "2-digit", month: "short" });
          const barWidth = Math.min(100, r.pct);
          return (
            <div key={r.cohort_week} style={{ display: "flex", alignItems: "center", gap: 10 }}>
              <div style={{
                fontFamily: MONO, fontSize: 10.5, color: C.text2,
                minWidth: 56, letterSpacing: "0.04em",
              }}>
                {label.toUpperCase()}
              </div>
              <div style={{
                position: "relative", flex: 1, height: 10, borderRadius: 999,
                background: C.surfaceHi, overflow: "hidden",
              }}>
                <div style={{
                  position: "absolute", inset: 0,
                  width: `${barWidth}%`, background: C.accent,
                  borderRadius: 999,
                }} />
              </div>
              <div style={{ fontFamily: MONO, fontSize: 11, color: C.text, minWidth: 78, textAlign: "right" }}>
                {fmtPct(r.pct)} <span style={{ color: C.muted }}>({r.retained_w1}/{r.cohort_size})</span>
              </div>
            </div>
          );
        })}
      </div>
    </Card>
  );
}

function RunwayCard({ C, runway }: { C: Theme; runway: Runway }) {
  if (!runway) {
    return (
      <MetricCard C={C} label="Runway" value="—" sub="Set cash + burn in founder_metrics" />
    );
  }
  const months = runway.runway_months;
  const value = months === null ? "∞" : `${months}mo`;
  const sub = `${fmtGbp(runway.cash_in_bank_gbp)} cash · ${fmtGbp(runway.monthly_burn_gbp)}/mo burn`;
  return (
    <Card C={C} pad={16}>
      <div style={{
        fontFamily: MONO, fontSize: 9.5, letterSpacing: "0.12em",
        textTransform: "uppercase", color: C.muted,
      }}>
        Runway
      </div>
      <div style={{
        fontFamily: DISPLAY, fontSize: 30, fontWeight: 600, letterSpacing: "-0.02em",
        color: C.text, marginTop: 8, lineHeight: 1.1,
      }}>
        {value}
      </div>
      <div style={{ fontFamily: BODY, fontSize: 12, color: C.text2, marginTop: 4 }}>
        {sub}
      </div>
      <div style={{ fontFamily: MONO, fontSize: 9.5, color: C.muted, marginTop: 8, letterSpacing: "0.04em" }}>
        UPDATED {new Date(runway.updated_at).toLocaleDateString("en-GB", { day: "2-digit", month: "short" }).toUpperCase()}
      </div>
    </Card>
  );
}

// ──────────────────────────────────────────────────────────────────────────────
// Top-level component
// ──────────────────────────────────────────────────────────────────────────────

export function FounderDashboard({ C, onBack }: { C: Theme; onBack?: () => void }) {
  const [m, setM] = useState<Metrics | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [lastFetched, setLastFetched] = useState<Date | null>(null);

  const fetchMetrics = useCallback(async () => {
    setLoading(true);
    setErr(null);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session?.access_token) {
        setErr("Not signed in");
        setLoading(false);
        return;
      }
      const res = await fetch("/api/admin/metrics", {
        headers: { Authorization: `Bearer ${session.access_token}` },
      });
      if (res.status === 403) {
        setErr("Forbidden — your email is not on the admin allowlist.");
        return;
      }
      if (res.status === 503) {
        setErr("Admin allowlist not configured. Set ADMIN_EMAILS in Vercel env.");
        return;
      }
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        setErr(body.error ?? `HTTP ${res.status}`);
        return;
      }
      const data = (await res.json()) as Metrics;
      setM(data);
      setLastFetched(new Date());
    } catch (e) {
      setErr((e as Error).message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { void fetchMetrics(); }, [fetchMetrics]);

  const deltas = useMemo(() => {
    if (!m) return null;
    return {
      signups: pctDelta(m.signups.last_7d, m.signups.prev_7d),
      trades:  pctDelta(m.trades.last_7d,  m.trades.prev_7d),
    };
  }, [m]);

  return (
    <div style={{
      minHeight: "100dvh", background: C.bg, color: C.text,
      padding: "22px 18px 60px", maxWidth: 720, margin: "0 auto", boxSizing: "border-box",
    }}>
      {/* Header */}
      <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 18 }}>
        {onBack && (
          <button
            onClick={onBack}
            aria-label="Back"
            style={{
              width: 36, height: 36, borderRadius: 999, background: C.surface,
              border: `1px solid ${C.line}`, display: "flex",
              alignItems: "center", justifyContent: "center", cursor: "pointer", padding: 0,
            }}
          >
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none">
              <path d="M14 6l-6 6 6 6" stroke={C.text} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </button>
        )}
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontFamily: DISPLAY, fontSize: 22, fontWeight: 600, letterSpacing: "-0.02em" }}>
            Founder
          </div>
          <div style={{ fontFamily: MONO, fontSize: 10, letterSpacing: "0.08em", color: C.muted, marginTop: 4 }}>
            {lastFetched ? `UPDATED ${fmtTime(lastFetched.toISOString())}` : "LOADING…"}
          </div>
        </div>
        <button
          onClick={() => void fetchMetrics()}
          disabled={loading}
          style={{
            padding: "8px 14px", borderRadius: 999, background: "transparent",
            border: `1px solid ${C.border2}`, color: C.text,
            fontFamily: MONO, fontSize: 10, letterSpacing: "0.08em",
            textTransform: "uppercase", cursor: loading ? "default" : "pointer",
            opacity: loading ? 0.5 : 1,
          }}
        >
          {loading ? "…" : "Refresh"}
        </button>
      </div>

      {/* Error */}
      {err && (
        <Card C={C} pad={18} style={{ marginBottom: 16, borderColor: `color-mix(in oklch, ${C.red} 30%, transparent)` }}>
          <div style={{ fontFamily: MONO, fontSize: 9.5, letterSpacing: "0.12em", textTransform: "uppercase", color: C.red, marginBottom: 6 }}>
            Error
          </div>
          <div style={{ fontFamily: BODY, fontSize: 13, color: C.text }}>{err}</div>
        </Card>
      )}

      {/* Loading skeleton */}
      {!m && !err && (
        <Card C={C} pad={28} style={{ textAlign: "center" }}>
          <div style={{ fontFamily: MONO, fontSize: 10, letterSpacing: "0.12em", color: C.muted, textTransform: "uppercase" }}>
            Loading metrics…
          </div>
        </Card>
      )}

      {/* Metrics */}
      {m && (
        <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
          <HeroCard C={C} m={m} />

          {/* 2-column grid on mobile */}
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
            <MetricCard
              C={C}
              label="Activation"
              value={fmtPct(m.activation.pct)}
              sub={`${fmtInt(m.activation.activated_total)} of ${fmtInt(m.activation.signups_total)} signups`}
            />
            <MetricCard
              C={C}
              label="Signups · 7d"
              value={fmtInt(m.signups.last_7d)}
              sub={`${fmtInt(m.signups.total)} total`}
              delta={deltas?.signups ?? undefined}
              good="up"
            />
            <MetricCard
              C={C}
              label="Trades · 7d"
              value={fmtInt(m.trades.last_7d)}
              delta={deltas?.trades ?? undefined}
              good="up"
            />
            <MetricCard
              C={C}
              label="Waitlist · 7d"
              value={fmtInt(m.waitlist.last_7d)}
              sub={`${fmtInt(m.waitlist.total)} total`}
            />
            <MetricCard
              C={C}
              label="At-risk"
              value={fmtInt(m.dormant_activated)}
              sub="No trade in 14d"
              good="down"
            />
            <RunwayCard C={C} runway={m.runway} />
          </div>

          <RetentionCard C={C} rows={m.retention} />

          {/* Revenue scaffold */}
          {m.revenue.source !== "not_configured" && (
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
              <MetricCard
                C={C}
                label="MRR"
                value={fmtGbp(m.revenue.mrr_gbp)}
              />
              <MetricCard
                C={C}
                label="Active subs"
                value={fmtInt(m.revenue.active_subs)}
              />
            </div>
          )}

          {/* Footer note */}
          <div style={{ fontFamily: MONO, fontSize: 9.5, color: C.muted, letterSpacing: "0.06em", textAlign: "center", marginTop: 8 }}>
            ACTIVATION = ≥{m.activation_threshold} LOGGED TRADE{m.activation_threshold === 1 ? "" : "S"} · ALL DATA UTC
          </div>
        </div>
      )}
    </div>
  );
}
