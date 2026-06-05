import { useState } from "react";
import type React from "react";
import type { Theme } from "../theme";
import { MONO, BODY, DISPLAY, Kicker, Card } from "../shared";

// ═══════════════════════════════════════════════════════════════════════════
// Settings screens — Account & billing sub-flows (cat02)
//
// All take a Theme prop (C) and render as full-bleed phone-sized layouts
// with a back button + title masthead.
//
// Components:
//   • SettingsSub — shared "back + title" shell
//   • Banner — tone-coded alert banner (red/warn/accent)
//   • BillingPastDueScreen, BillingDunningScreen, BillingPromoScreen
//   • AccountDeleteWarnScreen, AccountDeleteConfirmScreen, AccountDeleteScheduledScreen
//   • DataExportScreen
//   • TwoFactorScreen
//   • DevicesScreen
//   • BrokerDisconnectSheet (bottom sheet)
//   • PreferencesScreen
//   • FeedbackScreen
// ═══════════════════════════════════════════════════════════════════════════

// ─── Icons ──────────────────────────────────────────────────────────────────
function IconBack({ c, s = 18 }: { c: string; s?: number }) {
  return <svg width={s} height={s} viewBox="0 0 24 24" fill="none"><path d="M14 6l-6 6 6 6" stroke={c} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" /></svg>;
}
function IconAlert({ c, s = 20 }: { c: string; s?: number }) {
  return <svg width={s} height={s} viewBox="0 0 24 24" fill="none"><path d="M12 9v5M12 17h.01M10.3 4.86L1.82 19A2 2 0 0 0 3.54 22h16.93A2 2 0 0 0 22.2 19L13.71 4.86a2 2 0 0 0-3.42 0z" stroke={c} strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" /></svg>;
}
function IconClock({ c, s = 20 }: { c: string; s?: number }) {
  return <svg width={s} height={s} viewBox="0 0 24 24" fill="none"><circle cx="12" cy="12" r="9" stroke={c} strokeWidth="1.6" /><path d="M12 7v5l3 2" stroke={c} strokeWidth="1.6" strokeLinecap="round" /></svg>;
}
function IconTrash({ c, s = 24 }: { c: string; s?: number }) {
  return <svg width={s} height={s} viewBox="0 0 24 24" fill="none"><path d="M3 6h18M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6" stroke={c} strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" /></svg>;
}
function IconClose({ c, s = 16 }: { c: string; s?: number }) {
  return <svg width={s} height={s} viewBox="0 0 24 24" fill="none"><path d="M6 6l12 12M18 6l-12 12" stroke={c} strokeWidth="2" strokeLinecap="round" /></svg>;
}
function IconCard({ c, s = 18 }: { c: string; s?: number }) {
  return <svg width={s} height={s} viewBox="0 0 24 24" fill="none"><rect x="2" y="6" width="20" height="12" rx="2" stroke={c} strokeWidth="1.6" /><path d="M2 10h20" stroke={c} strokeWidth="1.6" /></svg>;
}
function IconDownload({ c, s = 18 }: { c: string; s?: number }) {
  return <svg width={s} height={s} viewBox="0 0 24 24" fill="none"><path d="M12 3v12M8 11l4 4 4-4M4 17v2a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-2" stroke={c} strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" /></svg>;
}
function IconRefresh({ c, s = 22 }: { c: string; s?: number }) {
  return <svg width={s} height={s} viewBox="0 0 24 24" fill="none"><path d="M3 12a9 9 0 0 1 15-6.7L21 8M21 3v5h-5M21 12a9 9 0 0 1-15 6.7L3 16M3 21v-5h5" stroke={c} strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" /></svg>;
}
function IconChevR({ c, s = 16 }: { c: string; s?: number }) {
  return <svg width={s} height={s} viewBox="0 0 16 16" fill="none"><path d="M5 3l5 5-5 5" stroke={c} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" /></svg>;
}
function IconUser({ c, s = 18 }: { c: string; s?: number }) {
  return <svg width={s} height={s} viewBox="0 0 24 24" fill="none"><circle cx="12" cy="8" r="4" stroke={c} strokeWidth="1.6" /><path d="M4 20c0-4 4-6 8-6s8 2 8 6" stroke={c} strokeWidth="1.6" strokeLinecap="round" /></svg>;
}
function IconPlus({ c, s = 16 }: { c: string; s?: number }) {
  return <svg width={s} height={s} viewBox="0 0 24 24" fill="none"><path d="M12 5v14M5 12h14" stroke={c} strokeWidth="1.8" strokeLinecap="round" /></svg>;
}

// ─── Atoms ──────────────────────────────────────────────────────────────────
export function SettingsSub({
  C, title, right, onBack, children,
}: {
  C: Theme; title: string; right?: React.ReactNode; onBack?: () => void;
  children: React.ReactNode;
}) {
  return (
    <div style={{
      minHeight: "100dvh", background: C.bg, color: C.text,
      padding: "22px 22px 60px", boxSizing: "border-box",
      maxWidth: 480, margin: "0 auto",
    }}>
      <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 22 }}>
        <button
          onClick={onBack}
          aria-label="Back"
          style={{
            width: 36, height: 36, borderRadius: 999, background: C.surface,
            border: `1px solid ${C.line}`, display: "flex", alignItems: "center", justifyContent: "center",
            cursor: "pointer", padding: 0,
          }}
        >
          <IconBack c={C.text} />
        </button>
        <div style={{
          flex: 1, fontFamily: DISPLAY, fontSize: 19, fontWeight: 600,
          letterSpacing: "-0.01em", color: C.text,
        }}>
          {title}
        </div>
        {right}
      </div>
      {children}
    </div>
  );
}

export function SectionLabel({ C, children }: { C: Theme; children: React.ReactNode }) {
  return (
    <div style={{
      fontFamily: MONO, fontSize: 9.5, letterSpacing: "0.16em",
      color: C.muted, textTransform: "uppercase", margin: "22px 4px 10px",
    }}>
      {children}
    </div>
  );
}

