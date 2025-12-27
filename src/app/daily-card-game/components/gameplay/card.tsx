import { playingCards } from '@/app/daily-card-game/domain/playing-card/playing-cards'
import { PlayingCardState } from '@/app/daily-card-game/domain/playing-card/types'
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

const enchantmentStyles = {
  bonus: 'border-2 border-green-500',
  mult: 'border-2 border-blue-500',
  gold: 'border-2 border-yellow-500',
  glass: 'border-2 border-gray-500',
  lucky: 'border-2 border-purple-500',
  none: '',
}

const FaceUpCard = ({ playingCard }: { playingCard: PlayingCardState }) => {
  return (
    <>
      <div
        className={cn(
          'flex flex-col px-1 h-full',
          cardColors[playingCards[playingCard.playingCardId]?.suit ?? 'hearts'],
          enchantmentStyles[playingCard.flags.enchantment ?? 'none']
        )}
      >
        <div data-name="top-row" className="flex justify-between">
          <div>{playingCards[playingCard.playingCardId]?.value}</div>
          <div>{cardSymbols[playingCards[playingCard.playingCardId].suit]}</div>
        </div>
        <div data-name="image-row" className="flex justify-center grow items-center">
          <div>{cardSymbols[playingCards[playingCard.playingCardId].suit]}</div>
        </div>
        <div data-name="bottom-row" className="flex justify-between">
          <div>{cardSymbols[playingCards[playingCard.playingCardId].suit]}</div>
          <div>{playingCards[playingCard.playingCardId].value}</div>
        </div>
      </div>
    </>
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

export const PlayingCard = ({
  playingCard,
  isSelected,
  onClick,
}: {
  playingCard: PlayingCardState
  isSelected?: boolean
  onClick?: (isSelected: boolean, id: string) => void
}) => {
  return (
    <CardUI
      className={cn(
        isSelected ? 'ring-2 ring-space-purple -mt-2' : '',
        'h-36 w-24 transform transition-all duration-300 cursor-pointer text-xl'
      )}
      onClick={() => {
        onClick?.(isSelected ?? false, playingCard.id)
      }}
    >
      {playingCard.isFaceUp ? <FaceUpCard playingCard={playingCard} /> : <FaceDownCard />}
    </CardUI>
  )
}
