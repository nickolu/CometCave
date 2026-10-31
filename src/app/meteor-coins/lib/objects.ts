import { PUCK_RADIUS, PUCK_THICKNESS } from '@/app/meteor-coins/lib/cabinet'
import type { PALETTE } from '@/app/meteor-coins/scene/palette'

/**
 * The things that go on the table: coins, and every special object a stage
 * adds (moonstones, chocolates, ducks). Each is a rigid body built from one
 * or more parts, with its own weight, points and fall behavior.
 *
 * Special objects are always marked by shape as well as color — a crescent,
 * a cherry, a bow — so nothing depends on telling colors apart.
 */

export type Vec3 = readonly [number, number, number]
export type Tone = keyof typeof PALETTE

type PartBase = {
  /** Offset from the object's center, in its own frame (y is up when resting flat). */
  at?: Vec3
  tone: Tone
  /** Visual-only parts are drawn but have no collider: markings, decorations. */
  visualOnly?: boolean
}

export type Part = PartBase &
  /** `notches` cuts V notches around the rim, drawn only: the collider stays round. */
  (| { shape: 'cylinder'; radius: number; height: number; notches?: number }
    /** `rounding` softens the edges, so a pile of squares doesn't lock solid. */
    | { shape: 'box'; size: Vec3; rounding?: number }
    | { shape: 'ball'; radius: number }
    /** A flat arc lying on the object, drawn only: a crescent, a rim. */
    | { shape: 'arc'; radius: number; tube: number; arc: number }
  )

export type ObjectSpec = {
  id: string
  /** Plain names for the HUD and screen readers. */
  name: string
  plural: string
  parts: readonly Part[]
  /** Relative to a coin's 1. */
  density: number
  friction: number
  restitution: number
  /** Points scored when it falls into the chute. */
  points: number
  /** Coins returned to the budget when it falls into the chute. */
  refund: number
  /**
   * Farthest point from its center, seen from above. A ring hit means the
   * whole object clears the rim, so a square's corners count, not its side.
   */
  reach: number
}

export const COIN: ObjectSpec = {
  id: 'coin',
  name: 'coin',
  plural: 'coins',
  parts: [{ shape: 'cylinder', radius: PUCK_RADIUS, height: PUCK_THICKNESS, tone: 'puck' }],
  density: 1,
  friction: 0.6,
  restitution: 0.05,
  points: 1,
  refund: 0,
  reach: PUCK_RADIUS,
}

/** A wide cream disc with an engraved crescent. Each one jarred refunds 3 coins. */
export const MOONSTONE: ObjectSpec = {
  id: 'moonstone',
  name: 'moonstone',
  plural: 'moonstones',
  parts: [
    { shape: 'cylinder', radius: 0.72, height: 0.22, tone: 'moonstone' },
    {
      shape: 'arc',
      radius: 0.36,
      tube: 0.07,
      arc: Math.PI * 1.2,
      at: [0, 0.115, 0],
      tone: 'moonstoneMark',
      visualOnly: true,
    },
  ],
  density: 1.2,
  friction: 0.55,
  restitution: 0.05,
  points: 1,
  refund: 3,
  reach: 0.72,
}

const CHOCOLATE_SIDE = 0.8
const CHOCOLATE_ROUNDING = 0

/** A square of chocolate with a scored cross on top. */
export const CHOCOLATE: ObjectSpec = {
  id: 'chocolate',
  name: 'chocolate',
  plural: 'chocolates',
  parts: [
    {
      shape: 'box',
      size: [CHOCOLATE_SIDE, 0.2, CHOCOLATE_SIDE],
      rounding: CHOCOLATE_ROUNDING,
      tone: 'chocolate',
    },
    {
      shape: 'box',
      size: [CHOCOLATE_SIDE * 0.8, 0.02, 0.06],
      at: [0, 0.105, 0],
      tone: 'chocolateMark',
      visualOnly: true,
    },
    {
      shape: 'box',
      size: [0.06, 0.02, CHOCOLATE_SIDE * 0.8],
      at: [0, 0.105, 0],
      tone: 'chocolateMark',
      visualOnly: true,
    },
  ],
  density: 1,
  friction: 0.8,
  restitution: 0.05,
  points: 1,
  refund: 0,
  reach: (CHOCOLATE_SIDE / 2) * Math.SQRT2,
}

/** A round truffle with a cherry on top, worth three chocolates. */
export const TRUFFLE: ObjectSpec = {
  id: 'truffle',
  name: 'cherry truffle',
  plural: 'cherry truffles',
  parts: [
    { shape: 'cylinder', radius: 0.55, height: 0.36, tone: 'truffle' },
    { shape: 'ball', radius: 0.17, at: [0, 0.3, 0], tone: 'cherry', visualOnly: true },
  ],
  density: 1,
  friction: 0.6,
  restitution: 0.05,
  points: 3,
  refund: 0,
  reach: 0.55,
}

/**
 * A rubber duck: a squat round body with the head set forward and up, so it's
 * top-heavy and tips when bumped. The beak is drawn only — a third collider
 * per duck costs step time for no difference in play.
 */
function duck(scale: number, extra: Part[] = []): Part[] {
  const k = (v: Vec3): Vec3 => [v[0] * scale, v[1] * scale, v[2] * scale]
  return [
    { shape: 'cylinder', radius: 0.4 * scale, height: 0.42 * scale, tone: 'duck' },
    { shape: 'ball', radius: 0.24 * scale, at: k([0.14, 0.36, 0]), tone: 'duck' },
    {
      shape: 'box',
      size: k([0.2, 0.07, 0.15]),
      at: k([0.42, 0.33, 0]),
      tone: 'duckBeak',
      visualOnly: true,
    },
    ...extra,
  ]
}