export function Banner({
  C, tone = "warn", icon, title, body,
}: {
  C: Theme; tone?: "red" | "warn" | "accent" | "live";
  icon: React.ReactNode; title: string; body: string;
}) {
  const c = tone === "red" ? C.red : tone === "warn" ? C.warn : tone === "live" ? C.live : C.accent;
  return (
    <div style={{
      display: "flex", gap: 12, padding: "14px 16px", borderRadius: 14,
      background: `color-mix(in oklch, ${c} 9%, ${C.surface})`,
      border: `1px solid color-mix(in oklch, ${c} 32%, transparent)`,
    }}>
      <div style={{ flexShrink: 0, color: c }}>{icon}</div>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontSize: 13.5, fontWeight: 600, color: C.text, fontFamily: BODY }}>
          {title}
        </div>
        <div style={{ fontSize: 12, color: C.text2, marginTop: 3, lineHeight: 1.5, fontFamily: BODY }}>
          {body}
        </div>
      </div>
    </div>
  );
}

export function MonoTag({ C, tone, children }: { C: Theme; tone: "green" | "red" | "warn" | "accent" | "live"; children: React.ReactNode }) {
  const c = tone === "green" ? C.green : tone === "red" ? C.red : tone === "warn" ? C.warn : tone === "live" ? C.live : C.accent;
  return (
    <span style={{
      fontFamily: MONO, fontSize: 10, letterSpacing: "0.10em",
      color: c, padding: "3px 8px", borderRadius: 999,
      background: `color-mix(in oklch, ${c} 12%, transparent)`,
      border: `1px solid color-mix(in oklch, ${c} 30%, transparent)`,
      textTransform: "uppercase" as const, whiteSpace: "nowrap" as const,
    }}>
      {children}
    </span>
  );
}

function SettingsBtn({
  C, kind = "live", full, size = "md", style, onClick, disabled, children,
}: {
  C: Theme; kind?: "live" | "ink" | "ghost" | "danger";
  full?: boolean; size?: "sm" | "md";
  style?: React.CSSProperties; onClick?: () => void; disabled?: boolean;
  children: React.ReactNode;
}) {
  const pad = size === "sm" ? "10px 16px" : "13px 20px";
  const bg = kind === "live" ? C.live : kind === "ink" ? C.text : kind === "danger" ? "transparent" : "transparent";
  const fg = kind === "ghost" ? C.text : kind === "danger" ? C.red : "#0A0A0A";
  const bd = kind === "ghost"
    ? `1px solid ${C.border2}`
    : kind === "danger"
      ? `1px solid color-mix(in oklch, ${C.red} 35%, transparent)`
      : "1px solid transparent";
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      style={{
        display: "flex", alignItems: "center", justifyContent: "center", gap: 8,
        padding: pad, borderRadius: 999, background: bg, color: fg, border: bd,
        fontFamily: BODY, fontWeight: 600, fontSize: size === "sm" ? 13 : 14,
        width: full ? "100%" : undefined,
        cursor: disabled ? "not-allowed" : "pointer", opacity: disabled ? 0.5 : 1,
        boxSizing: "border-box", transition: "opacity 0.15s, transform 0.15s",
        ...style,
      }}
    >
      {children}
    </button>
  );
}

// ═══════════════════════════════════════════════════════════════════════════
// Billing — past due
// ═══════════════════════════════════════════════════════════════════════════

export function BillingPastDueScreen({
  C, plan = "Kōda Pro", price = "$24.99 / month", cardLast4 = "4242",
  declinedDate = "Jun 4", onUpdate, onBack,
}: {
  C: Theme; plan?: string; price?: string; cardLast4?: string;
  declinedDate?: string; onUpdate?: () => void; onBack?: () => void;
}) {
  return (
    <SettingsSub C={C} title="Billing" onBack={onBack}>
      <Banner
        C={C}
        tone="red"
        icon={<IconAlert c={C.red} />}
        title="Payment past due"
        body="We couldn't charge your card. Update it within 7 days to keep Pro."
      />
      <SectionLabel C={C}>Plan</SectionLabel>
      <Card C={C} pad={18}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
          <div>
            <div style={{ fontFamily: DISPLAY, fontSize: 18, fontWeight: 600, color: C.text }}>{plan}</div>
            <div style={{ fontSize: 12.5, color: C.text2, marginTop: 4, fontFamily: BODY }}>{price}</div>
          </div>
          <MonoTag C={C} tone="red">Past due</MonoTag>
        </div>
      </Card>
      <SectionLabel C={C}>Payment method</SectionLabel>
      <Card C={C} pad={16}>
        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
          <div style={{
            width: 38, height: 26, borderRadius: 6, background: C.surfaceHi,
            border: `1px solid ${C.border2}`, display: "flex", alignItems: "center", justifyContent: "center",
          }}>
            <IconCard c={C.red} s={16} />
          </div>
          <div style={{ flex: 1 }}>
            <div style={{ fontSize: 13.5, color: C.text, fontFamily: BODY }}>Visa ···· {cardLast4}</div>
            <div style={{ fontSize: 11.5, color: C.red, marginTop: 2, fontFamily: BODY }}>Declined {declinedDate}</div>
          </div>
        </div>
      </Card>
      <div style={{ marginTop: 22 }}>
        <SettingsBtn C={C} kind="live" full onClick={onUpdate}>Update payment method</SettingsBtn>
      </div>
    </SettingsSub>
  );
}

// ═══════════════════════════════════════════════════════════════════════════
// Billing — dunning / grace
// ═══════════════════════════════════════════════════════════════════════════

