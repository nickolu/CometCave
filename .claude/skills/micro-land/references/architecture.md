# Micro Land — Architecture Reference

All paths relative to `src/app/micro-land/` unless noted. LOC approximate.

## File map

### Entry / React shell
| File | ~LOC | Role |
|------|------|------|
| `page.tsx` | 28 | Route entry. Takes over the viewport (`fixed inset-0 z-40`) inside `CosmicShell`, which supplies the cave exit ✕. |
| `layout.tsx` | 10 | Route layout |
| `MicroLandGame.tsx` | 163 | Mounts the canvas, loads the chronicle *before* building the instance, subscribes theme changes, wires UI callbacks. A second effect calls `adoptAccount` when auth resolves — keyed on `user.uid`, not the user object, which is replaced on every token refresh |
| `store.ts` | 300 | Zustand: tool, brush, pause/speed, population summary, records, archive, notices, panel flags, tuning mirror |
| `format.ts` | 23 | `formatDuration` |

### Core loop
| File | ~LOC | Role |
|------|------|------|
| `game-instance.ts` | 1143 | Owns `WorldState`, the RAF loop, the pointer, the camera, records, and every command the UI can issue |

### Simulation (`domain/sim/`)
| File | ~LOC | Role |
|------|------|------|
| `world.ts` | 685 | World construction, tile access helpers, spawning, native plants, seed rain |
| `creature-sim.ts` | 931 | Hunger, senses, steering, physics, digging, breeding, death, particles |
| `tile-sim.ts` | 293 | Falling sand: powders, liquids, quenching, melting, corrosion |
| `prng.ts` | 78 | Seeded RNG, value noise, fbm |

