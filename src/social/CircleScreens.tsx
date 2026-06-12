import { useState } from "react";
import type React from "react";
import type { Theme } from "../theme";
import { MONO, BODY, DISPLAY, Kicker, Card, AvatarCircle } from "../shared";
import { SettingsSub, SectionLabel, MonoTag } from "../settings/SettingsScreens";

// ═══════════════════════════════════════════════════════════════════════════
// Social & circles screens (cat04)
//
// Components:
//   • BottomSheet — shared sheet shell
//   • CircleCreateScreen — privacy + focus tag picker
//   • CircleJoinScreen — code entry + recently-viewed
//   • CircleOwnerControlsScreen — members / reports / challenges / invite
//   • MemberDetailSheet — make-mod / kick / ban
//   • CircleLeaderboardScreen — top 5 + blur upsell
//   • ChallengeCreateScreen — name + win-condition + duration
//   • ChallengeLiveScreen — standings with progress bars
//   • ChallengeWinScreen — full-bleed celebration
//   • ChatThreadScreen — bubbles + reactions + context menu
//   • MentionAutocomplete (slot component)
//   • ReportContentSheet — radio reasons
//   • BlockedUsersScreen — list + unblock
//   • InviteLinkSheet — copy / share / QR
//   • LeaveCircleModal — centered modal
// ═══════════════════════════════════════════════════════════════════════════

// ─── Icons ──────────────────────────────────────────────────────────────────
function IconChevR({ c, s = 16 }: { c: string; s?: number }) {
  return <svg width={s} height={s} viewBox="0 0 16 16" fill="none"><path d="M5 3l5 5-5 5" stroke={c} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" /></svg>;
}
function IconGrid({ c, s = 20 }: { c: string; s?: number }) {
  return <svg width={s} height={s} viewBox="0 0 24 24" fill="none"><rect x="4" y="4" width="7" height="7" rx="1" stroke={c} strokeWidth="1.6" /><rect x="13" y="4" width="7" height="7" rx="1" stroke={c} strokeWidth="1.6" /><rect x="4" y="13" width="7" height="7" rx="1" stroke={c} strokeWidth="1.6" /><rect x="13" y="13" width="7" height="7" rx="1" stroke={c} strokeWidth="1.6" /></svg>;
}
function IconUser({ c, s = 18 }: { c: string; s?: number }) {
  return <svg width={s} height={s} viewBox="0 0 24 24" fill="none"><circle cx="12" cy="8" r="4" stroke={c} strokeWidth="1.6" /><path d="M4 20c0-4 4-6 8-6s8 2 8 6" stroke={c} strokeWidth="1.6" strokeLinecap="round" /></svg>;
}
function IconFlag({ c, s = 18 }: { c: string; s?: number }) {
  return <svg width={s} height={s} viewBox="0 0 24 24" fill="none"><path d="M5 21V4l13 4-13 4" stroke={c} strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" /></svg>;
}
function IconShare({ c, s = 16 }: { c: string; s?: number }) {
  return <svg width={s} height={s} viewBox="0 0 24 24" fill="none"><circle cx="6" cy="12" r="2.5" stroke={c} strokeWidth="1.6" /><circle cx="18" cy="6" r="2.5" stroke={c} strokeWidth="1.6" /><circle cx="18" cy="18" r="2.5" stroke={c} strokeWidth="1.6" /><path d="M8 11l8-4M8 13l8 4" stroke={c} strokeWidth="1.6" /></svg>;
}
function IconQR({ c, s = 16 }: { c: string; s?: number }) {
  return <svg width={s} height={s} viewBox="0 0 24 24" fill="none"><rect x="3" y="3" width="7" height="7" stroke={c} strokeWidth="1.6" /><rect x="14" y="3" width="7" height="7" stroke={c} strokeWidth="1.6" /><rect x="3" y="14" width="7" height="7" stroke={c} strokeWidth="1.6" /><path d="M14 14h7M14 14v3M17 17h4M14 21h3M21 14v7" stroke={c} strokeWidth="1.6" /></svg>;
}
function IconClock({ c, s = 16 }: { c: string; s?: number }) {
  return <svg width={s} height={s} viewBox="0 0 24 24" fill="none"><circle cx="12" cy="12" r="9" stroke={c} strokeWidth="1.6" /><path d="M12 7v5l3 2" stroke={c} strokeWidth="1.6" strokeLinecap="round" /></svg>;
}
function IconPlus({ c, s = 18 }: { c: string; s?: number }) {
  return <svg width={s} height={s} viewBox="0 0 24 24" fill="none"><path d="M12 5v14M5 12h14" stroke={c} strokeWidth="1.8" strokeLinecap="round" /></svg>;
}
function IconTrash({ c, s = 15 }: { c: string; s?: number }) {
  return <svg width={s} height={s} viewBox="0 0 24 24" fill="none"><path d="M3 6h18M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6" stroke={c} strokeWidth="1.6" strokeLinecap="round" /></svg>;
}
function IconBack({ c, s = 18 }: { c: string; s?: number }) {
  return <svg width={s} height={s} viewBox="0 0 24 24" fill="none"><path d="M14 6l-6 6 6 6" stroke={c} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" /></svg>;
}

// ═══════════════════════════════════════════════════════════════════════════
// BottomSheet — shared sheet shell
// ═══════════════════════════════════════════════════════════════════════════

export function BottomSheet({
  C, onClose, children, maxWidth = 480,
}: {
  C: Theme; onClose?: () => void; children: React.ReactNode; maxWidth?: number;
}) {
  return (
    <div
      role="dialog"
      aria-modal="true"
      onClick={onClose}
      style={{
        position: "fixed", inset: 0, zIndex: 9000,
        background: "rgba(10,10,11,0.72)", backdropFilter: "blur(6px)",
        WebkitBackdropFilter: "blur(6px)",
        display: "flex", alignItems: "flex-end", justifyContent: "center",
        animation: "kFadeIn 0.22s ease-out",
      }}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          width: "100%", maxWidth,
          background: C.surface, borderRadius: "24px 24px 0 0",
          border: `1px solid ${C.border2}`,
          padding: "10px 20px 34px",
          animation: "kSlideIn 0.32s cubic-bezier(.2,.8,.2,1)",
          maxHeight: "85vh", overflowY: "auto",
        }}
      >
        <div style={{ width: 38, height: 4, borderRadius: 99, background: C.line3, margin: "0 auto 18px" }} />
        {children}
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════
// 1 · Create circle
// ═══════════════════════════════════════════════════════════════════════════

