// api/lib/email.ts
// Resend-based email helper for Kōda transactional emails.

const RESEND_API_KEY = process.env.RESEND_API_KEY ?? "";

function esc(s: string): string {
  return String(s)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}
const FROM = "Kōda <noreply@kodatrade.co.uk>";

const APP_ORIGIN = process.env.APP_URL ?? "https://kodatrade.co.uk";

/** Public, unauthenticated unsubscribe link clicked from an email client. */
export function buildUnsubscribeUrl(token: string, type: "weekly" | "winback" | "product" | "all"): string {
  return `${APP_ORIGIN}/api/account?action=unsubscribe&token=${encodeURIComponent(token)}&type=${type}`;
}

export async function sendEmail({ to, subject, html }: { to: string; subject: string; html: string }) {
  if (!RESEND_API_KEY) throw new Error("RESEND_API_KEY not set");
  const res = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: { Authorization: `Bearer ${RESEND_API_KEY}`, "Content-Type": "application/json" },
    body: JSON.stringify({ from: FROM, to: [to], subject, html }),
  });
  if (!res.ok) {
    const body = await res.text();
    throw new Error(`Resend error ${res.status}: ${body}`);
  }
  return res.json();
}

export function receiptHtml({ name, plan, amount, date }: { name: string; plan: string; amount: string; date: string }) {
  return `<!DOCTYPE html>
<html lang="en"><head><meta charset="UTF-8"/><title>Receipt · Kōda</title></head>
<body style="margin:0;padding:0;background:#0A0A0B;font-family:system-ui,sans-serif;color:#F2F2EE">
  <table width="100%" cellpadding="0" cellspacing="0" style="max-width:560px;margin:0 auto;padding:40px 24px">
    <tr><td>
      <p style="font-family:monospace;font-size:11px;letter-spacing:0.14em;text-transform:uppercase;color:#65655F;margin:0 0 8px">Payment receipt</p>
      <p style="font-size:26px;font-weight:600;letter-spacing:-0.02em;margin:0 0 32px">Thanks, ${esc(name)}.</p>
      <table width="100%" cellpadding="14" style="background:#131317;border-radius:14px;border:1px solid rgba(255,255,255,0.07);margin-bottom:24px">
        <tr><td style="font-size:13px;color:#A6A6A2;border-bottom:1px solid rgba(255,255,255,0.07)">Plan</td><td style="font-size:13px;color:#F2F2EE;text-align:right;border-bottom:1px solid rgba(255,255,255,0.07)">Kōda ${esc(plan)}</td></tr>
        <tr><td style="font-size:13px;color:#A6A6A2;border-bottom:1px solid rgba(255,255,255,0.07)">Amount</td><td style="font-size:13px;color:#F2F2EE;text-align:right;border-bottom:1px solid rgba(255,255,255,0.07)">${esc(amount)}</td></tr>
        <tr><td style="font-size:13px;color:#A6A6A2">Date</td><td style="font-size:13px;color:#F2F2EE;text-align:right">${esc(date)}</td></tr>
      </table>
      <a href="https://kodatrade.co.uk" style="display:inline-block;padding:12px 26px;border-radius:999px;background:#F2F2EE;color:#0A0A0B;font-family:monospace;font-size:11px;font-weight:600;letter-spacing:0.12em;text-transform:uppercase;text-decoration:none">Open Kōda →</a>
    </td></tr>
  </table>
</body></html>`;
}

