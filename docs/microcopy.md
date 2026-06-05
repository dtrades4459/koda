# Kōda OS — Microcopy library

> Single source of truth for product voice, error messages, empty states, push
> templates, button labels, kicker vocabulary, email subjects, and milestone
> copy. Update this file before changing copy in code; reviews against this doc.
>
> Designed from `koda-designs/cat15-copy.jsx`. Companion to
> [`design-coverage.md`](design-coverage.md) row "15 · Microcopy library".

---

## 1 · Voice & tone reference card

### We are
- **Direct.** "Your sync paused." Not "Uh oh, we couldn't quite reach…"
- **Calm.** Even errors land flat. We don't panic on the user's behalf.
- **A coach, not a cheerleader.** We hold them to their rules. We don't say "you got this".
- **Trader-fluent.** R, fills, stop-out, eval, dunning, drawdown — used correctly. We assume context.
- **Specific.** "+18.4R · 92% adherence" beats "great week".

### We avoid
- **Exclamation marks** outside genuine milestones. One per email max.
- **"Crush it" / "Let's go" / "Crushed it"** — finance-bro idiom.
- **Hype.** We don't ever say "amazing", "incredible", "next-level", "game-changer".
- **Blame.** When a trade goes wrong, the user broke a rule — not "you screwed up". "You broke a rule on NQ — review it."
- **Emoji.** Only for genuine milestone celebrations (🔥 streaks, 🏆 challenge wins). Never in errors or default UI.
- **Apologies.** "Sorry" once per error max. We don't grovel.
- **Brand voice in transactional flows.** A receipt is a receipt.

### Tone by surface
| Surface | Tone |
|---|---|
| Trade entry | Brief, mechanical |
| Stats / journal | Confident, specific numbers |
| Intervention / tilt | Calm, slow, respectful — we are interrupting their session |
| Errors | Plain, factual, recovery-focused |
| Celebrations | Earned, never sycophantic |
| Marketing / landing | Brand voice unlocked — italic accent on the verbs |
| Legal / receipt | Boring on purpose |

### Sentence patterns we like
- `"You X. Y."` — short, two-beat. *"You broke a rule. Review it."*
- `"X — Y"` — em-dash separates fact from consequence. *"Tradovate sync paused — reconnect."*
- `"{Verb} your {noun}."` — direct CTA. *"Reset your password."*
- `"{Stat} this week."` — fact-first. *"+18.4R this week."*

---

## 2 · Error message library

### Network errors
| Code | Title | Body | Action |
|---|---|---|---|
| `net.offline` | You're offline | Showing your last synced data. Changes save locally. | (banner) |
| `net.timeout` | Couldn't reach Kōda | Check your connection and retry. | Retry |
| `net.slow` | Slow connection | Still loading — hang tight. | (banner, no action) |
| `net.reconnected` | Back online | Synced {n} trade{s} logged offline. | (auto-dismiss) |

### Validation errors
| Code | Pattern | Example |
|---|---|---|
| `val.email` | "That doesn't look like a valid email." | invalid email field |
| `val.handle.taken` | "@{handle} is taken. Try another." | handle picker |
| `val.handle.format` | "Handles are letters, numbers, and underscores. 3–20 chars." | handle picker |
| `val.password.short` | "Password needs at least 8 characters." | sign-up |
| `val.required` | "{Field} is required." | generic missing field |
| `val.range` | "{Field} must be between {min} and {max}." | numeric range |

### Server errors
| Code | Title | Body | Action |
|---|---|---|---|
| `srv.500` | Something broke on our end. | We've been pinged and we're on it — give it a moment and try again. | Reload |
| `srv.503` | Kōda is upgrading. | We're shipping something good. The app will be back in a few minutes — your data is safe and untouched. | Try again |
| `srv.rate` | Slow down a sec | You've made a lot of requests quickly. Try again in {timer}. | Got it |
| `srv.maintenance` | Scheduled maintenance | We'll be back at {time}. Your trades aren't going anywhere. | Status page |

### Permission errors
| Code | Title | Body | Action |
|---|---|---|---|
| `perm.401` | You're not signed in. | This page needs an account. Sign in to continue — your work is saved. | Sign in |
| `perm.403` | You can't access this. | This page is private or you don't have permission. If you think this is a mistake, head back home. | Back to dashboard |
| `perm.circle.private` | You don't have access to this Circle. | Ask the owner for an invite link. | Browse Circles |
| `perm.feature.pro` | Pro feature | Upgrade to unlock {feature}. | Upgrade |
| `perm.notif.blocked` | Notifications are blocked | You'll need to re-enable them in your browser. | Step-by-step |

