import { TokenCard } from '@/app/comet-cards/components/cosmic/token-card'
import { celestialCards } from '@/app/comet-cards/domain/consumable/celestial-cards'
import type { CelestialCardState } from '@/app/comet-cards/domain/consumable/types'

export const CelestialCard = ({
  celestialCard,
  isSelected,
  onClick,
  tabIndex,
}: {
  celestialCard: CelestialCardState
  isSelected?: boolean
  onClick?: (isSelected: boolean, id: string) => void
  tabIndex?: number
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
      typeLabel="Celestial"
      edition={celestialCard.edition}
      onClick={onClick ? () => onClick(isSelected ?? false, celestialCard.id) : undefined}
      tabIndex={tabIndex}
    />
  )
}
