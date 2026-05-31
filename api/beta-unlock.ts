// api/beta-unlock.ts
// POST { code } → { ok: true } (200) or { error } (401 / 429)
//
// Server-side beta gate check — keeps the beta password out of the JS bundle.
// Client only needs VITE_BETA_ENABLED=true to show the gate UI.
//
// Required Vercel env var:
//   BETA_PASSWORD   — the invite code (plain text, never exposed to the client)
//
// If BETA_PASSWORD is not set the gate is treated as disabled (all callers pass).

import { timingSafeEqual } from "crypto";
import { checkRateLimit, getClientIp } from "./lib/rateLimit.js";

export const config = { runtime: "nodejs" };

type Req = { method?: string; headers: Record<string, string | string[] | undefined>; body: Record<string, unknown> };
type Res = { status(n: number): Res; json(d: unknown): Res; end(): void; setHeader(k: string, v: string): void };

const APP_URL = process.env.APP_URL ?? "https://kodatrade.co.uk";

const ALLOWED_ORIGINS = new Set([
  APP_URL,
  APP_URL.replace("://", "://www."),
  "http://localhost:5173",
  "http://localhost:4173",
]);

function cors(req: Req, res: Res) {
  const origin = (req.headers["origin"] as string | undefined) ?? "";
  const allowed = ALLOWED_ORIGINS.has(origin) ? origin : APP_URL;
  res.setHeader("Access-Control-Allow-Origin", allowed);
  res.setHeader("Vary", "Origin");
  res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");
}

function safeEqual(a: string, b: string): boolean {
  const bufA = Buffer.from(a);
  const bufB = Buffer.from(b);
  if (bufA.length !== bufB.length) return false;
  return timingSafeEqual(bufA, bufB);
}

export default async function handler(req: Req, res: Res) {
  cors(req, res);
  if (req.method === "OPTIONS") return res.status(200).end();
  if (req.method !== "POST") return res.status(405).json({ error: "Method not allowed" });

  const betaPassword = process.env.BETA_PASSWORD;
  if (!betaPassword) {
    // Gate disabled — all callers pass
    return res.status(200).json({ ok: true });
  }

  // Rate limit: 10 attempts per IP per 15 minutes
  const ip = getClientIp(req);
  const allowed = await checkRateLimit("beta_unlock", ip, { limit: 10, windowMs: 15 * 60_000 });
  if (!allowed) return res.status(429).json({ error: "Too many attempts — try again later" });

  const { code } = req.body as { code?: string };
  if (!code || typeof code !== "string") return res.status(400).json({ error: "code required" });

  const ok = safeEqual(code.trim().toLowerCase(), betaPassword.trim().toLowerCase());
  if (!ok) return res.status(401).json({ error: "Invalid code" });

  return res.status(200).json({ ok: true });
}
