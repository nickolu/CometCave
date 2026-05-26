import {
  DangerButton,
  PrimaryButton,
} from '@/app/comet-cards/components/cosmic/buttons'
import { CelestialCard } from '@/app/comet-cards/components/gameplay/celestial-card'
import { TarotCard } from '@/app/comet-cards/components/gameplay/tarot-card'
import { getConsumableDefinition } from '@/app/comet-cards/domain/consumable/utils'
import { eventEmitter } from '@/app/comet-cards/domain/events/event-emitter'
import { getConsumableSellValue } from '@/app/comet-cards/domain/shop/sell-utils'
import { useGameState } from '@/app/comet-cards/useGameState'

export const CurrentConsumables = () => {
  const { game } = useGameState()

  const selectedConsumable = game.gamePlayState.selectedConsumable
  const selectedConsumableDefinition = selectedConsumable
    ? getConsumableDefinition(selectedConsumable)
    : undefined

  return (
    <div className="flex flex-col gap-2">
      <div className="flex flex-wrap gap-3">
        {game.consumables.map(consumable =>
          consumable.consumableType === 'tarotCard' ? (
            <TarotCard
              key={consumable.id}
              tarotCard={consumable}
              isSelected={selectedConsumable?.id === consumable.id}
              onClick={(isSelected, id) => {
                if (isSelected) {
                  eventEmitter.emit({ type: 'CONSUMABLE_DESELECTED', id })
                } else {
                  eventEmitter.emit({ type: 'CONSUMABLE_SELECTED', id })
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
                  eventEmitter.emit({ type: 'CONSUMABLE_DESELECTED', id })
                } else {
                  eventEmitter.emit({ type: 'CONSUMABLE_SELECTED', id })
                }
              }}
            />
          )
        )}
      </div>

      {selectedConsumable && (
        <div className="flex flex-wrap gap-2">
          <PrimaryButton
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
          </PrimaryButton>
          <DangerButton onClick={() => eventEmitter.emit({ type: 'CONSUMABLE_SOLD' })}>
            Sell · ${selectedConsumableDefinition ? getConsumableSellValue(selectedConsumableDefinition) : 0}
          </DangerButton>
        </div>
      )}
    </div>
  )
}
