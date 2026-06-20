# Businesstats Bot Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Ship a Telegram bot (`businesstats_bot`) that posts live Kōda metrics (users, revenue, errors, analytics) to an internal team group, auth-gated to a whitelist of Telegram user IDs.

**Architecture:** New Vercel serverless function `api/businesstats.ts` receives Telegram webhook updates verified by a shared secret, gates all commands against a user-ID + chat-ID whitelist, routes to modular metric handlers that query Supabase/Stripe/Sentry/PostHog directly with no caching, and posts formatted HTML replies via the Bot API. A daily digest fires via Vercel Cron at 07:00 UTC.

**Tech Stack:** TypeScript, Vercel serverless functions, `getAdminClient()` from `api/lib/supabaseAdmin.ts`, Stripe (already installed `stripe@^22`), Sentry REST API (raw fetch), PostHog API (raw fetch — no new dependency), Telegram Bot API (raw fetch). Types are inlined as in existing `api/*.ts` files — no `@vercel/node` package.

**Function count:** 8 existing serverless functions → 9 after this change. Hobby limit is 12. Fine.

---

## File Map

| Path | Status | Responsibility |
|---|---|---|
| `api/businesstats.ts` | CREATE | Webhook entry point: verify secret, auth gate, route commands |
| `api/lib/telegram/auth.ts` | CREATE | Whitelist check (user IDs + chat ID) + shared `TelegramUpdate` type |
| `api/lib/telegram/format.ts` | CREATE | HTML message escaping + formatting helpers |
| `api/lib/metrics/users.ts` | CREATE | Supabase: total/active users, new signups, waitlist |
| `api/lib/metrics/revenue.ts` | CREATE | Stripe: MRR, active subs, new/churned this week, WoW delta |
| `api/lib/metrics/trades.ts` | CREATE | Supabase: trade volume, top strategies |
| `api/lib/metrics/errors.ts` | CREATE | Sentry REST: unresolved issues, error count/rate |
| `api/lib/metrics/analytics.ts` | CREATE | PostHog API: DAU, WAU, event counts |
| `api/lib/metrics/digest.ts` | CREATE | Assembles + sends daily digest to ops chat |
| `supabase/migrations/20260601_metrics_fns.sql` | CREATE | Postgres RPCs for user + trade counts (cross-schema queries) |
| `api/cron.ts` | MODIFY | Add `daily-digest` job branch |
| `api/telegram.ts` | MODIFY | Replace hardcoded `ADMIN_TELEGRAM_ID` with shared auth module |
| `vercel.json` | MODIFY | Add daily-digest cron schedule |
| `.env.example` | MODIFY | Document all new env vars |
| `docs/BUSINESSTATS_BOT.md` | CREATE | Setup, tokens, webhook registration, deployment guide |

---

## Task 1: Auth module + basic bot scaffold

The bot should respond to `/help` only, reject all other users silently, before any
metric integration exists.

**Files:**
- Create: `api/lib/telegram/auth.ts`
- Create: `api/lib/telegram/format.ts`
- Create: `api/lib/telegram/__tests__/auth.test.ts`
- Create: `api/businesstats.ts`

- [ ] **Step 1: Write failing auth tests**

```typescript
// api/lib/telegram/__tests__/auth.test.ts
import { describe, it, expect, beforeEach } from 'vitest';

type Update = import('../auth.js').TelegramUpdate;

function makeUpdate(
  userId: number,
  chatId: number,
  chatType: 'private' | 'group' | 'supergroup' = 'supergroup',
): Update {
  return {
    update_id: 1,
    message: {
      message_id: 1,
      date: Date.now(),
      text: '/help',
      from: { id: userId, is_bot: false, first_name: 'Test' },
      chat: { id: chatId, type: chatType },
    },
  };
}

// Module reads env at import time — reset module registry between tests
describe('isAuthorized', () => {
  beforeEach(() => {
    process.env.TELEGRAM_ALLOWED_USER_IDS = '100,200';
    process.env.TELEGRAM_OPS_CHAT_ID = '-9999';
  });

  it('allows whitelisted user in the ops group', async () => {
    const { isAuthorized } = await import('../auth.js');
    expect(isAuthorized(makeUpdate(100, -9999))).toBe(true);
  });

  it('rejects unknown user even in ops group', async () => {
    const { isAuthorized } = await import('../auth.js');
    expect(isAuthorized(makeUpdate(999, -9999))).toBe(false);
  });

  it('allows whitelisted user in private chat', async () => {
    const { isAuthorized } = await import('../auth.js');
    expect(isAuthorized(makeUpdate(100, 100, 'private'))).toBe(true);
  });

  it('rejects whitelisted user in a different group', async () => {
    const { isAuthorized } = await import('../auth.js');
    expect(isAuthorized(makeUpdate(100, -1234))).toBe(false);
  });

  it('rejects update with no message', async () => {
    const { isAuthorized } = await import('../auth.js');
    expect(isAuthorized({ update_id: 1 } as Update)).toBe(false);
  });
});
```

- [ ] **Step 2: Run test — verify it fails (module not found)**

```bash
cd C:\Users\Dylon\OneDrive\Desktop\koda
npx vitest run api/lib/telegram/__tests__/auth.test.ts
```
Expected: FAIL — `Cannot find module '../auth.js'`

- [ ] **Step 3: Create `api/lib/telegram/auth.ts`**

```typescript
export interface TelegramUpdate {
  update_id: number;
  message?: {
    message_id: number;
    date: number;
    text?: string;
    from?: { id: number; is_bot: boolean; first_name: string; username?: string };
    chat: { id: number; type: 'private' | 'group' | 'supergroup' | 'channel' };
  };
}

const ALLOWED_USER_IDS = new Set(
  (process.env.TELEGRAM_ALLOWED_USER_IDS ?? '')
    .split(',')
    .map(s => parseInt(s.trim(), 10))
    .filter(n => !isNaN(n) && n > 0),
);

const OPS_CHAT_ID = parseInt(process.env.TELEGRAM_OPS_CHAT_ID ?? '0', 10);

export function isAuthorized(update: TelegramUpdate): boolean {
  const msg = update.message;
  if (!msg) return false;
  const userId = msg.from?.id;
  if (!userId || !ALLOWED_USER_IDS.has(userId)) return false;
  return msg.chat.type === 'private' || msg.chat.id === OPS_CHAT_ID;
}

export function getChatId(update: TelegramUpdate): number {
  return update.message!.chat.id;
}
```

- [ ] **Step 4: Run test — verify all 5 pass**

```bash
npx vitest run api/lib/telegram/__tests__/auth.test.ts
```
Expected: 5 passed

- [ ] **Step 5: Create `api/lib/telegram/format.ts`**

