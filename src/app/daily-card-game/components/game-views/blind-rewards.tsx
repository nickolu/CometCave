'use client'

import { useEffect, useState } from 'react'

import { ViewTemplate } from '@/app/daily-card-game/components/game-views/view-template'
import { DollarSigns } from '@/app/daily-card-game/components/global/dollar-signs'
import { eventEmitter } from '@/app/daily-card-game/domain/events/event-emitter'
import { getBlindDefinition } from '@/app/daily-card-game/domain/game/utils'
import { getInProgressBlind } from '@/app/daily-card-game/domain/round/blinds'
import { useGameState } from '@/app/daily-card-game/useGameState'
import { Button } from '@/components/ui/button'

export function BlindRewardsView() {
  const { game } = useGameState()
  const [hasCashedOut, setHasCashedOut] = useState(false)
  useEffect(() => {
    eventEmitter.emit({ type: 'BLIND_REWARDS_START' })
  }, [])

  const currentBlind = getInProgressBlind(game)
  const baseReward =
    getBlindDefinition(currentBlind?.type ?? 'smallBlind', game.rounds[game.roundIndex])
      .baseReward ?? 0
  const additionalRewards = currentBlind?.additionalRewards ?? []

  return (
    <ViewTemplate>
      <div>
        <h2>Blind Rewards</h2>
        <div>
          Your Score: {currentBlind?.score.toString()}
          <div>
            <p>
              Blind: <DollarSigns count={baseReward || 0} />
            </p>
            {additionalRewards?.map(([rewardName, rewardAmount]) => (
              <p key={rewardName}>
                {rewardName}: <DollarSigns count={rewardAmount} />
              </p>
            ))}
          </div>
        </div>
      </div>
      <Button
        disabled={hasCashedOut}
        onClick={() => {
          setHasCashedOut(true)
          eventEmitter.emit({ type: 'BLIND_REWARDS_END' })
        }}
      >
        Cash Out
      </Button>
    </ViewTemplate>
  )
}
