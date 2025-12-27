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
      {visiblePokerHands.map(hand => {
        const currentHandChips =
          pokerHands[hand.handId].baseChips +
          pokerHands[hand.handId].chipIncreasePerLevel * (hand.level - 1)
        const currentHandMult =
          pokerHands[hand.handId].baseMult +
          pokerHands[hand.handId].multIncreasePerLevel * (hand.level - 1)
        return (
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
              <p>{`${currentHandChips} x ${currentHandMult}`}</p>
            </div>
            <div className="col-span-1">
              <p>{hand.timesPlayed}</p>
            </div>
          </div>
        )
      })}
    </div>
  )
}