export const DUCK: ObjectSpec = {
  id: 'duck',
  name: 'duck',
  plural: 'ducks',
  parts: duck(1),
  density: 0.8,
  friction: 0.5,
  restitution: 0.3,
  points: 1,
  refund: 0,
  reach: 0.52,
}

const MAMA = 1.45

/** A big duck with a bow on the back of her head, worth 5. */
export const MAMA_DUCK: ObjectSpec = {
  id: 'mama-duck',
  name: 'Mama Duck',
  plural: 'Mama Ducks',
  parts: duck(MAMA, [
    {
      shape: 'box',
      size: [0.1, 0.2, 0.42],
      at: [-0.05 * MAMA, 0.52 * MAMA, 0],
      tone: 'bow',
      visualOnly: true,
    },
  ]),
  density: 0.8,
  friction: 0.5,
  restitution: 0.3,
  points: 5,
  refund: 0,
  reach: 0.52 * MAMA,
}

/** The Bedtime Book's coin: an ink-blue word. Plays exactly like a coin. */
export const WORD: ObjectSpec = {
  ...COIN,
  id: 'word',
  name: 'word',
  plural: 'words',
  parts: [{ shape: 'cylinder', radius: PUCK_RADIUS, height: PUCK_THICKNESS, tone: 'word' }],
}

/** Redline's coin: amber. Plays exactly like a coin. */
export const AMBER: ObjectSpec = {
  ...COIN,
  parts: [{ shape: 'cylinder', radius: PUCK_RADIUS, height: PUCK_THICKNESS, tone: 'amber' }],
}

/**
 * How Redline's bonus coins look: notched around the rim, so a bonus coin
 * is told apart by its shape, not only its color. Only ever drawn — it
 * plays as an AMBER coin.
 */
export const AMBER_BONUS: ObjectSpec = {
  ...AMBER,
  parts: [
    { shape: 'cylinder', radius: PUCK_RADIUS, height: PUCK_THICKNESS, notches: 8, tone: 'bonus' },
  ],
}

/** Gravity Assist's coin: silver. Plays exactly like a coin. */
export const SILVER: ObjectSpec = {
  ...COIN,
  parts: [{ shape: 'cylinder', radius: PUCK_RADIUS, height: PUCK_THICKNESS, tone: 'silver' }],
}

/**
 * A dark meteorite, worth 5: a thick disc (so it settles instead of
 * rolling away) with three craters on top.
 */
export const METEORITE: ObjectSpec = {
  id: 'meteorite',
  name: 'meteorite',
  plural: 'meteorites',
  parts: [
    { shape: 'cylinder', radius: 0.58, height: 0.34, tone: 'meteorite' },
    ...(
      [
        [0.24, 0.1, 0.12],
        [-0.2, 0.22, 0.09],
        [-0.12, -0.26, 0.1],
      ] as const
    ).map(
      ([x, z, r]): Part => ({
        shape: 'arc',
        radius: r,
        tube: 0.035,
        arc: Math.PI * 2,
        at: [x, 0.175, z],
        tone: 'meteoriteMark',
        visualOnly: true,
      })
    ),
  ],
  // Heavier than a coin, but light enough for the pile to push: at 2.5× it
  // sat on top of the coins and dammed the shelf.
  density: 1.3,
  friction: 0.6,
  restitution: 0.02,
  points: 5,
  refund: 0,
  reach: 0.58,
}

/**
 * Comet Homecoming's comet core: a wide, heavy pale-blue disc with a raised
 * star-shaped cap (a cap and five points), worth 40.
 */
export const CORE: ObjectSpec = {
  id: 'core',
  name: 'comet core',
  plural: 'comet cores',
  parts: [
    { shape: 'cylinder', radius: 0.95, height: 0.42, tone: 'core' },
    { shape: 'cylinder', radius: 0.3, height: 0.12, at: [0, 0.27, 0], tone: 'coreMark' },
    ...Array.from(
      { length: 5 },
      (_, i): Part => ({
        shape: 'box',
        size: [0.16, 0.08, 0.34],
        at: [0.42 * Math.sin((i * 2 * Math.PI) / 5), 0.25, 0.42 * Math.cos((i * 2 * Math.PI) / 5)],
        tone: 'coreMark',
        visualOnly: true,
      })
    ),
  ],
  density: 0.9,
  friction: 0.15,
  restitution: 0.02,
  points: 40,
  refund: 0,
  reach: 0.95,
}

const DREAM_SIDE = 0.8

/** A white square with a crescent moon on it, worth 5 words. */
export const DREAM: ObjectSpec = {
  id: 'dream',
  name: 'dream',
  plural: 'dreams',
  parts: [
    { shape: 'box', size: [DREAM_SIDE, 0.2, DREAM_SIDE], tone: 'dream' },
    {
      shape: 'arc',
      radius: 0.2,
      tube: 0.05,
      arc: Math.PI * 1.2,
      at: [0, 0.105, 0],
      tone: 'dreamMark',
      visualOnly: true,
    },
  ],
  density: 1,
  friction: 0.6,
  restitution: 0.05,
  points: 5,
  refund: 0,
  reach: (DREAM_SIDE / 2) * Math.SQRT2,
}

export const OBJECTS = {
  coin: COIN,
  moonstone: MOONSTONE,
  chocolate: CHOCOLATE,
  truffle: TRUFFLE,
  duck: DUCK,
  'mama-duck': MAMA_DUCK,
  word: WORD,
  dream: DREAM,
  meteorite: METEORITE,
  core: CORE,
}

export type ObjectId = keyof typeof OBJECTS
