# Fantasy Tycoon: Character Roster Feature Micro-Sprints

This document outlines a step-by-step plan for implementing a character roster feature. The player will be able to view, select, create (up to 5), and delete their characters. Each micro-sprint is self-contained and includes context for the next agent.

---

## Micro-sprint 1: Extend data model & defaults

**Context**
- `src/app/fantasy-tycoon/models/types.ts`
- `src/app/fantasy-tycoon/lib/defaultGameState.ts`

**Prompt**
```
1. In models/types.ts, update GameState to add a new field:
   characters: FantasyCharacter[]
   (retain `character` as the currently selected one).
2. In defaultGameState.ts, initialize characters: [] in defaultGameState.
```

---

## Micro-sprint 2: Refactor Zustand store for roster management

**Context**
- `src/app/fantasy-tycoon/hooks/useGameStore.ts`

**Prompt**
```
1. Change persisted state to include both `gameState.characters` and `gameState.character`.
2. Add three actions:
   • addCharacter(c: FantasyCharacter) – pushes to characters if length<5
   • deleteCharacter(id: string) – removes by id
   • selectCharacter(id: string) – sets gameState.character
3. Update persist partialize to save characters & character.
```

---

## Micro-sprint 3: Wire new store actions into character creation

**Context**
- `src/app/fantasy-tycoon/components/CharacterCreation.tsx`
- `src/app/fantasy-tycoon/hooks/useCharacterCreation.ts`

**Prompt**
```
1. In CharacterCreation.tsx, import addCharacter, selectCharacter from useGameStore.
2. After completeCreation(), call addCharacter(character) then selectCharacter(character.id).
3. Remove the onComplete prop (or repurpose it) so creation flows via the store.
```

---

## Micro-sprint 4: Build CharacterList UI

**Context**
- new file: `src/app/fantasy-tycoon/components/CharacterList.tsx`

**Prompt**
```
Create CharacterList.tsx that:
1. Reads characters[] and character from useGameStore.
2. Renders a button per character:
   • clicking selects via selectCharacter
   • shows a delete (×) icon that calls deleteCharacter
3. If characters.length<5, renders a “New Character” button to open CharacterCreation.
4. Style to match existing tailwind/ui conventions.
```

---

## Micro-sprint 5: Integrate CharacterList into GameUI

**Context**
- `src/app/fantasy-tycoon/components/GameUI.tsx`

**Prompt**
```
1. Import and render CharacterList when characters.length>0 && no character selected.
2. Otherwise, if no characters, show CharacterCreation.
3. Once a character is selected, show the main game view as before.
```

---

## Micro-sprint 6: Add store tests for roster

**Context**
- `src/app/fantasy-tycoon/__tests__/useGameStore.test.ts` (new)

**Prompt**
```
Write Jest/unit tests for useGameStore:
1. addCharacter up to 5, then reject 6th.
2. deleteCharacter removes correctly.
3. selectCharacter sets gameState.character.
4. check persistence partialize only includes characters & character.
```
