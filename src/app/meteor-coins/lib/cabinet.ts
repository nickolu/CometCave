/**
 * Cabinet geometry and the pure rules that sit on top of it.
 *
 * Units are puck diameters: a round puck is 1 wide and 0.18 thick (~5.5:1).
 * Real coins are ~12:1, and thin bodies tunnel and jitter in a stack. In the
 * headless harness 0.18 and 0.15 piled as still as 0.25 with nothing passing
 * through the table; 0.12 doubled the spin in a resting pile. 0.18 was picked
 * over 0.15 because thinner coins push less per stroke and score lower.
 * Everything else is sized off the puck.
 *
 * Layout, looking down from the player (+z is toward the player):
 *
 *   z = -7    back of the pusher (always hidden behind the back wall)
 *   z = -5.5  back wall face — hangs just above the pusher's top, so pucks
 *             riding the pusher get scraped off as it retracts
 *   z = -2…-0.5  pusher front face, sweeping back and forth
 *   z = 4     front edge — pucks pushed over it fall into the chute or a gutter
 */

export const PUCK_RADIUS = 0.5
export const PUCK_THICKNESS = 0.18
export const FIELD_HALF_WIDTH = 4
export const FIELD_BACK_Z = -7
export const FIELD_FRONT_Z = 4
export const WALL_HEIGHT = 3

export const PUSHER_DEPTH = 5
export const PUSHER_HEIGHT = 0.6
/** Pusher center z sweeps mid ± amp; front face goes -2 … -0.5. */
export const PUSHER_MID_Z = -3.75
export const PUSHER_AMP_Z = 0.75
export const PUSHER_PERIOD_S = 3.2

export const BACK_WALL_Z = -5.5
/** Gap between pusher top and back wall bottom — smaller than a puck. */
export const BACK_WALL_GAP = 0.05

/** Front edge within this half-width drops into the chute; outside is a gutter. */
export const CHUTE_HALF_WIDTH = 2.6

/**
 * The line coins drop along: hard against the back wall, as close as the
 * skill-shot ring (centered on this line) allows without clipping the wall.
 * As the pusher slides forward it opens a clean strip of shelf here, so a
 * well-timed drop lands on clear space instead of on the heap.
 */
export const DROP_Z = BACK_WALL_Z + 0.9

/** Physics runs at a fixed rate regardless of display refresh. */
export const PHYSICS_STEP_S = 1 / 60
export const GRAVITY = -20

export function pusherCenterZ(timeS: number, periodS = PUSHER_PERIOD_S): number {
  return PUSHER_MID_Z + PUSHER_AMP_Z * Math.sin((2 * Math.PI * timeS) / periodS)
}

export type FallResult = 'chute' | 'gutter'

export function classifyFall(x: number, chuteHalfWidth = CHUTE_HALF_WIDTH): FallResult {
  return Math.abs(x) <= chuteHalfWidth ? 'chute' : 'gutter'
}

/**
 * A level of the table: a floor with a pusher on it, an edge at the front,
 * and something hanging just above the pusher's top at the back that
 * scrapes off whatever rides it (the back wall, or the front edge of the
 * deck above). Most stages have one deck; The Cascade Engine stacks three,
 * each spilling onto the pusher top of the one below.
 *
 * A reversed deck faces the other way: its pusher sits at the player's end
 * and pushes away, its wall is in front (glass, so the table shows through)
 * and its edge is behind. The Bedtime Book sets two decks face to face, so
 * both push toward a slot between them.
 */
export type Deck = {
  /** Height of the floor's top. */
  floorY: number
  /** The edge things fall off. */
  frontZ: number
  /** The face of what hangs above the pusher's top. */
  backZ: number
  pusher: {
    /** Pusher center at mid-stroke, and how far it swings either way. */
    midZ: number
    ampZ: number
    depth: number
    /** Seconds this pusher's stroke runs behind the top deck's. */
    lagS: number
    /** Pushes away from the player. */
    reversed?: boolean
  }
}

