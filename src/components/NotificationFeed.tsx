// src/components/NotificationFeed.tsx
// ═══════════════════════════════════════════════════════════════════════════════
// Kōda · NotificationFeed
//
// In-app inbox: loads from notification_feed, shows kind-specific icons,
// marks unread items read on mount, polished empty + loading states.
// Mobile-first (320px min), dark+light via theme tokens only.
// ═══════════════════════════════════════════════════════════════════════════════

import { useEffect, useState } from "react";
import { MONO, BODY } from "../shared";
import type { Theme } from "../theme";
import { listNotifications, markNotificationsRead, type FeedNotif } from "../data/notificationFeed";

// ─── Relative-time formatter ─────────────────────────────────────────────────
function relativeTime(iso: string): string {
  const delta = Date.now() - new Date(iso).getTime();
  const s = Math.floor(delta / 1000);
  if (s < 60) return "just now";
  const m = Math.floor(s / 60);
  if (m < 60) return `${m}m`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h`;
  const d = Math.floor(h / 24);
  return `${d}d`;
}

// ─── Kind icons (16×16, 1.5px stroke, consistent weight) ─────────────────────
function KindIcon({ kind, color }: { kind: FeedNotif["kind"]; color: string }) {
  const shared = {
    width: 16, height: 16,
    display: "block" as const,
    flexShrink: 0,
  };
  switch (kind) {
    case "follow":
      // Person + plus icon
      return (
        <svg {...shared} viewBox="0 0 16 16" fill="none" aria-hidden="true">
          <circle cx="6" cy="5" r="2.5" stroke={color} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
          <path d="M1.5 13.5c0-2.5 2-4 4.5-4" stroke={color} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
          <path d="M11.5 9v5M9 11.5h5" stroke={color} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      );
    case "circle_join":
      // Group / three-dots icon
      return (
        <svg {...shared} viewBox="0 0 16 16" fill="none" aria-hidden="true">
          <circle cx="5.5" cy="6" r="2" stroke={color} strokeWidth="1.5" />
          <circle cx="10.5" cy="6" r="2" stroke={color} strokeWidth="1.5" />
          <path d="M1 13.5c0-2 2-3.5 4.5-3.5" stroke={color} strokeWidth="1.5" strokeLinecap="round" />
          <path d="M15 13.5c0-2-2-3.5-4.5-3.5" stroke={color} strokeWidth="1.5" strokeLinecap="round" />
          <path d="M5.5 10c0-2 1-3.5 2.5-3.5s2.5 1.5 2.5 3.5" stroke={color} strokeWidth="1.5" strokeLinecap="round" />
        </svg>
      );
    case "reaction":
      // Heart / reaction bubble
      return (
        <svg {...shared} viewBox="0 0 16 16" fill="none" aria-hidden="true">
          <path d="M8 13.5S1.5 9.5 1.5 5.5a3 3 0 0 1 6-1 3 3 0 0 1 6 1c0 4-6.5 8-6.5 8z"
            stroke={color} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      );
    case "idea_like":
      // Lightbulb icon
      return (
        <svg {...shared} viewBox="0 0 16 16" fill="none" aria-hidden="true">
          <path d="M8 1.5a4.5 4.5 0 0 1 2 8.5H6a4.5 4.5 0 0 1 2-8.5z"
            stroke={color} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
          <path d="M6 10v1.5a2 2 0 0 0 4 0V10" stroke={color} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
          <path d="M6.5 13h3" stroke={color} strokeWidth="1.5" strokeLinecap="round" />
        </svg>
      );
    case "digest":
      // Checklist / lines icon
      return (
        <svg {...shared} viewBox="0 0 16 16" fill="none" aria-hidden="true">
          <rect x="2" y="2" width="12" height="12" rx="2" stroke={color} strokeWidth="1.5" />
          <path d="M5 6h6M5 8.5h4M5 11h3" stroke={color} strokeWidth="1.5" strokeLinecap="round" />
        </svg>
      );
    default:
      return (
        <svg {...shared} viewBox="0 0 16 16" fill="none" aria-hidden="true">
          <circle cx="8" cy="8" r="3" fill={color} />
        </svg>
      );
  }
}

// ─── Skeleton row ─────────────────────────────────────────────────────────────
// Dimensions chosen to match real row height so the layout doesn't jump.
function SkeletonRow({ C }: { C: Theme }) {
  return (
    <div style={{
      padding: 12,
      borderRadius: 12,
      border: `1px solid ${C.border}`,
      background: C.panel,
      minHeight: 56,
      display: "flex",
      alignItems: "center",
      gap: 10,
      animation: "kPulse 1.4s ease-in-out infinite",
    }}>
      {/* Kind icon placeholder */}
      <div style={{ width: 28, height: 28, borderRadius: 8, background: C.border2, flexShrink: 0 }} />
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ height: 11, width: "52%", borderRadius: 4, background: C.border2, marginBottom: 7 }} />
        <div style={{ height: 9, width: "35%", borderRadius: 4, background: C.border }} />
      </div>
      {/* Timestamp placeholder */}
      <div style={{ height: 9, width: 24, borderRadius: 4, background: C.border, flexShrink: 0 }} />
    </div>
  );
}

// ─── Empty state ──────────────────────────────────────────────────────────────
function EmptyState({ C }: { C: Theme }) {
  return (
    <div style={{
      display: "flex", flexDirection: "column", alignItems: "center",
      textAlign: "center", gap: 16, padding: "60px 24px 48px",
    }}>
      {/* Bell icon circle */}
      <div style={{
        width: 64, height: 64, borderRadius: "50%",
        background: C.panel,
        border: `1px solid ${C.border2}`,
        display: "flex", alignItems: "center", justifyContent: "center",
      }}>
        <svg width="26" height="26" viewBox="0 0 24 24" fill="none" aria-hidden="true">
          <path
            d="M10 5a4 4 0 0 1 8 0c0 4.5 2 6 2 6H4s2-1.5 2-6A4 4 0 0 1 10 5zM9 17a3 3 0 0 0 6 0"
            stroke={C.muted} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"
          />
        </svg>
      </div>
      <div>
        <div style={{
          fontFamily: BODY, fontSize: 16, fontWeight: 600,
          color: C.text, letterSpacing: "-0.01em", marginBottom: 8,
        }}>
          No activity yet.
        </div>
        <div style={{
          fontFamily: MONO, fontSize: 11, color: C.muted,
          lineHeight: 1.65, maxWidth: "30ch", margin: "0 auto",
          letterSpacing: "0.02em",
        }}>
          When followers, reactions, or messages come in, they'll show up here.
        </div>
      </div>
    </div>
  );
}

// ─── Single notification row ──────────────────────────────────────────────────
function NotifRow({ notif, C }: { notif: FeedNotif; C: Theme }) {
  const isUnread = notif.read_at === null;
  const title = notif.data.title ?? kindLabel(notif.kind);
  const body  = notif.data.body  ?? null;

  // Subtle accent tint for unread rows — stays within theme, not garish
  const rowBg = isUnread
    ? `color-mix(in oklch, ${C.accent} 8%, ${C.panel})`
    : C.panel;

  return (
    <div style={{
      padding: 12,
      borderRadius: 12,
      border: `1px solid ${C.border}`,
      background: rowBg,
      minHeight: 56,
      display: "flex",
      alignItems: "flex-start",
      gap: 10,
      transition: "background 250ms ease-out",
      position: "relative",
    }}>
      {/* Unread accent dot — top-right corner, fades on read */}
      {isUnread && (
        <span style={{
          position: "absolute",
          top: 10, right: 10,
          width: 6, height: 6,
          borderRadius: "50%",
          background: C.accent,
          transition: "opacity 250ms ease-out",
          flexShrink: 0,
        }} />
      )}

      {/* Kind icon chip */}
      <div style={{
        width: 28, height: 28, borderRadius: 8, flexShrink: 0,
        background: `color-mix(in oklch, ${C.accent} 10%, ${C.panel})`,
        border: `1px solid ${C.border}`,
        display: "flex", alignItems: "center", justifyContent: "center",
        marginTop: 1,
      }}>
        <KindIcon kind={notif.kind} color={C.muted} />
      </div>

      {/* Content */}
      <div style={{ flex: 1, minWidth: 0, paddingRight: isUnread ? 14 : 0 }}>
        <div style={{
          display: "flex", flexWrap: "wrap", alignItems: "baseline",
          gap: "0 6px", lineHeight: 1.4,
        }}>
          <span style={{
            fontFamily: BODY, fontSize: 13, fontWeight: 600,
            color: C.text, wordBreak: "break-word",
          }}>
            {title}
          </span>
          {body && (
            <span style={{
              fontFamily: BODY, fontSize: 13, fontWeight: 400,
              color: C.text2, wordBreak: "break-word",
            }}>
              {body}
            </span>
          )}
        </div>
      </div>

      {/* Relative timestamp */}
      <span style={{
        fontFamily: MONO, fontSize: 10, color: C.muted,
        letterSpacing: "0.06em", flexShrink: 0,
        marginTop: 2, whiteSpace: "nowrap",
      }}>
        {relativeTime(notif.created_at)}
      </span>
    </div>
  );
}

// ─── Kind → human label fallback ─────────────────────────────────────────────
function kindLabel(kind: FeedNotif["kind"]): string {
  switch (kind) {
    case "follow":      return "New follower";
    case "circle_join": return "Circle activity";
    case "reaction":    return "Reaction";
    case "idea_like":   return "Idea liked";
    case "digest":      return "Weekly digest";
  }
}

// ─── Main component ───────────────────────────────────────────────────────────
interface NotificationFeedProps {
  C: Theme;
  onMarkRead?: () => void;
}

export function NotificationFeed({ C, onMarkRead }: NotificationFeedProps) {
  const [notifs, setNotifs] = useState<FeedNotif[] | null>(null); // null = loading
  const [fetchError, setFetchError] = useState(false);

  const load = (alive: { current: boolean }) => {
    (async () => {
      setFetchError(false);
      const { items, error: hasError } = await listNotifications(30);
      if (!alive.current) return;
      if (hasError) {
        setFetchError(true);
        setNotifs([]);
        return;
      }
      setNotifs(items);

      // Mark unread items read — opening this view IS reading them.
      const unreadIds = items
        .filter(n => n.read_at === null)
        .map(n => n.id);
      if (unreadIds.length > 0) {
        await markNotificationsRead(unreadIds);
        // Optimistically flip read_at in local state so the dot fades
        if (alive.current) {
          const now = new Date().toISOString();
          setNotifs(prev =>
            prev
              ? prev.map(n =>
                  unreadIds.includes(n.id) ? { ...n, read_at: now } : n
                )
              : prev
          );
          // Notify parent so the nav badge clears immediately
          onMarkRead?.();
        }
      }
    })();
  };

  useEffect(() => {
    const alive = { current: true };
    load(alive);
    return () => { alive.current = false; };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div style={{ width: "100%", maxWidth: 600, margin: "0 auto" }}>
      {/* Section kicker */}
      <div style={{
        fontFamily: MONO, fontSize: 10, letterSpacing: "0.16em",
        textTransform: "uppercase", color: C.muted,
        padding: "0 0 12px",
      }}>
        Activity
      </div>

      {/* Loading state — 4 skeleton rows */}
      {notifs === null && (
        <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
          <SkeletonRow C={C} />
          <SkeletonRow C={C} />
          <SkeletonRow C={C} />
          <SkeletonRow C={C} />
        </div>
      )}

      {/* Error state */}
      {fetchError && (
        <div style={{ padding: 24, textAlign: "center", color: C.muted, fontFamily: MONO, fontSize: 11 }}>
          <div style={{ marginBottom: 8 }}>Couldn&apos;t load activity.</div>
          <button
            type="button"
            onClick={() => {
              setNotifs(null);
              setFetchError(false);
              const alive = { current: true };
              load(alive);
            }}
            style={{
              fontFamily: MONO, fontSize: 10, letterSpacing: "0.08em",
              color: C.accent, background: "transparent",
              border: `1px solid ${C.accent}`, padding: "6px 12px",
              borderRadius: 999, cursor: "pointer",
            }}
          >
            RETRY
          </button>
        </div>
      )}

      {/* Empty state */}
      {notifs !== null && notifs.length === 0 && !fetchError && (
        <EmptyState C={C} />
      )}

      {/* Feed rows */}
      {notifs !== null && notifs.length > 0 && (
        <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
          {notifs.map(n => (
            <NotifRow key={n.id} notif={n} C={C} />
          ))}
        </div>
      )}
    </div>
  );
}
