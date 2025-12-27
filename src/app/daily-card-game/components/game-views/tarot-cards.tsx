import { TarotCard } from '@/app/daily-card-game/components/gameplay/tarot-card'
import { implementedTarotCards as tarotCards } from '@/app/daily-card-game/domain/consumable/tarot-cards'
import { initializeTarotCard } from '@/app/daily-card-game/domain/consumable/utils'
import { eventEmitter } from '@/app/daily-card-game/domain/events/event-emitter'
import { Button } from '@/components/ui/button'

export const TarotCardsView = () => {
  return (
    <div className="flex flex-col items-center mt-10 h-screen w-3/4 mx-auto">
      <h1 className="text-2xl font-bold">Tarot Cards</h1>
      <div className="flex flex-wrap gap-2 mt-4">
        {Object.values(tarotCards).map(tarotCard => (
          <TarotCard key={tarotCard.tarotType} tarotCard={initializeTarotCard(tarotCard)} />
        ))}
      </div>
      <Button
        className="mt-4"
        onClick={() => {
          eventEmitter.emit({ type: 'BACK_TO_MAIN_MENU' })
        }}
      >
        Back to Main Menu
      </Button>
    </div>
  )
}
