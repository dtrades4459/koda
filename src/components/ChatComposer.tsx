// ═══════════════════════════════════════════════════════════════════════════════
// Kōda · ChatComposer — message input with reply context + typing ping (Phase 2)
// Place at: src/components/ChatComposer.tsx
//
// Controlled: parent owns `value`. Calls onTyping() on each keystroke (the
// presence hook throttles it), and onSend() on Enter / send tap.
// ═══════════════════════════════════════════════════════════════════════════════
import { MONO, BODY } from "../shared";
import type { Theme } from "../theme";
import type { ChatMessageRow } from "./ChatMessage";

interface Props {
  value: string;
  onChange: (v: string) => void;
  onSend: () => void;
  onTyping?: () => void;
  sending?: boolean;
  C: Theme;
  /** When set, a quoted strip shows above the input. */
  replyingTo?: ChatMessageRow | null;
  onCancelReply?: () => void;
}

function stripAt(h: string | null | undefined): string {
  return (h ?? "").replace(/^@+/, "");
}

export function ChatComposer({
  value, onChange, onSend, onTyping, sending, C, replyingTo, onCancelReply,
}: Props) {
  return (
    <div
      style={{
        position: "fixed", bottom: "calc(80px + env(safe-area-inset-bottom))",
        left: "50%", transform: "translateX(-50%)", width: "100%", maxWidth: 500,
        padding: "10px 16px 14px",
        background: `linear-gradient(to top, ${C.bg} 80%, transparent)`,
        zIndex: 40,
      }}
    >
      {replyingTo && (
        <div
          style={{
            display: "flex", alignItems: "center", gap: 9, marginBottom: 8,
            padding: "8px 12px", borderRadius: 12,
            background: C.panel,
            border: `1px solid ${C.border2}`,
          }}
        >
          <div style={{ width: 2, alignSelf: "stretch", background: C.accent, borderRadius: 2 }} />
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontFamily: MONO, fontSize: 9, letterSpacing: "0.1em", textTransform: "uppercase", color: C.accent }}>
              Replying to @{stripAt(replyingTo.sender_handle) || replyingTo.sender_name}
            </div>
            <div style={{ fontFamily: BODY, fontSize: 12, color: C.muted, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{replyingTo.text}</div>
          </div>
          <button onClick={onCancelReply} style={{ background: "none", border: "none", color: C.muted, cursor: "pointer", fontSize: 16, flexShrink: 0 }} aria-label="Cancel reply">×</button>
        </div>
      )}

      <div style={{ display: "flex", gap: 10, alignItems: "flex-end" }}>
        <textarea
          value={value}
          rows={1}
          onChange={(e) => { onChange(e.target.value); onTyping?.(); }}
          onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); onSend(); } }}
          placeholder="Message the circle…"
          style={{
            flex: 1, background: C.panel, resize: "none", lineHeight: 1.45,
            border: `1px solid ${C.border2}`, borderRadius: 18,
            padding: "11px 16px", fontSize: 14, color: C.text, outline: "none",
            fontFamily: BODY,
          }}
        />
        <button
          onClick={onSend}
          disabled={!value.trim() || sending}
          style={{
            width: 44, height: 44, borderRadius: "50%", background: C.live,
            border: "none", display: "flex", alignItems: "center", justifyContent: "center",
            color: "#0A0A0B", fontSize: 18, flexShrink: 0,
            cursor: !value.trim() || sending ? "default" : "pointer",
            opacity: !value.trim() || sending ? 0.5 : 1,
            boxShadow: `0 6px 18px color-mix(in oklch, ${C.live} 35%, transparent)`,
          }}
        >
          →
        </button>
      </div>
    </div>
  );
}
