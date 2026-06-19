// ═══════════════════════════════════════════════════════════════════════════════
// Kōda · PinnedBanner — circle announcement strip (Phase 2)
// Place at: src/components/PinnedBanner.tsx
// ═══════════════════════════════════════════════════════════════════════════════
import { MONO, BODY } from "../shared";
import type { Theme } from "../theme";

interface Props {
  senderName: string;
  text: string;
  C: Theme;
  /** Owner-only — omit to hide the unpin affordance. */
  onUnpin?: () => void;
}

export function PinnedBanner({ senderName, text, C, onUnpin }: Props) {
  return (
    <div
      style={{
        margin: "12px 16px 0",
        borderRadius: 14,
        padding: "11px 13px",
        background: `color-mix(in oklch, ${C.warn} 10%, transparent)`,
        border: `1px solid color-mix(in oklch, ${C.warn} 30%, transparent)`,
        display: "flex",
        gap: 10,
        alignItems: "flex-start",
      }}
    >
      <span style={{ fontSize: 13, marginTop: 1 }}>📌</span>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontFamily: MONO, fontSize: 9, letterSpacing: "0.14em", textTransform: "uppercase", color: C.warn }}>
          Pinned · {senderName}
        </div>
        <div style={{ fontFamily: BODY, fontSize: 12, color: C.text, marginTop: 3, lineHeight: 1.45 }}>{text}</div>
      </div>
      {onUnpin && (
        <button
          onClick={onUnpin}
          style={{ background: "none", border: "none", color: C.muted, cursor: "pointer", fontSize: 16, lineHeight: 1, padding: "0 0 0 4px", flexShrink: 0 }}
          aria-label="Unpin"
        >
          ×
        </button>
      )}
    </div>
  );
}
