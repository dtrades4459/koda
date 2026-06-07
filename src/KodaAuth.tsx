import { useState, useEffect, useRef } from "react";
import { supabase } from "./lib/supabase";
import { installStorage, clearStorageCache } from "./lib/storage";
import type { Session } from "@supabase/supabase-js";
import Koda from "./Koda";
import { DARK } from "./theme";
import { KodaMark, FloatingInput, Kicker, MONO, BODY, DISPLAY } from "./shared";

// â”€â”€â”€ THEME (dark-only for auth surfaces) â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
const C = DARK;

// â”€â”€â”€ OAUTH BUTTON â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
function OAuthBtn({ label, provider, onClick }: {
  label: string; provider: "google" | "x" | "apple"; onClick?: () => void;
}) {
  const icons: Record<string, React.ReactNode> = {
    google: <svg width="16" height="16" viewBox="0 0 16 16"><path fill="#EA4335" d="M8 6.5v3.2h4.6c-.2 1.2-1.5 3.4-4.6 3.4-2.8 0-5-2.3-5-5.1S5.2 2.9 8 2.9c1.6 0 2.7.7 3.3 1.3l2.3-2.2C12.2 0.8 10.3 0 8 0 3.6 0 0 3.6 0 8s3.6 8 8 8c4.6 0 7.7-3.2 7.7-7.8 0-.5 0-.9-.1-1.3H8z"/></svg>,
    x: <svg width="14" height="14" viewBox="0 0 16 16"><path fill={C.text} d="M9.6 6.8L15.5 0H14L8.9 5.9 4.8 0H0l6.2 9-6.2 7h1.4l5.4-6.2L11.2 16H16L9.6 6.8zm-1.9 2.2l-.6-.9L2 1h2.2l4 5.7.6.9 5.2 7.4h-2.1L7.7 9z"/></svg>,
    apple: <svg width="16" height="16" viewBox="0 0 16 16"><path fill={C.text} d="M11.2 8.5c0-2 1.6-3 1.7-3-1-1.4-2.4-1.6-3-1.6-1.3-.1-2.5.7-3.1.7-.7 0-1.7-.7-2.7-.7-1.4 0-2.7.8-3.4 2-1.5 2.5-.4 6.3 1 8.3.7 1 1.6 2.1 2.7 2.1 1 0 1.5-.7 2.8-.7 1.3 0 1.7.7 2.8.7s1.9-1 2.6-2c.8-1.2 1.2-2.3 1.2-2.4-.1 0-2.4-.9-2.6-3.4z"/></svg>,
  };
  return (
    <div onClick={onClick} style={{
      display: "flex", alignItems: "center", gap: 12,
      padding: "11px 14px", borderRadius: 14,
      background: "transparent", border: `1px solid ${C.border2}`,
      fontFamily: BODY, fontSize: 13, fontWeight: 500, color: C.text,
      cursor: onClick ? "pointer" : "default",
      transition: "opacity 0.15s",
    }}>
      {icons[provider]}
      <span style={{ flex: 1 }}>{label}</span>
      <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
        <path d="M5 3l4 4-4 4" stroke={C.text2} strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round"/>
      </svg>
    </div>
  );
}

// â”€â”€â”€ AUTH FORM â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
type AuthMode = "signin" | "signup" | "reset" | "reset-sent" | "new-password";

const USERNAME_DOMAIN = "users.kodatrade.co.uk";
const usernameToEmail = (u: string) => `${u.toLowerCase().trim()}@${USERNAME_DOMAIN}`;
const USERNAME_RE = /^[a-z0-9_]{3,20}$/;

