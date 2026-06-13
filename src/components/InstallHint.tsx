// src/components/InstallHint.tsx
// ═══════════════════════════════════════════════════════════════════════════════
// Kōda · PWA install hint (iOS + Android)
//
// Two platforms, one banner:
//   - iOS Safari: shows visual "tap Share → Add to Home Screen" instructions
//     (iOS has no native install prompt).
//   - Android Chromium: when the `beforeinstallprompt` event fires, shows a
//     one-tap "Install Kōda" button that triggers the native prompt.
//
// Why this matters: iOS Safari blocks push notifications until the app is
// installed via "Add to Home Screen". On Android Chrome, the user has to
// dig through ⋮ menu to install — most never do. A nudge captures both.
//
// Show conditions (all must hold):
//   - iOS device, OR Android Chromium with deferred install prompt available
//   - NOT already running in standalone PWA mode
//   - User hasn't dismissed it previously (localStorage)
//   - Delay 3s after mount + cookie consent dismissed so banners don't stack
// ═══════════════════════════════════════════════════════════════════════════════

import { useEffect, useState } from "react";
import { isStandalone, isIOS, useInstallPrompt } from "../lib/pwa";
import { MONO, BODY } from "../shared";

// iPadOS reports as Mac in newer versions — augment the shared isIOS() check.
function isIOSDevice(): boolean {
  if (isIOS()) return true;
  if (typeof navigator === "undefined") return false;
  return navigator.maxTouchPoints > 1 && /Macintosh/.test(navigator.userAgent);
}

const DISMISS_KEY = "koda_install_hint_dismissed";
const COOKIE_CONSENT_KEY = "koda_cookie_consent";
const SHOW_DELAY_MS = 3000;

export function InstallHint() {
  const [show, setShow] = useState(false);
  const { canPrompt, triggerPrompt } = useInstallPrompt();

  const ios = isIOSDevice();
  // Android (or any Chromium) gets the banner only when the native prompt
  // is actually available — otherwise there's nothing to suggest.
  const eligible = (ios || canPrompt) && !isStandalone();

  useEffect(() => {
    if (!eligible) return;

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
        // Support both legacy strings ("accepted"/"rejected") and current JSON format.
        if (!consent) return false;
        if (consent !== "accepted" && consent !== "rejected") {
          try { if (typeof JSON.parse(consent) !== "object") return false; }
          catch { return false; }
        }
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
  }, [eligible]);

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
        background: "#0A0A0B",
        border: "1px solid rgba(255,255,255,0.13)",
        borderRadius: "16px",
        boxShadow: "0 16px 40px rgba(0,0,0,0.45), 0 2px 8px rgba(0,0,0,0.2)",
        backdropFilter: "blur(20px) saturate(140%)",
        WebkitBackdropFilter: "blur(20px) saturate(140%)",
        display: "flex",
        alignItems: "flex-start",
        gap: "12px",
        fontFamily: BODY,
        color: "#F2F2EE",
      }}
    >
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{
          fontFamily: MONO,
          fontSize: "0.5625rem",
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
        {ios ? (
          <div style={{ fontSize: "0.8125rem", lineHeight: 1.45, color: "#F2F2EE" }}>
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
        ) : (
          <>
            <div style={{ fontSize: "0.8125rem", lineHeight: 1.45, color: "#F2F2EE", marginBottom: 10 }}>
              Install Kōda for push notifications + offline access.
            </div>
            <button
              onClick={async () => {
                const choice = await triggerPrompt();
                if (choice) dismiss();
              }}
              style={{
                background: "#F2F2EE",
                color: "#13110E",
                border: "none",
                borderRadius: 999,
                padding: "8px 14px",
                fontSize: "0.75rem",
                fontWeight: 600,
                fontFamily: BODY,
                cursor: "pointer",
              }}
            >
              Install Kōda →
            </button>
          </>
        )}
      </div>
      <button
        onClick={dismiss}
        aria-label="Dismiss install hint"
        style={{
          background: "transparent",
          border: "none",
          color: "#65655F",
          cursor: "pointer",
          fontFamily: MONO,
          fontSize: "1rem",
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
