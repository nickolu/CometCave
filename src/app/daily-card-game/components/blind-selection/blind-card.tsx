import { DollarSigns } from '@/app/daily-card-game/components/global/dollar-signs'
import { eventEmitter } from '@/app/daily-card-game/domain/events/event-emitter'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'

export function BlindCard({
  name,
  description,
  reward,
  minimumScore,
  disabled,
  selectEventName,
  skipEventName,
}: {
  name: string
  description?: string
  reward: number
  minimumScore: number
  disabled: boolean
  selectEventName: 'SMALL_BLIND_SELECTED' | 'BIG_BLIND_SELECTED' | 'BOSS_BLIND_SELECTED'
  skipEventName?: 'SMALL_BLIND_SKIPPED' | 'BIG_BLIND_SKIPPED'
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
        <p>Score at Least: {minimumScore}</p>
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
          {skipEventName && (
            <Button
              variant="outline"
              className="w-full mt-2"
              disabled={disabled}
              onClick={() => {
                console.log('SKIP EVENT NAME', skipEventName)
                eventEmitter.emit({ type: skipEventName })
              }}
            >
              Skip
            </Button>
          )}
        </div>
      </div>
    </Card>
  )
}
