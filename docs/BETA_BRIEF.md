# Kōda Beta — What You Need to Know

Thanks for being here early. This is a closed beta — your feedback directly shapes the product.

---

## What Kōda is

A trading journal built for retail traders who want to understand *why* they win and lose, not just track P&L. Log trades, tag your emotions and rule adherence, join circles with other traders, and get weekly report cards on your discipline.

---

## What to test

These are the core flows — please try all of them:

- **Log a trade** — manual entry from the home screen. Try tagging emotion, rule adherence (Y/N), and a mistake if you have one.
- **CSV import** — Settings → Sync from CSV. Supported brokers: Tradovate, NinjaTrader 8, MetaTrader 4/5, TradeStation, Quantower, Rithmic. If yours isn't listed, let me know.
- **Calendar view** — P&L by day, toggle between R-multiple and dollar view.
- **Strategies** — create a strategy, tag trades to it, check the breakdown.
- **Circles** — join the global Kōda circle or create your own. Try the leaderboard and chat.
- **Weekly Report Card** — only shows after you have a week of trades logged.
- **Discipline Score Card** — tracks rule adherence and consistency over time.
- **Upgrade flow** — you don't need to actually pay, but tap through to the paywall and confirm it loads correctly.

---

## What is deliberately limited right now

**Live broker sync** — the Data Sources screen shows this as Coming Soon. Manual CSV import is the supported path for beta. Live sync is in active development.

**Review Inbox** — if you use Tradovate CSV import, synced trades may land as drafts pending review. The inbox badge will show a count; the review UI is coming in the next sprint.

**Mobile PWA** — install Kōda to your home screen (Safari on iOS: Share → Add to Home Screen; Chrome on Android: browser menu → Add to Home Screen) for the full app experience. It works in a browser tab but is designed as a PWA.

---

## Expected rough edges

- First load after a long gap may be slow (free Supabase tier, being resolved before public launch)
- Some animations may stutter on older Android devices
- Stack traces in error reports are minified until source maps are re-enabled

---

## How to report bugs

Hit the **feedback button** in the app (Settings → Send feedback). It goes straight to me with your name and handle attached so I can follow up directly. Aim for: what you were doing, what you expected, what actually happened.

For anything urgent: DM [@dylon.trades](https://instagram.com/dylon.trades) on Instagram.

---

## Plans

Kōda has a free tier with core journaling features. Pro (£24.99/mo or £199/yr) unlocks Prop Firm Mode, live trade card streaming to circles, and upcoming features.

**As a beta tester, you get Pro free.** Use code **`BETA_26`** at checkout — it discounts the plan to £0 for the full beta window. Steps:

1. In the app, tap your avatar → **Upgrade to Pro** (or hit any Pro-gated feature)
2. On the paywall, choose **Monthly** or **Yearly** and tap **Continue**
3. On the Stripe checkout page, click **Add promotion code** and paste `BETA_26`
4. The total should drop to £0.00 — complete the checkout (no card charge)
5. You're back in the app on Pro. Confirm by checking the **Pro** badge in Settings

If the code doesn't apply or the total isn't £0, screenshot the checkout page and send it to me — that's a bug worth knowing about.

---

## What I need from you

1. Try to break the CSV import with your actual broker export
2. Log at least one real trading week and check if the analytics feel accurate
3. Use the feedback button — even small things ("this label is confusing") are useful

Thanks again. Building in public, shipping fast.

— Dylon, Kōda
