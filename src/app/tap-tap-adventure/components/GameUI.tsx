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
import { crossedMilestone, SHOP_MILESTONE_INTERVAL, STEPS_PER_DAY, calculateDay } from '@/app/tap-tap-adventure/lib/leveling'
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
import { MainQuestPanel } from './MainQuestPanel'
import { StatAllocationScreen } from './StatAllocationScreen'
import { ShopUI } from './ShopUI'
import { StoryFeed } from './StoryFeed'
import { RegionMap } from './RegionMap'
import { SettingsPanel } from './SettingsPanel'
import { KeyboardHelp } from './KeyboardHelp'
import { OnboardingHint } from './OnboardingHint'
import { SkillPanel } from './SkillPanel'
import { useOnboarding, HintKey } from '@/app/tap-tap-adventure/hooks/useOnboarding'

const DIFFICULTY_STYLES: Record<RegionDifficulty, { label: string; color: string }> = {
  easy: { label: 'Easy', color: 'bg-green-900/50 text-green-300 border-green-600/40' },
  medium: { label: 'Medium', color: 'bg-yellow-900/50 text-yellow-300 border-yellow-600/40' },
  hard: { label: 'Hard', color: 'bg-red-900/50 text-red-300 border-red-600/40' },
  very_hard: { label: 'Very Hard', color: 'bg-purple-900/50 text-purple-300 border-purple-600/40' },
  extreme: { label: 'Extreme', color: 'bg-purple-950/70 text-purple-200 border-purple-400/50' },
}

const ELEMENT_STYLES: Record<string, { color: string }> = {
  nature: { color: 'bg-green-900/40 text-green-300' },
  shadow: { color: 'bg-slate-800/60 text-slate-300' },
  arcane: { color: 'bg-violet-900/40 text-violet-300' },
  fire: { color: 'bg-orange-900/40 text-orange-300' },
  ice: { color: 'bg-cyan-900/40 text-cyan-300' },
  none: { color: 'bg-slate-800/40 text-slate-400' },
}