```typescript
function esc(t: unknown): string {
  return String(t)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}

export const b    = (t: unknown) => `<b>${esc(t)}</b>`;
export const code = (t: unknown) => `<code>${esc(t)}</code>`;
export const link = (text: string, url: string) => `<a href="${url}">${esc(text)}</a>`;
```

- [ ] **Step 6: Create `api/businesstats.ts`**

```typescript
export const config = { runtime: 'nodejs' };

type Req = { method?: string; headers: Record<string, string | string[] | undefined>; body: Record<string, unknown> };
type Res = { status(n: number): Res; json(d: unknown): Res; end(): void };

import { isAuthorized, getChatId, type TelegramUpdate } from './lib/telegram/auth.js';
import { b } from './lib/telegram/format.js';

const TOKEN  = process.env.TELEGRAM_BUSINESSTATS_TOKEN!;
const SECRET = process.env.TELEGRAM_BUSINESSTATS_SECRET!;

export async function sendMessage(chatId: number | string, text: string) {
  const res = await fetch(`https://api.telegram.org/bot${TOKEN}/sendMessage`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ chat_id: chatId, text, parse_mode: 'HTML', disable_web_page_preview: true }),
  });
  if (!res.ok) console.error('Telegram sendMessage failed:', res.status, await res.text());
}

function integrationStatus() {
  return [
    process.env.SUPABASE_SERVICE_ROLE_KEY ? '✅ Supabase' : '❌ Supabase',
    process.env.STRIPE_SECRET_KEY         ? '✅ Stripe'   : '❌ Stripe',
    process.env.SENTRY_AUTH_TOKEN         ? '✅ Sentry'   : '❌ Sentry (commands disabled)',
    process.env.POSTHOG_PERSONAL_API_KEY  ? '✅ PostHog'  : '❌ PostHog (commands disabled)',
  ];
}

async function handleHelp(chatId: number) {
  await sendMessage(chatId, [
    b('📊 Kōda Ops Bot'),
    '',
    b('Business'),
    '/users — signups + active users',
    '/waitlist — beta waitlist count',
    '/revenue — MRR, subs, churn',
    '/trades — trade volume + activity',
    '',
    b('Monitoring'),
    '/errors — latest Sentry issues',
    '/analytics — DAU/WAU (PostHog)',
    '',
    b('Utility'),
    '/health — integration status',
    '/user email@example.com — user lookup',
    '/digest — run daily digest now',
    '',
    b('Integrations'),
    ...integrationStatus(),
  ].join('\n'));
}

export default async function handler(req: Req, res: Res) {
  if (req.method !== 'POST') return res.status(405).end();

  const secret = req.headers['x-telegram-bot-api-secret-token'] as string | undefined;
  if (secret !== SECRET) return res.status(401).end();

  const update = req.body as TelegramUpdate;
  if (!isAuthorized(update)) return res.status(200).end();

  const text    = update.message?.text ?? '';
  const chatId  = getChatId(update);
  const command = text.split(' ')[0].toLowerCase().replace(/@\w+$/, '');

  try {
    switch (command) {
      case '/start':
      case '/help':
        await handleHelp(chatId);
        break;
      // Further commands added in subsequent tasks
    }
  } catch (err) {
    console.error('businesstats bot error:', err);
    await sendMessage(chatId, '❌ Internal error — check Vercel logs.');
  }

  return res.status(200).end();
}
```

- [ ] **Step 7: Commit**

```bash
git add api/businesstats.ts api/lib/telegram/auth.ts api/lib/telegram/format.ts api/lib/telegram/__tests__/auth.test.ts
git commit -m "feat: businesstats bot scaffold with auth gate and /help"
```

---

## Task 2: Supabase migration + user metrics

**Files:**
- Create: `supabase/migrations/20260601_metrics_fns.sql`
- Create: `api/lib/metrics/users.ts`
- Create: `api/lib/metrics/__tests__/users.test.ts`
- Modify: `api/businesstats.ts`

- [ ] **Step 1: Write failing test**

```typescript
// api/lib/metrics/__tests__/users.test.ts
import { describe, it, expect, vi } from 'vitest';

vi.mock('../../supabaseAdmin.js', () => ({
  getAdminClient: () => ({
    rpc: vi.fn().mockResolvedValue({
      data: { total: 42, today: 3, last_7d: 10, last_30d: 28, active_30d: 15 },
      error: null,
    }),
    from: vi.fn().mockReturnValue({
      select: vi.fn().mockResolvedValue({ count: 7, error: null }),
    }),
  }),
}));

import { getUserMetrics } from '../users.js';

describe('getUserMetrics', () => {
  it('returns shaped metrics from rpc + waitlist count', async () => {
    const m = await getUserMetrics();
    expect(m).toEqual({ total: 42, today: 3, last7d: 10, last30d: 28, active30d: 15, waitlist: 7 });
  });
});
```

- [ ] **Step 2: Run — verify fails (module not found)**

```bash
npx vitest run api/lib/metrics/__tests__/users.test.ts
```

- [ ] **Step 3: Apply Supabase migration**

Create `supabase/migrations/20260601_metrics_fns.sql`:

```sql
-- User stats: requires cross-schema access to auth.users
CREATE OR REPLACE FUNCTION public.get_user_stats()
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth
AS $$
BEGIN
  RETURN jsonb_build_object(
    'total',      (SELECT COUNT(*)               FROM auth.users),
    'today',      (SELECT COUNT(*)               FROM auth.users WHERE created_at >= CURRENT_DATE),
    'last_7d',    (SELECT COUNT(*)               FROM auth.users WHERE created_at >= NOW() - INTERVAL '7 days'),
    'last_30d',   (SELECT COUNT(*)               FROM auth.users WHERE created_at >= NOW() - INTERVAL '30 days'),
    'active_30d', (SELECT COUNT(DISTINCT user_id) FROM public.trades WHERE date >= CURRENT_DATE - 30)
  );
END;
$$;

REVOKE ALL ON FUNCTION public.get_user_stats() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_user_stats() TO service_role;

-- Trade stats
CREATE OR REPLACE FUNCTION public.get_trade_stats()
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  top_strats jsonb;
BEGIN
  SELECT jsonb_agg(row_to_json(t))
  INTO top_strats
  FROM (
    SELECT strategy, COUNT(*) AS count
    FROM public.trades
    WHERE strategy IS NOT NULL AND strategy <> ''
    GROUP BY strategy
    ORDER BY count DESC
    LIMIT 5
  ) t;

  RETURN jsonb_build_object(
    'total',          (SELECT COUNT(*) FROM public.trades),
    'today',          (SELECT COUNT(*) FROM public.trades WHERE date = CURRENT_DATE),
    'last_7d',        (SELECT COUNT(*) FROM public.trades WHERE date >= CURRENT_DATE - 7),
    'top_strategies', COALESCE(top_strats, '[]'::jsonb)
  );
