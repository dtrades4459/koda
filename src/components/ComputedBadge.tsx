import type React from "react";
import { MONO } from "../shared";
import type { Theme } from "../theme";

interface Props {
  C: Pick<Theme, "accent">;
  style?: React.CSSProperties;
}

export function ComputedBadge({ C, style }: Props) {
  return (
    <div
      title="Every number here is computed from your logged trades. No model. No guess."
      style={{
        display: "inline-flex",
        alignItems: "center",
        gap: "6px",
        padding: "4px 10px",
        borderRadius: "999px",
        border: `1px solid color-mix(in oklch, ${C.accent} 25%, transparent)`,
        background: `color-mix(in oklch, ${C.accent} 8%, transparent)`,
        fontFamily: MONO,
        fontSize: "0.5625rem",
        letterSpacing: "0.14em",
        textTransform: "uppercase",
        color: C.accent,
        fontWeight: 600,
        ...style,
      }}
    >
      <span style={{ width: 5, height: 5, borderRadius: "50%", background: C.accent, flexShrink: 0 }} />
      Computed · not LLM-guessed
    </div>
  );
}
