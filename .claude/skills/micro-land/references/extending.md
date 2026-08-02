# Micro Land — Extending

Recipes for the changes that come up most. Each one lists every file that has to
move together, because most of these have a step that is easy to miss and fails
silently rather than loudly.

---

## Add a material

1. `domain/types.ts` — add the id to `BaseMaterialId`.
2. `domain/config/materials.ts` — add to `BASE_MATERIAL_IDS` **at the end**
   (index order is stored in the tile grid) and add an entry to
   `BASE_MATERIALS` as a diff against `DEFAULTS`. Only say what makes it
   different from plain rock.
3. Add it to `PAINTABLE` if the player should be able to paint it, in the place
   in the list where it belongs by feel (soft ground first, then rock, then
   built things, then shiny).
4. If it should come in colors, add it to `TINTABLE` and to
   `TintableMaterialId` in `types.ts`. That generates 9 more variants, appended
   after everything else.

Automatic once the above is done: the flag lookup arrays, the paint toolbar, the
tint strip, the summon prompt's material list, the terrain legend enum, and the
blueprint schema's `immuneTo` / `dig.through` / `death.becomes` enums — they all
derive from `BASE_MATERIAL_IDS` or the material table.

**Things that need a deliberate decision:**
- `fertile` — the summon prompt's fertile list is derived, so setting this
  changes what the model is told plants can root on. A world painted only in
  non-fertile materials quietly starves.
- `deadly` — kills anything without it in `immuneTo`.
- `melts` — turns to water next to lava, handled in `tile-sim.ts`.
- `acidProof` — there must always be enough acid-proof materials to build a
  container out of.
- A material with genuinely new *behaviour* (like acid corroding, or cloud being
  passable-but-thick) needs a branch in `tile-sim.ts` or a new precomputed flag
  array in `materials.ts`. Follow how `VISCOSITY` and `IS_DROWNING` are done —
  a `Uint8Array` indexed the same as the grid, never a per-tile object lookup.

Verify: paint it, drop something on it, run the harness on `earth` to confirm
nothing about the food chain moved.

---

## Add a built-in creature

Write it in `domain/config/creatures.ts` as a plain object literal — exactly the
shape a model returns — wrapped in `builtin('<stable-id>', {...})`, then add it
to `BUILTIN_CREATURES`.

Then decide which themes it lives in: add `{ id, count }` to those themes'
`starters` in `domain/config/themes.ts`. Counts are **per screen** and get
multiplied by `WIDTH_SCALE` in `seedStarters` — write the number that reads as
"a meadow" on one screen, not the total.

Getting it right:
- **`size` and art width must agree.** Size drives the food chain and the
  summon prompt publishes the scale (`size 1` = 3–5 wide, `size 6` = 20–28).
  A dragon drawn 9 wide is a beetle that eats everything.
- **Exactly one structural tag** (`plant` / `meat` / `mineral`), then 1–3
  flavour tags. The sanitizer will force one in if you forget, which may not be
  the one you wanted.
- **Check what it slots into.** Run `canEat` in your head against the existing
  roster in both directions: what does it eat, and what eats it? A creature with
  no predators and a plant diet is a population that only goes up until it hits
  `SPECIES_SOFT_CAP`.
- **Adding a plant costs every other plant.** `MAX_PLANTS` and
  `PLANT_SPECIES_CAP` are a shared budget. Adding an eighth plant species to a
  seven-species roster takes a slice out of all seven; check whether the grazers
  still eat.
- Values outside the sanitizer's clamp ranges are silently changed, not
  rejected. If a tuning edit seems to do nothing, check the clamp in
  `sanitizeBlueprint`.

Verify with the harness on every theme it was added to, `--runs 5`, and confirm
it neither goes extinct in every run nor drives something else extinct.

---

## Add a theme

In `domain/config/themes.ts`: a `Theme` object with `id`, `name`, `blurb`, `sky`
gradient, `gloom`, `gravity`, `starters`, and `build(tiles, rng)`. Add it to the
`THEMES` array.

