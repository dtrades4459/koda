// src/BetaWelcome.tsx
// Full-screen welcome letter shown once after the beta gate is passed.

import { useEffect } from "react";
import { MONO, BODY } from "./shared";

const BG      = "#0A0A0B";
const PANEL   = "#131317";
const BORDER  = "rgba(255,255,255,0.07)";
const BORDER2 = "rgba(255,255,255,0.13)";
const TEXT    = "#F2F2EE";
const TEXT2   = "#A6A6A2";
const MUTED   = "#65655F";
const MINT    = "oklch(0.84 0.14 175)";

interface BetaWelcomeProps {
  onClose: () => void;
}

export function BetaWelcome({ onClose }: BetaWelcomeProps) {
  useEffect(() => {
    function onKey(e: KeyboardEvent) { if (e.key === "Escape") onClose(); }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  useEffect(() => {
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => { document.body.style.overflow = prev; };
  }, []);

  return (
    <div
      style={{
        position: "fixed", inset: 0, zIndex: 9999,
        background: "rgba(10,10,11,0.88)",
        backdropFilter: "blur(12px)",
        WebkitBackdropFilter: "blur(12px)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        padding: "24px",
        animation: "wlFadeIn 0.3s ease",
      }}
      onClick={e => { if (e.target === e.currentTarget) onClose(); }}
    >
      <style>{`
        @keyframes wlFadeIn{from{opacity:0}to{opacity:1}}
        @keyframes wlSlideUp{from{opacity:0;transform:translateY(16px)}to{opacity:1;transform:translateY(0)}}
        .wl-close:hover{opacity:1!important;}
        .wl-body::-webkit-scrollbar{display:none;}
        .wl-section+.wl-section{margin-top:28px;}
        .wl-cta:hover{opacity:0.88!important;}
      `}</style>

      {/* Card — flex column so header/footer never scroll away */}
      <div style={{
        display: "flex",
        flexDirection: "column",
        width: "100%",
        maxWidth: 540,
        maxHeight: "90dvh",
        background: PANEL,
        border: `1px solid ${BORDER2}`,
        borderRadius: 20,
        animation: "wlSlideUp 0.35s ease",
        overflow: "hidden",
      }}>

        {/* ── Sticky header ─────────────────────────────────────── */}
        <div style={{
          flexShrink: 0,
          padding: "28px 28px 24px",
          borderBottom: `1px solid ${BORDER}`,
          display: "flex",
          justifyContent: "space-between",
          alignItems: "flex-start",
          gap: 16,
        }}>
          <div>
            <p style={{
              fontFamily: MONO, fontSize: 10, color: MUTED,
              letterSpacing: "0.14em", textTransform: "uppercase",
              margin: "0 0 10px",
            }}>
              BETA / 2026 — Welcome letter
            </p>
            <h1 style={{
              fontFamily: BODY, fontSize: 24, fontWeight: 700,
              letterSpacing: "-0.03em", color: TEXT,
              margin: 0, lineHeight: 1.15,
            }}>
              You're in.<br />
              <span style={{ fontStyle: "italic", fontWeight: 400, color: TEXT2 }}>
                Let's build this together.
              </span>
            </h1>
          </div>

          <button
            className="wl-close"
            onClick={onClose}
            aria-label="Close"
            style={{
              flexShrink: 0,
              width: 32, height: 32,
              background: "transparent",
              border: `1px solid ${BORDER2}`,
              borderRadius: "50%",
              color: TEXT2,
              display: "flex", alignItems: "center", justifyContent: "center",
              cursor: "pointer",
              opacity: 0.6,
              transition: "opacity 0.15s",
              padding: 0,
            }}
          >
            <svg width="11" height="11" viewBox="0 0 12 12" fill="none">
              <path d="M1 1l10 10M11 1L1 11" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
            </svg>
          </button>
        </div>

        {/* ── Scrollable body ────────────────────────────────────── */}
        <div
          className="wl-body"
          style={{
            flex: 1,
            overflowY: "auto",
            padding: "24px 28px",
            scrollbarWidth: "none",
          }}
        >
          <div style={{ fontFamily: BODY, fontSize: 14, color: TEXT2, lineHeight: 1.75 }}>

            <div className="wl-section">
              <p style={{ fontFamily: MONO, fontSize: 9, color: MUTED, letterSpacing: "0.14em", textTransform: "uppercase", margin: "0 0 8px" }}>
                01 — What is Kōda
              </p>
              <p style={{ margin: 0 }}>
                Kōda is a trading journal built for retail traders who take their craft seriously.
                Log trades, track your R-multiple, review setups, and find the edge hidden in your
                own data. Everything in one place, no spreadsheets.
              </p>
            </div>

            <div className="wl-section">
              <p style={{ fontFamily: MONO, fontSize: 9, color: MUTED, letterSpacing: "0.14em", textTransform: "uppercase", margin: "0 0 8px" }}>
                02 — What the beta is for
              </p>
              <p style={{ margin: 0 }}>
                This is a closed beta with a small, hand-picked group of traders. You're here
                because I want real feedback from real people before opening up to the public.
                What you log now is persistent — your data stays with you at launch and beyond.
              </p>
            </div>

            <div className="wl-section">
              <p style={{ fontFamily: MONO, fontSize: 9, color: MUTED, letterSpacing: "0.14em", textTransform: "uppercase", margin: "0 0 8px" }}>
                03 — What I need from you
              </p>
              <ul style={{ margin: 0, paddingLeft: 20, display: "flex", flexDirection: "column", gap: 6 }}>
                <li>Log your trades genuinely — real data makes the platform better</li>
                <li>If something feels off, broken, or missing, tell me</li>
                <li>
                  Use the <span style={{ color: TEXT, fontWeight: 500 }}>feedback button</span> in
                  the app or DM{" "}
                  <a
                    href="https://instagram.com/dylon.trades"
                    target="_blank"
                    rel="noopener noreferrer"
                    style={{ color: MINT, textDecoration: "none" }}
                  >@dylon.trades</a>
                </li>
              </ul>
            </div>

            <div className="wl-section">
              <p style={{ fontFamily: MONO, fontSize: 9, color: MUTED, letterSpacing: "0.14em", textTransform: "uppercase", margin: "0 0 8px" }}>
                04 — A few things to know
              </p>
              <ul style={{ margin: 0, paddingLeft: 20, display: "flex", flexDirection: "column", gap: 6 }}>
                <li>Some features are still being built — you'll see them appear</li>
                <li>The Pro plan is available at launch — beta users get early access pricing</li>
              </ul>
            </div>

          </div>
        </div>

        {/* ── Sticky footer ──────────────────────────────────────── */}
        <div style={{
          flexShrink: 0,
          padding: "20px 28px 28px",
          borderTop: `1px solid ${BORDER}`,
        }}>
          <p style={{ fontFamily: BODY, fontSize: 13, color: MUTED, margin: "0 0 16px", lineHeight: 1.6 }}>
            Thanks for being early.{" "}
            <span style={{ color: TEXT2 }}>— Dylon, founder of Kōda</span>
          </p>
          <button
            className="wl-cta"
            onClick={onClose}
            style={{
              width: "100%",
              padding: "14px 20px",
              background: TEXT,
              color: BG,
              border: "none",
              borderRadius: 999,
              fontFamily: BODY,
              fontSize: 13,
              fontWeight: 600,
              letterSpacing: "0.02em",
              cursor: "pointer",
              opacity: 1,
              transition: "opacity 0.15s",
            }}
          >
            Let's go →
          </button>
        </div>

      </div>
    </div>
  );
}
