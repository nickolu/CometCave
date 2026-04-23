'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { LoaderCircle } from 'lucide-react'
import { Button } from '@/app/tap-tap-adventure/components/ui/button'
import { useGameStore, useGameStateBuilder } from '@/app/tap-tap-adventure/hooks/useGameStore'
import { useMoveForwardMutation } from '@/app/tap-tap-adventure/hooks/useMoveForwardMutation'
import { useResolveDecisionMutation } from '@/app/tap-tap-adventure/hooks/useResolveDecisionMutation'
import { getGenericTravelMessage } from '@/app/tap-tap-adventure/lib/getGenericTravelMessage'
import { checkAchievements } from '@/app/tap-tap-adventure/lib/achievementTracker'
import { canClaimDailyReward, getDailyReward } from '@/app/tap-tap-adventure/lib/dailyRewardTracker'
import { crossedMilestone, SHOP_MILESTONE_INTERVAL, STEPS_PER_DAY, calculateDay } from '@/app/tap-tap-adventure/lib/leveling'
import { getRegion, REGIONS, canEnterRegion } from '@/app/tap-tap-adventure/config/regions'
import type { RegionDifficulty } from '@/app/tap-tap-adventure/config/regions'
import { rollWeather } from '@/app/tap-tap-adventure/config/weather'
import { flipCoin } from '@/app/utils'
import { hasArrived, moveToward } from '@/app/tap-tap-adventure/lib/movementUtils'

import { SKILLS } from '@/app/tap-tap-adventure/config/skills'
import { getSkillBonus } from '@/app/tap-tap-adventure/lib/skillTracker'
import { soundEngine } from '@/app/tap-tap-adventure/lib/soundEngine'

