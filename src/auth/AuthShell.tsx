import type React from "react";
import { DARK } from "../theme";
import { KodaMark, MONO, BODY, DISPLAY, GlassOrb, GhostWord, Kicker, Card } from "../shared";

const C = DARK;

/**
 * AuthShell — centered glass auth card on a dark phone-sized stage.
 * Ports the `AuthShell` pattern from koda-designs/cat01-auth.jsx.
 * Used for all auth flows: sign-up, reset, verify, recovery, handle picker.
 */
export function AuthShell({
  kicker,
  title,
  accent,
  sub,
  children,
  foot,
  ghost,
}: {
  kicker: string;
  title: string;
  accent?: string;
  sub?: React.ReactNode;
  children: React.ReactNode;
  foot?: React.ReactNode;
  ghost?: string;
}) {
  return (
    <div style={{
      minHeight: "100dvh", background: C.bg, color: C.text,
      position: "relative", overflow: "hidden",
      display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center",
      padding: "72px 22px 40px", boxSizing: "border-box",
    }}>
      <GlassOrb C={C} color={C.orb1} size={360} top={-80} right={-90} opacity={0.42} />
      <GlassOrb C={C} color={C.orb3} size={260} bottom={40} left={-70} opacity={0.3} />
      {ghost && (
        <GhostWord C={C} word={ghost} fontSize={120} bottom={70} right={-10} align="right" isDark />
      )}
      <div style={{ position: "relative", zIndex: 2, width: "100%", maxWidth: 420, display: "flex", flexDirection: "column", alignItems: "stretch" }}>
        <div style={{ marginBottom: 22, display: "flex", justifyContent: "center", alignItems: "center", gap: 9 }}>
          <KodaMark size={22} color={C.text} />
          <span style={{ fontFamily: BODY, fontWeight: 600, fontSize: "0.9375rem", letterSpacing: "0.22em", color: C.text }}>
            Kōda
          </span>
        </div>
        <Card C={C} glass pad={24} style={{ borderRadius: 24 }}>
          <Kicker C={C} color={C.live}>{kicker}</Kicker>
          <div style={{
            fontFamily: DISPLAY, fontSize: "1.6875rem", fontWeight: 600,
            letterSpacing: "-0.03em", lineHeight: 1.08, marginTop: 14, color: C.text,
          }}>
            {title}{" "}
            {accent && (
              <span style={{ fontStyle: "italic", fontWeight: 500, color: C.live }}>{accent}</span>
            )}
          </div>
          {sub && (
            <div style={{ fontSize: "0.84375rem", color: C.text2, marginTop: 12, lineHeight: 1.5 }}>
              {sub}
            </div>
          )}
          <div style={{ marginTop: 24, display: "flex", flexDirection: "column", gap: 18 }}>
            {children}
          </div>
        </Card>
        {foot && (
          <div style={{
            textAlign: "center", marginTop: 20, fontSize: "0.78125rem", color: C.text2, fontFamily: BODY,
          }}>
            {foot}
          </div>
        )}
      </div>
    </div>
  );
}

/** Divider with "OR" — used between primary CTA and OAuth row. */
export function OrSplit() {
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 12, color: C.muted }}>
      <div style={{ flex: 1, height: 1, background: C.border2 }} />
      <span style={{ fontFamily: MONO, fontSize: "0.5625rem", letterSpacing: "0.16em" }}>OR</span>
      <div style={{ flex: 1, height: 1, background: C.border2 }} />
    </div>
  );
}

/** Primary CTA — live (mint) or ink (white) or ghost (outline). */
export function AuthBtn({
  children, kind = "live", full, size = "md", style, onClick, disabled,
}: {
  children: React.ReactNode;
  kind?: "live" | "ink" | "ghost";
  full?: boolean;
  size?: "sm" | "md";
  style?: React.CSSProperties;
  onClick?: () => void;
  disabled?: boolean;
}) {
  const pad = size === "sm" ? "10px 16px" : "14px 22px";
  const bg = kind === "live" ? C.live : kind === "ink" ? C.text : "transparent";
  const fg = kind === "ghost" ? C.text : "#0A0A0A";
  const bd = kind === "ghost" ? `1px solid ${C.border2}` : "1px solid transparent";
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      style={{
        display: "flex", alignItems: "center", justifyContent: "center", gap: 8,
        padding: pad, borderRadius: 999, background: bg, color: fg, border: bd,
        fontFamily: BODY, fontWeight: 600, fontSize: size === "sm" ? 13 : 14, letterSpacing: "0.01em",
        width: full ? "100%" : undefined, cursor: disabled ? "not-allowed" : "pointer",
        boxSizing: "border-box", opacity: disabled ? 0.5 : 1,
        transition: "opacity 0.15s, transform 0.15s",
        ...style,
      }}
    >
      {children}
    </button>
  );
}

