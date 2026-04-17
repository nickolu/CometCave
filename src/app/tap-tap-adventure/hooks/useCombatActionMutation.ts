'use client'
import { useMutation, useQueryClient } from '@tanstack/react-query'

import { getDifficultyModifiers } from '@/app/tap-tap-adventure/config/difficultyModes'
import { getRegion } from '@/app/tap-tap-adventure/config/regions'
import { DeathPenalty } from '@/app/tap-tap-adventure/lib/deathPenalty'
import { generateHeirloom } from '@/app/tap-tap-adventure/lib/heirloomGenerator'
import { inferItemTypeAndEffects } from '@/app/tap-tap-adventure/lib/itemPostProcessor'
import { checkQuestProgress } from '@/app/tap-tap-adventure/lib/questGenerator'
import { claimNewMilestones, getConqueredCount } from '@/app/tap-tap-adventure/lib/mainQuestManager'
import { CombatAction, CombatState } from '@/app/tap-tap-adventure/models/combat'
import { Mount } from '@/app/tap-tap-adventure/models/mount'
import { FantasyCharacter, Item } from '@/app/tap-tap-adventure/models/types'

import { soundEngine } from '@/app/tap-tap-adventure/lib/soundEngine'

import { useGameStateBuilder, useGameStore } from './useGameStore'

interface CombatActionResponse {
  combatState: CombatState
  rewards?: {
    gold: number
    loot: Item[]
    mountDrop?: Mount
  }
  updatedCharacter: FantasyCharacter
  consumedItemId?: string
  deathPenalty?: DeathPenalty
}