### Domain
| File | ~LOC | Role |
|------|------|------|
| `types.ts` | 390 | Every shared type. Read this first — the blueprint interface is the contract the whole game turns on |
| `blueprint.ts` | 712 | Zod schema (doubles as the model's tool schema), sanitizer, `canEat`, `artSize`, `bodyBox`, creature grouping |
| `constants.ts` | 210 | All tuning. Heavily commented; the comments are the reasoning |
| `tuning.ts` | 310 | The ecosystem subset of those constants as a mutable `TUNING` object, plus the knob table the settings panel and `--set` both read |
| `terrain.ts` | 327 | Promptable terrain: schema, sanitizer, ground-level fitting, map→tiles painter |
| `creature-kit.ts` | 663 | The hand-drawing kit: `Draft`, flood fill, trim, `draftToArt`, body plans, `buildRawCreature` |
| `procedural.ts` | 298 | Offline fallback creature/scene when the model is unavailable |

### Config (`domain/config/`)
| File | ~LOC | Role |
|------|------|------|
| `creatures.ts` | 1420 | The 34 built-in blueprints, as raw literals |
| `themes.ts` | 511 | Five worlds: `empty`, `earth`, `station`, `tidepool`, `volcanic`. Default is `empty` |
| `materials.ts` | 321 | 26 base materials + 36 tints, flag lookup tables |
| `milestones.ts` | 105 | Eleven once-ever milestones and the context they read |
| `loader-shapes.ts` | 145 | Pixel shapes for the summon loading animation |

### Rendering
| File | ~LOC | Role |
|------|------|------|
| `rendering/renderer.ts` | 726 | Backbuffer compositing, light field, shadow, camera, minimap |
| `rendering/sprite-cache.ts` | 84 | Blueprint art → offscreen canvases, plus flipped copies |

### Records (`chronicle/`)
| File | ~LOC | Role |
|------|------|------|
| `chronicle.ts` | 340 | In-memory chronicle, debounced writes, land ids, species archive, `mergeChronicles`, `adoptAccount` |
| `backend.ts` | 139 | `localBackend`, `nullBackend`, `accountBackend` behind one async interface |
| `wire.ts` | 131 | Validate/decode/`fitChronicle` size trimming, shared by the browser and the route |
| `types.ts` | 101 | `ChronicleData`, `LandRecord`, `SpeciesRecord`, `ElderRecord` |

### Components (`components/`)
| File | ~LOC | Role |
|------|------|------|
| `toolbar.tsx` | 486 | Material palette + tint strip, brush sizes, creature drawers, summon/draw entry points |
| `hud.tsx` | 210 | Theme picker, pause, speed, population, steady streak, field guide button, settings button |
| `summon-panel.tsx` | 484 | The describe-it flow for creature / scene / terrain |
| `summon-loader.tsx` | 456 | The wait, made watchable |
| `summon-sand.tsx` | 191 | Sand animation for pending summons |
| `creature-builder.tsx` | 1070 | The pixel drawing panel |
| `pixel-canvas.tsx` | 327 | The drawing surface itself |
| `field-guide.tsx` | 416 | Archive, records, milestones |
| `settings-panel.tsx` | 230 | The live tuning drawer |
| `inspector.tsx` | 359 | Live read-out of one creature; naming the elder |
| `creature-chip.tsx` | 78 | Sprite portrait |
| `pan-controls.tsx` | 108 | Edge arrow buttons |
| `notices.tsx` | 46 | Toast strip |
| `sparkle-icon.tsx` | 24 | Marks the AI-assisted entry points |

### Outside the game directory
| Path | Role |
|------|------|
| `src/app/api/v1/micro-land/summon/route.ts` | Creature / scene / terrain generation |
| `src/app/api/v1/micro-land/chronicle/route.ts` | Account-backed record storage (GET/PUT, uid from the verified token) |
| `src/lib/micro-land/chronicle-store.ts` | Server-side chronicle persistence |
| `firestore.rules` | `users/{uid}/microLand/{docId}` — closed to clients like everything else |
| `firestore.indexes.json` | `fieldOverrides` entry disabling indexing on `microLand.blob` |
| `scripts/micro-land-sim.ts` | Headless ecosystem harness (`npm run sim:micro-land`) |
| `src/app/micro-land/domain/__tests__/creature-kit.test.ts` | Drawing kit tests |
| `src/app/micro-land/chronicle/__tests__/chronicle.test.ts` | Record/merge/`adoptAccount` tests |
| `src/app/micro-land/chronicle/__tests__/wire.test.ts` | Validation and size-trimming tests |

---

## Frame pipeline

`GameInstance.frame(now)` per animation frame:

1. Read store state; resolve the theme (summoned terrain wins over the registry
   when `themeId === 'summoned'`).
2. Clamp delta to `MAX_CATCHUP_MS` (250) — a backgrounded tab hands back a huge
   delta and simulating all of it is a freeze.
3. If not paused: accumulate `delta * speed`, run up to 8 fixed steps of
   `TICK_S` (1/60 s), collecting `SimEvent[]`.
4. `digestEvents` — turn raw events into occasional human notices.
5. Every `STATS_EVERY_MS` (300): `pushStats` → population summary → store,
   `updateRecords`, `pushInspected`.
6. `updateCamera(delta/1000)` — held keys/buttons, edge-scroll while carrying a
   creature, follow the inspected creature. Runs off wall-clock, not the sim
   clock, so the camera answers the same whether paused or fast-forwarded.
7. `renderer.render(world, theme, inspectedId, elderId)`.

### One simulation step (`GameInstance.step`)

1. `world.elapsed += TICK_S`
2. Every `TILE_TICK_EVERY` (3) ticks: `tickTiles(world)` then
   `renderer.markTilesDirty()`. So tiles run at 20 Hz — 60 Hz reads as frantic.
3. `tickCreatures(world, TICK_S, rng, theme.gravity, events)`

### `tickCreatures` internals

Per tick, before the loop: count plants, count per species, gather aura holders,
rebuild and sort the `byX` array (nearly-sorted every tick, which is sort's best
case). Then per creature:

1. Age, animation clock, breed cooldown
2. Hunger → starving timer → `kill('starved')`
3. Old age → `kill('aged')`
4. Environment: deadly material (→ `burned` unless immune), habitat `needs`
   unmet or drowning (→ one shared `distress` timer → `drowned` at
   `BREATH_SECONDS`)
5. Senses, every `SENSE_EVERY` (6) ticks, staggered by creature id. Walks only
   the x-sorted slice within `sight + SIGHT_PAD`. Bodies overlapping → eat now
   (`BITE_PAD`), else pick nearest threat or prey and set mood
6. `steer` (per locomotion kind), then `integrate` (gravity, buoyancy,
   viscosity, drag, horizontal move with step-up or dig, vertical move,
   friction, clamp to world)
7. `applyConversion` if the blueprint has `aura.converts`
8. Breeding, gated on cooldown / fullness / maturity / `MAX_CREATURES` /
   `MAX_PLANTS` / per-species cap. Plants pay no hunger cost (they
   photosynthesise; charging them would sterilise them permanently)

After the loop: filter the dead, `seedNativePlants` (the only regrowth there is
— animals that die out stay dead), `tickParticles`.

### `tickTiles`

One bottom-up pass. `moved` bitmask stops a tile falling twice in a pass. Scan
direction alternates by `flowPhase` or liquids drift left forever. Lava moves
every other pass; sap every eighth. Order per tile: melt check → quench (lava
touching water → obsidian) → corrode (acid, spends itself) → powder step or
liquid step. Liquids reach `FLOW_REACH` (4) sideways looking for a way down.

---

## The blueprint contract

`CreatureBlueprint` is the whole entity model. Groups:

| Field | What it drives |
|-------|----------------|
| `size` 1–6 | Food chain position — nothing eats anything bigger than itself |
| `tags` | What it *is*. Exactly one structural tag (`plant`/`meat`/`mineral`) plus flavour |
| `art` | `palette` (single char → hex), `frames` (rows of palette keys, `.` transparent), `frameMs`, `faceMotion` |
| `body` | `mass`, `bounce`, `drag`, `buoyancy`, `immuneTo[]` |
| `move` | `kind` (walk/fly/swim/crawl/drift/root), `speed`, `jump`, `restlessness` |
| `diet` | `eats[]`, `fears[]`, `hungerRate`, `starveSeconds`, `breedAt`, `lifespanSeconds` |
| `senses` | `sight` in tiles |
| `habitat` | `needs[]` (hurt anywhere not touching one of these), `drowns` |
| `dig` | `through[]` materials, `speed` tiles/sec |
| `death` | `becomes` material, `particleColor`, `particleCount` |
| `aura` | `radius`, `helps[]` tags, `boost`, `converts {from,to}`, `convertRate` — or null |
| `glow` | Light cast, 0–1 |

**The entire food chain** is `canEat(hunter, prey)`: not itself, prey not
larger, and `hunter.diet.eats` intersects `prey.tags`. `fears(prey, hunter)` is
that plus explicit `diet.fears` tags. Every relationship in the world — including
between a built-in and something invented five seconds ago — falls out of these
two functions.

Art bounds: `ART_MIN` 3, `ART_MAX_W` 28, `ART_MAX_H` 24, `MAX_FRAMES` 4,
`MAX_PALETTE` 12. Core-vs-sprite thresholds: `CORE_W` 12, `CORE_H` 10,
`CORE_SLOPE` 0.4 — set above the largest pre-existing built-in (Grumblestone,
10×7) so nothing that shipped before big creatures changed behaviour.

---

## Materials

26 base materials, each written as a diff against a boring-rock `DEFAULTS`.
Flags: `solid`, `liquid`, `powder`, `deadly`, `glow`, `fertile`, `viscous`,
`breathable`, `melts`, `corrosive`, `acidProof`, `tintable`, `tintOf`.

Four are tintable (`plastic`, `crystal`, `gem`, `cloud`) × 9 tints = 36
generated variants appended after the base list. A tint is a real tile id
(`crystal-blue`) that inherits every physical property; only the color differs.

Hot-path lookups are precomputed `Uint8Array`s indexed identically to the tile
grid: `IS_SOLID`, `IS_LIQUID`, `IS_POWDER`, `IS_DEADLY`, `IS_FERTILE`,
`IS_DROWNING` (liquid and not breathable — sap holds you but you can breathe),
`IS_ACID_PROOF`, `VISCOSITY` (0–255).

`PAINTABLE` is palette order for the toolbar and lists only the base of each
tintable family; colors hang off it in a tint strip.

Fertile today: `dirt, grass, sand, ash, wood, snow, mud, moss, bone`.

---

## Themes

A theme is a terrain generator plus a mood: `sky` gradient, `gloom` (0 = evenly
lit, 1 = only glowing things visible), `gravity` multiplier, `starters[]`, and a
`build(tiles, rng)`. Registry is `THEMES` / `THEME_BY_ID`; `DEFAULT_THEME` is
`empty`.

| id | Name | Notes |
|----|------|-------|
| `empty` | Empty | Default. Nothing at all — build it yourself |
| `earth` | — | Cross-section: soil, caves, ponds |
| `station` | — | `gravity` 0.35, high gloom |
| `tidepool` | — | Water-heavy, kelp-led food chain |
| `volcanic` | — | Lava seams, ember/cinder roster |

`across(n)` inside `themes.ts` is the `WIDTH_SCALE` multiplier for scattered
features. Theme starter counts get the same treatment in `seedStarters`.

`SUMMONED_THEME_ID` (`'summoned'`) is a pseudo-theme: `GameInstance` holds the
summoned `Theme` object in `summonedTheme` and `resolveTheme` prefers it.

---

## Summoning

`POST /api/v1/micro-land/summon` with `{ mode, prompt }`, mode being
`creature` | `scene` | `terrain`.

The zod schema in `blueprint.ts` / `terrain.ts` is converted straight into the
tool's `input_schema` via the AI SDK's `zodSchema`, so **the contract the model
is held to and the contract the simulation reads are the same object**. The
`.describe()` strings are the model's only instructions — they are written for
the model, not for a human reader, and editing one edits the prompt.

Calls the Messages API directly (`claude-opus-5`) rather than `generateObject`,
which hard-codes `temperature: 0` that Opus 5 rejects. `maxDuration` 120 s with
a 105 s internal abort so a fallback can still be returned. Max tokens: creature
16k, terrain 16k, scene 32k.

Every failure path — no API key, model error, refusal, malformed output — falls
back to `proceduralCreature` / `proceduralScene` / `sanitizeTerrain`'s built-in
island. The route returns `source: 'model' | 'offline'`.

Client side: `GameInstance.introduce(raw, count)` sanitizes, registers (which
also makes the species native so seed rain can bring it back), and places.
`applyTerrain(raw, {keepCreatures})` sanitizes, wraps as a theme, repaints, and
re-keys the records to the summoned land's name.

Terrain painting (`paintTerrain`): a coarse character map, ground level fitted
by `fitGroundLevel` (models draw the horizon two-thirds up, which plays badly —
pad empty rows on top until the surface sits 30–50% up), then sampled with fbm
noise jitter so cell edges come out ragged. Cells are kept **square**; a map too
narrow to cross the world repeats mirrored rather than stretching.

---

## Rendering

One canvas pixel per world tile into a `WORLD_W × WORLD_H` backbuffer, then one
scaled blit with `imageSmoothingEnabled = false`. Zoom is fixed by `VIEW_W`
(224), not by the world width, so a hopper is the same size it has always been;
a wide display simply sees more tiles.

Per frame, all clipped to visible columns:
1. `ensureTiles` — re-bake tile colors if the view left the baked range
   (`TILE_MARGIN` 32 columns of slack, which earns its keep while paused)
2. `buildLight` — quarter-res light field: daylight by column depth below the
   first solid tile (`SKY_FALLOFF` 16), glowing tiles sampled every other tile,
   glowing creatures, three blur passes, baked into a shadow overlay scaled by
   `theme.gloom`. Gathered `LIGHT_MARGIN` 24 columns wide because blur bleeds
3. Sky gradient → tile layer → creatures (culled off-screen; flicker when
   starving or distressed) → particles → **shadow** → elder halo → inspect
   brackets. Shadow goes after sprites so creatures are dimmed by the same
   shadows as terrain
4. Scaled blit, then the minimap

Minimap is drawn on the world canvas (not React) because it must share the pixel
grid and updates every frame; refreshed every `MAP_REFRESH_FRAMES` (12).
`minimapHit` must be consulted before a tap is allowed to paint.

---

## Input

All pointer handling is in `GameInstance`, on the canvas.

| Gesture | Effect |
|---------|--------|
| Tap/drag, paint tool | Paint a circle of `brush` radius |
| Tap/drag, creature tool | Place (throttled `PLACE_THROTTLE_MS` 130) |
| Drag on a creature | Pick up; release throws with trail velocity |
| Tap in Look mode | Inspect + follow; drag in Look mode pans (nothing to paint) |
| Two fingers | Pan, always — cancels whatever the first finger started |
| Tap/drag on minimap | Jump/scrub the camera |
| Wheel / trackpad | Pan sideways (vertical folded in) |
| Arrow keys, A/D | Held pan; both held then one released keeps the other |
| Home / End | Jump to either end |
| Edge band while carrying | World scrolls under the carried creature |

Following is cleared the moment the player pans by hand.

---

## Records and persistence

**Chronicle** = one in-memory `ChronicleData`, written back on a 4 s debounce
plus on `visibilitychange`/`pagehide` (not `beforeunload` — mobile kills
backgrounded tabs without unloading).

`landId(themeId, summonedLandName)` — built-ins file under their theme id; a
summoned land files under `summoned:<slug-of-its-name>`, so re-summoning "a
drowned cathedral" finds its own records.

Per land: `elder` (seconds, species, player-given name, when taken),
`steadySeconds` (longest run with no extinction), `generations` (deepest
bloodline). Plus a global species archive (blueprint + first/last seen +
longest life) and a global milestone map.

- `ELDER_MIN_SECONDS` 60 — below this the record is meaningless and the halo is
  on screen constantly.
- `STEADY_SHOW_SECONDS` 120 — below this the streak flickers during early churn.
- Archive pruning caps *summoned* species at `MAX_ARCHIVED_SUMMONED` 80,
  oldest-sighting first. Built-ins are never pruned.
- Only the elder can be named. A name is the reward for the record.

Backends implement `load()/save()` async. `localBackend` wraps every access
because `localStorage` *throws* on read in private-mode Safari.
`accountBackend` goes through the API route (house pattern — Firestore is closed
to clients), trims with `fitChronicle` before sending, and uses `keepalive` only
under 60 KB because the spec rejects larger keepalive bodies outright.

The game **starts on `localBackend` and never waits for the network**; when auth
resolves, `adoptAccount` reads the account copy, `mergeChronicles` folds it into
the live one, and the merged result is written straight back. Merging, not
choosing — the account holds last week's phone session, the local copy holds the
last thirty seconds, and both are real. `initChronicle` memoizes its in-flight
promise for exactly this reason: `loaded` is only set *after* the await, so
without the memo a local read landing after the merge would silently overwrite
it and the account's creatures would vanish for that session.

Stored at `users/{uid}/microLand/chronicle` as **one JSON string in an unindexed
`blob` field**, not as nested maps. It is a save blob — read whole, written
whole, never queried — and as maps Firestore would index every leaf of every
archived creature on every write, with ids (`summon:cinder-wyrm:3`) landing in
field paths that do not take colons. The cost is that the document is opaque in
the console and cannot be queried across players: a public gallery would want
creatures as their own documents, added *alongside* this rather than by
unpicking it. `MAX_CHRONICLE_BYTES` 700 KB leaves headroom under Firestore's
1 MiB field cap; the route refuses anything larger rather than trimming it.

Anonymous players are first-class here — `useAuth` mints an anonymous uid for
everyone, so records are kept from the first creature drawn, and signing up
links the credential to that same uid and carries the archive across. The honest
limit is that an anonymous uid lives in browser storage: clearing site data
loses it, and cross-device only truly works once the player signs up.

**Milestones** fire once ever, not once per land, and have no screen of their
own — one line in the notice strip, then the back of the field guide.

## Saved worlds — the shelf

The chronicle is a logbook; the shelf is the save file, added alongside it. A
player can keep up to `MAX_SAVED_WORLDS` (8) worlds by name and reopen one
mid-simulation: same terrain, same creatures, same hungers and ages.

`worlds/types.ts` (shape) · `worlds/wire.ts` (validation + size, shared with the
route) · `worlds/snapshot.ts` (world ↔ snapshot, pure) · `worlds/backend.ts`
(local / account) · `worlds/shelf.ts` (module state, active world, autosave) ·
`components/worlds-panel.tsx` · `api/v1/micro-land/worlds[/[id]]` ·
`lib/micro-land/world-store.ts`.

What is stored: the RLE'd tile grid, every creature's full runtime state, the
world scalars, `natives`, summoned blueprints **that have something alive**, the
summoned `SanitizedTerrain` (not the `Theme` — it carries a `build` function),
the camera column, and where the record-keeper was standing. What is not:
`grain` (regenerated from `seed`; the visible cost is slightly different
speckle), `particles`, and built-in blueprints.

- **The material table version travels with the grid.** Tile values are indices
  into `MATERIAL_IDS`; a save written against a *longer* table is refused rather
  than rendered as whatever now sits at that index (invariant 3).
- **`decodeTiles` measures before it writes.** A one-pass decoder would leave
  half a world behind on its way to returning false, ruining the land on screen.
- **A shelved world is released when the land is replaced** — theme change,
  Reshape, summoned terrain — so the autosave can never overwrite a kept world
  with the one that replaced it. Painting, placing and clearing life do not.
- **Records survive the move.** `steadySince` and `elapsed` are saved together,
  so a resumed streak continues rather than resetting; the outgoing world banks
  its own on the way out. Nothing here can lower a high-water mark.
- Stored at `users/{uid}/microLandWorlds/{saveId}`, one document per world, blob
  unindexed like the chronicle — but with the shelf-row fields (`name`,
  `creatures`, `elapsed`, …) alongside it so `listWorlds` can `select()` them
  without pulling megabytes of saves.
