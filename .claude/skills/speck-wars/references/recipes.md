# Speck Wars — change recipes

Step-by-step for the recurring change types. Each is written as a checklist because the common failure mode is a change that typechecks, looks complete, and never reaches the player because one link in the chain is missing.

---

## 1. Add a new player command

The full chain, in dependency order:

1. **`domain/types.ts`** — add the variant to the `InputEvent` union.
2. **`domain/simulation/tick.ts` → `consumeInputs()`** — handle it. Note the existing style: `if (event.type === 'X')` blocks, not a `switch`. Mutate `sim` here and nowhere else in the chain.
3. **`game-instance.ts`** — add a method that pushes the event:
   ```ts
   myVerb(arg: string) {
     this.sim.inputQueue.push({ type: 'MY_VERB', ownerId: 'player', arg })
   }
   ```
   Add user feedback if the verb is player-visible (`this.notify('⚑ VERB', '#4af7c4', 700)`).
4. **`game-instance.ts` → the `setGameActions({...})` call in `start()`** — expose it: `myVerb: (a) => this.myVerb(a)`.
5. **`store.ts`** — add the key to **both** the `gameActions` type and the `setGameActions` type, and to **both** default-object literals (the initial value and the `?? {…}` fallback in the setter). Missing a default is the single most common bug here.
6. **`components/hud.tsx`** — add the control. Optional-chain the call (`gameActions.myVerb?.(…)`), because `destroy()` nulls the bag.
7. **`input/input-handler.ts`** — if it gets a keyboard shortcut: add an optional callback parameter to the constructor (a long positional list — append to the end), assign it to the field, and add the `else if (e.code === 'KeyX')` branch. Then pass it positionally from `GameInstance.start()`. **Count the positions carefully** — a misaligned argument silently wires the wrong verb.
8. **Touch affordance** — a keyboard-only command is not done (CLAUDE.md #8).

Verify: `yarn typecheck`, then actually trigger it in `yarn dev`. A missing link produces no error, just silence.

---

## 2. Tune balance

Edit constants, not logic:
- Unit stats → `domain/config/speck-types.ts`
- Building HP / spawn intervals / costs → `domain/config/building-types.ts`
- Capture, fortify, supply caps, domination, fog, creep camps → `domain/constants.ts`
- Per-difficulty AI and player spawn intervals → the `aiSpawnInterval` / `playerSpawnInterval` records at the top of `domain/simulation/create-sim.ts`
- AI aggression, wave timing, spawn-mode switching → `domain/ai/ai-controller.ts`

Then measure:
```bash
npx tsx .claude/skills/speck-wars/scripts/sim-harness.ts --games 20 --difficulty easy,medium,hard
```
Run it **before and after** and report both tables. The sim is not deterministic run-to-run, so 20+ games per difficulty is the minimum for a claim; a 1-game difference is noise. Report the delta in win rate and median game length, not a vibe.

---

## 3. Add a new speck type

1. `domain/config/speck-types.ts` — add to `SPECK_TYPES` (hp, damage, speed, attackRange, attackCooldown, size, productionTime, supplyCost, abilities). Extend `getTypeAdvantage` if it should participate in the rock-paper-scissors triangle.
2. `rendering/layers/speck-layer.ts` — size/tint handling if it needs to look distinct.
3. Spawn path: either a building `spawnTypeId` in `building-types.ts`, or a `SET_SPAWN_TYPE` option. If player-selectable, the `'basic' | 'heavy' | 'scout'` literal union appears in `store.ts`, `input-handler.ts`, `game-instance.ts`, and the `AI_SPAWN_SWITCH` event — widen all of them or the type won't be reachable.
4. `components/hud.tsx` — spawn selector entry and any composition readout.
5. Behavior: if it needs unique logic, add to `domain/simulation/unit-abilities.ts` and give it an entry in `abilities`.
6. Sweep with the harness — a new unit almost always shifts the passive win rate.

---

## 4. Add a new building type

1. `domain/config/building-types.ts` — `BUILDING_TYPES` entry (maxHp, size, spawnTypeId, spawnInterval, spawnCount, optional `hpRegen`, `sacrificeCost`, `attackRange`, `fireInterval`).
2. `domain/simulation/create-sim.ts` — if it exists at game start.
3. Construction path — `BUILD` input event and `domain/simulation/construction.ts` if player-built via sacrifice.
4. Behavior system — a new file under `domain/simulation/`, called from `tick.ts` at the correct pipeline stage (see architecture reference), with a numbered comment matching the existing style.
5. `rendering/layers/building-layer.ts` — drawing, selection ring, damage flash.
6. HUD: building drawer section in `hud.tsx` if it has a selected-state panel.

---

## 5. Add a field to the HUD

`HudData` is a snapshot rebuilt every 10 ticks — the HUD cannot read `sim`.

1. `domain/types.ts` — add the field to `HudData` (and to the nested per-player record if it's per-player).
2. `domain/simulation/tick.ts` → `emitHudUpdate()` — populate it. If it's per-speck aggregate, fold it into the existing single `for (let i = 0; i < sim.speckCount; i++)` loop rather than adding a second pass.
3. `components/hud.tsx` — consume via `useSpeckWarsStore(s => s.hud)`.

For anything that must react faster than 10 ticks (roughly 160ms), drive it off a `SimEvent` in `game-instance.ts` instead — that's what notifications and the kill feed do.

---

## 6. Change AI behavior

`domain/ai/ai-controller.ts` — `update(sim, dt)` is called immediately before `tick()` in the game loop (`game-instance.ts:478`). It holds personality (`aggressive` / `macro` / `balanced`), spawn-mode switching, wave scheduling (hard / very-hard only), dominance tracking, and adaptive difficulty. Its decisions run on an interval (default every 30 ticks), not every frame.

It issues orders through the same `sim.inputQueue` the player uses (`ATTACK_MOVE`, `SET_SPAWN_TYPE`), but it is not purely an input source: it also writes wave state directly (`sim.waveNumber`, `sim.waveCountdown`, `sim.waveInProgress`) and pushes `AI_WAVE_START` / `AI_LAST_STAND` / `AI_SPAWN_SWITCH` onto `sim.events`. Keep new AI behavior on the inputQueue path where you can — direct writes are the exception, not the pattern to copy.

Test across all three personalities:
```bash
for p in aggressive macro balanced; do
  npx tsx .claude/skills/speck-wars/scripts/sim-harness.ts --games 10 --difficulty medium --personality $p
done
```

---

## 7. Add a visual effect

1. Emit or reuse a `SimEvent` in `domain/types.ts` + the relevant system.
2. `rendering/renderer.ts` — handle it in the event loop of `update()` (see the existing `SPECK_DIED` → death flash + particles + combat marker chain).
3. `rendering/layers/effects-layer.ts` — the actual particle/flash implementation.
4. Screen-level feedback (shake, notification, kill feed) belongs in `game-instance.ts`, not the renderer.

Respect `prefers-reduced-motion`. The renderer must not mutate `sim`.

---

## 8. Add tests

There are none today, and `vitest.config.ts` does not cover this directory.

1. Add `'src/app/speck-wars/**/*.test.ts'` to the `include` array in `vitest.config.ts`. **Without this the file silently never runs.**
2. Test `domain/` only — it's pure. `createSim()` + a `tick()` loop needs no DOM.
3. Do not assert on exact outcomes of long runs: runtime randomness makes them flaky. Assert on invariants instead — supply never exceeds the hard cap, `speckMeta[i] === null` for freed slots, capture progress stays in 0..1, a destroyed base always produces `GAME_OVER`.

---

## 9. Debug "my change did nothing"

In order:
1. Is the `InputEvent` actually reaching `consumeInputs`? Log `sim.inputQueue.length` at the top of `tick()`.
2. Is the `gameActions` key present in **both** default literals in `store.ts`? A missing default leaves it `undefined`, and the optional-chained call is a silent no-op.
3. Are the `InputHandler` constructor arguments still positionally aligned after your edit?
4. Is your new tick system placed after the state it reads is written? Systems that run before `removeDeadSpecks` see dead specks; systems before `moveSpecks` see last frame's positions.
5. Are you iterating specks with the `speckMeta[i]` null guard, and not caching indices across ticks?
6. Is the HUD field being read from a `HudData` snapshot that's only refreshed every 10 ticks?
