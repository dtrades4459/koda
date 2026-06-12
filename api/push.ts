// api/push.ts — merged push endpoint; ?action=subscribe | ?action=send
export const config = { runtime: "nodejs" };

type VercelRequest  = { method?: string; url?: string; headers: Record<string, string | string[] | undefined>; body: Record<string, unknown> };
type VercelResponse = { status(n: number): VercelResponse; json(d: unknown): VercelResponse; end(): void };

import { createClient } from "@supabase/supabase-js";
import webpush from "web-push";
import { checkRateLimit, getClientIp } from "./_lib/rateLimit.js";

// Service-role client — used for all DB access and JWT verification
// (auth.getUser(token) works with the service role key)
const supabase = createClient(process.env.SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);

// Lazy VAPID init so a missing env var doesn't crash the whole module on cold
// start — only the push-sending handlers throw if VAPID is unconfigured.
let _vapidReady = false;
function ensureVapid(): void {
  if (_vapidReady) return;
  const email = process.env.VAPID_EMAIL;
  const pub   = process.env.VAPID_PUBLIC_KEY;
  const priv  = process.env.VAPID_PRIVATE_KEY;
  if (!email || !pub || !priv) {
    throw new Error("VAPID_EMAIL / VAPID_PUBLIC_KEY / VAPID_PRIVATE_KEY must all be set");
  }
  webpush.setVapidDetails(`mailto:${email}`, pub, priv);
  _vapidReady = true;
}

async function handleSubscribe(req: VercelRequest, res: VercelResponse) {
  const auth = req.headers.authorization as string | undefined;
  if (!auth?.startsWith("Bearer ")) return res.status(401).json({ error: "No token" });

  const { data: { user }, error: authErr } = await supabase.auth.getUser(auth.slice(7));
  if (authErr || !user) return res.status(401).json({ error: "Invalid token" });

  const { endpoint, keys } = req.body as { endpoint: string; keys: { p256dh: string; auth: string } };
  if (!endpoint || typeof endpoint !== "string" || endpoint.length > 512 || !endpoint.startsWith("https://"))
    return res.status(400).json({ error: "Invalid endpoint" });
  if (!keys?.p256dh || !keys?.auth) return res.status(400).json({ error: "Invalid subscription" });

  const { error } = await supabase.from("notification_subscriptions").upsert({
    user_id: user.id, endpoint, p256dh: keys.p256dh, auth_key: keys.auth,
  }, { onConflict: "user_id,endpoint" });

  if (error) return res.status(500).json({ error: error.message });
  return res.status(200).json({ ok: true });
}

async function handleSend(req: VercelRequest, res: VercelResponse) {
  const auth = req.headers.authorization as string | undefined;
  const token = auth?.startsWith("Bearer ") ? auth.slice(7) : "";
  if (!token || token !== process.env.CRON_SECRET) return res.status(401).json({ error: "Unauthorized" });

  const { userId, title, body } = req.body as { userId: string; title: string; body: string };
  if (!userId || !title) return res.status(400).json({ error: "Missing fields" });

  const { data: subs } = await supabase
    .from("notification_subscriptions")
    .select("endpoint, p256dh, auth_key")
    .eq("user_id", userId);

  if (subs?.length) {
    ensureVapid();
    await Promise.allSettled(subs.map(sub =>
      webpush.sendNotification(
        { endpoint: sub.endpoint, keys: { p256dh: sub.p256dh, auth: sub.auth_key } },
        JSON.stringify({ title, body, icon: "/icon-192.png" })
      )
    ));
  }

  return res.status(200).json({ ok: true });
}

// ---------------------------------------------------------------------------
// Low-level single-subscription sender with dead-endpoint cleanup
// ---------------------------------------------------------------------------
async function sendPush(
  endpoint: string,
  p256dh: string,
  authKey: string,
  payload: string,
): Promise<void> {
  try {
    ensureVapid();
    await webpush.sendNotification(
      { endpoint, keys: { p256dh, auth: authKey } },
      payload,
    );
  } catch (err: unknown) {
    const statusCode = (err as { statusCode?: number })?.statusCode;
    if (statusCode === 410 || statusCode === 404) {
      // Dead endpoint — remove so we stop sending to it
      await supabase.from("notification_subscriptions").delete().eq("endpoint", endpoint);
    } else {
      throw err;
    }
  }
}

