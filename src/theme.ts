// ═══════════════════════════════════════════════════════════════════════════════
// theme.ts — Kōda design system
//
// OKLCH-based palette, Geist type scale, glass surfaces.
// Import DARK / LIGHT for the colour token set.
// Import makeStyles(C) for the shared editorial style helpers.
// ═══════════════════════════════════════════════════════════════════════════════

import type React from "react";
import { MONO, BODY } from "./shared";

// ── Colour tokens ─────────────────────────────────────────────────────────────

export const DARK = {
  // Core surfaces — verbatim from koda-kit.jsx THEME.dark (handover bundle).
  // Cool near-black, neutral panels. Replaces the warm-dark #13110E pass
  // because Dylon wants the redesign to land exactly as shipped in the kit.
  bg: "#0A0A0B",
  panel: "#131317",
  panel2: "#1A1A20",
  panel3: "#22222A",
  border: "rgba(255,255,255,0.07)",
  border2: "rgba(255,255,255,0.12)",
  // Text
  text: "#F2F2EE",
  text2: "#A6A6A2",
  muted: "#65655F",
  dim: "#45453F",
  // Accents — electric blue + mint
  accent: "oklch(0.74 0.16 250)",
  accentSoft: "oklch(0.74 0.16 250 / 0.16)",
  live: "oklch(0.84 0.14 175)",
  liveSoft: "oklch(0.84 0.14 175 / 0.16)",
  // Outcome
  green: "oklch(0.78 0.18 152)",
  greenSoft: "oklch(0.78 0.18 152 / 0.15)",
  red: "oklch(0.70 0.21 25)",
  redSoft: "oklch(0.70 0.21 25 / 0.15)",
  // Glass/bloom
  surfaceGlass: "rgba(28,28,34,0.55)",
  orb1: "oklch(0.55 0.22 252)",
  orb2: "oklch(0.45 0.20 268)",
  orb3: "oklch(0.68 0.18 175)",
  // Semantic
  warn: "oklch(0.79 0.16 75)",
  warnSoft: "oklch(0.79 0.16 75 / 0.15)",
  // Kit aliases — match koda-kit.jsx token names so design ports are 1:1
  surface: "#131317",
  surfaceHi: "#1A1A20",
  line: "rgba(255,255,255,0.07)",
  line2: "rgba(255,255,255,0.12)",
  line3: "rgba(255,255,255,0.20)",
  ink: "#F2F2EE",
  ink2: "#A6A6A2",
  // Legacy compat
  blue: "oklch(0.74 0.16 250)",
  yellow: "#65655F",
  inputBg: "transparent",
  shadow: "rgba(0,0,0,0.45)",
} as const;

export const LIGHT = {
  // Core surfaces — verbatim from koda-kit.jsx THEME.light (handover bundle).
  bg: "#F4F2ED",
  panel: "#FFFFFF",
  panel2: "#FAFAF6",
  panel3: "#EFEDE6",
  border: "rgba(10,10,10,0.07)",
  border2: "rgba(10,10,10,0.14)",
  // Text
  text: "#0A0A0A",
  text2: "#55554F",
  muted: "#9A9890",
  dim: "rgba(10,10,10,0.30)",
  // Accents
  accent: "oklch(0.55 0.18 252)",
  accentSoft: "oklch(0.55 0.18 252 / 0.10)",
  live: "oklch(0.62 0.14 175)",
  liveSoft: "oklch(0.62 0.14 175 / 0.12)",
  // Outcome
  green: "oklch(0.55 0.18 152)",
  greenSoft: "oklch(0.55 0.18 152 / 0.12)",
  red: "oklch(0.55 0.22 25)",
  redSoft: "oklch(0.55 0.22 25 / 0.12)",
  // Glass/bloom
  surfaceGlass: "rgba(255,255,255,0.65)",
  orb1: "oklch(0.78 0.14 252)",
  orb2: "oklch(0.72 0.12 268)",
  orb3: "oklch(0.78 0.10 175)",
  // Semantic
  warn: "oklch(0.68 0.16 75)",
  warnSoft: "oklch(0.68 0.16 75 / 0.14)",
  // Kit aliases — match koda-kit.jsx token names so design ports are 1:1
  surface: "#FFFFFF",
  surfaceHi: "#FAFAF6",
  line: "rgba(10,10,10,0.07)",
  line2: "rgba(10,10,10,0.14)",
  line3: "rgba(10,10,10,0.22)",
  ink: "#0A0A0A",
  ink2: "#55554F",
  // Legacy compat
  blue: "oklch(0.55 0.18 252)",
  yellow: "#9A9890",
  inputBg: "transparent",
  shadow: "rgba(0,0,0,0.08)",
} as const;

/** Canonical theme type — typeof DARK works for both (identical keys). */
export type Theme = typeof DARK;

// ── Shared style factory ──────────────────────────────────────────────────────
// Call makeStyles(C) inside a component where C = DARK | LIGHT.
// Returns the editorial input / label / pill helpers used across all screens.

export function makeStyles(C: Theme) {
  const inp: React.CSSProperties = {
    background: "transparent",
    border: "none",
    borderBottom: `1px solid ${C.border2}`,
    borderRadius: 0,
    color: C.text,
    padding: "12px 0",
    minHeight: "44px",
    fontSize: "16px",
    width: "100%",
    outline: "none",
    fontFamily: BODY,
    boxSizing: "border-box",
    letterSpacing: "0.01em",
  };

  const sel: React.CSSProperties = { ...inp, cursor: "pointer" };

  const lbl: React.CSSProperties = {
    fontSize: "0.75rem",
    color: C.muted,
    letterSpacing: "0.05em",
    marginBottom: "6px",
    display: "block",
    fontFamily: MONO,
    textTransform: "uppercase",
  };

  const pillPrimary = (enabled = true): React.CSSProperties => ({
    background: enabled ? C.text : "transparent",
    color: enabled ? C.bg : C.muted,
    border: enabled ? "none" : `1px solid ${C.border2}`,
    borderRadius: "999px",
    padding: "14px 20px",
    fontSize: "0.8125rem",
    letterSpacing: "0.02em",
    cursor: enabled ? "pointer" : "not-allowed",
    fontFamily: BODY,
    width: "100%",
    transition: "opacity 0.15s, transform 0.15s",
  });

  const pillGhost: React.CSSProperties = {
    background: "transparent",
    color: C.text,
    border: `1px solid ${C.border2}`,
    borderRadius: "999px",
    padding: "12px 18px",
    minHeight: "44px",
    fontSize: "0.8125rem",
    letterSpacing: "0.01em",
    cursor: "pointer",
    fontFamily: BODY,
    transition: "opacity 0.15s",
    display: "inline-flex",
    alignItems: "center",
    justifyContent: "center",
  };

  return { inp, sel, lbl, pillPrimary, pillGhost };
}
