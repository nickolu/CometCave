import type { Effect } from '@/app/daily-card-game/domain/events/types'
import { jokers } from '@/app/daily-card-game/domain/joker/jokers'
import type { PlayingCardState } from '@/app/daily-card-game/domain/playing-card/types'
import { mulberry32, xmur3 } from '@/app/daily-card-game/domain/randomness'
import { bigBlind, getInProgressBlind, smallBlind } from '@/app/daily-card-game/domain/round/blinds'
import { bossBlinds } from '@/app/daily-card-game/domain/round/boss-blinds'
import type {
  BlindDefinition,
  BlindState,
  RoundState,
} from '@/app/daily-card-game/domain/round/types'

import type { GameState } from './types'

export function getBlindDefinition(type: BlindState['type'], round: RoundState): BlindDefinition {
  if (type === 'smallBlind') return smallBlind
  if (type === 'bigBlind') return bigBlind
  if (type === 'bossBlind') {
    const bossBlind = bossBlinds.find(blind => blind.name === round.bossBlindName)
    if (!bossBlind) throw new Error(`Boss blind not found: ${round.bossBlindName}`)
    return bossBlind
  }

  throw new Error(`Unknown blind type: ${type}`)
}

export function collectEffects(game: GameState): Effect[] {
  const effects: Effect[] = []

  const blind = getInProgressBlind(game)
  if (blind && blind.type === 'bossBlind') {
    effects.push(...getBlindDefinition(blind.type, game.rounds[game.roundIndex]).effects)
  }

  effects.push(...game.jokers.flatMap(j => jokers[j.jokerId]?.effects || []))

  return effects
}

function shuffleDeck(array: PlayingCardState[], rng: () => number): PlayingCardState[] {
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
  deck: PlayingCardState[]
  seed: string
  iteration: number
}): PlayingCardState[] {
  const seedFn = xmur3(seed + iteration.toString())
  const rng = mulberry32(seedFn())

  return shuffleDeck(deck, rng)
}