// ---------------------------------------------------------------------------
// Shared notification helper — writes to notification_feed + fans out push
// ---------------------------------------------------------------------------
type NotifKind = "follow" | "circle_join" | "reaction" | "idea_like" | "digest";

interface DeliverOpts {
  targetUid: string;
  kind: NotifKind;
  title: string;
  body: string;
  data: Record<string, unknown>;
}

export async function deliverNotification(opts: DeliverOpts): Promise<void> {
  // 1. Write to in-app feed (notification_feed table from Task 7's migration)
  await supabase.from("notification_feed").insert({
    user_id: opts.targetUid,
    kind: opts.kind,
    data: { title: opts.title, body: opts.body, ...opts.data },
  });

  // 2. Fan out push to all subscribed endpoints for this user
  const { data: subs } = await supabase
    .from("notification_subscriptions")
    .select("endpoint, p256dh, auth_key")
    .eq("user_id", opts.targetUid);
  if (!subs?.length) return;

  const payload = JSON.stringify({
    title: opts.title,
    body: opts.body,
    data: { kind: opts.kind, ...opts.data },
  });

  await Promise.all(
    subs.map((s: { endpoint: string; p256dh: string; auth_key: string }) =>
      sendPush(s.endpoint, s.p256dh, s.auth_key, payload).catch((err: unknown) => {
        console.error("[push] deliver failed:", err);
      }),
    ),
  );
}

// ---------------------------------------------------------------------------
// Server-side verification helpers
//
// These close the notification-forgery hole (Security Audit 2026-06-11, M2).
// The actor's identity is always derived from the authenticated caller's
// profile — never from request-body display strings — and every notification
// is only delivered after confirming the triggering relationship actually
// exists in authoritative state (circle_members, idea_likes, or the shared_kv
// follow edge). All reads here use the service-role client and bypass RLS.
// ---------------------------------------------------------------------------

interface Actor { uid: string; memberCode: string | null; name: string; handle: string; }

/** Resolve the caller's display identity + member code from their own profile. */
async function getActor(uid: string): Promise<Actor> {
  const { data } = await supabase
    .from("profiles")
    .select("member_code, name, handle")
    .eq("user_id", uid)
    .maybeSingle();
  const row = (data ?? {}) as { member_code?: string; name?: string; handle?: string };
  return {
    uid,
    memberCode: row.member_code ?? null,
    name: (row.name && row.name.trim()) || (row.handle ? `@${row.handle}` : "Someone"),
    handle: row.handle ?? "",
  };
}

async function memberCodeForUid(uid: string): Promise<string | null> {
  const { data } = await supabase
    .from("profiles").select("member_code").eq("user_id", uid).maybeSingle();
  return ((data as { member_code?: string } | null)?.member_code) ?? null;
}

async function isCircleMemberUid(uid: string, circleCode: string): Promise<boolean> {
  const { data } = await supabase
    .from("circle_members").select("user_id")
    .eq("circle_code", circleCode).eq("user_id", uid).neq("role", "banned")
    .maybeSingle();
  return !!data;
}

async function circleOwnerUid(circleCode: string): Promise<string | null> {
  const { data } = await supabase
    .from("circle_members").select("user_id")
    .eq("circle_code", circleCode).eq("role", "owner")
    .maybeSingle();
  return ((data as { user_id?: string } | null)?.user_id) ?? null;
}

async function circleDisplayName(circleCode: string): Promise<string | null> {
  const { data } = await supabase
    .from("circles").select("name").eq("code", circleCode).maybeSingle();
  return ((data as { name?: string } | null)?.name) ?? null;
}

