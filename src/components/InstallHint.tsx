// src/components/InstallHint.tsx
// ═══════════════════════════════════════════════════════════════════════════════
// Kōda · iOS PWA install hint
//
// iOS Safari blocks push notifications until the app is installed via
// "Add to Home Screen". The onboarding "Enable notifications" step is wasted
// on Safari users until they install. This banner surfaces the install path
// so the feature chain actually completes on iOS.
//
// Show conditions (all must hold):
//   - iOS device (Safari or in-app browsers running WebKit)
//   - NOT already running in standalone PWA mode
//   - User hasn't dismissed it previously (localStorage)
//   - Delay 3s after mount so it doesn't slap users on first paint
//
// Android Chrome handles install via beforeinstallprompt natively — no banner
// needed for that path.
// ═══════════════════════════════════════════════════════════════════════════════

import { useEffect, useState } from "react";

const DISMISS_KEY = "koda_install_hint_dismissed";
const COOKIE_CONSENT_KEY = "koda_cookie_consent";
const SHOW_DELAY_MS = 3000;

function isIOS(): boolean {
  if (typeof navigator === "undefined") return false;
  const ua = navigator.userAgent;
  // iPad on iPadOS reports as Mac in newer versions — check touch points too.
  const iOSDevice = /iPad|iPhone|iPod/.test(ua);
  const iPadOS = navigator.maxTouchPoints > 1 && /Macintosh/.test(ua);
  return iOSDevice || iPadOS;
}

function isStandalone(): boolean {
  if (typeof window === "undefined") return false;
  // iOS Safari sets navigator.standalone; other browsers use matchMedia.
  const navAny = navigator as Navigator & { standalone?: boolean };
  if (navAny.standalone === true) return true;
  return window.matchMedia?.("(display-mode: standalone)").matches ?? false;
}

export function InstallHint() {
  const [show, setShow] = useState(false);

  useEffect(() => {
    if (!isIOS() || isStandalone()) return;

    // Wait for the cookie consent banner to be dismissed so the two
    // bottom-pinned banners don't stack on top of each other. Poll the
    // localStorage key the CookieConsent component sets on Accept/Reject.
    let mounted = true;
    let pollId: number | null = null;
    let showTimer: number | null = null;

    const tryShow = () => {
      try {
        if (localStorage.getItem(DISMISS_KEY) === "1") return false;
        const consent = localStorage.getItem(COOKIE_CONSENT_KEY);
        if (consent !== "accepted" && consent !== "rejected") return false;
      } catch { /* fall through and show */ }
      showTimer = window.setTimeout(() => { if (mounted) setShow(true); }, SHOW_DELAY_MS);
      return true;
    };

    if (!tryShow()) {
      pollId = window.setInterval(() => {
        if (tryShow() && pollId !== null) {
          window.clearInterval(pollId);
          pollId = null;
        }
      }, 1000);
    }

    return () => {
      mounted = false;
      if (pollId !== null) window.clearInterval(pollId);
      if (showTimer !== null) window.clearTimeout(showTimer);
    };
  }, []);

  function dismiss() {
    setShow(false);
    try { localStorage.setItem(DISMISS_KEY, "1"); } catch { /* ignore */ }
  }

  if (!show) return null;

  return (
    <div
      role="dialog"
      aria-label="Install Kōda"
      style={{
        position: "fixed",
        left: "12px",
        right: "12px",
        bottom: "calc(12px + env(safe-area-inset-bottom))",
        zIndex: 9997,
        padding: "14px 16px",
        background: "#131317",
        border: "1px solid rgba(255,255,255,0.13)",
        borderRadius: "16px",
        boxShadow: "0 16px 40px rgba(0,0,0,0.45), 0 2px 8px rgba(0,0,0,0.2)",
        backdropFilter: "blur(20px) saturate(140%)",
        WebkitBackdropFilter: "blur(20px) saturate(140%)",
        display: "flex",
        alignItems: "flex-start",
        gap: "12px",
        fontFamily: "'Geist', -apple-system, sans-serif",
        color: "#F2F2EE",
      }}
    >
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{
          fontFamily: "'Geist Mono', monospace",
          fontSize: "9px",
          letterSpacing: "0.18em",
          textTransform: "uppercase" as const,
          color: "oklch(0.84 0.14 175)",
          marginBottom: "6px",
          display: "flex",
          alignItems: "center",
          gap: "6px",
        }}>
          <span style={{
            width: "5px", height: "5px", borderRadius: "50%",
            background: "oklch(0.84 0.14 175)",
            boxShadow: "0 0 6px oklch(0.84 0.14 175)",
          }} />
          Install for push + offline
        </div>
        <div style={{ fontSize: "13px", lineHeight: 1.45, color: "#F2F2EE" }}>
          Tap{" "}
          <span style={{
            display: "inline-flex", alignItems: "center", justifyContent: "center",
            width: "18px", height: "18px", verticalAlign: "-4px",
            background: "rgba(255,255,255,0.08)",
            borderRadius: "4px",
            marginInline: "2px",
          }} aria-label="Share button">
            <svg width="11" height="13" viewBox="0 0 11 13" fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
              <path d="M5.5 1 V 8" />
              <path d="M3 3.5 L 5.5 1 L 8 3.5" />
              <path d="M2 6 H 1.5 V 12 H 9.5 V 6 H 9" />
            </svg>
          </span>
          {" "}then <strong style={{ fontWeight: 600 }}>Add to Home Screen</strong> to install Kōda. Notifications need it.
        </div>
      </div>
      <button
        onClick={dismiss}
        aria-label="Dismiss install hint"
        style={{
          background: "transparent",
          border: "none",
          color: "#65655F",
          cursor: "pointer",
          fontFamily: "'Geist Mono', monospace",
          fontSize: "16px",
          lineHeight: 1,
          padding: "4px 6px",
          marginRight: "-4px",
          marginTop: "-2px",
          flexShrink: 0,
        }}
      >
        ×
      </button>
    </div>
  );
}
