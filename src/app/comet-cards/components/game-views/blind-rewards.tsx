'use client'

import { useEffect, useState } from 'react'

import { PrimaryButton } from '@/app/comet-cards/components/cosmic/buttons'
import { Panel } from '@/app/comet-cards/components/cosmic/panel'
import { ViewTemplate } from '@/app/comet-cards/components/game-views/view-template'
import { eventEmitter } from '@/app/comet-cards/domain/events/event-emitter'
import { getBlindDefinition } from '@/app/comet-cards/domain/game/utils'
import { getInProgressBlind } from '@/app/comet-cards/domain/round/blinds'
import { useGameState } from '@/app/comet-cards/useGameState'

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

  const totalReward =
    baseReward + additionalRewards.reduce((acc, [, amount]) => acc + amount, 0)

  return (
    <ViewTemplate>
      <div className="mx-auto" style={{ maxWidth: 520, padding: '32px 0' }}>
        <Panel title="Blind Cleared">
          <div className="flex flex-col" style={{ padding: '20px 18px', gap: 14 }}>
            <div className="flex items-center justify-between">
              <span
                className="uppercase"
                style={{
                  fontFamily: 'var(--cc-font-mono)',
                  fontSize: 10,
                  letterSpacing: 2,
                  opacity: 0.55,
                }}
              >
                Your Score
              </span>
              <span
                style={{
                  fontFamily: 'var(--cc-font-mono)',
                  fontSize: 18,
                  fontWeight: 700,
                  color: 'var(--cc-mint)',
                }}
              >
                {currentBlind?.score.toString() ?? '0'}
              </span>
            </div>

            <div
              style={{
                borderTop: '1px solid var(--cc-panel-divider)',
                paddingTop: 14,
                display: 'flex',
                flexDirection: 'column',
                gap: 8,
              }}
            >
              <RewardRow label="Blind reward" amount={baseReward} />
              {additionalRewards.map(([rewardName, rewardAmount]) => (
                <RewardRow key={rewardName} label={rewardName} amount={rewardAmount} />
              ))}
            </div>

            <div
              className="flex items-center justify-between"
              style={{
                borderTop: '1px solid var(--cc-panel-divider)',
                paddingTop: 14,
              }}
            >
              <span
                className="uppercase"
                style={{
                  fontFamily: 'var(--cc-font-mono)',
                  fontSize: 11,
                  letterSpacing: 2,
                  opacity: 0.7,
                }}
              >
                Total
              </span>
              <span
                style={{
                  fontFamily: 'var(--cc-font-mono)',
                  fontSize: 22,
                  fontWeight: 700,
                  color: 'var(--cc-gold)',
                }}
              >
                ${totalReward}
              </span>
            </div>

            <PrimaryButton
              style={{ width: '100%', marginTop: 6 }}
              disabled={hasCashedOut}
              onClick={() => {
                setHasCashedOut(true)
                eventEmitter.emit({ type: 'BLIND_REWARDS_END' })
              }}
            >
              Cash Out
            </PrimaryButton>
          </div>
        </Panel>
      </div>
    </ViewTemplate>
  )
}

function RewardRow({ label, amount }: { label: string; amount: number }) {
  return (
    <div className="flex items-center justify-between">
      <span style={{ fontSize: 12, opacity: 0.75 }}>{label}</span>
      <span
        style={{
          fontFamily: 'var(--cc-font-mono)',
          fontSize: 13,
          color: 'var(--cc-gold)',
        }}
      >
        +${amount}
      </span>
    </div>
  )
}