export const CIRCLE_FOCUS_TAGS = ["Futures", "Forex", "Crypto", "Stocks", "ICT", "Smart Money", "Wyckoff", "ORB", "Supply / Demand", "Prop firm", "Day trading", "Swing"];

export function CircleCreateScreen({
  C, onCreate, onBack,
}: {
  C: Theme;
  onCreate?: (form: { name: string; privacy: "private" | "public"; focus: string[] }) => void;
  onBack?: () => void;
}) {
  const [name, setName] = useState("");
  const [privacy, setPrivacy] = useState<"private" | "public">("private");
  const [focus, setFocus] = useState<string[]>([]);
  const toggleFocus = (t: string) =>
    setFocus(focus.includes(t) ? focus.filter(x => x !== t) : [...focus, t].slice(0, 4));
  const valid = name.trim().length >= 2 && focus.length > 0;

  return (
    <SettingsSub C={C} title="Create a Circle" onBack={onBack}>
      <Card C={C} pad={18} style={{ position: "relative", overflow: "hidden" }}>
        <div style={{
          position: "absolute", top: -60, right: -50, width: 200, height: 200,
          borderRadius: "50%",
          background: `conic-gradient(from 200deg at 50% 50%, ${C.orb3}, ${C.accent}, ${C.orb2}, ${C.orb3})`,
          filter: "blur(46px)", opacity: 0.4, pointerEvents: "none",
        }} />
        <div style={{ position: "relative" }}>
          <Kicker C={C} color={C.live}>New circle</Kicker>
          <div style={{
            fontFamily: DISPLAY, fontSize: "1.3125rem", fontWeight: 600,
            letterSpacing: "-0.02em", color: C.text, marginTop: 10,
          }}>
            Build your room.
          </div>
        </div>
      </Card>

      <SectionLabel C={C}>Name</SectionLabel>
      <div style={{
        display: "flex", alignItems: "center",
        borderBottom: `1px solid ${name ? C.live : C.border2}`, padding: "10px 0",
      }}>
        <input
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="London Futures"
          autoFocus
          style={{
            flex: 1, background: "transparent", border: "none", outline: "none",
            fontFamily: BODY, fontSize: 16, color: C.text, padding: 0,
          }}
        />
      </div>

      <SectionLabel C={C}>Privacy</SectionLabel>
      <div style={{ display: "flex", gap: 10 }}>
        {([
          { id: "private" as const, title: "Private", body: "Invite only" },
          { id: "public" as const, title: "Public", body: "Anyone can join" },
        ]).map(opt => {
          const on = privacy === opt.id;
          return (
            <button
              key={opt.id}
              onClick={() => setPrivacy(opt.id)}
              style={{
                flex: 1, padding: "14px", borderRadius: 14, textAlign: "left",
                background: on ? C.liveSoft : C.surface,
                border: `1px solid ${on ? `color-mix(in oklch, ${C.live} 40%, transparent)` : C.line}`,
                cursor: "pointer", fontFamily: BODY,
              }}
            >
              <div style={{ fontSize: "0.875rem", fontWeight: 600, color: C.text }}>{opt.title}</div>
              <div style={{ fontSize: "0.71875rem", color: C.text2, marginTop: 3 }}>{opt.body}</div>
            </button>
          );
        })}
      </div>

      <SectionLabel C={C}>Focus · pick up to 4</SectionLabel>
      <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
        {CIRCLE_FOCUS_TAGS.map(tag => {
          const on = focus.includes(tag);
          return (
            <button
              key={tag}
              onClick={() => toggleFocus(tag)}
              style={{
                padding: "8px 16px", borderRadius: 999,
                background: on ? C.accentSoft : "transparent",
                color: on ? C.accent : C.text,
                border: on
                  ? `1px solid color-mix(in oklch, ${C.accent} 40%, transparent)`
                  : `1px solid ${C.border2}`,
                fontFamily: BODY, fontSize: "0.8125rem", fontWeight: 500, cursor: "pointer",
              }}
            >
              {tag}
            </button>
          );
        })}
      </div>

      <div style={{ marginTop: 24 }}>
        <button
          onClick={() => onCreate?.({ name, privacy, focus })}
          disabled={!valid}
          style={{
            padding: "13px 22px", borderRadius: 999,
            background: valid ? C.live : C.panel,
            color: valid ? "#0A0A0A" : C.text2,
            border: "none", fontFamily: BODY, fontSize: "0.875rem", fontWeight: 600,
            width: "100%", cursor: valid ? "pointer" : "not-allowed",
          }}
        >
          Create circle
        </button>
      </div>
    </SettingsSub>
  );
}

// ═══════════════════════════════════════════════════════════════════════════
// 2 · Join by code
// ═══════════════════════════════════════════════════════════════════════════

export interface RecentCircleSuggestion {
  id: string; name: string; memberCount: number; privacy: "public" | "private"; avatar?: string;
}

export function CircleJoinScreen({
  C, recent = [], onJoin, onJoinCode, onBack, errorCode,
}: {
  C: Theme;
  recent?: RecentCircleSuggestion[];
  errorCode?: string;
  onJoin?: (circleId: string) => void;
  onJoinCode?: (code: string) => void;
  onBack?: () => void;
}) {
  const [code, setCode] = useState(errorCode ?? "");
  const valid = code.trim().length >= 6 && code !== errorCode;
  const showError = !!errorCode && code === errorCode;
  return (
    <SettingsSub C={C} title="Join a Circle" onBack={onBack}>
      <div style={{ fontSize: "0.84375rem", color: C.text2, lineHeight: 1.55, marginBottom: 8, fontFamily: BODY }}>
        Enter the invite code a circle owner shared with you.
      </div>
      <SectionLabel C={C}>Invite code</SectionLabel>
      <div style={{
        display: "flex", alignItems: "center",
        borderBottom: `1px solid ${showError ? C.red : valid ? C.live : C.border2}`,
        padding: "10px 0",
      }}>
        <input
          value={code}
          onChange={(e) => setCode(e.target.value.toUpperCase())}
          placeholder="ENTER-CODE"
          style={{
            flex: 1, background: "transparent", border: "none", outline: "none",
            fontFamily: MONO, fontSize: "1.125rem", color: C.text, letterSpacing: "0.06em",
            padding: 0,
          }}
        />
      </div>
      {showError && (
        <div style={{ fontSize: "0.71875rem", color: C.red, marginTop: 7, lineHeight: 1.4, fontFamily: BODY }}>
          That code is invalid or expired.
        </div>
      )}
      <div style={{ marginTop: 22 }}>
        <button
          onClick={() => onJoinCode?.(code)}
          disabled={!valid}
          style={{
            padding: "13px 22px", borderRadius: 999,
            background: "transparent", color: valid ? C.text : C.text2,
            border: `1px solid ${C.border2}`,
            fontFamily: BODY, fontSize: "0.875rem", fontWeight: 600,
            width: "100%", cursor: valid ? "pointer" : "not-allowed", opacity: valid ? 1 : 0.5,
          }}
        >
          Join
        </button>
      </div>
      {recent.length > 0 && (
        <>
          <SectionLabel C={C}>Recently viewed</SectionLabel>
          {recent.map(c => (
            <Card C={C} pad={14} key={c.id} style={{ marginBottom: 10 }}>
              <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                <AvatarCircle name={c.name} avatar={c.avatar} size={36} C={C} />
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: "0.84375rem", color: C.text, fontFamily: BODY }}>{c.name}</div>
                  <div style={{ fontFamily: MONO, fontSize: "0.625rem", color: C.muted, marginTop: 2 }}>
                    {c.privacy.toUpperCase()} · {c.memberCount.toLocaleString()} MEMBERS
                  </div>
                </div>
                <button
                  onClick={() => onJoin?.(c.id)}
                  style={{
                    padding: "8px 16px", borderRadius: 999,
                    background: "transparent", color: C.text,
                    border: `1px solid ${C.border2}`,
                    fontFamily: BODY, fontSize: "0.75rem", fontWeight: 600, cursor: "pointer",
                  }}
                >
                  Join
                </button>
              </div>
            </Card>
          ))}
        </>
      )}
    </SettingsSub>
  );
}

