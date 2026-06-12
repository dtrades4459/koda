import { DARK } from "../theme";
import { DISPLAY, KodaMarkFilled } from "../shared";

// First-paint splash. Always renders in the DARK palette regardless of the
// user's saved theme since the theme is not known yet at this point.
export function LoadingSplash() {
  return (
    <div style={{ minHeight: "100dvh", background: DARK.bg, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: "20px" }}>
      <style>{`
        @keyframes splashPulse{0%,100%{transform:scale(1);opacity:0.18}50%{transform:scale(1.55);opacity:0}}
        @keyframes splashBreath{0%,100%{opacity:0.3;transform:scale(0.92)}50%{opacity:1;transform:scale(1)}}
        @keyframes splashDot{0%,80%,100%{opacity:0.2;transform:scale(0.7)}40%{opacity:1;transform:scale(1)}}
      `}</style>
      {/* Pulse ring behind logo */}
      <div style={{ position: "relative", display: "flex", alignItems: "center", justifyContent: "center" }}>
        <div style={{ position: "absolute", width: "96px", height: "96px", borderRadius: "50%", border: `1.5px solid ${DARK.text}`, animation: "splashPulse 2s ease-in-out infinite" }} />
        <div style={{ animation: "splashBreath 2.4s ease-in-out infinite" }}>
          <KodaMarkFilled size={64} bg={DARK.panel} />
        </div>
      </div>
      {/* Wordmark */}
      <div style={{ display: "flex", alignItems: "baseline", gap: "8px" }}>
        <span style={{ fontFamily: DISPLAY, fontWeight: 600, fontSize: "18px", letterSpacing: "0.22em", color: DARK.text }}>Kōda</span>
      </div>
      {/* Breathing dots */}
      <div style={{ display: "flex", gap: "6px" }}>
        {[0, 1, 2].map(i => (
          <span key={i} style={{ width: "5px", height: "5px", borderRadius: "50%", background: DARK.text, display: "inline-block", animation: `splashDot 1.2s ease-in-out infinite`, animationDelay: `${i * 0.2}s` }} />
        ))}
      </div>
    </div>
  );
}
