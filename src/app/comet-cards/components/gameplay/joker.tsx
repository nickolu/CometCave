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

export const Joker = ({
  joker,
  isSelected,
  onClick,
}: {
  joker: JokerState
  isSelected?: boolean
  onClick?: (isSelected: boolean, id: string) => void
}) => {
  const def = jokers[joker.jokerId]
  const accent = RARITY_ACCENT[def?.rarity ?? 'common'] ?? 'var(--cc-mint)'
  const multBonus = joker.metadata?.multBonus as number | undefined
  const chipsBonus = joker.metadata?.chipsBonus as number | undefined
  const handSizeBonus = joker.metadata?.handSizeBonus as number | undefined
  const xMult = joker.metadata?.xMult as number | undefined
  const payout = joker.metadata?.payout as number | undefined

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