/** Decks, bottom first. The bottom deck's front edge is the scoring edge. */
export type Layout = readonly Deck[]

export const CLASSIC_LAYOUT: Layout = [
  {
    floorY: 0,
    frontZ: FIELD_FRONT_Z,
    backZ: BACK_WALL_Z,
    pusher: { midZ: PUSHER_MID_Z, ampZ: PUSHER_AMP_Z, depth: PUSHER_DEPTH, lagS: 0 },
  },
]

/** 1 for a deck that pushes toward the player, -1 for one that pushes away. */
export const deckDir = (deck: Deck): 1 | -1 => (deck.pusher.reversed ? -1 : 1)

/**
 * Where a deck's pusher is in its stroke, from -1 (pulled back) to 1 (all
 * the way forward, toward its edge).
 */
export function deckStroke(deck: Deck, timeS: number, periodS = PUSHER_PERIOD_S): number {
  return Math.sin((2 * Math.PI * (timeS - deck.pusher.lagS)) / periodS)
}

export function deckPusherZ(deck: Deck, timeS: number, periodS = PUSHER_PERIOD_S): number {
  const { midZ, ampZ } = deck.pusher
  return midZ + deckDir(deck) * ampZ * deckStroke(deck, timeS, periodS)
}

/** The z of a deck's pusher face at a point in its stroke (1 is full reach). */
export function deckFaceZ(deck: Deck, stroke: number): number {
  const dir = deckDir(deck)
  return deck.pusher.midZ + dir * deck.pusher.ampZ * stroke + (dir * deck.pusher.depth) / 2
}

/** The top deck: where coins are dropped. */
export const topDeck = (layout: Layout): Deck => layout[layout.length - 1]

/** The decks open to the sky, whose walls stand above everything: the ones coins are dropped on. */
export const openDecks = (layout: Layout): Deck[] =>
  layout.filter(d => d.floorY === topDeck(layout).floorY)

/** The deck a coin dropped at `z` falls onto: the highest whose shelf runs under it. */
export function deckUnder(layout: Layout, z: number): Deck {
  for (let i = layout.length - 1; i >= 0; i--) {
    const { frontZ, backZ } = layout[i]
    if (z >= Math.min(frontZ, backZ) && z <= Math.max(frontZ, backZ)) return layout[i]
  }
  return topDeck(layout)
}

/** The back of the table: behind every pusher's back end, with margin. */
export function fieldBackZ(layout: Layout): number {
  if (layout === CLASSIC_LAYOUT) return FIELD_BACK_Z
  const ends = layout
    .filter(d => !d.pusher.reversed)
    .map(d => d.pusher.midZ - d.pusher.ampZ - d.pusher.depth / 2)
  return Math.min(...ends) - 0.4
}

/** The front of the table: the scoring edge, or behind a reversed pusher's far end. */
export function fieldFrontZ(layout: Layout): number {
  const reversed = layout.filter(d => d.pusher.reversed)
  if (!reversed.length) return layout[0].frontZ
  return Math.max(...reversed.map(d => d.pusher.midZ + d.pusher.ampZ + d.pusher.depth / 2)) + 0.4
}

/**
 * The gap between two decks that face each other, which everything falls
 * into, as [back edge, front edge]; null on a table whose edge is at the front.
 */
export function slotOf(layout: Layout): [number, number] | null {
  const away = layout.find(d => d.pusher.reversed)
  const toward = layout.find(d => !d.pusher.reversed)
  return away && toward ? [toward.frontZ, away.frontZ] : null
}

/**
 * How far `z` sits past the scoring edge, out over the drop: negative on the
 * table. In a slot, it's the distance in from the nearer side.
 */
export function overEdge(layout: Layout, z: number): number {
  return Math.min(...layout.map(d => deckDir(d) * (z - d.frontZ)))
}
