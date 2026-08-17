/**
 * World tuning. One place to change the feel of everything.
 *
 * Some of these are *defaults* rather than values: the ecosystem numbers — plant
 * seeding, population caps, breeding, gravity — are re-exported through
 * `tuning.ts` as a mutable `TUNING` object that the options panel can move while
 * the world runs, and the simulation reads that object rather than the constant.
 * The comments here are still the reasoning for where each one starts; if you
 * change one, change it here, and check whether `tuning.ts` gives it a slider
 * range that still contains the new value.
 *
 * If you add a use of one of those constants directly in simulation code, the
 * panel will silently stop working for it. Read it off `TUNING` instead.
 */

/**
 * World size in tiles. Everything is drawn at 1 pixel per tile, then scaled up.
 *
 * The world is three screens wide and one screen tall. It used to be exactly one
 * screen of each, and the old width lives on as VIEW_W below — that is the part
 * that matters, because the terrarium is only legible at a certain number of
 * tiles across. A creature is 4-28 tiles; fit 672 of them into a phone and the
 * whole world is smaller than the sprite you are trying to look at.
 */
export const WORLD_W = 672
export const WORLD_H = 132

/**
 * How much world the camera shows at once, in tiles.
 *
 * This is the *zoom*, not a viewport size: the renderer sizes a tile so that
 * VIEW_W of them span the canvas, which is exactly the scale the world had back
 * when it was 224 wide and fully visible. A wide display gets to see more than
 * VIEW_W tiles (height runs out first), a phone sees exactly this many. Either
 * way a hopper is the same size it has always been.
 */
export const VIEW_W = 224

/**
 * How many times wider than one screen the world is.
 *
 * Counts tuned for a single screen — how many ponds, how many starting hoppers,
 * how many of a species the land can carry — are all densities wearing an
 * absolute number's clothing. Multiplying them by this is what stops a world
 * three times the size from feeling three times as empty.
 */
export const WIDTH_SCALE = WORLD_W / VIEW_W

/** Fixed simulation step. */
export const TICK_MS = 1000 / 60
export const TICK_S = TICK_MS / 1000

/** Tile physics runs every N sim ticks — 20Hz reads as liquid, 60Hz as frantic. */
export const TILE_TICK_EVERY = 3

/** Base downward acceleration, tiles/second². */
export const GRAVITY = 34

/** Terminal fall speed, tiles/second. Stops tunnelling through thin floors. */
export const MAX_FALL = 46

/**
 * Tiles of height one point of `move.jump` is worth.
 *
 * `jump` used to be a launch velocity, handed straight to `c.vy`, and at this
 * gravity that made it very nearly a decoration. Apex is `v² / 2gm`, so a Mite
 * on `jump: 6` rose 0.53 tiles, a Grumblestone on `jump: 5` rose 0.12, and a
 * tyrannosaur rose 0.18 — all of them less than the single tile they could
 * already step up without jumping at all. Every walker in the game except the
 * Hopper was therefore stopped dead by a two-tile bump, which is exactly what a
 * bump looks like after the sand has moved once.
 *
 * So `jump` now says how high the creature means to get and the launch velocity
 * is solved for. It is read against `GRAVITY` and the creature's own mass but
 * *not* against the theme's gravity multiplier, so a leap is worth the same
 * number of tiles in every world the player builds — and the station, at 0.35g,
 * still sends the same push nearly three times as high. Floatiness stays a
 * property of the place rather than something each creature has to be tuned for.
 *
 * Calibrated so the roster reads the way it was written: Loamworm (3) barely
 * clears a tile, most walkers (5-6) clear about two, hunters (9-10) clear three,
 * and the Hopper (12) clears four and looks like it means it.
 */
export const JUMP_TILES_PER_STRENGTH = 0.33

/**
 * How much further a starving animal finds food than a fed one, as a multiple
 * of its own sight.
 *
 * The harness is what forced this. Sampling every animal that was within a
 * breath of starving and measuring the distance to the nearest thing it could
 * have eaten: a Finling with 20 tiles of sight was a median of 47 tiles from
 * the nearest kelp, a Crystal Snail with 14 was 55 tiles away, and a Woolly
 * with 18 was 45 — with the meadow pinned at its species cap the whole time.
 * Food was never scarce. It was over the horizon, and the horizon was a circle
 * the animal could not enlarge no matter how badly it needed to.
 *
 * The multiplier ramps in with hunger and applies to food only. Fear is not
 * improved by starving — a desperate animal is worse at noticing what is
 * hunting it, not better — so threats keep plain `senses.sight`, which also
 * means hunger genuinely trades safety for a meal rather than being free.
 *
 * Read it as smell rather than sight. Nothing in the renderer draws it, and a
 * creature still has to walk the whole way, so what it actually buys is a
 * direction to walk in instead of a coin flip.
 */
