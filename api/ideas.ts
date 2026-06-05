// ═══════════════════════════════════════════════════════════════════════════════
// Kōda · /api/ideas?action=list | create | like | delete
//
// Public chronological feed of trader Ideas (pre-trade and post-trade analysis).
// All actions require an authenticated Supabase JWT in the Authorization header.
// ═══════════════════════════════════════════════════════════════════════════════

export const config = { runtime: "nodejs" };

import { getAdminClient, getUserIdFromJwt } from "./lib/supabaseAdmin.js";
import { deliverNotification } from "./push.js";

type Req = {
  method?: string;
  headers: Record<string, string | string[] | undefined>;
  body: Record<string, unknown>;
  query: Record<string, string | string[] | undefined>;
};
type Res = {
  status(n: number): Res;
  json(d: unknown): Res;
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

function cors(req: Req, res: Res) {
  const origin  = (req.headers["origin"] as string | undefined) ?? "";
  const allowed = ALLOWED_ORIGINS.has(origin) ? origin : APP_URL;
  res.setHeader("Access-Control-Allow-Origin", allowed);
  res.setHeader("Vary", "Origin");
  res.setHeader("Access-Control-Allow-Methods", "GET, POST, DELETE, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type, Authorization");
}

// ── shared row → API shape mapper (snake_case → camelCase) ──────────────────
type IdeaRow = {
  id: string;
  author_uid: string;
  author_handle: string;
  author_name: string;
  author_avatar: string | null;
  type: "pre" | "post";
  title: string;
  body: string;
  instrument: string;
  timeframe: string | null;
  direction: "long" | "short" | "neutral";
  entry_price: string | null;
  stop_price: string | null;
  target_price: string | null;
  chart_url: string | null;
  linked_trade_id: number | null;
  created_at: string;
};

function rowToIdea(row: IdeaRow, likeCount: number, likedByMe: boolean) {
  return {
    id: row.id,
    authorUid: row.author_uid,
    authorHandle: row.author_handle,
    authorName: row.author_name,
    authorAvatar: row.author_avatar,
    type: row.type,
    title: row.title,
    body: row.body,
    instrument: row.instrument,
    timeframe: row.timeframe,
    direction: row.direction,
    entryPrice: row.entry_price,
    stopPrice: row.stop_price,
    targetPrice: row.target_price,
    chartUrl: row.chart_url,
    linkedTradeId: row.linked_trade_id,
    createdAt: row.created_at,
    likeCount,
    likedByMe,
  };
}

// ══════════════════════════════════════════════════════════════════════════════
// Action: list
// ══════════════════════════════════════════════════════════════════════════════
async function handleList(req: Req, res: Res) {
  const uid = await getUserIdFromJwt(req.headers.authorization as string | undefined);
  if (!uid) return res.status(401).json({ error: "Unauthorized" });

  const pageRaw = req.query.page;
  const page = Math.max(0, Number.parseInt(typeof pageRaw === "string" ? pageRaw : "0", 10) || 0);
  const limit = 20;
  const from = page * limit;
  const to   = from + limit - 1;

  const admin = getAdminClient();

  const { data: rows, error } = await admin
    .from("ideas")
    .select("*")
    .order("created_at", { ascending: false })
    .range(from, to);

  if (error) {
    console.error("[ideas/list]", error);
    return res.status(500).json({ error: "Failed to load ideas" });
  }

  const ideas = (rows ?? []) as IdeaRow[];
  if (ideas.length === 0) return res.status(200).json({ ideas: [], hasMore: false });

  const ids = ideas.map(i => i.id);

  const { data: likeRows, error: likeErr } = await admin
    .from("idea_likes")
    .select("idea_id, user_uid")
    .in("idea_id", ids);

  if (likeErr) {
    console.error("[ideas/list] likes", likeErr);
    return res.status(500).json({ error: "Failed to load likes" });
  }

  const likeCount = new Map<string, number>();
  const likedByMe = new Set<string>();
  for (const r of (likeRows ?? []) as { idea_id: string; user_uid: string }[]) {
    likeCount.set(r.idea_id, (likeCount.get(r.idea_id) ?? 0) + 1);
    if (r.user_uid === uid) likedByMe.add(r.idea_id);
  }

  const out = ideas.map(row => rowToIdea(row, likeCount.get(row.id) ?? 0, likedByMe.has(row.id)));

  return res.status(200).json({ ideas: out, hasMore: ideas.length === limit });
}

// ══════════════════════════════════════════════════════════════════════════════
// Action: create
// ══════════════════════════════════════════════════════════════════════════════
async function handleCreate(req: Req, res: Res) {
  const uid = await getUserIdFromJwt(req.headers.authorization as string | undefined);
  if (!uid) return res.status(401).json({ error: "Unauthorized" });

  const body = req.body as {
    type?: string; title?: string; body?: string; instrument?: string;
    timeframe?: string | null; direction?: string;
    entryPrice?: string | null; stopPrice?: string | null; targetPrice?: string | null;
    chartUrl?: string | null; linkedTradeId?: number | null;
  };

  if (body.type !== "pre" && body.type !== "post") return res.status(400).json({ error: "Invalid type" });
  if (!body.title || typeof body.title !== "string" || body.title.length < 1 || body.title.length > 120) return res.status(400).json({ error: "Invalid title" });
  if (!body.body || typeof body.body !== "string" || body.body.length < 1 || body.body.length > 4000) return res.status(400).json({ error: "Invalid body" });
  if (!body.instrument || typeof body.instrument !== "string" || body.instrument.length < 1 || body.instrument.length > 32) return res.status(400).json({ error: "Invalid instrument" });
  if (body.direction !== "long" && body.direction !== "short" && body.direction !== "neutral") return res.status(400).json({ error: "Invalid direction" });

  const admin = getAdminClient();

  const { data: profileRow, error: pErr } = await admin
    .from("profiles")
    .select("handle, name, avatar")
    .eq("uid", uid)
    .maybeSingle();

  if (pErr) {
    console.error("[ideas/create] profile lookup", pErr);
    return res.status(500).json({ error: "Profile lookup failed" });
  }
  if (!profileRow) return res.status(400).json({ error: "Profile not found — finish onboarding first" });

  const handle = (profileRow as { handle?: string }).handle ?? "";
  const name   = (profileRow as { name?: string }).name ?? "";
  const avatar = (profileRow as { avatar?: string | null }).avatar ?? null;

  const insertRow = {
    author_uid: uid,
    author_handle: handle,
    author_name: name,
    author_avatar: avatar,
    type: body.type,
    title: body.title.trim(),
    body: body.body.trim(),
    instrument: body.instrument.trim().toUpperCase(),
    timeframe: body.timeframe ?? null,
    direction: body.direction,
    entry_price:  body.entryPrice  ?? null,
    stop_price:   body.stopPrice   ?? null,
    target_price: body.targetPrice ?? null,
    chart_url:    body.chartUrl    ?? null,
    linked_trade_id: body.linkedTradeId ?? null,
  };

  const { data: inserted, error: insErr } = await admin
    .from("ideas")
    .insert(insertRow)
    .select("*")
    .single();

  if (insErr || !inserted) {
    console.error("[ideas/create] insert", insErr);
    return res.status(500).json({ error: "Insert failed" });
  }

  return res.status(200).json({ idea: rowToIdea(inserted as IdeaRow, 0, false) });
}

// ══════════════════════════════════════════════════════════════════════════════
// Action: like (toggle)
// ══════════════════════════════════════════════════════════════════════════════
async function handleLike(req: Req, res: Res) {
  const uid = await getUserIdFromJwt(req.headers.authorization as string | undefined);
  if (!uid) return res.status(401).json({ error: "Unauthorized" });

  const { ideaId } = req.body as { ideaId?: string };
  if (!ideaId || typeof ideaId !== "string") return res.status(400).json({ error: "Missing ideaId" });

  const admin = getAdminClient();

  const { data: existing, error: selErr } = await admin
    .from("idea_likes")
    .select("id")
    .eq("idea_id", ideaId)
    .eq("user_uid", uid)
    .maybeSingle();

  if (selErr) {
    console.error("[ideas/like] select", selErr);
    return res.status(500).json({ error: "Like check failed" });
  }

  let liked: boolean;

  if (existing) {
    const { error: delErr } = await admin
      .from("idea_likes")
      .delete()
      .eq("id", (existing as { id: string }).id);
    if (delErr) {
      console.error("[ideas/like] delete", delErr);
      return res.status(500).json({ error: "Unlike failed" });
    }
    liked = false;
  } else {
    const { error: insErr } = await admin
      .from("idea_likes")
      .insert({ idea_id: ideaId, user_uid: uid });
    if (insErr) {
      console.error("[ideas/like] insert", insErr);
      return res.status(500).json({ error: "Like failed" });
    }
    liked = true;

    // Fire notification to the idea's author (skip self-likes)
    try {
      const [{ data: ideaRow }, { data: likerProfile }] = await Promise.all([
        admin.from("ideas").select("author_uid, title").eq("id", ideaId).maybeSingle(),
        admin.from("profiles").select("name").eq("uid", uid).maybeSingle(),
      ]);
      const idea = ideaRow as { author_uid: string; title: string } | null;
      if (idea && idea.author_uid !== uid) {
        const likerName = (likerProfile as { name?: string } | null)?.name ?? "Someone";
        await deliverNotification({
          targetUid: idea.author_uid,
          kind: "idea_like",
          title: "Idea liked",
          body: `${likerName} liked "${idea.title}"`,
          data: { ideaId, fromUid: uid },
        });
      }
    } catch (err) {
      console.error("[ideas/like] notification failed:", err);
    }
  }

  const { count, error: countErr } = await admin
    .from("idea_likes")
    .select("id", { count: "exact", head: true })
    .eq("idea_id", ideaId);

  if (countErr) {
    console.error("[ideas/like] count", countErr);
    return res.status(500).json({ error: "Count failed" });
  }

  return res.status(200).json({ liked, count: count ?? 0 });
}

// ══════════════════════════════════════════════════════════════════════════════
// Action: delete
// ══════════════════════════════════════════════════════════════════════════════
async function handleDelete(req: Req, res: Res) {
  const uid = await getUserIdFromJwt(req.headers.authorization as string | undefined);
  if (!uid) return res.status(401).json({ error: "Unauthorized" });

  const idRaw = req.query.id;
  const id = typeof idRaw === "string" ? idRaw : "";
  if (!id) return res.status(400).json({ error: "Missing id" });

  const admin = getAdminClient();

  const { error } = await admin
    .from("ideas")
    .delete()
    .eq("id", id)
    .eq("author_uid", uid);

  if (error) {
    console.error("[ideas/delete]", error);
    return res.status(500).json({ error: "Delete failed" });
  }

  return res.status(200).json({ ok: true });
}

// ══════════════════════════════════════════════════════════════════════════════
// Router
// ══════════════════════════════════════════════════════════════════════════════
export default async function handler(req: Req, res: Res) {
  cors(req, res);
  if (req.method === "OPTIONS") { res.status(204).end(); return; }

  const action = req.query.action;
  const actionStr = typeof action === "string" ? action : "";

  if (req.method === "GET"    && actionStr === "list")         return handleList(req, res);
  if (req.method === "POST"   && actionStr === "create")       return handleCreate(req, res);
  if (req.method === "POST"   && actionStr === "like")         return handleLike(req, res);
  if (req.method === "DELETE" && actionStr === "delete")       return handleDelete(req, res);
  if (req.method === "POST"   && actionStr === "attach-trade") return handleAttachTrade(req, res);

  return res.status(404).json({ error: "Unknown action" });
}

// ══════════════════════════════════════════════════════════════════════════════
// Action: attach-trade — POST { ideaId, tradeId | null }
//
// Sets `linked_trade_id` on a post-trade Idea owned by the caller. Pass null
// to detach. Used by the trade-actions sheet "Attach to idea" picker (cat03).
// ══════════════════════════════════════════════════════════════════════════════

async function handleAttachTrade(req: Req, res: Res) {
  const uid = await getUserIdFromJwt(req.headers["authorization"] as string | undefined);
  if (!uid) return res.status(401).json({ error: "Not authenticated" });

  const body = req.body as { ideaId?: string; tradeId?: number | null };
  if (!body?.ideaId) return res.status(400).json({ error: "ideaId required" });

  const admin = getAdminClient();
  const { error } = await admin
    .from("ideas")
    .update({ linked_trade_id: body.tradeId ?? null })
    .eq("id", body.ideaId)
    .eq("author_uid", uid);

  if (error) {
    console.error("[ideas/attach-trade]", error);
    return res.status(500).json({ error: "Update failed" });
  }
  return res.status(200).json({ ok: true });
}
