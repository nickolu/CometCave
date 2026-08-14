'use client'

/**
 * The game, assembled.
 *
 * Three phases, one component: loading while storage is consulted, creation if
 * there is no story yet, and the table itself. There is no threshold screen —
 * a returning player's campaign *is* the threshold, and making them tap "play"
 * to see a story they were already in the middle of would be re-onboarding a
 * regular (CLAUDE.md principle 3, interaction model 1).
 *
 * The shell stays visible, so this game adds no exit affordance of its own —
 * the cave's own nav is the exit, and a duplicate would be clutter (interaction
 * model 2).
 */
import { useEffect, useState } from 'react'

import { useAuth } from '@/hooks/useAuth'

import { accountBackend, localBackend } from './backend'
import { Composer } from './components/composer'
import { Creation } from './components/creation'
import { ShareButton } from './components/share'
import { Sheet } from './components/sheet'
import { SignInInvite } from './components/sign-in-invite'
import { Transcript } from './components/transcript'
import { useDicebound } from './store'

export function DiceboundGame() {
  const { user, loading: authLoading, configured } = useAuth()
  const { phase, campaign, pending, error, attach, begin, act, abandon, dismissError } =
    useDicebound()

  const [sheetOpen, setSheetOpen] = useState(false)

  /**
   * How much of the transcript was already there when this session started.
   * Entries at or after it may play their arrival animation; everything before
   * it is history being re-read and stays still — a die card should tumble
   * once, on the turn it happened, and never again on a reload.
   */
  const [freshFrom, setFreshFrom] = useState(Number.POSITIVE_INFINITY)

  useEffect(() => {
    if (authLoading) return

    const backend =
      configured && user
        ? accountBackend(() => (user ? user.getIdToken() : Promise.resolve(null)))
        : localBackend

    void attach(backend).then(() => {
      setFreshFrom(useDicebound.getState().campaign?.transcript.length ?? 0)
    })
  }, [authLoading, configured, user, attach])

  if (phase === 'loading') {
    return (
      <p className="py-24 text-center text-body-lg italic text-on-surface-variant">
        The table is being set…
      </p>
    )
  }

  if (phase === 'creating' || !campaign) {
    return <Creation onBegin={begin} pending={pending} error={error} />
  }

  return (
    <div className="flex h-[calc(100dvh-var(--dicebound-chrome,8rem))] gap-0 md:gap-6">
      <div className="flex min-w-0 flex-1 flex-col rounded-ds-sm border-2 border-outline-variant bg-surface-container-low/40">
        <header className="flex items-center justify-between gap-3 border-b-2 border-outline-variant px-4 py-3 md:px-8">
          <div className="min-w-0">
            <h1 className="truncate font-headline text-xl font-extrabold text-on-surface">
              {campaign.title}
            </h1>
            <p className="truncate text-sm text-on-surface-variant">
              {campaign.character.name}
              {campaign.currentStreak > 1 && (
                <span className="ml-2 text-ds-tertiary">{campaign.currentStreak} days deep</span>
              )}
            </p>
          </div>

          <div className="flex shrink-0 items-center gap-2">
            <ShareButton campaign={campaign} />
            <button
              type="button"
              onClick={() => setSheetOpen(open => !open)}
              aria-expanded={sheetOpen}
              aria-controls="dicebound-sheet"
              className="rounded-full border-2 border-outline-variant bg-surface-container px-3 py-2 text-sm text-on-surface-variant hover:border-ds-primary/60 hover:text-on-surface focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ds-primary lg:hidden"
            >
              <span
                className="material-symbols-outlined align-middle text-[20px]"
                aria-hidden="true"
              >
                contract
              </span>
              <span className="sr-only">Character sheet</span>
            </button>
          </div>
        </header>

        <Transcript entries={campaign.transcript} pending={pending} freshFrom={freshFrom} />

        {error && (
          <p
            role="alert"
            className="flex items-center justify-between gap-3 border-t-2 border-ds-error/40 bg-ds-error/10 px-4 py-2 text-sm text-ds-error md:px-8"
          >
            {error}
            <button
              type="button"
              onClick={dismissError}
              className="shrink-0 underline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ds-error"
            >
              Dismiss
            </button>
          </p>
        )}

        <Composer onSend={act} disabled={pending} />
      </div>

      {/* Desktop: the sheet is always there. Mobile: it slides over. */}
      <aside
        id="dicebound-sheet"
        className={`${
          sheetOpen ? 'fixed inset-0 z-50 bg-ds-background' : 'hidden'
        } lg:static lg:z-auto lg:block lg:w-80 lg:shrink-0 lg:rounded-ds-sm lg:border-2 lg:border-outline-variant lg:bg-surface-container-low/40`}
      >
        {sheetOpen && (
          <button
            type="button"
            onClick={() => setSheetOpen(false)}
            className="absolute right-4 top-4 z-10 rounded-full border-2 border-outline-variant bg-surface-container px-3 py-2 text-on-surface lg:hidden"
          >
            <span className="material-symbols-outlined align-middle text-[20px]" aria-hidden="true">
              close
            </span>
            <span className="sr-only">Close character sheet</span>
          </button>
        )}
        <Sheet campaign={campaign} />
        <div className="flex flex-col gap-4 p-5 pt-0">
          {(!configured || user?.isAnonymous) && <SignInInvite streak={campaign.currentStreak} />}
          <button
            type="button"
            onClick={() => {
              if (window.confirm('Leave this story behind? It will not come back.')) void abandon()
            }}
            disabled={pending}
            className="text-sm text-on-surface-variant/70 underline hover:text-ds-error focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ds-error disabled:opacity-50"
          >
            Begin a different story
          </button>
        </div>
      </aside>
    </div>
  )
}