export function waitlistConfirmHtml({ position }: { position: number }) {
  return `<!DOCTYPE html>
<html lang="en"><head><meta charset="UTF-8"/><meta name="viewport" content="width=device-width,initial-scale=1"/>
<title>You're on the Kōda waitlist</title></head>
<body style="margin:0;padding:0;background:#0A0A0B;font-family:system-ui,sans-serif;color:#F2F2EE">
  <table width="100%" cellpadding="0" cellspacing="0" style="max-width:560px;margin:0 auto;padding:40px 24px">
    <tr><td>
      <p style="font-family:monospace;font-size:11px;letter-spacing:0.14em;text-transform:uppercase;color:#65655F;margin:0 0 8px">Kōda · Waitlist</p>
      <p style="font-size:48px;font-weight:700;letter-spacing:-0.04em;color:oklch(0.84 0.14 175);margin:0 0 16px;line-height:1">You're #${position}.</p>
      <p style="font-size:15px;color:#A6A6A2;line-height:1.7;margin:0 0 32px">Kōda is in closed beta. You're on the list — we'll reach out when access opens.</p>
      <a href="https://kodatrade.co.uk" style="display:inline-block;padding:12px 26px;border-radius:999px;background:#F2F2EE;color:#0A0A0B;font-family:monospace;font-size:11px;font-weight:600;letter-spacing:0.12em;text-transform:uppercase;text-decoration:none">Open kodatrade.co.uk →</a>
      <p style="font-size:11px;color:#45453F;margin-top:40px;line-height:1.6">You're receiving this because you joined the Kōda waitlist.</p>
    </td></tr>
  </table>
</body></html>`;
}

// ═══════════════════════════════════════════════════════════════════════════
// CAT12 EMAIL TEMPLATES — added 2026-06-04 as part of Kōda OS redesign
// All templates use inline styles (email-client compatibility) and reference
// the Kōda OS design tokens: bg #0A0A0B, ink #F2F2EE, mute #65655F,
// live (mint) oklch(0.84 0.14 175), red oklch(0.70 0.21 25), warn oklch(0.79 0.16 75).
// Each function takes a typed param object and returns an HTML string.
// ═══════════════════════════════════════════════════════════════════════════

const EMAIL_BG = "#0A0A0B";
const EMAIL_SURFACE = "#131317";
const EMAIL_INK = "#F2F2EE";
const EMAIL_INK2 = "#A6A6A2";
const EMAIL_MUTE = "#65655F";
const EMAIL_LINE = "rgba(255,255,255,0.08)";
const EMAIL_LIVE = "oklch(0.84 0.14 175)";
const EMAIL_RED = "oklch(0.70 0.21 25)";
const EMAIL_WARN = "oklch(0.79 0.16 75)";

function emailShell({ kicker, title, body, unsubscribeUrl }: { kicker: string; title: string; body: string; unsubscribeUrl?: string }): string {
  return `<!DOCTYPE html>
<html lang="en"><head><meta charset="UTF-8"/><meta name="viewport" content="width=device-width,initial-scale=1"/>
<title>${esc(title)} · Kōda</title></head>
<body style="margin:0;padding:0;background:${EMAIL_BG};font-family:'Geist','Inter',system-ui,sans-serif;color:${EMAIL_INK}">
  <table width="100%" cellpadding="0" cellspacing="0" style="max-width:600px;margin:0 auto">
    <tr><td style="padding:26px 32px 0">
      <table width="100%" cellpadding="0" cellspacing="0"><tr>
        <td style="text-align:left">
          <span style="font-weight:600;font-size:14px;letter-spacing:0.22em;color:${EMAIL_INK}">Kōda</span>
        </td>
        <td style="text-align:right">
          <span style="font-family:'Geist Mono',monospace;font-size:9px;letter-spacing:0.16em;color:${EMAIL_MUTE};text-transform:uppercase">${esc(kicker)}</span>
        </td>
      </tr></table>
    </td></tr>
    <tr><td style="padding:4px 32px 8px">${body}</td></tr>
    <tr><td style="padding:24px 32px 30px;border-top:1px solid ${EMAIL_LINE};margin-top:8px">
      <p style="font-family:'Geist Mono',monospace;font-size:9px;letter-spacing:0.14em;color:${EMAIL_MUTE};text-transform:uppercase;margin:0">Kōda · kodatrade.co.uk</p>
      <p style="font-size:11px;color:${EMAIL_MUTE};margin:8px 0 0;line-height:1.6">You're receiving this because you have a Kōda account. <a href="https://kodatrade.co.uk/settings" style="color:${EMAIL_INK2};text-decoration:underline">Manage emails</a> · <a href="${unsubscribeUrl ?? "https://kodatrade.co.uk/settings"}" style="color:${EMAIL_INK2};text-decoration:underline">Unsubscribe</a></p>
    </td></tr>
  </table>
</body></html>`;
}

