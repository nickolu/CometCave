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
  return (
    <TokenCard
      title={def?.name ?? 'Unknown'}
      description={def?.description}
      glyph="✺"
      accent={accent}
      selected={isSelected}
      size="sm"
      onClick={onClick ? () => onClick(isSelected ?? false, joker.id) : undefined}
    />
  )
}
