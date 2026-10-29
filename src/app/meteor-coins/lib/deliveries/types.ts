import type { Vec } from '@/app/meteor-coins/lib/cannon'
import type { PusherEngine } from '@/app/meteor-coins/lib/engine'
import type { GameEvent } from '@/app/meteor-coins/lib/game'
import type { GameState } from '@/app/meteor-coins/lib/rules'
import type { StageDef } from '@/app/meteor-coins/lib/stages'

/**
 * How coins get onto a stage's table: the swinging arm, the cannon, and
 * whatever a stage brings of its own (a crane, a waterslide, a plunger…).
 *
 * A delivery takes the player's input, runs its own moving parts each step,
 * and hands coins to the game with `host.launch`, which counts each one as
 * the player's drop. It owns no physics bodies of its own beyond what it
 * asks the engine for, and runs identically on screen and headless; its
 * rig in scene/ only reads from it.
 */
export interface Delivery {
  /** Which delivery this is, for the scene and the sim to pick its rig and bot. */
  readonly kind: string
  /**
   * One player input. Returns true if it did something — a coin went, or a
   * step of aiming was taken — so the UI can tell a dud tap from a real one.
   */
  input(e: DeliveryInput): boolean
  /**
   * Once per physics step, before the engine steps: move its parts, push on
   * coins it's carrying, release ones whose moment has come.
   */
  beforeStep?(events: GameEvent[]): void
  /**
   * Once per physics step, after the engine has stepped: check where its
   * coins went (through a hoop, into a cup). Events it raises go in `events`.
   */
  step(events: GameEvent[]): void
  /**
   * Coins it holds or has in the air that the stage must wait for before it
   * can end: one being charged, carried, rolling down a ramp, not yet landed.
   */
  readonly busy: number
  /** Where bonus coins pour from, if not the arm's tip. */
  bonusAt?(): Vec
}

/**
 * The player's input, as the UI sends it. Press and release are pointer
 * down/up and Space down/up. `point` is where the pointer is over the
 * table, already projected onto the plane y = `aimY` (see deliveryAimY):
 * sent on pointer move and just before each press. `steer` is the arrow
 * keys held right now, each axis -1, 0 or 1 (+x is right, +z is toward the
 * player): sent whenever it changes, so a delivery integrates it per step.
 */
export type DeliveryInput =
  | { type: 'press' }
  | { type: 'release' }
  | { type: 'point'; x: number; z: number }
  | { type: 'steer'; x: number; z: number }

/** A coin to put on the table: where, how fast, and whether on edge. */
export type Spawn = Vec & { velocity?: Vec; upright?: boolean }

/** What a delivery can see and do in the game. DropGame implements it. */
export interface DeliveryHost {
  readonly stage: StageDef
  readonly engine: PusherEngine
  /**
   * The stage clock deliveries run on: physics time × the slow-mode speed.
   * Anything the player times against (a swing, a sweep, a bob) should
   * follow this, so slow mode slows it.
   */
  readonly dropperTime: number
  readonly speed: number
  /** Whether a coin may go now: coins left, a free slot in the pool, the board clear. */
  readonly canDrop: boolean
  /** The rules state; change it only through the functions in lib/rules. */
  state: GameState
  /**
   * Puts the player's next coin on the table and counts it as a drop: a
   * coin off the budget, the clock started, phases and meteorites moved on,
   * the tempo judged by `onBeat`, the ring shot tracked. Returns the puck's
   * index, or null if it couldn't (check canDrop first).
   */
  launch(spawn: Spawn, opts?: { onBeat?: boolean }): number | null
  /** Raises an event outside a step (from input); it goes out with the next step's. */
  emit(e: GameEvent): void
}
