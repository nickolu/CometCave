'use client'

/**
 * The active timed quest on the quests bill: what it asks, the days left as a
 * brass figure, a thin ink progress rule and the promised rewards as stamps.
 */
import { useCallback, useEffect, useRef, useState } from 'react'

import { useGameStore } from '@/app/tap-tap-adventure/hooks/useGameStore'
import { STEPS_PER_DAY, calculateDay } from '@/app/tap-tap-adventure/lib/leveling'
import { createPartyMember } from '@/app/tap-tap-adventure/lib/partyRecruitment'
import { soundEngine } from '@/app/tap-tap-adventure/lib/soundEngine'
import { MAX_PARTY_SIZE } from '@/app/tap-tap-adventure/models/partyMember'
import { TimedQuest } from '@/app/tap-tap-adventure/models/quest'
import { BrassFigure, BrassPlate, PaperButton, PlaybillCaption, PlaybillTitle, Stamp, type StampTone } from '@/app/tap-tap-adventure/stage/Playbill'
import { cn } from '@/lib/utils'

import { QuestCelebration } from './QuestCelebration'

function getUrgencyStyle(daysLeft: number): { stamp: StampTone; bar: string; figure: 'green' | 'ink' | 'red' } {
  if (daysLeft >= 3) return { stamp: 'green', bar: 'bg-ps-stamp-green', figure: 'green' }
  if (daysLeft === 2) return { stamp: 'gold', bar: 'bg-ps-ink', figure: 'ink' }
  return { stamp: 'red', bar: 'bg-ps-stamp-red', figure: 'red' }
}

function RewardStamps({ quest, animate = false }: { quest: TimedQuest; animate?: boolean }) {
  const hasRewards = quest.rewards.gold || quest.rewards.reputation || (quest.rewards.items && quest.rewards.items.length > 0) || quest.rewards.companion
  if (!hasRewards) return null

  return (
    <div className="flex flex-wrap items-center gap-1.5">
      {quest.rewards.gold && <Stamp tone="gold" animate={animate}>+{quest.rewards.gold} gold</Stamp>}
      {quest.rewards.reputation && <Stamp tone="blue" animate={animate}>+{quest.rewards.reputation} repute</Stamp>}
      {quest.rewards.items?.map(item => (
        <Stamp key={item.id} tone="violet" animate={animate}>{item.name}</Stamp>
      ))}
      {quest.rewards.companion && (
        <Stamp tone="green" animate={animate}>{quest.rewards.companion.name} joins you</Stamp>
      )}
    </div>
  )
}

function InkBar({ value, tone, label }: { value: number; tone: string; label: string }) {
  const pct = Math.round(Math.max(0, Math.min(1, value)) * 100)
  return (
    <div className="h-1.5 w-full overflow-hidden rounded-full bg-ps-playbill-edge" role="progressbar" aria-valuemin={0} aria-valuemax={100} aria-valuenow={pct} aria-label={label}>
      <div className={cn('h-full rounded-full transition-[width] duration-300', tone)} style={{ width: `${pct}%` }} />
    </div>
  )
}

