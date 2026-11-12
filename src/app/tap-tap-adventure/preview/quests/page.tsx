'use client'

/**
 * Development-only preview of the Quests, Map and Party drawers with a run
 * that has something in them: a main quest, a timed quest, feats, a bestiary,
 * companions, contacts, factions, a camp and two finished runs.
 *
 *   /tap-tap-adventure/preview/quests?drawer=quests|map|party&sub=<sub-tab id>
 *
 * Returns 404 outside development. Nothing here reaches a server route.
 */
import { notFound, useSearchParams } from 'next/navigation'
import { Suspense, useEffect, useState } from 'react'

import { useGameStore } from '@/app/tap-tap-adventure/hooks/useGameStore'
import { getTodayDateString } from '@/app/tap-tap-adventure/lib/dailyRewardTracker'
import { defaultGameState } from '@/app/tap-tap-adventure/lib/defaultGameState'
import type { BestiaryEntry, FantasyCharacter, FantasyStoryEvent, GameState, PartyMember } from '@/app/tap-tap-adventure/models/types'
import type { DrawerId } from '@/app/tap-tap-adventure/stage/Drawers'
import GameStage from '@/app/tap-tap-adventure/stage/GameStage'

const NOW = '2026-11-11T18:00:00.000Z'
const EARLIER = '2026-11-03T09:30:00.000Z'

function companion(overrides: Partial<PartyMember> & Pick<PartyMember, 'id' | 'name' | 'icon' | 'className' | 'rarity'>): PartyMember {
  return {
    description: 'A companion of the road.',
    level: 4,
    hp: 30,
    maxHp: 40,
    stats: { strength: 5, intelligence: 4, luck: 5, charisma: 4 },
    equipment: { weapon: null, armor: null, accessory: null },
    dailyCost: 3,
    recruitCost: 40,
    relationship: 0,
    role: 'combatant',
    ...overrides,
  }
}

