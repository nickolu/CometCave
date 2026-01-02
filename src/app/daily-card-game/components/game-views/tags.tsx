import { Tag } from '@/app/daily-card-game/components/gameplay/tag'
import { eventEmitter } from '@/app/daily-card-game/domain/events/event-emitter'
import { implementedTags as tags } from '@/app/daily-card-game/domain/tag/tags'
import { initializeTag } from '@/app/daily-card-game/domain/tag/utils'
import { Button } from '@/components/ui/button'

export const TagsView = () => {
  return (
    <div className="flex flex-col items-center mt-10 w-3/4 mx-auto">
      <h1 className="text-2xl font-bold">Tags</h1>
      <div className="flex flex-wrap justify-center gap-2 mt-4 mx-auto">
        {Object.values(tags).map(tag => (
          <Tag key={tag.tagType} tag={initializeTag(tag.tagType)} />
        ))}
      </div>
      <Button
        className="mt-4"
        onClick={() => {
          eventEmitter.emit({ type: 'BACK_TO_MAIN_MENU' })
        }}
      >
        Back to Main Menu
      </Button>
    </div>
  )
}