export function QuestPanel() {
  const { gameState, getSelectedCharacter, setActiveQuest } = useGameStore()
  const quest = gameState.activeQuest
  const character = getSelectedCharacter()
  // The celebration shows for a completed quest until its rewards are claimed.
  const [celebrationClaimedFor, setCelebrationClaimedFor] = useState<string | null>(null)
  const showCelebration = quest?.status === 'completed' && celebrationClaimedFor !== quest.id
  const failSoundPlayed = useRef(false)

  // Play defeat sound once when quest fails
  useEffect(() => {
    if (quest?.status === 'failed' && !failSoundPlayed.current) {
      soundEngine.playDefeat()
      failSoundPlayed.current = true
    }
    if (quest?.status !== 'failed') {
      failSoundPlayed.current = false
    }
  }, [quest?.status])

  const handleClaimRewards = useCallback(() => {
    if (!quest || !character) return
    const rewards = quest.rewards
    const updatedGold = character.gold + (rewards.gold ?? 0)
    const updatedRep = character.reputation + (rewards.reputation ?? 0)

    const { gameState: gs, setGameState } = useGameStore.getState()
    const updatedChars = gs.characters.map(c => {
      if (c.id !== character.id) return c
      const updatedInventory = [...c.inventory, ...(rewards.items ?? [])]
      let updatedParty = [...(c.party ?? [])]
      if (rewards.companion && updatedParty.length < MAX_PARTY_SIZE) {
        const member = createPartyMember({
          id: `quest-companion-${Date.now()}-${Math.floor(Math.random() * 10000)}`,
          name: rewards.companion.name,
          description: rewards.companion.description,
          icon: rewards.companion.icon ?? '⚔️',
          level: character.level,
          dailyCost: 0,  // Quest companions are loyal — no upkeep
          rarity: rewards.companion.rarity ?? 'common',
          role: 'combatant',
        })
        updatedParty = [...updatedParty, member]
      }
      return { ...c, gold: updatedGold, reputation: updatedRep, inventory: updatedInventory, party: updatedParty }
    })
    setGameState({ ...gs, characters: updatedChars, activeQuest: null })
    setCelebrationClaimedFor(quest.id)
  }, [quest, character])

  const handleDismiss = useCallback(() => {
    setActiveQuest(null)
  }, [setActiveQuest])

  if (!quest || !character) return null

  const currentDay = calculateDay(character.distance)
  const daysLeft = Math.max(0, quest.deadlineDay - currentDay)
  const stepsUntilDeadline = Math.max(0, quest.deadlineDay * STEPS_PER_DAY - character.distance)

  // Progress calculation
  let progress = 0
  let progressText = ''
  let targetDescription = ''
  switch (quest.type) {
    case 'reach_distance': {
      const needed = quest.target - quest.startValue
      const done = Math.max(0, character.distance - quest.startValue)
      progress = Math.min(1, done / needed)
      progressText = `${Math.round(character.distance)} / ${quest.target} km`
      targetDescription = `Travel ${quest.target} km`
      break
    }
    case 'collect_gold': {
      const needed = quest.target - quest.startValue
      const done = Math.max(0, character.gold - quest.startValue)
      progress = Math.min(1, done / needed)
      progressText = `${character.gold} / ${quest.target} gold`
      targetDescription = `Collect ${quest.target} gold`
      break
    }
    case 'win_combat':
      progress = quest.status === 'completed' ? 1 : 0
      progressText = quest.status === 'completed' ? 'Completed!' : 'Win a fight'
      targetDescription = 'Win a combat encounter'
      break
    case 'gain_reputation': {
      const needed = quest.target - quest.startValue
      const done = Math.max(0, character.reputation - quest.startValue)
      progress = Math.min(1, done / needed)
      progressText = `${character.reputation} / ${quest.target} reputation`
      targetDescription = `Reach ${quest.target} reputation`
      break
    }
    case 'explore_landmarks': {
      const explored = (character.landmarkState?.landmarks ?? []).filter(lm => lm.explored).length
      const needed = quest.target - quest.startValue
      const done = Math.max(0, explored - quest.startValue)
      progress = Math.min(1, done / Math.max(1, needed))
      progressText = `${explored} / ${quest.target} explored`
      targetDescription = `Explore ${quest.target} landmarks`
      break
    }
    case 'survive_combats': {
      const wins = quest.startValue
      progress = Math.min(1, wins / quest.target)
      progressText = `${wins} / ${quest.target} won`
      targetDescription = `Win ${quest.target} battles`
      break
    }
    case 'reach_level': {
      const needed = quest.target - quest.startValue
      const done = Math.max(0, character.level - quest.startValue)
      progress = Math.min(1, done / Math.max(1, needed))
      progressText = `Level ${character.level} / ${quest.target}`
      targetDescription = `Reach level ${quest.target}`
      break
    }
    case 'hoard_items': {
      const needed = quest.target - quest.startValue
      const done = Math.max(0, character.inventory.length - quest.startValue)
      progress = Math.min(1, done / Math.max(1, needed))
      progressText = `${character.inventory.length} / ${quest.target} items`
      targetDescription = `Collect ${quest.target} items`
      break
    }
    case 'visit_region': {
      const visited = character.visitedRegions?.length ?? 1
      const needed = quest.target - quest.startValue
      const done = Math.max(0, visited - quest.startValue)
      progress = Math.min(1, done / Math.max(1, needed))
      progressText = `${visited} / ${quest.target} regions`
      targetDescription = `Visit ${quest.target} regions`
      break
    }
  }

  // Celebration modal for completed quests
  if (quest.status === 'completed' && showCelebration) {
    return <QuestCelebration quest={quest} onClaim={handleClaimRewards} />
  }

  // Completed but celebration dismissed (fallback)
  if (quest.status === 'completed') {
    return (
      <section aria-label="Quest complete" className="space-y-3">
        <PlaybillTitle size="sm">Quest complete</PlaybillTitle>
        <div className="flex items-start justify-between gap-3">
          <p className="font-body text-base font-semibold leading-snug text-ps-ink">{quest.title}</p>
          <Stamp tone="green" animate className="shrink-0">Done</Stamp>
        </div>
        <RewardStamps quest={quest} />
        <PaperButton variant="brass" className="w-full" onClick={handleClaimRewards}>
          Claim rewards
        </PaperButton>
      </section>
    )
  }

  // Failed quest — detailed feedback
  if (quest.status === 'failed') {
    const daysOverdue = currentDay - quest.deadlineDay
    const questDuration = quest.deadlineDay - quest.startDay
    return (
      <section aria-label="Quest failed" className="space-y-3">
        <PlaybillTitle size="sm" className="border-ps-stamp-red text-ps-stamp-red">Quest failed</PlaybillTitle>
        <div className="flex items-start justify-between gap-3">
          <p className="font-body text-base font-semibold leading-snug text-ps-ink">{quest.title}</p>
          <Stamp tone="red" className="shrink-0">
            {daysOverdue > 0 ? `${daysOverdue} day${daysOverdue !== 1 ? 's' : ''} overdue` : 'Expired'}
          </Stamp>
        </div>
        <dl className="divide-y divide-ps-playbill-edge border-y border-ps-playbill-edge font-body text-sm">
          <div className="flex justify-between gap-3 py-1.5">
            <dt className="text-ps-ink-soft">Asked</dt>
            <dd className="text-right text-ps-ink">{targetDescription}</dd>
          </div>
          <div className="flex justify-between gap-3 py-1.5">
            <dt className="text-ps-ink-soft">Got to</dt>
            <dd className="text-right tabular-nums text-ps-ink">{progressText} ({Math.round(progress * 100)}%)</dd>
          </div>
          <div className="flex justify-between gap-3 py-1.5">
            <dt className="text-ps-ink-soft">Time given</dt>
            <dd className="text-right tabular-nums text-ps-ink">{questDuration} day{questDuration !== 1 ? 's' : ''}</dd>
          </div>
        </dl>
        <InkBar value={progress} tone="bg-ps-stamp-red" label="Quest progress" />
        <PaperButton variant="outline" className="w-full" onClick={handleDismiss}>
          Dismiss
        </PaperButton>
      </section>
    )
  }

  // Active quest — enhanced with urgency, rewards, and steps
  const urgency = getUrgencyStyle(daysLeft)

  return (
    <section aria-label="Active quest" className="space-y-3">
      <PlaybillTitle size="sm">Active quest</PlaybillTitle>
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <p className="font-body text-base font-semibold leading-snug text-ps-ink">{quest.title}</p>
          <p className="mt-1 font-body text-sm leading-snug text-ps-ink-soft">{quest.description}</p>
        </div>
        <BrassPlate className="shrink-0">
          <BrassFigure
            label={daysLeft === 1 ? 'Day left' : 'Days left'}
            value={daysLeft}
            sub={`~${stepsUntilDeadline} km`}
            barTone={urgency.figure}
            title={`${daysLeft} day${daysLeft !== 1 ? 's' : ''} left · about ${stepsUntilDeadline} km until the deadline`}
          />
        </BrassPlate>
      </div>

      <div>
        <div className="flex items-center justify-between font-label text-xs font-bold uppercase tracking-widest text-ps-ink-soft">
          <span className="tabular-nums">{progressText}</span>
          <span className="tabular-nums">{Math.round(progress * 100)}%</span>
        </div>
        <div className="mt-1">
          <InkBar value={progress} tone={urgency.bar} label="Quest progress" />
        </div>
      </div>

      <div>
        <PlaybillCaption className="mb-1.5">Rewards</PlaybillCaption>
        <RewardStamps quest={quest} />
      </div>
    </section>
  )
}
