import { BrandCard } from '@/app/daily-card-game/components/cosmic/brand-card'
import { PlayingCardState } from '@/app/daily-card-game/domain/playing-card/types'

export const PlayingCard = ({
  playingCard,
  isSelected,
  onClick,
}: {
  playingCard: PlayingCardState
  isSelected?: boolean
  onClick?: (isSelected: boolean, id: string) => void
}) => {
  return <BrandCard card={playingCard} selected={isSelected} onClick={onClick} size="md" />
}
