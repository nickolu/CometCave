/** World tuning. One place to change the feel of everything. */

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
 * of them.
 */
export const MAX_PLANTS = Math.round(195 * WIDTH_SCALE)

/** Seconds a drowning creature survives underwater. */
export const BREATH_SECONDS = 9

/** Cooldown after breeding, seconds. */
export const BREED_COOLDOWN = 12

/**
 * Plants play by different rules, and they have to.
 *
 * A grazer empties its stomach every ~15s, so a dozen of them strip the map far
 * faster than anything gated on a fraction of a 260-second lifespan can grow
 * back — the plants vanish, then everything that eats plants starves, then
 * everything that eats *those* starves. Plants mature in seconds and spread
 * often, and MAX_PLANT_SHARE is what stops that from becoming a green carpet.
 */
export const PLANT_MATURITY = 6
export const PLANT_SPREAD_COOLDOWN = 9

/**
 * How much fullness a meal restores, and what breeding costs.
 *
 * Keep the cost above the meal: if one meal more than pays for a child, grazers
 * breed on every full stomach, overshoot the plants, and take the whole food
 * chain down with them.
 */
export const MEAL_VALUE = 0.42
export const BREED_COST = 0.55

/**
 * Seed rain — animals.
 *
 * A native that has died out comes back once there is something alive for it to
 * eat again. It only fires while something is still alive, so pressing Empty
 * leaves the world empty.
 */
export const SEED_RAIN_INTERVAL = 4

/**
 * Native plants — the ground's own seed bank.
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
 */
export const NATIVE_PLANT_TARGET = Math.round(45 * WIDTH_SCALE)
export const PLANT_SEED_INTERVAL = 3
/**
 * Most plants a single seeding may place, when the world is at zero.
 *
 * Scaled along with the target, not left alone. The interval is a wall-clock
 * rate, so a batch that doesn't grow with the world turns "a meadow can come
 * back" into "a meadow comes back three times slower" — long enough that the
 * grazers waiting on it starve again before it arrives.
 */
export const PLANT_SEED_BATCH = Math.round(3 * WIDTH_SCALE)
/**
 * How many species the ground picks when it establishes its natives.
 *
 * Fewer than are viable, on purpose: two worlds painted with the same soil
 * should not grow the same flora.
 */
export const NATIVE_PLANT_SPECIES = 3

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
 */
export const PLANT_SPECIES_CAP = Math.round(46 * WIDTH_SCALE)

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
