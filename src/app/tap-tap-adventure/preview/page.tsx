'use client'

/**
 * Development-only stage preview: seeds the store with a fixture run and
 * renders the real stage in a named state, so the theatre can be looked at
 * (and screenshotted) without signing in or spending a model call.
 *
 *   /tap-tap-adventure/preview?s=idle|decision|arrival|social|combat|shop|town|foyer|creation|summary
 *     &drawer=pack|gear|quests|map|party|town&sub=<sub-tab id>&town=tavern|stable|mailbox|notice|blacksmith|waypoints|npc
 *
 * Returns 404 outside development. Nothing here reaches a server route.
 */
import { notFound, useSearchParams } from 'next/navigation'
import { Suspense, useEffect, useState } from 'react'

import CharacterList from '@/app/tap-tap-adventure/components/CharacterList'
import RunSummary from '@/app/tap-tap-adventure/components/RunSummary'
import { useGameStore } from '@/app/tap-tap-adventure/hooks/useGameStore'
import { getTodayDateString } from '@/app/tap-tap-adventure/lib/dailyRewardTracker'
import { defaultGameState } from '@/app/tap-tap-adventure/lib/defaultGameState'
import type { CombatState, FantasyCharacter, FantasyDecisionPoint, FantasyStoryEvent, GameState } from '@/app/tap-tap-adventure/models/types'
import type { DrawerId } from '@/app/tap-tap-adventure/stage/Drawers'
import { Foyer } from '@/app/tap-tap-adventure/stage/Foyer'
import GameStage, { type TownDoor } from '@/app/tap-tap-adventure/stage/GameStage'

const NOW = '2026-11-11T18:00:00.000Z'

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
    currentWeather: 'rain',
    visitedRegions: ['green_meadows'],
    visitedTowns: [],
    factionReputations: {},
    landmarkState: {
      regionId: 'green_meadows',
      landmarks: [
        { templateId: 'hearthwood', name: 'Hearthwood', type: 'village', description: 'A village of smoke and bread.', icon: '🏘️', hasShop: true, encounterPrompt: '', distanceFromEntry: 20, hidden: false, isSecret: false, explored: true, position: { x: 60, y: 240 } },
        { templateId: 'old-mill', name: 'The Old Mill', type: 'ruin', description: 'A mill with no miller.', icon: '🏚️', hasShop: false, encounterPrompt: '', distanceFromEntry: 90, hidden: false, isSecret: false, explored: true, position: { x: 180, y: 300 } },
        { templateId: 'pebble-ford', name: 'Pebble Ford', type: 'crossing', description: 'A shallow crossing where carts come to grief.', icon: '🌉', hasShop: true, encounterPrompt: '', distanceFromEntry: 150, hidden: false, isSecret: false, explored: false, position: { x: 300, y: 260 } },
      ],
      entryDistance: 0,
      nextLandmarkIndex: 2,
      exploring: false,
      explorationDepth: 0,
      positionInRegion: 136,
      activeTargetIndex: 2,
      regionLength: 200,
      position: { x: 288, y: 262 },
      exitPositions: [{ regionId: 'dark_forest', name: 'Road to the Dark Forest', icon: '🌲', position: { x: 480, y: 250 } }],
      regionBounds: { width: 500, height: 500 },
    },
    ...overrides,
  }
}

function story(): FantasyStoryEvent[] {
  const base = { characterId: 'preview-wren', locationId: 'green_meadows' }
  return [
    { id: 'e1', type: 'travel', ...base, timestamp: NOW, outcomeDescription: 'You set out from Hearthwood at dawn with a heel of bread and a borrowed cloak.' },
    { id: 'e2', type: 'decision_result', ...base, timestamp: NOW, selectedOptionText: 'Trade the lantern', outcomeDescription: 'At The Old Mill the miller’s widow trades you a storm lantern for twelve gold.', resourceDelta: { gold: -12 } },
    { id: 'e3', type: 'combat_victory', ...base, timestamp: NOW, outcomeDescription: 'A marsh wolf comes at you from the reeds. You put an arrow in it and it limps off.', resourceDelta: { reputation: 2 } },
    { id: 'e4', type: 'travel', ...base, timestamp: NOW, outcomeDescription: 'Rain sets in. The road to Pebble Ford turns to soup and your boots take on water.' },
  ]
}

const DECISION: FantasyDecisionPoint = {
  id: 'dp-1',
  eventId: 'ev-1',
  prompt: 'At Pebble Ford a tinker’s cart lies on its side in the shallows. Bramble the tinker, soaked to the knees, offers a brass whistle to whoever helps.',
  resolved: false,
  options: [
    { id: 'heave', text: 'Heave the cart upright', relevantAttributes: ['strength'], successProbability: 0.7 },
    { id: 'wade', text: 'Wade in for her scattered tools', relevantAttributes: ['luck'], successProbability: 0.55 },
    { id: 'walk', text: 'Walk on' },
  ],
}

const COMBAT: CombatState = {
  id: 'c-1',
  eventId: 'ev-2',
  scenario: 'A boar the size of a cart bursts from the hedgerow.',
  enemy: { id: 'boar', name: 'Hedgerow Boar', description: 'Tusks like ploughshares.', hp: 34, maxHp: 50, attack: 9, defense: 4, level: 4, goldReward: 18, element: 'nature' },
  playerState: { hp: 48, maxHp: 60, attack: 11, defense: 6, isDefending: false, comboCount: 1, abilityCooldown: 0, enemyStunned: false, mana: 10, maxMana: 20, shield: 0, ap: 3, maxAp: 3, luck: 7, stamina: 6, maxStamina: 6 },
  turnNumber: 2,
  combatLog: [
    { turn: 1, actor: 'player', action: 'attack', damage: 9, description: 'You loose an arrow. 9 damage.' },
    { turn: 1, actor: 'enemy', action: 'attack', damage: 7, description: 'The boar charges. 7 damage.' },
  ],
  status: 'active',
  combatDistance: 'mid',
  turnPhase: 'player',
}