END;
$$;

REVOKE ALL ON FUNCTION public.get_trade_stats() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_trade_stats() TO service_role;
```

Apply via Supabase Dashboard → SQL Editor → run the file contents.

- [ ] **Step 4: Create `api/lib/metrics/users.ts`**

```typescript
import { getAdminClient } from '../supabaseAdmin.js';
import { b } from '../telegram/format.js';

export interface UserMetrics {
  total: number;
  today: number;
  last7d: number;
  last30d: number;
  active30d: number;
  waitlist: number;
}

export async function getUserMetrics(): Promise<UserMetrics> {
  const db = getAdminClient();

  const [statsRes, waitlistRes] = await Promise.all([
    db.rpc('get_user_stats'),
    db.from('waitlist').select('*', { count: 'exact', head: true }),
  ]);

  if (statsRes.error) throw new Error(`get_user_stats: ${statsRes.error.message}`);

  const s = statsRes.data as Record<string, number>;
  return {
    total:     s.total,
    today:     s.today,
    last7d:    s.last_7d,
    last30d:   s.last_30d,
    active30d: s.active_30d,
    waitlist:  waitlistRes.count ?? 0,
  };
}

export function formatUserMetrics(m: UserMetrics): string {
  return [
    b('👥 Users'),
    `Total: ${b(m.total)}  •  Active 30d: ${b(m.active30d)}`,
    `New today: ${b(m.today)}  •  Last 7d: ${b(m.last7d)}  •  Last 30d: ${b(m.last30d)}`,
    '',
    b('📋 Waitlist'),
    `${b(m.waitlist)} pending signups`,
  ].join('\n');
}
```

- [ ] **Step 5: Run test — verify passes**

```bash
npx vitest run api/lib/metrics/__tests__/users.test.ts
```
Expected: 1 passed

- [ ] **Step 6: Wire `/users` and `/waitlist` into `api/businesstats.ts`**

Add import at the top:
```typescript
import { getUserMetrics, formatUserMetrics } from './lib/metrics/users.js';
```

Add case to the switch (before the closing `}`):
```typescript
      case '/users':
      case '/waitlist': {
        await sendMessage(chatId, '⏳ Fetching...');
        const m = await getUserMetrics();
        await sendMessage(chatId, formatUserMetrics(m));
        break;
      }
```

- [ ] **Step 7: Commit**

```bash
git add supabase/migrations/20260601_metrics_fns.sql api/lib/metrics/users.ts api/lib/metrics/__tests__/users.test.ts api/businesstats.ts
git commit -m "feat: add /users and /waitlist commands with Supabase RPC"
```

---

## Task 3: Trade metrics

**Files:**
- Create: `api/lib/metrics/trades.ts`
- Create: `api/lib/metrics/__tests__/trades.test.ts`
- Modify: `api/businesstats.ts`

- [ ] **Step 1: Write failing test**

```typescript
// api/lib/metrics/__tests__/trades.test.ts
import { describe, it, expect, vi } from 'vitest';

vi.mock('../../supabaseAdmin.js', () => ({
  getAdminClient: () => ({
    rpc: vi.fn().mockResolvedValue({
      data: {
        total: 500,
        today: 12,
        last_7d: 47,
        top_strategies: [
          { strategy: 'Breakout', count: 120 },
          { strategy: 'Scalp', count: 98 },
        ],
      },
      error: null,
    }),
  }),
}));

import { getTradeMetrics } from '../trades.js';

describe('getTradeMetrics', () => {
  it('returns shaped trade metrics from rpc', async () => {
    const m = await getTradeMetrics();
    expect(m.total).toBe(500);
    expect(m.today).toBe(12);
    expect(m.last7d).toBe(47);
    expect(m.topStrategies).toHaveLength(2);
    expect(m.topStrategies[0]).toEqual({ strategy: 'Breakout', count: 120 });
  });
});
```

- [ ] **Step 2: Run — verify fails**

```bash
npx vitest run api/lib/metrics/__tests__/trades.test.ts
```

- [ ] **Step 3: Create `api/lib/metrics/trades.ts`**

```typescript
import { getAdminClient } from '../supabaseAdmin.js';
import { b } from '../telegram/format.js';

export interface TradeMetrics {
  total: number;
  today: number;
  last7d: number;
  topStrategies: { strategy: string; count: number }[];
}

export async function getTradeMetrics(): Promise<TradeMetrics> {
  const db = getAdminClient();
  const { data, error } = await db.rpc('get_trade_stats');
  if (error) throw new Error(`get_trade_stats: ${error.message}`);
  const d = data as Record<string, unknown>;
  return {
    total:         d.total as number,
    today:         d.today as number,
    last7d:        d.last_7d as number,
    topStrategies: d.top_strategies as { strategy: string; count: number }[],
  };
}

export function formatTradeMetrics(m: TradeMetrics): string {
  const strats = m.topStrategies.length
    ? m.topStrategies.map(s => `  • ${s.strategy}: ${b(s.count)}`).join('\n')
    : '  No strategy data yet';

  return [
    b('📈 Trades'),
    `Total: ${b(m.total)}  •  Today: ${b(m.today)}  •  Last 7d: ${b(m.last7d)}`,
    '',
    b('Top Strategies (all-time)'),
    strats,
  ].join('\n');
}
```

- [ ] **Step 4: Run test — verify passes**

```bash
npx vitest run api/lib/metrics/__tests__/trades.test.ts
```

- [ ] **Step 5: Wire `/trades` into `api/businesstats.ts`**

Add import:
```typescript
import { getTradeMetrics, formatTradeMetrics } from './lib/metrics/trades.js';
```

Add case:
```typescript
      case '/trades': {
        await sendMessage(chatId, '⏳ Fetching...');
        const m = await getTradeMetrics();
        await sendMessage(chatId, formatTradeMetrics(m));
        break;
      }
```

- [ ] **Step 6: Commit**

```bash
git add api/lib/metrics/trades.ts api/lib/metrics/__tests__/trades.test.ts api/businesstats.ts
git commit -m "feat: add /trades command"
```

---

## Task 4: Stripe revenue metrics

**Files:**
- Create: `api/lib/metrics/revenue.ts`
- Create: `api/lib/metrics/__tests__/revenue.test.ts`
- Modify: `api/businesstats.ts`

- [ ] **Step 1: Write failing test**

```typescript
// api/lib/metrics/__tests__/revenue.test.ts
import { describe, it, expect, vi } from 'vitest';

