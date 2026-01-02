import { BlindCard } from '@/app/daily-card-game/components/blind-selection/blind-card'
import { eventEmitter } from '@/app/daily-card-game/domain/events/event-emitter'
import { bossBlinds } from '@/app/daily-card-game/domain/round/boss-blinds'
import { Button } from '@/components/ui/button'

export const BossBlindsView = () => {
  return (
    <div className="flex flex-col items-center mt-10 w-3/4 mx-auto">
      <h1 className="text-2xl font-bold">Boss Blinds</h1>
      <div className="flex flex-wrap justify-center gap-2 mt-4 mx-auto">
        {bossBlinds.map(bossBlind => (
          <BlindCard
            key={bossBlind.name}
            name={bossBlind.name}
            description={bossBlind.description}
            reward={bossBlind.baseReward}
            disabled={true}
            selectEventName="BOSS_BLIND_SELECTED"
          />
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
