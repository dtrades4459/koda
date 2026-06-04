// ═══════════════════════════════════════════════════════════════════════════════
// Kōda · Sentry init
//
// @sentry/react is an optional peer — imported dynamically so the build
// succeeds even when the package is not installed locally.
// Activates only when VITE_SENTRY_DSN is set in Vercel env vars.
//
// To enable in production:
//   Vercel -> Settings -> Environment Variables -> VITE_SENTRY_DSN = <your DSN>
//
// To enable locally:
//   echo "VITE_SENTRY_DSN=https://...@sentry.io/..." >> .env.local
// ═══════════════════════════════════════════════════════════════════════════════

export function initSentry(): void {
  const dsn = import.meta.env.VITE_SENTRY_DSN as string | undefined;
  if (!dsn) return; // No-op unless DSN is configured

  // Dynamic import keeps the build green when @sentry/react is not installed.
  // Vercel installs it via package.json on every deploy.
  import("@sentry/react").then((Sentry) => {
    Sentry.init({
      dsn,
      environment: import.meta.env.MODE,
      release: import.meta.env.VITE_APP_VERSION,
      tracesSampleRate: 0.05,
      replaysSessionSampleRate: 0,
      replaysOnErrorSampleRate: 1.0,
      integrations: [
        Sentry.browserTracingIntegration(),
      ],
      beforeSend(event: any) {
        if (window.location.hostname === "localhost") return null;
        // Belt-and-suspenders for the legacy "[object Object]" title bug
        // (KODA-TT-1). Stale-bundle clients can still emit a message of
        // exactly "[object Object]"; recover a readable title from the
        // `original` extra written by log.ts.
        if (event.message === "[object Object]") {
          const original = event.extra?.original;
          if (typeof original === "string" && original.length > 0 && original !== "{}") {
            event.message = original.length > 200 ? `${original.slice(0, 200)}…` : original;
          }
        }
        return event;
      },
    });
    // Expose on window so log.ts and ErrorBoundary can access without a static import.
    (window as any).Sentry = Sentry;
  }).catch(() => {
    // @sentry/react not installed - Sentry disabled, app continues normally
  });
}
