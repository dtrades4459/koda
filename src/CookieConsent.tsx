import { useEffect, useState } from "react";
import { COOKIE_CONSENT_KEY, initPostHog } from "./lib/posthog";
import { DARK } from "./theme";
import { BODY, MONO, DISPLAY, Kicker } from "./shared";

const C = DARK;

// ═══════════════════════════════════════════════════════════════════════════
// CookieConsent — GDPR/ePrivacy compliant banner + preferences modal (cat10)
//
// Levels:
//   • essential — always on (no opt-out; required for the site to function)
//   • analytics — PostHog (opt-in)
//   • marketing — Meta / TikTok / Google pixels (opt-in, off by default)
//
// Persistence: localStorage key COOKIE_CONSENT_KEY stores JSON:
//   { essential: true, analytics: bool, marketing: bool, ts: number }
// Backwards compat: legacy "accepted"/"rejected" strings still recognised.
// ═══════════════════════════════════════════════════════════════════════════

export interface CookiePrefs {
  essential: true;
  analytics: boolean;
  marketing: boolean;
  ts: number;
}

function readPrefs(): CookiePrefs | null {
  try {
    const raw = localStorage.getItem(COOKIE_CONSENT_KEY);
    if (!raw) return null;
    if (raw === "accepted") return { essential: true, analytics: true, marketing: false, ts: Date.now() };
    if (raw === "rejected") return { essential: true, analytics: false, marketing: false, ts: Date.now() };
    const p = JSON.parse(raw);
    if (typeof p === "object" && p !== null && typeof p.analytics === "boolean") {
      return { essential: true, analytics: !!p.analytics, marketing: !!p.marketing, ts: p.ts ?? Date.now() };
    }
  } catch { /* noop */ }
  return null;
}

function writePrefs(p: CookiePrefs) {
  try { localStorage.setItem(COOKIE_CONSENT_KEY, JSON.stringify(p)); } catch { /* noop */ }
}

function applyPrefs(p: CookiePrefs) {
  if (p.analytics) initPostHog();
  // Marketing pixels would gate-load here in the future.
}

export function CookieConsent() {
  const [stage, setStage] = useState<"hidden" | "banner" | "prefs">("hidden");
  const [analytics, setAnalytics] = useState(true);
  const [marketing, setMarketing] = useState(false);

  useEffect(() => {
    const p = readPrefs();
    if (p) {
      applyPrefs(p);
      setStage("hidden");
    } else {
      setStage("banner");
    }
  }, []);

  if (stage === "hidden") return null;

  const acceptAll = () => {
    const p: CookiePrefs = { essential: true, analytics: true, marketing: true, ts: Date.now() };
    writePrefs(p);
    applyPrefs(p);
    setStage("hidden");
  };
  const rejectAll = () => {
    const p: CookiePrefs = { essential: true, analytics: false, marketing: false, ts: Date.now() };
    writePrefs(p);
    setStage("hidden");
  };
  const savePrefs = () => {
    const p: CookiePrefs = { essential: true, analytics, marketing, ts: Date.now() };
    writePrefs(p);
    applyPrefs(p);
    setStage("hidden");
  };

  if (stage === "prefs") {
    return <CookiePreferencesModal
      analytics={analytics} marketing={marketing}
      setAnalytics={setAnalytics} setMarketing={setMarketing}
      onSave={savePrefs} onRejectAll={rejectAll} onAcceptAll={acceptAll}
      onCancel={() => setStage("banner")}
    />;
  }

  return (
    <div
      role="dialog"
      aria-label="Cookie consent"
      style={{
        position: "fixed", left: 12, right: 12,
        bottom: "calc(12px + env(safe-area-inset-bottom))",
        maxWidth: 720, margin: "0 auto",
        zIndex: 9999,
        background: C.surfaceGlass,
        backdropFilter: "blur(28px) saturate(180%)",
        WebkitBackdropFilter: "blur(28px) saturate(180%)",
        border: `1px solid ${C.border2}`,
        borderRadius: 18,
        color: C.text, fontFamily: BODY,
        padding: "18px 20px",
        boxShadow: "0 24px 60px rgba(0,0,0,0.45)",
        animation: "kRise 0.42s cubic-bezier(.2,.8,.2,1)",
      }}
    >
      <Kicker C={C} color={C.live}>Cookies</Kicker>
      <p style={{
        margin: "8px 0 0", fontSize: 13.5, lineHeight: 1.55, color: C.text2,
      }}>
        We use cookies to make Kōda work, measure what helps traders, and improve the product.
        Essential cookies are always on.{" "}
        <a href="/cookies.html" style={{ color: C.live, textDecoration: "none" }}>
          Cookie Policy
        </a>
        .
      </p>
      <div style={{
        display: "flex", flexWrap: "wrap", gap: 8,
        marginTop: 14, justifyContent: "flex-end", alignItems: "center",
      }}>
        <button
          onClick={() => setStage("prefs")}
          style={{
            background: "transparent", color: C.text2, border: "none",
            fontFamily: MONO, fontSize: 11, letterSpacing: "0.08em", cursor: "pointer",
            padding: "10px 12px", textTransform: "uppercase",
          }}
        >
          Preferences
        </button>
        <button
          onClick={rejectAll}
          style={{
            minHeight: 44, padding: "11px 18px", borderRadius: 999,
            background: "transparent", color: C.text,
            border: `1px solid ${C.border2}`,
            fontFamily: BODY, fontSize: 13, fontWeight: 500, cursor: "pointer",
          }}
        >
          Reject all
        </button>
        <button
          onClick={acceptAll}
          style={{
            minHeight: 44, padding: "11px 22px", borderRadius: 999,
            background: C.live, color: "#0A0A0A", border: "none",
            fontFamily: BODY, fontSize: 13, fontWeight: 600, cursor: "pointer",
          }}
        >
          Accept all
        </button>
      </div>
    </div>
  );
}