### Optimistic rollback toasts
- "Couldn't save — reverted. {reason}." — with **RETRY** action
  - `reason` examples: "Your star didn't stick.", "Your comment didn't post.", "Your tag didn't save."

---

## 3 · Empty-state copy (per screen)

| Screen | Headline | Sub | CTA (if any) |
|---|---|---|---|
| Journal — never logged | No trades yet. | Log your first and Kōda starts tracking. | Log trade |
| Journal — filtered to zero | Nothing matches. | Try widening your filters. | Clear filters |
| Stats — < 5 trades | Stats unlock at 5 trades. | You're at {n}. | — |
| Circles — none joined | No Circles yet. | Join one with a code, or create your own. | Browse Circles |
| Inbox — caught up | You're all caught up. | New broker syncs, follows, and Circle activity will appear here. | — |
| Inbox — first run | No activity yet. | Connect a broker and your fills will appear here. | Connect broker |
| Friend feed — no follows | Quiet around here. | Follow a few traders to see their trades and reactions. | Suggested follows |
| Notifications drawer — empty | You're all caught up. | New broker syncs, follows, and Circle activity will appear here. | — |
| Ideas — none | No ideas yet. | Drop a setup, link it to a trade later. | New idea |
| Discipline history — none | No tilt events. | Kōda learns your patterns as you log. | — |
| News — none loaded | Couldn't load news. | We'll try again in a minute. | Retry |
| Eval account — none | No eval running. | Start one and Kōda tracks the rules for you. | Start eval |
| Search — no results | Nothing found for "{query}". | Try a broader term, or check spelling. | — |

---

## 4 · Push notification templates

> Variables in `{braces}`. Keep under 110 chars total (title + body) so the
> notification doesn't truncate on Android. Title in `**bold**` is the
> notification title; the rest is the body.

### Lifecycle
- **Your week** · `{net}R · {adh}% rule adherence. Your best setup: {setup}.`
- **Sync complete** · `{broker} · {n} fill{s} imported.`
- **Sync paused** · `{broker} sync paused — reconnect.`
- **Update ready** · `A new version of Kōda is available.`

### Social
- **@{handle} started following you** · *(body optional)*
- **{n} traders reacted to your {setup}** · *(aggregate; body optional)*
- **Circle {name}** · `{n} new message{s}.`
- **@{handle} mentioned you** · `"{snippet}"`

### Discipline
- **You broke a rule on {pair}** · `Review it before your next session.`
- **Cooldown active** · `Kōda paused you for {duration}. Take a breath.`
- **🔥 {n}-day discipline streak** · `{n} days, every rule logged.`

### Milestones (emoji allowed here)
- **🔥 {n}-day discipline streak** · `{n} days, every rule logged. Tap to share your card.`
- **🏆 You won "{challenge}"** · `Top of {circle} this week.`
- **🎯 First trade logged** · `Your journal starts here.`
- **💯 {n}th trade** · `That's {n} fills in your edge.`

### Billing
- **Payment declined** · `Visa ending {last4} couldn't be charged. Update to keep Pro.`
- **Receipt** · `{amount} for Kōda {plan}. Thanks.`

---

## 5 · Email subject lines

> No emoji in subjects except genuine milestones. Verbs in present tense.
> Under 60 chars where possible.

### Auth & onboarding
- `Welcome to Kōda — your edge starts now`
- `Verify your email — code {code}`
- `Reset your Kōda password`
- `You're on the Kōda waitlist`
- `You moved up the Kōda waitlist — #{position}`
- `Your Kōda beta seat is ready`

### Billing
- `Receipt from Kōda — {amount}`
- `Action needed: your payment was declined`
- `Your Kōda Pro plan has been cancelled`
- `Your Pro plan renews in 3 days`

### Lifecycle
- `Your week: {net}R`
- `Your {month} in review: {net}`
- `Your year on Kōda — by the numbers`

### Data & sync
- `Your Tradovate sync needs attention`
- `Sync complete — {n} new fills`

### Milestones *(emoji allowed)*
- `🔥 {n}-day discipline streak`
- `🏆 You won "{challenge}"`
- `🎯 100 trades logged`

### Product news
- `New in Kōda: in-session intervention`
- `What changed this month on Kōda`

### Account
- `Your Kōda account is scheduled for deletion`
- `Your data export is ready`

---

## 6 · Button label patterns

### Primary actions (live mint)
Format: `{Verb} {noun}` — never just `{Verb}`.
- `Log trade`
- `Start session`
- `Save changes`
- `Connect broker`
- `Reconnect`
- `Reset password`
- `Update payment method`
- `Sign back in`
- `Open Kōda` (in emails)

