import { Effect } from '@/app/daily-card-game/domain/events/types'
import { GameState } from '@/app/daily-card-game/domain/game/types'
import type { PokerHandDefinition } from '@/app/daily-card-game/domain/hand/types'

export type Consumable = CelestialCardDefinition | TarotCardDefinition

export interface ConsumableDefinition {
  type: 'celestialCard' | 'tarotCard' | 'spectralCard'
  name: string
  description: string
  isPlayable: (game: GameState) => boolean
  effects: Effect[]
}
export interface CelestialCardDefinition extends ConsumableDefinition {
  type: 'celestialCard'
  handId: PokerHandDefinition['id']
}
export interface TarotCardDefinition extends ConsumableDefinition {
  type: 'tarotCard'
  tarotType:
    | 'theFool'
    | 'theMagician'
    | 'theHighPriestess'
    | 'theEmpress'
    | 'theEmperor'
    | 'theHierophant'
    | 'theLovers'
    | 'theChariot'
    | 'strength'
    | 'theHermit'
    | 'wheelOfFortune'
    | 'justice'
    | 'theHangedMan'
    | 'death'
    | 'temperance'
    | 'theDevil'
    | 'theTower'
    | 'theStar'
    | 'theMoon'
    | 'theSun'
    | 'judgement'
    | 'theWorld'
    | 'notImplemented'
  description: string
  effects: Effect[]
}

export interface SpectralCardDefinition extends ConsumableDefinition {
  type: 'spectralCard'
}

export interface ConsumableState {
  id: string
  consumableType: ConsumableDefinition['type']
}

export interface CelestialCardState extends ConsumableState {
  consumableType: 'celestialCard'
  handId: PokerHandDefinition['id']
}

export interface TarotCardState extends ConsumableState {
  consumableType: 'tarotCard'
  tarotType: TarotCardDefinition['tarotType']
}