import { FloatingResources, ResourceEvent } from './FloatingResources'
import { RareLootCelebration } from './RareLootCelebration'
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
import { TravelConfirmDialog } from './TravelConfirmDialog'
import { CONQUERABLE_REGIONS } from '@/app/tap-tap-adventure/lib/mainQuestManager'
import { SettingsPanel } from './SettingsPanel'
import { KeyboardHelp } from './KeyboardHelp'
import { OnboardingHint } from './OnboardingHint'
import { SkillPanel } from './SkillPanel'
import { BasePanel } from './BasePanel'
import { MercenaryPanel } from './MercenaryPanel'
import { FactionPanel } from './FactionPanel'
import AdventureLeaderboard from './AdventureLeaderboard'
import { CraftingPanel } from './CraftingPanel'
import { EnchantingPanel } from './EnchantingPanel'
import { ExplorationSpellsPanel } from './ExplorationSpellsPanel'
import { BestiaryPanel } from './BestiaryPanel'
import { SpellComboPanel } from './SpellComboPanel'
import { DailyChallengesPanel } from './DailyChallengesPanel'
import { NPCDialoguePanel } from './NPCDialoguePanel'
import { TargetList } from './TargetList'
import { AreaMap } from './AreaMap'
import { getNPCsForRegion } from '@/app/tap-tap-adventure/config/npcs'
import { useOnboarding, HintKey } from '@/app/tap-tap-adventure/hooks/useOnboarding'
import { StatsPanel } from '@/app/tap-tap-adventure/components/StatsPanel'
import { RunHistoryPanel } from '@/app/tap-tap-adventure/components/RunHistoryPanel'

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
        <span>Something happens on your travels...</span>
      </div>
    )
  if (distance === 0) return 'Start Your Adventure'
  return 'Continue Travelling'
}
type MobileCategory = 'gear' | 'quest' | 'social' | 'more' | null
type GearSubTab = 'equipment' | 'inventory' | 'crafting' | 'enchant' | 'spells'
type QuestSubTab = 'quests' | 'map' | 'bestiary'
type SocialSubTab = 'party' | 'factions' | 'npc' | 'leaderboard'
type MoreSubTab = 'status' | 'history' | 'base' | 'settings'

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
    applyAchievementRewards,
    claimDailyReward,
    recordNPCEncounter,
    setActiveTarget,
    dismissLootCelebration,
  } = useGameStore()

  const [newlyCompletedIds, setNewlyCompletedIds] = useState<string[]>([])
  const [showDailyReward, setShowDailyReward] = useState(false)
  const [floatingResources, setFloatingResources] = useState<ResourceEvent[]>([])
  const [mobileCategory, setMobileCategory] = useState<MobileCategory>(null)
  const [travelTarget, setTravelTarget] = useState<string | null>(null)
  const [gearSubTab, setGearSubTab] = useState<GearSubTab>('equipment')
  const [questSubTab, setQuestSubTab] = useState<QuestSubTab>('quests')
  const [socialSubTab, setSocialSubTab] = useState<SocialSubTab>('party')
  const [moreSubTab, setMoreSubTab] = useState<MoreSubTab>('status')
  const [mapView, setMapView] = useState<'area' | 'world'>('area')
  const [showKeyboardHelp, setShowKeyboardHelp] = useState(false)
  const [showNPCPanel, setShowNPCPanel] = useState(false)
  const [decisionGracePeriod, setDecisionGracePeriod] = useState(false)

  useEffect(() => {
    if (gameState?.decisionPoint && !gameState.decisionPoint.resolved) {
      setDecisionGracePeriod(true)
      const timer = setTimeout(() => setDecisionGracePeriod(false), 500)
      return () => clearTimeout(timer)
    }
    setDecisionGracePeriod(false)
  }, [gameState?.decisionPoint?.id])

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

  const { addStoryEvent, commit, updateSelectedCharacter } = useGameStateBuilder()

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

  const handleRegionClick = useCallback((regionId: string) => {
    const region = REGIONS[regionId]
    if (!region || !character) return
    const currentRegion = getRegion(character.currentRegion ?? 'green_meadows')
    const isConnected = currentRegion.connectedRegions.includes(regionId)
    const isVisited = (character.visitedRegions ?? []).includes(regionId)
    if (isConnected && isVisited && canEnterRegion(region, character.level)) {
      setTravelTarget(regionId)
    }
  }, [character])

  const handleTravelConfirm = useCallback(() => {
    if (!travelTarget || !character) return
    const destRegion = getRegion(travelTarget)
    updateSelectedCharacter({
      currentRegion: travelTarget,
      currentWeather: rollWeather(travelTarget),
    })
    addStoryEvent({
      id: `map-travel-${Date.now()}`,
      type: 'region_travel',
      characterId: character.id,
      locationId: character.locationId,
      timestamp: new Date().toISOString(),
      selectedOptionId: travelTarget,
      selectedOptionText: `Traveled to ${destRegion.name}`,
      outcomeDescription: `You set out for ${destRegion.icon} ${destRegion.name} \u2014 ${destRegion.description}`,
    })
    commit()
    setTravelTarget(null)
    soundEngine.playCrossroads()
  }, [travelTarget, character, updateSelectedCharacter, addStoryEvent, commit])

  const handleResolveDecision = (optionId: string) => {
    resolveDecisionMutation({
      decisionPoint: gameState.decisionPoint!,
      optionId: optionId,
      onSuccess: () => {
        setDecisionPoint(null)
      },
      onResourceDelta: (delta) => {
        if (!delta) return
        const events: ResourceEvent[] = []
        if (delta.gold && delta.gold !== 0) {
          events.push({ id: `gold-${Date.now()}`, type: 'gold', value: delta.gold })
        }
        if (delta.reputation && delta.reputation !== 0) {
          events.push({ id: `rep-${Date.now()}`, type: 'reputation', value: delta.reputation })
        }
        if (events.length > 0) {
          setFloatingResources(events)
          setTimeout(() => setFloatingResources([]), 2000)
        }
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
    const mountSpeed = character?.activeMount?.bonuses?.autoWalkSpeed ?? 1
    const distance = character?.distance ?? 0
    const nextDistance = distance + mountSpeed

    // Check if the next step would hit a target arrival (landmark or region exit)
    const ls = character?.landmarkState
    const nextPosInRegion = (ls?.positionInRegion ?? 0) + mountSpeed
    const activeTargetIndex = ls?.activeTargetIndex ?? 0
    const isExitTarget = ls ? activeTargetIndex >= ls.landmarks.length : false
    const activeTargetPosition = ls
      ? isExitTarget
        ? (ls.regionLength ?? 200)
        : ls.landmarks[activeTargetIndex]?.distanceFromEntry ?? Infinity
      : Infinity
    const charPos = ls?.position
    let targetPos2d
    if (isExitTarget && ls?.exitPositions) {
      const exitIdx = activeTargetIndex - ls.landmarks.length
      targetPos2d = ls.exitPositions[exitIdx]?.position ?? ls.exitPosition
    } else if (isExitTarget) {
      targetPos2d = ls?.exitPosition
    } else {
      targetPos2d = ls?.landmarks[activeTargetIndex]?.position
    }
    const hitsTarget = charPos && targetPos2d
      ? hasArrived(moveToward(charPos, targetPos2d, mountSpeed), targetPos2d)
      : (!charPos && ls != null && nextPosInRegion >= activeTargetPosition) // 1D ONLY when no 2D data

    // Always call server for milestone events (shop, target arrival)
    const hitsMilestone =
      crossedMilestone(distance, nextDistance, SHOP_MILESTONE_INTERVAL) ||
      hitsTarget

    if (hitsMilestone) {
      moveForwardMutation()
      return
    }

    const shouldDoNothing = flipCoin(0.03, 0.97)
    if (shouldDoNothing) {
      const region = character ? getRegion(character.currentRegion ?? 'green_meadows') : null
      const genericMessage = getGenericTravelMessage({
        regionElement: region?.element,
        timeOfDay: getTimeOfDay(character?.distance ?? 0),
        weather: character?.currentWeather,
      })
      setGenericMessage(genericMessage)
      incrementDistance(mountSpeed)
    } else {
      moveForwardMutation()
    }
  }

  const [isAutoWalking, setIsAutoWalking] = useState(false)
  const autoWalkTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const autoWalkIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null)
  const lastMoveTimeRef = useRef<number>(0)

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
        setMobileCategory(null)
        return
      }

      // During decision point — 1-4 to pick options
      if (gameState.decisionPoint && !gameState.decisionPoint.resolved && !resolveDecisionPending && !decisionGracePeriod) {
        const num = parseInt(e.key, 10)
        if (num >= 1 && num <= gameState.decisionPoint.options.length) {
          e.preventDefault()
          handleResolveDecision(gameState.decisionPoint.options[num - 1].id)
        }
        return
      }

      // During combat or shop — let those components handle their own shortcuts
      if (gameState.combatState?.status === 'active' || gameState.shopState?.isOpen) return

      // Travel mode — Space or Enter to move forward, throttled to match walk speed
      if ((e.key === ' ' || e.key === 'Enter') && !moveForwardPending) {
        e.preventDefault()
        const now = Date.now()
        const mountSpeed = character?.activeMount?.bonuses?.autoWalkSpeed ?? 1
        const unlockedSkillIds = character?.unlockedSkills ?? []
        const unlockedSkillObjects = SKILLS.filter(s => unlockedSkillIds.includes(s.id))
        const walkSpeedBonus = getSkillBonus(unlockedSkillObjects, 'auto_walk_speed')
        const skillSpeedMultiplier = 1 + walkSpeedBonus.percentage / 100
        const walkInterval = Math.round(300 / (mountSpeed * skillSpeedMultiplier))
        if (now - lastMoveTimeRef.current >= walkInterval) {
          lastMoveTimeRef.current = now
          handleMoveForward()
        }
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
      {gameState.pendingLootCelebration && (
        <RareLootCelebration
          item={gameState.pendingLootCelebration}
          onDismiss={dismissLootCelebration}
        />
      )}
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
          onConfirm={(str, int, lck, cha) => allocateStatPoints(str, int, lck, cha)}
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
                      applyAchievementRewards(newlyCompleted)
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
                      applyAchievementRewards(newlyCompleted)
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
                {(() => {
                  const isLandmarkArrival = gameState.decisionPoint?.options?.some(
                    (o: { id: string }) => o.id === 'explore-landmark' || o.id === 'bypass-landmark'
                  )
                  // Find landmark data from character state (the one we just arrived at)
                  // nextLandmarkIndex has NOT been incremented yet at this point (server didn't increment it)
                  const arrivalLandmark = isLandmarkArrival && character?.landmarkState
                    ? character.landmarkState.landmarks[character.landmarkState.nextLandmarkIndex]
                    : null

                  if (arrivalLandmark) {
                    return (
                      <div className="text-center mb-4 pb-2 border-b border-indigo-600/40">
                        <div className="text-3xl mb-1">{arrivalLandmark.icon}</div>
                        <h4 className="font-semibold uppercase text-indigo-300">{arrivalLandmark.name}</h4>
                        <p className="text-xs text-slate-400 italic mt-1">{arrivalLandmark.description}</p>
                        {arrivalLandmark.hasShop && (
                          <span className="inline-block mt-1 text-[10px] px-1.5 py-0.5 rounded bg-yellow-900/40 border border-yellow-600/40 text-yellow-300">
                            🛒 Shop Available
                          </span>
                        )}
                      </div>
                    )
                  }

                  return (
                    <h4 className={`font-semibold w-full text-center uppercase border-b pb-2 mb-4 ${
                      gameState.decisionPoint?.isLegendary
                        ? 'text-amber-400 border-amber-500/50'
                        : 'border-[#3a3c56]'
                    }`}>
                      {gameState.decisionPoint?.isLegendary ? '✨ Legendary Encounter ✨' : 'Event'}
                    </h4>
                  )
                })()}
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

                          // Enrich crossroads travel options with region data
                          const isTravelOption = option.id.startsWith('travel-')
                          const travelRegionId = isTravelOption ? option.id.replace('travel-', '') : null
                          const travelRegion = travelRegionId ? REGIONS[travelRegionId] : null
                          const diffStyle = travelRegion ? DIFFICULTY_STYLES[travelRegion.difficulty] : null
                          const elemStyle = travelRegion && travelRegion.element !== 'none' ? ELEMENT_STYLES[travelRegion.element] : null
                          const borderColor = diffStyle
                            ? travelRegion!.difficulty === 'easy' ? 'border-green-600/50'
                              : travelRegion!.difficulty === 'medium' ? 'border-yellow-600/50'
                              : travelRegion!.difficulty === 'hard' ? 'border-orange-600/50'
                              : travelRegion!.difficulty === 'very_hard' ? 'border-red-600/50'
                              : 'border-purple-600/50'
                            : 'border-[#3a3c56]'

                          return (
                            <Button
                              key={option.id}
                              className={`block w-full text-left whitespace-normal h-auto border bg-[#2a2b3f] hover:bg-[#3a3c56] text-white px-3 py-3 text-base mt-2 rounded disabled:opacity-60 ${borderColor}`}
                              disabled={resolveDecisionPending || decisionGracePeriod}
                              onClick={() => {
                                handleResolveDecision(option.id)
                              }}
                            >
                              <span className="hidden sm:inline text-slate-400 mr-2 text-xs font-mono">[{index + 1}]</span>
                              {option.text}
                              {travelRegion && (
                                <span className="flex items-center gap-1.5 mt-1.5">
                                  {diffStyle && (
                                    <span className={`text-[10px] px-1.5 py-0.5 rounded border ${diffStyle.color}`}>
                                      {diffStyle.label}
                                    </span>
                                  )}
                                  {elemStyle && (
                                    <span className={`text-[10px] px-1.5 py-0.5 rounded ${elemStyle.color}`}>
                                      {travelRegion.element}
                                    </span>
                                  )}
                                  {travelRegion.minLevel > 0 && (
                                    <span className="text-[10px] text-slate-500">
                                      Lv.{travelRegion.minLevel}+
                                    </span>
                                  )}
                                </span>
                              )}
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

                  // Landmark state for TargetList
                  const ls = character?.landmarkState

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
                      {/* Target list */}
                      {ls && (
                        <TargetList
                          landmarks={ls.landmarks}
                          positionInRegion={ls.positionInRegion ?? 0}
                          activeTargetIndex={ls.activeTargetIndex ?? 0}
                          regionLength={ls.regionLength ?? 200}
                          regionName={region.name}
                          onSelectTarget={(i) => setActiveTarget(i)}
                          disabled={moveForwardPending || resolveDecisionPending}
                          characterPosition={ls.position}
                          exitTargets={ls.exitPositions}
                        />
                      )}
                    </div>
                  )
                })()}
                {/* NPC button and panel */}
                {(() => {
                  const regionNPCs = getNPCsForRegion(character?.currentRegion ?? 'green_meadows')
                  if (regionNPCs.length === 0) return null
                  const npc = regionNPCs[0]
                  const encounters = character?.npcEncounters ?? {}
                  const disposition = encounters[npc.id]?.disposition ?? 0
                  return (
                    <div>
                      {showNPCPanel ? (
                        <NPCDialoguePanel
                          npc={npc}
                          characterName={character?.name ?? 'Adventurer'}
                          characterClass={character?.class ?? 'Unknown'}
                          characterLevel={character?.level ?? 1}
                          reputation={character?.reputation ?? 0}
                          region={character?.currentRegion ?? 'green_meadows'}
                          characterCharisma={character?.charisma ?? 5}
                          activeCharismaBonus={character?.activeExplorationSpells?.filter(s => s.effectType === 'cha_boost').reduce((sum, s) => sum + (s.value ?? 0), 0) ?? 0}
                          disposition={disposition}
                          hiddenLandmarkName={character?.landmarkState?.landmarks.find(lm => lm.hidden)?.name}
                          hiddenLandmarkType={character?.landmarkState?.landmarks.find(lm => lm.hidden)?.type}
                          onEncounterUpdate={(dispositionDelta, reward, revealLandmark) => {
                            recordNPCEncounter(npc.id, dispositionDelta, reward, revealLandmark)
                          }}
                          onClose={() => {
                            setShowNPCPanel(false)
                          }}
                        />
                      ) : (
                        <button
                          className="w-full text-left text-xs bg-[#1e1f30] border border-[#3a3c56] hover:border-indigo-700/50 rounded-lg px-3 py-2 text-slate-300 transition-colors"
                          onClick={() => setShowNPCPanel(true)}
                        >
                          <span className="mr-1.5">{npc.icon}</span>
                          <span className="font-semibold">{npc.name}</span>
                          <span className="text-slate-500 ml-1">is nearby &mdash; Talk?</span>
                        </button>
                      )}
                    </div>
                  )
                })()}
                <div className="relative">
                  <FloatingResources events={floatingResources} />
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
                </div>
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
            <DailyChallengesPanel />
            <AchievementPanel achievements={gameState.achievements ?? []} />
            <BestiaryPanel bestiary={character?.bestiary ?? []} />
            <SpellComboPanel discoveredCombos={character?.discoveredCombos ?? []} />
            <EquipmentPanel
              equipment={getSelectedCharacter()?.equipment ?? { weapon: null, armor: null, accessory: null }}
            />
            <div className="border-t border-[#3a3c56] pt-4">
              <InventoryPanel inventory={getSelectedCharacter()?.inventory ?? []} />
            </div>
            <div className="border-t border-[#3a3c56] pt-4">
              <div className="flex gap-1 mb-3">
                <button onClick={() => setMapView('area')} className={`flex-1 text-xs py-1.5 px-2 rounded-md transition-colors ${mapView === 'area' ? 'bg-indigo-600 text-white' : 'text-slate-400 hover:text-white'}`}>Area Map</button>
                <button onClick={() => setMapView('world')} className={`flex-1 text-xs py-1.5 px-2 rounded-md transition-colors ${mapView === 'world' ? 'bg-indigo-600 text-white' : 'text-slate-400 hover:text-white'}`}>World Map</button>
              </div>
              {mapView === 'area' && character?.landmarkState ? (
                <AreaMap
                  playerPosition={character.landmarkState.position ?? { x: 0, y: 0 }}
                  landmarks={character.landmarkState.landmarks.map((lm, i) => ({
                    index: i,
                    name: lm.name,
                    icon: lm.icon,
                    position: lm.position ?? { x: 0, y: 0 },
                    explored: lm.explored ?? false,
                    hidden: lm.hidden ?? false,
                    hasShop: lm.hasShop ?? false,
                  }))}
                  exits={(character.landmarkState.exitPositions ?? []).map((exit, i) => ({
                    index: character.landmarkState!.landmarks.length + i,
                    name: exit.name,
                    icon: exit.icon,
                    position: exit.position,
                  }))}
                  activeTargetIndex={character.landmarkState.activeTargetIndex ?? 0}
                  regionBounds={character.landmarkState.regionBounds ?? { width: 500, height: 500 }}
                  regionName={getRegion(character.currentRegion ?? 'green_meadows').name}
                  regionIcon={getRegion(character.currentRegion ?? 'green_meadows').icon}
                  onSelectTarget={(i) => setActiveTarget(i)}
                />
              ) : (
                <RegionMap
                  currentRegionId={character?.currentRegion ?? 'green_meadows'}
                  characterLevel={character?.level ?? 1}
                  visitedRegions={character?.visitedRegions ?? []}
                  conqueredRegions={character?.visitedRegions?.filter(r => CONQUERABLE_REGIONS.includes(r)) ?? []}
                  onRegionClick={handleRegionClick}
                />
              )}
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
              <BasePanel />
            </div>
            <div className="border-t border-[#3a3c56] pt-4">
              {character && <MercenaryPanel character={character} />}
            </div>
            <div className="border-t border-[#3a3c56] pt-4">
              {character && <FactionPanel character={character} />}
            </div>
            <div className="border-t border-[#3a3c56] pt-4">
              <CraftingPanel />
            </div>
            <div className="border-t border-[#3a3c56] pt-4">
              <EnchantingPanel />
            </div>
            <div className="border-t border-[#3a3c56] pt-4">
              <ExplorationSpellsPanel />
            </div>
            <div className="border-t border-[#3a3c56] pt-4">
              <SettingsPanel />
            </div>
            <div className="border-t border-[#3a3c56] pt-4">
              <StatsPanel />
            </div>
            <div className="border-t border-[#3a3c56] pt-4">
              <RunHistoryPanel />
            </div>
          </div>
        </div>
        {/* Two-column grid END */}
      </div>
      {/* Main content wrapper END */}

      {/* Mobile bottom drawer overlay */}
      {mobileCategory && (
        <div className="md:hidden fixed inset-0 z-40" onClick={() => setMobileCategory(null)}>
          <div className="absolute inset-0 bg-black/50" />
          <div
            className="absolute bottom-14 left-0 right-0 max-h-[70vh] overflow-y-auto bg-[#161723] border-t border-[#3a3c56] rounded-t-xl p-4 space-y-4"
            onClick={e => e.stopPropagation()}
          >
            {/* Sub-tab bar inside the drawer */}
            <div className="flex gap-1 bg-[#0e0f1a] rounded-lg p-1 overflow-x-auto">
              {mobileCategory === 'gear' && ([
                { id: 'equipment' as GearSubTab, label: 'Equip' },
                { id: 'inventory' as GearSubTab, label: 'Items' },
                { id: 'crafting' as GearSubTab, label: 'Craft' },
                { id: 'enchant' as GearSubTab, label: 'Enchant' },
                { id: 'spells' as GearSubTab, label: 'Spells' },
              ]).map(t => (
                <button key={t.id} onClick={() => setGearSubTab(t.id)}
                  className={`flex-1 text-xs py-1.5 px-2 rounded-md transition-colors ${gearSubTab === t.id ? 'bg-indigo-600 text-white' : 'text-slate-400 hover:text-white'}`}
                >{t.label}</button>
              ))}
              {mobileCategory === 'quest' && ([
                { id: 'quests' as QuestSubTab, label: 'Quests' },
                { id: 'map' as QuestSubTab, label: 'Map' },
                { id: 'bestiary' as QuestSubTab, label: 'Bestiary' },
              ]).map(t => (
                <button key={t.id} onClick={() => setQuestSubTab(t.id)}
                  className={`flex-1 text-xs py-1.5 px-2 rounded-md transition-colors ${questSubTab === t.id ? 'bg-indigo-600 text-white' : 'text-slate-400 hover:text-white'}`}
                >{t.label}</button>
              ))}
              {mobileCategory === 'social' && ([
                { id: 'party' as SocialSubTab, label: 'Party' },
                { id: 'factions' as SocialSubTab, label: 'Factions' },
                { id: 'npc' as SocialSubTab, label: 'NPCs' },
                { id: 'leaderboard' as SocialSubTab, label: 'Ranks' },
              ]).map(t => (
                <button key={t.id} onClick={() => setSocialSubTab(t.id)}
                  className={`flex-1 text-xs py-1.5 px-2 rounded-md transition-colors ${socialSubTab === t.id ? 'bg-indigo-600 text-white' : 'text-slate-400 hover:text-white'}`}
                >{t.label}</button>
              ))}
              {mobileCategory === 'more' && ([
                { id: 'status' as MoreSubTab, label: 'Status' },
                { id: 'history' as MoreSubTab, label: 'History' },
                { id: 'base' as MoreSubTab, label: 'Camp' },
                { id: 'settings' as MoreSubTab, label: 'Settings' },
              ]).map(t => (
                <button key={t.id} onClick={() => setMoreSubTab(t.id)}
                  className={`flex-1 text-xs py-1.5 px-2 rounded-md transition-colors ${moreSubTab === t.id ? 'bg-indigo-600 text-white' : 'text-slate-400 hover:text-white'}`}
                >{t.label}</button>
              ))}
            </div>

            {/* Gear panels */}
            {mobileCategory === 'gear' && gearSubTab === 'equipment' && (
              <>
                <EquipmentPanel
                  equipment={getSelectedCharacter()?.equipment ?? { weapon: null, armor: null, accessory: null }}
                />
                <AchievementPanel achievements={gameState.achievements ?? []} />
              </>
            )}
            {mobileCategory === 'gear' && gearSubTab === 'inventory' && (
              <InventoryPanel inventory={getSelectedCharacter()?.inventory ?? []} />
            )}
            {mobileCategory === 'gear' && gearSubTab === 'crafting' && <CraftingPanel />}
            {mobileCategory === 'gear' && gearSubTab === 'enchant' && <EnchantingPanel />}
            {mobileCategory === 'gear' && gearSubTab === 'spells' && <ExplorationSpellsPanel />}

            {/* Quest panels */}
            {mobileCategory === 'quest' && questSubTab === 'quests' && (
              <>
                {character && <MainQuestPanel character={character} />}
                <QuestPanel />
                <DailyChallengesPanel />
              </>
            )}
            {mobileCategory === 'quest' && questSubTab === 'map' && (
              <div>
                <div className="flex gap-1 mb-3">
                  <button onClick={() => setMapView('area')} className={`flex-1 text-xs py-1.5 px-2 rounded-md transition-colors ${mapView === 'area' ? 'bg-indigo-600 text-white' : 'text-slate-400 hover:text-white'}`}>Area</button>
                  <button onClick={() => setMapView('world')} className={`flex-1 text-xs py-1.5 px-2 rounded-md transition-colors ${mapView === 'world' ? 'bg-indigo-600 text-white' : 'text-slate-400 hover:text-white'}`}>World</button>
                </div>
                {mapView === 'area' && character?.landmarkState ? (
                  <AreaMap
                    playerPosition={character.landmarkState.position ?? { x: 0, y: 0 }}
                    landmarks={character.landmarkState.landmarks.map((lm, i) => ({
                      index: i,
                      name: lm.name,
                      icon: lm.icon,
                      position: lm.position ?? { x: 0, y: 0 },
                      explored: lm.explored ?? false,
                      hidden: lm.hidden ?? false,
                      hasShop: lm.hasShop ?? false,
                    }))}
                    exits={(character.landmarkState.exitPositions ?? []).map((exit, i) => ({
                      index: character.landmarkState!.landmarks.length + i,
                      name: exit.name,
                      icon: exit.icon,
                      position: exit.position,
                    }))}
                    activeTargetIndex={character.landmarkState.activeTargetIndex ?? 0}
                    regionBounds={character.landmarkState.regionBounds ?? { width: 500, height: 500 }}
                    regionName={getRegion(character.currentRegion ?? 'green_meadows').name}
                    regionIcon={getRegion(character.currentRegion ?? 'green_meadows').icon}
                    onSelectTarget={(i) => setActiveTarget(i)}
                  />
                ) : (
                  <RegionMap
                    currentRegionId={character?.currentRegion ?? 'green_meadows'}
                    characterLevel={character?.level ?? 1}
                    visitedRegions={character?.visitedRegions ?? []}
                    conqueredRegions={character?.visitedRegions?.filter(r => CONQUERABLE_REGIONS.includes(r)) ?? []}
                    onRegionClick={handleRegionClick}
                  />
                )}
              </div>
            )}
            {mobileCategory === 'quest' && questSubTab === 'bestiary' && character && (
              <>
                <BestiaryPanel bestiary={character.bestiary ?? []} />
                <SpellComboPanel discoveredCombos={character.discoveredCombos ?? []} />
              </>
            )}

            {/* Social panels */}
            {mobileCategory === 'social' && socialSubTab === 'party' && character && (
              <MercenaryPanel character={character} />
            )}
            {mobileCategory === 'social' && socialSubTab === 'factions' && character && (
              <FactionPanel character={character} />
            )}
            {mobileCategory === 'social' && socialSubTab === 'leaderboard' && (
              <AdventureLeaderboard onBack={() => setMobileCategory(null)} />
            )}
            {mobileCategory === 'social' && socialSubTab === 'npc' && character && (() => {
              const regionNPCs = getNPCsForRegion(character.currentRegion ?? 'green_meadows')
              if (regionNPCs.length === 0) return <p className="text-sm text-slate-400">No NPCs in this region.</p>
              const npc = regionNPCs[0]
              const encounters = character.npcEncounters ?? {}
              const disposition = encounters[npc.id]?.disposition ?? 0
              return (
                <NPCDialoguePanel
                  npc={npc}
                  characterName={character.name}
                  characterClass={character.class}
                  characterLevel={character.level}
                  reputation={character.reputation}
                  region={character.currentRegion ?? 'green_meadows'}
                  characterCharisma={character.charisma ?? 5}
                  activeCharismaBonus={character.activeExplorationSpells?.filter(s => s.effectType === 'cha_boost').reduce((sum, s) => sum + (s.value ?? 0), 0) ?? 0}
                  disposition={disposition}
                  hiddenLandmarkName={character.landmarkState?.landmarks.find(lm => lm.hidden)?.name}
                  hiddenLandmarkType={character.landmarkState?.landmarks.find(lm => lm.hidden)?.type}
                  onEncounterUpdate={(dispositionDelta, reward, revealLandmark) => {
                    recordNPCEncounter(npc.id, dispositionDelta, reward, revealLandmark)
                  }}
                  onClose={() => {
                    setMobileCategory(null)
                  }}
                />
              )
            })()}

            {/* More panels */}
            {mobileCategory === 'more' && moreSubTab === 'status' && (
              <StatsPanel />
            )}
            {mobileCategory === 'more' && moreSubTab === 'history' && (
              <RunHistoryPanel />
            )}
            {mobileCategory === 'more' && moreSubTab === 'base' && <BasePanel />}
            {mobileCategory === 'more' && moreSubTab === 'settings' && <SettingsPanel />}
          </div>
        </div>
      )}

      {/* Mobile bottom tab bar — 4 grouped tabs */}
      <div className="md:hidden fixed bottom-0 left-0 right-0 z-50 flex bg-[#1a1b2e] border-t border-slate-700">
        {([
          { id: 'gear' as MobileCategory, label: 'Gear', icon: '\u2694' },
          { id: 'quest' as MobileCategory, label: 'Quest', icon: '\uD83D\uDCDC' },
          { id: 'social' as MobileCategory, label: 'Social', icon: '\uD83C\uDFF0' },
          { id: 'more' as MobileCategory, label: 'More', icon: '\u2630' },
        ]).map(tab => (
          <button
            key={tab.id}
            className={`flex-1 flex flex-col items-center py-2.5 text-xs transition-colors ${
              mobileCategory === tab.id
                ? 'text-indigo-400 bg-[#2a2b3f]'
                : 'text-slate-400 hover:text-slate-200'
            }`}
            onClick={() => setMobileCategory(mobileCategory === tab.id ? null : tab.id)}
          >
            <span className="text-xl leading-none">{tab.icon}</span>
            <span className="mt-1 text-[11px]">{tab.label}</span>
          </button>
        ))}
      </div>
      {/* Bottom padding spacer for mobile tab bar */}
      <div className="md:hidden h-14" />

      {/* Travel confirm dialog */}
      {travelTarget && (
        <TravelConfirmDialog
          region={getRegion(travelTarget)}
          onConfirm={handleTravelConfirm}
          onCancel={() => setTravelTarget(null)}
        />
      )}
    </div>
    </>
  )
}