const mockSubs = { list: vi.fn() };
const mockEvents = { list: vi.fn() };
vi.mock('stripe', () => ({ default: vi.fn(() => ({ subscriptions: mockSubs, events: mockEvents })) }));

import { getRevenueMetrics } from '../revenue.js';

describe('getRevenueMetrics', () => {
  it('calculates MRR from monthly + annual subs and counts churn events', async () => {
    mockSubs.list
      // active subs call
      .mockResolvedValueOnce({
        data: [
          { id: 'sub_1', currency: 'gbp', items: { data: [{ price: { unit_amount: 1000, recurring: { interval: 'month' } }, quantity: 1 }] } },
          { id: 'sub_2', currency: 'gbp', items: { data: [{ price: { unit_amount: 12000, recurring: { interval: 'year' } }, quantity: 1 }] } },
        ],
        has_more: false,
      })
      // new this week call
      .mockResolvedValueOnce({ data: [{ id: 'sub_3' }], has_more: false });

    mockEvents.list.mockResolvedValueOnce({ data: [{ id: 'evt_1' }], has_more: false });

    const m = await getRevenueMetrics();
    // £10/mo + £12k/yr÷12=£1/mo = £11 MRR
    expect(m.mrr).toBeCloseTo(11.0, 1);
    expect(m.currency).toBe('GBP');
    expect(m.activeCount).toBe(2);
    expect(m.newThisWeek).toBe(1);
    expect(m.churnedThisWeek).toBe(1);
    expect(m.wowDelta).toBe(0);
  });
});
```

- [ ] **Step 2: Run — verify fails**

```bash
npx vitest run api/lib/metrics/__tests__/revenue.test.ts
```

- [ ] **Step 3: Create `api/lib/metrics/revenue.ts`**

```typescript
import Stripe from 'stripe';
import { b } from '../telegram/format.js';

export interface RevenueMetrics {
  mrr: number;
  currency: string;
  activeCount: number;
  newThisWeek: number;
  churnedThisWeek: number;
  wowDelta: number;
}

export async function getRevenueMetrics(): Promise<RevenueMetrics> {
  const stripe  = new Stripe(process.env.STRIPE_SECRET_KEY!);
  const weekAgo = Math.floor(Date.now() / 1000) - 7 * 24 * 60 * 60;

  const [activeSubs, newSubsRes, churnEvents] = await Promise.all([
    stripe.subscriptions.list({ status: 'active', limit: 100 }),
    stripe.subscriptions.list({ status: 'active', created: { gte: weekAgo }, limit: 100 }),
    stripe.events.list({ type: 'customer.subscription.deleted', created: { gte: weekAgo }, limit: 100 }),
  ]);

  let mrrPence = 0;
  let currency = 'gbp';

  for (const sub of activeSubs.data) {
    currency = sub.currency;
    for (const item of sub.items.data) {
      const price = item.price as Stripe.Price;
      const amount = price.unit_amount ?? 0;
      const qty    = item.quantity ?? 1;
      if (price.recurring?.interval === 'month') {
        mrrPence += amount * qty;
      } else if (price.recurring?.interval === 'year') {
        mrrPence += Math.round((amount * qty) / 12);
      }
    }
  }

  const newThisWeek     = newSubsRes.data.length;
  const churnedThisWeek = churnEvents.data.length;

  return {
    mrr:             mrrPence / 100,
    currency:        currency.toUpperCase(),
    activeCount:     activeSubs.data.length,
    newThisWeek,
    churnedThisWeek,
    wowDelta:        newThisWeek - churnedThisWeek,
  };
}

export function formatRevenueMetrics(m: RevenueMetrics): string {
  const sym   = m.currency === 'GBP' ? '£' : m.currency === 'USD' ? '$' : m.currency + ' ';
  const delta = m.wowDelta >= 0 ? `+${m.wowDelta}` : String(m.wowDelta);
  return [
    b('💰 Revenue'),
    `MRR: ${b(`${sym}${m.mrr.toFixed(2)}`)}  •  Active subs: ${b(m.activeCount)}`,
    '',
    b('This week'),
    `New: ${b(m.newThisWeek)}  •  Churned: ${b(m.churnedThisWeek)}  •  Net: ${b(delta)}`,
  ].join('\n');
}
```

- [ ] **Step 4: Run test — verify passes**

```bash
npx vitest run api/lib/metrics/__tests__/revenue.test.ts
```

- [ ] **Step 5: Wire `/revenue` into `api/businesstats.ts`**

Add import:
```typescript
import { getRevenueMetrics, formatRevenueMetrics } from './lib/metrics/revenue.js';
```

Add case:
```typescript
      case '/revenue': {
        await sendMessage(chatId, '⏳ Fetching...');
        const m = await getRevenueMetrics();
        await sendMessage(chatId, formatRevenueMetrics(m));
        break;
      }
```

- [ ] **Step 6: Commit**

```bash
git add api/lib/metrics/revenue.ts api/lib/metrics/__tests__/revenue.test.ts api/businesstats.ts
git commit -m "feat: add /revenue command (Stripe MRR + churn)"
```

---

## Task 5: Sentry errors

**Files:**
- Create: `api/lib/metrics/errors.ts`
- Create: `api/lib/metrics/__tests__/errors.test.ts`
- Modify: `api/businesstats.ts`

- [ ] **Step 1: Write failing test**

```typescript
// api/lib/metrics/__tests__/errors.test.ts
import { describe, it, expect, vi, beforeEach } from 'vitest';

const mockFetch = vi.fn();
vi.stubGlobal('fetch', mockFetch);

import { getSentryMetrics } from '../errors.js';

describe('getSentryMetrics', () => {
  it('returns null when SENTRY_AUTH_TOKEN is missing', async () => {
    delete process.env.SENTRY_AUTH_TOKEN;
    expect(await getSentryMetrics()).toBeNull();
  });

  it('returns issues and 24h error count', async () => {
    process.env.SENTRY_AUTH_TOKEN = 'test-token';
    process.env.SENTRY_ORG       = 'test-org';
    process.env.SENTRY_PROJECT   = 'test-project';

    mockFetch
      .mockResolvedValueOnce({
        ok: true,
        json: async () => [
          { id: '1', title: 'TypeError: x is undefined', count: '42', lastSeen: '2026-06-01T10:00:00Z', permalink: 'https://sentry.io/issues/1/' },
        ],
      })
      .mockResolvedValueOnce({
        ok: true,
        json: async () => [[1748736000, 10], [1748739600, 5], [1748743200, 8]],
      });

    const m = await getSentryMetrics();
    expect(m).not.toBeNull();
    expect(m!.issues).toHaveLength(1);
    expect(m!.issues[0].count).toBe(42);
    expect(m!.errorCount24h).toBe(23);
  });
});
```

- [ ] **Step 2: Run — verify fails**

```bash
npx vitest run api/lib/metrics/__tests__/errors.test.ts
```

- [ ] **Step 3: Create `api/lib/metrics/errors.ts`**

```typescript
import { b, link } from '../telegram/format.js';

