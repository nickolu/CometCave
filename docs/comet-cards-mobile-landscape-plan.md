# Plan: Comet Cards — iPhone Landscape Mode

**Issue:** #1401
**Target device:** iPhone 13 Pro Max landscape (926×428 logical pixels)
**Goal:** Fully playable game on iPhone in landscape, with zero regression to the existing desktop experience.

---

## Current State

The Comet Cards UI is desktop-first with minimal responsive styling:

- **Gameplay view** uses a 3-column fixed grid: `gridTemplateColumns: 'minmax(240px, 270px) minmax(0, 1fr) minmax(240px, 270px)'` — the two sidebars alone need 480px+, which exceeds the 428px height in landscape.
- **Card sizes** are hardcoded pixels (`sm: 72×102`, `md: 92×132`, `lg: 116×168`) — not viewport-relative.
- **CosmicShell** sets `minHeight: calc(100vh - 8rem)` with fixed padding.
- **Main menu** has `maxWidth: 720px` and `padding: 64px 24px`.
- **Shop/view template** uses a stats strip + content area with no mobile layout.
- **Blind selection** has `sm:grid-cols-3` which is the one responsive rule that already exists.

At 926×428, the game will overflow vertically and horizontally. Cards will be too large, sidebars won't fit, and touch targets will overlap.

---

## Acceptance Criteria

### Every game phase is playable without scrolling
- **Main menu** — all buttons visible and tappable
- **Blind select** — all three blind options visible and selectable
- **Gameplay** — hand, play area, joker slots, score/mult, chip count, blind target, discard/play buttons all visible. Individual cards selectable by tap.
- **Shop** — items, buy/skip buttons, money display all usable
- **Round end / Game over** — results visible, buttons tappable

### Nothing is cut off or unreachable
- No horizontal scroll on any phase
- No buttons or interactive elements hidden with no way to reach them
- No text truncated to unreadable

### Touch targets work
- Every tappable element ≥44×44px
- Cards in hand individually selectable without hitting neighbors
- No hover-only interactions

### Zero desktop regression
- All existing desktop layouts unchanged (verified via process below)

---

## Regression Prevention

### 1. Screenshot baseline (before changes)

Capture reference screenshots at **1440×900** (desktop) for every game phase:
- Main menu
- Blind selection
- Gameplay (hand with cards, jokers in slots)
- Shop
- Pack opening
- Round end / game over

Store in `docs/screenshots/desktop-baseline/` for reference.

### 2. Scoped CSS changes only

All mobile layout changes MUST be inside responsive breakpoints:
- Use a custom Tailwind breakpoint or `@media` query for the target range (e.g., `max-height: 500px` for landscape phones)
- Desktop styles are the default — mobile overrides only
- **No changes to any rule that applies at desktop viewports**

### 3. Playtest both viewports after every change

After each component is modified:
1. Check 1440×900 desktop — compare to baseline screenshots
2. Check 926×428 landscape — verify against acceptance criteria

### 4. Future: Playwright visual tests (optional, not in scope)

If Comet Cards gets frequent UI changes, add automated screenshot tests at both viewports. Not required for this PR.

---

## Implementation Plan

### Phase 1: Setup & Baseline

**1.1 Add a landscape breakpoint**
- File: `tailwind.config.js` (or equivalent)
- Add a custom breakpoint or use `@media (max-height: 500px) and (orientation: landscape)` for landscape phone targeting
- This keeps all changes scoped and prevents desktop regression by definition

**1.2 Capture desktop baseline screenshots**
- Use Chrome DevTools at 1440×900
- Screenshot each game phase
- Store in `docs/screenshots/desktop-baseline/`

### Phase 2: Core Layout (gameplay view)

**2.1 Collapse 3-column grid to single column on landscape mobile**
- File: `src/app/comet-cards/components/game-views/gameplay.tsx`
- The 3-column layout (`left sidebar | center | right sidebar`) must rearrange for 926×428
- Proposed layout for landscape mobile:
  - **Top strip:** Score, mult, chips, blind target, round info (compact horizontal bar)
  - **Center:** Play area + hand (stacked or overlapping)
  - **Bottom strip:** Joker slots (horizontal scroll if needed), discard/play buttons
  - Left and right sidebar content collapses into the top/bottom strips
- The key constraint is 428px of vertical space — every pixel counts

**2.2 Scale card sizes for mobile**
- File: `src/app/comet-cards/components/cosmic/brand-card.tsx`
- Add a `xs` size variant (e.g., 54×78px) for landscape mobile
- Or make card size viewport-relative using `vw`/`vh` units within the landscape breakpoint

**2.3 Compact the hand display**
- File: `src/app/comet-cards/components/gameplay/hand.tsx`
- Cards in hand should overlap/fan more tightly on mobile
- Selected card should lift visually (translate-Y) with enough clearance for neighboring cards

### Phase 3: Supporting Views

**3.1 Main menu**
- File: `src/app/comet-cards/components/game-views/main-menu.tsx`
- Reduce padding (`64px` top → something smaller)
- Ensure buttons don't overflow 428px height

**3.2 Blind selection**
- File: `src/app/comet-cards/components/game-views/blind-selection.tsx`
- Already has `sm:grid-cols-3` — verify it fits at 926×428
- May need smaller blind cards (#1333 covers this partially)

**3.3 Shop**
- File: `src/app/comet-cards/components/game-views/shop.tsx`
- Compact the stats strip
- Ensure buy/skip buttons are tappable

**3.4 View template (shared layout)**
- File: `src/app/comet-cards/components/game-views/view-template.tsx`
- Compact stat strip and content padding for landscape mobile

**3.5 Pack opening, game over, blind rewards**
- Files: `pack-open.tsx`, `game-over.tsx`, `blind-rewards.tsx`
- Verify fit at 926×428, reduce padding/spacing as needed

### Phase 4: CosmicShell & Global

**4.1 Shell container**
- File: `src/app/comet-cards/components/cosmic/shell.tsx`
- Reduce `minHeight`, padding, and border-radius on landscape mobile
- The game should fill the viewport edge-to-edge on mobile

**4.2 Touch target audit**
- Verify all interactive elements ≥44×44px on landscape mobile
- Cards, buttons, joker slots, shop items
- Fix any that are too small

### Phase 5: Verification

**5.1 Desktop regression check**
- Compare every phase at 1440×900 against baseline screenshots
- Any visual difference is a regression to fix

**5.2 Full playthrough on target device**
- Play a complete game at 926×428 (Chrome DevTools with touch simulation, or actual iPhone 13 Pro Max)
- Menu → blind select → play 3+ rounds → visit shop → win or lose
- If you can do that without pinching, scrolling sideways, or missing a tap target, it's done

---

## Key Risks

| Risk | Mitigation |
|------|-----------|
| Card sizes too small to read on mobile | Test with actual device, not just DevTools. Set a minimum readable size. |
| Hand fan too tight, can't select individual cards | Increase card lift on selection. Add visual feedback (glow, scale) on touch. |
| Desktop layout breaks due to shared CSS | All mobile rules behind breakpoint. No shared-rule modifications. |
| Joker slots overflow horizontally | Allow horizontal scroll for joker bar only, or cap visible slots with arrow nav. |
| 428px is just too small for all game info | Accept some information hiding — e.g., detailed score breakdown in a tap-to-expand panel instead of always visible. |

---

## Out of Scope

- Portrait mode (landscape only for this pass)
- Android devices (iPhone 13 Pro Max is the target, but landscape rules will generally apply)
- Tablet layout (separate effort if needed)
- Comet Cards game logic changes
- New features — this is purely layout/responsive
