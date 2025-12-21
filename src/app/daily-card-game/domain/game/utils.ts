import type { Effect } from '@/app/daily-card-game/domain/events/types'
import type { PlayingCard } from '@/app/daily-card-game/domain/playing-card/types'
import { mulberry32, xmur3 } from '@/app/daily-card-game/domain/randomness'
import { getInProgressBlind } from '@/app/daily-card-game/domain/round/blinds'

import type { GameState } from './types'

export function collectEffects(game: GameState): Effect[] {
  const effects: Effect[] = []

  const blind = getInProgressBlind(game)
  if (blind && blind.type === 'bossBlind') {
    effects.push(...blind.effects)
  }

  effects.push(...game.gamePlayState.jokers.flatMap(j => j.effects || []))

  return effects
}

function shuffleDeck(array: PlayingCard[], rng: () => number): PlayingCard[] {
  const shuffled = [...array]
  for (let i = shuffled.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1))
    ;[shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]]
  }
  return shuffled
}

export function randomizeDeck({
  deck,
  seed,
  iteration,
}: {
  deck: PlayingCard[]
  seed: string
  iteration: number
}): PlayingCard[] {
  const seedFn = xmur3(seed + iteration.toString())
  const rng = mulberry32(seedFn())

  return shuffleDeck(deck, rng)
}
