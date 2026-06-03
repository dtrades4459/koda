// api/push.ts — merged push endpoint; ?action=subscribe | ?action=send
export const config = { runtime: "nodejs" };

type VercelRequest  = { method?: string; url?: string; headers: Record<string, string | string[] | undefined>; body: Record<string, unknown> };
type VercelResponse = { status(n: number): VercelResponse; json(d: unknown): VercelResponse; end(): void };

import { createClient } from "@supabase/supabase-js";
import webpush from "web-push";

// Service-role client — used for all DB access and JWT verification
// (auth.getUser(token) works with the service role key)
webpush.setVapidDetails(
  `mailto:${process.env.VAPID_EMAIL}`,
  process.env.VAPID_PUBLIC_KEY!,
  process.env.VAPID_PRIVATE_KEY!
);

const supabase = createClient(process.env.SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);

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
type NotifKind = "follow" | "circle_join" | "reaction" | "idea_like";

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
async function handleNotifyCircle(req: VercelRequest, res: VercelResponse) {
  const auth = req.headers.authorization as string | undefined;
  if (!auth?.startsWith("Bearer ")) return res.status(401).json({ error: "No token" });

  const { data: { user }, error: authErr } = await supabase.auth.getUser(auth.slice(7));
  if (authErr || !user) return res.status(401).json({ error: "Invalid token" });

  const { circleCode, senderName, messagePreview } = req.body as {
    circleCode: string; senderName: string; messagePreview: string;
  };
  if (!circleCode || typeof circleCode !== "string" || circleCode.length > 64)
    return res.status(400).json({ error: "Invalid circleCode" });

  const { data: memberRows } = await supabase
    .from("circle_members")
    .select("user_id")
    .eq("circle_code", circleCode)
    .neq("role", "banned");

  if (!memberRows?.length) return res.status(200).json({ ok: true, sent: 0 });

  const recipientUids = memberRows
    .map((r: { user_id: string }) => r.user_id)
    .filter((uid: string) => uid && uid !== user.id);

  if (!recipientUids.length) return res.status(200).json({ ok: true, sent: 0 });

  const { data: subs } = await supabase
    .from("notification_subscriptions")
    .select("endpoint, p256dh, auth_key")
    .in("user_id", recipientUids);

  if (!subs?.length) return res.status(200).json({ ok: true, sent: 0 });

  const title = senderName || "New message";
  const preview = messagePreview
    ? (messagePreview.length > 80 ? messagePreview.slice(0, 77) + "…" : messagePreview)
    : "New message in your circle";

  const circlePayload = JSON.stringify({ title, body: preview, icon: "/icon-192.png" });
  await Promise.allSettled(
    subs.map((sub: { endpoint: string; p256dh: string; auth_key: string }) =>
      sendPush(sub.endpoint, sub.p256dh, sub.auth_key, circlePayload),
    ),
  );

  return res.status(200).json({ ok: true, sent: subs.length });
}

async function handleNotifyFollow(req: VercelRequest, res: VercelResponse) {
  const auth = req.headers.authorization as string | undefined;
  if (!auth?.startsWith("Bearer ")) return res.status(401).json({ error: "No token" });

  const { data: { user }, error: authErr } = await supabase.auth.getUser(auth.slice(7));
  if (authErr || !user) return res.status(401).json({ error: "Invalid token" });

  const { targetUid, followerName, followerHandle } = req.body as {
    targetUid?: string;
    followerName?: string;
    followerHandle?: string;
  };
  if (!targetUid || typeof targetUid !== "string") {
    return res.status(400).json({ error: "targetUid required" });
  }
  if (targetUid === user.id) return res.status(200).json({ ok: true }); // no self-notify

  await deliverNotification({
    targetUid,
    kind: "follow",
    title: followerName ?? followerHandle ?? "Someone",
    body: "started following you",
    data: { followerUid: user.id, followerHandle: followerHandle ?? null },
  });
  return res.status(200).json({ ok: true });
}

async function handleNotifyCircleJoin(req: VercelRequest, res: VercelResponse) {
  const auth = req.headers.authorization as string | undefined;
  if (!auth?.startsWith("Bearer ")) return res.status(401).json({ error: "No token" });

  const { data: { user }, error: authErr } = await supabase.auth.getUser(auth.slice(7));
  if (authErr || !user) return res.status(401).json({ error: "Invalid token" });

  const { circleCode, circleName, ownerUid, joinerName, joinerHandle } = req.body as {
    circleCode?: string;
    circleName?: string;
    ownerUid?: string;
    joinerName?: string;
    joinerHandle?: string;
  };
  if (!circleCode || !ownerUid) {
    return res.status(400).json({ error: "circleCode and ownerUid required" });
  }
  if (ownerUid === user.id) return res.status(200).json({ ok: true }); // creator joining their own circle

  await deliverNotification({
    targetUid: ownerUid,
    kind: "circle_join",
    title: joinerName ?? joinerHandle ?? "Someone",
    body: `joined ${circleName ?? circleCode}`,
    data: { circleCode, joinerUid: user.id, joinerHandle: joinerHandle ?? null },
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
  if (action === "broadcast") return handleBroadcast(req, res);
  return res.status(400).json({ error: "Unknown action" });
}
