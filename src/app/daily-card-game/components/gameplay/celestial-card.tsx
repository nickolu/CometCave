import { celestialCards } from '@/app/daily-card-game/domain/consumable/celestial-cards'
import { CelestialCardState } from '@/app/daily-card-game/domain/consumable/types'
import { Card } from '@/components/ui/card'
import { cn } from '@/lib/utils'

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
    <Card
      className={cn(
        isSelected ? 'ring-2 ring-space-purple transform -translate-y-2' : '',
        'h-36 w-24 transform transition-all duration-300 cursor-pointer'
      )}
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
    </Card>
  )
}
