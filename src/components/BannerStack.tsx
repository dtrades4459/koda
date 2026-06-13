import { useEffect, useRef, useState } from "react";
import type { ReactNode } from "react";
import type { Theme } from "../theme";
import { MONO } from "../shared";

// ═══════════════════════════════════════════════════════════════════════════
// BannerStack — deliberate layered stack for in-feed announcement banners.
//
// When more than one banner is active they render as a STACK (top card full,
// the rest peeking below with a slight offset + a "1 of N" count) rather than a
// vertical pile that shoves the feed down.
//
//   • Highest `priority` sits on top (CTA banners outrank informational ones).
//   • Dismissing the top card slides the next one up into its place.
//   • Rear cards peek a fixed sliver at the bottom (bottom-anchored + clipped),
//     so the deck reads cleanly whichever card is on top, regardless of height.
//   • Rear cards stay reachable — a "Next ›" control cycles the stack, so no
//     banner is hidden for good.
//   • A polite live region announces whichever card is currently on top.
//
// The stack is purely presentational: parents decide which items are visible
// and own dismiss/analytics side-effects via `onDismiss`.
// ═══════════════════════════════════════════════════════════════════════════

export interface BannerStackItem {
  id: string;
  /** Higher = closer to the top of the stack. CTA / most important = highest. */
  priority: number;
  /** Announced to screen readers when this card reaches the top. */
  ariaLabel: string;
  dismissible?: boolean;
  onDismiss?: () => void;
  /** Inner content only — the stack supplies the card chrome + dismiss button. */
  children: ReactNode;
}

const PEEK_OFFSET = 10;   // px each rear card peeks below the one above
const PEEK_SCALE = 0.04;  // scale reduction per depth level (deck inset)
const MAX_PEEK = 2;       // how many rear cards are visibly offset
const EXIT_MS = 280;      // dismiss animation duration

export function BannerStack({
  C,
  items,
  isMobile = false,
}: {
  C: Theme;
  items: BannerStackItem[];
  isMobile?: boolean;
}) {
  // Highest priority first. Rotation lets the user cycle rear cards to the top.
  const sorted = [...items].sort((a, b) => b.priority - a.priority);
  const [rotation, setRotation] = useState(0);
  const [exiting, setExiting] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  const count = sorted.length;
  // Clamp rotation into range whenever the item count changes.
  const rot = count > 0 ? ((rotation % count) + count) % count : 0;
  const order = count > 0 ? [...sorted.slice(rot), ...sorted.slice(0, rot)] : [];
  const peekPad = Math.min(count - 1, MAX_PEEK) * PEEK_OFFSET;

  // Reset transient state if the underlying items change out from under us.
  useEffect(() => {
    setExiting(false);
  }, [count]);

  if (count === 0) return null;

  const top = order[0];

  function dismissTop() {
    if (exiting) return;
    setExiting(true);
    window.setTimeout(() => {
      setExiting(false);
      setRotation(0);
      top.onDismiss?.();
      // Return focus to the stack so keyboard users aren't stranded.
      containerRef.current?.focus();
    }, EXIT_MS);
  }

  function cycle() {
    if (count < 2 || exiting) return;
    setRotation((r) => r + 1);
  }

  return (
    <div
      ref={containerRef}
      tabIndex={-1}
      role="region"
      aria-roledescription="Announcements"
      aria-label={count > 1 ? `Announcements, ${count} items` : "Announcement"}
      style={{ position: "relative", marginBottom: 16, outline: "none" }}
    >
      {/* Polite live region — announces whichever card is on top. */}
      <div aria-live="polite" style={{ position: "absolute", width: 1, height: 1, overflow: "hidden", clip: "rect(0 0 0 0)" }}>
        {top.ariaLabel}
      </div>

      {/* Clipped viewport — rear cards peek a fixed sliver; overflow is hidden. */}
      <div style={{ position: "relative", overflow: "hidden", paddingBottom: peekPad, borderRadius: 16 }}>
        {order.map((item, depth) => {
          const isTop = depth === 0;
          const d = Math.min(depth, MAX_PEEK);
          return (
            <div
              key={item.id}
              aria-hidden={isTop ? undefined : true}
              style={
                isTop
                  ? {
                      position: "relative",
                      zIndex: count + 1,
                      transform: exiting ? "translateY(-10px) scale(0.97)" : "none",
                      opacity: exiting ? 0 : 1,
                      transition: `transform ${EXIT_MS}ms cubic-bezier(.2,.8,.2,1), opacity ${EXIT_MS}ms ease`,
                      pointerEvents: "auto",
                    }
                  : {
                      position: "absolute",
                      left: 0,
                      right: 0,
                      bottom: peekPad - d * PEEK_OFFSET,
                      zIndex: count + 1 - depth,
                      transform: `scale(${1 - d * PEEK_SCALE})`,
                      transformOrigin: "bottom center",
                      opacity: Math.max(0, 0.6 - (d - 1) * 0.2),
                      transition: `transform ${EXIT_MS}ms cubic-bezier(.2,.8,.2,1), opacity ${EXIT_MS}ms ease`,
                      pointerEvents: "none",
                      filter: "saturate(0.9)",
                    }
              }
            >
              <BannerCard
                C={C}
                dismissible={item.dismissible}
                onDismiss={item.dismissible ? dismissTop : undefined}
              >
                {item.children}
              </BannerCard>
            </div>
          );
        })}
      </div>

      {/* Count + cycle control — only when the stack holds more than one. */}
      {count > 1 && (
        <div style={{ display: "flex", alignItems: "center", justifyContent: "flex-end", gap: 10, marginTop: 8 }}>
          <span style={{
            fontFamily: MONO, fontSize: "0.5625rem", letterSpacing: "0.12em",
            textTransform: "uppercase" as const, color: C.muted,
          }}>
            {rot + 1} of {count}
          </span>
          <button
            type="button"
            onClick={cycle}
            aria-label="Show next announcement"
            style={{
              display: "inline-flex", alignItems: "center", gap: 6,
              background: "transparent", border: `1px solid ${C.border2}`,
              borderRadius: 999, padding: isMobile ? "6px 12px" : "5px 12px",
              minHeight: 32,
              fontFamily: MONO, fontSize: "0.5625rem", letterSpacing: "0.1em",
              textTransform: "uppercase" as const, color: C.text2, cursor: "pointer",
            }}
          >
            Next ›
          </button>
        </div>
      )}
    </div>
  );
}

// ─── Card chrome shared by every stacked banner ─────────────────────────────
function BannerCard({
  C, dismissible, onDismiss, children,
}: {
  C: Theme; dismissible?: boolean; onDismiss?: () => void; children: ReactNode;
}) {
  return (
    <div
      style={{
        position: "relative",
        background: C.surfaceGlass,
        backdropFilter: "blur(20px) saturate(160%)",
        WebkitBackdropFilter: "blur(20px) saturate(160%)",
        border: `1px solid ${C.border2}`,
        borderRadius: 16,
        padding: "18px 20px",
      }}
    >
      <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 8 }}>
        <div style={{ flex: 1, minWidth: 0 }}>{children}</div>
        {dismissible && onDismiss && (
          <button
            onClick={onDismiss}
            aria-label="Dismiss"
            style={{
              background: "none", border: "none", color: C.muted,
              cursor: "pointer", fontSize: "1.25rem", padding: "0 0 0 8px",
              lineHeight: 1, flexShrink: 0,
            }}
          >
            ×
          </button>
        )}
      </div>
    </div>
  );
}
