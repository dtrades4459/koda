import { getAdminClient } from '../supabaseAdmin.js';
import { b } from '../telegram/format.js';

// Governing metric: day-21 logging rate of the cohort. Computed in SQL by the
// get_retention_stats() RPC (migration 20260618_retention_stats_fn.sql).
export interface RetentionMetrics {
  cohort: number;     // users old enough to have reached day 21
  retained: number;   // of those, still logging in the last 7 days
  rate: number | null;
}

export async function getRetentionMetrics(): Promise<RetentionMetrics> {
  const db = getAdminClient();
  const { data, error } = await db.rpc('get_retention_stats');
  if (error) throw new Error(`get_retention_stats: ${error.message}`);
  const d = data as Record<string, number | null>;
  return {
    cohort:   (d.cohort as number) ?? 0,
    retained: (d.retained as number) ?? 0,
    rate:     d.rate === null || d.rate === undefined ? null : Number(d.rate),
  };
}

export function formatRetentionMetrics(m: RetentionMetrics): string {
  const headline = m.cohort === 0
    ? 'No cohort old enough yet (need users ≥21 days in).'
    : `${b(`${m.rate}%`)} still logging at week 3+ (${m.retained}/${m.cohort})`;

  return [
    b('🔁 Day-21 Retention'),
    'Cohort: users ≥21d old · retained = logged a trade in last 7d',
    '',
    `  ${headline}`,
    m.cohort > 0 && m.cohort < 10 ? `\n  ⚠️ small cohort (${m.cohort}) — read as directional, not statistical.` : '',
  ].filter(Boolean).join('\n');
}
