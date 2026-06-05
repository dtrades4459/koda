import { useCallback, useEffect, useState } from "react";
import type { Theme } from "../theme";
import {
  OfflineBanner,
  ReconnectedBanner,
  SWUpdateBanner,
  SessionExpiredModal,
  VersionMismatchBanner,
  SlowConnectionBanner,
  OptimisticRollbackToast,
  RateLimitedModal,
  Error401,
  Error403,
  Error500,
  Error503,
} from "./SystemBanners";

/**
 * SystemProvider — global connectivity / lifecycle UI provider.
 *
 * Wires:
 *   • Browser online/offline events → OfflineBanner + ReconnectedBanner
 *   • Service worker `updatefound` → SWUpdateBanner
 *   • Session expiry from Supabase (`koda:session-expired`) → SessionExpiredModal
 *   • Client/server version mismatch (`koda:version-mismatch`) → VersionMismatchBanner
 *   • Slow connection (Network Information API + `koda:slow-connection`) → SlowConnectionBanner
 *   • Optimistic write rollback (`koda:optimistic-rollback`) → OptimisticRollbackToast
 *   • Rate-limited API response (`koda:rate-limited`) → RateLimitedModal
 *   • Branded error pages 401/403/500/503 (`koda:error-page`) → Error40x/50x
 *   • Maintenance mode (`koda:maintenance`) → Error503 (which doubles as "we're upgrading")
 *
 * Mount once at the app root, after auth.
 */

type ErrorPageCode = "401" | "403" | "500" | "503";

interface RollbackDetail {
  message?: string;
  retryEventName?: string;
}

interface RateLimitedDetail {
  secondsLeft?: number;
}

interface ErrorPageDetail {
  code?: ErrorPageCode;
}

