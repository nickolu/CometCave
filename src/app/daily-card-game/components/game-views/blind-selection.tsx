'use client'

import { BlindCard } from '@/app/daily-card-game/components/blind-selection/blind-card'
import { useGameState } from '@/app/daily-card-game/useGameState'

import { ViewTemplate } from './view-template'

export function BlindSelectionView() {
  const { game } = useGameState()
  const currentRound = game.rounds[game.roundIndex]
  const blindsInCurrentRound = [
    currentRound.smallBlind,
    currentRound.bigBlind,
    currentRound.bossBlind,
  ]
  const nextBlind = blindsInCurrentRound.find(blind => blind.status === 'notStarted')

  return (
    <ViewTemplate>
      <div className="flex gap-2">
        <BlindCard
          name="Small Blind"
          minimumScore={
            game.rounds[game.roundIndex].baseAnte * (currentRound.smallBlind.anteMultiplier || 1)
          }
          disabled={nextBlind?.type !== 'smallBlind'}
          selectEventName="SMALL_BLIND_SELECTED"
          skipEventName="SMALL_BLIND_SKIPPED"
        />
        <BlindCard
          name="Big Blind"
          minimumScore={
            game.rounds[game.roundIndex].baseAnte * (currentRound.bigBlind.anteMultiplier || 1)
          }
          disabled={nextBlind?.type !== 'bigBlind'}
          selectEventName="BIG_BLIND_SELECTED"
          skipEventName="BIG_BLIND_SKIPPED"
        />
        <BlindCard
          name={'Boss Blind: ' + currentRound.bossBlind.name}
          minimumScore={
            game.rounds[game.roundIndex].baseAnte * (currentRound.bossBlind.anteMultiplier || 1)
          }
          disabled={nextBlind?.type !== 'bossBlind'}
          selectEventName="BOSS_BLIND_SELECTED"
        />
      </div>
    </ViewTemplate>
  )
}
