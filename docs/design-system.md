# CometCave Design System

> Cosmic-chunky visual language — dark-first, neon-accented, M3-shaped token system.

## Colors

All color values live as CSS custom properties in `src/app/globals.css`.
Component code **never** hard-codes hex values — it consumes only these tokens.

### Surfaces

| Token | Hex | Intent |
|---|---|---|
| `--surface` | `#0e0f1a` | Default app background |
| `--surface-dim` | `#0a0b14` | Deepest bg — hero overlays |
| `--surface-bright` | `#1e2030` | Elevated panels |
| `--surface-variant` | `#1a1c2e` | Chunky card body |
| `--surface-container` | `#141624` | Mid-level container |
| `--surface-container-lowest` | `#080916` | Drop-shadow / depth anchor |
| `--surface-container-low` | `#101220` | Subtle container |
| `--surface-container-high` | `#1e2038` | Raised container (nav, dialogs) |
| `--surface-container-highest` | `#262842` | Top-level overlay |
| `--surface-tint` | `#00ffc2` | Tint for elevation (primary glow) |

### Background

| Token | Hex | Intent |
|---|---|---|
| `--ds-background` | `#0a0b14` | Page background |
| `--on-background` | `#e4e1d6` | Body text on background |

### Primary (neon green)

| Token | Hex | Intent |
|---|---|---|
| `--ds-primary` | `#00ffc2` | CTAs, active states |
| `--on-primary` | `#003b2e` | Text on primary |
| `--primary-container` | `#00ffc2` | Chunky button fill, hero accents |
| `--on-primary-container` | `#002018` | Text inside primary container |
| `--primary-fixed` | `#7dfce0` | Fixed variant for static surfaces |
| `--primary-fixed-dim` | `#00e6ad` | Dimmed fixed variant |
| `--on-primary-fixed` | `#002018` | Text on primary-fixed |
| `--on-primary-fixed-variant` | `#005740` | Text on primary-fixed alt |
| `--inverse-primary` | `#006b54` | Primary on inverse (light) surface |

### Secondary (cyan)

| Token | Hex | Intent |
|---|---|---|
| `--ds-secondary` | `#14d1ff` | Info, links |
| `--on-secondary` | `#003544` | Text on secondary |
| `--secondary-container` | `#14d1ff` | Secondary container fill |
| `--on-secondary-container` | `#001e2b` | Text inside secondary container |
| `--secondary-fixed` | `#90e8ff` | Fixed variant |
| `--secondary-fixed-dim` | `#14d1ff` | Dimmed fixed |
| `--on-secondary-fixed` | `#001e2b` | Text on secondary-fixed |
| `--on-secondary-fixed-variant` | `#004d66` | Text on secondary-fixed alt |

### Tertiary (warm gold)

| Token | Hex | Intent |
|---|---|---|
| `--ds-tertiary` | `#ffba20` | Badges, streaks |
| `--on-tertiary` | `#3e2e00` | Text on tertiary |
| `--tertiary-container` | `#ffba20` | Warm badge / highlight fill |
| `--on-tertiary-container` | `#2c2000` | Text inside tertiary container |
| `--tertiary-fixed` | `#ffe08a` | Fixed variant |
| `--tertiary-fixed-dim` | `#ffba20` | Dimmed fixed |
| `--on-tertiary-fixed` | `#2c2000` | Text on tertiary-fixed |
| `--on-tertiary-fixed-variant` | `#5c4800` | Text on tertiary-fixed alt |

### Error

| Token | Hex | Intent |
|---|---|---|
| `--ds-error` | `#ff5449` | Error state |
| `--on-error` | `#690005` | Text on error |
| `--error-container` | `#93000a` | Error container fill |
| `--on-error-container` | `#ffdad6` | Text inside error container |

### Outline

| Token | Hex | Intent |
|---|---|---|
| `--outline` | `#484a5e` | Borders, dividers |
| `--outline-variant` | `#2e3044` | Subtle divider |

### Inverse

| Token | Hex | Intent |
|---|---|---|
| `--inverse-surface` | `#e4e1d6` | Inverse (light) surface |
| `--inverse-on-surface` | `#1a1c2e` | Text on inverse surface |

### On-surface

| Token | Hex | Intent |
|---|---|---|
| `--on-surface` | `#e4e1d6` | High-emphasis text |
| `--on-surface-variant` | `#c4c5d0` | Medium-emphasis text |

## Fonts

CSS custom properties set via `next/font/google` in `app/layout.tsx`:

| Token | Family | Weights | Role |
|---|---|---|---|
| `--font-headline` | Plus Jakarta Sans | 500, 800 | Headlines, hero text |
| `--font-body` | Be Vietnam Pro | 400, 500, 700 | Body copy (default) |
| `--font-label` | Lexend | 700 | Labels, caps, badges |

Icon font: **Material Symbols Outlined** (loaded via CDN `<link>`).

## Spacing

| Token | Value | Intent |
|---|---|---|
| `--space-unit` | `8px` | Base unit — smallest spacing increment |
| `--space-stack-gap` | `16px` | Vertical gap between stacked elements |
| `--space-gutter` | `24px` | Horizontal gap between columns/cards |
| `--space-margin` | `32px` | Outer margin for sections |
| `--space-component-padding-x` | `24px` | Horizontal padding inside components |
| `--space-component-padding-y` | `16px` | Vertical padding inside components |

## Radius

| Token | Value | Intent |
|---|---|---|
| `--radius-sm` | `1rem` | Default card/container radius |
| `--radius-lg` | `2rem` | Large cards, hero sections |
| `--radius-xl` | `3rem` | Nav pill, side-nav |
| `--radius-full` | `9999px` | Circular badges, pills |

## Typography

Font family tokens are set in `app/layout.tsx` (see Fonts above). The typography tokens below combine family, size, weight, and line-height for each semantic text style.

| Style | Size | Line-height | Weight | Tracking | Family |
|---|---|---|---|---|---|
| `headline-lg` | 40px (2.5rem) | 1.2 | 800 | -0.02em | `--font-headline` |
| `headline-md` | 32px (2rem) | 1.2 | 800 | — | `--font-headline` |
| `body-lg` | 18px (1.125rem) | 1.6 | 500 | — | `--font-body` |
| `body-md` | 16px (1rem) | 1.6 | 400 | — | `--font-body` |
| `label-caps` | 14px (0.875rem) | 1.0 | 700 | 0.05em | `--font-label` |

## Shadows

Shadow tokens define the "chunky" visual signature. Every solid drop-shadow pairs with a press offset for interactive elements.

### Chunky drop-shadows

| Token | Value | Paired press offset | Intent |
|---|---|---|---|
| `--shadow-card` | `0 8px 0 0 surface-container-lowest` | `--press-offset-card` (8px) | Game cards, content cards |
| `--shadow-hero` | `0 12px 0 0 surface-container-lowest` | `--press-offset-hero` (12px) | Hero sections, question cards |
| `--shadow-button` | `0 6px 0 0 surface-container-lowest` | `--press-offset-button` (6px) | Primary/secondary buttons |
| `--shadow-button-sm` | `0 4px 0 0 surface-container-lowest` | `--press-offset-button-sm` (4px) | Pill nav, score chips, small buttons |
| `--shadow-pressed` | `none` | — | Active/pressed state (remove shadow) |

### Neon glows

| Token | Value | Intent |
|---|---|---|
| `--shadow-glow-primary` | `0 0 20px primary/40%` | Primary accent hover/focus glow |
| `--shadow-glow-secondary` | `0 0 15px secondary/20%` | Secondary accent glow |
| `--shadow-glow-tertiary` | `0 0 15px tertiary/25%` | Tertiary/gold glow |
| `--shadow-glow-error` | `0 0 15px error/30%` | Error state glow |

### Inset rim lights

| Token | Value | Intent |
|---|---|---|
| `--shadow-rim-top` | `inset 0 2px 4px white/5%` | Subtle top highlight on cards |
| `--shadow-rim-inset-deep` | `inset 0 4px 10px black/50%` | Sunken input / recessed areas |

### Chunky-press recipes

Apply one class for the full drop-shadow + press-down effect:

| Class | Shadow token | Press offset | Use for |
|---|---|---|---|
| `.chunky-card` | `--shadow-card` | 8px | Clickable cards |
| `.chunky-hero` | `--shadow-hero` | 12px | Hero elements |
| `.chunky-button` | `--shadow-button` | 6px | Buttons |
| `.chunky-button-sm` | `--shadow-button-sm` | 4px | Small interactive elements |

Each recipe applies `transition: transform 0.1s ease, box-shadow 0.1s ease` and on `:active` sets `box-shadow: none` + `translateY(offset)`.

## Legacy tokens (to be removed)

The following primitive tokens in `tailwind.config.js` are legacy and will be replaced by semantic tokens during the redesign:

- `space-black`, `space-dark`, `space-grey`
- `space-purple`, `space-purple-light`, `space-blue`
- `cream-white`, `space-gold`, `grey-500`

Do not use these in new code.

---

> Full documentation lands in issue #535 (Redesign 06).