// ═══════════════════════════════════════════════════════════════════════════
// 3 · Owner controls
// ═══════════════════════════════════════════════════════════════════════════

export interface CircleOwnerRow {
  id: string; icon: "user" | "flag" | "grid" | "share";
  label: string; detail?: string;
  toneKey: "live" | "red" | "accent" | "warn";
  highlight?: boolean;
}

function OwnerIcon({ icon, c, s }: { icon: CircleOwnerRow["icon"]; c: string; s?: number }) {
  if (icon === "user") return <IconUser c={c} s={s} />;
  if (icon === "flag") return <IconFlag c={c} s={s} />;
  if (icon === "grid") return <IconGrid c={c} s={s} />;
  return <IconShare c={c} s={s} />;
}

export function CircleOwnerControlsScreen({
  C, circleName, memberCount, code, rows, onRow, onDelete, onBack,
}: {
  C: Theme;
  circleName: string; memberCount: number; code: string;
  rows: CircleOwnerRow[];
  onRow?: (id: string) => void;
  onDelete?: () => void;
  onBack?: () => void;
}) {
  return (
    <SettingsSub
      C={C}
      title="Manage circle"
      onBack={onBack}
      right={<MonoTag C={C} tone="accent">Owner</MonoTag>}
    >
      <Card C={C} pad={18}>
        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
          <div style={{
            width: 46, height: 46, borderRadius: 12, background: C.greenSoft,
            display: "flex", alignItems: "center", justifyContent: "center",
          }}>
            <IconGrid c={C.green} s={20} />
          </div>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontFamily: DISPLAY, fontSize: "1.0625rem", fontWeight: 600, color: C.text }}>{circleName}</div>
            <div style={{ fontFamily: MONO, fontSize: "0.625rem", color: C.muted, marginTop: 3 }}>
              {memberCount.toLocaleString()} MEMBERS · CODE {code}
            </div>
          </div>
        </div>
      </Card>
      <SectionLabel C={C}>Controls</SectionLabel>
      <Card C={C} pad={0}>
        {rows.map((row, i) => (
          <button
            key={row.id}
            onClick={() => onRow?.(row.id)}
            style={{
              display: "flex", alignItems: "center", gap: 12,
              padding: "14px 16px", borderTop: i ? `1px solid ${C.line}` : "none",
              background: "transparent", border: "none", width: "100%", cursor: "pointer",
              textAlign: "left",
            }}
          >
            <OwnerIcon icon={row.icon} c={C[row.toneKey]} />
            <span style={{ flex: 1, fontSize: "0.875rem", color: C.text, fontFamily: BODY }}>{row.label}</span>
            {row.detail && (
              <span style={{ fontFamily: MONO, fontSize: "0.6875rem", color: row.highlight ? C.red : C.muted }}>
                {row.detail}
              </span>
            )}
            <IconChevR c={C.muted} s={16} />
          </button>
        ))}
      </Card>
      <SectionLabel C={C}>Danger zone</SectionLabel>
      <button
        onClick={onDelete}
        style={{
          width: "100%", padding: "13px 22px", borderRadius: 999,
          background: "transparent", color: C.red,
          border: `1px solid color-mix(in oklch, ${C.red} 30%, transparent)`,
          fontFamily: BODY, fontSize: "0.875rem", fontWeight: 600, cursor: "pointer",
        }}
      >
        Delete circle
      </button>
    </SettingsSub>
  );
}

// ═══════════════════════════════════════════════════════════════════════════
// 4 · Member detail — ban / kick / mod
// ═══════════════════════════════════════════════════════════════════════════