export function BillingDunningScreen({
  C, attempts = defaultAttempts(),
  daysLeft = 4, onFix, onDowngrade, onBack,
}: {
  C: Theme;
  attempts?: { date: string; label: string; status: string; tone: "red" | "warn" }[];
  daysLeft?: number;
  onFix?: () => void; onDowngrade?: () => void; onBack?: () => void;
}) {
  const lastAttempt = attempts.find(a => a.tone === "warn");
  return (
    <SettingsSub C={C} title="Billing" onBack={onBack}>
      <Banner
        C={C}
        tone="warn"
        icon={<IconClock c={C.warn} />}
        title={`Pro ends in ${daysLeft} day${daysLeft === 1 ? "" : "s"}`}
        body={`We've tried your card ${attempts.filter(a => a.tone === "red").length} times. We'll try once more on ${lastAttempt?.date ?? "soon"} before downgrading.`}
      />
      <SectionLabel C={C}>Retry schedule</SectionLabel>
      <Card C={C} pad={18}>
        {attempts.map((a, i) => (
          <div
            key={i}
            style={{
              display: "flex", alignItems: "center", gap: 12,
              padding: "11px 0", borderTop: i ? `1px solid ${C.line}` : "none",
            }}
          >
            <span style={{
              width: 8, height: 8, borderRadius: "50%",
              background: a.tone === "red" ? C.red : C.warn, flexShrink: 0,
            }} />
            <div style={{ flex: 1 }}>
              <div style={{ fontSize: 13.5, color: C.text, fontFamily: BODY }}>{a.label}</div>
              <div style={{ fontFamily: MONO, fontSize: 10, color: C.muted, marginTop: 2 }}>{a.date}</div>
            </div>
            <MonoTag C={C} tone={a.tone}>{a.status}</MonoTag>
          </div>
        ))}
      </Card>
      <div style={{ marginTop: 22, display: "flex", flexDirection: "column", gap: 10 }}>
        <SettingsBtn C={C} kind="live" full onClick={onFix}>Fix payment now</SettingsBtn>
        <SettingsBtn C={C} kind="ghost" full onClick={onDowngrade}>Switch to free plan</SettingsBtn>
      </div>
    </SettingsSub>
  );
}
function defaultAttempts(): { date: string; label: string; status: string; tone: "red" | "warn" }[] {
  return [
    { date: "Jun 4", label: "Attempt 1", status: "Failed", tone: "red" },
    { date: "Jun 5", label: "Attempt 2", status: "Failed", tone: "red" },
    { date: "Jun 7", label: "Attempt 3", status: "Scheduled", tone: "warn" },
  ];
}

// ═══════════════════════════════════════════════════════════════════════════
// Billing — promo code
// ═══════════════════════════════════════════════════════════════════════════

export function BillingPromoScreen({
  C, initial = "", basePrice = "$24.99", onApply, onBack,
}: {
  C: Theme; initial?: string; basePrice?: string;
  onApply?: (code: string) => void; onBack?: () => void;
}) {
  const [code, setCode] = useState(initial);
  const discount = code === "LAUNCH50" ? 0.5 : 0;
  const discounted = (parseFloat(basePrice.replace("$", "")) * (1 - discount)).toFixed(2);

  return (
    <SettingsSub C={C} title="Redeem code" onBack={onBack}>
      <Card C={C} pad={20} style={{ position: "relative", overflow: "hidden" }}>
        <div style={{
          position: "absolute", top: -60, right: -50, width: 200, height: 200,
          borderRadius: "50%",
          background: `conic-gradient(from 200deg at 50% 50%, ${C.orb3}, ${C.accent}, ${C.orb2}, ${C.orb3})`,
          filter: "blur(46px)", opacity: 0.4, pointerEvents: "none",
        }} />
        <div style={{ position: "relative" }}>
          <Kicker C={C} color={C.live}>Promo code</Kicker>
          <div style={{
            fontFamily: DISPLAY, fontSize: 22, fontWeight: 600,
            letterSpacing: "-0.02em", color: C.text, marginTop: 12,
          }}>
            Got a code?
          </div>
          <div style={{ fontSize: 13, color: C.text2, marginTop: 8, lineHeight: 1.5, fontFamily: BODY }}>
            Enter it to apply a discount to your Pro plan.
          </div>
          <div style={{ marginTop: 20 }}>
            <div style={{
              fontFamily: MONO, fontSize: 9.5, letterSpacing: "0.16em",
              color: C.muted, textTransform: "uppercase", marginBottom: 8,
            }}>
              Code
            </div>
            <div style={{
              display: "flex", alignItems: "center", gap: 8,
              borderBottom: `1px solid ${discount > 0 ? C.live : C.border2}`, padding: "10px 0",
            }}>
              <input
                value={code}
                onChange={(e) => setCode(e.target.value.toUpperCase())}
                placeholder="ENTER CODE"
                style={{
                  flex: 1, background: "transparent", border: "none", outline: "none",
                  fontFamily: MONO, fontSize: 16, color: C.text, letterSpacing: "0.06em",
                  padding: 0,
                }}
              />
              {discount > 0 && <MonoTag C={C} tone="green">−{Math.round(discount * 100)}%</MonoTag>}
            </div>
          </div>
          {discount > 0 && (
            <div style={{
              display: "flex", justifyContent: "space-between",
              marginTop: 18, padding: "14px 0", borderTop: `1px solid ${C.line}`,
            }}>
              <span style={{ fontSize: 13, color: C.text2, fontFamily: BODY }}>Pro · first 3 months</span>
              <span style={{ fontFamily: DISPLAY, fontSize: 15, color: C.text }}>
                <span style={{ color: C.muted, textDecoration: "line-through", marginRight: 8 }}>{basePrice}</span>
                ${discounted}
              </span>
            </div>
          )}
        </div>
      </Card>
      <div style={{ marginTop: 20 }}>
        <SettingsBtn C={C} kind={discount > 0 ? "live" : "ghost"} full disabled={discount === 0} onClick={() => onApply?.(code)}>
          Apply code
        </SettingsBtn>
      </div>
    </SettingsSub>
  );
}

// ═══════════════════════════════════════════════════════════════════════════
// Account deletion — step 1 warning
// ═══════════════════════════════════════════════════════════════════════════

