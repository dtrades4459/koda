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

  const host    = (process.env.POSTHOG_HOST ?? 'https://us.posthog.com').replace(/\/$/, '');
  const headers = { Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json' };

  async function trend(series: object[], dateFrom: string, interval: string) {
    const res = await fetch(`${host}/api/projects/${projectId}/query/`, {
      method: 'POST',
      headers,
      body: JSON.stringify({
        query: {
          kind: 'TrendsQuery',
          series: (series as Record<string, unknown>[]).map(s => ({ kind: 'EventsNode', ...s })),
          dateRange: { date_from: dateFrom },
          interval,
        },
      }),
    });
    if (!res.ok) throw new Error(`PostHog query ${res.status}`);
    return (await res.json()) as { results: { data: number[]; action?: { name: string } }[] };
  }

  try {
    const [dauRes, wauRes, eventsRes] = await Promise.all([
      trend([{ event: '$pageview', math: 'dau' }], '-1d', 'day'),
      trend([{ event: '$pageview', math: 'dau' }], '-7d', 'week'),
      trend([
        { event: 'trade_logged',   math: 'total' },
        { event: 'user_signed_up', math: 'total' },
        { event: '$pageview',      math: 'total' },
      ], '-7d', 'day'),
    ]);

    const lastOf = (arr: number[]) => arr.at(-1) ?? 0;
    const sumOf  = (arr: number[]) => arr.reduce((a, n) => a + n, 0);

    const topEvents = eventsRes.results
      .map(r => ({ name: r.action?.name ?? 'unknown', count: sumOf(r.data) }))
      .sort((a, z) => z.count - a.count);

    return {
      dau:       lastOf(dauRes.results[0]?.data ?? []),
      wau:       lastOf(wauRes.results[0]?.data ?? []),
      topEvents,
    };
  } catch (err) {
    console.error('getPostHogMetrics error:', err);
    return null;
  }
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