function emailH({ title, accent }: { title: string; accent?: string }): string {
  return `<h1 style="font-size:30px;font-weight:600;letter-spacing:-0.035em;line-height:1.08;color:${EMAIL_INK};margin:22px 0 0">${esc(title)}${accent ? ` <em style="font-style:italic;font-weight:500;color:${EMAIL_LIVE}">${esc(accent)}</em>` : ""}</h1>`;
}
function emailP(text: string): string {
  return `<p style="font-size:14px;color:${EMAIL_INK2};line-height:1.6;margin:14px 0 0">${text}</p>`;
}
function emailCTA({ label, href, kind = "live" }: { label: string; href: string; kind?: "live" | "ghost" | "ink" }): string {
  const bg = kind === "live" ? EMAIL_LIVE : kind === "ink" ? EMAIL_INK : "transparent";
  const fg = kind === "ghost" ? EMAIL_INK : "#0A0A0A";
  const border = kind === "ghost" ? `1px solid ${EMAIL_LINE}` : "none";
  return `<a href="${esc(href)}" style="display:inline-block;padding:13px 24px;border-radius:999px;background:${bg};color:${fg};border:${border};font-weight:600;font-size:14px;text-decoration:none">${esc(label)}</a>`;
}
function emailPanel(inner: string, extraStyle = ""): string {
  return `<div style="background:${EMAIL_SURFACE};border:1px solid ${EMAIL_LINE};border-radius:16px;padding:20px;${extraStyle}">${inner}</div>`;
}