const SENTRY_BASE = 'https://sentry.io/api/0';

async function sentryGet(path: string) {
  const res = await fetch(`${SENTRY_BASE}${path}`, {
    headers: { Authorization: `Bearer ${process.env.SENTRY_AUTH_TOKEN}` },
  });
  if (!res.ok) throw new Error(`Sentry ${res.status}: ${path}`);
  return res.json();
}

export interface SentryIssue {
  id: string;
  title: string;
  count: number;
  lastSeen: string;
  permalink: string;
}

export interface SentryMetrics {
  issues: SentryIssue[];
  errorCount24h: number;
}

export async function getSentryMetrics(): Promise<SentryMetrics | null> {
  const { SENTRY_AUTH_TOKEN, SENTRY_ORG, SENTRY_PROJECT } = process.env;
  if (!SENTRY_AUTH_TOKEN || !SENTRY_ORG || !SENTRY_PROJECT) return null;

  const since = Math.floor(Date.now() / 1000) - 24 * 60 * 60;
  const until = Math.floor(Date.now() / 1000);

  const [issues, stats] = await Promise.all([
    sentryGet(`/projects/${SENTRY_ORG}/${SENTRY_PROJECT}/issues/?query=is:unresolved&limit=10&sort=date`),
    sentryGet(`/projects/${SENTRY_ORG}/${SENTRY_PROJECT}/stats/?stat=received&since=${since}&until=${until}&resolution=1h`),
  ]);

  return {
    issues: (issues as Record<string, unknown>[]).map(i => ({
      id:        String(i.id),
      title:     String(i.title),
      count:     parseInt(String(i.count), 10),
      lastSeen:  String(i.lastSeen),
      permalink: String(i.permalink),
    })),
    errorCount24h: (stats as [number, number][]).reduce((sum, [, count]) => sum + count, 0),
  };
}

export function formatSentryMetrics(m: SentryMetrics): string {
  const issueLines = m.issues.length
    ? m.issues.map(i => `  • ${link(i.title.slice(0, 55), i.permalink)} (${i.count}×)`)
    : ['  No unresolved issues 🎉'];

  return [
    b('🚨 Sentry — last 24h'),
    `Total errors: ${b(m.errorCount24h)}`,
    '',
    b('Unresolved issues'),
    ...issueLines,
  ].join('\n');
}
```

- [ ] **Step 4: Run test — verify passes**

```bash
npx vitest run api/lib/metrics/__tests__/errors.test.ts
```

- [ ] **Step 5: Wire `/errors` into `api/businesstats.ts`**

Add import:
```typescript
import { getSentryMetrics, formatSentryMetrics } from './lib/metrics/errors.js';
```

Add case:
```typescript
      case '/errors': {
        await sendMessage(chatId, '⏳ Fetching...');
        const m = await getSentryMetrics();
        if (!m) { await sendMessage(chatId, '❌ Sentry not configured — set SENTRY_AUTH_TOKEN, SENTRY_ORG, SENTRY_PROJECT in Vercel env.'); break; }
        await sendMessage(chatId, formatSentryMetrics(m));
        break;
      }
```

- [ ] **Step 6: Commit**

```bash
git add api/lib/metrics/errors.ts api/lib/metrics/__tests__/errors.test.ts api/businesstats.ts
git commit -m "feat: add /errors command (Sentry REST API)"
```

---

## Task 6: PostHog analytics

Uses raw fetch — no new npm dependency needed.

**Files:**
- Create: `api/lib/metrics/analytics.ts`
- Create: `api/lib/metrics/__tests__/analytics.test.ts`
- Modify: `api/businesstats.ts`

- [ ] **Step 1: Write failing test**

```typescript
// api/lib/metrics/__tests__/analytics.test.ts
import { describe, it, expect, vi, beforeEach } from 'vitest';

const mockFetch = vi.fn();
vi.stubGlobal('fetch', mockFetch);

import { getPostHogMetrics } from '../analytics.js';

describe('getPostHogMetrics', () => {
  it('returns null when env vars missing', async () => {
    delete process.env.POSTHOG_PERSONAL_API_KEY;
    expect(await getPostHogMetrics()).toBeNull();
  });

  it('returns DAU, WAU, and summed event counts', async () => {
    process.env.POSTHOG_PERSONAL_API_KEY = 'phx_test';
    process.env.POSTHOG_PROJECT_ID       = '12345';
    process.env.VITE_POSTHOG_HOST        = 'https://eu.posthog.com';

    // DAU response
    mockFetch.mockResolvedValueOnce({ ok: true, json: async () => ({ result: [{ data: [3, 5], days: ['2026-05-31', '2026-06-01'] }] }) });
    // WAU response
    mockFetch.mockResolvedValueOnce({ ok: true, json: async () => ({ result: [{ data: [23], days: ['2026-05-26'] }] }) });
    // Events response
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        result: [
          { action: { name: 'trade_logged' }, data: [10, 8, 9] },
          { action: { name: 'user_signed_up' }, data: [2, 1, 3] },
        ],
      }),
    });

    const m = await getPostHogMetrics();
    expect(m).not.toBeNull();
    expect(m!.dau).toBe(5);   // last value of DAU series
    expect(m!.wau).toBe(23);
    expect(m!.topEvents[0]).toEqual({ name: 'trade_logged', count: 27 });
    expect(m!.topEvents[1]).toEqual({ name: 'user_signed_up', count: 6 });
  });
});
```

- [ ] **Step 2: Run — verify fails**

```bash
npx vitest run api/lib/metrics/__tests__/analytics.test.ts
```

- [ ] **Step 3: Create `api/lib/metrics/analytics.ts`**

```typescript
import { b } from '../telegram/format.js';

export interface PostHogMetrics {
  dau: number;
  wau: number;
  topEvents: { name: string; count: number }[];
}

