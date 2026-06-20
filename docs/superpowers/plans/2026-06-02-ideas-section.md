# Kōda Ideas Section — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Ship an Ideas section in Kōda — a public chronological feed where traders post pre-trade setups or post-trade breakdowns with title/body/instrument/direction/timeframe/entry-stop-target/chart image, with one-tap likes.

**Architecture:** New `social` top-level nav tab in `Koda.tsx` (5th tab) renders the existing `FriendsFeed` component, which gains a new `"ideas"` sub-tab rendering `<IdeasScreen />`. New Supabase tables (`ideas`, `idea_likes`) with RLS. New serverless function `api/ideas.ts` with `list | create | like | delete` actions (10/12 Hobby slots). Chart uploads go client-side direct to the existing `trade-screenshots` Supabase Storage bucket.

**Tech Stack:** React 19 + TypeScript + Vite, Supabase (Postgres + Storage + Auth), Vercel serverless functions.

**Source spec:** `docs/superpowers/specs/2026-06-02-ideas-design.md`

**Important constraints:**
- No git repo in this project — commit steps are skipped; instead each task ends with a typecheck (`npm run typecheck`) as the integrity gate.
- Pre-commit hook rejects `: any` annotations — use typed alternatives or `unknown` + type guard.
- OneDrive atomic-write rule: large `Koda.tsx` writes should use Edit (not Write), and verify with `wc -l` if a big delete is involved.
- Deploys are done via `vercel` CLI (preview) or `vercel --prod` (production) from `C:\Users\Dylon\OneDrive\Desktop\koda`.

---

## File Map

| File | Action | Responsibility |
|---|---|---|
| `supabase/migrations/20260602_ideas.sql` | CREATE | `ideas` + `idea_likes` tables, RLS, schema reload |
| `api/ideas.ts` | CREATE | `?action=list \| create \| like \| delete` serverless handler |
| `src/types.ts` | MODIFY | Add `Idea` interface |
| `src/components/IdeaCard.tsx` | CREATE | Pure-presentational card (collapsed + expanded) |
| `src/IdeaComposer.tsx` | CREATE | New-idea form (modal on desktop, sheet on mobile) |
| `src/IdeasScreen.tsx` | CREATE | Feed list + paging + composer trigger + like wiring |
| `src/FriendsFeed.tsx` | MODIFY | Add `"ideas"` to tab union; render `<IdeasScreen />` |
| `src/Koda.tsx` | MODIFY | Add `"social"` to `TABS` + `NAV_TABS`; render `<FriendsFeed />` for that view; expose `myUid` to FriendsFeed |
| `src/IdeasScreen.test.tsx` | CREATE | Unit test for empty state + card rendering |

---

## Task 1: Supabase migration — `ideas` + `idea_likes` tables

**Files:**
- Create: `supabase/migrations/20260602_ideas.sql`

- [ ] **Step 1: Write the migration SQL**

Create `supabase/migrations/20260602_ideas.sql` with the following content:

```sql
-- ═══════════════════════════════════════════════════════════════════════════════
-- Kōda · ideas + idea_likes tables
--
-- Public chronological feed of trader analysis posts ("ideas").
-- Pre-trade setups and post-trade breakdowns.
-- One like per (idea_id, user_uid).
-- ═══════════════════════════════════════════════════════════════════════════════

create extension if not exists "pgcrypto";

-- ── ideas ───────────────────────────────────────────────────────────────────
create table if not exists public.ideas (
  id              uuid        primary key default gen_random_uuid(),
  author_uid      uuid        not null references auth.users(id) on delete cascade,
  author_handle   text        not null,
  author_name     text        not null,
  author_avatar   text,
  type            text        not null check (type in ('pre','post')),
  title           text        not null check (char_length(title) between 1 and 120),
  body            text        not null check (char_length(body) between 1 and 4000),
  instrument      text        not null check (char_length(instrument) between 1 and 32),
  timeframe       text,
  direction       text        not null check (direction in ('long','short','neutral')),
  entry_price     text,
  stop_price      text,
  target_price    text,
  chart_url       text,
  linked_trade_id integer,
  created_at      timestamptz not null default now()
);

create index if not exists ideas_created_at_idx on public.ideas (created_at desc);
create index if not exists ideas_author_uid_idx on public.ideas (author_uid);

alter table public.ideas enable row level security;

drop policy if exists "ideas_read_authed"   on public.ideas;
drop policy if exists "ideas_insert_self"   on public.ideas;
drop policy if exists "ideas_delete_self"   on public.ideas;

create policy "ideas_read_authed"
  on public.ideas for select
  to authenticated
  using (true);

create policy "ideas_insert_self"
  on public.ideas for insert
  to authenticated
  with check (auth.uid() = author_uid);

create policy "ideas_delete_self"
  on public.ideas for delete
  to authenticated
  using (auth.uid() = author_uid);

grant select, insert, delete on public.ideas to authenticated;

-- ── idea_likes ──────────────────────────────────────────────────────────────
create table if not exists public.idea_likes (
  id         uuid        primary key default gen_random_uuid(),
  idea_id    uuid        not null references public.ideas(id) on delete cascade,
  user_uid   uuid        not null references auth.users(id) on delete cascade,
  created_at timestamptz not null default now(),
  unique (idea_id, user_uid)
);

create index if not exists idea_likes_idea_id_idx on public.idea_likes (idea_id);
create index if not exists idea_likes_user_uid_idx on public.idea_likes (user_uid);

alter table public.idea_likes enable row level security;

drop policy if exists "idea_likes_read_authed"   on public.idea_likes;
drop policy if exists "idea_likes_insert_self"   on public.idea_likes;
drop policy if exists "idea_likes_delete_self"   on public.idea_likes;

create policy "idea_likes_read_authed"
  on public.idea_likes for select
  to authenticated
  using (true);

create policy "idea_likes_insert_self"
  on public.idea_likes for insert
  to authenticated
  with check (auth.uid() = user_uid);

create policy "idea_likes_delete_self"
  on public.idea_likes for delete
  to authenticated
  using (auth.uid() = user_uid);

grant select, insert, delete on public.idea_likes to authenticated;

notify pgrst, 'reload schema';
```

- [ ] **Step 2: Run the migration in Supabase**

Open Supabase Dashboard → SQL Editor for project `vifwjwsndchnrpvfgrmg`. Paste the contents of `supabase/migrations/20260602_ideas.sql` and run.

Expected: "Success. No rows returned."

Verify:
```sql
select count(*) from public.ideas;        -- → 0
select count(*) from public.idea_likes;   -- → 0
```

- [ ] **Step 3: Verify RLS is on**

```sql
select tablename, rowsecurity from pg_tables
  where schemaname = 'public' and tablename in ('ideas','idea_likes');
```