function AuthForm({ onSuccess, initialError = "", onModeChange, modeRequest }: {
  onSuccess: () => void; initialError?: string;
  onModeChange?: (m: "signin" | "signup") => void;
  /** Parent can request a mode switch + focus by bumping `nonce`. */
  modeRequest?: { mode: "signin" | "signup"; nonce: number };
}) {
  const [mode,          setMode]          = useState<AuthMode>("signin");
  const [username,      setUsername]      = useState("");
  const [password,      setPassword]      = useState("");
  const [newPassword,   setNewPassword]   = useState("");
  const [loading,       setLoading]       = useState(false);
  const [error,         setError]         = useState(initialError);
  const [msg,           setMsg]           = useState("");
  const [recoveryEmail, setRecoveryEmail] = useState("");
  const usernameInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event) => {
      if (event === "PASSWORD_RECOVERY") setMode("new-password");
    });
    return () => subscription.unsubscribe();
  }, []);

  // External mode-switch trigger from LandingPage CTA buttons. Nonce changes
  // even when the same mode is re-requested so consecutive clicks still
  // re-focus the input.
  useEffect(() => {
    if (!modeRequest) return;
    setMode(modeRequest.mode);
    setError(""); setMsg("");
    onModeChange?.(modeRequest.mode);
    requestAnimationFrame(() => usernameInputRef.current?.focus());
  }, [modeRequest?.nonce]); // eslint-disable-line react-hooks/exhaustive-deps

  async function handleSubmit() {
    const u = username.toLowerCase().trim();
    if (!u || !password) return;
    if (!USERNAME_RE.test(u)) { setError("Username must be 3–20 chars, lowercase letters, numbers, or underscores only."); return; }
    if (password.length < 6)  { setError("Password must be at least 6 characters."); return; }
    setLoading(true); setError(""); setMsg("");
    try {
      const email = usernameToEmail(u);
      if (mode === "signin") {
        const { error: e } = await supabase.auth.signInWithPassword({ email, password });
        if (e) throw e;
        onSuccess();
      } else {
        const { error: e } = await supabase.auth.signUp({
          email, password,
          options: { data: { username: u, ...(recoveryEmail.trim() ? { recovery_email: recoveryEmail.trim().toLowerCase() } : {}) } },
        });
        if (e) throw e;
        onSuccess();
      }
    } catch (e: any) {
      const raw = e?.message || "Something went wrong.";
      if (raw.toLowerCase().includes("invalid login")) {
        setError("Username or password incorrect.");
      } else if (raw.toLowerCase().includes("already registered")) {
        setError("That username is taken. Try a different one.");
      } else {
        setError(raw);
      }
    } finally {
      setLoading(false);
    }
  }

  async function handleReset() {
    const u = username.toLowerCase().trim();
    if (!u) { setError("Enter your username."); return; }
    if (!USERNAME_RE.test(u)) { setError("Invalid username format."); return; }
    setLoading(true); setError("");
    try {
      const r = await fetch("/api/account?action=reset-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username: u }),
      });
      if (!r.ok) throw new Error("Failed to request reset");
      setMode("reset-sent");
    } catch (e: any) {
      setError(e?.message || "Failed to send reset link. Try again.");
    } finally {
      setLoading(false);
    }
  }

  async function handleNewPassword() {
    if (newPassword.length < 6) { setError("Password must be at least 6 characters."); return; }
    setLoading(true); setError("");
    try {
      const { error: e } = await supabase.auth.updateUser({ password: newPassword });
      if (e) throw e;
      onSuccess();
    } catch (e: any) {
      setError(e?.message || "Failed to update password. Try again.");
    } finally {
      setLoading(false);
    }
  }

  async function signInWithOAuth(provider: "google" | "twitter" | "apple") {
    await supabase.auth.signInWithOAuth({
      provider,
      options: {
        redirectTo: window.location.origin,
        ...(provider === "google" ? { queryParams: { prompt: "select_account" } } : {}),
      },
    });
  }

  /* â”€â”€ Reset sent â”€â”€ */
  if (mode === "reset-sent") {
    return (
      <div style={{ position: "relative", zIndex: 1 }}>
        <div style={{ fontFamily: MONO, fontSize: 10, color: C.green, letterSpacing: "0.10em", textTransform: "uppercase", marginBottom: 16 }}>
          Check your recovery email
        </div>
        <p style={{ fontSize: 14, color: C.text2, lineHeight: 1.65, marginBottom: 20, fontFamily: BODY }}>
          If you added a recovery email at signup, your reset link is on its way. Check your inbox and spam folder.
        </p>
        <button onClick={() => { setMode("signin"); setUsername(""); setError(""); }} style={{
          background: "transparent", color: C.text, border: `1px solid ${C.border2}`,
          borderRadius: 999, padding: "12px 20px", fontSize: 13, fontFamily: BODY,
          cursor: "pointer", width: "100%",
        }}>Back to sign in</button>
      </div>
    );
  }

  /* â”€â”€ New password â”€â”€ */
  if (mode === "new-password") {
    return (
      <div style={{ position: "relative", zIndex: 1 }}>
        <div style={{ fontFamily: MONO, fontSize: 10, color: C.muted, letterSpacing: "0.10em", textTransform: "uppercase", marginBottom: 20 }}>
          Set new password
        </div>
        <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
          <FloatingInput C={C} label="New password" placeholder="min. 6 characters" value={newPassword}
            onChange={v => setNewPassword(v)} type="password" />
          {error && <div style={{ fontSize: 13, color: C.red, fontFamily: BODY }}>{error}</div>}
          <button onClick={handleNewPassword} disabled={loading} style={{
            background: C.text, color: C.bg, border: "none", borderRadius: 999,
            padding: "14px 20px", fontSize: 13, fontFamily: BODY, cursor: "pointer", width: "100%",
            opacity: loading ? 0.6 : 1,
          }}>{loading ? "…" : "Update password →"}</button>
        </div>
      </div>
    );
  }

  /* â”€â”€ Reset form â”€â”€ */
  if (mode === "reset") {
    return (
      <div style={{ position: "relative", zIndex: 1 }}>
        <div style={{ fontFamily: MONO, fontSize: 10, color: C.muted, letterSpacing: "0.10em", textTransform: "uppercase", marginBottom: 20 }}>
          Reset password
        </div>
        <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
          <FloatingInput C={C} label="Username" placeholder="yourname" value={username}
            onChange={v => setUsername(v.toLowerCase())} />
          {error && <div style={{ fontSize: 13, color: C.red, fontFamily: BODY }}>{error}</div>}
          <button onClick={handleReset} disabled={loading} style={{
            background: C.text, color: C.bg, border: "none", borderRadius: 999,
            padding: "14px 20px", fontSize: 13, fontFamily: BODY, cursor: "pointer", width: "100%",
            opacity: loading ? 0.6 : 1,
          }}>{loading ? "…" : "Send reset link →"}</button>
          <button onClick={() => { setMode("signin"); setError(""); }} style={{
            background: "none", border: "none", color: C.muted, fontSize: 12,
            cursor: "pointer", fontFamily: BODY, textAlign: "left", padding: 0,
          }}>← Back to sign in</button>
        </div>
      </div>
    );
  }

  /* â”€â”€ Main sign-in / sign-up â”€â”€ */
  return (
    <div style={{ position: "relative", zIndex: 1 }}>
      {/* OAuth first — frictionless one-tap path for both modes */}
      <div style={{ display: "flex", flexDirection: "column", gap: 10, marginBottom: 18 }}>
        <OAuthBtn label="Continue with Google" provider="google" onClick={() => signInWithOAuth("google")} />
      </div>

      {/* OR divider */}
      <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 18 }}>
        <div style={{ flex: 1, height: 1, background: C.border2 }} />
        <span style={{ fontFamily: MONO, fontSize: 9, letterSpacing: "0.16em", color: C.muted }}>OR</span>
        <div style={{ flex: 1, height: 1, background: C.border2 }} />
      </div>

      {/* Mode tabs */}
      <div style={{ display: "flex", gap: 20, marginBottom: 22 }}>
        {(["signin", "signup"] as AuthMode[]).map(m => (
          <button key={m} onClick={() => { setMode(m); setError(""); setMsg(""); onModeChange?.(m as "signin" | "signup"); }}
            style={{
              background: "none", border: "none", padding: 0,
              color: mode === m ? C.text : C.muted,
              borderBottom: mode === m ? `1px solid ${C.text}` : "1px solid transparent",
              paddingBottom: 4, cursor: "pointer",
              fontFamily: MONO, fontSize: 11, letterSpacing: "0.06em", textTransform: "uppercase",
            }}>
            {m === "signin" ? "Sign in" : "Sign up"}
          </button>
        ))}
      </div>

      {/* Enter key submits via form onSubmit */}
      <form onSubmit={e => { e.preventDefault(); handleSubmit(); }}>
        <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
          <FloatingInput C={C} label="Username" value={username} placeholder={mode === "signup" ? "pick a handle" : "yourname"}
            onChange={v => setUsername(v.toLowerCase())} inputRef={usernameInputRef} />

          <FloatingInput C={C} label="Password" value={password} placeholder={mode === "signup" ? "min. 6 characters" : "••••••••"}
            onChange={v => setPassword(v)} type="password" />

          {error && <div style={{ fontSize: 13, color: C.red, marginTop: 4, fontFamily: BODY }}>{error}</div>}
          {msg   && <div style={{ fontSize: 13, color: C.green, marginTop: 4, fontFamily: BODY }}>{msg}</div>}

          <button type="submit" data-testid="auth-submit" disabled={loading} style={{
            background: C.text, color: C.bg, border: "none", borderRadius: 999,
            padding: "14px 20px", fontSize: 13, fontWeight: 500, fontFamily: BODY,
            cursor: "pointer", width: "100%", marginTop: 8,
            opacity: loading ? 0.6 : 1, transition: "opacity 0.15s, transform 0.15s",
          }}>
            {loading ? "…" : mode === "signin" ? "Sign in →" : "Create account →"}
          </button>

          {mode === "signup" && (
            <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
              <FloatingInput C={C} label="Recovery email (optional)" value={recoveryEmail}
                placeholder="you@example.com" onChange={v => setRecoveryEmail(v)} />
              <div style={{ fontSize: 11, color: C.muted, marginTop: 2, fontFamily: BODY, lineHeight: 1.5 }}>
                Add this now — it's the only way to recover your account if you forget your password.
              </div>
            </div>
          )}

          {mode === "signin" && (
            <button type="button" onClick={() => { setMode("reset"); setError(""); }} style={{
              background: "none", border: "none", color: C.muted, fontSize: 12,
              cursor: "pointer", fontFamily: BODY, textAlign: "left", padding: 0, marginTop: 2,
            }}>Forgot password?</button>
          )}
        </div>
      </form>
    </div>
  );
}