export const HUNGER_REACH = 2

/**
 * Hunger at which an animal stops browsing and starts searching.
 *
 * Below this it wanders the way it always did — `restlessness` re-rolls its
 * heading, which mills it around a home patch. Above it, the re-rolls slow down
 * and the heading goes to full tilt, so it strikes out in one direction and
 * keeps going. A random walk covers ground like the square root of time and a
 * committed one covers it linearly; over the minute an animal has between full
 * and dead, that is the difference between crossing 20 tiles and crossing 200.
 */
export const FORAGE_HUNGER = 0.55

/**
 * Global multiplier on every creature's per-species hunger rate.
 *
 * 1 = the per-species rates as written. 0 = creatures never get hungry (hunger
 * is effectively disabled). Values above 1 make every animal drain faster,
 * compressing the window between a full stomach and a starving one without
 * touching the amount a meal restores — so a world set to 2× goes through the
 * same boom-and-crash cycles on a tighter clock.
 *
 * Down to 0.1 from 0.25. Starvation was the dominant cause of death in every
 * theme and it was a *reach* problem, not a shortage — the meadow sat at its
 * species caps while animals died a screen away from it. Draining ten times
 * slower than the blueprints assume gives a hungry animal long enough to
 * actually cross the distance, which is the same thing MIGRATION_THRESHOLD and
 * MATE_RADIUS were lowered/raised for.
 */
export const HUNGER_RATE_SCALE = 0.1

/**
 * Hard population ceiling. Past this, nothing new is born (summoning still works).
 *
 * Scaled with the world rather than left alone, because this ceiling binds well
 * before the per-species caps do — leaving it at a single screen's worth would
 * have made a three-screen world one third as densely populated, which is the
 * opposite of what a bigger world is for.
 */
export const MAX_CREATURES = Math.round(340 * WIDTH_SCALE)

/**
 * Hard ceiling on plants, so they can't blanket the world.
 *
 * This is an absolute count, not a share of the population, and that matters in
 * both directions. As a share it is self-defeating: a theme that starts with
 * more plants than grazers is over the cap on frame one and can never spread,
 * so the meadow only ever shrinks — and after a crash, a world of nothing but
 * plants is permanently at 100% and can never regrow either.
 *
 * Raised from 150 when the roster grew to seven plant species: the ceiling is
 * shared, so every species added to a world takes its share out of everything
 * else's, and a crowded world was starving its grazers rather than feeding more
 * of them. Raised again to 650 whole-world when NATIVE_PLANT_SPECIES went to 8 —
 * eight species at PLANT_SPECIES_CAP is 560, so the global ceiling has to sit
 * above that or it becomes the binding limit and the mix collapses back to
 * whichever plant spreads fastest.
 *
 * Written per screen and scaled, like every other count here, but the number was
 * found on the slider in the full 672-wide world: 650 there, ~217 per screen.
 */
export const MAX_PLANTS = Math.round(216.7 * WIDTH_SCALE)

/** Seconds a drowning creature survives underwater. */
export const BREATH_SECONDS = 9

/**
 * Cooldown after breeding, seconds.
 *
 * One second, down from twenty. The cooldown is no longer what paces breeding —
 * BREED_COST is, and at a hunger rate of 0.1 refilling a stomach to the point
 * where a parent can afford another child takes far longer than any cooldown
 * would. Leaving the timer at twenty on top of that was double-charging for the
 * same thing and it was part of why no animal population could hold itself up.
 */
export const BREED_COOLDOWN = 1

