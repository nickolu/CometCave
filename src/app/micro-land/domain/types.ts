/**
 * Micro Land — core types.
 *
 * The whole point of this world is that a creature is *data*. Everything a
 * creature is — its pixels, its animation, how it falls, what it eats, what it
 * runs from, what it leaves behind when it dies — lives in a single plain
 * object literal. Nothing about a creature is code. That's what lets an LLM
 * invent one at runtime (see `blueprint.ts` + the summon route) and drop it
 * into a running world with no new rendering or behavior code.
 */

/**
 * Tile materials. The world is a grid of these.
 *
 * `BaseMaterialId` is the vocabulary — the list a person (or the summoning
 * model) thinks in. A handful of those are *tintable*: the player can paint them
 * in any of `TintId`'s colors, and each color is its own entry in the tile grid
 * (`'plastic-red'`, `'crystal-blue'`). Tints are pure recolors — they inherit
 * every physical property from the material they came from.
 */
export type BaseMaterialId =
  | 'air'
  | 'dirt'
  | 'grass'
  | 'stone'
  | 'sand'
  | 'water'
  | 'lava'
  | 'ice'
  | 'metal'
  | 'glass'
  | 'ash'
  | 'obsidian'
  | 'wood'
  | 'snow'
  | 'mud'
  | 'moss'
  | 'crystal'
  | 'gem'
  | 'gold'
  | 'bone'
  | 'iron'
  | 'marble'
  | 'plastic'
  | 'cloud'
  | 'sap'
  | 'acid'

/** The colors a tintable material can be painted in. */
export type TintId =
  | 'red'
  | 'orange'
  | 'yellow'
  | 'green'
  | 'blue'
  | 'purple'
  | 'pink'
  | 'white'
  | 'black'

/** Materials that come in colors. */
export type TintableMaterialId = 'plastic' | 'crystal' | 'gem' | 'cloud'

export type MaterialId = BaseMaterialId | `${TintableMaterialId}-${TintId}`

export interface Material {
  id: MaterialId
  name: string
  /** Base color, #rrggbb. Per-tile jitter is applied at render time. */
  color: string
  /** How much the renderer varies each tile's color, 0..1. Gives texture. */
  grain: number
  /** Solid tiles block movement and stop falling powders. */
  solid: boolean
  /** Liquids flow sideways and creatures can swim/drown in them. */
  liquid: boolean
  /** Powders fall and pile into slopes. */
  powder: boolean
  /** Touching this kills anything not immune to it. */
  deadly: boolean
  /** Emits light into the dark. 0 = none. */
  glow: number
  /** Plants can only root on these. */
  fertile: boolean
  /**
   * How much this gums up anything moving through it, 0..1.
   *
   * Only means anything for stuff you can be *inside* — cloud and sap. 0 is
   * open air; 0.9 is wading through treacle.
   */
  viscous: number
  /** A liquid you can still breathe in, so it never drowns anything. */
  breathable: boolean
  /** Turns to water next to lava. */
  melts: boolean
  /** Eats through neighbouring solids, using itself up as it goes. */
  corrosive: boolean
  /** Corrosive materials can't touch this. */
  acidProof: boolean
  /** The player can paint this in any tint. Set on the base material only. */
  tintable: boolean
  /** For a tint variant, the material it is a recolor of. */
  tintOf: TintableMaterialId | null
}

// ---------------------------------------------------------------------------
// Creature blueprints — the promptable entity model
// ---------------------------------------------------------------------------

/**
 * Pixel art for a creature.
 *
 * `frames` is an array of animation frames; each frame is an array of row
 * strings; each character in a row is a key into `palette`. `.` is always
 * transparent. Every row in every frame must be the same length.
 *
 *   palette: { b: '#33dd88', e: '#ffffff' }
 *   frames: [
 *     ['.bbb.',
 *      'bebeb',
 *      '.bbb.'],
 *   ]
 */
export interface CreatureArt {
  /** Single-character key → `#rrggbb`. `.` is reserved for transparent. */
  palette: Record<string, string>
  /** 1–4 frames of equal dimensions. */
  frames: string[][]
  /** Milliseconds per animation frame. */
  frameMs: number
  /** Mirror the sprite horizontally when moving left. */
  faceMotion: boolean
}

export type LocomotionKind =
  /** Affected by gravity, walks on solid ground, can jump. */
  | 'walk'
  /** Ignores gravity, moves freely through air. */
  | 'fly'
  /** Only moves inside liquid; flops helplessly on land. */
  | 'swim'
  /** Sticks to any surface — walls and ceilings included. */
  | 'crawl'
  /** Gravity applies but weakly; bobs and drifts. */
  | 'drift'
  /** Never moves. Plants, eggs, coral, mushrooms. */
  | 'root'

export interface CreatureBody {
  /** Gravity multiplier. 0 = weightless, 1 = normal, 3 = boulder. */
  mass: number
  /** How much velocity is kept on impact, 0..1. */
  bounce: number
  /** Velocity retained per second in air, 0..1. Low = sluggish. */
  drag: number
  /** > 1 floats up in liquid, < 1 sinks. */
  buoyancy: number
  /** Materials that can't hurt this creature (e.g. `['lava']`). */
  immuneTo: MaterialId[]
}

