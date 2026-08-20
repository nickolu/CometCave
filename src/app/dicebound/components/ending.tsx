'use client'

/**
 * The last screen of a story.
 *
 * This is the run boundary both design docs have been waiting for. Until the
 * track could bottom out there was nowhere to put an end-of-session beat, so
 * there was no ceremony, nothing to share that was a whole thing rather than a
 * moment, and no honest place to ask anyone to sign up. All three land here.
 *
 * **It replaces the composer, and the transcript stays.** That placement is the
 * only real design decision in the file, and the alternative — a full-screen
 * takeover — was rejected because the most important thing on the page is the
 * paragraph in which the character died, and a takeover covers it. The player
 * types in this spot every turn of the game; the last thing that happens is
 * that there is nothing to type there any more, which says it better than a
 * modal would.
 *
 * Voice is the cosmic narrator (CLAUDE.md #4, #7). This is the most emotionally
 * loaded surface the game has and it does not get a default dialog.
 */
import { useEffect, useRef } from 'react'

import { CONDITION_LABEL } from '@/app/dicebound/domain/body'
import type { Campaign } from '@/app/dicebound/domain/campaign'
import { currentPlace, describeClock } from '@/app/dicebound/domain/world'
import { ChunkyButton } from '@/components/ui/chunky-button'

import { ShareButton } from './share'
import { SignInInvite } from './sign-in-invite'

/**
 * The confirmation is not paperwork.
 *
 * A finished story is kept — the campaign is marked ended, never deleted, and
 * that is the whole reason `Ending` is a record rather than a flag inferred
 * from the track. But there is still one campaign per player, so starting
 * another is what finally lets this one go, and the player is told so in the
 * sentence rather than finding out afterwards. The shelf that would make this
 * non-destructive is #3780, and it is deliberately not built yet.
 */
const CONFIRM =
  'Begin a new story? This one stays where it is until you do — starting another lets it go.'

export function Ending({
  campaign,
  onBegin,
  invite,
}: {
  campaign: Campaign
  onBegin: () => void
  /** Whether this player is still anonymous, and so has something to be offered. */
  invite: boolean
}) {
  const headingRef = useRef<HTMLParagraphElement>(null)

  /**
   * Move the reader to the ending once, when it arrives.
   *
   * A screen reader that stays parked in the composer it was in a moment ago
   * is a player who is told nothing at all — the composer is simply gone, which
   * announces as silence. `preventScroll` because the transcript has already
   * scrolled to the death paragraph and dragging the viewport away from it is
   * the one thing this screen must not do.
   */
  useEffect(() => {
    headingRef.current?.focus({ preventScroll: true })
  }, [])

  const where = currentPlace(campaign.world)
  const { stats } = campaign
  const rung = campaign.ending?.condition ?? campaign.body.condition

  const tally = [
    `${stats.turns} ${stats.turns === 1 ? 'turn' : 'turns'}`,
    `${stats.checks} ${stats.checks === 1 ? 'roll' : 'rolls'} of the die`,
    // Zeroes are left off rather than printed. "0 natural twenties" is a line
    // about something that did not happen, and a tally of a finished story
    // should only contain things that did (CLAUDE.md #17, in spirit).
    stats.naturalTwenties > 0
      ? `${stats.naturalTwenties} natural ${stats.naturalTwenties === 1 ? 'twenty' : 'twenties'}`
      : '',
    stats.naturalOnes > 0
      ? `${stats.naturalOnes} natural ${stats.naturalOnes === 1 ? 'one' : 'ones'}`
      : '',
  ].filter(Boolean)

  return (
    <section
      aria-labelledby="dicebound-ending-heading"
      className="dicebound-ending border-t-2 border-ds-error/30 bg-surface-container-low px-4 py-6 md:px-8"
    >
      <div className="mx-auto flex max-w-2xl flex-col gap-5">
        <div>
          <p
            id="dicebound-ending-heading"
            ref={headingRef}
            tabIndex={-1}
            className="font-headline text-headline-md text-on-surface focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-ds-primary"
          >
            Here the telling stops.
          </p>
          <p className="mt-2 text-body-lg text-on-surface-variant">
            {campaign.character.name} came as far as{' '}
            {where ? <span className="text-on-surface">{where.name}</span> : 'this'}, and no
            further. {describeClock(campaign.world.clock)}.
          </p>
        </div>

        <p className="border-l-2 border-ds-error/40 pl-3 font-label text-label-caps uppercase tracking-widest text-on-surface-variant/80">
          {CONDITION_LABEL[rung]}
        </p>

        <p className="text-body-md text-on-surface-variant">{tally.join(' · ')}.</p>

        <p className="text-body-md italic text-on-surface-variant/80">
          The cave keeps what happened here. It does not give it back.
        </p>

        <div className="flex flex-wrap items-center gap-3">
          <ShareButton campaign={campaign} label="Share this story" />
          <ChunkyButton
            variant="exit"
            size="md"
            shape="pill"
            onClick={() => {
              if (window.confirm(CONFIRM)) onBegin()
            }}
          >
            Begin a new story
          </ChunkyButton>
        </div>

        {invite && <SignInInvite streak={campaign.currentStreak} ending />}
      </div>
    </section>
  )
}