/**
 * How close two animals of the same kind have to be to have a baby, in tiles.
 *
 * An animal needs a willing partner — one of its own kind, grown, off cooldown
 * and as well fed as it is — and this is the last gap they have to close. It is
 * *not* how far they can see each other from: finding a mate rides on the
 * ordinary sense pass, so a hopper spots one anywhere inside its 20 tiles of
 * sight and then walks over. This is only the distance at which the walking
 * stops being necessary.
 *
 * Ten tiles is a few body-lengths apart — close enough that the pair is visibly
 * together when the baby appears, far enough that two walkers steering at each
 * other actually converge instead of jittering past one another. Making it much
 * tighter reads as broken: you watch two well-fed hoppers stand next to each
 * other and nothing happens.
 *
 * The real cost of this whole mechanic is paid here. A species down to its last
 * individual can no longer recover, and a species scattered thinly across three
 * screens breeds far more slowly than the same headcount in one meadow. That is
 * the intended shape — but at six tiles the penalty for being thinly spread was
 * steep enough that no animal species was self-sustaining in a three-screen
 * world at all, so this went to ten: a pair that has walked into the same
 * neighbourhood counts as having met.
 */
export const MATE_RADIUS = 10

/**
 * How far a child's heritable traits may fall from its parents'.
 *
 * Every creature carries a handful of numbers of its own — how fast it is, how
 * far it sees, how long it lives, what colour it is — as multipliers on its
 * species' blueprint. A child takes the midpoint of its two parents and then
 * moves by up to this much in either direction. That is the entire mutation
 * mechanic; the world's existing pressures (predators, starvation, drowning) do
 * the selecting for free.
 *
 * This number carries *all* of the variation, which is why it is as large as it
 * is. Founders are deliberately identical — every creature placed by hand, and
 * every plant the ground seeds, is exactly 1.0 on everything — so a new world
 * starts with no variance at all and every difference you ever see was
 * manufactured here, one birth at a time.
 *
 * Blending halves the spread each generation while this puts some back, so a
 * population settles at a standard deviation of about `drift * sqrt(2/3)` —
 * 0.10 at 0.12. That is the number to reason with: it is roughly how far apart
 * two siblings are, and therefore how much raw material selection has to work
 * on in any one generation. At 0.04 the drift is real but takes a hundred
 * generations to see, which is longer than any world survives. At 0.12 a line
 * under steady pressure visibly separates from its founders in about ten.
 *
 * Zero is a legitimate setting and turns inheritance off entirely: every
 * creature is then exactly its blueprint, which is how the game behaved before
 * any of this existed.
 */
export const TRAIT_DRIFT = 0.12

/**
 * Plants play by different rules, and they have to.
 *
 * A grazer empties its stomach every ~15s, so a dozen of them strip the map far
 * faster than anything gated on a fraction of a 260-second lifespan can grow
 * back — the plants vanish, then everything that eats plants starves, then
 * everything that eats *those* starves. Plants mature in seconds and spread
 * often, and MAX_PLANT_SHARE is what stops that from becoming a green carpet.
 *
 * Maturity halved to 20 and the cooldown nudged to 26: the doubling time barely
 * moves (40+20 = 60s, 20+26 = 46s), but the front-loaded half means a sprout the
 * ground has just placed contributes to the recovery much sooner, which is what
 * the seed bank is for. The cooldown carries the rest, and PLANT_CROWDING_STRENGTH
 * lengthens it wherever a species is already dense.
 */
export const PLANT_MATURITY = 20
export const PLANT_SPREAD_COOLDOWN = 26

/**
 * How much fullness a meal restores, and what breeding costs.
 *
 * Keep the cost above the meal: if one meal more than pays for a child, grazers
 * breed on every full stomach, overshoot the plants, and take the whole food
 * chain down with them.
 *
 * Both roughly halved (0.54/0.69 → 0.26/0.31) so more of the world's pacing sits
 * in eating and less in the timers. A parent now needs two bites per child rather
 * than one-and-a-bit, which is what lets BREED_COOLDOWN drop to a second without
 * turning every full stomach into a litter. Note the margin is exactly
 * MEAL_HEADROOM (0.05) — `enforceInvariants` in tuning.ts holds it there, so
 * lowering the cost any further will pull the meal down with it.
 */
export const MEAL_VALUE = 0.26
export const BREED_COST = 0.31

/**
 * A multiplier over every blueprint's `breedAt` — how full it has to be to breed.
 *
 * Ships at 1, so by itself it changes nothing. It exists because `breedAt` is
 * per-species data and the ecosystem's hardest open question is whether the
 * breeding gate is shut by that number rather than by the food supply — and a
 * number on a blueprint cannot be swept. The harness's `--set` and the settings
 * panel both reach `TUNING` and only `TUNING`, so without this the most-suspected
 * lever in the world was the one nobody could move.
 *
 * A multiplier and not an override: the roster's *ordering* is deliberate (a
 * stalker is stricter than a mite because a predator's meal is rarer), and a flat
 * value would erase that while appearing to answer the question.
 *
 * See `breedFullness` in `creature-sim.ts` for why `breedAt: 1` is exempt.
 */
