import { GameCard } from '@/app/daily-card-game/components/ui/game-card'
import { implementedSpectralCards as spectralCards } from '@/app/daily-card-game/domain/spectral/spectal-cards'
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
  const spectralCardDefinition = spectralCards[spectralCard.spectralType]
  if (!spectralCardDefinition) {
    return (
      <GameCard>
        <div className={'px-1 h-full '}>
          <div>
            <h3 className="text-sm font-bold">Not Implemented</h3>
            <p className="text-xs text-muted-foreground">This card has not yet been implemented.</p>
          </div>
        </div>
      </GameCard>
    )
  }
  return (
    <GameCard
      onClick={() => {
        onClick?.(isSelected ?? false, spectralCard.id)
      }}
    >
      <div className={'px-1 h-full '}>
        <div>
          <h3 className="text-sm font-bold">{spectralCardDefinition.name}</h3>
          <p className="text-xs text-muted-foreground">{spectralCardDefinition.description}</p>
        </div>
      </div>
    </GameCard>
  )
}
