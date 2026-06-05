// src/components/MutualFriends.tsx
// ═══════════════════════════════════════════════════════════════════════════════
// Kōda · Mutual-friends visualization (cat05)
//
// Renders the intersection of two follow-graphs / two Circle-membership sets
// as a compact "you both …" row on a public profile.
//
// Inputs are pre-computed string lists so the component stays decoupled from
// data fetching. Empty list → null render (no visual noise on cold profiles).
// ═══════════════════════════════════════════════════════════════════════════════

import type { Theme } from "../theme";
import { MONO, BODY } from "../shared";

interface Props {
  C: Theme;
  /** Handles that both viewer and viewed follow. */
  sharedFollows: string[];
  /** Circle names that both viewer and viewed belong to. */
  sharedCircles: string[];
  /** Limit how many handles render before "+N more". */
  maxFollows?: number;
}

export function MutualFriends({ C, sharedFollows, sharedCircles, maxFollows = 3 }: Props) {
  if (sharedFollows.length === 0 && sharedCircles.length === 0) return null;

  const shownFollows = sharedFollows.slice(0, maxFollows);
  const extra = sharedFollows.length - shownFollows.length;

  return (
    <div style={{
      padding: "12px 14px", borderRadius: 12,
      background: C.surface, border: `1px solid ${C.line}`,
      display: "flex", flexDirection: "column", gap: 8,
    }}>
      <div style={{
        fontFamily: MONO, fontSize: 9.5, letterSpacing: "0.14em",
        color: C.muted, textTransform: "uppercase",
      }}>
        In common
      </div>

      {shownFollows.length > 0 && (
        <div style={{ display: "flex", alignItems: "center", gap: 6, flexWrap: "wrap" }}>
          <span style={{ fontSize: 12.5, color: C.text2, fontFamily: BODY }}>You both follow</span>
          {shownFollows.map((h, i) => (
            <span key={h} style={{
              fontFamily: BODY, fontSize: 12.5, fontWeight: 600,
              color: C.text, padding: "2px 8px",
              background: C.surfaceHi ?? "rgba(255,255,255,0.04)",
              borderRadius: 999, border: `1px solid ${C.line}`,
            }}>
              @{h}{i < shownFollows.length - 1 ? "" : ""}
            </span>
          ))}
          {extra > 0 && (
            <span style={{ fontFamily: MONO, fontSize: 10, color: C.muted, letterSpacing: "0.06em" }}>
              + {extra} more
            </span>
          )}
        </div>
      )}

      {sharedCircles.length > 0 && (
        <div style={{ display: "flex", alignItems: "center", gap: 6, flexWrap: "wrap" }}>
          <span style={{ fontSize: 12.5, color: C.text2, fontFamily: BODY }}>You're both in</span>
          {sharedCircles.map(name => (
            <span key={name} style={{
              fontFamily: BODY, fontSize: 12.5, fontWeight: 600,
              color: C.live, padding: "2px 8px",
              background: `color-mix(in oklch, ${C.live} 10%, transparent)`,
              borderRadius: 999, border: `1px solid color-mix(in oklch, ${C.live} 30%, transparent)`,
            }}>
              {name}
            </span>
          ))}
        </div>
      )}
    </div>
  );
}
