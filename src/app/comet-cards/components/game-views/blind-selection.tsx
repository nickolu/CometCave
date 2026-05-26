'use client'

import { motion, useReducedMotion } from 'framer-motion'

import { BlindCard } from '@/app/comet-cards/components/blind-selection/blind-card'
import { calculateAnte, getBlindDefinition } from '@/app/comet-cards/domain/game/utils'
import { useGameState } from '@/app/comet-cards/useGameState'

import { ViewTemplate } from './view-template'

const containerVariants = {
  hidden: {},
  visible: { transition: { staggerChildren: 0.08 } },
}

const itemVariants = {
  hidden: { opacity: 0, y: 20, scale: 0.95 },
  visible: {
    opacity: 1,
    y: 0,
    scale: 1,
    transition: { duration: 0.35, ease: [0.2, 0.9, 0.3, 1] },
  },
}

export function BlindSelectionView() {
  const { game } = useGameState()
  const reducedMotion = useReducedMotion()
  const currentRound = game.rounds[game.roundIndex]
  const blindsInCurrentRound = [
    currentRound.smallBlind,
    currentRound.bigBlind,
    currentRound.bossBlind,
  ]
  const nextBlind = blindsInCurrentRound.find(blind => blind.status === 'notStarted')
  const smallBlindDefinition = getBlindDefinition(
    currentRound.smallBlind.type,
    game.rounds[game.roundIndex]
  )
  const bigBlindDefinition = getBlindDefinition(
    currentRound.bigBlind.type,
    game.rounds[game.roundIndex]
  )
  const bossBlindDefinition = getBlindDefinition(
    currentRound.bossBlind.type,
    game.rounds[game.roundIndex]
  )

  return (
    <ViewTemplate>
      <motion.div
        className="grid grid-cols-1 sm:grid-cols-3 items-stretch gap-4"
        variants={containerVariants}
        initial={reducedMotion ? false : 'hidden'}
        animate="visible"
      >
        <motion.div variants={itemVariants}>
          <BlindCard
            name="Small Blind"
            reward={smallBlindDefinition.baseReward}
            minimumScore={calculateAnte(
              game.rounds[game.roundIndex].baseAnte,
              smallBlindDefinition.anteMultiplier
            )}
            disabled={nextBlind?.type !== 'smallBlind'}
            selectEventName="SMALL_BLIND_SELECTED"
            tag={game.rounds[game.roundIndex].smallBlind.tag ?? undefined}
          />
        </motion.div>
        <motion.div variants={itemVariants}>
          <BlindCard
            name="Big Blind"
            reward={bigBlindDefinition.baseReward}
            minimumScore={calculateAnte(
              game.rounds[game.roundIndex].baseAnte,
              bigBlindDefinition.anteMultiplier
            )}
            disabled={nextBlind?.type !== 'bigBlind'}
            selectEventName="BIG_BLIND_SELECTED"
            tag={game.rounds[game.roundIndex].bigBlind.tag ?? undefined}
          />
        </motion.div>
        <motion.div variants={itemVariants}>
          <BlindCard
            name={'Boss: ' + bossBlindDefinition.name}
            description={bossBlindDefinition.description}
            reward={bossBlindDefinition.baseReward}
            minimumScore={calculateAnte(
              game.rounds[game.roundIndex].baseAnte,
              bossBlindDefinition.anteMultiplier
            )}
            disabled={nextBlind?.type !== 'bossBlind'}
            selectEventName="BOSS_BLIND_SELECTED"
          />
        </motion.div>
      </motion.div>
    </ViewTemplate>
  )
}
