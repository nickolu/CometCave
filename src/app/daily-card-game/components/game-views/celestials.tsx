import { ReferenceView } from '@/app/daily-card-game/components/cosmic/reference-view'
import { CelestialCard } from '@/app/daily-card-game/components/gameplay/celestial-card'
import { celestialCards } from '@/app/daily-card-game/domain/consumable/celestial-cards'
import { initializeCelestialCard } from '@/app/daily-card-game/domain/consumable/utils'

export const CelestialsView = () => {
  return (
    <ReferenceView
      eyebrow="Reference"
      title="Celestial Cards"
      description="Level up a specific poker hand. Stacks across uses."
    >
      <div className="flex flex-wrap gap-3">
        {Object.values(celestialCards).map(celestialCard => (
          <CelestialCard
            key={celestialCard.handId}
            celestialCard={initializeCelestialCard(celestialCard)}
          />
        ))}
      </div>
    </ReferenceView>
  )
}
