'use client'

import { useEffect, useState } from 'react'
import { motion } from 'framer-motion'

import { PrimaryButton } from '@/app/comet-cards/components/cosmic/buttons'
import { Panel } from '@/app/comet-cards/components/cosmic/panel'
import { ViewTemplate } from '@/app/comet-cards/components/game-views/view-template'
import { useAutoFocus } from '@/app/comet-cards/hooks/useAutoFocus'
import { MiniScoringLog } from '@/app/comet-cards/components/mini-scoring-log'
import { eventEmitter } from '@/app/comet-cards/domain/events/event-emitter'
import { getBlindDefinition } from '@/app/comet-cards/domain/game/utils'
import { getInProgressBlind } from '@/app/comet-cards/domain/round/blinds'
import { useGameState } from '@/app/comet-cards/useGameState'

function FadeUp({ children, delay = 0 }: { children: React.ReactNode; delay?: number }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4, delay, ease: [0.2, 0.9, 0.3, 1] }}
    >
      {children}
    </motion.div>
  )
}

export function BlindRewardsView() {
  const { game } = useGameState()
  const [hasCashedOut, setHasCashedOut] = useState(false)
  const autoFocusRef = useAutoFocus()
  useEffect(() => {
    eventEmitter.emit({ type: 'BLIND_REWARDS_START' })
    eventEmitter.emit({ type: 'ROUND_END' })
  }, [])

  const currentBlind = getInProgressBlind(game)
  const baseReward =
    getBlindDefinition(currentBlind?.type ?? 'smallBlind', game.rounds[game.roundIndex])
      .baseReward ?? 0
  const additionalRewards = currentBlind?.additionalRewards ?? []

  const jokerPayoutTotal = game.gamePlayState.jokerPayouts.reduce(
    (acc, p) => acc + p.amount,
    0
  )
  const totalReward =
    baseReward +
    additionalRewards.reduce((acc, [, amount]) => acc + amount, 0) +
    jokerPayoutTotal

  return (
    <ViewTemplate>
      <div ref={autoFocusRef} className="mx-auto" style={{ maxWidth: 520, padding: '32px 0' }}>
        <Panel title="Blind Cleared">
          <div className="flex flex-col" style={{ padding: '20px 18px', gap: 14 }}>
            <FadeUp delay={0}>
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
            </FadeUp>

            <FadeUp delay={0.2}>
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
                {game.gamePlayState.jokerPayouts.map((payout, i) => (
                  <RewardRow key={`joker-${i}`} label={payout.name} amount={payout.amount} />
                ))}
              </div>
            </FadeUp>

            <FadeUp delay={0.4}>
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
            </FadeUp>

            <FadeUp delay={0.6}>
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
            </FadeUp>

            {game.gamePlayState.handResults.length > 0 && (
              <FadeUp delay={0.8}>
                <div
                  style={{
                    borderTop: '1px solid var(--cc-panel-divider)',
                    paddingTop: 14,
                  }}
                >
                  <div
                    className="uppercase"
                    style={{
                      fontFamily: 'var(--cc-font-mono)',
                      fontSize: 10,
                      letterSpacing: 2,
                      opacity: 0.55,
                      marginBottom: 8,
                    }}
                  >
                    Hands Played
                  </div>
                  <MiniScoringLog handResults={game.gamePlayState.handResults} />
                </div>
              </FadeUp>
            )}
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