export const BREED_AT_SCALE = 1

/**
 * Native plants — the ground's own seed bank, and the only regrowth there is.
 *
 * Animals had a seed bank too once: any native that had died out wandered back
 * in every four seconds as long as something was alive for it to eat. It kept
 * every world populated and it made extinction meaningless — a kind you had
 * watched starve was back before the notice finished scrolling, and the world
 * read as a stocked aquarium rather than somewhere things happen. It is gone.
 * Animals that die out stay out until the player places one.
 *
 * Plants are the only thing in the world with no upstream: a grazer boom strips
 * the last one and then nothing can ever bring it back, because plants only come
 * from plants. Everything downstream starves and the world is a restart.
 *
 * So the *ground* holds the seed instead of the plants. The first time a world
 * has soil in it, whichever species could live on that soil become its natives
 * (see `establishNativePlants`), and from then on that soil keeps pushing the
 * plant population back toward `NATIVE_PLANT_TARGET`. A meadow can be grazed
 * flat and still come back, which is what makes a population renewable rather
 * than merely long-lived.
 *
 * The target is a floor, not a quota. Well above it the ground does nothing at
 * all and plants spread the ordinary way; the further below it the world falls,
 * the harder the seed comes in. That asymmetry is deliberate — a constant
 * trickle would just pin every world at MAX_PLANTS and turn it into a carpet.
 *
 * 115 whole-world, up from 15. Fifteen plants across three screens is a floor
 * only in the most literal sense: it got the count off zero and left the meadow
 * to rebuild itself from five sprouts per screen, which took longer than the
 * grazers waiting on it had. This still sits well under MAX_PLANTS (650), so the
 * ground goes quiet in a grown-in world and plants do their own spreading —
 * it is just a floor a food chain can actually stand on.
 *
 * Per screen this is ~38; the number itself was found on the slider in the full
 * 672-wide world.
 */
export const NATIVE_PLANT_TARGET = Math.round(38.3 * WIDTH_SCALE)
/**
 * How long the ground waits between seedings.
 *
 * Slow on purpose — this was 35s, up from an original 3s. At three seconds the
 * soil was doing the work the plants are supposed to do: a grazed patch filled
 * back in while you were still watching it be grazed, so nothing the animals did
 * to the meadow ever showed. Recovery is meant to come from plants that exist
 * spreading on their own (PLANT_MATURITY + PLANT_SPREAD_COOLDOWN, ~46s per
 * doubling) — all the ground has to do is get the count off zero.
 *
 * Back down to 13s, which at PLANT_SEED_BATCH 1 is the entire rate: one sprout
 * every thirteen seconds, or about 4.5 a minute, and none at all once the world
 * is at NATIVE_PLANT_TARGET. That is still a trickle against a 650-plant ceiling
 * — what it stops being is slower than the thing it is a floor under. At 35s the
 * ground needed nearly an hour to walk a stripped world back to a target of 115,
 * by which time everything that ate plants had already died of it.
 */
export const PLANT_SEED_INTERVAL = 13
/**
 * Most plants a single seeding may place, when the world is at zero.
 *
 * One per screen of land, scaled up here rather than left as a bare number, so
 * a three-screen world gets three sprouts spread across it instead of three
 * screens sharing one. Small on purpose: the ground is starting a meadow, not
 * planting one. Anywhere near the target this rounds down to a single sprout
 * every thirty seconds, which is what the trickle is meant to feel like.
 */
export const PLANT_SEED_BATCH = 1
/**
 * How many species the ground picks when it establishes its natives.
 *
 * This used to be fewer than are viable on purpose, so that two worlds painted
 * with the same soil would not grow the same flora. That variety cost more than
 * it bought: three species is three ways for a grazer to be looking at a plant it
 * cannot eat, and a picky eater in a world whose soil happened not to pick its
 * food starved through no fault of its own. Eight takes essentially every viable
 * plant, so the flora a world grows is now decided by what its *soil* can support
 * rather than by a shuffle — which is the more legible answer anyway, since the
 * player chose the soil.
 */