export function MemberDetailSheet({
  C, handle, displayName, joinedDate,
  role = "Member", winRate, netR, posts,
  onMakeMod, onKick, onBan, onCancel,
}: {
  C: Theme;
  handle: string; displayName: string; joinedDate: string;
  role?: "Member" | "Moderator" | "Owner";
  winRate?: string; netR?: string; posts?: string;
  onMakeMod?: () => void; onKick?: () => void; onBan?: () => void;
  onCancel?: () => void;
}) {
  const isOwner = role === "Owner";
  return (
    <BottomSheet C={C} onClose={onCancel}>
      <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
        <AvatarCircle name={displayName} size={56} C={C} />
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontFamily: DISPLAY, fontSize: "1.1875rem", fontWeight: 600, color: C.text }}>{displayName}</div>
          <div style={{ fontFamily: MONO, fontSize: "0.625rem", color: C.muted, marginTop: 3 }}>
            @{handle} · JOINED {joinedDate.toUpperCase()}
          </div>
        </div>
        <MonoTag C={C} tone={isOwner ? "accent" : role === "Moderator" ? "live" : "accent"}>{role}</MonoTag>
      </div>
      <div style={{ display: "flex", gap: 10, margin: "18px 0" }}>
        {[
          { label: "Win rate", value: winRate ?? "—" },
          { label: "Net", value: netR ?? "—" },
          { label: "Posts", value: posts ?? "—" },
        ].map(s => (
          <div key={s.label} style={{
            flex: 1, padding: 12, borderRadius: 12, textAlign: "center",
            background: C.surfaceHi, border: `1px solid ${C.line}`,
          }}>
            <div style={{ fontFamily: MONO, fontSize: "0.5625rem", color: C.muted, textTransform: "uppercase" }}>
              {s.label}
            </div>
            <div style={{ fontFamily: DISPLAY, fontSize: "1.125rem", fontWeight: 600, color: C.text, marginTop: 4 }}>
              {s.value}
            </div>
          </div>
        ))}
      </div>
      <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
        {!isOwner && role !== "Moderator" && (
          <button
            onClick={onMakeMod}
            style={{
              padding: "13px 22px", borderRadius: 999, background: "transparent", color: C.text,
              border: `1px solid ${C.border2}`,
              fontFamily: BODY, fontSize: "0.875rem", fontWeight: 600, cursor: "pointer",
            }}
          >
            Make moderator
          </button>
        )}
        {!isOwner && (
          <div style={{ display: "flex", gap: 8 }}>
            <button
              onClick={onKick}
              style={{
                flex: 1, padding: "13px 22px", borderRadius: 999,
                background: "transparent", color: C.warn,
                border: `1px solid color-mix(in oklch, ${C.warn} 30%, transparent)`,
                fontFamily: BODY, fontSize: "0.875rem", fontWeight: 600, cursor: "pointer",
              }}
            >
              Kick
            </button>
            <button
              onClick={onBan}
              style={{
                flex: 1, padding: "13px 22px", borderRadius: 999,
                background: "transparent", color: C.red,
                border: `1px solid color-mix(in oklch, ${C.red} 30%, transparent)`,
                fontFamily: BODY, fontSize: "0.875rem", fontWeight: 600, cursor: "pointer",
              }}
            >
              Ban
            </button>
          </div>
        )}
      </div>
    </BottomSheet>
  );
}

// ═══════════════════════════════════════════════════════════════════════════
// 5 · Leaderboard expanded — top5 + blur upsell
// ═══════════════════════════════════════════════════════════════════════════

export interface LeaderboardRow { rank: number; handle: string; value: string; tone?: "green" | "red"; }

export function CircleLeaderboardScreen({
  C, period = "June", rows, totalRows, isPro = false, onUpgrade, onBack,
}: {
  C: Theme;
  period?: string;
  rows: LeaderboardRow[];        // visible rows
  totalRows: number;
  isPro?: boolean;
  onUpgrade?: () => void;
  onBack?: () => void;
}) {
  const top = rows.slice(0, 5);
  const showUpsell = !isPro && totalRows > 5;
  return (
    <SettingsSub
      C={C}
      title="Leaderboard"
      onBack={onBack}
      right={<MonoTag C={C} tone="live">{period}</MonoTag>}
    >
      {top.map((r, i) => (
        <div
          key={r.rank}
          style={{
            display: "flex", alignItems: "center", gap: 12,
            padding: "13px 16px", borderRadius: 12,
            background: i === 0 ? C.liveSoft : C.surface,
            border: `1px solid ${i === 0 ? `color-mix(in oklch, ${C.live} 30%, transparent)` : C.line}`,
            marginBottom: 8,
          }}
        >
          <span style={{
            fontFamily: DISPLAY, fontSize: 16, fontWeight: 600,
            color: i === 0 ? C.live : C.muted, width: 18,
          }}>
            {r.rank}
          </span>
          <AvatarCircle name={r.handle} size={32} C={C} />
          <span style={{ flex: 1, fontSize: "0.875rem", color: C.text, fontFamily: BODY }}>@{r.handle}</span>
          <span style={{
            fontFamily: DISPLAY, fontSize: "0.9375rem", fontWeight: 600,
            color: r.tone === "red" ? C.red : C.green,
          }}>
            {r.value}
          </span>
        </div>
      ))}
      {showUpsell && (
        <div style={{ position: "relative", marginTop: 4 }}>
          {[6, 7, 8].map(i => (
            <div
              key={i}
              style={{
                display: "flex", alignItems: "center", gap: 12,
                padding: "13px 16px", borderRadius: 12,
                background: C.surface, border: `1px solid ${C.line}`,
                marginBottom: 8, filter: "blur(5px)", opacity: 0.6,
              }}
            >
              <span style={{ width: 18, fontFamily: DISPLAY, color: C.muted }}>{i}</span>
              <div style={{ width: 32, height: 32, borderRadius: 999, background: C.surfaceHi }} />
              <div style={{ flex: 1, height: 12, background: C.surfaceHi, borderRadius: 6 }} />
            </div>
          ))}
          <div style={{
            position: "absolute", inset: 0,
            display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 10,
          }}>
            <div style={{ fontSize: "0.8125rem", color: C.text2, textAlign: "center", fontFamily: BODY }}>
              See the full leaderboard
            </div>
            <button
              onClick={onUpgrade}
              style={{
                padding: "10px 16px", borderRadius: 999, background: C.live,
                color: "#0A0A0A", border: "none",
                fontFamily: BODY, fontSize: "0.8125rem", fontWeight: 600, cursor: "pointer",
              }}
            >
              Upgrade to Pro
            </button>
          </div>
        </div>
      )}
    </SettingsSub>
  );
}

// ═══════════════════════════════════════════════════════════════════════════
// 6 · Challenge create
// ═══════════════════════════════════════════════════════════════════════════

const WIN_CONDITIONS = ["Most R", "Best win rate", "Longest streak", "Highest discipline"];
const DURATIONS = ["3 days", "5 days", "7 days", "30 days"];