export async function getPostHogMetrics(): Promise<PostHogMetrics | null> {
  const apiKey    = process.env.POSTHOG_PERSONAL_API_KEY;
  const projectId = process.env.POSTHOG_PROJECT_ID;
  if (!apiKey || !projectId) return null;

  const host    = (process.env.VITE_POSTHOG_HOST ?? 'https://us.posthog.com').replace(/\/$/, '');
  const headers = { Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json' };

  async function trend(body: object) {
    const res = await fetch(`${host}/api/projects/${projectId}/insights/trend/`, {
      method: 'POST', headers, body: JSON.stringify(body),
    });
    if (!res.ok) throw new Error(`PostHog trend ${res.status}`);
    return (await res.json()) as { result: { data: number[]; action?: { name: string } }[] };
  }

  const pageviewDau = { id: '$pageview', math: 'dau', type: 'events' };

  const [dauRes, wauRes, eventsRes] = await Promise.all([
    trend({ events: [pageviewDau], date_from: '-1d', interval: 'day' }),
    trend({ events: [pageviewDau], date_from: '-7d', interval: 'week' }),
    trend({
      events: [
        { id: 'trade_logged',   math: 'total', type: 'events' },
        { id: 'user_signed_up', math: 'total', type: 'events' },
        { id: '$pageview',      math: 'total', type: 'events' },
      ],
      date_from: '-7d',
      interval:  'day',
    }),
  ]);

  const lastOf = (arr: number[]) => arr.at(-1) ?? 0;
  const sumOf  = (arr: number[]) => arr.reduce((a, n) => a + n, 0);

  const topEvents = eventsRes.result
    .map(r => ({ name: (r as { action: { name: string } }).action?.name ?? 'unknown', count: sumOf(r.data) }))
    .sort((a, z) => z.count - a.count);

  return {
    dau:       lastOf(dauRes.result[0]?.data ?? []),
    wau:       lastOf(wauRes.result[0]?.data ?? []),
    topEvents,
  };
}

export function formatPostHogMetrics(m: PostHogMetrics): string {
  const events = m.topEvents.length
    ? m.topEvents.map(e => `  • ${e.name}: ${b(e.count)}`).join('\n')
    : '  No event data';

  return [
    b('📊 Analytics (PostHog)'),
    `DAU: ${b(m.dau)}  •  WAU: ${b(m.wau)}`,
    '',
    b('Events — last 7d'),
    events,
  ].join('\n');
}
```

- [ ] **Step 4: Run test — verify passes**

```bash
npx vitest run api/lib/metrics/__tests__/analytics.test.ts
```

- [ ] **Step 5: Wire `/analytics` into `api/businesstats.ts`**

Add import:
```typescript
import { getPostHogMetrics, formatPostHogMetrics } from './lib/metrics/analytics.js';
```

Add case:
```typescript
      case '/analytics': {
        await sendMessage(chatId, '⏳ Fetching...');
        const m = await getPostHogMetrics();
        if (!m) { await sendMessage(chatId, '❌ PostHog not configured — set POSTHOG_PERSONAL_API_KEY and POSTHOG_PROJECT_ID in Vercel env.'); break; }
        await sendMessage(chatId, formatPostHogMetrics(m));
        break;
      }
```

- [ ] **Step 6: Commit**

```bash
git add api/lib/metrics/analytics.ts api/lib/metrics/__tests__/analytics.test.ts api/businesstats.ts
git commit -m "feat: add /analytics command (PostHog DAU/WAU)"
```

---

## Task 7: /health and /user commands

Both use multiple integrations and don't need their own module — defined as local
functions in `api/businesstats.ts`.

**Files:**
- Modify: `api/businesstats.ts`

- [ ] **Step 1: Add required imports to `api/businesstats.ts`**

```typescript
import Stripe from 'stripe';
import { getAdminClient } from './lib/supabaseAdmin.js';
import { code } from './lib/telegram/format.js';
```

- [ ] **Step 2: Add `handleHealth` local function in `api/businesstats.ts`** (above `handler`)

```typescript
async function handleHealth(chatId: number) {
  const checks: { name: string; ok: boolean; detail?: string }[] = [];

  // Supabase
  try {
    const { error } = await getAdminClient().from('waitlist').select('id').limit(1);
    checks.push({ name: 'Supabase', ok: !error, detail: error?.message });
  } catch (e) {
    checks.push({ name: 'Supabase', ok: false, detail: String(e) });
  }

  // Stripe
  try {
    await new Stripe(process.env.STRIPE_SECRET_KEY!).balance.retrieve();
    checks.push({ name: 'Stripe', ok: true });
  } catch (e) {
    checks.push({ name: 'Stripe', ok: false, detail: String(e) });
  }

  // Sentry
  if (process.env.SENTRY_AUTH_TOKEN && process.env.SENTRY_ORG && process.env.SENTRY_PROJECT) {
    try {
      const r = await fetch(
        `https://sentry.io/api/0/projects/${process.env.SENTRY_ORG}/${process.env.SENTRY_PROJECT}/`,
        { headers: { Authorization: `Bearer ${process.env.SENTRY_AUTH_TOKEN}` } },
      );
      checks.push({ name: 'Sentry', ok: r.ok, detail: r.ok ? undefined : `HTTP ${r.status}` });
    } catch (e) {
      checks.push({ name: 'Sentry', ok: false, detail: String(e) });
    }
  } else {
    checks.push({ name: 'Sentry', ok: false, detail: 'not configured' });
  }

  // PostHog
  if (process.env.POSTHOG_PERSONAL_API_KEY && process.env.POSTHOG_PROJECT_ID) {
    try {
      const host = (process.env.VITE_POSTHOG_HOST ?? 'https://us.posthog.com').replace(/\/$/, '');
      const r = await fetch(`${host}/api/projects/${process.env.POSTHOG_PROJECT_ID}/`, {
        headers: { Authorization: `Bearer ${process.env.POSTHOG_PERSONAL_API_KEY}` },
      });
      checks.push({ name: 'PostHog', ok: r.ok, detail: r.ok ? undefined : `HTTP ${r.status}` });
    } catch (e) {
      checks.push({ name: 'PostHog', ok: false, detail: String(e) });
    }
  } else {
    checks.push({ name: 'PostHog', ok: false, detail: 'not configured' });
  }

  const lines = checks.map(c => `${c.ok ? '✅' : '❌'} ${c.name}${c.detail ? ` — ${c.detail}` : ''}`);
  await sendMessage(chatId, [b('🔍 Health Check'), ...lines].join('\n'));
}
```

- [ ] **Step 3: Add `handleUserLookup` local function in `api/businesstats.ts`** (above `handler`)

```typescript
async function handleUserLookup(chatId: number, email: string) {
  if (!email || !email.includes('@')) {
    await sendMessage(chatId, '❌ Usage: /user email@example.com');
    return;
  }

  const db = getAdminClient();

  // Supabase auth.admin.listUsers paginates; search by email is not exposed in JS client
  // Use RPC or iterate — for small user counts iterate is acceptable
  const { data: { users }, error } = await db.auth.admin.listUsers({ perPage: 1000 });
  if (error) throw error;

  const user = users.find((u: { email?: string }) => u.email?.toLowerCase() === email.toLowerCase());
  if (!user) {
    await sendMessage(chatId, `❌ No user found: ${code(email)}`);
    return;
  }

  const [profileRes, tradeRes] = await Promise.all([
    db.from('profiles').select('handle, name, onboarded').eq('user_id', user.id).single(),
    db.from('trades').select('*', { count: 'exact', head: true }).eq('user_id', user.id),
  ]);

  const plan      = (user.app_metadata?.plan as string | undefined) ?? 'free';
  const handle    = profileRes.data?.handle ?? '—';
  const signedUp  = new Date(user.created_at).toLocaleDateString('en-GB');
  const trades    = tradeRes.count ?? 0;
  const onboarded = profileRes.data?.onboarded ? 'Yes' : 'No';

  await sendMessage(chatId, [
    b('👤 User Lookup'),
    `Email: ${code(email)}`,
    `Handle: @${handle}`,
    `Plan: ${b(plan)}`,
    `Signed up: ${signedUp}`,
    `Trades logged: ${b(trades)}`,
    `Onboarded: ${onboarded}`,
  ].join('\n'));
}
```

- [ ] **Step 4: Add cases to the switch in `handler`**

```typescript
      case '/health': {
        await sendMessage(chatId, '⏳ Checking...');
        await handleHealth(chatId);
        break;
      }
      case '/user': {
        const email = text.split(' ')[1] ?? '';
        await handleUserLookup(chatId, email.trim());
        break;
      }
```

- [ ] **Step 5: Commit**

```bash
git add api/businesstats.ts
git commit -m "feat: add /health and /user commands"
```

---

## Task 8: Daily digest + cron

**Files:**
- Create: `api/lib/metrics/digest.ts`
- Modify: `api/cron.ts`
- Modify: `vercel.json`
- Modify: `api/businesstats.ts`

- [ ] **Step 1: Create `api/lib/metrics/digest.ts`**

```typescript
import { getUserMetrics }    from './users.js';
import { getRevenueMetrics } from './revenue.js';
import { getTradeMetrics }   from './trades.js';
import { getSentryMetrics }  from './errors.js';
import { getPostHogMetrics } from './analytics.js';
import { b } from '../telegram/format.js';

const TOKEN      = process.env.TELEGRAM_BUSINESSTATS_TOKEN!;
const OPS_CHAT   = process.env.TELEGRAM_OPS_CHAT_ID!;

async function post(text: string) {
  await fetch(`https://api.telegram.org/bot${TOKEN}/sendMessage`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ chat_id: OPS_CHAT, text, parse_mode: 'HTML', disable_web_page_preview: true }),
  });
}

