import { TokenCard } from '@/app/comet-cards/components/cosmic/token-card'
import { implementedSpectralCards as spectralCards } from '@/app/comet-cards/domain/spectral/spectal-cards'
import type { SpectralCardState } from '@/app/comet-cards/domain/spectral/types'

export const SpectralCard = ({
  spectralCard,
  isSelected,
  onClick,
}: {
  spectralCard: SpectralCardState
  isSelected?: boolean
  onClick?: (isSelected: boolean, id: string) => void
}) => {
  const def = spectralCards[spectralCard.spectralType]
  if (!def) {
    return (
      <TokenCard
        title="Not Implemented"
        description="This card has not yet been implemented."
        glyph="✦"
        accent="var(--cc-mint)"
        size="sm"
        disabled
      />
    )
  }
  return (
    <TokenCard
      title={def.name}
      description={def.description}
      glyph="✦"
      accent="var(--cc-rarity-uncommon)"
      selected={isSelected}
      size="sm"
      onClick={onClick ? () => onClick(isSelected ?? false, spectralCard.id) : undefined}
    />
  )
}
