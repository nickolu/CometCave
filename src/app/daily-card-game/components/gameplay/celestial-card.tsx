import { GameCard } from '@/app/daily-card-game/components/ui/game-card'
import { celestialCards } from '@/app/daily-card-game/domain/consumable/celestial-cards'
import { CelestialCardState } from '@/app/daily-card-game/domain/consumable/types'

export const CelestialCard = ({
  celestialCard,
  isSelected,
  onClick,
}: {
  celestialCard: CelestialCardState
  isSelected?: boolean
  onClick?: (isSelected: boolean, id: string) => void
}) => {
  return (
    <GameCard
      onClick={() => {
        onClick?.(isSelected ?? false, celestialCard.id)
      }}
    >
      <div className={'px-1 h-full '}>
        <div>
          <h3 className="text-sm font-bold">{celestialCards[celestialCard.handId].name}</h3>
          <p className="text-xs text-muted-foreground">
            {celestialCards[celestialCard.handId].description}
          </p>
        </div>
      </div>
    </GameCard>
  )
}
