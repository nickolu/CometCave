---
name: CometCave
description: A dim arcade of hand-built worlds. Chunky, pressable, lit by three neon colors.
colors:
  comet-mint: "#00ffc2"
  comet-mint-light: "#7dfce0"
  comet-mint-dim: "#00e6ad"
  on-comet-mint: "#002018"
  signal-cyan: "#14d1ff"
  signal-cyan-light: "#90e8ff"
  on-signal-cyan: "#001e2b"
  ember-gold: "#ffba20"
  ember-gold-light: "#ffe08a"
  on-ember-gold: "#2c2000"
  alert-coral: "#ff5449"
  on-alert-coral: "#690005"
  alert-coral-container: "#93000a"
  on-alert-coral-container: "#ffdad6"
  cave-floor: "#080916"
  cave-ink: "#0a0b14"
  surface: "#0e0f1a"
  surface-container-low: "#101220"
  surface-container: "#141624"
  surface-variant: "#1a1c2e"
  surface-bright: "#1e2030"
  surface-container-high: "#1e2038"
  surface-container-highest: "#262842"
  outline: "#484a5e"
  outline-variant: "#2e3044"
  on-surface: "#e4e1d6"
  on-surface-variant: "#c4c5d0"
typography:
  headline:
    fontFamily: "Plus Jakarta Sans, sans-serif"
    fontSize: "2.5rem"
    fontWeight: 800
    lineHeight: 1.2
    letterSpacing: "-0.02em"
  title:
    fontFamily: "Plus Jakarta Sans, sans-serif"
    fontSize: "2rem"
    fontWeight: 800
    lineHeight: 1.2
  body-lg:
    fontFamily: "Be Vietnam Pro, Arial, sans-serif"
    fontSize: "1.125rem"
    fontWeight: 500
    lineHeight: 1.6
  body:
    fontFamily: "Be Vietnam Pro, Arial, sans-serif"
    fontSize: "1rem"
    fontWeight: 400
    lineHeight: 1.6
  label:
    fontFamily: "Lexend, sans-serif"
    fontSize: "0.875rem"
    fontWeight: 700
    lineHeight: 1
    letterSpacing: "0.05em"
rounded:
  sm: "1rem"
  lg: "2rem"
  xl: "3rem"
  full: "9999px"
spacing:
  unit: "8px"
  stack-gap: "16px"
  gutter: "24px"
  margin: "32px"
  component-px: "24px"
  component-py: "16px"
components:
  button-primary:
    backgroundColor: "{colors.comet-mint}"
    textColor: "{colors.on-comet-mint}"
    typography: "{typography.label}"
    rounded: "{rounded.full}"
    padding: "0 24px"
    height: "40px"
  button-primary-hero:
    backgroundColor: "{colors.comet-mint}"
    textColor: "{colors.on-comet-mint}"
    typography: "{typography.label}"
    rounded: "{rounded.full}"
    padding: "0 40px"
    height: "56px"
  button-secondary:
    backgroundColor: "{colors.signal-cyan}"
    textColor: "{colors.on-signal-cyan}"
    typography: "{typography.label}"
    rounded: "{rounded.full}"
    padding: "0 24px"
    height: "40px"
  button-ghost:
    backgroundColor: "transparent"
    textColor: "{colors.on-surface}"
    typography: "{typography.label}"
    rounded: "{rounded.full}"
    padding: "0 24px"
    height: "40px"
  button-exit:
    backgroundColor: "{colors.surface-container-high}"
    textColor: "{colors.alert-coral}"
    typography: "{typography.label}"
    rounded: "{rounded.full}"
    padding: "0 24px"
    height: "40px"
  card:
    backgroundColor: "{colors.surface-variant}"
    textColor: "{colors.on-surface}"
    rounded: "{rounded.sm}"
    padding: "16px 24px"
  card-hero:
    backgroundColor: "{colors.surface-container}"
    textColor: "{colors.on-surface}"
    rounded: "{rounded.sm}"
    padding: "48px 32px"
  pill-hot:
    backgroundColor: "{colors.alert-coral}"
    textColor: "{colors.on-alert-coral}"
    typography: "{typography.label}"
    rounded: "{rounded.full}"
    padding: "4px 12px"
  pill-info:
    backgroundColor: "{colors.signal-cyan}"
    textColor: "{colors.on-signal-cyan}"
    typography: "{typography.label}"
    rounded: "{rounded.full}"
    padding: "4px 12px"
  nav-pill-active:
    backgroundColor: "{colors.comet-mint}"
    textColor: "{colors.on-comet-mint}"
    typography: "{typography.label}"
    rounded: "{rounded.sm}"
    padding: "12px 24px"
  input:
    backgroundColor: "{colors.surface-container}"
    textColor: "{colors.on-surface}"
    typography: "{typography.body}"
    rounded: "6px"
    padding: "8px 12px"
    height: "40px"
---

# Design System: CometCave

## Overview

**Creative North Star: "The Arcade Cabinet in the Dark"**

