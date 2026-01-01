import { GameCard } from '@/app/daily-card-game/components/ui/game-card'
import { playingCards } from '@/app/daily-card-game/domain/playing-card/playing-cards'
import { PlayingCardFlags, PlayingCardState } from '@/app/daily-card-game/domain/playing-card/types'
import { cn } from '@/lib/utils'

const suitSymbols = {
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

const enchantmentStyles: Record<PlayingCardFlags['enchantment'], string> = {
  bonus: 'bg-blue-500',
  mult: 'bg-red-500',
  gold: 'bg-space-gold',
  glass: 'bg-gradient-to-br from-cream-white to-transparent',
  lucky: 'bg-green-500',
  steel: 'bg-space-grey',
  stone: 'bg-grey-500',
  wild: 'bg-white',
  none: 'bg-white',
}

const sealStyles: Record<PlayingCardFlags['seal'], string> = {
  blue: 'bg-blue-500',
  purple: 'bg-purple-500',
  gold: 'bg-space-gold',
  red: 'bg-red-500',
  none: 'bg-white',
}
const FaceUpCard = ({ playingCard }: { playingCard: PlayingCardState }) => {
  if (playingCard.flags.enchantment !== 'none') {
    console.log('playingCard', playingCard)
  }
  const suit =
    playingCard.flags.enchantment === 'wild'
      ? 'X'
      : suitSymbols[playingCards[playingCard.playingCardId]?.suit ?? 'hearts']

  return (
    <>
      <div
        className={cn(
          'flex flex-col px-1 h-full rounded-xl',
          cardColors[playingCards[playingCard.playingCardId]?.suit ?? 'hearts'],
          enchantmentStyles[playingCard.flags.enchantment ?? 'none']
        )}
      >
        {playingCard.flags.seal !== 'none' && (
          <div
            data-name="seal-row"
            className={cn(
              'absolute top-8 right-2 rounded-full w-6 h-6 shadow-xl',
              sealStyles[playingCard.flags.seal]
            )}
          ></div>
        )}
        <div data-name="top-row" className="flex justify-between">
          <div>{playingCards[playingCard.playingCardId]?.value}</div>
          <div className="text-2xl">{suit}</div>
        </div>
        <div data-name="image-row" className="flex justify-center grow items-center">
          <div className="text-2xl">{suit}</div>
        </div>
        <div data-name="bottom-row" className="flex justify-between">
          <div className="text-2xl">{suit}</div>
          <div>{playingCards[playingCard.playingCardId].value}</div>
        </div>
        {playingCard.flags.edition !== 'normal' && (
          <div
            data-name="edition-row"
            className="flex justify-center bg-cream-white -mx-1 rounded-b-xl"
          >
            <div className="text-xs">{playingCard.flags.edition}</div>
          </div>
        )}
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
    <GameCard
      isSelected={isSelected}
      className="bg-transparent"
      onClick={() => {
        onClick?.(isSelected ?? false, playingCard.id)
      }}
    >
      {playingCard.isFaceUp ? <FaceUpCard playingCard={playingCard} /> : <FaceDownCard />}
    </GameCard>
  )
}
