# Kōda — Design System

> Living spec for the Kōda visual language. Update this when the design intent shifts, not just when token values change.

**Last meaningful update:** 2026-06-03 — warmth pass v1 in response to beta feedback that the original aesthetic read as "AI-generated / dark-web / web3" and felt emotionally cold on losing days.

---

## Design intent (read this first)

Kōda is a **trader's journal**, not a Bloomberg terminal. The trader using it just lost £400 on a revenge entry. They open the app to log it and reflect. What they see in that moment matters.

The aesthetic exists to serve that moment:

- **Calm before cool.** Warm dark, not pure black. Soft surfaces, not stark glass. Type that breathes, not type that yells "TERMINAL".
- **Made by a trader, not a model.** Voice has personality (Dylon's). Empty states say something. Copy chooses words a human would say to a friend who just lost money.
- **Information-dense where it earns it, not by default.** P&L deserves big numbers. A "Settings" label does not need to be a 9px monospace caps caption.

The trader who has had a great day wants the same app. They do not need a separate "celebration" mode. The aesthetic should feel right at both ends.

---

## What we are NOT

Anti-patterns we have drifted toward and are actively correcting:

- **AI-dashboard generic.** Glass cards everywhere, conic gradients in every corner, ambient orbs on every screen, monospace in every label. When everything sparkles, nothing does.
- **Pure-black background.** Reads as "dark web" / "crypto degen tool" rather than "calm focused workspace." The base color must have warmth in it (a hint of brown/cream undertone), not just be a dark neutral.
- **MONO everywhere.** Geist Mono is for numbers and codes. It is not for "Following" / "Settings" / "Sync & Log" / random section labels. Using it everywhere makes the app feel like a terminal emulator, not a journal.
- **Tiny text.** A 10px monospace caps label is illegible to half our beta users and unreadable to most of our addressable market. Default body should be 14-15px. Labels 11-12px. Numbers and chrome can be smaller when justified.

---

## Color tokens

Source of truth: `src/theme.ts` → `DARK` and `LIGHT`. Don't read raw hex from anywhere else. If a constant is hardcoded in a component, it is technical debt and should be routed through `C.*`.

### DARK theme — warm-dark (default for existing users)

| Token | Value | Use |
|---|---|---|
| `bg` | `#13110E` | Top-level page background. Coffee-toned warm dark. NOT pure black. |
| `panel` | `#1B1814` | Card backgrounds. One step lighter than `bg`, same warm undertone. |
| `panel2` | `#23201B` | Raised surface (modals, popovers, hover state). |
| `border` | `rgba(245,234,222,0.07)` | Subtle separators. Warm-white tint at 7% over the panels. |
| `border2` | `rgba(245,234,222,0.13)` | Stronger separators (around buttons, around cards). |
| `text` | `#F2EFE9` | Primary body / headline text. Off-white with cream undertone. |
| `text2` | `#A8A39A` | Secondary text (descriptions, byline). |
| `muted` | `#6A655C` | Tertiary text (labels, kickers, deemphasized chrome). |
| `dim` | `#4A4640` | Border-on-disabled, very-quiet text. |

Reasoning: the previous palette (`bg: #0A0A0B`, white-tinted borders) was technically a "near-black" but read cold because the hue was anchored at blue (240°). Shifting hue to warm (~25°) and lifting lightness by 1-2 percentage points keeps the dark-mode feel while landing emotionally calmer.

### Accents — both themes

| Token | DARK | LIGHT | Use |
|---|---|---|---|
| `accent` | `oklch(0.74 0.16 250)` | `oklch(0.55 0.18 252)` | Electric blue — links, highlights, "Pro" badge |
| `live` | `oklch(0.84 0.14 175)` | `oklch(0.62 0.14 175)` | Mint/teal — go CTAs, "Session live", live-data dots |
| `green` | `oklch(0.78 0.18 152)` | `oklch(0.55 0.18 152)` | Win, positive P&L, profit pills |
| `red` | `oklch(0.70 0.21 25)` | `oklch(0.55 0.22 25)` | Loss, negative P&L, critical signals, error states |
| `warn` | `oklch(0.79 0.16 75)` | `oklch(0.70 0.16 75)` | Caution (75% of limit, offline banner) |

Each accent has a `*Soft` variant (`accentSoft`, `liveSoft`) for backgrounds — already-paled OKLCH with explicit alpha. Use those for pill backgrounds, not `accent` + `color-mix(...)` ad-hoc.

### LIGHT theme — warm off-white

| Token | Value | Use |
|---|---|---|
| `bg` | `#F4F2ED` | Warm off-white page background |
| `panel` | `#FFFFFF` | Card backgrounds (pure white pops against the warm bg) |
| `text` | `#0A0A0A` | Body text, near-black for max contrast |
| `text2` | `#55554F` | Secondary text |
| `muted` | `#9A9890` | Tertiary text |

The light theme is currently underbaked relative to dark — Phase 2 of the warmth pass will polish it as a real peer (Settings becomes Light / Dark / System, new users default to System).

---

## Typography

Source of truth: `src/shared.tsx` exports `MONO`, `BODY`, `DISPLAY`.

```
MONO    = 'Geist Mono', 'IBM Plex Mono', ui-monospace, monospace
BODY    = 'Geist', 'Inter', system-ui, sans-serif
DISPLAY = 'Geist', 'Inter', system-ui, sans-serif   (same family, used at heavier weights / larger sizes)
```

### When to use which

**MONO — for numeric data and codes only.**

✅ Yes:
- P&L values (`+$1,240`, `−2.5R`)
- Percentages (`67% WR`, `90% of limit`)
- Counts (`12 trades`, `3 / 5`)
- Trade pair codes (`ESM4`, `NQH5`)
- Strategy codes (`RTM`, `FVG`)
- Timestamps and date strings (`10:25 ET`)
- Cron / technical chrome where the monospace IS the signal

❌ No:
- Section labels (`STATS`, `RULES`, `FOLLOWING`)
- Navigation labels (`Home`, `News`, `Stats`)
- Kicker text (`Public · Chronological`)
- Empty-state copy
- Button labels (even `+ NEW IDEA`)
- Setting names

Letter-spacing on uppercase MONO captions reads as "technical instrument". That is the vibe we are deliberately dialing back.

**BODY — for everything that is reading material.**

Default body text, paragraphs, descriptions, captions, button labels, navigation, section headers.

**DISPLAY — for headlines that need weight.**

Larger weights of the same Geist family. Used for hero numbers, screen titles, modal titles. Distinguished by size and weight, not by family swap.

### Size scale

| Size | px | Use |
|---|---|---|
| `display-l` | 26-32 | Hero headlines, "Welcome back" |
| `display-m` | 22 | Modal titles, screen titles |
| `display-s` | 17-18 | Sheet titles |
| `body-l` | 15 | Default paragraph / card body |
| `body-m` | 14 | Card subtitle, secondary copy |
| `body-s` | 13 | Tertiary descriptions (still readable) |
| `label-l` | 12 | Section labels, button labels |
| `label-m` | 11 | Pill labels, badges |
| `label-s` | 10 | Numeric chrome only (column headers in dense tables) |
| `data-l` | 22-28 | Hero P&L number |
| `data-m` | 14-16 | In-card P&L |
| `data-s` | 11-13 | Inline numbers (R-multiple after a trade) |

Anything under 11px MUST be numeric data that benefits from the compact form. No body text at 10px. No labels at 9px. The warmth pass is bumping base sizes — if you find an 11px body string, it should become 13px.

---

## Voice and tone

The app's words matter as much as its colors. Beta feedback called the original copy "AI generated" — that is fixable, mostly by writing as a human would.

### What Kōda sounds like

- **Direct, not chirpy.** "Log your first trade →" rather than "Let's get started on your trading journey! 🚀".
- **Specific, not generic.** "Tag rule adherence on 3+ trades this week to unlock your score." rather than "Add more data to see insights."
- **Honest about feelings.** The app exists for traders who lose money sometimes. Acknowledge that. "Rough day. Tomorrow's a fresh ledger." beats "Stay positive!".
- **Lowercase first-person for Dylon.** Founder voice shows up as "Hi, I'm Dylon — I built this because I needed it." not "Welcome to Kōda by Mr. Nyland".

### What Kōda does NOT sound like

- Marketing-bot enthusiasm ("Unleash your trading potential!")
- LinkedIn corporate ("Leverage data-driven insights to optimize your edge.")
- Tech-bro shorthand ("Print", "send it", "lfg")
- Emoji-rich anywhere outside the streak fire (🔥) and the genuine ones the user types into chat

### Where the voice lives

Empty states, onboarding, settings descriptions, error messages, intervention sheet copy, debrief prompts. These are the high-leverage copy surfaces — they are where the user feels the app's personality. Keep them human.

---

## Surfaces and motion

### Glass / ambient effects

Use SPARINGLY. Maximum **one signature ambient piece per screen.** A single soft conic gradient in the hero corner is enough — repeating it in three places makes the app feel templated.

| Element | Use |
|---|---|
| `GlassOrb` | At most two per page, low opacity, only on Home hero |
| Iridescent corner glow | Home hero only |
| `surfaceGlass` blur | Hero card only, not on every panel |

Cards, panels, and modals should mostly be flat warm panels with subtle borders. The brand pop comes from the accent dots, the type, and the data — not from glass everywhere.

### Motion

Source of truth: `src/index.css` `@keyframes k*`. All animations respect `prefers-reduced-motion`.

| Keyframe | Use |
|---|---|
| `kSlideIn` | Sheets, toasts entering |
| `kRise` | Cards appearing on load |
| `kFadeIn` | Subtle reveal |
| `kPulse` | Live-data dots (mint), critical signal indicators |
| `kShimmer` | Loading skeletons (Circles, Ideas) |
| `kStreakGlow` | Streak milestone (use sparingly) |
| `kConfetti*` | Won-the-day celebration ONLY when the user explicitly hits a milestone |

Avoid wrapping non-essential elements in `kFadeIn` "because it feels nicer" — too much motion is part of the "AI generated" feel.

---

## Component patterns

### Pills (buttons)

`makeStyles(C).pillPrimary` and `pillGhost` are the source of truth. Re-use them, don't redefine.

- Primary: filled with `C.text` on `C.bg` (or `C.live` for go-state CTAs)
- Ghost: transparent with `C.border2` outline, MONO uppercase caption — kept for cases where the "technical" reading earns it (CSV imports, dev-tool actions)

### Cards

Flat warm `C.panel` background, `1px solid C.border`, `12px` radius, `14-16px` padding. No glass on standard cards. Reserve glass for the home hero only.

### Sheets / modals

- Mobile: bottom sheet with 36×4 drag handle on top, slides up from bottom edge.
- Desktop: centered modal, max-width 400-440px, soft shadow.
- Backdrop: `rgba(0,0,0,0.45)` mobile, `rgba(0,0,0,0.62)` desktop with 2px blur.

Backdrop tap = Cancel. No silent dismiss for high-stakes sheets (intervention, debrief).

### Live data dots

Mint `C.live` 8x8 circle with `box-shadow: 0 0 10px C.live` pulse. Reserved for "session live", "intervention firing", "realtime active". Don't put pulse dots everywhere — it's the "we're connected to the matrix" sparkle that the AI-generated critique was about.

---

## Roadmap

| Phase | When | What |
|---|---|---|
| **Phase 1 — Foundation pass** | 2026-06-03 | Warm DARK palette, founder voice in empty states, typography breath, de-MONO of chrome |
| Phase 2 — Light theme + visual quieting | 2026-06-04 | LIGHT polished as peer, Settings toggle 3-way, reduce ambient orbs to one per screen, final MONO sweep |
| Phase 3 — Brand-level | Post-launch | Default to System mode (Light primary), custom illustration for empty states, evaluate font family swap (Inter Display / serif accent for journal voice) |

---

## How to extend this

If you are about to add a new screen, new component, or new color token:

1. Check this doc first. If it conflicts with what is here, either update the doc with a rationale or align with the doc.
2. New colors go in `theme.ts` — do not hardcode hex anywhere downstream. The warmth pass turned up a dozen hardcoded `#0A0A0B` references that broke when the palette shifted. Add new tokens, don't hardcode.
3. New copy goes through the voice check: would Dylon say this to a trading friend, in a sentence? If no, rewrite.
4. New motion goes through the motion check: does this need to move, or am I adding it because it "feels modern"? If the latter, remove.

The point of having this doc is to keep the next round of changes coherent. Without it, the app drifts back to AI-generated-dashboard one card at a time.