/** Do the two users share at least one (non-banned) circle? */
async function shareCircleWith(uidA: string, uidB: string): Promise<boolean> {
  const { data: aRows } = await supabase
    .from("circle_members").select("circle_code").eq("user_id", uidA).neq("role", "banned");
  const codes = (aRows ?? []).map((r: { circle_code: string }) => r.circle_code);
  if (!codes.length) return false;
  const { data: shared } = await supabase
    .from("circle_members").select("circle_code")
    .eq("user_id", uidB).neq("role", "banned").in("circle_code", codes).limit(1);
  return !!shared?.length;
}

/**
 * Does a follow edge `caller → target` exist? Follows live in shared_kv as
 * `koda_follow_<followerCode>_<targetCode>` owned by the follower (see
 * src/data/follows.ts). The owner_id match makes this unforgeable.
 */
async function followEdgeExists(
  followerUid: string, followerCode: string | null, targetCode: string | null,
): Promise<boolean> {
  if (!followerCode || !targetCode) return false;
  const { data } = await supabase
    .from("shared_kv").select("key")
    .eq("key", `koda_follow_${followerCode}_${targetCode}`)
    .eq("owner_id", followerUid)
    .maybeSingle();
  return !!data;
}

/** Authenticate the caller from the Bearer token; returns the uid or null. */
async function callerUid(req: VercelRequest): Promise<string | null> {
  const auth = req.headers.authorization as string | undefined;
  if (!auth?.startsWith("Bearer ")) return null;
  const { data: { user }, error } = await supabase.auth.getUser(auth.slice(7));
  if (error || !user) return null;
  return user.id;
}

/** Clamp a reaction emoji to a safe, short token before echoing it back. */
function safeEmoji(raw: unknown): string {
  if (typeof raw !== "string") return "👍";
  return raw.replace(/\s+/g, "").slice(0, 8) || "👍";
}

// ---------------------------------------------------------------------------
async function handleNotifyCircle(req: VercelRequest, res: VercelResponse) {
  const allowed = await checkRateLimit("push_notify", getClientIp(req), { limit: 20, windowMs: 60_000 });
  if (!allowed) return res.status(429).json({ error: "Too many requests" });

  const uid = await callerUid(req);
  if (!uid) return res.status(401).json({ error: "Invalid token" });

  // messagePreview is the caller's own message they just posted — legitimate to
  // echo. senderName is ignored; the title is derived from the caller's profile.
  const { circleCode, messagePreview } = req.body as { circleCode?: string; messagePreview?: string };
  if (!circleCode || typeof circleCode !== "string" || circleCode.length > 64)
    return res.status(400).json({ error: "Invalid circleCode" });

  // Only an actual member may trigger a notification to a circle.
  if (!(await isCircleMemberUid(uid, circleCode)))
    return res.status(403).json({ error: "Not a member of this circle" });

  const actor = await getActor(uid);

  const { data: memberRows } = await supabase
    .from("circle_members")
    .select("user_id")
    .eq("circle_code", circleCode)
    .neq("role", "banned");

  if (!memberRows?.length) return res.status(200).json({ ok: true, sent: 0 });

  const recipientUids = memberRows
    .map((r: { user_id: string }) => r.user_id)
    .filter((u: string) => u && u !== uid);

  if (!recipientUids.length) return res.status(200).json({ ok: true, sent: 0 });

  const { data: subs } = await supabase
    .from("notification_subscriptions")
    .select("endpoint, p256dh, auth_key")
    .in("user_id", recipientUids);

  if (!subs?.length) return res.status(200).json({ ok: true, sent: 0 });

  const previewRaw = typeof messagePreview === "string" ? messagePreview : "";
  const preview = previewRaw
    ? (previewRaw.length > 80 ? previewRaw.slice(0, 77) + "…" : previewRaw)
    : "New message in your circle";

  const circlePayload = JSON.stringify({ title: actor.name, body: preview, icon: "/icon-192.png" });
  await Promise.allSettled(
    subs.map((sub: { endpoint: string; p256dh: string; auth_key: string }) =>
      sendPush(sub.endpoint, sub.p256dh, sub.auth_key, circlePayload),
    ),
  );

  return res.status(200).json({ ok: true, sent: subs.length });
}

