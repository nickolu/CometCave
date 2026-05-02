import { ReferenceView } from '@/app/daily-card-game/components/cosmic/reference-view'
import { Tag } from '@/app/daily-card-game/components/gameplay/tag'
import { implementedTags as tags } from '@/app/daily-card-game/domain/tag/tags'
import { initializeTag } from '@/app/daily-card-game/domain/tag/utils'

export const TagsView = () => {
  return (
    <ReferenceView
      eyebrow="Reference"
      title="Tags"
      description="Earn a tag by skipping a blind. Tags fire when you next reach the shop or boss."
    >
      <div className="flex flex-wrap gap-3">
        {Object.values(tags).map(tag => (
          <Tag key={tag.tagType} tag={initializeTag(tag.tagType)} />
        ))}
      </div>
    </ReferenceView>
  )
}
