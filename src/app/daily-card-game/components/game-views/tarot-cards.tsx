import { ReferenceView } from '@/app/daily-card-game/components/cosmic/reference-view'
import { TarotCard } from '@/app/daily-card-game/components/gameplay/tarot-card'
import { implementedTarotCards as tarotCards } from '@/app/daily-card-game/domain/consumable/tarot-cards'
import { initializeTarotCard } from '@/app/daily-card-game/domain/consumable/utils'

export const TarotCardsView = () => {
  return (
    <ReferenceView
      eyebrow="Reference"
      title="Tarot Cards"
      description="One-shot effects that mutate your deck or board state. Held in your consumable slots."
    >
      <div className="flex flex-wrap gap-3">
        {Object.values(tarotCards).map(tarotCard => (
          <TarotCard key={tarotCard.tarotType} tarotCard={initializeTarotCard(tarotCard)} />
        ))}
      </div>
    </ReferenceView>
  )
}
