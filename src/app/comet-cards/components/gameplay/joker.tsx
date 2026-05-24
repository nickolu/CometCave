import type { ReactNode } from 'react'
import { TokenCard } from '@/app/comet-cards/components/cosmic/token-card'
import { jokers } from '@/app/comet-cards/domain/joker/jokers'
import type { JokerState } from '@/app/comet-cards/domain/joker/types'

const RARITY_ACCENT: Record<string, string> = {
  common: 'var(--cc-mint)',
  uncommon: 'var(--cc-rarity-uncommon)',
  rare: 'var(--cc-pink)',
  legendary: 'var(--cc-gold)',
}

const COUNTER_XMULT_DIVISOR: Record<string, number> = {
  vampire: 10,
  hitTheRoad: 2,
  campfire: 4,
  obelisk: 5,
  luckyCat: 4,
  ramen: 100,
}

const IDOL_VALUES = ['2','3','4','5','6','7','8','9','10','J','Q','K','A'] as const
const IDOL_SUITS = ['\u2665','\u2666','\u2663','\u2660'] as const
const IDOL_SUIT_COLORS: Record<string, string> = { '\u2665': 'var(--cc-pink)', '\u2666': 'var(--cc-pink)', '\u2663': 'var(--cc-text-default)', '\u2660': 'var(--cc-text-default)' }

const TRIGGERED_JOKERS = new Set(['photograph', 'hangingChad', 'burntJoker', 'tradingCard'])

const POKER_HAND_LABELS = [
  'High Card', 'Pair', 'Two Pair', '3 of a Kind', 'Straight',
  'Flush', 'Full House', '4 of a Kind', 'Str. Flush', 'Flush House',
  '5 of a Kind', 'Flush Five',
] as const

