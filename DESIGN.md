# Design System — Kōda

## Product Context

- **What this is:** Mobile-first trading journal and social platform, delivered as an installable PWA
- **Who it's for:** Retail traders who take their edge seriously — people who track P&L, analyse strategy patterns, and want their data presented with craft
- **Space/industry:** Trading tools / fintech; peers include Tradervue, TradesViz, Edgewonk
- **Project type:** Mobile-first PWA with desktop support; data-dense dashboard, social layer (Circles), subscription product

## North Star

**"Trading data, finally beautiful."**

Every design decision should serve this impression. The product should feel like serious, crafted software — not a toy, not a clinical analytics tool. The numbers are the hero. Typography and whitespace do the design work.

## Aesthetic Direction

- **Direction:** Industrial-Editorial — Bloomberg Terminal clarity meets Apple Notes warmth
- **Decoration level:** Intentional — glass surfaces and OKLCH orb bloom effects on key screens; no decorative patterns elsewhere
- **Mood:** Focused and warm. A trading workspace you want to open at 7am. Not the cold blue-black of a terminal, not the gamified pastels of a consumer app. The palette is coffee-dark — serious but never hostile.
- **Reference sites:** Tradervue (table stakes baseline), TradesViz (AI-forward, no craft), Edgewonk (functional, light-mode default). Kōda is the only mobile-first, dark-primary, OKLCH-powered product in the space.

### Differentiation choices

1. **Coffee-warm dark** (`#13110E`) instead of cold blue-black. Makes the app feel like a focused workspace. The panel2 (`#23201B`) tones add depth without the harsh contrast of pure OLED black.
2. **Electric blue + mint instead of green-as-brand.** Every competitor uses green as their primary action/brand color (profit = green). Kōda's accent is blue (information) and live/CTAs are mint-teal. Green and red appear only for win/loss outcomes — they are not the brand.
3. **Geist for display and body (same family).** Rather than a separate display face, typographic hierarchy comes from weight, size, and tracking variation. Numbers and prose feel unified.

## Typography

- **Display/Hero:** Geist — large numbers (P&L, stats) at negative tracking (−0.02em to −0.05em). The numbers are the poster.
- **Body:** Geist — prose, descriptions, button labels at 0em tracking
- **UI/Labels:** Geist Mono — all kickers, section labels, nav items, metadata. Always uppercase, wide-tracked (0.05em–0.14em). Creates data-terminal structure.
- **Data/Tables:** Geist Mono — `font-variant-numeric: tabular-nums` for aligned columns
- **Code:** Geist Mono
- **Loading:** Google Fonts CDN — `https://fonts.googleapis.com/css2?family=Geist:wght@300;400;500;600;700&family=Geist+Mono:wght@400;500;700&display=swap`
- **Fallback stacks:**
  - Body/Display: `'Geist', 'Inter', system-ui, sans-serif`
  - Mono: `'Geist Mono', 'IBM Plex Mono', ui-monospace, monospace`

### Type Scale

| Role                | Family     | Size (px)         | Weight | Tracking   |
|---------------------|------------|-------------------|--------|------------|
| Hero display number | Geist      | 72–110px          | 700    | −0.04em    |
| Large metric / stat | Geist      | 36–44px           | 600    | −0.03em    |
| Section heading     | Geist      | 22–28px           | 500–600| −0.02em    |
| Body paragraph      | Geist      | 13–14px           | 400    | 0em        |
| Input text          | Geist      | 16px (iOS zoom)   | 400    | 0.01em     |
| Button label        | Geist      | 13px              | 500    | 0.02em     |
| Kicker / label      | Geist Mono | 9–12px            | 400–500| 0.06–0.14em|
| Data cell           | Geist Mono | 10–13px           | 400    | 0.04em     |
| Sub-label           | Geist Mono | 8–9px             | 500    | 0.1–0.18em |

**Rules:**
- MONO uppercase + wide tracking for all metadata, labels, and kickers — never for body or headings
- Negative tracking only on display sizes (≥22px)
- `font-size: 16px` on all inputs — prevents iOS auto-zoom