export function ChallengeCreateScreen({
  C, onLaunch, onBack,
}: {
  C: Theme;
  onLaunch?: (form: { name: string; winCondition: string; duration: string }) => void;
  onBack?: () => void;
}) {
  const [name, setName] = useState("");
  const [winCondition, setWinCondition] = useState("Most R");
  const [duration, setDuration] = useState("5 days");
  const valid = name.trim().length >= 2;
  return (
    <SettingsSub C={C} title="New challenge" onBack={onBack}>
      <Card C={C} pad={18} style={{ position: "relative", overflow: "hidden" }}>
        <div style={{
          position: "absolute", top: -60, right: -50, width: 200, height: 200,
          borderRadius: "50%",
          background: `conic-gradient(from 200deg at 50% 50%, ${C.orb3}, ${C.accent}, ${C.orb2}, ${C.orb3})`,
          filter: "blur(46px)", opacity: 0.4, pointerEvents: "none",
        }} />
        <div style={{ position: "relative" }}>
          <Kicker C={C} color={C.live}>Circle challenge</Kicker>
          <div style={{
            fontFamily: DISPLAY, fontSize: "1.25rem", fontWeight: 600, color: C.text, marginTop: 10,
          }}>
            Compete on the metric that matters.
          </div>
        </div>
      </Card>
      <SectionLabel C={C}>Name</SectionLabel>
      <div style={{
        display: "flex", borderBottom: `1px solid ${name ? C.live : C.border2}`, padding: "10px 0",
      }}>
        <input
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="June Sprint"
          autoFocus
          style={{
            flex: 1, background: "transparent", border: "none", outline: "none",
            fontFamily: BODY, fontSize: 16, color: C.text, padding: 0,
          }}
        />
      </div>
      <SectionLabel C={C}>Win condition</SectionLabel>
      <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
        {WIN_CONDITIONS.map(w => {
          const on = winCondition === w;
          return (
            <button
              key={w}
              onClick={() => setWinCondition(w)}
              style={{
                padding: "8px 16px", borderRadius: 999,
                background: on ? C.accentSoft : "transparent",
                color: on ? C.accent : C.text,
                border: on
                  ? `1px solid color-mix(in oklch, ${C.accent} 40%, transparent)`
                  : `1px solid ${C.border2}`,
                fontFamily: BODY, fontSize: "0.8125rem", fontWeight: 500, cursor: "pointer",
              }}
            >
              {w}
            </button>
          );
        })}
      </div>
      <SectionLabel C={C}>Duration</SectionLabel>
      <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
        {DURATIONS.map(d => {
          const on = duration === d;
          return (
            <button
              key={d}
              onClick={() => setDuration(d)}
              style={{
                padding: "8px 16px", borderRadius: 999,
                background: on ? C.liveSoft : "transparent",
                color: on ? C.live : C.text,
                border: on
                  ? `1px solid color-mix(in oklch, ${C.live} 40%, transparent)`
                  : `1px solid ${C.border2}`,
                fontFamily: BODY, fontSize: "0.8125rem", fontWeight: 500, cursor: "pointer",
              }}
            >
              {d}
            </button>
          );
        })}
      </div>
      <div style={{ marginTop: 24 }}>
        <button
          onClick={() => onLaunch?.({ name, winCondition, duration })}
          disabled={!valid}
          style={{
            padding: "13px 22px", borderRadius: 999,
            background: valid ? C.live : C.panel,
            color: valid ? "#0A0A0A" : C.text2,
            border: "none", fontFamily: BODY, fontSize: "0.875rem", fontWeight: 600,
            width: "100%", cursor: valid ? "pointer" : "not-allowed",
          }}
        >
          Launch challenge
        </button>
      </div>
    </SettingsSub>
  );
}

// ═══════════════════════════════════════════════════════════════════════════
// 7 · Challenge live — standings
// ═══════════════════════════════════════════════════════════════════════════

export interface ChallengeStanding {
  handle: string; value: string; progress: number; isMe?: boolean;
}

export function ChallengeLiveScreen({
  C, name, winCondition, timeLeft, standings, onBack,
}: {
  C: Theme;
  name: string; winCondition: string; timeLeft: string;
  standings: ChallengeStanding[];
  onBack?: () => void;
}) {
  return (
    <SettingsSub
      C={C} title="Challenge" onBack={onBack}
      right={<MonoTag C={C} tone="live">Live</MonoTag>}
    >
      <Card C={C} pad={20} style={{ position: "relative", overflow: "hidden" }}>
        <div style={{
          position: "absolute", top: -60, right: -50, width: 200, height: 200,
          borderRadius: "50%",
          background: `conic-gradient(from 200deg at 50% 50%, ${C.orb3}, ${C.accent}, ${C.orb2}, ${C.orb3})`,
          filter: "blur(46px)", opacity: 0.4, pointerEvents: "none",
        }} />
        <div style={{ position: "relative" }}>
          <Kicker C={C} color={C.live}>{winCondition.toLowerCase()}</Kicker>
          <div style={{
            fontFamily: DISPLAY, fontSize: "1.375rem", fontWeight: 600,
            letterSpacing: "-0.02em", color: C.text, marginTop: 10,
          }}>
            {name}
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: 8, marginTop: 14 }}>
            <IconClock c={C.warn} s={16} />
            <span style={{ fontFamily: MONO, fontSize: "0.75rem", color: C.warn }}>
              {timeLeft.toUpperCase()} LEFT
            </span>
          </div>
        </div>
      </Card>
      <SectionLabel C={C}>Standings</SectionLabel>
      {standings.map((s, i) => (
        <div
          key={s.handle}
          style={{
            padding: "12px 16px", borderRadius: 12,
            background: s.isMe ? C.accentSoft : C.surface,
            border: `1px solid ${s.isMe ? `color-mix(in oklch, ${C.accent} 30%, transparent)` : C.line}`,
            marginBottom: 8,
          }}
        >
          <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 8 }}>
            <span style={{ fontSize: "0.84375rem", color: C.text, fontFamily: BODY }}>
              {i + 1}. @{s.handle}
            </span>
            <span style={{
              fontFamily: DISPLAY, fontSize: "0.875rem", fontWeight: 600,
              color: s.value.startsWith("-") ? C.red : C.green,
            }}>
              {s.value}
            </span>
          </div>
          <div style={{
            width: "100%", height: 6, borderRadius: 999,
            background: C.surfaceHi, overflow: "hidden",
          }}>
            <div style={{
              width: `${Math.min(100, Math.max(0, s.progress))}%`, height: "100%",
              background: i === 0 ? C.live : C.green,
              borderRadius: 999, transition: "width 0.3s",
            }} />
          </div>
        </div>
      ))}
    </SettingsSub>
  );
}

// ═══════════════════════════════════════════════════════════════════════════
// 8 · Challenge result — celebration
// ═══════════════════════════════════════════════════════════════════════════

