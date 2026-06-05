// ═══════════════════════════════════════════════════════════════════════════════
// Kōda · NotificationsDrawer
//
// Bell-anchored notifications panel. Opens on bell button tap; closes on
// outside click or Escape. Renders a list of notification cards aggregated
// from app state.
//
// v1 sources: draft trades waiting in the Review Inbox.
// Future sources (architected for, not yet wired): new followers, circle
// activity, challenge completions.
// ═══════════════════════════════════════════════════════════════════════════════

import { useEffect, useRef, useState } from "react";
import type { Theme } from "./theme";
import type { Circle } from "./types";
import { MONO, BODY, DISPLAY, Kicker } from "./shared";
import {
  PermissionPrimerSheet, PermissionBlockedScreen, NotificationInbox,
} from "./notifications/NotificationScreens";
import type { InboxRow } from "./notifications/NotificationScreens";
import { listNotifications, markNotificationsRead } from "./data/notificationFeed";

interface Props {
  open: boolean;
  onClose: () => void;
  draftCount: number;
  onOpenInbox: () => void;
  unreadMsgs: Record<string, number>;
  circles: Circle[];
  onOpenCircles: () => void;
  C: Theme;
}

const PROFILE_FIX_KEY = "koda_notif_profile_fix_v1";

function relativeTime(iso: string): string {
  const delta = Date.now() - new Date(iso).getTime();
  const s = Math.floor(delta / 1000);
  if (s < 60) return "just now";
  const m = Math.floor(s / 60);
  if (m < 60) return `${m}m`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h`;
  return `${Math.floor(h / 24)}d`;
}

export default function NotificationsDrawer({ open, onClose, draftCount, onOpenInbox, unreadMsgs, circles, onOpenCircles, C }: Props) {
  const ref = useRef<HTMLDivElement | null>(null);
  const [profileFixDismissed, setProfileFixDismissed] = useState(() => {
    try { return localStorage.getItem(PROFILE_FIX_KEY) === "1"; } catch { return false; }
  });
  const [pushState, setPushState] = useState<"default" | "granted" | "denied">("default");
  const [showPrimer, setShowPrimer] = useState(false);
  const [showInbox, setShowInbox] = useState(false);
  const [inboxRows, setInboxRows] = useState<InboxRow[]>([]);

  useEffect(() => {
    if (typeof Notification !== "undefined") {
      setPushState(Notification.permission);
    }
  }, [open]);

  useEffect(() => {
    if (!open) return;
    listNotifications(40).then(({ items }) => {
      setInboxRows(items.map(n => ({
        id: n.id,
        kind: n.kind,
        body: (n.data.body as string | undefined) ?? (n.data.title as string | undefined) ?? n.kind,
        timestamp: relativeTime(n.created_at),
        unread: n.read_at === null,
      })));
    });
  }, [open]);

  function dismissProfileFix() {
    try { localStorage.setItem(PROFILE_FIX_KEY, "1"); } catch {}
    setProfileFixDismissed(true);
  }

  function requestPush() {
    setShowPrimer(false);
    if (typeof Notification === "undefined") return;
    void Notification.requestPermission().then(perm => {
      setPushState(perm);
    });
  }

  useEffect(() => {
    if (!open) return;
    function onDoc(e: PointerEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) onClose();
    }
    function onEsc(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
    }
    // Defer attaching the outside-click listener by one tick so the very tap
    // that opened the drawer doesn't immediately close it again on mobile,
    // where pointerdown on the trigger fires before this effect runs.
    const t = setTimeout(() => {
      document.addEventListener("pointerdown", onDoc);
    }, 0);
    document.addEventListener("keydown", onEsc);
    return () => {
      clearTimeout(t);
      document.removeEventListener("pointerdown", onDoc);
      document.removeEventListener("keydown", onEsc);
    };
  }, [open, onClose]);

  if (!open) return null;

  const unreadCircles = circles.filter(c => (unreadMsgs[c.code] || 0) > 0);
  const total = draftCount + unreadCircles.length + (profileFixDismissed ? 0 : 1);

  return (
    <div
      ref={ref}
      role="dialog"
      aria-label="Notifications"
      style={{
        position: "fixed",
        top: "calc(64px + env(safe-area-inset-top))",
        right: "clamp(12px, 4vw, 48px)",
        width: 340,
        maxWidth: "calc(100vw - 24px)",
        maxHeight: "calc(100dvh - 100px)",
        overflowY: "auto",
        background: C.panel,
        border: `1px solid ${C.border}`,
        borderRadius: 18,
        boxShadow: `0 24px 56px ${C.shadow}`,
        zIndex: 101,
        padding: 16,
        animation: "rise 0.18s ease",
      }}
    >
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 14 }}>
        <Kicker C={C}>Notifications</Kicker>
        <button
          onClick={onClose}
          aria-label="Close"
          style={{
            background: "transparent",
            border: "none",
            color: C.muted,
            cursor: "pointer",
            fontSize: 18,
            lineHeight: 1,
            padding: 4,
          }}
        >
          ×
        </button>
      </div>

      {total === 0 ? (
        <div style={{ textAlign: "center", padding: "28px 12px" }}>
          <div style={{ fontFamily: BODY, fontSize: 13, color: C.text, lineHeight: 1.5, marginBottom: 6 }}>
            You're all caught up.
          </div>
          <div style={{ fontFamily: MONO, fontSize: 10, color: C.muted, letterSpacing: "0.06em", lineHeight: 1.5 }}>
            New broker syncs, follows, and circle activity will appear here.
          </div>
          {pushState === "default" && (
            <button
              onClick={() => setShowPrimer(true)}
              style={{
                marginTop: 14, padding: "8px 16px", borderRadius: 999,
                border: `1px solid ${C.border2}`, background: "transparent",
                color: C.live, fontFamily: MONO, fontSize: 10,
                letterSpacing: "0.1em", textTransform: "uppercase", cursor: "pointer",
              }}>
              Turn on push →
            </button>
          )}
        </div>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
          {!profileFixDismissed && (
            <div style={{
              padding: 14, borderRadius: 14,
              background: `color-mix(in oklch, ${C.accent ?? "#60a5fa"} 8%, ${C.panel})`,
              border: `1px solid color-mix(in oklch, ${C.accent ?? "#60a5fa"} 25%, transparent)`,
            }}>
              <div style={{ fontFamily: MONO, fontSize: 9, color: C.accent ?? "#60a5fa", letterSpacing: "0.14em", fontWeight: 700, textTransform: "uppercase", marginBottom: 5 }}>
                Kōda Team
              </div>
              <div style={{ fontFamily: BODY, fontSize: 13, color: C.text, lineHeight: 1.55, marginBottom: 10 }}>
                We've fixed the issue where some user details didn't automatically save — this is now sorted for all new users. If you're an existing user, just head to your profile tab to update your details such as your name and handle. Thanks, Kōda Team
              </div>
              <button onClick={dismissProfileFix} style={{
                background: C.accent ?? "#60a5fa", color: "#0A0A0A", border: "none",
                borderRadius: 999, padding: "7px 14px", fontFamily: MONO, fontSize: 10,
                letterSpacing: "0.12em", textTransform: "uppercase", fontWeight: 700, cursor: "pointer",
              }}>
                Got it
              </button>
            </div>
          )}
          {unreadCircles.map(circle => {
            const count = unreadMsgs[circle.code] || 0;
            return (
              <NotificationCard
                key={circle.code}
                C={C}
                accent={C.accent ?? "#60a5fa"}
                kicker={`${circle.emoji ?? "◆"} ${circle.name}`}
                title={`${count} new message${count !== 1 ? "s" : ""}`}
                body="New activity in your circle."
                ctaLabel="View →"
                onCta={onOpenCircles}
              />
            );
          })}
          {draftCount > 0 && (
            <NotificationCard
              C={C}
              accent={C.green ?? "#22c55e"}
              kicker="Review Inbox"
              title={`${draftCount} trade${draftCount !== 1 ? "s" : ""} ready to review`}
              body="Auto-synced from your broker. Publish them to your journal."
              ctaLabel="Review →"
              onCta={() => {
                onClose();
                onOpenInbox();
              }}
            />
          )}
          {pushState === "default" && (
            <NotificationCard
              C={C}
              accent={C.live}
              kicker="Push notifications"
              title="Never miss a tilt moment"
              body="Get nudged when you're over-trading, sync finishes, or your weekly recap lands."
              ctaLabel="Turn on →"
              onCta={() => setShowPrimer(true)}
            />
          )}
        </div>
      )}
      {inboxRows.length > 0 && (
        <button
          onClick={() => setShowInbox(true)}
          style={{
            display: "block", width: "100%", marginTop: 12,
            padding: "10px 0", borderRadius: 10,
            border: `1px solid ${C.border}`, background: "transparent",
            color: C.muted, fontFamily: MONO, fontSize: 10,
            letterSpacing: "0.08em", textTransform: "uppercase", cursor: "pointer",
          }}>
          View all activity
        </button>
      )}
      {showPrimer && (
        <PermissionPrimerSheet
          C={C}
          onTurnOn={requestPush}
          onLater={() => setShowPrimer(false)}
        />
      )}
      {showInbox && (
        <div style={{ position: "fixed", inset: 0, zIndex: 9200, background: C.bg, overflowY: "auto" }}>
          <NotificationInbox
            C={C}
            rows={inboxRows}
            onMarkAllRead={() => {
              const unreadIds = inboxRows.filter(r => r.unread).map(r => r.id);
              void markNotificationsRead(unreadIds).then(() => {
                setInboxRows(prev => prev.map(r => ({ ...r, unread: false })));
              });
            }}
            onRow={_id => { /* navigate to relevant screen — future */ }}
            title="Activity"
          />
          <button
            onClick={() => setShowInbox(false)}
            style={{
              position: "fixed", top: "max(18px, env(safe-area-inset-top))", left: 18,
              width: 36, height: 36, borderRadius: 999,
              background: C.surface, border: `1px solid ${C.border2}`,
              display: "flex", alignItems: "center", justifyContent: "center",
              cursor: "pointer", zIndex: 9201,
            }}>
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none">
              <path d="M14 6l-6 6 6 6" stroke={C.text} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </button>
        </div>
      )}
      {pushState === "denied" && showPrimer && (
        <div style={{ position: "fixed", inset: 0, zIndex: 9200, background: C.bg, overflowY: "auto" }}>
          <PermissionBlockedScreen
            C={C}
            browser="Chrome"
            onReload={() => { window.location.reload(); }}
            onBack={() => setShowPrimer(false)}
          />
        </div>
      )}
    </div>
  );
}

function NotificationCard({
  C, accent, kicker, title, body, ctaLabel, onCta,
}: {
  C: Theme;
  accent: string;
  kicker: string;
  title: string;
  body: string;
  ctaLabel: string;
  onCta: () => void;
}) {
  return (
    <div
      style={{
        padding: 14,
        borderRadius: 14,
        background: `color-mix(in oklch, ${accent} 8%, ${C.panel})`,
        border: `1px solid color-mix(in oklch, ${accent} 25%, transparent)`,
      }}
    >
      <div
        style={{
          fontFamily: MONO,
          fontSize: 9,
          color: accent,
          letterSpacing: "0.14em",
          fontWeight: 700,
          textTransform: "uppercase",
          marginBottom: 5,
        }}
      >
        {kicker}
      </div>
      <div
        style={{
          fontFamily: DISPLAY,
          fontSize: 15,
          color: C.text,
          fontWeight: 500,
          marginBottom: 4,
          letterSpacing: "-0.01em",
        }}
      >
        {title}
      </div>
      <div
        style={{
          fontFamily: BODY,
          fontSize: 12,
          color: C.text2 ?? C.muted,
          lineHeight: 1.45,
          marginBottom: 10,
        }}
      >
        {body}
      </div>
      <button
        onClick={onCta}
        style={{
          background: accent,
          color: "#0A0A0A",
          border: "none",
          borderRadius: 999,
          padding: "7px 14px",
          fontFamily: MONO,
          fontSize: 10,
          letterSpacing: "0.12em",
          textTransform: "uppercase",
          fontWeight: 700,
          cursor: "pointer",
        }}
      >
        {ctaLabel}
      </button>
    </div>
  );
}
