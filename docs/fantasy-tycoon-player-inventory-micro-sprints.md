# Inventory & Event Rewards Roadmap

## Overview
Add a persistent player inventory and let events grant items.  
Break the work into four micro-sprints (~1 week each) with clear deliverables and acceptance criteria.

---

## Sprint 1: Data Model & Persistence

**Goal:** Define inventory schema, integrate into store & storage.

**Tasks:**
- Design `Item` interface (id, name, description, icon, quantity).
- Extend global store (e.g. Zustand) with `inventory: Item[]`.
- Add actions: `addItem`, `removeItem`, `updateQuantity`.
- Persist only `inventory` (avoid serializing empty arrays elsewhere).
- Write unit tests for store actions and persistence.

**Acceptance Criteria:**
- Inventory shape documented in code.
- Store actions pass tests.
- Inventory survives page reloads.

---

## Sprint 2: Inventory UI

**Goal:** Display and manage inventory in the Game UI.

**Tasks:**
- Create `InventoryPanel` component:
  - List items with icon, name, qty.
  - Expand/collapse panel.
- Integrate panel into `GameUI.tsx`.
- Add “Use”/“Discard” buttons per item (hook into store actions).
- Style panel to match existing design.
- Add basic keyboard shortcut (e.g. “I” to toggle).

**Acceptance Criteria:**
- InventoryPanel opens/closes.
- Items render with correct data and icons.
- Use/Discard invoke store actions and update UI.

---

## Sprint 3: Event Reward Integration

**Goal:** Hook item rewards into the event resolution flow.

**Tasks:**
- Extend event schema to optionally return `rewardItems: { id: string; qty: number }[]`.
- Update `llmEventGenerator`/`eventResolution` to parse and emit item rewards.
- In `resolve-decision/route.ts`, after resolving an event:
  - Dispatch `addItem` for each reward.
  - Capture a list of new items in the response.
- Update `StoryFeed` to show “You received X” toast/messages.

**Acceptance Criteria:**
- Events can include one or more reward items.
- After an event, inventory updates with new items.
- Player sees feedback in StoryFeed.

---

## Sprint 4: Polish, Testing & Documentation

**Goal:** Final QA, docs, edge-case handling.

**Tasks:**
- Write integration tests covering:
  - Inventory persistence + UI sync.
  - Event rewards pipeline end-to-end.
- Handle edge cases:
  - Adding duplicate items (merge qty).
  - Removing more than available qty.
- Write a README section for “Inventory & Rewards”.
- Update TypeScript definitions, ensure no `any` or implicit `this`.
- UX polish: tooltips, animations, error handling.

**Acceptance Criteria:**
- All tests green.
- Code adheres to strict TS rules.
- Documentation added to repo.
- Smooth UX with no console errors.

---

## Next Steps
- Review plan & adjust sprint length based on team capacity.
- Kick off Sprint 1 by drafting the `Item` interface and store module.