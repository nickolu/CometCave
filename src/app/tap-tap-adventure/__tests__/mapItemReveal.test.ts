import { describe, expect, it } from 'vitest'

import { discoveryTier } from '@/app/tap-tap-adventure/lib/discovery'
import { useItem } from '@/app/tap-tap-adventure/lib/itemEffects'
import { FantasyCharacter } from '@/app/tap-tap-adventure/models/character'
import { Item } from '@/app/tap-tap-adventure/models/item'

const landmark = (name: string, distanceFromEntry: number, extra: Partial<NonNullable<FantasyCharacter['landmarkState']>['landmarks'][number]> = {}) => ({
  templateId: name.toLowerCase().replace(/\s+/g, '-'),
  name,
  type: 'ruin',
  description: '',
  icon: '🏚️',
  hasShop: false,
  encounterPrompt: '',
  distanceFromEntry,
  hidden: false,
  isSecret: false,
  explored: false,
  position: { x: distanceFromEntry, y: 250 },
  ...extra,
})

const character = (landmarks: ReturnType<typeof landmark>[], activeTargetIndex: number): FantasyCharacter => ({
  id: '1',
  playerId: 'p1',
  name: 'Test',
  race: 'Human',
  class: 'Warrior',
  level: 1,
  abilities: [],
  locationId: 'loc1',
  gold: 50,
  reputation: 10,
  distance: 5,
  status: 'active',
  strength: 5,
  intelligence: 5,
  luck: 5,
  charisma: 5,
  hp: 50,
  maxHp: 100,
  inventory: [map],
  deathCount: 0,
  pendingStatPoints: 0,
  difficultyMode: 'normal',
  currentRegion: 'green_meadows',
  currentWeather: 'clear',
  factionReputations: {},
  bounty: 0,
  mountRoster: [],
  mailbox: [],
  pendingReplies: [],
  visitedTowns: [],
  party: [],
  landmarkState: {
    regionId: 'green_meadows',
    landmarks,
    entryDistance: 0,
    nextLandmarkIndex: activeTargetIndex,
    activeTargetIndex,
    exploring: false,
    explorationDepth: 0,
    positionInRegion: 10,
    regionLength: 200,
    position: { x: 10, y: 250 },
    exitPositions: [{ regionId: 'dark_forest', name: 'Road east', icon: '🌲', position: { x: 480, y: 250 } }],
    regionBounds: { width: 500, height: 500 },
  },
})

const map: Item = { id: 'map', name: 'Treasure Map', description: '', quantity: 1, type: 'consumable', effects: { revealLandmark: true } }

describe('a map or chart from the shop', () => {
  it('reveals a hidden place, marks it mapped and says which one', () => {
    const c = character([landmark('Near Well', 40), landmark('Lost Shrine', 180, { hidden: true })], 0)
    const result = useItem(c, map)
    expect(result.consumed).toBe(true)
    expect(result.revealedLandmark).toEqual({ index: 1, name: 'Lost Shrine' })
    const shrine = result.character.landmarkState!.landmarks[1]
    expect(shrine.hidden).toBe(false)
    expect(shrine.mapped).toBe(true)
    // 170 km off, it would be off the map by distance alone; mapped keeps it drawn by name.
    expect(discoveryTier(170, shrine)).toBe('revealed')
    expect(discoveryTier(170, { ...shrine, mapped: false })).toBe('hidden')
  })

  it('adds a new place when nothing is hidden and keeps the target pointing at the same place', () => {
    const c = character([landmark('Near Well', 40), landmark('Far Tower', 190)], 1)
    const result = useItem(c, map)
    const ls = result.character.landmarkState!
    expect(result.revealedLandmark).toBeDefined()
    expect(ls.landmarks).toHaveLength(3)
    const added = ls.landmarks[result.revealedLandmark!.index]
    expect(added.name).toBe(result.revealedLandmark!.name)
    expect(added.mapped).toBe(true)
    // The target was Far Tower; whatever slot it moved to, it is still the target.
    expect(ls.landmarks[ls.activeTargetIndex!].name).toBe('Far Tower')
    expect(ls.nextLandmarkIndex).toBe(ls.activeTargetIndex)
  })

  it('keeps an exit target as the exit after a new place is inserted', () => {
    const c = character([landmark('Near Well', 40), landmark('Far Tower', 190)], 2)
    const result = useItem(c, map)
    const ls = result.character.landmarkState!
    expect(ls.landmarks).toHaveLength(3)
    expect(ls.activeTargetIndex).toBe(3) // exits sit past the last landmark
  })
})
