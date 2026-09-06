'use client'

import Link from 'next/link'
import { useState } from 'react'

import { useClustersGame } from '@/app/clusters/hooks/useClustersGame'
import { useClustersUser } from '@/app/clusters/hooks/useClustersUser'
import { ROUTE_CONSTANTS } from '@/app/route-constants'
import { NicknameDialog } from '@/components/nickname-dialog'
import { ChunkyButton } from '@/components/ui/chunky-button'
import { ChunkyCard, ChunkyCardContent } from '@/components/ui/chunky-card'
import { displayedStreak } from '@/lib/clusters/profile'
import { formatDisplayDate } from '@/lib/dates'

import { ClustersBoard } from './ClustersBoard'
import { ClustersControls } from './ClustersControls'
import { ClustersResults } from './ClustersResults'
import { MistakeDots } from './MistakeDots'
import { SolvedGroupBanner } from './SolvedGroupBanner'

export function ClustersGameView({ date, today }: { date?: string; today: string }) {
  const game = useClustersGame(date)
  const user = useClustersUser()
  const [started, setStarted] = useState(false)
  const [nameDialogOpen, setNameDialogOpen] = useState(false)

  const finished = game.status !== 'in_progress'
  const inProgress = game.guesses.length > 0 && !finished

  // The threshold is for arriving fresh. A run already under way, or a
  // finished one, skips straight to its own state (interaction models 1, 5).
  const showThreshold = !started && !inProgress && !finished

  if (game.phase === 'loading' || user.loading) {
    return <Notice title="Loading today's puzzle…" />
  }

  if (game.phase === 'missing') {
    return (
      <Notice
        title="No puzzle for this day."
        body="Nothing was published for that date."
        action={{ label: 'Back to today', href: ROUTE_CONSTANTS.CLUSTERS }}
      />
    )
  }

  if (game.phase === 'error') {
    return (
      <Notice
        title="Something went wrong."
        body={game.error ?? 'The puzzle could not be loaded.'}
        onRetry={game.reload}
      />
    )
  }

  const streak = displayedStreak(user.profile, today)

  return (
    <div className="mx-auto flex w-full max-w-lg flex-col gap-5 py-6">
      <header className="flex items-baseline justify-between gap-3">
        <div>
          <h1 className="font-headline text-2xl font-extrabold text-on-surface">Clusters</h1>
          <p className="text-xs text-on-surface-variant">
            #{game.puzzleNumber} · {formatDisplayDate(game.date)}
          </p>
        </div>
        <p className="text-right text-xs text-on-surface-variant">
          <span className="block font-headline text-lg font-extrabold tabular-nums text-ds-tertiary">
            {streak}
          </span>
          day streak
        </p>
      </header>

      {/* Every state change the board shows in motion is also said here. */}
      <p aria-live="polite" role="status" className="sr-only">
        {game.announcement}
      </p>

      {showThreshold ? (
        <Threshold
          needsNickname={user.needsNickname}
          onChooseName={() => setNameDialogOpen(true)}
          onPlay={() => setStarted(true)}
        />
      ) : finished ? (
        <ClustersResults
          sourceDate={game.sourceDate}
          puzzleNumber={game.puzzleNumber}
          status={game.status}
          mistakes={game.mistakes}
          guesses={game.guesses}
          groups={game.solved}
          solution={game.solution ?? game.solved}
          profile={game.finishedProfile ?? user.profile}
          today={today}
          isAnonymous={user.isAnonymous}
          editor={game.editor}
        />
      ) : (
        <>
          {game.solved.length > 0 && (
            <div className="flex flex-col gap-2">
              {game.solved.map((group, i) => (
                <SolvedGroupBanner
                  key={group.tier}
                  group={group}
                  celebrate={i === 0 && group.tier === 'purple'}
                />
              ))}
            </div>
          )}

          <ClustersBoard
            words={game.board}
            selection={game.selection}
            onToggle={game.toggle}
            disabled={game.submitting}
            shakeKey={
              game.flash && (game.flash.kind === 'wrong' || game.flash.kind === 'one-away')
                ? game.flash.id
                : 0
            }
          />

          {game.flash?.kind === 'one-away' && (
            <p className="text-center font-label text-sm uppercase tracking-[0.14em] text-ds-tertiary">
              One away
            </p>
          )}
          {game.flash?.kind === 'duplicate' && (
            <p className="text-center text-sm text-on-surface-variant">
              You already tried that group.
            </p>
          )}

          <div className="flex justify-center">
            <MistakeDots mistakes={game.mistakes} />
          </div>

          <ClustersControls
            selectionCount={game.selection.length}
            canSubmit={game.canSubmit}
            submitting={game.submitting}
            onShuffle={game.shuffle}
            onDeselectAll={game.deselectAll}
            onSubmit={game.submit}
          />

          {game.error && (
            <p className="text-center text-sm text-ds-error">{game.error}</p>
          )}
        </>
      )}

      {nameDialogOpen && (
        <NicknameDialog
          initialValue={user.nickname}
          title="Pick a name"
          subtitle="No password needed. It's how your streak and stats are kept."
          onClose={() => setNameDialogOpen(false)}
          onSave={user.setNickname}
        />
      )}
    </div>
  )
}

function Threshold({
  needsNickname,
  onChooseName,
  onPlay,
}: {
  needsNickname: boolean
  onChooseName: () => void
  onPlay: () => void
}) {
  return (
    <ChunkyCard variant="surface-container">
      <ChunkyCardContent className="flex flex-col items-center gap-4 py-8 text-center">
        <p className="max-w-xs text-body-lg text-on-surface-variant">
          Sixteen words hide four groups of four. Find them all before four mistakes.
        </p>
        {needsNickname ? (
          <ChunkyButton variant="primary" size="hero" onClick={onChooseName}>
            Pick a name to play
          </ChunkyButton>
        ) : (
          <ChunkyButton variant="primary" size="hero" onClick={onPlay}>
            Play today&apos;s puzzle
          </ChunkyButton>
        )}
        <Link
          href={`${ROUTE_CONSTANTS.CLUSTERS}/calendar`}
          className="text-sm text-ds-tertiary underline-offset-4 hover:underline"
        >
          Past puzzles
        </Link>
      </ChunkyCardContent>
    </ChunkyCard>
  )
}

function Notice({
  title,
  body,
  action,
  onRetry,
}: {
  title: string
  body?: string
  action?: { label: string; href: string }
  onRetry?: () => void
}) {
  return (
    <div className="mx-auto flex w-full max-w-lg flex-col items-center gap-3 py-16 text-center">
      <h1 className="font-headline text-xl font-bold text-on-surface">{title}</h1>
      {body && <p className="text-sm text-on-surface-variant">{body}</p>}
      {onRetry && (
        <ChunkyButton variant="primary" onClick={onRetry}>
          Try again
        </ChunkyButton>
      )}
      {action && (
        <Link href={action.href}>
          <ChunkyButton variant="secondary">{action.label}</ChunkyButton>
        </Link>
      )}
    </div>
  )
}
