'use client'

import Link from 'next/link'
import { useMemo, useSyncExternalStore } from 'react'

import { StarRow } from '@/app/meteor-coins/components/StarRow'
import { useScores } from '@/app/meteor-coins/hooks/useScores'
import { bestText } from '@/app/meteor-coins/lib/goalText'
import {
  isUnlocked,
  parseProgress,
  readProgressRaw,
  subscribeProgress,
} from '@/app/meteor-coins/lib/progress'
import type { Placement } from '@/app/meteor-coins/lib/scoreboard'
import { STAGES, type Stage } from '@/app/meteor-coins/lib/stages'
import { PALETTE } from '@/app/meteor-coins/scene/palette'

/**
 * The campaign map: twelve stages in order. One star on a stage opens the
 * next; stages not built yet show as coming soon. Progress lives in this
 * browser, read through useSyncExternalStore so the server render (nothing
 * unlocked past stage 1) and the browser render never disagree on hydration.
 * The player's place on each stage's board comes from the server once the
 * account is known; the map reads the same without it.
 *
 * Takes over the viewport, so it carries its own cave exit (interaction model 2).
 */
export default function StageMap() {
  const raw = useSyncExternalStore(subscribeProgress, readProgressRaw, () => null)
  const progress = useMemo(() => parseProgress(raw), [raw])
  const { scores } = useScores()
  const totalStars = Object.values(progress.stars).reduce<number>((a, n) => a + n, 0)

  return (
    <div className="fixed inset-0 z-40 overflow-y-auto bg-ds-background text-white">
      <Link
        href="/"
        aria-label="Return to the cave"
        className="absolute left-2 top-2 z-50 flex min-h-11 min-w-11 items-center justify-center rounded-md px-2 text-sm text-white/60 hover:text-white focus-visible:outline focus-visible:outline-2 focus-visible:outline-white"
      >
        ✕
      </Link>
      <div className="mx-auto flex max-w-4xl flex-col gap-6 px-4 pb-[max(2rem,env(safe-area-inset-bottom))] pt-16">
        <header className="flex flex-col gap-1 text-center">
          <h1
            className="text-4xl font-extrabold uppercase tracking-wide"
            style={{ color: PALETTE.puck }}
          >
            Meteor Coins
          </h1>
          <p className="text-sm text-white/70">
            Twelve machines. Earn a star on each to open the next.{' '}
            <span className="tabular-nums">{totalStars} of 36 stars</span>
          </p>
        </header>
        <ol className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {STAGES.map(stage => (
            <li key={stage.slug} className="flex">
              <StageCard
                stage={stage}
                unlocked={isUnlocked(progress, stage)}
                stars={progress.stars[stage.slug] ?? 0}
                best={progress.best[stage.slug]}
                place={scores?.stages[stage.slug]}
              />
            </li>
          ))}
        </ol>
      </div>
    </div>
  )
}

function StageCard({
  stage,
  unlocked,
  stars,
  best,
  place,
}: {
  stage: Stage
  unlocked: boolean
  stars: number
  best?: number
  place?: Placement
}) {
  const number = (
    <span
      className="text-3xl font-extrabold tabular-nums leading-none"
      style={{ color: stage.playable && unlocked ? PALETTE.puck : undefined }}
    >
      {stage.number}
    </span>
  )

  if (stage.playable && unlocked) {
    const bestLine = [
      best !== undefined && bestText(stage, best),
      place?.listed && place.rank !== null && `#${place.rank} on the board`,
      'Play',
    ]
      .filter(Boolean)
      .join(' · ')
    // The stage name is the link and covers the whole card; the scores link
    // sits above that cover so both can be reached by pointer and keyboard.
    return (
      <div className="relative flex w-full flex-col gap-2 rounded-lg border border-white/20 bg-white/5 p-4 transition-colors hover:border-white/50 hover:bg-white/10 motion-reduce:transition-none">
        <div className="flex items-start justify-between gap-3">
          {number}
          <StarRow earned={stars} size={18} label={`${stars} of 3 stars`} />
        </div>
        <Link
          href={`/meteor-coins/${stage.slug}`}
          className="text-lg font-bold after:absolute after:inset-0 after:rounded-lg focus-visible:outline focus-visible:outline-2 focus-visible:outline-white"
        >
          {stage.name}
        </Link>
        <span className="text-sm italic text-white/75">{stage.pitch}</span>
        <span className="mt-auto flex items-center justify-between gap-3 pt-1 text-xs text-white/60">
          <span>{bestLine}</span>
          <Link
            href={`/meteor-coins/${stage.slug}/scores`}
            className="relative z-10 min-h-11 px-1 leading-[2.75rem] underline-offset-4 hover:underline focus-visible:outline focus-visible:outline-2 focus-visible:outline-white"
          >
            Scores
          </Link>
        </span>
      </div>
    )
  }

  const previous = STAGES.filter(s => s.playable && s.number < stage.number).at(-1)
  const reason = stage.playable
    ? `Earn a star on stage ${previous?.number ?? stage.number - 1} to open.`
    : 'Coming soon.'
  return (
    <div
      aria-disabled
      className="flex w-full flex-col gap-2 rounded-lg border border-dashed border-white/15 p-4 text-white/50"
    >
      <div className="flex items-start justify-between gap-3">
        {number}
        <span aria-hidden className="material-symbols-outlined text-[20px]">
          {stage.playable ? 'lock' : 'construction'}
        </span>
      </div>
      <span className="text-lg font-bold">{stage.name}</span>
      <span className="text-sm italic">{stage.pitch}</span>
      <span className="mt-auto pt-1 text-xs">{reason}</span>
    </div>
  )
}
