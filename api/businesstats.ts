export const config = { runtime: 'nodejs' };

type Req = { method?: string; headers: Record<string, string | string[] | undefined>; body: Record<string, unknown> };
type Res = { status(n: number): Res; json(d: unknown): Res; end(): void };

import { timingSafeEqual } from 'crypto';
import { isAuthorized, getChatId, logDropDiagnostic, type TelegramUpdate } from './_lib/telegram/auth.js';
import Stripe from 'stripe';
import { getAdminClient } from './_lib/supabaseAdmin.js';
import { b, code } from './_lib/telegram/format.js';
import { getUserMetrics, formatUserMetrics } from './_lib/metrics/users.js';
import { getTradeMetrics, formatTradeMetrics } from './_lib/metrics/trades.js';
import { getRevenueMetrics, formatRevenueMetrics } from './_lib/metrics/revenue.js';
import { getSentryMetrics, formatSentryMetrics } from './_lib/metrics/errors.js';
import { getPostHogMetrics, formatPostHogMetrics } from './_lib/metrics/analytics.js';
import { getWedgeMetrics, formatWedgeMetrics } from './_lib/metrics/interventions.js';
import { getFunnelMetrics, getRevenueFunnelMetrics, formatFunnelMetrics } from './_lib/metrics/funnel.js';
import { getRetentionMetrics, formatRetentionMetrics } from './_lib/metrics/retention.js';
import { sendDailyDigest } from './_lib/metrics/digest.js';

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
    '/today — one-tap morning snapshot',
    '',
    b('Business'),
    '/users — signups + active users',
    '/waitlist — beta waitlist count',
    '/revenue — MRR, subs, churn',
    '/trades — trade volume + activity',
    '',
    b('Wedge & funnel'),
    '/wedge — pre-trade intervention verdict (% cancelled)',
    '/funnel — landing → signup → CSV → day-2 survival',
    '/retention — day-21 logging rate of the cohort',
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
    await new Stripe(process.env.STRIPE_SECRET_KEY ?? '', { apiVersion: '2025-05-28.basil' as any }).balance.retrieve();
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

async function handleUserLookup(chatId: number, email: string) {
  if (!email || !email.includes('@')) {
    await sendMessage(chatId, '❌ Usage: /user email@example.com');
    return;
  }

  const db = getAdminClient();

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
  const name      = profileRes.data?.name ?? '—';
  const signedUp  = new Date(user.created_at).toLocaleDateString('en-GB');
  const trades    = tradeRes.count ?? 0;
  const onboarded = profileRes.data?.onboarded ? 'Yes' : 'No';

  await sendMessage(chatId, [
    b('👤 User Lookup'),
    `Email: ${code(email)}`,
    `Handle: @${handle}`,
    `Name: ${name}`,
    `Plan: ${b(plan)}`,
    `Signed up: ${signedUp}`,
    `Trades logged: ${b(trades)}`,
    `Onboarded: ${onboarded}`,
  ].join('\n'));
}

// One-tap morning snapshot — the essentials in a single message so you don't
// fire four commands. Each block degrades gracefully if its integration is off.
async function handleToday(chatId: number) {
  const [users, revenue, sentry, wedge] = await Promise.all([
    getUserMetrics().catch(() => null),
    getRevenueMetrics().catch(() => null),
    getSentryMetrics().catch(() => null),
    getWedgeMetrics().catch(() => null),
  ]);

  const lines: string[] = [b('☀️ Kōda — Today'), ''];
  if (users)   lines.push(`👥 Users: ${b(users.total)} total · ${b(users.today)} new today · ${b(users.active30d)} active 30d`);
  if (revenue) {
    const sym = revenue.currency === 'GBP' ? '£' : revenue.currency === 'USD' ? '$' : revenue.currency + ' ';
    lines.push(`💷 MRR: ${b(`${sym}${revenue.mrr.toFixed(2)}`)} · ${b(revenue.activeCount)} subs`);
  }
  if (sentry)  lines.push(`🚨 Errors 24h: ${b(sentry.errorCount24h)} · ${b(sentry.issues.length)} unresolved`);
  else         lines.push('🚨 Errors: ❌ Sentry not configured');
  if (wedge)   lines.push(`🛡️ Wedge: ${b(wedge.sessionsStarted)} sessions · ${b(wedge.fired)} fired · ${wedge.pctCancelled === null ? 'n/a' : b(`${wedge.pctCancelled}% cancelled`)}`);
  else         lines.push('🛡️ Wedge: ❌ PostHog not configured');
  lines.push('', 'Detail: /users /revenue /errors /wedge /funnel /retention');

  await sendMessage(chatId, lines.join('\n'));
}

