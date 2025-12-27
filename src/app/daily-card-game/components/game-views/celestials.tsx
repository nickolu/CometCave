import { CelestialCard } from '@/app/daily-card-game/components/gameplay/celestial-card'
import { celestialCards } from '@/app/daily-card-game/domain/consumable/celestial-cards'
import { initializeCelestialCard } from '@/app/daily-card-game/domain/consumable/utils'
import { eventEmitter } from '@/app/daily-card-game/domain/events/event-emitter'
import { Button } from '@/components/ui/button'

export const CelestialsView = () => {
  return (
    <div className="flex flex-col items-center mt-10 h-screen w-3/4 mx-auto">
      <h1 className="text-2xl font-bold">Celestials</h1>
      <div className="flex flex-wrap justify-center gap-2 mt-4 mx-auto">
        {Object.values(celestialCards).map(celestialCard => (
          <CelestialCard
            key={celestialCard.handId}
            celestialCard={initializeCelestialCard(celestialCard)}
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