export function AccountDeleteWarnScreen({
  C, tradeCount = 0, onDownloadFirst, onContinue, onBack,
}: {
  C: Theme; tradeCount?: number;
  onDownloadFirst?: () => void; onContinue?: () => void; onBack?: () => void;
}) {
  const items = [
    `${tradeCount.toLocaleString()} logged trades & screenshots`,
    "All stats, streaks & discipline history",
    "Your @handle and Circle memberships",
    "Your Pro subscription (cancelled, no refund)",
  ];
  return (
    <SettingsSub C={C} title="Delete account" onBack={onBack}>
      <div style={{
        width: 56, height: 56, borderRadius: 999, background: C.redSoft,
        display: "flex", alignItems: "center", justifyContent: "center",
        margin: "8px 0 18px",
      }}>
        <IconTrash c={C.red} s={24} />
      </div>
      <div style={{
        fontFamily: DISPLAY, fontSize: 23, fontWeight: 600,
        letterSpacing: "-0.02em", color: C.text, lineHeight: 1.1,
      }}>
        This deletes everything.
      </div>
      <div style={{ fontSize: 13.5, color: C.text2, marginTop: 12, lineHeight: 1.55, fontFamily: BODY }}>
        Deleting your account permanently removes:
      </div>
      <div style={{ marginTop: 16 }}>
        {items.map((x, i) => (
          <div
            key={i}
            style={{
              display: "flex", gap: 10, alignItems: "flex-start",
              padding: "9px 0", borderTop: i ? `1px solid ${C.line}` : "none",
            }}
          >
            <IconClose c={C.red} s={15} />
            <span style={{ fontSize: 13, color: C.text, fontFamily: BODY }}>{x}</span>
          </div>
        ))}
      </div>
      <div style={{ marginTop: 24, display: "flex", flexDirection: "column", gap: 10 }}>
        <SettingsBtn C={C} kind="ghost" full onClick={onDownloadFirst}>
          Download my data first
        </SettingsBtn>
        <SettingsBtn C={C} kind="danger" full onClick={onContinue}>
          Continue to delete
        </SettingsBtn>
      </div>
    </SettingsSub>
  );
}

// ═══════════════════════════════════════════════════════════════════════════
// Account deletion — step 2 confirm
// ═══════════════════════════════════════════════════════════════════════════

const DELETE_REASONS = [
  "Too expensive",
  "Missing a feature",
  "Not trading anymore",
  "Found an alternative",
  "Other",
];

export function AccountDeleteConfirmScreen({
  C, onDelete, onBack,
}: {
  C: Theme;
  onDelete?: (reason: string, confirmation: string) => void;
  onBack?: () => void;
}) {
  const [reason, setReason] = useState<string | null>(null);
  const [confirm, setConfirm] = useState("");
  const valid = !!reason && confirm === "DELETE";

  return (
    <SettingsSub C={C} title="Confirm deletion" onBack={onBack}>
      <div style={{
        fontFamily: MONO, fontSize: 9.5, letterSpacing: "0.14em",
        color: C.muted, textTransform: "uppercase",
      }}>
        Step 2 of 2
      </div>
      <div style={{
        fontFamily: DISPLAY, fontSize: 21, fontWeight: 600,
        color: C.text, marginTop: 12, lineHeight: 1.15,
      }}>
        Why are you leaving?
      </div>
      <div style={{ display: "flex", flexWrap: "wrap", gap: 8, marginTop: 16 }}>
        {DELETE_REASONS.map(r => {
          const on = reason === r;
          return (
            <button
              key={r}
              onClick={() => setReason(r)}
              style={{
                padding: "8px 16px", borderRadius: 999,
                background: on ? C.accentSoft : "transparent",
                color: on ? C.accent : C.text,
                border: on
                  ? `1px solid color-mix(in oklch, ${C.accent} 40%, transparent)`
                  : `1px solid ${C.border2}`,
                fontFamily: BODY, fontSize: 13, fontWeight: 500, cursor: "pointer",
                whiteSpace: "nowrap",
              }}
            >
              {r}
            </button>
          );
        })}
      </div>
      <div style={{ marginTop: 22 }}>
        <div style={{
          fontFamily: MONO, fontSize: 9.5, letterSpacing: "0.16em",
          color: C.muted, textTransform: "uppercase", marginBottom: 8,
        }}>
          Type "DELETE" to confirm
        </div>
        <div style={{
          display: "flex", alignItems: "center", gap: 8,
          borderBottom: `1px solid ${confirm === "DELETE" ? C.red : C.border2}`,
          padding: "10px 0",
        }}>
          <input
            value={confirm}
            onChange={(e) => setConfirm(e.target.value.toUpperCase())}
            placeholder="DELETE"
            style={{
              flex: 1, background: "transparent", border: "none", outline: "none",
              fontFamily: MONO, fontSize: 16, color: C.text, letterSpacing: "0.06em",
              padding: 0,
            }}
          />
        </div>
      </div>
      <div style={{ marginTop: 14 }}>
        <Banner
          C={C}
          tone="warn"
          icon={<IconClock c={C.warn} />}
          title="14-day grace period"
          body="Your account is recoverable for 14 days. After that it's gone for good."
        />
      </div>
      <div style={{ marginTop: 22 }}>
        <SettingsBtn
          C={C} kind="danger" full
          disabled={!valid}
          onClick={() => onDelete?.(reason!, confirm)}
        >
          Delete my account
        </SettingsBtn>
      </div>
    </SettingsSub>
  );
}

// ═══════════════════════════════════════════════════════════════════════════
// Account deletion — scheduled state
// ═══════════════════════════════════════════════════════════════════════════

export function AccountDeleteScheduledScreen({
  C, deletionDate = "Jun 18", onCancel, onBack,
}: {
  C: Theme; deletionDate?: string;
  onCancel?: () => void; onBack?: () => void;
}) {
  return (
    <SettingsSub C={C} title="Account deletion" onBack={onBack}>
      <div style={{
        display: "flex", flexDirection: "column", alignItems: "center",
        textAlign: "center", padding: "30px 0",
      }}>
        <div style={{
          width: 64, height: 64, borderRadius: 999, background: C.warnSoft,
          display: "flex", alignItems: "center", justifyContent: "center", marginBottom: 20,
        }}>
          <IconClock c={C.warn} s={28} />
        </div>
        <div style={{
          fontFamily: DISPLAY, fontSize: 22, fontWeight: 600,
          letterSpacing: "-0.02em", color: C.text,
        }}>
          Scheduled for deletion
        </div>
        <div style={{
          fontSize: 13.5, color: C.text2, marginTop: 12, lineHeight: 1.55,
          maxWidth: "32ch", fontFamily: BODY,
        }}>
          Your account and all data will be erased on{" "}
          <span style={{ color: C.text }}>{deletionDate}</span>.{" "}
          Change your mind any time before then.
        </div>
      </div>
      <SettingsBtn C={C} kind="live" full onClick={onCancel}>
        Cancel deletion & keep my account
      </SettingsBtn>
    </SettingsSub>
  );
}

