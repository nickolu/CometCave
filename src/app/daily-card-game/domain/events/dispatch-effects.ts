import type { Effect, EffectContext, GameEvent } from '@/app/daily-card-game/domain/events/types'

export function dispatchEffects(event: GameEvent, ctx: EffectContext, effects: Effect[]) {
  const matching = effects
    .filter(e => e.event.type === event.type)
    .sort((a, b) => a.priority - b.priority)

  for (const effect of matching) {
    if (effect.condition && !effect.condition(ctx)) continue
    effect.apply(ctx)
  }
}
