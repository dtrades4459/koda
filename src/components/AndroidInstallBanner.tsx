// src/components/AndroidInstallBanner.tsx
// ═══════════════════════════════════════════════════════════════════════════════
// Kōda · Android/desktop PWA install banner (cat19)
//
// Catches the `beforeinstallprompt` event (Chrome/Edge/Brave on Android +
// desktop) and surfaces a subtle banner once the user has spent enough time
// in-app to know they want this. We *don't* show on iOS (handled by the
// existing InstallHint), and we never show if already installed.
//
// Show conditions:
//   - beforeinstallprompt fired (browser thinks user qualifies for install)
//   - NOT running standalone
//   - User hasn't dismissed previously (localStorage)
//   - User has been on the page at least 60s
// ═══════════════════════════════════════════════════════════════════════════════

import { useEffect, useState } from "react";

type BeforeInstallPromptEvent = Event & {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
};

const DISMISS_KEY = "koda_android_install_dismissed";
const SHOW_DELAY_MS = 60_000;

function isStandalone(): boolean {
  if (typeof window === "undefined") return false;
  return window.matchMedia?.("(display-mode: standalone)").matches ?? false;
}

export function AndroidInstallBanner() {
  const [evt, setEvt]   = useState<BeforeInstallPromptEvent | null>(null);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    if (isStandalone()) return;
    try { if (localStorage.getItem(DISMISS_KEY) === "1") return; } catch { /* ignore */ }

    const handler = (e: Event) => {
      e.preventDefault();
      setEvt(e as BeforeInstallPromptEvent);
    };
    window.addEventListener("beforeinstallprompt", handler);

    const timer = window.setTimeout(() => setReady(true), SHOW_DELAY_MS);
    return () => {
      window.removeEventListener("beforeinstallprompt", handler);
      window.clearTimeout(timer);
    };
  }, []);

  function dismiss() {
    setEvt(null);
    try { localStorage.setItem(DISMISS_KEY, "1"); } catch { /* ignore */ }
  }

  async function install() {
    if (!evt) return;
    await evt.prompt();
    const { outcome } = await evt.userChoice;
    if (outcome === "accepted") dismiss();
    setEvt(null);
  }

  if (!evt || !ready) return null;

  return (
    <div
      role="dialog"
      aria-label="Install Kōda"
      style={{
        position: "fixed",
        left: "12px",
        right: "12px",
        bottom: "calc(12px + env(safe-area-inset-bottom))",
        zIndex: 9996,
        padding: "14px 16px",
        background: "#131317",
        border: "1px solid rgba(255,255,255,0.13)",
        borderRadius: "16px",
        boxShadow: "0 16px 40px rgba(0,0,0,0.45), 0 2px 8px rgba(0,0,0,0.2)",
        backdropFilter: "blur(20px) saturate(140%)",
        WebkitBackdropFilter: "blur(20px) saturate(140%)",
        display: "flex",
        alignItems: "center",
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
        }}>
          Install Kōda
        </div>
        <div style={{ fontSize: "13px", lineHeight: 1.45 }}>
          Add to home screen for push, offline, and a faster launch.
        </div>
      </div>
      <button
        onClick={install}
        style={{
          background: "oklch(0.84 0.14 175)",
          color: "#0A0A0A",
          border: "none",
          borderRadius: 999,
          padding: "9px 16px",
          fontWeight: 600,
          fontSize: 13,
          cursor: "pointer",
        }}
      >
        Install
      </button>
      <button
        onClick={dismiss}
        aria-label="Dismiss"
        style={{
          background: "transparent", border: "none", color: "#65655F",
          fontFamily: "'Geist Mono', monospace", fontSize: 16, cursor: "pointer",
          padding: "4px 6px",
        }}
      >
        ×
      </button>
    </div>
  );
}
