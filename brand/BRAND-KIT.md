# TikiTaka.vip Brand Kit

## Brand Name
- **Full**: TikiTaka.vip
- **Short**: TikiTaka / Tiki
- **Hebrew**: ניחושי מונדיאל 2026
- **Tagline (HE)**: קוף אמיתי ממקלט מנחש. אתם יכולים לנצח אותו?
- **Tagline (EN)**: A real shelter monkey predicts all 104 matches. Can you beat it?

## Colors

### Primary
| Name       | Hex       | Usage                              |
|------------|-----------|-------------------------------------|
| Navy       | `#0a0e17` | Background, text on light surfaces  |
| Gold       | `#c9a227` | Accent, CTAs, headings, highlights  |
| White      | `#e8e6e3` | Body text on dark backgrounds       |

### Secondary
| Name       | Hex       | Usage                              |
|------------|-----------|-------------------------------------|
| Card       | `#141b2d` | Card backgrounds                    |
| Card Alt   | `#1a2238` | Alternate card backgrounds          |
| Border     | `#1e2a45` | Borders, dividers                   |
| Muted      | `#7a8ba7` | Secondary text, labels              |
| Dimmed     | `#4a5568` | Tertiary text, hints                |

### Semantic
| Name       | Hex       | Usage                              |
|------------|-----------|-------------------------------------|
| Green      | `#27ae60` | Exact prediction, success           |
| Red        | `#c0392b` | Wrong prediction, errors, locked    |
| Blue       | `#2980b9` | Close prediction, info              |
| Orange     | `#e67e22` | Surprise multiplier, warnings       |

### Gradients
- **Header**: `linear-gradient(135deg, #1a1a2e, #16213e 50%, #0f3460)`
- **Gold glow**: `rgba(201,162,39,0.25)` overlay

## Typography

- **Font**: [Heebo](https://fonts.google.com/specimen/Heebo) (Google Fonts)
- **Weights**: 400 (body), 700 (labels), 800 (headings), 900 (titles, wordmark)
- **Direction**: RTL for Hebrew, LTR for English/scores
- **Fallback**: Arial, sans-serif

### Scale
| Element       | Size   | Weight |
|---------------|--------|--------|
| H1 / Title    | 2rem   | 900    |
| H2 / Section  | 1rem   | 800    |
| Body          | 0.9rem | 400    |
| Label / Muted | 0.85rem| 600–700|
| Small / Badge | 0.78rem| 600–800|

## Logo Variations

All in `/brand/`:

| File                  | Format | Usage                              |
|-----------------------|--------|------------------------------------|
| `logo-icon.svg`       | SVG    | App icon, favicon, profile pics    |
| `logo-full-dark.svg`  | SVG    | Horizontal — for dark backgrounds  |
| `logo-full-light.svg` | SVG    | Horizontal — for light backgrounds |
| `logo-stacked.svg`    | SVG    | Stacked — square contexts          |
| `profile-pic.svg`     | SVG    | Social media profile picture       |

### Logo Rules
- Minimum clear space: 1/4 of icon diameter on all sides
- Minimum size: 32px for icon, 120px wide for full logo
- Gold accent always on "Taka" in the wordmark
- ".vip" always in gold badge pill
- Never stretch, rotate, or recolor the logo
- Never place on busy backgrounds without a scrim

## Social Media Assets

| File                    | Size      | Platform                |
|-------------------------|-----------|-------------------------|
| `banner-whatsapp.svg`   | 1200×630  | WhatsApp, Facebook, OG  |
| `banner-instagram.svg`  | 1080×1080 | Instagram post/story    |
| `banner-telegram.svg`   | 1280×640  | Telegram channel banner |
| `profile-pic.svg`       | 400×400   | All profile pictures    |

## Existing App Assets (in `/public/`)

| File                   | Size    | Usage              |
|------------------------|---------|--------------------|
| `icon-192.png`         | 192×192 | PWA icon           |
| `icon-512.png`         | 512×512 | PWA icon           |
| `icon-maskable-512.png`| 512×512 | Android maskable   |
| `favicon.ico`          | multi   | Browser tab        |
| `og-image.png`         | 1200×630| OpenGraph sharing  |

## Voice & Tone
- Playful, competitive, slightly cheeky
- The monkey is the mascot — reference it often
- "Beat the monkey" is the core hook
- Hebrew-first for Israeli audience, English available
- Surprise predictions = more points — emphasize this mechanic

## PNG Export

To convert SVGs to PNGs, run:
```bash
# Requires librsvg2 or Inkscape
for f in brand/*.svg; do
  rsvg-convert -w 2048 "$f" -o "${f%.svg}.png"
done
```