// 1 · Welcome — sent after sign-up
export function welcomeEmailHtml({ firstName = "Trader", appUrl = "https://kodatrade.co.uk" }: { firstName?: string; appUrl?: string }): string {
  const body = `
${emailH({ title: "Your edge starts", accent: "aboard." })}
${emailP(`Hi ${esc(firstName)} — you're in. Kōda is the journal that holds you to your rules: logs every trade, surfaces your patterns, and steps in mid-tilt before a good day turns red.`)}
<div style="margin:24px 0">${emailCTA({ label: "Log your first trade →", href: `${appUrl}/?screen=log` })}</div>
${emailPanel(`
  <p style="font-family:'Geist Mono',monospace;font-size:9px;letter-spacing:0.14em;color:${EMAIL_MUTE};text-transform:uppercase;margin:0 0 14px">Three things to try first</p>
  ${[
    ["Connect your broker", "Auto-import fills from Tradovate or CSV"],
    ["Set your rules", "Pre-trade checklist + tilt signals"],
    ["Join a Circle", "Trade alongside your people"],
  ].map(([a, b], i) => `<table width="100%" cellpadding="0" cellspacing="0" style="${i ? `border-top:1px solid ${EMAIL_LINE};` : ""}margin-top:${i ? 0 : 0}"><tr><td style="padding:10px 0;vertical-align:top;width:32px"><div style="width:22px;height:22px;border-radius:999px;background:rgba(255,255,255,0.05);border:1px solid ${EMAIL_LINE};text-align:center;font-family:'Geist Mono',monospace;font-size:11px;color:${EMAIL_INK};line-height:22px">${i + 1}</div></td><td style="padding:10px 0 10px 12px"><p style="font-size:13.5px;font-weight:600;color:${EMAIL_INK};margin:0">${esc(a)}</p><p style="font-size:12px;color:${EMAIL_INK2};margin:3px 0 0">${esc(b)}</p></td></tr></table>`).join("")}
`)}`;
  return emailShell({ kicker: "Welcome", title: "Welcome to Kōda", body });
}

// 2 · Password reset
export function passwordResetEmailHtml({ email, resetUrl }: { email: string; resetUrl: string }): string {
  const body = `
${emailH({ title: "Reset your", accent: "password." })}
${emailP(`We got a request to reset the password for <span style="color:${EMAIL_INK}">${esc(email)}</span>. Tap below to choose a new one. This link expires in 30 minutes.`)}
<div style="margin:24px 0">${emailCTA({ label: "Reset password", href: resetUrl })}</div>
${emailPanel(`<table cellpadding="0" cellspacing="0"><tr><td style="vertical-align:top;padding-right:12px;width:28px">🛡️</td><td><p style="font-size:12.5px;color:${EMAIL_INK2};line-height:1.6;margin:0">Didn't request this? You can safely ignore this email — your password won't change until you create a new one.</p></td></tr></table>`)}`;
  return emailShell({ kicker: "Security", title: "Reset your Kōda password", body });
}

// 3 · Email verification (with 6-digit code)
export function emailVerificationHtml({ code, verifyUrl }: { code: string; verifyUrl: string }): string {
  const codeFormatted = code.replace(/(\d{3})(\d{3})/, "$1 $2");
  const body = `
${emailH({ title: "Confirm your", accent: "email." })}
${emailP("One tap and you're set. Verifying keeps your account secure and your weekly recaps landing in the right inbox.")}
<div style="display:block;text-align:center;margin:28px 0">
  <span style="display:inline-block;font-family:'Geist Mono',monospace;font-size:34px;font-weight:600;letter-spacing:0.34em;color:${EMAIL_INK};padding:18px 26px;background:${EMAIL_SURFACE};border:1px solid ${EMAIL_LINE};border-radius:16px">${esc(codeFormatted)}</span>
</div>
<div style="text-align:center">${emailCTA({ label: "Or verify in one tap →", href: verifyUrl, kind: "ghost" })}</div>`;
  return emailShell({ kicker: "Verify", title: `Verify your email — code ${codeFormatted}`, body });
}

// 4 · Payment failed
export function paymentFailedEmailHtml({
  cardLast4, amount = "$24.99", retryDate = "soon", updateUrl,
}: { cardLast4: string; amount?: string; retryDate?: string; updateUrl: string }): string {
  const body = `
${emailH({ title: "Your payment was", accent: "declined." })}
${emailP("We couldn't charge your card for Kōda Pro. No features are locked yet — update your payment method within 7 days to keep your Pro tools.")}
<div style="margin:22px 0">
${emailPanel(`<table width="100%" cellpadding="0" cellspacing="0"><tr><td style="width:36px;vertical-align:middle;padding-right:14px">💳</td><td style="vertical-align:middle"><p style="font-size:13.5px;font-weight:600;color:${EMAIL_INK};margin:0">Visa ending ${esc(cardLast4)}</p><p style="font-size:12px;color:${EMAIL_RED};margin:3px 0 0">Declined</p></td><td style="text-align:right;vertical-align:middle"><span style="font-family:'Geist Mono',monospace;font-size:13px;color:${EMAIL_INK}">${esc(amount)}</span></td></tr></table>`, `border-color:color-mix(in oklch, ${EMAIL_RED} 30%, transparent);background:color-mix(in oklch, ${EMAIL_RED} 8%, ${EMAIL_SURFACE})`)}
</div>
${emailCTA({ label: "Update payment method", href: updateUrl })}
<p style="font-size:12px;color:${EMAIL_MUTE};margin-top:16px">We'll retry automatically on ${esc(retryDate)}. <a href="${esc(updateUrl)}" style="color:${EMAIL_INK2};text-decoration:underline">View invoice</a></p>`;
  return emailShell({ kicker: "Billing · action needed", title: "Payment declined — action needed", body });
}

