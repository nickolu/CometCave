import { dispatchEffects } from '@/app/daily-card-game/domain/events/dispatch-effects'
import type { EffectContext, GameEvent } from '@/app/daily-card-game/domain/events/types'
import type { GameState } from '@/app/daily-card-game/domain/game/types'
import { collectEffects, populateTags } from '@/app/daily-card-game/domain/game/utils'
import { getRandomVoucherType } from '@/app/daily-card-game/domain/voucher/utils'

export function handleGameStart(draft: GameState, event: GameEvent) {
  draft.gamePhase = 'blindSelection'
  draft.shopState.voucher = getRandomVoucherType(draft)
  populateTags(draft)
  const ctx: EffectContext = {
    event,
    game: draft,
    score: draft.gamePlayState.score,
    playedCards: [],
    round: draft.rounds[draft.roundIndex],
    bossBlind: draft.rounds[draft.roundIndex].bossBlind,
    jokers: draft.jokers,
    vouchers: draft.vouchers,
    tags: draft.tags,
  }
  dispatchEffects(event, ctx, collectEffects(ctx.game))
}
