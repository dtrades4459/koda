# Kōda OS — Brand assets reference

> Index of every brand asset shipped with the app and the export steps
> needed where SVG sources require PNG raster output. Companion to
> [`design-coverage.md`](design-coverage.md) cat11 rows.

---

## 1 · App icons (shipped as PNGs)

| File | Size | Purpose |
|---|---|---|
| `public/icon.svg` | scalable | Master vector |
| `public/icon-192.png` | 192×192 | Manifest icon |
| `public/icon-512.png` | 512×512 | Manifest icon, splash master |
| `public/icon-maskable-512.png` | 512×512 | Maskable (Android adaptive) |
| `public/icon-maskable.svg` | scalable | Maskable source |
| `public/apple-touch-icon.png` | 180×180 | iOS home-screen |
| `public/apple-touch-icon.svg` | scalable | iOS home-screen source |
| `public/favicon.svg` | scalable | Browser tab favicon |

---

## 2 · OG cards (per-page)

Vector sources in `public/`. Render to 1200×630 PNG via:
```sh
npx svgexport public/og-image-{page}.svg public/og-image-{page}.png 1200:630
```

| File | Used by | Variable copy |
|---|---|---|
| `public/og-image.svg` | Landing (root + default share) | "TRADE SMARTER." tagline |
| `public/og-image-pricing.svg` | `/pricing` page | "£24.99/mo" fixed |
| `public/og-image-blog.svg` | Any `/blog/*` page | `{{POST_TITLE_LINE_1}}`, `{{POST_TITLE_LINE_2}}`, `{{POST_READ_TIME}}` |
| `public/og-image-profile.svg` | Public profile pages | `{{NAME}}`, `{{HANDLE}}`, `{{INITIAL}}`, `{{NET_R}}`, `{{WIN_RATE}}`, `{{DISCIPLINE}}` |

Wire from each HTML page's `<head>`:
```html
<meta property="og:image" content="/og-image-pricing.png" />
<meta property="twitter:image" content="/og-image-pricing.png" />
```

Per-post / per-profile cards are rendered server-side at request time
(replace placeholders + render via Vercel OG image route — TODO).

---

## 3 · Social share cards

Single SVG source per platform aspect-ratio; PNG export with svgexport.

| File | Size | Platform |
|---|---|---|
| `public/share-card-ig-square.svg` | 1080×1080 | Instagram feed, X (1:1 crop), LinkedIn |
| `public/share-card-ig-story.svg` | 1080×1920 | Instagram story / Reels, TikTok |

Variables: `{{KICKER}}`, `{{VALUE}}`, `{{SUBTITLE}}`. Filled by the
WeeklyReportCard / Year-in-review export pipeline (cat09).

For X (Twitter) landscape — use `og-image.svg` (1200×630) directly.
For Facebook + LinkedIn — they accept the OG 1200×630 too.

---

## 4 · Splash screens (PWA)

Source template: `public/splash-template.svg`. Inline comment lists the
8 device-specific sizes Apple requires for `apple-touch-startup-image`.

Export each size:
```sh
npx svgexport public/splash-template.svg public/splash-1170x2532.png 1170:2532
npx svgexport public/splash-template.svg public/splash-1290x2796.png 1290:2796
# …repeat for the rest
```

Wire in `index.html`:
```html
<link rel="apple-touch-startup-image" href="/splash-1170x2532.png"
      media="(device-width: 393px) and (device-height: 852px)
             and (-webkit-device-pixel-ratio: 3) and (orientation: portrait)" />
```

Android doesn't need device-specific splashes — Chrome auto-generates from
the 512×512 maskable icon + `theme_color` + `background_color` in the
manifest.

---

## 5 · Press kit

The press page (`public/press.html`) renders all of:
- Logo + wordmark downloads (light + dark)
- App icon download
- Favicon download
- Boilerplate copy (short + standard)
- Pull quotes from the founder
- Fact-sheet grid (name, founder, HQ, category, pricing, status)
- Do / don't brand rules
- Founder bio

When you add new assets, also update the press page's asset grid so
journalists / partners can find them.

---

## 6 · Colour tokens

Palette in [`src/theme.ts`](../src/theme.ts) (canonical):

| Token | OKLCH | Hex (approx) | Use |
|---|---|---|---|
| `bg` | — | `#0A0A0B` | Page background (auth) |
| `bg` (warm) | — | `#13110E` | Page background (app) |
| `ink` | — | `#F2F2EE` | Primary text |
| `ink2` | — | `#A6A6A2` | Body text |
| `mute` | — | `#65655F` | Captions / meta |
| `live` | `oklch(0.84 0.14 175)` | mint | Brand accent, CTA |
| `accent` | `oklch(0.72 0.16 252)` | blue | Info / informational |
| `green` | `oklch(0.78 0.18 152)` | green | Win outcomes only |
| `red` | `oklch(0.70 0.21 25)` | red | Loss outcomes only |
| `warn` | `oklch(0.79 0.16 75)` | amber | Caution states |

Reminder: green / red are **outcomes only**. Don't use them for UI
affordances. The "go" colour is mint live.

---

## 7 · Type stack

- **Display + body:** `Geist`
- **Mono / labels:** `Geist Mono`
- **Both loaded from Google Fonts**, family weights 400 / 500 / 600 / 700

System fallback: `Inter, system-ui, sans-serif` (display/body) and
`ui-monospace, monospace` (mono).

---

## Maintenance

When you add a per-page OG card or a new export size:
1. Add the SVG source to `public/`.
2. Add an `svgexport` command to your build / a `package.json` script.
3. Update the table in this doc.
4. Wire the `<meta property="og:image">` (or `<link rel="apple-touch-startup-image">`) into the consuming HTML.