export interface CreatureMove {
  kind: LocomotionKind
  /** Tiles per second at full tilt. */
  speed: number
  /** Jump impulse in tiles/second. Only used by `walk`. */
  jump: number
  /**
   * How much of its travelling is done in the air, 0..1. Only used by `walk`.
   *
   * At 0 it runs, and only leaves the ground when something is in its way or
   * it is trying to escape. Above 0 it *hops*: the whole of its speed goes into
   * the leap rather than into its legs, so it covers roughly the ground a
   * walker does but in bursts, with a beat on landing. 0.3 is a frog that sits
   * between jumps; 1 is a grasshopper that is barely ever down.
   */
  hop: number
  /** Chance per second of picking a new idle direction, 0..1. */
  restlessness: number
}

export interface CreatureDiet {
  /**
   * Tags this creature can eat. A creature can eat another if any of these
   * tags appears in the target's `tags` *and* the target isn't bigger than it.
   * This one rule is the entire food chain.
   */
  eats: string[]
  /** Extra tags to flee from beyond its natural predators. */
  fears: string[]
  /** Hunger gained per second, 0..1 scale. At 1 it starts starving. */
  hungerRate: number
  /** How long it survives at full hunger before dying. */
  starveSeconds: number
  /** Fullness (0..1) needed before it will reproduce. */
  breedAt: number
  /** Dies of old age after this long. */
  lifespanSeconds: number
}

export interface CreatureSenses {
  /** How far it can spot food or danger, in tiles. */
  sight: number
}

export interface CreatureHabitat {
  /** If set, it takes damage anywhere that isn't one of these materials. */
  needs: MaterialId[] | null
  /** Non-swimmers drown; set false for amphibians. */
  drowns: boolean
}

/**
 * What this creature can tunnel through.
 *
 * Kept separate from locomotion on purpose: digging is orthogonal to how you
 * move, so a walker, a swimmer and a floater can each be a digger, and each can
 * be limited to different rock.
 */
export interface CreatureDig {
  /** Materials it can chew through. Empty means it cannot dig at all. */
  through: MaterialId[]
  /** Tiles per second it gets through. Low values read as effort. */
  speed: number
}

/**
 * A creature that changes the world around it rather than just living in it.
 *
 * This is how a bee is different from a moth. Both fly and eat plants; only one
 * of them makes the meadow grow faster. Kept as data like everything else, so a
 * summoned creature can be a helper too.
 */
export interface CreatureAura {
  /** How far the effect reaches, in tiles. */
  radius: number
  /** Creatures carrying any of these tags breed faster nearby. */
  helps: string[]
  /** How much faster. 1 = no help, 3 = three times as fast. */
  boost: number
  /** Ground it slowly changes as it goes, e.g. stone into dirt. */
  converts: { from: MaterialId; to: MaterialId } | null
  /** Conversions per second, at most. Low reads as patient work. */
  convertRate: number
}

export interface CreatureDeath {
  /** Leaves this material behind on the tile where it died. */
  becomes: MaterialId | null
  /** Color of the burst of particles it leaves, `#rrggbb`. */
  particleColor: string
  /** How many particles. 0 for a quiet death. */
  particleCount: number
}

/**
 * A complete creature, as a plain object literal.
 *
 * Everything here is data an LLM can author. Nothing is a function, a class,
 * or a reference to code. Add one of these to the world and it lives.
 */
export interface CreatureBlueprint {
  id: string
  name: string
  /** One-line description, shown in the palette and the field guide. */
  blurb: string
  /**
   * Relative size, 1 (mite) to 6 (leviathan). Drives the food chain: nothing
   * can eat something bigger than itself.
   */
  size: number
  /** What this creature *is*. Others hunt it by matching these. */
  tags: string[]
  art: CreatureArt
  body: CreatureBody
  move: CreatureMove
  diet: CreatureDiet
  senses: CreatureSenses
  habitat: CreatureHabitat
  dig: CreatureDig
  death: CreatureDeath
  /** What it does to its surroundings, or null for the vast majority. */
  aura: CreatureAura | null
  /** Light it casts into dark areas, 0..1. */
  glow: number
  /** True for anything the player summoned, so we can badge it in the UI. */
  summoned?: boolean
}

/**
 * Which half of the food web something belongs to.
 *
 * Two buckets rather than the six `CREATURE_GROUPS`, and the reason is that a
 * record is only worth holding if something is competing for it. Split six ways,
 * a land with one hunter in it hands that hunter every hunter record forever and
 * they stop meaning anything. Plant against animal is the one split where both
 * sides are always crowded.
 */
export type LifeKind = 'plant' | 'animal'

/** Display order wherever the two are shown side by side. Plants first. */
export const LIFE_KINDS: LifeKind[] = ['plant', 'animal']

// ---------------------------------------------------------------------------
// Live world state
// ---------------------------------------------------------------------------

