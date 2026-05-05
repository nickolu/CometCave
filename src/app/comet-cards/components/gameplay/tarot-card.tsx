import { TokenCard } from '@/app/comet-cards/components/cosmic/token-card'
import { implementedTarotCards as tarotCards } from '@/app/comet-cards/domain/consumable/tarot-cards'
import type { TarotCardState } from '@/app/comet-cards/domain/consumable/types'

export const TarotCard = ({
  tarotCard,
  isSelected,
  onClick,
}: {
  tarotCard: TarotCardState
  isSelected?: boolean
  onClick?: (isSelected: boolean, id: string) => void
}) => {
  const def = tarotCards[tarotCard.tarotType]
  return (
    <TokenCard
      title={def?.name ?? 'Tarot'}
      description={def?.description}
      glyph="◈"
      accent="var(--cc-pink)"
      selected={isSelected}
      size="sm"
      onClick={onClick ? () => onClick(isSelected ?? false, tarotCard.id) : undefined}
    />
  )
}