Use the local helpers — `fill`, `set`, `rect`, `blob`, `mossify`, and `across(n)`
for anything scattered (ponds, seams, rooms). `across` is the `WIDTH_SCALE`
multiplier; a bare count doesn't spread out across three screens, it thins out.

Requirements for a theme that actually lives:
- Somewhere fertile, or nothing grows and everything starves.
- Water deep enough to swim in if any starter swims; open air if any flies.
- A starter list that is a working food chain: plants, then things that eat
  plants, then usually one thing that eats those. More small things than big
  things.
- `mossify` after the grid is finished, not inside the generator loop — "is this
  tile exposed" is a question about neighbours that don't exist yet mid-column.

The theme picker in `components/hud.tsx` reads `THEMES`, so it needs no change.

Verify: `npm run sim:micro-land -- --theme <id> --seconds 600 --runs 5`. A new
theme that prints `✗ Everything died` is not ready regardless of how it looks.

---

## Add a milestone

`domain/config/milestones.ts`: an entry with `id`, `text`, and
`reached(context)`. Add fields to `MilestoneContext` only if the existing eight
can't express it, and if you do, populate it in
`GameInstance.updateRecords`/`checkMilestones`.

Order the list by roughly when a player meets it — order only affects the field
guide listing, and it should read as a ladder with the ones still ahead sitting
in a stable place.

Keep the voice: the world remarking on something and then getting on with it.
No badges, no progress bars, nothing to collect on purpose. Milestones fire once
ever, not once per land.

---

## Add a field to the blueprint

This is the big one — it changes the contract between the model and the
simulation, and every piece has to move at once.

1. `domain/types.ts` — add to the interface, with a comment saying what it means
   in the world.
2. `domain/blueprint.ts` — add to `BlueprintSchema` with a `.describe()`. **That
   string is the model's only instruction about the field**; write it for the
   model, with concrete ranges and a worked example. Then add it to
   `sanitizeBlueprint` with a clamp and a fallback that is playable when the
   field is missing entirely.
3. `domain/sim/creature-sim.ts` (or wherever it acts) — read it off the
   blueprint. Never branch on species.
4. `domain/config/creatures.ts` — the built-ins are literals, so they get the
   sanitizer's fallback unless you set the field. Decide whether that fallback
   is right for all 34 or whether some need it explicitly.
5. `domain/creature-kit.ts` — if a hand-drawing player should be able to set it,
   add it to `BuildOptions` and `buildRawCreature`, and a control in
   `components/creature-builder.tsx`. If not, the plan defaults cover it.
6. `components/field-guide.tsx` / `inspector.tsx` — if it's something a player
   should be able to see.
7. `domain/procedural.ts` — the offline fallback creature should set it too.

If the field is optional and easy to get subtly wrong, follow `aura`'s pattern:
collapse anything that doesn't resolve to a real effect back to `null` rather
than shipping a half-working feature.

Add a test in `domain/__tests__/` if the field has non-obvious sanitizing.

---

## Change the summoning prompt

The system prompt lives in `src/app/api/v1/micro-land/summon/route.ts`. Its
material list and fertile list are *derived* from the material table — keep them
that way, so adding a material updates the prompt for free.

The three user prompts (`creaturePrompt`, `terrainPrompt`, `scenePrompt`) are
short on purpose; most instruction belongs in the shared `SYSTEM` block or in
the schema's `.describe()` strings.

Things the prompt is currently load-bearing for, learned the hard way:
- Drawing at the scale `size` says. This is the single most common failure.
- The head on anything size 4+: outline, an eye colour used nowhere else, a jaw
  line, a snout that breaks the outline. Viewers find the face first.
- Two frames with a *small* difference. Two unrelated drawings read as a glitch.
- Facing right.
- "Describe what the creature IS, not what it eats" — otherwise "a snail that
  eats moss" comes back as a plant.
