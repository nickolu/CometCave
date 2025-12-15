import { CardValue, PlayingCard } from '@/app/daily-card-game/domain/playing-card/types'

export const cardValuePriority: Record<CardValue, number> = {
  2: 1,
  3: 2,
  4: 3,
  5: 4,
  6: 5,
  7: 6,
  8: 7,
  9: 8,
  10: 9,
  J: 10,
  Q: 11,
  K: 12,
  A: 13,
}

export const suitPriority: Record<PlayingCard['suit'], number> = {
  hearts: 1,
  diamonds: 2,
  clubs: 3,
  spades: 4,
}
