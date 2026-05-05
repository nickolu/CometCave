import { pokerHands } from '@/app/comet-cards/domain/hand/hands'
import type { PokerHandState, PokerHandsState } from '@/app/comet-cards/domain/hand/types'

export const Hands = ({ pokerHandsState }: { pokerHandsState: PokerHandsState }) => {
  const visiblePokerHands: PokerHandState[] = Object.values(pokerHandsState).filter(
    hand => !hand.isSecret
  )

  return (
    <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
      {visiblePokerHands.map(hand => {
        const definition = pokerHands[hand.handId]
        const currentHandChips =
          definition.baseChips + definition.chipIncreasePerLevel * (hand.level - 1)
        const currentHandMult =
          definition.baseMult + definition.multIncreasePerLevel * (hand.level - 1)
        return (
          <div
            key={hand.handId}
            className="flex items-center justify-between gap-3 rounded-md p-2.5"
            style={{
              background: 'rgba(255,255,255,0.03)',
              border: '1px solid rgba(94,234,212,0.1)',
            }}
          >
            <div>
              <div style={{ fontWeight: 600, fontSize: 13 }}>{definition.name}</div>
              <div
                style={{
                  fontFamily: 'var(--cc-font-mono)',
                  fontSize: 10,
                  opacity: 0.55,
                  marginTop: 2,
                }}
              >
                Lvl {hand.level} · played {hand.timesPlayed}
              </div>
            </div>
            <div
              style={{
                fontFamily: 'var(--cc-font-mono)',
                fontSize: 12,
              }}
            >
              <span style={{ color: 'var(--cc-mint)' }}>{currentHandChips}</span>
              <span style={{ opacity: 0.4, padding: '0 4px' }}>×</span>
              <span style={{ color: 'var(--cc-pink)' }}>{currentHandMult}</span>
            </div>
          </div>
        )
      })}
    </div>
  )
}
