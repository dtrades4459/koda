# Garry verdict — Kōda, 2026-06-07

> Brutal read on where the product actually stands the night before 30-day dogfood. Written in Garry-mode: no hedging, no founder cosplay, no "everything is great." If something here stings, it's doing its job. Sign off (or push back) before this becomes the operating thesis.

---

## What you're actually building

A **tilt-aware trading journal for prop-firm evaluation traders.**

Not "a trading journal PWA." Not "a social network for traders." Not "the all-in-one platform." Those framings lose you in a crowded category against TraderSync, Tradervue, Edgewonk, Notion templates, and Discord communities — all of which have multi-year head starts.

The tilt detector + in-session intervention is the only thing in Kōda that doesn't exist as a feature in any of those competitors. **That is the entire wedge.** Everything else is table stakes you need to keep, not arguments to install Kōda.

---

## Who specifically (the wedge)

A prop-firm evaluation trader who has blown ≥1 eval ($500–$2,000 fee per attempt) because they kept taking revenge trades after a loss.

That person:
- Is bleeding money in a measurable, recent, traumatic way.
- Knows they have a tilt problem; the eval rules made it impossible to hide.
- Searches for "prop firm risk management" / "stop overtrading" / "revenge trading."
- Will pay for anything that demonstrably prevents the next blow-up.

That is who you build for the next 90 days. Not "retail traders." Not "futures traders." Not "the trading community." **One bleeding-neck user.** If they don't stick, no one else will either.

---

## The one metric

**% of dogfood users (n=14 in KODA-GLOBAL) who log a trade on day 21 of the 30-day dogfood.**

Not stars. Not signups. Not TikTok views. Not MAU.

Why this one:
- It's the leading indicator of paid retention. If half the closed beta won't log a trade three weeks in — when they joined because they trust you personally — paying strangers won't either.
- It's measurable from the existing PostHog `intervention_fired` + trade-insert events without building new instrumentation.
- It's binary per user. No vanity ratios.

**Threshold:** >50% logging on day 21 = the wedge works, double down. <30% = the wedge is wrong, stop building features and re-interview. 30–50% = retention loop is bent, fix the journal/intervention friction before any distribution.

---

## What kills this

In rough order of likelihood:

**1. You don't actually dogfood.** Memory says dogfood starts Monday 2026-06-08. If you skip a day in week one because you were "busy shipping," you've already lost. The dogfood IS the work for 30 days — not a thing you do alongside shipping features. If you can't sit with the product daily as a user, the product isn't real yet.

**2. You ship features during dogfood.** The temptation is going to be "I noticed this small thing while logging — let me just fix it." Don't. Write it down, ship a single batch on day 31. Dogfooding is signal collection, not parallel development.

**3. TikTok push before the dogfood result is in.** Distribution without retention is the most expensive way to learn your product isn't sticky. The TikTok strategy assumes the product retains; you don't know that yet. Pushing TikTok week 1 means burning the cheapest, most engaged audience (close beta + first 100 organic) on an unvalidated loop.

**4. Splitting attention between Kōda + JARVIS + redesign.** Three projects, one solo founder, 30 days. Pick one. The other two get "no commits for 30 days" status.

**5. Tradovate dead-code rot.** ~150 lines of dead UI + 3 dead modules in the code path. It's not killing prod, but it's killing your ability to confidently refactor `Koda.tsx`. Delete it the first week of dogfood when shipping is on hold anyway.

**6. The chat-RLS hole stays open.** `circle_messages_select` is `USING (true)`. Any authenticated user can read every circle's chat. KODA-GLOBAL is fine; the second you have two private circles it's a real leak. Fix in Runbook C before adding any second private circle.

---

## The single highest-leverage move for the next 2 weeks

**Run the dogfood.** That's it. No new features. No TikTok push. No redesign work. No JARVIS.

Concretely, for the next 14 days (2026-06-08 through 2026-06-21):

1. **Use Kōda every NY AM session as a real trader.** Log every trade in the app, not on paper, not in a spreadsheet, not "I'll do it later." If the act of logging makes you not-want-to-trade-again, that's a feature — write down what was friction.

2. **Once-a-day end-of-NY journal entry in the Obsidian vault (Phase 3).** 2 lines: what worked in Kōda today, what almost made me quit using it. That's the bug list. Don't fix yet. Just collect.

3. **Day 7 + Day 14 check-ins.** Look at the metric. If <50% of the other 13 closed-beta users have logged in the last 7 days, ping them personally (Telegram works) and ask one question: "What stopped you?" Write the answer down. Don't argue, don't explain, don't ship anything based on it yet.

4. **Day 14 decision point.** Either: (a) the wedge works → start day 15 of dogfood and queue TikTok week 5, or (b) the wedge doesn't work → STOP building, re-interview 5 prop-eval traders, redefine the wedge. Either decision is fine. Both are catastrophic to skip.

The shipping itch is going to be brutal. You've spent the last 2 months building. The Sat-PR push (4 PRs queued) is the muscle memory talking. **The 2-week version of you that doesn't ship a single line of new code is the version that finds out whether Kōda is real.**

---

## What you do NOT do for 14 days

- ✗ Merge any feature PR (bug fixes only, and only if they block dogfood usage)
- ✗ Open the TikTok account
- ✗ Touch the redesign sprint docs
- ✗ Plan v2 dual-write rollout
- ✗ Email Tradovate Eval Support (it can wait until day 15)
- ✗ Anything in JARVIS

The Kōda backlog will not catch fire in 14 days. The dogfood window will.

---

## One question you should answer yourself before Monday morning

**If at day 30 of the dogfood, you found you'd only used Kōda 8 of 30 trading days — would you still ship the TikTok push?**

If yes: you're building for someone other than yourself. That's allowed, but identify who specifically and re-interview them. If no: the metric above is the right one. Run it honestly.

---

*Saved to journal because Phase 3 (Obsidian vault) hasn't shipped yet. Will live at `vault/garry-verdict-2026-06-07.md` once the vault exists.*