// ═══════════════════════════════════════════════════════════════════════════
// Data export
// ═══════════════════════════════════════════════════════════════════════════

export function DataExportScreen({
  C, recent = defaultExports(),
  onGenerate, onDownload, onBack,
}: {
  C: Theme;
  recent?: { name: string; status: string; ready: boolean }[];
  onGenerate?: (formats: string[]) => void;
  onDownload?: (name: string) => void;
  onBack?: () => void;
}) {
  const [formats, setFormats] = useState<string[]>(["CSV", "JSON"]);
  const toggle = (f: string) =>
    setFormats(formats.includes(f) ? formats.filter(x => x !== f) : [...formats, f]);

  return (
    <SettingsSub C={C} title="Export data" onBack={onBack}>
      <Card C={C} pad={18}>
        <Kicker C={C}>Your data</Kicker>
        <div style={{
          fontSize: 13.5, color: C.text2, marginTop: 10, lineHeight: 1.55, fontFamily: BODY,
        }}>
          Download everything — trades, stats, journal notes and screenshots — as a portable archive.
        </div>
        <div style={{ display: "flex", gap: 8, marginTop: 16, flexWrap: "wrap" }}>
          {["CSV", "JSON", "Screenshots .zip"].map(f => {
            const on = formats.includes(f);
            return (
              <button
                key={f}
                onClick={() => toggle(f)}
                style={{
                  padding: "7px 14px", borderRadius: 999,
                  background: on ? C.liveSoft : "transparent",
                  color: on ? C.live : C.text,
                  border: on
                    ? `1px solid color-mix(in oklch, ${C.live} 40%, transparent)`
                    : `1px solid ${C.border2}`,
                  fontFamily: BODY, fontSize: 12.5, fontWeight: 500, cursor: "pointer",
                }}
              >
                {f}
              </button>
            );
          })}
        </div>
      </Card>
      <SectionLabel C={C}>Recent exports</SectionLabel>
      {recent.map(e => (
        <Card C={C} pad={16} key={e.name} style={{ marginBottom: 10 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
            <div style={{
              width: 34, height: 34, borderRadius: 9, background: C.greenSoft,
              display: "flex", alignItems: "center", justifyContent: "center",
            }}>
              <IconDownload c={C.green} s={18} />
            </div>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontSize: 13.5, color: C.text, fontFamily: BODY }}>{e.name}</div>
              <div style={{ fontFamily: MONO, fontSize: 10, color: C.muted, marginTop: 2 }}>{e.status}</div>
            </div>
            <SettingsBtn C={C} kind="live" size="sm" onClick={() => onDownload?.(e.name)}>
              Get
            </SettingsBtn>
          </div>
        </Card>
      ))}
      <div style={{ marginTop: 22 }}>
        <SettingsBtn
          C={C} kind="ghost" full
          disabled={formats.length === 0}
          onClick={() => onGenerate?.(formats)}
        >
          Generate new export
        </SettingsBtn>
      </div>
    </SettingsSub>
  );
}
function defaultExports() {
  return [
    { name: "koda-export-jun4.zip", status: "READY · 4.2 MB · EXPIRES IN 24H", ready: true },
  ];
}

// ═══════════════════════════════════════════════════════════════════════════
// Two-factor setup
// ═══════════════════════════════════════════════════════════════════════════

export function TwoFactorScreen({
  C, qrUrl, onEnable, onShowKey, onBack,
}: {
  C: Theme; qrUrl?: string;
  onEnable?: (code: string) => void; onShowKey?: () => void; onBack?: () => void;
}) {
  const [code, setCode] = useState("");
  const valid = /^\d{3}\s?\d{3}$/.test(code.replace(/\s/g, ""));

  return (
    <SettingsSub C={C} title="Two-factor auth" onBack={onBack}>
      <div style={{ fontSize: 13.5, color: C.text2, lineHeight: 1.55, fontFamily: BODY }}>
        Scan this with your authenticator app, then enter the 6-digit code to turn on 2FA.
      </div>
      <div style={{ display: "flex", justifyContent: "center", margin: "22px 0" }}>
        {qrUrl ? (
          <img
            src={qrUrl}
            alt="2FA QR code"
            style={{ width: 176, height: 176, borderRadius: 18, background: "#fff", padding: 14 }}
          />
        ) : (
          <div style={{
            width: 176, height: 176, borderRadius: 18, background: "#fff",
            padding: 14, boxSizing: "border-box",
            display: "flex", alignItems: "center", justifyContent: "center",
            fontFamily: MONO, fontSize: 11, color: "#888",
          }}>
            QR loading…
          </div>
        )}
      </div>
      <div>
        <div style={{
          fontFamily: MONO, fontSize: 9.5, letterSpacing: "0.16em",
          color: C.muted, textTransform: "uppercase", marginBottom: 8,
        }}>
          6-digit code
        </div>
        <div style={{
          display: "flex", alignItems: "center", gap: 8,
          borderBottom: `1px solid ${valid ? C.live : C.border2}`, padding: "10px 0",
        }}>
          <input
            value={code}
            onChange={(e) => setCode(e.target.value)}
            inputMode="numeric"
            placeholder="000 000"
            style={{
              flex: 1, background: "transparent", border: "none", outline: "none",
              fontFamily: MONO, fontSize: 20, color: C.text, letterSpacing: "0.08em",
              padding: 0,
            }}
          />
        </div>
      </div>
      <div style={{ marginTop: 22 }}>
        <SettingsBtn C={C} kind={valid ? "live" : "ghost"} full disabled={!valid} onClick={() => onEnable?.(code)}>
          Enable 2FA
        </SettingsBtn>
      </div>
      <div style={{ textAlign: "center", marginTop: 14, fontSize: 12, color: C.muted, fontFamily: BODY }}>
        Can't scan?{" "}
        <span onClick={onShowKey} style={{ color: C.text2, cursor: "pointer", textDecoration: "underline" }}>
          Enter setup key
        </span>
      </div>
    </SettingsSub>
  );
}

