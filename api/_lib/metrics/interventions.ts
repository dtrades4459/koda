import { b } from '../telegram/format.js';

// The pre-trade wedge verdict, from PostHog. The `source` + `choice` props live
// on the `intervention_fired` event (PostHog-only — not in the DB row), so the
// session-vs-log split can only come from here.
//   choice: "cancelled" = chose the cooldown (the win)  ·  "continued" = traded on
export interface WedgeMetrics {
  sessionsStarted: number;
  fired: number;
  cancelled: number;
  continued: number;
  pctCancelled: number | null;   // null when nothing fired yet
  windowDays: number;
}

interface EventProp { key: string; value: string; operator: 'exact'; type: 'event' }

export async function getWedgeMetrics(windowDays = 30): Promise<WedgeMetrics | null> {
  const apiKey    = process.env.POSTHOG_PERSONAL_API_KEY;
  const projectId = process.env.POSTHOG_PROJECT_ID;
  if (!apiKey || !projectId) return null;

  const host    = (process.env.POSTHOG_HOST ?? 'https://us.posthog.com').replace(/\/$/, '');
  const headers = { Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json' };
  const dateFrom = `-${windowDays}d`;

  async function totalFor(event: string, properties: EventProp[]): Promise<number> {
    const res = await fetch(`${host}/api/projects/${projectId}/query/`, {
      method: 'POST',
      headers,
      body: JSON.stringify({
        query: {
          kind: 'TrendsQuery',
          series: [{ kind: 'EventsNode', event, math: 'total', properties }],
          dateRange: { date_from: dateFrom },
          interval: 'day',
        },
      }),
    });
    if (!res.ok) throw new Error(`PostHog query ${res.status}`);
    const json = (await res.json()) as { results: { data: number[] }[] };
    return (json.results[0]?.data ?? []).reduce((a, n) => a + n, 0);
  }

  const SESSION: EventProp = { key: 'source', value: 'session', operator: 'exact', type: 'event' };

  try {
    const [sessionsStarted, cancelled, continued] = await Promise.all([
      totalFor('session_started', []),
      totalFor('intervention_fired', [SESSION, { key: 'choice', value: 'cancelled', operator: 'exact', type: 'event' }]),
      totalFor('intervention_fired', [SESSION, { key: 'choice', value: 'continued', operator: 'exact', type: 'event' }]),
    ]);
    const fired = cancelled + continued;
    return {
      sessionsStarted,
      fired,
      cancelled,
      continued,
      pctCancelled: fired > 0 ? Math.round((cancelled / fired) * 100) : null,
      windowDays,
    };
  } catch (err) {
    console.error('getWedgeMetrics error:', err);
    return null;
  }
}

export function formatWedgeMetrics(m: WedgeMetrics): string {
  const verdict = m.pctCancelled === null
    ? 'No interventions fired yet — arm a session and tilt to test it.'
    : `${b(`${m.pctCancelled}%`)} chose the cooldown (${m.cancelled} stopped / ${m.continued} traded on)`;

  return [
    b('🛡️ Pre-Trade Wedge'),
    `Window: last ${m.windowDays}d (source=session)`,
    '',
    `Sessions armed: ${b(m.sessionsStarted)}`,
    `Interventions fired: ${b(m.fired)}`,
    '',
    b('Day-30 verdict — % cancelled'),
    `  ${verdict}`,
  ].join('\n');
}
