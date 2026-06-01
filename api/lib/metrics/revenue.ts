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
