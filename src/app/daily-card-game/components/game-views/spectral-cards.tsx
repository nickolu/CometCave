import { ReferenceView } from '@/app/daily-card-game/components/cosmic/reference-view'
import { SpectralCard } from '@/app/daily-card-game/components/gameplay/spectral-card'
import { implementedSpectralCards as spectralCards } from '@/app/daily-card-game/domain/spectral/spectal-cards'
import { initializeSpectralCard } from '@/app/daily-card-game/domain/spectral/utils'

export const SpectralCardsView = () => {
  return (
    <ReferenceView
      eyebrow="Reference"
      title="Spectral Cards"
      description="Volatile, powerful effects. Most carry a downside — read carefully."
    >
      <div className="flex flex-wrap gap-3">
        {Object.values(spectralCards).map(spectralCard => (
          <SpectralCard
            key={spectralCard.spectralType}
            spectralCard={initializeSpectralCard(spectralCard)}
          />
        ))}
      </div>
    </ReferenceView>
  )
}
