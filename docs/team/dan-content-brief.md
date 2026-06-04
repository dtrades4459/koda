# Dan — CMO content + demo brief

**Created:** 2026-06-04 · **For:** Dan (CMO) · **From:** Dylon (CEO)

This doc gives you a concrete content engine for the next 4 weeks. The thesis: Kōda's wedge is in-session intervention. Every piece of content should pull a viewer toward the moment they see that feature fire. Polish on the rest of the app stays on the backlog until paying users tell us which screen matters next.

---

## What you own

1. **In-session intervention demo video** (week 1 — single biggest lever)
2. **Comparison page #2** (week 1–2 — Kōda vs Edgewonk)
3. **Mon/Wed/Fri content shoot cadence** (ongoing — @dylon.trades + @kodatrade.co.uk)
4. **Founder content amplification** (ongoing — Dylon shoots, you produce + post)
5. **Comparison page #3 + #4** (week 3–4)
6. **Lifecycle email copy** (week 2 — the 12 new templates need final copy review before they ship)

Everything below.

---

## 1. In-session intervention demo video (THE PRIORITY)

### Why this is the lever

We have 13 beta users and a £24.99/mo target. The single thing that gets us from 13 → 130 is a piece of content that shows the intervention feature firing live, on a real phone, mid-trade. Not a mockup. Not a Loom of me talking. **Actual phone-screen capture of the moment Kōda stops a trade.** That clip is the entire pitch.

### Spec

- **Format:** vertical (9:16), 60–90 seconds. Two versions: one with my voiceover, one with just text overlays (for TikTok where sound is often off).
- **Capture:** Dylon's actual iPhone, screen recording, real Kōda account. Not staged accounts, real trades.
- **Setting:** the morning trading session (NY open). 06:45–09:30 calendar block.

### Script outline

0:00–0:08 — Hook
> Voiceover: "Every trading journal asks 'what went wrong?' after the money's gone. This is a journal that asks 'are you sure?' before you take the trade."
> Visual: Kōda intervention sheet sliding up over a chart in the background.

0:08–0:20 — Set-up
> Voiceover: "I'm down two trades on NQ this morning. I'm about to take a third — and Kōda thinks I'm tilted."
> Visual: phone screen showing the existing two trades logged with losses, then user tapping "Log Trade."

0:20–0:45 — The wedge
> Voiceover: "It doesn't open the form. It opens this."
> Visual: the new polished InterventionSheet (with the editorial 'Pause.' headline). Show the signal list. Show the critical badge. Show the two CTAs.
> Voiceover continues: "Two consecutive losses. Revenge-trade window. Two signals. The data says I do worse from here. I can override. Or I can take a fifteen-minute break."

0:45–0:60 — The choice
> Voiceover: "Last month I would've clicked through. Today I'm taking the break."
> Visual: tap "Cancel · 15-min break". Sheet dismisses. Cooldown timer appears at top of screen.

0:60–1:30 — The payoff
> Voiceover: "Fifteen minutes later — clean head, better setup, +2.3R. The trade I would've taken at 9:24 would've been a loss. That's not a coincidence; it's discipline you can measure."
> Visual: Pre-cooldown trade not taken (red overlay), post-cooldown trade logged at +2.3R, weekly recap card showing the +R.

End card: "Kōda. The journal that stops you mid-tilt." + URL + CTA "Free forever".

### Production notes

- Use the new polished InterventionSheet that just landed on `redesign/v2`. Confirm with Dylon which build to record from.
- No music underneath voiceover, music only on the hook (0:00–0:08) and end card. Keep it sparse.
- Subtitles burned in — assume sound-off.
- Vertical only. Don't crop a horizontal video.
- Don't use stock footage. Don't use B-roll of "trader looking at multiple monitors." Just the phone screen and a hand operating it.

### Distribution

- TikTok @dylon.trades — primary
- IG Reels @kodatrade.co.uk — same cut, cross-post
- X @kodatrade — 90-sec version with thread context
- LinkedIn — 60-sec version with a more "process / discipline" angle
- Embed on the landing page above the fold (replaces the current static hero gradient)

Target ship: **Friday this week.** This is the highest-priority asset on the company.

---

## 2. Comparison page #2 — Kōda vs Edgewonk

Page 1 (Kōda vs Tradezella) shipped session 9. We need three more comparison pages — Edgewonk is next because they're the closest analogue + they rank for our target keywords.

### Spec

- Location: `public/koda-vs-edgewonk.html`
- Style: match `public/koda-vs-tradezella.html` exactly (same tokens — and remember the colour palette was just updated to the kit values, so make sure you pull the latest `theme.ts` cool palette: `#0A0A0B` bg, `#131317` panels, etc.)
- Length: ~1500 words, scannable. Above-fold = side-by-side feature comparison table. Below-fold = three deep-dive sections.

### Angles to hit (Edgewonk's weaknesses we beat)

| Edgewonk | Kōda |
|---|---|
| Desktop-first, mobile is an afterthought | Mobile-first PWA, designed for between-trades phone use |
| Analytics-only — looks back at trades | Intervention-first — stops trades before they happen |
| No social / Circles | Trading Circles + leaderboards + chat |
| €169/year flat (~£140/year) | £24.99/mo or £199/year — same ballpark, but with social + intervention |
| Self-hosted feel, no live data | Live broker sync (Tradovate), CSV import for the rest |

### Don't be a dick about it

Edgewonk is a respected tool. We win on a different axis (real-time intervention + community), not on "we have features they don't." Be specific about *who Kōda is for*: futures traders, prop-firm grinders, anyone who's blown an eval to a revenge trade. Edgewonk's audience is more "the analytical trader who wants to optimise post-trade." That's a real persona, we just don't serve them.

