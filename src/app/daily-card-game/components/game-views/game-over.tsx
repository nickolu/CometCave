'use client'

import { useCallback, useMemo, useState } from 'react'

import { useGameState } from '@/app/daily-card-game/useGameState'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'

import { ViewTemplate } from './view-template'

async function copyToClipboard(text: string) {
  if (typeof window === 'undefined') return

  if (window.isSecureContext && navigator.clipboard?.writeText) {
    await navigator.clipboard.writeText(text)
    return
  }

  // Fallback for non-secure contexts / older browsers
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
    const link = 'https://cometcave.com/daily-card-game'
    const progressBar =
      '🟩 '.repeat(roundsCompleted) + '🟥 '.repeat(Math.max(0, totalRounds - roundsCompleted))
    return [
      didWin ? 'Daily Card Game — You Win!' : 'Daily Card Game — Game Over',
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
      // If clipboard fails, at least surface the text for manual copy.
      window.prompt('Copy your score report:', shareText)
    }
  }, [shareText])

  return (
    <ViewTemplate>
      <Card className="bg-space-grey border-space-purple p-4 text-cream-white h-63 w-1/3 flex flex-col justify-between text-center mx-auto">
        <div className="flex flex-col items-center justify-center">
          <h2>{didWin ? 'You Win!' : 'Game Over: You Lose'}</h2>
          <div>Total Score: {game.totalScore.toString()}</div>
          <div>Hands Played: {game.handsPlayed}</div>
          <div>
            Rounds Completed: {roundsCompleted} / {totalRounds}
            <div className="mt-2 flex justify-center gap-1">
              {Array.from({ length: totalRounds }).map((_, idx) => {
                const isCompleted = idx < roundsCompleted
                return (
                  <span
                    key={idx}
                    title={
                      isCompleted ? `Round ${idx + 1} completed` : `Round ${idx + 1} remaining`
                    }
                    aria-label={
                      isCompleted ? `Round ${idx + 1} completed` : `Round ${idx + 1} remaining`
                    }
                    className={[
                      'inline-block h-3 w-3 rounded-sm border',
                      isCompleted ? 'bg-green-600 border-green-700' : 'bg-red-600 border-red-700',
                    ].join(' ')}
                  />
                )
              })}
            </div>
          </div>
          <div className="mt-4">
            <Button onClick={onShare}>{hasCopied ? 'Copied!' : 'Share Score'}</Button>
          </div>
          <div className="mt-4">
            <p className="text-lg font-bold text-space-gold">Try again tomorrow for a new game!</p>
          </div>
        </div>
      </Card>
    </ViewTemplate>
  )
}
