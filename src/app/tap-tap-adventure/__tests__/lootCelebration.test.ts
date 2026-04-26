import { describe, expect, it, beforeEach } from 'vitest'
import { defaultGameState } from '@/app/tap-tap-adventure/lib/defaultGameState'
import { Item } from '@/app/tap-tap-adventure/models/item'
import { GameState } from '@/app/tap-tap-adventure/models/types'

// Helper: create a fresh game state clone
function makeGameState(): GameState {
  return structuredClone(defaultGameState)
}

// Helper: simulate what addItem() does in useGameStateBuilder
function simulateAddItem(gameState: GameState, item: Item) {
  const char = gameState.characters[0]
  if (!char) return
  char.inventory.push(item)
  if (!gameState.newItemIds) gameState.newItemIds = []
  gameState.newItemIds.push(item.id)
  if (item.rarity === 'epic' || item.rarity === 'legendary') {
    gameState.pendingLootCelebration = item
  }
}

// Helper: simulate dismissLootCelebration
function simulateDismiss(gameState: GameState) {
  gameState.pendingLootCelebration = null
}

// Helper: simulate clearNewItemId
function simulateClearNewItem(gameState: GameState, itemId: string) {
  gameState.newItemIds = (gameState.newItemIds ?? []).filter(id => id !== itemId)
}

const baseItem: Item = {
  id: 'item-1',
  name: 'Iron Sword',
  description: 'A basic sword.',
  quantity: 1,
  type: 'equipment',
  effects: { strength: 3 },
}

const epicItem: Item = {
  id: 'item-epic-1',
  name: 'Blade of Shadows',
  description: 'A powerful blade.',
  quantity: 1,
  type: 'equipment',
  rarity: 'epic',
  effects: { strength: 10 },
}

const legendaryItem: Item = {
  id: 'item-leg-1',
  name: 'Dragon Slayer',
  description: 'A legendary weapon.',
  quantity: 1,
  type: 'equipment',
  rarity: 'legendary',
  effects: { strength: 20 },
}

const rareItem: Item = {
  id: 'item-rare-1',
  name: 'Silver Dagger',
  description: 'A rare dagger.',
  quantity: 1,
  type: 'equipment',
  rarity: 'rare',
  effects: { luck: 5 },
}

const commonItem: Item = {
  id: 'item-common-1',
  name: 'Wooden Club',
  description: 'A plain club.',
  quantity: 1,
  type: 'equipment',
  rarity: 'common',
  effects: { strength: 1 },
}

const uncommonItem: Item = {
  id: 'item-uncommon-1',
  name: 'Leather Vest',
  description: 'A simple vest.',
  quantity: 1,
  type: 'equipment',
  rarity: 'uncommon',
  effects: { strength: 2 },
}

