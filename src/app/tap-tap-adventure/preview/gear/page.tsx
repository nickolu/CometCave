'use client'

/**
 * Development-only preview of the Pack and Gear drawers with a character who
 * actually carries things: a mixed pack, worn equipment, a few skills, two
 * spells, a mount. The main preview's fixture travels light; this one does not.
 *
 *   /tap-tap-adventure/preview/gear?drawer=pack|gear&sub=<sub-tab id>
 *   /tap-tap-adventure/preview/gear?status=1          the full character sheet
 *
 * Returns 404 outside development. Nothing here reaches a server route.
 */
import { notFound, useSearchParams } from 'next/navigation'
import { Suspense, useEffect, useState } from 'react'

import { PlayerStatusView } from '@/app/tap-tap-adventure/components/PlayerStatusView'
import { FALLBACK_SKILL_TREES } from '@/app/tap-tap-adventure/config/fallbackSkillTrees'
import { MOUNT_DEFINITIONS } from '@/app/tap-tap-adventure/config/mounts'
import { STARTING_SPELLS } from '@/app/tap-tap-adventure/config/startingSpells'
import { useGameStore } from '@/app/tap-tap-adventure/hooks/useGameStore'
import { getTodayDateString } from '@/app/tap-tap-adventure/lib/dailyRewardTracker'
import { defaultGameState } from '@/app/tap-tap-adventure/lib/defaultGameState'
import type { FantasyCharacter, GameState, Item } from '@/app/tap-tap-adventure/models/types'
import type { DrawerId } from '@/app/tap-tap-adventure/stage/Drawers'
import { Foyer } from '@/app/tap-tap-adventure/stage/Foyer'
import GameStage from '@/app/tap-tap-adventure/stage/GameStage'

const WORN_BOW: Item = {
  id: 'worn-bow',
  name: 'Yew Longbow',
  description: 'A ranger’s bow, well strung and better kept.',
  quantity: 1,
  type: 'equipment',
  rarity: 'rare',
  effects: { strength: 3, luck: 1, range: 'far' },
  enchantmentLevel: 2,
  onHitEffect: { type: 'bleed', chance: 0.2, damage: 3, duration: 2, description: 'Barbed arrows leave a bleeding wound' },
}

const WORN_CLOAK: Item = {
  id: 'worn-cloak',
  name: 'Mossy Travelling Cloak',
  description: 'Smells of rain and keeps most of it out.',
  quantity: 1,
  type: 'equipment',
  rarity: 'uncommon',
  effects: { luck: 2 },
  passiveEffect: { type: 'hp_regen', value: 1, description: 'Mends 1 HP each km walked' },
}

const INVENTORY: Item[] = [
  { id: 'i-honey', name: 'Honey Cakes', description: 'Sticky, filling, and restores 15 HP.', quantity: 3, type: 'consumable', rarity: 'common', effects: { heal: 15 } },
  { id: 'i-lantern', name: 'Storm Lantern', description: 'Burns in any weather. Shows what hides in the dark.', quantity: 1, type: 'misc', rarity: 'uncommon', effects: { revealLandmark: true } },
  {
    id: 'i-sword',
    name: 'Ashwood Sword',
    description: 'A straight blade with a hilt wrapped in red cord.',
    quantity: 1,
    type: 'equipment',
    rarity: 'epic',
    effects: { strength: 5, charisma: 1 },
    loreText: 'Carried out of the Dark Forest by a knight who never said how.',
    grantsSpell: { spellId: 'ember-cut', spellName: 'Ember Cut', usesPerCombat: 2, description: 'A burning slash' },
  },
  { id: 'i-ring', name: 'Tarnished Signet Ring', description: 'The seal is worn flat, but doors still open for it.', quantity: 1, type: 'equipment', rarity: 'rare', effects: { charisma: 3, luck: -1 }, drawback: { stat: 'luck', value: -1, description: 'Its old owner had debts' } },
  {
    id: 'i-scroll',
    name: 'Scroll of Frost Lance',
    description: 'A spell written in a hand that shivers.',
    quantity: 1,
    type: 'spell_scroll',
    rarity: 'rare',
    spell: { id: 'frost-lance', name: 'Frost Lance', description: 'A spear of ice that slows whatever it strikes.', school: 'arcane', manaCost: 7, cooldown: 2, target: 'enemy', effects: [{ type: 'damage', value: 14, element: 'ice' }], tags: ['ice'] },
  },
  { id: 'i-pelts', name: 'Marsh Wolf Pelts', description: 'Worth something to a tanner.', quantity: 4, type: 'trade_good', rarity: 'common', price: 9 },
  { id: 'i-letter', name: 'Sealed Letter for Elder Maren', description: 'Do not open. Hearthwood’s elder is expecting it.', quantity: 1, type: 'quest', rarity: 'common' },
  { id: 'i-tooth', name: 'Griffin Tooth Charm', description: 'Strung on a leather cord. It hums faintly.', quantity: 1, type: 'equipment', rarity: 'legendary', effects: { luck: 4, intelligence: 2 }, isHeirloom: true, passiveEffect: { type: 'crit_bonus', value: 10, description: '+10% critical chance' } },
  { id: 'i-old-boots', name: 'Split Boots', description: 'Thrown out at the ford.', quantity: 1, type: 'equipment', rarity: 'common', status: 'deleted', effects: { luck: 1 } },
]

