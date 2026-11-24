'use client'

import { useState } from 'react'

import { CosmicShell } from '@/app/comet-cards/components/cosmic/shell'

import { CardInfoDialog } from './components/CardInfoDialog'
import { CollectionView } from './components/CollectionView'
import { PlayView } from './components/PlayView'
import { SummaryView } from './components/SummaryView'
import { usePostmortem } from './usePostmortem'

import './postmortem.css'

type Screen = 'play' | 'collection'

/**
 * "Play" shows the run summary once all 10 incidents are done.
 */
export function PostmortemGame() {
  const [screen, setScreen] = useState<Screen>('play')
  const [info, setInfo] = useState<{ cardId: string; trigger: HTMLElement | null } | null>(null)
  const openInfo = (cardId: string, trigger?: HTMLElement) =>
    setInfo({ cardId, trigger: trigger ?? (document.activeElement instanceof HTMLElement ? document.activeElement : null) })
  // Keys are off while the dialog is open so number keys and Enter cannot reach the game behind it.
  const game = usePostmortem({ keysActive: screen === 'play' && !info, onOpenInfo: id => openInfo(id) })
  const { finished } = game

  return (
    <CosmicShell>
      <div className="pm-root">
        {screen === 'collection' ? (
          <CollectionView onInfo={openInfo} onBack={() => setScreen('play')} backLabel={finished ? 'Back to results' : 'Back to game'} />
        ) : finished ? (
          <SummaryView
            finished={finished}
            onPlayAgain={game.playAgain}
            onCollection={() => setScreen('collection')}
          />
        ) : (
          <PlayView game={game} onInfo={openInfo} onCollection={() => setScreen('collection')} />
        )}
      </div>
      <CardInfoDialog cardId={info?.cardId ?? null} trigger={info?.trigger ?? null} onClose={() => setInfo(null)} />
    </CosmicShell>
  )
}