/** Editorial-underline input — single line, animated underline focus, error state. */
export function AuthField({
  label, value, placeholder, focus, error, hint, trailing, mono, type, onChange, inputRef, onKeyDown,
}: {
  label: string;
  value?: string;
  placeholder?: string;
  focus?: boolean;
  error?: string;
  hint?: string;
  trailing?: React.ReactNode;
  mono?: boolean;
  type?: string;
  onChange?: (v: string) => void;
  inputRef?: React.Ref<HTMLInputElement>;
  onKeyDown?: (e: React.KeyboardEvent<HTMLInputElement>) => void;
}) {
  const bc = error ? C.red : focus ? C.live : C.border2;
  const fam = mono ? MONO : BODY;
  return (
    <div>
      <div style={{
        fontFamily: MONO, fontSize: "0.59375rem", letterSpacing: "0.16em",
        textTransform: "uppercase", color: error ? C.red : C.muted, marginBottom: 8,
      }}>
        {label}
      </div>
      <div style={{
        display: "flex", alignItems: "center", gap: 8,
        borderBottom: `1px solid ${bc}`, padding: "10px 0",
        transition: "border-color 0.15s",
      }}>
        {onChange ? (
          <input
            ref={inputRef}
            type={type || "text"}
            value={value || ""}
            placeholder={placeholder}
            onChange={(e) => onChange(e.target.value)}
            onKeyDown={onKeyDown}
            style={{
              flex: 1, minWidth: 0, background: "transparent", border: "none", outline: "none",
              fontFamily: fam, fontSize: 16, color: C.text,
              letterSpacing: mono ? "0.04em" : 0, padding: 0,
            }}
          />
        ) : (
          <div style={{
            flex: 1, minWidth: 0, fontFamily: fam, fontSize: 16,
            color: value ? C.text : C.muted, letterSpacing: mono ? "0.04em" : 0,
          }}>
            {value || placeholder}
            {focus && (
              <span style={{ display: "inline-block", width: 1.5, height: 17, background: C.live, marginLeft: 1, verticalAlign: "-3px" }} />
            )}
          </div>
        )}
        {trailing}
      </div>
      {(hint || error) && (
        <div style={{ fontSize: "0.71875rem", color: error ? C.red : C.muted, marginTop: 7, lineHeight: 1.4, fontFamily: BODY }}>
          {error || hint}
        </div>
      )}
    </div>
  );
}

/** Floating pill input used in OAuth rows + handle picker. */
export function PillField({
  label, value, placeholder, action, error, mono, onChange, type,
}: {
  label: string;
  value?: string;
  placeholder?: string;
  action?: React.ReactNode;
  error?: string;
  mono?: boolean;
  onChange?: (v: string) => void;
  type?: string;
}) {
  return (
    <div>
      <div style={{
        display: "flex", alignItems: "center", gap: 8,
        padding: "10px 8px 10px 16px", borderRadius: 14,
        background: "rgba(255,255,255,0.03)",
        border: `1px solid ${error ? C.red : C.border2}`,
      }}>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{
            fontFamily: MONO, fontSize: "0.5625rem", letterSpacing: "0.16em",
            color: error ? C.red : C.muted, textTransform: "uppercase", marginBottom: 2,
          }}>
            {label}
          </div>
          {onChange ? (
            <input
              type={type || "text"}
              value={value || ""}
              placeholder={placeholder}
              onChange={(e) => onChange(e.target.value)}
              style={{
                width: "100%", background: "transparent", border: "none", outline: "none",
                fontFamily: mono ? MONO : BODY, fontSize: "0.875rem", color: C.text, fontWeight: 500,
                letterSpacing: mono ? "0.04em" : 0, padding: 0,
              }}
            />
          ) : (
            <div style={{
              fontFamily: mono ? MONO : BODY, fontSize: "0.875rem",
              color: value ? C.text : C.muted, fontWeight: 500,
              letterSpacing: mono ? "0.04em" : 0,
            }}>
              {value || placeholder}
            </div>
          )}
        </div>
        {action}
      </div>
      {error && (
        <div style={{ fontSize: "0.71875rem", color: C.red, marginTop: 7, lineHeight: 1.4, fontFamily: BODY }}>
          {error}
        </div>
      )}
    </div>
  );
}

/** OAuth provider row — Google or X glyph + label + chevron. */
export function OAuthRow({
  label, provider, onClick,
}: {
  label: string;
  provider: "google" | "x" | "apple";
  onClick?: () => void;
}) {
  const glyph =
    provider === "google" ? "G" :
    provider === "apple" ? "" :
    "X";
  return (
    <div
      onClick={onClick}
      role={onClick ? "button" : undefined}
      tabIndex={onClick ? 0 : undefined}
      style={{
        display: "flex", alignItems: "center", gap: 12,
        padding: "12px 16px", borderRadius: 12,
        background: "rgba(255,255,255,0.03)", border: `1px solid ${C.border2}`,
        cursor: onClick ? "pointer" : "default",
        transition: "opacity 0.15s",
      }}
    >
      <div style={{
        width: 20, height: 20, borderRadius: 5, background: C.text,
        display: "flex", alignItems: "center", justifyContent: "center",
        color: C.bg, fontFamily: BODY, fontWeight: 700, fontSize: "0.75rem",
      }}>
        {glyph}
      </div>
      <div style={{ flex: 1, fontSize: "0.875rem", color: C.text, fontWeight: 500, fontFamily: BODY }}>
        {label}
      </div>
      <svg width={16} height={16} viewBox="0 0 16 16" fill="none">
        <path d="M6 4l4 4-4 4" stroke={C.muted} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    </div>
  );
}

export { C as AuthTheme };
