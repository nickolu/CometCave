import { Effect } from '@/app/daily-card-game/domain/events/types'

export interface JokerDefinition {
  effects: Effect[]
  flags: JokerFlags
}

export interface JokerFlags {
  isRentable: boolean
  isPerishable: boolean
  isEternal: boolean
  isHolographic: boolean
  isFoil: boolean
  isNegative: boolean
}
