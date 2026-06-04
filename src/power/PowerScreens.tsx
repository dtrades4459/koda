import { useState } from "react";
import type React from "react";
import type { Theme } from "../theme";
import { MONO, BODY, DISPLAY, Card, Kicker, KodaMark, GhostWord, GlassOrb } from "../shared";
import { SettingsSub, SectionLabel, MonoTag } from "../settings/SettingsScreens";

// ═══════════════════════════════════════════════════════════════════════════
// Power feature screens (cat09)
//
// Components:
//   • CustomContractEditorScreen — list + add custom future contracts
//   • EvalAccountCreateScreen — prop firm eval setup wizard
//   • EvalResetPromptModal — breach / reset modal
//   • PreTradeChecklistEditorScreen — drag-to-reorder rules
//   • ReportCardIGSquare — 540×540 shareable share card
//   • ReportCardXLandscape — 600×338 shareable card
//   • YearInReviewCard — 540×540 annual recap
// ═══════════════════════════════════════════════════════════════════════════

function IconPlus({ c, s = 18 }: { c: string; s?: number }) { return <svg width={s} height={s} viewBox="0 0 24 24" fill="none"><path d="M12 5v14M5 12h14" stroke={c} strokeWidth="1.8" strokeLinecap="round" /></svg>; }
function IconChevR({ c, s = 16 }: { c: string; s?: number }) { return <svg width={s} height={s} viewBox="0 0 16 16" fill="none"><path d="M5 3l5 5-5 5" stroke={c} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" /></svg>; }
function IconGrid({ c, s = 16 }: { c: string; s?: number }) { return <svg width={s} height={s} viewBox="0 0 24 24" fill="none"><line x1="8" y1="6" x2="8" y2="18" stroke={c} strokeWidth="1.6" strokeLinecap="round" /><line x1="16" y1="6" x2="16" y2="18" stroke={c} strokeWidth="1.6" strokeLinecap="round" /></svg>; }
function IconAlert({ c, s = 26 }: { c: string; s?: number }) { return <svg width={s} height={s} viewBox="0 0 24 24" fill="none"><path d="M12 9v5M12 17h.01" stroke={c} strokeWidth="2" strokeLinecap="round" /><circle cx="12" cy="12" r="9" stroke={c} strokeWidth="1.5" /></svg>; }

// ═══════════════════════════════════════════════════════════════════════════
// 1 · Custom contract editor
// ═══════════════════════════════════════════════════════════════════════════

export interface ContractDef {
  id: string; symbol: string; name: string;
  tickValue: string; tickIncrement: string;
  custom?: boolean;
}

export function CustomContractEditorScreen({
  C, contracts, onEdit, onAdd, onBack,
}: {
  C: Theme; contracts: ContractDef[];
  onEdit?: (id: string) => void; onAdd?: () => void; onBack?: () => void;
}) {
  return (
    <SettingsSub
      C={C} title="Contracts" onBack={onBack}
      right={
        <button
          onClick={onAdd}
          aria-label="Add contract"
          style={{
            width: 36, height: 36, borderRadius: 999,
            background: C.live,
            display: "flex", alignItems: "center", justifyContent: "center",
            border: "none", cursor: "pointer", padding: 0,
          }}
        >
          <IconPlus c="#0A0A0B" s={18} />
        </button>
      }
    >
      <div style={{ fontSize: 13, color: C.text2, marginBottom: 14, lineHeight: 1.5, fontFamily: BODY }}>
        Tick value + size per contract powers the lot calculator.
      </div>
      {contracts.map(c => (
        <Card C={C} pad={14} key={c.id} style={{ marginBottom: 8 }}>
          <button
            onClick={() => onEdit?.(c.id)}
            style={{
              width: "100%", display: "flex", alignItems: "center", gap: 12,
              background: "transparent", border: "none", cursor: "pointer", textAlign: "left", padding: 0,
            }}
          >
            <div style={{
              width: 40, height: 40, borderRadius: 10,
              background: C.surfaceHi, border: `1px solid ${C.border2}`,
              display: "flex", alignItems: "center", justifyContent: "center",
              fontFamily: DISPLAY, fontWeight: 600, fontSize: 13, color: C.text,
            }}>
              {c.symbol}
            </div>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontSize: 13.5, fontWeight: 600, color: C.text, fontFamily: BODY }}>
                {c.name}
              </div>
              <div style={{ fontFamily: MONO, fontSize: 9.5, color: C.muted, marginTop: 2 }}>
                TICK {c.tickValue} · INC {c.tickIncrement}
              </div>
            </div>
            {c.custom && <MonoTag C={C} tone="accent">Custom</MonoTag>}
            <IconChevR c={C.muted} s={16} />
          </button>
        </Card>
      ))}
      <button
        onClick={onAdd}
        style={{
          padding: "14px 16px", borderRadius: 14,
          background: "transparent", border: `1.5px dashed ${C.line3}`,
          color: C.live, width: "100%", cursor: "pointer",
          display: "flex", alignItems: "center", justifyContent: "center", gap: 8,
          fontFamily: BODY, fontSize: 13.5,
        }}
      >
        <IconPlus c={C.live} s={18} /> Add custom contract
      </button>
    </SettingsSub>
  );
}

