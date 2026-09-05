import type { Effect } from '@/app/comet-cards/domain/events/types'
import type { GameState } from '@/app/comet-cards/domain/game/types'

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
  /**
   * Spectral cards sit in the consumable slots alongside Tarots and Celestials,
   * so they carry the same discriminant. Ghost Deck's starting Hex, Seance and
   * Sixth Sense all hand the player one to hold.
   */
  consumableType: 'spectralCard'
  spectralType: SpectralCardType
}