CometCave's shell is a dim arcade. The room is near-black ink; the light comes from the machines. Every control is a piece of hardware you could find on a cabinet: a thick pill button that sinks when you press it, a backlit panel with a hard edge, a marquee pill that pulses once to say something is new. Surfaces are slabs with real thickness, shown by a solid, unblurred drop shadow in the deepest surface color. Nothing floats; everything sits on the floor and can be pushed down into it. Three neon colors do all the talking: Comet Mint for the thing you should press, Signal Cyan for information, Ember Gold for reward. They glow only when a hand is near.

The cave is deliberately quiet so the worlds inside it can be loud. The shell has low motion, no ambient sound, restrained color on a dark field, and a single accent per screen region. Each game is free to be its own visual dimension (Comet Cards' scoped mint-and-pink palette, Clusters' tier colors, Starmatch's sigil set, Tap Tap Adventure's Paper Stage), but it keeps the shared pact: the same body font, the same primary-action color for the main action, and the shared shell components for exit, share, pause, score and sign-up.

Confirmed anti-references: generic SaaS dark mode (flat cards, 1px borders, soft blurry shadows, gradient buttons); casino and slot-machine neon (everything glowing at once); flat corporate Material (tonal surfaces with no physicality, even though the token names are M3-shaped); and kids-app bubblegum (primary colors, cartoon gradients). All-ages must never read as toddler.

**Key Characteristics:**
- Near-black ink field; depth comes from a nine-step surface ladder, not from blur.
- Solid hard-offset shadows (4, 6, 8, 12px) that collapse on press. Shadow means pressable.
- Three neon accents with strict jobs: mint acts, cyan informs, gold rewards. Coral is for error and "hot" only.
- Pill geometry everywhere interactive; 1rem slabs for cards; 3rem sweeps for the shell's big housings.
- Label type is uppercase, tracked, bold Lexend; headlines are heavy Plus Jakarta Sans; body is Be Vietnam Pro.
- Glow is a state (hover, focus, active segment), never a resting decoration.
- Reduced motion is honored globally: every animation and transition collapses to near-zero duration.

## Colors

A near-black navy field lit by three neon signs, with a coral reserved for alarm.

### Primary
- **Comet Mint** (`#00ffc2`, `--ds-primary` / `--primary-container`): the one color that means "press this". Primary buttons, the active nav item, the active progress segment, focus outlines, the brand mark. Its ink is **Deep Mint Ink** (`#002018`, `--on-primary-container`). **Mint Light** (`#7dfce0`) and **Mint Dim** (`#00e6ad`) are the fixed variants for static tints and pressed fills.

### Secondary
- **Signal Cyan** (`#14d1ff`, `--ds-secondary` / `--secondary-container`): information and secondary actions. The "NEW RELEASE" pill, the secondary button, the utility button's translucent tint (cyan at 20% over surface), links. Ink is **Deep Cyan Ink** (`#001e2b`). **Cyan Light** (`#90e8ff`) is the fixed tint.

### Tertiary
- **Ember Gold** (`#ffba20`, `--ds-tertiary` / `--tertiary-container`): reward and warmth. Streak badges, the score chip's star and multiplier, the "Arcade Floor" section icon, the nickname dialog title. Ink is **Deep Gold Ink** (`#2c2000`). **Gold Light** (`#ffe08a`) is the fixed tint.

### Error
- **Alert Coral** (`#ff5449`, `--ds-error`): error text, wrong answers, the exit button's label, and the one non-error use: the "HOT!" pill on the featured game. Ink on coral is `#690005`. The container pair is `#93000a` with `#ffdad6` text.

### Neutral
- **Cave Floor** (`#080916`, `--surface-container-lowest`): the depth anchor. Every hard shadow is this color; it is also the top nav's fill, the footer, and the 4px card border. It is the floor everything sits on.
- **Cave Ink** (`#0a0b14`, `--surface-dim` / `--ds-background`): the page background.
- **Surface ladder** (`#0e0f1a` surface → `#101220` container-low → `#141624` container → `#1a1c2e` surface-variant → `#1e2030` surface-bright → `#1e2038` container-high → `#262842` container-highest): nine tonal steps from floor to the brightest panel. Cards are surface-variant; answer options, the exit button and the score chip are container-high; progress tracks are container-highest.
- **Outline** (`#484a5e`) and **Outline Variant** (`#2e3044`): borders and dividers; the icon ring on game tiles uses outline-variant.
- **Bone** (`#e4e1d6`, `--on-surface`): high-emphasis text. Slightly warm, never pure white.
- **Bone Dim** (`#c4c5d0`, `--on-surface-variant`): medium-emphasis text, descriptions, inactive nav labels.

### Named Rules
**The One Press Color Rule.** Comet Mint is the primary-action color on every surface in the cave and inside every game. If two things on a screen are mint, one of them is wrong.

**The Floor Shadow Rule.** Shadows are never black or gray with alpha. They are solid Cave Floor (`#080916`) with zero blur, so a slab reads as a slab sitting on the same floor as everything else.

**The Hex Lives in One File Rule.** Hex values exist only in the `:root` block of `src/app/globals.css`. Components consume tokens through Tailwind classes (`bg-primary-container`, `text-on-surface`) or `var(--…)`. ESLint enforces this.

## Typography

