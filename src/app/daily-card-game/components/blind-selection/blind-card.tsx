import { DollarSigns } from '@/app/daily-card-game/components/global/dollar-signs'
import { eventEmitter } from '@/app/daily-card-game/domain/events/event-emitter'
import { implementedTags as tags } from '@/app/daily-card-game/domain/tag/tags'
import type { TagType } from '@/app/daily-card-game/domain/tag/types'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'

export function BlindCard({
  name,
  description,
  reward,
  minimumScore,
  disabled,
  selectEventName,
  tag,
}: {
  name: string
  description?: string
  reward: number
  minimumScore?: bigint
  disabled: boolean
  selectEventName: 'SMALL_BLIND_SELECTED' | 'BIG_BLIND_SELECTED' | 'BOSS_BLIND_SELECTED'
  tag?: TagType
}) {
  return (
    <Card className="bg-space-grey border-space-purple p-4 text-cream-white h-63 w-1/3 flex flex-col justify-between text-center">
      <div className="flex flex-col gap-2 h-full">
        <h3 className="text-xl font-bold">{name}</h3>
        {description && <p className="text-sm text-cream-white/50">{description}</p>}
        <p>
          Reward: <DollarSigns count={reward} />
        </p>
      </div>

      <div className="flex flex-col gap-2 justify-start h-full mt-7">
        {minimumScore !== undefined && <p>Score at Least: {minimumScore.toString()}</p>}
        <div>
          <Button
            className="w-full"
            disabled={disabled}
            onClick={() => {
              eventEmitter.emit({ type: selectEventName })
            }}
          >
            Select
          </Button>
          {tag && (
            <div className="flex flex-col gap-2">
              <Button
                variant="outline"
                className="w-full mt-2 h-auto whitespace-break-spaces"
                disabled={disabled}
                onClick={() => {
                  eventEmitter.emit({ type: 'BLIND_SKIPPED' })
                }}
              >
                Skip and get the {tags[tag]?.name} tag
              </Button>{' '}
              <div className="text-sm text-cream-white/50">
                {tags[tag]?.name} Tag: {tags[tag]?.benefit}
              </div>
            </div>
          )}
        </div>
      </div>
    </Card>
  )
}
