'use client'

/**
 * Development-only combat preview: the fight's bill in its busier states,
 * so the panels can be looked at (and screenshotted) without a model call.
 *
 *   /tap-tap-adventure/preview/combat?v=rich|victory|defeat|fled
 *
 * `rich` is a boss fight with a spellbook, items, a party, a mount, status
 * effects, a telegraph and a second enemy. The other three are how a fight
 * ends. Returns 404 outside development. Nothing here reaches a server route.
 */
import { notFound, useSearchParams } from 'next/navigation'
import { Suspense, useEffect, useState } from 'react'

import { useGameStore } from '@/app/tap-tap-adventure/hooks/useGameStore'
import { getTodayDateString } from '@/app/tap-tap-adventure/lib/dailyRewardTracker'
import { defaultGameState } from '@/app/tap-tap-adventure/lib/defaultGameState'
import type { CombatState, FantasyCharacter, FantasyStoryEvent, GameState } from '@/app/tap-tap-adventure/models/types'
import GameStage from '@/app/tap-tap-adventure/stage/GameStage'

const NOW = '2026-11-11T18:00:00.000Z'

function wren(overrides: Partial<FantasyCharacter> = {}): FantasyCharacter {
  return {
    id: 'preview-wren',
    playerId: 'preview',
    name: 'Wren',
    race: 'Elf',
    class: 'Mage',
    level: 6,
    abilities: [],
    locationId: 'dark_forest',
    gold: 134,
    reputation: 12,
    bounty: 0,
    distance: 412,
    status: 'active',
    strength: 6,
    intelligence: 9,
    luck: 7,
    charisma: 5,
    hp: 22,
    maxHp: 70,
    inventory: [
      { id: 'i1', name: 'Honey cakes', description: 'Restores 15 HP.', quantity: 3, type: 'consumable', effects: { heal: 15 } },
      { id: 'i2', name: 'Blue tonic', description: 'Restores 10 MP.', quantity: 1, type: 'consumable', effects: { manaRestore: 10 } },
    ],
    equipment: { weapon: null, armor: null, accessory: null },
    deathCount: 1,
    pendingStatPoints: 0,
    mountRoster: [],
    mailbox: [],
    pendingReplies: [],
    party: [],
    difficultyMode: 'normal',
    currentRegion: 'dark_forest',
    currentWeather: 'storm',
    visitedRegions: ['green_meadows', 'dark_forest'],
    visitedTowns: [],
    factionReputations: {},
    discoveredCombos: ['plasma_burst'],
    spellbook: [
      { id: 's1', name: 'Ember Lance', description: 'A spear of fire.', school: 'arcane', manaCost: 6, cooldown: 0, target: 'enemy', effects: [{ type: 'damage', value: 14, element: 'fire' }], tags: ['fire', 'bolt'], spellLevel: 2, spellXp: 30 },
      { id: 's2', name: 'Frost Bind', description: 'Ice that slows.', school: 'nature', manaCost: 5, cooldown: 2, target: 'enemy', effects: [{ type: 'damage', value: 8, element: 'ice' }], tags: ['ice'], spellLevel: 1, spellXp: 4 },
      { id: 's3', name: 'Mend', description: 'Knit the flesh back.', school: 'nature', manaCost: 14, cooldown: 3, target: 'self', effects: [{ type: 'heal', value: 20 }], tags: ['heal'], spellLevel: 1, spellXp: 0 },
    ],
    landmarkState: {
      regionId: 'dark_forest',
      landmarks: [
        { templateId: 'hollow', name: 'The Hollow', type: 'ruin', description: 'A hollow where the trees lean in.', icon: '🌲', hasShop: false, encounterPrompt: '', distanceFromEntry: 60, hidden: false, isSecret: false, explored: false, position: { x: 200, y: 260 } },
      ],
      entryDistance: 0,
      nextLandmarkIndex: 0,
      exploring: false,
      explorationDepth: 0,
      positionInRegion: 36,
      activeTargetIndex: 0,
      regionLength: 200,
      position: { x: 88, y: 262 },
      exitPositions: [],
      regionBounds: { width: 500, height: 500 },
    },
    ...overrides,
  }
}

