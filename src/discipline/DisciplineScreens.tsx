import type { Theme } from "../theme";
import { MONO, BODY, DISPLAY, Card, Kicker, KodaMark } from "../shared";
import { SettingsSub, SectionLabel, MonoTag } from "../settings/SettingsScreens";

// ═══════════════════════════════════════════════════════════════════════════
// Discipline / intervention screens (cat08)
//
// Components:
//   • DisciplineRing — conic-gradient progress ring (used in cooldown + reviews)
//   • LiveMonitorScreen — 5 tilt signals + risk score
//   • CooldownScreen — short / medium / long variants
//   • TiltHistoryScreen — filtered history list
//   • WeeklyDisciplineReportScreen — score + by-day bars
//   • DisciplineScoreBreakdownScreen — what's in the score
//   • MonthlyReviewScreen — month summary
// ═══════════════════════════════════════════════════════════════════════════

// ─── Icons ──────────────────────────────────────────────────────────────────
function IconFlag({ c, s = 18 }: { c: string; s?: number }) { return <svg width={s} height={s} viewBox="0 0 24 24" fill="none"><path d="M5 21V4l13 4-13 4" stroke={c} strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" /></svg>; }
function IconChevR({ c, s = 16 }: { c: string; s?: number }) { return <svg width={s} height={s} viewBox="0 0 16 16" fill="none"><path d="M5 3l5 5-5 5" stroke={c} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" /></svg>; }

// ═══════════════════════════════════════════════════════════════════════════
// Discipline Ring — conic-gradient progress
// ═══════════════════════════════════════════════════════════════════════════

export function DisciplineRing({
  C, pct, size = 120, tone = "live", label, sub,
}: {
  C: Theme; pct: number; size?: number;
  tone?: "live" | "green" | "warn" | "red" | "accent";
  label: string; sub?: string;
}) {
  const c = C[tone];
  const safePct = Math.max(0, Math.min(100, pct));
  return (
    <div style={{
      width: size, height: size, borderRadius: "50%",
      background: `conic-gradient(${c} ${safePct * 3.6}deg, ${C.surfaceHi} 0)`,
      display: "flex", alignItems: "center", justifyContent: "center", position: "relative",
    }}>
      <div style={{
        position: "absolute", inset: 10, borderRadius: "50%",
        background: C.bg, display: "flex", flexDirection: "column",
        alignItems: "center", justifyContent: "center",
      }}>
        <div style={{
          fontFamily: DISPLAY, fontSize: size * 0.26, fontWeight: 600,
          color: c, letterSpacing: "-0.03em",
        }}>
          {label}
        </div>
        {sub && (
          <div style={{ fontFamily: MONO, fontSize: 8.5, color: C.muted, marginTop: 2, letterSpacing: "0.06em" }}>
            {sub}
          </div>
        )}
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════
// Generic progress bar
// ═══════════════════════════════════════════════════════════════════════════

function ProgressBar({
  C, pct, tone = "live", h = 6,
}: {
  C: Theme; pct: number;
  tone?: "live" | "green" | "warn" | "red" | "accent";
  h?: number;
}) {
  const c = C[tone];
  return (
    <div style={{
      width: "100%", height: h, borderRadius: 999,
      background: C.surfaceHi, overflow: "hidden",
    }}>
      <div style={{
        width: `${Math.max(0, Math.min(100, pct))}%`, height: "100%",
        background: c, borderRadius: 999, transition: "width 0.3s",
      }} />
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════
// 1 · Live monitor — 5 tilt signals + composite score
// ═══════════════════════════════════════════════════════════════════════════

export interface TiltSignal {
  id: string; label: string; detail: string;
  pct: number; tone: "live" | "green" | "warn" | "red" | "accent";
}

export function LiveMonitorScreen({
  C, sessionDuration = "1H 12M", riskScore = 38, riskLabel = "Elevated",
  riskDescription = "2 signals climbing. Stay with your plan.",
  signals,
}: {
  C: Theme;
  sessionDuration?: string;
  riskScore?: number;
  riskLabel?: string;
  riskDescription?: string;
  signals: TiltSignal[];
}) {
  const riskTone: "green" | "warn" | "red" =
    riskScore < 30 ? "green" : riskScore < 70 ? "warn" : "red";
  return (
    <div style={{
      minHeight: "100dvh", background: C.bg, color: C.text,
      padding: "22px 22px 60px", maxWidth: 600, margin: "0 auto", boxSizing: "border-box",
    }}>
      <div style={{
        display: "flex", alignItems: "center", justifyContent: "space-between",
        marginBottom: 6,
      }}>
        <div style={{ display: "flex", alignItems: "center", gap: 9 }}>
          <KodaMark size={20} color={C.text} />
          <span style={{ fontFamily: BODY, fontWeight: 600, fontSize: 14, letterSpacing: "0.22em", color: C.text }}>
            Kōda
          </span>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
          <span style={{ width: 8, height: 8, borderRadius: 99, background: C.live, boxShadow: `0 0 8px ${C.live}` }} />
          <span style={{ fontFamily: MONO, fontSize: 10, letterSpacing: "0.1em", color: C.live }}>
            LIVE · {sessionDuration}
          </span>
        </div>
      </div>
      <Card C={C} pad={18} style={{ marginTop: 14, position: "relative", overflow: "hidden" }}>
        <div style={{
          position: "absolute", top: -60, right: -50, width: 200, height: 200,
          borderRadius: "50%",
          background: `conic-gradient(from 200deg at 50% 50%, ${C.orb3}, ${C.accent}, ${C.orb2}, ${C.orb3})`,
          filter: "blur(46px)", opacity: 0.35, pointerEvents: "none",
        }} />
        <div style={{ position: "relative" }}>
          <Kicker C={C}>Session tilt risk</Kicker>
          <div style={{ display: "flex", alignItems: "center", gap: 16, marginTop: 12 }}>
            <DisciplineRing C={C} pct={riskScore} size={96} tone={riskTone} label={String(riskScore)} sub="OF 100" />
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontFamily: DISPLAY, fontSize: 16, fontWeight: 600, color: C.text }}>
                {riskLabel}
              </div>
              <div style={{ fontSize: 12, color: C.text2, marginTop: 4, lineHeight: 1.4, fontFamily: BODY }}>
                {riskDescription}
              </div>
            </div>
          </div>
        </div>
      </Card>
      <SectionLabel C={C}>5 signals</SectionLabel>
      <Card C={C} pad={16}>
        {signals.map((s, i) => (
          <div
            key={s.id}
            style={{
              padding: "12px 0", borderTop: i ? `1px solid ${C.line}` : "none",
            }}
          >
            <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 8 }}>
              <span style={{ fontSize: 13.5, color: C.text, fontFamily: BODY }}>{s.label}</span>
              <span style={{ fontFamily: MONO, fontSize: 10, color: C.muted }}>{s.detail}</span>
            </div>
            <ProgressBar C={C} pct={s.pct} tone={s.tone} h={6} />
          </div>
        ))}
      </Card>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════
// 2 · Cooldown — short / medium / long
// ═══════════════════════════════════════════════════════════════════════════

export type CooldownVariant = "short" | "medium" | "long";

const COOLDOWN_CONFIG: Record<CooldownVariant, {
  kicker: string; title: string;
  pct: number; ringLabel: string; ringSub: string;
  tone: "warn" | "red"; bg: string;
  body: string;
}> = {
  short: {
    kicker: "Intervention · short",
    title: "Take a breath.",
    pct: 70, ringLabel: "3:00", ringSub: "COOLDOWN",
    tone: "warn", bg: "warn",
    body: "You just took a loss and re-entered fast. A 3-minute pause resets the tilt.",
  },
  medium: {
    kicker: "Intervention · medium",
    title: "Step away.",
    pct: 80, ringLabel: "10:00", ringSub: "PAUSE",
    tone: "warn", bg: "warn",
    body: "You've taken three losses in a row. A 10-minute reset before the next entry.",
  },
  long: {
    kicker: "Intervention · lockout",
    title: "Done for now.",
    pct: 88, ringLabel: "30:00", ringSub: "LOCKED",
    tone: "red", bg: "red",
    body: "You hit your daily loss limit. Logging is locked for 30 minutes — the data says you do worse from here.",
  },
};

export function CooldownScreen({
  C, variant = "short", onLogFeeling, onReview,
}: {
  C: Theme; variant?: CooldownVariant;
  onLogFeeling?: () => void; onReview?: () => void;
}) {
  const cfg = COOLDOWN_CONFIG[variant];
  const bgTone = cfg.bg === "warn" ? C.warn : C.red;
  return (
    <div style={{
      minHeight: "100dvh", background: C.bg, color: C.text,
      position: "relative", overflow: "hidden",
    }}>
      <div style={{
        position: "absolute", inset: 0,
        background: `radial-gradient(120% 70% at 50% 30%, color-mix(in oklch, ${bgTone} 14%, transparent), ${C.bg} 70%)`,
      }} />
      <div style={{
        position: "relative", zIndex: 2, minHeight: "100dvh",
        display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center",
        padding: "72px 30px 40px", textAlign: "center", boxSizing: "border-box",
      }}>
        <Kicker C={C} color={cfg.tone === "warn" ? C.warn : C.red}>{cfg.kicker}</Kicker>
        <div style={{ margin: "24px 0" }}>
          <DisciplineRing C={C} pct={cfg.pct} size={170} tone={cfg.tone} label={cfg.ringLabel} sub={cfg.ringSub} />
        </div>
        <div style={{
          fontFamily: DISPLAY, fontSize: 24, fontWeight: 600,
          letterSpacing: "-0.02em", color: C.text, lineHeight: 1.1,
        }}>
          {cfg.title}
        </div>
        <div style={{
          fontSize: 13.5, color: C.text2, marginTop: 12, lineHeight: 1.55,
          maxWidth: "34ch", fontFamily: BODY,
        }}>
          {cfg.body}
        </div>
        <div style={{ marginTop: 26, width: "100%", maxWidth: 360 }}>
          {variant === "long" ? (
            <button
              onClick={onReview}
              style={{
                width: "100%", padding: "13px 22px", borderRadius: 999,
                background: "transparent", color: C.text, border: `1px solid ${C.border2}`,
                fontFamily: BODY, fontSize: 14, fontWeight: 600, cursor: "pointer",
              }}
            >
              Review today's trades
            </button>
          ) : (
            <button
              onClick={onLogFeeling}
              style={{
                width: "100%", padding: "13px 22px", borderRadius: 999,
                background: "transparent", color: C.text, border: `1px solid ${C.border2}`,
                fontFamily: BODY, fontSize: 14, fontWeight: 600, cursor: "pointer",
              }}
            >
              Log how you're feeling
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════
// 3 · Tilt history with filters
// ═══════════════════════════════════════════════════════════════════════════

export interface TiltHistoryItem {
  id: string; date: string; signal: string;
  outcome: string; toneKey?: "warn" | "red" | "live";
}

export function TiltHistoryScreen({
  C, items, filters, activeFilter = "All", onFilter, onItem, onBack,
}: {
  C: Theme;
  items: TiltHistoryItem[];
  filters: string[];
  activeFilter?: string;
  onFilter?: (f: string) => void;
  onItem?: (id: string) => void;
  onBack?: () => void;
}) {
  return (
    <SettingsSub C={C} title="Tilt history" onBack={onBack}>
      <div style={{ display: "flex", gap: 8, marginBottom: 14, overflowX: "auto", paddingBottom: 2 }}>
        {filters.map(f => {
          const on = activeFilter === f;
          return (
            <button
              key={f}
              onClick={() => onFilter?.(f)}
              style={{
                padding: "8px 16px", borderRadius: 999, whiteSpace: "nowrap",
                background: on ? C.accentSoft : "transparent",
                color: on ? C.accent : C.text,
                border: on
                  ? `1px solid color-mix(in oklch, ${C.accent} 40%, transparent)`
                  : `1px solid ${C.border2}`,
                fontFamily: BODY, fontSize: 13, fontWeight: 500, cursor: "pointer",
              }}
            >
              {f}
            </button>
          );
        })}
      </div>
      {items.map(item => (
        <Card C={C} pad={14} key={item.id} style={{ marginBottom: 8 }}>
          <button
            onClick={() => onItem?.(item.id)}
            style={{
              width: "100%", display: "flex", alignItems: "center", gap: 12,
              background: "transparent", border: "none", cursor: "pointer", textAlign: "left", padding: 0,
            }}
          >
            <span style={{
              width: 8, height: 8, borderRadius: "50%",
              background: item.toneKey ? C[item.toneKey] : C.muted,
              flexShrink: 0,
            }} />
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontSize: 13.5, fontWeight: 600, color: C.text, fontFamily: BODY }}>
                {item.signal}
              </div>
              <div style={{ fontFamily: MONO, fontSize: 9.5, color: C.muted, marginTop: 3, textTransform: "uppercase" }}>
                {item.date} · {item.outcome}
              </div>
            </div>
            <IconChevR c={C.muted} s={16} />
          </button>
        </Card>
      ))}
    </SettingsSub>
  );
}

// ═══════════════════════════════════════════════════════════════════════════
// 4 · Weekly discipline report
// ═══════════════════════════════════════════════════════════════════════════

export function WeeklyDisciplineReportScreen({
  C, score, weekLabel = "Wk 23", deltaFromLastWeek = 0,
  rulesKept = "0/0", interventions = "0", lockouts = "0",
  byDay = [],
  onBack,
}: {
  C: Theme;
  score: number;
  weekLabel?: string;
  deltaFromLastWeek?: number;
  rulesKept?: string;
  interventions?: string;
  lockouts?: string;
  byDay?: { day: string; score: number }[];
  onBack?: () => void;
}) {
  const tone: "green" | "warn" | "red" = score >= 80 ? "green" : score >= 60 ? "warn" : "red";
  return (
    <SettingsSub
      C={C} title="Weekly review" onBack={onBack}
      right={<MonoTag C={C} tone="live">{weekLabel}</MonoTag>}
    >
      <Card C={C} pad={20} style={{ position: "relative", overflow: "hidden", textAlign: "center" }}>
        <div style={{
          position: "absolute", top: -60, right: -50, width: 200, height: 200,
          borderRadius: "50%",
          background: `conic-gradient(from 200deg at 50% 50%, ${C.orb3}, ${C.accent}, ${C.orb2}, ${C.orb3})`,
          filter: "blur(46px)", opacity: 0.35, pointerEvents: "none",
        }} />
        <div style={{ position: "relative" }}>
          <Kicker C={C} color={C.live}>Discipline score</Kicker>
          <div style={{ display: "flex", justifyContent: "center", margin: "16px 0" }}>
            <DisciplineRing C={C} pct={score} size={132} tone={tone} label={String(score)} sub="THIS WEEK" />
          </div>
          <div style={{ fontSize: 13, color: C.text2, fontFamily: BODY }}>
            {deltaFromLastWeek > 0 ? `Up ${deltaFromLastWeek} pts from last week.` :
             deltaFromLastWeek < 0 ? `Down ${Math.abs(deltaFromLastWeek)} pts from last week.` :
             "Same as last week."}
          </div>
        </div>
      </Card>
      <div style={{ display: "flex", gap: 10, marginTop: 12 }}>
        {[
          { label: "Rules kept", value: rulesKept },
          { label: "Interventions", value: interventions },
          { label: "Lockouts", value: lockouts },
        ].map(s => (
          <div
            key={s.label}
            style={{
              flex: 1, padding: "14px 12px", borderRadius: 14,
              background: C.surface, border: `1px solid ${C.line}`, textAlign: "center",
            }}
          >
            <div style={{ fontFamily: MONO, fontSize: 9, color: C.muted, textTransform: "uppercase" }}>
              {s.label}
            </div>
            <div style={{ fontFamily: DISPLAY, fontSize: 19, fontWeight: 600, color: C.text, marginTop: 6 }}>
              {s.value}
            </div>
          </div>
        ))}
      </div>
      {byDay.length > 0 && (
        <>
          <SectionLabel C={C}>By day</SectionLabel>
          <Card C={C} pad={16}>
            <div style={{ display: "flex", alignItems: "flex-end", gap: 8, height: 90 }}>
              {byDay.map((d, i) => (
                <div key={i} style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", gap: 6, height: "100%" }}>
                  <div style={{ flex: 1, display: "flex", alignItems: "flex-end", width: "100%" }}>
                    <div style={{
                      width: "100%", height: d.score ? `${d.score * 0.8}%` : "4%",
                      borderRadius: 6,
                      background: d.score ? (d.score >= 80 ? C.green : d.score >= 60 ? C.warn : C.red) : C.surfaceHi,
                      transition: "height 0.3s",
                    }} />
                  </div>
                  <span style={{ fontFamily: MONO, fontSize: 9, color: C.muted }}>{d.day}</span>
                </div>
              ))}
            </div>
          </Card>
        </>
      )}
    </SettingsSub>
  );
}

// ═══════════════════════════════════════════════════════════════════════════
// 5 · Score breakdown
// ═══════════════════════════════════════════════════════════════════════════

export interface ScoreLineItem {
  label: string; points: string;     // "+38"
  detail: string;                    // "92% of trades"
  pct: number;
  tone: "green" | "warn" | "red";
}

export function DisciplineScoreBreakdownScreen({
  C, score, grade = "A", period = "this month",
  lines, onBack,
}: {
  C: Theme; score: number; grade?: string; period?: string;
  lines: ScoreLineItem[];
  onBack?: () => void;
}) {
  const tone: "green" | "warn" | "red" = score >= 80 ? "green" : score >= 60 ? "warn" : "red";
  return (
    <SettingsSub C={C} title="Discipline score" onBack={onBack}>
      <Card C={C} pad={20} style={{ textAlign: "center" }}>
        <div style={{ display: "flex", justifyContent: "center", margin: "8px 0 14px" }}>
          <DisciplineRing
            C={C} pct={score} size={140} tone={tone}
            label={String(score)}
            sub={`${grade} · ${period.toUpperCase()}`}
          />
        </div>
      </Card>
      <SectionLabel C={C}>What's in the score</SectionLabel>
      <Card C={C} pad={16}>
        {lines.map((line, i) => (
          <div
            key={i}
            style={{
              padding: "12px 0", borderTop: i ? `1px solid ${C.line}` : "none",
            }}
          >
            <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 8 }}>
              <span style={{ fontSize: 13.5, color: C.text, fontFamily: BODY }}>
                {line.label}{" "}
                <span style={{ fontFamily: MONO, fontSize: 10, color: C.green }}>{line.points}</span>
              </span>
              <span style={{ fontFamily: MONO, fontSize: 10, color: C.muted }}>{line.detail}</span>
            </div>
            <ProgressBar C={C} pct={line.pct} tone={line.tone} h={6} />
          </div>
        ))}
      </Card>
    </SettingsSub>
  );
}

// ═══════════════════════════════════════════════════════════════════════════
// 6 · Monthly review
// ═══════════════════════════════════════════════════════════════════════════

export interface MonthlySetup {
  label: string; name: string; value: string; positive: boolean;
}

export function MonthlyReviewScreen({
  C, month = "May 2026", net = "+0R", tradeCount = 0, winRate = "—",
  setups = [],
  topMistakeLabel, topMistakeDetail,
  onBack,
}: {
  C: Theme;
  month?: string; net?: string; tradeCount?: number; winRate?: string;
  setups?: MonthlySetup[];
  topMistakeLabel?: string; topMistakeDetail?: string;
  onBack?: () => void;
}) {
  return (
    <SettingsSub
      C={C} title="Monthly review" onBack={onBack}
      right={<MonoTag C={C} tone="live">{month.split(" ")[0]}</MonoTag>}
    >
      <Card C={C} pad={20} style={{ position: "relative", overflow: "hidden" }}>
        <div style={{
          position: "absolute", top: -60, right: -50, width: 200, height: 200,
          borderRadius: "50%",
          background: `conic-gradient(from 200deg at 50% 50%, ${C.orb3}, ${C.accent}, ${C.orb2}, ${C.orb3})`,
          filter: "blur(46px)", opacity: 0.4, pointerEvents: "none",
        }} />
        <div style={{ position: "relative" }}>
          <Kicker C={C} color={C.live}>{month} · in review</Kicker>
          <div style={{
            fontFamily: DISPLAY, fontSize: 40, fontWeight: 600,
            letterSpacing: "-0.04em", color: net.startsWith("+") ? C.green : C.red, marginTop: 12,
          }}>
            {net}
          </div>
          <div style={{ fontSize: 13, color: C.text2, marginTop: 4, fontFamily: BODY }}>
            across {tradeCount.toLocaleString()} trades · {winRate} win rate
          </div>
        </div>
      </Card>
      {setups.length > 0 && (
        <div style={{ display: "flex", gap: 10, marginTop: 12 }}>
          {setups.map(s => (
            <Card C={C} pad={16} key={s.label} style={{ flex: 1 }}>
              <div style={{ fontFamily: MONO, fontSize: 9, color: C.muted, textTransform: "uppercase" }}>
                {s.label}
              </div>
              <div style={{ fontSize: 15, fontWeight: 600, color: C.text, marginTop: 6, fontFamily: BODY }}>
                {s.name}
              </div>
              <div style={{
                fontFamily: DISPLAY, fontSize: 16, fontWeight: 600,
                color: s.positive ? C.green : C.red, marginTop: 4,
              }}>
                {s.value}
              </div>
            </Card>
          ))}
        </div>
      )}
      {topMistakeLabel && (
        <>
          <SectionLabel C={C}>Top mistake</SectionLabel>
          <Card C={C} pad={16}>
            <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
              <div style={{
                width: 34, height: 34, borderRadius: 9, background: C.redSoft,
                display: "flex", alignItems: "center", justifyContent: "center",
              }}>
                <IconFlag c={C.red} s={18} />
              </div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: 13.5, color: C.text, fontFamily: BODY }}>{topMistakeLabel}</div>
                {topMistakeDetail && (
                  <div style={{ fontFamily: MONO, fontSize: 9.5, color: C.muted, marginTop: 2, textTransform: "uppercase" }}>
                    {topMistakeDetail}
                  </div>
                )}
              </div>
            </div>
          </Card>
        </>
      )}
    </SettingsSub>
  );
}
