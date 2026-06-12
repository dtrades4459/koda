import { useState } from "react";
import type { Theme } from "../theme";
import { MONO, BODY, DISPLAY, Kicker, Card, AvatarCircle } from "../shared";
import { SettingsSub, SectionLabel, Banner, MonoTag } from "../settings/SettingsScreens";

// ═══════════════════════════════════════════════════════════════════════════
// Trade lifecycle screens (cat03)
//
// Components:
//   • EditTradeScreen — dirty/unsaved edit form
//   • DeleteTradeModal — centered confirm modal
//   • ScreenshotsScreen — multi/paste/library
//   • ShareToCircleSheet — bottom sheet
//   • MistakeTagSheet — bottom sheet
//   • TradeDetailScreen — reactions + comments
//   • ReviewInboxScreen — bulk publish/skip
//   • CsvDedupStep — import wizard step 4
//   • TradeActionsScreen — favorite / attach / link
// ═══════════════════════════════════════════════════════════════════════════

// ─── Icons ──────────────────────────────────────────────────────────────────
function IconClose({ c, s = 14 }: { c: string; s?: number }) {
  return <svg width={s} height={s} viewBox="0 0 24 24" fill="none"><path d="M6 6l12 12M18 6l-12 12" stroke={c} strokeWidth="2" strokeLinecap="round" /></svg>;
}
function IconPlus({ c, s = 16 }: { c: string; s?: number }) {
  return <svg width={s} height={s} viewBox="0 0 24 24" fill="none"><path d="M12 5v14M5 12h14" stroke={c} strokeWidth="1.8" strokeLinecap="round" /></svg>;
}
function IconGrid({ c, s = 16 }: { c: string; s?: number }) {
  return <svg width={s} height={s} viewBox="0 0 24 24" fill="none"><rect x="4" y="4" width="7" height="7" rx="1" stroke={c} strokeWidth="1.6" /><rect x="13" y="4" width="7" height="7" rx="1" stroke={c} strokeWidth="1.6" /><rect x="4" y="13" width="7" height="7" rx="1" stroke={c} strokeWidth="1.6" /><rect x="13" y="13" width="7" height="7" rx="1" stroke={c} strokeWidth="1.6" /></svg>;
}
function IconShare({ c, s = 16 }: { c: string; s?: number }) {
  return <svg width={s} height={s} viewBox="0 0 24 24" fill="none"><circle cx="6" cy="12" r="2.5" stroke={c} strokeWidth="1.6" /><circle cx="18" cy="6" r="2.5" stroke={c} strokeWidth="1.6" /><circle cx="18" cy="18" r="2.5" stroke={c} strokeWidth="1.6" /><path d="M8 11l8-4M8 13l8 4" stroke={c} strokeWidth="1.6" /></svg>;
}
function IconCheck({ c, s = 14, sw = 2 }: { c: string; s?: number; sw?: number }) {
  return <svg width={s} height={s} viewBox="0 0 24 24" fill="none"><path d="M5 12l5 5L19 8" stroke={c} strokeWidth={sw} strokeLinecap="round" strokeLinejoin="round" /></svg>;
}
function IconTrash({ c, s = 24 }: { c: string; s?: number }) {
  return <svg width={s} height={s} viewBox="0 0 24 24" fill="none"><path d="M3 6h18M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6" stroke={c} strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" /></svg>;
}
function IconAlert({ c, s = 16 }: { c: string; s?: number }) {
  return <svg width={s} height={s} viewBox="0 0 24 24" fill="none"><path d="M12 9v5M12 17h.01M10.3 4.86L1.82 19A2 2 0 0 0 3.54 22h16.93A2 2 0 0 0 22.2 19L13.71 4.86a2 2 0 0 0-3.42 0z" stroke={c} strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" /></svg>;
}
function IconStar({ c, s = 18 }: { c: string; s?: number }) {
  return <svg width={s} height={s} viewBox="0 0 24 24" fill="none"><path d="M12 2.5l3 6.5 7 1-5 5 1.5 7-6.5-3.5L5.5 22 7 15 2 10l7-1 3-6.5z" stroke={c} strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" /></svg>;
}
function IconClock({ c, s = 18 }: { c: string; s?: number }) {
  return <svg width={s} height={s} viewBox="0 0 24 24" fill="none"><circle cx="12" cy="12" r="9" stroke={c} strokeWidth="1.6" /><path d="M12 7v5l3 2" stroke={c} strokeWidth="1.6" strokeLinecap="round" /></svg>;
}
function IconChevR({ c, s = 16 }: { c: string; s?: number }) {
  return <svg width={s} height={s} viewBox="0 0 16 16" fill="none"><path d="M5 3l5 5-5 5" stroke={c} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" /></svg>;
}

// ═══════════════════════════════════════════════════════════════════════════
// Segmented control (Long / Short)
// ═══════════════════════════════════════════════════════════════════════════