const RICH: CombatState = {
  id: 'c-2',
  eventId: 'ev-9',
  scenario: 'The trees part and the Bramble King is waiting, crown of thorns and all.',
  enemy: {
    id: 'bramble-king',
    name: 'Bramble King',
    description: 'A tangle of hedge and hate, older than the road.',
    hp: 61,
    maxHp: 120,
    attack: 14,
    defense: 6,
    level: 7,
    goldReward: 60,
    element: 'nature',
    specialAbility: { name: 'Thorn Lash', description: 'A lash of thorns that bleeds.', damage: 18, cooldown: 3 },
    statusEffects: [{ id: 'se-1', name: 'Burning', type: 'burn', value: 4, turnsRemaining: 2, source: 'player' }],
  },
  additionalEnemies: [
    { id: 'thornling-1', name: 'Thornling', description: 'A sprig with teeth.', hp: 9, maxHp: 20, attack: 4, defense: 1, level: 3, goldReward: 4, element: 'nature' },
    { id: 'thornling-2', name: 'Thornling', description: 'A sprig with teeth.', hp: 0, maxHp: 20, attack: 4, defense: 1, level: 3, goldReward: 4, element: 'nature' },
  ],
  playerState: {
    hp: 22,
    maxHp: 70,
    attack: 12,
    defense: 7,
    isDefending: true,
    comboCount: 3,
    abilityCooldown: 2,
    enemyStunned: false,
    mana: 9,
    maxMana: 30,
    shield: 4,
    ap: 2,
    maxAp: 3,
    luck: 7,
    stamina: 1,
    maxStamina: 6,
    spellCooldowns: { s2: 1 },
    statusEffects: [{ id: 'se-2', name: 'Poisoned', type: 'poison', value: 3, turnsRemaining: 3, source: 'enemy' }],
    activeBuffs: [{ stat: 'strength', value: 2, turnsRemaining: 2 }],
    activeSpellEffects: [{ spellId: 's3', effectType: 'heal_over_time', value: 5, turnsRemaining: 2 }],
    mountHp: 18,
    mountMaxHp: 40,
    mountMovesRemaining: 1,
  },
  partyMemberStates: [
    { memberId: 'pm-1', name: 'Tam', icon: '🪓', hp: 30, maxHp: 44, attack: 9, defense: 5, isKnockedOut: false, relationship: 3 },
    { memberId: 'pm-2', name: 'Bramble', icon: '🧰', hp: 0, maxHp: 28, attack: 5, defense: 3, isKnockedOut: true, relationship: 1 },
  ],
  enemyTelegraph: { action: 'heavy_attack', description: 'The Bramble King draws back its thorns for a heavy blow.' },
  isBoss: true,
  turnNumber: 7,
  combatLog: [
    { turn: 5, actor: 'player', action: 'cast_spell', damage: 28, description: 'Ember Lance burns through the thicket. 28 damage. Super effective!', isCritical: true },
    { turn: 5, actor: 'enemy', action: 'special', damage: 18, description: 'Thorn Lash tears across your arm. 18 damage.' },
    { turn: 6, actor: 'player', action: 'use_item', description: 'You eat a honey cake. 15 HP restored.' },
    { turn: 6, actor: 'party_member', action: 'attack', damage: 6, description: 'Tam swings the axe. 6 damage.' },
    { turn: 6, actor: 'enemy', action: 'status_effect', damage: 3, description: 'Poison seeps. 3 damage.' },
    { turn: 7, actor: 'player', action: 'cast_spell', damage: 4, description: 'Frost Bind grips the roots. 4 damage. Resisted!' },
  ],
  status: 'active',
  combatDistance: 'far',
  turnPhase: 'player',
}

function stateFor(v: string): GameState {
  const c = wren()
  const story: FantasyStoryEvent[] = [
    { id: 'e1', type: 'travel', characterId: c.id, locationId: 'dark_forest', timestamp: NOW, outcomeDescription: 'The Dark Forest closes over the road like a lid.' },
  ]
  const base: GameState = {
    ...defaultGameState,
    selectedCharacterId: c.id,
    characters: [c],
    storyEvents: story,
    dailyReward: { lastClaimedDate: getTodayDateString(), streak: 3, totalDaysClaimed: 3 },
  }
  switch (v) {
    case 'victory':
      return {
        ...base,
        storyEvents: [
          ...story,
          {
            id: 'e2',
            type: 'combat_victory',
            characterId: c.id,
            locationId: 'dark_forest',
            timestamp: NOW,
            outcomeDescription: 'The crown of thorns comes apart in your hands. The forest breathes out.',
            resourceDelta: { gold: 60, reputation: 5 },
            rewardItems: [
              { id: 'r1', name: 'Thorn crown', description: 'Still warm.', quantity: 1, type: 'equipment', rarity: 'rare' },
              { id: 'r2', name: 'Scroll of Bramble', description: 'A spell on bark.', quantity: 1, type: 'spell_scroll' },
            ],
          },
        ],
        combatState: { ...RICH, status: 'victory', enemy: { ...RICH.enemy, hp: 0 }, turnNumber: 8 },
      }
    case 'defeat':
      return {
        ...base,
        storyEvents: [
          ...story,
          {
            id: 'e3',
            type: 'combat_defeat',
            characterId: c.id,
            locationId: 'dark_forest',
            timestamp: NOW,
            outcomeDescription: 'The thorns close over you.',
            resourceDelta: { gold: -34, reputation: -3 },
          },
        ],
        combatState: { ...RICH, status: 'defeat', playerState: { ...RICH.playerState, hp: 0 }, turnNumber: 11 },
      }
    case 'fled':
      return { ...base, combatState: { ...RICH, status: 'fled' } }
    default:
      return { ...base, combatState: RICH }
  }
}

function Preview() {
  const params = useSearchParams()
  const v = params.get('v') ?? 'rich'
  const [ready, setReady] = useState(false)

  useEffect(() => {
    for (const hint of ['first-tap', 'first-combat', 'first-item', 'first-crossroads']) {
      try {
        localStorage.setItem(`tta-onboarding-preview-wren-${hint}`, '1')
      } catch {
        // ignore
      }
    }
    useGameStore.setState({ gameState: stateFor(v) })
    const t = setTimeout(() => setReady(true), 0)
    return () => clearTimeout(t)
  }, [v])

  if (!ready) return null
  return <GameStage />
}

export default function CombatPreviewPage() {
  if (process.env.NODE_ENV === 'production') notFound()
  return (
    <Suspense fallback={null}>
      <Preview />
    </Suspense>
  )
}
