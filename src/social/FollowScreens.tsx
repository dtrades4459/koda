import { useState } from "react";
import type React from "react";
import type { Theme } from "../theme";
import { MONO, BODY, DISPLAY, Card, AvatarCircle, KodaMark } from "../shared";
import { SettingsSub, SectionLabel } from "../settings/SettingsScreens";

// ═══════════════════════════════════════════════════════════════════════════
// Follow graph screens (cat05)
//
// Components:
//   • FollowButton — all 4 states (none/following/pending/blocked)
//   • UnfollowConfirmModal
//   • FollowersScreen — with follow-back banner
//   • DiscoverTradersScreen — mutuals + suggested
//   • ProfileQRScreen — full-bleed share view
// ═══════════════════════════════════════════════════════════════════════════

export type FollowState = "none" | "following" | "pending" | "blocked";

export function FollowButton({
  C, state, onClick, size = "sm",
}: {
  C: Theme; state: FollowState; onClick?: () => void;
  size?: "sm" | "md";
}) {
  const pad = size === "sm" ? "8px 14px" : "10px 18px";
  const fs = size === "sm" ? 12 : 13;
  const config: Record<FollowState, { label: string; bg: string; fg: string; border?: string }> = {
    none: { label: "Follow", bg: C.live, fg: "#0A0A0A" },
    following: { label: "Following ✓", bg: "transparent", fg: C.text, border: C.border2 },
    pending: { label: "Requested", bg: "transparent", fg: C.text, border: C.border2 },
    blocked: { label: "Blocked", bg: "transparent", fg: C.red, border: `color-mix(in oklch, ${C.red} 30%, transparent)` },
  };
  const c = config[state];
  return (
    <button
      onClick={onClick}
      style={{
        padding: pad, borderRadius: 999,
        background: c.bg, color: c.fg,
        border: c.border ? `1px solid ${c.border}` : "none",
        fontFamily: BODY, fontSize: fs, fontWeight: 600,
        cursor: "pointer", whiteSpace: "nowrap",
      }}
    >
      {c.label}
    </button>
  );
}

// ═══════════════════════════════════════════════════════════════════════════
// Unfollow confirm modal
// ═══════════════════════════════════════════════════════════════════════════

export function UnfollowConfirmModal({
  C, handle, displayName, onCancel, onUnfollow,
}: {
  C: Theme; handle: string; displayName?: string;
  onCancel?: () => void; onUnfollow?: () => void;
}) {
  return (
    <div
      role="dialog"
      aria-modal="true"
      onClick={onCancel}
      style={{
        position: "fixed", inset: 0, zIndex: 9000,
        background: "rgba(10,10,11,0.72)", backdropFilter: "blur(6px)",
        WebkitBackdropFilter: "blur(6px)",
        display: "flex", alignItems: "center", justifyContent: "center", padding: 22,
        animation: "kFadeIn 0.22s ease-out",
      }}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          width: "100%", maxWidth: 360, borderRadius: 24,
          background: C.panel, border: `1px solid ${C.border2}`,
          padding: 24, textAlign: "center",
          animation: "kRise 0.32s cubic-bezier(.2,.8,.2,1)",
        }}
      >
        <div style={{ display: "flex", justifyContent: "center" }}>
          <AvatarCircle name={displayName || handle} size={56} C={C} />
        </div>
        <div style={{ fontFamily: DISPLAY, fontSize: 19, fontWeight: 600, color: C.text, marginTop: 16 }}>
          Unfollow @{handle}?
        </div>
        <div style={{ fontSize: 13, color: C.text2, marginTop: 10, lineHeight: 1.5, fontFamily: BODY }}>
          Their trades will stop showing in your feed.
        </div>
        <div style={{ display: "flex", gap: 10, marginTop: 22 }}>
          <button
            onClick={onCancel}
            style={{
              flex: 1, padding: "13px 20px", borderRadius: 999,
              background: "transparent", color: C.text, border: `1px solid ${C.border2}`,
              fontFamily: BODY, fontSize: 14, fontWeight: 600, cursor: "pointer",
            }}
          >
            Cancel
          </button>
          <button
            onClick={onUnfollow}
            style={{
              flex: 1, padding: "13px 20px", borderRadius: 999,
              background: C.text, color: C.bg, border: "none",
              fontFamily: BODY, fontSize: 14, fontWeight: 600, cursor: "pointer",
            }}
          >
            Unfollow
          </button>
        </div>
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════
// Followers screen (with follow-back banner)
// ═══════════════════════════════════════════════════════════════════════════

export interface FollowerRow {
  handle: string; displayName?: string;
  mutuals?: number; followsYou?: boolean;
  state: FollowState; avatar?: string;
  isNew?: boolean;
}

