import { CelestialCard } from '@/app/daily-card-game/components/gameplay/celestial-card'
import { TarotCard } from '@/app/daily-card-game/components/gameplay/tarot-card'
import { getConsumableDefinition } from '@/app/daily-card-game/domain/consumable/utils'
import { eventEmitter } from '@/app/daily-card-game/domain/events/event-emitter'
import { useGameState } from '@/app/daily-card-game/useGameState'
import { Button } from '@/components/ui/button'

export const CurrentConsumables = () => {
  const { game } = useGameState()

  const selectedConsumable = game.gamePlayState.selectedConsumable
  const selectedConsumableDefinition = selectedConsumable
    ? getConsumableDefinition(selectedConsumable)
    : undefined

  return (
    <div>
      <div className="flex flex-wrap gap-2">
        {game.consumables.map(consumable =>
          consumable.consumableType === 'tarotCard' ? (
            <TarotCard
              key={consumable.id}
              tarotCard={consumable}
              isSelected={selectedConsumable?.id === consumable.id}
              onClick={(isSelected, id) => {
                if (isSelected) {
                  eventEmitter.emit({
                    type: 'CONSUMABLE_DESELECTED',
                    id,
                  })
                } else {
                  eventEmitter.emit({
                    type: 'CONSUMABLE_SELECTED',
                    id,
                  })
                }
              }}
            />
          ) : (
            <CelestialCard
              key={consumable.id}
              celestialCard={consumable}
              isSelected={selectedConsumable?.id === consumable.id}
              onClick={(isSelected, id) => {
                if (isSelected) {
                  eventEmitter.emit({
                    type: 'CONSUMABLE_DESELECTED',
                    id,
                  })
                } else {
                  eventEmitter.emit({
                    type: 'CONSUMABLE_SELECTED',
                    id,
                  })
                }
              }}
            />
          )
        )}
      </div>

      {selectedConsumable && (
        <div className="flex gap-2">
          <Button
            disabled={!selectedConsumableDefinition?.isPlayable(game)}
            onClick={() => {
              if (selectedConsumable.consumableType === 'tarotCard') {
                eventEmitter.emit({ type: 'TAROT_CARD_USED' })
              } else if (selectedConsumable.consumableType === 'celestialCard') {
                eventEmitter.emit({ type: 'CELESTIAL_CARD_USED' })
              }
            }}
          >
            Use
          </Button>
          <Button
            onClick={() => {
              eventEmitter.emit({ type: 'CONSUMABLE_SOLD' })
            }}
          >
            Sell (${selectedConsumableDefinition?.price})
          </Button>
        </div>
      )}
    </div>
  )
}