Expected: both rows show `rowsecurity = t`.

---

## Task 2: Add `Idea` interface to `src/types.ts`

**Files:**
- Modify: `src/types.ts` (append at end)

- [ ] **Step 1: Append the interface**

Add to the bottom of `src/types.ts`:

```ts
export interface Idea {
  id: string;
  authorUid: string;
  authorHandle: string;
  authorName: string;
  authorAvatar: string | null;
  type: "pre" | "post";
  title: string;
  body: string;
  instrument: string;
  timeframe: string | null;
  direction: "long" | "short" | "neutral";
  entryPrice: string | null;
  stopPrice: string | null;
  targetPrice: string | null;
  chartUrl: string | null;
  linkedTradeId: number | null;
  createdAt: string;
  likeCount: number;
  likedByMe: boolean;
}

export interface IdeaCreateInput {
  type: "pre" | "post";
  title: string;
  body: string;
  instrument: string;
  timeframe: string | null;
  direction: "long" | "short" | "neutral";
  entryPrice: string | null;
  stopPrice: string | null;
  targetPrice: string | null;
  chartUrl: string | null;
  linkedTradeId: number | null;
}
```

- [ ] **Step 2: Typecheck**

Run from project root:

```bash
npm run typecheck
```

Expected: exit 0, no errors.

---

## Task 3: Serverless function — `api/ideas.ts`

**Files:**
- Create: `api/ideas.ts`

This consumes 1 of the 3 remaining Hobby serverless slots (10/12 total).

- [ ] **Step 1: Create the file with the full handler**

Create `api/ideas.ts` with the following content (note: follows the same pattern as `api/push.ts` and `api/account.ts`):

```ts
// ═══════════════════════════════════════════════════════════════════════════════
// Kōda · /api/ideas?action=list | create | like | delete
//
// Public chronological feed of trader Ideas (pre-trade and post-trade analysis).
// All actions require an authenticated Supabase JWT in the Authorization header.
// ═══════════════════════════════════════════════════════════════════════════════

export const config = { runtime: "nodejs" };

import { getAdminClient, getUserIdFromJwt } from "./lib/supabaseAdmin.js";

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

  // Validate required fields
  if (body.type !== "pre" && body.type !== "post") return res.status(400).json({ error: "Invalid type" });
  if (!body.title || typeof body.title !== "string" || body.title.length < 1 || body.title.length > 120) return res.status(400).json({ error: "Invalid title" });
  if (!body.body || typeof body.body !== "string" || body.body.length < 1 || body.body.length > 4000) return res.status(400).json({ error: "Invalid body" });
  if (!body.instrument || typeof body.instrument !== "string" || body.instrument.length < 1 || body.instrument.length > 32) return res.status(400).json({ error: "Invalid instrument" });
  if (body.direction !== "long" && body.direction !== "short" && body.direction !== "neutral") return res.status(400).json({ error: "Invalid direction" });

  const admin = getAdminClient();

  // Fetch author denorm fields from profiles
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

  if (req.method === "GET"    && actionStr === "list")   return handleList(req, res);
  if (req.method === "POST"   && actionStr === "create") return handleCreate(req, res);
  if (req.method === "POST"   && actionStr === "like")   return handleLike(req, res);
  if (req.method === "DELETE" && actionStr === "delete") return handleDelete(req, res);

  return res.status(404).json({ error: "Unknown action" });
}
```

- [ ] **Step 2: Typecheck the API**

Run:

```bash
npm run typecheck
```

Expected: exit 0. The `tsconfig.api.json` should pick up the new file.

---

## Task 4: `IdeaCard` component

**Files:**
- Create: `src/components/IdeaCard.tsx`

The card has two render modes — collapsed (feed) and expanded (full detail). Same component, `expanded` prop switches modes.

- [ ] **Step 1: Create the component**

Create `src/components/IdeaCard.tsx`:

```tsx
import { type CSSProperties } from "react";
import type { Idea } from "../types";
import { MONO, BODY, DISPLAY, AvatarCircle } from "../shared";

interface IdeaCardProps {
  idea: Idea;
  expanded?: boolean;
  C: Record<string, string>;
  onLike: (id: string) => void;
  onExpand?: (id: string) => void;
  onOpenChart?: (url: string) => void;
}

function timeAgo(iso: string): string {
  const then = new Date(iso).getTime();
  if (Number.isNaN(then)) return "";
  const diffSec = Math.max(0, Math.floor((Date.now() - then) / 1000));
  if (diffSec < 60) return `${diffSec}s ago`;
  if (diffSec < 3600) return `${Math.floor(diffSec / 60)}m ago`;
  if (diffSec < 86400) return `${Math.floor(diffSec / 3600)}h ago`;
  return `${Math.floor(diffSec / 86400)}d ago`;
}

const directionColor = (dir: Idea["direction"], C: Record<string, string>): string => {
  if (dir === "long") return C.green ?? "#34d399";
  if (dir === "short") return C.red ?? "#f87171";
  return C.muted ?? "#94a3b8";
};

export function IdeaCard({ idea, expanded = false, C, onLike, onExpand, onOpenChart }: IdeaCardProps) {
  const cardBg = `color-mix(in srgb, ${C.text} 3%, transparent)`;
  const border = `1px solid ${C.border2 ?? C.border}`;
  const pillBg = (col: string): CSSProperties => ({
    background: `color-mix(in srgb, ${col} 18%, transparent)`,
    color: col,
    fontFamily: MONO,
    fontSize: "10px",
    fontWeight: 600,
    padding: "2px 8px",
    borderRadius: "4px",
    letterSpacing: "0.06em",
    textTransform: "uppercase" as const,
  });

  const dirCol = directionColor(idea.direction, C);
  const typeCol = idea.type === "pre" ? (C.live ?? "#a78bfa") : (C.green ?? "#34d399");

  const hasPrices = !!(idea.entryPrice || idea.stopPrice || idea.targetPrice);

  return (
    <div
      data-testid={`idea-card-${idea.id}`}
      onClick={!expanded && onExpand ? () => onExpand(idea.id) : undefined}
      style={{
        background: cardBg, border, borderRadius: "14px",
        padding: "14px", marginBottom: "10px",
        cursor: !expanded && onExpand ? "pointer" : "default",
        maxWidth: "680px",
      }}
    >
      {/* Header row */}
      <div style={{ display: "flex", alignItems: "flex-start", gap: "10px", marginBottom: "8px" }}>
        <AvatarCircle name={idea.authorName || idea.authorHandle || "?"} avatar={idea.authorAvatar ?? ""} size={32} C={C} />
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ display: "flex", alignItems: "center", gap: "6px", flexWrap: "wrap" }}>
            <span style={{ fontFamily: MONO, fontSize: "12px", color: C.text, fontWeight: 600 }}>@{idea.authorHandle || "trader"}</span>
            <span style={pillBg(typeCol)}>{idea.type === "pre" ? "PRE" : "POST"}</span>
            <span style={{ fontFamily: MONO, fontSize: "10px", color: C.muted, marginLeft: "auto" }}>{timeAgo(idea.createdAt)}</span>
          </div>
          <div style={{ fontFamily: DISPLAY, fontSize: expanded ? "18px" : "14px", fontWeight: 600, color: C.text, marginTop: "4px", lineHeight: 1.25,
            ...(expanded ? {} : { display: "-webkit-box", WebkitLineClamp: 1, WebkitBoxOrient: "vertical" as const, overflow: "hidden" }) }}>
            {idea.title}
          </div>
        </div>
        {idea.chartUrl && !expanded && (
          <button
            data-testid={`idea-chart-thumb-${idea.id}`}
            onClick={(e) => { e.stopPropagation(); onOpenChart?.(idea.chartUrl!); }}
            style={{
              width: "56px", height: "56px", flexShrink: 0,
              background: `${C.surface ?? "#252535"} center/cover no-repeat url("${idea.chartUrl}")`,
              border: "none", borderRadius: "8px", cursor: "pointer", padding: 0,
            }}
            aria-label="Open chart"
          />
        )}
      </div>

      {/* Body */}
      <div style={{
        fontFamily: BODY, fontSize: "13px", color: C.text2 ?? C.muted, lineHeight: 1.55, marginBottom: "10px",
        ...(expanded ? {} : { display: "-webkit-box", WebkitLineClamp: 2, WebkitBoxOrient: "vertical" as const, overflow: "hidden" }),
        whiteSpace: expanded ? "pre-wrap" : undefined,
      }}>
        {idea.body}
      </div>

      {/* Expanded chart full-width */}
      {expanded && idea.chartUrl && (
        <button
          onClick={(e) => { e.stopPropagation(); onOpenChart?.(idea.chartUrl!); }}
          style={{ width: "100%", maxHeight: "360px", border: "none", padding: 0, marginBottom: "10px", cursor: "zoom-in", borderRadius: "10px", overflow: "hidden", background: "transparent" }}
          aria-label="Open chart"
        >
          <img src={idea.chartUrl} alt="" style={{ width: "100%", height: "auto", display: "block", borderRadius: "10px" }} />
        </button>
      )}

      {/* Tags row */}
      <div style={{ display: "flex", alignItems: "center", gap: "6px", flexWrap: "wrap", marginBottom: hasPrices ? "8px" : "0" }}>
        <span style={pillBg(C.live ?? "#a78bfa")}>{idea.instrument}</span>
        <span style={pillBg(dirCol)}>{idea.direction.toUpperCase()}</span>
        {idea.timeframe && <span style={pillBg(C.muted ?? "#94a3b8")}>{idea.timeframe}</span>}
      </div>

      {/* Entry / Stop / Target */}
      {hasPrices && (
        <div style={{ display: "flex", gap: "12px", flexWrap: "wrap", padding: "8px 10px",
          background: `color-mix(in srgb, ${C.text} 4%, transparent)`, borderRadius: "8px", marginBottom: "8px",
          fontFamily: MONO, fontSize: "11px", color: C.muted }}>
          {idea.entryPrice  && <span>Entry <strong style={{ color: C.text }}>{idea.entryPrice}</strong></span>}
          {idea.stopPrice   && <span>Stop <strong style={{ color: C.red ?? "#f87171" }}>{idea.stopPrice}</strong></span>}
          {idea.targetPrice && <span>Target <strong style={{ color: C.green ?? "#34d399" }}>{idea.targetPrice}</strong></span>}
        </div>
      )}

      {/* Footer */}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", paddingTop: "8px", borderTop: `1px solid ${C.border ?? "#2a2a2a"}` }}>
        <button
          data-testid={`idea-like-${idea.id}`}
          onClick={(e) => { e.stopPropagation(); onLike(idea.id); }}
          style={{
            background: "none", border: "none", cursor: "pointer",
            display: "flex", alignItems: "center", gap: "6px",
            fontFamily: MONO, fontSize: "12px",
            color: idea.likedByMe ? (C.red ?? "#f87171") : C.muted,
          }}
        >
          <span style={{ fontSize: "14px" }}>{idea.likedByMe ? "♥" : "♡"}</span>
          <span>{idea.likeCount}</span>
        </button>
        {!expanded && <span style={{ fontFamily: MONO, fontSize: "10px", color: C.muted }}>Tap to expand →</span>}
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Typecheck**

Run:

```bash
npm run typecheck
```

Expected: exit 0. If `AvatarCircle` props don't match this signature, adjust to match `src/shared.tsx` (the most likely mismatch is the prop name for the avatar URL — it may be `src` instead of `avatar`).

---

## Task 5: `IdeaComposer` component

**Files:**
- Create: `src/IdeaComposer.tsx`

Single scrollable form. Mobile = bottom sheet, desktop = centred modal.

- [ ] **Step 1: Create the component**

Create `src/IdeaComposer.tsx`:

```tsx
import { type CSSProperties, useState, useRef } from "react";
import type { Idea, IdeaCreateInput, Trade } from "./types";
import { MONO, BODY, DISPLAY, compressImage } from "./shared";

interface IdeaComposerProps {
  open: boolean;
  onClose: () => void;
  onPosted: (idea: Idea) => void;
  recentTrades: Trade[];
  myUid: string;
  C: Record<string, string>;
  inp: CSSProperties;
  pillPrimary: (active: boolean) => CSSProperties;
  isDesktop: boolean;
  supabaseUploadChart: (file: Blob, filename: string) => Promise<string>;
  authToken: string;
}

const TYPES = ["post", "pre"] as const;
const DIRECTIONS = ["long", "short", "neutral"] as const;

