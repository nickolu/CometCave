'use client'

import { useState, useRef, useCallback } from 'react'

import { motion, useReducedMotion } from 'framer-motion'

import { BlindCard } from '@/app/comet-cards/components/blind-selection/blind-card'
import {
  DangerButton,
  GhostButton,
  PrimaryButton,
} from '@/app/comet-cards/components/cosmic/buttons'
import { Modal } from '@/app/comet-cards/components/ui/modal'
import { calculateAnte, getBlindDefinition } from '@/app/comet-cards/domain/game/utils'
import { eventEmitter } from '@/app/comet-cards/domain/events/event-emitter'
import { useAutoFocus } from '@/app/comet-cards/hooks/useAutoFocus'
import { useRunHistory } from '@/app/comet-cards/hooks/useRunHistory'
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
  const autoFocusRef = useAutoFocus()
  const containerRef = useRef<HTMLDivElement>(null)
  const handleKeyDown = useCallback((e: React.KeyboardEvent) => {
    if (e.key !== 'ArrowLeft' && e.key !== 'ArrowRight') return
    const container = containerRef.current
    if (!container) return
    // find all enabled Select buttons (aria-label starts with "Select ")
    const selectBtns = Array.from(
      container.querySelectorAll<HTMLButtonElement>('button[aria-label^="Select "]:not([disabled])')
    )
    if (selectBtns.length === 0) return
    const currentIdx = selectBtns.indexOf(document.activeElement as HTMLButtonElement)
    if (currentIdx === -1) {
      // focus the first available select button
      selectBtns[0].focus()
      return
    }
    e.preventDefault()
    const next = e.key === 'ArrowRight'
      ? Math.min(currentIdx + 1, selectBtns.length - 1)
      : Math.max(currentIdx - 1, 0)
    selectBtns[next]?.focus()
  }, [])
  const [showGiveUpModal, setShowGiveUpModal] = useState(false)
  const { todayRun } = useRunHistory()
  const isPractice = todayRun !== null
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
    <>
    <ViewTemplate
      topBarAction={
        <GhostButton onClick={() => setShowGiveUpModal(true)} style={{ fontSize: 10, opacity: 0.6 }}>
          {isPractice ? 'Restart' : 'Give Up'}
        </GhostButton>
      }
    >
      <div ref={autoFocusRef}>
      <div ref={containerRef} onKeyDown={handleKeyDown}>
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
      </div>
      </div>
    </ViewTemplate>
    {showGiveUpModal && (
      <Modal
        eyebrow={isPractice ? 'Practice Run' : 'End Run'}
        title={isPractice ? 'Restart?' : 'Give up?'}
        onClose={() => setShowGiveUpModal(false)}
      >
        <div style={{ padding: '16px 20px', fontFamily: 'var(--cc-font-mono)', fontSize: 12 }}>
          <p style={{ opacity: 0.7, marginBottom: 16 }}>
            {isPractice
              ? "Start over from round 1. Practice runs don't record scores."
              : `Your current score of ${game.totalScore.toString()} will be your final score for today.`}
          </p>
          <div className="flex items-center justify-end gap-3">
            <GhostButton onClick={() => setShowGiveUpModal(false)}>Cancel</GhostButton>
            {isPractice ? (
              <PrimaryButton onClick={() => eventEmitter.emit({ type: 'GAME_START' })}>
                Restart
              </PrimaryButton>
            ) : (
              <DangerButton onClick={() => eventEmitter.emit({ type: 'GIVE_UP' })}>
                Give Up
              </DangerButton>
            )}
          </div>
        </div>
      </Modal>
    )}
    </>
  )
}