const BESTIARY: BestiaryEntry[] = [
  { name: 'Marsh Wolf', element: 'nature', level: 3, attack: 8, defense: 3, maxHp: 28, region: 'green_meadows', timesDefeated: 4, firstEncountered: EARLIER },
  {
    name: 'Hedgerow Boar',
    element: 'nature',
    level: 4,
    attack: 9,
    defense: 4,
    maxHp: 50,
    region: 'green_meadows',
    timesDefeated: 1,
    firstEncountered: NOW,
    specialAbility: { name: 'Gore', description: 'A charge with both tusks.', damage: 14, cooldown: 3 },
  },
  { name: 'Hollow Knight', element: 'shadow', level: 6, attack: 12, defense: 7, maxHp: 80, region: 'dark_forest', timesDefeated: 1, firstEncountered: NOW, isBoss: true },
]

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
    inventory: [
      { id: 'gift-1', name: 'Friendship Token', description: 'A carved token.', quantity: 2, type: 'misc', rarity: 'uncommon', effects: { companionGift: 10 } },
    ],
    equipment: { weapon: null, armor: null, accessory: null },
    deathCount: 0,
    pendingStatPoints: 0,
    mountRoster: [],
    mailbox: [],
    pendingReplies: [],
    party: [
      companion({ id: 'pm-tam', name: 'Tamsin', icon: '🛡️', className: 'Shieldmaiden', rarity: 'uncommon', relationship: 34, hp: 22, maxHp: 40, description: 'Steady as a wall.' }),
      companion({ id: 'pm-pip', name: 'Pip', customName: 'Pip the Quick', icon: '🪕', className: 'Bard', rarity: 'rare', relationship: 62, hp: 18, maxHp: 24, role: 'non-combatant', dailyCost: 2, description: 'Sings the road shorter.' }),
    ],
    activeMercenary: { id: 'merc-brom', name: 'Brom', description: 'A hired axe.', class: 'warrior', rarity: 'uncommon', attack: 9, defense: 6, icon: '🪓', dailyCost: 4, recruitCost: 60, hp: 31, maxHp: 45 },
    mercenaryRoster: [
      { id: 'merc-brom', name: 'Brom', description: 'A hired axe.', class: 'warrior', rarity: 'uncommon', attack: 9, defense: 6, icon: '🪓', dailyCost: 4, recruitCost: 60, hp: 31, maxHp: 45 },
    ],
    difficultyMode: 'normal',
    currentRegion: 'green_meadows',
    currentWeather: 'rain',
    visitedRegions: ['green_meadows', 'dark_forest'],
    visitedTowns: [],
    factionReputations: { silver_dawn: 42, verdant_circle: 88, iron_consortium: 6 },
    campState: { buildingLevels: { tavern: 2, armory: 1 } },
    bestiary: BESTIARY,
    npcEncounters: {
      elder_maren: { timesSpoken: 5, disposition: 56, lastTier: 'trusted' },
      bramble: { timesSpoken: 2, disposition: 14 },
      whisper: { timesSpoken: 1, disposition: -22 },
    },
    mainQuest: {
      title: 'The Long Road East',
      description: 'Walk every country between the meadows and the throne, and leave each one quieter than you found it.',
      status: 'active',
      milestones: [
        { regionsRequired: 2, title: 'First steps beyond the meadow', goldReward: 50, claimed: true },
        { regionsRequired: 4, title: 'A name in four countries', goldReward: 150, claimed: false },
        { regionsRequired: 7, title: 'Half the world walked', goldReward: 400, claimed: false },
        { regionsRequired: 10, title: 'The whole road', goldReward: 1000, claimed: false },
      ],
    },
    landmarkState: {
      regionId: 'green_meadows',
      landmarks: [
        { templateId: 'hearthwood', name: 'Hearthwood', type: 'village', description: 'A village of smoke and bread.', icon: '🏘️', hasShop: true, encounterPrompt: '', distanceFromEntry: 20, hidden: false, isSecret: false, explored: true, position: { x: 60, y: 240 } },
        { templateId: 'old-mill', name: 'The Old Mill', type: 'ruin', description: 'A mill with no miller.', icon: '🏚️', hasShop: false, encounterPrompt: '', distanceFromEntry: 90, hidden: false, isSecret: false, explored: true, position: { x: 180, y: 300 } },
        { templateId: 'pebble-ford', name: 'Pebble Ford', type: 'crossing', description: 'A shallow crossing where carts come to grief.', icon: '🌉', hasShop: true, encounterPrompt: '', distanceFromEntry: 150, hidden: false, isSecret: false, explored: false, position: { x: 300, y: 260 } },
        { templateId: 'hollow-oak', name: 'The Hollow Oak', type: 'grove', description: 'An oak you could live in.', icon: '🌳', hasShop: false, encounterPrompt: '', distanceFromEntry: 170, hidden: false, isSecret: false, explored: false, position: { x: 250, y: 330 } },
        { templateId: 'barrow', name: 'The Barrow', type: 'ruin', description: 'Stones nobody put there.', icon: '🪦', hasShop: false, encounterPrompt: '', distanceFromEntry: 190, hidden: true, isSecret: true, explored: false, position: { x: 320, y: 300 } },
      ],
      entryDistance: 0,
      nextLandmarkIndex: 2,
      exploring: false,
      explorationDepth: 0,
      positionInRegion: 136,
      activeTargetIndex: 2,
      regionLength: 200,
      position: { x: 288, y: 262 },
      exitPositions: [
        { regionId: 'dark_forest', name: 'Road to the Dark Forest', icon: '🌲', position: { x: 480, y: 250 } },
        { regionId: 'sunken_ruins', name: 'Path to the Sunken Ruins', icon: '🌊', position: { x: 250, y: 480 } },
      ],
      regionBounds: { width: 500, height: 500 },
    },
    ...overrides,
  }
}

function story(): FantasyStoryEvent[] {
  const base = { characterId: 'preview-wren', locationId: 'green_meadows' }
  return [
    { id: 'e1', type: 'travel', ...base, timestamp: NOW, outcomeDescription: 'You set out from Hearthwood at dawn with a heel of bread and a borrowed cloak.' },
    { id: 'e2', type: 'combat_victory', ...base, timestamp: NOW, outcomeDescription: 'A marsh wolf comes at you from the reeds. You put an arrow in it and it limps off.', resourceDelta: { reputation: 2 } },
  ]
}

