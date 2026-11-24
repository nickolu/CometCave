'use client'

import { useEffect, useRef } from 'react'

import type { Card } from '@/app/postmortem/data/cards'
import type { CardResult } from '@/app/postmortem/lib/rules'

const RESULT_LABEL: Record<Exclude<CardResult, 'neutral'>, string> = {
  correct: '✓ Correct',
  wrong: '✕ Wrong',
  missed: 'Missed',
}

/**
 * A portrait (5:7) card. Frame color comes from the category via the
 * --pm-cat-* variables in postmortem.css. Frame, sheen and inner border are
 * adapted from Comet Cards' TokenCard.
 *
 * The "i" button is a sibling of the card button (not nested in it), so it can
 * never select or play the card.
 */
export function PostmortemCard({
  card,
  keyHint,
  armed = false,
  played = false,
  eliminated = false,
  result,
  footer,
  onClick,
  onInfo,
}: {
  card: Card
  /** Number key (1-8) shown in the top-left corner. */
  keyHint?: number
  /** Selected, waiting for Lock in. */
  armed?: boolean
  /** Locked in and face-down. Pass `result` once the case is closed to flip it. */
  played?: boolean
  /** Removed by Eliminate: greyed out and not playable. */
  eliminated?: boolean
  /** Reveal state mark. */
  result?: CardResult
  /** Custom footer, e.g. lifetime accuracy in the collection. */
  footer?: string
  onClick?: () => void
  /** Opens the info modal. Receives the button so focus can return to it. */
  onInfo?: (cardId: string, trigger: HTMLElement) => void
}) {
  const wrapRef = useRef<HTMLDivElement>(null)
  // On phones the hand is a horizontal scroll row: keep a card chosen with a number key in view.
  useEffect(() => {
    if (armed && window.matchMedia?.('(max-width: 767px)').matches) {
      wrapRef.current?.scrollIntoView?.({ block: 'nearest', inline: 'nearest' })
    }
  }, [armed])

  const faceDown = played && !result
  const playable = !!onClick && !played && !eliminated
  const mark = result && result !== 'neutral' ? RESULT_LABEL[result] : null
  const foot = mark ?? (eliminated ? 'Eliminated' : faceDown ? 'Played' : armed ? 'Selected' : footer)

  const content = faceDown ? (
    <div className="pm-card__back" aria-hidden>
      {keyHint !== undefined && <span className="pm-card__key">{keyHint}</span>}
      <span className="pm-card__lock">Locked</span>
      <span className="pm-card__foot">{foot}</span>
    </div>
  ) : (
    <>
      <div className="pm-card__top">
        {keyHint !== undefined ? <span className="pm-card__key" aria-hidden>{keyHint}</span> : <span />}
        <span>{card.id}</span>
      </div>
      <p className="pm-card__nickname">{card.nickname}</p>
      <div className="pm-card__rule" aria-hidden />
      <p className="pm-card__body">{card.officialName}</p>
      <div className="pm-card__foot">{foot}</div>
    </>
  )

  const common = {
    className: `pm-card pm-cat-${card.category}`,
    'data-armed': armed ? 'true' : 'false',
    'data-facedown': faceDown ? 'true' : 'false',
    'data-eliminated': eliminated ? 'true' : 'false',
    'data-result': result,
  } as const

  const state = eliminated ? 'eliminated' : faceDown ? 'played, face down' : armed ? 'selected' : ''
  const label = `${card.nickname}, ${card.id}. ${card.officialName}${state ? `. ${state}` : ''}`

  return (
    <div ref={wrapRef} className={`pm-cardwrap pm-cat-${card.category}`} data-armed={armed ? 'true' : 'false'} data-playable={playable ? 'true' : 'false'}>
      {onClick ? (
        <button type="button" {...common} disabled={!playable} aria-pressed={armed} aria-label={label} onClick={onClick}>
          {content}
        </button>
      ) : (
        <div {...common} role="group" aria-label={label}>
          {content}
        </div>
      )}
      {onInfo && (
        <button
          type="button"
          className="pm-card__info"
          data-pm-native
          aria-label={`About ${card.nickname} (${card.id})`}
          onClick={e => onInfo(card.id, e.currentTarget)}
        >
          i
        </button>
      )}
    </div>
  )
}
