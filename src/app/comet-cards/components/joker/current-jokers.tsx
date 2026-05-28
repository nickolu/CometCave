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
    <div
      style={{
        background: 'rgba(255, 255, 255, 0.04)',
        border: '1px solid rgba(255, 255, 255, 0.1)',
        borderRadius: 10,
        padding: '12px 14px',
      }}
    >
      <div className="flex flex-col gap-2">
        <div className="flex flex-wrap gap-3">
          {game.jokers.length === 0 ? (
            <div
              style={{
                fontFamily: 'var(--cc-font-mono)',
                fontSize: 11,
                opacity: 0.45,
                letterSpacing: 0.5,
              }}
            >
              Your joker slots are empty
            </div>
          ) : (
            game.jokers.map(joker => (
              <Joker
                key={joker.id}
                joker={joker}
                isSelected={game.gamePlayState.selectedJokerId === joker.id}
                ownedCardCount={game.ownedCardIds.length}
                gameSeed={game.gameSeed}
                roundIndex={game.roundIndex}
                onClick={(isSelected, id) => {
                  if (isSelected) {
                    eventEmitter.emit({ type: 'JOKER_DESELECTED', id })
                  } else {
                    eventEmitter.emit({ type: 'JOKER_SELECTED', id })
                  }
                }}
              />
            ))
          )}
        </div>
        {selectedJokerDefinition && (
          <div>
            <DangerButton onClick={() => eventEmitter.emit({ type: 'JOKER_SOLD' })}>
              Sell · ${selectedJokerDefinition.price}
            </DangerButton>
          </div>
        )}
      </div>
    </div>
  )
}
