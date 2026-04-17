'use client'
import { produce } from 'immer'
import { create } from 'zustand'
import { persist } from 'zustand/middleware'

import { checkAchievements } from '@/app/tap-tap-adventure/lib/achievementTracker'
import { ACHIEVEMENTS } from '@/app/tap-tap-adventure/config/achievements'
import { clampReputation } from '@/app/tap-tap-adventure/lib/contextBuilder'
import { generateHeirloom } from '@/app/tap-tap-adventure/lib/heirloomGenerator'
import { getMetaBonuses, MetaBonuses } from '@/app/tap-tap-adventure/lib/metaProgressionBonuses'
import { calculateSoulEssence } from '@/app/tap-tap-adventure/lib/soulEssenceCalculator'
import { computeUnlockedSkillIds, computeUnlockedTreeSkillIds } from '@/app/tap-tap-adventure/lib/skillTracker'
import { defaultGameState } from '@/app/tap-tap-adventure/lib/defaultGameState'
import { useItem as applyItemUse } from '@/app/tap-tap-adventure/lib/itemEffects'
import { applyLevelFromDistance, calculateDay, calculateMaxHp, calculateMaxMana } from '@/app/tap-tap-adventure/lib/leveling'
import { checkQuestProgress } from '@/app/tap-tap-adventure/lib/questGenerator'
import { createMainQuest } from '@/app/tap-tap-adventure/lib/mainQuestManager'
import { getUpgradeById } from '@/app/tap-tap-adventure/config/eternalUpgrades'
import { getCampBonuses as computeCampBonuses, getBuildingById, CampBonuses } from '@/app/tap-tap-adventure/config/baseBuildings'
import { getSpellConfigForCharacter } from '@/app/tap-tap-adventure/config/characterOptions'
import { FantasyCharacter } from '@/app/tap-tap-adventure/models/character'
import { CombatState } from '@/app/tap-tap-adventure/models/combat'
import { getEquipmentSlot, EquipmentSlotType } from '@/app/tap-tap-adventure/models/equipment'
import { PlayerAchievement } from '@/app/tap-tap-adventure/models/achievement'
import { Mount } from '@/app/tap-tap-adventure/models/mount'
import { assignMountPersonality, getMountMaxHp } from '@/app/tap-tap-adventure/config/mounts'
import { Mercenary } from '@/app/tap-tap-adventure/models/mercenary'
import { getMercenaryMaxHp } from '@/app/tap-tap-adventure/config/mercenaries'
import { TimedQuest } from '@/app/tap-tap-adventure/models/quest'
import {
  FantasyDecisionPoint,
  FantasyStoryEvent,
  GameState,
  Item,
  MetaProgressionState,
  RunSummaryData,
  ShopState,
} from '@/app/tap-tap-adventure/models/types'
import { claimDailyReward as processDailyRewardClaim, getTodayDateString } from '@/app/tap-tap-adventure/lib/dailyRewardTracker'
import {
  shouldRefreshChallenges,
  refreshChallenges,
  applyProgress as applyDailyChallengeProgress,
  computeBonusReward,
  canClaimBonusReward,
} from '@/app/tap-tap-adventure/lib/dailyChallengeTracker'
import { DailyChallengeType } from '@/app/tap-tap-adventure/models/dailyChallenge'
import { FACTIONS, FactionId } from '@/app/tap-tap-adventure/config/factions'
import { rollWeather, WEATHER_CHANGE_INTERVAL } from '@/app/tap-tap-adventure/config/weather'
import { CRAFTING_RECIPES } from '@/app/tap-tap-adventure/config/craftingRecipes'
import { canCraft, applyCraft } from '@/app/tap-tap-adventure/lib/craftingEngine'
import { getEnchantCost, getEnchantBonusStat, MAX_ENCHANT_LEVEL } from '@/app/tap-tap-adventure/config/enchanting'

const defaultCharacter: FantasyCharacter = {
  id: '',
  playerId: '',
  name: '',
  race: '',
  class: '',
  level: 1,
  abilities: [],
  locationId: '',
  gold: 0,
  reputation: 0,
  distance: 0,
  status: 'active',
  strength: 0,
  intelligence: 0,
  luck: 0,
  hp: 53,
  maxHp: 53,
  inventory: [],
  equipment: { weapon: null, armor: null, accessory: null },
  deathCount: 0,
  pendingStatPoints: 0,
  mana: 20,
  maxMana: 20,
  spellbook: [],
  classData: undefined,
  activeMount: null,
  activeMercenary: null,
  mercenaryRoster: [],
  difficultyMode: 'normal',
  currentRegion: 'green_meadows',
  currentWeather: 'clear',
  visitedRegions: ['green_meadows'],
  mainQuest: createMainQuest(),
  factionReputations: {},
  bestiary: [],
  npcEncounters: {},
}

export interface GameStore {
  gameState: GameState
  addCharacter: (c: Partial<FantasyCharacter>) => void
  allocateStatPoints: (strength: number, intelligence: number, luck: number) => void
  clearGameState: () => void
  deleteCharacter: (id: string) => void
  getSelectedCharacter: () => FantasyCharacter | null
  incrementDistance: () => void
  selectCharacter: (id: string) => void
  setCombatState: (combatState: CombatState | null) => void
  setShopState: (shopState: ShopState | null) => void
  setDecisionPoint: (decisionPoint: FantasyDecisionPoint | null) => void
  setGameState: (gameState: GameState) => void
  setGenericMessage: (message: string) => void
  useItem: (itemId: string) => { message: string; consumed: boolean } | null
  setActiveQuest: (quest: TimedQuest | null) => void
  discardItem: (itemId: string) => void
  restoreItem: (itemId: string) => void
  equipItem: (itemId: string, slot?: EquipmentSlotType) => void
  unequipItem: (slot: EquipmentSlotType) => void
  learnSpell: (itemId: string) => { message: string; learned: boolean } | null
  updateAchievements: (achievements: PlayerAchievement[]) => void
  applyAchievementRewards: (ids: string[]) => void
  setMount: (mount: Mount | null, customName?: string) => void
  damageMountHp: (damage: number) => void
  killMount: () => void
  recruitMercenary: (mercenary: Mercenary) => boolean
  dismissMercenary: (mercenaryId: string) => void
  setActiveMercenary: (mercenaryId: string) => void
  addHeirloom: (item: Item) => void
  claimHeirloom: (itemId: string) => Item | null
  retireCharacter: (characterId: string) => void
  claimDailyReward: () => import('@/app/tap-tap-adventure/lib/dailyRewardTracker').ClaimResult | null
  awardSoulEssence: (character: FantasyCharacter, bonusMultiplier?: number) => number
  purchaseUpgrade: (upgradeId: string) => boolean
  getMetaBonuses: () => MetaBonuses
  upgradeBuilding: (buildingId: string) => boolean
  getCampBonuses: () => CampBonuses
  setRunSummary: (summary: RunSummaryData) => void
  clearRunSummary: () => void
  purchaseFactionGear: (factionId: FactionId, gearId: string) => boolean
  craftItem: (recipeId: string) => { message: string; success: boolean } | null
  enchantItem: (slot: 'weapon' | 'armor' | 'accessory') => { message: string; success: boolean } | null
  updateDailyChallengeProgress: (type: DailyChallengeType, amount: number) => void
  claimDailyChallengeBonus: () => { gold: number; reputation: number } | null
  recordNPCEncounter: (npcId: string, reward?: { gold?: number; reputation?: number }) => void
}

