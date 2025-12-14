import { PlayingCard } from '@/app/daily-card-game/domain/playing-card/types'
import { Card as CardUI } from '@/components/ui/card'
import { eventEmitter } from '../../domain/events/event-emitter'
import { cn } from '@/lib/utils'

const FaceUpCard = ({ playingCard }: { playingCard: PlayingCard }) => {
  return (
    <>
      {playingCard.value}
      {playingCard.suit}
      {playingCard.isHolographic && <div>Holographic</div>}
      {playingCard.isFoil && <div>Foil</div>}
      {playingCard.modifier && <div>{playingCard.modifier}</div>}
    </>
  )
}

const FaceDownCard = () => {
  return <>Face Down Card</>
}

export const Card = ({
  playingCard,
  handIndex,
  isSelected,
}: {
  playingCard: PlayingCard
  handIndex?: number
  isSelected?: boolean
}) => {
  return (
    <CardUI
      className={cn(
        isSelected ? 'ring-2 ring-space-purple -mt-2' : '',
        'w-16 h-24 transform transition-all duration-300 cursor-pointer'
      )}
      onClick={() => {
        if (handIndex !== undefined) {
          if (isSelected) {
            eventEmitter.emit({ type: 'CARD_DESELECTED', id: playingCard.id })
          } else {
            eventEmitter.emit({ type: 'CARD_SELECTED', id: playingCard.id })
          }
        }
      }}
    >
      {playingCard.faceUp ? <FaceUpCard playingCard={playingCard} /> : <FaceDownCard />}
    </CardUI>
  )
}