// ─── Preferences modal (categorised) ───────────────────────────────────────
function CookiePreferencesModal({
  analytics, marketing,
  setAnalytics, setMarketing,
  onSave, onRejectAll, onAcceptAll, onCancel,
}: {
  analytics: boolean;
  marketing: boolean;
  setAnalytics: (v: boolean) => void;
  setMarketing: (v: boolean) => void;
  onSave: () => void;
  onRejectAll: () => void;
  onAcceptAll: () => void;
  onCancel: () => void;
}) {
  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="Cookie preferences"
      onClick={onCancel}
      style={{
        position: "fixed", inset: 0, zIndex: 10000,
        background: "rgba(10,10,11,0.72)",
        backdropFilter: "blur(6px)", WebkitBackdropFilter: "blur(6px)",
        display: "flex", alignItems: "center", justifyContent: "center",
        padding: 16, animation: "kFadeIn 0.22s ease-out",
      }}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          width: "100%", maxWidth: 480, borderRadius: 24,
          background: C.panel, border: `1px solid ${C.border2}`,
          padding: 24, animation: "kRise 0.32s cubic-bezier(.2,.8,.2,1)",
          maxHeight: "85vh", overflowY: "auto", boxSizing: "border-box",
        }}
      >
        <Kicker C={C} color={C.live}>Cookie preferences</Kicker>
        <div style={{
          fontFamily: DISPLAY, fontSize: 22, fontWeight: 600, color: C.text,
          letterSpacing: "-0.02em", marginTop: 10,
        }}>
          Choose what's on.
        </div>
        <div style={{ marginTop: 18, display: "flex", flexDirection: "column", gap: 12 }}>
          <PrefRow
            label="Essential"
            body="Required to sign in, keep your session safe, and save trades. Always on."
            on={true}
            disabled
          />
          <PrefRow
            label="Analytics"
            body="Helps us understand which features traders actually use. Sent through PostHog."
            on={analytics}
            onToggle={setAnalytics}
          />
          <PrefRow
            label="Marketing"
            body="Lets us see which content brings in new traders. Off unless you turn it on."
            on={marketing}
            onToggle={setMarketing}
          />
        </div>
        <div style={{
          display: "flex", flexWrap: "wrap", gap: 8,
          marginTop: 22, justifyContent: "space-between", alignItems: "center",
        }}>
          <button
            onClick={onRejectAll}
            style={{
              background: "transparent", color: C.text2, border: "none",
              fontFamily: MONO, fontSize: 11, letterSpacing: "0.08em",
              cursor: "pointer", padding: "10px 12px", textTransform: "uppercase",
            }}
          >
            Reject all
          </button>
          <div style={{ display: "flex", gap: 8 }}>
            <button
              onClick={onAcceptAll}
              style={{
                padding: "11px 18px", borderRadius: 999,
                background: "transparent", color: C.text, border: `1px solid ${C.border2}`,
                fontFamily: BODY, fontSize: 13, fontWeight: 500, cursor: "pointer",
              }}
            >
              Accept all
            </button>
            <button
              onClick={onSave}
              style={{
                padding: "11px 22px", borderRadius: 999,
                background: C.live, color: "#0A0A0A", border: "none",
                fontFamily: BODY, fontSize: 13, fontWeight: 600, cursor: "pointer",
              }}
            >
              Save preferences
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

function PrefRow({
  label, body, on, disabled, onToggle,
}: {
  label: string; body: string; on: boolean; disabled?: boolean;
  onToggle?: (v: boolean) => void;
}) {
  return (
    <div style={{
      display: "flex", gap: 14, alignItems: "flex-start",
      padding: "14px 16px", borderRadius: 14,
      background: C.surface, border: `1px solid ${C.line}`,
    }}>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontSize: 14, fontWeight: 600, color: C.text, fontFamily: BODY }}>
          {label}
        </div>
        <div style={{ fontSize: 12, color: C.text2, marginTop: 4, lineHeight: 1.5, fontFamily: BODY }}>
          {body}
        </div>
      </div>
      <button
        type="button"
        role="switch"
        aria-checked={on}
        disabled={disabled}
        onClick={() => !disabled && onToggle?.(!on)}
        style={{
          width: 44, height: 26, borderRadius: 999,
          background: on ? C.live : C.surfaceHi,
          border: `1px solid ${on ? "transparent" : C.border2}`,
          position: "relative", cursor: disabled ? "not-allowed" : "pointer",
          opacity: disabled ? 0.6 : 1, flexShrink: 0, padding: 0,
          transition: "background 0.2s",
        }}
      >
        <span style={{
          position: "absolute", top: 2, left: on ? 20 : 2,
          width: 20, height: 20, borderRadius: 999,
          background: on ? "#0A0A0A" : C.text,
          transition: "left 0.2s",
        }} />
      </button>
    </div>
  );
}
