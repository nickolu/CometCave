import { ReferenceView } from '@/app/comet-cards/components/cosmic/reference-view'
import { Joker } from '@/app/comet-cards/components/gameplay/joker'
import { defaultGameState } from '@/app/comet-cards/domain/game/default-game-state'
import { jokers } from '@/app/comet-cards/domain/joker/jokers'
import { initializeJoker } from '@/app/comet-cards/domain/joker/utils'

export const JokersView = () => {
  return (
    <ReferenceView
      eyebrow="Reference"
      title="Jokers"
      description="Every joker that can show up in the shop. Effects stack, trigger order matters."
    >
      <div className="flex flex-wrap gap-3">
        {Object.values(jokers).map(joker => (
          <Joker key={joker.id} joker={initializeJoker(joker, defaultGameState)} />
        ))}
      </div>
    </ReferenceView>
  )
}
