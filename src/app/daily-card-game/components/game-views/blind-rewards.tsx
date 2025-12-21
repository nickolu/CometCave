'use client'

import { useEffect, useState } from 'react'

import { eventEmitter } from '@/app/daily-card-game/domain/events/event-emitter'
import { getInProgressBlind } from '@/app/daily-card-game/domain/round/blinds'
import { useGameState } from '@/app/daily-card-game/useGameState'
import { Button } from '@/components/ui/button'

import { ViewTemplate } from './view-template'

const DollarSigns = ({ count }: { count: number }) => {
  return Array.from({ length: count }, (_, index) => <span key={index}>$</span>)
}

export function BlindRewardsView() {
  const { game, addMoney } = useGameState()
  const [hasCashedOut, setHasCashedOut] = useState(false)
  useEffect(() => {
    eventEmitter.emit({ type: 'BLIND_REWARDS_START' })
  }, [])

  const currentBlind = getInProgressBlind(game)
  const baseReward = currentBlind?.baseReward ?? 0
  const additionalRewards = currentBlind?.additionalRewards ?? []
  const totalReward = baseReward + additionalRewards.reduce((acc, reward) => acc + reward[1], 0)

  return (
    <ViewTemplate>
      <div>
        <h2>Blind Rewards</h2>
        <div>
          Your Score: {currentBlind?.score}
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
          addMoney(totalReward)
          eventEmitter.emit({ type: 'BLIND_REWARDS_END' })
        }}
      >
        Cash Out
      </Button>
    </ViewTemplate>
  )
}
