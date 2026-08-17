---
name: micro-land
description: Working on Micro Land (src/app/micro-land) — the pixel-physics terrarium at /micro-land. Load before changing its simulation, creatures, materials, themes, renderer, summoning route, chronicle, or UI. Covers the premise a creature is data, the invariants that keep summoned creatures working, the headless ecosystem harness that is the real test, and the hazards that make a change look fine and quietly starve the world.
---

# Micro Land — Skill Document

## What this covers

Micro Land is a 2D falling-sand terrarium at `/micro-land`. The player paints
terrain, drops creatures into it, watches a food chain run, and invents new
creatures either by describing them to a model or by drawing them pixel by
pixel. Everything lives under `src/app/micro-land`, plus one API route
(`src/app/api/v1/micro-land/summon`), one persistence route
(`.../micro-land/chronicle`), and one headless harness
(`scripts/micro-land-sim.ts`).

Read `references/architecture.md` for the file map, tick order and data flow.
Read `references/extending.md` for step-by-step recipes (new material, new
creature, new theme, new milestone, balance pass).

## Whose game this is

Micro Land's product direction belongs to Nick's young daughter, not to the
codebase and not to you. She chose the empty-by-default world, the theme picker,
the food chain as the thing that makes creatures feel alive, and summoning that
works for one creature *or* a whole scene. She named it.