export type CreatureMood = 'wander' | 'hunt' | 'flee' | 'eat' | 'rest' | 'mate'

/**
 * The small part of a creature that is its own rather than its species'.
 *
 * A blueprint is shared by every creature that has it — one object, in
 * `WorldState.blueprints`, read by all of them. That is the premise the whole
 * game rests on and it is not up for negotiation, so heritable variation cannot
 * live in the blueprint. It lives here instead: per-creature numbers applied
 * *on top of* the species, passed from parents to children with a nudge.
 *
 * Everything here is deliberately a modifier rather than a value. A hopper's
 * speed is still the hopper's speed; this says whether this particular hopper is
 * a little quicker than its parents were. It also means a trait can never make a
 * creature into something the blueprint didn't describe — the food chain (size
 * and tags) and the economics of eating (`hungerRate`, `breedAt`) are not in
 * here on purpose, because those are what the ecosystem was balanced against.
 *
 * See `domain/traits.ts` for how these are inherited and what reads them.
 */
export interface Traits {
  /** Multiplier on `move.speed`. */
  speed: number
  /** Multiplier on `senses.sight`. */
  sight: number
  /** Multiplier on `diet.lifespanSeconds` — and so on breeding age with it. */
  lifespan: number
  /** Hue rotation applied to the whole palette, in degrees. Wraps. */
  hue: number
  /**
   * Multiplier on the palette's lightness.
   *
   * Carried alongside `hue` because hue rotation does nothing whatsoever to a
   * grey: a species drawn in white and charcoal would drift for a thousand
   * generations and never once look different. Clamped far tighter than the
   * others — a line that drifted to twice its lightness would be a white smear
   * against the sky, and one at half would vanish into the dark.
   */
  shade: number
}

/** One living thing in the world. */
export interface Creature {
  id: number
  blueprintId: string
  /** World-tile coordinates of the sprite's top-left corner. */
  x: number
  y: number
  vx: number
  vy: number
  /** Facing: 1 = right, -1 = left. */
  facing: 1 | -1
  /** 0 = stuffed, 1 = starving. */
  hunger: number
  /** Seconds spent at hunger >= 1. */
  starving: number
  ageSeconds: number
  /**
   * Seconds spent somewhere this creature can't survive — underwater for a
   * lander, out of water for a fish. One timer covers both.
   */
  distress: number
  mood: CreatureMood
  /** Creature id this one is chasing or fleeing, if any. */
  targetId: number | null
  /** Idle wander direction, -1..1. */
  drift: number
  /** Animation clock, ms. */
  animMs: number
  /** True once it's on the ground (walkers only). */
  grounded: boolean
  /** Cooldown before it can breed again, seconds. */
  breedCooldown: number
  /** Lifetime tally of meals eaten — the inspector's evidence that it hunts. */
  mealsEaten: number
  /** Lifetime tally of offspring. */
  children: number
  /** Progress into the tile currently being chewed through, 0..1. */
  digProgress: number
  /** Lifetime tally of tiles tunnelled through. */
  tilesDug: number
  /**
   * How far back this creature's line goes. 1 was placed or seeded by hand or by
   * the world; anything higher was born here, to a parent one lower.
   *
   * Counts ancestry rather than population, so it survives a crash: a species
   * can dwindle to a single individual and its line keeps its depth.
   */
  generation: number
  /**
   * What this one inherited, as multipliers on its species.
   *
   * Neutral for anything that wasn't born here, which is what makes a species
   * that dies out and is placed again genuinely start over rather than resume.
   */
  traits: Traits
  /**
   * What the player called it.
   *
   * Only ever offered for a creature holding the longevity record — naming is
   * the moment a creature stops being one of the hoppers and becomes *yours*,
   * and it is worth more if it has to be earned.
   */
  name: string | null
}

export interface Particle {
  x: number
  y: number
  vx: number
  vy: number
  life: number
  maxLife: number
  color: string
}

export interface WorldState {
  width: number
  height: number
  /** Row-major grid of materials, length `width * height`. */
  tiles: Uint8Array
  /** Per-tile color jitter, so the terrain doesn't look flat. */
  grain: Uint8Array
  creatures: Creature[]
  particles: Particle[]
  /** Blueprints available in this world, keyed by id. */
  blueprints: Record<string, CreatureBlueprint>
  nextCreatureId: number
  /** Seconds since the world started. */
  elapsed: number
  /** Deterministic RNG state. */
  seed: number
  /** Tile-simulation phase, alternated so liquids don't drift one way. */
  flowPhase: number
  /**
   * Species that belong to this world — theme starters plus anything the player
   * summoned. The ground's seed bank only ever draws from this list, so a desert
   * never spontaneously sprouts kelp.
   */
  natives: string[]
  /** Next world-clock time at which the ground may seed native plants. */
  nextPlantSeed: number
  /**
   * True while the player has deliberately emptied the world.
   *
   * Native plants otherwise grow back out of the soil forever, which would make
   * Empty impossible to hold on any world that has ground in it. Anything
   * generative — painting, placing, summoning, changing theme — wakes it again.
   */
  dormant: boolean
}
