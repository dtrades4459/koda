// ─── Server-side PostHog capture ─────────────────────────────────────────────
// Fire-and-forget event capture from serverless functions (e.g. the Stripe
// webhook, where the real "paid" conversion is confirmed). Never throws — a
// failed analytics call must never break the calling handler.
//
// Uses the project's public ingestion key (VITE_POSTHOG_KEY — Vercel injects it
// into the function runtime regardless of the VITE_ prefix). Project lives on
// PostHog EU, so ingestion goes to eu.i.posthog.com. See src/lib/posthog.ts and
// the EU-region memory for why the host matters.

const INGEST_HOST = process.env.POSTHOG_INGEST_HOST ?? "https://eu.i.posthog.com";

/**
 * Capture a server-side event. `distinctId` must be the user's Supabase uid so
 * it lines up with the browser's phIdentify() and connects in funnels.
 * Awaited by callers (a detached fetch can be killed when the function returns)
 * but resolves even on error.
 */
export async function phCaptureServer(
  event: string,
  distinctId: string,
  properties?: Record<string, unknown>,
): Promise<void> {
  const key = process.env.VITE_POSTHOG_KEY ?? process.env.POSTHOG_INGEST_KEY;
  if (!key || !distinctId) return;
  try {
    await fetch(`${INGEST_HOST}/capture/`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        api_key:     key,
        event,
        distinct_id: distinctId,
        properties:  { ...properties, $lib: "koda-server" },
        timestamp:   new Date().toISOString(),
      }),
    });
  } catch (err) {
    console.error("phCaptureServer error:", err);
  }
}