export const Joker = ({
  joker,
  isSelected,
  onClick,
  ownedCardCount,
}: {
  joker: JokerState
  isSelected?: boolean
  onClick?: (isSelected: boolean, id: string) => void
  ownedCardCount?: number
}) => {
  const def = jokers[joker.jokerId]
  const accent = RARITY_ACCENT[def?.rarity ?? 'common'] ?? 'var(--cc-mint)'
  const multBonus = joker.metadata?.multBonus as number | undefined
  const chipsBonus = joker.metadata?.chipsBonus as number | undefined
  const handSizeBonus = joker.metadata?.handSizeBonus as number | undefined
  const xMult = joker.metadata?.xMult as number | undefined
  const payout = joker.metadata?.payout as number | undefined

  const xMultDivisor = COUNTER_XMULT_DIVISOR[joker.jokerId]

  let badge: ReactNode = undefined
  if (multBonus != null && multBonus > 0) {
    badge = (
      <span style={{ fontSize: 11, fontWeight: 700, color: 'var(--cc-pink)' }}>
        +{multBonus}
      </span>
    )
  } else if (chipsBonus != null && chipsBonus > 0) {
    badge = (
      <span style={{ fontSize: 11, fontWeight: 700, color: 'var(--cc-mint)' }}>
        +{chipsBonus}
      </span>
    )
  } else if (handSizeBonus != null && handSizeBonus > 0) {
    badge = (
      <span style={{ fontSize: 11, fontWeight: 700, color: 'var(--cc-gold)' }}>
        +{handSizeBonus}
      </span>
    )
  } else if (joker.jokerId === 'yorick') {
    const yXMult = (xMult ?? 100) / 100
    const countdown = joker.counter || 23
    badge = yXMult > 1 ? (
      <span style={{ fontSize: 11, fontWeight: 700, color: 'var(--cc-pink)' }}>
        ×{yXMult % 1 === 0 ? yXMult.toString() : yXMult.toFixed(1)} <span style={{ opacity: 0.7 }}>⌛{countdown}</span>
      </span>
    ) : (
      <span style={{ fontSize: 11, fontWeight: 700, color: 'var(--cc-text-default)', opacity: 0.7 }}>
        ⌛{countdown}
      </span>
    )
  } else if (xMult != null && xMult > 100) {
    badge = (
      <span style={{ fontSize: 11, fontWeight: 700, color: 'var(--cc-pink)' }}>
        ×{(xMult / 100).toFixed(xMult % 100 === 0 ? 0 : 2)}
      </span>
    )
  } else if (payout != null && payout > 0) {
    badge = (
      <span style={{ fontSize: 11, fontWeight: 700, color: 'var(--cc-gold)' }}>
        ${payout}
      </span>
    )
  } else if (xMultDivisor != null && joker.counter > 0) {
    const computed = joker.counter / xMultDivisor
    if (computed > 1) {
      badge = (
        <span style={{ fontSize: 11, fontWeight: 700, color: 'var(--cc-pink)' }}>
          ×{computed % 1 === 0 ? computed.toString() : computed.toFixed(1)}
        </span>
      )
    }
  } else if (joker.jokerId === 'iceCream' && joker.counter > 0) {
    badge = (
      <span style={{ fontSize: 11, fontWeight: 700, color: 'var(--cc-mint)' }}>
        +{joker.counter}
      </span>
    )
  } else if (joker.jokerId === 'popcorn' && joker.counter > 0) {
    badge = (
      <span style={{ fontSize: 11, fontWeight: 700, color: 'var(--cc-pink)' }}>
        +{joker.counter}
      </span>
    )
  } else if (joker.jokerId === 'theIdol') {
    const valueIdx = Math.floor(joker.counter / 4)
    const suitIdx = joker.counter % 4
    const value = IDOL_VALUES[valueIdx] ?? '?'
    const suit = IDOL_SUITS[suitIdx] ?? '?'
    const suitColor = IDOL_SUIT_COLORS[suit] ?? 'var(--cc-text-default)'
    badge = (
      <span style={{ fontSize: 11, fontWeight: 700, color: suitColor }}>
        {value}{suit}
      </span>
    )
  } else if (joker.jokerId === 'toDoList') {
    const handLabel = POKER_HAND_LABELS[joker.counter] ?? '?'
    badge = (
      <span style={{ fontSize: 10, fontWeight: 700, color: 'var(--cc-gold)' }}>
        {handLabel}
      </span>
    )
  } else if (joker.jokerId === 'vagabond') {
    badge = (
      <span style={{ fontSize: 11, fontWeight: 700, color: 'var(--cc-gold)' }}>
        ≤$4
      </span>
    )
  } else if (TRIGGERED_JOKERS.has(joker.jokerId)) {
    badge = joker.counter === 1 ? (
      <span style={{ fontSize: 11, fontWeight: 700, color: 'var(--cc-mint)', opacity: 0.7 }}>
        ✓
      </span>
    ) : (
      <span style={{ fontSize: 11, fontWeight: 700, color: 'var(--cc-text-default)', opacity: 0.5 }}>
        ○
      </span>
    )
  } else if (joker.jokerId === 'hologram' && ownedCardCount != null && joker.counter > 0) {
    const cardsAdded = Math.max(0, ownedCardCount - joker.counter)
    const holoXMult = 1 + cardsAdded * 0.25
    badge = holoXMult > 1 ? (
      <span style={{ fontSize: 11, fontWeight: 700, color: 'var(--cc-pink)' }}>
        ×{holoXMult % 1 === 0 ? holoXMult.toString() : holoXMult.toFixed(2)}
      </span>
    ) : (
      <span style={{ fontSize: 11, fontWeight: 700, color: 'var(--cc-text-default)', opacity: 0.7 }}>
        ×1
      </span>
    )
  } else if (joker.jokerId === 'invisibleJoker') {
    badge = (
      <span style={{ fontSize: 11, fontWeight: 700, color: 'var(--cc-text-default)', opacity: 0.7 }}>
        {joker.counter}/2
      </span>
    )
  } else if (joker.counter > 0) {
    badge = (
      <span style={{ fontSize: 11, fontWeight: 700, color: 'var(--cc-text-default)', opacity: 0.7 }}>
        {joker.counter}
      </span>
    )
  }

  return (
    <TokenCard
      title={def?.name ?? 'Unknown'}
      description={def?.description}
      glyph="✺"
      accent={accent}
      selected={isSelected}
      size="sm"
      badge={badge}
      typeLabel="Joker"
      onClick={onClick ? () => onClick(isSelected ?? false, joker.id) : undefined}
    />
  )
}
