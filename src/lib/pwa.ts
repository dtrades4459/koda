// ═══════════════════════════════════════════════════════════════════════════════
// Kōda · PWA / install / in-app-browser detection
//
// Three primitives used by InAppBrowserBanner + AddToHomeScreenPrompt:
//   - detectInAppBrowser()  →  UA sniff for Instagram/TikTok/FB/etc.
//   - isStandalone()        →  is the app already installed + opened from home
//                              screen (display-mode: standalone, or iOS
//                              navigator.standalone)
//   - useInstallPrompt()    →  React hook around the Chrome/Android
//                              `beforeinstallprompt` event. iOS Safari does
//                              NOT fire this — fallback is visual instructions.
// ═══════════════════════════════════════════════════════════════════════════════

import { useEffect, useState } from "react";

// In-app browser detection.
// These UA fragments are distinctive — false positives are rare in practice.
// We treat this as UX routing, not a security check.
const IN_APP_BROWSER_PATTERNS: Array<{ name: string; pattern: RegExp }> = [
  { name: "Instagram",   pattern: /Instagram/i },
  { name: "TikTok",      pattern: /TikTok|BytedanceWebview|musical_ly/i },
  { name: "Facebook",    pattern: /FBAN|FBAV|FB_IAB|FBIOS/i },
  { name: "Twitter",     pattern: /Twitter/i },
  { name: "LinkedIn",    pattern: /LinkedInApp/i },
  { name: "Snapchat",    pattern: /Snapchat/i },
  { name: "Line",        pattern: /Line\//i },
  { name: "WeChat",      pattern: /MicroMessenger/i },
  { name: "KakaoTalk",   pattern: /KAKAOTALK/i },
];

export interface InAppBrowserResult {
  isInApp: boolean;
  name?: string;
}

export function detectInAppBrowser(): InAppBrowserResult {
  if (typeof navigator === "undefined") return { isInApp: false };
  const ua = navigator.userAgent;
  for (const { name, pattern } of IN_APP_BROWSER_PATTERNS) {
    if (pattern.test(ua)) return { isInApp: true, name };
  }
  return { isInApp: false };
}

// Standalone (installed-PWA) detection.
// Works on both Chrome/Android (display-mode) and iOS Safari (navigator.standalone).
export function isStandalone(): boolean {
  if (typeof window === "undefined") return false;
  if (window.matchMedia?.("(display-mode: standalone)").matches) return true;
  const nav = navigator as Navigator & { standalone?: boolean };
  return nav.standalone === true;
}

export function isIOS(): boolean {
  if (typeof navigator === "undefined") return false;
  return /iPad|iPhone|iPod/.test(navigator.userAgent);
}

// `beforeinstallprompt` is non-standard but supported on Chromium-based
// browsers (Chrome, Edge, Samsung Internet, Android WebView).
// iOS Safari never fires it.
interface BeforeInstallPromptEvent extends Event {
  prompt(): Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed"; platform: string }>;
}

export interface InstallPromptState {
  canPrompt: boolean;
  /**
   * Fire the native install prompt. Returns the user's choice, or null if
   * no prompt was available (e.g. iOS Safari, or already installed).
   */
  triggerPrompt: () => Promise<{ outcome: "accepted" | "dismissed" } | null>;
}

export function useInstallPrompt(): InstallPromptState {
  const [deferred, setDeferred] = useState<BeforeInstallPromptEvent | null>(null);

  useEffect(() => {
    function onBeforeInstallPrompt(e: Event) {
      // Prevent the mini-infobar from auto-showing on mobile Chrome.
      e.preventDefault();
      setDeferred(e as BeforeInstallPromptEvent);
    }
    window.addEventListener("beforeinstallprompt", onBeforeInstallPrompt);
    return () => window.removeEventListener("beforeinstallprompt", onBeforeInstallPrompt);
  }, []);

  async function triggerPrompt() {
    if (!deferred) return null;
    await deferred.prompt();
    const choice = await deferred.userChoice;
    setDeferred(null);
    return { outcome: choice.outcome };
  }

  return { canPrompt: !!deferred, triggerPrompt };
}
