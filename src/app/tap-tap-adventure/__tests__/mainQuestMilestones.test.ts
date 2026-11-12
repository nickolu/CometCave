import { produce } from 'immer'
import { describe, expect, it } from 'vitest'

import { roundKm } from '@/app/tap-tap-adventure/lib/leveling'
import { TOTAL_CONQUERABLE, claimNewMilestones, createMainQuest } from '@/app/tap-tap-adventure/lib/mainQuestManager'

describe('claimNewMilestones', () => {
  it('claims every milestone reached and awards their gold without touching the quest it was given', () => {
    // The store's state is produced by immer, which freezes it. Beating a guardian used to
    // write into this object and throw, leaving the fight open and the guardian immortal.
    const frozen = produce({ quest: createMainQuest() }, () => {}).quest
    expect(Object.isFrozen(frozen.milestones[0])).toBe(true)

    const { mainQuest, goldAwarded } = claimNewMilestones(frozen, 3)
    expect(goldAwarded).toBe(150)
    expect(mainQuest.milestones[0].claimed).toBe(true)
    expect(mainQuest.milestones[1].claimed).toBe(false)
    expect(mainQuest.status).toBe('active')
    expect(frozen.milestones[0].claimed).toBe(false)
  })

  it('does not pay a milestone twice', () => {
    const first = claimNewMilestones(createMainQuest(), 6)
    expect(first.goldAwarded).toBe(450)
    const second = claimNewMilestones(first.mainQuest, 6)
    expect(second.goldAwarded).toBe(0)
  })

  it('completes the quest when every region is conquered', () => {
    const { mainQuest } = claimNewMilestones(createMainQuest(), TOTAL_CONQUERABLE)
    expect(mainQuest.status).toBe('completed')
    expect(mainQuest.milestones.every(m => m.claimed)).toBe(true)
  })
})

describe('roundKm', () => {
  it('keeps mounted steps from drifting into floating-point dust', () => {
    let km = 0
    for (let i = 0; i < 1000; i++) km = roundKm(km + 1.3)
    expect(km).toBe(1300)
    expect(roundKm(1493.4999999999868)).toBe(1493.5)
  })
})
