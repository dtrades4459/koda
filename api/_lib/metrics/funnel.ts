import { b } from '../telegram/format.js';

type Step = { event: string; label: string };

// Acquisition→activation funnel. Event names verified against the frontend
// phCapture calls (src/). Ordered conversion within a 14-day window.
//
// Bottom step is `returned_active` (came back on ANY later day within 2 weeks),
// NOT `app_opened_day2`: Kōda is a bursty-use product — a discretionary futures
// trader returns 2–4×/week, not daily — so a strict calendar-day-2 return
// undercounts real retention. See the activation-insight note.
const FUNNEL_STEPS: Step[] = [
  { event: 'landing_page_viewed', label: 'Landed' },
  { event: 'landing_cta_clicked', label: 'Clicked CTA' },
  { event: 'signed_up',           label: 'Signed up' },
  { event: 'onboarding_complete', label: 'Onboarded' },
  { event: 'csv_imported',        label: 'Imported CSV' },
  { event: 'returned_active',     label: 'Returned (wk1)' },
];

// Revenue / paid-conversion funnel. paywall_viewed + checkout_started fire
// client-side; subscription_activated fires server-side from the Stripe webhook
// (api/stripe.ts), distinct_id = uid so the three connect. 30-day window — the
// decision to pay lags activation. Reported alongside /funnel.
const REVENUE_STEPS: Step[] = [
  { event: 'paywall_viewed',         label: 'Saw paywall' },
  { event: 'checkout_started',       label: 'Started checkout' },
  { event: 'subscription_activated', label: 'Subscribed' },
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

/** Run an ordered PostHog funnel for an arbitrary set of steps. */
async function runFunnel(steps: Step[], windowDays: number): Promise<FunnelMetrics | null> {
  const apiKey    = process.env.POSTHOG_PERSONAL_API_KEY;
  const projectId = process.env.POSTHOG_PROJECT_ID;
  if (!apiKey || !projectId) return null;

  // Project is on PostHog EU — default the REST host to eu.posthog.com.
  const host    = (process.env.POSTHOG_HOST ?? 'https://eu.posthog.com').replace(/\/$/, '');
  const headers = { Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json' };

  try {
    const res = await fetch(`${host}/api/projects/${projectId}/query/`, {
      method: 'POST',
      headers,
      body: JSON.stringify({
        query: {
          kind: 'FunnelsQuery',
          series: steps.map(s => ({ kind: 'EventsNode', event: s.event })),
          dateRange: { date_from: `-${windowDays}d` },
          funnelsFilter: { funnelWindowInterval: windowDays, funnelWindowIntervalUnit: 'day' },
        },
      }),
    });
    if (!res.ok) throw new Error(`PostHog funnel ${res.status}`);
    const json = (await res.json()) as { results: { count: number }[] };
    const counts = steps.map((_, i) => json.results[i]?.count ?? 0);
    return { steps: buildSteps(counts, steps), windowDays };
  } catch (err) {
    console.error('runFunnel error:', err);
    return null;
  }
}

/** Acquisition → activation funnel (14-day window). */
export function getFunnelMetrics(windowDays = 14): Promise<FunnelMetrics | null> {
  return runFunnel(FUNNEL_STEPS, windowDays);
}

/** Paid-conversion funnel: paywall → checkout → subscribed (30-day window). */
export function getRevenueFunnelMetrics(windowDays = 30): Promise<FunnelMetrics | null> {
  return runFunnel(REVENUE_STEPS, windowDays);
}

/** Pure: turn raw per-step counts into survival percentages. */
export function buildSteps(counts: number[], steps: Step[] = FUNNEL_STEPS): FunnelStep[] {
  const top = counts[0] ?? 0;
  return counts.map((count, i) => {
    const prev = i === 0 ? count : counts[i - 1];
    return {
      label:    steps[i]?.label ?? `Step ${i + 1}`,
      count,
      pctOfTop:  top  > 0 ? Math.round((count / top)  * 100) : 0,
      pctOfPrev: prev > 0 ? Math.round((count / prev) * 100) : 0,
    };
  });
}

export function formatFunnelMetrics(m: FunnelMetrics, title = '🫧 Funnel'): string {
  const lines = m.steps.map((s, i) =>
    i === 0
      ? `  ${s.label}: ${b(s.count)}`
      : `  ↓ ${s.pctOfPrev}%\n  ${s.label}: ${b(s.count)} (${s.pctOfTop}% of top)`,
  );
  return [
    b(title),
    `Window: last ${m.windowDays}d`,
    '',
    ...lines,
  ].join('\n');
}