export default async function handler(req: Req, res: Res) {
  if (req.method !== 'POST') return res.status(405).end();

  const secret = req.headers['x-telegram-bot-api-secret-token'] as string | undefined;
  const incoming = Buffer.from(secret ?? '', 'utf8');
  const expected = Buffer.from(SECRET, 'utf8');
  if (incoming.length !== expected.length || !timingSafeEqual(incoming, expected)) {
    return res.status(401).end();
  }

  const update = req.body as unknown as TelegramUpdate;
  if (!isAuthorized(update)) {
    logDropDiagnostic(update);   // surfaces a stale TELEGRAM_OPS_CHAT_ID (e.g. after a Topics→supergroup upgrade)
    return res.status(200).end();
  }

  const text    = update.message?.text ?? '';
  const chatId  = getChatId(update);
  const command = text.split(' ')[0].toLowerCase().replace(/@\w+$/, '');

  try {
    switch (command) {
      case '/start':
      case '/help':
        await handleHelp(chatId);
        break;
      case '/users':
      case '/waitlist': {
        await sendMessage(chatId, '⏳ Fetching...');
        const m = await getUserMetrics();
        await sendMessage(chatId, formatUserMetrics(m));
        break;
      }
      case '/trades': {
        await sendMessage(chatId, '⏳ Fetching...');
        const m = await getTradeMetrics();
        await sendMessage(chatId, formatTradeMetrics(m));
        break;
      }
      case '/revenue': {
        await sendMessage(chatId, '⏳ Fetching...');
        const m = await getRevenueMetrics();
        await sendMessage(chatId, formatRevenueMetrics(m));
        break;
      }
      case '/errors': {
        await sendMessage(chatId, '⏳ Fetching...');
        const m = await getSentryMetrics();
        if (!m) {
          await sendMessage(chatId, '❌ Sentry unavailable — check SENTRY_AUTH_TOKEN, SENTRY_ORG, SENTRY_PROJECT in Vercel env, or Sentry may be unreachable.');
          break;
        }
        await sendMessage(chatId, formatSentryMetrics(m));
        break;
      }
      case '/analytics': {
        await sendMessage(chatId, '⏳ Fetching...');
        const m = await getPostHogMetrics();
        if (!m) {
          await sendMessage(chatId, '❌ PostHog unavailable — check POSTHOG_PERSONAL_API_KEY and POSTHOG_PROJECT_ID in Vercel env.');
          break;
        }
        await sendMessage(chatId, formatPostHogMetrics(m));
        break;
      }
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
      case '/digest': {
        await sendMessage(chatId, '⏳ Running digest...');
        await sendDailyDigest();
        break;
      }
      case '/wedge':
      case '/intervention': {
        await sendMessage(chatId, '⏳ Fetching...');
        const m = await getWedgeMetrics();
        if (!m) {
          await sendMessage(chatId, '❌ PostHog unavailable — check POSTHOG_PERSONAL_API_KEY and POSTHOG_PROJECT_ID in Vercel env.');
          break;
        }
        await sendMessage(chatId, formatWedgeMetrics(m));
        break;
      }
      case '/funnel': {
        await sendMessage(chatId, '⏳ Fetching...');
        const m = await getFunnelMetrics();
        if (!m) {
          await sendMessage(chatId, '❌ PostHog unavailable — check POSTHOG_PERSONAL_API_KEY and POSTHOG_PROJECT_ID in Vercel env.');
          break;
        }
        await sendMessage(chatId, formatFunnelMetrics(m, '🫧 Activation funnel'));
        const rev = await getRevenueFunnelMetrics();
        if (rev) await sendMessage(chatId, formatFunnelMetrics(rev, '💷 Revenue funnel'));
        break;
      }
      case '/retention': {
        await sendMessage(chatId, '⏳ Fetching...');
        const m = await getRetentionMetrics();
        await sendMessage(chatId, formatRetentionMetrics(m));
        break;
      }
      case '/today': {
        await sendMessage(chatId, '⏳ Building snapshot...');
        await handleToday(chatId);
        break;
      }
    }
  } catch (err) {
    console.error('businesstats bot error:', err);
    await sendMessage(chatId, '❌ Internal error — check Vercel logs.');
  }

  return res.status(200).end();
}
