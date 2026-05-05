import { ReferenceView } from '@/app/comet-cards/components/cosmic/reference-view'
import { CelestialCard } from '@/app/comet-cards/components/gameplay/celestial-card'
import { celestialCards } from '@/app/comet-cards/domain/consumable/celestial-cards'
import { initializeCelestialCard } from '@/app/comet-cards/domain/consumable/utils'

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
