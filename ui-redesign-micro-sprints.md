# Fantasy Tycoon UI Redesign – Micro-Sprints

A step-by-step plan to incrementally improve the UI/UX of the game. Each micro-sprint is designed to be 1–2 hours and independently shippable.

## Micro-Sprint 1 – Navigation Refactor
- Add a persistent top bar with logo/title + `Characters`, `Play`, `Settings` buttons
- Route buttons using Next.js `Link` for faster navigation
- Remove old inline nav from `GameUI.tsx` / `CharacterList.tsx`

## Micro-Sprint 2 – Character List Upgrade
- Replace list with `CharacterCard` component: avatar, name, level, quick stats
- Add a prominent “Add Character” CTA card with plus icon & hover effect
- Animate card hover (scale + shadow) via `framer-motion`
- Ensure responsive grid using CSS grid / Tailwind `grid-cols-…`

## Micro-Sprint 3 – HUD & Stats Bar
- Extract inventory/stats into `HudBar.tsx` with icons + tooltips
- Use flex layout; hide less-used stats behind an info dropdown on mobile

## Micro-Sprint 4 – Event Panel & Choice Buttons
- Wrap current event text in `EventPanel.tsx` with parchment-style background (CSS texture)
- Refactor choice buttons into `ChoiceButton.tsx`; include icon, colour-coded risk level
- Add keyboard shortcuts (`1`, `2`, `3`) for quick selection

## Micro-Sprint 5 – Event Log Enhancement
- Make log collapsible (`CollapsibleLog.tsx` using Radix UI Accordion)
- Add timestamp, colour-coded outcome tags (success, fail, info)
- Virtualise long lists with `react-virtual`

## Micro-Sprint 6 – Visual Polish & Animation
- Page-level fade/slide transitions with Next.js `<AnimatePresence>`
- Button press ripple / success confetti (`canvas-confetti`) for major milestones
- Ensure prefers-reduced-motion media query disables motion for accessibility

## Micro-Sprint 7 – Accessibility & QA
- Run `axe-core` and Lighthouse; fix contrast, aria-labels, focus traps
- Add jest-axe test for key components
- Cross-device manual testing (mobile, tablet)

## Micro-Sprint 8 – Cleanup & Docs
- Remove dead CSS / legacy components
- Update README and Storybook docs with new UI patterns
- Tag release `v1.1-ui-refresh`

---

This roadmap lets you ship value after each sprint while steadily converging on the full redesign. Adjust as needed for your workflow.
