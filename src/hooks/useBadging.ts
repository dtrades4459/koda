import { useEffect } from "react";

// ═══════════════════════════════════════════════════════════════════════════
// useBadging — Badging API integration (cat19)
//
// Sets the app icon badge to the unread count (or clears it when 0).
// Uses the experimental `navigator.setAppBadge` API where available;
// silently no-ops on unsupported browsers (Safari iOS, Firefox).
//
// Spec: https://developer.mozilla.org/en-US/docs/Web/API/Badging_API
// ═══════════════════════════════════════════════════════════════════════════

type BadgingNav = {
  setAppBadge?: (n?: number) => Promise<void>;
  clearAppBadge?: () => Promise<void>;
};

function badgingNav(): BadgingNav | null {
  if (typeof navigator === "undefined") return null;
  return navigator as unknown as BadgingNav;
}

export function useBadging(unreadCount: number) {
  useEffect(() => {
    const n = badgingNav();
    if (!n || !n.setAppBadge || !n.clearAppBadge) return;
    if (unreadCount > 0) {
      n.setAppBadge(unreadCount).catch(() => { /* permission denied — ignore */ });
    } else {
      n.clearAppBadge().catch(() => { /* noop */ });
    }
  }, [unreadCount]);
}

/** Manual setters for one-off calls (e.g. from a service worker bridge). */
export async function setAppBadge(n: number) {
  const nav = badgingNav();
  if (nav?.setAppBadge) {
    try { await nav.setAppBadge(n); } catch { /* noop */ }
  }
}
export async function clearAppBadge() {
  const nav = badgingNav();
  if (nav?.clearAppBadge) {
    try { await nav.clearAppBadge(); } catch { /* noop */ }
  }
}
