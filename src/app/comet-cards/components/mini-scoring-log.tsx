import type { HandResult } from '@/app/comet-cards/domain/game/types'

const handIdToName: Record<string, string> = {
  highCard: 'High Card',
  pair: 'Pair',
  twoPair: 'Two Pair',
  threeOfAKind: 'Three of a Kind',
  straight: 'Straight',
  flush: 'Flush',
  fullHouse: 'Full House',
  fourOfAKind: 'Four of a Kind',
  straightFlush: 'Straight Flush',
  flushHouse: 'Flush House',
  fiveOfAKind: 'Five of a Kind',
  flushFive: 'Flush Five',
}

export function MiniScoringLog({ handResults }: { handResults: HandResult[] }) {
  if (handResults.length === 0) return null

  // Show last 5 hands, most recent first
  const recentHands = [...handResults].reverse().slice(0, 5)

  return (
    <div
      style={{
        fontFamily: 'var(--cc-font-mono)',
        fontSize: 10,
        lineHeight: 1.6,
      }}
    >
      {recentHands.map((hand, i) => (
        <div
          key={i}
          className="flex items-center justify-between gap-2"
          style={{ opacity: i === 0 ? 1 : 0.6 }}
        >
          <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
            {handIdToName[hand.handType] ?? hand.handType}
          </span>
          <span style={{ flexShrink: 0 }}>
            <span style={{ color: 'var(--cc-mint)' }}>{hand.chips}</span>
            <span style={{ opacity: 0.4, margin: '0 2px' }}>×</span>
            <span style={{ color: 'var(--cc-pink)' }}>{hand.mult}</span>
            <span style={{ opacity: 0.4, margin: '0 4px' }}>=</span>
            <span style={{ fontWeight: 600 }}>{hand.score.toLocaleString()}</span>
          </span>
        </div>
      ))}
    </div>
  )
}
