// ─── PostHog analytics wrapper ────────────────────────────────────────────────
// Safe no-op if VITE_POSTHOG_KEY is not set (local dev, CI).
// Gated on cookie consent — PECR / GDPR: no non-essential cookies before opt-in.
// Import `ph` and call ph.capture() anywhere in the app.

import posthog from "posthog-js";

const KEY  = import.meta.env.VITE_POSTHOG_KEY as string | undefined;
// Project lives on PostHog EU (eu.posthog.com, project 182606). The browser MUST
// ingest to the EU region — sending an EU key to the US host returns 200 but the
// events are silently dropped. `||` (not `??`) so an empty-string env still falls
// back to the EU default.
const HOST = (import.meta.env.VITE_POSTHOG_HOST as string | undefined) || "https://eu.i.posthog.com";

export const COOKIE_CONSENT_KEY = "koda_cookie_consent";

export function hasAnalyticsConsent(): boolean {
  if (typeof window === "undefined") return false;
  try {
    const raw = localStorage.getItem(COOKIE_CONSENT_KEY);
    if (!raw) return false;
    // Legacy string format (pre-granular-consent banner)
    if (raw === "accepted") return true;
    if (raw === "rejected") return false;
    // Granular format written by CookieConsent.tsx:
    //   { essential: true, analytics: bool, marketing: bool, ts: number }
    const p: unknown = JSON.parse(raw);
    return typeof p === "object" && p !== null && (p as { analytics?: unknown }).analytics === true;
  } catch { return false; }
}

/**
 * Dispatched after PostHog initializes (including when a first-time visitor
 * accepts the cookie banner). Lets pre-consent views — e.g. landing_page_viewed,
 * which mounts before the banner is answered — capture once consent arrives
 * instead of being silently dropped.
 */
export const ANALYTICS_READY_EVENT = "koda:analytics-ready";

export function initPostHog() {
  if (!KEY) return;
  if (!hasAnalyticsConsent()) return;
  posthog.init(KEY, {
    api_host:                HOST,
    person_profiles:         "identified_only",
    capture_pageview:        true,
    capture_pageleave:       true,
    autocapture:             true,
    session_recording: {
      maskAllInputs:    false,
      maskInputOptions: { password: true },
    },
  });
  if (typeof window !== "undefined") {
    window.dispatchEvent(new Event(ANALYTICS_READY_EVENT));
  }
}

/** Identify the user so events are tied to their account. */
export function phIdentify(userId: string, props?: Record<string, unknown>) {
  if (!KEY) return;
  posthog.identify(userId, props);
}

/** Reset identity on sign-out. */
export function phReset() {
  if (!KEY) return;
  posthog.reset();
}

/** Capture a named event with optional properties. */
export function phCapture(event: string, props?: Record<string, unknown>) {
  if (!KEY) return;
  posthog.capture(event, props);
}
