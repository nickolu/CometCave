# Tap Tap Adventure — architecture

## File map

```
src/app/tap-tap-adventure/
  page.tsx, layout.tsx          landing and layout; game/page.tsx mounts <AiGate> around the stage
  game/page.tsx                 GameStage when a character is selected, else the Foyer + CharacterList
  characters/page.tsx           character roster
  preview/                      dev-only fixture renders of the stage (404 in production)
  stage/                        the Paper Stage (rendering only)
    Theatre.tsx                 the frame: house, wings, proscenium, apron, footlights, drawer dock/sheet
    GameStage.tsx               the run: owns walk/decision/town/celebration state and lays it into Theatre
    PlaybillStrip.tsx           the bill on the apron: newest line, choices, results, describeTarget()
    Drawers.tsx                 the six drawers and their sub-tabs; wires panels to the stage
    Playbill.tsx                primitives: PlaybillSheet/Title/Caption/Line/Rule, PaperButton, Stamp, BrassPlate…
    StageHud.tsx, WalkBar.tsx   identity, placards, brass plate; the one mint control
    Scenery.tsx, Cutout.tsx     painted flats per region/time/weather; actors on sticks
    StoryLog.tsx, Foyer.tsx     the story so far; the lobby for character pick
    glyphs.tsx, icons.tsx       game-data glyphs (regions, doors, resources); control icons
    time.ts                     distance → time of day
    README.md                   the material and type rules
  components/                   the panels (one per feature); rendering in Paper Stage vocabulary
  hooks/
    useGameStore.ts             Zustand + immer + persist; every action; useGameStateBuilder()
    useMoveForwardMutation.ts   a step: POST move-forward, then shop/generate if a milestone hit
    useResolveDecisionMutation  a choice: client-side bypass/travel/stay, else POST resolve-decision
    useCombatActionMutation.ts  a fight turn: POST combat/action; victory/defeat/fled bookkeeping
    useNPCDialogue.ts, usePartyDialogue.ts, useOnboarding.ts, useCharacterCreation.ts
  lib/                          pure engines: combatEngine, itemEffects, landmarkGenerator, leveling,
                                discovery, mainQuestManager, questGenerator, craftingEngine, spells…
  config/                       data: regions, landmarks, mounts, mercenaries, npcs, skills, weather…
  models/                       zod schemas; FantasyCharacter (character.ts) is the big one
  __tests__/                    vitest; engines and data, not components

src/app/api/v1/tap-tap-adventure/
  move-forward/                 route + schemas + services/moveForwardService.ts (the road)
  resolve-decision/             resolves a picked option; townEventGenerator.ts for town scenes
  combat/start, combat/action   start builds an enemy (model); action is the pure engine
  shop/generate|purchase|sell   shop stock (model) and the two ledgers
  npc/dialogue, party/dialogue  conversations (model)
  quest/generate, classes/generate, skill-tree/generate   generated content (model)
  leaderboard, leaderboard/submit-score, game-state       game-state GET is a stub; storage is local
```

Persistence is `zustand/middleware` `persist` to localStorage, key
`fantasy-tycoon-storage`, version 40. There is no server-side save of a run;
the leaderboard is the only thing written to Firestore. Character state travels
to the server in every request body and comes back updated.

## The three loops

### Walk

1. `WalkBar` → `handleMoveForward` (`GameStage`). Refuses if a request is in
   flight or `roadBlocked()`.
2. The client predicts whether this step reaches the active target (2D
   `moveToward` + `hasArrived`, or 1D `positionInRegion` when there is no 2D
   data) or crosses a shop milestone (`crossedMilestone`, every 100 km). If
   so, or on a 97% flip, it calls `useMoveForwardMutation`; otherwise it
   prints a generic travel line and `incrementDistance(mountSpeed)` locally.
3. `moveForwardService` (server): initialises `landmarkState` for a new
   country (seeded landmarks, exits around the edge, region length by
   difficulty); advances position; on reaching a landmark returns an arrival
   decision (explore / enter town / bypass-toward options), on reaching an
   exit returns a travel decision (enter / turn back; a guardian the first
   time), otherwise asks the model for events (`generateLLMEvents`; after
   150 km, a 1% roll per step asks for a `generateLegendaryEvent` instead) or
   returns a social encounter or a generic message.
4. The mutation writes the returned character, items, social encounter,
   decision point or shop into the builder clone, checks quests, and commits.

### Decide

1. A `PlaybillLine` on the bill (or keys 1–4) → `handleResolveDecision`.
2. Door-opening ids are handled in `GameStage` without a request (stable,
   mailbox, notice board, blacksmith, waypoints, tavern, townspeople, the
   social-encounter conversation).
3. `useResolveDecisionMutation` handles `bypass-*`, `travel-*` and `stay`
   client-side (retarget, move country, start a guardian fight) and sends the
   rest to `resolve-decision`, which rolls the option's probability against
   the character's stats and applies `successEffects` / `failureEffects`
   through `eventResolution.ts`.
4. `GameStage.onResult` prints a result card unless the id is in
   `skipResults`; `onSuccess` clears the decision point if it is still the
   same one.

### Fight

1. `combat/start` builds the enemy (model) from the character, the story
   context and an `eventContext`; party members get combat states, bosses are
   scaled for party size and ordinary fights gain extra enemies for it.
   `isBoss` (and `isMiniBoss`, `isSecretBoss`) plus `pendingRegionId` mark a
   guardian.
2. Each action POSTs the entire `combatState` to `combat/action`
   (`processPlayerAction` in `combatEngine.ts`): action points, stamina,
   distance (close/mid/far), telegraphs, status effects, boss phases,
   additional enemies, party and mount turns.
3. `useCombatActionMutation` syncs HP/mana/mount/mercenary/party back to the
   character every turn; on victory adds loot and gold, claims main-quest
   milestones (pure), moves the player into a conquered country, updates the
   bestiary and the story; on defeat applies the death penalty, pays soul
   essence, generates an heirloom and shows the run summary (permadeath
   deletes the character after commit); then `setCombatState(null)` and commit.
4. `GameStage` shows `CombatUI` while `status === 'active'` and the brass
   placard in the footlights; `CombatResult` renders for a non-active state,
   which the mutation currently never leaves in the store.

## Where things are drawn

| What | Where |
|---|---|
| The newest story line, choices, result cards, arrival card | `PlaybillStrip` on the apron |
| Fights, the shop, the town and its doors | the apron, replacing the strip |
| Hero, party, mount, enemy, NPC cut-outs | `actors` → `Theatre` over `Scenery` |
| Identity, region/day/weather placards, HP/gold/repute/level plate | `StageHud` |
| WALK, or the reason the road waits | `footlights` |
| The six drawers and their sub-tabs | `Drawers` → docked (desktop) or sheet (phone) |
| The story so far | `StoryLog` in the left wing (desktop) or below (phone) |
| Onboarding hints, celebrations, stat allocation, travel confirm, keyboard help, character sheet | overlays in `GameStage` |