### Schema + SEO

- Include `schema.org/Product` markup with rating + price
- Include FAQ schema for the 5 most-likely Edgewonk-vs-Kōda search queries
- Title: "Kōda vs Edgewonk — which trading journal stops you mid-tilt?"
- Meta description: 155 chars, lead with "stops you mid-tilt"
- Cross-link from `/comparison.html` (the hub) and from the existing Tradezella page footer

Target ship: **End of week 2.**

---

## 3. Mon/Wed/Fri content shoot cadence

We already have the calendar block. Lock the format so we ship consistently.

### Format (60–90 sec each, vertical)

- **Monday — "What I'm watching this week"**
  - Dylon captures pre-market thoughts on NQ + ES levels for the week
  - Show the relevant Kōda screen (the rules checklist + the weekly recap from last week)
  - End with: "Logged in Kōda. Free to use. Link below."

- **Wednesday — "Mid-week check-in"**
  - Mid-session capture. Dylon shows the live discipline score + any intervention events that fired this week.
  - The win: show a real intervention that *did* fire, the trade we didn't take, what would have happened
  - Don't fake intervention events. If none fired this week, replace with a CSV-import demo or a Circles chat highlight.

- **Friday — "Weekly recap"**
  - Use the new WeeklyReportCard share image (just shipped) — screenshot the IG-square render
  - Quick voiceover on what worked / what didn't
  - End with "Sunday is review day. Plan your next week with me on @dylon.trades"

### Posting times

- TikTok: 6pm UK (1pm ET)
- IG Reels: same cut, same time
- X: thread with the embedded clip, 9pm UK

### Engagement

- You respond to first 20 comments on each post (Dylon's brand voice — direct, no fluff, no emoji except 🔥)
- Pin the comment that says "Free at kodatrade.co.uk — link in bio"
- DMs from prop firm traders → forward to me, I personally reply
- DMs asking for support → forward to Bruno

---

## 4. Founder content amplification

Dylon shoots raw. You polish and post.

- I'll Telegram you raw clips Mon/Wed/Fri morning by 8am
- You handle: cut, captions, thumbnail, posting, cross-posting, comment moderation
- Turnaround target: same-day post for Mon/Wed, Saturday morning for Friday's clip
- Asset library: `team/content-archive` Google Drive folder (set it up if not already)

### Voice guardrails

Per DESIGN.md (line 14): the brand voice is **focused, direct, anti-hype**. Avoid:
- "Game-changing"
- "Revolutionary"
- "AI-powered" (we don't use a model for the wedge)
- Stock-trader emoji set 📈💸🚀
- "Crushing it"

Lean into:
- Specific numbers ("+2.3R", "13 → 100")
- Concrete situations ("yesterday I almost took a revenge trade...")
- Process language ("the system caught it", "the data said")

---

## 5. Comparison pages #3 and #4

In week 3–4 after #2 ships:

- **#3: Kōda vs TradesViz** — they're the AI-forward competitor. Our angle: "AI summarises your trades. Kōda intervenes before you make them."
- **#4: Kōda vs Tradervue** — the OG. Our angle: "Tradervue is the journal. Kōda is the coach."

Same structure as Edgewonk page.

---

## 6. Lifecycle email copy review

Dylon built 12 new transactional + lifecycle email templates in `api/lib/email.ts` (welcome, password reset, payment failed, milestone, monthly recap, etc.). Bruno is wiring them. Before they go to real users, **you do a copy pass** on each:

- Brand voice check (use the guardrails above)
- Subject line A/B suggestions for the 3 most-trafficked (welcome, weekly recap, milestone)
- CTA copy — "Open Kōda →" is current default; suggest alternatives where it could be sharper
- Unsubscribe + preference centre copy — currently terse, should be friendlier

Deliverable: a single doc with your suggested edits per template. Dylon merges them.

---

## What's NOT in your scope (for now)

- Product features. If you have a feature idea, write it in `whiteboard.md` for me to triage.
- UI design changes. The redesign is in progress (Dylon + the design handover bundle). Don't propose visual changes mid-sprint.
- Paid acquisition. We're not running ads until we have a working organic funnel + 100 paying users. The math doesn't work earlier.
- Influencer outreach with > 100k followers. Their CPM is currently higher than the value of a Kōda subscriber to us. Smaller, more aligned creators (5k–50k, prop-firm focused) only.

---

## Metrics you own

| Metric | Frequency | Where |
|---|---|---|
| Posts shipped per week | Weekly | Notion content tracker |
| Average TikTok views per post | Weekly | TikTok analytics |
| Landing page conversion rate (visit → sign-up) | Weekly | PostHog funnel |
| Free → Pro conversion rate | Weekly | Stripe dashboard |
| Comparison page traffic + bounce rate | Weekly | Vercel Analytics / GSC |
| Founder content engagement rate | Weekly | per-platform |

Telegram the weekly numbers in our group every Monday at 10am UK (after Bruno's ops dump at 9am).

---

## When you and I disagree

You'll sometimes push for a content angle, design change, or messaging tweak I'll say no to. That's the job. The rule:

1. **Push hard before the decision.** Make the case in writing or voice.
2. **Once it's decided, you ship the decided version.** Don't half-execute because you disagreed.
3. **If you fundamentally disagree with the brand voice or strategy, we have a different conversation.** Not day-to-day.

---

## Signed off

**Dylon (CEO):** Yes, this is the scope.
**Dan (CMO):** [sign here when you've read and agreed]

Date: __________