function wren(overrides: Partial<FantasyCharacter> = {}): FantasyCharacter {
  const tree = FALLBACK_SKILL_TREES.ranger
  const mount = { ...MOUNT_DEFINITIONS.find(m => m.id === 'wolf')!, customName: 'Bramblepaw', personality: 'loyal' as const, hp: 22, maxHp: 30 }
  return {
    id: 'preview-wren',
    playerId: 'preview',
    name: 'Wren',
    race: 'Elf',
    class: 'Ranger',
    level: 6,
    abilities: [],
    locationId: 'green_meadows',
    gold: 134,
    reputation: 42,
    bounty: 0,
    distance: 212,
    status: 'active',
    strength: 10,
    intelligence: 5,
    luck: 11,
    charisma: 5,
    hp: 48,
    maxHp: 60,
    mana: 12,
    maxMana: 20,
    explorationShield: 4,
    inventory: INVENTORY,
    equipment: { weapon: WORN_BOW, armor: WORN_CLOAK, accessory: null },
    deathCount: 0,
    pendingStatPoints: 0,
    mountRoster: [mount],
    activeMount: mount,
    mailbox: [],
    pendingReplies: [],
    party: [],
    difficultyMode: 'normal',
    currentRegion: 'green_meadows',
    currentWeather: 'rain',
    visitedRegions: ['green_meadows', 'dark_forest'],
    visitedTowns: [],
    factionReputations: {},
    unlockedSkills: ['iron_fist', 'pathfinder', 'scavenger'],
    classSkillTree: tree,
    unlockedTreeSkillIds: ['ranger_t1_eagle_eye', 'ranger_t1_natures_bond', 'ranger_t2_pathfinder'],
    discoveredCombos: ['elemental_fury', 'frostfire'],
    spellbook: [
      {
        ...STARTING_SPELLS.ranger,
        explorationEffect: { type: 'heal', value: 12, description: 'Knit your wounds while you walk. Heals 12 HP.' },
        explorationManaCost: 4,
      },
      {
        ...STARTING_SPELLS.rogue,
        id: 'spell-fleetfoot',
        name: 'Fleetfoot',
        school: 'nature',
        manaCost: 8,
        cooldown: 0,
        description: 'The road shortens under you.',
        explorationEffect: { type: 'speed_boost', value: 2, description: 'Walk twice as far on each tap for 40 km.', duration: 40 },
      },
    ],
    activeExplorationSpells: [{ spellId: 'spell-fleetfoot', spellName: 'Fleetfoot', effectType: 'speed_boost', value: 2, stepsRemaining: 18 }],
    landmarkState: {
      regionId: 'green_meadows',
      landmarks: [
        { templateId: 'hearthwood', name: 'Hearthwood', type: 'village', description: 'A village of smoke and bread.', icon: '🏘️', hasShop: true, encounterPrompt: '', distanceFromEntry: 20, hidden: false, isSecret: false, explored: true, position: { x: 60, y: 240 } },
        { templateId: 'pebble-ford', name: 'Pebble Ford', type: 'crossing', description: 'A shallow crossing where carts come to grief.', icon: '🌉', hasShop: true, encounterPrompt: '', distanceFromEntry: 150, hidden: false, isSecret: false, explored: false, position: { x: 300, y: 260 } },
      ],
      entryDistance: 0,
      nextLandmarkIndex: 1,
      exploring: false,
      explorationDepth: 0,
      positionInRegion: 136,
      activeTargetIndex: 1,
      regionLength: 200,
      position: { x: 288, y: 262 },
      exitPositions: [{ regionId: 'dark_forest', name: 'Road to the Dark Forest', icon: '🌲', position: { x: 480, y: 250 } }],
      regionBounds: { width: 500, height: 500 },
    },
    ...overrides,
  }
}

function state(): GameState {
  const c = wren()
  return {
    ...defaultGameState,
    selectedCharacterId: c.id,
    characters: [c, wren({ id: 'preview-tam', name: 'Tam', race: 'Dwarf', class: 'Warrior', level: 9, distance: 640, status: 'retired', deathCount: 1 })],
    storyEvents: [
      { id: 'e1', type: 'travel', characterId: c.id, locationId: 'green_meadows', timestamp: '2026-11-11T18:00:00.000Z', outcomeDescription: 'Rain sets in. The road to Pebble Ford turns to soup and your boots take on water.' },
    ],
    newItemIds: ['i-tooth', 'i-scroll'],
    dailyReward: { lastClaimedDate: getTodayDateString(), streak: 3, totalDaysClaimed: 3 },
  }
}

function Preview() {
  const params = useSearchParams()
  const drawer = (params.get('drawer') as DrawerId | null) ?? 'pack'
  const sub = params.get('sub') ?? undefined
  const status = params.get('status') === '1'
  const [ready, setReady] = useState(false)

  useEffect(() => {
    for (const hint of ['first-tap', 'first-combat', 'first-item', 'first-crossroads']) {
      try {
        localStorage.setItem(`tta-onboarding-preview-wren-${hint}`, '1')
      } catch {
        // ignore
      }
    }
    useGameStore.setState({ gameState: state() })
    const t = setTimeout(() => setReady(true), 0)
    return () => clearTimeout(t)
  }, [])

  if (!ready) return null
  if (status) {
    return (
      <Foyer>
        <PlayerStatusView onClose={() => {}} />
      </Foyer>
    )
  }
  return <GameStage initialDrawer={drawer} initialSub={sub} />
}

export default function GearPreviewPage() {
  if (process.env.NODE_ENV === 'production') notFound()
  return (
    <Suspense fallback={null}>
      <Preview />
    </Suspense>
  )
}