// â”€â”€â”€ PARSE OAUTH ERROR FROM URL HASH â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
function parseOAuthError(): string {
  const hash = window.location.hash.slice(1);
  if (!hash.includes("error=")) return "";
  const params = new URLSearchParams(hash);
  const code = params.get("error") ?? "";
  const desc = params.get("error_description") ?? "";
  history.replaceState(null, "", window.location.pathname + window.location.search);
  if (code === "access_denied" || desc.toLowerCase().includes("cancel")) {
    return "Google sign-in was cancelled. Use your username and password instead.";
  }
  if (desc) return `Sign-in failed: ${desc.replace(/\+/g, " ")}. Please use username and password.`;
  return "Google sign-in isn’t available. Please use your username and password.";
}

// â”€â”€â”€ LANDING PAGE â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
function LandingPage({ onSuccess }: { onSuccess: () => void }) {
  const [oauthError] = useState(() => parseOAuthError());
  const [authMode, setAuthMode] = useState<"signin" | "signup">("signin");
  const [modeRequest, setModeRequest] = useState<{ mode: "signin" | "signup"; nonce: number } | undefined>();
  const authRef     = useRef<HTMLElement>(null);
  const featuresRef = useRef<HTMLElement>(null);

  const handleStarted = () => {
    setModeRequest({ mode: "signup", nonce: Date.now() });
    authRef.current?.scrollIntoView({ behavior: "smooth", block: "center" });
  };
  const handleSeeAction = () => {
    featuresRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
  };
  const handleSignIn = () => {
    setModeRequest({ mode: "signin", nonce: Date.now() });
    authRef.current?.scrollIntoView({ behavior: "smooth", block: "center" });
  };

  return (
    <div className="koda-landing" style={{
      minHeight: "100dvh", background: C.bg, color: C.text, fontFamily: BODY,
      position: "relative", overflow: "hidden",
    }}>
      <style>{`
        *{box-sizing:border-box;margin:0;padding:0;}
        html,body{-webkit-font-smoothing:antialiased;-moz-osx-font-smoothing:grayscale;scroll-behavior:smooth;}
        @keyframes rise{from{opacity:0;transform:translateY(10px)}to{opacity:1;transform:translateY(0)}}
        @keyframes orbDrift{0%,100%{transform:translateX(-50%) scale(1) translate(0,0)}50%{transform:translateX(-50%) scale(1.06) translate(20px,-12px)}}
        @media (prefers-reduced-motion: reduce){
          *{animation:none!important;transition:none!important;scroll-behavior:auto!important;}
        }

        .koda-landing input::placeholder{color:${C.dim};font-weight:400;}
        .koda-landing input:focus{border-bottom-color:${C.text}!important;}
        .koda-landing button:hover:not(:disabled),
        .koda-landing a:hover{opacity:0.85;}
        .koda-landing button:active:not(:disabled){transform:scale(0.98);}
        .koda-landing a{text-decoration:none;color:inherit;}

        .koda-shell{max-width:1440px;margin:0 auto;padding:24px 24px 80px;position:relative;z-index:1;}
        .koda-grid{display:grid;grid-template-columns:1fr;gap:56px;margin-top:56px;}

        .koda-mast-nav{display:none;}
        @media(min-width:720px){.koda-mast-nav{display:flex;gap:26px;}}

        @media(min-width:900px){
          .koda-shell{padding:36px 56px 96px;}
          .koda-grid{grid-template-columns:minmax(0,1.45fr) minmax(320px,440px);gap:80px;margin-top:96px;align-items:start;}
          .koda-auth-card{position:sticky;top:36px;}
        }
        @media(min-width:1280px){
          .koda-shell{padding:44px 88px 120px;}
          .koda-grid{gap:120px;}
        }

        .koda-strategies{display:grid;grid-template-columns:1fr;border-top:1px solid ${C.border};}
        @media(min-width:900px){.koda-strategies{grid-template-columns:1fr 1fr;}}
        .koda-strat-item{padding:28px 0;border-bottom:1px solid ${C.border};}
        @media(min-width:900px){
          .koda-strat-item{padding:32px 40px 32px 0;}
          .koda-strat-item:nth-child(odd){border-right:1px solid ${C.border};}
          .koda-strat-item:nth-child(even){padding-left:40px;padding-right:0;}
        }

        .koda-features{display:grid;grid-template-columns:1fr;gap:16px;}
        @media(min-width:680px){.koda-features{grid-template-columns:1fr 1fr;}}
        @media(min-width:1100px){.koda-features{grid-template-columns:1fr 1fr 1fr 1fr;}}
        .koda-feat{padding:22px;border-radius:18px;background:${C.panel};border:1px solid ${C.border};display:flex;flex-direction:column;gap:10px;}
        a.koda-feat{transition:border-color 0.18s, transform 0.18s;}
        a.koda-feat:hover{border-color:${C.border2};transform:translateY(-2px);}

        .koda-pricing{display:grid;grid-template-columns:1fr;gap:20px;}
        @media(min-width:780px){.koda-pricing{grid-template-columns:1fr 1fr;}}

        .koda-anchor{scroll-margin-top:36px;}

        .koda-section-label{
          font-family:${MONO};font-size:11px;color:${C.muted};
          letter-spacing:0.14em;text-transform:uppercase;
          margin-bottom:18px;display:flex;align-items:center;gap:12px;
        }
        .koda-section-label::before{
          content:"";flex:0 0 32px;height:1px;background:${C.border2};display:block;
        }

        .koda-section-h2{
          font-family:${DISPLAY};font-size:clamp(28px,4vw,42px);
          font-weight:600;letter-spacing:-0.02em;line-height:1.1;
          color:${C.text};margin-bottom:14px;max-width:22ch;
        }
        .koda-section-sub{
          font-size:clamp(15px,1.3vw,17px);color:${C.text2};
          line-height:1.6;max-width:58ch;margin-bottom:36px;
        }
      `}</style>

      {/* â”€â”€ Background orbs (multi-color ambient blooms) â”€â”€ */}
      {/* Single signature ambient orb per DESIGN.md warmth-pass guidance. */}
      <div style={{
        position: "absolute", top: "-8%", left: "50%", transform: "translateX(-50%)",
        width: 900, height: 500, borderRadius: "50%",
        background: `radial-gradient(ellipse, ${C.orb1} 0%, ${C.orb2} 30%, transparent 65%)`,
        filter: "blur(80px)", opacity: 0.45, pointerEvents: "none",
        animation: "orbDrift 10s ease-in-out infinite",
      }} />

      <div className="koda-shell" style={{ animation: "rise 0.5s ease" }}>

        {/* â”€â”€ MASTHEAD â”€â”€ */}
        <header style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 16 }}>
          <a href="/" style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <KodaMark size={26} color={C.text} />
            <span style={{ fontFamily: BODY, fontSize: 15, fontWeight: 600, letterSpacing: "0.20em", color: C.text, lineHeight: 1 }}>Kōda</span>
          </a>
          <nav className="koda-mast-nav" style={{ alignItems: "center" }}>
            {[
              ["Intervention", "/in-session-intervention.html"],
              ["Circles", "/trading-circles.html"],
              ["Compare", "/comparison.html"],
              ["FAQ", "/faq.html"],
            ].map(([label, href]) => (
              <a key={label} href={href} style={{
                fontFamily: BODY, fontSize: 13, color: C.text2,
                fontWeight: 500, letterSpacing: "0.01em",
              }}>{label}</a>
            ))}
          </nav>
          <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
            <button onClick={handleSignIn} type="button" style={{
              background: "none", border: "none", padding: 0,
              fontFamily: BODY, fontSize: 13, color: C.text, fontWeight: 500,
              letterSpacing: "0.01em", cursor: "pointer",
            }}>Sign in</button>
            <span style={{ fontFamily: MONO, fontSize: 10, color: C.muted, letterSpacing: "0.08em" }}>BETA / 2026</span>
          </div>
        </header>

        {/* â”€â”€ GRID â”€â”€ */}
        <div className="koda-grid">

          {/* Hero column */}
          <div style={{ minWidth: 0 }}>
            {/* Small pill above headline */}
            <div style={{
              display: "inline-flex", alignItems: "center", gap: 8,
              padding: "6px 14px 6px 8px", borderRadius: 999, marginBottom: 28,
              background: "rgba(255,255,255,0.05)", border: `1px solid ${C.border2}`,
              backdropFilter: "blur(12px)",
            }}>
              <span style={{
                width: 22, height: 22, borderRadius: 999, background: C.live,
                display: "flex", alignItems: "center", justifyContent: "center",
                fontFamily: MONO, fontSize: 9, fontWeight: 700, color: "#0A0A0A",
              }}>v1</span>
              <span style={{ fontFamily: MONO, fontSize: 11, color: C.text, letterSpacing: "0.04em" }}>
                <span style={{ color: C.live, fontWeight: 600 }}>CSV import live</span> · Tradovate auto-sync coming
              </span>
            </div>

            <h1 style={{
              fontFamily: DISPLAY,
              fontSize: "clamp(52px, 9vw, 128px)",
              fontWeight: 600,
              letterSpacing: "-0.03em",
              lineHeight: 1.0,
              color: C.text,
              marginBottom: 24,
              textShadow: `0 0 60px ${C.orb1}60, 0 0 120px ${C.orb3}40`,
            }}>
              The journal that<br />
              stops you <span style={{ fontStyle: "italic", fontWeight: 500, color: C.live }}>mid-tilt.</span>
            </h1>

            <p style={{ fontSize: "clamp(15px, 1.4vw, 17px)", color: C.text2, lineHeight: 1.65, maxWidth: 580, fontWeight: 400, marginBottom: 36 }}>
              Every other journal asks <em>what went wrong?</em> after the money's gone.
              Kōda asks <em>are you sure?</em> before you take the trade. Free forever to log and review.
            </p>

            {/* CTA row — wired buttons */}
            <div style={{ display: "flex", gap: 10, marginBottom: 32, flexWrap: "wrap" }}>
              <button type="button" onClick={handleStarted} style={{
                display: "flex", alignItems: "center", gap: 10,
                padding: "8px 8px 8px 22px", borderRadius: 999,
                background: C.text, color: C.bg, border: "none",
                fontFamily: BODY, fontSize: 14, fontWeight: 600, cursor: "pointer",
                transition: "opacity 0.15s, transform 0.15s",
              }}>
                Get started free
                <span style={{
                  width: 32, height: 32, borderRadius: 999, background: C.live,
                  display: "flex", alignItems: "center", justifyContent: "center",
                }}>
                  <svg width="14" height="14" viewBox="0 0 16 16" fill="none">
                    <path d="M3 8h10M9 4l4 4-4 4" stroke="#0A0A0A" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round"/>
                  </svg>
                </span>
              </button>
              <button type="button" onClick={handleSeeAction} style={{
                padding: "12px 22px", borderRadius: 999, background: "transparent",
                color: C.text, border: `1px solid ${C.border2}`,
                fontFamily: BODY, fontSize: 14, fontWeight: 500, cursor: "pointer",
                transition: "opacity 0.15s, transform 0.15s",
              }}>See what&apos;s included</button>
            </div>

            {/* Feature chips */}
            <div style={{ display: "flex", gap: 10, flexWrap: "wrap", marginBottom: 48 }}>
              {([
                ["ICT", "Smart Money"], ["ORB", "Opening Range"],
                ["S&D", "Supply / Demand"], ["WYC", "Wyckoff / VSA"], ["+", "Your own"],
              ] as [string, string][]).map(([code, label]) => (
                <div key={code} style={{
                  display: "flex", alignItems: "center", gap: 8,
                  padding: "5px 12px 5px 5px", borderRadius: 999,
                  background: "rgba(255,255,255,0.04)", border: `1px solid ${C.border}`,
                }}>
                  <div style={{
                    width: 26, height: 26, borderRadius: 999,
                    background: C.accentSoft, border: `1px solid ${C.border2}`,
                    display: "flex", alignItems: "center", justifyContent: "center",
                    color: C.accent, fontFamily: MONO, fontSize: 9, fontWeight: 600,
                  }}>{code}</div>
                  <span style={{ fontFamily: BODY, fontSize: 12, color: C.text2 }}>{label}</span>
                </div>
              ))}
            </div>
          </div>

          {/* Auth column — glass card with corner glow + OS badge */}
          <aside ref={authRef} id="auth" className="koda-auth-card koda-anchor" style={{
            position: "relative", padding: 32, borderRadius: 28,
            background: "rgba(19,19,23,0.7)",
            backdropFilter: "blur(28px) saturate(180%)",
            WebkitBackdropFilter: "blur(28px) saturate(180%)",
            border: `1px solid ${C.border2}`,
            boxShadow: `0 30px 80px rgba(0,0,0,0.5), inset 0 1px 0 rgba(255,255,255,0.06)`,
            overflow: "hidden",
            animation: "kRise 0.42s ease-out",
          }}>
            {/* Iridescent corner glow */}
            <div style={{
              position: "absolute", top: -80, left: -80, width: 280, height: 280,
              borderRadius: "50%",
              background: `conic-gradient(from 200deg at 50% 50%, ${C.orb3}, ${C.accent}, ${C.orb2}, ${C.orb3})`,
              filter: "blur(50px)", opacity: 0.4, pointerEvents: "none",
            }} />

            {/* Logo + OS badge */}
            <div style={{
              position: "relative", zIndex: 1, display: "flex", alignItems: "center",
              gap: 9, justifyContent: "center", marginBottom: 26,
            }}>
              <KodaMark size={24} color={C.text} />
              <span style={{ fontFamily: DISPLAY, fontWeight: 600, fontSize: 14, letterSpacing: "0.22em", color: C.text }}>Kōda</span>
              <span style={{
                fontFamily: MONO, fontWeight: 500, fontSize: 9, letterSpacing: "0.16em",
                color: C.text, padding: "2px 6px", borderRadius: 4,
                border: `1px solid ${C.border2}`, lineHeight: 1,
              }}>OS</span>
            </div>

            {/* Kicker */}
            <div style={{ position: "relative", zIndex: 1, textAlign: "center", marginBottom: 8 }}>
              <Kicker C={C} color={C.live}>{authMode === "signin" ? "Welcome back" : "Create account"}</Kicker>
            </div>

            {/* Editorial heading with italic accent */}
            <div style={{ position: "relative", zIndex: 1, textAlign: "center", marginBottom: 8 }}>
              <h2 style={{
                fontFamily: DISPLAY, fontSize: 32, fontWeight: 600,
                letterSpacing: "-0.03em", color: C.text, margin: 0, lineHeight: 1.05,
              }}>
                {authMode === "signin"
                  ? <>Sign back <span style={{ fontStyle: "italic", fontWeight: 500, color: C.live }}>in.</span></>
                  : <>Start your <span style={{ fontStyle: "italic", fontWeight: 500, color: C.live }}>journal.</span></>}
              </h2>
            </div>
            <div style={{ position: "relative", zIndex: 1, textAlign: "center", marginBottom: 22 }}>
              <span style={{ fontFamily: BODY, fontSize: 13, color: C.text2 }}>
                {authMode === "signin" ? "Pick up where you left off." : "Free forever. No card to start."}
              </span>
            </div>

            {oauthError && (
              <div style={{
                position: "relative", zIndex: 1, fontFamily: BODY, fontSize: 13, color: C.red,
                marginBottom: 16, padding: "12px 16px",
                background: "rgba(255,80,60,0.06)", borderRadius: 8,
                border: "1px solid rgba(255,80,60,0.15)",
              }}>{oauthError}</div>
            )}

            <AuthForm
              onSuccess={onSuccess}
              initialError=""
              onModeChange={setAuthMode}
              modeRequest={modeRequest}
            />
          </aside>
        </div>

        {/* ── FOUR PILLARS ── */}
        <section style={{
          marginTop: "clamp(56px, 7vw, 96px)",
          display: "flex",
          justifyContent: "center",
        }}>
          <div style={{
            display: "flex",
            alignItems: "center",
            gap: "clamp(18px, 3vw, 36px)",
            flexWrap: "wrap",
            justifyContent: "center",
          }}>
            {[
              { n: "01", w: "log",       accent: false },
              { n: "02", w: "review",    accent: false },
              { n: "03", w: "intervene", accent: false },
              { n: "04", w: "improve",   accent: true  },
            ].map((p, i, arr) => (
              <div key={p.n} style={{ display: "flex", alignItems: "center", gap: "clamp(18px, 3vw, 36px)" }}>
                <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 6 }}>
                  <span style={{
                    fontFamily: MONO, fontWeight: 500, fontSize: 11,
                    letterSpacing: "0.18em",
                    color: p.accent ? C.live : C.muted,
                  }}>{p.n}</span>
                  <span style={{
                    fontFamily: BODY, fontStyle: "italic",
                    fontWeight: p.accent ? 500 : 400, fontSize: 18,
                    color: p.accent ? C.live : C.dim,
                  }}>{p.w}</span>
                </div>
                {i < arr.length - 1 && (
                  <svg width="14" height="11" viewBox="0 0 14 11" style={{ opacity: 0.4, marginTop: 10, flexShrink: 0 }}>
                    <path d="M2 1l4 4.5-4 4.5M7 1l4 4.5-4 4.5" stroke={C.text} strokeWidth="1" fill="none" strokeLinecap="round"/>
                  </svg>
                )}
              </div>
            ))}
          </div>
        </section>

        {/* â”€â”€ BUILT-IN STRATEGIES â”€â”€ */}
        {/* WHAT'S INCLUDED — eight-tile feature grid; featuresRef target for the See-it-in-action CTA. */}
        <section ref={featuresRef} id="features" className="koda-anchor" style={{ marginTop: "clamp(80px, 10vw, 128px)" }}>
          <div className="koda-section-label">WHAT&apos;S INCLUDED</div>
          <h2 className="koda-section-h2">Everything a journal should do, plus the part most skip.</h2>
          <p className="koda-section-sub">
            Logging trades is table stakes. Kōda&apos;s wedge is what happens
            between the trades &mdash; the moment you&apos;re about to take one you shouldn&apos;t.
          </p>

          <div className="koda-features">
            {[
              { tag: "WEDGE", accent: true,  title: "Tilt intervention",   body: "Tap Log Trade on a tilt signal and the form doesn't open. A sheet does, with the choice to acknowledge or lock out for 15 minutes.", href: "/in-session-intervention.html" },
              { tag: "SCORE", accent: false, title: "Discipline score",    body: "A+ to F, rolling seven days. Built from rule adherence and mistake tagging, not from P&L." },
              { tag: "SOCIAL", accent: true, title: "Trading Circles",     body: "Private groups of 3 to 20. Live leaderboards, group chat, weekly challenges. Accountability your friends can see.", href: "/trading-circles.html" },
              { tag: "FEED",  accent: false, title: "Ideas feed",          body: "Pre-trade setups and post-trade breakdowns. Public if you want it, private by default." },
              { tag: "SYNC",  accent: false, title: "CSV import",          body: "Tradovate, Rithmic, TradingView, NinjaTrader 8, TopstepX, FTMO, MT4 and MT5. Live Tradovate auto-sync coming." },
              { tag: "STATS", accent: false, title: "Stats dashboard",     body: "Win rate, average R, streaks, time-on-tilt counters. Numbers that actually move your edge." },
              { tag: "PROP",  accent: false, title: "Prop firm tracker",   body: "Profit target, daily loss, max drawdown. Built for Topstep, FTMO, and the eval grind." },
              { tag: "TAG",   accent: false, title: "Strategy tagging",    body: "Tag every trade with ICT, Supply & Demand, Wyckoff, or Opening Range. Custom setups on Pro." },
            ].map((f) => {
              const inner = (
                <>
                  <div style={{
                    display: "inline-flex", alignSelf: "flex-start",
                    fontFamily: MONO, fontSize: 9, fontWeight: 600,
                    letterSpacing: "0.16em", textTransform: "uppercase",
                    color: f.accent ? C.live : C.muted,
                    padding: "3px 8px", borderRadius: 999,
                    background: f.accent ? `color-mix(in oklch, ${C.live} 12%, transparent)` : "transparent",
                    border: f.accent ? `1px solid color-mix(in oklch, ${C.live} 28%, transparent)` : `1px solid ${C.border2}`,
                  }}>{f.tag}</div>
                  <div style={{ fontFamily: DISPLAY, fontSize: 18, fontWeight: 600, letterSpacing: "-0.01em", color: C.text }}>{f.title}</div>
                  <div style={{ fontSize: 14, color: C.text2, lineHeight: 1.55 }}>{f.body}</div>
                  {f.href && (
                    <span style={{ fontFamily: BODY, fontSize: 12, color: C.live, marginTop: 4, display: "inline-flex", alignItems: "center", gap: 4 }}>Learn more →</span>
                  )}
                </>
              );
              return f.href
                ? <a key={f.title} href={f.href} className="koda-feat">{inner}</a>
                : <div key={f.title} className="koda-feat">{inner}</div>;
            })}
          </div>
        </section>

        {/* BUILT-IN STRATEGIES */}
        <section style={{ marginTop: "clamp(80px, 10vw, 128px)" }}>
          <div className="koda-section-label">BUILT-IN STRATEGIES</div>
          <h2 className="koda-section-h2">Strategies you can tag from day one.</h2>
          <div className="koda-strategies">
            {[
              { n: "01", name: "ICT / Smart Money",     desc: "Order blocks, fair value gaps, liquidity sweeps. Mark your bias before the open." },
              { n: "02", name: "Supply & Demand",        desc: "Fresh zones, base-to-base, institutional imbalances. No stale levels." },
              { n: "03", name: "Wyckoff / VSA",          desc: "Accumulation, distribution, spring and upthrust. Read the auction, not the candle." },
              { n: "04", name: "Opening Range Breakout", desc: "First 15–30 min range. Clean breakouts with defined risk." },
            ].map((s) => (
              <div key={s.n} className="koda-strat-item">
                <div style={{ display: "flex", alignItems: "baseline", gap: 14, marginBottom: 10 }}>
                  <span style={{ fontFamily: MONO, fontSize: 10, color: C.muted, letterSpacing: "0.08em" }}>{s.n}</span>
                  <span style={{ flex: 1, height: 1, background: C.border }} />
                </div>
                <h3 style={{ fontFamily: DISPLAY, fontSize: "clamp(20px, 2.2vw, 26px)", fontWeight: 500, letterSpacing: "-0.02em", lineHeight: 1.1, color: C.text, marginBottom: 10 }}>
                  {s.name}
                </h3>
                <p style={{ fontSize: 14, color: C.text2, lineHeight: 1.6, fontWeight: 400, maxWidth: "46ch" }}>{s.desc}</p>
              </div>
            ))}
          </div>
        </section>

        {/* PRICING — Free vs Pro side-by-side. Free-tier-first per the wedge in the comparison page. */}
        <section id="pricing" className="koda-anchor" style={{ marginTop: "clamp(80px, 10vw, 128px)" }}>
          <div className="koda-section-label">PRICING</div>
          <h2 className="koda-section-h2">Free is real. Pro is when you outgrow it.</h2>
          <p className="koda-section-sub">
            No trial timer, no card on file. The free tier covers everything most retail
            futures traders need. Pro unlocks the social and analytics layer.
          </p>

          <div className="koda-pricing">
            {/* Free */}
            <div style={{
              padding: 28, borderRadius: 22,
              background: C.panel, border: `1px solid ${C.border}`,
              display: "flex", flexDirection: "column", gap: 18,
            }}>
              <div style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between", gap: 12 }}>
                <div style={{ fontFamily: DISPLAY, fontSize: 22, fontWeight: 600, color: C.text }}>Free</div>
                <div style={{ fontFamily: MONO, fontSize: 11, color: C.muted, letterSpacing: "0.08em", textTransform: "uppercase" }}>Forever</div>
              </div>
              <div style={{ display: "flex", alignItems: "baseline", gap: 8 }}>
                <span style={{ fontFamily: DISPLAY, fontSize: 44, fontWeight: 600, color: C.text, letterSpacing: "-0.02em" }}>£0</span>
                <span style={{ fontFamily: BODY, fontSize: 14, color: C.text2 }}>/ month</span>
              </div>
              <ul style={{ listStyle: "none", padding: 0, margin: 0, display: "flex", flexDirection: "column", gap: 10 }}>
                {[
                  "Unlimited trade logging",
                  "Full stats dashboard",
                  "Tilt intervention",
                  "Discipline score",
                  "Prop firm eval tracker",
                  "Ideas feed",
                  "Kōda global Circle + 2 Circles (join or create)",
                  "iOS + Android (PWA)",
                ].map((item) => (
                  <li key={item} style={{ fontFamily: BODY, fontSize: 14, color: C.text2, display: "flex", alignItems: "flex-start", gap: 10 }}>
                    <svg width="14" height="14" viewBox="0 0 14 14" style={{ marginTop: 4, flexShrink: 0 }}>
                      <path d="M2 7l3.5 3.5L12 3.5" stroke={C.live} strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" fill="none"/>
                    </svg>
                    {item}
                  </li>
                ))}
              </ul>
              <button type="button" onClick={handleStarted} style={{
                background: C.text, color: C.bg, border: "none", borderRadius: 999,
                padding: "13px 20px", fontSize: 13, fontFamily: BODY, fontWeight: 600,
                cursor: "pointer", width: "100%", marginTop: 6,
                transition: "opacity 0.15s, transform 0.15s",
              }}>Start free →</button>
            </div>

            {/* Pro */}
            <div style={{
              padding: 28, borderRadius: 22,
              background: C.panel,
              border: `1px solid color-mix(in oklch, ${C.accent} 36%, transparent)`,
              display: "flex", flexDirection: "column", gap: 18,
              position: "relative", overflow: "hidden",
            }}>
              {/* Subtle accent wash on the Pro card — not a full sparkle, just a tint. */}
              <div style={{
                position: "absolute", top: -100, right: -100, width: 240, height: 240,
                background: `radial-gradient(circle, ${C.accentSoft} 0%, transparent 60%)`,
                pointerEvents: "none",
              }} />
              <div style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between", gap: 12, position: "relative", zIndex: 1 }}>
                <div style={{ display: "flex", alignItems: "baseline", gap: 10 }}>
                  <div style={{ fontFamily: DISPLAY, fontSize: 22, fontWeight: 600, color: C.text }}>Pro</div>
                  <span style={{
                    fontFamily: MONO, fontSize: 9, fontWeight: 600,
                    letterSpacing: "0.16em", textTransform: "uppercase",
                    color: C.accent, padding: "3px 8px", borderRadius: 999,
                    background: C.accentSoft,
                    border: `1px solid color-mix(in oklch, ${C.accent} 36%, transparent)`,
                  }}>Recommended</span>
                </div>
                <div style={{ fontFamily: MONO, fontSize: 11, color: C.muted, letterSpacing: "0.08em", textTransform: "uppercase" }}>Pay monthly</div>
              </div>
              <div style={{ display: "flex", alignItems: "baseline", gap: 8, position: "relative", zIndex: 1 }}>
                <span style={{ fontFamily: DISPLAY, fontSize: 44, fontWeight: 600, color: C.text, letterSpacing: "-0.02em" }}>£24.99</span>
                <span style={{ fontFamily: BODY, fontSize: 14, color: C.text2 }}>/ month</span>
              </div>
              <div style={{ fontFamily: BODY, fontSize: 12, color: C.muted, marginTop: -8, position: "relative", zIndex: 1 }}>
                Or <span style={{ color: C.text2, fontWeight: 600 }}>£199 / year</span> &mdash; equivalent to £16.58 / month, save £100.
              </div>
              <ul style={{ listStyle: "none", padding: 0, margin: 0, display: "flex", flexDirection: "column", gap: 10, position: "relative", zIndex: 1 }}>
                {[
                  "Everything in Free",
                  "Unlimited Trading Circles",
                  "Advanced analytics (MAE / MFE, heatmaps, drawdown curves)",
                  "Custom strategy slots",
                  "Weekly digest emails",
                ].map((item) => (
                  <li key={item} style={{ fontFamily: BODY, fontSize: 14, color: C.text2, display: "flex", alignItems: "flex-start", gap: 10 }}>
                    <svg width="14" height="14" viewBox="0 0 14 14" style={{ marginTop: 4, flexShrink: 0 }}>
                      <path d="M2 7l3.5 3.5L12 3.5" stroke={C.accent} strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" fill="none"/>
                    </svg>
                    {item}
                  </li>
                ))}
              </ul>
              <button type="button" onClick={handleStarted} style={{
                background: "transparent", color: C.text,
                border: `1px solid ${C.border2}`, borderRadius: 999,
                padding: "13px 20px", fontSize: 13, fontFamily: BODY, fontWeight: 600,
                cursor: "pointer", width: "100%", marginTop: 6, position: "relative", zIndex: 1,
                transition: "opacity 0.15s, transform 0.15s",
              }}>Start free, upgrade anytime →</button>
            </div>
          </div>
        </section>

        {/* COMPARISON TEASER — links to existing /comparison.html */}
        <section style={{ marginTop: "clamp(80px, 10vw, 128px)" }}>
          <a href="/comparison.html" style={{
            display: "block", padding: "clamp(28px, 4vw, 48px)",
            borderRadius: 24, background: C.panel,
            border: `1px solid ${C.border}`,
            position: "relative", overflow: "hidden",
          }}>
            <div className="koda-section-label" style={{ marginBottom: 14 }}>KŌDA VS THE REST</div>
            <div style={{
              fontFamily: DISPLAY, fontSize: "clamp(22px, 2.6vw, 30px)",
              fontWeight: 500, letterSpacing: "-0.015em", lineHeight: 1.3,
              color: C.text, maxWidth: "44ch", marginBottom: 18,
            }}>
              Most trading journals analyse the trade after the loss. Kōda intervenes before it.
              The honest question is which one your <span style={{ fontStyle: "italic", color: C.live }}>actual</span> losses come from.
            </div>
            <span style={{
              fontFamily: BODY, fontSize: 14, fontWeight: 600,
              color: C.live, display: "inline-flex", alignItems: "center", gap: 6,
            }}>Read the full comparison →</span>
          </a>
        </section>

        {/* FOUNDER NOTE — per DESIGN.md voice ("Made by a trader, not a model"). */}
        <section style={{ marginTop: "clamp(80px, 10vw, 128px)", display: "flex", justifyContent: "center" }}>
          <div style={{ maxWidth: 620 }}>
            <div className="koda-section-label" style={{ justifyContent: "center" }}>FROM THE BUILDER</div>
            <p style={{
              fontFamily: DISPLAY, fontSize: "clamp(18px, 1.8vw, 22px)",
              color: C.text, lineHeight: 1.55, fontWeight: 400, letterSpacing: "-0.005em",
              marginBottom: 18,
            }}>
              Hi, I&apos;m Dylon. I built Kōda because I needed it.
            </p>
            <p style={{ fontSize: 15, color: C.text2, lineHeight: 1.7, marginBottom: 14 }}>
              I journal on my phone between sessions and I&apos;ve blown a Topstep eval
              to a revenge trade. The intervention exists because of that day.
              Circles exist because I journal better when someone else is watching.
            </p>
            <p style={{ fontSize: 15, color: C.text2, lineHeight: 1.7 }}>
              I want this to be a journal that respects your time and tells you the
              truth &mdash; not one that gamifies your losses.
            </p>
            <div style={{
              marginTop: 18, fontFamily: MONO, fontSize: 11,
              color: C.muted, letterSpacing: "0.10em", textTransform: "uppercase",
            }}>&mdash; DYLON &middot; KŌDA</div>
          </div>
        </section>

        {/* GIANT GHOST WORDMARK */}
        <div style={{
          textAlign: "center", marginTop: "clamp(60px, 8vw, 100px)",
          pointerEvents: "none", overflow: "hidden",
        }}>
          <div style={{
            fontFamily: DISPLAY, fontWeight: 700, fontSize: "clamp(120px, 22vw, 280px)",
            letterSpacing: "0.04em", lineHeight: 0.85,
            background: "linear-gradient(180deg, rgba(255,255,255,0.12), rgba(255,255,255,0.01))",
            WebkitBackgroundClip: "text", backgroundClip: "text",
            WebkitTextFillColor: "transparent",
            WebkitTextStroke: "1px rgba(255,255,255,0.06)",
          }}>KŌDA</div>
        </div>

        {/* FINAL CTA — last conversion nudge after the editorial sections. */}
        <section style={{ marginTop: "clamp(40px, 6vw, 80px)", textAlign: "center" }}>
          <button type="button" onClick={handleStarted} style={{
            display: "inline-flex", alignItems: "center", gap: 12,
            padding: "10px 10px 10px 26px", borderRadius: 999,
            background: C.text, color: C.bg, border: "none",
            fontFamily: BODY, fontSize: 15, fontWeight: 600, cursor: "pointer",
            transition: "opacity 0.15s, transform 0.15s",
          }}>
            Start your free journal
            <span style={{
              width: 36, height: 36, borderRadius: 999, background: C.live,
              display: "flex", alignItems: "center", justifyContent: "center",
            }}>
              <svg width="14" height="14" viewBox="0 0 16 16" fill="none">
                <path d="M3 8h10M9 4l4 4-4 4" stroke="#0A0A0A" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round"/>
              </svg>
            </span>
          </button>
        </section>

        {/* FOOTER — expanded marketing nav linking to the static page set. */}
        <footer style={{
          marginTop: "clamp(60px, 8vw, 100px)", paddingTop: 32,
          borderTop: `1px solid ${C.border}`,
          display: "grid", gridTemplateColumns: "1fr", gap: 24,
        }}>
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <KodaMark size={20} color={C.text2} />
            <span style={{ fontFamily: BODY, fontWeight: 600, fontSize: 13, letterSpacing: "0.18em", color: C.text2 }}>KŌDA</span>
          </div>
          <nav style={{
            display: "flex", flexWrap: "wrap", gap: "12px 22px",
            fontFamily: BODY, fontSize: 13, color: C.text2,
          }}>
            {[
              ["Intervention", "/in-session-intervention.html"],
              ["Circles", "/trading-circles.html"],
              ["Compare", "/comparison.html"],
              ["FAQ", "/faq.html"],
              ["Changelog", "/changelog.html"],
              ["Privacy", "/privacy.html"],
              ["Terms", "/terms.html"],
              ["Cookies", "/cookies.html"],
            ].map(([label, href]) => (
              <a key={label} href={href} style={{ color: C.text2 }}>{label}</a>
            ))}
          </nav>
          <div style={{
            display: "flex", justifyContent: "space-between", alignItems: "center",
            flexWrap: "wrap", gap: 12, paddingTop: 18,
            borderTop: `1px solid ${C.border}`,
            fontFamily: MONO, fontSize: 10, color: C.dim, letterSpacing: "0.08em",
          }}>
            <span>©2026 KŌDA · KEEP THE EDGE YOU EARNED</span>
            <span>v1.0 · <span style={{ color: C.live }}>● LIVE</span></span>
          </div>
        </footer>

      </div>
    </div>
  );
}

