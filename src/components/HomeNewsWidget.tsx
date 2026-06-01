// ═══════════════════════════════════════════════════════════════════════════════
// Kōda · HomeNewsWidget
//
// Hero card (next high-impact event + countdown) + horizontal week strip.
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

  const upcoming = useMemo<CalendarEvent[]>(() => {
    const events = calendar?.items ?? [];
    return events
      .filter(e => new Date(e.time).getTime() > now)
      .sort((a, b) => new Date(a.time).getTime() - new Date(b.time).getTime());
  }, [calendar, now]);

  const hero = useMemo<CalendarEvent | null>(() => {
    const high = upcoming.find(e => e.impact === "high");
    return high ?? upcoming[0] ?? null;
  }, [upcoming]);

  const strip = useMemo<CalendarEvent[]>(() => {
    if (!hero) return [];
    return upcoming.filter(e => e.id !== hero.id).slice(0, 6);
  }, [upcoming, hero]);

  if (!hero) {
    return (
      <div
        style={{
          padding: "14px",
          background: C.panel,
          border: `1px solid ${C.border}`,
          borderRadius: 12,
          color: C.muted,
          fontFamily: MONO,
          fontSize: 12,
          textAlign: "center",
        }}
      >
        News loading — check back in a few minutes.
      </div>
    );
  }

  const heroColor = impactColor(C, hero.impact);
  const countdownMs = new Date(hero.time).getTime() - now;

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
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
          <span style={{ fontFamily: MONO, fontSize: 9, letterSpacing: "0.1em", color: C.muted }}>
            NEXT EVENT
          </span>
          <span
            style={{
              fontFamily: MONO,
              fontSize: 9,
              letterSpacing: "0.08em",
              color: heroColor,
            }}
          >
            ● {hero.impact.toUpperCase()}
          </span>
        </div>
        <div style={{ fontSize: 17, fontWeight: 700, marginBottom: 6 }}>{hero.title}</div>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline" }}>
          <span style={{ fontFamily: MONO, fontSize: 22, letterSpacing: "-0.02em" }}>
            {formatCountdown(countdownMs)}
          </span>
          <span style={{ fontSize: 11, color: C.muted }}>
            {formatLocalDayTime(hero.time)}
          </span>
        </div>
      </button>

      {strip.length > 0 && (
        <div
          data-testid="home-news-strip"
          onClick={onOpenNews}
          style={{
            display: "flex",
            gap: 6,
            overflowX: "auto",
            paddingBottom: 4,
            cursor: "pointer",
          }}
        >
          {strip.map(ev => {
            const c = impactColor(C, ev.impact);
            return (
              <div
                key={ev.id}
                style={{
                  minWidth: 88,
                  background: C.panel,
                  border: `1px solid ${C.border}`,
                  borderTop: `2px solid ${c}`,
                  borderRadius: 8,
                  padding: 8,
                  color: C.text,
                }}
              >
                <div style={{ fontFamily: MONO, fontSize: 9, color: C.muted }}>
                  {formatLocalDayTime(ev.time)}
                </div>
                <div style={{ fontSize: 10, marginTop: 4, lineHeight: 1.2, fontWeight: 600 }}>
                  {ev.title}
                </div>
                <div
                  style={{
                    fontSize: 8,
                    marginTop: 6,
                    letterSpacing: "0.08em",
                    color: c,
                  }}
                >
                  {ev.impact.toUpperCase()}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