**Headline Font:** Plus Jakarta Sans (self-hosted variable 200–800; fallback sans-serif)
**Body Font:** Be Vietnam Pro (self-hosted 400 / 500 / 700; fallback Arial, sans-serif)
**Label Font:** Lexend (self-hosted variable 100–900, used at 700; fallback sans-serif)
**Icon Font:** Material Symbols Outlined (weight 600, FILL 1 when active or featured)
**Scoped Display Font:** Abril Fatface 400 (self-hosted latin + latin-ext as `--font-playbill`, set only on the `.paper-stage` wrapper by `src/app/tap-tap-adventure/layout.tsx`; see Paper Stage under Scoped worlds). It never appears in the shell.

**Character:** Heavy, rounded geometric headlines over a plain, legible humanist body, with a wide-set uppercase label face for anything that behaves like a button or a badge. The pairing reads like cabinet signage: the title is painted big, the controls are stamped.

### Hierarchy
- **Headline** (800, 2.5rem / 40px, line-height 1.2, tracking -0.02em): the page title. On the home hero it carries a 4px solid Cave Floor drop shadow so it sits on the panel like printed lettering.
- **Title** (800, 2rem / 32px, line-height 1.2): section heads ("Arcade Floor") and card titles. Section heads pair with a 32px filled gold icon.
- **Tile Title** (700, 1.125rem / 18px, headline face): game tile names. Below Title, above Body.
- **Body Large** (500, 1.125rem / 18px, line-height 1.6): hero subtitle and answer-option text.
- **Body** (400, 1rem / 16px, line-height 1.6): descriptions and dialog copy. Tile descriptions step down to 14px.
- **Label Caps** (700, 0.875rem / 14px, line-height 1, tracking 0.05em, uppercase, Lexend): every button, nav item, pill and badge. Buttons widen the tracking further (`tracking-widest`, 0.1em).

### Named Rules
**The Stamped Control Rule.** If it can be pressed or it tags something, it is set in uppercase Lexend with tracked letters. Buttons, nav pills, badges and chips never use the body face.

**The Three Faces Rule.** Headline, body and label are three different fonts with three different jobs. Do not set a headline in Lexend or a label in Plus Jakarta Sans. The generic `Typography` component in `src/components/ui/typography.tsx` predates this system and is legacy.

## Layout

The shell is a centered column with a floating control bar above it and a thick-lipped footer below.

- **Container:** Tailwind container, centered, 2rem side padding, maximum 1400px. Home content narrows further to 64rem (`max-w-5xl`) and stacks sections with a 3rem gap and 3rem vertical padding.
- **Top nav (all sizes):** a sticky pill, 1rem from the top and sides, maximum 80rem wide. Fill is Cave Floor at 90% with backdrop blur, a 4px Cave Floor border, and the 6px button shadow. Brand mark left, inline nav pills scrolling horizontally in the middle, account pill right.
- **Side nav (game shell, ≥768px):** a fixed 280px rail, full height, filled surface-container-low at 95% with blur, swept on the right with a 3rem radius, 4px Cave Floor right border, 12px hero shadow. Content shifts right by 280px. Hidden below 768px.
- **Game grid:** one column on phones, two from 768px, three from 1024px, with the 24px gutter token between tiles. Tiles stretch to equal height.
- **Spacing rhythm:** an 8px unit. Component padding is 24px horizontal and 16px vertical. Stacked elements sit 16px apart, columns 24px, sections 32px.
- **Immersive routes** (Comet Cards, Micro Land, Speck Wars play and skirmish, Meteor Coins, Voice Journey, Tap Tap Adventure) drop the nav, footer and ambient orbs entirely and own the whole window; since 11 Nov 2026 this is the stance for every game, applied as each is revisited (`IMMERSIVE_ROUTES` in `src/components/layout-shell.tsx`). An immersive game carries its own "Return to the cave" door top-left; Tap Tap Adventure's `CaveExit` is the first one built. On phones, a game that sets `body.game-active` hides the header and footer and pads main by 0.5rem.
- **Backdrop:** three fixed, blurred circles (mint, cyan, gold at 20% opacity, 16–24rem wide) sit behind the page at deterministic positions. They are the only ambient color in the shell and never move.
- **Footer:** Cave Floor fill, swept top corners at 3rem, a 1px white-at-5% top rim, 3rem vertical padding, centered brand mark.

### Named Rules
**The Quiet Shell Rule.** The shell's motion budget is a 200ms cross-fade on route change and the 100ms press. Bounce, parallax, ambient animation and sound stay inside games.

## Elevation & Depth

Depth is physical, not atmospheric. The system has no soft shadows at all. Every lifted surface shows a solid, zero-blur drop shadow in Cave Floor whose length is the surface's thickness, and pressing the surface moves it down by exactly that length while the shadow disappears. Static depth between panels comes from the nine-step surface ladder and from borders: a 4px Cave Floor border with a 1px white-at-5% top edge gives a slab a lit rim. Neon glow is a second, separate vocabulary used only to signal state.

