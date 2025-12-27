import { useState } from 'react'

import { Hands } from '@/app/daily-card-game/components/hands/hands'
import { Modal } from '@/app/daily-card-game/components/ui/modal'
import { Vouchers } from '@/app/daily-card-game/components/voucher/vouchers'
import { isCustomScoringEvent } from '@/app/daily-card-game/domain/game/types'
import { getBlindDefinition } from '@/app/daily-card-game/domain/game/utils'
import { getInProgressBlind } from '@/app/daily-card-game/domain/round/blinds'
import { useGameState } from '@/app/daily-card-game/useGameState'
import { Button } from '@/components/ui/button'

export function ViewTemplate({
  sidebarContentTop,
  sidebarContentBottom,
  children,
}: {
  sidebarContentTop?: React.ReactNode
  sidebarContentBottom?: React.ReactNode
  children: React.ReactNode
}) {
  const { game } = useGameState()
  const currentBlind = getInProgressBlind(game)
  const [showHands, setShowHands] = useState(false)
  const [showVouchers, setShowVouchers] = useState(false)
  return (
    <div>
      <div className="flex">
        {/* Sidebar */}
        <div id="game-sidebar" className="w-1/4 min-w-[300px] p-4 flex flex-col gap-4">
          {sidebarContentTop}

          <hr />
          <div className="flex flex-col gap-2 pl-2">
            <div>
              <strong>Total Score:</strong> {game.totalScore}
            </div>
            <div>
              <strong>Round:</strong> {game.roundIndex}/{game.rounds.length}
            </div>
            <div>
              <strong>Current Money:</strong> ${game.money}
            </div>
            <div>
              <strong>Hands Played:</strong> {game.handsPlayed}
            </div>
            <div className="flex gap-2">
              <Button onClick={() => setShowHands(!showHands)}>Show Hands</Button>
              {game.vouchers.length > 0 && (
                <Button onClick={() => setShowVouchers(!showVouchers)}>Show Vouchers</Button>
              )}
            </div>
            {showHands && (
              <Modal onClose={() => setShowHands(false)}>
                <Hands pokerHandsState={game.pokerHands} />
              </Modal>
            )}
            {showVouchers && (
              <Modal onClose={() => setShowVouchers(false)}>
                <Vouchers vouchers={game.vouchers.map(voucher => voucher.type)} />
              </Modal>
            )}
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
          {sidebarContentBottom}
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