export const useGameStore = create<GameStore>()(
  persist(
    (set, get) => ({
      gameState: defaultGameState,
      addCharacter: c => {
        set(
          produce((state: GameStore) => {
            if (!state.gameState) return
            const characters = state.gameState.characters || []
            if (characters.length >= 5) return
            state.gameState.characters = [...characters, { ...defaultCharacter, ...c }]
          })
        )
      },
      allocateStatPoints: (strength: number, intelligence: number, luck: number) => {
        set(
          produce((state: GameStore) => {
            const selectedCharacter = get().getSelectedCharacter()
            if (!selectedCharacter) return

            const totalAllocated = strength + intelligence + luck
            const pending = selectedCharacter.pendingStatPoints ?? 0
            if (totalAllocated > pending || totalAllocated <= 0) return

            const characterIndex = state.gameState.characters.findIndex(
              char => char.id === selectedCharacter.id
            )
            if (characterIndex === -1) return

            const updatedCharacter = {
              ...selectedCharacter,
              strength: selectedCharacter.strength + strength,
              intelligence: selectedCharacter.intelligence + intelligence,
              luck: selectedCharacter.luck + luck,
              pendingStatPoints: pending - totalAllocated,
            }
            const maxHp = calculateMaxHp(updatedCharacter)
            updatedCharacter.maxHp = maxHp
            // Also increase current HP by the same amount maxHp increased
            const oldMaxHp = selectedCharacter.maxHp ?? maxHp
            updatedCharacter.hp = Math.min(maxHp, (selectedCharacter.hp ?? oldMaxHp) + (maxHp - oldMaxHp))

            // Update maxMana and current mana similarly
            const maxMana = calculateMaxMana(updatedCharacter)
            const oldMaxMana = selectedCharacter.maxMana ?? maxMana
            updatedCharacter.maxMana = maxMana
            updatedCharacter.mana = Math.min(maxMana, (selectedCharacter.mana ?? oldMaxMana) + (maxMana - oldMaxMana))

            state.gameState.characters[characterIndex] = updatedCharacter
          })
        )
      },
      clearGameState: () => set({ gameState: defaultGameState }),
      deleteCharacter: id => {
        set(
          produce((state: GameStore) => {
            if (!state.gameState) return {}
            const characters = state.gameState.characters || []
            const selectedCharacterId = state.gameState.selectedCharacterId ?? ''
            const updatedCharacters = characters.filter((char: FantasyCharacter) => char.id !== id)
            const updatedSelectedCharacterId =
              selectedCharacterId === id ? null : selectedCharacterId

            return {
              gameState: {
                ...state.gameState,
                characters: updatedCharacters,
                selectedCharacterId: updatedSelectedCharacterId,
              },
            }
          })
        )
      },
      getSelectedCharacter: () => {
        const state = get().gameState
        if (!state) return null
        return state.characters?.find(c => c.id === state.selectedCharacterId) ?? null
      },
      incrementDistance: () => {
        set(
          produce((state: GameStore) => {
            const selectedCharacter = get().getSelectedCharacter()
            if (!selectedCharacter) return

            // Refresh daily challenges if date has changed
            const today = getTodayDateString()
            if (shouldRefreshChallenges(state.gameState.dailyChallenges, today)) {
              state.gameState.dailyChallenges = refreshChallenges(
                state.gameState.dailyChallenges,
                today,
                selectedCharacter.level ?? 1
              )
            }
            // Track travel_distance progress
            if (state.gameState.dailyChallenges) {
              state.gameState.dailyChallenges = applyDailyChallengeProgress(
                state.gameState.dailyChallenges,
                'travel_distance',
                1
              )
            }

            const oldDistance = selectedCharacter.distance || 0
            const newDistance = oldDistance + 1
            const metaBonuses = get().getMetaBonuses()
            const campBonuses = get().getCampBonuses()
            let updatedCharacter = applyLevelFromDistance({
              ...selectedCharacter,
              distance: newDistance,
            }, 1, metaBonuses)

            // Mount daily upkeep: deduct gold when a new day boundary is crossed
            const oldDay = calculateDay(oldDistance)
            const newDay = calculateDay(newDistance)
            if (newDay > oldDay && updatedCharacter.activeMount) {
              const rawCost = updatedCharacter.activeMount.dailyCost ?? 0
              const cost = Math.max(0, Math.floor(rawCost * (1 - campBonuses.mountUpkeepDiscountPct / 100)))
              const newGold = updatedCharacter.gold - cost
              if (newGold < 0) {
                // Can't afford upkeep — auto-release mount
                updatedCharacter = { ...updatedCharacter, gold: updatedCharacter.gold, activeMount: null }
              } else {
                updatedCharacter = { ...updatedCharacter, gold: newGold }
              }
            }

            // Mercenary daily upkeep
            if (newDay > oldDay && updatedCharacter.activeMercenary) {
              const mercCost = updatedCharacter.activeMercenary.dailyCost ?? 0
              const mercGold = updatedCharacter.gold - mercCost
              if (mercGold < 0) {
                updatedCharacter = { ...updatedCharacter, activeMercenary: null }
              } else {
                updatedCharacter = { ...updatedCharacter, gold: mercGold }
              }
            }

            // Weather change every WEATHER_CHANGE_INTERVAL distance steps
            if (newDistance % WEATHER_CHANGE_INTERVAL === 0) {
              const newWeather = rollWeather(updatedCharacter.currentRegion ?? 'green_meadows')
              updatedCharacter = { ...updatedCharacter, currentWeather: newWeather }
            }

            state.gameState.characters = state.gameState.characters.map(char =>
              char.id === selectedCharacter.id ? updatedCharacter : char
            )
            // Check quest progress on each step
            if (state.gameState.activeQuest?.status === 'active') {
              state.gameState.activeQuest = checkQuestProgress(
                state.gameState.activeQuest,
                updatedCharacter
              )
            }
            // Check achievements on each step
            const { achievements, newlyCompleted } = checkAchievements(
              updatedCharacter,
              state.gameState,
              state.gameState.achievements ?? []
            )
            state.gameState.achievements = achievements
            // Apply rewards for newly completed achievements
            if (newlyCompleted.length > 0) {
              const characterIndex2 = state.gameState.characters.findIndex(
                char => char.id === updatedCharacter.id
              )
              if (characterIndex2 !== -1) {
                const char = state.gameState.characters[characterIndex2]
                let goldGain = 0
                let repGain = 0
                for (const id of newlyCompleted) {
                  const config = ACHIEVEMENTS.find(a => a.id === id)
                  if (config?.reward) {
                    goldGain += config.reward.gold ?? 0
                    repGain += config.reward.reputation ?? 0
                  }
                  const pa = state.gameState.achievements.find(a => a.achievementId === id)
                  if (pa) pa.rewardClaimed = true
                }
                state.gameState.characters[characterIndex2] = {
                  ...char,
                  gold: char.gold + goldGain,
                  reputation: clampReputation(char.reputation + repGain),
                }
              }
            }
            // Check and unlock passive skills
            const skillIds = computeUnlockedSkillIds(updatedCharacter, achievements)
            if (skillIds.length !== (updatedCharacter.unlockedSkills ?? []).length) {
              const characterIndex = state.gameState.characters.findIndex(
                char => char.id === updatedCharacter.id
              )
              if (characterIndex !== -1) {
                state.gameState.characters[characterIndex] = {
                  ...state.gameState.characters[characterIndex],
                  unlockedSkills: skillIds,
                }
              }
            }
            // Check and unlock class skill tree nodes
            const treeSkillIds = computeUnlockedTreeSkillIds(updatedCharacter)
            if (treeSkillIds.length !== (updatedCharacter.unlockedTreeSkillIds ?? []).length) {
              const characterIndex = state.gameState.characters.findIndex(
                char => char.id === updatedCharacter.id
              )
              if (characterIndex !== -1) {
                state.gameState.characters[characterIndex] = {
                  ...state.gameState.characters[characterIndex],
                  unlockedTreeSkillIds: treeSkillIds,
                }
              }
            }
          })
        )
      },
      setActiveQuest: (quest: TimedQuest | null) => {
        set(
          produce((state: GameStore) => {
            state.gameState.activeQuest = quest
          })
        )
      },
      setGameState: (state: GameState) => set({ gameState: state }),
      selectCharacter: id => {
        set(
          produce((state: GameStore) => {
            const matchingCharacter = state.gameState?.characters?.find(
              (char: FantasyCharacter) => char.id === id
            )
            if (!matchingCharacter) return {}
            return {
              gameState: {
                ...state.gameState,
                selectedCharacterId: id,
                storyEvents: [],
                decisionPoint: null,
                combatState: null,
                shopState: null,
                activeQuest: null,
                genericMessage: null,
              },
            }
          })
        )
      },
      setGenericMessage: (message: string) => {
        set(
          produce((state: GameStore) => {
            const updatedState = {
              gameState: {
                ...state.gameState,
                genericMessage: message,
              },
            }
            return updatedState
          })
        )
      },
      setCombatState: (combatState: CombatState | null) => {
        set(
          produce((state: GameStore) => {
            return {
              gameState: {
                ...state.gameState,
                combatState,
              },
            }
          })
        )
      },
      setShopState: (shopState: ShopState | null) => {
        set(
          produce((state: GameStore) => {
            return {
              gameState: {
                ...state.gameState,
                shopState,
              },
            }
          })
        )
      },
      setDecisionPoint: (decisionPoint: FantasyDecisionPoint | null) => {
        set(
          produce((state: GameStore) => {
            const updatedState = {
              gameState: {
                ...state.gameState,
                decisionPoint: decisionPoint,
              },
            }
            return updatedState
          })
        )
      },
      useItem: (itemId: string) => {
        const selectedCharacter = get().getSelectedCharacter()
        if (!selectedCharacter) return null

        const item = selectedCharacter.inventory.find(i => i.id === itemId)
        if (!item) return null

        const result = applyItemUse(selectedCharacter, item)

        if (result.consumed) {
          set(
            produce((state: GameStore) => {
              const charIndex = state.gameState.characters.findIndex(
                char => char.id === selectedCharacter.id
              )
              if (charIndex === -1) return
              state.gameState.characters[charIndex] = result.character
            })
          )
        }

        return {
          message: result.message,
          consumed: result.consumed,
        }
      },
      discardItem: (itemId: string) => {
        set(
          produce((state: GameStore) => {
            const selectedCharacter = get().getSelectedCharacter()
            if (!selectedCharacter || !selectedCharacter.inventory) return

            const itemIndex = selectedCharacter.inventory.findIndex(item => item.id === itemId)
            if (itemIndex === -1) return

            // Ensure the characters array and the specific character are found for modification
            const characterIndex = state.gameState.characters.findIndex(
              char => char.id === selectedCharacter.id
            )
            if (characterIndex === -1) return

            // Create a new inventory array with the updated item
            const updatedInventory = selectedCharacter.inventory.map((item, index) => {
              if (index === itemIndex) {
                return { ...item, status: 'deleted' as const }
              }
              return item
            })

            // Update the character in the characters array
            state.gameState.characters[characterIndex] = {
              ...selectedCharacter,
              inventory: updatedInventory,
            }
          })
        )
      },
      restoreItem: (itemId: string) => {
        set(
          produce((state: GameStore) => {
            const selectedCharacter = get().getSelectedCharacter()
            if (!selectedCharacter || !selectedCharacter.inventory) return

            const itemIndex = selectedCharacter.inventory.findIndex(item => item.id === itemId)
            if (itemIndex === -1) return

            const characterIndex = state.gameState.characters.findIndex(
              char => char.id === selectedCharacter.id
            )
            if (characterIndex === -1) return

            const updatedInventory = selectedCharacter.inventory.map((item, index) => {
              if (index === itemIndex) {
                // Set status to 'active'. Alternatively, could remove the status property
                // if undefined status means active by default.
                // For clarity and consistency with 'deleted', explicitly setting 'active'.
                return { ...item, status: 'active' as const }
              }
              return item
            })

            state.gameState.characters[characterIndex] = {
              ...selectedCharacter,
              inventory: updatedInventory,
            }
          })
        )
      },
      equipItem: (itemId: string, slot?: EquipmentSlotType) => {
        set(
          produce((state: GameStore) => {
            const selectedCharacter = get().getSelectedCharacter()
            if (!selectedCharacter) return

            const characterIndex = state.gameState.characters.findIndex(
              char => char.id === selectedCharacter.id
            )
            if (characterIndex === -1) return

            const item = selectedCharacter.inventory.find(
              i => i.id === itemId && i.status !== 'deleted'
            )
            if (!item) return

            const targetSlot = slot ?? getEquipmentSlot(item)
            const equipment = selectedCharacter.equipment ?? { weapon: null, armor: null, accessory: null }
            const currentlyEquipped = equipment[targetSlot]

            // Build new inventory: remove the item being equipped, add back old equipped item
            let updatedInventory = selectedCharacter.inventory.filter(i => i.id !== itemId)
            if (currentlyEquipped) {
              updatedInventory = [...updatedInventory, currentlyEquipped]
            }

            state.gameState.characters[characterIndex] = {
              ...selectedCharacter,
              inventory: updatedInventory,
              equipment: {
                ...equipment,
                [targetSlot]: item,
              },
            }
          })
        )
      },
      unequipItem: (slot: EquipmentSlotType) => {
        set(
          produce((state: GameStore) => {
            const selectedCharacter = get().getSelectedCharacter()
            if (!selectedCharacter) return

            const characterIndex = state.gameState.characters.findIndex(
              char => char.id === selectedCharacter.id
            )
            if (characterIndex === -1) return

            const equipment = selectedCharacter.equipment ?? { weapon: null, armor: null, accessory: null }
            const equippedItem = equipment[slot]
            if (!equippedItem) return

            state.gameState.characters[characterIndex] = {
              ...selectedCharacter,
              inventory: [...selectedCharacter.inventory, equippedItem],
              equipment: {
                ...equipment,
                [slot]: null,
              },
            }
          })
        )
      },
      learnSpell: (itemId: string) => {
        const selectedCharacter = get().getSelectedCharacter()
        if (!selectedCharacter) return null

        const item = selectedCharacter.inventory.find(
          i => i.id === itemId && i.status !== 'deleted' && i.type === 'spell_scroll'
        )
        if (!item) return null

        // Check if item has a spell (stored in item description or parsed)
        const spell = (item as Record<string, unknown>).spell
        if (!spell || typeof spell !== 'object') {
          return { message: 'This scroll contains no learnable spell.', learned: false }
        }

        // Check max slots
        const classConfig = getSpellConfigForCharacter(selectedCharacter.class, selectedCharacter.classData)
        const maxSlots = classConfig.maxSlots
        const currentSpells = selectedCharacter.spellbook ?? []
        if (currentSpells.length >= maxSlots) {
          return { message: `Your spellbook is full! (${maxSlots} slots max for ${selectedCharacter.class})`, learned: false }
        }

        // Check if already known
        const spellData = spell as { id: string; name: string }
        if (currentSpells.some(s => s.id === spellData.id)) {
          return { message: `You already know ${spellData.name}.`, learned: false }
        }

        set(
          produce((state: GameStore) => {
            const charIndex = state.gameState.characters.findIndex(
              char => char.id === selectedCharacter.id
            )
            if (charIndex === -1) return

            const updatedSpellbook = [...currentSpells, spell as FantasyCharacter['spellbook'] extends (infer U)[] | undefined ? U : never]
            // Remove the scroll from inventory
            const updatedInventory = selectedCharacter.inventory.map(i => {
              if (i.id !== itemId) return i
              const newQty = i.quantity - 1
              if (newQty <= 0) return { ...i, quantity: 0, status: 'deleted' as const }
              return { ...i, quantity: newQty }
            }).filter(i => i.quantity > 0 || i.status === 'deleted')

            state.gameState.characters[charIndex] = {
              ...selectedCharacter,
              spellbook: updatedSpellbook,
              inventory: updatedInventory,
            }
          })
        )

        return { message: `Learned ${spellData.name}!`, learned: true }
      },
      updateAchievements: (achievements: PlayerAchievement[]) => {
        set(
          produce((state: GameStore) => {
            state.gameState.achievements = achievements
          })
        )
      },
      applyAchievementRewards: (ids: string[]) => {
        if (ids.length === 0) return
        set(
          produce((state: GameStore) => {
            const selectedCharacter = get().getSelectedCharacter()
            if (!selectedCharacter) return
            const characterIndex = state.gameState.characters.findIndex(
              char => char.id === selectedCharacter.id
            )
            if (characterIndex === -1) return
            const char = state.gameState.characters[characterIndex]
            let goldGain = 0
            let repGain = 0
            for (const id of ids) {
              const config = ACHIEVEMENTS.find(a => a.id === id)
              if (config?.reward) {
                goldGain += config.reward.gold ?? 0
                repGain += config.reward.reputation ?? 0
              }
              const pa = state.gameState.achievements?.find(a => a.achievementId === id)
              if (pa) pa.rewardClaimed = true
            }
            state.gameState.characters[characterIndex] = {
              ...char,
              gold: char.gold + goldGain,
              reputation: clampReputation(char.reputation + repGain),
            }
          })
        )
      },
      setMount: (mount: Mount | null, customName?: string) => {
        set(
          produce((state: GameStore) => {
            const selectedCharacter = get().getSelectedCharacter()
            if (!selectedCharacter) return

            const characterIndex = state.gameState.characters.findIndex(
              char => char.id === selectedCharacter.id
            )
            if (characterIndex === -1) return

            const activeMount = mount && customName
              ? { ...mount, customName }
              : mount

            state.gameState.characters[characterIndex] = {
              ...selectedCharacter,
              activeMount,
            }
          })
        )
      },
      damageMountHp: (damage: number) => {
        set(
          produce((state: GameStore) => {
            const selectedCharacter = get().getSelectedCharacter()
            if (!selectedCharacter) return

            const characterIndex = state.gameState.characters.findIndex(
              char => char.id === selectedCharacter.id
            )
            if (characterIndex === -1) return

            const mount = state.gameState.characters[characterIndex].activeMount
            if (!mount) return

            const currentHp = mount.hp ?? mount.maxHp ?? 1
            const newHp = Math.max(0, currentHp - damage)
            state.gameState.characters[characterIndex] = {
              ...state.gameState.characters[characterIndex],
              activeMount: newHp <= 0 ? null : { ...mount, hp: newHp },
            }
          })
        )
      },
      killMount: () => {
        set(
          produce((state: GameStore) => {
            const selectedCharacter = get().getSelectedCharacter()
            if (!selectedCharacter) return

            const characterIndex = state.gameState.characters.findIndex(
              char => char.id === selectedCharacter.id
            )
            if (characterIndex === -1) return

            state.gameState.characters[characterIndex] = {
              ...state.gameState.characters[characterIndex],
              activeMount: null,
            }
          })
        )
      },
      recruitMercenary: (mercenary: Mercenary) => {
        const selectedCharacter = get().getSelectedCharacter()
        if (!selectedCharacter) return false
        if (selectedCharacter.gold < mercenary.recruitCost) return false
        const roster = selectedCharacter.mercenaryRoster ?? []
        if (roster.length >= 3) return false
        if (roster.some(m => m.id === mercenary.id)) return false

        const maxHp = getMercenaryMaxHp(mercenary.rarity)
        const fullMercenary: Mercenary = { ...mercenary, hp: maxHp, maxHp }

        set(
          produce((state: GameStore) => {
            const charIndex = state.gameState.characters.findIndex(
              char => char.id === selectedCharacter.id
            )
            if (charIndex === -1) return
            const char = state.gameState.characters[charIndex]
            const updatedRoster = [...(char.mercenaryRoster ?? []), fullMercenary]
            state.gameState.characters[charIndex] = {
              ...char,
              gold: char.gold - mercenary.recruitCost,
              mercenaryRoster: updatedRoster,
              activeMercenary: char.activeMercenary ?? fullMercenary,
            }
          })
        )
        return true
      },
      dismissMercenary: (mercenaryId: string) => {
        set(
          produce((state: GameStore) => {
            const selectedCharacter = get().getSelectedCharacter()
            if (!selectedCharacter) return
            const charIndex = state.gameState.characters.findIndex(
              char => char.id === selectedCharacter.id
            )
            if (charIndex === -1) return
            const char = state.gameState.characters[charIndex]
            const updatedRoster = (char.mercenaryRoster ?? []).filter(m => m.id !== mercenaryId)
            const updatedActive =
              char.activeMercenary?.id === mercenaryId ? null : char.activeMercenary
            state.gameState.characters[charIndex] = {
              ...char,
              mercenaryRoster: updatedRoster,
              activeMercenary: updatedActive,
            }
          })
        )
      },
      setActiveMercenary: (mercenaryId: string) => {
        set(
          produce((state: GameStore) => {
            const selectedCharacter = get().getSelectedCharacter()
            if (!selectedCharacter) return
            const charIndex = state.gameState.characters.findIndex(
              char => char.id === selectedCharacter.id
            )
            if (charIndex === -1) return
            const char = state.gameState.characters[charIndex]
            const merc = (char.mercenaryRoster ?? []).find(m => m.id === mercenaryId)
            if (!merc) return
            state.gameState.characters[charIndex] = {
              ...char,
              activeMercenary: merc,
            }
          })
        )
      },
      addHeirloom: (item: Item) => {
        set(
          produce((state: GameStore) => {
            if (!state.gameState.legacyHeirlooms) {
              state.gameState.legacyHeirlooms = []
            }
            state.gameState.legacyHeirlooms.push(item)
          })
        )
      },
      claimHeirloom: (itemId: string) => {
        const heirloom = get().gameState.legacyHeirlooms?.find(i => i.id === itemId) ?? null
        if (!heirloom) return null
        set(
          produce((state: GameStore) => {
            state.gameState.legacyHeirlooms = (state.gameState.legacyHeirlooms ?? []).filter(
              i => i.id !== itemId
            )
          })
        )
        return heirloom
      },
      claimDailyReward: () => {
        const state = get().gameState
        const selectedCharacter = get().getSelectedCharacter()
        if (!selectedCharacter) return null

        const result = processDailyRewardClaim(state, selectedCharacter)
        if (!result) return null

        set({ gameState: result.updatedState })
        return result
      },
      retireCharacter: (characterId: string) => {
        set(
          produce((state: GameStore) => {
            const character = state.gameState.characters.find(c => c.id === characterId)
            if (!character || character.status !== 'active') return
            if ((character.distance ?? 0) < 100) return

            // Snapshot character before mutation for the summary screen
            const characterSnapshot = { ...character }

            // Award soul essence before retiring
            const essence = calculateSoulEssence(character)
            const meta = state.gameState.metaProgression ?? {
              soulEssence: 0,
              totalEssenceEarned: 0,
              totalRuns: 0,
              bestDistance: 0,
              bestLevel: 0,
              upgradeLevels: {},
            }
            meta.soulEssence += essence
            meta.totalEssenceEarned += essence
            meta.totalRuns += 1
            meta.bestDistance = Math.max(meta.bestDistance, character.distance ?? 0)
            meta.bestLevel = Math.max(meta.bestLevel, character.level ?? 1)
            state.gameState.metaProgression = meta

            character.status = 'retired'
            const heirloom = generateHeirloom(character)
            if (!state.gameState.legacyHeirlooms) {
              state.gameState.legacyHeirlooms = []
            }
            state.gameState.legacyHeirlooms.push(heirloom)

            // Set run summary for the end-of-run screen
            state.gameState.runSummary = {
              character: characterSnapshot,
              reason: 'retirement',
              essenceEarned: essence,
              heirloom,
            }

            // Deselect if this was the active character
            if (state.gameState.selectedCharacterId === characterId) {
              state.gameState.selectedCharacterId = null
            }
          })
        )
      },
      awardSoulEssence: (character: FantasyCharacter, bonusMultiplier?: number) => {
        const essence = calculateSoulEssence(character) * (bonusMultiplier ?? 1)
        set(
          produce((state: GameStore) => {
            const meta: MetaProgressionState = state.gameState.metaProgression ?? {
              soulEssence: 0,
              totalEssenceEarned: 0,
              totalRuns: 0,
              bestDistance: 0,
              bestLevel: 0,
              upgradeLevels: {},
            }
            meta.soulEssence += essence
            meta.totalEssenceEarned += essence
            meta.totalRuns += 1
            meta.bestDistance = Math.max(meta.bestDistance, character.distance ?? 0)
            meta.bestLevel = Math.max(meta.bestLevel, character.level ?? 1)
            state.gameState.metaProgression = meta
          })
        )
        return essence
      },
      purchaseUpgrade: (upgradeId: string) => {
        const meta = get().gameState.metaProgression
        if (!meta) return false

        const upgrade = getUpgradeById(upgradeId)
        if (!upgrade) return false

        const currentLevel = meta.upgradeLevels[upgradeId] ?? 0
        if (currentLevel >= upgrade.maxLevel) return false

        const cost = upgrade.costPerLevel[currentLevel]
        if (cost === undefined || meta.soulEssence < cost) return false

        set(
          produce((state: GameStore) => {
            if (!state.gameState.metaProgression) return
            state.gameState.metaProgression.soulEssence -= cost
            state.gameState.metaProgression.upgradeLevels[upgradeId] = currentLevel + 1
          })
        )
        return true
      },
      getMetaBonuses: () => {
        const meta = get().gameState.metaProgression
        if (!meta) return getMetaBonuses({})
        return getMetaBonuses(meta.upgradeLevels)
      },
      upgradeBuilding: (buildingId: string) => {
        const selectedCharacter = get().getSelectedCharacter()
        if (!selectedCharacter) return false

        const building = getBuildingById(buildingId)
        if (!building) return false

        const currentLevel = selectedCharacter.campState?.buildingLevels[buildingId] ?? 0
        if (currentLevel >= building.maxLevel) return false

        const cost = building.costPerLevel[currentLevel]
        if (cost === undefined || selectedCharacter.gold < cost) return false

        set(
          produce((state: GameStore) => {
            const charIndex = state.gameState.characters.findIndex(
              char => char.id === selectedCharacter.id
            )
            if (charIndex === -1) return
            const char = state.gameState.characters[charIndex]
            if (!char.campState) {
              char.campState = { buildingLevels: {} }
            }
            char.gold -= cost
            char.campState.buildingLevels[buildingId] = currentLevel + 1
          })
        )
        return true
      },
      getCampBonuses: () => {
        const char = get().getSelectedCharacter()
        return computeCampBonuses(char?.campState?.buildingLevels ?? {})
      },
      setRunSummary: (summary: RunSummaryData) => {
        set(
          produce((state: GameStore) => {
            state.gameState.runSummary = summary
          })
        )
      },
      clearRunSummary: () => {
        set(
          produce((state: GameStore) => {
            state.gameState.runSummary = null
          })
        )
      },
      purchaseFactionGear: (factionId: FactionId, gearId: string) => {
        const selectedCharacter = get().getSelectedCharacter()
        if (!selectedCharacter) return false

        const faction = FACTIONS[factionId]
        if (!faction) return false

        const gear = faction.gear.find(g => g.id === gearId)
        if (!gear) return false

        const factionRep = (selectedCharacter.factionReputations ?? {})[factionId] ?? 0
        if (factionRep < gear.requiredRep) return false
        if (selectedCharacter.gold < gear.price) return false

        const newItem: Item = {
          id: `${gear.id}_${Date.now()}`,
          name: gear.name,
          description: gear.description,
          quantity: 1,
          type: 'equipment',
          effects: gear.effects,
          price: gear.price,
          status: 'active',
        }

        set(
          produce((state: GameStore) => {
            const charIndex = state.gameState.characters.findIndex(
              char => char.id === selectedCharacter.id
            )
            if (charIndex === -1) return
            const char = state.gameState.characters[charIndex]
            char.gold -= gear.price
            char.inventory = [...char.inventory, newItem]
          })
        )
        return true
      },
      craftItem: (recipeId: string) => {
        const selectedCharacter = get().getSelectedCharacter()
        if (!selectedCharacter) return null

        const recipe = CRAFTING_RECIPES.find(r => r.id === recipeId)
        if (!recipe) return null

        if (!canCraft(recipe, selectedCharacter.inventory, selectedCharacter.gold)) {
          return { message: 'Cannot craft: missing ingredients or gold.', success: false }
        }

        const updatedCharacter = applyCraft(selectedCharacter, recipe)

        set(
          produce((state: GameStore) => {
            const charIndex = state.gameState.characters.findIndex(
              char => char.id === selectedCharacter.id
            )
            if (charIndex === -1) return
            state.gameState.characters[charIndex] = updatedCharacter
            // Track craft_item daily challenge progress
            if (state.gameState.dailyChallenges) {
              state.gameState.dailyChallenges = applyDailyChallengeProgress(
                state.gameState.dailyChallenges,
                'craft_item',
                1
              )
            }
          })
        )

        return { message: `Crafted ${recipe.result.name}!`, success: true }
      },
      enchantItem: (slot: 'weapon' | 'armor' | 'accessory') => {
        const selectedCharacter = get().getSelectedCharacter()
        if (!selectedCharacter) return null

        const equipment = selectedCharacter.equipment ?? { weapon: null, armor: null, accessory: null }
        const item = equipment[slot]
        if (!item) return { message: 'No item equipped in that slot.', success: false }

        const currentLevel = item.enchantmentLevel ?? 0
        if (currentLevel >= MAX_ENCHANT_LEVEL) {
          return { message: `${item.name} is already at max enchantment level!`, success: false }
        }

        const cost = getEnchantCost(currentLevel)
        if (cost === null) return { message: 'Cannot enchant further.', success: false }
        if (selectedCharacter.gold < cost) {
          return { message: `Not enough gold! Need ${cost}g.`, success: false }
        }

        const bonusStat = getEnchantBonusStat(item)
        if (!bonusStat) {
          return { message: `${item.name} has no stat to boost.`, success: false }
        }

        const newLevel = currentLevel + 1
        const enchantedItem: Item = {
          ...item,
          enchantmentLevel: newLevel,
          effects: {
            ...item.effects,
            [bonusStat]: (item.effects?.[bonusStat] ?? 0) + 1,
          },
        }

        set(
          produce((state: GameStore) => {
            const charIndex = state.gameState.characters.findIndex(
              char => char.id === selectedCharacter.id
            )
            if (charIndex === -1) return
            const char = state.gameState.characters[charIndex]
            // Deduct gold
            char.gold -= cost
            // Update equipped item
            const currentEquipment = char.equipment ?? { weapon: null, armor: null, accessory: null }
            char.equipment = {
              weapon: currentEquipment.weapon ?? null,
              armor: currentEquipment.armor ?? null,
              accessory: currentEquipment.accessory ?? null,
              [slot]: enchantedItem,
            }
            // Update the same item in inventory (if present by id)
            char.inventory = char.inventory.map(invItem =>
              invItem.id === item.id ? enchantedItem : invItem
            )
          })
        )

        return {
          message: `${enchantedItem.name} +${newLevel} enchanted! (+1 ${bonusStat})`,
          success: true,
        }
      },
      updateDailyChallengeProgress: (type: DailyChallengeType, amount: number) => {
        set(
          produce((state: GameStore) => {
            if (!state.gameState.dailyChallenges) return
            state.gameState.dailyChallenges = applyDailyChallengeProgress(
              state.gameState.dailyChallenges,
              type,
              amount
            )
          })
        )
      },
      claimDailyChallengeBonus: () => {
        const challenges = get().gameState.dailyChallenges
        const selectedCharacter = get().getSelectedCharacter()
        if (!challenges || !selectedCharacter) return null
        if (!canClaimBonusReward(challenges)) return null

        const bonus = computeBonusReward(challenges.streak)
        set(
          produce((state: GameStore) => {
            const charIndex = state.gameState.characters.findIndex(c => c.id === selectedCharacter.id)
            if (charIndex === -1) return
            state.gameState.characters[charIndex].gold += bonus.gold
            state.gameState.characters[charIndex].reputation = clampReputation(
              state.gameState.characters[charIndex].reputation + bonus.reputation
            )
            state.gameState.dailyChallenges!.allCompletedClaimed = true
          })
        )
        return bonus
      },
      recordNPCEncounter: (npcId: string, reward?: { gold?: number; reputation?: number }) => {
        set(
          produce((state: GameStore) => {
            const selectedCharacter = get().getSelectedCharacter()
            if (!selectedCharacter) return
            const charIndex = state.gameState.characters.findIndex(c => c.id === selectedCharacter.id)
            if (charIndex === -1) return

            const encounters = state.gameState.characters[charIndex].npcEncounters ?? {}
            const existing = encounters[npcId] ?? { timesSpoken: 0, disposition: 0 }
            encounters[npcId] = {
              timesSpoken: existing.timesSpoken + 1,
              disposition: Math.min(100, existing.disposition + 5),
            }
            state.gameState.characters[charIndex].npcEncounters = encounters

            if (reward?.gold) {
              state.gameState.characters[charIndex].gold += reward.gold
            }
            if (reward?.reputation) {
              state.gameState.characters[charIndex].reputation = clampReputation(
                state.gameState.characters[charIndex].reputation + reward.reputation
              )
            }
          })
        )
      },
    }),
    {
      name: 'fantasy-tycoon-storage', // localStorage key (kept for backward compat)
      version: 23,
      migrate: (persistedState: unknown) => {
        const state = persistedState as GameStore
        if (state?.gameState && !('combatState' in state.gameState)) {
          (state.gameState as GameState).combatState = null
        }
        if (state?.gameState && !('shopState' in state.gameState)) {
          (state.gameState as GameState).shopState = null
        }
        if (state?.gameState?.characters) {
          for (const char of state.gameState.characters) {
            if (!char.equipment) {
              (char as FantasyCharacter).equipment = { weapon: null, armor: null, accessory: null }
            }
            if (char.deathCount === undefined) {
              (char as FantasyCharacter).deathCount = 0
            }
            // v5: Add persistent HP
            if (char.hp === undefined || char.maxHp === undefined) {
              const maxHp = 50 + (char.strength ?? 5) * 5 + (char.level ?? 1) * 10
              ;(char as FantasyCharacter).hp = maxHp
              ;(char as FantasyCharacter).maxHp = maxHp
            }
            // v6: Add pending stat points
            if (char.pendingStatPoints === undefined) {
              ;(char as FantasyCharacter).pendingStatPoints = 0
            }
            // v7: Add mana and spellbook
            if (char.mana === undefined || char.maxMana === undefined) {
              const maxMana = calculateMaxMana(char as FantasyCharacter)
              ;(char as FantasyCharacter).mana = maxMana
              ;(char as FantasyCharacter).maxMana = maxMana
            }
            if (!char.spellbook) {
              ;(char as FantasyCharacter).spellbook = []
            }
            // v8: Add classData
            if ((char as FantasyCharacter).classData === undefined) {
              ;(char as FantasyCharacter).classData = undefined
            }
            // v10: Add activeMount
            if ((char as FantasyCharacter).activeMount === undefined) {
              ;(char as FantasyCharacter).activeMount = null
            }
            // v11: Add unlockedSkills
            if ((char as FantasyCharacter).unlockedSkills === undefined) {
              ;(char as FantasyCharacter).unlockedSkills = []
            }
            // v12: Add currentRegion
            if ((char as FantasyCharacter).currentRegion === undefined) {
              ;(char as FantasyCharacter).currentRegion = 'green_meadows'
            }
            // v14: Add visitedRegions
            if (!(char as FantasyCharacter).visitedRegions) {
              ;(char as FantasyCharacter).visitedRegions = [(char as FantasyCharacter).currentRegion ?? 'green_meadows']
            }
            // v15: customName is optional on activeMount; no action needed for backward compat
            // v16: Add mainQuest
            if (!(char as FantasyCharacter).mainQuest) {
              ;(char as FantasyCharacter).mainQuest = createMainQuest()
              // Mark milestones as claimed for already-visited regions (no retroactive gold)
              const visited = (char as FantasyCharacter).visitedRegions ?? ['green_meadows']
              const count = visited.filter((r: string) => r !== 'starting_village').length
              for (const m of (char as FantasyCharacter).mainQuest!.milestones) {
                if (count >= m.regionsRequired) m.claimed = true
              }
              if (count >= 12) (char as FantasyCharacter).mainQuest!.status = 'completed'
            }
            // v17: Add mount personality
            if ((char as FantasyCharacter).activeMount && !(char as FantasyCharacter).activeMount!.personality) {
              ;(char as FantasyCharacter).activeMount!.personality = assignMountPersonality()
            }
            // v18: Add mount HP
            if ((char as FantasyCharacter).activeMount && (char as FantasyCharacter).activeMount!.hp === undefined) {
              const rarity = (char as FantasyCharacter).activeMount!.rarity
              const hp = getMountMaxHp(rarity)
              ;(char as FantasyCharacter).activeMount!.hp = hp
              ;(char as FantasyCharacter).activeMount!.maxHp = hp
            }
            // v19: Add unlockedTreeSkillIds
            if ((char as FantasyCharacter).unlockedTreeSkillIds === undefined) {
              ;(char as FantasyCharacter).unlockedTreeSkillIds = []
            }
            // v19: Add campState
            if ((char as FantasyCharacter).campState === undefined) {
              ;(char as FantasyCharacter).campState = { buildingLevels: {} }
            }
            // v20: Add factionReputations
            if ((char as FantasyCharacter).factionReputations === undefined) {
              ;(char as FantasyCharacter).factionReputations = {}
            }
            // v21: crafting system (no per-character migration needed)
            // v21: Add currentWeather
            if ((char as FantasyCharacter).currentWeather === undefined) {
              ;(char as FantasyCharacter).currentWeather = 'clear'
            }
            // v22: Add bestiary
            if (!(char as FantasyCharacter).bestiary) {
              ;(char as FantasyCharacter).bestiary = []
            }
          }
        }
        // v6: Add activeQuest
        if (state?.gameState && !('activeQuest' in state.gameState)) {
          (state.gameState as GameState).activeQuest = null
        }
        // v9: Add achievements
        if (state?.gameState && !('achievements' in state.gameState)) {
          (state.gameState as GameState).achievements = []
        }
        // v10: Add legacyHeirlooms
        if (state?.gameState && !('legacyHeirlooms' in state.gameState)) {
          (state.gameState as GameState).legacyHeirlooms = []
        }
        // v11: Add dailyReward
        if (state?.gameState && !('dailyReward' in state.gameState)) {
          (state.gameState as GameState).dailyReward = null
        }
        // v12: Add metaProgression
        if (state?.gameState && !('metaProgression' in state.gameState)) {
          (state.gameState as GameState).metaProgression = null
        }
        // v13: Add runSummary
        if (state?.gameState && !('runSummary' in state.gameState)) {
          (state.gameState as GameState).runSummary = null
        }
        // v23: Add dailyChallenges
        if (state?.gameState && !('dailyChallenges' in state.gameState)) {
          (state.gameState as GameState).dailyChallenges = null
        }
        return state
      },
    }
  )
)