### Ghost actions (secondary)
Soft refusals.
- `Maybe later`
- `Cancel`
- `Not now`
- `Skip for now`
- `Keep my account` (in account deletion)

### Destructive (red border, ghost)
We never auto-confirm. Always say what's being lost.
- `Delete trade`
- `Delete account`
- `Leave Circle`
- `Disconnect broker`
- `Sign out`

### Confirmation patterns
- `Yes, delete {noun}` — always include the noun
- `I understand, continue`

### Empty-state CTAs
- `Log your first trade →`
- `Browse Circles`
- `Join with a code`

---

## 7 · Kicker / label vocabulary

> Mono caps, `letter-spacing: 0.12em–0.22em`, tone matched to context.

### Status kickers
`LIVE · DRAFT · PAST DUE · LOCKED · ARCHIVED · PAUSED · COMPLETED · ACTIVE · IDLE · ERROR`

### Section kickers
`OVERVIEW · PERFORMANCE · PSYCHOLOGY · DISCIPLINE · NEWS · CIRCLES · IDEAS · STATS · JOURNAL · SETTINGS · ACCOUNT · BILLING · DEVICES · NOTIFICATIONS`

### Time kickers
`TODAY · THIS WEEK · THIS MONTH · YEAR TO DATE · ALL TIME · LAST 7D · LAST 30D · LAST 90D`

### Outcome kickers
- `+R MULTIPLE` / `−R MULTIPLE`
- `WIN` / `LOSS` / `BREAK-EVEN`
- `ABOVE PLAN` / `BELOW PLAN`

### Tone-coded kickers
| Tone | Use for | Examples |
|---|---|---|
| `t.live` (mint) | Action, primary fact | `WEEKLY RECAP · MILESTONE · NEW` |
| `t.accent` (blue) | Info, neutral status | `RECEIPT · ANNOUNCEMENT · UPDATE` |
| `t.green` | Win, success | `SYNC COMPLETE · MILESTONE` |
| `t.red` | Loss, error | `PAYMENT FAILED · SYNC ERROR · DECLINED` |
| `t.warn` (amber) | Caution | `RULE BROKEN · COOLDOWN · ACTION NEEDED` |
| `t.mute` | Metadata | `2H AGO · JUN 4 · BY @MARCUS` |

### Email kickers
`KŌDA · WAITLIST · BILLING · BILLING · ACTION NEEDED · SECURITY · ACCOUNT · MILESTONE · WELCOME · PRODUCT NEWS · DATA · SYNC · BETA · UNLOCKED`

---

## 8 · Achievement / milestone copy templates

### Discipline streaks
| Days | Headline | Body |
|---|---|---|
| 7 | A 7-day streak. | One full week, every rule logged. The chain starts here. |
| 30 | A 30-day streak. | Thirty trading days, every rule logged. That's not luck — that's a process. Keep the chain alive. |
| 100 | A 100-day streak. | A hundred days holding the line. You don't need motivation anymore — you have a habit. |
| 365 | A full year. | 365 days, every rule logged. This is who you are now. |

### Trade count
| Count | Headline | Body |
|---|---|---|
| 1 | Your first trade. | Welcome to your journal. The next thousand build the edge. |
| 100 | 100 trades logged. | A hundred data points — Kōda's pattern recognition is sharpening up. |
| 500 | 500 trades. | Half a thousand. Your win rate is real now. |
| 1000 | 1,000 trades. | A thousand fills. Your stats stop being noise. |

### Prop firm
| Event | Headline | Body |
|---|---|---|
| Eval started | Eval running. | We'll track every rule — drawdown, daily loss, target — and tell you the moment something's off. |
| Eval at risk | At risk. | You're {n}% to your max drawdown. One more red day and the account's done. |
| Eval passed | Eval passed. | You hit target with {dd}% drawdown to spare. Funded next. |
| Eval failed | Eval ended. | The account's done. The journal isn't — every trade is still here, still yours. |

### Challenge wins
- `🏆 You won "{title}"` — `Top of {circle} on {metric}: {value}.`

### Year in review
- `Your year on Kōda` — `{trades} trades · {netR}R net · {adh}% adherence · {streak}-day best streak.`

---

## Maintenance notes

- **When you change copy in code**, update this file in the same PR.
- **When you add a new error / empty state / push template**, append to the
  relevant section here first, then reference it from code.
- **When in doubt about tone**, re-read §1 *"We are / we avoid"*. The voice card
  is the tiebreaker.
- Variables follow the `{snake_case}` convention. `{n}` for counts. `{handle}`
  for usernames. `{circle}` for Circle names. `{setup}` for strategies.