interface NetInfoConnection {
  effectiveType?: string;
  addEventListener?: (type: "change", listener: () => void) => void;
  removeEventListener?: (type: "change", listener: () => void) => void;
}

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
  const [slowConnection, setSlowConnection] = useState(false);
  const [rollback, setRollback] = useState<{ message: string; retryEventName?: string } | null>(null);
  const [rateLimited, setRateLimited] = useState<{ secondsLeft: number } | null>(null);
  const [errorPage, setErrorPage] = useState<ErrorPageCode | null>(null);

  // ── Online / offline tracking ────────────────────────────────────────────
  useEffect(() => {
    const initialOnline = typeof navigator !== "undefined" ? navigator.onLine : true;
    setWasOffline(!initialOnline);
    const handleOnline = () => {
      if (wasOffline) {
        try {
          const q = localStorage.getItem("koda_offline_queue");
          const n = q ? (JSON.parse(q) as unknown[]).length : 0;
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

  // ── Slow connection auto-detection via Network Information API ───────────
  useEffect(() => {
    const nav = navigator as unknown as { connection?: NetInfoConnection };
    const conn = nav.connection;
    if (!conn) return;
    const check = () => {
      const eff = conn.effectiveType;
      setSlowConnection(eff === "slow-2g" || eff === "2g");
    };
    check();
    conn.addEventListener?.("change", check);
    return () => conn.removeEventListener?.("change", check);
  }, []);

  // ── Window-event triggers ────────────────────────────────────────────────
  useEffect(() => {
    const onSessionExpired = () => setSessionExpired(true);
    const onVersionMismatch = () => setVersionMismatch(true);
    const onSlow: EventListener = (e) => {
      const detail = (e as CustomEvent<{ on?: boolean }>).detail;
      setSlowConnection(detail?.on !== false);
    };
    const onRollback: EventListener = (e) => {
      const detail = (e as CustomEvent<RollbackDetail>).detail ?? {};
      setRollback({
        message: detail.message ?? "Your change didn't stick. Tap to retry.",
        retryEventName: detail.retryEventName,
      });
    };
    const onRate: EventListener = (e) => {
      const detail = (e as CustomEvent<RateLimitedDetail>).detail ?? {};
      setRateLimited({ secondsLeft: detail.secondsLeft ?? 23 });
    };
    const onErr: EventListener = (e) => {
      const detail = (e as CustomEvent<ErrorPageDetail>).detail;
      if (!detail?.code) return;
      setErrorPage(detail.code);
    };
    const onMaint = () => setErrorPage("503");

    window.addEventListener("koda:session-expired", onSessionExpired);
    window.addEventListener("koda:version-mismatch", onVersionMismatch);
    window.addEventListener("koda:slow-connection", onSlow);
    window.addEventListener("koda:optimistic-rollback", onRollback);
    window.addEventListener("koda:rate-limited", onRate);
    window.addEventListener("koda:error-page", onErr);
    window.addEventListener("koda:maintenance", onMaint);
    return () => {
      window.removeEventListener("koda:session-expired", onSessionExpired);
      window.removeEventListener("koda:version-mismatch", onVersionMismatch);
      window.removeEventListener("koda:slow-connection", onSlow);
      window.removeEventListener("koda:optimistic-rollback", onRollback);
      window.removeEventListener("koda:rate-limited", onRate);
      window.removeEventListener("koda:error-page", onErr);
      window.removeEventListener("koda:maintenance", onMaint);
    };
  }, []);

  const handleReload = useCallback(() => {
    if (typeof navigator !== "undefined" && "serviceWorker" in navigator) {
      navigator.serviceWorker.getRegistration().then(reg => {
        if (reg?.waiting) reg.waiting.postMessage({ type: "SKIP_WAITING" });
        window.location.reload();
      });
    } else {
      window.location.reload();
    }
  }, []);

  const handleRetry = useCallback(() => {
    if (rollback?.retryEventName) {
      window.dispatchEvent(new CustomEvent(rollback.retryEventName));
    }
    setRollback(null);
  }, [rollback]);

  const clearErrorPage = () => setErrorPage(null);

  return (
    <>
      <OfflineBanner C={C} />
      {showReconnected && <ReconnectedBanner C={C} syncedCount={syncedCount} onDismiss={() => setShowReconnected(false)} />}
      {slowConnection && <SlowConnectionBanner C={C} />}
      {swUpdate && <SWUpdateBanner C={C} onReload={handleReload} onDismiss={() => setSwUpdate(false)} />}
      {versionMismatch && <VersionMismatchBanner C={C} onReload={handleReload} />}
      {rollback && (
        <OptimisticRollbackToast
          C={C}
          message={rollback.message}
          onRetry={rollback.retryEventName ? handleRetry : undefined}
          onDismiss={() => setRollback(null)}
        />
      )}
      {rateLimited && (
        <RateLimitedModal
          C={C}
          secondsLeft={rateLimited.secondsLeft}
          onDismiss={() => setRateLimited(null)}
        />
      )}
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
      {errorPage === "401" && (
        <Error401 C={C} onSignIn={() => { clearErrorPage(); onSignIn?.(); }} />
      )}
      {errorPage === "403" && (
        <Error403 C={C} onHome={() => { clearErrorPage(); window.location.href = "/"; }} />
      )}
      {errorPage === "500" && (
        <Error500 C={C} onReload={() => { clearErrorPage(); window.location.reload(); }} />
      )}
      {errorPage === "503" && (
        <Error503 C={C} onReload={() => { clearErrorPage(); window.location.reload(); }} />
      )}
    </>
  );
}

/** Manually fire the session-expired modal from anywhere. */
export function triggerSessionExpired() {
  window.dispatchEvent(new CustomEvent("koda:session-expired"));
}

/** Manually fire the version-mismatch banner. */
export function triggerVersionMismatch() {
  window.dispatchEvent(new CustomEvent("koda:version-mismatch"));
}

/** Force-show / hide the slow-connection banner. Pass `false` to clear. */
export function triggerSlowConnection(on = true) {
  window.dispatchEvent(new CustomEvent("koda:slow-connection", { detail: { on } }));
}

/** Show the optimistic-rollback toast. `retryEventName` is dispatched on RETRY. */
export function triggerOptimisticRollback(message: string, retryEventName?: string) {
  window.dispatchEvent(new CustomEvent("koda:optimistic-rollback", { detail: { message, retryEventName } }));
}

/** Show the rate-limited modal with a countdown. */
export function triggerRateLimited(secondsLeft = 23) {
  window.dispatchEvent(new CustomEvent("koda:rate-limited", { detail: { secondsLeft } }));
}

/** Take over the screen with a branded 401/403/500/503 error page. */
export function triggerErrorPage(code: "401" | "403" | "500" | "503") {
  window.dispatchEvent(new CustomEvent("koda:error-page", { detail: { code } }));
}

/** Show the maintenance-mode takeover (renders the 503 page). */
export function triggerMaintenanceMode() {
  window.dispatchEvent(new CustomEvent("koda:maintenance"));
}
