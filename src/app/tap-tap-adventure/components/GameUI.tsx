'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { LoaderCircle } from 'lucide-react'
import { Button } from '@/app/tap-tap-adventure/components/ui/button'
import { useGameStore } from '@/app/tap-tap-adventure/hooks/useGameStore'
import { useMoveForwardMutation } from '@/app/tap-tap-adventure/hooks/useMoveForwardMutation'
import { useResolveDecisionMutation } from '@/app/tap-tap-adventure/hooks/useResolveDecisionMutation'
import { getGenericTravelMessage } from '@/app/tap-tap-adventure/lib/getGenericTravelMessage'
import { checkAchievements } from '@/app/tap-tap-adventure/lib/achievementTracker'
import { canClaimDailyReward, getDailyReward } from '@/app/tap-tap-adventure/lib/dailyRewardTracker'
import { crossedMilestone, BOSS_MILESTONE_INTERVAL, SHOP_MILESTONE_INTERVAL, STEPS_PER_DAY, calculateDay } from '@/app/tap-tap-adventure/lib/leveling'
import { CROSSROADS_INTERVAL, getRegion } from '@/app/tap-tap-adventure/config/regions'
import type { RegionDifficulty } from '@/app/tap-tap-adventure/config/regions'
import { flipCoin } from '@/app/utils'

import { SKILLS } from '@/app/tap-tap-adventure/config/skills'
import { getSkillBonus } from '@/app/tap-tap-adventure/lib/skillTracker'
import { soundEngine } from '@/app/tap-tap-adventure/lib/soundEngine'

import { DailyRewardPopup } from './DailyRewardPopup'
import { AchievementPanel } from './AchievementPanel'
import { AchievementToastContainer } from './AchievementToast'
import { CombatUI, CombatResult } from './CombatUI'
import { EquipmentPanel } from './EquipmentPanel'
import { InventoryPanel } from './InventoryPanel'
import { QuestPanel } from './QuestPanel'
import { StatAllocationScreen } from './StatAllocationScreen'
import { ShopUI } from './ShopUI'
import { SkillPanel } from './SkillPanel'
import { StoryFeed } from './StoryFeed'

const DIFFICULTY_STYLES: Record<RegionDifficulty, { label: string; color: string }> = {
  easy: { label: 'Easy', color: 'bg-green-900/50 text-green-300 border-green-600/40' },
  medium: { label: 'Medium', color: 'bg-yellow-900/50 text-yellow-300 border-yellow-600/40' },
  hard: { label: 'Hard', color: 'bg-red-900/50 text-red-300 border-red-600/40' },
  very_hard: { label: 'Very Hard', color: 'bg-purple-900/50 text-purple-300 border-purple-600/40' },
}

const ELEMENT_STYLES: Record<string, { color: string }> = {
  nature: { color: 'bg-green-900/40 text-green-300' },
  shadow: { color: 'bg-slate-800/60 text-slate-300' },
  arcane: { color: 'bg-violet-900/40 text-violet-300' },
  fire: { color: 'bg-orange-900/40 text-orange-300' },
  ice: { color: 'bg-cyan-900/40 text-cyan-300' },
  none: { color: 'bg-slate-800/40 text-slate-400' },
}

function getTimeOfDay(distance: number): string {
  const stepInDay = distance % STEPS_PER_DAY
  const fraction = stepInDay / STEPS_PER_DAY
  if (fraction < 0.25) return 'Morning'
  if (fraction < 0.5) return 'Midday'
  if (fraction < 0.75) return 'Afternoon'
  return 'Nightfall'
}

