import { b } from '../telegram/format.js';

// Acquisition→activation funnel. Event names verified against the frontend
// phCapture calls (src/). Ordered conversion within a 14-day window.
const FUNNEL_STEPS: { event: string; label: string }[] = [
  { event: 'landing_page_viewed', label: 'Landed' },
  { event: 'landing_cta_clicked', label: 'Clicked CTA' },
  { event: 'signed_up',           label: 'Signed up' },
  { event: 'onboarding_complete', label: 'Onboarded' },
  { event: 'csv_imported',        label: 'Imported CSV' },
  { event: 'app_opened_day2',     label: 'Returned day 2' },
];

export interface FunnelStep {
  label: string;
  count: number;
  pctOfTop: number;     // % surviving from step 1
  pctOfPrev: number;    // % surviving from the previous step
}

export interface FunnelMetrics {
  steps: FunnelStep[];
  windowDays: number;
}

export async function getFunnelMetrics(windowDays = 14): Promise<FunnelMetrics | null> {
  const apiKey    = process.env.POSTHOG_PERSONAL_API_KEY;
  const projectId = process.env.POSTHOG_PROJECT_ID;
  if (!apiKey || !projectId) return null;

  const host    = (process.env.POSTHOG_HOST ?? 'https://us.posthog.com').replace(/\/$/, '');
  const headers = { Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json' };

  try {
    const res = await fetch(`${host}/api/projects/${projectId}/query/`, {
      method: 'POST',
      headers,
      body: JSON.stringify({
        query: {
          kind: 'FunnelsQuery',
          series: FUNNEL_STEPS.map(s => ({ kind: 'EventsNode', event: s.event })),
          dateRange: { date_from: `-${windowDays}d` },
          funnelsFilter: { funnelWindowInterval: windowDays, funnelWindowIntervalUnit: 'day' },
        },
      }),
    });
    if (!res.ok) throw new Error(`PostHog funnel ${res.status}`);
    const json = (await res.json()) as { results: { count: number }[] };
    const counts = FUNNEL_STEPS.map((_, i) => json.results[i]?.count ?? 0);
    return { steps: buildSteps(counts), windowDays };
  } catch (err) {
    console.error('getFunnelMetrics error:', err);
    return null;
  }
}

/** Pure: turn raw per-step counts into survival percentages. */
export function buildSteps(counts: number[]): FunnelStep[] {
  const top = counts[0] ?? 0;
  return counts.map((count, i) => {
    const prev = i === 0 ? count : counts[i - 1];
    return {
      label:    FUNNEL_STEPS[i]?.label ?? `Step ${i + 1}`,
      count,
      pctOfTop:  top  > 0 ? Math.round((count / top)  * 100) : 0,
      pctOfPrev: prev > 0 ? Math.round((count / prev) * 100) : 0,
    };
  });
}

export function formatFunnelMetrics(m: FunnelMetrics): string {
  const lines = m.steps.map((s, i) =>
    i === 0
      ? `  ${s.label}: ${b(s.count)}`
      : `  ↓ ${s.pctOfPrev}%\n  ${s.label}: ${b(s.count)} (${s.pctOfTop}% of top)`,
  );
  return [
    b('🫧 Funnel'),
    `Window: last ${m.windowDays}d`,
    '',
    ...lines,
  ].join('\n');
}
