'use client'

/**
 * The foyer: the theatre's front of house, where the roster, character
 * creation and the run summary live. Same housing as the stage, no
 * proscenium: a lobby with playbills on the walls.
 */
import Link from 'next/link'
import * as React from 'react'

import { ROUTE_CONSTANTS } from '@/app/route-constants'
import { useGameStore } from '@/app/tap-tap-adventure/hooks/useGameStore'

import { StageIcon } from './icons'
import { TopBand } from './Theatre'

export function Foyer({ children, title = 'Tap Tap Adventure' }: { children: React.ReactNode; title?: string }) {
  const selectedCharacterId = useGameStore(s => s.gameState?.selectedCharacterId)
  const character = useGameStore(s => s.gameState?.characters?.find(c => c.id === s.gameState?.selectedCharacterId))
  return (
    <div className="flex min-h-[100dvh] w-full flex-col bg-ps-house text-on-surface">
      <TopBand
        identity={<span className="font-playbill text-lg uppercase tracking-widest text-ps-brass-light">{title}</span>}
        controls={
          selectedCharacterId ? (
            <Link
              href={`${ROUTE_CONSTANTS.TAP_TAP_ADVENTURE}/game`}
              className="flex h-9 items-center gap-1.5 rounded-[3px] border-2 border-ps-brass-deep px-2.5 font-label text-xs font-bold uppercase tracking-widest text-ps-brass-light transition-colors hover:bg-ps-lacquer-deep focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ds-primary"
            >
              <StageIcon />
              Back to the stage{character ? ` · ${character.name}` : ''}
            </Link>
          ) : null
        }
      />
      <div className="ps-scroll min-h-0 flex-1 overflow-y-auto p-3 sm:p-4 md:p-6">{children}</div>
    </div>
  )
}
