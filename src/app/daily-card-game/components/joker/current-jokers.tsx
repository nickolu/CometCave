import { Joker } from '@/app/daily-card-game/components/gameplay/joker'
import { eventEmitter } from '@/app/daily-card-game/domain/events/event-emitter'
import { jokers } from '@/app/daily-card-game/domain/joker/jokers'
import { useGameState } from '@/app/daily-card-game/useGameState'
import { Button } from '@/components/ui/button'

export const CurrentJokers = () => {
  const { game } = useGameState()
  const selectedJoker = game.jokers.find(joker => joker.id === game.gamePlayState.selectedJokerId)
  const selectedJokerDefinition = selectedJoker ? jokers[selectedJoker.jokerId] : undefined

  return (
    <div className="flex flex-wrap gap-2">
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
      {selectedJokerDefinition && (
        <Button
          onClick={() => {
            eventEmitter.emit({ type: 'JOKER_SOLD' })
          }}
        >
          Sell (${selectedJokerDefinition?.price})
        </Button>
      )}
    </div>
  )
}
