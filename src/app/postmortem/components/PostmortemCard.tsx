'use client'

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
 */
export function PostmortemCard({
  card,
  keyHint,
  selected = false,
  result,
  footer,
  onClick,
}: {
  card: Card
  /** Number key (1-8) shown in the top-left corner. */
  keyHint?: number
  selected?: boolean
  /** Reveal state mark. */
  result?: CardResult
  /** Custom footer, e.g. lifetime accuracy in the collection. */
  footer?: string
  onClick?: () => void
}) {
  const interactive = !!onClick
  const mark = result && result !== 'neutral' ? RESULT_LABEL[result] : null
  const foot = mark ?? (selected ? 'Picked' : footer)

  const content = (
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
    'data-selected': selected ? 'true' : 'false',
    'data-result': result,
  } as const

  if (!interactive) {
    return (
      <div {...common} role="group" aria-label={`${card.nickname}, ${card.id}`}>
        {content}
      </div>
    )
  }

  return (
    <button
      type="button"
      {...common}
      aria-pressed={selected}
      aria-label={`${card.nickname}, ${card.id}. ${card.officialName}`}
      onClick={onClick}
    >
      {content}
    </button>
  )
}