## Color

- **Approach:** Restrained — accent is rare and meaningful; color signals role, not decoration

### Dark Mode (primary)

```
bg:           #13110E       // Coffee-warm dark, not cold OLED black
panel:        #1B1814       // Surface panels
panel2:       #23201B       // Nested/secondary surfaces
border:       rgba(245,234,222,0.07)
border2:      rgba(245,234,222,0.13)

text:         #F2EFE9       // Warm off-white, not pure white
text2:        #A8A39A       // Secondary text
muted:        #6A655C       // Disabled states, placeholders, metadata
dim:          #4A4640       // Weakest text

accent:       oklch(0.74 0.16 250)         // Electric blue — links, highlights, info
accentSoft:   oklch(0.74 0.16 250 / 0.18) // Accent backgrounds
live:         oklch(0.84 0.14 175)         // Mint/teal — "go" CTAs, positive action
liveSoft:     oklch(0.84 0.14 175 / 0.18) // Live backgrounds

green:        oklch(0.78 0.18 152)  // Win outcome only
red:          oklch(0.70 0.21 25)   // Loss outcome only
warn:         oklch(0.79 0.16 75)   // Warning state

surfaceGlass: rgba(34,30,26,0.55)   // Glass surface overlay
orb1:         oklch(0.55 0.22 252)  // Bloom accent 1
orb2:         oklch(0.45 0.20 268)  // Bloom accent 2
orb3:         oklch(0.68 0.18 175)  // Bloom accent 3 (mint)
shadow:       rgba(0,0,0,0.45)
```

### Light Mode (secondary)

```
bg:           #F4F2ED       // Warm cream, not cool grey
panel:        #FFFFFF
panel2:       #FAFAF6
text:         #0A0A0A
text2:        #55554F
muted:        #9A9890
accent:       oklch(0.55 0.18 252)  // Darker blue for light bg contrast
live:         oklch(0.62 0.14 175)  // Darker mint
green:        oklch(0.55 0.18 152)
red:          oklch(0.55 0.22 25)
```

**Dark mode is primary.** Light mode is a peer, not an afterthought — all components support both. The warm bg (`#F4F2ED`) and warm-toned text (`#0A0A0A` has a very slight warm cast) mirror the dark mode's warmth.

### Semantic usage rules

| Color    | Use for                                      | Never use for        |
|----------|----------------------------------------------|----------------------|
| accent   | Links, active state, info highlights, badges | Win/loss, CTAs       |
| live     | Primary action CTAs, "go" states             | Outcomes, branding   |
| green    | Win outcomes, positive deltas                | CTAs, accents        |
| red      | Loss outcomes, errors, negative deltas       | Warnings, decoration |
| warn     | Warning states only                          | Anything else        |

## Spacing

- **Base unit:** 4px
- **Density:** Comfortable (touch-first, not airy)
- **Minimum touch target:** 44px height on all interactive elements

### Scale

| Token | px  | Usage                              |
|-------|-----|------------------------------------|
| 2xs   | 2px | Icon gap, inner-element spacing    |
| xs    | 4px | Tight pairs                        |
| sm    | 8px | Component internal spacing         |
| md    | 12px| Standard internal padding          |
| lg    | 16px| Between related elements           |
| xl    | 20px| Section internal padding           |
| 2xl   | 24px| Between components                 |
| 3xl   | 32px| Section gaps                       |
| 4xl   | 48px| Major section breaks               |

**Standard patterns:**
- Input padding: `12px 0` (bottom-only border, editorial)
- Button padding: `14px 20px` (pill primary), `12px 18px` (pill ghost)
- Card padding: `16–24px`
- Nav item padding: `10px 22px`
- Screen horizontal: `20–24px`

## Layout

- **Approach:** Mobile-first stack, editorial discipline on desktop
- **Grid:** Single column on mobile; sidebar nav + content area on desktop (≥768px)
- **Max content width:** ~420px on mobile; sidebar 220px + content on desktop
- **Safe areas:** `env(safe-area-inset-*)` applied to body for notch/home-indicator clearance