export function IdeaComposer({
  open, onClose, onPosted, recentTrades, myUid: _myUid, C, inp, pillPrimary, isDesktop,
  supabaseUploadChart, authToken,
}: IdeaComposerProps) {
  const [type, setType] = useState<"pre" | "post">("post");
  const [title, setTitle] = useState("");
  const [bodyText, setBodyText] = useState("");
  const [instrument, setInstrument] = useState("");
  const [timeframe, setTimeframe] = useState("");
  const [direction, setDirection] = useState<"long" | "short" | "neutral">("long");
  const [entry, setEntry] = useState("");
  const [stop, setStop] = useState("");
  const [target, setTarget] = useState("");
  const [chartFile, setChartFile] = useState<File | null>(null);
  const [linkedTradeId, setLinkedTradeId] = useState<number | null>(null);
  const [posting, setPosting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  if (!open) return null;

  const reset = () => {
    setType("post"); setTitle(""); setBodyText(""); setInstrument(""); setTimeframe("");
    setDirection("long"); setEntry(""); setStop(""); setTarget("");
    setChartFile(null); setLinkedTradeId(null); setError(null); setPosting(false);
  };

  const canPost = title.trim().length > 0
    && bodyText.trim().length > 0
    && instrument.trim().length > 0;

  async function handlePost() {
    if (!canPost || posting) return;
    setPosting(true);
    setError(null);
    try {
      let chartUrl: string | null = null;
      if (chartFile) {
        const compressed = await compressImage(chartFile, 1600, 0.85);
        const filename = `idea-${Date.now()}-${Math.random().toString(36).slice(2, 8)}.jpg`;
        chartUrl = await supabaseUploadChart(compressed, filename);
      }

      const payload: IdeaCreateInput = {
        type, title: title.trim(), body: bodyText.trim(),
        instrument: instrument.trim().toUpperCase(),
        timeframe: timeframe.trim() || null,
        direction,
        entryPrice: entry.trim() || null,
        stopPrice: stop.trim() || null,
        targetPrice: target.trim() || null,
        chartUrl,
        linkedTradeId: type === "post" ? linkedTradeId : null,
      };

      const resp = await fetch("/api/ideas?action=create", {
        method: "POST",
        headers: { "Content-Type": "application/json", "Authorization": `Bearer ${authToken}` },
        body: JSON.stringify(payload),
      });
      const data = await resp.json() as { idea?: Idea; error?: string };
      if (!resp.ok || !data.idea) throw new Error(data.error ?? "Failed to post");
      onPosted(data.idea);
      reset();
      onClose();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to post");
    } finally {
      setPosting(false);
    }
  }

  const backdropStyle: CSSProperties = {
    position: "fixed", inset: 0, background: "rgba(0,0,0,0.55)",
    zIndex: 100, display: "flex",
    alignItems: isDesktop ? "center" : "flex-end",
    justifyContent: "center",
  };

  const panelStyle: CSSProperties = {
    background: C.bg ?? "#0f0f14",
    border: `1px solid ${C.border2 ?? C.border}`,
    borderRadius: isDesktop ? "18px" : "18px 18px 0 0",
    width: "100%",
    maxWidth: isDesktop ? "560px" : "100%",
    maxHeight: isDesktop ? "90vh" : "92vh",
    overflowY: "auto",
    padding: "18px 18px calc(24px + env(safe-area-inset-bottom))",
    display: "flex", flexDirection: "column", gap: "12px",
  };

  const segBtn = (id: "pre" | "post", label: string): CSSProperties => ({
    flex: 1, padding: "8px 12px",
    background: type === id ? C.text : "transparent",
    color: type === id ? C.bg : C.text,
    border: `1px solid ${C.border2 ?? C.border}`,
    borderRadius: "8px", cursor: "pointer",
    fontFamily: MONO, fontSize: "11px", letterSpacing: "0.08em",
    textTransform: "uppercase" as const,
  });

  const labelStyle: CSSProperties = {
    fontFamily: MONO, fontSize: "9px", color: C.muted,
    letterSpacing: "0.16em", textTransform: "uppercase" as const,
    marginBottom: "4px",
  };

  return (
    <div data-testid="idea-composer" style={backdropStyle} onClick={onClose}>
      <div style={panelStyle} onClick={e => e.stopPropagation()}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "4px" }}>
          <div style={{ fontFamily: DISPLAY, fontSize: "18px", fontWeight: 600, color: C.text }}>New Idea</div>
          <button onClick={onClose} aria-label="Close" style={{ background: "none", border: "none", color: C.muted, fontSize: "20px", cursor: "pointer" }}>×</button>
        </div>

        {/* Type toggle */}
        <div style={{ display: "flex", gap: "6px" }}>
          {TYPES.map(t => (
            <button key={t} onClick={() => setType(t)} style={segBtn(t, t === "pre" ? "Pre-trade" : "Post-trade")}>
              {t === "pre" ? "Pre-trade" : "Post-trade"}
            </button>
          ))}
        </div>

        {/* Title */}
        <div>
          <div style={labelStyle}>Title</div>
          <input value={title} onChange={e => setTitle(e.target.value)} placeholder="e.g. NQ break above VWAP" maxLength={120} style={{ ...inp, margin: 0, width: "100%" }} />
        </div>

        {/* Instrument · Direction · Timeframe */}
        <div style={{ display: "flex", gap: "8px" }}>
          <div style={{ flex: 2 }}>
            <div style={labelStyle}>Instrument</div>
            <input value={instrument} onChange={e => setInstrument(e.target.value)} placeholder="NQ" maxLength={32} style={{ ...inp, margin: 0, width: "100%" }} />
          </div>
          <div style={{ flex: 1 }}>
            <div style={labelStyle}>Direction</div>
            <select value={direction} onChange={e => setDirection(e.target.value as "long" | "short" | "neutral")} style={{ ...inp, margin: 0, width: "100%" }}>
              {DIRECTIONS.map(d => <option key={d} value={d}>{d.toUpperCase()}</option>)}
            </select>
          </div>
          <div style={{ flex: 1 }}>
            <div style={labelStyle}>Timeframe</div>
            <input value={timeframe} onChange={e => setTimeframe(e.target.value)} placeholder="15m" maxLength={16} style={{ ...inp, margin: 0, width: "100%" }} />
          </div>
        </div>

        {/* Entry / Stop / Target */}
        <div style={{ display: "flex", gap: "8px" }}>
          <div style={{ flex: 1 }}>
            <div style={labelStyle}>Entry</div>
            <input value={entry} onChange={e => setEntry(e.target.value)} placeholder="—" inputMode="decimal" style={{ ...inp, margin: 0, width: "100%" }} />
          </div>
          <div style={{ flex: 1 }}>
            <div style={labelStyle}>Stop</div>
            <input value={stop} onChange={e => setStop(e.target.value)} placeholder="—" inputMode="decimal" style={{ ...inp, margin: 0, width: "100%" }} />
          </div>
          <div style={{ flex: 1 }}>
            <div style={labelStyle}>Target</div>
            <input value={target} onChange={e => setTarget(e.target.value)} placeholder="—" inputMode="decimal" style={{ ...inp, margin: 0, width: "100%" }} />
          </div>
        </div>

        {/* Body */}
        <div>
          <div style={labelStyle}>Analysis</div>
          <textarea value={bodyText} onChange={e => setBodyText(e.target.value)} placeholder="Write your analysis..."
            maxLength={4000} rows={6}
            style={{ ...inp, margin: 0, width: "100%", fontFamily: BODY, lineHeight: 1.5, resize: "vertical" }} />
        </div>

        {/* Chart upload */}
        <div>
          <div style={labelStyle}>Chart image (optional)</div>
          <button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            style={{
              width: "100%", padding: "12px",
              background: "transparent",
              border: `1px dashed ${C.border2 ?? C.border}`,
              borderRadius: "10px",
              fontFamily: MONO, fontSize: "11px", color: C.muted, cursor: "pointer",
            }}>
            {chartFile ? `📎 ${chartFile.name}` : "📎 Attach chart"}
          </button>
          <input ref={fileInputRef} type="file" accept="image/*" hidden onChange={e => setChartFile(e.target.files?.[0] ?? null)} />
        </div>

        {/* Link trade (post only) */}
        {type === "post" && recentTrades.length > 0 && (
          <div>
            <div style={labelStyle}>Link trade (optional)</div>
            <select
              value={linkedTradeId ?? ""}
              onChange={e => setLinkedTradeId(e.target.value ? Number(e.target.value) : null)}
              style={{ ...inp, margin: 0, width: "100%" }}
            >
              <option value="">— none —</option>
              {recentTrades.slice(0, 10).map(t => (
                <option key={t.id} value={t.id}>
                  {t.date} · {t.pair} · {t.direction?.toUpperCase() ?? ""} · {t.outcome}
                </option>
              ))}
            </select>
          </div>
        )}

        {error && (
          <div style={{ fontFamily: BODY, fontSize: "12px", color: C.red ?? "#f87171" }}>{error}</div>
        )}

        {/* Post button */}
        <button
          onClick={handlePost}
          disabled={!canPost || posting}
          style={{ ...pillPrimary(canPost && !posting), width: "100%", padding: "12px", opacity: !canPost || posting ? 0.55 : 1 }}>
          {posting ? "Posting…" : "Post Idea"}
        </button>
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Typecheck**

Run:

```bash
npm run typecheck
```

Expected: exit 0. If `compressImage` signature doesn't match `compressImage(file, maxDim, quality)`, adjust the call — see `src/shared.tsx` for the actual signature (it may use options object or different arg order).

---

## Task 6: `IdeasScreen` — feed list + composer + paging

**Files:**
- Create: `src/IdeasScreen.tsx`

- [ ] **Step 1: Create the component**

Create `src/IdeasScreen.tsx`:

```tsx
import { type CSSProperties, useEffect, useState, useCallback } from "react";
import { createClient } from "@supabase/supabase-js";
import type { Idea, Trade } from "./types";
import { MONO, BODY, DISPLAY } from "./shared";
import { IdeaCard } from "./components/IdeaCard";
import { IdeaComposer } from "./IdeaComposer";

interface IdeasScreenProps {
  myUid: string;
  recentTrades: Trade[];
  C: Record<string, string>;
  inp: CSSProperties;
  pillPrimary: (active: boolean) => CSSProperties;
  isDesktop: boolean;
}

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL as string;
const SUPABASE_ANON_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY as string;
const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

async function uploadChart(file: Blob, filename: string): Promise<string> {
  const path = `ideas/${filename}`;
  const { error } = await supabase.storage.from("trade-screenshots").upload(path, file, {
    contentType: "image/jpeg", upsert: false,
  });
  if (error) throw error;
  const { data } = supabase.storage.from("trade-screenshots").getPublicUrl(path);
  return data.publicUrl;
}

async function getToken(): Promise<string> {
  const { data } = await supabase.auth.getSession();
  return data.session?.access_token ?? "";
}

export function IdeasScreen({ myUid, recentTrades, C, inp, pillPrimary, isDesktop }: IdeasScreenProps) {
  const [ideas, setIdeas] = useState<Idea[]>([]);
  const [page, setPage] = useState(0);
  const [hasMore, setHasMore] = useState(false);
  const [loading, setLoading] = useState(false);
  const [composerOpen, setComposerOpen] = useState(false);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [chartLightbox, setChartLightbox] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async (pageToLoad: number, append: boolean) => {
    setLoading(true);
    setError(null);
    try {
      const token = await getToken();
      const resp = await fetch(`/api/ideas?action=list&page=${pageToLoad}`, {
        headers: { "Authorization": `Bearer ${token}` },
      });
      const data = await resp.json() as { ideas?: Idea[]; hasMore?: boolean; error?: string };
      if (!resp.ok) throw new Error(data.error ?? "Failed to load");
      setIdeas(prev => append ? [...prev, ...(data.ideas ?? [])] : (data.ideas ?? []));
      setHasMore(!!data.hasMore);
      setPage(pageToLoad);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    let alive = true;
    (async () => {
      if (!alive) return;
      await load(0, false);
    })();
    return () => { alive = false; };
  }, [load]);

  async function handleLike(id: string) {
    const before = ideas.find(i => i.id === id);
    if (!before) return;
    // Optimistic toggle
    setIdeas(prev => prev.map(i => i.id === id ? {
      ...i,
      likedByMe: !i.likedByMe,
      likeCount: i.likeCount + (i.likedByMe ? -1 : 1),
    } : i));
    try {
      const token = await getToken();
      const resp = await fetch("/api/ideas?action=like", {
        method: "POST",
        headers: { "Content-Type": "application/json", "Authorization": `Bearer ${token}` },
        body: JSON.stringify({ ideaId: id }),
      });
      const data = await resp.json() as { liked?: boolean; count?: number; error?: string };
      if (!resp.ok) throw new Error(data.error ?? "Like failed");
      setIdeas(prev => prev.map(i => i.id === id ? { ...i, likedByMe: !!data.liked, likeCount: data.count ?? i.likeCount } : i));
    } catch {
      // Revert optimistic
      setIdeas(prev => prev.map(i => i.id === id ? before : i));
    }
  }

  function handlePosted(idea: Idea) {
    setIdeas(prev => [idea, ...prev]);
  }

  const containerStyle: CSSProperties = { maxWidth: "680px", margin: "0 auto", paddingBottom: "120px" };

  return (
    <div data-testid="ideas-screen" style={containerStyle}>
      {/* Header */}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "12px" }}>
        <div>
          <div style={{ fontFamily: MONO, fontSize: "10px", color: C.muted, letterSpacing: "0.16em", textTransform: "uppercase" as const, marginBottom: "4px" }}>Public · Chronological</div>
          <div style={{ fontFamily: DISPLAY, fontSize: "22px", fontWeight: 500, color: C.text, letterSpacing: "-0.02em" }}>Ideas</div>
        </div>
        <button onClick={() => load(0, false)} disabled={loading}
          style={{ background: "none", border: `1px solid ${C.border2 ?? C.border}`, borderRadius: "999px", width: "32px", height: "32px", color: C.muted, cursor: "pointer" }}>
          &#8635;
        </button>
      </div>

      {/* List */}
      {loading && ideas.length === 0 ? (
        <div style={{ padding: "48px 20px", textAlign: "center", fontFamily: BODY, fontSize: "13px", color: C.muted }}>Loading…</div>
      ) : ideas.length === 0 ? (
        <div style={{ padding: "48px 20px", textAlign: "center" }}>
          <div style={{ fontSize: "32px", marginBottom: "14px" }}>💡</div>
          <div style={{ fontFamily: DISPLAY, fontSize: "16px", fontWeight: 500, color: C.text, marginBottom: "8px" }}>No ideas yet</div>
          <div style={{ fontFamily: BODY, fontSize: "13px", color: C.muted }}>Be the first to post.</div>
        </div>
      ) : (
        <>
          {ideas.map(idea => (
            <IdeaCard
              key={idea.id}
              idea={idea}
              expanded={expandedId === idea.id}
              C={C}
              onLike={handleLike}
              onExpand={(id) => setExpandedId(prev => prev === id ? null : id)}
              onOpenChart={(url) => setChartLightbox(url)}
            />
          ))}
          {hasMore && (
            <button onClick={() => load(page + 1, true)} disabled={loading}
              style={{ display: "block", margin: "16px auto", padding: "10px 22px",
                background: "transparent", border: `1px solid ${C.border2 ?? C.border}`, borderRadius: "999px",
                fontFamily: MONO, fontSize: "11px", color: C.muted, cursor: "pointer" }}>
              {loading ? "…" : "Load more"}
            </button>
          )}
        </>
      )}

      {error && <div style={{ padding: "10px 14px", color: C.red ?? "#f87171", fontFamily: BODY, fontSize: "12px" }}>{error}</div>}

      {/* FAB */}
      <button
        data-testid="idea-fab-new"
        onClick={() => setComposerOpen(true)}
        style={{
          position: "fixed",
          bottom: isDesktop ? "28px" : "calc(96px + env(safe-area-inset-bottom))",
          right: "16px",
          zIndex: 50,
          background: C.text, color: C.bg, border: "none", borderRadius: "999px",
          padding: "14px 20px", minHeight: "48px", cursor: "pointer",
          fontFamily: MONO, fontSize: "11px", letterSpacing: "0.12em", textTransform: "uppercase" as const,
          boxShadow: "0 4px 16px rgba(0,0,0,0.28)",
        }}>
        + New Idea
      </button>

      <IdeaComposer
        open={composerOpen}
        onClose={() => setComposerOpen(false)}
        onPosted={handlePosted}
        recentTrades={recentTrades}
        myUid={myUid}
        C={C}
        inp={inp}
        pillPrimary={pillPrimary}
        isDesktop={isDesktop}
        supabaseUploadChart={uploadChart}
        authToken=""
      />

      {/* Chart lightbox */}
      {chartLightbox && (
        <div onClick={() => setChartLightbox(null)}
          style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.92)", zIndex: 200, display: "flex", alignItems: "center", justifyContent: "center", padding: "24px", cursor: "zoom-out" }}>
          <img src={chartLightbox} alt="" style={{ maxWidth: "100%", maxHeight: "100%", borderRadius: "10px" }} />
        </div>
      )}
    </div>
  );
}
```

- [ ] **Step 2: Fix the composer auth token wiring**

The composer needs the current auth token. Update `IdeasScreen.tsx`'s `<IdeaComposer />` invocation to compute and pass it. Inside `IdeasScreen`, add state for the token and load it once on mount:

Replace the `authToken=""` line, and add this hook at the top of the component (after the `error` useState):

```tsx
const [authToken, setAuthToken] = useState("");
useEffect(() => {
  let alive = true;
  (async () => {
    const t = await getToken();
    if (alive) setAuthToken(t);
    const sub = supabase.auth.onAuthStateChange((_, session) => {
      if (alive) setAuthToken(session?.access_token ?? "");
    });
    return () => { sub.data.subscription.unsubscribe(); };
  })();
  return () => { alive = false; };
}, []);
```

And in the `<IdeaComposer />` JSX change `authToken=""` to `authToken={authToken}`.

- [ ] **Step 3: Typecheck**

Run:

```bash
npm run typecheck
```

Expected: exit 0.

---

## Task 7: Unit test — `IdeasScreen.test.tsx`

**Files:**
- Create: `src/IdeasScreen.test.tsx`

Pattern follows `src/BetaGate.test.tsx` and `src/NewsScreen.test.tsx`.

- [ ] **Step 1: Write the failing test**

Create `src/IdeasScreen.test.tsx`:

```tsx
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import { IdeasScreen } from "./IdeasScreen";
import type { Idea } from "./types";

vi.mock("@supabase/supabase-js", () => ({
  createClient: () => ({
    auth: {
      getSession: async () => ({ data: { session: { access_token: "fake-token" } } }),
      onAuthStateChange: () => ({ data: { subscription: { unsubscribe: () => {} } } }),
    },
    storage: { from: () => ({ upload: async () => ({ error: null }), getPublicUrl: () => ({ data: { publicUrl: "" } }) }) },
  }),
}));

const sampleIdea: Idea = {
  id: "idea-1",
  authorUid: "u1",
  authorHandle: "trader",
  authorName: "Test Trader",
  authorAvatar: null,
  type: "post",
  title: "NQ test breakout",
  body: "Took the entry above VWAP and held the runner.",
  instrument: "NQ",
  timeframe: "15m",
  direction: "long",
  entryPrice: "21420",
  stopPrice: "21380",
  targetPrice: "21520",
  chartUrl: null,
  linkedTradeId: null,
  createdAt: new Date().toISOString(),
  likeCount: 3,
  likedByMe: false,
};

const C = {
  text: "#fff", text2: "#aaa", bg: "#000", muted: "#888",
  border: "#222", border2: "#333", red: "#f87171", green: "#34d399",
  live: "#a78bfa", surface: "#222",
};

const inp = {} as React.CSSProperties;
const pillPrimary = () => ({} as React.CSSProperties);

describe("IdeasScreen", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it("renders empty state when no ideas", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => ({
      ok: true,
      json: async () => ({ ideas: [], hasMore: false }),
    })));

    render(<IdeasScreen myUid="u1" recentTrades={[]} C={C} inp={inp} pillPrimary={pillPrimary} isDesktop={false} />);

    await waitFor(() => {
      expect(screen.getByText(/No ideas yet/i)).toBeInTheDocument();
    });
  });

  it("renders idea card from API response", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => ({
      ok: true,
      json: async () => ({ ideas: [sampleIdea], hasMore: false }),
    })));

    render(<IdeasScreen myUid="u1" recentTrades={[]} C={C} inp={inp} pillPrimary={pillPrimary} isDesktop={false} />);

    await waitFor(() => {
      expect(screen.getByTestId("idea-card-idea-1")).toBeInTheDocument();
      expect(screen.getByText("NQ test breakout")).toBeInTheDocument();
    });
  });
});
```

- [ ] **Step 2: Run the test**

```bash
npm test -- --run src/IdeasScreen.test.tsx
```

Expected: both tests PASS.

If they fail because `AvatarCircle` rendering throws on missing props or theme tokens, adjust the `C` mock to include the keys it needs (check the error message).

---

## Task 8: Wire Ideas tab into `FriendsFeed.tsx`

**Files:**
- Modify: `src/FriendsFeed.tsx` (header region around line 67 + tab body region)

- [ ] **Step 1: Extend the tab union and prop interface**

In `src/FriendsFeed.tsx`, change line ~67:

```tsx
const [tab, setTab] = useState<"feed" | "people">("feed");
```

to:

```tsx
const [tab, setTab] = useState<"feed" | "ideas" | "people">("feed");
```

Then update the `tabBtn` helper signature (line ~76) from:

```tsx
const tabBtn = (id: "feed" | "people", label: string) => (
```

to:

```tsx
const tabBtn = (id: "feed" | "ideas" | "people", label: string) => (
```

- [ ] **Step 2: Add `IdeasScreen` props to `FriendsFeedProps`**

Append to the `FriendsFeedProps` interface (around line ~57):

```tsx
  myUid: string;
  recentTrades: import("./types").Trade[];
  isDesktop: boolean;
```

And add these names to the function destructure (around line ~65):

```tsx
  myUid, recentTrades, isDesktop,
```

- [ ] **Step 3: Add the Ideas tab button and render section**

Find the tab buttons row (line ~127, where `tabBtn("feed", "Feed")` and `tabBtn("people", ...)` are rendered) and insert the Ideas tab between them:

```tsx
{tabBtn("feed", "Feed")}
{tabBtn("ideas", "Ideas")}
{tabBtn("people", `People${followingCount ? ` · ${followingCount}` : ""}`)}
```

Then add an import at the top of the file (after the existing `import` lines):

```tsx
import { IdeasScreen } from "./IdeasScreen";
```

And add the render block right before the existing `{/* FEED tab */}` block — wrap the existing FEED block in `tab === "feed"` (it already is) and add a new `tab === "ideas"` block immediately after it:

```tsx
{/* IDEAS tab */}
{tab === "ideas" && (
  <div style={{ marginTop: "20px" }}>
    <IdeasScreen
      myUid={myUid}
      recentTrades={recentTrades}
      C={C}
      inp={inp}
      pillPrimary={pillPrimary}
      isDesktop={isDesktop}
    />
  </div>
)}
```

- [ ] **Step 4: Typecheck**

```bash
npm run typecheck
```

Expected: exit 0. All callers of `<FriendsFeed />` in `Koda.tsx` will now have TS errors for the missing `myUid`, `recentTrades`, and `isDesktop` props — those are fixed in Task 9.

---

## Task 9: Wire Social tab into `Koda.tsx`

**Files:**
- Modify: `src/Koda.tsx`

This task adds the new `"social"` top-level tab to `TABS` and `NAV_TABS`, renders a Social view that shows `<FriendsFeed />`, and passes the new required props (`myUid`, `recentTrades`, `isDesktop`) to all `<FriendsFeed />` call sites.

- [ ] **Step 1: Add `"social"` to `TABS`**

In `src/Koda.tsx`, change line ~78:

```tsx
const TABS = ["home","news","stats","circles"];
```

to:

```tsx
const TABS = ["home","news","stats","circles","social"];
```

- [ ] **Step 2: Add `"social"` to `NAV_TABS`**

In `src/Koda.tsx`, change the `NAV_TABS` array (line ~1394) from:

```tsx
const NAV_TABS = [
  { id: "home",    label: "Home",    path: "M3 10l7-7 7 7v8a1 1 0 01-1 1H4a1 1 0 01-1-1z" },
  { id: "news",    label: "News",    path: "M3 4h14v12H3zM6 7h8M6 10h8M6 13h5" },
  { id: "stats",   label: "Stats",   path: "M3 16V9M9 16V3M15 16v-5M18 16H2" },
  { id: "circles", label: "Circles", path: "M5 8a3 3 0 1 1 6 0 3 3 0 0 1-6 0zM12.5 11a3 3 0 0 1 4.5 2.5M3 17c0-2.5 2-3.8 5-3.8s5 1.3 5 3.8" },
];
```

to:

```tsx
const NAV_TABS = [
  { id: "home",    label: "Home",    path: "M3 10l7-7 7 7v8a1 1 0 01-1 1H4a1 1 0 01-1-1z" },
  { id: "news",    label: "News",    path: "M3 4h14v12H3zM6 7h8M6 10h8M6 13h5" },
  { id: "stats",   label: "Stats",   path: "M3 16V9M9 16V3M15 16v-5M18 16H2" },
  { id: "circles", label: "Circles", path: "M5 8a3 3 0 1 1 6 0 3 3 0 0 1-6 0zM12.5 11a3 3 0 0 1 4.5 2.5M3 17c0-2.5 2-3.8 5-3.8s5 1.3 5 3.8" },
  { id: "social",  label: "Social",  path: "M3 18v-1a4 4 0 014-4h2a4 4 0 014 4v1M11 7a3 3 0 11-6 0 3 3 0 016 0zM16 11a3 3 0 100-6 3 3 0 000 6zM17 18v-1a3 3 0 00-2-2.8" },
];
```

- [ ] **Step 3: Locate `myUid` (or define it)**

Find where the current user's UID is available in `Koda.tsx` — likely as a `uid` or `myUid` state, or available via `await supabase.auth.getUser()`. Run:

```bash
grep -n "myUid\|getUser\|auth.user\|user.id" "C:\Users\Dylon\OneDrive\Desktop\koda\src\Koda.tsx"
```

If no `myUid` is currently held in state, add this after the `profile` state declaration (search for `useState.*profile` near the top of the component body):

```tsx
const [myUid, setMyUid] = useState<string>("");
useEffect(() => {
  let alive = true;
  (async () => {
    const { data } = await supabase.auth.getUser();
    if (alive) setMyUid(data.user?.id ?? "");
  })();
  return () => { alive = false; };
}, []);
```

(Make sure `supabase` is already imported — search for `from "@supabase/supabase-js"`. If not, the existing code accesses Supabase via `window.storage` shim — in that case, instead use whatever auth-context utility the codebase already has. Search for an existing pattern: `grep -n "auth.getUser\|access_token" src/Koda.tsx src/KodaAuth.tsx` and reuse it.)

- [ ] **Step 4: Add Social view render section**

In `src/Koda.tsx`, find the existing block that renders the `"circles"` view (search: `view === "circles"`). Immediately after the `</>` or closing of that view's JSX block, add:

```tsx
{view === "social" && (
  <FriendsFeed
    friends={friends} friendFeed={friendFeed as any} showAddFriend={showAddFriend} setShowAddFriend={setShowAddFriend}
    followHandleInput={followHandleInput} setFollowHandleInput={setFollowHandleInput}
    followHandleMsg={followHandleMsg} followHandleLoading={followHandleLoading}
    followByHandle={followByHandle} unfollowUser={unfollowUser} following={following} followers={followers} followerProfiles={followerProfiles}
    publishFeed={publishFeed} refreshFeed={refreshFeed} reactToFeed={reactToFeed} myFeedReactions={myFeedReactions} profile={profile}
    C={C} inp={inp} pillPrimary={pillPrimary} openProfile={openProfile}
    myUid={myUid}
    recentTrades={trades}
    isDesktop={isDesktop}
  />
)}
```

(Use the same props the existing in-Home `<FriendsFeed />` is passing — the snippet above mirrors the existing call. If the existing call site passes additional props or different names, copy from there. The `trades` variable should be the user's local trade list; verify it exists with `grep -n "const trades" src/Koda.tsx`.)

- [ ] **Step 5: Update the existing in-Home `<FriendsFeed />` call**

Find the existing `<FriendsFeed />` JSX in the Home section (around line 2301). Add the three new props to it as well so it typechecks:

```tsx
  myUid={myUid}
  recentTrades={trades}
  isDesktop={isDesktop}
```

- [ ] **Step 6: Typecheck**

```bash
npm run typecheck
```

Expected: exit 0.

If `recentTrades={trades}` errors (perhaps `trades` is named differently — `tradeList`, `allTrades`, etc.), find the right variable name with `grep -n "useState.*Trade\[\]" src/Koda.tsx`.

---

## Task 10: Local smoke test — dev server

**Files:** none

- [ ] **Step 1: Start the dev server**

```bash
cd "C:\Users\Dylon\OneDrive\Desktop\koda" && npm run dev
```

Expected: Vite serves on `http://localhost:5173`.

- [ ] **Step 2: Manual flow check**

Open `http://localhost:5173` in a browser. Sign in as your test user.

Verify in order:
1. The bottom nav now shows 5 tabs: Home · News · Stats · Circles · **Social**.
2. Tap Social → see "Friends / Ideas / People" sub-tabs.
3. Tap Ideas → see empty state ("No ideas yet — be the first to post.") + "+ New Idea" FAB.
4. Tap "+ New Idea" → composer modal/sheet opens.
5. Fill in: type=post, title="Test idea", instrument="NQ", direction=long, body="hello world". Click Post Idea.
6. Composer closes; the new idea appears at the top of the feed with correct author handle, like count 0, ♡ icon.
7. Click ♡ — it flips to ♥ and count shows 1. Click again — back to ♡ and 0.
8. Tap the card — it expands, showing the full body.
9. Resize to desktop width (≥ 900px) — composer should open as a centred modal, feed cards should max out at 680px width.

If any step fails: STOP, capture the browser console errors, fix, re-run from step 1.

- [ ] **Step 3: Stop the dev server**

`Ctrl+C` in the terminal running `npm run dev`.

---

## Task 11: Deploy preview to Vercel

**Files:** none

- [ ] **Step 1: Final typecheck + lint**

```bash
cd "C:\Users\Dylon\OneDrive\Desktop\koda" && npm run typecheck && npm run lint
```

Expected: both exit 0.

- [ ] **Step 2: Deploy preview**

```bash
cd "C:\Users\Dylon\OneDrive\Desktop\koda" && vercel
```

Expected: builds, returns a preview URL like `https://tradr-dt-xxxxx.vercel.app`. Note the URL.

- [ ] **Step 3: Smoke-test the preview**

Open the preview URL. Sign in. Repeat manual flow check from Task 10 Step 2 (steps 1–9). Pay special attention to:
- API calls to `/api/ideas?action=list` return 200 (not 404 — confirms the new serverless function deployed).
- Chart upload to Supabase Storage succeeds and the public URL renders.
- RLS isn't blocking inserts (if it is: check that the user is authenticated and `auth.uid()` matches `author_uid`).

If anything fails in preview but worked locally, check Vercel build logs:

```bash
vercel logs <preview-url>
```

- [ ] **Step 4: Report status**

Print a one-line summary: preview URL + "Ideas feature working end-to-end in preview" OR a list of remaining issues.

---

## Self-Review

**Spec coverage:**
- ✅ Navigation rename (Feed → Social) — Task 9 adds new tab; the spec said "rename Feed → Social" but the codebase has FriendsFeed embedded in Home rather than a Feed tab, so we add Social as the 5th tab. The behavioural intent (a Social home for Ideas/Friends/People) is preserved.
- ✅ `public.ideas` + `public.idea_likes` tables — Task 1
- ✅ RLS — Task 1 step 3
- ✅ `api/ideas.ts` actions `list | create | like | delete` — Task 3
- ✅ Client-side direct upload to `trade-screenshots` — Task 6 `uploadChart`
- ✅ `IdeasScreen` + empty state — Task 6
- ✅ `IdeaCard` collapsed + expanded — Task 4
- ✅ `IdeaComposer` single scrollable form — Task 5
- ✅ FriendsFeed `"ideas"` tab union — Task 8
- ✅ `Idea` interface — Task 2
- ✅ Migration file — Task 1
- ✅ Desktop responsive (max-width 680px, modal vs sheet) — Tasks 4/5/6

**Placeholder scan:** No "TBD"/"TODO"/"add appropriate error handling" placeholders. The two known unknowns (exact `AvatarCircle` props in shared.tsx; exact `myUid` source / `trades` variable name in Koda.tsx) are explicitly called out with the grep command to verify before editing.

**Type consistency:**
- `Idea` interface (Task 2) ↔ `rowToIdea` mapping (Task 3) ↔ `IdeaCard` consumption (Task 4): all use the same camelCase keys.
- `IdeaCreateInput` (Task 2) ↔ composer payload (Task 5) ↔ API validation (Task 3): all align.
- `IdeasScreenProps` (Task 6) ↔ `FriendsFeedProps` additions (Task 8) ↔ Koda.tsx call site (Task 9): consistent.

**Scope:** This is one cohesive feature shippable in one cycle.

---

## Execution Handoff

Plan complete and saved to `docs/superpowers/plans/2026-06-02-ideas-section.md`.
