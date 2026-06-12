// ═══════════════════════════════════════════════════════════════════════════════
// Kōda · HomeNewsWidget
//
// Hero card (next high-or-medium impact event + countdown).
// Mounted on the main Home feed view. Tapping anywhere opens the full News page.
// ═══════════════════════════════════════════════════════════════════════════════

import { useEffect, useMemo, useState } from "react";
import type { Theme } from "../theme";
import { MONO } from "../shared";
import { useNews } from "../hooks/useNews";
import type { CalendarEvent, Impact } from "../lib/news";

interface Props {
  C: Theme;
  onOpenNews: () => void;
}

function impactColor(C: Theme, impact: Impact): string {
  if (impact === "high")   return C.red;
  if (impact === "medium") return C.warn;
  return C.muted;
}

function formatLocalDayTime(iso: string): string {
  const d = new Date(iso);
  const day = d.toLocaleDateString(undefined, { weekday: "short" }).toUpperCase();
  const time = d.toLocaleTimeString(undefined, { hour: "2-digit", minute: "2-digit" });
  return `${day} ${time}`;
}

function formatCountdown(ms: number): string {
  if (ms <= 0) return "Now";
  const totalMin = Math.floor(ms / 60_000);
  const h = Math.floor(totalMin / 60);
  const m = totalMin % 60;
  if (h >= 24) {
    const days = Math.floor(h / 24);
    const remHours = h % 24;
    return `${days}d ${remHours}h`;
  }
  return `${h}h ${m}m`;
}

export function HomeNewsWidget({ C, onOpenNews }: Props) {
  const { calendar } = useNews();
  const [now, setNow] = useState<number>(() => Date.now());

  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 60_000);
    return () => clearInterval(id);
  }, []);

  const hero = useMemo<CalendarEvent | null>(() => {
    const events = calendar?.items ?? [];
    return (
      events
        .filter(e => e.impact === "high" || e.impact === "medium")
        .filter(e => new Date(e.time).getTime() > now)
        .sort((a, b) => new Date(a.time).getTime() - new Date(b.time).getTime())[0] ?? null
    );
  }, [calendar, now]);

  if (!hero) {
    const message = calendar
      ? "All US events done for today — check back tomorrow."
      : "Loading news...";
    return (
      <div
        style={{
          padding: "14px",
          background: C.panel,
          border: `1px solid ${C.border}`,
          borderRadius: 12,
          color: C.muted,
          fontFamily: MONO,
          fontSize: "0.75rem",
          textAlign: "center",
        }}
      >
        {message}
      </div>
    );
  }

  const heroColor = impactColor(C, hero.impact);
  const countdownMs = new Date(hero.time).getTime() - now;

  return (
    <button
      type="button"
      data-testid="home-news-hero"
      onClick={onOpenNews}
      style={{
        textAlign: "left",
        background: C.panel,
        border: `1px solid ${C.border}`,
        borderRadius: 12,
        padding: 14,
        cursor: "pointer",
        color: C.text,
        width: "100%",
      }}
    >
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          marginBottom: 6,
        }}
      >
        <span style={{ fontFamily: MONO, fontSize: "0.5625rem", letterSpacing: "0.1em", color: C.muted }}>
          NEXT HIGH/MED EVENT
        </span>
        <span
          style={{
            fontFamily: MONO,
            fontSize: "0.5625rem",
            letterSpacing: "0.08em",
            color: heroColor,
          }}
        >
          ● {hero.impact.toUpperCase()}
        </span>
      </div>
      <div style={{ fontSize: "1.0625rem", fontWeight: 700, marginBottom: 6 }}>{hero.title}</div>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline" }}>
        <span style={{ fontFamily: MONO, fontSize: "1.375rem", letterSpacing: "-0.02em" }}>
          {formatCountdown(countdownMs)}
        </span>
        <span style={{ fontSize: "0.6875rem", color: C.muted }}>
          {formatLocalDayTime(hero.time)}
        </span>
      </div>
    </button>
  );
}