export function ChallengeWinScreen({
  C, rank = "1st", challengeName = "June Sprint",
  body = "+18R over 5 days, top of 128 traders. Respect.",
  onShare, onViewBoard,
}: {
  C: Theme;
  rank?: string; challengeName?: string; body?: string;
  onShare?: () => void; onViewBoard?: () => void;
}) {
  return (
    <div style={{
      minHeight: "100dvh", background: C.bg, color: C.text,
      position: "relative", overflow: "hidden",
    }}>
      <div style={{
        position: "absolute", inset: 0,
        background: `radial-gradient(120% 70% at 50% 25%, color-mix(in oklch, ${C.live} 22%, transparent), ${C.bg} 70%)`,
      }} />
      <div style={{
        position: "relative", zIndex: 2, minHeight: "100dvh",
        display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center",
        padding: "72px 30px 40px", textAlign: "center", boxSizing: "border-box",
      }}>
        <div style={{
          width: 96, height: 96, borderRadius: 999, background: C.live,
          display: "flex", alignItems: "center", justifyContent: "center",
          marginBottom: 24,
          boxShadow: `0 0 0 14px color-mix(in oklch, ${C.live} 12%, transparent)`,
          animation: "kRise 0.6s cubic-bezier(.2,.8,.2,1)",
        }}>
          <span style={{
            fontFamily: DISPLAY, fontSize: "2.625rem", fontWeight: 700, color: "#0A0A0B",
          }}>
            {rank}
          </span>
        </div>
        <Kicker C={C} color={C.live}>{challengeName} · complete</Kicker>
        <div style={{
          fontFamily: DISPLAY, fontSize: "1.875rem", fontWeight: 600,
          letterSpacing: "-0.03em", color: C.text, marginTop: 14, lineHeight: 1.05,
        }}>
          You won the<br />
          <span style={{ fontStyle: "italic", color: C.live }}>challenge.</span>
        </div>
        <div style={{
          fontSize: "0.875rem", color: C.text2, marginTop: 14, lineHeight: 1.55,
          maxWidth: "36ch", fontFamily: BODY,
        }}>
          {body}
        </div>
        <div style={{ display: "flex", gap: 10, marginTop: 28, width: "100%", maxWidth: 360 }}>
          <button
            onClick={onShare}
            style={{
              flex: 1, padding: "13px 20px", borderRadius: 999,
              background: C.live, color: "#0A0A0A", border: "none",
              fontFamily: BODY, fontSize: "0.875rem", fontWeight: 600, cursor: "pointer",
            }}
          >
            Share win
          </button>
          <button
            onClick={onViewBoard}
            style={{
              flex: 1, padding: "13px 20px", borderRadius: 999,
              background: "transparent", color: C.text, border: `1px solid ${C.border2}`,
              fontFamily: BODY, fontSize: "0.875rem", fontWeight: 600, cursor: "pointer",
            }}
          >
            View board
          </button>
        </div>
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════
// 9 · Chat thread + reactions + context menu
// ═══════════════════════════════════════════════════════════════════════════

export interface ChatMessage {
  id: string; handle: string; body: string;
  isMe?: boolean;
  reactions?: { emoji: string; count: number }[];
}

export function ChatThreadScreen({
  C, circleName, onlineCount, messages, contextMenuFor,
  onBack, onSend, onMenuAction,
}: {
  C: Theme;
  circleName: string;
  onlineCount?: number;
  messages: ChatMessage[];
  contextMenuFor?: string;
  onBack?: () => void;
  onSend?: (text: string) => void;
  onMenuAction?: (msgId: string, action: "react" | "quote" | "report" | "delete") => void;
}) {
  const [draft, setDraft] = useState("");
  return (
    <div style={{
      minHeight: "100dvh", background: C.bg, color: C.text,
      display: "flex", flexDirection: "column", maxWidth: 600, margin: "0 auto",
    }}>
      <div style={{
        padding: "16px 18px 12px", borderBottom: `1px solid ${C.line}`,
        display: "flex", alignItems: "center", gap: 12,
        position: "sticky", top: 0, background: C.bg, zIndex: 5,
      }}>
        <button
          onClick={onBack}
          aria-label="Back"
          style={{
            width: 36, height: 36, borderRadius: 999, background: C.surface,
            border: `1px solid ${C.line}`, display: "flex", alignItems: "center", justifyContent: "center",
            cursor: "pointer", padding: 0,
          }}
        >
          <IconBack c={C.text} />
        </button>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontSize: "0.9375rem", fontWeight: 600, color: C.text, fontFamily: BODY }}>{circleName}</div>
          {onlineCount !== undefined && (
            <div style={{ fontFamily: MONO, fontSize: "0.59375rem", color: C.live, marginTop: 2 }}>
              ● {onlineCount} ONLINE
            </div>
          )}
        </div>
      </div>
      <div style={{
        flex: 1, padding: "16px 18px",
        display: "flex", flexDirection: "column", gap: 14,
        position: "relative",
      }}>
        {messages.map(m => (
          <div key={m.id} style={{
            display: "flex", flexDirection: "column",
            alignItems: m.isMe ? "flex-end" : "flex-start",
            position: "relative",
          }}>
            {!m.isMe && (
              <div style={{
                fontFamily: MONO, fontSize: "0.5625rem", color: C.muted, margin: "0 0 4px 8px",
              }}>
                @{m.handle}
              </div>
            )}
            <div style={{
              maxWidth: "78%", padding: "10px 14px",
              borderRadius: m.isMe ? "16px 16px 4px 16px" : "16px 16px 16px 4px",
              background: m.isMe ? C.live : C.surface,
              color: m.isMe ? "#0A0A0B" : C.text,
              fontSize: "0.84375rem", lineHeight: 1.4, fontFamily: BODY,
              border: m.isMe ? "none" : `1px solid ${C.line}`,
            }}>
              {m.body}
            </div>
            {m.reactions && m.reactions.length > 0 && (
              <div style={{ display: "flex", gap: 4, marginTop: 5, marginLeft: 8 }}>
                {m.reactions.map((r, i) => (
                  <span
                    key={i}
                    style={{
                      padding: "2px 7px", borderRadius: 99,
                      background: C.surfaceHi, border: `1px solid ${C.line}`,
                      fontSize: "0.6875rem",
                    }}
                  >
                    {r.emoji} {r.count}
                  </span>
                ))}
              </div>
            )}
            {contextMenuFor === m.id && (
              <div style={{
                alignSelf: m.isMe ? "flex-end" : "flex-start",
                marginTop: 6,
                background: C.surfaceHi, border: `1px solid ${C.border2}`,
                borderRadius: 12, padding: 4, width: 180,
                boxShadow: "0 12px 30px rgba(0,0,0,0.4)",
                animation: "kRise 0.18s ease-out",
              }}>
                {([
                  { id: "react" as const, label: "React", icon: <IconPlus c={C.text2} s={15} /> },
                  { id: "quote" as const, label: "Quote", icon: <IconShare c={C.text2} s={15} /> },
                  { id: "report" as const, label: "Report", icon: <IconFlag c={C.red} s={15} />, danger: true },
                  { id: "delete" as const, label: "Delete", icon: <IconTrash c={C.red} s={15} />, danger: true },
                ]).map(opt => (
                  <button
                    key={opt.id}
                    onClick={() => onMenuAction?.(m.id, opt.id)}
                    style={{
                      display: "flex", alignItems: "center", gap: 10,
                      padding: "9px 10px", borderRadius: 8, width: "100%",
                      color: opt.danger ? C.red : C.text,
                      fontSize: "0.8125rem", fontFamily: BODY,
                      background: "transparent", border: "none", cursor: "pointer", textAlign: "left",
                    }}
                  >
                    {opt.icon}
                    {opt.label}
                  </button>
                ))}
              </div>
            )}
          </div>
        ))}
      </div>
      <div style={{
        position: "sticky", bottom: 0,
        padding: "10px 14px calc(30px + env(safe-area-inset-bottom))",
        background: C.bg, borderTop: `1px solid ${C.line}`,
      }}>
        <div style={{
          display: "flex", alignItems: "center", gap: 10,
          padding: "8px 8px 8px 16px", borderRadius: 999,
          background: C.surface, border: `1px solid ${C.border2}`,
        }}>
          <button
            aria-label="Attach"
            style={{
              background: "transparent", border: "none", padding: 0, cursor: "pointer",
              display: "flex",
            }}
          >
            <IconPlus c={C.muted} s={18} />
          </button>
          <input
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && draft.trim()) {
                onSend?.(draft);
                setDraft("");
              }
            }}
            placeholder="Message…"
            style={{
              flex: 1, background: "transparent", border: "none", outline: "none",
              fontFamily: BODY, fontSize: "0.8125rem", color: C.text, padding: 0,
            }}
          />
          <button
            onClick={() => { if (draft.trim()) { onSend?.(draft); setDraft(""); } }}
            aria-label="Send"
            style={{
              width: 32, height: 32, borderRadius: 999,
              background: draft.trim() ? C.live : C.panel,
              display: "flex", alignItems: "center", justifyContent: "center",
              border: "none", cursor: draft.trim() ? "pointer" : "not-allowed",
              padding: 0,
            }}
          >
            <IconChevR c={draft.trim() ? "#0A0A0B" : C.muted} s={16} />
          </button>
        </div>
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════
// 10 · @mention autocomplete (inline component, not full screen)
// ═══════════════════════════════════════════════════════════════════════════

