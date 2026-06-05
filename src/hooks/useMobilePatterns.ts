import { useEffect, useRef, useState, useCallback } from "react";

// ═══════════════════════════════════════════════════════════════════════════
// Mobile interaction hooks (cat17)
//
// Exports:
//   • useHaptics — light / medium / heavy / select / success / error
//   • usePullToRefresh — gesture handler that returns { pulling, distance, refreshing, bind }
//   • useSwipeActions — left-swipe reveals action chips per row
//   • useLongPress — fires after configurable delay, cancels on move/up
// ═══════════════════════════════════════════════════════════════════════════

// ─── Haptics ──────────────────────────────────────────────────────────────
export type HapticKind = "light" | "medium" | "heavy" | "select" | "success" | "warn" | "error";

const HAPTIC_PATTERNS: Record<HapticKind, number | number[]> = {
  light: 10,
  medium: 25,
  heavy: 60,
  select: 5,
  success: [12, 40, 12],
  warn: [30, 60, 30],
  error: [50, 80, 50],
};

export function useHaptics() {
  return useCallback((kind: HapticKind) => {
    if (typeof navigator === "undefined" || !navigator.vibrate) return;
    try { navigator.vibrate(HAPTIC_PATTERNS[kind]); } catch { /* noop */ }
  }, []);
}

// ─── Pull to refresh ──────────────────────────────────────────────────────
export interface PullToRefreshState {
  pulling: boolean;
  distance: number;
  refreshing: boolean;
  bind: {
    onTouchStart: (e: React.TouchEvent) => void;
    onTouchMove: (e: React.TouchEvent) => void;
    onTouchEnd: () => void;
  };
}

export function usePullToRefresh(
  onRefresh: () => Promise<void> | void,
  options: { threshold?: number; maxDistance?: number; container?: () => HTMLElement | null } = {}
): PullToRefreshState {
  const { threshold = 60, maxDistance = 120, container } = options;
  const [pulling, setPulling] = useState(false);
  const [distance, setDistance] = useState(0);
  const [refreshing, setRefreshing] = useState(false);
  const startY = useRef<number | null>(null);
  const haptics = useHaptics();
  const lastFireDistance = useRef(0);

  const onTouchStart = useCallback((e: React.TouchEvent) => {
    if (refreshing) return;
    const scrollTop = container?.()?.scrollTop ?? window.scrollY;
    if (scrollTop > 0) {
      startY.current = null;
      return;
    }
    startY.current = e.touches[0].clientY;
    lastFireDistance.current = 0;
  }, [refreshing, container]);

  const onTouchMove = useCallback((e: React.TouchEvent) => {
    if (startY.current === null || refreshing) return;
    const dy = e.touches[0].clientY - startY.current;
    if (dy > 0) {
      const d = Math.min(maxDistance, dy * 0.5);
      setDistance(d);
      setPulling(true);
      // Haptic when crossing threshold
      if (d >= threshold && lastFireDistance.current < threshold) {
        haptics("light");
        lastFireDistance.current = d;
      }
    }
  }, [refreshing, threshold, maxDistance, haptics]);

  const onTouchEnd = useCallback(async () => {
    if (startY.current === null) return;
    const shouldRefresh = distance >= threshold;
    startY.current = null;
    setPulling(false);
    if (shouldRefresh) {
      setRefreshing(true);
      haptics("medium");
      try { await onRefresh(); } finally {
        setRefreshing(false);
        setDistance(0);
      }
    } else {
      setDistance(0);
    }
  }, [distance, threshold, onRefresh, haptics]);

  return {
    pulling, distance, refreshing,
    bind: { onTouchStart, onTouchMove, onTouchEnd },
  };
}

// ─── Swipe actions (left-reveal action chips) ─────────────────────────────
export interface SwipeBinding {
  offset: number;
  open: boolean;
  bind: {
    onTouchStart: (e: React.TouchEvent) => void;
    onTouchMove: (e: React.TouchEvent) => void;
    onTouchEnd: () => void;
  };
  close: () => void;
}

export function useSwipeActions(actionWidth = 128): SwipeBinding {
  const [offset, setOffset] = useState(0);
  const [open, setOpen] = useState(false);
  const startX = useRef<number | null>(null);
  const startOffset = useRef(0);
  const haptics = useHaptics();

  const onTouchStart = useCallback((e: React.TouchEvent) => {
    startX.current = e.touches[0].clientX;
    startOffset.current = offset;
  }, [offset]);

  const onTouchMove = useCallback((e: React.TouchEvent) => {
    if (startX.current === null) return;
    const dx = e.touches[0].clientX - startX.current;
    const next = Math.max(-actionWidth, Math.min(0, startOffset.current + dx));
    setOffset(next);
  }, [actionWidth]);

  const onTouchEnd = useCallback(() => {
    if (startX.current === null) return;
    startX.current = null;
    const shouldOpen = Math.abs(offset) > actionWidth / 2;
    if (shouldOpen !== open) haptics("light");
    setOpen(shouldOpen);
    setOffset(shouldOpen ? -actionWidth : 0);
  }, [offset, open, actionWidth, haptics]);

  const close = useCallback(() => {
    setOpen(false);
    setOffset(0);
  }, []);

  return { offset, open, bind: { onTouchStart, onTouchMove, onTouchEnd }, close };
}

// ─── External link / share-sheet helpers ────────────────────────────────
/**
 * Open an external URL in the OS browser (not in-app webview).
 * Adds `noopener,noreferrer` so the new page can't reach back into our window.
 *
 * Standalone PWAs on Android/iOS hand the URL off to the OS browser via
 * window.open. On desktop, it opens a new tab. Same call site works for both.
 */
export function openExternal(url: string) {
  if (typeof window === "undefined") return;
  window.open(url, "_blank", "noopener,noreferrer");
}

/**
 * Native share sheet via the Web Share API. Falls back to copy-to-clipboard
 * with a callback if not supported. Returns `true` on successful share.
 */
export async function shareSheet(data: ShareData, onFallback?: () => void): Promise<boolean> {
  try {
    if (typeof navigator !== "undefined" && navigator.share) {
      await navigator.share(data);
      return true;
    }
    if (data.url && typeof navigator !== "undefined" && navigator.clipboard) {
      await navigator.clipboard.writeText(data.url);
      onFallback?.();
      return true;
    }
  } catch {
    /* user cancelled or denied */
  }
  return false;
}

// ─── Long-press ───────────────────────────────────────────────────────────
export function useLongPress<T extends HTMLElement>(
  callback: () => void,
  options: { delay?: number } = {}
) {
  const { delay = 500 } = options;
  const timer = useRef<number | null>(null);
  const haptics = useHaptics();

  const clear = useCallback(() => {
    if (timer.current !== null) {
      window.clearTimeout(timer.current);
      timer.current = null;
    }
  }, []);

  const onTouchStart = useCallback((_e: React.TouchEvent<T>) => {
    clear();
    timer.current = window.setTimeout(() => {
      haptics("medium");
      callback();
    }, delay);
  }, [callback, delay, clear, haptics]);

  const onMouseDown = useCallback((_e: React.MouseEvent<T>) => {
    clear();
    timer.current = window.setTimeout(() => callback(), delay);
  }, [callback, delay, clear]);

  useEffect(() => clear, [clear]);

  return {
    onTouchStart,
    onTouchEnd: clear,
    onTouchMove: clear,
    onTouchCancel: clear,
    onMouseDown,
    onMouseUp: clear,
    onMouseLeave: clear,
  };
}