### Shadow Vocabulary
- **Card** (`box-shadow: 0 8px 0 0 var(--surface-container-lowest)`, press offset 8px): game tiles and content cards.
- **Hero** (`0 12px 0 0 var(--surface-container-lowest)`, press offset 12px): the home hero panel, question cards, the side nav, dialogs.
- **Button** (`0 6px 0 0 var(--surface-container-lowest)`, press offset 6px): primary and secondary buttons, the top nav bar.
- **Button Small** (`0 4px 0 0 var(--surface-container-lowest)`, press offset 4px): pills, score chips, answer options, exit and utility buttons.
- **Pressed** (`none`): the active state of anything above, paired with `translateY(offset)`.
- **Glow Primary** (`0 0 20px rgba(0,255,194,0.4)`): mint hover and focus, the active progress segment, the active block nav pill.
- **Glow Secondary** (`0 0 15px rgba(20,209,255,0.2)`), **Glow Tertiary** (`0 0 15px rgba(255,186,32,0.25)`), **Glow Error** (`0 0 15px rgba(255,84,73,0.3)`): the same for their colors.
- **Rim Top** (`inset 0 2px 4px rgba(255,255,255,0.05)`): a lit top edge on tracks and panels.
- **Rim Inset Deep** (`inset 0 4px 10px rgba(0,0,0,0.5)`): sunken wells, such as empty progress segments and recessed inputs.

### Named Rules
**The Pressable Shadow Rule.** A hard-offset shadow means the element can be pressed, and pressing it removes the shadow and sinks the element by the shadow's length. Static content does not cast one. The incumbent exceptions are the shell's fixed housings: the top nav bar, the side nav, the home hero panel and dialogs. Treat those as the cabinet's body, not as permission to shadow new static panels.

**The Glow Is State Rule.** Neon glow appears on hover, focus-visible, and the current item. Nothing glows at rest except the active nav pill and the active progress segment.

**The Press Travels Rule.** Press-down is `transition: transform 0.1s ease, box-shadow 0.1s ease`. Under `prefers-reduced-motion` the translate is suppressed and only the shadow collapses.

## Shapes

Two silhouettes: the pill and the slab. Anything you press is a full pill (`9999px`). Anything that holds content is a slab with 1rem corners (`--radius-sm`), a 4px Cave Floor border and a 1px white-at-5% top edge. The shell's three big housings (top nav pill, side nav, footer) sweep at 3rem (`--radius-xl`); dialogs use 2rem (`--radius-lg`). Icon wells are circles with a 2px outline-variant ring. The legacy shadcn radius (`--radius`, 0.5rem, giving `rounded-md`) survives only on the text input and legacy components; it is not the cave's corner.

Borders are thick and the same color as shadows, so edge and depth read as one material. Thin 1px borders appear only as the lit top rim (white at 5%) or as the dialog's outline-variant stroke.

### Named Rules
**The Pill or Slab Rule.** Interactive controls are pills. Containers are 1rem slabs. There is no third shape in the shell, and nothing is a sharp rectangle.

## Components

Tactile and confident. Thick, pressable, high-contrast: you know what will happen before you touch it. The chunky system is canonical. The shadcn `Button` and `Toast` in `src/components/ui/` are legacy, kept for dialogs and forms until replaced, and are never used for a primary action.

### Buttons (ChunkyButton, `src/components/ui/chunky-button.tsx`)
- **Shape:** full pill by default (`rounded-full`); `block` shape uses the 1rem slab corner.
- **Type:** Label Caps, uppercase, `tracking-widest`, Lexend 700.
- **Sizes:** sm 32px tall / 16px side padding; md 40px / 24px; lg 48px / 32px; hero 56px / 40px with 16px type.
- **Primary:** Comet Mint fill, Deep Mint Ink text, 6px Button shadow. Hover adds Glow Primary. Press: shadow off, sinks 6px.
- **Secondary:** Signal Cyan fill, Deep Cyan Ink text, same shadow and press. Hover adds Glow Secondary.
- **Ghost:** transparent, Bone text, no shadow. Hover tints surface-container-high at 60% and scales 1.05. Does not sink.
- **Exit:** surface-container-high fill, Alert Coral text, 4px Button Small shadow and press. The shared "back to the cave" affordance.
- **Utility:** cyan at 20% fill, cyan text, 4px shadow and press. Hover deepens the tint to 30%.
- **Focus:** 2px outline in Comet Mint, offset 2px, on `focus-visible` only.
- **Disabled:** 50% opacity, no pointer events.

### Cards (ChunkyCard, `src/components/ui/chunky-card.tsx`)
- **Corner Style:** 1rem slab.
- **Background:** surface-variant by default; surface-container for the hero; surface-container-high for raised panels.
- **Border:** 4px Cave Floor on all sides, overridden to 1px white-at-5% on top. The hero uses 6px.
- **Shadow Strategy:** Card (8px) by default, Hero (12px) for the hero, none for flat panels.
- **Interactive:** lifts 8px on hover over 200ms and shows a pointer. Game tiles are interactive; the hero is not.
- **Corner glow:** an optional 96px blurred circle of mint, cyan or gold at 30% bleeding from the top-right corner. Game tiles use mint.
- **Internal Padding:** 16px vertical, 24px horizontal via the component tokens. Tiles center their content: a 64px icon well, an optional HOT pill, an 18px headline-face title, a 14px description in Bone Dim.