function stateFor(): GameState {
  const c = wren()
  const fallen = wren({
    id: 'preview-oriel',
    name: 'Oriel',
    race: 'Human',
    class: 'Mage',
    level: 7,
    distance: 912,
    gold: 310,
    status: 'dead',
    deathCount: 1,
    currentRegion: 'dark_forest',
    visitedRegions: ['green_meadows', 'dark_forest', 'feywild_grove'],
    party: [],
    activeMercenary: null,
    mercenaryRoster: [],
    equipment: { weapon: { id: 'w1', name: 'Ashwood staff', description: 'Warm to the touch.', quantity: 1, type: 'equipment', rarity: 'rare' }, armor: null, accessory: null },
  })
  const retired = wren({
    id: 'preview-tam',
    name: 'Tam',
    race: 'Dwarf',
    class: 'Warrior',
    level: 9,
    distance: 1640,
    gold: 1205,
    status: 'retired',
    difficultyMode: 'hard',
    currentRegion: 'crystal_caves',
    visitedRegions: ['green_meadows', 'sunken_ruins', 'crystal_caves', 'pirates_cove'],
    party: [],
    activeMercenary: null,
    mercenaryRoster: [],
  })
  const today = getTodayDateString()
  return {
    ...defaultGameState,
    selectedCharacterId: c.id,
    characters: [c, fallen, retired],
    storyEvents: story(),
    dailyReward: { lastClaimedDate: today, streak: 3, totalDaysClaimed: 3 },
    activeQuest: {
      id: 'q-1',
      title: 'Carry word to Pebble Ford',
      description: 'The crossing-keeper has not been heard from since the rains. Reach the ford before the river rises further.',
      status: 'active',
      type: 'reach_distance',
      target: 260,
      startValue: 180,
      deadlineDay: 7,
      startDay: 2,
      rewards: { gold: 45, reputation: 3, items: [{ id: 'r1', name: 'Crossing-keeper’s lantern', description: 'Never gutters.', quantity: 1, type: 'misc', rarity: 'uncommon' }] },
    },
    achievements: [
      { achievementId: 'travel_first_steps', progress: 10, completed: true, completedAt: EARLIER, rewardClaimed: true },
      { achievementId: 'travel_wanderer', progress: 100, completed: true, completedAt: EARLIER, rewardClaimed: true },
      { achievementId: 'travel_explorer', progress: 212, completed: false },
      { achievementId: 'combat_first_blood', progress: 1, completed: true, completedAt: NOW, rewardClaimed: false },
    ],
    dailyChallenges: {
      date: today,
      streak: 2,
      allCompletedClaimed: false,
      challenges: [
        { id: `${today}-0`, type: 'travel_distance', description: 'Walk 50 km', target: 50, progress: 50, completed: true, reward: { gold: 10 } },
        { id: `${today}-1`, type: 'win_combats', description: 'Win 3 fights', target: 3, progress: 1, completed: false, reward: { gold: 15 } },
        { id: `${today}-2`, type: 'earn_gold', description: 'Earn 40 gold', target: 40, progress: 22, completed: false, reward: { reputation: 2 } },
      ],
    },
  }
}

function Preview() {
  const params = useSearchParams()
  const drawer = (params.get('drawer') as DrawerId | null) ?? 'quests'
  const sub = params.get('sub') ?? undefined
  const [ready, setReady] = useState(false)

  useEffect(() => {
    for (const hint of ['first-tap', 'first-combat', 'first-item', 'first-crossroads']) {
      try {
        localStorage.setItem(`tta-onboarding-preview-wren-${hint}`, '1')
      } catch {
        // ignore
      }
    }
    try {
      // A name on the board, so the ranks show their ledger rather than the name dialog.
      localStorage.setItem('adventure-player-name', 'Wren')
    } catch {
      // ignore
    }
    useGameStore.setState({ gameState: stateFor() })
    const t = setTimeout(() => setReady(true), 0)
    return () => clearTimeout(t)
  }, [])

  if (!ready) return null
  return <GameStage initialDrawer={drawer} initialSub={sub} />
}

export default function PreviewQuestsPage() {
  if (process.env.NODE_ENV === 'production') notFound()
  return (
    <Suspense fallback={null}>
      <Preview />
    </Suspense>
  )
}
