import { PUSHER_PERIOD_S } from '@/app/meteor-coins/lib/cabinet'
import { type PileName } from '@/app/meteor-coins/lib/piles'
import { type RuleConfig } from '@/app/meteor-coins/lib/rules'

/**
 * The campaign: twelve stages, played in order, one star unlocks the next.
 * Designs are in the campaign doc (https://claude.ai/artifact/Qjj2HPLFGNr56y4ZJJHQTX).
 *
 * A stage is data. Everything that differs between stages — the table, the
 * arm, the ring, the coins, the pile, the stars — lives here, and the engine,
 * rules and scene read it. Stages that aren't built yet are listed by name so
 * the map can show what's coming.
 */

export type StageDef = {
  number: number
  /** URL segment, also the pile's name. */
  slug: string
  name: string
  /** One line in the stage's own voice, shown on the map and before play. */
  pitch: string
  playable: true
  table: { chuteHalfWidth: number; pusherPeriodS: number }
  arm: { periodS: number }
  ring: { enabled: boolean }
  pile: PileName
  rules: RuleConfig
  /** In-game lines in the stage's voice. */
  voice: { start: string; clear: string; miss: string }
}

export type ComingSoon = {
  number: number
  slug: string
  name: string
  pitch: string
  playable: false
}

export type Stage = StageDef | ComingSoon

const PENNY_FALLS: StageDef = {
  number: 1,
  slug: 'penny-falls',
  name: 'Penny Falls',
  pitch:
    'The seaside cabinet you remember. The lip is already loaded, so your first coin knocks some over.',
  playable: true,
  // A wider chute than the classic 2.6 so aim doesn't matter yet; gutters are
  // only the outer unit on each side.
  table: { chuteHalfWidth: 3, pusherPeriodS: PUSHER_PERIOD_S },
  // The arm swings on the pusher's beat, so the good moment comes back at the
  // same point of every swing and players pick up the rhythm unprompted.
  arm: { periodS: PUSHER_PERIOD_S },
  ring: { enabled: true },
  pile: 'penny-falls',
  rules: {
    coins: 40,
    // A flat +3 per ring hit. The arm runs on the pusher's slower beat here,
    // which makes ring lineups easy; with the escalating classic table a
    // well-timed bot averaged 308 against a random tapper's 37, so the ring
    // drowned out the pusher this stage exists to teach.
    bonusForStreak: () => 3,
    // From scripts/meteor-coins-sim.ts (20 games each): a random tapper
    // clears one star ~85% of the time; two needs real timing; three is
    // around the well-timed bot's median, which plays near-perfectly.
    stars: [22, 50, 90],
  },
  voice: {
    start: 'Drop when the pusher slides forward.',
    clear: 'Over the edge! Every coin is yours.',
    miss: 'The pier keeps its pennies this time.',
  },
}

const soon = (number: number, slug: string, name: string, pitch: string): ComingSoon => ({
  number,
  slug,
  name,
  pitch,
  playable: false,
})

export const STAGES: readonly Stage[] = [
  PENNY_FALLS,
  soon(
    2,
    'moonstone-porch',
    'Moonstone Porch',
    'Nudge nine moonstones into the jar at your own pace.'
  ),
  soon(
    3,
    'brambles-midnight-snack',
    "Bramble's Midnight Snack",
    'Feed thirty chocolates to the polite monster under the counter.'
  ),
  soon(4, 'hoop-la-cannon', 'Hoop-La Cannon', 'Lob coins in an arc through three hanging hoops.'),
  soon(5, 'the-cairn', 'The Cairn', 'Stack towers that hold on three stone posts.'),
  soon(
    6,
    'rubber-ducky-rumble',
    'Rubber Ducky Rumble',
    'Push wobbly rubber ducks down the bathtub drain.'
  ),
  soon(
    7,
    'the-cascade-engine',
    'The Cascade Engine',
    'Three stacked pushers, each feeding the next.'
  ),
  soon(
    8,
    'the-doorstop',
    'The Doorstop',
    'Eight coins and a wedged bar that only swings from one end.'
  ),
  soon(9, 'gravity-assist', 'Gravity Assist', 'A small moon bends every falling coin.'),
  soon(10, 'the-bedtime-book', 'The Bedtime Book', 'Two pages push toward the fold in the middle.'),
  soon(11, 'redline', 'Redline', 'Ninety seconds. Stay on the beat.'),
  soon(12, 'comet-homecoming', 'Comet Homecoming', 'Help a sleepy giant comet back home.'),
]

/** Looks a stage up by its slug or its number ("1"). */
export function findStage(key: string): Stage | undefined {
  return STAGES.find(s => s.slug === key || String(s.number) === key)
}

export function playableStage(key: string): StageDef | undefined {
  const stage = findStage(key)
  return stage?.playable ? stage : undefined
}
