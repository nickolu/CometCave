'use client'

import { useState } from 'react'

import { CosmicShell } from '@/app/comet-cards/components/cosmic/shell'

import { CollectionView } from './components/CollectionView'
import { PlayView } from './components/PlayView'
import { SummaryView } from './components/SummaryView'
import { usePostmortem } from './usePostmortem'

import './postmortem.css'

type Screen = 'play' | 'collection'

/**
 * Desktop only. This is a deliberate, documented exception to CLAUDE.md
 * principle 8 (mobile = desktop): the prototype spec (#4042) puts mobile
 * layout out of scope, and the hand is one row of 8 cards with number-key
 * controls.
 *
 * "Play" shows the run summary once all 10 incidents are done.
 */
export function PostmortemGame() {
  const [screen, setScreen] = useState<Screen>('play')
  const game = usePostmortem({ keysActive: screen === 'play' })
  const { finished } = game

  return (
    <CosmicShell>
      <div className="pm-root">
        {screen === 'collection' ? (
          <CollectionView onBack={() => setScreen('play')} backLabel={finished ? 'Back to results' : 'Back to game'} />
        ) : finished ? (
          <SummaryView
            finished={finished}
            onPlayAgain={game.playAgain}
            onCollection={() => setScreen('collection')}
          />
        ) : (
          <PlayView game={game} onCollection={() => setScreen('collection')} />
        )}
      </div>
    </CosmicShell>
  )
}
