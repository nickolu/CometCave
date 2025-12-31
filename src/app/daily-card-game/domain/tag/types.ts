import type { Effect } from '@/app/daily-card-game/domain/events/types'

export type TagType =
  | 'uncommon'
  | 'rare'
  | 'negative'
  | 'foil'
  | 'holographic'
  | 'polychrome'
  | 'investment'
  | 'voucher'
  | 'boss'
  | 'standard'
  | 'charm'
  | 'meteor'
  | 'buffoon'
  | 'handy'
  | 'garbage'
  | 'ethereal'
  | 'coupon'
  | 'double'
  | 'juggle'
  | 'd6'
  | 'topUp'
  | 'speed'
  | 'orbital'
  | 'economy'

export interface TagDefinition {
  tagType: TagType
  name: string
  benefit: string
  minimumAnte: number
  effects: Effect[]
}

export interface TagState {
  id: string
  tagType: TagType
}