async function handleNotifyFollow(req: VercelRequest, res: VercelResponse) {
  const allowed = await checkRateLimit("push_notify", getClientIp(req), { limit: 20, windowMs: 60_000 });
  if (!allowed) return res.status(429).json({ error: "Too many requests" });

  const uid = await callerUid(req);
  if (!uid) return res.status(401).json({ error: "Invalid token" });

  const { targetUid } = req.body as { targetUid?: string };
  if (!targetUid || typeof targetUid !== "string") {
    return res.status(400).json({ error: "targetUid required" });
  }
  if (targetUid === uid) return res.status(200).json({ ok: true }); // no self-notify

  const actor = await getActor(uid);
  const targetCode = await memberCodeForUid(targetUid);

  // Only deliver if the caller actually follows the target — stops blind
  // "X started following you" spam to arbitrary users.
  if (!(await followEdgeExists(uid, actor.memberCode, targetCode))) {
    return res.status(200).json({ ok: true, skipped: "no-follow-edge" });
  }

  await deliverNotification({
    targetUid,
    kind: "follow",
    title: actor.name,
    body: "started following you",
    data: { followerUid: uid, followerHandle: actor.handle || null },
  });
  return res.status(200).json({ ok: true });
}

async function handleNotifyCircleJoin(req: VercelRequest, res: VercelResponse) {
  const allowed = await checkRateLimit("push_notify", getClientIp(req), { limit: 20, windowMs: 60_000 });
  if (!allowed) return res.status(429).json({ error: "Too many requests" });

  const uid = await callerUid(req);
  if (!uid) return res.status(401).json({ error: "Invalid token" });

  const { circleCode } = req.body as { circleCode?: string };
  if (!circleCode || typeof circleCode !== "string") {
    return res.status(400).json({ error: "circleCode required" });
  }

  // The caller must actually be a member of the circle they claim to have joined.
  if (!(await isCircleMemberUid(uid, circleCode))) {
    return res.status(403).json({ error: "Not a member of this circle" });
  }

  // Resolve the real owner server-side — ignore any body-supplied ownerUid so a
  // caller cannot redirect the notification to an arbitrary user.
  const ownerUid = await circleOwnerUid(circleCode);
  if (!ownerUid || ownerUid === uid) return res.status(200).json({ ok: true });

  const actor = await getActor(uid);
  const name = await circleDisplayName(circleCode);

  await deliverNotification({
    targetUid: ownerUid,
    kind: "circle_join",
    title: actor.name,
    body: `joined ${name ?? circleCode}`,
    data: { circleCode, joinerUid: uid, joinerHandle: actor.handle || null },
  });
  return res.status(200).json({ ok: true });
}

async function handleNotifyReaction(req: VercelRequest, res: VercelResponse) {
  const allowed = await checkRateLimit("push_notify", getClientIp(req), { limit: 20, windowMs: 60_000 });
  if (!allowed) return res.status(429).json({ error: "Too many requests" });

  const uid = await callerUid(req);
  if (!uid) return res.status(401).json({ error: "Unauthorized" });

  const { targetUid, surface, emoji } = req.body as {
    targetUid?: string;
    surface?: "feed_trade" | "shared_trade";
    emoji?: string;
  };
  if (!targetUid || (surface !== "feed_trade" && surface !== "shared_trade")) {
    return res.status(400).json({ error: "targetUid and valid surface required" });
  }
  if (targetUid === uid) return res.status(200).json({ ok: true });

  // The caller must plausibly be able to see the target's content:
  //   feed_trade   → target is someone the caller follows
  //   shared_trade → caller and target share a circle
  const actor = await getActor(uid);
  const related = surface === "feed_trade"
    ? await followEdgeExists(uid, actor.memberCode, await memberCodeForUid(targetUid))
    : await shareCircleWith(uid, targetUid);
  if (!related) return res.status(200).json({ ok: true, skipped: "unrelated" });

  // Body text is built server-side; caller-supplied free text is not echoed.
  const e = safeEmoji(emoji);
  await deliverNotification({
    targetUid,
    kind: "reaction",
    title: "New reaction",
    body: `${e} on your ${surface === "feed_trade" ? "trade" : "shared trade"}`,
    data: { surface, emoji: e, fromUid: uid },
  });
  return res.status(200).json({ ok: true });
}

