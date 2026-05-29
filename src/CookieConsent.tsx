import { useEffect, useState } from "react";
import { COOKIE_CONSENT_KEY, initPostHog } from "./lib/posthog";

const C = {
  bg:      "#0C0C0B",
  text:    "#EDEDE8",
  text2:   "#BCBCB4",
  muted:   "#8A8A82",
  border:  "#3A3A34",
  accent:  "#89CFF0",
};
const BODY = "'Inter', system-ui, sans-serif";
const MONO = "'IBM Plex Mono', ui-monospace, monospace";

export function CookieConsent() {
  const [open, setOpen] = useState(false);

  useEffect(() => {
    try {
      const v = localStorage.getItem(COOKIE_CONSENT_KEY);
      if (v !== "accepted" && v !== "rejected") setOpen(true);
    } catch {
      setOpen(true);
    }
  }, []);

  if (!open) return null;

  const accept = () => {
    try { localStorage.setItem(COOKIE_CONSENT_KEY, "accepted"); } catch {}
    initPostHog();
    setOpen(false);
  };

  const reject = () => {
    try { localStorage.setItem(COOKIE_CONSENT_KEY, "rejected"); } catch {}
    setOpen(false);
  };

  return (
    <div
      role="dialog"
      aria-label="Cookie consent"
      style={{
        position: "fixed",
        left: 0,
        right: 0,
        bottom: 0,
        zIndex: 9999,
        background: "rgba(12, 12, 11, 0.96)",
        borderTop: `1px solid ${C.border}`,
        backdropFilter: "blur(8px)",
        WebkitBackdropFilter: "blur(8px)",
        color: C.text,
        fontFamily: BODY,
        padding: "16px max(16px, env(safe-area-inset-left)) calc(16px + env(safe-area-inset-bottom)) max(16px, env(safe-area-inset-right))",
      }}
    >
      <div
        style={{
          maxWidth: 720,
          margin: "0 auto",
          display: "flex",
          flexWrap: "wrap",
          alignItems: "center",
          justifyContent: "space-between",
          gap: 12,
        }}
      >
        <p
          style={{
            margin: 0,
            fontSize: 13,
            lineHeight: 1.5,
            color: C.text2,
            flex: "1 1 280px",
            minWidth: 0,
          }}
        >
          We use analytics cookies to understand how Kōda is used and improve it. Essential cookies are always on.{" "}
          <a
            href="/cookies.html"
            style={{ color: C.accent, textDecoration: "none" }}
          >
            Cookie Policy
          </a>
          .
        </p>
        <div style={{ display: "flex", gap: 8, flexShrink: 0 }}>
          <button
            onClick={reject}
            style={{
              minHeight: 44,
              padding: "10px 18px",
              borderRadius: 8,
              border: `1px solid ${C.border}`,
              background: "transparent",
              color: C.text,
              fontFamily: MONO,
              fontSize: 12,
              letterSpacing: "0.08em",
              textTransform: "uppercase",
              cursor: "pointer",
            }}
          >
            Reject
          </button>
          <button
            onClick={accept}
            style={{
              minHeight: 44,
              padding: "10px 18px",
              borderRadius: 8,
              border: "none",
              background: C.accent,
              color: C.bg,
              fontFamily: MONO,
              fontSize: 12,
              fontWeight: 600,
              letterSpacing: "0.08em",
              textTransform: "uppercase",
              cursor: "pointer",
            }}
          >
            Accept
          </button>
        </div>
      </div>
    </div>
  );
}
