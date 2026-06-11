// ═══════════════════════════════════════════════════════════════════════════════
// Kōda · profile data layer (v2)
//
// One row per user against public.profiles. Replaces koda_profile in user_kv
// AND koda_profile_pub_<handle> in shared_kv (split across is_public flag).
//
// NOT WIRED INTO Koda.tsx YET. Safe to ship.
// ═══════════════════════════════════════════════════════════════════════════════

import { supabase } from "../lib/supabase";
import { log } from "../lib/log";

export interface Profile {
  userId: string;
  handle: string;             // citext — unique
  name: string;
  avatar: string;
  bio: string;
  broker: string;
  timezone: string;
  memberCode: string;
  isPublic: boolean;
  publicTrades: boolean;
  onboarded: boolean;
  prefs: Record<string, unknown>;
  createdAt: string;
  updatedAt: string;
}

function fromRow(r: any): Profile {
  return {
    userId: r.user_id,
    handle: String(r.handle ?? ""),
    name: r.name ?? "",
    avatar: r.avatar ?? "",
    bio: r.bio ?? "",
    broker: r.broker ?? "",
    timezone: r.timezone ?? "UTC",
    memberCode: r.member_code ?? "",
    isPublic: Boolean(r.is_public),
    publicTrades: Boolean(r.public_trades),
    onboarded: Boolean(r.onboarded),
    prefs: r.prefs ?? {},
    createdAt: r.created_at ?? "",
    updatedAt: r.updated_at ?? "",
  };
}

function toRow(p: Partial<Profile> & { userId: string }): Record<string, unknown> {
  return {
    user_id: p.userId,
    handle: p.handle?.toLowerCase().replace(/^@/, ""),
    name: p.name ?? "",
    avatar: p.avatar ?? "",
    bio: p.bio ?? "",
    broker: p.broker ?? "",
    timezone: p.timezone ?? "UTC",
    member_code: p.memberCode ?? "",
    is_public: p.isPublic ?? false,
    public_trades: p.publicTrades ?? false,
    onboarded: p.onboarded ?? false,
    prefs: p.prefs ?? {},
  };
}

export async function getProfile(userId: string): Promise<Profile | null> {
  const { data, error } = await supabase
    .from("profiles")
    .select("*")
    .eq("user_id", userId)
    .maybeSingle();
  if (error) {
    log.error("profile.getProfile", error, { userId });
    return null;
  }
  return data ? fromRow(data) : null;
}

export async function getProfileByHandle(handle: string): Promise<Profile | null> {
  const norm = handle.toLowerCase().replace(/^@/, "");
  const { data, error } = await supabase
    .from("profiles")
    .select("*")
    .eq("handle", norm)
    .eq("is_public", true)
    .maybeSingle();
  if (error) {
    log.error("profile.getProfileByHandle", error, { handle: norm });
    return null;
  }
  return data ? fromRow(data) : null;
}

// Safari surfaces fetch failures as "Load failed", Chrome as "Failed to
// fetch" — client connectivity blips, not app bugs. Keep them out of Sentry.
const NETWORK_ERROR_RE = /load failed|failed to fetch|network ?error|network request failed/i;

export async function upsertProfile(p: Partial<Profile> & { userId: string }): Promise<Profile | null> {
  const row = toRow(p);
  let { data, error } = await supabase
    .from("profiles")
    .upsert(row, { onConflict: "user_id" })
    .select()
    .single();
  if (error && error.code === "23505" && /handle/.test(error.message ?? "")) {
    // KODA-TT-P/T: the handle is owned by another account in v2 — often a
    // private/backfilled row the client can't see, so no pre-check can catch
    // it. Retry under a per-user fallback handle so the v2 row always exists
    // (losing it would break this user at the read-flip cutover). Legacy KV
    // keeps serving their display handle until the registries are reconciled.
    const fallback = `user_${p.userId.slice(0, 8)}`;
    log.info("profile.upsertProfile", `handle collision — retrying as ${fallback}`, {
      userId: p.userId,
      attempted_handle: p.handle,
    });
    ({ data, error } = await supabase
      .from("profiles")
      .upsert({ ...row, handle: fallback }, { onConflict: "user_id" })
      .select()
      .single());
  }
  if (error) {
    if (NETWORK_ERROR_RE.test(error.message ?? "")) {
      // KODA-TT-V: transient network failure — caller falls back to legacy KV.
      log.info("profile.upsertProfile", `transient network error: ${error.message}`, { userId: p.userId });
      return null;
    }
    const wrapped = new Error(error.message || error.code || "upsert failed");
    log.error("profile.upsertProfile", wrapped, { userId: p.userId, code: error.code, details: error.details, hint: error.hint });
    return null;
  }
  return fromRow(data);
}
