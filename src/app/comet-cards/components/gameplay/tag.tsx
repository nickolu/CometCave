import { TokenCard } from '@/app/comet-cards/components/cosmic/token-card'
import { implementedTags as tags } from '@/app/comet-cards/domain/tag/tags'
import type { TagState } from '@/app/comet-cards/domain/tag/types'

export const Tag = ({
  tag,
  isSelected,
  onClick,
}: {
  tag: TagState
  isSelected?: boolean
  onClick?: (isSelected: boolean, id: string) => void
}) => {
  const def = tags[tag.tagType]
  if (!def) {
    return (
      <TokenCard
        title="Not Implemented"
        description="This tag has not yet been implemented."
        glyph="◉"
        accent="var(--cc-mint)"
        size="sm"
        disabled
      />
    )
  }
  return (
    <TokenCard
      title={def.name}
      description={def.benefit}
      glyph="◉"
      accent="var(--cc-mint)"
      selected={isSelected}
      size="sm"
      footer={
        <div
          className="uppercase"
          style={{
            fontFamily: 'var(--cc-font-mono)',
            fontSize: 9,
            letterSpacing: 1.5,
            opacity: 0.6,
          }}
        >
          Min ante {def.minimumAnte}
        </div>
      }
      onClick={onClick ? () => onClick(isSelected ?? false, tag.id) : undefined}
    />
  )
}
