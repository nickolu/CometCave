import type { Effect, EffectContext, GameEvent } from '@/app/comet-cards/domain/events/types'

export function dispatchEffects(event: GameEvent, ctx: EffectContext, effects: Effect[]) {
  const matching = effects
    .filter(e => {
      if (e.event.type !== event.type) return false
      if ('id' in e.event && 'id' in event) return e.event.id === event.id
      return true
    })
    .sort((a, b) => a.priority - b.priority)

  for (const effect of matching) {
    if (effect.condition && !effect.condition(ctx)) continue
    effect.apply(ctx)
  }
}
