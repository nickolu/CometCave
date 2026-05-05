import { ReferenceView } from '@/app/comet-cards/components/cosmic/reference-view'
import { SpectralCard } from '@/app/comet-cards/components/gameplay/spectral-card'
import { implementedSpectralCards as spectralCards } from '@/app/comet-cards/domain/spectral/spectal-cards'
import { initializeSpectralCard } from '@/app/comet-cards/domain/spectral/utils'

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
