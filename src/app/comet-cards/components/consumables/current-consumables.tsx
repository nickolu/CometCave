import {
  DangerButton,
  PrimaryButton,
} from '@/app/comet-cards/components/cosmic/buttons'
import { CelestialCard } from '@/app/comet-cards/components/gameplay/celestial-card'
import { SpectralCard } from '@/app/comet-cards/components/gameplay/spectral-card'
import { TarotCard } from '@/app/comet-cards/components/gameplay/tarot-card'
import { getConsumableDefinition } from '@/app/comet-cards/domain/consumable/utils'
import { eventEmitter } from '@/app/comet-cards/domain/events/event-emitter'
import { isSpectralCardState } from '@/app/comet-cards/domain/spectral/utils'
import { useGameState } from '@/app/comet-cards/useGameState'

import {
  getConsumableUseEvent,
  getHeldConsumableSellValue,
  isConsumablePlayable,
} from './consumable-actions'

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
          isSpectralCardState(consumable) ? (
            <SpectralCard
              key={consumable.id}
              spectralCard={consumable}
              isSelected={selectedConsumable?.id === consumable.id}
              onClick={(isSelected, id) => {
                if (isSelected) {
                  eventEmitter.emit({ type: 'CONSUMABLE_DESELECTED', id })
                } else {
                  eventEmitter.emit({ type: 'CONSUMABLE_SELECTED', id })
                }
              }}
            />
          ) : consumable.consumableType === 'tarotCard' ? (
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
            disabled={!isConsumablePlayable(selectedConsumableDefinition, game)}
            onClick={() => {
              const useEvent = getConsumableUseEvent(selectedConsumable)
              if (useEvent) eventEmitter.emit(useEvent)
            }}
          >
            Use
          </PrimaryButton>
          <DangerButton onClick={() => eventEmitter.emit({ type: 'CONSUMABLE_SOLD' })}>
            Sell · ${getHeldConsumableSellValue(selectedConsumable)}
          </DangerButton>
        </div>
      )}
    </div>
  )
}
