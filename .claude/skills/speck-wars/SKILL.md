# Speck Wars — Skill Document

## What this skill covers
Speck Wars is a real-time strategy browser game in which a player captures outposts and defeats the AI by destroying its base. This skill covers the post-simplification game (after epic #2327): mechanics not documented here have been removed.

## The game in one paragraph
Two bases face each other across a 3000×1500 px world. Each base and capturable outpost automatically spawns units ("specks") at a steady rate. The player commands specks with rally points, attack-move orders, and spawn-type switches. The AI responds based on its personality (aggressive / macro / balanced). Victory goes to whoever destroys the enemy base first, or to whichever side holds all three outposts for 60 consecutive seconds (domination win).

## Invariants

1. **SOA structure, fixed arrays.** All speck data lives in parallel typed arrays (`speckX`, `speckY`, `speckHp`, …) allocated once at max capacity (`MAX_SPECKS = 15000`). Dead slots are recycled via `freeSlots`. No new arrays are ever allocated per tick. `speckCount` is a high-water mark, not a live count.

2. **Seeded setup, non-deterministic run.** Map layout (outpost positions, starting orientation) is seeded from the daily date + difficulty, so the same day/difficulty always produces the same map. The simulation itself is non-deterministic: `Math.random()` is used during spawning and AI decisions. Replay and lockstep are not supported.

3. **No global mutable state outside SimulationState.** The entire game world is `SimulationState`. Rendering reads it; inputs enter via `inputQueue`; events leave via `events`. The `game-instance.ts` wrapper owns the RAF loop and wires UI ↔ sim.

4. **Player specks never choose their own objective.** Once a player speck reaches its assigned rally point it waits there, attacking enemies that come within `GUARD_ENGAGE_RANGE` (130 px). Only AI specks autonomously seek the nearest enemy building.

5. **Capture is flat.** A single speck captures an outpost at the same speed as a hundred; the only thing that matters is *presence* inside `CAPTURE_RADIUS` (100 px). Contested reversal is also flat (0.5 speed).

6. **Veteran progression is real.** Specks accumulate kills and gain permanent stat bonuses at 3 (Veteran, +20% dmg), 6 (Elite, +35%), and 12 (Legend, +50% + AoE splash). Kill counts survive until the speck dies; they are not reset by rallying or holding.

## Baseline balance
A player who issues no orders after the opening wins approximately 4 out of 5 games on easy. On medium the passive win rate drops to roughly 1 in 2. On hard and very-hard the AI's faster decision ticks and wave assault mechanic mean a passive player loses reliably. Re-measure after any change to spawn intervals, capture time, or AI tick rates.

## Verifying a change
1. Run `npx tsc --noEmit` in `cometcave/` — no type errors.
2. Start a game at each difficulty and observe for at least 90 s.
3. Check that the HUD surge button, minimap, and speck composition panel update correctly.
4. On hard, let the AI reach wave 1 and confirm the WAVE indicator appears.
5. Capture all three outposts and hold them — confirm domination countdown and win screen.

## Known hazards
- **Non-determinism in spawning.** `Math.random()` is called inside `updateSpawners` and `runSpeckAI`. Tests that assert exact unit positions or kill counts across ticks will be fragile.
- **SOA index invalidation.** `freeSlots.pop()` recycles indices. Code that caches a speck index across ticks (rather than looking up by ID) will read stale data for a recycled slot.
- `speckCount` is a high-water mark, not a live count. Iterating `0..speckCount` visits dead slots; always check `speckIds[i]` before reading a slot.
- `dominationTimer` in `SimulationState` is reset to 0 whenever the player loses an outpost. A near-win can silently reset. Watch this field in the HUD if domination wins stop triggering.
