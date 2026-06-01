// ═══════════════════════════════════════════════════════════════════════════════
// Kōda · Waitlist API
//
// POST { email: string }
// → Rate-limited (5 req / 15 min per IP)
// → Inserts into public.waitlist; id = position number
// → 409 if email already exists (returns existing position)
// → Sends Resend confirmation email to user
// → Fire-and-forget Telegram notification to Dylon
// → Returns { ok: true, position: number, existing?: true }
//
// Required Vercel environment variables:
//   SUPABASE_URL               same value as VITE_SUPABASE_URL
//   SUPABASE_SERVICE_ROLE_KEY  service_role key
//   RESEND_API_KEY             from resend.com
//   TELEGRAM_BOT_TOKEN         Telegram bot token
//   TELEGRAM_CHAT_ID           Dylon's chat ID
// ═══════════════════════════════════════════════════════════════════════════════

export const config = { runtime: "nodejs" };

import { checkRateLimit, getClientIp } from "./lib/rateLimit.js";
import { getAdminClient } from "./lib/supabaseAdmin.js";
import { sendEmail, waitlistConfirmHtml } from "./lib/email.js";

type VercelRequest = {
  method?: string;
  headers: Record<string, string | string[] | undefined>;
  body: Record<string, unknown>;
};

type VercelResponse = {
  status(n: number): VercelResponse;
  json(d: unknown): VercelResponse;
  end(): void;
  setHeader(k: string, v: string): void;
};

const APP_URL = process.env.APP_URL ?? "https://kodatrade.co.uk";
const ALLOWED_ORIGINS = new Set([
  APP_URL,
  APP_URL.replace("://", "://www."),
  "http://localhost:5173",
  "http://localhost:4173",
]);

function cors(req: VercelRequest, res: VercelResponse): void {
  const origin = (req.headers["origin"] as string) ?? "";
  const allowed = ALLOWED_ORIGINS.has(origin) ? origin : APP_URL;
  res.setHeader("Access-Control-Allow-Origin", allowed);
  res.setHeader("Vary", "Origin");
  res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");
}

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export default async function handler(req: VercelRequest, res: VercelResponse): Promise<void> {
  cors(req, res);
  if (req.method === "OPTIONS") return res.status(200).end();
  if (req.method !== "POST") return res.status(405).json({ error: "Method not allowed" });

  const ip = getClientIp(req);
  const allowed = await checkRateLimit("waitlist", ip, { limit: 5, windowMs: 15 * 60_000 });
  if (!allowed) return res.status(429).json({ error: "Too many requests — try again later" });

  const email = (req.body?.email as string) ?? "";
  if (!email.trim() || !EMAIL_RE.test(email.trim())) {
    return res.status(400).json({ error: "Valid email required" });
  }

  const normalised = email.trim().toLowerCase();
  const admin = getAdminClient();

  // ── Insert — returns id (= position) ────────────────────────────────────────
  const { data: inserted, error: insertErr } = await admin
    .from("waitlist")
    .insert({ email: normalised })
    .select("id")
    .single();

  let position: number;
  let existing = false;

  if (insertErr) {
    // Unique violation — email already on list
    if (insertErr.code === "23505") {
      const { data: row, error: lookupErr } = await admin
        .from("waitlist")
        .select("id")
        .eq("email", normalised)
        .single();
      if (lookupErr || !row) {
        console.error("[waitlist] lookup after 23505:", lookupErr);
        return res.status(500).json({ error: "Internal error" });
      }
      position = row.id;
      existing = true;
    } else {
      console.error("[waitlist] insert:", insertErr);
      return res.status(500).json({ error: "Internal error" });
    }
  } else {
    position = inserted.id;
  }

  // ── Confirmation email (best-effort) ────────────────────────────────────────
  if (!existing) {
    try {
      await sendEmail({
        to: normalised,
        subject: "You're on the Kōda waitlist",
        html: waitlistConfirmHtml({ position }),
      });
    } catch (e) {
      console.error("[waitlist] Resend:", e);
      // Don't fail the request — the signup is saved even if the email fails
    }
  }

  // ── Telegram notification (fire-and-forget) ──────────────────────────────────
  const token = process.env.TELEGRAM_BOT_TOKEN;
  const chatId = process.env.TELEGRAM_CHAT_ID;
  if (token && chatId && !existing) {
    const text = `📋 *New waitlist signup*\n\n📧 ${normalised}\n🔢 Position #${position}`;
    fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ chat_id: chatId, text, parse_mode: "Markdown" }),
    }).catch(e => console.error("[waitlist] Telegram:", e));
  }

  return res.status(existing ? 409 : 200).json({ ok: true, position, ...(existing && { existing: true }) });
}