export const NATIVE_PLANT_SPECIES = 8

/**
 * How often a seed is dropped from the sky rather than from a random height.
 *
 * Not a taste setting — this is the difference between a meadow and a world
 * that looks bare while its plant counter reads full. Every fertile surface in
 * a cross-section world is a candidate for a seed, and the overwhelming
 * majority of them are cave floors: the sky holds nothing, the outdoor surface
 * is one row per column, and the rock below it is a honeycomb. Sampling a point
 * in that volume uniformly put 95% of the flora underground. Measured on earth
 * over ten minutes: 554 of 585 plants buried, one sunleaf left on the surface
 * of the entire world, grazers starving at more than twice the rate they were
 * being hunted, and the ground's own seed bank switched off the whole time
 * because the *global* plant count was sitting on its ceiling.
 *
 * Short of 1 on purpose. Caves keeping some flora is what makes a glowvine
 * worth finding down there, and it is the only way anything grows in a world
 * with no outdoor surface at all — a sealed station, a cavern the player
 * painted shut. One seed in six is enough to green a cave system slowly
 * without taking the meadow's share of MAX_PLANTS back off it.
 */
export const SURFACE_SEEDING_BIAS = 0.84

/**
 * Carrying capacity for a single animal species.
 *
 * Without predator pressure a grazer grows until it hits the global population
 * ceiling — 234 hoppers on a map that can feed maybe 60 — and then the entire
 * species starves at once. This is the environment saying "there is only so much
 * room here" and is what turns a terminal crash into an oscillation.
 */
export const SPECIES_SOFT_CAP = Math.round(70 * WIDTH_SCALE)

/**
 * Carrying capacity for a single *plant* species.
 *
 * Plants share the MAX_PLANTS budget, so without a per-species limit whichever
 * one happens to spread fastest takes the entire allowance and the world becomes
 * a monoculture — which then starves out every grazer too small to eat it.
 * Keeping this well under MAX_PLANTS is what leaves room for a mixed meadow.
 *
 * Down to 70 whole-world from 138, alongside NATIVE_PLANT_SPECIES 3 → 8. The
 * meadow is about the same size in total (8 × 70 = 560 against the old 3 × 138 =
 * 414, both under the 650 ceiling) but it is spread across every plant the soil
 * can carry instead of concentrated in three. A grazer's own food is scarcer per
 * species and the world as a whole is greener, which pushes animals to range for
 * it rather than sit in one patch — and makes it far less likely that the one
 * plant a species eats is the one that got shuffled out.
 *
 * Per screen this is ~23; the number was found on the slider at whole-world scale.
 */
export const PLANT_SPECIES_CAP = Math.round(23.3 * WIDTH_SCALE)

/**
 * How long a pollinator can carry a seed before it auto-drops, seconds.
 *
 * Long enough for a dustbee or fluttermoth to cross a gap between two plant
 * clusters, short enough that a seed does not ride forever on a creature that
 * never lands. The 2-second minimum-carry guard in creature-sim prevents
 * the seed from dropping right back at the pickup plant.
 *
 * Ten, down from fifteen. With eight native species sharing the meadow the gaps
 * a bee has to cross are shorter, and a shorter carry means a seed lands nearer
 * the cluster it came from, which keeps a species from being smeared so thin that
 * PLANT_SPREAD_MIN and the crowding penalty are the only things placing it.
 */
export const POLLINATION_CARRY_SECONDS = 10

/**
 * When 1, plants cannot spread on their own — they may only reproduce via
 * pollinator seed-carriers. 0 = off (default).
 */
export const POLLINATION_ONLY = 0

/**
 * Multiplier added to spread cooldown per same-species plant within crowding radius.
 *
 * 0.6, down from 2. At 2 a plant with three neighbours took seven times as long
 * to spread again, which was strong enough to be the real cap on the flora — the
 * meadow stopped growing long before PLANT_SPECIES_CAP had anything to say about
 * it, and a species knocked back to a single clump could barely restart. Now the
 * caps do the limiting and this only biases *where* the growth goes.
 */
export const PLANT_CROWDING_STRENGTH = 0.6

/** Minimum tiles a plant seed must travel from its parent. */
export const PLANT_SPREAD_MIN = 11

/** Particle lifetime range, seconds. */
export const PARTICLE_LIFE = 0.9

