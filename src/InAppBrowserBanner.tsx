// ═══════════════════════════════════════════════════════════════════════════════
// Kōda · InAppBrowserBanner
//
// Sticky banner at the top of the app shell when the user is inside an
// in-app browser (Instagram, TikTok, Facebook, etc.). OAuth flows don't
// work reliably in these — Supabase callback redirects can fail silently
// or land on a raw error page (Bruno 2026-06-06 incident).
//
// The banner tells them to open in their real browser, with a one-tap
// copy-link button so they don't lose the URL.
// ═══════════════════════════════════════════════════════════════════════════════

import { useState, useEffect } from "react";
import { detectInAppBrowser } from "./lib/pwa";
import { MONO, BODY } from "./shared";

const DISMISS_KEY = "koda_inapp_banner_dismissed";

export function InAppBrowserBanner() {
  const [show, setShow] = useState(false);
  const [browserName, setBrowserName] = useState<string | undefined>();
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    const { isInApp, name } = detectInAppBrowser();
    // Session-only dismiss — banner returns next time they open the link.
    const dismissed = sessionStorage.getItem(DISMISS_KEY) === "1";
    if (isInApp && !dismissed) {
      setShow(true);
      setBrowserName(name);
    }
  }, []);

  function dismiss() {
    try { sessionStorage.setItem(DISMISS_KEY, "1"); } catch { /* ignore */ }
    setShow(false);
  }

  async function copyLink() {
    try {
      await navigator.clipboard.writeText(window.location.href);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // Clipboard API can be blocked inside in-app browsers — fall back to
      // selecting the URL via a temporary input. Not perfect, but works.
      const input = document.createElement("input");
      input.value = window.location.href;
      document.body.appendChild(input);
      input.select();
      try { document.execCommand("copy"); setCopied(true); setTimeout(() => setCopied(false), 2000); } catch { /* ignore */ }
      document.body.removeChild(input);
    }
  }

  if (!show) return null;

  return (
    <div role="alert" style={{
      width: "100%",
      background: "#13110E",
      borderBottom: "1px solid rgba(255,255,255,0.12)",
      padding: "12px 16px calc(12px + env(safe-area-inset-top, 0px)) 16px",
      paddingTop: "calc(12px + env(safe-area-inset-top, 0px))",
      display: "flex",
      alignItems: "flex-start",
      gap: 12,
      fontFamily: BODY,
      color: "#F2F2EE",
      position: "sticky",
      top: 0,
      zIndex: 10000,
    }}>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{
          fontFamily: MONO, fontSize: 10, color: "#A6A6A2",
          letterSpacing: "0.10em", textTransform: "uppercase",
          marginBottom: 4,
        }}>
          {browserName ? `${browserName} browser` : "In-app browser"} · sign-in won't work here
        </div>
        <div style={{ fontSize: 13, lineHeight: 1.45 }}>
          Tap <strong>⋮</strong> (top-right) → <strong>"Open in Browser"</strong> for the full Kōda experience.
        </div>
        <div style={{ marginTop: 8, display: "flex", gap: 8 }}>
          <button
            onClick={copyLink}
            style={{
              background: "rgba(255,255,255,0.08)",
              border: "1px solid rgba(255,255,255,0.12)",
              color: "#F2F2EE",
              borderRadius: 999,
              padding: "6px 12px",
              fontSize: 12,
              fontFamily: BODY,
              cursor: "pointer",
            }}
          >
            {copied ? "Copied ✓" : "Copy link"}
          </button>
        </div>
      </div>
      <button
        onClick={dismiss}
        aria-label="Dismiss"
        style={{
          background: "none", border: "none",
          color: "#65655F", cursor: "pointer",
          fontSize: 20, padding: "0 4px", lineHeight: 1,
          flexShrink: 0,
        }}
      >×</button>
    </div>
  );
}
