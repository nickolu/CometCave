'use client'

/**
 * Development-only ceremony preview: seeds the store with a fixture roster,
 * renders the foyer, and holds one ceremony open over it so each bill can be
 * looked at (and screenshotted) without playing to the moment it fires.
 *
 *   /tap-tap-adventure/preview/foyer?c=daily|hint|stats|levelup|loot|quest|toast|meta
 *
 * Ceremonies that dismiss themselves are re-mounted when they do, so the
 * screenshot always finds one up. Returns 404 outside development.
 */
import { notFound, useSearchParams } from 'next/navigation'
import { Suspense, useCallback, useEffect, useState } from 'react'

import { AchievementToast } from '@/app/tap-tap-adventure/components/AchievementToast'
import CharacterList from '@/app/tap-tap-adventure/components/CharacterList'
import { DailyRewardPopup } from '@/app/tap-tap-adventure/components/DailyRewardPopup'
import { LevelUpCelebration } from '@/app/tap-tap-adventure/components/LevelUpCelebration'
import MetaProgression from '@/app/tap-tap-adventure/components/MetaProgression'
import { OnboardingHint } from '@/app/tap-tap-adventure/components/OnboardingHint'
import { QuestCelebration } from '@/app/tap-tap-adventure/components/QuestCelebration'
import { RareLootCelebration } from '@/app/tap-tap-adventure/components/RareLootCelebration'
import { StatAllocationScreen } from '@/app/tap-tap-adventure/components/StatAllocationScreen'
import { useGameStore } from '@/app/tap-tap-adventure/hooks/useGameStore'
import { getDailyReward } from '@/app/tap-tap-adventure/lib/dailyRewardTracker'
import { defaultGameState } from '@/app/tap-tap-adventure/lib/defaultGameState'
import type { TimedQuest } from '@/app/tap-tap-adventure/models/quest'
import type { FantasyCharacter, Item } from '@/app/tap-tap-adventure/models/types'
import { Foyer } from '@/app/tap-tap-adventure/stage/Foyer'

function wren(overrides: Partial<FantasyCharacter> = {}): FantasyCharacter {
  return {
    id: 'preview-wren',
    playerId: 'preview',
    name: 'Wren',
    race: 'Elf',
    class: 'Ranger',
    level: 4,
    abilities: [],
    locationId: 'green_meadows',
    gold: 134,
    reputation: 12,
    bounty: 0,
    distance: 212,
    status: 'active',
    strength: 6,
    intelligence: 5,
    luck: 7,
    charisma: 5,
    hp: 48,
    maxHp: 60,
    inventory: [],
    equipment: { weapon: null, armor: null, accessory: null },
    deathCount: 0,
    pendingStatPoints: 0,
    mountRoster: [],
    mailbox: [],
    pendingReplies: [],
    party: [],
    difficultyMode: 'normal',
    currentRegion: 'green_meadows',
    currentWeather: 'clear',
    visitedRegions: ['green_meadows'],
    visitedTowns: [],
    factionReputations: {},
    ...overrides,
  }
}

const LOOT: Item = {
  id: 'preview-loot',
  name: 'Yew Longbow of the Marsh',
  description: 'A ranger’s bow, strung with something that was once alive.',
  quantity: 1,
  type: 'equipment',
  rarity: 'legendary',
  effects: { strength: 3, luck: 2 },
  loreText: 'The reeds remember who drew it last.',
}

const QUEST: TimedQuest = {
  id: 'preview-quest',
  title: 'Carts at the Ford',
  description: 'Help three travellers across Pebble Ford before the rains.',
  status: 'completed',
  type: 'explore_landmarks',
  target: 3,
  startValue: 0,
  deadlineDay: 6,
  startDay: 3,
  rewards: { gold: 40, reputation: 5, items: [{ id: 'q-whistle', name: 'Brass whistle', description: 'Loud.', quantity: 1, type: 'misc' }] },
}

const HINT = {
  title: 'The road is yours',
  body: 'Tap WALK to take a step, or hold it to keep walking. Things happen on the road; the playbill tells you what.',
}

function Ceremony({ c }: { c: string }) {
  // Self-dismissing ceremonies come straight back so there is always one to look at.
  const [key, setKey] = useState(0)
  const remount = useCallback(() => setKey(k => k + 1), [])
  const noop = useCallback(() => {}, [])

  switch (c) {
    case 'daily': {
      const reward = getDailyReward(3)
      return (
        <DailyRewardPopup
          key={key}
          streak={3}
          reward={reward}
          onClaim={() => ({ updatedState: useGameStore.getState().gameState, reward, items: [], goldAwarded: reward.gold ?? 25, reputationAwarded: reward.reputation ?? 0 })}
          onDismiss={remount}
        />
      )
    }
    case 'hint':
      return <OnboardingHint key={key} title={HINT.title} body={HINT.body} onDismiss={remount} />
    case 'stats':
      return <StatAllocationScreen key={key} character={wren({ level: 5, pendingStatPoints: 3 })} onConfirm={noop} />
    case 'levelup':
      return <LevelUpCelebration key={key} level={5} onDismiss={remount} />
    case 'loot':
      return <RareLootCelebration key={key} item={LOOT} onDismiss={remount} />
    case 'quest':
      return <QuestCelebration key={key} quest={QUEST} onClaim={remount} />
    case 'toast':
      return <AchievementToast key={key} achievementId="travel_explorer" onDismiss={remount} />
    case 'meta':
      return <MetaProgression onClose={noop} />
    default:
      return null
  }
}

function Preview() {
  const params = useSearchParams()
  const c = params.get('c') ?? 'daily'
  const [ready, setReady] = useState(false)

  useEffect(() => {
    useGameStore.setState({
      gameState: {
        ...defaultGameState,
        metaProgression: { ...defaultGameState.metaProgression, soulEssence: 230, totalEssenceEarned: 410, totalRuns: 3, bestDistance: 640, bestLevel: 9, upgradeLevels: { resilience: 2, fortune: 1 } },
        characters: [wren(), wren({ id: 'preview-tam', name: 'Tam', race: 'Dwarf', class: 'Warrior', level: 9, distance: 640, status: 'retired', deathCount: 2, difficultyMode: 'hard' })],
      },
    })
    const t = setTimeout(() => setReady(true), 0)
    return () => clearTimeout(t)
  }, [])

  if (!ready) return null
  return (
    <>
      <Foyer>
        <CharacterList />
      </Foyer>
      <Ceremony c={c} />
    </>
  )
}

export default function FoyerPreviewPage() {
  if (process.env.NODE_ENV === 'production') notFound()
  return (
    <Suspense fallback={null}>
      <Preview />
    </Suspense>
  )
}
