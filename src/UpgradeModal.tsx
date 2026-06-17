import { useState, useEffect } from "react";
import { supabase } from "./lib/supabase";
import { MONO, BODY, DISPLAY } from "./shared";
import { phCapture } from "./lib/posthog";
import type { Theme } from "./theme";

export function UpgradeModal({ C, userId, userEmail, stripeCustomerId, onCustomerId, onClose, mandatory = false }: {
  C: Theme;
  userId: string;
  userEmail: string;
  stripeCustomerId?: string;
  onCustomerId: (id: string) => void;
  onClose: () => void;
  mandatory?: boolean;
}) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => { phCapture("paywall_viewed", { mandatory }); }, [mandatory]);

  async function handleUpgrade() {
    setLoading(true);
    setError("");
    phCapture("checkout_started", { mandatory });
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session?.access_token) throw new Error("Not signed in");
      const res = await fetch("/api/stripe?action=checkout", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${session.access_token}`,
        },
        body: JSON.stringify({ userId, email: userEmail, stripeCustomerId }),
      });
      if (!res.ok) {
        const { error: msg } = await res.json().catch(() => ({}));
        throw new Error(msg ?? `Request failed (${res.status})`);
      }
      const { url, customerId: newCid } = await res.json();
      if (newCid) onCustomerId(newCid);
      window.location.href = url;
    } catch (err: unknown) {
      console.error("[upgrade]", err);
      setError(err instanceof Error ? err.message : "Something went wrong. Please try again.");
      setLoading(false);
    }
  }

  const { live, liveSoft, orb1, orb3 } = C;

  const FEATURES = [
    { icon: "📊", text: "Unlimited trade history" },
    { icon: "📥", text: "CSV import — 8 broker formats" },
    { icon: "↗", text: "Advanced analytics — heatmaps, MAE/MFE, edge stats", mono: true },
    { icon: "◈", text: "Full insights — pattern detection & discipline scoring", mono: true },
    { icon: "⇣", text: "Export reports (CSV + PDF)", mono: true },
  ];

  return (
    <div
      style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.82)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 9999, padding: "20px" }}
      onClick={e => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div style={{
        position: "relative",
        width: "100%", maxWidth: "380px",
        background: C.surfaceGlass,
        border: `1px solid ${C.border2 ?? "rgba(255,255,255,0.13)"}`,
        borderRadius: "24px",
        padding: "28px 24px 24px",
        display: "flex", flexDirection: "column", gap: "20px",
        overflow: "hidden",
        backdropFilter: "blur(28px) saturate(180%)",
        WebkitBackdropFilter: "blur(28px) saturate(180%)",
        animation: "kRise 0.42s ease-out",
      }}>
        {/* Single signature ambient: centered orb bloom behind the badge.
            The previous design stacked a corner glow + this bloom + the ghost
            word — three ambient layers on one modal read as templated. */}
        <div style={{
          position: "absolute", top: 40, left: "50%", transform: "translateX(-50%)",
          width: 300, height: 300, borderRadius: "50%",
          background: `conic-gradient(from 180deg, ${orb1}, ${live}, ${orb3}, ${orb1})`,
          filter: "blur(80px)", opacity: 0.32, pointerEvents: "none",
        }} />

        {/* Ghost "PRO" word */}
        <div style={{
          position: "absolute", bottom: -20, right: -10, pointerEvents: "none", zIndex: 0,
          fontFamily: DISPLAY, fontWeight: 700, fontSize: "7.5rem", lineHeight: 0.85, letterSpacing: "-0.05em",
          background: "linear-gradient(180deg, rgba(255,255,255,0.07), rgba(255,255,255,0.01))",
          WebkitBackgroundClip: "text", backgroundClip: "text", WebkitTextFillColor: "transparent",
          WebkitTextStroke: "1px rgba(255,255,255,0.05)",
        }}>PRO</div>

        {/* Content */}
        <div style={{ position: "relative", zIndex: 1 }}>
          {/* Badge */}
          <div style={{
            display: "inline-flex", alignItems: "center", gap: "5px",
            background: liveSoft, color: live,
            borderRadius: "6px", padding: "3px 10px",
            fontFamily: MONO, fontSize: "0.625rem", fontWeight: 600, letterSpacing: "0.12em", textTransform: "uppercase",
          }}>
            <span style={{ width: "6px", height: "6px", borderRadius: "50%", background: live, boxShadow: `0 0 6px ${live}` }}/>
            KŌDA OS · PRO
          </div>

          {/* Headline */}
          <div style={{ marginTop: "12px", fontFamily: DISPLAY, fontSize: "1.5rem", fontWeight: 600, color: C.text ?? "#F2F2EE", lineHeight: 1.15, letterSpacing: "-0.02em" }}>
            Trade with<br/>a real <span style={{ fontStyle: "italic", color: live }}>edge.</span>
          </div>
          <div style={{ marginTop: "6px", fontFamily: BODY, fontSize: "0.8125rem", color: C.muted ?? "#65655F", lineHeight: 1.5 }}>
                    Everything you need, in one place.
          </div>
        </div>

        {/* Price */}
        <div style={{ position: "relative", zIndex: 1, display: "flex", alignItems: "baseline", gap: "6px" }}>
          <span style={{ fontFamily: DISPLAY, fontSize: "2.625rem", fontWeight: 700, color: C.text ?? "#F2F2EE", lineHeight: 1, letterSpacing: "-0.03em" }}>£24.99</span>
          <span style={{ fontFamily: MONO, fontSize: "0.75rem", color: C.muted ?? "#65655F" }}>/mo · cancel any time</span>
        </div>

        {/* Features */}
        <div style={{ position: "relative", zIndex: 1, display: "flex", flexDirection: "column", gap: "10px" }}>
          {FEATURES.map(f => (
            <div key={f.text} style={{ display: "flex", alignItems: "flex-start", gap: "10px" }}>
              <span style={{ width: "18px", flexShrink: 0, fontSize: f.mono ? "0.75rem" : "0.9375rem", fontFamily: f.mono ? MONO : "system-ui", textAlign: "center", lineHeight: "20px", color: live }}>
                {f.icon}
              </span>
              <span style={{ fontFamily: BODY, fontSize: "0.8125rem", color: C.text2 ?? "#A6A6A2", lineHeight: 1.4 }}>{f.text}</span>
            </div>
          ))}
        </div>

        {/* Error */}
        {error && (
          <div style={{ position: "relative", zIndex: 1, background: "rgba(239,68,68,0.12)", border: "1px solid rgba(239,68,68,0.3)", borderRadius: "10px", padding: "10px 12px", fontFamily: MONO, fontSize: "0.6875rem", color: "#ef4444" }}>
            {error}
          </div>
        )}

        {/* CTA */}
        <div style={{ position: "relative", zIndex: 1, display: "flex", flexDirection: "column", gap: "10px" }}>
          <button
            onClick={handleUpgrade}
            disabled={loading}
            style={{
              display: "flex", alignItems: "center", justifyContent: "space-between",
              background: loading ? C.muted : live,
              color: "#0A0A0A", border: "none", borderRadius: "14px",
              padding: "5px 6px 5px 20px", fontSize: "0.875rem", fontWeight: 600,
              cursor: loading ? "default" : "pointer", width: "100%",
              fontFamily: BODY, opacity: loading ? 0.7 : 1, transition: "opacity 0.2s",
            }}
          >
            <span>{loading ? "Redirecting…" : "Upgrade Now — £24.99/mo"}</span>
            {!loading && (
              <span style={{ width: "36px", height: "36px", borderRadius: "999px", background: "#0A0A0A", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
                  <path d="M3 8h10M9 4l4 4-4 4" stroke={live} strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round"/>
                </svg>
              </span>
            )}
          </button>
          {!mandatory && (
            <button
              onClick={onClose}
              style={{ background: "none", border: "none", color: C.muted ?? "#65655F", cursor: "pointer", fontFamily: MONO, fontSize: "0.6875rem", letterSpacing: "0.08em", textTransform: "uppercase", textAlign: "center", padding: "6px" }}
            >
              Maybe later
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