// â”€â”€â”€ LOADING SCREEN â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
const PULSE_CSS = "@keyframes koda-pulse{0%,100%{opacity:1;transform:scale(1)}50%{opacity:0.7;transform:scale(0.96)}}";

function LoadingScreen() {
  return (
    <div style={{
      minHeight: "100dvh", background: C.bg,
      display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 20,
    }}>
      <style dangerouslySetInnerHTML={{ __html: PULSE_CSS }} />
      <div style={{ animation: "koda-pulse 1.8s ease-in-out infinite" }}>
        <KodaMark size={80} color={C.text} />
      </div>
    </div>
  );
}

// â”€â”€â”€ ROOT AUTH WRAPPER â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
export default function KodaAuth() {
  const [session, setSession] = useState<Session | null | undefined>(undefined);

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      installStorage(data.session?.user?.id ?? null);
      setSession(data.session);
    });
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, sess) => {
      if (event === "SIGNED_OUT") clearStorageCache();
      installStorage(sess?.user?.id ?? null);
      setSession(sess);
    });
    return () => subscription.unsubscribe();
  }, []);

  if (session === undefined) return <LoadingScreen />;
  if (!session) return <LandingPage onSuccess={() => {}} />;

  const jwtPlan = (session.user.app_metadata?.plan ?? "free") as "free" | "pro" | "elite";
  return <Koda user={session.user} jwtPlan={jwtPlan} />;
}

