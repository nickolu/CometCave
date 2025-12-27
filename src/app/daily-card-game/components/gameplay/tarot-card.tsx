import { GameCard } from '@/app/daily-card-game/components/ui/game-card'
import { tarotCards } from '@/app/daily-card-game/domain/consumable/tarot-cards'
import { TarotCardState } from '@/app/daily-card-game/domain/consumable/types'

export const TarotCard = ({
  tarotCard,
  isSelected,
  onClick,
}: {
  tarotCard: TarotCardState
  isSelected?: boolean
  onClick?: (isSelected: boolean, id: string) => void
}) => {
  return (
    <GameCard
      onClick={() => {
        onClick?.(isSelected ?? false, tarotCard.id)
      }}
    >
      <div className={'px-1 h-full '}>
        <div>
          <h3 className="text-sm font-bold">{tarotCards[tarotCard.tarotType].name}</h3>
          <p className="text-xs text-muted-foreground">
            {tarotCards[tarotCard.tarotType].description}
          </p>
        </div>
      </div>
    </GameCard>
  )
}
