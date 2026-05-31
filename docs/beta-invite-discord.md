# Kōda — Beta invite messages

Drop-in copy for the first wave of Discord invites. One short DM-friendly message, one longer server-post version. UTM convention below.

---

## A · Short DM / first message (≤ 4 lines)

> Hey — building a trading journal called **Kōda** (kodatrade.co.uk). It's the journal I wanted while running prop evals: discipline tracking, kill-switch when you hit your daily loss limit, and verified-trade circles instead of Discord screenshot wars.
>
> Closed beta opens this week. Want a spot? Free Pro for the whole beta with code **`BETA_26`**.
>
> Link: https://kodatrade.co.uk/?utm_source={SOURCE}&utm_medium=discord&utm_campaign=beta_wave1

Replace `{SOURCE}` per channel — see UTM table below.

---

## B · Longer server-post version (for channels you've earned the right to post in)

> **Kōda — closed beta is opening 🚀**
>
> I've been building a trading journal for retail futures + prop-firm traders. The honest pitch:
>
> • **CSV import that doesn't lie.** Rithmic, NinjaTrader, Tradovate, MetaTrader, TradeStation, Quantower. Symbols normalised (NQH5 → NQ), broker P&L preferred over local recompute, EU decimals handled, dedup that works.
> • **Daily loss-limit kill switch.** Hits your home screen, not buried 4 menus deep. Three-state escalation (safe / warning / breach). Optional hard-block on logging more trades when you've breached.
> • **Circles, not screenshots.** Join the global Kōda circle on sign-up. Leaderboards based on real imported trades, not someone's flexed iPhone screenshot. Verified-trade trust signal.
> • **Discipline tracking.** Per-trade rule adherence (Y/N), emotional state (Calm / FOMO / Revenge / Confident), weekly report card.
>
> **Beta access is free** — use code **`BETA_26`** at checkout for full Pro until the beta closes.
>
> kodatrade.co.uk?utm_source={SOURCE}&utm_medium=discord&utm_campaign=beta_wave1
>
> Mobile-first PWA — install to home screen. Feedback button in-app goes straight to me. Built solo, shipping fast, want your honest takes.

---

## C · UTM source map (match `docs/utm-conventions.md`)

Replace `{SOURCE}` in the link based on where you're posting:

| Channel | `utm_source` |
|---|---|
| Apex Trader Funding Discord | `apex_discord` |
| FTMO Discord | `ftmo_discord` |
| TopstepTrader Discord | `topstep_discord` |
| MyFundedFutures Discord | `mff_discord` |
| r/PropTrading | `reddit_proptrading` |
| r/FuturesTrading | `reddit_futures` |
| Instagram bio link | `instagram_bio` |
| Instagram DM | `instagram_dm` |
| TikTok bio link | `tiktok_bio` |
| Direct DM (no channel) | `direct_dm` |

`utm_medium=discord` for any Discord post. Use `social`, `reddit`, `dm` etc. for other surfaces.

---

## D · Posting checklist

Before you hit send in a server:

- [ ] Read the channel's promotion rules — most prop firm Discords have a #self-promo or #made-by-traders channel. Don't drop in #general.
- [ ] Pre-DM a mod where possible. "Hey, building a journal aimed at people in evals — OK to post in #self-promo?"
- [ ] Replace `{SOURCE}` in the link. **Don't post with a literal `{SOURCE}` in the URL.**
- [ ] Have the in-app feedback button working before posting — first 24h will be the highest signal.
- [ ] Save a screenshot of the post + timestamp for the launch retro.

---

## E · If asked "what's different from TradeZella / TraderSync / Tradervue"

Tight answer:

> Three things: (1) Kill-switch enforcement, not just a metric — Kōda can block trade-logging when you've breached your daily loss limit. (2) Circles with verified imported trades, so the leaderboard is real, not screenshot-claimed. (3) British indie dev, £24.99/mo not $30, no upsell carousel.
