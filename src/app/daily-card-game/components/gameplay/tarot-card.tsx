import { tarotCards } from '@/app/daily-card-game/domain/consumable/tarot-cards'
import { TarotCardState } from '@/app/daily-card-game/domain/consumable/types'
import { Card } from '@/components/ui/card'
import { cn } from '@/lib/utils'

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
    <Card
      className={cn(
        isSelected ? 'ring-2 ring-space-purple transform -translate-y-2' : '',
        'h-36 w-24 transform transition-all duration-300 cursor-pointer'
      )}
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
    </Card>
  )
}