// ═══════════════════════════════════════════════════════════════════════════
// Devices / sessions
// ═══════════════════════════════════════════════════════════════════════════

export interface DeviceSession {
  id: string;
  label: string;        // "MacBook Pro · Chrome"
  meta: string;         // "London · 2h ago"
  current?: boolean;
}

export function DevicesScreen({
  C, current, others = [],
  onRevoke, onRevokeAll, onBack,
}: {
  C: Theme;
  current?: DeviceSession;
  others?: DeviceSession[];
  onRevoke?: (id: string) => void;
  onRevokeAll?: () => void;
  onBack?: () => void;
}) {
  const cur = current ?? { id: "this", label: "This device", meta: "ACTIVE NOW", current: true };
  return (
    <SettingsSub C={C} title="Devices" onBack={onBack}>
      <SectionLabel C={C}>This device</SectionLabel>
      <Card C={C} pad={16}>
        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
          <div style={{
            width: 34, height: 34, borderRadius: 9, background: C.liveSoft,
            display: "flex", alignItems: "center", justifyContent: "center",
          }}>
            <IconUser c={C.live} s={18} />
          </div>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontSize: 13.5, color: C.text, fontFamily: BODY }}>{cur.label}</div>
            <div style={{ fontFamily: MONO, fontSize: 10, color: C.muted, marginTop: 2 }}>{cur.meta}</div>
          </div>
          <MonoTag C={C} tone="green">This</MonoTag>
        </div>
      </Card>
      {others.length > 0 && (
        <>
          <SectionLabel C={C}>Other sessions</SectionLabel>
          <Card C={C} pad={0}>
            {others.map((s, i) => (
              <div
                key={s.id}
                style={{
                  display: "flex", alignItems: "center", gap: 12,
                  padding: "14px 16px", borderTop: i ? `1px solid ${C.line}` : "none",
                }}
              >
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: 13.5, color: C.text, fontFamily: BODY }}>{s.label}</div>
                  <div style={{ fontFamily: MONO, fontSize: 10, color: C.muted, marginTop: 2 }}>{s.meta}</div>
                </div>
                <button
                  onClick={() => onRevoke?.(s.id)}
                  style={{
                    background: "transparent", border: "none",
                    fontFamily: MONO, fontSize: 10, letterSpacing: "0.08em", color: C.red,
                    cursor: "pointer", padding: 4,
                  }}
                >
                  REVOKE
                </button>
              </div>
            ))}
          </Card>
          <div style={{ marginTop: 22 }}>
            <SettingsBtn C={C} kind="danger" full onClick={onRevokeAll}>
              Sign out all other devices
            </SettingsBtn>
          </div>
        </>
      )}
    </SettingsSub>
  );
}

// ═══════════════════════════════════════════════════════════════════════════
// Broker disconnect — bottom sheet
// ═══════════════════════════════════════════════════════════════════════════

export function BrokerDisconnectSheet({
  C, broker = "Tradovate", existingCount = 0, onCancel, onDisconnect,
}: {
  C: Theme; broker?: string; existingCount?: number;
  onCancel?: () => void; onDisconnect?: () => void;
}) {
  return (
    <div
      role="dialog"
      aria-modal="true"
      style={{
        position: "fixed", inset: 0, zIndex: 9000,
        background: "rgba(10,10,11,0.7)", backdropFilter: "blur(6px)",
        WebkitBackdropFilter: "blur(6px)",
        display: "flex", alignItems: "flex-end", justifyContent: "center",
        padding: 14,
        animation: "kFadeIn 0.22s ease-out",
      }}
      onClick={onCancel}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          width: "100%", maxWidth: 480, borderRadius: 24,
          background: C.panel, border: `1px solid ${C.border2}`, padding: 22,
          animation: "kSlideIn 0.32s cubic-bezier(.2,.8,.2,1)",
        }}
      >
        <div style={{
          width: 48, height: 48, borderRadius: 12,
          background: C.surfaceHi, border: `1px solid ${C.border2}`,
          display: "flex", alignItems: "center", justifyContent: "center", marginBottom: 16,
        }}>
          <IconRefresh c={C.warn} />
        </div>
        <div style={{
          fontFamily: DISPLAY, fontSize: 20, fontWeight: 600, color: C.text,
        }}>
          Disconnect {broker}?
        </div>
        <div style={{ fontSize: 13.5, color: C.text2, marginTop: 10, lineHeight: 1.55, fontFamily: BODY }}>
          New fills will stop importing. Your{" "}
          <span style={{ color: C.text }}>{existingCount.toLocaleString()} existing trades</span>{" "}
          stay in your journal.
        </div>
        <div style={{ display: "flex", gap: 10, marginTop: 22 }}>
          <SettingsBtn C={C} kind="ghost" style={{ flex: 1 }} onClick={onCancel}>
            Cancel
          </SettingsBtn>
          <button
            onClick={onDisconnect}
            style={{
              flex: 1, padding: "13px 20px", borderRadius: 999,
              background: C.red, color: "#fff", border: "none",
              fontFamily: BODY, fontSize: 14, fontWeight: 600, cursor: "pointer",
            }}
          >
            Disconnect
          </button>
        </div>
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════
// Preferences (theme / region)
// ═══════════════════════════════════════════════════════════════════════════

