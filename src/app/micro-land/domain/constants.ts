/** World tuning. One place to change the feel of everything. */

/** World size in tiles. Everything is drawn at 1 pixel per tile, then scaled up. */
export const WORLD_W = 224
export const WORLD_H = 132

/** Fixed simulation step. */
export const TICK_MS = 1000 / 60
export const TICK_S = TICK_MS / 1000

/** Tile physics runs every N sim ticks — 20Hz reads as liquid, 60Hz as frantic. */
export const TILE_TICK_EVERY = 3

/** Base downward acceleration, tiles/second². */
export const GRAVITY = 34

/** Terminal fall speed, tiles/second. Stops tunnelling through thin floors. */
export const MAX_FALL = 46

/** Hard population ceiling. Past this, nothing new is born (summoning still works). */
export const MAX_CREATURES = 340

/**
 * Hard ceiling on plants, so they can't blanket the world.
 *
 * This is an absolute count, not a share of the population, and that matters in
 * both directions. As a share it is self-defeating: a theme that starts with
 * more plants than grazers is over the cap on frame one and can never spread,
 * so the meadow only ever shrinks — and after a crash, a world of nothing but
 * plants is permanently at 100% and can never regrow either.
 */
export const MAX_PLANTS = 150

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
 * Seed rain.
 *
 * Left alone, a grazer boom strips the last plant and then starves — and a
 * world at zero plants can never come back, because plants only come from other
 * plants. Real meadows recover because seed blows in from outside the meadow;
 * this is that, and it is the difference between a world that breathes and a
 * world you have to restart.
 *
 * It only fires while something is still alive, so pressing Empty leaves the
 * world empty.
 */
export const PLANT_FLOOR = 6
export const SEED_RAIN_INTERVAL = 4

/**
 * Carrying capacity for a single animal species.
 *
 * Without predator pressure a grazer grows until it hits the global population
 * ceiling — 234 hoppers on a map that can feed maybe 60 — and then the entire
 * species starves at once. This is the environment saying "there is only so much
 * room here" and is what turns a terminal crash into an oscillation.
 */
export const SPECIES_SOFT_CAP = 70

/**
 * Carrying capacity for a single *plant* species.
 *
 * Plants share the MAX_PLANTS budget, so without a per-species limit whichever
 * one happens to spread fastest takes the entire allowance and the world becomes
 * a monoculture — which then starves out every grazer too small to eat it.
 * Keeping this well under MAX_PLANTS is what leaves room for a mixed meadow.
 */
export const PLANT_SPECIES_CAP = 55

/** Particle lifetime range, seconds. */
export const PARTICLE_LIFE = 0.9

export const MAX_PARTICLES = 400

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
