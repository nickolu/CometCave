'use client'

import { useCallback, useMemo, useState } from 'react'

import { PrimaryButton } from '@/app/comet-cards/components/cosmic/buttons'
import { Panel } from '@/app/comet-cards/components/cosmic/panel'
import { useGameState } from '@/app/comet-cards/useGameState'

import { ViewTemplate } from './view-template'

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

  const totalRounds = 8
  const roundsCompleted = Math.max(0, Math.min(totalRounds, game.roundIndex - 1))
  const didWin = roundsCompleted >= totalRounds

  const shareText = useMemo(() => {
    const link = 'https://cometcave.com/comet-cards'
    const progressBar =
      '🟩 '.repeat(roundsCompleted) + '🟥 '.repeat(Math.max(0, totalRounds - roundsCompleted))
    return [
      didWin ? 'Comet Cards — You Win!' : 'Comet Cards — Game Over',
      '',
      `Final Score: ${game.totalScore.toString()}`,
      `Hands Played: ${game.handsPlayed}`,
      `Rounds Completed:`,
      progressBar,
      '',
      `Play: ${link}`,
    ].join('\n')
  }, [didWin, game.handsPlayed, game.totalScore, roundsCompleted, totalRounds])

  const onShare = useCallback(async () => {
    try {
      await copyToClipboard(shareText)
      setHasCopied(true)
      window.setTimeout(() => setHasCopied(false), 2000)
    } catch {
      window.prompt('Copy your score report:', shareText)
    }
  }, [shareText])

  const accent = didWin ? 'var(--cc-mint)' : 'var(--cc-pink)'
  const eyebrow = didWin ? 'Victory' : 'Run Ended'
  const headline = didWin ? 'The cave aligns.' : 'The cave goes quiet.'

  return (
    <ViewTemplate>
      <div className="mx-auto" style={{ maxWidth: 520, padding: '32px 0' }}>
        <Panel title={eyebrow}>
          <div
            className="flex flex-col items-center text-center"
            style={{ padding: '28px 24px', gap: 16 }}
          >
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
              Total Score
            </div>
            <div
              style={{
                fontSize: 44,
                fontWeight: 200,
                letterSpacing: -1.5,
                lineHeight: 1,
                color: 'var(--cc-text-default)',
                textShadow: '0 0 60px rgba(94,234,212,0.3)',
              }}
            >
              {game.totalScore.toString()}
            </div>
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
            <div className="flex flex-col items-center" style={{ gap: 6, marginTop: 8 }}>
              <div style={{ fontSize: 12, opacity: 0.7 }}>
                Hands Played: <strong>{game.handsPlayed}</strong>
              </div>
            </div>
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
              Try again tomorrow for a new game.
            </div>
          </div>
        </Panel>
      </div>
    </ViewTemplate>
  )
}
