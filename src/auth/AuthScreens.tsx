import { useState, useEffect, useRef } from "react";
import { DARK } from "../theme";
import { KodaMark, MONO, BODY, DISPLAY, GlassOrb, Card, Kicker } from "../shared";
import { AuthShell, AuthBtn, AuthField, PillField } from "./AuthShell";

const C = DARK;

// ─── Icon helpers (used inline across screens) ──────────────────────────────
function IconMail({ c = C.live, s = 28 }: { c?: string; s?: number }) {
  return (
    <svg width={s} height={s} viewBox="0 0 24 24" fill="none">
      <rect x="3" y="5" width="18" height="14" rx="2" stroke={c} strokeWidth="1.6" />
      <path d="M3 7l9 6 9-6" stroke={c} strokeWidth="1.6" strokeLinecap="round" />
    </svg>
  );
}
function IconClock({ c = C.warn, s = 28 }: { c?: string; s?: number }) {
  return (
    <svg width={s} height={s} viewBox="0 0 24 24" fill="none">
      <circle cx="12" cy="12" r="9" stroke={c} strokeWidth="1.6" />
      <path d="M12 7v5l3 2" stroke={c} strokeWidth="1.6" strokeLinecap="round" />
    </svg>
  );
}
function IconCheck({ c = C.live, s = 26, sw = 2 }: { c?: string; s?: number; sw?: number }) {
  return (
    <svg width={s} height={s} viewBox="0 0 24 24" fill="none">
      <path d="M5 12l5 5L19 8" stroke={c} strokeWidth={sw} strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}
function IconClose({ c = C.red, s = 26 }: { c?: string; s?: number }) {
  return (
    <svg width={s} height={s} viewBox="0 0 24 24" fill="none">
      <path d="M6 6l12 12M18 6l-12 12" stroke={c} strokeWidth="1.8" strokeLinecap="round" />
    </svg>
  );
}
function IconAlert({ c = C.red, s = 16 }: { c?: string; s?: number }) {
  return (
    <svg width={s} height={s} viewBox="0 0 24 24" fill="none">
      <path d="M12 8v5M12 16h.01" stroke={c} strokeWidth="2" strokeLinecap="round" />
      <circle cx="12" cy="12" r="9" stroke={c} strokeWidth="1.5" />
    </svg>
  );
}
function IconShare({ c = C.text, s = 16 }: { c?: string; s?: number }) {
  return (
    <svg width={s} height={s} viewBox="0 0 24 24" fill="none">
      <path d="M12 3v12M8 7l4-4 4 4" stroke={c} strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M5 12v6a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2v-6" stroke={c} strokeWidth="1.6" strokeLinecap="round" />
    </svg>
  );
}
function IconDownload({ c = "#0A0A0A", s = 16 }: { c?: string; s?: number }) {
  return (
    <svg width={s} height={s} viewBox="0 0 24 24" fill="none">
      <path d="M12 3v12M8 11l4 4 4-4" stroke={c} strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M4 17v2a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-2" stroke={c} strokeWidth="1.6" strokeLinecap="round" />
    </svg>
  );
}
function IconChevR({ c = "#0A0A0A", s = 16 }: { c?: string; s?: number }) {
  return (
    <svg width={s} height={s} viewBox="0 0 16 16" fill="none">
      <path d="M5 3l5 5-5 5" stroke={c} strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

// ═══════════════════════════════════════════════════════════════════════════
// 1 · Reset · expired link
// ═══════════════════════════════════════════════════════════════════════════

export function ResetExpiredScreen({ onSendNew, onBack }: { onSendNew?: () => void; onBack?: () => void }) {
  return (
    <AuthShell
      kicker="Link expired"
      title="This link has"
      accent="expired."
      sub="Reset links are valid for 30 minutes for your security. Request a fresh one to continue."
      foot={
        <span onClick={onBack} style={{ color: C.live, fontWeight: 500, cursor: "pointer" }}>
          ← Back to sign in
        </span>
      }
    >
      <div style={{ display: "flex", justifyContent: "center", padding: "4px 0 8px" }}>
        <div style={{
          width: 64, height: 64, borderRadius: 999, background: C.warnSoft,
          display: "flex", alignItems: "center", justifyContent: "center",
        }}>
          <IconClock c={C.warn} s={28} />
        </div>
      </div>
      <AuthBtn kind="live" full onClick={onSendNew}>Send a new link</AuthBtn>
    </AuthShell>
  );
}

// ═══════════════════════════════════════════════════════════════════════════
// 2 · Email verification — pending (6-digit code)
// ═══════════════════════════════════════════════════════════════════════════

export function VerifyPendingScreen({
  email = "you@example.com",
  resendIn = 28,
  onVerify,
  onResend,
}: {
  email?: string;
  resendIn?: number;
  onVerify?: (code: string) => void;
  onResend?: () => void;
}) {
  const [digits, setDigits] = useState<string[]>(["", "", "", "", "", ""]);
  const [seconds, setSeconds] = useState(resendIn);
  const inputs = useRef<(HTMLInputElement | null)[]>([]);

  useEffect(() => {
    if (seconds <= 0) return;
    const t = setInterval(() => setSeconds(s => Math.max(0, s - 1)), 1000);
    return () => clearInterval(t);
  }, [seconds]);

  useEffect(() => {
    inputs.current[0]?.focus();
  }, []);

  const handleChange = (i: number, v: string) => {
    const d = v.replace(/\D/g, "").slice(0, 1);
    const next = [...digits];
    next[i] = d;
    setDigits(next);
    if (d && i < 5) inputs.current[i + 1]?.focus();
    if (next.every(Boolean) && onVerify) onVerify(next.join(""));
  };
  const handleKey = (i: number, e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Backspace" && !digits[i] && i > 0) inputs.current[i - 1]?.focus();
  };

  const ready = digits.every(Boolean);
  const mins = Math.floor(seconds / 60);
  const secs = (seconds % 60).toString().padStart(2, "0");

  return (
    <AuthShell
      kicker="Verify email"
      title="Confirm it's"
      accent="you."
      sub={<>We sent a 6-digit code to <span style={{ color: C.text }}>{email}</span>.</>}
      foot={
        seconds > 0
          ? <>Resend code in <span style={{ color: C.text2 }}>{mins}:{secs}</span></>
          : <span onClick={onResend} style={{ color: C.live, fontWeight: 500, cursor: "pointer" }}>Resend code</span>
      }
    >
      <div style={{ display: "flex", gap: 9, justifyContent: "space-between" }}>
        {digits.map((d, i) => (
          <input
            key={i}
            ref={(el) => { inputs.current[i] = el; }}
            value={d}
            inputMode="numeric"
            maxLength={1}
            onChange={(e) => handleChange(i, e.target.value)}
            onKeyDown={(e) => handleKey(i, e)}
            style={{
              flex: 1, aspectRatio: "1", maxWidth: 48, borderRadius: 12,
              border: `1px solid ${d ? C.live : C.border2}`,
              background: d ? "rgba(255,255,255,0.03)" : "transparent",
              fontFamily: MONO, fontSize: 22, color: C.text, textAlign: "center",
              outline: "none", padding: 0,
            }}
          />
        ))}
      </div>
      <AuthBtn kind={ready ? "live" : "ghost"} full disabled={!ready} onClick={() => onVerify?.(digits.join(""))}>
        Verify
      </AuthBtn>
    </AuthShell>
  );
}

// ═══════════════════════════════════════════════════════════════════════════
// 3 · OAuth return — error
// ═══════════════════════════════════════════════════════════════════════════

export function OAuthReturnErrorScreen({
  provider = "Google",
  onRetry,
  onUseEmail,
}: {
  provider?: string;
  onRetry?: () => void;
  onUseEmail?: () => void;
}) {
  return (
    <AuthShell
      kicker={`${provider} · returning`}
      title="Couldn't finish"
      accent="sign-in."
      sub={`The ${provider} sign-in was cancelled or timed out. No account was created — try again.`}
      foot={
        <>
          Use email instead?{" "}
          <span onClick={onUseEmail} style={{ color: C.live, fontWeight: 500, cursor: "pointer" }}>
            Sign up
          </span>
        </>
      }
    >
      <div style={{ display: "flex", justifyContent: "center", padding: "4px 0 8px" }}>
        <div style={{
          width: 64, height: 64, borderRadius: 999, background: C.redSoft,
          display: "flex", alignItems: "center", justifyContent: "center",
        }}>
          <IconClose c={C.red} s={26} />
        </div>
      </div>
      <AuthBtn kind="live" full onClick={onRetry}>
        <div style={{
          width: 18, height: 18, borderRadius: 4, background: "#0A0A0A",
          color: C.live, display: "flex", alignItems: "center", justifyContent: "center",
          fontWeight: 700, fontSize: 11,
        }}>
          {provider[0]}
        </div>
        Retry with {provider}
      </AuthBtn>
    </AuthShell>
  );
}

// ═══════════════════════════════════════════════════════════════════════════
// 4 · Handle picker — collision + suggestions
// ═══════════════════════════════════════════════════════════════════════════

export function HandlePickerScreen({
  initial = "",
  suggestions = ["@dylon_fx", "@dylontrades", "@dylon.apex", "@dylon7"],
  onContinue,
}: {
  initial?: string;
  suggestions?: string[];
  onContinue?: (handle: string) => void;
}) {
  const [handle, setHandle] = useState(initial);
  const taken = handle === initial && initial.length > 0;
  const valid = handle.length >= 3 && !taken;

  return (
    <AuthShell
      kicker="Pick a handle"
      title="Claim your"
      accent="@handle."
      sub="This is how other traders find and @mention you in Circles."
    >
      <AuthField
        label="Handle"
        value={handle}
        onChange={setHandle}
        mono
        error={taken ? "That handle is taken." : undefined}
        placeholder="@yourname"
      />
      {taken && (
        <div>
          <div style={{
            fontFamily: MONO, fontSize: 9, letterSpacing: "0.14em",
            color: C.muted, textTransform: "uppercase", marginBottom: 10,
          }}>
            Available
          </div>
          <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
            {suggestions.map(h => (
              <button
                key={h}
                onClick={() => setHandle(h.replace(/^@/, ""))}
                style={{
                  display: "inline-flex", alignItems: "center", gap: 6,
                  padding: "7px 12px", borderRadius: 999,
                  background: C.liveSoft, color: C.live,
                  border: `1px solid color-mix(in oklch, ${C.live} 30%, transparent)`,
                  fontFamily: MONO, fontSize: 12, letterSpacing: "0.02em",
                  cursor: "pointer",
                }}
              >
                <span style={{ width: 6, height: 6, borderRadius: "50%", background: C.live }} />
                {h}
              </button>
            ))}
          </div>
        </div>
      )}
      <AuthBtn kind={valid ? "live" : "ghost"} full disabled={!valid} onClick={() => onContinue?.(handle)}>
        Continue
      </AuthBtn>
    </AuthShell>
  );
}

// ═══════════════════════════════════════════════════════════════════════════
// 5 · Recovery email — standalone setup
// ═══════════════════════════════════════════════════════════════════════════

export function RecoveryEmailScreen({
  initialEmail = "",
  onSend,
  onSkip,
}: {
  initialEmail?: string;
  onSend?: (email: string) => void;
  onSkip?: () => void;
}) {
  const [email, setEmail] = useState(initialEmail);
  const valid = /\S+@\S+\.\S+/.test(email);

  return (
    <AuthShell
      kicker="Account safety"
      title="Add a recovery"
      accent="email."
      sub="A backup address lets you regain access if you ever lose your password and inbox."
      foot={
        <span onClick={onSkip} style={{ color: C.text2, cursor: "pointer" }}>
          Skip for now
        </span>
      }
    >
      <AuthField
        label="Recovery email"
        value={email}
        onChange={setEmail}
        placeholder="you@personal.com"
        type="email"
      />
      <AuthBtn kind={valid ? "live" : "ghost"} full disabled={!valid} onClick={() => onSend?.(email)}>
        Send verification
      </AuthBtn>
    </AuthShell>
  );
}

// ═══════════════════════════════════════════════════════════════════════════
// 6 · Install PWA — iOS Safari
// ═══════════════════════════════════════════════════════════════════════════

export function InstallIOSScreen({ onClose }: { onClose?: () => void }) {
  return (
    <div style={{
      minHeight: "100dvh", background: C.bg, color: C.text,
      position: "relative", overflow: "hidden",
      display: "flex", flexDirection: "column",
    }}>
      <GlassOrb C={C} color={C.orb3} size={300} top={-60} left={-80} opacity={0.32} />
      <div style={{
        position: "relative", zIndex: 2,
        flex: 1, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center",
        padding: "0 30px", textAlign: "center",
      }}>
        <div style={{
          width: 84, height: 84, borderRadius: 20, background: C.bg,
          border: `1px solid ${C.border2}`,
          display: "flex", alignItems: "center", justifyContent: "center",
          marginBottom: 24, boxShadow: "0 20px 40px rgba(0,0,0,0.3)",
        }}>
          <KodaMark size={46} color={C.text} />
        </div>
        <div style={{ fontFamily: DISPLAY, fontSize: 24, fontWeight: 600, letterSpacing: "-0.02em", color: C.text }}>
          Install Kōda
        </div>
        <div style={{ fontSize: 13.5, color: C.text2, marginTop: 10, lineHeight: 1.55, maxWidth: "30ch", fontFamily: BODY }}>
          Add Kōda to your Home Screen for full-screen, offline-ready journaling.
        </div>
      </div>
      <div style={{ position: "relative", zIndex: 2 }}>
        <Card C={C} glass pad={20} style={{ borderRadius: "24px 24px 0 0", margin: 0 }}>
          <Kicker C={C} color={C.live}>iOS · Safari</Kicker>
          <div style={{ display: "flex", flexDirection: "column", gap: 14, marginTop: 16 }}>
            {[
              { n: "1", txt: <>Tap the <IconShare c={C.text} s={16} /> Share button below</> },
              { n: "2", txt: "Scroll and tap \"Add to Home Screen\"" },
              { n: "3", txt: "Tap \"Add\" — Kōda lands on your Home Screen" },
            ].map(({ n, txt }) => (
              <div key={n} style={{ display: "flex", alignItems: "center", gap: 12 }}>
                <div style={{
                  width: 26, height: 26, borderRadius: 999, background: C.surfaceHi,
                  border: `1px solid ${C.border2}`, display: "flex", alignItems: "center", justifyContent: "center",
                  fontFamily: MONO, fontSize: 12, color: C.text, flexShrink: 0,
                }}>
                  {n}
                </div>
                <div style={{
                  fontSize: 13.5, color: C.text, fontFamily: BODY,
                  display: "flex", alignItems: "center", gap: 6,
                }}>
                  {txt}
                </div>
              </div>
            ))}
          </div>
          {onClose && (
            <AuthBtn kind="ghost" full onClick={onClose} style={{ marginTop: 18 }}>
              Got it
            </AuthBtn>
          )}
        </Card>
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════
// 7 · Install PWA — Android Chrome
// ═══════════════════════════════════════════════════════════════════════════

export function InstallAndroidScreen({
  onInstall,
  onSkip,
}: {
  onInstall?: () => void;
  onSkip?: () => void;
}) {
  return (
    <div style={{
      minHeight: "100dvh", background: C.bg, color: C.text,
      position: "relative", overflow: "hidden",
      display: "flex", flexDirection: "column", justifyContent: "center",
      padding: "72px 22px 40px", boxSizing: "border-box",
    }}>
      <GlassOrb C={C} color={C.orb1} size={300} top={-60} right={-80} opacity={0.34} />
      <div style={{ position: "relative", zIndex: 2, width: "100%", maxWidth: 420, margin: "0 auto" }}>
        <Card C={C} pad={22} style={{ borderRadius: 24, position: "relative" }}>
          {/* corner glow */}
          <div style={{
            position: "absolute", top: -60, right: -50, width: 200, height: 200,
            borderRadius: "50%", pointerEvents: "none",
            background: `conic-gradient(from 200deg at 50% 50%, ${C.orb3}, ${C.accent}, ${C.orb2}, ${C.orb3})`,
            filter: "blur(46px)", opacity: 0.5,
          }} />
          <div style={{ position: "relative", display: "flex", alignItems: "center", gap: 14 }}>
            <div style={{
              width: 56, height: 56, borderRadius: 14, background: C.bg,
              border: `1px solid ${C.border2}`,
              display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0,
            }}>
              <KodaMark size={32} color={C.text} />
            </div>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontFamily: DISPLAY, fontSize: 17, fontWeight: 600, color: C.text }}>
                Install Kōda
              </div>
              <div style={{
                fontFamily: MONO, fontSize: 10, letterSpacing: "0.06em",
                color: C.muted, marginTop: 3,
              }}>
                kodatrade.co.uk
              </div>
            </div>
          </div>
          <div style={{
            position: "relative", fontSize: 13, color: C.text2,
            marginTop: 16, lineHeight: 1.55, fontFamily: BODY,
          }}>
            Installs as an app — own icon, full screen, push notifications, and offline access to your journal.
          </div>
          <div style={{ position: "relative", display: "flex", gap: 10, marginTop: 20 }}>
            <AuthBtn kind="ghost" style={{ flex: 1 }} onClick={onSkip}>
              Not now
            </AuthBtn>
            <AuthBtn kind="live" style={{ flex: 1.4 }} onClick={onInstall}>
              <IconDownload c="#0A0A0A" s={16} />
              Install
            </AuthBtn>
          </div>
        </Card>
        <div style={{
          textAlign: "center", marginTop: 16,
          fontFamily: MONO, fontSize: 9, letterSpacing: "0.14em", color: C.muted,
        }}>
          ANDROID · CHROME — NATIVE INSTALL PROMPT
        </div>
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════
// 8 · First-session survey (3-step)
// ═══════════════════════════════════════════════════════════════════════════

const SURVEY_STEPS = [
  {
    kicker: "1 of 3 · Quick setup",
    title: "What do you trade",
    accentLine: "most?",
    options: [
      { id: "futures", a: "Futures", b: "ES · NQ · CL · GC" },
      { id: "forex", a: "Forex", b: "EUR/USD · GBP/USD" },
      { id: "stocks", a: "Stocks & options", b: "equities & spreads" },
      { id: "crypto", a: "Crypto", b: "BTC · ETH · alts" },
    ],
  },
  {
    kicker: "2 of 3 · Quick setup",
    title: "How long have you",
    accentLine: "traded?",
    options: [
      { id: "new", a: "Less than 6 months", b: "Getting started" },
      { id: "1y", a: "6 months – 2 years", b: "Building consistency" },
      { id: "2y", a: "2 – 5 years", b: "Refining the edge" },
      { id: "5y+", a: "5+ years", b: "Live the loop" },
    ],
  },
  {
    kicker: "3 of 3 · Quick setup",
    title: "What's your",
    accentLine: "biggest leak?",
    options: [
      { id: "tilt", a: "Revenge / tilt trading", b: "After a loss" },
      { id: "size", a: "Over-sizing", b: "Wrong R per trade" },
      { id: "fomo", a: "FOMO entries", b: "Chasing the move" },
      { id: "exit", a: "Bad exits", b: "Cut winners short / hold losers" },
    ],
  },
];

export function FirstSessionSurveyScreen({
  onComplete,
}: {
  onComplete?: (answers: Record<number, string>) => void;
}) {
  const [step, setStep] = useState(0);
  const [answers, setAnswers] = useState<Record<number, string>>({});
  const cur = SURVEY_STEPS[step];
  const picked = answers[step];

  const next = () => {
    if (step < SURVEY_STEPS.length - 1) setStep(step + 1);
    else onComplete?.(answers);
  };

  return (
    <div style={{
      minHeight: "100dvh", background: C.bg, color: C.text,
      position: "relative", overflow: "hidden",
      padding: "60px 22px 100px", boxSizing: "border-box",
    }}>
      <GlassOrb C={C} color={C.orb1} size={360} top={-80} right={-90} opacity={0.32} />
      <div style={{ position: "relative", zIndex: 2, maxWidth: 420, margin: "0 auto" }}>
        <div style={{ marginBottom: 20, display: "flex", alignItems: "center", gap: 9 }}>
          <KodaMark size={20} color={C.text} />
          <span style={{ fontFamily: BODY, fontWeight: 600, fontSize: 14, letterSpacing: "0.22em", color: C.text }}>
            Kōda
          </span>
        </div>
        <Kicker C={C} color={C.live}>{cur.kicker}</Kicker>
        <div style={{
          fontFamily: DISPLAY, fontSize: 25, fontWeight: 600,
          letterSpacing: "-0.03em", lineHeight: 1.1, marginTop: 14, color: C.text,
        }}>
          {cur.title}
          <br />
          <span style={{ fontStyle: "italic", fontWeight: 500, color: C.live }}>{cur.accentLine}</span>
        </div>
        <div style={{ display: "flex", flexDirection: "column", gap: 10, marginTop: 24 }}>
          {cur.options.map(opt => {
            const on = picked === opt.id;
            return (
              <button
                key={opt.id}
                onClick={() => setAnswers({ ...answers, [step]: opt.id })}
                style={{
                  display: "flex", alignItems: "center", gap: 14,
                  padding: "16px 18px", borderRadius: 14,
                  background: on ? C.liveSoft : C.panel,
                  border: `1px solid ${on ? `color-mix(in oklch, ${C.live} 40%, transparent)` : C.border}`,
                  textAlign: "left", cursor: "pointer",
                  fontFamily: BODY,
                }}
              >
                <div style={{ flex: 1 }}>
                  <div style={{ fontSize: 15, fontWeight: 600, color: C.text }}>{opt.a}</div>
                  <div style={{
                    fontFamily: MONO, fontSize: 10, letterSpacing: "0.06em",
                    color: C.muted, marginTop: 4,
                  }}>
                    {opt.b}
                  </div>
                </div>
                <div style={{
                  width: 24, height: 24, borderRadius: 999,
                  border: `1.5px solid ${on ? C.live : C.border2}`,
                  background: on ? C.live : "transparent",
                  display: "flex", alignItems: "center", justifyContent: "center",
                }}>
                  {on && <IconCheck c="#0A0A0A" s={14} sw={2.4} />}
                </div>
              </button>
            );
          })}
        </div>
      </div>
      <div style={{
        position: "fixed", left: 22, right: 22, bottom: "calc(28px + env(safe-area-inset-bottom))",
        maxWidth: 420, margin: "0 auto",
        display: "flex", gap: 10, alignItems: "center", zIndex: 5,
      }}>
        <div style={{ display: "flex", gap: 6, flex: 1 }}>
          {SURVEY_STEPS.map((_, i) => (
            <div
              key={i}
              style={{
                flex: 1, height: 4, borderRadius: 999,
                background: i <= step ? C.live : C.border2,
                transition: "background 0.2s",
              }}
            />
          ))}
        </div>
        <AuthBtn kind="live" size="sm" onClick={next} disabled={!picked}>
          {step === SURVEY_STEPS.length - 1 ? "Done" : "Next"}
          <IconChevR c="#0A0A0A" s={15} />
        </AuthBtn>
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════
// 9 · Waitlist joined
// ═══════════════════════════════════════════════════════════════════════════

export function WaitlistJoinedScreen({
  position = 428,
  onRefer,
  onFollow,
}: {
  position?: number;
  onRefer?: () => void;
  onFollow?: () => void;
}) {
  return (
    <AuthShell
      kicker="You're on the list"
      title="Saved your"
      accent="spot."
      sub={
        <>
          We'll email you the moment a beta seat opens. You're <span style={{ color: C.text }}>#{position}</span> in line — invites go out weekly.
        </>
      }
      foot={
        <>
          Bump your spot —{" "}
          <span onClick={onRefer} style={{ color: C.live, fontWeight: 500, cursor: "pointer" }}>
            refer a trader
          </span>
        </>
      }
    >
      <div style={{ display: "flex", justifyContent: "center", padding: "4px 0 8px" }}>
        <div style={{
          width: 64, height: 64, borderRadius: 999, background: C.liveSoft,
          display: "flex", alignItems: "center", justifyContent: "center",
          boxShadow: `0 0 0 8px color-mix(in oklch, ${C.live} 8%, transparent)`,
        }}>
          <IconCheck c={C.live} s={30} sw={2} />
        </div>
      </div>
      <AuthBtn kind="ghost" full onClick={onFollow}>
        Follow @kodatrade on X
      </AuthBtn>
    </AuthShell>
  );
}

// ═══════════════════════════════════════════════════════════════════════════
// 10 · Reset · sent (mail icon + open mail app)
// ═══════════════════════════════════════════════════════════════════════════

export function ResetSentScreen({
  email = "you@example.com",
  onOpenMail,
  onResend,
}: {
  email?: string;
  onOpenMail?: () => void;
  onResend?: () => void;
}) {
  return (
    <AuthShell
      kicker="Check your inbox"
      title="Link"
      accent="sent."
      sub={<>We emailed a reset link to <span style={{ color: C.text }}>{email}</span>. It expires in 30 minutes.</>}
      foot={
        <>
          Didn't get it?{" "}
          <span onClick={onResend} style={{ color: C.live, fontWeight: 500, cursor: "pointer" }}>
            Resend
          </span>{" "}
          · check spam
        </>
      }
    >
      <div style={{ display: "flex", justifyContent: "center", padding: "4px 0 8px" }}>
        <div style={{
          width: 64, height: 64, borderRadius: 999, background: C.liveSoft,
          display: "flex", alignItems: "center", justifyContent: "center",
          boxShadow: `0 0 0 8px color-mix(in oklch, ${C.live} 8%, transparent)`,
        }}>
          <IconMail c={C.live} s={28} />
        </div>
      </div>
      <AuthBtn kind="ghost" full onClick={onOpenMail}>
        Open mail app
      </AuthBtn>
    </AuthShell>
  );
}

// ═══════════════════════════════════════════════════════════════════════════
// 11 · Sign-up form (new design, full Email + Password + OAuth)
// ═══════════════════════════════════════════════════════════════════════════

export function SignUpFormScreen({
  initialEmail = "",
  onSubmit,
  onOAuth,
  onSignIn,
  busy,
  error,
}: {
  initialEmail?: string;
  onSubmit?: (email: string, password: string) => void;
  onOAuth?: (p: "google" | "x") => void;
  onSignIn?: () => void;
  busy?: boolean;
  error?: string;
}) {
  const [email, setEmail] = useState(initialEmail);
  const [pw, setPw] = useState("");
  const [show, setShow] = useState(false);

  const emailErr = email && !/\S+@\S+\.\S+/.test(email) ? "That doesn't look like a valid email." : undefined;
  const pwErr = pw && pw.length < 8 ? "Too short — needs 8+ characters." : undefined;
  const ready = !emailErr && !pwErr && email.length > 0 && pw.length >= 8;
  const errCount = (emailErr ? 1 : 0) + (pwErr ? 1 : 0);

  return (
    <AuthShell
      kicker="Create account"
      title="Start your"
      accent="journal."
      ghost="KŌDA"
      foot={
        <>
          Already trading with us?{" "}
          <span onClick={onSignIn} style={{ color: C.live, fontWeight: 500, cursor: "pointer" }}>
            Sign in
          </span>
        </>
      }
    >
      <AuthField
        label="Email"
        value={email}
        onChange={setEmail}
        placeholder="you@example.com"
        type="email"
        error={emailErr}
      />
      <AuthField
        label="Password"
        value={pw}
        onChange={setPw}
        placeholder="8+ chars, one number"
        type={show ? "text" : "password"}
        error={pwErr}
        hint={pwErr ? undefined : "8+ characters, one number."}
        trailing={
          <span
            onClick={() => setShow(!show)}
            style={{ fontFamily: MONO, fontSize: 9, letterSpacing: "0.12em", color: C.live, cursor: "pointer" }}
          >
            {show ? "HIDE" : "SHOW"}
          </span>
        }
      />
      {error && (
        <div style={{
          display: "flex", alignItems: "center", gap: 8,
          padding: "10px 14px", borderRadius: 10,
          background: C.redSoft, border: `1px solid color-mix(in oklch, ${C.red} 30%, transparent)`,
        }}>
          <IconAlert c={C.red} s={16} />
          <span style={{ fontSize: 12, color: C.red, fontFamily: BODY }}>{error}</span>
        </div>
      )}
      {!error && errCount > 0 && (
        <div style={{
          display: "flex", alignItems: "center", gap: 8,
          padding: "10px 14px", borderRadius: 10,
          background: C.redSoft, border: `1px solid color-mix(in oklch, ${C.red} 30%, transparent)`,
        }}>
          <IconAlert c={C.red} s={16} />
          <span style={{ fontSize: 12, color: C.red, fontFamily: BODY }}>
            Fix {errCount} field{errCount > 1 ? "s" : ""} to continue.
          </span>
        </div>
      )}
      <AuthBtn
        kind={ready ? "live" : "ghost"}
        full
        disabled={!ready || busy}
        onClick={() => onSubmit?.(email, pw)}
      >
        {busy ? "Creating…" : "Create account"} <IconChevR c={ready ? "#0A0A0A" : C.text} s={16} />
      </AuthBtn>

      {onOAuth && (
        <>
          <div style={{ display: "flex", alignItems: "center", gap: 12, color: C.muted }}>
            <div style={{ flex: 1, height: 1, background: C.border2 }} />
            <span style={{ fontFamily: MONO, fontSize: 9, letterSpacing: "0.16em" }}>OR</span>
            <div style={{ flex: 1, height: 1, background: C.border2 }} />
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
            <button
              onClick={() => onOAuth("google")}
              style={{
                display: "flex", alignItems: "center", gap: 12,
                padding: "12px 16px", borderRadius: 12,
                background: "rgba(255,255,255,0.03)", border: `1px solid ${C.border2}`,
                cursor: "pointer", fontFamily: BODY,
              }}
            >
              <div style={{
                width: 20, height: 20, borderRadius: 5, background: C.text,
                display: "flex", alignItems: "center", justifyContent: "center",
                color: C.bg, fontWeight: 700, fontSize: 12,
              }}>G</div>
              <span style={{ flex: 1, fontSize: 14, color: C.text, fontWeight: 500, textAlign: "left" }}>
                Continue with Google
              </span>
              <svg width={16} height={16} viewBox="0 0 16 16" fill="none">
                <path d="M6 4l4 4-4 4" stroke={C.muted} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            </button>
          </div>
        </>
      )}
      <div style={{ fontSize: 11, color: C.muted, textAlign: "center", lineHeight: 1.5, fontFamily: BODY }}>
        By continuing you agree to our{" "}
        <a href="/terms.html" style={{ color: C.text2 }}>Terms</a> &{" "}
        <a href="/privacy.html" style={{ color: C.text2 }}>Privacy</a>.
      </div>
    </AuthShell>
  );
}

// ═══════════════════════════════════════════════════════════════════════════
// 12 · New password (after clicking reset link)
// ═══════════════════════════════════════════════════════════════════════════

export function NewPasswordScreen({
  onSubmit,
  busy,
  error,
}: {
  onSubmit?: (password: string) => void;
  busy?: boolean;
  error?: string;
}) {
  const [pw, setPw] = useState("");
  const [show, setShow] = useState(false);

  const pwErr = pw && pw.length < 8 ? "Too short — needs 8+ characters." : undefined;
  const ready = pw.length >= 8 && !pwErr;

  return (
    <AuthShell
      kicker="Password reset"
      title="Set your new"
      accent="password."
      sub="Choose something strong — at least 8 characters with at least one number."
    >
      <AuthField
        label="New password"
        value={pw}
        onChange={setPw}
        placeholder="8+ chars, one number"
        type={show ? "text" : "password"}
        error={pwErr}
        trailing={
          <span
            onClick={() => setShow(!show)}
            style={{ fontFamily: MONO, fontSize: 9, letterSpacing: "0.12em", color: C.live, cursor: "pointer" }}
          >
            {show ? "HIDE" : "SHOW"}
          </span>
        }
      />
      {error && (
        <div style={{
          display: "flex", alignItems: "center", gap: 8,
          padding: "10px 14px", borderRadius: 10,
          background: C.redSoft, border: `1px solid color-mix(in oklch, ${C.red} 30%, transparent)`,
        }}>
          <svg width={16} height={16} viewBox="0 0 24 24" fill="none">
            <path d="M12 8v5M12 16h.01" stroke={C.red} strokeWidth="2" strokeLinecap="round" />
            <circle cx="12" cy="12" r="9" stroke={C.red} strokeWidth="1.5" />
          </svg>
          <span style={{ fontSize: 12, color: C.red, fontFamily: BODY }}>{error}</span>
        </div>
      )}
      <AuthBtn
        kind={ready ? "live" : "ghost"}
        full
        disabled={!ready || busy}
        onClick={() => onSubmit?.(pw)}
      >
        {busy ? "Updating…" : "Update password"}
      </AuthBtn>
    </AuthShell>
  );
}

// ═══════════════════════════════════════════════════════════════════════════
// 13 · Reset request (enter email to receive reset link)
// ═══════════════════════════════════════════════════════════════════════════

export function ResetRequestScreen({
  onSubmit,
  onBack,
  busy,
  error,
}: {
  onSubmit?: (email: string) => void;
  onBack?: () => void;
  busy?: boolean;
  error?: string;
}) {
  const [email, setEmail] = useState("");
  const emailErr = email && !/\S+@\S+\.\S+/.test(email) ? "Enter a valid email address." : undefined;
  const ready = email.length > 0 && !emailErr;

  return (
    <AuthShell
      kicker="Password reset"
      title="Forgot your"
      accent="password?"
      sub="Enter your email address and we'll send a reset link. Check your spam folder too."
      foot={
        <span onClick={onBack} style={{ color: C.live, fontWeight: 500, cursor: "pointer" }}>
          ← Back to sign in
        </span>
      }
    >
      <AuthField
        label="Email"
        value={email}
        onChange={setEmail}
        placeholder="you@example.com"
        type="email"
        error={emailErr}
      />
      {error && (
        <div style={{
          display: "flex", alignItems: "center", gap: 8,
          padding: "10px 14px", borderRadius: 10,
          background: C.redSoft, border: `1px solid color-mix(in oklch, ${C.red} 30%, transparent)`,
        }}>
          <svg width={16} height={16} viewBox="0 0 24 24" fill="none">
            <path d="M12 8v5M12 16h.01" stroke={C.red} strokeWidth="2" strokeLinecap="round" />
            <circle cx="12" cy="12" r="9" stroke={C.red} strokeWidth="1.5" />
          </svg>
          <span style={{ fontSize: 12, color: C.red, fontFamily: BODY }}>{error}</span>
        </div>
      )}
      <AuthBtn
        kind={ready ? "live" : "ghost"}
        full
        disabled={!ready || busy}
        onClick={() => onSubmit?.(email)}
      >
        {busy ? "Sending…" : "Send reset link"}
      </AuthBtn>
    </AuthShell>
  );
}

// Silence unused warnings — PillField is exported for future screens but not consumed here.
export const _internal = { PillField };
