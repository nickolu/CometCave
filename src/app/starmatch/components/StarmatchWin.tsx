'use client'

import Link from 'next/link'

import { ROUTE_CONSTANTS } from '@/app/route-constants'
import type { StarmatchState } from '@/app/starmatch/useStarmatch'
import { ChunkyButton } from '@/components/ui/chunky-button'
import { ChunkyCard, ChunkyCardContent } from '@/components/ui/chunky-card'
import { cn } from '@/lib/utils'



interface WinProps {
  state: StarmatchState
  onPlayAgain: () => void
  onNewMatch: () => void
}

const MEDALS = ['🥇', '🥈', '🥉']

export function StarmatchWin({ state, onPlayAgain, onNewMatch }: WinProps) {
  const ranked = [...state.players].sort((a, b) => b.score - a.score)
  const winner = ranked[0]

  return (
    <div className="flex flex-col items-center gap-6 py-10 text-center">
      <div
        className="text-6xl md:text-7xl animate-bounce motion-reduce:animate-none"
        aria-hidden
        style={{ filter: `drop-shadow(0 0 24px ${winner.color})` }}
      >
        {winner.glyph}
      </div>

      <h2
        className="font-headline text-headline-lg text-on-surface"
        aria-live="polite"
      >
        <span style={{ color: winner.color }}>{winner.name}</span> reads the stars best
      </h2>
      <p className="text-on-surface-variant">Most twin signs traced across the drift.</p>

      <ChunkyCard variant="surface-variant" className="w-full max-w-md">
        <ChunkyCardContent className="pt-4 pb-4 flex flex-col gap-2">
          {ranked.map((p, i) => (
            <div
              key={p.id}
              className={cn(
                'flex items-center gap-3 rounded-ds-sm px-4 py-2.5 border-2',
                i === 0
                  ? 'border-transparent bg-surface-container-high'
                  : 'border-outline-variant/30 bg-surface-container-high/50'
              )}
              style={i === 0 ? { borderColor: winner.color } : undefined}
            >
              <span className="w-8 text-center font-mono font-bold text-on-surface-variant">
                {MEDALS[i] ?? `#${i + 1}`}
              </span>
              <span className="text-xl" aria-hidden>
                {p.glyph}
              </span>
              <span className="flex-1 text-left font-headline font-bold truncate">{p.name}</span>
              <span
                className="font-mono tabular-nums text-2xl font-bold"
                style={{ color: p.color }}
              >
                {p.score}
              </span>
            </div>
          ))}
        </ChunkyCardContent>
      </ChunkyCard>

      <div className="flex flex-wrap items-center justify-center gap-3">
        <ChunkyButton
          variant="primary"
          size="lg"
          onClick={onPlayAgain}
          iconStart={
            <span className="material-symbols-outlined text-[20px]" aria-hidden>
              replay
            </span>
          }
        >
          Chart again
        </ChunkyButton>
        <ChunkyButton variant="ghost" size="lg" onClick={onNewMatch}>
          New match
        </ChunkyButton>
        <Link href={ROUTE_CONSTANTS.HOME}>
          <ChunkyButton variant="ghost" size="lg" asChild>
            <span>Return to the cave</span>
          </ChunkyButton>
        </Link>
      </div>
    </div>
  )
}
