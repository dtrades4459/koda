// ═══════════════════════════════════════════════════════════════════════════════
// Kōda · ChatMessage — restyled chat bubble (Phase 2, "pushing it" direction)
//
// Per-sender hue, reply quote, reaction pills, @mention highlight, own-message
// delete. Place at: src/components/ChatMessage.tsx
// ═══════════════════════════════════════════════════════════════════════════════
import { MONO, BODY } from "../shared";
import type { Theme } from "../theme";
import { REACTION_PALETTE, type ReactionMap } from "../data/circleMessageReactions";

export interface ChatMessageRow {
  id: string;
  sender_id: string | null;
  sender_name: string;
  sender_handle: string;
  text: string;
  created_at: string;
  reply_to_id?: string | null;
}

interface Props {
  msg: ChatMessageRow;
  isMe: boolean;
  myId: string | undefined;
  C: Theme;
  reactions?: ReactionMap;
  /** The message this one replies to, already resolved by the parent. */
  replyTo?: ChatMessageRow | null;
  onReact: (messageId: string, emoji: string) => void;
  onReply: (msg: ChatMessageRow) => void;
  onDelete?: (messageId: string) => void;
  /** Owner-only — omit to hide the pin affordance. */
  onPin?: (messageId: string) => void;
  openProfile?: (handle: string) => void;
}

/** Deterministic per-sender hue so each trader keeps a stable colour. */
function hueFor(id: string | null | undefined): number {
  const s = id ?? "?";
  let h = 0;
  for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) % 360;
  return h;
}

function stripAt(h: string | null | undefined): string {
  return (h ?? "").replace(/^@+/, "");
}

function fmtTime(iso: string): string {
  const diff = (Date.now() - new Date(iso).getTime()) / 60000;
  if (diff < 1) return "now";
  if (diff < 60) return `${Math.floor(diff)}m`;
  if (diff < 1440) return `${Math.floor(diff / 60)}h`;
  return new Date(iso).toLocaleDateString(undefined, { month: "short", day: "numeric" });
}

/** Render text with @handles highlighted in the accent colour. */
function renderText(text: string, C: Theme) {
  const parts = text.split(/(@[A-Za-z0-9_]+)/g);
  return parts.map((part, i) =>
    part.startsWith("@") ? (
      <span
        key={i}
        style={{
          color: C.accent,
          background: `color-mix(in oklch, ${C.accent} 14%, transparent)`,
          borderRadius: 5,
          padding: "0 3px",
        }}
      >
        {part}
      </span>
    ) : (
      <span key={i}>{part}</span>
    )
  );
}

