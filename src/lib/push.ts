// src/lib/push.ts
// ═══════════════════════════════════════════════════════════════════════════════
// Kōda · Push notification subscription helper
//
// Shared by SettingsScreen (toggle) and OnboardingFlow (opt-in step). Wraps:
//   1. Service worker registration
//   2. OS-level Notification.requestPermission()
//   3. PushManager.subscribe with VAPID key
//   4. POST subscription JSON to /api/push?action=subscribe
//
// Returns a discriminated result instead of throwing so callers can show
// targeted UX for each failure mode.
// ═══════════════════════════════════════════════════════════════════════════════

import { supabase } from "./supabase";

function vapidKey(): Uint8Array {
  const base64 = (import.meta.env.VITE_VAPID_PUBLIC_KEY as string)
    .replace(/-/g, "+").replace(/_/g, "/");
  const padded = base64 + "=".repeat((4 - base64.length % 4) % 4);
  const raw = atob(padded);
  return Uint8Array.from([...raw].map(c => c.charCodeAt(0)));
}

export type PushSubscribeResult =
  | { ok: true }
  | { ok: false; reason: "unsupported" | "denied" | "dismissed" | "no_session" | "server" | "unknown"; message: string };

export async function subscribeToPush(): Promise<PushSubscribeResult> {
  if (typeof window === "undefined" || !("serviceWorker" in navigator) || !("PushManager" in window) || typeof Notification === "undefined") {
    return { ok: false, reason: "unsupported", message: "Push notifications aren't supported on this device" };
  }

  try {
    let reg = await navigator.serviceWorker.getRegistration();
    if (!reg) {
      reg = await navigator.serviceWorker.register("/sw.js", { scope: "/" });
      await navigator.serviceWorker.ready;
    }

    const permission = await Notification.requestPermission();
    if (permission === "denied") return { ok: false, reason: "denied", message: "Notifications blocked — allow them in your browser settings" };
    if (permission !== "granted") return { ok: false, reason: "dismissed", message: "Notification permission not granted" };

    const { data: { session } } = await supabase.auth.getSession();
    if (!session?.access_token) return { ok: false, reason: "no_session", message: "Sign in required" };

    const sub = await reg.pushManager.subscribe({
      userVisibleOnly: true,
      applicationServerKey: vapidKey() as BufferSource,
    });

    const res = await fetch("/api/push?action=subscribe", {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${session.access_token}` },
      body: JSON.stringify(sub.toJSON()),
    });

    if (!res.ok) return { ok: false, reason: "server", message: `Server error ${res.status} — try again` };
    return { ok: true };
  } catch (e) {
    return { ok: false, reason: "unknown", message: e instanceof Error ? e.message : "Unexpected error" };
  }
}