function getTravelButtonMessage({ isLoading, distance }: { isLoading: boolean; distance: number }) {
  if (isLoading)
    return (
      <div className="flex items-center justify-center gap-2 w-full">
        <LoaderCircle className="animate-spin h-5 w-5" />
        <span>Searching for adventure...</span>
      </div>
    )
  if (distance === 0) return 'Start Your Adventure'
  return 'Continue Travelling'
}
export default function GameUI() {
  const {
    gameState,
    getSelectedCharacter,
    setGenericMessage,
    incrementDistance,
    setDecisionPoint,
    setCombatState,
    allocateStatPoints,
    updateAchievements,
    claimDailyReward,
  } = useGameStore()

  const [newlyCompletedIds, setNewlyCompletedIds] = useState<string[]>([])
  const [showDailyReward, setShowDailyReward] = useState(false)

  // Check for daily reward on mount
  useEffect(() => {
    if (gameState && canClaimDailyReward(gameState)) {
      setShowDailyReward(true)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const { mutate: moveForwardMutation, isPending: moveForwardPending } = useMoveForwardMutation()
  const { mutate: resolveDecisionMutation, isPending: resolveDecisionPending } =
    useResolveDecisionMutation()

  const character = getSelectedCharacter()

  const handleResolveDecision = (optionId: string) => {
    resolveDecisionMutation({
      decisionPoint: gameState.decisionPoint!,
      optionId: optionId,
      onSuccess: () => {
        setDecisionPoint(null)
      },
    })
  }

  if (!gameState) return <div className="p-4 text-center">No game found.</div>

  const { selectedCharacterId, storyEvents } = gameState

  if (!selectedCharacterId) {
    return <div>please select a character</div>
  }

  const handleMoveForward = () => {
    soundEngine.playTap()
    const character = getSelectedCharacter()
    const distance = character?.distance ?? 0
    const nextDistance = distance + 1

    // Always call server for milestone events (crossroads, shop, boss)
    const hitsMilestone =
      crossedMilestone(distance, nextDistance, CROSSROADS_INTERVAL) ||
      crossedMilestone(distance, nextDistance, SHOP_MILESTONE_INTERVAL) ||
      crossedMilestone(distance, nextDistance, BOSS_MILESTONE_INTERVAL)

    if (hitsMilestone) {
      moveForwardMutation()
      return
    }

    const shouldDoNothing = flipCoin(0.03, 0.97)
    if (shouldDoNothing) {
      const genericMessage = getGenericTravelMessage()
      setGenericMessage(genericMessage)
      incrementDistance()
    } else {
      moveForwardMutation()
    }
  }

  const [isAutoWalking, setIsAutoWalking] = useState(false)
  const autoWalkTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const autoWalkIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null)

  const clearAutoWalk = useCallback(() => {
    if (autoWalkTimeoutRef.current) {
      clearTimeout(autoWalkTimeoutRef.current)
      autoWalkTimeoutRef.current = null
    }
    if (autoWalkIntervalRef.current) {
      clearInterval(autoWalkIntervalRef.current)
      autoWalkIntervalRef.current = null
    }
    setIsAutoWalking(false)
  }, [])

  // Track newly completed achievements for toast notifications
  const prevCompletedRef = useRef<Set<string>>(new Set(
    (gameState.achievements ?? []).filter(a => a.completed).map(a => a.achievementId)
  ))

  useEffect(() => {
    const currentCompleted = new Set(
      (gameState.achievements ?? []).filter(a => a.completed).map(a => a.achievementId)
    )
    const newOnes: string[] = []
    for (const id of currentCompleted) {
      if (!prevCompletedRef.current.has(id)) {
        newOnes.push(id)
      }
    }
    prevCompletedRef.current = currentCompleted
    if (newOnes.length > 0) {
      setNewlyCompletedIds(newOnes)
    }
  }, [gameState.achievements])

  // Stop auto-walking when an event triggers or server call is pending
  useEffect(() => {
    if (gameState.decisionPoint || gameState.combatState || gameState.shopState || moveForwardPending) {
      clearAutoWalk()
    }
  }, [gameState.decisionPoint, gameState.combatState, gameState.shopState, moveForwardPending, clearAutoWalk])

  // Clean up on unmount
  useEffect(() => {
    return () => {
      clearAutoWalk()
    }
  }, [clearAutoWalk])

  const handlePointerDown = (e: React.PointerEvent) => {
    e.preventDefault()
    const mountSpeed = character?.activeMount?.bonuses?.autoWalkSpeed ?? 1
    const unlockedSkillIds = character?.unlockedSkills ?? []
    const unlockedSkillObjects = SKILLS.filter(s => unlockedSkillIds.includes(s.id))
    const walkSpeedBonus = getSkillBonus(unlockedSkillObjects, 'auto_walk_speed')
    const skillSpeedMultiplier = 1 + walkSpeedBonus.percentage / 100
    const walkInterval = Math.round(300 / (mountSpeed * skillSpeedMultiplier))
    autoWalkTimeoutRef.current = setTimeout(() => {
      setIsAutoWalking(true)
      handleMoveForward()
      autoWalkIntervalRef.current = setInterval(() => {
        handleMoveForward()
      }, walkInterval)
    }, 500)
  }

  const handlePointerUpOrLeave = (e: React.PointerEvent) => {
    e.preventDefault()
    clearAutoWalk()
  }

  return (
    <>
      <AchievementToastContainer achievementIds={newlyCompletedIds} />
      {showDailyReward && character && (
        <DailyRewardPopup
          streak={gameState.dailyReward?.streak ?? 0}
          reward={getDailyReward(gameState.dailyReward?.streak ?? 0)}
          onClaim={() => claimDailyReward()}
          onDismiss={() => setShowDailyReward(false)}
        />
      )}
      {character && (character.pendingStatPoints ?? 0) > 0 && (
        <StatAllocationScreen
          character={character}
          onConfirm={(str, int, lck) => allocateStatPoints(str, int, lck)}
        />
      )}
    <div className="flex flex-col select-none">
      <div className="relative z-10 mx-auto w-full">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 pt-6">
          <div className={'p-4 bg-[#161723] border border-[#3a3c56] rounded-lg space-y-4 overflow-hidden'}>
            {/* Combat UI takes priority */}
            {gameState.combatState && gameState.combatState.status === 'active' ? (
              <CombatUI combatState={gameState.combatState} />
            ) : gameState.combatState && gameState.combatState.status !== 'active' ? (
              <CombatResult
                combatState={gameState.combatState}
                onContinue={() => {
                  const combatState = gameState.combatState
                  if (combatState && combatState.status === 'victory' && character) {
                    const { achievements, newlyCompleted } = checkAchievements(
                      character,
                      gameState,
                      gameState.achievements ?? [],
                      {
                        type: 'combat_win',
                        hpAfterCombat: combatState.playerState.hp,
                        maxHp: combatState.playerState.maxHp,
                        isBoss: combatState.isBoss ?? false,
                      }
                    )
                    updateAchievements(achievements)
                    if (newlyCompleted.length > 0) {
                      setNewlyCompletedIds(newlyCompleted)
                    }
                  } else if (combatState && combatState.status === 'defeat' && character) {
                    const { achievements, newlyCompleted } = checkAchievements(
                      character,
                      gameState,
                      gameState.achievements ?? [],
                      { type: 'death' }
                    )
                    updateAchievements(achievements)
                    if (newlyCompleted.length > 0) {
                      setNewlyCompletedIds(newlyCompleted)
                    }
                  }
                  setCombatState(null)
                }}
              />
            ) : gameState.shopState?.isOpen ? (
              <ShopUI />
            ) : gameState.decisionPoint ? (
              <>
                <h4 className="font-semibold w-full text-center uppercase border-b border-[#3a3c56] pb-2 mb-4">
                  Event
                </h4>
                {!gameState.decisionPoint.resolved && (
                  <div>
                    <div className="font-semibold mb-6 break-words">{gameState.decisionPoint.prompt}</div>
                    {resolveDecisionPending ? (
                      <div className="flex flex-col items-center gap-3 py-6 text-slate-400">
                        <LoaderCircle className="animate-spin h-6 w-6" />
                        <span className="text-sm">Resolving your choice...</span>
                      </div>
                    ) : (
                      <div className="space-y-2 mt-2">
                        {gameState.decisionPoint.options.map((option: { id: string; text: string }) => {
                          if (!option) return null
                          if (!gameState.decisionPoint) return null
                          return (
                            <Button
                              key={option.id}
                              className="block w-full text-left whitespace-normal h-auto border border-[#3a3c56] bg-[#2a2b3f] hover:bg-[#3a3c56] text-white px-3 py-2 mt-2 rounded disabled:opacity-60"
                              disabled={resolveDecisionPending}
                              onClick={() => {
                                handleResolveDecision(option.id)
                              }}
                            >
                              {option.text}
                            </Button>
                          )
                        })}
                      </div>
                    )}
                  </div>
                )}
              </>
            ) : (
              <>
                {/* Region info */}
                {(() => {
                  const dist = character?.distance ?? 0
                  const region = getRegion(character?.currentRegion ?? 'green_meadows')
                  const diff = DIFFICULTY_STYLES[region.difficulty]
                  const elem = ELEMENT_STYLES[region.element] ?? ELEMENT_STYLES.none
                  const day = calculateDay(dist)
                  const timeOfDay = getTimeOfDay(dist)

                  // Milestone calculations
                  const milestones = [
                    { label: 'Crossroads', icon: '🔀', steps: CROSSROADS_INTERVAL - (dist % CROSSROADS_INTERVAL) },
                    { label: 'Shop', icon: '🛒', steps: SHOP_MILESTONE_INTERVAL - (dist % SHOP_MILESTONE_INTERVAL) },
                    { label: 'Boss', icon: '💀', steps: BOSS_MILESTONE_INTERVAL - (dist % BOSS_MILESTONE_INTERVAL) },
                  ].sort((a, b) => a.steps - b.steps).slice(0, 3)

                  return (
                    <div className="space-y-2 mb-1">
                      {/* Region header */}
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="text-lg font-bold">{region.icon} {region.name}</span>
                        <span className={`text-[10px] px-1.5 py-0.5 border rounded ${diff.color}`}>{diff.label}</span>
                        {region.element !== 'none' && (
                          <span className={`text-[10px] px-1.5 py-0.5 rounded ${elem.color}`}>{region.element}</span>
                        )}
                      </div>
                      {/* Atmospheric text */}
                      <p className="text-xs text-slate-400 italic leading-snug">{region.description}</p>
                      {/* Day / time of day */}
                      <p className="text-xs text-slate-500">Day {day} &mdash; {timeOfDay}</p>
                      {/* Milestone indicators */}
                      <div className="flex flex-wrap gap-1.5">
                        {milestones.map(m => (
                          <span key={m.label} className="text-[10px] px-1.5 py-0.5 rounded bg-[#2a2b3f] border border-[#3a3c56] text-slate-300">
                            {m.icon} {m.label}: {m.steps}
                          </span>
                        ))}
                      </div>
                    </div>
                  )
                })()}
                <Button
                  className={`w-full border text-white font-bold text-xl sm:text-2xl py-8 sm:py-10 rounded-xl transition-all duration-300 select-none ${
                    isAutoWalking
                      ? 'bg-gradient-to-r from-emerald-700 to-teal-700 border-emerald-400/30 shadow-lg shadow-emerald-500/20 animate-pulse'
                      : moveForwardPending
                      ? 'bg-gradient-to-r from-indigo-800 to-purple-800 border-indigo-500/20 shadow-none animate-pulse cursor-wait'
                      : 'bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-500 hover:to-purple-500 border-indigo-400/30 shadow-lg shadow-indigo-500/20 hover:shadow-indigo-500/40 active:translate-y-0.5 active:shadow-none'
                  }`}
                  onClick={handleMoveForward}
                  onPointerDown={handlePointerDown}
                  onPointerUp={handlePointerUpOrLeave}
                  onPointerLeave={handlePointerUpOrLeave}
                  onPointerCancel={handlePointerUpOrLeave}
                  disabled={moveForwardPending || resolveDecisionPending}
                >
                  {isAutoWalking
                    ? 'Walking...'
                    : getTravelButtonMessage({
                        isLoading: moveForwardPending,
                        distance: getSelectedCharacter()?.distance ?? 0,
                      })}
                </Button>
                {gameState.genericMessage && (
                  <div className="text-sm">{gameState.genericMessage}</div>
                )}
                <div className="select-text">
                  <StoryFeed events={storyEvents} filterCharacterId={selectedCharacterId} />
                </div>
              </>
            )}
          </div>
          {/* Right column: Quest, Equipment, Achievements & Inventory Panel */}
          <div className="p-4 bg-[#161723] border border-[#3a3c56] rounded-lg space-y-4 h-fit md:sticky md:top-8">
            <QuestPanel />
            <SkillPanel unlockedSkillIds={character?.unlockedSkills ?? []} />
            <AchievementPanel achievements={gameState.achievements ?? []} />
            <EquipmentPanel
              equipment={getSelectedCharacter()?.equipment ?? { weapon: null, armor: null, accessory: null }}
            />
            <div className="border-t border-[#3a3c56] pt-4">
              <InventoryPanel inventory={getSelectedCharacter()?.inventory ?? []} />
            </div>
          </div>
        </div>
        {/* Two-column grid END */}
      </div>
      {/* Main content wrapper END */}
    </div>
    </>
  )
}
