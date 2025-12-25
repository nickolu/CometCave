import { cn } from '@/lib/utils'
import { Card } from '@/components/ui/card'
import { CelestialCardState, TarotCardState } from '@/app/daily-card-game/domain/consumable/types'
import { eventEmitter } from '@/app/daily-card-game/domain/events/event-emitter'
import { tarotCards } from '@/app/daily-card-game/domain/consumable/tarot-cards'
import { celestialCards } from '../../domain/consumable/celestial-cards'

export const CelestialCard = ({
  celestialCard,
  isSelected,
}: {
  celestialCard: CelestialCardState
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
          eventEmitter.emit({ type: 'CONSUMABLE_DESELECTED', id: celestialCard.id })
        } else {
          eventEmitter.emit({ type: 'CONSUMABLE_SELECTED', id: celestialCard.id })
        }
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
    </Card>
  )
}