### Pills (Pill and ScoreChip, `src/components/ui/pill.tsx`)
- **Style:** full pill, Label Caps uppercase bold, 4px Button Small shadow, 1px white-at-5% top rim. Sizes xs (10px type) and sm (12px type).
- **Tones:** info is cyan on Deep Cyan Ink; hot is Alert Coral on `#690005`; success is mint; warning is gold; neutral is surface-variant with Bone Dim text.
- **Pulse:** the HOT pill pulses with Tailwind's `animate-pulse`, suppressed under reduced motion. It is the only resting animation in the shell.
- **ScoreChip:** surface-container-high pill with a gold star icon, an optional gold `x{n}` multiplier in Lexend, and the score in headline face. The shared score display.

### Navigation (NavPill, `src/components/ui/nav-pill.tsx`)
- **Inline (top bar):** Label Caps at 12px, 12px side padding, a 4px bottom border that is transparent at rest and Comet Mint when current; current text is Bone, inactive is Bone Dim. Hover scales 1.05.
- **Block (side rail):** full width, 24px side padding, 12px vertical, 1rem corners, with a 20px Material Symbol. Current is a Comet Mint fill with Deep Mint Ink text and Glow Primary, and the icon switches to FILL 1. Hover tints surface-container-high at 60%.
- **Current page** is marked with `aria-current="page"`.

### Answer Option (`src/components/ui/answer-option.tsx`)
The signature game control. A full-width slab (1rem corners, surface-container-high, minimum 88px tall, 24px side padding) with a 2px border, a 4px shadow and Body Large text. A 48px circular letter badge in headline face sits at the left. Idle: outline-variant border, lifts 4px with Glow Primary on hover, sinks 4px on press. Focused or selected: mint border, already lifted, glowing. Correct: mint border over mint at 15%, badge becomes a check. Wrong: coral border over coral at 15%, badge becomes an X. Disabled: 60% opacity.

### Progress Segments (`src/components/ui/progress-segments.tsx`)
A pill-shaped track (surface-container-highest, 8px padding, Rim Top) holding equal 12px-tall segments. Filled segments run a mint-to-cyan gradient with Glow Primary and a skewed white sheen (hidden under reduced motion). The current segment is a hollow mint-bordered well with glow. Empty segments are sunken with Rim Inset Deep. Correct and incorrect results use green and red gradients with their own glows. Exposes `role="progressbar"` and per-segment labels.

### Inputs (`src/components/ui/input.tsx`)
- **Style:** 40px tall, surface-container fill, 1px `border-input` stroke, 6px corners (legacy radius), 12px side padding, 16px body type, Bone text with Bone Dim placeholder at 70%.
- **Focus:** a 2px Comet Mint ring offset 2px against surface-container-low.
- **Disabled:** 50% opacity, not-allowed cursor.
- The nickname dialog is the reference form: a 2rem-cornered surface-container panel with an outline-variant stroke and Hero shadow over a Cave Ink scrim at 80% with blur; a gold title; a character count in Bone at 40%; coral error text; a two-column Cancel (secondary) and Save (primary) pair.

### Brand Mark (`src/components/brand-mark.tsx`)
"COMET" in Comet Mint and "CAVE" in Bone Dim, headline face, bold, tight tracking, with a 2px solid Cave Floor drop shadow. Sizes 18px, 24px, 36px. Text only; there is no logo asset yet.

### Scoped worlds
Games may define their own palettes inside a scoping class, as Comet Cards does with `.cosmic-cards` (a softer mint `#5eead4`, pink `#ff6b9d`, gold `#ffd166`, JetBrains Mono for numbers) and Clusters does with its four tier colors. These are the worlds being loud, not the cave drifting. They still use Be Vietnam Pro for body text and the shared components for the pact verbs. Note that Comet Cards' primary action uses its scoped mint rather than Comet Mint; that is an incumbent variance from the One Press Color Rule, not a model for new games.

#### Paper Stage (Tap Tap Adventure, `.paper-stage`)

