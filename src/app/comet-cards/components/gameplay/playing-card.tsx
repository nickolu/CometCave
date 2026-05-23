import { BrandCard } from '@/app/comet-cards/components/cosmic/brand-card'
import { PlayingCardState } from '@/app/comet-cards/domain/playing-card/types'

export const PlayingCard = ({
  playingCard,
  isSelected,
  onClick,
  debuffed,
  size = 'md',
}: {
  playingCard: PlayingCardState
  isSelected?: boolean
  onClick?: (isSelected: boolean, id: string) => void
  debuffed?: boolean
  size?: 'xs' | 'sm' | 'md' | 'lg'
}) => {
  return <BrandCard card={playingCard} selected={isSelected} onClick={onClick} size={size} debuffed={debuffed} />
}