export function FollowersScreen({
  C, latest, recent, onFollow, onBack,
}: {
  C: Theme;
  latest?: FollowerRow;
  recent: FollowerRow[];
  onFollow?: (handle: string) => void;
  onBack?: () => void;
}) {
  return (
    <SettingsSub C={C} title="Followers" onBack={onBack}>
      {latest && (
        <div style={{
          padding: "14px 16px", borderRadius: 14,
          background: C.liveSoft,
          border: `1px solid color-mix(in oklch, ${C.live} 30%, transparent)`,
          display: "flex", alignItems: "center", gap: 12, marginBottom: 16,
          animation: "kRise 0.4s ease-out",
        }}>
          <AvatarCircle name={latest.displayName || latest.handle} avatar={latest.avatar} size={40} C={C} />
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontSize: 13.5, color: C.text, fontFamily: BODY }}>
              <b>@{latest.handle}</b> started following you
            </div>
            <div style={{ fontSize: 11.5, color: C.text2, marginTop: 2, fontFamily: BODY }}>
              {latest.mutuals ? `${latest.mutuals} mutual${latest.mutuals === 1 ? "" : "s"}` : "First follower"}
              {latest.followsYou && " · follows you"}
            </div>
          </div>
          <FollowButton C={C} state={latest.state} onClick={() => onFollow?.(latest.handle)} />
        </div>
      )}
      <SectionLabel C={C}>Recent followers</SectionLabel>
      <Card C={C} pad={0}>
        {recent.map((f, i) => (
          <div
            key={f.handle}
            style={{
              display: "flex", alignItems: "center", gap: 12,
              padding: "13px 16px", borderTop: i ? `1px solid ${C.line}` : "none",
            }}
          >
            <AvatarCircle name={f.displayName || f.handle} avatar={f.avatar} size={34} C={C} />
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontSize: 13.5, color: C.text, fontFamily: BODY }}>@{f.handle}</div>
              <div style={{ fontFamily: MONO, fontSize: 9.5, color: C.muted, marginTop: 2, textTransform: "uppercase" }}>
                {f.mutuals ? `${f.mutuals} MUTUAL` : f.followsYou ? "FOLLOWS YOU" : "NEW FOLLOWER"}
              </div>
            </div>
            <FollowButton C={C} state={f.state} onClick={() => onFollow?.(f.handle)} />
          </div>
        ))}
      </Card>
    </SettingsSub>
  );
}

// ═══════════════════════════════════════════════════════════════════════════
// Discover screen — mutuals + suggested
// ═══════════════════════════════════════════════════════════════════════════

export interface SuggestedTrader {
  handle: string; displayName?: string;
  mutualCount: number; avatar?: string;
}
export interface TopInCircleTrader {
  handle: string; displayName?: string; via: string;
  state: FollowState; avatar?: string;
}

export function DiscoverTradersScreen({
  C, peopleYouMayKnow, topInCircles, onFollow, onBack,
}: {
  C: Theme;
  peopleYouMayKnow: SuggestedTrader[];
  topInCircles: TopInCircleTrader[];
  onFollow?: (handle: string) => void;
  onBack?: () => void;
}) {
  return (
    <SettingsSub C={C} title="Discover traders" onBack={onBack}>
      <SectionLabel C={C}>People you may know</SectionLabel>
      <div style={{
        display: "flex", gap: 10, overflowX: "auto", paddingBottom: 4,
        scrollbarWidth: "none", msOverflowStyle: "none",
      }}>
        <style>{`
          .koda-suggest-scroll::-webkit-scrollbar { display: none; }
        `}</style>
        {peopleYouMayKnow.map(p => (
          <Card C={C} pad={16} key={p.handle} style={{ width: 150, flexShrink: 0, textAlign: "center" }}>
            <div style={{ display: "flex", justifyContent: "center" }}>
              <AvatarCircle name={p.displayName || p.handle} avatar={p.avatar} size={52} C={C} />
            </div>
            <div style={{ fontSize: 14, fontWeight: 600, color: C.text, marginTop: 10, fontFamily: BODY }}>
              @{p.handle}
            </div>
            <div style={{ display: "flex", justifyContent: "center", margin: "8px 0 12px", alignItems: "center" }}>
              <div style={{ display: "flex" }}>
                {[0, 1, 2].map(j => (
                  <div
                    key={j}
                    style={{
                      width: 18, height: 18, borderRadius: 999,
                      background: `linear-gradient(135deg, ${C.orb1}, ${C.orb2})`,
                      border: `1.5px solid ${C.surface}`, marginLeft: j ? -6 : 0,
                    }}
                  />
                ))}
              </div>
              <span style={{
                fontFamily: MONO, fontSize: 9.5, color: C.muted,
                marginLeft: 6, alignSelf: "center",
              }}>
                {p.mutualCount} MUTUAL
              </span>
            </div>
            <button
              onClick={() => onFollow?.(p.handle)}
              style={{
                width: "100%", padding: "8px 14px", borderRadius: 999,
                background: C.live, color: "#0A0A0A", border: "none",
                fontFamily: BODY, fontSize: 12, fontWeight: 600, cursor: "pointer",
              }}
            >
              Follow
            </button>
          </Card>
        ))}
      </div>
      <SectionLabel C={C}>Top in your circles</SectionLabel>
      <Card C={C} pad={0}>
        {topInCircles.map((t, i) => (
          <div
            key={t.handle}
            style={{
              display: "flex", alignItems: "center", gap: 12,
              padding: "13px 16px", borderTop: i ? `1px solid ${C.line}` : "none",
            }}
          >
            <AvatarCircle name={t.displayName || t.handle} avatar={t.avatar} size={34} C={C} />
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontSize: 13.5, color: C.text, fontFamily: BODY }}>@{t.handle}</div>
              <div style={{ fontFamily: MONO, fontSize: 9.5, color: C.muted, marginTop: 2, textTransform: "uppercase" }}>
                VIA {t.via}
              </div>
            </div>
            <FollowButton C={C} state={t.state} onClick={() => onFollow?.(t.handle)} />
          </div>
        ))}
      </Card>
    </SettingsSub>
  );
}

