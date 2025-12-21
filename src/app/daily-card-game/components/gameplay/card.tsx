import { eventEmitter } from '@/app/daily-card-game/domain/events/event-emitter'
import { PlayingCard } from '@/app/daily-card-game/domain/playing-card/types'
import { Card as CardUI } from '@/components/ui/card'
import { cn } from '@/lib/utils'

const cardSymbols = {
  hearts: '♥',
  diamonds: '♦',
  clubs: '♣',
  spades: '♠',
}

const cardColors = {
  hearts: 'text-red-500',
  diamonds: 'text-green-500',
  clubs: 'text-black',
  spades: 'text-blue-500',
}

const FaceUpCard = ({ playingCard }: { playingCard: PlayingCard }) => {
  return (
    <div className={'flex flex-col px-1 h-full ' + cardColors[playingCard.suit]}>
      <div data-name="top-row" className="flex justify-between">
        <div>{playingCard.value}</div>
        <div>{cardSymbols[playingCard.suit]}</div>
      </div>
      <div data-name="image-row" className="flex justify-center grow items-center">
        <div>{cardSymbols[playingCard.suit]}</div>
      </div>
      <div data-name="bottom-row" className="flex justify-between">
        <div>{cardSymbols[playingCard.suit]}</div>
        <div>{playingCard.value}</div>
      </div>
    </div>
  )
}

const FaceDownCard = () => {
  return (
    <div className="flex flex-col px-1 h-full bg-space-grey">
      <div data-name="top-row" className="flex justify-between">
        <div>?</div>
      </div>
      <div data-name="image-row" className="flex justify-center grow items-center">
        <div>?</div>
      </div>
    </div>
  )
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
        'h-36 w-24 transform transition-all duration-300 cursor-pointer text-xl'
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
