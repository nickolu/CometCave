import {
  type GameState,
  goalCount,
  nextStar,
  starsAt,
  starsFor,
} from '@/app/meteor-coins/lib/rules'
import type { StageDef } from '@/app/meteor-coins/lib/stages'

/**
 * Plain words for a stage's goal, for the HUD, the result panel and the map.
 * Each goal type counts something different — points, objects collected,
 * coins to spare — so the copy is worked out here, once, in one voice.
 */

const starWord = (n: number) => (n === 1 ? 'a star' : `${n} stars`)

/** The HUD's goal readout: "Score 12", "Moonstones 3/9", "Fed 18/30". */
export function hudMeasure(stage: StageDef, s: GameState): { label: string; value: string } {
  const { goal } = stage.rules
  const count = goalCount(s, goal)
  const value =
    goal.type === 'collect'
      ? `${count}/${goal.total}`
      : goal.type === 'target'
        ? `${count}/${goal.count}`
        : String(count)
  return { label: stage.measure.label, value }
}

/**
 * The HUD's stars and the short note under them. A target goal shows the
 * stars the run would earn if the target were met right now, so spending
 * coins visibly costs stars.
 */
export function hudStars(
  stage: StageDef,
  s: GameState
): { stars: number; note: string; label: string } {
  const { goal } = stage.rules
  if (goal.type === 'target' && s.spareAtGoal === null) {
    const stars = s.coinsLeft === null ? 0 : starsAt(s.coinsLeft, goal.stars)
    return {
      stars,
      note: 'if done now',
      label: `${stars} of 3 stars if the goal were reached now, with ${s.coinsLeft} left.`,
    }
  }
  const stars = starsFor(s, goal)
  const next = nextStar(s, goal)
  if (!next) return { stars, note: 'all stars', label: '3 of 3 stars.' }
  if (next.at === 0) {
    return { stars, note: 'finish for ★', label: `${stars} of 3 stars. Finishing earns a star.` }
  }
  return {
    stars,
    note: `next at ${next.at}`,
    label: `${stars} of 3 stars. Next star at ${next.at}.`,
  }
}

/** The result panel's big number and what it counts. */
export function headline(stage: StageDef, s: GameState): { value: string; caption: string } {
  const { goal } = stage.rules
  if (goal.type === 'target') {
    if (s.spareAtGoal !== null)
      return { value: String(s.spareAtGoal), caption: stage.measure.caption }
    return {
      value: `${goalCount(s, goal)}/${goal.count}`,
      caption: stage.measure.label.toLowerCase(),
    }
  }
  return { value: String(goalCount(s, goal)), caption: stage.measure.caption }
}

/** What the next star takes, as a sentence. */
export function nextStarSentence(stage: StageDef, s: GameState): string {
  const { goal } = stage.rules
  if (goal.type === 'target' && s.spareAtGoal === null) {
    return `Reach ${goal.count} to earn a star.`
  }
  const next = nextStar(s, goal)
  if (!next) return 'Every star on this stage.'
  if (goal.type === 'target') {
    return `Finish with ${next.at} ${stage.measure.caption} for ${starWord(next.stars)}.`
  }
  return `${next.at} ${stage.measure.caption} for ${starWord(next.stars)}.`
}

/** The map card's line for a stored best. */
export function bestText(stage: StageDef, best: number): string {
  return `Best: ${best} ${stage.measure.caption}`
}
