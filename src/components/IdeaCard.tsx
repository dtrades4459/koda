import { type CSSProperties } from "react";
import type { Idea } from "../types";
import { MONO, BODY, DISPLAY, AvatarCircle } from "../shared";

interface IdeaCardProps {
  idea: Idea;
  expanded?: boolean;
  C: Record<string, string>;
  onLike: (id: string) => void;
  onExpand?: (id: string) => void;
  onOpenChart?: (url: string) => void;
}

function timeAgo(iso: string): string {
  const then = new Date(iso).getTime();
  if (Number.isNaN(then)) return "";
  const diffSec = Math.max(0, Math.floor((Date.now() - then) / 1000));
  if (diffSec < 60) return `${diffSec}s ago`;
  if (diffSec < 3600) return `${Math.floor(diffSec / 60)}m ago`;
  if (diffSec < 86400) return `${Math.floor(diffSec / 3600)}h ago`;
  return `${Math.floor(diffSec / 86400)}d ago`;
}

const directionColor = (dir: Idea["direction"], C: Record<string, string>): string => {
  if (dir === "long") return C.green ?? "#34d399";
  if (dir === "short") return C.red ?? "#f87171";
  return C.muted ?? "#94a3b8";
};

export function IdeaCard({ idea, expanded = false, C, onLike, onExpand, onOpenChart }: IdeaCardProps) {
  const cardBg = `color-mix(in srgb, ${C.text} 3%, transparent)`;
  const border = `1px solid ${C.border2 ?? C.border}`;
  const pillBg = (col: string): CSSProperties => ({
    background: `color-mix(in srgb, ${col} 18%, transparent)`,
    color: col,
    fontFamily: MONO,
    fontSize: "10px",
    fontWeight: 600,
    padding: "2px 8px",
    borderRadius: "4px",
    letterSpacing: "0.06em",
    textTransform: "uppercase" as const,
  });

  const dirCol = directionColor(idea.direction, C);
  const typeCol = idea.type === "pre" ? (C.live ?? "#a78bfa") : (C.green ?? "#34d399");

  const hasPrices = !!(idea.entryPrice || idea.stopPrice || idea.targetPrice);

  return (
    <div
      data-testid={`idea-card-${idea.id}`}
      onClick={!expanded && onExpand ? () => onExpand(idea.id) : undefined}
      style={{
        background: cardBg, border, borderRadius: "14px",
        padding: "14px", marginBottom: "10px",
        cursor: !expanded && onExpand ? "pointer" : "default",
        maxWidth: "680px",
      }}
    >
      {/* Header row */}
      <div style={{ display: "flex", alignItems: "flex-start", gap: "10px", marginBottom: "8px" }}>
        <AvatarCircle name={idea.authorName || idea.authorHandle || "?"} avatar={idea.authorAvatar ?? ""} size={32} C={C} />
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ display: "flex", alignItems: "center", gap: "6px", flexWrap: "wrap" }}>
            <span style={{ fontFamily: MONO, fontSize: "12px", color: C.text, fontWeight: 600 }}>@{idea.authorHandle || "trader"}</span>
            <span style={pillBg(typeCol)}>{idea.type === "pre" ? "PRE" : "POST"}</span>
            <span style={{ fontFamily: MONO, fontSize: "10px", color: C.muted, marginLeft: "auto" }}>{timeAgo(idea.createdAt)}</span>
          </div>
          <div style={{ fontFamily: DISPLAY, fontSize: expanded ? "18px" : "14px", fontWeight: 600, color: C.text, marginTop: "4px", lineHeight: 1.25,
            ...(expanded ? {} : { display: "-webkit-box", WebkitLineClamp: 1, WebkitBoxOrient: "vertical" as const, overflow: "hidden" }) }}>
            {idea.title}
          </div>
        </div>
        {idea.chartUrl && !expanded && (
          <button
            data-testid={`idea-chart-thumb-${idea.id}`}
            onClick={(e) => { e.stopPropagation(); onOpenChart?.(idea.chartUrl!); }}
            style={{
              width: "56px", height: "56px", flexShrink: 0,
              background: `${C.surface ?? "#252535"} center/cover no-repeat url("${idea.chartUrl}")`,
              border: "none", borderRadius: "8px", cursor: "pointer", padding: 0,
            }}
            aria-label="Open chart"
          />
        )}
      </div>

      {/* Body */}
      <div style={{
        fontFamily: BODY, fontSize: "13px", color: C.text2 ?? C.muted, lineHeight: 1.55, marginBottom: "10px",
        ...(expanded ? {} : { display: "-webkit-box", WebkitLineClamp: 2, WebkitBoxOrient: "vertical" as const, overflow: "hidden" }),
        whiteSpace: expanded ? "pre-wrap" : undefined,
      }}>
        {idea.body}
      </div>

      {/* Expanded chart full-width */}
      {expanded && idea.chartUrl && (
        <button
          onClick={(e) => { e.stopPropagation(); onOpenChart?.(idea.chartUrl!); }}
          style={{ width: "100%", maxHeight: "360px", border: "none", padding: 0, marginBottom: "10px", cursor: "zoom-in", borderRadius: "10px", overflow: "hidden", background: "transparent" }}
          aria-label="Open chart"
        >
          <img src={idea.chartUrl} alt="" style={{ width: "100%", height: "auto", display: "block", borderRadius: "10px" }} />
        </button>
      )}

      {/* Tags row */}
      <div style={{ display: "flex", alignItems: "center", gap: "6px", flexWrap: "wrap", marginBottom: hasPrices ? "8px" : "0" }}>
        <span style={pillBg(C.live ?? "#a78bfa")}>{idea.instrument}</span>
        <span style={pillBg(dirCol)}>{idea.direction.toUpperCase()}</span>
        {idea.timeframe && <span style={pillBg(C.muted ?? "#94a3b8")}>{idea.timeframe}</span>}
      </div>

      {/* Entry / Stop / Target */}
      {hasPrices && (
        <div style={{ display: "flex", gap: "12px", flexWrap: "wrap", padding: "8px 10px",
          background: `color-mix(in srgb, ${C.text} 4%, transparent)`, borderRadius: "8px", marginBottom: "8px",
          fontFamily: MONO, fontSize: "11px", color: C.muted }}>
          {idea.entryPrice  && <span>Entry <strong style={{ color: C.text }}>{idea.entryPrice}</strong></span>}
          {idea.stopPrice   && <span>Stop <strong style={{ color: C.red ?? "#f87171" }}>{idea.stopPrice}</strong></span>}
          {idea.targetPrice && <span>Target <strong style={{ color: C.green ?? "#34d399" }}>{idea.targetPrice}</strong></span>}
        </div>
      )}

      {/* Footer */}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", paddingTop: "8px", borderTop: `1px solid ${C.border ?? "#2a2a2a"}` }}>
        <button
          data-testid={`idea-like-${idea.id}`}
          onClick={(e) => { e.stopPropagation(); onLike(idea.id); }}
          style={{
            background: "none", border: "none", cursor: "pointer",
            display: "flex", alignItems: "center", gap: "6px",
            fontFamily: MONO, fontSize: "12px",
            color: idea.likedByMe ? (C.red ?? "#f87171") : C.muted,
          }}
        >
          <span style={{ fontSize: "14px" }}>{idea.likedByMe ? "♥" : "♡"}</span>
          <span>{idea.likeCount}</span>
        </button>
        {!expanded && <span style={{ fontFamily: MONO, fontSize: "10px", color: C.muted }}>Tap to expand →</span>}
      </div>
    </div>
  );
}