const ONBOARDING_HINTS: Record<HintKey, { title: string; body: string }> = {
  'first-tap': {
    title: 'Welcome, Adventurer!',
    body: 'Tap or hold the travel button to explore the world. Events will appear as you journey forward!',
  },
  'first-combat': {
    title: 'Combat Begins!',
    body: 'You have Action Points (AP) each turn. Attacks, spells, and abilities each cost AP. Plan your moves carefully — when your AP runs out, your turn ends!',
  },
  'first-item': {
    title: 'Item Found!',
    body: 'Check your inventory to equip or use items. Weapons and armor make you stronger — open your equipment panel to gear up!',
  },
  'first-crossroads': {
    title: 'Choose Your Path',
    body: 'A decision lies ahead! Choose wisely — harder paths offer better rewards, but greater danger.',
  },
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
type MobilePanel = 'equipment' | 'inventory' | 'quest' | 'map' | 'settings' | null

interface GameUIProps {
  onOpenStatus?: () => void
}

export default function GameUI({ onOpenStatus }: GameUIProps) {
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
  const [mobilePanel, setMobilePanel] = useState<MobilePanel>(null)
  const [showKeyboardHelp, setShowKeyboardHelp] = useState(false)

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

  const { hasSeenHint, markHintSeen } = useOnboarding(character?.id)

  // Determine which onboarding hint to show (priority order)
  const activeHint: HintKey | null = (() => {
    if (!character) return null
    if (gameState.combatState?.status === 'active' && !hasSeenHint('first-combat')) return 'first-combat'
    if (gameState.decisionPoint && !hasSeenHint('first-crossroads')) return 'first-crossroads'
    if (character.inventory.length > 0 && !hasSeenHint('first-item')) return 'first-item'
    if (character.distance === 0 && !hasSeenHint('first-tap')) return 'first-tap'
    return null
  })()

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
    if (moveForwardPending) return
    soundEngine.playTap()
    const character = getSelectedCharacter()
    const distance = character?.distance ?? 0
    const nextDistance = distance + 1

    // Always call server for milestone events (crossroads, shop)
    const hitsMilestone =
      crossedMilestone(distance, nextDistance, CROSSROADS_INTERVAL) ||
      crossedMilestone(distance, nextDistance, SHOP_MILESTONE_INTERVAL)

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

  // Keyboard shortcuts
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Ignore when typing in inputs
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return

      // ? — toggle keyboard help
      if (e.key === '?') {
        setShowKeyboardHelp(prev => !prev)
        return
      }

      // Escape — close overlays
      if (e.key === 'Escape') {
        if (showKeyboardHelp) { setShowKeyboardHelp(false); return }
        setMobilePanel(null)
        return
      }

      // During decision point — 1-4 to pick options
      if (gameState.decisionPoint && !gameState.decisionPoint.resolved && !resolveDecisionPending) {
        const num = parseInt(e.key, 10)
        if (num >= 1 && num <= gameState.decisionPoint.options.length) {
          e.preventDefault()
          handleResolveDecision(gameState.decisionPoint.options[num - 1].id)
        }
        return
      }

      // During combat or shop — let those components handle their own shortcuts
      if (gameState.combatState?.status === 'active' || gameState.shopState?.isOpen) return

      // Travel mode — Space or Enter to move forward
      if ((e.key === ' ' || e.key === 'Enter') && !moveForwardPending) {
        e.preventDefault()
        handleMoveForward()
      }
    }

    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  })

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
      {showKeyboardHelp && <KeyboardHelp onClose={() => setShowKeyboardHelp(false)} />}
      {showDailyReward && character && (
        <DailyRewardPopup
          streak={gameState.dailyReward?.streak ?? 0}
          reward={getDailyReward(gameState.dailyReward?.streak ?? 0)}
          onClaim={() => claimDailyReward()}
          onDismiss={() => setShowDailyReward(false)}
        />
      )}
      {activeHint && (
        <OnboardingHint
          title={ONBOARDING_HINTS[activeHint].title}
          body={ONBOARDING_HINTS[activeHint].body}
          onDismiss={() => markHintSeen(activeHint)}
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
                <h4 className={`font-semibold w-full text-center uppercase border-b pb-2 mb-4 ${
                  gameState.decisionPoint?.isLegendary
                    ? 'text-amber-400 border-amber-500/50'
                    : 'border-[#3a3c56]'
                }`}>
                  {gameState.decisionPoint?.isLegendary ? '✨ Legendary Encounter ✨' : 'Event'}
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
                        {gameState.decisionPoint.options.map((option: { id: string; text: string; successEffects?: { reputation?: number }; failureEffects?: { reputation?: number }; effects?: { reputation?: number } }, index: number) => {
                          if (!option) return null
                          if (!gameState.decisionPoint) return null
                          return (
                            <Button
                              key={option.id}
                              className="block w-full text-left whitespace-normal h-auto border border-[#3a3c56] bg-[#2a2b3f] hover:bg-[#3a3c56] text-white px-3 py-3 text-base mt-2 rounded disabled:opacity-60"
                              disabled={resolveDecisionPending}
                              onClick={() => {
                                handleResolveDecision(option.id)
                              }}
                            >
                              <span className="hidden sm:inline text-slate-400 mr-2 text-xs font-mono">[{index + 1}]</span>
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
                  ].sort((a, b) => a.steps - b.steps)

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
          {/* Right column: Quest, Equipment, Achievements & Inventory Panel — hidden on mobile */}
          <div className="hidden md:block p-4 bg-[#161723] border border-[#3a3c56] rounded-lg space-y-4 h-fit md:sticky md:top-8">
            {character && <MainQuestPanel character={character} />}
            <QuestPanel />
            <AchievementPanel achievements={gameState.achievements ?? []} />
            <EquipmentPanel
              equipment={getSelectedCharacter()?.equipment ?? { weapon: null, armor: null, accessory: null }}
            />
            <div className="border-t border-[#3a3c56] pt-4">
              <InventoryPanel inventory={getSelectedCharacter()?.inventory ?? []} />
            </div>
            <div className="border-t border-[#3a3c56] pt-4">
              <RegionMap
                currentRegionId={character?.currentRegion ?? 'green_meadows'}
                characterLevel={character?.level ?? 1}
              />
            </div>
            <div className="border-t border-[#3a3c56] pt-4">
              <SkillPanel
                unlockedSkillIds={getSelectedCharacter()?.unlockedSkills ?? []}
                classSkillTree={getSelectedCharacter()?.classSkillTree}
                unlockedTreeSkillIds={getSelectedCharacter()?.unlockedTreeSkillIds ?? []}
                characterLevel={getSelectedCharacter()?.level ?? 1}
              />
            </div>
            <div className="border-t border-[#3a3c56] pt-4">
              <SettingsPanel />
            </div>
          </div>
        </div>
        {/* Two-column grid END */}
      </div>
      {/* Main content wrapper END */}

      {/* Mobile bottom drawer overlay */}
      {mobilePanel && (
        <div className="md:hidden fixed inset-0 z-40" onClick={() => setMobilePanel(null)}>
          <div className="absolute inset-0 bg-black/50" />
          <div
            className="absolute bottom-14 left-0 right-0 max-h-[70vh] overflow-y-auto bg-[#161723] border-t border-[#3a3c56] rounded-t-xl p-4 space-y-4"
            onClick={e => e.stopPropagation()}
          >
            <div className="flex justify-between items-center mb-2">
              <h3 className="text-sm font-semibold text-slate-300 uppercase">
                {mobilePanel === 'equipment' ? 'Equipment' : mobilePanel === 'inventory' ? 'Inventory' : mobilePanel === 'map' ? 'Map' : mobilePanel === 'settings' ? 'Settings' : 'Quest'}
              </h3>
              <button
                className="text-slate-400 hover:text-white text-sm px-2 py-1"
                onClick={() => setMobilePanel(null)}
              >
                Close
              </button>
            </div>
            {mobilePanel === 'quest' && character && <MainQuestPanel character={character} />}
            {mobilePanel === 'quest' && <QuestPanel />}
            {mobilePanel === 'equipment' && (
              <>
                <EquipmentPanel
                  equipment={getSelectedCharacter()?.equipment ?? { weapon: null, armor: null, accessory: null }}
                />
                <AchievementPanel achievements={gameState.achievements ?? []} />
              </>
            )}
            {mobilePanel === 'inventory' && (
              <InventoryPanel inventory={getSelectedCharacter()?.inventory ?? []} />
            )}
            {mobilePanel === 'map' && (
              <RegionMap
                currentRegionId={character?.currentRegion ?? 'green_meadows'}
                characterLevel={character?.level ?? 1}
              />
            )}
            {mobilePanel === 'settings' && <SettingsPanel />}
          </div>
        </div>
      )}

      {/* Mobile bottom tab bar */}
      <div className="md:hidden fixed bottom-0 left-0 right-0 z-50 flex bg-[#1a1b2e] border-t border-slate-700">
        {([
          { id: 'equipment' as MobilePanel, label: 'Equip', icon: '\u2694' },
          { id: 'inventory' as MobilePanel, label: 'Items', icon: '\uD83C\uDF92' },
          { id: 'quest' as MobilePanel, label: 'Quest', icon: '\uD83D\uDCDC' },
          { id: 'map' as MobilePanel, label: 'Map', icon: '\uD83D\uDDFA' },
          { id: 'settings' as MobilePanel, label: 'Settings', icon: '\u2699' },
        ]).map(tab => (
          <button
            key={tab.id}
            className={`flex-1 flex flex-col items-center py-2 text-xs transition-colors ${
              mobilePanel === tab.id
                ? 'text-indigo-400 bg-[#2a2b3f]'
                : 'text-slate-400 hover:text-slate-200'
            }`}
            onClick={() => setMobilePanel(mobilePanel === tab.id ? null : tab.id)}
          >
            <span className="text-lg leading-none">{tab.icon}</span>
            <span className="mt-0.5">{tab.label}</span>
          </button>
        ))}
        <button
          className="flex-1 flex flex-col items-center py-2 text-xs transition-colors text-slate-400 hover:text-slate-200"
          onClick={() => onOpenStatus?.()}
        >
          <span className="text-lg leading-none">&#x1F4CA;</span>
          <span className="mt-0.5">Status</span>
        </button>
      </div>
      {/* Bottom padding spacer for mobile tab bar */}
      <div className="md:hidden h-14" />
    </div>
    </>
  )
}