- Keeping the horizon low and putting hollows in deep rock.
- Fertile ground, or the world starves.

Tone is all-ages and kid-safe; creatures hunt each other because that is nature,
but names and descriptions stay warm.

There is no automated test for prompt quality. Summon ten things across the
range (a mite, a dragon, a plant, a fish, something absurd) and look at them.

---

## Balance work

Everything tunable is in `domain/constants.ts`, and the comments there are the
reasoning — update the comment when you change the number.

The relationships that matter:
- `MEAL_VALUE` (0.42) **must stay below** `BREED_COST` (0.55).
- `MAX_PLANTS` is shared across plant species; `PLANT_SPECIES_CAP` stops one
  species taking the lot and turning the world into a monoculture.
- `SPECIES_SOFT_CAP` is what turns a terminal crash into an oscillation — it is
  the environment saying "there is only so much room here".
- `NATIVE_PLANT_TARGET` is a floor, not a quota. Above it the ground does
  nothing; the further below, the harder it seeds. A constant trickle would pin
  every world at `MAX_PLANTS` and produce a green carpet.
- `PLANT_MATURITY` / `PLANT_SPREAD_COOLDOWN` are far shorter than animal
  equivalents on purpose: a grazer empties its stomach every ~15 s.
- Anything scaled by `WIDTH_SCALE` is a density. Keep it that way.

Method: run the harness on all four populated themes at `--runs 5 --seconds 600`
before and after, on the same seeds, and compare `peak`, `low water mark`,
`alive at the end`, per-species averages, and the cause-of-death breakdown. A
change that improves one theme and kills another is not done.

---

## Adding to the drawing kit

`domain/creature-kit.ts` is the hand-drawing path. Its output is a **raw** object
literal in the same shape the model returns, so it goes through
`sanitizeBlueprint` on exactly the same path — a drawn creature and a summoned
one are the same kind of thing, and that must stay true.

- A `Draft` stores hex colours per pixel, not palette keys. Keys are a transport
  detail; quantising to a real palette happens once, at the end, in
  `draftToArt`.
- `BODY_PLANS` numbers are lifted off the starter roster (a Walker is a Hopper,
  a Swimmer is a Finling) so a drawn creature drops into the existing food chain
  and behaves like it belongs. Don't invent numbers for a new plan — copy them
  off a built-in that already works.
- Choices exposed to the player must be answerable by a seven-year-old: how it
  moves, what it eats, whether it glows. Anything finer belongs in the plan
  defaults.
- `sizeForWidth` mirrors the table in the summoning prompt so a hand-drawn and a
  summoned creature of the same width land on the same rung. Change both or
  neither.

Tests live in `domain/__tests__/creature-kit.test.ts` and are the closest thing
this codebase has to a spec for the kit — extend them.

---

## Adding UI

Micro Land takes over the viewport, which interaction model 2 permits *because*
`CosmicShell` carries the cave exit. Don't add a second exit and don't remove
that one.

- Panels are store flags (`summonOpen`, `builderOpen`, `guideOpen`), rendered
  from `MicroLandGame`, at `z-50` (site nav is z-30, the game is z-40).
- Read from the store with selectors, one field at a time — the store is pushed
  to a few times a second and a whole-state selector re-renders everything.
- Never put world data in the store. If a panel needs live creature state, push
  a snapshot from `GameInstance` the way `pushInspected` does.
- Style with the `--cc-*` CSS variables (`--cc-font-mono`, `--cc-mint`,
  `--cc-mint-line`, `--cc-mint-soft`, `--cc-text-muted`) rather than raw colors;
  the shared primary-action color is part of the cave's pact.
- The sparkle icon marks AI-assisted entry points. AI is invisible as a *hook*
  (CLAUDE.md #5) — the sparkle is an affordance, not a "powered by" badge.
- Touch and mouse carry equal weight. Anything reachable by pointer needs a
  keyboard path, and anything conveyed by color or motion needs a second
  channel.
