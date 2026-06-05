import { useState } from "react";
import type { Theme } from "../theme";
import { MONO, BODY, DISPLAY, Card, AvatarCircle } from "../shared";
import { SettingsSub, SectionLabel } from "../settings/SettingsScreens";

// ═══════════════════════════════════════════════════════════════════════════
// Social & Circles screens (cat04)
//
// Components:
//   • BanKickModal        — confirm kick/ban before calling kickMember
//   • OwnerControlsScreen — manage circle settings, privacy, danger zone
//   • ReportSheet         — report a message or member (reason picker)
//   • MemberDetailCard    — member detail bottom sheet with stats + actions
//   • MessageContextMenu  — copy / quote / report / delete for a chat message
// ═══════════════════════════════════════════════════════════════════════════

// ─── Icons ──────────────────────────────────────────────────────────────────
function IconTrash({ c, s = 20 }: { c: string; s?: number }) {
  return (
    <svg width={s} height={s} viewBox="0 0 24 24" fill="none">
      <path d="M3 6h18M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6" stroke={c} strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}
function IconFlag({ c, s = 20 }: { c: string; s?: number }) {
  return (
    <svg width={s} height={s} viewBox="0 0 24 24" fill="none">
      <path d="M4 15s1-1 4-1 5 2 8 2 4-1 4-1V3s-1 1-4 1-5-2-8-2-4 1-4 1zM4 22v-7" stroke={c} strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}
function IconShield({ c, s = 20 }: { c: string; s?: number }) {
  return (
    <svg width={s} height={s} viewBox="0 0 24 24" fill="none">
      <path d="M12 2L4 6v6c0 5.25 3.5 10.14 8 11.5C16.5 22.14 20 17.25 20 12V6L12 2z" stroke={c} strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}
function IconChevR({ c, s = 16 }: { c: string; s?: number }) {
  return (
    <svg width={s} height={s} viewBox="0 0 16 16" fill="none">
      <path d="M5 3l5 5-5 5" stroke={c} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}
function IconCopy({ c, s = 16 }: { c: string; s?: number }) {
  return (
    <svg width={s} height={s} viewBox="0 0 24 24" fill="none">
      <rect x="9" y="9" width="13" height="13" rx="2" stroke={c} strokeWidth="1.6" />
      <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" stroke={c} strokeWidth="1.6" strokeLinecap="round" />
    </svg>
  );
}
function IconQuote({ c, s = 16 }: { c: string; s?: number }) {
  return (
    <svg width={s} height={s} viewBox="0 0 24 24" fill="none">
      <path d="M3 21c3 0 7-1 7-8V5c0-1.25-.756-2.017-2-2H4c-1.25 0-2 .75-2 1.972V11c0 1.25.75 2 2 2 1 0 1 0 1 1v1c0 1-1 2-2 2s-1 .008-1 1.031V20c0 1 0 1 1 1zm12 0c3 0 7-1 7-8V5c0-1.25-.757-2.017-2-2h-4c-1.25 0-2 .75-2 1.972V11c0 1.25.75 2 2 2h.75c0 2.25.25 4-2.75 4v3c0 1 0 1 1 1z" stroke={c} strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

// ═══════════════════════════════════════════════════════════════════════════
// 1 · Ban / Kick confirmation modal
// ═══════════════════════════════════════════════════════════════════════════

export function BanKickModal({
  C, memberName, action = "kick", onCancel, onConfirm,
}: {
  C: Theme; memberName: string; action?: "kick" | "ban";
  onCancel?: () => void; onConfirm?: () => void;
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
        <div style={{ fontFamily: DISPLAY, fontSize: 21, fontWeight: 600, color: C.text }}>
          {action === "ban" ? "Ban" : "Kick"} {memberName}?
        </div>
        <div style={{ fontSize: 13.5, color: C.text2, marginTop: 10, lineHeight: 1.55, fontFamily: BODY }}>
          {action === "ban"
            ? `${memberName} will be removed and permanently blocked from rejoining this circle.`
            : `${memberName} will be removed from the circle. They can rejoin with the invite code.`}
        </div>
        <div style={{ display: "flex", gap: 10, marginTop: 22 }}>
          <button
            onClick={onCancel}
            style={{
              flex: 1, padding: "13px 20px", borderRadius: 999,
              background: "transparent", color: C.text, border: `1px solid ${C.border2}`,
              fontFamily: BODY, fontSize: 14, fontWeight: 600, cursor: "pointer",
            }}
          >
            Cancel
          </button>
          <button
            onClick={onConfirm}
            style={{
              flex: 1, padding: "13px 20px", borderRadius: 999,
              background: C.red, color: "#fff", border: "none",
              fontFamily: BODY, fontSize: 14, fontWeight: 600, cursor: "pointer",
            }}
          >
            {action === "ban" ? "Ban" : "Kick"}
          </button>
        </div>
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════
// 2 · Owner controls screen
// ═══════════════════════════════════════════════════════════════════════════

export function OwnerControlsScreen({
  C, circleName, circleCode, privacy = "public",
  onRename, onTogglePrivacy, onRegenerateCode, onDeleteCircle, onBack,
}: {
  C: Theme; circleName: string; circleCode: string; privacy?: "public" | "private";
  onRename?: (name: string) => void;
  onTogglePrivacy?: (privacy: "public" | "private") => void;
  onRegenerateCode?: () => void;
  onDeleteCircle?: () => void;
  onBack?: () => void;
}) {
  const [name, setName] = useState(circleName);
  const [dirty, setDirty] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);

  return (
    <SettingsSub C={C} title="Owner controls" onBack={onBack}>
      <SectionLabel C={C}>Circle name</SectionLabel>
      <Card C={C} pad={16}>
        <input
          value={name}
          onChange={(e) => { setName(e.target.value); setDirty(e.target.value !== circleName); }}
          style={{
            width: "100%", background: "transparent", border: "none", outline: "none",
            fontFamily: BODY, fontSize: 16, color: C.text, padding: 0,
            boxSizing: "border-box",
          }}
          placeholder="Circle name"
        />
      </Card>
      {dirty && (
        <button
          onClick={() => { onRename?.(name); setDirty(false); }}
          style={{
            padding: "12px 22px", borderRadius: 999, background: C.live, color: "#0A0A0A",
            border: "none", fontFamily: BODY, fontSize: 14, fontWeight: 600,
            width: "100%", cursor: "pointer",
          }}
        >
          Save name
        </button>
      )}

      <SectionLabel C={C}>Privacy</SectionLabel>
      <Card C={C} pad={0}>
        {(["public", "private"] as const).map((p, i) => {
          const on = privacy === p;
          return (
            <button
              key={p}
              onClick={() => onTogglePrivacy?.(p)}
              style={{
                display: "flex", alignItems: "center", gap: 12,
                padding: "15px 16px", borderTop: i ? `1px solid ${C.line}` : "none",
                background: "transparent", border: "none", width: "100%", cursor: "pointer",
                textAlign: "left",
              }}
            >
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: 14, color: C.text, fontFamily: BODY, fontWeight: 500 }}>
                  {p === "public" ? "Public" : "Private"}
                </div>
                <div style={{ fontFamily: MONO, fontSize: 10, color: C.muted, marginTop: 2 }}>
                  {p === "public" ? "Anyone with the code can join" : "Invite only — you approve members"}
                </div>
              </div>
              <div style={{
                width: 22, height: 22, borderRadius: 999,
                border: `1.5px solid ${on ? C.live : C.border2}`,
                background: on ? C.live : "transparent",
                display: "flex", alignItems: "center", justifyContent: "center",
              }}>
                {on && (
                  <svg width="12" height="12" viewBox="0 0 24 24" fill="none">
                    <path d="M5 12l5 5L19 8" stroke="#0A0A0B" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" />
                  </svg>
                )}
              </div>
            </button>
          );
        })}
      </Card>

      <SectionLabel C={C}>Invite code</SectionLabel>
      <Card C={C} pad={16}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
          <div style={{ fontFamily: MONO, fontSize: 16, color: C.text, letterSpacing: "0.12em" }}>
            {circleCode}
          </div>
          <button
            onClick={onRegenerateCode}
            style={{
              padding: "7px 14px", borderRadius: 999, background: "transparent",
              color: C.muted, border: `1px solid ${C.border2}`,
              fontFamily: MONO, fontSize: 10, letterSpacing: "0.08em", cursor: "pointer",
            }}
          >
            REGENERATE
          </button>
        </div>
        <div style={{ fontFamily: BODY, fontSize: 12, color: C.muted, marginTop: 8, lineHeight: 1.5 }}>
          Regenerating invalidates the current code — existing members stay.
        </div>
      </Card>

      <SectionLabel C={C}>Danger zone</SectionLabel>
      <Card C={C} pad={16}>
        {!showDeleteConfirm ? (
          <button
            onClick={() => setShowDeleteConfirm(true)}
            style={{
              display: "flex", alignItems: "center", gap: 10,
              background: "transparent", border: "none", cursor: "pointer", padding: 0, width: "100%",
            }}
          >
            <div style={{
              width: 36, height: 36, borderRadius: 999, background: C.redSoft,
              display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0,
            }}>
              <IconTrash c={C.red} s={18} />
            </div>
            <div style={{ flex: 1, textAlign: "left" }}>
              <div style={{ fontSize: 14, color: C.red, fontFamily: BODY, fontWeight: 500 }}>
                Delete circle
              </div>
              <div style={{ fontFamily: MONO, fontSize: 10, color: C.muted, marginTop: 2 }}>
                Permanently removes this circle and all its data
              </div>
            </div>
            <IconChevR c={C.red} s={16} />
          </button>
        ) : (
          <div>
            <div style={{ fontFamily: BODY, fontSize: 13, color: C.text2, lineHeight: 1.55, marginBottom: 14 }}>
              This will permanently delete <span style={{ color: C.text, fontWeight: 600 }}>{circleName}</span>. All members, messages, and trophies will be lost. This cannot be undone.
            </div>
            <div style={{ display: "flex", gap: 8 }}>
              <button
                onClick={() => setShowDeleteConfirm(false)}
                style={{
                  flex: 1, padding: "11px 16px", borderRadius: 999,
                  background: "transparent", color: C.text, border: `1px solid ${C.border2}`,
                  fontFamily: BODY, fontSize: 13, fontWeight: 600, cursor: "pointer",
                }}
              >
                Cancel
              </button>
              <button
                onClick={onDeleteCircle}
                style={{
                  flex: 1, padding: "11px 16px", borderRadius: 999,
                  background: C.red, color: "#fff", border: "none",
                  fontFamily: BODY, fontSize: 13, fontWeight: 600, cursor: "pointer",
                }}
              >
                Delete
              </button>
            </div>
          </div>
        )}
      </Card>
    </SettingsSub>
  );
}

// ═══════════════════════════════════════════════════════════════════════════
// 3 · Report sheet
// ═══════════════════════════════════════════════════════════════════════════

const REPORT_REASONS = [
  "Spam or self-promotion",
  "Misleading trades",
  "Harassment",
  "Hate speech",
  "Inappropriate content",
  "Other",
];

export function ReportSheet({
  C, targetName, targetType = "message", onCancel, onSubmit,
}: {
  C: Theme; targetName: string; targetType?: "message" | "member";
  onCancel?: () => void; onSubmit?: (reason: string) => void;
}) {
  const [picked, setPicked] = useState<string | null>(null);

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
        <div style={{ width: 38, height: 4, borderRadius: 99, background: C.line3, margin: "0 auto 18px" }} />
        <div style={{ display: "flex", gap: 12, alignItems: "center", marginBottom: 18 }}>
          <div style={{
            width: 40, height: 40, borderRadius: 999, background: C.warnSoft,
            display: "flex", alignItems: "center", justifyContent: "center",
          }}>
            <IconFlag c={C.warn} s={20} />
          </div>
          <div>
            <div style={{ fontFamily: DISPLAY, fontSize: 17, fontWeight: 600, color: C.text }}>
              Report {targetType}
            </div>
            <div style={{ fontFamily: MONO, fontSize: 10, color: C.muted, marginTop: 2 }}>
              {targetName}
            </div>
          </div>
        </div>

        <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
          {REPORT_REASONS.map((r) => {
            const on = picked === r;
            return (
              <button
                key={r}
                onClick={() => setPicked(r)}
                style={{
                  display: "flex", alignItems: "center", justifyContent: "space-between",
                  padding: "13px 14px", borderRadius: 12,
                  background: on ? C.warnSoft : C.surface,
                  border: `1px solid ${on ? `color-mix(in oklch, ${C.warn} 40%, transparent)` : C.border2}`,
                  cursor: "pointer", textAlign: "left",
                }}
              >
                <span style={{ fontFamily: BODY, fontSize: 14, color: C.text }}>{r}</span>
                {on && (
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none">
                    <path d="M5 12l5 5L19 8" stroke={C.warn} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                  </svg>
                )}
              </button>
            );
          })}
        </div>

        <div style={{ marginTop: 16 }}>
          <button
            onClick={() => picked && onSubmit?.(picked)}
            disabled={!picked}
            style={{
              padding: "13px 22px", borderRadius: 999,
              background: picked ? C.warn : C.panel,
              color: picked ? "#0A0A0A" : C.muted,
              border: "none", fontFamily: BODY, fontSize: 14, fontWeight: 600,
              width: "100%", cursor: picked ? "pointer" : "not-allowed",
            }}
          >
            Submit report
          </button>
        </div>
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════
// 4 · Member detail card — bottom sheet
// ═══════════════════════════════════════════════════════════════════════════

export interface MemberStat {
  label: string;
  value: string;
  tone?: "green" | "red" | "muted";
}

export function MemberDetailCard({
  C, name, handle, avatar, rank,
  stats = [], isFollowing = false, isMe = false, isOwner = false, canKick = false,
  onFollow, onUnfollow, onKick, onReport, onViewProfile, onClose,
}: {
  C: Theme; name: string; handle?: string; avatar?: string;
  rank?: number; stats?: MemberStat[];
  isFollowing?: boolean; isMe?: boolean; isOwner?: boolean; canKick?: boolean;
  onFollow?: () => void; onUnfollow?: () => void; onKick?: () => void;
  onReport?: () => void; onViewProfile?: () => void; onClose?: () => void;
}) {
  const rankEmoji = rank === 1 ? "🥇" : rank === 2 ? "🥈" : rank === 3 ? "🥉" : null;

  return (
    <div
      role="dialog"
      aria-modal="true"
      onClick={onClose}
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
        <div style={{ width: 38, height: 4, borderRadius: 99, background: C.line3, margin: "0 auto 18px" }} />

        {/* Header */}
        <div style={{ display: "flex", gap: 14, alignItems: "center", marginBottom: 18 }}>
          <div style={{ position: "relative" }}>
            <AvatarCircle name={name} avatar={avatar} size={52} C={C} />
            {rankEmoji && (
              <div style={{
                position: "absolute", bottom: -4, right: -4,
                fontSize: 16, lineHeight: 1,
              }}>
                {rankEmoji}
              </div>
            )}
          </div>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontFamily: DISPLAY, fontSize: 18, fontWeight: 600, color: C.text, letterSpacing: "-0.01em" }}>
              {name}
              {isMe && <span style={{ fontFamily: MONO, fontSize: 10, color: C.live, letterSpacing: "0.12em", marginLeft: 8 }}>YOU</span>}
              {isOwner && <span style={{ fontFamily: MONO, fontSize: 10, color: C.muted, letterSpacing: "0.1em", marginLeft: 8 }}>OWNER</span>}
            </div>
            {handle && (
              <div style={{ fontFamily: MONO, fontSize: 11, color: C.muted, marginTop: 2 }}>@{handle}</div>
            )}
            {rank && (
              <div style={{ fontFamily: MONO, fontSize: 10, color: C.accent, marginTop: 3, letterSpacing: "0.08em" }}>
                #{rank} this week
              </div>
            )}
          </div>
          {!isMe && (
            <button
              onClick={onReport}
              style={{
                width: 36, height: 36, borderRadius: 999, background: "transparent",
                border: `1px solid ${C.border2}`,
                display: "flex", alignItems: "center", justifyContent: "center",
                cursor: "pointer", padding: 0, flexShrink: 0,
              }}
            >
              <IconFlag c={C.muted} s={16} />
            </button>
          )}
        </div>

        {/* Stats grid */}
        {stats.length > 0 && (
          <Card C={C} pad={14} style={{ marginBottom: 16 }}>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 10 }}>
              {stats.map((s, i) => {
                const color = s.tone === "green" ? C.green : s.tone === "red" ? C.red : C.muted;
                return (
                  <div key={i} style={{ textAlign: "center" }}>
                    <div style={{ fontFamily: DISPLAY, fontSize: 16, fontWeight: 600, color }}>{s.value}</div>
                    <div style={{ fontFamily: MONO, fontSize: 9, color: C.muted, marginTop: 2, letterSpacing: "0.08em", textTransform: "uppercase" }}>{s.label}</div>
                  </div>
                );
              })}
            </div>
          </Card>
        )}

        {/* Actions */}
        <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
          {!isMe && (
            <button
              onClick={isFollowing ? onUnfollow : onFollow}
              style={{
                padding: "13px 22px", borderRadius: 999,
                background: isFollowing ? "transparent" : C.live,
                color: isFollowing ? C.muted : "#0A0A0A",
                border: isFollowing ? `1px solid ${C.border2}` : "none",
                fontFamily: BODY, fontSize: 14, fontWeight: 600,
                width: "100%", cursor: "pointer",
              }}
            >
              {isFollowing ? "Unfollow" : "Follow"}
            </button>
          )}
          {onViewProfile && (
            <button
              onClick={onViewProfile}
              style={{
                padding: "13px 22px", borderRadius: 999,
                background: "transparent", color: C.text,
                border: `1px solid ${C.border2}`,
                fontFamily: BODY, fontSize: 14, fontWeight: 600,
                width: "100%", cursor: "pointer",
              }}
            >
              View profile →
            </button>
          )}
          {canKick && !isMe && (
            <button
              onClick={onKick}
              style={{
                padding: "13px 22px", borderRadius: 999,
                background: "transparent", color: C.red,
                border: `1px solid color-mix(in oklch, ${C.red} 35%, transparent)`,
                fontFamily: BODY, fontSize: 14, fontWeight: 600,
                width: "100%", cursor: "pointer",
              }}
            >
              Kick from circle
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════
// 5 · Message context menu
// ═══════════════════════════════════════════════════════════════════════════

export interface MessageAction {
  id: "copy" | "quote" | "report" | "delete";
  label: string;
  danger?: boolean;
}

const DEFAULT_ACTIONS: MessageAction[] = [
  { id: "copy", label: "Copy text" },
  { id: "quote", label: "Quote reply" },
  { id: "report", label: "Report message" },
  { id: "delete", label: "Delete message", danger: true },
];

export function MessageContextMenu({
  C, senderName, preview, actions = DEFAULT_ACTIONS, isOwn = false,
  onAction, onClose,
}: {
  C: Theme; senderName: string; preview: string;
  actions?: MessageAction[]; isOwn?: boolean;
  onAction?: (id: MessageAction["id"]) => void;
  onClose?: () => void;
}) {
  const visible = actions.filter(a => {
    if (a.id === "delete") return isOwn;
    return true;
  });

  return (
    <div
      role="dialog"
      aria-modal="true"
      onClick={onClose}
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
        <div style={{ width: 38, height: 4, borderRadius: 99, background: C.line3, margin: "0 auto 12px" }} />

        {/* Message preview */}
        <div style={{
          padding: "12px 14px", borderRadius: 12, background: C.surfaceHi,
          border: `1px solid ${C.line}`, marginBottom: 16,
        }}>
          <div style={{ fontFamily: MONO, fontSize: 10, color: C.muted, marginBottom: 4 }}>
            {senderName}
          </div>
          <div style={{
            fontFamily: BODY, fontSize: 13, color: C.text2, lineHeight: 1.45,
            overflow: "hidden", display: "-webkit-box",
            WebkitLineClamp: 2, WebkitBoxOrient: "vertical" as const,
          }}>
            {preview}
          </div>
        </div>

        {/* Actions */}
        <Card C={C} pad={0}>
          {visible.map((a, i) => {
            const icon = a.id === "copy" ? <IconCopy c={a.danger ? C.red : C.text} s={18} />
              : a.id === "quote" ? <IconQuote c={a.danger ? C.red : C.text} s={18} />
              : a.id === "report" ? <IconFlag c={a.danger ? C.red : C.warn} s={18} />
              : <IconTrash c={C.red} s={18} />;
            return (
              <button
                key={a.id}
                onClick={() => { onAction?.(a.id); onClose?.(); }}
                style={{
                  display: "flex", alignItems: "center", gap: 12,
                  padding: "15px 16px", borderTop: i ? `1px solid ${C.line}` : "none",
                  background: "transparent", border: "none", width: "100%",
                  cursor: "pointer", textAlign: "left",
                }}
              >
                {icon}
                <span style={{
                  fontFamily: BODY, fontSize: 15,
                  color: a.danger ? C.red : C.text,
                }}>
                  {a.label}
                </span>
              </button>
            );
          })}
        </Card>
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════
// 6 · Leaderboard upsell row (blurred, Pro-gated)
// ═══════════════════════════════════════════════════════════════════════════

export function LeaderboardUpsellRow({
  C, rank = 4, onUpgrade,
}: {
  C: Theme; rank?: number; onUpgrade?: () => void;
}) {
  return (
    <div style={{ position: "relative", overflow: "hidden" }}>
      {/* Blurred ghost rows */}
      {[rank, rank + 1].map((r) => (
        <div
          key={r}
          style={{
            display: "flex", alignItems: "center", gap: 12,
            padding: "14px 16px", borderTop: `1px solid ${C.border}`,
            filter: "blur(5px)", userSelect: "none", pointerEvents: "none",
          }}
        >
          <div style={{ width: 28, fontFamily: MONO, fontSize: 12, color: C.muted, textAlign: "center" }}>
            {r}
          </div>
          <div style={{
            width: 36, height: 36, borderRadius: "50%", background: C.panel,
            border: `1px solid ${C.border}`,
          }} />
          <div style={{ flex: 1 }}>
            <div style={{ fontFamily: DISPLAY, fontSize: 14, color: C.text }}>● ● ● ● ●</div>
            <div style={{ fontFamily: MONO, fontSize: 10, color: C.muted, marginTop: 2 }}>●●●●●</div>
          </div>
          <div style={{ fontFamily: MONO, fontSize: 13, fontWeight: 700, color: C.green }}>+●●R</div>
        </div>
      ))}

      {/* Overlay CTA */}
      <div style={{
        position: "absolute", inset: 0,
        display: "flex", flexDirection: "column",
        alignItems: "center", justifyContent: "center", gap: 10,
        background: `linear-gradient(180deg, transparent 0%, ${C.bg}cc 30%, ${C.bg} 70%)`,
      }}>
        <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
          <IconShield c={C.accent} s={16} />
          <span style={{ fontFamily: MONO, fontSize: 11, fontWeight: 700, color: C.accent, letterSpacing: "0.1em" }}>
            PRO ONLY
          </span>
        </div>
        <div style={{ fontFamily: BODY, fontSize: 13, color: C.text2, textAlign: "center", maxWidth: 220, lineHeight: 1.45 }}>
          See the full leaderboard and every member's stats
        </div>
        <button
          onClick={onUpgrade}
          style={{
            padding: "10px 22px", borderRadius: 999,
            background: C.accent, color: "#0A0A0A",
            border: "none", fontFamily: BODY, fontSize: 13, fontWeight: 600,
            cursor: "pointer",
          }}
        >
          Upgrade to Pro
        </button>
      </div>
    </div>
  );
}
