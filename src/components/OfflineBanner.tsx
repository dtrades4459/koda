import type { Theme } from "../theme";
import { MONO } from "../shared";

interface OfflineBannerProps {
  visible: boolean;
  onRetry: () => void;
  C: Theme;
}

export function OfflineBanner({ visible, onRetry, C }: OfflineBannerProps) {
  if (!visible) return null;
  return (
    <div role="alert" aria-live="assertive" style={{ position: "fixed", top: 0, left: 0, right: 0, zIndex: 9999, background: C.warn, color: "#0A0A0B", fontFamily: MONO, fontSize: 11, letterSpacing: "0.06em", padding: "10px 16px", display: "flex", alignItems: "center", justifyContent: "center", gap: 12 }}>
      <span>OFFLINE — changes won't sync until you reconnect.</span>
      <button onClick={onRetry} style={{ background: "transparent", border: "1px solid rgba(0,0,0,0.25)", borderRadius: 999, padding: "2px 10px", cursor: "pointer", fontFamily: MONO, fontSize: 10, letterSpacing: "0.08em", color: "#0A0A0B" }}>Retry</button>
    </div>
  );
}
