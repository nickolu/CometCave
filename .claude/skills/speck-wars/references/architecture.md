# Speck Wars — Architecture Reference

## File map

All paths relative to `src/app/speck-wars/`. Approximate LOC after epic #2327 simplification.

### Entry / React shell
| File | ~LOC | Role |
|------|------|------|
| `page.tsx` | 14 | Next.js route entry |
| `layout.tsx` | 10 | Route layout |
| `SpeckWarsGame.tsx` | 178 | React root; mounts canvas, wires store |
| `components/phase-router.tsx` | 696 | Renders correct UI per game phase |
| `components/hud.tsx` | 1730 | In-game HUD (stats, surge button, help overlay) |
| `components/minimap.tsx` | 184 | Minimap overlay |
| `store.ts` | 160 | Zustand store: phase, HUD data, game actions |

### Core game loop
| File | ~LOC | Role |
|------|------|------|
| `game-instance.ts` | 928 | RAF loop, sim↔UI bridge, key bindings |
| `input/input-handler.ts` | 685 | Mouse/touch/keyboard → InputEvents |
| `input/touch-feedback.ts` | 20 | Touch ripple visuals |

### Simulation (`domain/simulation/`)
| File | ~LOC | Role |
|------|------|------|
| `tick.ts` | 397 | Master tick: calls all subsystems in order |
| `create-sim.ts` | 162 | Build initial `SimulationState` for a new game |
| `spawner.ts` | 87 | Spawn specks from buildings each tick |
| `speck-ai.ts` | 198 | Per-speck target selection and state machine |
| `movement.ts` | 229 | Velocity, steering, separation, guard bubble |
| `combat.ts` | 150 | Damage resolution, veteran promotion, building damage |
| `capture.ts` | 74 | Outpost capture progress |
| `turret.ts` | 71 | Turret fire logic (missile spawning) |
| `victory.ts` | 17 | Win/loss condition checks |
| `muster.ts` | 26 | Muster radius helpers for rally arrival |
| `spatial-grid.ts` | 37 | Spatial hash for O(1) neighbor queries |
| `prng.ts` | 9 | Seeded PRNG (map layout only) |

### AI (`domain/ai/`)
| File | ~LOC | Role |
|------|------|------|
| `ai-controller.ts` | 197 | High-level AI: personality, wave timing, decision loop |

### Config / types (`domain/`)
| File | ~LOC | Role |
|------|------|------|
| `types.ts` | 144 | All shared TypeScript interfaces |
| `constants.ts` | 54 | Numeric game constants |
| `config/building-types.ts` | 27 | Building type definitions |
| `config/speck-types.ts` | 53 | Unit type definitions |

### Rendering (`rendering/`)
| File | ~LOC | Role |
|------|------|------|
| `renderer.ts` | 247 | Pixi.js app setup, layer orchestration |
| `camera.ts` | 54 | Viewport transform |
| `textures.ts` | 12 | Texture cache |
| `layers/building-layer.ts` | 327 | Draw buildings, capture bars, HP rings |
| `layers/speck-layer.ts` | 172 | Draw specks, veteran rings, selection halos |
| `layers/effects-layer.ts` | 159 | Death particles, explosions |
| `layers/fog-layer.ts` | 179 | Fog-of-war mask |
| `layers/starfield-layer.ts` | 44 | Parallax background |
| `layers/grid-layer.ts` | 40 | Debug grid overlay |

### Persistence / lib
| File | ~LOC | Role |
|------|------|------|
| `lib/personal-best.ts` | 131 | Local-storage personal best tracking |
| `lib/daily-modifier.ts` | 25 | Returns layout name from daily seed (modifier logic removed) |

