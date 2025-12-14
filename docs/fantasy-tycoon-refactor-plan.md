# Fantasy Tycoon Refactor Plan

_Date: 2025-04-27_

## Overview

- Monolithic files (`llmEventGenerator.ts`, API `route.ts`) hinder readability and testing.
- Duplication of type definitions and parsing logic between client and server.
- Hooks (`useGameQuery`, `useResolveDecisionMutation`) have repetitive boilerplate.
- Direct `localStorage` usage scattered across `storage.ts` and hooks.
- Magic constants embedded in `defaultGameState.ts`.
- Tight coupling of validation, controller, and service in API routes.

## Micro Sprints

1. **Extract Shared Types**

   - Create `src/app/fantasy-tycoon/models/types.ts` with interfaces (`GameState`, `Event`, `Item`, etc.).
   - Refactor `lib/` and `hooks/` to import these types instead of redeclaring.

2. **Modularize LLM Integration**

   - Move logic from `lib/llmEventGenerator.ts` into `services/llm.ts`:
     - `buildPrompt(input: GameState): string`
     - `parseResponse(raw: string): Event[]`
   - Add unit tests in `__tests__/services/llm.test.ts`.

3. **Simplify Event Parsing**

   - Split `extractRewardItemsFromText.ts` into two files under `lib/parsers/`:
     - `textParser.ts` (regex utilities)
     - `rewardExtractor.ts` (core extraction logic)
   - Ensure each exports a single responsibility function.

4. **Consolidate Storage Logic**

   - Refactor `storage.ts` into a generic React hook `hooks/usePersistedState.ts`.
   - Replace all direct `localStorage` calls in components and hooks with this hook.

5. **Centralize Default Config**

   - Move magic values from `defaultGameState.ts` into `config/gameDefaults.ts`.
   - Simplify `defaultGameState.ts` to import constants from config.

6. **Refactor API Routes**

   - Under `app/api/v1/fantasy-tycoon/move-forward`:
     - Create `schemas.ts` for Zod validation schemas.
     - Create `controllers/moveForwardController.ts` for HTTP handling.
     - Create `services/moveForwardService.ts` for core logic.
   - Update `route.ts` to call controller → service.

7. **DRY React Query Hooks**

   - Implement `hooks/useFantasyTycoonQuery.ts` with generic factory methods.
   - Refactor `useGameQuery`, `useResolveDecisionMutation`, `useCharacterCreation` to use the factory.

8. **Decompose UI Components**

   - Audit `components/fantasy-tycoon`, extract common elements (`Card`, `Button`, `List`) into `components/ui/`.
   - Replace duplicated JSX in feature components.

9. **Increase Test Coverage**
   - Identify untested functions in `lib/` and `hooks/`.
   - Add Jest tests under `__tests__/lib` and `__tests__/hooks` to cover edge cases.