export const MAX_PARTICLES = Math.round(400 * WIDTH_SCALE)

// ---------------------------------------------------------------------------
// Records
// ---------------------------------------------------------------------------

/**
 * How old something has to get before it can hold the longevity record.
 *
 * Without a floor the very first creature in a fresh land takes the record at
 * one hundredth of a second and wears its halo immediately, which makes the mark
 * meaningless and puts it on screen constantly — the opposite of the intent.
 * Sixty seconds is long enough that most things are eaten first, so an elder is
 * genuinely something that survived rather than something that merely spawned.
 */
export const ELDER_MIN_SECONDS = 60

/**
 * How long a land must hold together before its steady streak is worth showing.
 *
 * Below this the number would flicker on and off during the early churn while
 * populations find their level, which reads as noise. Two minutes in, a streak
 * means the food web actually settled.
 */
export const STEADY_SHOW_SECONDS = 120

/**
 * Base probability per tick that a sick creature infects a healthy neighbour.
 *
 * Off by default (0). Disease is a second pressure on populations that cannot yet
 * reliably hold themselves up against the first one, and a contagion running
 * through a species that is already thin is just a faster extinction with a
 * different name in the death log. The mechanic stays — the knob is there, and
 * Sporecap spores are unaffected by this — but it is opt-in.
 */
export const DISEASE_SPREAD_CHANCE = 0

/**
 * How long a creature stays sick after catching a disease, in sim-seconds.
 * Sporecap spore infections use a fixed 5 s regardless of this setting — they
 * are a brief slow, not a full disease.
 */
export const DISEASE_DURATION = 10

/**
 * Seconds a creature must be hungry with no food in sight before it abandons
 * its home range and migrates toward richer terrain.
 *
 * Fifteen, down from sixty. Sixty was set to give the expanded-sight-range
 * mechanic room to work first, but the harness showed sight was not the binding
 * problem — food was a median of 45-55 tiles away from animals about to starve,
 * which is past any sight range hunger can buy. What they needed was to be walking
 * in a direction, sooner. Fifteen seconds of local searching before committing to
 * a move makes populations nomadic, and a nomadic species finds the meadow.
 */
export const MIGRATION_THRESHOLD = 15

/**
 * How many seconds of resting it takes to build a nest from scratch.
 *
 * Thirty seconds ensures a creature has to commit to a spot before it gets a
 * burrow — fast enough to see happen in a session, slow enough that nomadic
 * creatures never stay anywhere long enough to build one.
 */
export const NEST_BUILD_TIME = 30

/**
 * How many seconds a nest survives after its owner stops visiting.
 *
 * Two minutes: long enough that a creature can leave to hunt and return, short
 * enough that an abandoned burrow eventually disappears.
 */
export const NEST_DECAY_SECONDS = 120

/**
 * Global lifespan multiplier applied on top of each species' base lifespanSeconds
 * and each creature's inherited lifespan trait. 2 = twice as long-lived as the
 * per-species defaults, which were tuned at 1× for a faster-paced world.
 *
 * Now 10. Lifespan is the budget an animal has to solve the reach problem in: at
 * 2× a grazer had about nine minutes to find a mate, close MATE_RADIUS with it,
 * and eat twice over in a world three screens wide, and most of them ran out of
 * clock rather than out of food. Ten makes a natural death something that happens
 * to a creature that already bred, which is the difference between a population
 * and a queue. It also means `old age` should be a visible cause of death in the
 * harness — if starvation still dominates, the reach problem is not solved.
 */
export const LIFESPAN_SCALE = 10

/**
 * Default interval between spawner emissions, in seconds.
 *
 * Ten seconds lets a new world populate without overwhelming the population
 * caps, while still being fast enough to notice. Adjust per-spawner at
 * placement time.
 */
export const SPAWNER_DEFAULT_INTERVAL = 10

/**
 * Default local-population cap for a spawner.
 *
 * A spawner suppresses its next emission if this many creatures of the same
 * species are already within maxLocal tiles. Keeps each spawner from flooding
 * a small area while still letting the species spread.
 */
export const SPAWNER_DEFAULT_MAX_LOCAL = 5

/** Number of horizontal region bands for biome classification (Issue #3377). */
export const NUM_BIOME_REGIONS = 8

/** Height in rows of each biome region band. */
export const BIOME_REGION_H = Math.ceil(WORLD_H / NUM_BIOME_REGIONS) // 17
