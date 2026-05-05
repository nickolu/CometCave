import { DangerButton } from '@/app/comet-cards/components/cosmic/buttons'
import { Joker } from '@/app/comet-cards/components/gameplay/joker'
import { eventEmitter } from '@/app/comet-cards/domain/events/event-emitter'
import { jokers } from '@/app/comet-cards/domain/joker/jokers'
import { useGameState } from '@/app/comet-cards/useGameState'

export const CurrentJokers = () => {
  const { game } = useGameState()
  const selectedJoker = game.jokers.find(joker => joker.id === game.gamePlayState.selectedJokerId)
  const selectedJokerDefinition = selectedJoker ? jokers[selectedJoker.jokerId] : undefined

  return (
    <div className="flex flex-col gap-2">
      <div className="flex flex-wrap gap-3">
        {game.jokers.map(joker => (
          <Joker
            key={joker.id}
            joker={joker}
            isSelected={game.gamePlayState.selectedJokerId === joker.id}
            onClick={(isSelected, id) => {
              if (isSelected) {
                eventEmitter.emit({ type: 'JOKER_DESELECTED', id })
              } else {
                eventEmitter.emit({ type: 'JOKER_SELECTED', id })
              }
            }}
          />
        ))}
      </div>
      {selectedJokerDefinition && (
        <div>
          <DangerButton onClick={() => eventEmitter.emit({ type: 'JOKER_SOLD' })}>
            Sell · ${selectedJokerDefinition.price}
          </DangerButton>
        </div>
      )}
    </div>
  )
}
