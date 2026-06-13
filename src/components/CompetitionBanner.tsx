import { useEffect, useRef, useState } from "react";
import { BODY, MONO, DISPLAY } from "../shared";
import type { Theme } from "../theme";
import {
  isCompetitionActive,
  isCompetitionJoined,
  isCompetitionBannerDismissed,
  markCompetitionBannerDismissed,
} from "../lib/competition";
import { phCapture } from "../lib/posthog";

export interface CompetitionBannerProps {
  C: Theme;
  isMobile: boolean;
  onJoin: () => Promise<void>;
}

export function CompetitionBanner({ C, isMobile, onJoin }: CompetitionBannerProps) {
  // Dismiss now persists across reloads (localStorage), so the banner doesn't
  // re-appear on every page load for the full 30-day competition window.
  const [dismissed, setDismissed] = useState(isCompetitionBannerDismissed);
  const [joining, setJoining] = useState(false);

  const visible = !dismissed && !isCompetitionJoined() && isCompetitionActive();

  // Impression — fire once per mount when the banner is actually shown.
  const impressionFired = useRef(false);
  useEffect(() => {
    if (visible && !impressionFired.current) {
      impressionFired.current = true;
      phCapture("comp_banner_shown", { placement: "home_feed" });
    }
  }, [visible]);

  if (!visible) return null;

  async function handleJoin() {
    phCapture("comp_join_clicked", { placement: "home_feed" });
    setJoining(true);
    try { await onJoin(); } finally { setJoining(false); }
  }

  function handleDismiss() {
    markCompetitionBannerDismissed();
    setDismissed(true);
    phCapture("comp_banner_dismissed", { placement: "home_feed" });
  }

  return (
    <div
      role="region"
      aria-label="50K Eval Challenge"
      style={{
        background: C.surfaceGlass,
        backdropFilter: "blur(20px) saturate(160%)",
        WebkitBackdropFilter: "blur(20px) saturate(160%)",
        border: `1px solid color-mix(in oklch, ${C.live} 25%, transparent)`,
        borderRadius: 16,
        padding: "18px 20px",
        marginBottom: 16,
      }}
    >
      <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 8 }}>
        <div style={{ flex: 1 }}>
          <div style={{
            fontFamily: MONO, fontSize: "0.625rem", color: C.live,
            letterSpacing: "0.16em", textTransform: "uppercase" as const,
            fontWeight: 700, marginBottom: 10,
          }}>
            ⚡ $50K EVAL CHALLENGE · JUNE 15 – JULY 15
          </div>
          <div style={{
            fontFamily: DISPLAY, fontSize: isMobile ? 22 : 26,
            fontWeight: 600, letterSpacing: "-0.02em",
            lineHeight: 1.1, color: C.text, marginBottom: 8,
          }}>
            Trade your eval.<br />Top the leaderboard.
          </div>
          <div style={{
            fontFamily: BODY, fontSize: "0.8125rem", color: C.text2,
            lineHeight: 1.5, marginBottom: 14,
          }}>
            30-day R-multiple leaderboard for $50K eval traders. Free to enter.
          </div>
          <button
            onClick={handleJoin}
            disabled={joining}
            style={{
              background: C.live, color: "#0A0A0A", border: "none",
              borderRadius: 999, padding: "11px 22px",
              fontFamily: BODY, fontSize: "0.8125rem", fontWeight: 600,
              cursor: joining ? "default" : "pointer",
              opacity: joining ? 0.7 : 1,
            }}
          >
            {joining ? "Joining…" : "Enter competition"}
          </button>
        </div>
        <button
          onClick={handleDismiss}
          aria-label="Dismiss"
          style={{
            background: "none", border: "none", color: C.muted,
            cursor: "pointer", fontSize: "1.25rem", padding: "0 0 0 8px",
            lineHeight: 1, flexShrink: 0,
          }}
        >
          ×
        </button>
      </div>
    </div>
  );
}
