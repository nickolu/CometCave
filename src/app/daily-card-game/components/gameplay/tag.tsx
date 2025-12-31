import { GameCard } from '@/app/daily-card-game/components/ui/game-card'
import { implementedTags as tags } from '@/app/daily-card-game/domain/tag/tags'
import { TagState } from '@/app/daily-card-game/domain/tag/types'

export const Tag = ({
  tag,
  isSelected,
  onClick,
}: {
  tag: TagState
  isSelected?: boolean
  onClick?: (isSelected: boolean, id: string) => void
}) => {
  const tagDefinition = tags[tag.tagType]
  if (!tagDefinition) {
    return (
      <GameCard>
        <div className={'px-1 h-full '}>
          <div>
            <h3 className="text-sm font-bold">Not Implemented</h3>
            <p className="text-xs text-muted-foreground">This tag has not yet been implemented.</p>
          </div>
        </div>
      </GameCard>
    )
  }
  return (
    <GameCard
      onClick={() => {
        onClick?.(isSelected ?? false, tag.id)
      }}
    >
      <div className={'px-1 h-full '}>
        <div>
          <h3 className="text-sm font-bold">{tagDefinition.name}</h3>
          <p className="text-xs text-muted-foreground">{tagDefinition.benefit}</p>
          <p className="text-xs text-muted-foreground mt-1">
            Min Ante: {tagDefinition.minimumAnte}
          </p>
        </div>
      </div>
    </GameCard>
  )
}