export async function sendDailyDigest() {
  const date = new Date().toLocaleDateString('en-GB', { weekday: 'long', day: 'numeric', month: 'short' });
  await post(`${b(`☀️ Daily Digest — ${date}`)}\n\n⏳ Fetching...`);

  const [users, revenue, trades, sentry, posthog] = await Promise.allSettled([
    getUserMetrics(),
    getRevenueMetrics(),
    getTradeMetrics(),
    getSentryMetrics(),
    getPostHogMetrics(),
  ]);

  const sections: string[] = [];

  if (users.status === 'fulfilled') {
    const m = users.value;
    sections.push([
      b('👥 Users'),
      `Total: ${b(m.total)}  •  Active 30d: ${b(m.active30d)}`,
      `New today: ${b(m.today)}  •  Waitlist: ${b(m.waitlist)}`,
    ].join('\n'));
  } else {
    sections.push(`${b('👥 Users')} — ❌ ${users.reason}`);
  }

  if (revenue.status === 'fulfilled') {
    const m = revenue.value;
    const sym = m.currency === 'GBP' ? '£' : m.currency + ' ';
    sections.push([
      b('💰 Revenue'),
      `MRR: ${b(`${sym}${m.mrr.toFixed(2)}`)}  •  Active subs: ${b(m.activeCount)}`,
      `New this week: ${b(m.newThisWeek)}  •  Churned: ${b(m.churnedThisWeek)}`,
    ].join('\n'));
  } else {
    sections.push(`${b('💰 Revenue')} — ❌ ${revenue.reason}`);
  }

  if (trades.status === 'fulfilled') {
    const m = trades.value;
    sections.push([
      b('📈 Trades'),
      `Total: ${b(m.total)}  •  Today: ${b(m.today)}  •  Last 7d: ${b(m.last7d)}`,
    ].join('\n'));
  }

  if (sentry.status === 'fulfilled' && sentry.value) {
    const m = sentry.value;
    sections.push([
      b('🚨 Errors (24h)'),
      `${b(m.errorCount24h)} events  •  ${b(m.issues.length)} unresolved issues`,
    ].join('\n'));
  }

  if (posthog.status === 'fulfilled' && posthog.value) {
    const m = posthog.value;
    sections.push([
      b('📊 Usage'),
      `DAU: ${b(m.dau)}  •  WAU: ${b(m.wau)}`,
    ].join('\n'));
  }

  await post(sections.join('\n\n'));
}
```

- [ ] **Step 2: Extend `api/cron.ts` — add `daily-digest` branch**

In the router function at the bottom of `api/cron.ts`, find:
```typescript
  if (job === 'sync')                return handleSync(req, res);
```

Add immediately after:
```typescript
  if (job === 'daily-digest') {
    if (!isCronAuthed(req)) return res.status(401).json({ error: 'Unauthorized' });
    const { sendDailyDigest } = await import('./lib/metrics/digest.js');
    await sendDailyDigest();
    return res.status(200).json({ ok: true });
  }
```

- [ ] **Step 3: Update `vercel.json` — add digest cron**

In the `crons` array, add:
```json
{ "path": "/api/cron?job=daily-digest", "schedule": "0 7 * * *" }
```

- [ ] **Step 4: Wire `/digest` manual trigger into `api/businesstats.ts`**

Add import:
```typescript
import { sendDailyDigest } from './lib/metrics/digest.js';
```

Add case:
```typescript
      case '/digest': {
        await sendMessage(chatId, '⏳ Running digest...');
        await sendDailyDigest();
        break;
      }
```

- [ ] **Step 5: Commit**

```bash
git add api/lib/metrics/digest.ts api/cron.ts vercel.json api/businesstats.ts
git commit -m "feat: add /digest command and daily cron at 07:00 UTC"
```

---

## Task 9: Env vars + docs

**Files:**
- Modify: `.env.example`
- Create: `docs/BUSINESSTATS_BOT.md`

- [ ] **Step 1: Append to `.env.example`**

```env
# ─── Businesstats Bot ─────────────────────────────────────────────────────────
# Token for businesstats_bot (from BotFather)
TELEGRAM_BUSINESSTATS_TOKEN=