export function ChatMessage({
  msg, isMe, myId, C, reactions, replyTo, onReact, onReply, onDelete, onPin, openProfile,
}: Props) {
  const hue = hueFor(msg.sender_id);
  const nameColor = `oklch(0.72 0.16 ${hue})`;
  const avatarBg = `linear-gradient(135deg, oklch(0.7 0.16 ${hue}), oklch(0.5 0.18 ${(hue + 60) % 360}))`;
  const initials = (stripAt(msg.sender_handle) || msg.sender_name || "?").slice(0, 2).toUpperCase();
  const reactionEntries = Object.entries(reactions ?? {}).filter(([, u]) => u.length > 0);

  return (
    <div style={{ display: "flex", justifyContent: isMe ? "flex-end" : "flex-start", gap: 9, alignItems: "flex-end", padding: "4px 0" }}>
      {!isMe && (
        <div style={{ width: 30, height: 30, borderRadius: "50%", background: avatarBg, display: "flex", alignItems: "center", justifyContent: "center", color: "#fff", fontSize: 10, fontWeight: 600, flexShrink: 0, fontFamily: BODY }}>
          {initials}
        </div>
      )}

      <div style={{ maxWidth: "80%", display: "flex", flexDirection: "column", alignItems: isMe ? "flex-end" : "flex-start" }}>
        {!isMe && (
          <div
            onClick={() => openProfile && msg.sender_handle && openProfile(msg.sender_handle)}
            style={{ fontFamily: MONO, fontSize: 10, color: nameColor, letterSpacing: "0.05em", marginBottom: 4, cursor: openProfile && msg.sender_handle ? "pointer" : "default" }}
          >
            @{stripAt(msg.sender_handle) || msg.sender_name}
          </div>
        )}

        {/* reply quote */}
        {replyTo && (
          <div style={{ borderLeft: `2px solid ${nameColor}`, padding: "3px 0 3px 9px", marginBottom: 5, maxWidth: "100%" }}>
            <div style={{ fontFamily: MONO, fontSize: 9, color: nameColor }}>↩ @{stripAt(replyTo.sender_handle) || replyTo.sender_name}</div>
            <div style={{ fontFamily: BODY, fontSize: 11, color: C.muted, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", maxWidth: 220 }}>{replyTo.text}</div>
          </div>
        )}

        {/* bubble */}
        <div
          onDoubleClick={() => onReact(msg.id, "🔥")}
          style={{
            background: isMe ? C.live : C.panel2,
            color: isMe ? "#0A0A0B" : C.text,
            border: isMe ? "none" : `1px solid ${C.border}`,
            borderRadius: isMe ? "16px 16px 4px 16px" : "16px 16px 16px 4px",
            padding: "10px 13px", fontFamily: BODY, fontSize: 14, lineHeight: 1.45,
            wordBreak: "break-word", fontWeight: isMe ? 500 : 400,
          }}
        >
          {renderText(msg.text, C)}
        </div>

        {/* reaction pills */}
        {reactionEntries.length > 0 && (
          <div style={{ display: "flex", gap: 6, marginTop: 6, flexWrap: "wrap" }}>
            {reactionEntries.map(([emoji, users]) => {
              const mine = !!myId && users.includes(myId);
              return (
                <button
                  key={emoji}
                  onClick={() => onReact(msg.id, emoji)}
                  style={{
                    display: "inline-flex", alignItems: "center", gap: 4,
                    background: mine ? `color-mix(in oklch, ${C.accent} 16%, transparent)` : "rgba(255,255,255,0.05)",
                    border: `1px solid ${mine ? `color-mix(in oklch, ${C.accent} 30%, transparent)` : C.border2}`,
                    borderRadius: 999, padding: "2px 8px", fontSize: 11,
                    color: mine ? C.text : C.text2, cursor: "pointer", fontFamily: BODY,
                  }}
                >
                  {emoji} {users.length}
                </button>
              );
            })}
          </div>
        )}

        {/* meta row: time · reply · pin · delete */}
        <div style={{ display: "flex", gap: 10, marginTop: 4, alignItems: "center", fontFamily: MONO, fontSize: 10, color: C.muted }}>
          <span>{fmtTime(msg.created_at)}</span>
          <button onClick={() => onReply(msg)} style={{ background: "none", border: "none", color: C.muted, cursor: "pointer", fontFamily: MONO, fontSize: 10, padding: 0, letterSpacing: "0.06em", textTransform: "uppercase" }}>Reply</button>
          <button onClick={() => onReact(msg.id, REACTION_PALETTE[0])} style={{ background: "none", border: "none", color: C.muted, cursor: "pointer", fontSize: 12, padding: 0 }}>＋</button>
          {onPin && (
            <button onClick={() => onPin(msg.id)} style={{ background: "none", border: "none", color: C.muted, cursor: "pointer", fontFamily: MONO, fontSize: 10, padding: 0, letterSpacing: "0.06em", textTransform: "uppercase" }}>Pin</button>
          )}
          {isMe && onDelete && (
            <button onClick={() => onDelete(msg.id)} style={{ background: "none", border: "none", color: C.muted, cursor: "pointer", fontFamily: MONO, fontSize: 10, padding: 0, letterSpacing: "0.06em", textTransform: "uppercase" }}>Delete</button>
          )}
        </div>
      </div>
    </div>
  );
}