### Border radius hierarchy

| Shape      | Radius  | Used for                              |
|------------|---------|---------------------------------------|
| Input      | 0       | Underline-only inputs (editorial)     |
| Item       | 8px     | Dropdown items, contextual menu rows  |
| Card       | 12–14px | Panels, cards, drawers, popovers      |
| Glass      | 16–24px | Glass overlay cards, orb surfaces     |
| Pill       | 999px   | All buttons, pills, avatars, badges   |

## Motion

- **Approach:** Intentional — every animation aids comprehension or provides emotional punctuation. Nothing moves without reason.
- **Easing:** enter(`cubic-bezier(.2,.8,.2,1)`) exit(`ease-in`) move(`ease-in-out`)
- **Reduced motion:** Full `prefers-reduced-motion: reduce` support — all durations collapse to `0.01ms`

### Duration scale

| Name   | Range      | Use                                           |
|--------|------------|-----------------------------------------------|
| micro  | 50–100ms   | State feedback, hover, press confirmation     |
| short  | 150–250ms  | Component transitions, color/opacity changes  |
| medium | 250–400ms  | Screen transitions, modal open/close          |
| long   | 400–700ms  | Celebrations, confetti, streak reveals        |

### Named keyframes (21)

`kSlideIn/Out` · `kFadeIn/Out` · `kScaleIn/Out` · `kDrawer` · `kPop` · `kShake` · `kPulse` · `kSpin` · `kGlow` · `kConfetti/A` · `kRise` · `kCount` · `kStreakGlow` · `kTick` · `kRipple` · `kShimmer` · `kSheen`

**Pattern:** all animation names prefixed `k` (e.g. `kSlideIn`). Legacy `rise` kept for backward compat only.

## Component Patterns

### Inputs — editorial underline style

```css
background: transparent;
border: none;
border-bottom: 1px solid <border2>;
border-radius: 0;
padding: 12px 0;
font-size: 16px; /* iOS zoom prevention */
```

Labels use Geist Mono uppercase, 12px, 0.05em tracking, `muted` color, 6px margin-bottom.

### Buttons

- **Primary pill:** text-on-bg, 999px radius, 14px/20px padding, weight 500
- **Live pill:** live-color background, for primary CTAs ("Start Session", "Log Trade")
- **Ghost pill:** transparent, border2 border, 12px/18px padding
- **Icon button:** 36–40px circle, border2 border

### Glass surfaces

Used for announcement cards, CTAs, overlay panels on key screens. Always paired with OKLCH orb bloom effects in the background:

```css
background: rgba(34,30,26,0.55);  /* dark */
backdrop-filter: blur(16px);
border: 1px solid <border2>;
border-radius: 16–24px;
```

Orb bloom: `radial-gradient` with orb1/orb2/orb3 colors at 15–22% opacity, positioned absolutely behind glass elements.

## Decisions Log

| Date       | Decision                             | Rationale                                                                                 |
|------------|--------------------------------------|-------------------------------------------------------------------------------------------|
| 2026-06-03 | Initial DESIGN.md created            | Formalized from theme.ts + shared.tsx + Koda.tsx; generated by /design-consultation       |
| 2026-06-03 | Coffee-warm dark (#13110E) as bg     | Beta testers flagged cold dark; warm bg retains focus without "dark web" feel              |
| 2026-06-03 | OKLCH color system adopted           | Perceptually uniform — saturation and lightness adjustments behave predictably             |
| 2026-06-03 | Electric blue + mint vs green-brand  | Green reserved for win outcomes; breaks from trading-tool category default                 |
| 2026-06-03 | Geist Mono for all labels/kickers    | Data-terminal credibility; creates clear prose/metadata hierarchy without a second typeface|
| 2026-06-03 | 16px input font-size enforced        | Prevents iOS auto-zoom on focus (WCAG / mobile UX requirement)                             |
| 2026-06-03 | 44px minimum touch target            | WCAG 2.5.5 / Apple HIG guidance for mobile touchscreens                                   |
