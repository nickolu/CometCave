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
