import { GameCard } from '@/app/daily-card-game/components/ui/game-card'
import { spectralCards } from '@/app/daily-card-game/domain/spectral/spectal-cards'
import { SpectralCardState } from '@/app/daily-card-game/domain/spectral/types'

export const SpectralCard = ({
  spectralCard,
  isSelected,
  onClick,
}: {
  spectralCard: SpectralCardState
  isSelected?: boolean
  onClick?: (isSelected: boolean, id: string) => void
}) => {
  return (
    <GameCard
      onClick={() => {
        onClick?.(isSelected ?? false, spectralCard.id)
      }}
    >
      <div className={'px-1 h-full '}>
        <div>
          <h3 className="text-sm font-bold">{spectralCards[spectralCard.spectralType].name}</h3>
          <p className="text-xs text-muted-foreground">
            {spectralCards[spectralCard.spectralType].description}
          </p>
        </div>
      </div>
    </GameCard>
  )
}

