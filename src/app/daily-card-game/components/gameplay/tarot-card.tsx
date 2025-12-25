import { tarotCards } from '@/app/daily-card-game/domain/consumable/tarot-cards'
import { TarotCardState } from '@/app/daily-card-game/domain/consumable/types'
import { eventEmitter } from '@/app/daily-card-game/domain/events/event-emitter'
import { Card } from '@/components/ui/card'
import { cn } from '@/lib/utils'

export const TarotCard = ({
  tarotCard,
  isSelected,
}: {
  tarotCard: TarotCardState
  isSelected?: boolean
}) => {
  return (
    <Card
      className={cn(
        isSelected ? 'ring-2 ring-space-purple -mt-2' : '',
        'h-36 w-24 transform transition-all duration-300 cursor-pointer'
      )}
      onClick={() => {
        if (isSelected) {
          eventEmitter.emit({ type: 'CONSUMABLE_DESELECTED', id: tarotCard.id })
        } else {
          eventEmitter.emit({ type: 'CONSUMABLE_SELECTED', id: tarotCard.id })
        }
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