**Creative idea:** a Victorian paper toy theatre that owns the whole window: a peacock-blue and gilt proscenium framing a cobalt night, painted card flats that slide in from the wings on every step, the people as cut-outs on sticks, and every panel a playbill hanging in the wings. The scoping class is set by `src/app/tap-tap-adventure/layout.tsx`; the tokens live in the `.paper-stage` block at the end of `src/app/globals.css` (the only place the stage's hex may appear) and reach components as `ps-*` Tailwind colours (`color-mix` with `<alpha-value>`, so `/nn` modifiers work). The primitives are in `src/app/tap-tap-adventure/stage/`; its `README.md` is the working rulebook for setting a panel.

**Colours (hex as shipped in globals.css; the later "Poster paint" block is the final word on the flats).**
- *The house.* **Peacock Lacquer** (`#22668a`): the proscenium's 10–14px side posts and the pelmet. **Lacquer Deep** (`#164a66`): hover fill on brass-outlined controls and ticket stubs. **Lacquer Ink** (`#0c2436`): the top band, the wings (at 70%), the apron floor, the footlights row, foe cut-outs, and the deep half of the card shadow. **Gilt Brass** (`#d9a441`): brass plates, the proscenium's 5px inner trim, the pelmet rule, the focus of the foyer's dashed "print a new character" card. **Brass Light** (`#f2d27a`): type on the dark house (stubs, placards, log heading, the Cave door) and the daytime sun. **Brass Deep** (`#8a6420`): the 4px band borders, stub and plate edges, the thin scrollbar, the cut-out's stick. **Cobalt Night** (`#141c4a`): the backcloth at nightfall. **Cobalt Deep** (`#0c1030`): the proscenium floor behind the flats. **The House** (`#0a0b16`): the window fill, the sheet scrim (at 55%), and the flats' thickness (at 45%).
- *Paper.* **Playbill** (`#f1e4c3`): the only surface that carries body text; every sheet, drawer, dialog, name bill and the moon. **Playbill Edge** (`#d9c89a`): the first 3px of the card shadow and the paper placard's border. **Playbill Shade** (`#e3d3a8`): a second paper tone for panel wells. **Ink** (`#2b1a10`): text, every 2px border on paper, ink buttons, the hero and party cut-outs. **Ink Soft** (`#5c4a3a`): secondary text, captions, ink-button hover. **Ink Faint** (`#8a7a66`): tertiary text and disabled ledger lines.
- *Stamp inks.* **Red** (`#b3261e`), **Green** (`#2f7a4e`), **Blue** (`#27518a`), **Violet** (`#6b3fa0`), **Gold** (`#a8731a`): the printer's one-colour inks, for deltas (`deltaTone`: green up, red down), rarity, tags and warnings. Red is also the caret and the paper selection colour.
- *Footlights.* **Comet Mint** via `--ps-footlight: var(--ds-primary)` with the cave's ink, plus a dedicated glow (`0 0 28px rgba(0,255,194,0.45)`) used only while auto-walking.
- *Flats, per region (sky / far / mid / near / ground).* Green Meadows `#5fb4e6` / `#74b84a` / `#4e9a3a` / `#2f7a2a` / `#8a5a2e` (also the default so the stage is never unpainted). Dark Forest `#2e4a66` / `#1f6a4a` / `#155238` / `#0d3a27` / `#3a2718`. Crystal Caves `#241f5a` / `#7b5ce6` / `#5a3fc0` / `#3b2a8a` / `#1c1a3a`. Scorched Wastes `#f2a24a` / `#d9662a` / `#b5461a` / `#8a2f12` / `#5a2a10`. Frozen Peaks `#8fd0f5` / `#a9d6ee` / `#6fa8cc` / `#4a84ab` / `#e8f4fb`. Shadow Realm `#2c1548` / `#5e2f7a` / `#43205c` / `#2a1240` / `#120a1a`. Sky Citadel `#4aa3f0` / `#eaf3ff` / `#b9d4f2` / `#87b0e0` / `#5f8fc6`. Abyssal Depths `#073a5c` / `#0f6a8e` / `#0b5070` / `#073a55` / `#041a2a`. Celestial Throne `#ffd97a` / `#ffc14a` / `#f0a52a` / `#d98a1a` / `#b07a1a`. Sunken Ruins `#3f9a9a` / `#2f8080` / `#1f6565` / `#144a4a` / `#113535`. Volcanic Forge `#4a1a10` / `#ff7a2a` / `#e04a1a` / `#9a2a10` / `#4a1a0a`. The cut-out ink (`--ps-cutout`) is Ink.
- *Time of day* is a gel rectangle over the whole scene: morning `rgba(255,220,160,0.18)`, midday none, afternoon `rgba(255,170,90,0.16)`, nightfall `rgba(13,22,64,0.35)` with the sky swapped to Cobalt Night.

**Type (three faces on one ramp, Tailwind sizes only).**
- **Playbill** (Abril Fatface 400, uppercase unless it is a scene headline): titles, names, figures. `PlaybillTitle` sm 14px / md 18px (both `tracking-widest`) / lg 24px→30px at `sm` (`tracking-wide`), ruled above and below with 2px Ink. Brass figures 16px→24px at `md`, tabular. The WALK word 20px→30px at `md`. Ticket stubs 14px vertical, 12px horizontal. Cut-out name bills 12px. The face has one weight; nothing is bolded.
- **Label** (Lexend 700, 12px, uppercase, `tracking-widest`): `PlaybillCaption` ("DAY 5 · MORNING · 212 KM · GREEN MEADOWS"), `Stamp`, `Placard`, `PaperButton`, sub-tabs, the WALK bar's sub-line, the Cave door.
- **Body** (Be Vietnam Pro): 16px for the story and the printed choices, 14px for panel copy, 12px for ledger lines; never smaller. Secondary text is Ink Soft, never gray.
- Shell faces inside the stage: the cave's headline face (Plus Jakarta Sans) does not appear; the shared `ChunkyButton` keeps its Lexend label.

**Materials and their components (`src/app/tap-tap-adventure/stage/Playbill.tsx` unless noted).**
- **PlaybillSheet** (`.ps-paper`): Playbill fill with a faint laid texture (1px Ink at 3.5% every 3px), 2px Ink border, 3px corners, and a second 1px Ink-at-60% rule inset 5px (the playbill's double border). Card shadow `0 3px 0 0 Playbill Edge, 0 6px 0 0 Lacquer Ink`: hard, two-tone, the paper's own thickness. `flat` (`.ps-paper-flat`) drops the shadow for sheets already sitting on another sheet: drawers, name bills, active stubs.
- **PlaybillLine**: a printed choice. Full width, 2px Ink border, 3px corners, 16px body, a 24px circled numeral in the playbill face at the left (keyboard 1–4). Hover inverts to Ink on Playbill. `danger` is Stamp Red; `quiet` is Ink at 40% with Ink Soft text.
- **PaperButton**: 40px tall (32px `sm`), 3px corners, 2px border, Label Caps. `ink` is Ink on Ink (hover Ink Soft); `outline` is Ink stroke that fills on hover; `danger` is Stamp Red stroke that fills; `brass` is Gilt Brass with a Brass Deep edge (hover Brass Light) for paying. Press travels 2px with no shadow; suppressed under reduced motion.
- **Stamp**: 2px stamp-ink border and text, 2px corners, Label Caps, `mix-blend-multiply`, tilted −3°; `animate` plays the stamp landing. Status, rarity, deltas; `tone="ink"` for neutral tags.
- **BrassPlate / BrassFigure**: Gilt Brass with a 2px Brass Deep border, 4px corners, an inset 2px Brass Light top edge and Brass Deep bottom edge (engraved, not lifted). Figures are playbill-face numbers over a Label Caps name; an optional 6px full-radius bar (Ink, Stamp Red or Stamp Green over Brass Deep at 60%) carries HP or level. The HUD plate (`StageHud.tsx`) is four figures divided by Brass Deep rules; deltas rise off it as stamps.
- **Placard** (top band chips): 28px, 1px border, Label Caps. `brass` is Brass Light on Brass at 15%; `paper` is a small playbill; `danger` is Playbill on Stamp Red at 20%.
- **TicketStub** (drawer tabs): the playbill face, uppercase. Vertical stubs (desktop wing) are 48px with a 6px left edge; horizontal stubs (phone bottom, or the docked row) have a 4px top edge. Inactive: Brass Light on Lacquer Ink at 60% with a Brass Deep border, lifting 1px on hover. Active: flat paper with Ink, `aria-pressed`. A Stamp Red badge with a Playbill ring sits on the corner.
- **PlaybillRule**: a 2px dotted Ink-at-50% rule between sections. **PrintingDots**: a 12px Ink ring spinner beside "Printing…" in Label Caps.
- **Cutout** (`Cutout.tsx`): a flat card silhouette per role (hero, npc, party, enemy, boss, mount) in Ink with a 2px Playbill rim, foes in Lacquer Ink, on a 4px Brass Deep stick; the name hangs under it on a flat paper bill with an optional HP bar. Faces left by mirroring. Dimmed figures are 40% and grayscale.
- **Scenery** (`Scenery.tsx`): an SVG backcloth (sky), far, mid and near flats and a ground strip, slice-fitted to the proscenium with the base pinned. Each `Flat` is drawn twice: a copy offset 5 units down in The House at 45% (the card's thickness), then the painted copy with a 4-unit Playbill stroke at 70% under the fill (the cut edge). Sun is Brass Light at 85%; moon and stars are Playbill at 90%. Weather is cut paper on its own layer.
- **Theatre** (`Theatre.tsx`): the frame. 100dvh, `overflow-clip`, nothing scrolls at page level. Top band 56px min, Lacquer Ink with a 4px Brass Deep bottom rule: Cave door, identity, placards, controls. The house is a grid: left wing 220px→260px at `lg` (story log), the proscenium, right wing 200px→210px (stubs), widening to 440px→480px when a drawer is docked. The proscenium has Peacock Lacquer side posts, a 5px Gilt Brass inner trim, a striped lacquer pelmet (24px→32px) with a 4px brass rule, Cobalt Deep behind the flats, and an apron in Lacquer Ink with faint 48px floorboards that scrolls inside itself (max 70%, 64% at `md`). Footlights row at `md`+: WALK beside a 320–420px plate. On phones the plate, WALK and six horizontal stubs (54px) stack at the foot of the window and the log folds under the bill.
- **Drawers**: on desktop a `DockedDrawer` (flat paper, 2px Ink, playbill-face title bar) fills the right wing; on phones a `DrawerSheet` rises over the house (max 88% tall, 6px top corners, Ink sides) above a House-at-55% scrim, with the plate, WALK and stubs still exposed beneath so the map can stay open while walking. Both print in and close on Escape.
- **WalkBar** (`WalkBar.tsx`): the one Comet Mint element. A full pill, 56px (76px at `md`), 4px Cave Floor border, the cave's 6px Button shadow and press, mint hover glow; the word in the playbill face over a Label Caps instruction. Pending state sinks and waits; auto-walk pulses the footlight glow. During combat or at a stall it is replaced by a hollow Brass Deep pill reading "The road waits" / "Browsing the stall".
- **CaveExit** (`Theatre.tsx`): the door. A 36px Brass Deep outlined chip with the cave icon and "CAVE" in Label Caps, top-left of every band, hovering Lacquer Deep.
- **Foyer** (`Foyer.tsx`): roster, creation and run summary. The same top band, no proscenium; playbill character cards on The House. The one mint `ChunkyButton` per foyer screen is "Begin" on creation and "New character" on the run summary; everything else is a `PaperButton`.
- **Icons**: controls use `icons.tsx` and `glyphs.tsx` (one 2px stroke, round joins, 14–16px). Game-data glyphs (an NPC's, a landmark's, an item's) ride on bills as text and never become a control's icon.
- **Browser surfaces**: selection is Gilt Brass on the house and Stamp Red on paper; carets are Stamp Red; `.ps-scroll` scrollbars are thin Brass Deep.

**Motion grammar (keyframes in globals.css, all `cubic-bezier(0.16, 1, 0.3, 1)`).** Flats slide in from the wings on a region change (`--ps-slide` 220ms, from 12% off and 40% opacity; far and near from the left, mid from the right); each step nudges the near flat 6px over 200ms. Cut-outs rock on their stick when they speak or strike (`--ps-rock` 420ms, −6° then +5°, origin at the base). New bills and drawers print in (150ms, 10px rise). Stamps land (320ms, from 1.6× at −8° to rest at −3°). The footlights pulse their mint glow at 900ms while auto-walking; deltas float up 1s. Under reduced motion every `ps-*` animation is `none` (flats cut, cut-outs hold, the Day · km caption carries the change), the pulse becomes a steady glow, and press and hover translates are suppressed.

**Shapes.** Paper corners are 2–4px (stamps and name bills 2px, sheets and buttons 3px, brass plates 4px; the phone sheet's top is 6px). Full pills are reserved for the footlights, the circled numerals, the close button and the thin bars. Borders on paper are 2px Ink; on the house they are Brass Deep (4px bands, 2px chips); the proscenium is 10–14px lacquer with 5px brass inside.

**Named rules.**
**The Footlights Rule.** Inside the theatre Comet Mint is the WALK bar and nothing else; a primary action on paper is an ink `PaperButton`, and paying is brass. In the foyer, one mint `ChunkyButton` per screen. Mint focus outlines are the cave's and do not count.
**The Four Materials Rule.** Everything the player sees is playbill paper, brass, lacquer and the dark house, or stamp ink. Text sits only on paper; lacquer never fills a panel; numbers worth a glance sit on brass.
**The Stacked Card Rule.** Depth is card thickness, not light: a paper sheet casts its own edge (3px Playbill Edge over 6px Lacquer Ink), a flat is drawn twice with a darker copy below and a pale rim on the cut, and nothing blurs or glows except the footlights. A paper button presses 2px with no shadow; the cave's shadow-means-pressable rule stops at the proscenium.
**The Printer's Ink Rule.** Colour on paper is a stamp: bordered, tilted, in one of five inks, never a filled chip and never a gradient. Progress is a thin Ink-at-20% track with a stamp-ink fill.
**The Nightfall Rule.** By day each region paints its own backcloth; at nightfall the sky is Cobalt Night itself and the flats keep their paint under a 35% cobalt gel. Night is a change of backcloth, not a dimmer.
**The House Never Reflows Rule.** The window is the theatre: 100dvh, no page scroll, the wings and the apron scroll inside themselves. A drawer docks in the right wing on desktop (the proscenium yields width; slice-fitted flats do not jump) or rises as a sheet on phones with WALK still under it.

## Do's and Don'ts

### Do:
- **Do** give every pressable element a solid Cave Floor shadow and a matching press offset. Use the `chunky-*` recipes or the `shadow-*` plus `active:translate-y-[var(--press-offset-*)]` pair.
- **Do** use Comet Mint for exactly one primary action per screen region, and reach for cyan (secondary, utility) for everything else that is clickable.
- **Do** set every button, nav item, pill and badge in uppercase Lexend with tracked letters.
- **Do** build on `ChunkyButton`, `ChunkyCard`, `Pill`, `NavPill`, `AnswerOption` and `ProgressSegments` from `src/components/ui/`. New primitives go there and consume tokens; they do not define new ones.
- **Do** honor reduced motion on anything you add. The global rule collapses animations and transitions, but `translate` on hover and press must also be suppressed with `motion-reduce:`.
- **Do** mark current navigation with `aria-current`, give icon-only controls a name, and keep focus-visible outlines in Comet Mint.
- **Do** keep the shell quiet: the pulse on the HOT pill and the 100ms press are the whole motion budget outside games.

### Don't:
- **Don't** use blurred, black-alpha or gray drop shadows anywhere in the cave. Blur is reserved for glows and the ambient orbs.
- **Don't** write a hex value outside the `:root` block of `globals.css`, and don't use the legacy `space-*`, `cream-white`, `grey-500` classes.
- **Don't** use the shadcn `Button` for a primary action, or its `rounded-md` corner on anything new. Pill or 1rem slab.
- **Don't** let more than one accent glow at rest. Casino neon is an anti-reference; glow is state.
- **Don't** add a hard shadow to static content. The shell's fixed housings are the only exceptions, and they are not a precedent.
- **Don't** drift toward flat SaaS dark mode (1px borders, soft shadows, gradient CTAs) or toward bubblegum (saturated primaries, cartoon gradients). The cave is dim, thick and lit by three colors.
- **Don't** set headlines in Lexend or labels in Plus Jakarta Sans, and don't reach for the legacy `Typography` component.
