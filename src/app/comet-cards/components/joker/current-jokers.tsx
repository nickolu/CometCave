import { DangerButton } from '@/app/comet-cards/components/cosmic/buttons'
import { Joker } from '@/app/comet-cards/components/gameplay/joker'
import { eventEmitter } from '@/app/comet-cards/domain/events/event-emitter'
import { jokers } from '@/app/comet-cards/domain/joker/jokers'
import { getCopyJokerDescription } from '@/app/comet-cards/domain/joker/copy-joker-description'
import { useGridKeyboardNav } from '@/app/comet-cards/hooks/useGridKeyboardNav'
import { useGameState } from '@/app/comet-cards/useGameState'
import { getJokerSellValue } from '@/app/comet-cards/domain/shop/sell-utils'

export const CurrentJokers = () => {
  const { game } = useGameState()
  const selectedJoker = game.jokers.find(joker => joker.id === game.gamePlayState.selectedJokerId)
  const selectedJokerDefinition = selectedJoker ? jokers[selectedJoker.jokerId] : undefined

  const {
    containerRef: jokerContainerRef,
    handleKeyDown: jokerHandleKeyDown,
    focusedIndexRef: jokerFocusedIndexRef,
  } = useGridKeyboardNav()

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
        <div
          ref={jokerContainerRef}
          role="toolbar"
          aria-label="Jokers"
          onKeyDown={jokerHandleKeyDown}
          className="flex flex-wrap gap-3"
        >
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
            game.jokers.map((joker, i) => (
              <Joker
                key={joker.id}
                joker={joker}
                description={getCopyJokerDescription(joker.jokerId, i, game.jokers)}
                isSelected={game.gamePlayState.selectedJokerId === joker.id}
                isSwapTarget={!!game.gamePlayState.selectedJokerId && game.gamePlayState.selectedJokerId !== joker.id}
                ownedCardCount={game.ownedCardIds.length}
                gameSeed={game.gameSeed}
                roundIndex={game.roundIndex}
                tabIndex={i === jokerFocusedIndexRef.current ? 0 : -1}
                onClick={(isSelected, id) => {
                  if (isSelected) {
                    eventEmitter.emit({ type: 'JOKER_DESELECTED', id })
                  } else if (game.gamePlayState.selectedJokerId) {
                    eventEmitter.emit({ type: 'JOKER_SWAP', fromId: game.gamePlayState.selectedJokerId, toId: id })
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
              Sell · ${getJokerSellValue(selectedJokerDefinition, selectedJoker!)}
            </DangerButton>
          </div>
        )}
      </div>
    </div>
  )
}
