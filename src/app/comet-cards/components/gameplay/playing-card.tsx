import { BrandCard } from '@/app/comet-cards/components/cosmic/brand-card'
import { PlayingCardState } from '@/app/comet-cards/domain/playing-card/types'

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