// ═══════════════════════════════════════════════════════════════════════════
// Profile QR share
// ═══════════════════════════════════════════════════════════════════════════

export function ProfileQRScreen({
  C, handle, displayName, focus, qrSvg, onShare, onSaveImage, onBack,
}: {
  C: Theme;
  handle: string; displayName?: string; focus?: string;
  qrSvg?: React.ReactNode;
  onShare?: () => void; onSaveImage?: () => void; onBack?: () => void;
}) {
  return (
    <div style={{
      minHeight: "100dvh", background: C.bg, color: C.text,
      position: "relative", overflow: "hidden",
    }}>
      <div style={{
        position: "absolute", inset: 0,
        background: `radial-gradient(120% 70% at 50% 20%, color-mix(in oklch, ${C.orb1} 18%, transparent), ${C.bg} 70%)`,
      }} />
      <div style={{
        position: "relative", zIndex: 2, minHeight: "100dvh",
        display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center",
        padding: "72px 30px 40px", boxSizing: "border-box",
      }}>
        <button
          onClick={onBack}
          aria-label="Back"
          style={{
            position: "absolute", top: "max(20px, env(safe-area-inset-top))", left: 22,
            width: 36, height: 36, borderRadius: 999,
            background: C.surface, border: `1px solid ${C.border2}`,
            display: "flex", alignItems: "center", justifyContent: "center",
            cursor: "pointer", padding: 0,
          }}
        >
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none">
            <path d="M14 6l-6 6 6 6" stroke={C.text} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </button>
        <AvatarCircle name={displayName || handle} size={64} C={C} />
        <div style={{ fontFamily: DISPLAY, fontSize: 20, fontWeight: 600, color: C.text, marginTop: 14 }}>
          @{handle}
        </div>
        {focus && (
          <div style={{ fontFamily: MONO, fontSize: 10, letterSpacing: "0.1em", color: C.muted, marginTop: 4, textTransform: "uppercase" }}>
            {focus}
          </div>
        )}
        <div style={{
          width: 220, height: 220, borderRadius: 24,
          background: "#fff", padding: 18, boxSizing: "border-box",
          margin: "26px 0", display: "flex", alignItems: "center", justifyContent: "center",
        }}>
          {qrSvg ?? (
            <div style={{
              width: "100%", height: "100%", borderRadius: 4,
              display: "flex", alignItems: "center", justifyContent: "center",
              position: "relative",
              backgroundImage: "repeating-linear-gradient(0deg,#000 0 7px,#fff 7px 14px),repeating-linear-gradient(90deg,#000 0 7px,transparent 7px 14px)",
              backgroundBlendMode: "multiply",
            }}>
              <div style={{
                position: "absolute", inset: "40% 40%", background: "#fff",
                display: "flex", alignItems: "center", justifyContent: "center",
              }}>
                <KodaMark size={22} color="#000" />
              </div>
            </div>
          )}
        </div>
        <div style={{ fontSize: 13, color: C.text2, textAlign: "center", fontFamily: BODY }}>
          Scan to follow me on Kōda
        </div>
        <div style={{ display: "flex", gap: 10, marginTop: 22, width: "100%", maxWidth: 360 }}>
          <button
            onClick={onShare}
            style={{
              flex: 1, padding: "13px 20px", borderRadius: 999,
              background: C.live, color: "#0A0A0A", border: "none",
              fontFamily: BODY, fontSize: 14, fontWeight: 600, cursor: "pointer",
            }}
          >
            Share
          </button>
          <button
            onClick={onSaveImage}
            style={{
              flex: 1, padding: "13px 20px", borderRadius: 999,
              background: "transparent", color: C.text, border: `1px solid ${C.border2}`,
              fontFamily: BODY, fontSize: 14, fontWeight: 600, cursor: "pointer",
            }}
          >
            Save image
          </button>
        </div>
      </div>
    </div>
  );
}

// Re-export helper so consumers using setState pattern can hold state
export const useFollowState = () => useState<FollowState>("none");