export function useCombatActionMutation(options?: { onMountDrop?: (mount: Mount) => void }) {
  const queryClient = useQueryClient()
  const { getSelectedCharacter, addHeirloom, deleteCharacter, awardSoulEssence, setRunSummary } = useGameStore()
  const {
    addItem,
    addStoryEvent,
    commit,
    setCombatState,
    updateSelectedCharacter,
  } = useGameStateBuilder()

  return useMutation({
    mutationFn: async ({
      action,
      itemId,
      spellId,
    }: {
      action: CombatAction
      itemId?: string
      spellId?: string
    }) => {
      const character = getSelectedCharacter()
      if (!character) throw new Error('No character found')

      const { gameState } = useGameStore.getState()
      const combatState = gameState.combatState
      if (!combatState) throw new Error('No active combat')

      const res = await fetch('/api/v1/tap-tap-adventure/combat/action', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          combatState,
          action: { action, itemId, spellId },
          character,
        }),
      })

      if (!res.ok) {
        const errData = await res.json().catch(() => ({}))
        throw new Error(errData.details || 'Failed to process combat action')
      }

      const data: CombatActionResponse = await res.json()

      // Update character with server state
      if (data.updatedCharacter) {
        updateSelectedCharacter(data.updatedCharacter)
      }

      // Handle consumed item - decrement from inventory
      if (data.consumedItemId) {
        const updatedInventory = character.inventory
          .map(i => {
            if (i.id !== data.consumedItemId) return i
            const newQty = i.quantity - 1
            if (newQty <= 0) return { ...i, quantity: 0, status: 'deleted' as const }
            return { ...i, quantity: newQty }
          })
          .filter(i => i.quantity > 0 || i.status === 'deleted')
        updateSelectedCharacter({ inventory: updatedInventory })
      }

      // Persist HP and mana back to character after every combat turn
      updateSelectedCharacter({
        hp: data.combatState.playerState.hp,
        maxHp: data.combatState.playerState.maxHp,
        mana: data.combatState.playerState.mana,
        maxMana: data.combatState.playerState.maxMana,
      })

      // Sync mount HP back to character
      if (data.combatState.playerState.mountHp !== undefined && character.activeMount) {
        if (data.combatState.playerState.mountHp <= 0) {
          // Mount died in combat
          updateSelectedCharacter({ activeMount: null })
        } else {
          updateSelectedCharacter({
            activeMount: { ...character.activeMount, hp: data.combatState.playerState.mountHp },
          })
        }
      }

      // Sync mercenary HP back to character
      if (data.combatState.playerState.mercenaryHp !== undefined && character.activeMercenary) {
        updateSelectedCharacter({
          activeMercenary: {
            ...character.activeMercenary,
            hp: data.combatState.playerState.mercenaryHp,
          },
        })
      }

      if (data.combatState.status === 'active') {
        // Combat continues — play sounds based on what happened
        // Check for critical hits in new log entries
        const prevLogLen = combatState.combatLog.length
        const newEntries = data.combatState.combatLog.slice(prevLogLen)
        const hasCrit = newEntries.some(e => e.isCritical)
        if (hasCrit) {
          soundEngine.playCritical()
        } else if (action === 'attack' || action === 'heavy_attack' || action === 'class_ability') {
          soundEngine.playHit()
        }
        // If player took damage this turn (enemy attacked), play enemy hit sound
        const prevHp = combatState.playerState.hp
        const newHp = data.combatState.playerState.hp
        if (newHp < prevHp) {
          soundEngine.playEnemyHit()
        }
        setCombatState(data.combatState)
      } else {
        // Combat ended
        const enemy = combatState.enemy

        if (data.combatState.status === 'victory' && data.rewards) {
          soundEngine.playVictory()
          // Add loot items and collect for story event
          const processedLoot: Item[] = []
          for (const lootItem of data.rewards.loot) {
            const processed = inferItemTypeAndEffects(lootItem)
            addItem(processed)
            processedLoot.push(processed)
          }

          // If combat dropped a mount, trigger naming modal or equip directly
          let mountText = ''
          if (data.rewards.mountDrop) {
            const mountDrop = data.rewards.mountDrop
            if (options?.onMountDrop) {
              // Defer equipping until the naming modal resolves
              options.onMountDrop(mountDrop)
              mountText = ` You tamed a ${mountDrop.name}! ${mountDrop.icon}`
            } else {
              const oldMount = character.activeMount
              updateSelectedCharacter({ activeMount: mountDrop })
              soundEngine.playMountAcquired()
              const replacedText = oldMount ? ` (Replaced ${oldMount.name})` : ''
              mountText = ` You tamed a ${mountDrop.name}! ${mountDrop.icon}${replacedText}`
            }
          }

          // Handle boss-gated region travel on victory
          let regionTravelText = ''
          const pendingRegionId = combatState.pendingRegionId
          if (pendingRegionId) {
            const destRegion = getRegion(pendingRegionId)
            const visitedRegions = character.visitedRegions ?? ['green_meadows']
            const updatedVisited = visitedRegions.includes(pendingRegionId)
              ? visitedRegions
              : [...visitedRegions, pendingRegionId]
            updateSelectedCharacter({
              currentRegion: pendingRegionId,
              visitedRegions: updatedVisited,
            })
            regionTravelText = ` You conquered the guardian and entered ${destRegion.icon} ${destRegion.name}!`
          }

          // Reputation gain for combat victory
          const repGain = pendingRegionId ? 3 : 1
          updateSelectedCharacter({ reputation: (character.reputation ?? 0) + repGain })

          // Check main quest milestones
          if (character.mainQuest && character.mainQuest.status === 'active') {
            const updatedVisited = pendingRegionId
              ? [...(character.visitedRegions ?? ['green_meadows']), pendingRegionId]
              : (character.visitedRegions ?? ['green_meadows'])
            const conquered = getConqueredCount(updatedVisited)
            const milestoneGold = claimNewMilestones(character.mainQuest, conquered)
            if (milestoneGold > 0) {
              updateSelectedCharacter({ mainQuest: character.mainQuest })
              // Use fresh gold from store since updateSelectedCharacter has been called multiple times
              const freshChar = useGameStore.getState().gameState.characters.find(c => c.id === character.id)
              if (freshChar) {
                updateSelectedCharacter({ gold: freshChar.gold + milestoneGold })
              }
            } else {
              updateSelectedCharacter({ mainQuest: character.mainQuest })
            }

            // Check if the main quest just completed (final boss victory)
            // claimNewMilestones mutates the mainQuest object in place, so status may now be 'completed'
            const questStatus = (character.mainQuest as { status: string }).status
            if (questStatus === 'completed') {
              const freshChar = useGameStore.getState().gameState.characters.find(c => c.id === character.id)
              const victoryEssence = awardSoulEssence(freshChar ?? character, 5)
              setRunSummary({
                character: freshChar ? { ...freshChar } : { ...character },
                reason: 'victory',
                essenceEarned: victoryEssence,
                heirloom: null,
              })
              // Do NOT delete the character — post-game character persists
            }
          }

          addStoryEvent({
            id: `combat-victory-${Date.now()}`,
            type: pendingRegionId ? 'boss_guardian_victory' : 'combat_victory',
            characterId: character.id,
            locationId: character.locationId,
            timestamp: new Date().toISOString(),
            outcomeDescription: `You defeated ${enemy.name}!${mountText}${regionTravelText}`,
            resourceDelta: {
              gold: data.rewards.gold,
              reputation: repGain,
            },
            rewardItems: processedLoot.length > 0 ? processedLoot : undefined,
          })
        } else if (data.combatState.status === 'defeat') {
          soundEngine.playDefeat()
          const diffMods = getDifficultyModifiers(character.difficultyMode)
          const defeatPendingRegion = combatState.pendingRegionId
          const guardianDefeatText = defeatPendingRegion
            ? ` The guardian of ${getRegion(defeatPendingRegion).name} remains undefeated.`
            : ''

          if (diffMods.permadeath) {
            // Permadeath: delete character permanently
            addStoryEvent({
              id: `combat-permadeath-${Date.now()}`,
              type: 'combat_defeat',
              characterId: character.id,
              locationId: character.locationId,
              timestamp: new Date().toISOString(),
              outcomeDescription: `${character.name} was slain by ${enemy.name}. Permadeath: this character is gone forever.${guardianDefeatText}`,
              resourceDelta: {},
            })

            // Generate an heirloom before deleting
            const heirloom = generateHeirloom(character)
            addHeirloom(heirloom)

            // Award soul essence for the run
            const essenceEarned = awardSoulEssence(character)

            // Show run summary screen
            setRunSummary({
              character: { ...character },
              reason: 'permadeath',
              essenceEarned,
              heirloom,
            })

            // NOTE: deleteCharacter is called AFTER commit() below
            // to prevent commit() from overwriting the deletion with a stale snapshot
          } else {
            const penalty = data.deathPenalty
            const penaltyParts: string[] = []
            if (penalty) {
              if (penalty.goldLost > 0) penaltyParts.push(`${penalty.goldLost} gold`)
              if (penalty.itemsLost > 0)
                penaltyParts.push(
                  `${penalty.itemsLost} item${penalty.itemsLost !== 1 ? 's' : ''} from your inventory`
                )
              penaltyParts.push('some of your reputation')
            }
            const lossDescription =
              penaltyParts.length > 0 ? ` You lost ${penaltyParts.join(', ')}.` : ''

            addStoryEvent({
              id: `combat-defeat-${Date.now()}`,
              type: 'combat_defeat',
              characterId: character.id,
              locationId: character.locationId,
              timestamp: new Date().toISOString(),
              outcomeDescription: `You were defeated by ${enemy.name}.${lossDescription}${guardianDefeatText} (Death #${penalty?.newDeathCount ?? '?'})`,
              resourceDelta: {
                gold: data.rewards?.gold,
                reputation: penalty ? -penalty.reputationLost : undefined,
              },
            })

            // Generate an heirloom from the defeated character
            const heirloom = generateHeirloom(character)
            addHeirloom(heirloom)

            // Award soul essence for the run
            const essenceEarned = awardSoulEssence(character)

            // Show run summary screen
            setRunSummary({
              character: { ...character },
              reason: 'death',
              essenceEarned,
              heirloom,
            })
          }
        } else if (data.combatState.status === 'fled') {
          updateSelectedCharacter({ reputation: character.reputation - 2 })
          const fledPendingRegion = combatState.pendingRegionId
          const fledRegionText = fledPendingRegion
            ? ` The guardian of ${getRegion(fledPendingRegion).name} still blocks the path.`
            : ''
          addStoryEvent({
            id: `combat-fled-${Date.now()}`,
            type: fledPendingRegion ? 'boss_guardian_fled' : 'combat_fled',
            characterId: character.id,
            locationId: character.locationId,
            timestamp: new Date().toISOString(),
            outcomeDescription: `You fled from ${enemy.name}, losing some gold and a bit of your reputation in your haste.${fledRegionText}`,
            resourceDelta: { gold: data.rewards?.gold, reputation: -2 },
          })
        }

        setCombatState(null)

        // Check quest progress after combat ends
        const { gameState: gs } = useGameStore.getState()
        if (gs.activeQuest?.status === 'active') {
          const combatWon = data.combatState.status === 'victory'
          const updatedQuest = checkQuestProgress(gs.activeQuest, data.updatedCharacter, combatWon)
          useGameStore.getState().setActiveQuest(updatedQuest)
        }
      }

      commit()

      // Permadeath deletion must happen AFTER commit() to avoid the stale snapshot overwriting it
      if (data.combatState.status === 'defeat') {
        const diffMods = getDifficultyModifiers(character.difficultyMode)
        if (diffMods.permadeath) {
          deleteCharacter(character.id)
        }
      }

      return data
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['tap-tap-adventure', 'game-state'] })
    },
  })
}
