import { useEffect, useState } from "react";
import type { Theme } from "../theme";
import {
  OfflineBanner,
  ReconnectedBanner,
  SWUpdateBanner,
  SessionExpiredModal,
  VersionMismatchBanner,
} from "./SystemBanners";

/**
 * SystemProvider — global connectivity / lifecycle UI provider.
 *
 * Wires:
 *   • Browser online/offline events → OfflineBanner + ReconnectedBanner
 *   • Service worker `updatefound` → SWUpdateBanner
 *   • Session expiry from Supabase (use `useSessionExpiry` hook)
 *   • Client/server version mismatch (manual trigger via window.dispatchEvent)
 *
 * Mount once at the app root, after auth.
 */
export function SystemProvider({
  C,
  onSignIn,
}: {
  C: Theme;
  onSignIn?: () => void;
}) {
  const [showReconnected, setShowReconnected] = useState(false);
  const [syncedCount, setSyncedCount] = useState(0);
  const [swUpdate, setSwUpdate] = useState(false);
  const [sessionExpired, setSessionExpired] = useState(false);
  const [versionMismatch, setVersionMismatch] = useState(false);
  const [wasOffline, setWasOffline] = useState(false);

  // ── Online / offline tracking ────────────────────────────────────────────
  useEffect(() => {
    let initialOnline = typeof navigator !== "undefined" ? navigator.onLine : true;
    setWasOffline(!initialOnline);
    const handleOnline = () => {
      if (wasOffline) {
        // count any queued writes (read from localStorage queue key)
        try {
          const q = localStorage.getItem("koda_offline_queue");
          const n = q ? JSON.parse(q).length : 0;
          setSyncedCount(n);
        } catch { /* noop */ }
        setShowReconnected(true);
        setTimeout(() => setShowReconnected(false), 3500);
      }
      setWasOffline(false);
    };
    const handleOffline = () => setWasOffline(true);
    window.addEventListener("online", handleOnline);
    window.addEventListener("offline", handleOffline);
    return () => {
      window.removeEventListener("online", handleOnline);
      window.removeEventListener("offline", handleOffline);
    };
  }, [wasOffline]);

  // ── Service worker update detection ──────────────────────────────────────
  useEffect(() => {
    if (typeof navigator === "undefined" || !("serviceWorker" in navigator)) return;
    navigator.serviceWorker.getRegistration().then(reg => {
      if (!reg) return;
      reg.addEventListener("updatefound", () => {
        const newWorker = reg.installing;
        if (!newWorker) return;
        newWorker.addEventListener("statechange", () => {
          if (newWorker.state === "installed" && navigator.serviceWorker.controller) {
            setSwUpdate(true);
          }
        });
      });
    });
  }, []);

  // ── Manual triggers via window events ────────────────────────────────────
  useEffect(() => {
    const handleSessionExpired = () => setSessionExpired(true);
    const handleVersionMismatch = () => setVersionMismatch(true);
    window.addEventListener("koda:session-expired", handleSessionExpired);
    window.addEventListener("koda:version-mismatch", handleVersionMismatch);
    return () => {
      window.removeEventListener("koda:session-expired", handleSessionExpired);
      window.removeEventListener("koda:version-mismatch", handleVersionMismatch);
    };
  }, []);

  const handleReload = () => {
    if (typeof navigator !== "undefined" && "serviceWorker" in navigator) {
      navigator.serviceWorker.getRegistration().then(reg => {
        if (reg?.waiting) reg.waiting.postMessage({ type: "SKIP_WAITING" });
        window.location.reload();
      });
    } else {
      window.location.reload();
    }
  };

  return (
    <>
      <OfflineBanner C={C} />
      {showReconnected && <ReconnectedBanner C={C} syncedCount={syncedCount} onDismiss={() => setShowReconnected(false)} />}
      {swUpdate && <SWUpdateBanner C={C} onReload={handleReload} onDismiss={() => setSwUpdate(false)} />}
      {versionMismatch && <VersionMismatchBanner C={C} onReload={handleReload} />}
      {sessionExpired && (
        <SessionExpiredModal
          C={C}
          onSignIn={() => {
            setSessionExpired(false);
            onSignIn?.();
          }}
          onDismiss={() => setSessionExpired(false)}
        />
      )}
    </>
  );
}

/** Helper to manually trigger the session-expired modal from anywhere. */
export function triggerSessionExpired() {
  window.dispatchEvent(new CustomEvent("koda:session-expired"));
}

/** Helper to manually trigger the version-mismatch banner. */
export function triggerVersionMismatch() {
  window.dispatchEvent(new CustomEvent("koda:version-mismatch"));
}
