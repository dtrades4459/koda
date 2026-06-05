// src/components/EmojiPickerSheet.tsx
// ═══════════════════════════════════════════════════════════════════════════════
// Kōda · Emoji reactions picker (cat04)
//
// Bottom-sheet grid of common reaction emoji. Opened from the "+" button on
// a SharedTradeCard's reaction row (or from a chat message context menu).
// onSelect fires with the picked emoji; the parent decides what to do with it.
// ═══════════════════════════════════════════════════════════════════════════════

import type { Theme } from "../theme";
import { MONO, BODY, DISPLAY } from "../shared";

// 64 most-common reaction emoji, grouped roughly by tone.
const EMOJI_GRID = [
  "🔥","💎","👍","🎯","💀","🤯","🚀","💯",
  "❤️","🙌","🙏","👏","🫡","😎","😅","😬",
  "📈","📉","💰","💸","🟢","🔴","⚡","🌊",
  "🤔","😂","🤣","😭","😤","😡","🤬","🙃",
  "👀","👁️","🧠","💭","✨","🌟","⭐","🏆",
  "🤝","💪","🦾","🤞","🤘","✊","☝️","🤚",
  "👌","🤌","🤏","✌️","🤟","🫶","🫰","🫳",
  "💖","💔","💀","⚠️","✅","❌","❓","❗",
];

interface Props {
  C: Theme;
  onSelect: (emoji: string) => void;
  onClose: () => void;
}

export function EmojiPickerSheet({ C, onSelect, onClose }: Props) {
  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="Pick an emoji"
      onClick={onClose}
      style={{
        position: "fixed", inset: 0, zIndex: 9300,
        background: "rgba(10,10,11,0.7)", backdropFilter: "blur(6px)",
        WebkitBackdropFilter: "blur(6px)",
        display: "flex", alignItems: "flex-end", justifyContent: "center",
        padding: 14, animation: "kFadeIn 0.22s ease-out",
      }}
    >
      <div
        onClick={e => e.stopPropagation()}
        style={{
          width: "100%", maxWidth: 480,
          borderRadius: 24, background: C.panel,
          border: `1px solid ${C.border2}`,
          padding: 22, maxHeight: "75dvh", overflowY: "auto",
          animation: "kSlideIn 0.32s cubic-bezier(.2,.8,.2,1)",
        }}
      >
        <div style={{ fontFamily: MONO, fontSize: 10, letterSpacing: "0.14em", color: C.muted, textTransform: "uppercase" }}>
          React
        </div>
        <div style={{ fontFamily: DISPLAY, fontSize: 19, fontWeight: 600, letterSpacing: "-0.02em", color: C.text, marginTop: 6, marginBottom: 14 }}>
          Pick an emoji.
        </div>

        <div style={{
          display: "grid",
          gridTemplateColumns: "repeat(8, 1fr)",
          gap: 4,
        }}>
          {EMOJI_GRID.map((e, i) => (
            <button
              key={`${e}-${i}`}
              onClick={() => { onSelect(e); onClose(); }}
              aria-label={`React with ${e}`}
              style={{
                aspectRatio: "1 / 1",
                background: "transparent",
                border: "none",
                fontSize: 22,
                cursor: "pointer",
                borderRadius: 8,
                transition: "background 0.1s, transform 0.08s",
              }}
              onMouseOver={ev => { (ev.currentTarget as HTMLButtonElement).style.background = C.surface; }}
              onMouseOut={ev =>  { (ev.currentTarget as HTMLButtonElement).style.background = "transparent"; }}
            >
              {e}
            </button>
          ))}
        </div>

        <button
          onClick={onClose}
          style={{
            marginTop: 18, padding: "13px 22px", borderRadius: 999,
            background: "transparent", color: C.text, border: `1px solid ${C.border2}`,
            fontFamily: BODY, fontSize: 14, fontWeight: 500, cursor: "pointer", width: "100%",
          }}
        >
          Cancel
        </button>
      </div>
    </div>
  );
}