// ═══════════════════════════════════════════════════════════════════════════
// 2 · Eval account creation
// ═══════════════════════════════════════════════════════════════════════════

export const PROP_FIRMS = ["Apex", "TopstepX", "FTMO", "MyForexFunds", "Other"];

export function EvalAccountCreateScreen({
  C, onStart, onBack,
}: {
  C: Theme;
  onStart?: (form: {
    firm: string; balance: string; profitTarget: string;
    dailyLoss: string; maxDrawdown: string;
  }) => void;
  onBack?: () => void;
}) {
  const [firm, setFirm] = useState(PROP_FIRMS[0]);
  const [balance, setBalance] = useState("");
  const [profitTarget, setProfitTarget] = useState("");
  const [dailyLoss, setDailyLoss] = useState("");
  const [maxDrawdown, setMaxDrawdown] = useState("");
  const valid = balance && profitTarget && dailyLoss && maxDrawdown;

  return (
    <SettingsSub C={C} title="New eval account" onBack={onBack}>
      <Card C={C} pad={18} style={{ position: "relative", overflow: "hidden" }}>
        <div style={{
          position: "absolute", top: -60, right: -50, width: 200, height: 200,
          borderRadius: "50%",
          background: `conic-gradient(from 200deg at 50% 50%, ${C.orb3}, ${C.accent}, ${C.orb2}, ${C.orb3})`,
          filter: "blur(46px)", opacity: 0.4, pointerEvents: "none",
        }} />
        <div style={{ position: "relative" }}>
          <Kicker C={C} color={C.live}>Prop firm mode</Kicker>
          <div style={{
            fontFamily: DISPLAY, fontSize: 20, fontWeight: 600, color: C.text, marginTop: 10,
          }}>
            Track your challenge.
          </div>
        </div>
      </Card>
      <SectionLabel C={C}>Firm</SectionLabel>
      <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
        {PROP_FIRMS.map(f => {
          const on = firm === f;
          return (
            <button
              key={f}
              onClick={() => setFirm(f)}
              style={{
                padding: "8px 16px", borderRadius: 999,
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
      <SectionLabel C={C}>Parameters</SectionLabel>
      <div style={{ display: "flex", gap: 10 }}>
        <MoneyField C={C} label="Balance" value={balance} onChange={setBalance} />
        <MoneyField C={C} label="Profit target" value={profitTarget} onChange={setProfitTarget} />
      </div>
      <div style={{ display: "flex", gap: 10, marginTop: 14 }}>
        <MoneyField C={C} label="Daily loss" value={dailyLoss} onChange={setDailyLoss} />
        <MoneyField C={C} label="Max drawdown" value={maxDrawdown} onChange={setMaxDrawdown} />
      </div>
      <div style={{ marginTop: 24 }}>
        <button
          onClick={() => onStart?.({ firm, balance, profitTarget, dailyLoss, maxDrawdown })}
          disabled={!valid}
          style={{
            padding: "13px 22px", borderRadius: 999,
            background: valid ? C.live : C.panel,
            color: valid ? "#0A0A0A" : C.text2,
            border: "none", fontFamily: BODY, fontSize: 14, fontWeight: 600,
            width: "100%", cursor: valid ? "pointer" : "not-allowed",
          }}
        >
          Start tracking
        </button>
      </div>
    </SettingsSub>
  );
}

function MoneyField({
  C, label, value, onChange,
}: {
  C: Theme; label: string; value: string;
  onChange?: (v: string) => void;
}) {
  return (
    <div style={{ flex: 1 }}>
      <div style={{
        fontFamily: MONO, fontSize: 9.5, letterSpacing: "0.16em",
        color: C.muted, textTransform: "uppercase", marginBottom: 8,
      }}>
        {label}
      </div>
      <div style={{
        display: "flex", alignItems: "center",
        borderBottom: `1px solid ${value ? C.live : C.border2}`, padding: "10px 0",
      }}>
        <input
          value={value}
          onChange={(e) => onChange?.(e.target.value)}
          placeholder="$0"
          inputMode="numeric"
          style={{
            flex: 1, background: "transparent", border: "none", outline: "none",
            fontFamily: MONO, fontSize: 16, color: C.text,
            letterSpacing: "0.04em", padding: 0,
          }}
        />
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════
// 3 · Eval reset prompt (breach modal)
// ═══════════════════════════════════════════════════════════════════════════

export function EvalResetPromptModal({
  C, accountLabel = "your account", onReset, onKeepFailed,
}: {
  C: Theme; accountLabel?: string;
  onReset?: () => void; onKeepFailed?: () => void;
}) {
  return (
    <div
      role="dialog"
      aria-modal="true"
      style={{
        position: "fixed", inset: 0, zIndex: 9000,
        background: "rgba(10,10,11,0.72)",
        backdropFilter: "blur(6px)", WebkitBackdropFilter: "blur(6px)",
        display: "flex", alignItems: "center", justifyContent: "center",
        padding: 22, animation: "kFadeIn 0.22s ease-out",
      }}
    >
      <div
        style={{
          width: "100%", maxWidth: 380, borderRadius: 24,
          background: C.panel, border: `1px solid ${C.border2}`,
          padding: 24, textAlign: "center",
          animation: "kRise 0.32s cubic-bezier(.2,.8,.2,1)",
        }}
      >
        <div style={{
          width: 56, height: 56, borderRadius: 999, background: C.redSoft,
          display: "flex", alignItems: "center", justifyContent: "center",
          margin: "0 auto 18px",
        }}>
          <IconAlert c={C.red} s={26} />
        </div>
        <div style={{ fontFamily: DISPLAY, fontSize: 21, fontWeight: 600, color: C.text }}>
          Account breached
        </div>
        <div style={{ fontSize: 13.5, color: C.text2, marginTop: 10, lineHeight: 1.55, fontFamily: BODY }}>
          You hit the max drawdown on {accountLabel}. Reset to track a fresh challenge — your trade history is kept.
        </div>
        <div style={{ display: "flex", flexDirection: "column", gap: 10, marginTop: 22 }}>
          <button
            onClick={onReset}
            style={{
              padding: "13px 22px", borderRadius: 999,
              background: C.live, color: "#0A0A0A", border: "none",
              fontFamily: BODY, fontSize: 14, fontWeight: 600, cursor: "pointer", width: "100%",
            }}
          >
            Reset & start over
          </button>
          <button
            onClick={onKeepFailed}
            style={{
              padding: "13px 22px", borderRadius: 999,
              background: "transparent", color: C.text, border: `1px solid ${C.border2}`,
              fontFamily: BODY, fontSize: 14, fontWeight: 600, cursor: "pointer", width: "100%",
            }}
          >
            Keep as failed
          </button>
        </div>
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════
// 4 · Pre-trade checklist editor
// ═══════════════════════════════════════════════════════════════════════════

export interface ChecklistRule { id: string; label: string; enabled: boolean; }

export function PreTradeChecklistEditorScreen({
  C, rules, onToggle, onReorder, onAdd, onEditRule, onBack,
}: {
  C: Theme; rules: ChecklistRule[];
  onToggle?: (id: string, enabled: boolean) => void;
  onReorder?: (fromId: string, toId: string) => void;
  onAdd?: () => void;
  onEditRule?: (id: string) => void;
  onBack?: () => void;
}) {
  const [draggedId, setDraggedId] = useState<string | null>(null);
  return (
    <SettingsSub
      C={C} title="Pre-trade rules" onBack={onBack}
      right={<MonoTag C={C} tone="live">Edit</MonoTag>}
    >
      <div style={{ fontSize: 13, color: C.text2, marginBottom: 14, lineHeight: 1.5, fontFamily: BODY }}>
        Drag to reorder. These show before every session.
      </div>
      {rules.map(rule => (
        <Card
          C={C}
          pad={14}
          key={rule.id}
          style={{
            marginBottom: 8,
            opacity: draggedId === rule.id ? 0.5 : 1,
            transition: "opacity 0.15s",
          }}
        >
          <div
            draggable
            onDragStart={() => setDraggedId(rule.id)}
            onDragEnd={() => setDraggedId(null)}
            onDragOver={(e) => e.preventDefault()}
            onDrop={() => {
              if (draggedId && draggedId !== rule.id) {
                onReorder?.(draggedId, rule.id);
              }
              setDraggedId(null);
            }}
            style={{ display: "flex", alignItems: "center", gap: 12, cursor: "grab" }}
          >
            <IconGrid c={C.muted} s={16} />
            <button
              onClick={() => onEditRule?.(rule.id)}
              style={{
                flex: 1, fontSize: 14, color: C.text, fontFamily: BODY,
                background: "transparent", border: "none", cursor: "pointer", textAlign: "left", padding: 0,
              }}
            >
              {rule.label}
            </button>
            <button
              type="button"
              role="switch"
              aria-checked={rule.enabled}
              onClick={() => onToggle?.(rule.id, !rule.enabled)}
              style={{
                width: 42, height: 26, borderRadius: 999,
                background: rule.enabled ? C.live : C.surfaceHi,
                border: `1px solid ${rule.enabled ? "transparent" : C.border2}`,
                position: "relative", cursor: "pointer", flexShrink: 0, padding: 0,
                transition: "background 0.2s",
              }}
            >
              <span style={{
                position: "absolute", top: 2, left: rule.enabled ? 18 : 2,
                width: 20, height: 20, borderRadius: 999,
                background: rule.enabled ? "#0A0A0B" : C.text2,
                transition: "left 0.2s",
              }} />
            </button>
          </div>
        </Card>
      ))}
      <button
        onClick={onAdd}
        style={{
          padding: "14px 16px", borderRadius: 14,
          background: "transparent", border: `1.5px dashed ${C.line3}`,
          color: C.live, width: "100%", cursor: "pointer",
          display: "flex", alignItems: "center", justifyContent: "center", gap: 8,
          fontFamily: BODY, fontSize: 13.5,
        }}
      >
        <IconPlus c={C.live} s={16} /> Add rule
      </button>
    </SettingsSub>
  );
}

// ═══════════════════════════════════════════════════════════════════════════
// 5 / 6 · Report cards — share images
// ═══════════════════════════════════════════════════════════════════════════

function ShareCardFrame({
  C, width, height, children,
}: {
  C: Theme; width: number; height: number; children: React.ReactNode;
}) {
  return (
    <div
      style={{
        width, height, background: C.bg,
        position: "relative", overflow: "hidden",
        fontFamily: DISPLAY,
      }}
    >
      <GlassOrb C={C} color={C.orb1} size={Math.round(width * 0.7)} top={-Math.round(width * 0.2)} right={-Math.round(width * 0.15)} opacity={0.3} />
      <GlassOrb C={C} color={C.orb3} size={Math.round(width * 0.5)} bottom={-Math.round(width * 0.15)} left={-Math.round(width * 0.1)} opacity={0.22} />
      <div style={{ position: "relative", zIndex: 2, height: "100%", boxSizing: "border-box" }}>
        {children}
      </div>
    </div>
  );
}

export function ReportCardIGSquare({
  C, weekLabel = "WEEK 23",
  net = "+0R", winRate = "0%", trades = "0", discipline = "0%",
  handle = "@you",
  highlightWord = "EDGE",
}: {
  C: Theme;
  weekLabel?: string;
  net?: string; winRate?: string; trades?: string; discipline?: string;
  handle?: string; highlightWord?: string;
}) {
  return (
    <ShareCardFrame C={C} width={540} height={540}>
      <div style={{ padding: 40, height: "100%", display: "flex", flexDirection: "column", boxSizing: "border-box" }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 9 }}>
            <KodaMark size={22} color={C.text} />
            <span style={{ fontFamily: BODY, fontWeight: 600, fontSize: 16, letterSpacing: "0.22em", color: C.text }}>
              Kōda
            </span>
          </div>
          <span style={{ fontFamily: MONO, fontSize: 11, letterSpacing: "0.14em", color: C.muted }}>
            {weekLabel}
          </span>
        </div>
        <GhostWord C={C} word={highlightWord} fontSize={150} bottom={40} right={-20} align="right" isDark />
        <div style={{ flex: 1, display: "flex", flexDirection: "column", justifyContent: "center", position: "relative", zIndex: 1 }}>
          <div style={{ fontFamily: MONO, fontSize: 12, letterSpacing: "0.16em", color: C.live }}>
            NET THIS WEEK
          </div>
          <div style={{
            fontFamily: DISPLAY, fontSize: 96, fontWeight: 700,
            letterSpacing: "-0.05em",
            color: net.startsWith("-") ? C.red : C.green,
            lineHeight: 0.9, marginTop: 8,
          }}>
            {net}
          </div>
          <div style={{ display: "flex", gap: 28, marginTop: 28 }}>
            {[
              { label: "Win rate", value: winRate },
              { label: "Trades", value: trades },
              { label: "Discipline", value: discipline },
            ].map(s => (
              <div key={s.label}>
                <div style={{
                  fontFamily: MONO, fontSize: 10, letterSpacing: "0.1em",
                  color: C.muted, textTransform: "uppercase",
                }}>
                  {s.label}
                </div>
                <div style={{
                  fontFamily: DISPLAY, fontSize: 26, fontWeight: 600,
                  color: C.text, marginTop: 4,
                }}>
                  {s.value}
                </div>
              </div>
            ))}
          </div>
        </div>
        <div style={{
          fontFamily: MONO, fontSize: 11, letterSpacing: "0.12em",
          color: C.muted, textTransform: "uppercase",
        }}>
          {handle} · KODATRADE.CO.UK
        </div>
      </div>
    </ShareCardFrame>
  );
}

export function ReportCardXLandscape({
  C, weekLabel = "WEEK 23",
  net = "+0R", winRate = "0%", trades = "0", discipline = "0%", bestSetup = "—",
  handle = "@you",
}: {
  C: Theme;
  weekLabel?: string;
  net?: string; winRate?: string; trades?: string; discipline?: string; bestSetup?: string;
  handle?: string;
}) {
  return (
    <ShareCardFrame C={C} width={600} height={338}>
      <div style={{ padding: 36, height: "100%", display: "flex", boxSizing: "border-box" }}>
        <div style={{ flex: 1, display: "flex", flexDirection: "column", justifyContent: "space-between" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 9 }}>
            <KodaMark size={20} color={C.text} />
            <span style={{ fontFamily: BODY, fontWeight: 600, fontSize: 14, letterSpacing: "0.22em", color: C.text }}>
              Kōda
            </span>
          </div>
          <div>
            <div style={{ fontFamily: MONO, fontSize: 11, letterSpacing: "0.16em", color: C.live }}>
              NET · {weekLabel}
            </div>
            <div style={{
              fontFamily: DISPLAY, fontSize: 72, fontWeight: 700,
              letterSpacing: "-0.05em",
              color: net.startsWith("-") ? C.red : C.green,
              lineHeight: 0.9, marginTop: 6,
            }}>
              {net}
            </div>
          </div>
          <div style={{
            fontFamily: MONO, fontSize: 10, letterSpacing: "0.12em",
            color: C.muted, textTransform: "uppercase",
          }}>
            {handle} · KODATRADE.CO.UK
          </div>
        </div>
        <div style={{ width: 1, background: C.border2, margin: "0 28px" }} />
        <div style={{
          display: "flex", flexDirection: "column", justifyContent: "center", gap: 20,
        }}>
          {[
            { label: "Win rate", value: winRate },
            { label: "Trades", value: trades },
            { label: "Discipline", value: discipline },
            { label: "Best", value: bestSetup },
          ].map(s => (
            <div key={s.label}>
              <div style={{
                fontFamily: MONO, fontSize: 9, letterSpacing: "0.1em",
                color: C.muted, textTransform: "uppercase",
              }}>
                {s.label}
              </div>
              <div style={{
                fontFamily: DISPLAY, fontSize: 22, fontWeight: 600,
                color: C.text, marginTop: 2,
              }}>
                {s.value}
              </div>
            </div>
          ))}
        </div>
      </div>
    </ShareCardFrame>
  );
}

// ═══════════════════════════════════════════════════════════════════════════
// 7 · Year-in-review card
// ═══════════════════════════════════════════════════════════════════════════

export function YearInReviewCard({
  C, year = "2026",
  tradesLogged = "0", net = "+0R", bestMonth = "—", discipline = "0%",
  handle = "@you",
}: {
  C: Theme;
  year?: string;
  tradesLogged?: string; net?: string; bestMonth?: string; discipline?: string;
  handle?: string;
}) {
  return (
    <ShareCardFrame C={C} width={540} height={540}>
      <div style={{ padding: 40, height: "100%", display: "flex", flexDirection: "column", boxSizing: "border-box" }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 9 }}>
            <KodaMark size={22} color={C.text} />
            <span style={{ fontFamily: BODY, fontWeight: 600, fontSize: 16, letterSpacing: "0.22em", color: C.text }}>
              Kōda
            </span>
          </div>
          <span style={{ fontFamily: MONO, fontSize: 11, letterSpacing: "0.14em", color: C.muted }}>
            {year}
          </span>
        </div>
        <GhostWord C={C} word={year} fontSize={170} bottom={30} left={-10} isDark />
        <div style={{ flex: 1, display: "flex", flexDirection: "column", justifyContent: "center", position: "relative", zIndex: 1 }}>
          <div style={{
            fontFamily: DISPLAY, fontSize: 30, fontWeight: 600,
            letterSpacing: "-0.02em", color: C.text,
          }}>
            Your year,{" "}
            <span style={{ fontStyle: "italic", color: C.live }}>journaled.</span>
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 22, marginTop: 28 }}>
            {[
              { label: "Trades logged", value: tradesLogged, positive: false },
              { label: "Net", value: net, positive: !net.startsWith("-") },
              { label: "Best month", value: bestMonth, positive: false },
              { label: "Discipline", value: discipline, positive: false },
            ].map(s => (
              <div key={s.label}>
                <div style={{
                  fontFamily: MONO, fontSize: 10, letterSpacing: "0.1em",
                  color: C.muted, textTransform: "uppercase",
                }}>
                  {s.label}
                </div>
                <div style={{
                  fontFamily: DISPLAY, fontSize: 30, fontWeight: 600,
                  color: s.positive ? C.green : s.value.startsWith("-") ? C.red : C.text,
                  marginTop: 4, letterSpacing: "-0.03em",
                }}>
                  {s.value}
                </div>
              </div>
            ))}
          </div>
        </div>
        <div style={{
          fontFamily: MONO, fontSize: 11, letterSpacing: "0.12em",
          color: C.muted, textTransform: "uppercase",
        }}>
          {handle} · KODATRADE.CO.UK
        </div>
      </div>
    </ShareCardFrame>
  );
}
