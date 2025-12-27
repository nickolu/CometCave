'use client'

import { useCallback, useMemo, useState } from 'react'

import { useGameState } from '@/app/daily-card-game/useGameState'
import { Button } from '@/components/ui/button'

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

  const shareText = useMemo(() => {
    const link = 'https://cometcave.com/daily-card-game'
    return [
      'CometCave — Daily Card Game',
      `Score: ${game.totalScore}`,
      `Hands played: ${game.handsPlayed}`,
      link,
    ].join('\n')
  }, [game.handsPlayed, game.totalScore])

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
      <div className="flex flex-col items-center justify-center">
        <h2>Game Over: You Lose</h2>
        <div>Total Score: {game.totalScore}</div>
        <div>Hands Played: {game.handsPlayed}</div>
        <div className="mt-4">
          <Button variant="outline" onClick={onShare}>
            {hasCopied ? 'Copied!' : 'Share Score'}
          </Button>
        </div>
        <div>
          <p>Try again tomorrow for a new game!</p>
        </div>
      </div>
    </ViewTemplate>
  )
}
