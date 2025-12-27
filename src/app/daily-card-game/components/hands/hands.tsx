import { pokerHands } from '@/app/daily-card-game/domain/hand/hands'
import type { PokerHandState, PokerHandsState } from '@/app/daily-card-game/domain/hand/types'

export const Hands = ({ pokerHandsState }: { pokerHandsState: PokerHandsState }) => {
  const visiblePokerHands: PokerHandState[] = Object.values(pokerHandsState).filter(
    hand => !hand.isSecret
  )

  return (
    <div>
      <div className="grid grid-cols-4 gap-2">
        <div className="col-span-1">
          <p>Name</p>
        </div>
        <div className="col-span-1">
          <p>Level</p>
        </div>
        <div className="col-span-1">
          <p>Chips x Mult</p>
        </div>
        <div className="col-span-1">
          <p>Times Played</p>
        </div>
      </div>
      {visiblePokerHands.map(hand => (
        <div key={hand.handId} className="grid grid-cols-4 gap-2">
          <div className="col-span-1">
            <p>
              <strong>{pokerHands[hand.handId].name}</strong>
            </p>
          </div>
          <div className="col-span-1">
            <p>{hand.level}</p>
          </div>
          <div className="col-span-1">
            <p>{`${pokerHands[hand.handId].baseChips} x ${pokerHands[hand.handId].baseMult}`}</p>
          </div>
          <div className="col-span-1">
            <p>{hand.timesPlayed}</p>
          </div>
        </div>
      ))}
    </div>
  )
}
