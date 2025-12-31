import { SpectralCard } from '@/app/daily-card-game/components/gameplay/spectral-card'
import { eventEmitter } from '@/app/daily-card-game/domain/events/event-emitter'
import { implementedSpectralCards as spectralCards } from '@/app/daily-card-game/domain/spectral/spectal-cards'
import { initializeSpectralCard } from '@/app/daily-card-game/domain/spectral/utils'
import { Button } from '@/components/ui/button'

export const SpectralCardsView = () => {
  return (
    <div className="flex flex-col items-center mt-10 h-screen w-3/4 mx-auto">
      <h1 className="text-2xl font-bold">Spectral Cards</h1>
      <div className="flex flex-wrap justify-center gap-2 mt-4 mx-auto">
        {Object.values(spectralCards).map(spectralCard => (
          <SpectralCard
            key={spectralCard.spectralType}
            spectralCard={initializeSpectralCard(spectralCard)}
          />
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