// 5 · Subscription cancelled
export function subscriptionCancelledEmailHtml({
  endsDate, reactivateUrl,
}: { endsDate: string; reactivateUrl: string }): string {
  const body = `
${emailH({ title: "Your Pro plan is", accent: "cancelled." })}
${emailP(`You'll keep Pro until <span style="color:${EMAIL_INK}">${esc(endsDate)}</span>. After that you'll move to the free plan — your trades, stats and Circles all stay exactly where they are.`)}
<div style="margin:22px 0">${emailPanel(`
  <p style="font-family:'Geist Mono',monospace;font-size:9px;letter-spacing:0.14em;color:${EMAIL_MUTE};text-transform:uppercase;margin:0 0 12px">What changes on the free plan</p>
  ${[
    ["Trade history", "Last 30 days"],
    ["AI insights", "Off"],
    ["Circles", "Join only"],
  ].map(([a, b], i) => `<table width="100%" cellpadding="0" cellspacing="0" style="${i ? `border-top:1px solid ${EMAIL_LINE};` : ""}padding:9px 0;font-size:13px"><tr><td style="padding:9px 0;color:${EMAIL_INK2}">${esc(a)}</td><td style="padding:9px 0;text-align:right;color:${EMAIL_INK};font-weight:500">${esc(b)}</td></tr></table>`).join("")}
`)}</div>
${emailCTA({ label: "Reactivate Pro", href: reactivateUrl, kind: "ghost" })}`;
  return emailShell({ kicker: "Billing", title: "Your Kōda Pro plan has been cancelled", body });
}