// Helper to get state with fallback to default
export function useEffectiveGameState(): GameState {
  const state = useGameStore(s => s.gameState)
  return state || defaultGameState
}

export function useGameStateBuilder() {
  const { gameState, setGameState: saveGameState } = useGameStore()

  const gameStateClone = structuredClone(gameState)

  const commit = () => {
    saveGameState(gameStateClone)
  }

  const addItem = (item: Item) => {
    const selectedCharacterId = gameStateClone.selectedCharacterId
    if (!selectedCharacterId) return
    const selectedCharacter = gameStateClone.characters?.find(c => c.id === selectedCharacterId)
    if (!selectedCharacter) return
    selectedCharacter.inventory.push(item)
  }

  const MAX_STORY_EVENTS = 200

  const addStoryEvent = (event: FantasyStoryEvent) => {
    gameStateClone.storyEvents.push(event)
    if (gameStateClone.storyEvents.length > MAX_STORY_EVENTS) {
      gameStateClone.storyEvents = gameStateClone.storyEvents.slice(-MAX_STORY_EVENTS)
    }
  }

  const setCombatState = (combatState: CombatState | null) => {
    gameStateClone.combatState = combatState
  }

  const setShopState = (shopState: ShopState | null) => {
    gameStateClone.shopState = shopState
  }

  const setActiveQuest = (quest: TimedQuest | null) => {
    gameStateClone.activeQuest = quest
  }

  const setDecisionPoint = (decisionPoint: FantasyDecisionPoint | null) => {
    gameStateClone.decisionPoint = decisionPoint
  }

  const setGenericMessage = (message: string | null) => {
    gameStateClone.genericMessage = message
  }

  const updateSelectedCharacter = (characterUpdate: Partial<FantasyCharacter>) => {
    const selectedCharacterId = gameStateClone.selectedCharacterId
    if (!selectedCharacterId || !gameStateClone.characters) return

    const charIndex = gameStateClone.characters.findIndex(c => c.id === selectedCharacterId)
    if (charIndex === -1) return

    // Clamp reputation if it's being updated
    if (characterUpdate.reputation !== undefined) {
      characterUpdate = { ...characterUpdate, reputation: clampReputation(characterUpdate.reputation) }
    }

    // Create a new character object and recalculate level from distance
    const merged = {
      ...gameStateClone.characters[charIndex],
      ...characterUpdate,
    }
    gameStateClone.characters[charIndex] = applyLevelFromDistance(merged)
  }

  return {
    gameState: gameStateClone,
    commit,
    addItem,
    addStoryEvent,
    setCombatState,
    setShopState,
    setActiveQuest,
    setDecisionPoint,
    setGenericMessage,
    updateSelectedCharacter,
  }
}
