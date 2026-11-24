'use client'

import { ChunkyButton } from '@/components/ui/chunky-button'

import { CARDS, CATEGORIES } from '@/app/postmortem/data/cards'
import { accuracy } from '@/app/postmortem/lib/storage'
import { useStoredData } from '@/app/postmortem/useStoredData'

import { PostmortemCard } from './PostmortemCard'

export function CollectionView({
  onBack,
  backLabel,
  onInfo,
}: {
  onBack: () => void
  backLabel: string
  onInfo: (cardId: string, trigger: HTMLElement) => void
}) {
  const data = useStoredData()

  return (
    <>
      <header className="pm-topbar">
        <h1 className="pm-title">Collection</h1>
        <div className="pm-topbar__spacer" />
        <ChunkyButton variant="utility" size="sm" data-pm-native onClick={onBack}>
          {backLabel}
        </ChunkyButton>
      </header>
      <div className="pm-page">
        <div className="pm-page__inner">
          <p className="pm-acc">Under each card: how often you played it when it was a real factor. Press the i on a card to read about it.</p>
          {CATEGORIES.map(cat => (
            <section key={cat.id} className={`pm-group pm-cat-${cat.id}`}>
              <h2>
                {cat.id}. {cat.name}
              </h2>
              <div className="pm-grid">
                {CARDS.filter(c => c.category === cat.id).map(card => {
                  const stats = data.cardStats[card.id]
                  const acc = accuracy(stats)
                  return (
                    <div key={card.id} className="pm-cell">
                      <PostmortemCard card={card} onInfo={onInfo} />
                      <span className="pm-acc">
                        {acc === null || !stats ? 'Not seen yet' : `${stats.correct} of ${stats.factor} (${Math.round(acc * 100)}%)`}
                      </span>
                    </div>
                  )
                })}
              </div>
            </section>
          ))}
        </div>
      </div>
    </>
  )
}