**Deleted files** (epic #2327):
- `domain/simulation/garrison.ts`
- `domain/simulation/construction.ts`
- `domain/simulation/unit-abilities.ts`

---

## Tick pipeline (execution order)

Each animation frame calls `tick(sim, dt)` in `tick.ts`:

1. `consumeInputs()` — drain `sim.inputQueue`; apply RALLY, ATTACK_MOVE, SURGE, HOLD, STOP, BOX_SELECT, CLEAR_SELECT, SELECT_BUILDING, SET_BUILDING_RALLY, SET_SPAWN_TYPE
2. `updateSpawners()` — decrement `spawnTimer`; emit `SPECK_SPAWNED`
3. `updateTurrets()` — fire missiles at nearby enemies
4. `runSpeckAI()` — each speck picks or validates its target
5. `moveSpecks()` — update positions, apply separation forces
6. `resolveCombat()` — deal damage; emit SPECK_DIED, BUILDING_DAMAGED, BUILDING_DESTROYED
7. Auto-clear `selectedBuildingId` if building was destroyed this tick
8. `removeDeadSpecks()` — compact `speckMeta`; push freed indices to `freeSlots`
9. `updateCapture()` — advance capture progress; emit OUTPOST_CAPTURED
10. `regenBuildingHp()` — restore HP (5 s no-damage cooldown required)
11. Surge timers — decrement `surgeDuration` / `surgeCooldown`
12. `checkVictory()` — emit GAME_OVER if win condition met
13. Domination check — if `dominationTimer >= DOMINATION_TIME` emit GAME_OVER (domination)
14. `emitHudUpdate()` — emit HUD_UPDATE every 10 ticks

---

## InputEvent catalog

| Type | Key fields | Effect |
|------|-----------|--------|
| RALLY | ownerId, x, y | Move selected specks to (x, y) |
| ATTACK_MOVE | ownerId, x, y | Attack-move to (x, y) |
| SET_SPAWN_TYPE | ownerId, speckTypeId, buildingId? | Change production type for a building (or all) |
| BOX_SELECT | ownerId, x1, y1, x2, y2 | Select specks inside bounding box |
| CLEAR_SELECT | ownerId | Deselect all |
| SURGE | ownerId | Activate surge (2x spawn, 8 s, 45 s CD) |
| STOP | ownerId | Idle selected specks |
| HOLD | ownerId | Hold-position selected specks |
| SELECT_BUILDING | ownerId, buildingId | Focus a building for inspection |
| SET_BUILDING_RALLY | ownerId, buildingId, x, y | Set per-building rally point |

---

## SimEvent catalog

| Type | Key fields | Consumer |
|------|-----------|----------|
| SPECK_DIED | speckId, x, y, killedOwnerId, killerOwnerId | Effects layer, kill feed |
| BUILDING_DAMAGED | buildingId, hp | Building layer (HP ring) |
| BUILDING_DESTROYED | buildingId, ownerId, x, y | Explosion effect, victory check |
| SPECK_SPAWNED | speckId, buildingId | (informational) |
| GAME_OVER | winnerId, victoryType | phase-router → results screen |
| HUD_UPDATE | data: HudData | store → HUD component |
| OUTPOST_CAPTURED | outpostId, newOwner, previousOwner | Notification toast |
| SPECK_VETERAN | speckId, ownerId | Speck layer (gold ring) |
| SPECK_ELITE | speckId, ownerId | Speck layer (purple ring) |
| SPECK_LEGEND | speckId, ownerId | Speck layer (AoE ring) |
| AI_WAVE_START | waveNumber | HUD wave indicator |
| VETERAN_FALLEN | speckId, ownerId, kills, x, y | Kill-feed toast |
| AI_SPAWN_SWITCH | speckTypeId | (informational) |

---

## Keybinding table

| Key | Action |
|-----|--------|
| Space | Pause / resume |
| Escape | Cancel modifier or clear selection |
| R | Clear all rally points |
| H | Hold position (selected specks) |
| S | Stop (selected specks) |
| C | Re-center camera on player base |
| D | Defend — rally to player base |
| N | Advance — rally to nearest uncaptured outpost (cycles on repeat) |
| B | Rush — rally to enemy base |
| Q | Surge (2x spawn, 8 s, 45 s cooldown) |
| V | Snap camera to recent combat |
| A | Arm attack-move mode (click to execute) |
| G | Guard — rally to nearest friendly outpost |
| E / Ctrl+A | Select all player specks |
| 1 / 2 / 3 | Set spawn type: basic / heavy / scout (select building first) |
| X | Cycle playback speed (1x / 2x) |
| 4-9 | Recall control group |
| Ctrl+4-9 | Save control group |
| ? | Toggle help overlay |
| Arrow keys | Pan camera |

Removed keys (epic #2327): Z (stance), Y (commander ability), F (sacrifice), T (build turret).

---

## Unit and building config

### Building types (`domain/config/building-types.ts`)

| typeId | Name | Max HP | Size | Spawn type | Spawn interval | Regen |
|--------|------|--------|------|------------|----------------|-------|
| base | Base | 100 | 40 px | basic | 1800 ms | 0.5 HP/s |
| outpost | Outpost | 50 | 20 px | heavy | 2700 ms | 2.0 HP/s |

Regen only when not damaged for 5 s.

### Speck types (`domain/config/speck-types.ts`)

| typeId | Name | HP | Damage | Speed | Attack range | Attack CD | Size |
|--------|------|----|----|-------|------------|-----------|------|
| basic | Speck | 1 | 1.0 | 64 px/s | 6 px | 500 ms | 3 px |
| heavy | Tank | 5 | 2.0 | 48 px/s | 8 px | 700 ms | 6 px |
| scout | Dart | 1 | 0.5 | 120 px/s | 4 px | 600 ms | 2 px |
| missile | Missile | 1 | 1.0 | 220 px/s | 6 px | — | 2 px |

Type advantage: Heavy→Basic x1.3, Scout→Heavy x1.35, Basic→Scout x1.25.
Missile is turret-only; the player cannot produce or command missiles.

---

## Key numeric constants (`domain/constants.ts`)

| Constant | Value | Meaning |
|----------|-------|---------|
| MAX_SPECKS | 15 000 | Hard array capacity |
| WORLD_WIDTH / HEIGHT | 3000 / 1500 px | Play area |
| CAPTURE_RADIUS | 100 px | Proximity to count toward capture |
| CAPTURE_TIME | 5 000 ms | Full capture duration |
| DOMINATION_TIME | 60 000 ms | Hold all 3 outposts to win |
| FOG_VISION_SPECK | 150 px | Per-speck vision radius |
| FOG_VISION_BASE | 300 px | Vision around player base |
| FOG_VISION_BUILDING | 180 px | Vision around owned buildings |
| HUD_UPDATE_INTERVAL | 10 ticks | HUD sync frequency (~160 ms at 60 FPS) |

---

## Known hazards

- **Non-determinism.** `Math.random()` is called during spawning and AI decisions. Map layout is seeded; the runtime is not. Do not write tick-level deterministic tests.
- **SOA slot reuse.** `freeSlots` recycles dead indices. Never cache a slot index across ticks; always look up by speck ID.
- **`speckCount` is a high-water mark.** Dead slots may exist between 0 and `speckCount`. Guard reads with `if (!speckIds[i]) continue`.
- **`dominationTimer` resets on outpost loss.** If the player loses one outpost for even one tick, the 60 s clock restarts. Intentional but non-obvious when debugging win-condition edge cases.
- **`rngState` removed, non-determinism remains.** There is no longer a seeded RNG state for the runtime; do not attempt to add one expecting replay fidelity without a deeper architectural change.