// 6 · Account deletion confirmation
export function accountDeletionEmailHtml({
  deletionDate, recoverUrl, exportUrl,
}: { deletionDate: string; recoverUrl: string; exportUrl: string }): string {
  const body = `
${emailH({ title: "Your account is being", accent: "deleted." })}
${emailP(`We've received your request to delete your Kōda account. Everything will be permanently erased on <span style="color:${EMAIL_INK}">${esc(deletionDate)}</span> — a 14-day grace period in case you change your mind.`)}
<div style="margin:22px 0">${emailPanel(`<table cellpadding="0" cellspacing="0"><tr><td style="vertical-align:top;padding-right:12px;width:28px;color:${EMAIL_WARN}">⚠️</td><td><p style="font-size:12.5px;color:${EMAIL_INK2};line-height:1.6;margin:0">This erases all trades, stats, Circles and your handle. It cannot be undone after the grace period.</p></td></tr></table>`)}</div>
${emailCTA({ label: "Keep my account", href: recoverUrl, kind: "ghost" })}
<p style="font-size:12px;color:${EMAIL_MUTE};margin-top:16px">Want your data first? <a href="${esc(exportUrl)}" style="color:${EMAIL_INK2};text-decoration:underline">Download an export</a></p>`;
  return emailShell({ kicker: "Account", title: "Your Kōda account is scheduled for deletion", body });
}

// 7 · Milestone celebration (streak)
export function milestoneEmailHtml({
  streakDays, discipline = "0%", netR = "+0R", shareUrl,
}: { streakDays: number; discipline?: string; netR?: string; shareUrl: string }): string {
  const body = `
<div style="text-align:center;margin:28px 0 8px">
  <div style="display:inline-block;width:96px;height:96px;border-radius:999px;background:radial-gradient(circle at 50% 40%, color-mix(in oklch, ${EMAIL_LIVE} 30%, transparent), transparent 70%);text-align:center;line-height:96px">
    <span style="font-size:40px;font-weight:700;color:${EMAIL_LIVE};letter-spacing:-0.04em">${streakDays}</span>
  </div>
</div>
<div style="text-align:center">${emailH({ title: `A ${streakDays}-day`, accent: "streak." })}</div>
<div style="text-align:center">${emailP(`${streakDays} trading days, every rule logged. That's not luck — that's a process. Keep the chain alive.`)}</div>
<table width="100%" cellpadding="0" cellspacing="0" style="margin:24px 0">
  <tr>
    <td style="padding-right:6px">${emailPanel(`<p style="font-family:'Geist Mono',monospace;font-size:9px;letter-spacing:0.12em;color:${EMAIL_MUTE};text-transform:uppercase;margin:0">Discipline</p><p style="font-size:26px;font-weight:600;color:${EMAIL_LIVE};margin:6px 0 0">${esc(discipline)}</p>`, "text-align:center")}</td>
    <td style="padding-left:6px">${emailPanel(`<p style="font-family:'Geist Mono',monospace;font-size:9px;letter-spacing:0.12em;color:${EMAIL_MUTE};text-transform:uppercase;margin:0">Net</p><p style="font-size:26px;font-weight:600;color:${EMAIL_LIVE};margin:6px 0 0">${esc(netR)}</p>`, "text-align:center")}</td>
  </tr>
</table>
<div style="text-align:center">${emailCTA({ label: "Share your streak →", href: shareUrl })}</div>`;
  return emailShell({ kicker: "Milestone", title: `🔥 ${streakDays}-day discipline streak`, body });
}

// 8 · Broker sync error
export function brokerSyncErrorEmailHtml({
  broker = "Tradovate", accountLabel = "Apex-44219", since = "recently", reconnectUrl,
}: { broker?: string; accountLabel?: string; since?: string; reconnectUrl: string }): string {
  const body = `
${emailH({ title: `Your ${broker} sync`, accent: "paused." })}
${emailP(`We couldn't reach your ${broker} account since <span style="color:${EMAIL_INK}">${esc(since)}</span>. Recent fills may be missing from today's journal.`)}
<div style="margin:22px 0">${emailPanel(`<table cellpadding="0" cellspacing="0"><tr><td style="width:36px;vertical-align:middle;padding-right:12px"><div style="width:36px;height:36px;border-radius:9px;background:rgba(255,255,255,0.05);border:1px solid ${EMAIL_LINE};text-align:center;line-height:36px">🔄</div></td><td style="vertical-align:middle"><p style="font-size:13.5px;font-weight:600;color:${EMAIL_INK};margin:0">${esc(broker)} · ${esc(accountLabel)}</p><p style="font-size:12px;color:${EMAIL_WARN};margin:3px 0 0">Authorization expired</p></td></tr></table>`)}</div>
${emailCTA({ label: "Reconnect broker", href: reconnectUrl })}`;
  return emailShell({ kicker: "Data · sync", title: `Your ${broker} sync needs attention`, body });
}

// 9 · Announcement broadcast
export function announcementEmailHtml({
  headline, accent, body: bodyCopy, ctaLabel = "See how it works", ctaUrl,
}: { headline: string; accent?: string; body: string; ctaLabel?: string; ctaUrl: string }): string {
  const body = `
<div style="height:120px;border-radius:16px;margin:22px 0 0;background:linear-gradient(135deg, color-mix(in oklch, oklch(0.55 0.22 252) 40%, ${EMAIL_BG}), color-mix(in oklch, oklch(0.68 0.18 175) 30%, ${EMAIL_BG}));border:1px solid ${EMAIL_LINE};text-align:center;line-height:120px;font-size:44px;color:${EMAIL_INK}">Kōda</div>
${emailH({ title: headline, accent })}
${emailP(esc(bodyCopy))}
<div style="margin:22px 0">${emailCTA({ label: ctaLabel, href: ctaUrl })}</div>`;
  return emailShell({ kicker: "Product news", title: headline, body });
}

// 10 · Beta unlock confirmation
export function betaUnlockEmailHtml({
  accessCode, openUrl,
}: { accessCode: string; openUrl: string }): string {
  const body = `
${emailH({ title: "You're", accent: "in." })}
${emailP("A seat opened up — your Kōda beta access is live. Log your first trade and the journal starts learning your edge.")}
<div style="margin:24px 0">${emailCTA({ label: "Open Kōda →", href: openUrl })}</div>
${emailPanel(`<table cellpadding="0" cellspacing="0"><tr><td style="vertical-align:middle;padding-right:12px;width:28px;color:${EMAIL_LIVE}">✓</td><td><p style="font-size:12.5px;color:${EMAIL_INK2};margin:0">Access code <span style="font-family:'Geist Mono',monospace;color:${EMAIL_INK}">${esc(accessCode)}</span> · already linked to this email.</p></td></tr></table>`)}`;
  return emailShell({ kicker: "Beta · unlocked", title: "Your Kōda beta seat is ready", body });
}

// 11 · Waitlist position update
export function waitlistPositionEmailHtml({
  position, prevPosition, referUrl,
}: { position: number; prevPosition?: number; referUrl: string }): string {
  const moved = prevPosition !== undefined && prevPosition > position;
  const body = `
${emailH({ title: "You moved", accent: "up." })}
${emailP("Seats open weekly and you're climbing. Refer a trader and you'll skip ahead of everyone who joined after you.")}
<div style="margin:22px 0">${emailPanel(`
  <p style="font-family:'Geist Mono',monospace;font-size:9px;letter-spacing:0.14em;color:${EMAIL_MUTE};text-transform:uppercase;margin:0;text-align:center">Your position</p>
  <p style="font-size:48px;font-weight:700;letter-spacing:-0.04em;color:${EMAIL_LIVE};margin:6px 0 0;text-align:center">#${position}</p>
  ${moved ? `<p style="font-size:12px;color:${EMAIL_INK2};margin:4px 0 0;text-align:center">up from #${prevPosition} last week</p>` : ""}
`)}</div>
<div style="text-align:center">${emailCTA({ label: "Refer a trader — skip ahead", href: referUrl, kind: "ghost" })}</div>`;
  return emailShell({ kicker: "Waitlist", title: `You moved up the Kōda waitlist — #${position}`, body });
}

// 12 · Monthly summary
export function monthlySummaryEmailHtml({
  monthLabel = "Last month", netR = "+0R", winRate = "0%", discipline = "0%",
  bestSetup = "—", bestSetupNet = "—",
  worstMistake = "—", worstMistakeCost = "—",
  reportUrl,
}: {
  monthLabel?: string; netR?: string; winRate?: string; discipline?: string;
  bestSetup?: string; bestSetupNet?: string;
  worstMistake?: string; worstMistakeCost?: string;
  reportUrl: string;
}): string {
  const netColor = netR.startsWith("-") ? EMAIL_RED : EMAIL_LIVE;
  const body = `
${emailH({ title: "Your", accent: "month." })}
${emailP(`Here's how ${esc(monthLabel)} actually went.`)}
<div style="margin:22px 0">${emailPanel(`<table width="100%" cellpadding="0" cellspacing="0"><tr>
  <td style="width:33%"><p style="font-family:'Geist Mono',monospace;font-size:9px;letter-spacing:0.12em;color:${EMAIL_MUTE};text-transform:uppercase;margin:0">Net</p><p style="font-size:26px;font-weight:600;color:${netColor};margin:6px 0 0">${esc(netR)}</p></td>
  <td style="width:33%"><p style="font-family:'Geist Mono',monospace;font-size:9px;letter-spacing:0.12em;color:${EMAIL_MUTE};text-transform:uppercase;margin:0">Win rate</p><p style="font-size:26px;font-weight:600;color:${EMAIL_INK};margin:6px 0 0">${esc(winRate)}</p></td>
  <td style="width:33%"><p style="font-family:'Geist Mono',monospace;font-size:9px;letter-spacing:0.12em;color:${EMAIL_MUTE};text-transform:uppercase;margin:0">Discipline</p><p style="font-size:26px;font-weight:600;color:${EMAIL_INK};margin:6px 0 0">${esc(discipline)}</p></td>
</tr></table>`)}</div>
<table width="100%" cellpadding="0" cellspacing="0">
  <tr>
    <td style="padding-right:6px">${emailPanel(`<p style="font-family:'Geist Mono',monospace;font-size:9px;letter-spacing:0.1em;color:${EMAIL_MUTE};margin:0">BEST SETUP</p><p style="font-size:15px;font-weight:600;color:${EMAIL_INK};margin:6px 0 0">${esc(bestSetup)}</p><p style="font-size:16px;font-weight:600;color:${EMAIL_LIVE};margin:4px 0 0">${esc(bestSetupNet)}</p>`)}</td>
    <td style="padding-left:6px">${emailPanel(`<p style="font-family:'Geist Mono',monospace;font-size:9px;letter-spacing:0.1em;color:${EMAIL_MUTE};margin:0">TOP MISTAKE</p><p style="font-size:15px;font-weight:600;color:${EMAIL_INK};margin:6px 0 0">${esc(worstMistake)}</p><p style="font-size:16px;font-weight:600;color:${EMAIL_RED};margin:4px 0 0">${esc(worstMistakeCost)}</p>`)}</td>
  </tr>
</table>
<div style="margin-top:22px">${emailCTA({ label: "See full report", href: reportUrl })}</div>`;
  return emailShell({ kicker: `${monthLabel} · in review`, title: `Your ${monthLabel} in review: ${netR}`, body });
}

// 13 · Weekly recap — net $ leads, Net R secondary when present (else Win Rate)
export function weeklyRecapHtml({
  name, netDollar, winRate, netR, bestSetup, tradeCount, weekLabel, unsubscribeUrl,
}: {
  name: string; netDollar: number; winRate: number; netR: number | null;
  bestSetup: string; tradeCount: number; weekLabel: string; unsubscribeUrl?: string;
}) {
  const positive = netDollar >= 0;
  const color = positive ? "oklch(0.78 0.18 152)" : "oklch(0.70 0.21 25)";
  const dollarStr = `${positive ? "+" : "-"}$${Math.abs(Math.round(netDollar))}`;
  const secondLabel = netR === null ? "Win Rate" : "Net R";
  const secondValue = netR === null ? `${winRate}%` : `${netR >= 0 ? "+" : ""}${netR}R`;
  const body = `
${emailH({ title: "Your week in review,", accent: `${esc(name)}.` })}
${emailP(`${esc(weekLabel)} · ${tradeCount} trade${tradeCount === 1 ? "" : "s"} logged`)}
<table width="100%" cellpadding="0" cellspacing="0" style="margin:22px 0">
  <tr>
    <td style="padding-right:6px">${emailPanel(`<p style="font-family:'Geist Mono',monospace;font-size:9px;letter-spacing:0.12em;color:${EMAIL_MUTE};text-transform:uppercase;margin:0">Net</p><p style="font-size:28px;font-weight:600;color:${color};margin:6px 0 0">${dollarStr}</p>`, "text-align:center")}</td>
    <td style="padding-left:6px">${emailPanel(`<p style="font-family:'Geist Mono',monospace;font-size:9px;letter-spacing:0.12em;color:${EMAIL_MUTE};text-transform:uppercase;margin:0">${secondLabel}</p><p style="font-size:28px;font-weight:600;color:${EMAIL_INK};margin:6px 0 0">${secondValue}</p>`, "text-align:center")}</td>
  </tr>
</table>
${bestSetup ? emailP(`Best setup this week: <strong style="color:${EMAIL_INK}">${esc(bestSetup)}</strong>`) : ""}
<div style="margin:24px 0">${emailCTA({ label: "Open Kōda →", href: "https://kodatrade.co.uk" })}</div>`;
  return emailShell({ kicker: `${weekLabel} · Weekly Recap`, title: "Your Kōda week", body, unsubscribeUrl });
}

// 14 · Win-back — re-engage a lapsed user
export function winbackEmailHtml({
  firstName = "Trader", appUrl = "https://kodatrade.co.uk", unsubscribeUrl,
}: { firstName?: string; appUrl?: string; unsubscribeUrl?: string }): string {
  const body = `
${emailH({ title: "Your edge is", accent: "waiting." })}
${emailP(`Hey ${esc(firstName)} — it's been a minute. Your journal, your rules and your stats are exactly where you left them. One logged trade and Kōda picks the thread back up.`)}
<div style="margin:24px 0">${emailCTA({ label: "Pick up where you left off →", href: `${appUrl}/?screen=log` })}</div>
${emailPanel(`<p style="font-size:12.5px;color:${EMAIL_INK2};margin:0">Traders who journal consistently break fewer rules. Don't let the streak go cold.</p>`)}`;
  return emailShell({ kicker: "We miss you", title: "Your Kōda edge is waiting", body, unsubscribeUrl });
}