function stateFor(s: string, distance?: number): GameState {
  const c = wren(distance != null ? { distance } : {})
  const base: GameState = {
    ...defaultGameState,
    selectedCharacterId: c.id,
    characters: [c],
    storyEvents: story(),
    dailyReward: { lastClaimedDate: getTodayDateString(), streak: 3, totalDaysClaimed: 3 },
  }
  switch (s) {
    case 'decision':
      return { ...base, decisionPoint: DECISION }
    case 'arrival':
      return {
        ...base,
        decisionPoint: {
          id: 'dp-2',
          eventId: 'ev-3',
          prompt: 'The ford is ahead. Carts and a crossing-keeper’s hut, and the smell of wet rope.',
          resolved: false,
          options: [{ id: 'explore-landmark', text: 'Go in' }, { id: 'bypass-landmark', text: 'Pass it by' }],
        },
      }
    case 'social':
      return {
        ...base,
        socialEncounter: { npc: { id: 'bramble', name: 'Bramble', icon: '🧰', description: 'A tinker.', personality: 'brisk' }, scenario: 'A tinker at the ford.' },
        decisionPoint: {
          id: 'dp-3',
          eventId: 'ev-4',
          prompt: 'Bramble the tinker waves you over, dripping.',
          resolved: false,
          options: [{ id: 'engage-conversation', text: 'Talk to Bramble' }, { id: 'walk-away', text: 'Walk on' }],
        },
      }
    case 'combat':
      return { ...base, combatState: COMBAT }
    case 'shop':
      return {
        ...base,
        shopState: {
          isOpen: true,
          items: [
            { id: 's1', name: 'Storm lantern', description: 'Burns in any weather.', quantity: 1, type: 'misc', price: 18, rarity: 'uncommon' },
            { id: 's2', name: 'Honey cakes', description: 'Restores 15 HP.', quantity: 3, type: 'consumable', price: 4, rarity: 'common' },
            { id: 's3', name: 'Yew longbow', description: 'A ranger\u2019s bow, well strung.', quantity: 1, type: 'equipment', price: 60, rarity: 'rare', effects: { strength: 3 } },
          ],
        },
      }
    case 'summary':
      return { ...base, runSummary: { character: wren({ status: 'dead', deathCount: 1 }), reason: 'death', essenceEarned: 41, heirloom: null, killedBy: 'a hedgerow boar' } }
    case 'town': {
      const t = wren({ ...(distance != null ? { distance } : {}), landmarkState: { ...c.landmarkState!, exploring: true, exploringLandmarkName: 'Hearthwood', activeTargetIndex: 0 } })
      return {
        ...base,
        characters: [t],
        decisionPoint: {
          id: 'dp-4',
          eventId: 'ev-5',
          prompt: 'Hearthwood is quiet at this hour. Smoke from the bakery, a dog asleep on the step.',
          resolved: false,
          options: [
            { id: 'visit-shop', text: 'Visit the shop' },
            { id: 'rest-at-inn', text: 'Rest at the inn' },
            { id: 'visit-notice-board', text: 'Read the notice board' },
            { id: 'talk-to-npc-elder_maren', text: '👵 Elder Maren' },
            { id: 'leave-town', text: 'Leave Hearthwood' },
          ],
        },
      }
    }
    default:
      return base
  }
}

function Preview() {
  const params = useSearchParams()
  const s = params.get('s') ?? 'idle'
  const drawer = (params.get('drawer') as DrawerId | null) ?? null
  const sub = params.get('sub') ?? undefined
  const town = (params.get('town') as TownDoor | null) ?? null
  const d = params.get('d') ? Number(params.get('d')) : undefined
  const [ready, setReady] = useState(false)

  useEffect(() => {
    // Hints have been seen; this is a look at the stage, not a first run.
    for (const hint of ['first-tap', 'first-combat', 'first-item', 'first-crossroads']) {
      try {
        localStorage.setItem(`tta-onboarding-preview-wren-${hint}`, '1')
      } catch {
        // ignore
      }
    }
    useGameStore.setState({ gameState: s === 'foyer' || s === 'creation' ? { ...defaultGameState, characters: [wren(), wren({ id: 'preview-tam', name: 'Tam', race: 'Dwarf', class: 'Warrior', level: 9, distance: 640, status: 'retired' })] } : stateFor(s, d) })
    const t = setTimeout(() => setReady(true), 0)
    return () => clearTimeout(t)
  }, [s, d])

  if (!ready) return null
  if (s === 'foyer' || s === 'creation') {
    return (
      <Foyer>
        <CharacterList defaultShowCreation={s === 'creation'} />
      </Foyer>
    )
  }
  if (s === 'summary') {
    const summary = useGameStore.getState().gameState.runSummary
    return (
      <Foyer>
        {summary && <RunSummary data={summary} onViewUpgrades={() => {}} onNewCharacter={() => {}} onBackToCharacters={() => {}} />}
      </Foyer>
    )
  }
  return <GameStage initialDrawer={drawer} initialSub={sub} initialTown={s === 'town' ? town : null} />
}

export default function PreviewPage() {
  if (process.env.NODE_ENV === 'production') notFound()
  return (
    <Suspense fallback={null}>
      <Preview />
    </Suspense>
  )
}
