import { useEffect, useState } from "react";
import type React from "react";
import type { Theme } from "../theme";
import { MONO, BODY, DISPLAY, GlassOrb, GhostWord, Kicker, KodaMark } from "../shared";

// ═══════════════════════════════════════════════════════════════════════════
// SystemBanners — global connectivity / lifecycle UI (cat07)
//
// Includes:
//   • OfflineBanner / ReconnectedBanner (top sticky)
//   • SlowConnectionBanner (top sticky)
//   • OptimisticRollbackToast (bottom toast)
//   • SessionExpiredModal (centered modal)
//   • SWUpdateBanner (bottom CTA banner)
//   • RateLimitedModal (centered modal)
//   • VersionMismatchBanner (top accent banner)
//   • Error pages (401 / 403 / 500 / 503) — full-screen layouts
// ═══════════════════════════════════════════════════════════════════════════

// ─── Inline icon helpers ────────────────────────────────────────────────────
function IconWifi({ c, s = 20 }: { c: string; s?: number }) {
  return (
    <svg width={s} height={s} viewBox="0 0 24 24" fill="none">
      <path d="M1 9a14 14 0 0 1 22 0M5 13a8 8 0 0 1 14 0M9 17a3 3 0 0 1 6 0" stroke={c} strokeWidth="1.6" strokeLinecap="round" />
      <path d="M2 2l20 20" stroke={c} strokeWidth="1.6" strokeLinecap="round" />
    </svg>
  );
}
function IconCheck({ c, s = 14, sw = 2 }: { c: string; s?: number; sw?: number }) {
  return (
    <svg width={s} height={s} viewBox="0 0 24 24" fill="none">
      <path d="M5 12l5 5L19 8" stroke={c} strokeWidth={sw} strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}
function IconLock({ c, s = 24 }: { c: string; s?: number }) {
  return (
    <svg width={s} height={s} viewBox="0 0 24 24" fill="none">
      <rect x="5" y="11" width="14" height="10" rx="2" stroke={c} strokeWidth="1.6" />
      <path d="M8 11V8a4 4 0 0 1 8 0v3" stroke={c} strokeWidth="1.6" />
    </svg>
  );
}
function IconDownload({ c, s = 18 }: { c: string; s?: number }) {
  return (
    <svg width={s} height={s} viewBox="0 0 24 24" fill="none">
      <path d="M12 3v12M8 11l4 4 4-4M4 17v2a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-2" stroke={c} strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}
function IconClock({ c, s = 24 }: { c: string; s?: number }) {
  return (
    <svg width={s} height={s} viewBox="0 0 24 24" fill="none">
      <circle cx="12" cy="12" r="9" stroke={c} strokeWidth="1.6" />
      <path d="M12 7v5l3 2" stroke={c} strokeWidth="1.6" strokeLinecap="round" />
    </svg>
  );
}
function IconRefresh({ c, s = 18 }: { c: string; s?: number }) {
  return (
    <svg width={s} height={s} viewBox="0 0 24 24" fill="none">
      <path d="M3 12a9 9 0 0 1 15-6.7L21 8M21 3v5h-5M21 12a9 9 0 0 1-15 6.7L3 16M3 21v-5h5" stroke={c} strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

// ═══════════════════════════════════════════════════════════════════════════
// Generic top banner (offline / reconnected / version)
// ═══════════════════════════════════════════════════════════════════════════

function TopBanner({
  C, icon, title, body, tone = "warn", action,
}: {
  C: Theme;
  icon: React.ReactNode;
  title: string;
  body?: string;
  tone?: "warn" | "live" | "accent" | "neutral";
  action?: React.ReactNode;
}) {
  const borderTone =
    tone === "live" ? `color-mix(in oklch, ${C.live} 30%, transparent)` :
    tone === "accent" ? `color-mix(in oklch, ${C.accent} 35%, transparent)` :
    C.border2;
  return (
    <div
      role="status"
      aria-live="polite"
      style={{
        position: "fixed", top: "max(14px, env(safe-area-inset-top))", left: 14, right: 14,
        maxWidth: 600, margin: "0 auto",
        zIndex: 1200,
        display: "flex", alignItems: "center", gap: 11,
        padding: "12px 16px", borderRadius: 14,
        background: C.surfaceGlass, backdropFilter: "blur(22px) saturate(160%)",
        WebkitBackdropFilter: "blur(22px) saturate(160%)",
        border: `1px solid ${borderTone}`,
        boxShadow: "0 12px 30px rgba(0,0,0,0.3)",
        animation: "kSlideIn 0.38s cubic-bezier(.2,.8,.2,1)",
      }}
    >
      {icon}
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontSize: "0.84375rem", fontWeight: 600, color: C.text, fontFamily: BODY }}>
          {title}
        </div>
        {body && (
          <div style={{ fontSize: "0.71875rem", color: C.text2, marginTop: 2, fontFamily: BODY, lineHeight: 1.4 }}>
            {body}
          </div>
        )}
      </div>
      {action}
    </div>
  );
}

// ─── OfflineBanner ──────────────────────────────────────────────────────────
export function OfflineBanner({ C }: { C: Theme }) {
  const [online, setOnline] = useState(typeof navigator !== "undefined" ? navigator.onLine : true);
  useEffect(() => {
    const on = () => setOnline(true);
    const off = () => setOnline(false);
    window.addEventListener("online", on);
    window.addEventListener("offline", off);
    return () => {
      window.removeEventListener("online", on);
      window.removeEventListener("offline", off);
    };
  }, []);
  if (online) return null;
  return (
    <TopBanner
      C={C}
      icon={<IconWifi c={C.warn} s={20} />}
      title="You're offline"
      body="Showing your last synced data. Changes save locally."
      tone="warn"
    />
  );
}

// ─── ReconnectedBanner ──────────────────────────────────────────────────────
export function ReconnectedBanner({ C, syncedCount = 0, onDismiss }: {
  C: Theme; syncedCount?: number; onDismiss?: () => void;
}) {
  useEffect(() => {
    if (!onDismiss) return;
    const t = setTimeout(onDismiss, 3000);
    return () => clearTimeout(t);
  }, [onDismiss]);
  return (
    <TopBanner
      C={C}
      tone="live"
      icon={
        <div style={{
          width: 22, height: 22, borderRadius: 999,
          background: C.greenSoft, display: "flex", alignItems: "center", justifyContent: "center",
        }}>
          <IconCheck c={C.green} s={14} sw={2} />
        </div>
      }
      title="Back online"
      body={syncedCount > 0 ? `Synced ${syncedCount} trade${syncedCount === 1 ? "" : "s"} logged offline.` : "All synced."}
    />
  );
}

// ─── SlowConnectionBanner ───────────────────────────────────────────────────
export function SlowConnectionBanner({ C }: { C: Theme }) {
  return (
    <TopBanner
      C={C}
      icon={
        <div style={{
          width: 20, height: 20, border: `2px solid ${C.border2}`,
          borderTopColor: C.warn, borderRadius: 999,
          animation: "kSpin 0.9s linear infinite",
        }} />
      }
      title="Slow connection"
      body="Still loading — hang tight."
    />
  );
}

// ─── VersionMismatchBanner ──────────────────────────────────────────────────
export function VersionMismatchBanner({ C, onReload }: { C: Theme; onReload?: () => void }) {
  return (
    <div
      role="status"
      style={{
        position: "fixed", top: "max(14px, env(safe-area-inset-top))", left: 14, right: 14,
        maxWidth: 600, margin: "0 auto", zIndex: 1200,
        display: "flex", alignItems: "center", gap: 11,
        padding: "12px 16px", borderRadius: 14,
        background: C.accentSoft, border: `1px solid color-mix(in oklch, ${C.accent} 35%, transparent)`,
        animation: "kSlideIn 0.38s cubic-bezier(.2,.8,.2,1)",
      }}
    >
      <IconRefresh c={C.accent} s={18} />
      <div style={{ flex: 1, fontSize: "0.78125rem", color: C.text, fontFamily: BODY }}>
        Kōda was updated.{" "}
        <span onClick={onReload} style={{ fontWeight: 600, cursor: "pointer", textDecoration: "underline", textDecorationColor: C.accent }}>
          Reload
        </span>{" "}
        to avoid errors.
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════
// Bottom banners — SW update, optimistic rollback
// ═══════════════════════════════════════════════════════════════════════════

export function SWUpdateBanner({ C, onReload, onDismiss }: {
  C: Theme; onReload?: () => void; onDismiss?: () => void;
}) {
  return (
    <div
      role="status"
      style={{
        position: "fixed", left: 14, right: 14,
        bottom: "calc(28px + env(safe-area-inset-bottom))",
        maxWidth: 600, margin: "0 auto", zIndex: 1200,
        display: "flex", alignItems: "center", gap: 12,
        padding: "14px 16px", borderRadius: 16,
        background: C.surfaceGlass, backdropFilter: "blur(22px) saturate(160%)",
        WebkitBackdropFilter: "blur(22px) saturate(160%)",
        border: `1px solid ${C.border2}`,
        boxShadow: "0 16px 40px rgba(0,0,0,0.35)",
        animation: "kSlideIn 0.38s cubic-bezier(.2,.8,.2,1)",
      }}
    >
      <div style={{
        width: 34, height: 34, borderRadius: 9, background: C.liveSoft,
        display: "flex", alignItems: "center", justifyContent: "center",
      }}>
        <IconDownload c={C.live} s={18} />
      </div>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontSize: "0.84375rem", fontWeight: 600, color: C.text, fontFamily: BODY }}>
          Update ready
        </div>
        <div style={{ fontSize: "0.71875rem", color: C.text2, marginTop: 2, fontFamily: BODY }}>
          A new version of Kōda is available.
        </div>
      </div>
      {onDismiss && (
        <button
          onClick={onDismiss}
          style={{
            background: "transparent", border: "none", color: C.muted,
            fontFamily: MONO, fontSize: "0.625rem", letterSpacing: "0.08em", cursor: "pointer",
            padding: "8px 10px",
          }}
        >
          LATER
        </button>
      )}
      <button
        onClick={onReload}
        style={{
          background: C.live, color: "#0A0A0A", border: "none",
          borderRadius: 999, padding: "8px 18px",
          fontFamily: BODY, fontSize: "0.8125rem", fontWeight: 600, cursor: "pointer",
        }}
      >
        Reload
      </button>
    </div>
  );
}

export function OptimisticRollbackToast({ C, message, onRetry, onDismiss }: {
  C: Theme; message: string; onRetry?: () => void; onDismiss?: () => void;
}) {
  useEffect(() => {
    if (!onDismiss) return;
    const t = setTimeout(onDismiss, 5000);
    return () => clearTimeout(t);
  }, [onDismiss]);
  return (
    <div
      role="status"
      style={{
        position: "fixed", left: 14, right: 14,
        bottom: "calc(28px + env(safe-area-inset-bottom))",
        maxWidth: 480, margin: "0 auto", zIndex: 1100,
        display: "flex", alignItems: "center", gap: 12,
        padding: "14px 16px", borderRadius: 14,
        background: C.surfaceGlass, backdropFilter: "blur(22px) saturate(160%)",
        WebkitBackdropFilter: "blur(22px) saturate(160%)",
        borderLeft: `3px solid ${C.warn}`,
        border: `1px solid ${C.border2}`,
        boxShadow: "0 16px 40px rgba(0,0,0,0.35)",
        animation: "kSlideIn 0.38s cubic-bezier(.2,.8,.2,1)",
      }}
    >
      <div style={{
        width: 30, height: 30, borderRadius: 999, background: C.warnSoft,
        display: "flex", alignItems: "center", justifyContent: "center",
      }}>
        <IconRefresh c={C.warn} s={16} />
      </div>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontSize: "0.8125rem", fontWeight: 600, color: C.text, fontFamily: BODY }}>
          Couldn't save — reverted
        </div>
        <div style={{ fontSize: "0.71875rem", color: C.text2, marginTop: 2, fontFamily: BODY }}>
          {message}
        </div>
      </div>
      {onRetry && (
        <button
          onClick={onRetry}
          style={{
            background: "transparent", border: "none",
            fontFamily: MONO, fontSize: "0.625rem", letterSpacing: "0.08em", color: C.live,
            cursor: "pointer", padding: "8px 4px",
          }}
        >
          RETRY
        </button>
      )}
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════
// Centered modal — Session expired, Rate limited
// ═══════════════════════════════════════════════════════════════════════════

function CenteredModal({ C, children }: { C: Theme; children: React.ReactNode }) {
  return (
    <div
      role="dialog"
      aria-modal="true"
      style={{
        position: "fixed", inset: 0, zIndex: 9000,
        background: "rgba(10,10,11,0.7)", backdropFilter: "blur(6px)",
        WebkitBackdropFilter: "blur(6px)",
        display: "flex", alignItems: "center", justifyContent: "center",
        padding: 22,
        animation: "kFadeIn 0.22s ease-out",
      }}
    >
      <div style={{
        width: "100%", maxWidth: 380,
        borderRadius: 24, background: C.panel,
        border: `1px solid ${C.border2}`,
        padding: 24,
        animation: "kRise 0.32s cubic-bezier(.2,.8,.2,1)",
        boxShadow: "0 40px 80px rgba(0,0,0,0.6)",
      }}>
        {children}
      </div>
    </div>
  );
}

export function SessionExpiredModal({ C, onSignIn, onDismiss }: {
  C: Theme; onSignIn?: () => void; onDismiss?: () => void;
}) {
  return (
    <CenteredModal C={C}>
      <div style={{
        width: 52, height: 52, borderRadius: 999, background: C.accentSoft,
        display: "flex", alignItems: "center", justifyContent: "center", marginBottom: 18,
      }}>
        <IconLock c={C.accent} s={24} />
      </div>
      <div style={{ fontFamily: DISPLAY, fontSize: "1.3125rem", fontWeight: 600, letterSpacing: "-0.02em", color: C.text }}>
        Session expired
      </div>
      <div style={{ fontSize: "0.84375rem", color: C.text2, marginTop: 10, lineHeight: 1.55, fontFamily: BODY }}>
        For your security we signed you out after inactivity. Sign back in — your draft trade is saved.
      </div>
      <div style={{ marginTop: 22, display: "flex", flexDirection: "column", gap: 10 }}>
        <button
          onClick={onSignIn}
          style={{
            background: C.live, color: "#0A0A0A", border: "none",
            borderRadius: 999, padding: "13px 22px",
            fontFamily: BODY, fontSize: "0.875rem", fontWeight: 600, cursor: "pointer", width: "100%",
          }}
        >
          Sign back in
        </button>
        <button
          onClick={onDismiss}
          style={{
            background: "transparent", color: C.text,
            border: `1px solid ${C.border2}`, borderRadius: 999, padding: "13px 22px",
            fontFamily: BODY, fontSize: "0.875rem", fontWeight: 500, cursor: "pointer", width: "100%",
          }}
        >
          Not now
        </button>
      </div>
    </CenteredModal>
  );
}

export function RateLimitedModal({ C, secondsLeft = 23, onDismiss }: {
  C: Theme; secondsLeft?: number; onDismiss?: () => void;
}) {
  const [s, setS] = useState(secondsLeft);
  useEffect(() => {
    if (s <= 0) return;
    const t = setInterval(() => setS(v => Math.max(0, v - 1)), 1000);
    return () => clearInterval(t);
  }, [s]);
  const mins = Math.floor(s / 60);
  const secs = (s % 60).toString().padStart(2, "0");
  return (
    <CenteredModal C={C}>
      <div style={{
        width: 52, height: 52, borderRadius: 999, background: C.warnSoft,
        display: "flex", alignItems: "center", justifyContent: "center",
        margin: "0 auto 18px",
      }}>
        <IconClock c={C.warn} s={24} />
      </div>
      <div style={{ fontFamily: DISPLAY, fontSize: "1.3125rem", fontWeight: 600, letterSpacing: "-0.02em", color: C.text, textAlign: "center" }}>
        Slow down a sec
      </div>
      <div style={{ fontSize: "0.84375rem", color: C.text2, marginTop: 10, lineHeight: 1.55, fontFamily: BODY, textAlign: "center" }}>
        You've made a lot of requests quickly.{" "}
        {s > 0 ? <>Try again in <span style={{ color: C.text, fontFamily: MONO }}>{mins}:{secs}</span>.</> : "You can try again now."}
      </div>
      <div style={{ marginTop: 20 }}>
        <button
          onClick={onDismiss}
          style={{
            background: "transparent", color: C.text,
            border: `1px solid ${C.border2}`, borderRadius: 999, padding: "13px 22px",
            fontFamily: BODY, fontSize: "0.875rem", fontWeight: 500, cursor: "pointer", width: "100%",
          }}
        >
          Got it
        </button>
      </div>
    </CenteredModal>
  );
}

// ═══════════════════════════════════════════════════════════════════════════
// Error pages — 401 / 403 / 500 / 503
// ═══════════════════════════════════════════════════════════════════════════

export function ErrorPage({
  C, code, title, accent, sub, cta, onCta, onSecondary, secondary = "Status page",
}: {
  C: Theme;
  code: "401" | "403" | "500" | "503";
  title: string;
  accent?: string;
  sub: string;
  cta: string;
  onCta?: () => void;
  onSecondary?: () => void;
  secondary?: string;
}) {
  return (
    <div style={{
      minHeight: "100dvh", background: C.bg, color: C.text,
      position: "relative", overflow: "hidden",
      display: "flex", alignItems: "center", justifyContent: "center",
    }}>
      <GlassOrb C={C} color={C.orb1} size={520} top={-120} right={-100} opacity={0.3} />
      <GlassOrb C={C} color={C.orb3} size={360} bottom={-80} left={-80} opacity={0.22} />
      <GhostWord C={C} word={code} fontSize={Math.min(420, typeof window !== "undefined" ? window.innerWidth * 0.6 : 320)} top={"15%"} align="center" isDark />
      <div style={{
        position: "relative", zIndex: 2, textAlign: "center",
        maxWidth: 520, padding: "0 24px",
      }}>
        <div style={{ display: "flex", justifyContent: "center", marginBottom: 24, alignItems: "center", gap: 9 }}>
          <KodaMark size={22} color={C.text} />
          <span style={{ fontFamily: BODY, fontWeight: 600, fontSize: "0.9375rem", letterSpacing: "0.22em", color: C.text }}>
            Kōda
          </span>
        </div>
        <Kicker C={C} color={C.live}>Error {code}</Kicker>
        <div style={{
          fontFamily: DISPLAY, fontSize: "clamp(34px, 6vw, 42px)",
          fontWeight: 600, letterSpacing: "-0.035em", lineHeight: 1.05,
          color: C.text, marginTop: 16,
        }}>
          {title}{" "}
          {accent && <span style={{ fontStyle: "italic", fontWeight: 500, color: C.live }}>{accent}</span>}
        </div>
        <div style={{
          fontSize: "0.9375rem", color: C.text2, marginTop: 16, lineHeight: 1.6, fontFamily: BODY,
        }}>
          {sub}
        </div>
        <div style={{
          display: "flex", gap: 12, justifyContent: "center",
          marginTop: 28, flexWrap: "wrap",
        }}>
          <button
            onClick={onCta}
            style={{
              background: C.live, color: "#0A0A0A", border: "none",
              borderRadius: 999, padding: "13px 24px",
              fontFamily: BODY, fontSize: "0.875rem", fontWeight: 600, cursor: "pointer",
            }}
          >
            {cta}
          </button>
          {onSecondary && (
            <button
              onClick={onSecondary}
              style={{
                background: "transparent", color: C.text,
                border: `1px solid ${C.border2}`, borderRadius: 999, padding: "13px 22px",
                fontFamily: BODY, fontSize: "0.875rem", fontWeight: 500, cursor: "pointer",
              }}
            >
              {secondary}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

export function Error500({ C, onReload }: { C: Theme; onReload?: () => void }) {
  return (
    <ErrorPage
      C={C}
      code="500"
      title="Something broke on"
      accent="our end."
      sub="An unexpected error hit our servers. We've been pinged and we're on it — give it a moment and try again."
      cta="Reload page"
      onCta={onReload || (() => window.location.reload())}
      onSecondary={() => window.open("https://status.kodatrade.co.uk", "_blank")}
    />
  );
}
export function Error503({ C, onReload }: { C: Theme; onReload?: () => void }) {
  return (
    <ErrorPage
      C={C}
      code="503"
      title="Kōda is"
      accent="upgrading."
      sub="We're shipping something good. The app will be back in a few minutes — your data is safe and untouched."
      cta="Try again"
      onCta={onReload || (() => window.location.reload())}
      onSecondary={() => window.open("https://status.kodatrade.co.uk", "_blank")}
    />
  );
}
export function Error403({ C, onHome }: { C: Theme; onHome?: () => void }) {
  return (
    <ErrorPage
      C={C}
      code="403"
      title="You can't access"
      accent="this."
      sub="This page is private or you don't have permission. If you think this is a mistake, head back home."
      cta="Back to dashboard"
      onCta={onHome || (() => { window.location.href = "/"; })}
    />
  );
}
export function Error401({ C, onSignIn }: { C: Theme; onSignIn?: () => void }) {
  return (
    <ErrorPage
      C={C}
      code="401"
      title="You're not"
      accent="signed in."
      sub="This page needs an account. Sign in to continue — your work is saved."
      cta="Sign in"
      onCta={onSignIn || (() => { window.location.href = "/"; })}
    />
  );
}