export function Segmented<T extends string>({
  C, value, options, onChange,
}: {
  C: Theme;
  value: T;
  options: { id: T; label: string; tone?: "green" | "red" | "live" | "accent" }[];
  onChange?: (v: T) => void;
}) {
  return (
    <div style={{
      display: "inline-flex", padding: 3, borderRadius: 999,
      background: C.surfaceHi, border: `1px solid ${C.line2}`,
    }}>
      {options.map(opt => {
        const on = value === opt.id;
        const tone = opt.tone ? C[opt.tone] : C.text;
        return (
          <button
            key={opt.id}
            onClick={() => onChange?.(opt.id)}
            style={{
              padding: "7px 14px", borderRadius: 999,
              background: on ? tone : "transparent",
              color: on ? "#0A0A0A" : C.text2,
              border: "none", cursor: "pointer",
              fontFamily: BODY, fontSize: "0.75rem", fontWeight: 600,
              transition: "background 0.15s, color 0.15s",
            }}
          >
            {opt.label}
          </button>
        );
      })}
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════
// 1 · Edit trade (dirty)
// ═══════════════════════════════════════════════════════════════════════════

export function EditTradeScreen({
  C, symbol = "NQ", date = "JUN 4 · 09:42",
  side = "long" as "long" | "short",
  entry = "", exit = "", net = "", rMultiple = "",
  onDiscard, onSave, onBack,
}: {
  C: Theme; symbol?: string; date?: string; side?: "long" | "short";
  entry?: string; exit?: string; net?: string; rMultiple?: string;
  onDiscard?: () => void;
  onSave?: (patch: { side: "long" | "short"; entry: string; exit: string }) => void;
  onBack?: () => void;
}) {
  const [s, setS] = useState<"long" | "short">(side);
  const [e1, setE1] = useState(entry);
  const [e2, setE2] = useState(exit);
  const dirty = s !== side || e1 !== entry || e2 !== exit;

  const netColor = net.startsWith("+") || net.startsWith("$") ? C.green : C.red;
  return (
    <SettingsSub
      C={C}
      title="Edit trade"
      right={dirty ? <MonoTag C={C} tone="warn">Unsaved</MonoTag> : undefined}
      onBack={onBack}
    >
      <Card C={C} pad={18}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <div>
            <div style={{ fontFamily: DISPLAY, fontSize: "1.375rem", fontWeight: 600, color: C.text }}>{symbol}</div>
            <div style={{ fontFamily: MONO, fontSize: "0.625rem", color: C.muted, marginTop: 2 }}>{date}</div>
          </div>
          <Segmented
            C={C}
            value={s}
            options={[
              { id: "long", label: "Long", tone: "green" },
              { id: "short", label: "Short", tone: "red" },
            ]}
            onChange={setS}
          />
        </div>
      </Card>
      <SectionLabel C={C}>Entry / Exit</SectionLabel>
      <div style={{ display: "flex", gap: 10 }}>
        <FieldInline C={C} label="Entry" value={e1} onChange={setE1} mono />
        <FieldInline C={C} label="Exit" value={e2} onChange={setE2} mono focus />
      </div>
      {(net || rMultiple) && (
        <>
          <SectionLabel C={C}>Result</SectionLabel>
          <div style={{ display: "flex", gap: 10, alignItems: "center" }}>
            {net && (
              <div style={{
                flex: 1, padding: "14px 16px", borderRadius: 12,
                background: netColor === C.green ? C.greenSoft : C.redSoft,
                border: `1px solid color-mix(in oklch, ${netColor} 30%, transparent)`,
              }}>
                <div style={{ fontFamily: MONO, fontSize: "0.5625rem", color: C.muted }}>NET</div>
                <div style={{ fontFamily: DISPLAY, fontSize: "1.25rem", fontWeight: 600, color: netColor }}>
                  {net}
                </div>
              </div>
            )}
            {rMultiple && (
              <div style={{
                flex: 1, padding: "14px 16px", borderRadius: 12,
                background: C.panel, border: `1px solid ${C.line}`,
              }}>
                <div style={{ fontFamily: MONO, fontSize: "0.5625rem", color: C.muted }}>R</div>
                <div style={{ fontFamily: DISPLAY, fontSize: "1.25rem", fontWeight: 600, color: C.text }}>
                  {rMultiple}
                </div>
              </div>
            )}
          </div>
        </>
      )}
      <div style={{
        position: "sticky", bottom: 0, marginTop: 22,
        display: "flex", gap: 10,
        background: `linear-gradient(180deg, transparent, ${C.bg} 30%)`,
        paddingTop: 14, paddingBottom: 8,
      }}>
        <button
          onClick={onDiscard}
          disabled={!dirty}
          style={{
            flex: 1, padding: "13px 20px", borderRadius: 999,
            background: "transparent", color: C.text,
            border: `1px solid ${C.border2}`,
            fontFamily: BODY, fontSize: "0.875rem", fontWeight: 600,
            cursor: dirty ? "pointer" : "not-allowed", opacity: dirty ? 1 : 0.5,
          }}
        >
          Discard
        </button>
        <button
          onClick={() => onSave?.({ side: s, entry: e1, exit: e2 })}
          disabled={!dirty}
          style={{
            flex: 1.6, padding: "13px 20px", borderRadius: 999,
            background: dirty ? C.live : C.panel,
            color: dirty ? "#0A0A0A" : C.text2,
            border: "none", fontFamily: BODY, fontSize: "0.875rem", fontWeight: 600,
            cursor: dirty ? "pointer" : "not-allowed",
          }}
        >
          Save changes
        </button>
      </div>
    </SettingsSub>
  );
}

function FieldInline({
  C, label, value, onChange, mono, focus,
}: {
  C: Theme; label: string; value: string;
  onChange?: (v: string) => void;
  mono?: boolean; focus?: boolean;
}) {
  return (
    <div style={{ flex: 1 }}>
      <div style={{
        fontFamily: MONO, fontSize: "0.59375rem", letterSpacing: "0.16em",
        color: C.muted, textTransform: "uppercase", marginBottom: 8,
      }}>
        {label}
      </div>
      <div style={{
        display: "flex", alignItems: "center",
        borderBottom: `1px solid ${focus ? C.live : C.border2}`, padding: "10px 0",
      }}>
        <input
          value={value}
          onChange={(e) => onChange?.(e.target.value)}
          autoFocus={focus}
          style={{
            flex: 1, background: "transparent", border: "none", outline: "none",
            fontFamily: mono ? MONO : BODY, fontSize: 16, color: C.text,
            letterSpacing: mono ? "0.04em" : 0, padding: 0,
          }}
        />
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════
// 2 · Delete trade confirm modal
// ═══════════════════════════════════════════════════════════════════════════

export function DeleteTradeModal({
  C, summary = "your trade", onCancel, onDelete,
}: {
  C: Theme; summary?: string;
  onCancel?: () => void; onDelete?: () => void;
}) {
  return (
    <div
      role="dialog"
      aria-modal="true"
      onClick={onCancel}
      style={{
        position: "fixed", inset: 0, zIndex: 9000,
        background: "rgba(10,10,11,0.7)", backdropFilter: "blur(6px)",
        WebkitBackdropFilter: "blur(6px)",
        display: "flex", alignItems: "center", justifyContent: "center",
        padding: 22, animation: "kFadeIn 0.22s ease-out",
      }}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          width: "100%", maxWidth: 380, borderRadius: 24, background: C.panel,
          border: `1px solid ${C.border2}`, padding: 24,
          animation: "kRise 0.32s cubic-bezier(.2,.8,.2,1)",
        }}
      >
        <div style={{
          width: 52, height: 52, borderRadius: 999, background: C.redSoft,
          display: "flex", alignItems: "center", justifyContent: "center", marginBottom: 18,
        }}>
          <IconTrash c={C.red} s={24} />
        </div>
        <div style={{ fontFamily: DISPLAY, fontSize: "1.3125rem", fontWeight: 600, color: C.text }}>
          Delete this trade?
        </div>
        <div style={{ fontSize: "0.84375rem", color: C.text2, marginTop: 10, lineHeight: 1.55, fontFamily: BODY }}>
          Your <span style={{ color: C.text }}>{summary}</span> and its screenshots will be permanently removed from your stats.
        </div>
        <div style={{ display: "flex", gap: 10, marginTop: 22 }}>
          <button
            onClick={onCancel}
            style={{
              flex: 1, padding: "13px 20px", borderRadius: 999,
              background: "transparent", color: C.text, border: `1px solid ${C.border2}`,
              fontFamily: BODY, fontSize: "0.875rem", fontWeight: 600, cursor: "pointer",
            }}
          >
            Cancel
          </button>
          <button
            onClick={onDelete}
            style={{
              flex: 1, padding: "13px 20px", borderRadius: 999,
              background: C.red, color: "#fff", border: "none",
              fontFamily: BODY, fontSize: "0.875rem", fontWeight: 600, cursor: "pointer",
            }}
          >
            Delete
          </button>
        </div>
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════
// 3 · Screenshots upload
// ═══════════════════════════════════════════════════════════════════════════

export function ScreenshotsScreen({
  C, screenshots = [], max = 6, onAdd, onRemove, onPaste, onAttach, onBack,
}: {
  C: Theme;
  screenshots?: { id: string; src?: string; label?: string }[];
  max?: number;
  onAdd?: () => void; onRemove?: (id: string) => void;
  onPaste?: () => void; onAttach?: () => void; onBack?: () => void;
}) {
  return (
    <SettingsSub C={C} title="Add screenshots" onBack={onBack}>
      <SectionLabel C={C}>Charts · {screenshots.length} of {max}</SectionLabel>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
        {screenshots.map(s => (
          <div
            key={s.id}
            style={{
              aspectRatio: "4 / 3", borderRadius: 12, position: "relative", overflow: "hidden",
              background: s.src ? `url(${s.src}) center/cover` : `linear-gradient(135deg, ${C.surfaceHi}, ${C.surface})`,
              border: `1px solid ${C.border2}`,
            }}
          >
            {!s.src && (
              <div style={{
                position: "absolute", inset: 0,
                backgroundImage: `repeating-linear-gradient(135deg, ${C.line} 0 1px, transparent 1px 10px)`,
              }} />
            )}
            <button
              onClick={() => onRemove?.(s.id)}
              style={{
                position: "absolute", top: 6, right: 6, width: 22, height: 22,
                borderRadius: 999, background: "rgba(10,10,11,0.7)",
                display: "flex", alignItems: "center", justifyContent: "center",
                border: "none", cursor: "pointer",
              }}
            >
              <IconClose c="#fff" s={12} />
            </button>
            {s.label && (
              <div style={{
                position: "absolute", bottom: 6, left: 8,
                fontFamily: MONO, fontSize: "0.5625rem", color: C.text2,
              }}>
                {s.label}
              </div>
            )}
          </div>
        ))}
        {screenshots.length < max && (
          <button
            onClick={onAdd}
            style={{
              aspectRatio: "4 / 3", borderRadius: 12,
              border: `1.5px dashed ${C.line3}`, background: "transparent",
              display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center",
              gap: 8, color: C.muted, cursor: "pointer",
            }}
          >
            <IconPlus c={C.live} s={22} />
            <span style={{ fontSize: "0.6875rem", fontFamily: BODY }}>Add</span>
          </button>
        )}
      </div>
      <div style={{ marginTop: 16, display: "flex", gap: 10 }}>
        <button
          onClick={onAdd}
          style={{
            flex: 1, display: "flex", alignItems: "center", justifyContent: "center", gap: 8,
            padding: "13px 18px", borderRadius: 999, background: "transparent",
            color: C.text, border: `1px solid ${C.border2}`,
            fontFamily: BODY, fontSize: "0.8125rem", fontWeight: 600, cursor: "pointer",
          }}
        >
          <IconGrid c={C.text} s={16} /> Library
        </button>
        <button
          onClick={onPaste}
          style={{
            flex: 1, display: "flex", alignItems: "center", justifyContent: "center", gap: 8,
            padding: "13px 18px", borderRadius: 999, background: "transparent",
            color: C.text, border: `1px solid ${C.border2}`,
            fontFamily: BODY, fontSize: "0.8125rem", fontWeight: 600, cursor: "pointer",
          }}
        >
          📋 Paste
        </button>
      </div>
      <div style={{
        marginTop: 14, padding: "12px 14px", borderRadius: 10,
        background: C.accentSoft,
        border: `1px solid color-mix(in oklch, ${C.accent} 30%, transparent)`,
        fontSize: "0.75rem", color: C.text, fontFamily: BODY,
      }}>
        Tip: copy a chart and tap Paste, or drag images straight in on desktop.
      </div>
      <div style={{ marginTop: 18 }}>
        <button
          onClick={onAttach}
          disabled={screenshots.length === 0}
          style={{
            padding: "13px 22px", borderRadius: 999,
            background: screenshots.length === 0 ? C.panel : C.live,
            color: screenshots.length === 0 ? C.muted : "#0A0A0A",
            border: "none", fontFamily: BODY, fontSize: "0.875rem", fontWeight: 600,
            width: "100%", cursor: screenshots.length === 0 ? "not-allowed" : "pointer",
          }}
        >
          Attach {screenshots.length} screenshot{screenshots.length === 1 ? "" : "s"}
        </button>
      </div>
    </SettingsSub>
  );
}

// ═══════════════════════════════════════════════════════════════════════════
// 4 · Share to Circle — bottom sheet
// ═══════════════════════════════════════════════════════════════════════════

export interface ShareableTrade {
  symbol: string; side: "long" | "short"; rMultiple: string; setup?: string;
}
export interface ShareableCircle {
  id: string; name: string; memberCount: number; avatar?: string;
}

export function ShareToCircleSheet({
  C, trade, circles, onCancel, onShare,
}: {
  C: Theme;
  trade: ShareableTrade;
  circles: ShareableCircle[];
  onCancel?: () => void;
  onShare?: (circleIds: string[]) => void;
}) {
  const [picked, setPicked] = useState<Set<string>>(new Set());
  const togglePick = (id: string) => {
    const next = new Set(picked);
    if (next.has(id)) next.delete(id); else next.add(id);
    setPicked(next);
  };

  return (
    <div
      role="dialog"
      aria-modal="true"
      onClick={onCancel}
      style={{
        position: "fixed", inset: 0, zIndex: 9000,
        background: "rgba(10,10,11,0.7)", backdropFilter: "blur(6px)",
        WebkitBackdropFilter: "blur(6px)",
        display: "flex", alignItems: "flex-end", justifyContent: "center",
        animation: "kFadeIn 0.22s ease-out",
      }}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          width: "100%", maxWidth: 480,
          background: C.surface, borderRadius: "24px 24px 0 0",
          border: `1px solid ${C.border2}`,
          padding: "10px 20px 34px",
          animation: "kSlideIn 0.32s cubic-bezier(.2,.8,.2,1)",
        }}
      >
        <div style={{
          width: 38, height: 4, borderRadius: 99, background: C.line3,
          margin: "0 auto 18px",
        }} />
        <div style={{ fontFamily: DISPLAY, fontSize: "1.1875rem", fontWeight: 600, color: C.text }}>
          Share to a Circle
        </div>
        <Card C={C} pad={14} style={{ marginTop: 16, background: C.surfaceHi }}>
          <div style={{ display: "flex", gap: 12, alignItems: "center" }}>
            <div style={{
              width: 42, height: 42, borderRadius: 10,
              background: trade.side === "long" ? C.greenSoft : C.redSoft,
              display: "flex", alignItems: "center", justifyContent: "center",
            }}>
              <IconGrid c={trade.side === "long" ? C.green : C.red} s={18} />
            </div>
            <div style={{ flex: 1 }}>
              <div style={{ fontSize: "0.875rem", fontWeight: 600, color: C.text, fontFamily: BODY }}>
                {trade.symbol} {trade.side} · {trade.rMultiple}
              </div>
              {trade.setup && (
                <div style={{ fontFamily: MONO, fontSize: "0.625rem", color: C.muted, marginTop: 2 }}>
                  {trade.setup.toUpperCase()}
                </div>
              )}
            </div>
          </div>
        </Card>
        <SectionLabel C={C}>Your circles</SectionLabel>
        {circles.map((c, i) => {
          const on = picked.has(c.id);
          return (
            <button
              key={c.id}
              onClick={() => togglePick(c.id)}
              style={{
                width: "100%", display: "flex", alignItems: "center", gap: 12,
                padding: "12px 4px", borderTop: i ? `1px solid ${C.line}` : "none",
                background: "transparent", border: "none", cursor: "pointer", textAlign: "left",
              }}
            >
              <AvatarCircle name={c.name} avatar={c.avatar} size={34} C={C} />
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: "0.875rem", color: C.text, fontFamily: BODY }}>{c.name}</div>
                <div style={{ fontFamily: MONO, fontSize: "0.625rem", color: C.muted, marginTop: 2 }}>
                  {c.memberCount.toLocaleString()} MEMBERS
                </div>
              </div>
              <div style={{
                width: 24, height: 24, borderRadius: 999,
                border: `1.5px solid ${on ? C.live : C.border2}`,
                background: on ? C.live : "transparent",
                display: "flex", alignItems: "center", justifyContent: "center",
              }}>
                {on && <IconCheck c="#0A0A0B" s={14} sw={2.4} />}
              </div>
            </button>
          );
        })}
        <div style={{ marginTop: 18 }}>
          <button
            onClick={() => onShare?.(Array.from(picked))}
            disabled={picked.size === 0}
            style={{
              padding: "13px 22px", borderRadius: 999,
              background: picked.size === 0 ? C.panel : C.live,
              color: picked.size === 0 ? C.muted : "#0A0A0A",
              border: "none", fontFamily: BODY, fontSize: "0.875rem", fontWeight: 600,
              width: "100%", cursor: picked.size === 0 ? "not-allowed" : "pointer",
            }}
          >
            Share to {picked.size} circle{picked.size === 1 ? "" : "s"}
          </button>
        </div>
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════
// 5 · Mistake tag — bottom sheet
// ═══════════════════════════════════════════════════════════════════════════

export const MISTAKE_TAGS = [
  "None",
  "Chased entry",
  "Moved stop",
  "Oversized",
  "Revenge trade",
  "Cut winner early",
  "Held loser too long",
  "Broke a rule",
  "Other",
];

export function MistakeTagSheet({
  C, initial, onCancel, onSave,
}: {
  C: Theme; initial?: string;
  onCancel?: () => void; onSave?: (tag: string | null) => void;
}) {
  const [picked, setPicked] = useState<string | null>(initial ?? null);
  return (
    <div
      role="dialog"
      aria-modal="true"
      onClick={onCancel}
      style={{
        position: "fixed", inset: 0, zIndex: 9000,
        background: "rgba(10,10,11,0.7)", backdropFilter: "blur(6px)",
        display: "flex", alignItems: "flex-end", justifyContent: "center",
        animation: "kFadeIn 0.22s ease-out",
      }}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          width: "100%", maxWidth: 480,
          background: C.surface, borderRadius: "24px 24px 0 0",
          border: `1px solid ${C.border2}`,
          padding: "10px 20px 34px",
          animation: "kSlideIn 0.32s cubic-bezier(.2,.8,.2,1)",
        }}
      >
        <div style={{ width: 38, height: 4, borderRadius: 99, background: C.line3, margin: "0 auto 18px" }} />
        <Kicker C={C} color={C.red}>Mistake tag</Kicker>
        <div style={{
          fontFamily: DISPLAY, fontSize: "1.25rem", fontWeight: 600, color: C.text, marginTop: 10,
        }}>
          What went wrong?
        </div>
        <div style={{ display: "flex", flexWrap: "wrap", gap: 8, marginTop: 18 }}>
          {MISTAKE_TAGS.map(tag => {
            const on = picked === tag;
            const tone = on && tag !== "None" ? C.red : on ? C.text : C.text;
            return (
              <button
                key={tag}
                onClick={() => setPicked(tag === "None" ? null : tag)}
                style={{
                  padding: "8px 16px", borderRadius: 999,
                  background: on ? (tag === "None" ? C.text : C.redSoft) : "transparent",
                  color: on ? (tag === "None" ? C.bg : C.red) : tone,
                  border: on
                    ? `1px solid color-mix(in oklch, ${tag === "None" ? C.text : C.red} 40%, transparent)`
                    : `1px solid ${C.border2}`,
                  fontFamily: BODY, fontSize: "0.8125rem", fontWeight: 500, cursor: "pointer",
                  whiteSpace: "nowrap",
                }}
              >
                {tag}
              </button>
            );
          })}
        </div>
        <div style={{ marginTop: 22 }}>
          <button
            onClick={() => onSave?.(picked)}
            style={{
              padding: "13px 22px", borderRadius: 999,
              background: C.live, color: "#0A0A0A", border: "none",
              fontFamily: BODY, fontSize: "0.875rem", fontWeight: 600,
              width: "100%", cursor: "pointer",
            }}
          >
            Save tag
          </button>
        </div>
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════
// 6 · Trade detail — reactions + comments
// ═══════════════════════════════════════════════════════════════════════════

export interface TradeComment { id: string; handle: string; body: string; }

export function TradeDetailScreen({
  C, symbol, side, rMultiple, date, setup,
  tags = [], reactions = [], comments = [],
  onAddReaction, onShare, onAddComment, onBack,
}: {
  C: Theme;
  symbol: string; side: "long" | "short"; rMultiple: string;
  date: string; setup?: string;
  tags?: { tone: "green" | "red" | "warn" | "accent" | "live"; label: string }[];
  reactions?: { emoji: string; count: number; mine?: boolean }[];
  comments?: TradeComment[];
  onAddReaction?: () => void;
  onShare?: () => void;
  onAddComment?: (text: string) => void;
  onBack?: () => void;
}) {
  const [draft, setDraft] = useState("");
  return (
    <SettingsSub
      C={C}
      title="Trade detail"
      onBack={onBack}
      right={
        <button
          onClick={onShare}
          aria-label="Share"
          style={{
            width: 36, height: 36, borderRadius: 999, background: C.surface,
            border: `1px solid ${C.line}`,
            display: "flex", alignItems: "center", justifyContent: "center",
            cursor: "pointer", padding: 0,
          }}
        >
          <IconShare c={C.text} s={16} />
        </button>
      }
    >
      <Card C={C} pad={18} style={{ position: "relative", overflow: "hidden" }}>
        <div style={{
          position: "absolute", top: -60, right: -50, width: 200, height: 200,
          borderRadius: "50%",
          background: `conic-gradient(from 200deg at 50% 50%, ${C.orb3}, ${C.accent}, ${C.orb2}, ${C.orb3})`,
          filter: "blur(46px)", opacity: 0.4, pointerEvents: "none",
        }} />
        <div style={{ position: "relative", display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
          <div>
            <div style={{ fontFamily: DISPLAY, fontSize: "1.5rem", fontWeight: 600, color: C.text }}>
              {symbol} · {side === "long" ? "Long" : "Short"}
            </div>
            <div style={{ fontFamily: MONO, fontSize: "0.625rem", color: C.muted, marginTop: 3 }}>
              {date.toUpperCase()}{setup ? ` · ${setup.toUpperCase()}` : ""}
            </div>
          </div>
          <div style={{
            fontFamily: DISPLAY, fontSize: "1.5rem", fontWeight: 600,
            color: rMultiple.startsWith("+") ? C.green : C.red,
          }}>
            {rMultiple}
          </div>
        </div>
        {tags.length > 0 && (
          <div style={{ position: "relative", display: "flex", gap: 6, marginTop: 14, flexWrap: "wrap" }}>
            {tags.map((t, i) => (
              <MonoTag key={i} C={C} tone={t.tone}>{t.label}</MonoTag>
            ))}
          </div>
        )}
      </Card>
      <SectionLabel C={C}>Reactions</SectionLabel>
      <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
        {reactions.map((r, i) => (
          <div
            key={i}
            style={{
              padding: "7px 12px", borderRadius: 999,
              background: r.mine ? C.liveSoft : C.surface,
              border: `1px solid ${r.mine ? `color-mix(in oklch, ${C.live} 30%, transparent)` : C.border2}`,
              fontSize: "0.8125rem", color: C.text, fontFamily: BODY,
            }}
          >
            {r.emoji} {r.count}
          </div>
        ))}
        <button
          onClick={onAddReaction}
          style={{
            width: 34, height: 34, borderRadius: 999,
            background: C.surface, border: `1px solid ${C.border2}`,
            display: "flex", alignItems: "center", justifyContent: "center",
            cursor: "pointer", padding: 0,
          }}
        >
          <IconPlus c={C.text2} s={16} />
        </button>
      </div>
      <SectionLabel C={C}>Comments · {comments.length}</SectionLabel>
      {comments.map((c, i) => (
        <div
          key={c.id}
          style={{
            display: "flex", gap: 10, padding: "10px 0",
            borderTop: i ? `1px solid ${C.line}` : "none",
          }}
        >
          <AvatarCircle name={c.handle} size={30} C={C} />
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontSize: "0.78125rem", color: C.text, fontFamily: BODY }}>
              <b>@{c.handle}</b> <span style={{ color: C.text2 }}>{c.body}</span>
            </div>
          </div>
        </div>
      ))}
      <div style={{
        display: "flex", gap: 10, alignItems: "center",
        marginTop: 14, padding: "10px 14px", borderRadius: 999,
        background: C.surface, border: `1px solid ${C.border2}`,
      }}>
        <input
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && draft.trim()) {
              onAddComment?.(draft);
              setDraft("");
            }
          }}
          placeholder="Add a comment…"
          style={{
            flex: 1, background: "transparent", border: "none", outline: "none",
            fontFamily: BODY, fontSize: "0.8125rem", color: C.text, padding: 0,
          }}
        />
        <button
          onClick={() => { if (draft.trim()) { onAddComment?.(draft); setDraft(""); } }}
          disabled={!draft.trim()}
          style={{
            background: "transparent", border: "none",
            cursor: draft.trim() ? "pointer" : "not-allowed",
            opacity: draft.trim() ? 1 : 0.4, padding: 4,
          }}
        >
          <IconChevR c={C.live} s={18} />
        </button>
      </div>
    </SettingsSub>
  );
}