async function handleNotifyLike(req: VercelRequest, res: VercelResponse) {
  const allowed = await checkRateLimit("push_notify", getClientIp(req), { limit: 20, windowMs: 60_000 });
  if (!allowed) return res.status(429).json({ error: "Too many requests" });

  const uid = await callerUid(req);
  if (!uid) return res.status(401).json({ error: "Unauthorized" });

  const { ideaId } = req.body as { ideaId?: string };
  if (!ideaId || typeof ideaId !== "string") {
    return res.status(400).json({ error: "ideaId required" });
  }

  // Verify against authoritative state: the caller must have actually liked this
  // idea, and the recipient is the idea's real author (derived, not body-supplied).
  const [{ data: likeRow }, { data: ideaRow }] = await Promise.all([
    supabase.from("idea_likes").select("id").eq("idea_id", ideaId).eq("user_uid", uid).maybeSingle(),
    supabase.from("ideas").select("author_uid, title").eq("id", ideaId).maybeSingle(),
  ]);
  if (!likeRow || !ideaRow) return res.status(200).json({ ok: true, skipped: "unverified" });

  const idea = ideaRow as { author_uid: string; title: string };
  if (idea.author_uid === uid) return res.status(200).json({ ok: true });

  const actor = await getActor(uid);
  await deliverNotification({
    targetUid: idea.author_uid,
    kind: "idea_like",
    title: "Idea liked",
    body: `${actor.name} liked "${idea.title}"`,
    data: { ideaId, fromUid: uid },
  });
  return res.status(200).json({ ok: true });
}

async function handleBroadcast(req: VercelRequest, res: VercelResponse) {
  const auth = req.headers.authorization as string | undefined;
  const token = auth?.startsWith("Bearer ") ? auth.slice(7) : "";
  if (!token || token !== process.env.CRON_SECRET) return res.status(401).json({ error: "Unauthorized" });

  const { title, body } = req.body as { title: string; body: string };
  if (!title || !body) return res.status(400).json({ error: "Missing title or body" });

  const { data: subs } = await supabase
    .from("notification_subscriptions")
    .select("endpoint, p256dh, auth_key");

  if (!subs?.length) return res.status(200).json({ ok: true, sent: 0 });

  ensureVapid();
  const results = await Promise.allSettled(
    subs.map((sub: { endpoint: string; p256dh: string; auth_key: string }) =>
      webpush.sendNotification(
        { endpoint: sub.endpoint, keys: { p256dh: sub.p256dh, auth: sub.auth_key } },
        JSON.stringify({ title, body, icon: "/icon-192.png" })
      )
    )
  );

  const gone = subs.filter((_: unknown, i: number) => {
    const r = results[i];
    return r.status === "rejected" && [410, 404].includes((r.reason as { statusCode?: number })?.statusCode ?? 0);
  });
  if (gone.length) {
    await Promise.allSettled(
      gone.map((sub: { endpoint: string }) =>
        supabase.from("notification_subscriptions").delete().eq("endpoint", sub.endpoint)
      )
    );
  }

  return res.status(200).json({ ok: true, sent: results.filter(r => r.status === "fulfilled").length, total: subs.length });
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== "POST") return res.status(405).end();

  const action = new URL(req.url ?? "/", "http://localhost").searchParams.get("action");

  if (action === "subscribe") return handleSubscribe(req, res);
  if (action === "send") return handleSend(req, res);
  if (action === "notify-circle") return handleNotifyCircle(req, res);
  if (action === "notify-follow") return handleNotifyFollow(req, res);
  if (action === "notify-circle-join") return handleNotifyCircleJoin(req, res);
  if (action === "notify-reaction") return handleNotifyReaction(req, res);
  if (action === "notify-like") return handleNotifyLike(req, res);
  if (action === "broadcast") return handleBroadcast(req, res);
  return res.status(400).json({ error: "Unknown action" });
}
