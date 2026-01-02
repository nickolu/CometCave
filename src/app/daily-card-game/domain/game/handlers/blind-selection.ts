import { dispatchEffects } from '@/app/daily-card-game/domain/events/dispatch-effects'
import type { GameEvent } from '@/app/daily-card-game/domain/events/types'
import type { GameState } from '@/app/daily-card-game/domain/game/types'
import { collectEffects, shuffleCardIds } from '@/app/daily-card-game/domain/game/utils'
import { buildSeedString } from '@/app/daily-card-game/domain/randomness'
import { blindIndices, getNextBlind } from '@/app/daily-card-game/domain/round/blinds'
import { initializeTag } from '@/app/daily-card-game/domain/tag/utils'

export function handleSmallBlindSelected(draft: GameState) {
  const round = draft.rounds[draft.roundIndex]
  round.smallBlind.status = 'inProgress'
  draft.gamePhase = 'gameplay'
  const randomDrawPileIdsSeed = buildSeedString([
    draft.gameSeed,
    draft.roundIndex.toString(),
    draft.shopState.rerollsUsed.toString(),
    'smallBlind',
  ])
  draft.gamePlayState.drawPileIds = shuffleCardIds({
    cardIds: draft.ownedCardIds,
    seed: randomDrawPileIdsSeed,
    iteration: draft.roundIndex + blindIndices['smallBlind'],
  })
  draft.gamePlayState.handIds = []
  draft.gamePlayState.discardPileIds = []
}

export function handleBigBlindSelected(draft: GameState) {
  const round = draft.rounds[draft.roundIndex]
  round.bigBlind.status = 'inProgress'
  draft.gamePhase = 'gameplay'
  const randomDrawPileIdsSeed = buildSeedString([
    draft.gameSeed,
    draft.roundIndex.toString(),
    draft.shopState.rerollsUsed.toString(),
    'bigBlind',
  ])
  draft.gamePlayState.drawPileIds = shuffleCardIds({
    cardIds: draft.ownedCardIds,
    seed: randomDrawPileIdsSeed,
    iteration: draft.roundIndex + blindIndices['bigBlind'],
  })
  draft.gamePlayState.handIds = []
  draft.gamePlayState.discardPileIds = []
}

export function handleBossBlindSelected(draft: GameState) {
  const round = draft.rounds[draft.roundIndex]
  round.bossBlind.status = 'inProgress'
  draft.gamePhase = 'gameplay'
  const randomDrawPileIdsSeed = buildSeedString([
    draft.gameSeed,
    draft.roundIndex.toString(),
    draft.shopState.rerollsUsed.toString(),
    'bossBlind',
  ])
  draft.gamePlayState.drawPileIds = shuffleCardIds({
    cardIds: draft.ownedCardIds,
    seed: randomDrawPileIdsSeed,
    iteration: draft.roundIndex + blindIndices['bossBlind'],
  })
  draft.gamePlayState.handIds = []
  draft.gamePlayState.discardPileIds = []
}

export function handleBlindSkipped(draft: GameState, event: GameEvent) {
  const round = draft.rounds[draft.roundIndex]
  const blind = getNextBlind(draft)
  if (!blind) return

  if (blind.tag) {
    draft.tags.push(initializeTag(blind.tag))
  }
  round[blind.type].status = 'skipped'
  dispatchEffects(
    event,
    {
      event,
      game: draft,
      score: draft.gamePlayState.score,
      playedCards: [],
      round: draft.rounds[draft.roundIndex],
      bossBlind: draft.rounds[draft.roundIndex].bossBlind,
      jokers: draft.jokers,
      vouchers: draft.vouchers,
      tags: draft.tags,
    },
    collectEffects(draft)
  )
}
