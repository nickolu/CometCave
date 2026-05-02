import { BlindCard } from '@/app/daily-card-game/components/blind-selection/blind-card'
import { ReferenceView } from '@/app/daily-card-game/components/cosmic/reference-view'
import { bossBlinds } from '@/app/daily-card-game/domain/round/boss-blinds'

export const BossBlindsView = () => {
  return (
    <ReferenceView
      eyebrow="Reference"
      title="Boss Blinds"
      description="The third blind of every round. Each warps a different rule."
    >
      <div className="flex flex-wrap gap-4">
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
    </ReferenceView>
  )
}
