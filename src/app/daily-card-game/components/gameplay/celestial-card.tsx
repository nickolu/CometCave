import { TokenCard } from '@/app/daily-card-game/components/cosmic/token-card'
import { celestialCards } from '@/app/daily-card-game/domain/consumable/celestial-cards'
import type { CelestialCardState } from '@/app/daily-card-game/domain/consumable/types'

export const CelestialCard = ({
  celestialCard,
  isSelected,
  onClick,
}: {
  celestialCard: CelestialCardState
  isSelected?: boolean
  onClick?: (isSelected: boolean, id: string) => void
}) => {
  const def = celestialCards[celestialCard.handId]
  return (
    <TokenCard
      title={def?.name ?? 'Celestial'}
      description={def?.description}
      glyph="✷"
      accent="var(--cc-gold)"
      selected={isSelected}
      size="sm"
      onClick={onClick ? () => onClick(isSelected ?? false, celestialCard.id) : undefined}
    />
  )
}