# Shared secret between Vercel and Telegram — must match setWebhook secret_token param
# Generate: node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
TELEGRAM_BUSINESSTATS_SECRET=

# Comma-separated numeric Telegram user IDs allowed to use the bot
# Get IDs by messaging @userinfobot on Telegram
# Add Dan's ID here when he provides it
TELEGRAM_ALLOWED_USER_IDS=7587404723,1711954101

# The internal team group chat ID (and where digest posts)
TELEGRAM_OPS_CHAT_ID=-5275164414

# PostHog — personal API key (NOT the project key used by the browser SDK)
# PostHog → Settings → Personal API Keys → Create Key (read scope is enough)
POSTHOG_PERSONAL_API_KEY=

# PostHog project numeric ID — visible in the URL: app.posthog.com/project/XXXXX/
POSTHOG_PROJECT_ID=

# Sentry auth token with project:read scope
# Sentry → Settings → Auth Tokens → Create Token
SENTRY_AUTH_TOKEN=

# Sentry org slug — visible in URL: sentry.io/organizations/YOUR-SLUG/
SENTRY_ORG=

# Sentry project slug — visible in URL: sentry.io/organizations/{org}/projects/YOUR-PROJECT/
SENTRY_PROJECT=
```

- [ ] **Step 2: Create `docs/BUSINESSTATS_BOT.md`**

```markdown
# Businesstats Bot — Setup & Deployment

Internal Telegram bot for Kōda ops metrics. Auth-gated to whitelisted Telegram
user IDs only. Never respond to requests to make it public.

## 1. Add env vars to Vercel

Add all vars from the `─── Businesstats Bot ───` block in `.env.example` to
Vercel → Settings → Environment Variables (Production + Preview).

Generate the webhook secret:
```sh
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```

Token for key `TELEGRAM_BUSINESSTATS_TOKEN` is the businesstats_bot token from BotFather.

| Var | Where to find it |
|-----|-----------------|
| `POSTHOG_PERSONAL_API_KEY` | PostHog → Settings → Personal API Keys → Create |
| `POSTHOG_PROJECT_ID` | PostHog URL: `/project/XXXXX/...` (the number) |
| `SENTRY_AUTH_TOKEN` | Sentry → Settings → Auth Tokens → Create Token |
| `SENTRY_ORG` | Sentry URL slug: `sentry.io/organizations/YOUR-SLUG/` |
| `SENTRY_PROJECT` | Sentry project slug in the projects list |

## 2. Deploy to Vercel

```sh
vercel --prod
```

Note the production domain (e.g. `https://kodatrade.co.uk`).

## 3. Register the webhook

Replace `TOKEN`, `SECRET`, and `DOMAIN` with your values:

```sh
curl "https://api.telegram.org/botTOKEN/setWebhook?url=https://DOMAIN/api/businesstats&secret_token=SECRET&allowed_updates=%5B%22message%22%5D"
```

Expected: `{"ok":true,"result":true,"description":"Webhook was set"}`

Verify:
```sh
curl "https://api.telegram.org/botTOKEN/getWebhookInfo"
```

## 4. Add bot to group

1. Open the internal team group in Telegram
2. Group name → Add Members → search `@businesstats_bot` → Add

## 5. Verify

Type `/help` in the group. The bot should reply with the command menu and show
which integrations are live (✅) vs not configured (❌).

## 6. Adding Dan's Telegram ID

When Dan shares his ID, update `TELEGRAM_ALLOWED_USER_IDS` in Vercel:
```
7587404723,1711954101,DAN_ID_HERE
```
Redeploy. No code change required.

## Daily digest

Auto-posts at **07:00 UTC** daily via Vercel Cron (`/api/cron?job=daily-digest`).
Trigger manually at any time with `/digest` in the group.
```

- [ ] **Step 3: Commit**

```bash
git add .env.example docs/BUSINESSTATS_BOT.md
git commit -m "docs: businesstats bot env vars and setup guide"
```

---

## Task 10: Auth-gate existing admin bot

The existing `api/telegram.ts` hardcodes `ADMIN_TELEGRAM_ID = 7587404723` (Dylon only).
Update it to use the shared `TELEGRAM_ALLOWED_USER_IDS` env var so Bruno is also allowed.

**Files:**
- Modify: `api/telegram.ts`

- [ ] **Step 1: Replace the hardcoded ID check in `api/telegram.ts`**

Find line 14:
```typescript
const ADMIN_TELEGRAM_ID = 7587404723;
```

Replace with:
```typescript
const ADMIN_IDS = new Set(
  (process.env.TELEGRAM_ALLOWED_USER_IDS ?? '7587404723')
    .split(',')
    .map(s => parseInt(s.trim(), 10))
    .filter(n => !isNaN(n) && n > 0),
);
```

Find line 73:
```typescript
  if (!msg?.text || msg.from?.id !== ADMIN_TELEGRAM_ID) return res.status(200).json({ ok: true });
```

Replace with:
```typescript
  if (!msg?.text || !ADMIN_IDS.has(msg.from?.id ?? 0)) return res.status(200).json({ ok: true });
```

- [ ] **Step 2: Run all tests**

```bash
npx vitest run
```
Expected: all pass (no changes to existing test surface)

- [ ] **Step 3: Commit**

```bash
git add api/telegram.ts
git commit -m "feat: allow all whitelisted users in existing admin bot"
```

---

## Self-Review vs Spec

| Requirement | Covered |
|---|---|
| Total + active users, new signups today/7d/30d | ✅ Task 2 |
| Beta waitlist count | ✅ Task 2 |
| Revenue/MRR, new vs churned, WoW delta | ✅ Task 4 |
| Sentry: latest unresolved issues, count/rate, links | ✅ Task 5 |
| PostHog: DAU/WAU, key event counts | ✅ Task 6 |
| Daily auto-digest (07:00 UTC) | ✅ Task 8 |
| Auth gate — user ID + chat ID whitelist | ✅ Task 1 |
| All secrets via env vars, .env.example | ✅ Tasks 1, 9 |
| Graceful degradation for Sentry/PostHog | ✅ Tasks 5, 6 (return null + message) |
| Webhook on Vercel (justified) | ✅ Architecture section |
| README | ✅ Task 9 |
| Incremental build | ✅ Task order |
| Additional: /trades, /health, /user | ✅ Tasks 3, 7 |
| Auth gate existing admin bot | ✅ Task 10 |
| Dan's ID placeholder | ✅ .env.example comment + README §6 |

**Open item:** Dan's Telegram ID unknown — added to env var comment and README as a config-only change requiring no code edit.
