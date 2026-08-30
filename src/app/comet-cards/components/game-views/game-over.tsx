'use client'

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { motion, useReducedMotion } from 'framer-motion'

import { GhostButton, PrimaryButton } from '@/app/comet-cards/components/cosmic/buttons'
import { Panel } from '@/app/comet-cards/components/cosmic/panel'
import { MiniScoringLog } from '@/app/comet-cards/components/mini-scoring-log'
import { useAutoFocus } from '@/app/comet-cards/hooks/useAutoFocus'
import { useGameState } from '@/app/comet-cards/useGameState'
import { useLandscapeMobile } from '@/app/comet-cards/hooks/useLandscapeMobile'
import { useRunHistory } from '@/app/comet-cards/hooks/useRunHistory'
import { eventEmitter } from '@/app/comet-cards/domain/events/event-emitter'
import { calculateAnte, getBlindDefinition } from '@/app/comet-cards/domain/game/utils'
import { getTodayPST } from '@/lib/dates'

import { ViewTemplate } from './view-template'

function FadeUp({ children, delay = 0 }: { children: React.ReactNode; delay?: number }) {
  const reducedMotion = useReducedMotion()
  return (
    <motion.div
      initial={reducedMotion ? false : { opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      transition={reducedMotion ? { duration: 0 } : { duration: 0.4, delay, ease: [0.2, 0.9, 0.3, 1] }}
    >
      {children}
    </motion.div>
  )
}

async function copyToClipboard(text: string) {
  if (typeof window === 'undefined') return

  if (window.isSecureContext && navigator.clipboard?.writeText) {
    await navigator.clipboard.writeText(text)
    return
  }

  const textArea = document.createElement('textarea')
  textArea.value = text
  textArea.style.position = 'fixed'
  textArea.style.left = '-9999px'
  textArea.style.top = '-9999px'
  document.body.appendChild(textArea)
  textArea.focus()
  textArea.select()
  document.execCommand('copy')
  document.body.removeChild(textArea)
}

export function GameOverView() {
  const { game } = useGameState()
  const [hasCopied, setHasCopied] = useState(false)
  const copiedTimerRef = useRef<ReturnType<typeof setTimeout> | undefined>(undefined)
  const { addRun, findTodayRun } = useRunHistory()
  const reducedMotion = useReducedMotion()

  const isLastAnte = game.mode === 'lastAnte'

  const totalRounds = isLastAnte ? 1 : 8
  const didWin = isLastAnte
    ? game.lastAnte?.outcome === 'won'
    : game.roundIndex - 1 >= totalRounds
  const roundsCompleted = isLastAnte
    ? didWin
      ? 1
      : 0
    : Math.max(0, Math.min(totalRounds, game.roundIndex - 1))
  const isPractice = findTodayRun(game.mode) !== null

  /**
   * The Last Ante is scored on overkill, not on pass/fail. Everyone who clears
   * the boss gets a number that is comparable to everyone else's — same seed,
   * same deck, same boss — which is the part worth arguing about.
   */
  const overkill = useMemo(() => {
    if (!isLastAnte || !didWin) return null
    const round = game.rounds[game.roundIndex]
    const bossScore = round.bossBlind.score
    const target = calculateAnte(round.baseAnte, getBlindDefinition('bossBlind', round).anteMultiplier)
    return bossScore - target
  }, [didWin, game.rounds, game.roundIndex, isLastAnte])

  useEffect(() => () => { clearTimeout(copiedTimerRef.current) }, [])
  const hasSaved = useRef(false)
  useEffect(() => {
    if (hasSaved.current || isPractice) return
    hasSaved.current = true
    addRun({
      mode: game.mode,
      seed: game.gameSeed,
      // PST, to match how `todayRun` looks a run up.
      date: getTodayPST(),
      totalScore: game.totalScore.toString(),
      handsPlayed: game.handsPlayed,
      roundsCompleted,
      totalRounds,
      won: didWin,
    })
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  const shareText = useMemo(() => {
    const link = 'https://cometcave.com/comet-cards'
    if (isLastAnte) {
      const lines = [
        didWin ? 'Comet Cards — The Last Ante ✅' : 'Comet Cards — The Last Ante ❌',
        '',
        didWin ? `Overkill: ${overkill?.toString()}` : `Fell short at ${game.totalScore.toString()}`,
        `Hands Played: ${game.handsPlayed}`,
      ]
      if (game.gameSeed) lines.push('', `Seed: ${game.gameSeed}`)
      lines.push('', `Play: ${link}`)
      return lines.join('\n')
    }

    const progressBar =
      '🟩 '.repeat(roundsCompleted) + '🟥 '.repeat(Math.max(0, totalRounds - roundsCompleted))
    const lines = [
      didWin ? 'Comet Cards — You Win!' : 'Comet Cards — Game Over',
      '',
      `Final Score: ${game.totalScore.toString()}`,
      `Hands Played: ${game.handsPlayed}`,
      `Rounds Completed:`,
      progressBar,
    ]
    if (game.gameSeed) lines.push('', `Seed: ${game.gameSeed}`)
    lines.push('', `Play: ${link}`)
    return lines.join('\n')
  }, [didWin, game.handsPlayed, game.gameSeed, game.totalScore, isLastAnte, overkill, roundsCompleted, totalRounds])

  const onShare = useCallback(async () => {
    if (navigator.share) {
      try {
        await navigator.share({ text: shareText })
        return
      } catch {
        // User cancelled or share failed — fall through to clipboard
      }
    }
    try {
      await copyToClipboard(shareText)
      clearTimeout(copiedTimerRef.current)
      setHasCopied(true)
      copiedTimerRef.current = setTimeout(() => setHasCopied(false), 2000)
    } catch {
      window.prompt('Copy your score report:', shareText)
    }
  }, [shareText])

  const autoFocusRef = useAutoFocus()
  const isLandscape = useLandscapeMobile()
  const accent = didWin ? 'var(--cc-mint)' : 'var(--cc-pink)'
  const eyebrow = isPractice ? 'Practice Run' : didWin ? 'Victory' : 'Run Ended'
  const headline = isLastAnte
    ? didWin
      ? 'You talked your way out.'
      : 'The table keeps you.'
    : didWin
      ? 'The cave aligns.'
      : 'The cave goes quiet.'

  return (
    <ViewTemplate>
      <div ref={autoFocusRef} className="mx-auto" style={{ maxWidth: 520, padding: isLandscape ? '8px 0' : '32px 0' }}>
        <Panel title={eyebrow}>
          <div
            className="flex flex-col items-center text-center"
            style={{ padding: isLandscape ? '12px 16px' : '28px 24px', gap: 16 }}
          >
            <FadeUp delay={0}>
              <div
                className="uppercase"
                style={{
                  fontFamily: 'var(--cc-font-mono)',
                  fontSize: 11,
                  letterSpacing: 2.5,
                  opacity: 0.55,
                  color: accent,
                }}
              >
                {didWin ? 'You Win' : 'Game Over'}
              </div>
            </FadeUp>
            <FadeUp delay={0.15}>
              <div
                style={{
                  fontSize: 28,
                  fontWeight: 300,
                  letterSpacing: -0.5,
                  lineHeight: 1.2,
                  color: 'var(--cc-text-default)',
                }}
              >
                {headline}
              </div>
            </FadeUp>
            <FadeUp delay={0.3}>
              <div
                className="uppercase"
                style={{
                  fontFamily: 'var(--cc-font-mono)',
                  fontSize: 10,
                  letterSpacing: 2,
                  opacity: 0.5,
                  marginTop: 8,
                }}
              >
                {overkill !== null ? 'Overkill' : 'Total Score'}
              </div>
            </FadeUp>
            <motion.div
              initial={reducedMotion ? false : { opacity: 0, y: 16, scale: 0.8 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              transition={reducedMotion ? { duration: 0 } : { duration: 0.5, delay: 0.45, ease: [0.2, 0.9, 0.3, 1] }}
            >
              <div
                style={{
                  fontSize: isLandscape ? 28 : 44,
                  fontWeight: 200,
                  letterSpacing: -1.5,
                  lineHeight: 1,
                  color: 'var(--cc-text-default)',
                  textShadow: '0 0 60px rgba(94,234,212,0.3)',
                }}
              >
                {(overkill ?? game.totalScore).toString()}
              </div>
            </motion.div>
            <FadeUp delay={0.6}>
              <div
                className="flex items-center justify-center gap-1"
                style={{ marginTop: 4 }}
                role="img"
                aria-label={`Rounds completed ${roundsCompleted} of ${totalRounds}`}
              >
                {Array.from({ length: totalRounds }).map((_, idx) => {
                  const isCompleted = idx < roundsCompleted
                  return (
                    <span
                      key={idx}
                      className="inline-block"
                      style={{
                        width: 14,
                        height: 14,
                        borderRadius: 3,
                        background: isCompleted
                          ? 'color-mix(in srgb, var(--cc-mint) 65%, transparent)'
                          : 'transparent',
                        border: isCompleted
                          ? '1px solid var(--cc-mint)'
                          : '1px solid rgba(255,107,157,0.4)',
                        boxShadow: isCompleted ? '0 0 10px rgba(94,234,212,0.45)' : 'none',
                      }}
                    />
                  )
                })}
              </div>
              <div
                className="uppercase"
                style={{
                  fontFamily: 'var(--cc-font-mono)',
                  fontSize: 10,
                  letterSpacing: 2,
                  opacity: 0.45,
                }}
              >
                {roundsCompleted} / {totalRounds} rounds
              </div>
            </FadeUp>
            <FadeUp delay={0.75}>
              <div className="flex flex-col items-center" style={{ gap: 6, marginTop: 8 }}>
                <div style={{ fontSize: 12, opacity: 0.7 }}>
                  Hands Played: <strong>{game.handsPlayed}</strong>
                </div>
                {game.gameSeed && (
                  <div
                    style={{
                      fontFamily: 'var(--cc-font-mono)',
                      fontSize: 10,
                      letterSpacing: 1,
                      opacity: 0.4,
                      marginTop: 4,
                    }}
                  >
                    Seed: {game.gameSeed}
                  </div>
                )}
              </div>
            </FadeUp>
            {game.gamePlayState.handResults.length > 0 && (
              <FadeUp delay={0.8}>
                <div
                  style={{
                    width: '100%',
                    borderTop: '1px solid var(--cc-panel-divider)',
                    paddingTop: 14,
                    textAlign: 'left',
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
                    Final Hands
                  </div>
                  <MiniScoringLog handResults={game.gamePlayState.handResults} />
                </div>
              </FadeUp>
            )}
            <FadeUp delay={1.0}>
              <PrimaryButton style={{ marginTop: 12 }} onClick={onShare}>
                {hasCopied ? 'Copied' : 'Share Score'}
              </PrimaryButton>
              <div
                style={{
                  fontSize: 12,
                  opacity: 0.55,
                  marginTop: 8,
                  color: 'var(--cc-gold)',
                  fontWeight: 600,
                }}
              >
                {didWin
                  ? 'The cave aligns. Return tomorrow to test your fortune again.'
                  : roundsCompleted >= 4
                    ? 'So close. Can you thread the needle tomorrow?'
                    : 'The cave awaits your return. Tomorrow brings fresh cards.'}
              </div>
              <div className="flex items-center justify-center" style={{ gap: 12, marginTop: 16 }}>
                <PrimaryButton onClick={() => eventEmitter.emit({ type: 'GAME_START' })}>
                  Try Again
                </PrimaryButton>
                <GhostButton onClick={() => eventEmitter.emit({ type: 'BACK_TO_MAIN_MENU' })}>
                  Go Back
                </GhostButton>
              </div>
            </FadeUp>
          </div>
        </Panel>
      </div>
    </ViewTemplate>
  )
}
