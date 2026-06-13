import { useEffect, useRef, useState } from "react";
import { BODY, MONO, DISPLAY } from "../shared";
import type { Theme } from "../theme";
import { phCapture } from "../lib/posthog";

export interface CompetitionBannerContentProps {
  C: Theme;
  isMobile: boolean;
  onJoin: () => Promise<void>;
}

// Content-only competition banner. Visibility (active / joined / dismissed) and
// the card chrome + dismiss button are owned by the parent BannerStack; this
// component renders the inner content and tracks the impression + join click.
export function CompetitionBannerContent({ C, isMobile, onJoin }: CompetitionBannerContentProps) {
  const [joining, setJoining] = useState(false);

  // Impression — fire once when this banner content mounts (i.e. it's active).
  const impressionFired = useRef(false);
  useEffect(() => {
    if (!impressionFired.current) {
      impressionFired.current = true;
      phCapture("comp_banner_shown", { placement: "home_feed" });
    }
  }, []);

  async function handleJoin() {
    phCapture("comp_join_clicked", { placement: "home_feed" });
    setJoining(true);
    try { await onJoin(); } finally { setJoining(false); }
  }

  return (
    <>
      <div style={{
        fontFamily: MONO, fontSize: "0.625rem", color: C.accent,
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
    </>
  );
}
