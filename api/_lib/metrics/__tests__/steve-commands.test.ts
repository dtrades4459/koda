// @vitest-environment node
import { describe, it, expect } from 'vitest';
import { buildSteps, formatFunnelMetrics } from '../funnel.js';
import { formatWedgeMetrics, type WedgeMetrics } from '../interventions.js';
import { formatRetentionMetrics, type RetentionMetrics } from '../retention.js';

describe('funnel buildSteps', () => {
  it('computes survival % from the top and from the previous step', () => {
    const steps = buildSteps([100, 60, 30, 24, 12, 6]);
    expect(steps[0]).toMatchObject({ count: 100, pctOfTop: 100, pctOfPrev: 100 });
    expect(steps[1]).toMatchObject({ count: 60, pctOfTop: 60, pctOfPrev: 60 });
    expect(steps[2]).toMatchObject({ count: 30, pctOfTop: 30, pctOfPrev: 50 });
    expect(steps[5]).toMatchObject({ count: 6, pctOfTop: 6, pctOfPrev: 50 });
  });

  it('does not divide by zero when the top step is empty', () => {
    const steps = buildSteps([0, 0, 0, 0, 0, 0]);
    expect(steps.every(s => s.pctOfTop === 0 && s.pctOfPrev === 0)).toBe(true);
  });

  it('labels all six funnel steps', () => {
    expect(buildSteps([1, 1, 1, 1, 1, 1]).map(s => s.label)).toEqual([
      'Landed', 'Clicked CTA', 'Signed up', 'Onboarded', 'Imported CSV', 'Returned day 2',
    ]);
  });
});

describe('formatWedgeMetrics', () => {
  it('shows the % cancelled verdict when interventions fired', () => {
    const m: WedgeMetrics = { sessionsStarted: 12, fired: 5, cancelled: 3, continued: 2, pctCancelled: 60, windowDays: 30 };
    const out = formatWedgeMetrics(m);
    expect(out).toContain('60%');
    expect(out).toContain('3 stopped / 2 traded on');
  });

  it('handles the no-fires-yet case without NaN', () => {
    const m: WedgeMetrics = { sessionsStarted: 2, fired: 0, cancelled: 0, continued: 0, pctCancelled: null, windowDays: 30 };
    expect(formatWedgeMetrics(m)).toContain('No interventions fired yet');
  });
});

describe('formatRetentionMetrics', () => {
  it('renders the rate and cohort', () => {
    const m: RetentionMetrics = { cohort: 20, retained: 9, rate: 45 };
    const out = formatRetentionMetrics(m);
    expect(out).toContain('45%');
    expect(out).toContain('9/20');
  });

  it('warns on a small cohort and handles an empty cohort', () => {
    expect(formatRetentionMetrics({ cohort: 4, retained: 1, rate: 25 })).toContain('small cohort');
    expect(formatRetentionMetrics({ cohort: 0, retained: 0, rate: null })).toContain('No cohort old enough');
  });
});

describe('formatFunnelMetrics', () => {
  it('renders steps with drop-off arrows', () => {
    const out = formatFunnelMetrics({ windowDays: 14, steps: buildSteps([100, 50, 25, 20, 10, 5]) });
    expect(out).toContain('Landed');
    expect(out).toContain('Returned day 2');
    expect(out).toContain('↓');
  });
});
