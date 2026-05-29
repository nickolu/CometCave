'use client'

import { useState } from 'react'
import type { HandResult, ScoringEvent } from '@/app/comet-cards/domain/game/types'

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

function ScoringEventRow({ event, isLast }: { event: ScoringEvent; isLast: boolean }) {
  const prefix = isLast ? '└' : '├'
  const isChips = event.type === 'chips'
  const operator = event.operator ?? '+'
  const color = isChips ? 'var(--cc-mint)' : 'var(--cc-pink)'

  return (
    <div
      className="flex items-center justify-between gap-2"
      style={{ fontSize: 9, opacity: 0.85, paddingLeft: 8 }}
    >
      <span style={{ fontFamily: 'var(--cc-font-mono)', color: 'rgba(255,255,255,0.4)', flexShrink: 0 }}>
        {prefix}
      </span>
      <span
        style={{
          fontFamily: 'var(--cc-font-mono)',
          overflow: 'hidden',
          textOverflow: 'ellipsis',
          whiteSpace: 'nowrap',
          flex: 1,
          marginLeft: 4,
        }}
      >
        {event.source}
      </span>
      <span style={{ flexShrink: 0, fontFamily: 'var(--cc-font-mono)', color }}>
        {operator}{event.value} {event.type}
      </span>
    </div>
  )
}

export function MiniScoringLog({ handResults }: { handResults: HandResult[] }) {
  const [expandedIndex, setExpandedIndex] = useState<number | null>(null)

  if (handResults.length === 0) return null

  // Show all hands, most recent first
  const allHands = [...handResults].reverse()

  return (
    <div
      style={{
        fontFamily: 'var(--cc-font-mono)',
        fontSize: 10,
        lineHeight: 1.6,
        maxHeight: 200,
        overflowY: 'auto',
        scrollbarWidth: 'thin',
      }}
    >
      {allHands.map((hand, i) => {
        const isExpanded = expandedIndex === i
        const hasEvents = hand.scoringEventLog && hand.scoringEventLog.length > 0

        return (
          <div key={i}>
            <div
              className="flex items-center justify-between gap-2"
              style={{
                opacity: i === 0 ? 1 : 0.6,
                cursor: hasEvents ? 'pointer' : 'default',
              }}
              onClick={() => {
                if (!hasEvents) return
                setExpandedIndex(isExpanded ? null : i)
              }}
            >
              <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', flex: 1 }}>
                {hasEvents && (
                  <span style={{ opacity: 0.4, marginRight: 4, fontSize: 8 }}>
                    {isExpanded ? '▾' : '▸'}
                  </span>
                )}
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
            {isExpanded && hasEvents && (
              <div style={{ marginBottom: 2 }}>
                {hand.scoringEventLog.map((event, ei) => (
                  <ScoringEventRow
                    key={event.id}
                    event={event}
                    isLast={ei === hand.scoringEventLog.length - 1}
                  />
                ))}
              </div>
            )}
          </div>
        )
      })}
    </div>
  )
}