describe('loot celebration state', () => {
  let gameState: GameState

  beforeEach(() => {
    gameState = makeGameState()
    // Add a character so addItem has a target
    const char = {
      id: 'char-1',
      playerId: 'player-1',
      name: 'Hero',
      race: 'Human',
      class: 'Warrior',
      level: 1,
      abilities: [],
      locationId: 'loc-1',
      gold: 100,
      reputation: 0,
      distance: 0,
      status: 'active' as const,
      strength: 5,
      intelligence: 3,
      luck: 2,
      charisma: 5,
      hp: 100,
      maxHp: 100,
      inventory: [],
      equipment: { weapon: null, armor: null, accessory: null },
      deathCount: 0,
      pendingStatPoints: 0,
      mana: 20,
      maxMana: 20,
      spellbook: [],
      activeMount: null,
      activeMercenary: null,
      mercenaryRoster: [],
      difficultyMode: 'normal' as const,
      currentRegion: 'green_meadows',
      currentWeather: 'clear' as const,
      visitedRegions: ['green_meadows'],
      mainQuest: null,
      factionReputations: {},
      bestiary: [],
      npcEncounters: {},
    }
    gameState.characters = [char]
    gameState.selectedCharacterId = 'char-1'
  })

  describe('pendingLootCelebration', () => {
    it('starts as null', () => {
      expect(gameState.pendingLootCelebration).toBeNull()
    })

    it('is set when an epic item is added', () => {
      simulateAddItem(gameState, epicItem)
      expect(gameState.pendingLootCelebration).not.toBeNull()
      expect(gameState.pendingLootCelebration?.id).toBe(epicItem.id)
      expect(gameState.pendingLootCelebration?.rarity).toBe('epic')
    })

    it('is set when a legendary item is added', () => {
      simulateAddItem(gameState, legendaryItem)
      expect(gameState.pendingLootCelebration).not.toBeNull()
      expect(gameState.pendingLootCelebration?.id).toBe(legendaryItem.id)
      expect(gameState.pendingLootCelebration?.rarity).toBe('legendary')
    })

    it('is NOT set for common items', () => {
      simulateAddItem(gameState, commonItem)
      expect(gameState.pendingLootCelebration).toBeNull()
    })

    it('is NOT set for uncommon items', () => {
      simulateAddItem(gameState, uncommonItem)
      expect(gameState.pendingLootCelebration).toBeNull()
    })

    it('is NOT set for rare items (only epic/legendary trigger modal)', () => {
      simulateAddItem(gameState, rareItem)
      expect(gameState.pendingLootCelebration).toBeNull()
    })

    it('is NOT set for items with no rarity field', () => {
      simulateAddItem(gameState, baseItem)
      expect(gameState.pendingLootCelebration).toBeNull()
    })
  })

  describe('dismissLootCelebration', () => {
    it('clears pendingLootCelebration when dismissed', () => {
      simulateAddItem(gameState, epicItem)
      expect(gameState.pendingLootCelebration).not.toBeNull()

      simulateDismiss(gameState)
      expect(gameState.pendingLootCelebration).toBeNull()
    })

    it('is safe to call when no celebration is pending', () => {
      expect(gameState.pendingLootCelebration).toBeNull()
      simulateDismiss(gameState)
      expect(gameState.pendingLootCelebration).toBeNull()
    })
  })

  describe('newItemIds tracking', () => {
    it('starts empty', () => {
      expect(gameState.newItemIds).toEqual([])
    })

    it('adds item id when any item is added', () => {
      simulateAddItem(gameState, commonItem)
      expect(gameState.newItemIds).toContain(commonItem.id)
    })

    it('tracks epic item ids', () => {
      simulateAddItem(gameState, epicItem)
      expect(gameState.newItemIds).toContain(epicItem.id)
    })

    it('tracks legendary item ids', () => {
      simulateAddItem(gameState, legendaryItem)
      expect(gameState.newItemIds).toContain(legendaryItem.id)
    })

    it('tracks multiple items', () => {
      simulateAddItem(gameState, commonItem)
      simulateAddItem(gameState, epicItem)
      expect(gameState.newItemIds).toContain(commonItem.id)
      expect(gameState.newItemIds).toContain(epicItem.id)
      expect(gameState.newItemIds).toHaveLength(2)
    })

    it('clearNewItemId removes only the specified item', () => {
      simulateAddItem(gameState, commonItem)
      simulateAddItem(gameState, epicItem)
      simulateClearNewItem(gameState, commonItem.id)
      expect(gameState.newItemIds).not.toContain(commonItem.id)
      expect(gameState.newItemIds).toContain(epicItem.id)
    })

    it('clearNewItemId is safe to call for unknown item id', () => {
      simulateAddItem(gameState, commonItem)
      simulateClearNewItem(gameState, 'non-existent-id')
      expect(gameState.newItemIds).toContain(commonItem.id)
    })

    it('clearNewItemId on last item leaves empty array', () => {
      simulateAddItem(gameState, commonItem)
      simulateClearNewItem(gameState, commonItem.id)
      expect(gameState.newItemIds).toHaveLength(0)
    })
  })

  describe('defaultGameState fields', () => {
    it('defaultGameState has pendingLootCelebration as null', () => {
      const fresh = makeGameState()
      expect(fresh.pendingLootCelebration).toBeNull()
    })

    it('defaultGameState has newItemIds as empty array', () => {
      const fresh = makeGameState()
      expect(fresh.newItemIds).toEqual([])
    })
  })
})
