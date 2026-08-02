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

/** Tile materials. The world is a grid of these. */
export type MaterialId =
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
  /** Light it casts into dark areas, 0..1. */
  glow: number
  /** True for anything the player summoned, so we can badge it in the UI. */
  summoned?: boolean
}

// ---------------------------------------------------------------------------
// Live world state
// ---------------------------------------------------------------------------

export type CreatureMood = 'wander' | 'hunt' | 'flee' | 'eat' | 'rest'

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
   * summoned. Repopulation only ever draws from this list, so a desert never
   * spontaneously sprouts kelp.
   */
  natives: string[]
  /** Next world-clock time at which repopulation may fire. */
  nextSeedRain: number
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
