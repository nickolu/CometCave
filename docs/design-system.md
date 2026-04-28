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

## Legacy tokens (to be removed)

The following primitive tokens in `tailwind.config.js` are legacy and will be replaced by semantic tokens during the redesign:

- `space-black`, `space-dark`, `space-grey`
- `space-purple`, `space-purple-light`, `space-blue`
- `cream-white`, `space-gold`, `grey-500`

Do not use these in new code.

---

> Full documentation lands in issue #535 (Redesign 06).
