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
export const NATIVE_PLANT_TARGET = 45
export const PLANT_SEED_INTERVAL = 3
/** Most plants a single seeding may place, when the world is at zero. */
export const PLANT_SEED_BATCH = 3
/**
 * How many species the ground picks when it establishes its natives.
 *
 * Fewer than are viable, on purpose: two worlds painted with the same soil
 * should not grow the same flora.
 */
export const NATIVE_PLANT_SPECIES = 3

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
