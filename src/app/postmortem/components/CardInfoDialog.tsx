'use client'

import * as Dialog from '@radix-ui/react-dialog'

import { CARDS_BY_ID, CATEGORIES } from '@/app/postmortem/data/cards'
import { CARD_INFO, CATEGORY_MEANINGS, cardLabel } from '@/app/postmortem/data/card-info'
import { accuracy } from '@/app/postmortem/lib/storage'
import { useStoredData } from '@/app/postmortem/useStoredData'

/**
 * Study notes for one card. Built on Radix Dialog (already a dependency, no
 * shared dialog component exists): it traps focus, closes on Esc, labels the
 * dialog from its title, and we send focus back to the trigger on close.
 */
export function CardInfoDialog({
  cardId,
  trigger,
  onClose,
}: {
  cardId: string | null
  /** The element that opened the dialog. Focus returns here on close. */
  trigger: HTMLElement | null
  onClose: () => void
}) {
  const data = useStoredData()
  const card = cardId ? CARDS_BY_ID[cardId] : undefined
  const info = cardId ? CARD_INFO[cardId] : undefined
  const category = card ? CATEGORIES.find(c => c.id === card.category) : undefined
  const stats = cardId ? data.cardStats[cardId] : undefined
  const acc = accuracy(stats)

  return (
    <Dialog.Root open={!!(card && info)} onOpenChange={open => !open && onClose()}>
      <Dialog.Portal>
        <Dialog.Overlay className="pm-modal__overlay" />
        {card && info && category && (
          <Dialog.Content
            className={`pm-modal pm-root pm-cat-${card.category}`}
            aria-describedby={undefined}
            onCloseAutoFocus={e => {
              if (trigger?.isConnected) {
                e.preventDefault()
                trigger.focus()
              }
            }}
          >
            <div className="pm-modal__head">
              <div>
                <Dialog.Title className="pm-modal__title">{card.nickname}</Dialog.Title>
                <div className="pm-modal__sub">
                  {card.officialName} ({card.id})
                </div>
                <div className="pm-modal__cat">
                  Category {category.id}: {category.name}. {CATEGORY_MEANINGS[category.id]}
                </div>
              </div>
              <Dialog.Close className="pm-modal__close" aria-label="Close">
                ×
              </Dialog.Close>
            </div>

            <div className="pm-modal__body">
              <section>
                <h3>What it means</h3>
                <p>{info.meaning}</p>
              </section>
              <section>
                <h3>Typical situations</h3>
                <ul>
                  {info.situations.map(s => (
                    <li key={s}>{s}</li>
                  ))}
                </ul>
              </section>
              <section>
                <h3>Clues that point to it</h3>
                <ul>
                  {info.clues.map(s => (
                    <li key={s}>{s}</li>
                  ))}
                </ul>
              </section>
              <section>
                <h3>Often confused with</h3>
                <ul>
                  {info.confusedWith.map(c => (
                    <li key={c.id}>
                      <strong>
                        {cardLabel(c.id)} ({c.id}):
                      </strong>{' '}
                      {c.howToTell}
                    </li>
                  ))}
                </ul>
              </section>
              <section>
                <h3>Your record</h3>
                <p>
                  {!stats || stats.factor === 0 || acc === null
                    ? 'Not seen as a factor yet.'
                    : `Found ${stats.correct} of ${stats.factor} times it was a factor (${Math.round(acc * 100)}%). Missed ${stats.missed}. Played when it was not a factor ${stats.wrong}.`}
                </p>
              </section>
              <a className="pm-modal__link" href={info.catalogUrl} target="_blank" rel="noopener noreferrer">
                Read the catalog entry (opens in a new tab)
              </a>
            </div>
          </Dialog.Content>
        )}
      </Dialog.Portal>
    </Dialog.Root>
  )
}
