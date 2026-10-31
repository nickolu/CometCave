'use client'

import Link from 'next/link'
import { useCallback, useEffect, useState } from 'react'

import { PlaceLine } from '@/app/meteor-coins/components/PlaceLine'
import { ScoreBoard } from '@/app/meteor-coins/components/ScoreBoard'
import { useScores } from '@/app/meteor-coins/hooks/useScores'
import { type BoardView, fetchBoard } from '@/app/meteor-coins/lib/scoreboard'
import { type StageDef, playableStage } from '@/app/meteor-coins/lib/stages'
import { PALETTE } from '@/app/meteor-coins/scene/palette'
import { NicknameDialog } from '@/components/nickname-dialog'

/**
 * One stage's scores: the listed players, best first, and where the viewer
 * stands. Reachable from the stage map, from a finished run, and from the
 * sign-in redirect, so a player who just signed in lands on their name.
 *
 * Takes over the viewport, so it carries its own cave exit (interaction model 2).
 */
export default function StageScores({ slug }: { slug: string }) {
  const stage = playableStage(slug) as StageDef
  const { user, status, signedUp, setNickname } = useScores()
  const [view, setView] = useState<BoardView | null>(null)
  const [failed, setFailed] = useState(false)
  const [naming, setNaming] = useState(false)
  const [attempt, setAttempt] = useState(0)

  const load = useCallback(async () => {
    const token = user ? await user.getIdToken().catch(() => null) : null
    return fetchBoard(stage.slug, token)
  }, [user, stage.slug])

  // Waits for the account to settle so the board can mark the viewer's row.
  useEffect(() => {
    if (status === 'loading') return
    let cancelled = false
    load().then(next => {
      if (cancelled) return
      setView(next)
      setFailed(next === null)
    })
    return () => {
      cancelled = true
    }
  }, [status, load, attempt])

  const buttonBase =
    'flex min-h-11 w-full items-center justify-center rounded-md px-4 py-3 text-sm font-semibold transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-white motion-reduce:transition-none'

  return (
    <div className="fixed inset-0 z-40 overflow-y-auto bg-ds-background text-white">
      <Link
        href="/"
        aria-label="Return to the cave"
        className="absolute left-2 top-2 z-50 flex min-h-11 min-w-11 items-center justify-center rounded-md px-2 text-sm text-white/60 hover:text-white focus-visible:outline focus-visible:outline-2 focus-visible:outline-white"
      >
        ✕
      </Link>
      <div className="mx-auto flex max-w-md flex-col gap-5 px-4 pb-[max(2rem,env(safe-area-inset-bottom))] pt-16">
        <header className="flex flex-col gap-1 text-center">
          <p className="text-xs uppercase tracking-wide text-white/60">Stage {stage.number}</p>
          <h1 className="text-3xl font-extrabold" style={{ color: PALETTE.puck }}>
            {stage.name}
          </h1>
          <p className="text-sm text-white/70">Scores · {stage.measure.caption}</p>
        </header>

        {view === null && !failed && (
          <p className="text-center text-sm text-white/60" role="status">
            Loading scores…
          </p>
        )}
        {failed && (
          <div className="flex flex-col items-center gap-2 text-center" role="status">
            <p className="text-sm text-white/70">Couldn&apos;t load the scores.</p>
            <button
              type="button"
              onClick={() => {
                setFailed(false)
                setAttempt(a => a + 1)
              }}
              className={`${buttonBase} w-auto border border-white/25 hover:bg-white/10`}
            >
              Try again
            </button>
          </div>
        )}
        {view && (
          <>
            <ScoreBoard stage={stage} view={view} uid={user?.uid ?? null} />
            {view.players > 0 && (
              <p className="text-center text-xs text-white/60">
                {view.players === 1 ? '1 player has' : `${view.players} players have`} scored on
                this stage.
              </p>
            )}
            {view.me && (
              <div className="rounded-lg border border-white/15 bg-white/5 p-3 text-center text-sm text-white/80">
                <p>
                  Your best: <span className="font-bold text-white">{view.me.best}</span>{' '}
                  {stage.measure.caption}.
                </p>
                <PlaceLine
                  stage={stage}
                  placement={view.me}
                  signedUp={signedUp}
                  onPickNickname={() => setNaming(true)}
                  className="mt-1"
                />
              </div>
            )}
          </>
        )}

        <div className="flex flex-col gap-2">
          <Link
            href={`/meteor-coins/${stage.slug}`}
            className={`${buttonBase} bg-ds-primary text-on-primary`}
          >
            Play {stage.name}
          </Link>
          <Link
            href="/meteor-coins"
            className="min-h-11 py-3 text-center text-sm text-white/70 underline-offset-4 hover:underline"
          >
            Stage map
          </Link>
        </div>
      </div>

      {naming && (
        <NicknameDialog
          initialValue=""
          subtitle="Shown on the Meteor Coins scores."
          onClose={() => setNaming(false)}
          onSave={async name => {
            await setNickname(name)
            setAttempt(a => a + 1)
          }}
        />
      )}
    </div>
  )
}