export interface MentionUser { handle: string; displayName: string; avatar?: string; }

export function MentionAutocomplete({
  C, users, activeIndex = 0, onPick,
}: {
  C: Theme; users: MentionUser[]; activeIndex?: number;
  onPick?: (u: MentionUser) => void;
}) {
  if (users.length === 0) return null;
  return (
    <div style={{
      position: "absolute", left: 14, right: 14, bottom: 96,
      maxWidth: 480, margin: "0 auto",
    }}>
      <Card C={C} pad={0} style={{ background: C.surfaceHi }}>
        {users.map((u, i) => {
          const active = i === activeIndex;
          return (
            <button
              key={u.handle}
              onClick={() => onPick?.(u)}
              style={{
                display: "flex", alignItems: "center", gap: 10,
                padding: "10px 14px", borderTop: i ? `1px solid ${C.line}` : "none",
                background: active ? C.accentSoft : "transparent",
                border: "none", cursor: "pointer", width: "100%", textAlign: "left",
              }}
            >
              <AvatarCircle name={u.displayName} avatar={u.avatar} size={28} C={C} />
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: "0.8125rem", color: C.text, fontFamily: BODY }}>@{u.handle}</div>
                <div style={{ fontFamily: MONO, fontSize: "0.59375rem", color: C.muted, textTransform: "uppercase" }}>
                  {u.displayName}
                </div>
              </div>
            </button>
          );
        })}
      </Card>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════
// 11 · Report content — reasons sheet
// ═══════════════════════════════════════════════════════════════════════════

export const REPORT_REASONS = [
  "Spam or scam",
  "Harassment",
  "Bad trading advice / signals",
  "Impersonation",
  "Hate speech",
  "Something else",
];

export function ReportContentSheet({
  C, onCancel, onSubmit,
}: {
  C: Theme; onCancel?: () => void; onSubmit?: (reason: string) => void;
}) {
  const [picked, setPicked] = useState<string | null>(null);
  return (
    <BottomSheet C={C} onClose={onCancel}>
      <Kicker C={C} color={C.red}>Report</Kicker>
      <div style={{ fontFamily: DISPLAY, fontSize: "1.25rem", fontWeight: 600, color: C.text, marginTop: 10 }}>
        Why are you reporting this?
      </div>
      <div style={{ marginTop: 16, display: "flex", flexDirection: "column", gap: 8 }}>
        {REPORT_REASONS.map(r => {
          const on = picked === r;
          return (
            <button
              key={r}
              onClick={() => setPicked(r)}
              style={{
                display: "flex", alignItems: "center", gap: 12,
                padding: "14px 16px", borderRadius: 12,
                background: on ? C.surfaceHi : C.surface,
                border: `1px solid ${on ? C.border2 : C.line}`,
                width: "100%", cursor: "pointer", textAlign: "left",
              }}
            >
              <span style={{ flex: 1, fontSize: "0.875rem", color: C.text, fontFamily: BODY }}>{r}</span>
              <div style={{
                width: 20, height: 20, borderRadius: 999,
                border: `1.5px solid ${on ? C.accent : C.border2}`,
                background: on ? C.accent : "transparent",
              }} />
            </button>
          );
        })}
      </div>
      <div style={{ marginTop: 20 }}>
        <button
          onClick={() => picked && onSubmit?.(picked)}
          disabled={!picked}
          style={{
            padding: "13px 22px", borderRadius: 999,
            background: picked ? C.red : C.panel,
            color: picked ? "#fff" : C.text2,
            border: "none", fontFamily: BODY, fontSize: "0.875rem", fontWeight: 600,
            width: "100%", cursor: picked ? "pointer" : "not-allowed",
          }}
        >
          Submit report
        </button>
      </div>
    </BottomSheet>
  );
}

// ═══════════════════════════════════════════════════════════════════════════
// 12 · Blocked users
// ═══════════════════════════════════════════════════════════════════════════

export interface BlockedUser { handle: string; blockedDate: string; avatar?: string; }