export function PreferencesScreen({
  C, theme = "system", timezone = "Europe/London · GMT+1", currency = "USD ($)", language = "English",
  onThemeChange, onPickTimezone, onPickCurrency, onPickLanguage, onBack,
}: {
  C: Theme;
  theme?: "light" | "dark" | "system";
  timezone?: string; currency?: string; language?: string;
  onThemeChange?: (t: "light" | "dark" | "system") => void;
  onPickTimezone?: () => void; onPickCurrency?: () => void; onPickLanguage?: () => void;
  onBack?: () => void;
}) {
  return (
    <SettingsSub C={C} title="Preferences" onBack={onBack}>
      <SectionLabel C={C}>Theme</SectionLabel>
      <div style={{ display: "flex", gap: 8 }}>
        {(["light", "dark", "system"] as const).map(opt => {
          const on = theme === opt;
          return (
            <button
              key={opt}
              onClick={() => onThemeChange?.(opt)}
              style={{
                padding: "8px 16px", borderRadius: 999,
                background: on ? C.accentSoft : "transparent",
                color: on ? C.accent : C.text,
                border: on
                  ? `1px solid color-mix(in oklch, ${C.accent} 40%, transparent)`
                  : `1px solid ${C.border2}`,
                fontFamily: BODY, fontSize: 13, fontWeight: 500, cursor: "pointer",
                textTransform: "capitalize",
              }}
            >
              {opt}
            </button>
          );
        })}
      </div>
      <SectionLabel C={C}>Region</SectionLabel>
      <Card C={C} pad={0}>
        {[
          { label: "Time zone", value: timezone, onClick: onPickTimezone },
          { label: "Currency", value: currency, onClick: onPickCurrency },
          { label: "Language", value: language, onClick: onPickLanguage },
        ].map((row, i) => (
          <button
            key={row.label}
            onClick={row.onClick}
            style={{
              display: "flex", alignItems: "center", gap: 12,
              padding: "15px 16px", borderTop: i ? `1px solid ${C.line}` : "none",
              background: "transparent", border: "none", width: "100%", cursor: "pointer",
              textAlign: "left",
            }}
          >
            <span style={{ flex: 1, fontSize: 14, color: C.text, fontFamily: BODY }}>{row.label}</span>
            <span style={{ fontFamily: MONO, fontSize: 11, color: C.text2 }}>{row.value}</span>
            <IconChevR c={C.muted} s={16} />
          </button>
        ))}
      </Card>
    </SettingsSub>
  );
}

// ═══════════════════════════════════════════════════════════════════════════
// Feedback / bug-report
// ═══════════════════════════════════════════════════════════════════════════

export function FeedbackScreen({
  C, onSend, onBack,
}: {
  C: Theme;
  onSend?: (type: "feedback" | "bug", message: string, screenshot?: File) => void;
  onBack?: () => void;
}) {
  const [type, setType] = useState<"feedback" | "bug">("feedback");
  const [message, setMessage] = useState("");
  const [screenshot, setScreenshot] = useState<File | null>(null);

  return (
    <SettingsSub C={C} title="Send feedback" onBack={onBack}>
      <div style={{ display: "flex", gap: 8, marginBottom: 18 }}>
        {(["feedback", "bug"] as const).map(t => {
          const on = type === t;
          const label = t === "feedback" ? "Feedback" : "Bug report";
          return (
            <button
              key={t}
              onClick={() => setType(t)}
              style={{
                padding: "8px 16px", borderRadius: 999,
                background: on ? (t === "feedback" ? C.liveSoft : C.redSoft) : "transparent",
                color: on ? (t === "feedback" ? C.live : C.red) : C.text,
                border: on
                  ? `1px solid color-mix(in oklch, ${t === "feedback" ? C.live : C.red} 40%, transparent)`
                  : `1px solid ${C.border2}`,
                fontFamily: BODY, fontSize: 13, fontWeight: 500, cursor: "pointer",
              }}
            >
              {label}
            </button>
          );
        })}
      </div>
      <div>
        <div style={{
          fontFamily: MONO, fontSize: 9.5, letterSpacing: "0.16em",
          color: C.muted, textTransform: "uppercase", marginBottom: 8,
        }}>
          Tell us
        </div>
        <textarea
          value={message}
          onChange={(e) => setMessage(e.target.value)}
          placeholder={type === "feedback" ? "What would make Kōda better for you?" : "What broke? What did you expect?"}
          rows={4}
          style={{
            width: "100%", minHeight: 110, background: "transparent",
            border: "none", borderBottom: `1px solid ${C.border2}`, outline: "none",
            fontFamily: BODY, fontSize: 16, color: C.text, padding: "8px 0",
            resize: "vertical", boxSizing: "border-box",
          }}
        />
      </div>
      <label
        style={{
          display: "flex", alignItems: "center", justifyContent: "center",
          gap: 8, marginTop: 18, padding: "14px 16px", borderRadius: 14,
          border: `1.5px dashed ${C.line3}`, background: "transparent",
          color: screenshot ? C.text : C.muted, cursor: "pointer",
          fontFamily: BODY, fontSize: 13.5,
        }}
      >
        <IconPlus c={C.live} />
        {screenshot ? screenshot.name : "Attach a screenshot"}
        <input
          type="file"
          accept="image/*"
          style={{ display: "none" }}
          onChange={(e) => setScreenshot(e.target.files?.[0] || null)}
        />
      </label>
      <div style={{
        marginTop: 14, padding: "10px 14px", borderRadius: 10,
        background: C.surfaceHi, border: `1px solid ${C.line}`,
        fontFamily: MONO, fontSize: 10, color: C.muted, letterSpacing: "0.04em",
      }}>
        WE ATTACH: APP VERSION · DEVICE · LAST 50 LOGS
      </div>
      <div style={{ marginTop: 18 }}>
        <SettingsBtn
          C={C} kind="live" full
          disabled={message.trim().length < 3}
          onClick={() => onSend?.(type, message, screenshot || undefined)}
        >
          {type === "feedback" ? "Send feedback" : "Send bug report"}
        </SettingsBtn>
      </div>
    </SettingsSub>
  );
}

// ═══════════════════════════════════════════════════════════════════════════
// Broker sync + import history
// ═══════════════════════════════════════════════════════════════════════════

