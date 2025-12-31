import type { Effect } from '@/app/daily-card-game/domain/events/types'
import type { GameState } from '@/app/daily-card-game/domain/game/types'

export type SpectralCardType =
  | 'familiar'
  | 'grim'
  | 'incantation'
  | 'talisman'
  | 'aura'
  | 'wraith'
  | 'sigil'
  | 'ouija'
  | 'ectoplasm'
  | 'immolate'
  | 'ankh'
  | 'dejaVu'
  | 'hex'
  | 'trance'
  | 'medium'
  | 'cryptid'
  | 'theSoul'
  | 'blackHole'

export interface SpectralCardDefinition {
  spectralType: SpectralCardType
  name: string
  description: string
  isPlayable?: (game: GameState) => boolean
  effects: Effect[]
}

export interface SpectralCardState {
  id: string
  spectralType: SpectralCardType
}
