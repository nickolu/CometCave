import { dispatchEffects } from '@/app/comet-cards/domain/events/dispatch-effects'
import type { EffectContext, GameEvent } from '@/app/comet-cards/domain/events/types'
import type { GameState } from '@/app/comet-cards/domain/game/types'
import { collectEffects, populateTags } from '@/app/comet-cards/domain/game/utils'
import { getRandomVoucherType } from '@/app/comet-cards/domain/voucher/utils'

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