// ═══════════════════════════════════════════════════════════════════════════
// 7 · Review inbox — bulk publish / skip
// ═══════════════════════════════════════════════════════════════════════════

export interface ReviewItem {
  id: string; symbol: string; r: string; tone: "green" | "red";
  date: string; state: "draft" | "published" | "skipped";
}

export function ReviewInboxBulkScreen({
  C, items, onBack, onPublish, onSkip,
}: {
  C: Theme; items: ReviewItem[];
  onBack?: () => void;
  onPublish?: (ids: string[]) => void;
  onSkip?: (ids: string[]) => void;
}) {
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const toggle = (id: string) => {
    const next = new Set(selected);
    if (next.has(id)) next.delete(id); else next.add(id);
    setSelected(next);
  };
  const draftCount = items.filter(i => i.state === "draft").length;

  return (
    <SettingsSub
      C={C}
      title="Review inbox"
      onBack={onBack}
      right={<MonoTag C={C} tone="live">{draftCount} drafts</MonoTag>}
    >
      {selected.size > 0 && (
        <div style={{
          display: "flex", alignItems: "center", gap: 10,
          padding: "10px 14px", borderRadius: 12,
          background: C.accentSoft,
          border: `1px solid color-mix(in oklch, ${C.accent} 30%, transparent)`,
          marginBottom: 14,
        }}>
          <div style={{
            width: 22, height: 22, borderRadius: 6, background: C.accent,
            display: "flex", alignItems: "center", justifyContent: "center",
          }}>
            <IconCheck c="#0A0A0B" s={14} sw={2.4} />
          </div>
          <span style={{ flex: 1, fontSize: "0.8125rem", color: C.text, fontFamily: BODY }}>
            {selected.size} selected
          </span>
          <button
            onClick={() => { onPublish?.(Array.from(selected)); setSelected(new Set()); }}
            style={{
              background: "transparent", border: "none",
              fontFamily: MONO, fontSize: "0.625rem", color: C.live, letterSpacing: "0.08em",
              cursor: "pointer", padding: 6,
            }}
          >
            PUBLISH
          </button>
          <button
            onClick={() => { onSkip?.(Array.from(selected)); setSelected(new Set()); }}
            style={{
              background: "transparent", border: "none",
              fontFamily: MONO, fontSize: "0.625rem", color: C.muted, letterSpacing: "0.08em",
              cursor: "pointer", padding: 6,
            }}
          >
            SKIP
          </button>
        </div>
      )}
      {items.map(item => {
        const sel = selected.has(item.id);
        const dimmed = item.state === "skipped";
        return (
          <button
            key={item.id}
            onClick={() => toggle(item.id)}
            style={{
              display: "flex", alignItems: "center", gap: 12,
              padding: "14px 16px", borderRadius: 12,
              background: C.surface,
              border: `1px solid ${sel ? `color-mix(in oklch, ${C.accent} 30%, transparent)` : C.line}`,
              marginBottom: 8, width: "100%", textAlign: "left", cursor: "pointer",
              opacity: dimmed ? 0.5 : 1,
            }}
          >
            <div style={{
              width: 22, height: 22, borderRadius: 6,
              border: `1.5px solid ${sel ? C.accent : C.border2}`,
              background: sel ? C.accent : "transparent",
              display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0,
            }}>
              {sel && <IconCheck c="#0A0A0B" s={13} sw={2.4} />}
            </div>
            {item.state === "draft" && (
              <span style={{
                width: 8, height: 8, borderRadius: "50%", background: C.live, flexShrink: 0,
              }} />
            )}
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontSize: "0.875rem", fontWeight: 600, color: C.text, fontFamily: BODY }}>
                {item.symbol}{" "}
                <span style={{ color: item.tone === "green" ? C.green : C.red }}>{item.r}</span>
              </div>
              <div style={{ fontFamily: MONO, fontSize: "0.59375rem", color: C.muted, marginTop: 2 }}>
                {item.date}
              </div>
            </div>
            <MonoTag
              C={C}
              tone={item.state === "published" ? "green" : item.state === "skipped" ? "warn" : "live"}
            >
              {item.state}
            </MonoTag>
          </button>
        );
      })}
    </SettingsSub>
  );
}