When a change is a design decision rather than a repair, offer real options back
rather than picking one: plain language, but each option must change what
actually gets built and say what the consequence is. Toy-level choices ("bouncy
blobs") get rejected; "cross-section of the earth vs. orbital station vs.
tidepool" is the right altitude. Preserve the food-chain-first framing and the
empty starting world unless she changes her mind.

## The game in one paragraph

A world of 672×132 tiles, each one a material from a fixed table, simulated as
falling sand at 20 Hz while creatures move over it at 60 Hz. Every creature is a
plain object literal — pixels, physics, appetite, lifespan — and *nothing* about
a creature is code, which is what lets a model invent one at runtime and drop it
into a running world. The food chain is a single rule: you can eat something if
you list one of its tags and it isn't bigger than you. Populations rise and
crash, and the only thing pulled back from zero is the flora — the ground's
plant seed bank, running slowly. An animal that dies out is gone until the
player puts one back. Records — longest life, deepest bloodline, longest run
with no extinction — persist in a "chronicle" that works with no account and
merges into one when the player signs in. A world the player wants to come back
to can also be kept by name on a "shelf" and reopened mid-simulation.

## Invariants

1. **A creature is data, not code.** There is no per-species branching anywhere
   in the simulation. Every decision reads the blueprint. Built-in creatures in
   `domain/config/creatures.ts` are written as raw object literals and pushed
   through the *same* `sanitizeBlueprint` a summoned one goes through — there is
   no "built-in creature" code path. If you find yourself writing
   `if (bp.id === 'hopper')`, the feature belongs in the blueprint schema
   instead.

2. **Sanitizers never throw.** `sanitizeBlueprint` and `sanitizeTerrain` assume
   hostile input — wrong types, ragged pixel rows, 400 frames, colors that
   aren't colors — and every field falls back to something playable. A failed
   summon returns a procedural creature, never an error toast. A kid who asks
   for a purple fire snail always gets a purple fire snail.

3. **Material order is load-bearing.** The index into `MATERIAL_IDS` is what's
   stored in the tile grid. `air` must stay at 0 (a zeroed `Uint8Array` is an
   empty world). Appending is safe; reordering is not. Tint variants are
   generated *after* the base list so adding a color can never shift an existing
   index. The grid is `Uint8Array`, so the whole table is capped at 256 entries
   (currently 26 base + 36 tints = 62).

4. **The world is not in React.** `GameInstance` owns a mutable `WorldState`
   ticked 60×/second; the Zustand store gets a small summary pushed every 300 ms
   (`STATS_EVERY_MS`). Never put creatures, tiles or particles into store state.
   UI reads snapshots; the game reads `useMicroLand.getState()` imperatively.

5. **Counts are densities in disguise.** Anything tuned by eye against one
   screen of land — population caps, theme starters, ponds, geodes, lava falls,
   the plant seed bank — is multiplied by `WIDTH_SCALE` (`WORLD_W / VIEW_W`, so
   3). A new count written as a bare number does not spread out in a
   three-screen world, it thins out.

6. **`mealValue` must stay below `breedCost`.** If one meal more than pays for
   a child, grazers breed on every full stomach, overshoot the plants, and take
   the entire food chain down with them. Currently 0.42 vs 0.55. Both are
   sliders now, so this is enforced in `tuning.ts` rather than only believed —
   `enforceInvariants` holds the meal a fixed margin under the cost whichever of
   the two was dragged.

7. **Native plants are the only thing that regrows.** Plants only come from
   plants, so a grazer boom that strips the last one is terminal for everything
   above it — the ground carries their seed instead. `seedNativePlants` makes
   the *soil* push the plant population back toward `NATIVE_PLANT_TARGET`,
   harder the further below it the world falls, and it is deliberately blind to
   whether anything is alive. It is also deliberately slow (a batch every 30s,
   3 sprouts at total bareness): it exists to get a stripped world off zero and
   then let plants spread on their own, not to keep the meadow topped up.
   Animals have no equivalent. There *was* an animal seed rain (`repopulate`);
   it was removed because a species coming back four seconds after it died out
   made extinction meaningless. An animal that dies out stays out until the
   player places one.

8. **Empty means empty.** `world.dormant` is set when the player clears the
   world and suppresses the seed bank. Anything generative — painting, placing,
   summoning, changing theme — clears it again.

9. **Sprite size is not collision size.** `artSize(bp)` is what the creature
   looks like (sight, biting, drawing); `bodyBox(bp)` is what it collides with.
   They're identical up to 12×10, above which extra drawing is only 40% solid so
   a dragon's wingtips don't wedge it in a cave. Terrain collision, drowning and
   spawn-fitting all use the core; anything the player can see uses the sprite.

10. **The camera only ever sits on whole tiles.** The renderer draws one canvas
    pixel per world tile into a backbuffer and blows it up with smoothing off.
    A fractional camera would resample every tile onto a half-pixel and undo the
    one thing the renderer exists to protect. `camX` is kept fractional so slow
    pans accumulate, but `viewLeft()` floors it before anything is drawn.

11. **The world is a cylinder, and every stored x is wrapped.** Walk off the
    right edge and you come back on the left; top and bottom are still walls,
    because a wrapped ceiling in falling sand rains powder out of the sky
    forever. `domain/wrap.ts` owns the whole idea. Two consequences bite
    constantly:

    - **`b - a` is not a distance.** Use `deltaX` (signed, and its sign is a
      direction) or `distX`. A plain subtraction compiles, looks right, and
      produces a creature that can *see* across the seam but walks the long way
      round to get there — which reads as bad AI, not as a wrap bug. The same
      trap catches any *midpoint*: half of `a + b` is the far side of the world
      from both parents when they meet across the seam.
    - **Terrain has to meet itself.** Generators sample noise around a *ring*
      (`ringXY`, plus `makeNoise3D`/`fbm3` when depth is involved), never along a
      line from x=0 to x=671, which has no reason to arrive back where it
      started. `world-wrap.test.ts` measures the surface jump at column zero
      against each theme's own roughness — that test is the only thing standing
      between you and a visible cliff down the seam.

    Culling and drawing are the renderer's version of the same problem:
    `overlapsView` decides visibility on a circle, and anything overlapping
    column zero is drawn twice, once at each end.

12. **Records are high-water marks.** That is why the chronicle can be sampled a
    few times a second instead of per frame, why `mergeChronicles` needs no
    conflict resolution, and why banking a streak early is safe. Keep any new
    record monotonic.

13. **Anonymous-first (CLAUDE.md #1).** The game starts on `localBackend` and
    never waits for the network. Auth resolving later calls `adoptAccount`,
    which merges rather than choosing. A player with no account and no
    connection still gets a complete game.

14. **The ecosystem numbers are read off `TUNING`, not off `constants.ts`.**
    Plant seeding, population caps, breeding costs and gravity live in
    `domain/tuning.ts` as a mutable object the settings panel moves while the
    world runs; `constants.ts` holds their defaults and the reasoning for them.
    Importing one of those constants into simulation code compiles fine and
    silently makes that slider do nothing. Adding a knob means adding it to
    `TUNING_DEFAULTS` *and* `KNOBS` — the test asserts those two agree.

## Verifying a change

Run these in order. Step 3 is the one that actually catches ecosystem
regressions.

1. `npm run typecheck`
2. `npm test` — vitest; covers `creature-kit`, `chronicle`, `wire`, `tuning` and
   the world-save `snapshot`/`wire` pair.
3. `npm run eval:micro-land -- --seconds 1600 --runs 3`
   The ecosystem evals: the real simulation, headless, reduced to pass/fail
   claims with an exit code. This is the one that catches ecosystem regressions,
   and a browser cannot substitute for it. Add `--diagnose` to see the breeding
   probe per species while you tune. `--set knob=value` moves the same knobs the
   settings panel does, so a number found by dragging a slider can be run through
   the checks before it becomes a default.

   **Mind the run length.** Maturity is `lifespanSeconds * lifespanScale * 0.2`,
   and `lifespanScale` is 10 — so a species with `lifespanSeconds: 150` cannot
   breed until t=300s, and the slowest animal in `grassland` matures at 760s. Any
   run shorter than about 1600s is measuring how much of a creature's *childhood*
   fits in the window and reporting it as infertility. `run-outlasts-maturity`
   fails when this happens; believe nothing below it until that check is green.

   Read failures top-down — the list is in causal order, and only the first
   failure is worth acting on:
   `foraging-feeds-animals` → `breeding-gate-opens` → `ready-animals-seek-mates`
   → `mate-stints-convert`. Gate before priority before pathing; fixing a knob
   when the priority order is the problem makes the world worse and still shows
   no births.

   **Known-failing today.** `breeding-gate-opens` sits near 0% on every theme:
   animals are blocked roughly half by `too-young` and half by `underfed`, and
   `cooldown` is 0%, so `breedCooldown` is *not* the problem. Several species
   ship with `breedAt` at 0.9–1.0, which asks for a hunger of almost exactly
   zero. `foraging-feeds-animals` passes, so this is not a food-reach problem.

4. `npm run sim:micro-land -- --theme grassland --seconds 600` for the human
   read — population over time, causes of death, what ate what. Use it to see
   *shape*; use the evals to decide whether a change helped. Themes are `empty`,
   `grassland`, `tropical-island`, `verdant-forest`, `tidepool` — `earth`,
   `volcanic` and `station` were retired and any command naming them errors out.
   Look for deaths attributed sensibly (`starved` dominating a grazer means the
   plants lost; `burned` means the terrain is hostile) and `world still solid`
   not collapsing.
5. `npm run lint`
6. In the browser at `/micro-land`: paint, place, drag-throw a creature, summon
   one creature and one scene, pan with each input (arrows, minimap, wheel, two
   fingers, one finger in Look mode), open the field guide.

For balance work, run the evals before and after on the same seeds — `seedFor(i)`
is `1000 + i * 7919`, so run `i` is the same world on every checkout and a diff
is attributable rather than a vibe:

```
npm run eval:micro-land -- --seconds 1600 --runs 3 --diagnose --set breedAt=0.5
npm run eval:micro-land -- --json > after.json     # machine-readable, exit 1 on failure
```

`npm run eval:micro-land:smoke` is the fast version (120s, one seed) — it is a
"did I break the harness" check, not an ecosystem check, and it will always fail
`run-outlasts-maturity` by design.

Adding a check means adding it to `CHECKS` in `harness/evals.ts`. Three rules
live in that file's header and are worth honouring: a check must be able to fail
for exactly one reason, thresholds are floors set where behaviour is
*unambiguously* wrong rather than where the ideal sits, and nothing asserts on a
single seed.

## Known hazards

- **The harness is only mostly deterministic.** `makeRng` is seeded and
  `tile-sim` uses a coordinate hash rather than an RNG, but `emitParticles`,
  `spawnCreature`'s animation phase, and `applyThemeObject`'s default seed all
  call `Math.random()`. Don't write tick-exact assertions; do use `--runs N` and
  read averages.

- **Module-level simulation state.** `creature-sim.ts` keeps `tickCount` and the
  `byX` sort buffer at module scope, and `blueprint.ts` keeps `summonCounter`
  and `bodyBoxCache`. Two worlds in one process share all of them. Fine today
  (one world per page, one per harness run) but it is why `bodyBox` must never
  be asked about a blueprint whose art was mutated in place under the same id.

- **Built-in creatures are silently clamped.** `builtin()` runs the literal
  through `sanitizeBlueprint`, so a value outside the schema's clamp range in
  `creatures.ts` does not error — it changes. If a tuning edit appears to do
  nothing, check the clamp in `sanitizeBlueprint`.

- **The `settleOnGround` arithmetic.** The tile below a box at `y` with height
  `bh` is `floor(y + bh - 0.001) + 1`, **not** `floor(y + bh)`. The naive
  version asks about a row the box is already standing in, which collision has
  just proven empty, so the check silently never passes and nothing that walks
  or roots can be placed. Never hand-roll this; call `settleOnGround`.

- **Per-species caps are shared budgets.** `MAX_PLANTS` is split across every
  plant species, so *adding a plant to the roster takes its share out of every
  other plant*. The roster grew to seven and the grazers started starving; that
  is what `MAX_PLANTS` 150→195 and `PLANT_SPECIES_CAP` 55→46 were fixing.

- **A world can look beautiful and starve.** Terrain with no fertile material
  (`dirt, grass, sand, ash, wood, snow, mud, moss, bone`) supports no plants, so
  nothing eats and everything dies. `hasFertileGround` is checked on summoned
  terrain for exactly this reason; the summon prompt derives its fertile list
  off the material table so a new fertile material updates the prompt for free.

- **`aura.converts` from `air` would let a creature wall the world in.** The
  sanitizer rejects it, along with converting a material into itself. Keep that
  guard if you touch `cleanAura`.

- **Acid spends itself on each bite.** That is the only reason it is safe to
  ship — a puddle can dissolve as many tiles as it has drops and then it's gone.
  Making acid persistent would quietly erase the world while nobody watched.

- **Tint variants inherit every physical property.** Painting must never change
  how a tile behaves; `plastic-red` is `plastic` with a different color and a
  `tintOf` back-reference. Don't give a tint its own physics.

- **The summon route calls the Messages API directly on purpose.** The AI SDK's
  `generateObject` hard-codes `temperature: 0`, which Opus 5 rejects outright.
  Moving it back to the SDK can only work by downgrading the model.

- **Chronicle persistence fails silently by design.** Every error in
  `accountBackend` is swallowed, so a missing rules/index deploy, an expired
  token or a dropped connection looks exactly like a working game that quietly
  stops saving. After touching storage, confirm the write actually landed in
  Firestore rather than trusting the absence of an error. `firestore.rules` and
  the `microLand.blob` / `microLandWorlds.blob` index exemptions all need
  deploying (`firebase deploy --only firestore:rules,firestore:indexes`).

## House style

Prettier: no semicolons, single quotes, 2-space, 100 cols, `arrowParens: avoid`.
ESLint enforces grouped + alphabetized imports and `@/…` aliases over `../…`.

Comments in this codebase explain *why*, at length, and are load-bearing
documentation — several of them are the only record of a bug that took a day to
find. Match that register: when you change a tuned number, update the comment
that justifies it. Commit messages follow the same standard —
`feat(micro-land): <lowercase phrase>` with a body that explains the reasoning,
not the diff.
