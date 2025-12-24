import { eventEmitter } from '@/app/daily-card-game/domain/events/event-emitter'
import { isCustomScoringEvent } from '@/app/daily-card-game/domain/game/types'
import { getBlindDefinition } from '@/app/daily-card-game/domain/game/utils'
import { getInProgressBlind } from '@/app/daily-card-game/domain/round/blinds'
import { useGameState } from '@/app/daily-card-game/useGameState'
import { Button } from '@/components/ui/button'

export function ViewTemplate({ children }: { children: React.ReactNode }) {
  const { game } = useGameState()
  const currentBlind = getInProgressBlind(game)
  return (
    <div>
      <div className="flex">
        {/* Sidebar */}
        <div id="game-sidebar" className="w-1/4 p-4 flex flex-col gap-4">
          <Button
            onClick={() => {
              eventEmitter.emit({ type: 'BLIND_SELECTION_BACK_TO_MENU' })
            }}
          >
            Back to Main Menu
          </Button>
          <hr />
          <div className="flex flex-col gap-2 pl-2">
            <div>
              <strong>Total Score:</strong> {game.totalScore}
            </div>
            <div>
              <strong>Round:</strong> {game.roundIndex}/{game.rounds.length}
            </div>
            <div>
              <strong>Current Money:</strong> {game.money}
            </div>
            <div>
              <strong>Hands Played:</strong> {game.handsPlayed}
            </div>
          </div>
          {currentBlind && (
            <>
              <hr />
              <div className="pl-2 flex flex-col gap-2">
                <div>
                  <strong>Current Blind:</strong>{' '}
                  {
                    getBlindDefinition(
                      currentBlind?.type ?? 'smallBlind',
                      game.rounds[game.roundIndex]
                    ).name
                  }
                </div>
                <div>
                  <strong>Score at Least:</strong>{' '}
                  {game.rounds[game.roundIndex].baseAnte *
                    (getBlindDefinition(
                      currentBlind?.type ?? 'smallBlind',
                      game.rounds[game.roundIndex]
                    ).anteMultiplier || 1)}
                </div>
                <div>
                  <strong>Remaining Hands:</strong> {game.gamePlayState.remainingHands}
                </div>
                <div>
                  <strong>Remaining Discards:</strong> {game.gamePlayState.remainingDiscards}
                </div>
              </div>
            </>
          )}
          <hr />
          <div className="pl-2 flex flex-col gap-2">
            {game.gamePlayState.scoringEvents.length > 0 && (
              <>
                <h2 className="text-lg font-bold">Scoring Events Log</h2>
                <div className="flex flex-col gap-0.5 pl-1 max-h-[300px] overflow-y-auto">
                  {game.gamePlayState.scoringEvents.map(event =>
                    isCustomScoringEvent(event) ? (
                      <div key={event.id}>{event.message}</div>
                    ) : (
                      <div key={event.id}>
                        {event.source}: {event.type} {event.operator ?? '+'} {event.value}
                      </div>
                    )
                  )}
                </div>
              </>
            )}
          </div>
        </div>

        {/* Main Content */}
        <div id="game-content" className="w-3/4 p-4">
          {children}
        </div>
      </div>
    </div>
  )
}