// ═══════════════════════════════════════════════════════════════════════════
// 8 · CSV import — dedup step
// ═══════════════════════════════════════════════════════════════════════════

export interface DedupConflict {
  id: string; label: string; detail: string;
  resolution: "existing" | "imported" | "both";
}

export function CsvDedupStep({
  C, conflicts, skippedCount = 0, importableCount = 0,
  onUpdate, onContinue, onBack,
}: {
  C: Theme; conflicts: DedupConflict[];
  skippedCount?: number; importableCount?: number;
  onUpdate?: (id: string, r: "existing" | "imported" | "both") => void;
  onContinue?: () => void; onBack?: () => void;
}) {
  const OPTIONS = [
    { id: "existing", label: "Keep existing" },
    { id: "imported", label: "Keep imported" },
    { id: "both", label: "Keep both" },
  ] as const;

  return (
    <SettingsSub C={C} title="Import · review" onBack={onBack}>
      <div style={{
        fontFamily: MONO, fontSize: "0.59375rem", letterSpacing: "0.14em",
        color: C.muted, textTransform: "uppercase",
      }}>
        Step 4 of 6 · Dedup
      </div>
      <div style={{
        fontFamily: DISPLAY, fontSize: "1.25rem", fontWeight: 600,
        color: C.text, margin: "10px 0 4px",
      }}>
        {conflicts.length} possible duplicate{conflicts.length === 1 ? "" : "s"}
      </div>
      <div style={{ fontSize: "0.78125rem", color: C.text2, marginBottom: 16, lineHeight: 1.5, fontFamily: BODY }}>
        These rows match trades already in your journal. Choose what to keep.
      </div>
      {conflicts.map(c => (
        <Card C={C} pad={14} key={c.id} style={{ marginBottom: 10 }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <div>
              <div style={{ fontSize: "0.84375rem", fontWeight: 600, color: C.text, fontFamily: BODY }}>
                {c.label}
              </div>
              <div style={{ fontFamily: MONO, fontSize: "0.625rem", color: C.muted, marginTop: 3 }}>
                {c.detail}
              </div>
            </div>
            <MonoTag C={C} tone="warn">Conflict</MonoTag>
          </div>
          <div style={{ display: "flex", gap: 6, marginTop: 12 }}>
            {OPTIONS.map(o => {
              const on = c.resolution === o.id;
              return (
                <button
                  key={o.id}
                  onClick={() => onUpdate?.(c.id, o.id)}
                  style={{
                    flex: 1, padding: "8px 4px", borderRadius: 8,
                    fontSize: "0.6875rem", fontWeight: 500,
                    background: on ? C.text : "transparent",
                    color: on ? C.bg : C.text2,
                    border: `1px solid ${on ? "transparent" : C.border2}`,
                    cursor: "pointer", fontFamily: BODY,
                  }}
                >
                  {o.label}
                </button>
              );
            })}
          </div>
        </Card>
      ))}
      {skippedCount > 0 && (
        <div style={{
          padding: "12px 14px", borderRadius: 10, background: C.redSoft,
          border: `1px solid color-mix(in oklch, ${C.red} 28%, transparent)`,
          display: "flex", gap: 10, alignItems: "center", marginTop: 6,
        }}>
          <IconAlert c={C.red} s={16} />
          <span style={{ fontSize: "0.75rem", color: C.text, fontFamily: BODY }}>
            {skippedCount} row{skippedCount === 1 ? "" : "s"} skipped — invalid data.
          </span>
        </div>
      )}
      <div style={{ marginTop: 18 }}>
        <button
          onClick={onContinue}
          style={{
            padding: "13px 22px", borderRadius: 999,
            background: C.live, color: "#0A0A0A", border: "none",
            fontFamily: BODY, fontSize: "0.875rem", fontWeight: 600,
            width: "100%", cursor: "pointer",
          }}
        >
          Continue · import {importableCount} trades
        </button>
      </div>
    </SettingsSub>
  );
}

// ═══════════════════════════════════════════════════════════════════════════
// 9 · Trade actions — Favorite / Attach / Link
// ═══════════════════════════════════════════════════════════════════════════

export interface TradeActionRow {
  id: string;
  icon: "star" | "share" | "clock" | "grid";
  title: string;
  detail?: string;
  toneKey: "live" | "accent" | "warn";
  active?: boolean;
}

function ActionIcon({ icon, c }: { icon: TradeActionRow["icon"]; c: string }) {
  if (icon === "star") return <IconStar c={c} />;
  if (icon === "share") return <IconShare c={c} />;
  if (icon === "clock") return <IconClock c={c} />;
  return <IconGrid c={c} />;
}

export function TradeActionsScreen({
  C, symbol, side, rMultiple, date,
  rows, onRow, onBack,
}: {
  C: Theme; symbol: string; side: "long" | "short"; rMultiple: string; date: string;
  rows: TradeActionRow[];
  onRow?: (id: string) => void;
  onBack?: () => void;
}) {
  return (
    <SettingsSub C={C} title="More actions" onBack={onBack}>
      <Card C={C} pad={16} style={{ position: "relative", overflow: "hidden" }}>
        <div style={{
          position: "absolute", top: -60, right: -50, width: 200, height: 200,
          borderRadius: "50%",
          background: `conic-gradient(from 200deg at 50% 50%, ${C.orb3}, ${C.accent}, ${C.orb2}, ${C.orb3})`,
          filter: "blur(46px)", opacity: 0.35, pointerEvents: "none",
        }} />
        <div style={{ position: "relative", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <div>
            <div style={{ fontFamily: DISPLAY, fontSize: "1.125rem", fontWeight: 600, color: C.text }}>
              {symbol} · {side === "long" ? "Long" : "Short"}
            </div>
            <div style={{ fontFamily: MONO, fontSize: "0.59375rem", color: C.muted, marginTop: 3 }}>
              {date.toUpperCase()}
            </div>
          </div>
          <div style={{
            fontFamily: DISPLAY, fontSize: "1.125rem", fontWeight: 600,
            color: rMultiple.startsWith("+") ? C.green : C.red,
          }}>
            {rMultiple}
          </div>
        </div>
      </Card>
      <SectionLabel C={C}>Organise</SectionLabel>
      <Card C={C} pad={0}>
        {rows.map((row, i) => {
          const tone = C[row.toneKey];
          return (
            <button
              key={row.id}
              onClick={() => onRow?.(row.id)}
              style={{
                display: "flex", alignItems: "center", gap: 12,
                padding: "15px 16px", borderTop: i ? `1px solid ${C.line}` : "none",
                background: "transparent", border: "none", width: "100%", cursor: "pointer",
                textAlign: "left",
              }}
            >
              <ActionIcon icon={row.icon} c={tone} />
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: "0.875rem", color: C.text, fontFamily: BODY }}>{row.title}</div>
                {row.detail && (
                  <div style={{
                    fontFamily: MONO, fontSize: "0.59375rem", color: C.muted, marginTop: 2,
                  }}>
                    {row.detail.toUpperCase()}
                  </div>
                )}
              </div>
              {row.active
                ? <IconCheck c={C.live} s={18} sw={2.2} />
                : <IconChevR c={C.muted} s={16} />}
            </button>
          );
        })}
      </Card>
    </SettingsSub>
  );
}

// Re-export Banner so callers can use the same one
export { Banner };
