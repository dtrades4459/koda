import type React from "react";
import type { Theme } from "../theme";
import { MONO, BODY, DISPLAY, KodaMark, Card } from "../shared";
import { SettingsSub } from "../settings/SettingsScreens";

// ═══════════════════════════════════════════════════════════════════════════
// Notifications screens (cat06)
//
// Components:
//   • NotificationInbox — read/unread/aggregated list (14 kinds)
//   • PushPreviewIOS / PushPreviewAndroid — lock-screen mockups for docs
//   • NotificationKindGrid — reference grid of all 14 kinds
//   • PermissionPrimerSheet — pre-prompt the OS dialog
//   • PermissionBlockedScreen — Chrome/Safari recovery instructions
// ═══════════════════════════════════════════════════════════════════════════

// ─── Icons (small set used across notification rows) ───────────────────────
function IconUser({ c, s = 18 }: { c: string; s?: number }) { return <svg width={s} height={s} viewBox="0 0 24 24" fill="none"><circle cx="12" cy="8" r="4" stroke={c} strokeWidth="1.6" /><path d="M4 20c0-4 4-6 8-6s8 2 8 6" stroke={c} strokeWidth="1.6" strokeLinecap="round" /></svg>; }
function IconGrid({ c, s = 18 }: { c: string; s?: number }) { return <svg width={s} height={s} viewBox="0 0 24 24" fill="none"><rect x="4" y="4" width="7" height="7" rx="1" stroke={c} strokeWidth="1.6" /><rect x="13" y="4" width="7" height="7" rx="1" stroke={c} strokeWidth="1.6" /><rect x="4" y="13" width="7" height="7" rx="1" stroke={c} strokeWidth="1.6" /><rect x="13" y="13" width="7" height="7" rx="1" stroke={c} strokeWidth="1.6" /></svg>; }
function IconCheck({ c, s = 18, sw = 2 }: { c: string; s?: number; sw?: number }) { return <svg width={s} height={s} viewBox="0 0 24 24" fill="none"><path d="M5 12l5 5L19 8" stroke={c} strokeWidth={sw} strokeLinecap="round" strokeLinejoin="round" /></svg>; }
function IconFlag({ c, s = 18 }: { c: string; s?: number }) { return <svg width={s} height={s} viewBox="0 0 24 24" fill="none"><path d="M5 21V4l13 4-13 4" stroke={c} strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" /></svg>; }
function IconCard({ c, s = 18 }: { c: string; s?: number }) { return <svg width={s} height={s} viewBox="0 0 24 24" fill="none"><rect x="2" y="6" width="20" height="12" rx="2" stroke={c} strokeWidth="1.6" /><path d="M2 10h20" stroke={c} strokeWidth="1.6" /></svg>; }
function IconAlert({ c, s = 18 }: { c: string; s?: number }) { return <svg width={s} height={s} viewBox="0 0 24 24" fill="none"><path d="M12 9v5M12 17h.01" stroke={c} strokeWidth="2" strokeLinecap="round" /><circle cx="12" cy="12" r="9" stroke={c} strokeWidth="1.5" /></svg>; }
function IconMail({ c, s = 18 }: { c: string; s?: number }) { return <svg width={s} height={s} viewBox="0 0 24 24" fill="none"><rect x="3" y="5" width="18" height="14" rx="2" stroke={c} strokeWidth="1.6" /><path d="M3 7l9 6 9-6" stroke={c} strokeWidth="1.6" /></svg>; }
function IconClock({ c, s = 18 }: { c: string; s?: number }) { return <svg width={s} height={s} viewBox="0 0 24 24" fill="none"><circle cx="12" cy="12" r="9" stroke={c} strokeWidth="1.6" /><path d="M12 7v5l3 2" stroke={c} strokeWidth="1.6" strokeLinecap="round" /></svg>; }
function IconBell({ c, s = 24 }: { c: string; s?: number }) { return <svg width={s} height={s} viewBox="0 0 24 24" fill="none"><path d="M6 8a6 6 0 1 1 12 0v5l2 3H4l2-3V8zM10 19a2 2 0 0 0 4 0" stroke={c} strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" /></svg>; }
function IconChevD({ c, s = 16 }: { c: string; s?: number }) { return <svg width={s} height={s} viewBox="0 0 24 24" fill="none"><path d="M6 9l6 6 6-6" stroke={c} strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" /></svg>; }

// ═══════════════════════════════════════════════════════════════════════════
// Notification kind taxonomy (14 kinds)
// ═══════════════════════════════════════════════════════════════════════════

export type NotificationKind =
  | "follow"
  | "circle_join"
  | "reaction"
  | "idea_like"
  | "digest"
  | "sync_ok"
  | "sync_error"
  | "milestone"
  | "receipt"
  | "payment_failed"
  | "announcement"
  | "intervention"
  | "chat"
  | "mention";

const KIND_META: Record<NotificationKind, { icon: "user" | "grid" | "check" | "flag" | "card" | "alert" | "mail" | "clock"; toneKey: "live" | "accent" | "green" | "warn" | "red"; label: string }> = {
  follow: { icon: "user", toneKey: "live", label: "Follow" },
  circle_join: { icon: "user", toneKey: "live", label: "Circle join" },
  reaction: { icon: "grid", toneKey: "accent", label: "Reaction" },
  idea_like: { icon: "grid", toneKey: "accent", label: "Idea like" },
  digest: { icon: "grid", toneKey: "live", label: "Weekly digest" },
  sync_ok: { icon: "check", toneKey: "green", label: "Sync complete" },
  sync_error: { icon: "alert", toneKey: "red", label: "Sync error" },
  milestone: { icon: "flag", toneKey: "green", label: "Milestone" },
  receipt: { icon: "card", toneKey: "accent", label: "Receipt" },
  payment_failed: { icon: "alert", toneKey: "red", label: "Payment failed" },
  announcement: { icon: "mail", toneKey: "accent", label: "Announcement" },
  intervention: { icon: "clock", toneKey: "warn", label: "Intervention" },
  chat: { icon: "user", toneKey: "live", label: "Chat message" },
  mention: { icon: "user", toneKey: "live", label: "Mention / DM" },
};

function KindIcon({ icon, c, s = 18 }: { icon: typeof KIND_META[NotificationKind]["icon"]; c: string; s?: number }) {
  switch (icon) {
    case "user": return <IconUser c={c} s={s} />;
    case "grid": return <IconGrid c={c} s={s} />;
    case "check": return <IconCheck c={c} s={s} />;
    case "flag": return <IconFlag c={c} s={s} />;
    case "card": return <IconCard c={c} s={s} />;
    case "alert": return <IconAlert c={c} s={s} />;
    case "mail": return <IconMail c={c} s={s} />;
    case "clock": return <IconClock c={c} s={s} />;
  }
}

// ═══════════════════════════════════════════════════════════════════════════
// 1 · Notification inbox row + list
// ═══════════════════════════════════════════════════════════════════════════

export interface InboxRow {
  id: string;
  kind: NotificationKind;
  body: string;
  timestamp: string;     // "2m", "1h", "Jun 3"
  unread?: boolean;
  aggregate?: number;    // for "3 traders reacted"
}

export function NotificationInbox({
  C, rows, onMarkAllRead, onRow, title = "Activity",
}: {
  C: Theme; rows: InboxRow[];
  onMarkAllRead?: () => void;
  onRow?: (id: string) => void;
  title?: string;
}) {
  return (
    <div style={{ minHeight: "100dvh", background: C.bg, color: C.text, padding: "22px 22px 60px", maxWidth: 600, margin: "0 auto", boxSizing: "border-box" }}>
      <div style={{ display: "flex", alignItems: "center", gap: 9 }}>
        <KodaMark size={20} color={C.text} />
        <span style={{ fontFamily: BODY, fontWeight: 600, fontSize: 14, letterSpacing: "0.22em", color: C.text }}>
          Kōda
        </span>
      </div>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", margin: "20px 0 14px" }}>
        <div style={{
          fontFamily: DISPLAY, fontSize: 26, fontWeight: 600,
          letterSpacing: "-0.03em", color: C.text,
        }}>
          {title}
        </div>
        <button
          onClick={onMarkAllRead}
          style={{
            background: "transparent", border: "none",
            fontFamily: MONO, fontSize: 10, letterSpacing: "0.08em", color: C.live,
            cursor: "pointer", padding: 4,
          }}
        >
          MARK READ
        </button>
      </div>
      <Card C={C} pad={0}>
        {rows.map((r, i) => {
          const meta = KIND_META[r.kind];
          const c = C[meta.toneKey];
          return (
            <button
              key={r.id}
              onClick={() => onRow?.(r.id)}
              style={{
                display: "flex", alignItems: "center", gap: 12,
                padding: "14px 16px", borderTop: i ? `1px solid ${C.line}` : "none",
                background: r.unread ? "rgba(255,255,255,0.02)" : "transparent",
                border: "none", width: "100%", cursor: "pointer", textAlign: "left",
              }}
            >
              <div style={{
                width: 36, height: 36, borderRadius: 999,
                background: `color-mix(in oklch, ${c} 16%, transparent)`,
                display: "flex", alignItems: "center", justifyContent: "center",
                flexShrink: 0, position: "relative",
              }}>
                <KindIcon icon={meta.icon} c={c} s={18} />
                {r.aggregate !== undefined && r.aggregate > 1 && (
                  <span style={{
                    position: "absolute", top: -3, right: -3,
                    fontFamily: MONO, fontSize: 8, padding: "1px 4px",
                    borderRadius: 99, background: c, color: "#0A0A0B", fontWeight: 700,
                  }}>
                    +{r.aggregate}
                  </span>
                )}
              </div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: 13, color: C.text, lineHeight: 1.4, fontFamily: BODY }}>
                  {r.body}
                </div>
              </div>
              <div style={{
                display: "flex", flexDirection: "column", alignItems: "flex-end", gap: 5,
              }}>
                <span style={{ fontFamily: MONO, fontSize: 9.5, color: C.muted }}>{r.timestamp}</span>
                {r.unread && (
                  <span style={{
                    width: 7, height: 7, borderRadius: "50%", background: C.live,
                  }} />
                )}
              </div>
            </button>
          );
        })}
      </Card>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════
// 2 · Push previews (iOS rich + Android rich) — for docs / preview only
// ═══════════════════════════════════════════════════════════════════════════

function LockScreen({ C, children }: { C: Theme; children: React.ReactNode }) {
  return (
    <div style={{
      position: "relative", width: "100%", maxWidth: 380, aspectRatio: "9 / 19.5",
      borderRadius: 32, overflow: "hidden", margin: "0 auto",
      background: "radial-gradient(120% 80% at 50% 0%, #1a1722, #0A0A0B 70%)",
      boxShadow: `0 0 0 1px ${C.border2}`,
    }}>
      <div style={{
        position: "absolute", inset: 0, display: "flex", flexDirection: "column",
        alignItems: "center", paddingTop: 96,
      }}>
        <div style={{
          fontFamily: MONO, fontSize: 12, letterSpacing: "0.1em",
          color: "rgba(255,255,255,0.7)",
        }}>
          Wednesday, June 4
        </div>
        <div style={{
          fontFamily: DISPLAY, fontSize: 76, fontWeight: 600,
          letterSpacing: "-0.04em", color: "#fff", lineHeight: 1, marginTop: 2,
        }}>
          9:41
        </div>
      </div>
      <div style={{
        position: "absolute", left: 12, right: 12, bottom: 46,
        display: "flex", flexDirection: "column", gap: 10,
      }}>
        {children}
      </div>
    </div>
  );
}

function NotifGlassCard({ children, style }: { children: React.ReactNode; style?: React.CSSProperties }) {
  return (
    <div style={{
      borderRadius: 20,
      background: "rgba(40,38,46,0.62)",
      backdropFilter: "blur(24px) saturate(160%)",
      WebkitBackdropFilter: "blur(24px) saturate(160%)",
      border: "1px solid rgba(255,255,255,0.1)",
      padding: 14,
      ...style,
    }}>
      {children}
    </div>
  );
}

function AppChip() {
  return (
    <div style={{
      width: 22, height: 22, borderRadius: 6, background: "#0A0A0B",
      display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0,
    }}>
      <KodaMark size={14} color="#F2F2EE" strokeWidth={2} />
    </div>
  );
}

export function PushPreviewIOS({ C }: { C: Theme }) {
  return (
    <LockScreen C={C}>
      <NotifGlassCard>
        <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 10 }}>
          <AppChip />
          <span style={{ fontSize: 12, fontWeight: 600, color: "#fff", flex: 1 }}>KŌDA</span>
          <span style={{ fontFamily: MONO, fontSize: 10, color: "rgba(255,255,255,0.55)" }}>now</span>
        </div>
        <div style={{ display: "flex", gap: 12 }}>
          <div style={{ flex: 1 }}>
            <div style={{ fontSize: 14, fontWeight: 600, color: "#fff" }}>
              Weekly recap is ready
            </div>
            <div style={{
              fontSize: 13, color: "rgba(255,255,255,0.75)", marginTop: 3, lineHeight: 1.4,
            }}>
              +18.4R this week · 92% rule adherence. Your best setup: ICT silver bullet.
            </div>
          </div>
          <div style={{
            width: 54, height: 54, borderRadius: 10,
            background: `linear-gradient(135deg, ${C.orb1}, ${C.orb3})`,
            flexShrink: 0, display: "flex", alignItems: "center", justifyContent: "center",
          }}>
            <IconGrid c="#fff" s={20} />
          </div>
        </div>
      </NotifGlassCard>
      <NotifGlassCard style={{ opacity: 0.85 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <AppChip />
          <div style={{ flex: 1 }}>
            <span style={{ fontSize: 13, fontWeight: 600, color: "#fff" }}>
              @marcus reacted 🔥 to your trade
            </span>
          </div>
          <span style={{ fontFamily: MONO, fontSize: 10, color: "rgba(255,255,255,0.55)" }}>2m</span>
        </div>
      </NotifGlassCard>
    </LockScreen>
  );
}

export function PushPreviewAndroid({ C }: { C: Theme }) {
  return (
    <LockScreen C={C}>
      <NotifGlassCard style={{ borderRadius: 16, padding: 0, overflow: "hidden" }}>
        <div style={{ padding: "12px 14px 0" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 8 }}>
            <AppChip />
            <span style={{ fontSize: 12, color: "rgba(255,255,255,0.7)", flex: 1 }}>
              Kōda · Milestone
            </span>
            <IconChevD c="rgba(255,255,255,0.5)" s={16} />
          </div>
          <div style={{ fontSize: 14, fontWeight: 600, color: "#fff" }}>
            🔥 30-day discipline streak
          </div>
          <div style={{
            fontSize: 13, color: "rgba(255,255,255,0.72)", marginTop: 3, lineHeight: 1.4,
          }}>
            30 days, every rule logged. Tap to share your card.
          </div>
        </div>
        <div style={{
          height: 120, margin: "12px 0 0",
          background: `radial-gradient(circle at 30% 30%, ${C.live}, ${C.orb2})`,
          display: "flex", alignItems: "center", justifyContent: "center",
        }}>
          <span style={{
            fontFamily: DISPLAY, fontSize: 44, fontWeight: 700,
            color: "#0A0A0B", letterSpacing: "-0.04em",
          }}>
            30
          </span>
        </div>
        <div style={{ display: "flex", borderTop: "1px solid rgba(255,255,255,0.1)" }}>
          {["Share", "Dismiss"].map((a, i) => (
            <div
              key={a}
              style={{
                flex: 1, textAlign: "center", padding: "12px 0",
                fontSize: 13, fontWeight: 600,
                color: i ? "rgba(255,255,255,0.6)" : C.live,
                borderLeft: i ? "1px solid rgba(255,255,255,0.1)" : "none",
              }}
            >
              {a}
            </div>
          ))}
        </div>
      </NotifGlassCard>
    </LockScreen>
  );
}

// ═══════════════════════════════════════════════════════════════════════════
// 3 · Notification kind grid (reference doc)
// ═══════════════════════════════════════════════════════════════════════════

export function NotificationKindGrid({ C }: { C: Theme }) {
  const kinds = Object.entries(KIND_META) as [NotificationKind, typeof KIND_META[NotificationKind]][];
  return (
    <div style={{
      minHeight: "100dvh", background: C.bg, color: C.text,
      padding: "22px 22px 60px", maxWidth: 600, margin: "0 auto", boxSizing: "border-box",
    }}>
      <div style={{ display: "flex", alignItems: "center", gap: 9 }}>
        <KodaMark size={20} color={C.text} />
        <span style={{ fontFamily: BODY, fontWeight: 600, fontSize: 14, letterSpacing: "0.22em", color: C.text }}>
          Kōda
        </span>
      </div>
      <div style={{
        fontFamily: DISPLAY, fontSize: 22, fontWeight: 600,
        letterSpacing: "-0.02em", color: C.text, margin: "18px 0 6px",
      }}>
        14 notification kinds
      </div>
      <div style={{ fontSize: 12.5, color: C.text2, marginBottom: 16, lineHeight: 1.5, fontFamily: BODY }}>
        Each kind = a glyph + tint + copy template (see Microcopy).
      </div>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
        {kinds.map(([key, meta]) => {
          const c = C[meta.toneKey];
          return (
            <div
              key={key}
              style={{
                display: "flex", alignItems: "center", gap: 10,
                padding: "12px", borderRadius: 12,
                background: C.surface, border: `1px solid ${C.line}`,
              }}
            >
              <div style={{
                width: 30, height: 30, borderRadius: 999,
                background: `color-mix(in oklch, ${c} 16%, transparent)`,
                display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0,
              }}>
                <KindIcon icon={meta.icon} c={c} s={16} />
              </div>
              <span style={{ fontSize: 12, color: C.text, fontWeight: 500, fontFamily: BODY }}>
                {meta.label}
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════
// 4 · Permission primer sheet (pre-prompt before OS dialog)
// ═══════════════════════════════════════════════════════════════════════════

export function PermissionPrimerSheet({
  C, onTurnOn, onLater,
}: {
  C: Theme; onTurnOn?: () => void; onLater?: () => void;
}) {
  return (
    <div
      role="dialog"
      aria-modal="true"
      style={{
        position: "fixed", inset: 0, zIndex: 9000,
        background: "rgba(10,10,11,0.7)", backdropFilter: "blur(6px)",
        WebkitBackdropFilter: "blur(6px)",
        display: "flex", alignItems: "flex-end", justifyContent: "center",
        padding: 14, animation: "kFadeIn 0.22s ease-out",
      }}
      onClick={onLater}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          width: "100%", maxWidth: 480, borderRadius: 24,
          background: C.panel, border: `1px solid ${C.border2}`,
          padding: 24, position: "relative", overflow: "hidden",
          animation: "kSlideIn 0.32s cubic-bezier(.2,.8,.2,1)",
        }}
      >
        <div style={{
          position: "absolute", top: -60, right: -50, width: 200, height: 200,
          borderRadius: "50%",
          background: `conic-gradient(from 200deg at 50% 50%, ${C.orb3}, ${C.accent}, ${C.orb2}, ${C.orb3})`,
          filter: "blur(46px)", opacity: 0.35, pointerEvents: "none",
        }} />
        <div style={{ position: "relative" }}>
          <div style={{
            width: 52, height: 52, borderRadius: 14, background: C.liveSoft,
            display: "flex", alignItems: "center", justifyContent: "center", marginBottom: 18,
          }}>
            <IconBell c={C.live} s={24} />
          </div>
          <div style={{
            fontFamily: DISPLAY, fontSize: 21, fontWeight: 600,
            letterSpacing: "-0.02em", color: C.text,
          }}>
            Never miss a tilt moment
          </div>
          <div style={{
            fontSize: 13.5, color: C.text2, marginTop: 10, lineHeight: 1.55, fontFamily: BODY,
          }}>
            Get a nudge when you're over-trading, when sync finishes, and when your weekly recap lands. You choose which.
          </div>
          <div style={{
            display: "flex", flexDirection: "column", gap: 10, marginTop: 22,
          }}>
            <button
              onClick={onTurnOn}
              style={{
                padding: "13px 22px", borderRadius: 999,
                background: C.live, color: "#0A0A0A", border: "none",
                fontFamily: BODY, fontSize: 14, fontWeight: 600, cursor: "pointer", width: "100%",
              }}
            >
              Turn on notifications
            </button>
            <button
              onClick={onLater}
              style={{
                padding: "13px 22px", borderRadius: 999,
                background: "transparent", color: C.text, border: `1px solid ${C.border2}`,
                fontFamily: BODY, fontSize: 14, fontWeight: 600, cursor: "pointer", width: "100%",
              }}
            >
              Maybe later
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════
// 5 · Permission blocked — recovery instructions
// ═══════════════════════════════════════════════════════════════════════════

export function PermissionBlockedScreen({
  C, browser = "Chrome", onReload, onBack,
}: {
  C: Theme; browser?: "Chrome" | "Safari" | "Firefox" | "Edge";
  onReload?: () => void; onBack?: () => void;
}) {
  const steps: Record<string, string[]> = {
    Chrome: [
      "Tap the 🔒 lock icon in the address bar",
      "Find \"Notifications\" → switch to Allow",
      "Return here and reload",
    ],
    Safari: [
      "Open Safari Settings (iOS) or Preferences (Mac)",
      "Tap \"Notifications\" → find kodatrade.co.uk",
      "Switch to Allow, then return and reload",
    ],
    Firefox: [
      "Tap the shield icon in the address bar",
      "Site permissions → Notifications → Allow",
      "Reload this page",
    ],
    Edge: [
      "Tap the lock icon in the address bar",
      "Permissions for this site → Notifications → Allow",
      "Reload this page",
    ],
  };
  return (
    <SettingsSub C={C} title="Notifications" onBack={onBack}>
      <div style={{
        width: 52, height: 52, borderRadius: 999, background: C.warnSoft,
        display: "flex", alignItems: "center", justifyContent: "center",
        margin: "8px 0 18px",
      }}>
        <IconBell c={C.warn} s={24} />
      </div>
      <div style={{
        fontFamily: DISPLAY, fontSize: 22, fontWeight: 600,
        letterSpacing: "-0.02em", color: C.text, lineHeight: 1.1,
      }}>
        Notifications are blocked
      </div>
      <div style={{ fontSize: 13.5, color: C.text2, marginTop: 12, lineHeight: 1.55, fontFamily: BODY }}>
        You'll need to re-enable them in your browser. Here's how on{" "}
        <span style={{ color: C.text }}>{browser}</span>:
      </div>
      <Card C={C} pad={18} style={{ marginTop: 18 }}>
        {steps[browser].map((s, i) => (
          <div
            key={i}
            style={{
              display: "flex", gap: 12, padding: "10px 0",
              borderTop: i ? `1px solid ${C.line}` : "none",
            }}
          >
            <div style={{
              width: 24, height: 24, borderRadius: 999,
              background: C.surfaceHi, border: `1px solid ${C.border2}`,
              display: "flex", alignItems: "center", justifyContent: "center",
              fontFamily: MONO, fontSize: 11, color: C.text, flexShrink: 0,
            }}>
              {i + 1}
            </div>
            <span style={{ fontSize: 13, color: C.text, paddingTop: 3, fontFamily: BODY }}>{s}</span>
          </div>
        ))}
      </Card>
      <div style={{ marginTop: 18 }}>
        <button
          onClick={onReload}
          style={{
            padding: "13px 22px", borderRadius: 999,
            background: "transparent", color: C.text, border: `1px solid ${C.border2}`,
            fontFamily: BODY, fontSize: 14, fontWeight: 600,
            width: "100%", cursor: "pointer",
          }}
        >
          I've enabled them — reload
        </button>
      </div>
    </SettingsSub>
  );
}

export { KIND_META };