export interface SyncEntry {
  label: string;
  time: string;
  tone: "green" | "accent" | "red";
}

export function SyncScreen({
  C, brokerName = "Tradovate", accountId = "Apex-44219", lastSync = "2M AGO",
  history = defaultSyncHistory(), onDisconnect, onBack,
}: {
  C: Theme; brokerName?: string; accountId?: string; lastSync?: string;
  history?: SyncEntry[]; onDisconnect?: () => void; onBack?: () => void;
}) {
  return (
    <SettingsSub C={C} title="Sync" onBack={onBack} right={<MonoTag C={C} tone="green">Live</MonoTag>}>
      <Card C={C} pad={16}>
        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
          <div style={{
            width: 40, height: 40, borderRadius: 10, background: C.liveSoft,
            display: "flex", alignItems: "center", justifyContent: "center",
          }}>
            <IconRefresh c={C.live} />
          </div>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontSize: 14, fontWeight: 600, color: C.text, fontFamily: BODY }}>
              {brokerName} · {accountId}
            </div>
            <div style={{ fontFamily: MONO, fontSize: 9.5, color: C.muted, marginTop: 2 }}>
              CONNECTED · SYNCED {lastSync}
            </div>
          </div>
          <button
            onClick={onDisconnect}
            style={{
              background: "transparent", border: "none",
              fontFamily: MONO, fontSize: 10, letterSpacing: "0.08em", color: C.red,
              cursor: "pointer", padding: "4px 0",
            }}
          >
            DISCONNECT
          </button>
        </div>
      </Card>
      <SectionLabel C={C}>Import history</SectionLabel>
      <Card C={C} pad={0}>
        {history.map((e, i) => {
          const dotColor = e.tone === "green" ? C.green : e.tone === "red" ? C.red : C.accent;
          return (
            <div
              key={i}
              style={{
                display: "flex", alignItems: "center", gap: 12,
                padding: "13px 16px", borderTop: i ? `1px solid ${C.line}` : "none",
              }}
            >
              <span style={{
                width: 7, height: 7, borderRadius: "50%",
                background: dotColor, flexShrink: 0,
              }} />
              <span style={{ flex: 1, fontSize: 13.5, color: C.text, fontFamily: BODY }}>{e.label}</span>
              <span style={{ fontFamily: MONO, fontSize: 9.5, color: C.muted }}>{e.time.toUpperCase()}</span>
            </div>
          );
        })}
      </Card>
    </SettingsSub>
  );
}
function defaultSyncHistory(): SyncEntry[] {
  return [
    { label: "Synced 6 fills", time: "2m ago", tone: "green" },
    { label: "Auth refresh", time: "1h ago", tone: "accent" },
    { label: "Sync failed — token", time: "3h ago", tone: "red" },
    { label: "Synced 12 fills", time: "Yesterday", tone: "green" },
  ];
}

// ═══════════════════════════════════════════════════════════════════════════
// CSV import wizard — step 1 broker selection
// ═══════════════════════════════════════════════════════════════════════════

const CSV_BROKERS = [
  { name: "Tradovate", hint: "auto-detected" },
  { name: "NinjaTrader", hint: "" },
  { name: "Generic CSV", hint: "map columns yourself" },
];

export function CsvWizardScreen({
  C, step = 1, initialBroker = "Tradovate",
  previewRows = 142, newRows = 41, reviewRows = 1,
  onNext, onBack,
}: {
  C: Theme; step?: number; initialBroker?: string;
  previewRows?: number; newRows?: number; reviewRows?: number;
  onNext?: (broker: string) => void; onBack?: () => void;
}) {
  const [selected, setSelected] = useState(initialBroker);

  return (
    <SettingsSub C={C} title="Import CSV" onBack={onBack}>
      <div style={{
        fontFamily: MONO, fontSize: 9.5, letterSpacing: "0.14em",
        color: C.muted, textTransform: "uppercase",
      }}>
        Step {step} of 6 · Broker
      </div>
      <div style={{
        fontFamily: DISPLAY, fontSize: 20, fontWeight: 600, color: C.text,
        margin: "10px 0 16px",
      }}>
        Which broker exported this?
      </div>
      <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
        {CSV_BROKERS.map(b => {
          const on = selected === b.name;
          return (
            <button
              key={b.name}
              onClick={() => setSelected(b.name)}
              style={{
                display: "flex", alignItems: "center", gap: 12, padding: "16px",
                borderRadius: 14, textAlign: "left" as const, width: "100%",
                background: on ? C.liveSoft : C.surface,
                border: on
                  ? `1px solid color-mix(in oklch, ${C.live} 40%, transparent)`
                  : `1px solid ${C.line}`,
                cursor: "pointer",
              }}
            >
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: 14, fontWeight: 600, color: C.text, fontFamily: BODY }}>
                  {b.name}
                </div>
                {b.hint && (
                  <div style={{ fontSize: 11.5, color: C.text2, marginTop: 3, fontFamily: BODY }}>
                    {b.hint}
                  </div>
                )}
              </div>
              {on && (
                <svg width={18} height={18} viewBox="0 0 24 24" fill="none">
                  <path d="M5 12l5 5L19 8" stroke={C.live} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
              )}
            </button>
          );
        })}
      </div>
      <div style={{
        marginTop: 14, padding: "12px 14px", borderRadius: 10,
        background: C.greenSoft,
        border: `1px solid color-mix(in oklch, ${C.green} 28%, transparent)`,
        display: "flex", gap: 10, alignItems: "center",
      }}>
        <svg width={16} height={16} viewBox="0 0 24 24" fill="none">
          <path d="M5 12l5 5L19 8" stroke={C.green} strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
        <span style={{ fontSize: 12, color: C.text, fontFamily: BODY }}>
          Preview: {previewRows} rows · {newRows} new · {reviewRows} needs review
        </span>
      </div>
      <div style={{ marginTop: 18 }}>
        <SettingsBtn C={C} kind="live" full onClick={() => onNext?.(selected)}>
          Preview import
        </SettingsBtn>
      </div>
    </SettingsSub>
  );
}
