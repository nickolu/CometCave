# Handoff: CometCave Cards — Branded UI Redesign

## Overview

This handoff redesigns the CometCave Cards (Balatro-style poker game) UI to align with the CometCave brand identity. It keeps **all original game terminology** from the existing screen ("Total Score", "Big Blind", "Score at Least", "Remaining Hands", "Sort By: Value/Suit", "Discard", "Play Hand", "Show Deck", "Show Hands", "Jokers", "Splash", "Consumables", "Two Pair", standard ♥♦♠♣ suits) but reskins everything with cosmic visuals — deep navy/black background, ambient star field, mint/teal (#5eead4) brand accent, and glowing cards.

## About the Design Files

The files in this bundle are **design references created in HTML/JSX** — prototypes showing intended look and behavior, not production code to copy directly. Your task is to **recreate this design in the existing CometCave codebase** using its established components, framework conventions, and styling system.

The design uses inline `style={{}}` JSX for prototyping speed; in the real codebase, translate these to whatever the project uses (CSS modules, Tailwind, styled-components, etc.).

## Fidelity

**High-fidelity.** Exact colors, typography, sizes, shadows, glow values, and interactions are specified below and embodied in the HTML prototype. The intent is pixel-level fidelity to what's in the prototype, adapted to the codebase's stack.

---

## Layout — Single Screen

The game UI is a single full-viewport screen, divided as:

```
┌──────────────────────────────────────────────────────────────┐
│  COMETCAVE  Home Trivia Oracle Cards Chat   Round Money Hands│  ← Top bar (height auto, ~70px)
├──────────────────────────────────────────────────────────────┤
│ ┌──────────┐                              ┌──────────────┐  │
│ │ Current  │       Total Score            │   Jokers     │  │
│ │  Blind   │      ┌───────────┐           │   ┌─────┐    │  │
│ │  $1,200  │      │   5,540   │           │   │Splash│    │  │
│ │ ▓▓▓░░░░  │      └───────────┘           │   └─────┘    │  │
│ │ Hands  4 │                              │              │  │
│ │ Disc.  3 │                              │ Consumables  │  │
│ ├──────────┤                              │   ┌─────┐    │  │
│ │ Selected │      🂡🂢🂣🂤🂥🂦🂧🂨           │   │TwoPr│    │  │
│ │   Hand   │       (fanned cards)         │   └─────┘    │  │
│ │  Pair    │                              │              │  │
│ │ 10 × 2   │  Sort By: [Value][Suit]      │              │  │
│ ├──────────┤  [Discard][Play Hand][Deck]  │              │  │
│ │ Run Log  │                              │              │  │
│ └──────────┘                              └──────────────┘  │
└──────────────────────────────────────────────────────────────┘
   270px               1fr (centered)            270px
```

### Stage / Scaling
- The full UI is designed to a fixed **1280 × 800** stage and `transform: scale()` to fit the viewport. Implement equivalent behavior — either fixed stage with scaling, or a responsive layout that gracefully reflows below ~1100px wide.
- Min comfortable viewport for unscaled UI: **1280 × 800**.

### Top bar
- Height: auto (~58px)
- Padding: `12px 22px`
- Border-bottom: `1px solid rgba(94,234,212,0.08)`
- Left: COMETCAVE logo (split color: "COMET" #5eead4, "CAVE" #fff, weight 700, letter-spacing 1, 16px) + nav (`Home / Trivia / Oracle / Cards / Chat`, uppercase, 10px, weight 600, letter-spacing 1.8). Active item ("Cards") is mint (#5eead4) with a 2px mint underline + glow.
- Right: monospace stat row (Round, Money, Hands Played) — labels at 10px / opacity 0.45, values at 13px / weight 600.

### Main grid
- 3 columns: `230px minmax(0, 1fr) 230px`
- Gap: `18px`
- Padding: `14px 22px 18px`
- Height: `calc(100% - 70px)` (fills viewport minus top bar)

---

## Components

### Panel (left + right rails)
A reusable card container.
- Background: `linear-gradient(180deg, rgba(15,30,28,0.7), rgba(6,15,15,0.7))`
- Border: `1px solid rgba(94,234,212,0.1)`
- Border-radius: `8px`
- Backdrop-filter: `blur(8px)`
- Header: `10px 16px`, border-bottom `1px solid rgba(94,234,212,0.08)`, title in JetBrains Mono 10px uppercase letter-spacing 2 opacity 0.6, optional right-side subtitle ("1 / 5 slots") at same style with opacity 0.4.

### Left rail panels (top → bottom)

#### "Current Blind" panel
- Title (eyebrow): "Big Blind" — 18px weight 700, color **#5eead4**
- Eyebrow "Score at Least" (10px mono, opacity 0.5, uppercase, letter-spacing 2)
- Big number "1,200" — 36px weight 700, letter-spacing -1, color **#ff6b9d**, text-shadow `0 0 24px rgba(255,107,157,0.35)`
- Progress bar: 4px tall, track `rgba(94,234,212,0.1)`, fill `linear-gradient(90deg, #5eead4, #2dd4bf)` with `0 0 12px rgba(94,234,212,0.6)` glow, animated width on score change (`transition: width 0.3s`)
- Two stat rows (mono 11px, `white-space: nowrap`):
  - "Remaining Hands" / value in mint
  - "Remaining Discards" / value in pink (#ff6b9d)

#### "Selected Hand" panel
- Hand name (e.g. "Pair") — 20px weight 600, letter-spacing -0.3
- "Lvl 1" — mono 11px, opacity 0.55
- Chips × Mult row:
  - Chips chip: padding `6px 10px`, radius 4, bg `rgba(94,234,212,0.12)`, color `#5eead4`, min-width 48, mono 13px
  - "×" separator (opacity 0.4)
  - Mult chip: same but bg `rgba(255,107,157,0.12)`, color `#ff6b9d`
  - During play: trailing "= total" in #ffd166 weight 700 16px
- Subtitle "Chips × Mult" — mono 10px uppercase letter-spacing 1 opacity 0.5

#### "Run Log" panel
- Mono 11px opacity 0.6 line-height 1.7
- Three lines: Hands Played, Best (e.g. "Four of a Kind (840)"), Seed

### Right rail panels

#### "Jokers" — 1 / 5 slots
List of `ItemRow`s (see below) + EmptySlot placeholders.

#### "Consumables" — 1 / 2 slots
Same pattern.

#### `ItemRow`
- Container: padding 10, bg `rgba(255,255,255,0.02)`, border `1px solid <accent>22`, radius 6
- Left mini-card: 40×56, radius 4, bg `linear-gradient(155deg, #07120f, #0a1f1c)`, border `1px solid <accent>55`, glyph 22px in accent color, glow `0 0 12px <accent>33`
- Right text: name (13px weight 600 in accent), description (11px opacity 0.65 line-height 1.4)
- Splash uses accent **#5eead4** + glyph "✺", description "Every played card counts in scoring"
- Two Pair uses accent **#ffd166** + glyph "◈", description "Increases the level of Two Pair by 1"

#### `EmptySlot`
- Height 76, dashed border `1px dashed rgba(94,234,212,0.12)`, radius 6
- Centered "Empty slot" text (mono 10px opacity 0.3 uppercase letter-spacing 2)

### Center column

#### Total Score readout
- Eyebrow "Total Score" (mono 10px opacity 0.5 uppercase letter-spacing 3)
- Big number — 44px weight **200** (thin), letter-spacing -1.5, line-height 1, color #fff, text-shadow `0 0 60px rgba(94,234,212,0.3)`
- During Play Hand animation: `transform: scale(1.04)` and a "+ <yourScore>" line below in mint mono 13px weight 700.

#### Hand (fanned cards)
- 8 cards by default (King-S, King-H, Queen-D, Jack-H, 9-S, 7-C, 6-D, 5-D)
- Each card: 92 × 132, see Card spec below
- Layout: absolute-positioned in a fixed-width container so the visible fan is precisely centered. Each card overlaps the previous by 48px horizontally.
- Subtle fan rotation: `rotateZ((i - n/2 + 0.5) * 2deg)` and a slight Y-arc.
- Selected cards lift -16px (Y translate) and gain stronger glow (see Card).
- Click toggles selection; max 5 selected.

#### Card (`BrandCard`)
- Size md: 92 × 132. Size lg (focus mode if needed): 116 × 168.
- Background: `linear-gradient(160deg, #0d1f1a 0%, #061712 60%, #03100d 100%)`
- Border-radius: 14
- Border: `1px solid rgba(94,234,212,0.18)` default; selected → `1px solid <suit-color>`
- Shadow (default): `0 0 12px <suit-color>1a, 0 8px 16px rgba(0,0,0,0.5), inset 0 1px 0 rgba(94,234,212,0.08)`
- Shadow (selected): `0 0 0 2px <suit-color>55, 0 0 28px <suit-color>, 0 16px 28px rgba(0,0,0,0.7)`
- Sheen: full-bleed `linear-gradient(125deg, transparent 35%, <suit-color>1f 50%, transparent 65%)` with `mix-blend-mode: screen`
- Inner border: 1px inset 6px from edge, color `<suit-color>22`
- Two corner rank/suit indicators (top-left + bottom-right rotated 180°): rank in JetBrains Mono weight 700 (`fontSize * 0.7`), suit glyph below (`fontSize * 0.62`), color = suit color, text-shadow `0 0 10px <suit-color>88`
- Center suit pip: 42px, color suit color, text-shadow `0 0 22px <suit>, 0 0 40px <suit>88`
- Inner glow: `radial-gradient(circle at 50% 55%, <suit-color>22 0%, transparent 60%)`
- Hover: `transform: translateY(-6px)` (handled by `.bc-card:hover` global rule)
- Selected: `translateY(-16px)`
- Transition: `transform 220ms cubic-bezier(.2,.9,.3,1.2), box-shadow 220ms, border-color 220ms`

#### Suit colors (cosmic, not flat red/black)
- Hearts ♥ → `#ff6b9d` (coral pink)
- Diamonds ♦ → `#ffd166` (gold)
- Spades ♠ → `#e6e6f0` (pale white)
- Clubs ♣ → `#5eead4` (brand mint)

### Action bar (below cards)
Uppercase JetBrains Mono labels, 11px, letter-spacing 1.5/2.

- "Sort By:" label (opacity 0.5)
- `[Value]` `[Suit]` text buttons. Active: color #5eead4 with bottom border `1px solid #5eead4`. Inactive: color `rgba(230,255,247,0.5)`, no border.
- Vertical divider: 1px wide, 22px tall, `rgba(94,234,212,0.15)`
- **Discard** button: bg `rgba(255,107,157,0.1)`, border `1px solid rgba(255,107,157,0.35)`, color `#ff6b9d`, padding `10px 18px`, radius 4, weight 700. Trailing remaining-discards count at opacity 0.55.
- **Play Hand** button (primary): bg `linear-gradient(180deg, #5eead4, #2dd4bf)`, border `1px solid #5eead4`, color `#031a16`, padding `10px 22px`, radius 4, weight 700, shadow `0 0 20px rgba(94,234,212,0.4), inset 0 1px 0 rgba(255,255,255,0.2)`. Trailing "↑" character.
- **Show Deck**, **Show Hands** ghost buttons: transparent bg, border `1px solid rgba(94,234,212,0.15)`, color `rgba(230,255,247,0.7)`, padding `8px 14px`, radius 4, mono 10px uppercase letter-spacing 2.
- Disabled: opacity 0.35, cursor not-allowed.

### Modal (Show Deck / Show Hands)
- Backdrop: `rgba(2,8,10,0.75)` with `backdrop-filter: blur(10px)`
- Card: 640px max-width 85%, bg `linear-gradient(180deg, #0a1f1c, #050d0e)`, border `1px solid rgba(94,234,212,0.2)`, radius 10, padding 28
- Title eyebrow ("Show Deck" / "Show Hands") in mono 11px uppercase, then headline "Standard 52" / "Poker Hands" 24px weight 600
- Show Hands: 2-col grid of every formation (High Card → Straight Flush) with name + chips×mult in mint
- Show Deck: 13-col grid of all ranks (A → 2), each cell mono 12px with "×4" subtitle

---

## Interactions & Behavior

### Card selection
- Click toggles selection. Max 5 selected. While `playing === true`, selection is locked.

### Play Hand
- Disabled if 0 selected or `plays === 0`.
- Detects formation (high/pair/two-pair/three/straight/flush/full-house/four/straight-flush).
- Computes `(hand.chips + sum(card.values, capped at 11)) × hand.mult`.
- Animates score over **1400ms** with cubic ease-out, calling RAF.
- After animation: 800–900ms pause, then `plays--`, clear selection, reset chips/mult.
- During animation: score readout scales to 1.04, "+ <delta>" appears in mint below.

### Discard
- Disabled if 0 selected, `discards === 0`, or playing.
- Removes selected cards from hand, clears selection, `discards--`.

### Sort
- "Value" sorts hand desc by rank value.
- "Suit" sorts by suit id (alpha) then rank value desc.

### Modals
- Open on Show Deck / Show Hands buttons.
- Close on backdrop click or Close button.

---

## State Management

```ts
type State = {
  hand: Card[];               // 8 cards initially
  selected: Set<string>;      // card ids
  score: number;              // total score (starts 5540)
  yourScore: number;          // delta from last play
  chips: number;              // current chips (during play)
  mult: number;               // current mult (during play)
  plays: number;              // remaining hands (starts 4)
  discards: number;           // remaining discards (starts 3)
  playing: boolean;           // true during score animation
  sortBy: 'value' | 'suit';
  modal: 'deck' | 'hands' | null;
};

type Card = { id: string; rank: Rank; suit: Suit };
type Rank = { id: string|number; label: string; value: number }; // 2..A (value 14)
type Suit = { id: 'hearts'|'diamonds'|'spades'|'clubs'; glyph: string; label: string; color: string };

const HANDS = {
  high:          { name: 'High Card',       chips: 5,   mult: 1 },
  pair:          { name: 'Pair',            chips: 10,  mult: 2 },
  twoPair:       { name: 'Two Pair',        chips: 20,  mult: 2 },
  three:         { name: 'Three of a Kind', chips: 30,  mult: 3 },
  straight:      { name: 'Straight',        chips: 30,  mult: 4 },
  flush:         { name: 'Flush',           chips: 35,  mult: 4 },
  fullHouse:     { name: 'Full House',      chips: 40,  mult: 4 },
  four:          { name: 'Four of a Kind',  chips: 60,  mult: 7 },
  straightFlush: { name: 'Straight Flush',  chips: 100, mult: 8 },
};
```

The existing app likely already has authoritative game state — wire the UI to that. Don't reinvent rules.

---

## Animations

| What | Duration | Easing | Properties |
|---|---|---|---|
| Card hover lift | 220ms | `cubic-bezier(.2,.9,.3,1.2)` | `transform`, `box-shadow`, `border-color` |
| Card selection lift | 220ms | same | same |
| Score count-up on Play | 1400ms | cubic ease-out (`1 - (1-t)^3`) | numeric value via RAF |
| Score scale during play | 200ms | default | `transform: scale(1.04)` |
| Progress bar fill | 300ms | default | `width` |
| Modal backdrop | instant | — | `backdrop-filter: blur(10px)` |

### Ambient star field background
- Full-bleed `<canvas>` behind the UI.
- ~1 star per 8000 px², each with random radius (0.2–1.6), opacity (0.2–0.9), twinkle phase, and hue (~70% mint @ 165, 20% blue @ 200, 10% gold @ 50).
- Per-frame: clear, paint two large radial gradients (top-left mint `rgba(94,234,212,0.12) → 0`, bottom-right teal `rgba(45,212,191,0.10) → 0`), one mid-frame gold `rgba(255,209,102,0.04)`, then twinkle + draw stars (alpha modulated by `(sin(phase)+1)/2`).
- Stop on unmount. Resize-aware.

---

## Design Tokens

### Colors
| Token | Hex | Use |
|---|---|---|
| `bg-deep` | `#02080a` | Page background fallback |
| `bg-grad-1` | `#0a1f1c` | Top-left of body radial gradient |
| `bg-grad-2` | `#050d0e` | Mid-stop of body radial |
| `bg-grad-3` | `#02080a` | End-stop of body radial |
| `panel-grad-from` | `rgba(15,30,28,0.7)` | Panel top |
| `panel-grad-to` | `rgba(6,15,15,0.7)` | Panel bottom |
| `panel-border` | `rgba(94,234,212,0.1)` | Panel stroke |
| `panel-divider` | `rgba(94,234,212,0.08)` | Inner borders |
| `text-default` | `#e6fff7` | Body text |
| `text-muted` | `rgba(230,255,247,0.65)` | Secondary text |
| `accent-mint` | `#5eead4` | Brand primary |
| `accent-mint-hi` | `#2dd4bf` | Gradient end |
| `accent-pink` | `#ff6b9d` | Score-target / discard / mult |
| `accent-gold` | `#ffd166` | Money / consumables / total |
| `card-hearts` | `#ff6b9d` | Hearts suit |
| `card-diamonds` | `#ffd166` | Diamonds suit |
| `card-spades` | `#e6e6f0` | Spades suit |
| `card-clubs` | `#5eead4` | Clubs suit |
| `card-bg` | `linear-gradient(160deg, #0d1f1a, #061712 60%, #03100d)` | Card face |

### Typography
- **Body / UI**: Inter, weights 300–800 (Google Fonts). Falls back to `system-ui, sans-serif`.
- **Numerics / labels**: JetBrains Mono, weights 400/500/600/700 (Google Fonts). Used for all stat values, eyebrows, action buttons.
- **Type scale**:
  - 9px (chip subtitles)
  - 10px (eyebrows, ghost buttons, sub-labels — letter-spacing 2/3, uppercase)
  - 11px (primary action buttons, mono stats — letter-spacing 1.5–2)
  - 12px (modal grid items)
  - 13px (panel body values)
  - 16px (logo)
  - 18–20px (panel headlines)
  - 24px (modal title)
  - 36–44px (target / score numbers)
  - **44px weight 200** (Total Score hero)

### Spacing scale
4 / 6 / 8 / 10 / 12 / 14 / 16 / 18 / 22 / 24 / 28 px — used directly in inline styles. Map to whatever the codebase uses.

### Radii
- 4 — buttons, chips, mini-card thumbnails
- 6 — item rows, empty slots
- 8 — panels
- 10 — modal
- 14 — playing cards
- 100 — pill-shaped buttons (only in earlier variants)

### Shadows / glows
- Card default: `0 0 12px <suit>1a, 0 8px 16px rgba(0,0,0,0.5), inset 0 1px 0 rgba(94,234,212,0.08)`
- Card selected: `0 0 0 2px <suit>55, 0 0 28px <suit>, 0 16px 28px rgba(0,0,0,0.7)`
- Primary button: `0 0 20px rgba(94,234,212,0.4), inset 0 1px 0 rgba(255,255,255,0.2)`
- Score-target glow: `text-shadow: 0 0 24px rgba(255,107,157,0.35)`
- Total Score glow: `text-shadow: 0 0 60px rgba(94,234,212,0.3)`

---

## Assets

No external image assets. All visuals are CSS / SVG / canvas:
- COMETCAVE wordmark: type-set in Inter weight 700 with split colors
- Suit glyphs: Unicode (♥ ♦ ♠ ♣)
- Item glyphs: Unicode (✺ for Splash, ◈ for Two Pair)
- Star field: procedurally drawn on `<canvas>`

If the production app has a real logo SVG, swap it into the top bar.

---

## Files in this bundle

- `CometCave Cards v2.html` — Entry point. Sets up the scaling stage, loads fonts, mounts `BrandGame`.
- `brand-core.jsx` — Game data (`SUITS`, `RANKS`, `HANDS`, `buildHand`, `detectHand`), `BrandCard` component, `AmbientBG` star-field canvas component.
- `brand-game.jsx` — `BrandGame` (the screen), `Panel`, `ItemRow`, `EmptySlot`, `BrandModal`, button styles.

To preview the design locally: open `CometCave Cards v2.html` directly in a browser (it loads React, ReactDOM, Babel, and the JSX files via CDN — no build step required).

---

## Recreation Plan (Suggested)

1. **Don't rip the JSX** — these are inline-styled prototypes. Use them as the spec.
2. **Locate the existing game UI** in the CometCave codebase. Confirm the state shape matches (or adapt the props).
3. **Add brand tokens** for the new colors and shadows (cosmic palette above).
4. **Build the panel + button primitives** in the codebase's idiom.
5. **Build the `<Card>` component** — this is the centerpiece. Match the layered shadows and selection glow exactly.
6. **Build the ambient star-field canvas** (or use an equivalent existing background system if one exists).
7. **Replace the screen layout** with the 3-rail grid.
8. **Wire up animations** — RAF count-up on Play, scale pulse, lift on select.
9. **Verify at 1280×800 and a typical viewport** (≥1440×900). Add scaling-to-fit if the app target is smaller.
10. **Test interactions**: select 1–5 cards, play hand of each formation type, discard, sort by Value/Suit, open both modals, hit empty-state edge cases (0 plays / 0 discards).