export function BlockedUsersScreen({
  C, users, onUnblock, onBack,
}: {
  C: Theme; users: BlockedUser[];
  onUnblock?: (handle: string) => void;
  onBack?: () => void;
}) {
  return (
    <SettingsSub C={C} title="Blocked users" onBack={onBack}>
      <div style={{ fontSize: "0.8125rem", color: C.text2, lineHeight: 1.55, marginBottom: 14, fontFamily: BODY }}>
        Blocked traders can't follow you, message you, or see your posts.
      </div>
      {users.length === 0 ? (
        <Card C={C} pad={20} style={{ textAlign: "center" }}>
          <div style={{ fontSize: "0.875rem", color: C.text2, fontFamily: BODY }}>
            You haven't blocked anyone.
          </div>
        </Card>
      ) : (
        <Card C={C} pad={0}>
          {users.map((u, i) => (
            <div
              key={u.handle}
              style={{
                display: "flex", alignItems: "center", gap: 12,
                padding: "14px 16px", borderTop: i ? `1px solid ${C.line}` : "none",
              }}
            >
              <AvatarCircle name={u.handle} avatar={u.avatar} size={34} C={C} />
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: "0.84375rem", color: C.text, fontFamily: BODY }}>@{u.handle}</div>
                <div style={{ fontFamily: MONO, fontSize: "0.59375rem", color: C.muted, marginTop: 2, textTransform: "uppercase" }}>
                  {u.blockedDate}
                </div>
              </div>
              <button
                onClick={() => onUnblock?.(u.handle)}
                style={{
                  padding: "8px 14px", borderRadius: 999,
                  background: "transparent", color: C.text,
                  border: `1px solid ${C.border2}`,
                  fontFamily: BODY, fontSize: "0.75rem", fontWeight: 600, cursor: "pointer",
                }}
              >
                Unblock
              </button>
            </div>
          ))}
        </Card>
      )}
    </SettingsSub>
  );
}

// ═══════════════════════════════════════════════════════════════════════════
// 13 · Invite link sheet
// ═══════════════════════════════════════════════════════════════════════════

export function InviteLinkSheet({
  C, circleName, link, onCopy, onShare, onQR, onCancel,
}: {
  C: Theme; circleName: string; link: string;
  onCopy?: () => void; onShare?: () => void; onQR?: () => void; onCancel?: () => void;
}) {
  const [copied, setCopied] = useState(false);
  const handleCopy = async () => {
    try { await navigator.clipboard.writeText(link); setCopied(true); setTimeout(() => setCopied(false), 2000); onCopy?.(); } catch { /* noop */ }
  };
  return (
    <BottomSheet C={C} onClose={onCancel}>
      <Kicker C={C} color={C.live}>Invite link</Kicker>
      <div style={{ fontFamily: DISPLAY, fontSize: "1.25rem", fontWeight: 600, color: C.text, marginTop: 10 }}>
        Invite to {circleName}
      </div>
      <div style={{
        display: "flex", alignItems: "center", gap: 10,
        marginTop: 18, padding: "14px 16px", borderRadius: 12,
        background: C.surfaceHi, border: `1px solid ${C.border2}`,
      }}>
        <span style={{
          flex: 1, fontFamily: MONO, fontSize: "0.75rem", color: C.text, letterSpacing: "0.02em",
          overflow: "hidden", whiteSpace: "nowrap", textOverflow: "ellipsis",
        }}>
          {link}
        </span>
        <button
          onClick={handleCopy}
          style={{
            padding: "8px 14px", borderRadius: 999,
            background: C.live, color: "#0A0A0A", border: "none",
            fontFamily: BODY, fontSize: "0.75rem", fontWeight: 600, cursor: "pointer",
          }}
        >
          {copied ? "Copied" : "Copy"}
        </button>
      </div>
      <div style={{ display: "flex", gap: 10, marginTop: 14 }}>
        <button
          onClick={onShare}
          style={{
            flex: 1, display: "flex", alignItems: "center", justifyContent: "center", gap: 8,
            padding: "13px 18px", borderRadius: 999,
            background: "transparent", color: C.text, border: `1px solid ${C.border2}`,
            fontFamily: BODY, fontSize: "0.8125rem", fontWeight: 600, cursor: "pointer",
          }}
        >
          <IconShare c={C.text} s={16} /> Share
        </button>
        <button
          onClick={onQR}
          style={{
            flex: 1, display: "flex", alignItems: "center", justifyContent: "center", gap: 8,
            padding: "13px 18px", borderRadius: 999,
            background: "transparent", color: C.text, border: `1px solid ${C.border2}`,
            fontFamily: BODY, fontSize: "0.8125rem", fontWeight: 600, cursor: "pointer",
          }}
        >
          <IconQR c={C.text} s={16} /> QR code
        </button>
      </div>
      <div style={{ marginTop: 16, fontSize: "0.71875rem", color: C.muted, textAlign: "center", fontFamily: BODY }}>
        Anyone with this link can request to join. Reset anytime.
      </div>
    </BottomSheet>
  );
}

// ═══════════════════════════════════════════════════════════════════════════
// 14 · Leave circle confirm modal
// ═══════════════════════════════════════════════════════════════════════════

export function LeaveCircleModal({
  C, circleName, onCancel, onLeave,
}: {
  C: Theme; circleName: string; onCancel?: () => void; onLeave?: () => void;
}) {
  return (
    <div
      role="dialog"
      aria-modal="true"
      onClick={onCancel}
      style={{
        position: "fixed", inset: 0, zIndex: 9000,
        background: "rgba(10,10,11,0.72)", backdropFilter: "blur(6px)",
        WebkitBackdropFilter: "blur(6px)",
        display: "flex", alignItems: "center", justifyContent: "center",
        padding: 22, animation: "kFadeIn 0.22s ease-out",
      }}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          width: "100%", maxWidth: 380, borderRadius: 24,
          background: C.panel, border: `1px solid ${C.border2}`,
          padding: 24, textAlign: "center",
          animation: "kRise 0.32s cubic-bezier(.2,.8,.2,1)",
        }}
      >
        <div style={{
          width: 52, height: 52, borderRadius: 12,
          background: C.surfaceHi, border: `1px solid ${C.border2}`,
          display: "flex", alignItems: "center", justifyContent: "center",
          margin: "0 auto 16px",
        }}>
          <IconGrid c={C.warn} s={24} />
        </div>
        <div style={{ fontFamily: DISPLAY, fontSize: "1.25rem", fontWeight: 600, color: C.text }}>
          Leave {circleName}?
        </div>
        <div style={{ fontSize: "0.8125rem", color: C.text2, marginTop: 10, lineHeight: 1.5, fontFamily: BODY }}>
          You'll stop seeing its chat and leaderboard. You can rejoin with the code anytime.
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
            onClick={onLeave}
            style={{
              flex: 1, padding: "13px 20px", borderRadius: 999,
              background: C.text, color: C.bg, border: "none",
              fontFamily: BODY, fontSize: "0.875rem", fontWeight: 600, cursor: "pointer",
            }}
          >
            Leave
          </button>
        </div>
      </div>
    </div>
  );
}
