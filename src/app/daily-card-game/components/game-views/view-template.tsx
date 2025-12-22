import { getInProgressBlind } from '@/app/daily-card-game/domain/round/blinds'
import { useGameState } from '@/app/daily-card-game/useGameState'

export function ViewTemplate({ children }: { children: React.ReactNode }) {
  const { game } = useGameState()
  const currentBlind = getInProgressBlind(game)
  return (
    <div>
      <div className="flex">
        <div id="game-sidebar" className="w-1/4 p-4">
          <div>Total Score: {game.totalScore}</div>
          <div>
            Round {game.roundIndex + 1}/{game.rounds.length}
          </div>
          <div>Current Money: {game.money}</div>
          <div>Hands Played: {game.handsPlayed}</div>
          <div>Remaining Hands: {game.gamePlayState.remainingHands}</div>
          <div>Remaining Discards: {game.gamePlayState.remainingDiscards}</div>
          {currentBlind && (
            <div>
              <div>Current Blind: {currentBlind?.name}</div>
              <div>
                Score at Least:{' '}
                {game.rounds[game.roundIndex].baseAnte *
                  (getInProgressBlind(game)?.anteMultiplier || 1)}
              </div>
            </div>
          )}
          <hr />
          <div>
            {game.gamePlayState.scoringEvents.length > 0 && (
              <>
                <h2>Scoring Events Log</h2>
                {game.gamePlayState.scoringEvents.map(event => (
                  <div key={event.id}>
                    {event.source}: {event.type} + {event.value}
                  </div>
                ))}
              </>
            )}
          </div>
        </div>
        <div id="game-content" className="w-3/4 p-4">
          {children}
        </div>
      </div>
    </div>
  )
}
