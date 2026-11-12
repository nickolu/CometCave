'use client'

/**
 * The run, staged. This owns the same state and handlers the old GameUI did
 * (travel, decisions, auto-walk, keyboard, town doors, celebrations) and lays
 * them into the theatre: actors on the scenery, the playbill on the apron,
 * the footlights below, drawers in the wings.
 */
import Link from 'next/link'
import { useCallback, useEffect, useRef, useState } from 'react'

import { ROUTE_CONSTANTS } from '@/app/route-constants'
import { AchievementToastContainer } from '@/app/tap-tap-adventure/components/AchievementToast'
import { CombatResult, CombatUI } from '@/app/tap-tap-adventure/components/CombatUI'
import { CraftingPanel } from '@/app/tap-tap-adventure/components/CraftingPanel'
import { DailyRewardPopup } from '@/app/tap-tap-adventure/components/DailyRewardPopup'
import { FloatingResources, type ResourceEvent } from '@/app/tap-tap-adventure/components/FloatingResources'
import { KeyboardHelp } from '@/app/tap-tap-adventure/components/KeyboardHelp'
import { MailboxPanel } from '@/app/tap-tap-adventure/components/MailboxPanel'
import { NoticeBoard } from '@/app/tap-tap-adventure/components/NoticeBoard'
import { NPCDialoguePanel } from '@/app/tap-tap-adventure/components/NPCDialoguePanel'
import { OnboardingHint } from '@/app/tap-tap-adventure/components/OnboardingHint'
import { PlayerStatusView } from '@/app/tap-tap-adventure/components/PlayerStatusView'
import { RareLootCelebration } from '@/app/tap-tap-adventure/components/RareLootCelebration'
import { ShopUI } from '@/app/tap-tap-adventure/components/ShopUI'
import { StablePanel } from '@/app/tap-tap-adventure/components/StablePanel'
import { StatAllocationScreen } from '@/app/tap-tap-adventure/components/StatAllocationScreen'
import { TavernPanel } from '@/app/tap-tap-adventure/components/TavernPanel'
import { TownHub } from '@/app/tap-tap-adventure/components/TownHub'
import { TravelConfirmDialog } from '@/app/tap-tap-adventure/components/TravelConfirmDialog'
import { WaypointPanel } from '@/app/tap-tap-adventure/components/WaypointPanel'
import { type GameNPC, getNPCById } from '@/app/tap-tap-adventure/config/npcs'
import { REGIONS, canEnterRegion, getRegion } from '@/app/tap-tap-adventure/config/regions'
import { SKILLS } from '@/app/tap-tap-adventure/config/skills'
import { type WeatherId, rollWeather } from '@/app/tap-tap-adventure/config/weather'
import { useGameStateBuilder, useGameStore } from '@/app/tap-tap-adventure/hooks/useGameStore'
import { useMoveForwardMutation } from '@/app/tap-tap-adventure/hooks/useMoveForwardMutation'
import { type HintKey, useOnboarding } from '@/app/tap-tap-adventure/hooks/useOnboarding'
import { useResolveDecisionMutation } from '@/app/tap-tap-adventure/hooks/useResolveDecisionMutation'
import { checkAchievements } from '@/app/tap-tap-adventure/lib/achievementTracker'
import { canClaimDailyReward, getDailyReward } from '@/app/tap-tap-adventure/lib/dailyRewardTracker'
import { getGenericTravelMessage } from '@/app/tap-tap-adventure/lib/getGenericTravelMessage'
import { SHOP_MILESTONE_INTERVAL, calculateDay, crossedMilestone } from '@/app/tap-tap-adventure/lib/leveling'
import { hasArrived, moveToward } from '@/app/tap-tap-adventure/lib/movementUtils'
import { createPartyMember } from '@/app/tap-tap-adventure/lib/partyRecruitment'
import { getSkillBonus } from '@/app/tap-tap-adventure/lib/skillTracker'
import { soundEngine } from '@/app/tap-tap-adventure/lib/soundEngine'
import { flipCoin } from '@/app/utils'
import { AiAccessError } from '@/lib/api/ai-fetch'

import { Cutout } from './Cutout'
import { DRAWER_TABS, DrawerContent, type DrawerId, drawerTabs } from './Drawers'
import { CharactersIcon, HelpIcon, SoundOffIcon, SoundOnIcon } from './icons'
import { PaperButton, PlaybillCaption, PlaybillSheet, PlaybillTitle } from './Playbill'
import { type EventResult, PlaybillStrip, describeTarget } from './PlaybillStrip'
import { HudPlate, Identity, Placards } from './StageHud'
import { StoryLog } from './StoryLog'
import { Theatre } from './Theatre'
import { TIME_LABEL, getTimeOfDay } from './time'
import { WalkBar } from './WalkBar'

const ONBOARDING_HINTS: Record<HintKey, { title: string; body: string }> = {
  'first-tap': {
    title: 'The road is yours',
    body: 'Tap WALK to take a step, or hold it to keep walking. Things happen on the road; the playbill tells you what.',
  },
  'first-combat': {
    title: 'A fight',
    body: 'You have Action Points each turn. Attacks, spells and abilities each cost some. When they run out, your turn ends.',
  },
  'first-item': {
    title: 'You found something',
    body: 'Open the Pack drawer to use it, or the Gear drawer to wear it. Weapons and armour make you stronger.',
  },
  'first-crossroads': {
    title: 'A choice',
    body: 'Pick a line on the bill. Harder paths pay better and hurt more. Keys 1 to 4 pick them too.',
  },
}

function ControlButton({ label, onClick, children, href }: { label: string; onClick?: () => void; children: React.ReactNode; href?: string }) {
  const cls =
    'flex h-9 min-w-9 items-center justify-center gap-1.5 rounded-[3px] border-2 border-ps-brass-deep px-2 font-label text-xs font-bold uppercase tracking-widest text-ps-brass-light transition-colors hover:bg-ps-lacquer-deep focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ds-primary'
  if (href) {
    return (
      <Link href={href} className={cls} aria-label={label} title={label}>
        {children}
      </Link>
    )
  }
  return (
    <button type="button" onClick={onClick} className={cls} aria-label={label} title={label}>
      {children}
    </button>
  )
}

export type TownDoor = 'tavern' | 'stable' | 'mailbox' | 'notice' | 'blacksmith' | 'waypoints' | 'npc'

/** The `initial*` props exist for the dev preview route only; the game never passes them. */
export default function GameStage({
  initialDrawer = null,
  initialSub,
  initialTown = null,
}: { initialDrawer?: DrawerId | null; initialSub?: string; initialTown?: TownDoor | null } = {}) {
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
    setActiveTarget,
    dismissLootCelebration,
    clearSocialEncounter,
    recordNPCEncounter,
    addPartyMember,
  } = useGameStore()

  const [newlyCompletedIds, setNewlyCompletedIds] = useState<string[]>([])
  const [showDailyReward, setShowDailyReward] = useState(false)
  const [floatingResources, setFloatingResources] = useState<ResourceEvent[]>([])
  const floatingResourcesTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const [drawer, setDrawer] = useState<DrawerId | null>(initialDrawer)
  const [drawerSub, setDrawerSub] = useState<Record<DrawerId, string>>(() => {
    const base: Record<DrawerId, string> = { pack: 'items', gear: 'equipment', quests: 'quests', map: 'area', party: 'party', town: '' }
    if (initialDrawer && initialSub) base[initialDrawer] = initialSub
    return base
  })
  const [travelTarget, setTravelTarget] = useState<string | null>(null)
  const [showKeyboardHelp, setShowKeyboardHelp] = useState(false)
  const [showStatus, setShowStatus] = useState(false)
  const [decisionGracePeriod, setDecisionGracePeriod] = useState(false)
  const [showNPCPanel, setShowNPCPanel] = useState(false)
  const [showStablePanel, setShowStablePanel] = useState(initialTown === 'stable')
  const [showMailbox, setShowMailbox] = useState(initialTown === 'mailbox')
  const [showNoticeBoard, setShowNoticeBoard] = useState(initialTown === 'notice')
  const [showTavern, setShowTavern] = useState(initialTown === 'tavern')
  const [showBlacksmith, setShowBlacksmith] = useState(initialTown === 'blacksmith')
  const [showWaypoints, setShowWaypoints] = useState(initialTown === 'waypoints')
  const restFromTavern = useRef(false)
  const [eventResult, setEventResult] = useState<EventResult | null>(null)
  /** The place a map or chart just put on the sheet; the map drawer opens on it until the drawer closes. */
  const [mappedPlace, setMappedPlace] = useState<{ index: number; name: string } | null>(null)
  const [townNPC, setTownNPC] = useState<GameNPC | null>(() => (initialTown === 'npc' ? (getNPCById('elder_maren') ?? null) : null))

  const [soundEnabled, setSoundEnabled] = useState(true)
  useEffect(() => {
    try {
      const stored = localStorage.getItem('tap-tap-sound-enabled')
      if (stored !== null) {
        const val = stored === 'true'
        setSoundEnabled(val)
        soundEngine.setEnabled(val)
      }
    } catch {
      // localStorage unavailable, keep default
    }
  }, [])
  const toggleSound = useCallback(() => {
    setSoundEnabled(prev => {
      const next = !prev
      soundEngine.setEnabled(next)
      try {
        localStorage.setItem('tap-tap-sound-enabled', String(next))
      } catch {
        // fail silently
      }
      return next
    })
  }, [])

  useEffect(() => {
    if (gameState?.decisionPoint && !gameState.decisionPoint.resolved) {
      setDecisionGracePeriod(true)
      const timer = setTimeout(() => setDecisionGracePeriod(false), 500)
      return () => clearTimeout(timer)
    }
    setDecisionGracePeriod(false)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [gameState?.decisionPoint?.id])

  // Leaving town (or any new decision) closes the town's doors. Keyed on the
  // decision id itself so a Strict Mode double-run on mount is a no-op.
  const lastDecisionIdRef = useRef(gameState?.decisionPoint?.id)
  useEffect(() => {
    if (lastDecisionIdRef.current === gameState?.decisionPoint?.id) return
    lastDecisionIdRef.current = gameState?.decisionPoint?.id
    setTownNPC(null)
    setShowNoticeBoard(false)
    setShowTavern(false)
    setShowBlacksmith(false)
    setShowWaypoints(false)
    setShowStablePanel(false)
    setShowMailbox(false)
  }, [gameState?.decisionPoint?.id])

  useEffect(() => {
    if (gameState && canClaimDailyReward(gameState)) setShowDailyReward(true)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const { mutate: moveForwardMutation, isPending: moveForwardPending, error: moveForwardError } = useMoveForwardMutation()
  const { mutate: resolveDecisionMutation, isPending: resolveDecisionPending, error: resolveDecisionError } = useResolveDecisionMutation()
  // Plain words for the player when the road does not answer (principle 4).
  const fitToShow = (err: unknown): string | null =>
    !err ? null : err instanceof AiAccessError ? err.message : 'That did not go through. Try again.'
  const { addStoryEvent, commit, updateSelectedCharacter } = useGameStateBuilder()

  const character = getSelectedCharacter()
  const { hasSeenHint, markHintSeen } = useOnboarding(character?.id)

  const activeHint: HintKey | null = (() => {
    if (!character) return null
    if (gameState.combatState?.status === 'active' && !hasSeenHint('first-combat')) return 'first-combat'
    if (gameState.decisionPoint && !hasSeenHint('first-crossroads')) return 'first-crossroads'
    if (character.inventory.length > 0 && !hasSeenHint('first-item')) return 'first-item'
    if (character.distance === 0 && !hasSeenHint('first-tap')) return 'first-tap'
    return null
  })()

  const handleRegionClick = useCallback(
    (regionId: string) => {
      const region = REGIONS[regionId]
      if (!region || !character) return
      const currentRegion = getRegion(character.currentRegion ?? 'green_meadows')
      const isConnected = currentRegion.connectedRegions.includes(regionId)
      const isVisited = (character.visitedRegions ?? []).includes(regionId)
      if (isConnected && isVisited && canEnterRegion(region, character.level)) setTravelTarget(regionId)
    },
    [character]
  )

  const handleTravelConfirm = useCallback(() => {
    if (!travelTarget || !character) return
    const destRegion = getRegion(travelTarget)
    updateSelectedCharacter({ currentRegion: travelTarget, currentWeather: rollWeather(travelTarget) })
    addStoryEvent({
      id: `map-travel-${Date.now()}`,
      type: 'region_travel',
      characterId: character.id,
      locationId: character.locationId,
      timestamp: new Date().toISOString(),
      selectedOptionId: travelTarget,
      selectedOptionText: `Traveled to ${destRegion.name}`,
      outcomeDescription: `You set out for ${destRegion.icon} ${destRegion.name} — ${destRegion.description}`,
    })
    commit()
    setTravelTarget(null)
    soundEngine.playCrossroads()
  }, [travelTarget, character, updateSelectedCharacter, addStoryEvent, commit])

  const socialEncounter = gameState.socialEncounter

  const handleResolveDecision = (optionId: string) => {
    if (optionId === 'engage-conversation' && socialEncounter) {
      setShowNPCPanel(true)
      return
    }
    if (optionId === 'walk-away' && socialEncounter) {
      clearSocialEncounter()
      setDecisionPoint(null)
      return
    }
    if (optionId === 'visit-stable') return setShowStablePanel(true)
    if (optionId === 'check-mailbox') return setShowMailbox(true)
    if (optionId === 'visit-notice-board') return setShowNoticeBoard(true)
    if (optionId === 'visit-blacksmith') return setShowBlacksmith(true)
    if (optionId === 'visit-waypoints') return setShowWaypoints(true)
    if (optionId === 'rest-at-inn' && !restFromTavern.current) return setShowTavern(true)
    restFromTavern.current = false
    if (optionId.startsWith('talk-to-npc-')) {
      const npc = getNPCById(optionId.replace('talk-to-npc-', ''))
      if (npc) setTownNPC(npc)
      return
    }
    resolveDecisionMutation({
      decisionPoint: gameState.decisionPoint!,
      optionId,
      onSuccess: () => {
        const currentDP = useGameStore.getState().gameState.decisionPoint
        if (currentDP && currentDP.id === gameState.decisionPoint?.id) setDecisionPoint(null)
      },
      onResult: result => {
        const skipResults =
          optionId.startsWith('bypass-') || optionId.startsWith('travel-') || optionId.startsWith('talk-to-npc-') ||
          ['explore-landmark', 'leave-landmark', 'continue-exploring', 'visit-shop', 'back-to-town', 'pay-bounty', 'fight-secret-boss',
            'visit-stable', 'check-mailbox', 'visit-notice-board', 'rest-at-inn', 'visit-blacksmith', 'hire-transport', 'leave-town',
            'enter-town', 'visit-waypoints'].includes(optionId)
        if (!skipResults && result.outcomeDescription) {
          setEventResult({
            outcomeDescription: result.outcomeDescription,
            resourceDelta: result.resourceDelta,
            rewardItems: result.rewardItems?.map(item => ({ name: item.name, description: item.description })),
            mountDamage: result.mountDamage,
            mountDied: result.mountDied,
          })
        }
      },
      onResourceDelta: delta => {
        if (!delta) return
        const events: ResourceEvent[] = []
        if (delta.gold && delta.gold !== 0) events.push({ id: `gold-${Date.now()}`, type: 'gold', value: delta.gold })
        if (delta.reputation && delta.reputation !== 0) events.push({ id: `rep-${Date.now()}`, type: 'reputation', value: delta.reputation })
        if (events.length > 0) {
          setFloatingResources(events)
          if (floatingResourcesTimerRef.current != null) clearTimeout(floatingResourcesTimerRef.current)
          floatingResourcesTimerRef.current = setTimeout(() => setFloatingResources([]), 2000)
        }
      },
    })
  }

  /** True while the bill is asking something (an event, an arrival, a town, a stranger): the road waits. */
  const roadBlocked = () => {
    const live = useGameStore.getState().gameState
    return (
      (!!live.decisionPoint && !live.decisionPoint.resolved) ||
      live.combatState?.status === 'active' ||
      !!live.shopState?.isOpen
    )
  }

  const handleMoveForward = () => {
    if (moveForwardPending || roadBlocked()) return
    soundEngine.playTap()
    const character = getSelectedCharacter()
    const mountSpeed = character?.activeMount?.bonuses?.autoWalkSpeed ?? 1
    const distance = character?.distance ?? 0
    const nextDistance = distance + mountSpeed
    const ls = character?.landmarkState
    const nextPosInRegion = (ls?.positionInRegion ?? 0) + mountSpeed
    const activeTargetIndex = ls?.activeTargetIndex ?? 0
    const isExitTarget = ls ? activeTargetIndex >= ls.landmarks.length : false
    const activeTargetPosition = ls
      ? isExitTarget
        ? (ls.regionLength ?? 200)
        : (ls.landmarks[activeTargetIndex]?.distanceFromEntry ?? Infinity)
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
      : !charPos && ls != null && nextPosInRegion >= activeTargetPosition
    const hitsMilestone = crossedMilestone(distance, nextDistance, SHOP_MILESTONE_INTERVAL) || hitsTarget
    if (hitsMilestone) {
      moveForwardMutation()
      return
    }
    if (flipCoin(0.03, 0.97)) {
      const region = character ? getRegion(character.currentRegion ?? 'green_meadows') : null
      setGenericMessage(
        getGenericTravelMessage({ regionElement: region?.element, timeOfDay: TIME_LABEL[getTimeOfDay(character?.distance ?? 0)], weather: character?.currentWeather })
      )
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

  const prevCompletedRef = useRef<Set<string>>(new Set((gameState.achievements ?? []).filter(a => a.completed).map(a => a.achievementId)))
  useEffect(() => {
    const currentCompleted = new Set((gameState.achievements ?? []).filter(a => a.completed).map(a => a.achievementId))
    const newOnes: string[] = []
    for (const id of currentCompleted) if (!prevCompletedRef.current.has(id)) newOnes.push(id)
    prevCompletedRef.current = currentCompleted
    if (newOnes.length > 0) setNewlyCompletedIds(newOnes)
  }, [gameState.achievements])

  useEffect(() => {
    if (gameState.decisionPoint || gameState.combatState || gameState.shopState || moveForwardPending) clearAutoWalk()
  }, [gameState.decisionPoint, gameState.combatState, gameState.shopState, moveForwardPending, clearAutoWalk])

  useEffect(() => () => clearAutoWalk(), [clearAutoWalk])
  useEffect(() => () => { if (floatingResourcesTimerRef.current != null) clearTimeout(floatingResourcesTimerRef.current) }, [])

  const walkInterval = () => {
    const mountSpeed = character?.activeMount?.bonuses?.autoWalkSpeed ?? 1
    const unlockedSkillIds = character?.unlockedSkills ?? []
    const unlockedSkillObjects = SKILLS.filter(s => unlockedSkillIds.includes(s.id))
    const walkSpeedBonus = getSkillBonus(unlockedSkillObjects, 'auto_walk_speed')
    return Math.round(300 / (mountSpeed * (1 + walkSpeedBonus.percentage / 100)))
  }

  // Keyboard: ? help · Esc close · 1–4 choose · Space/Enter walk
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return
      if (e.key === '?') {
        setShowKeyboardHelp(prev => !prev)
        return
      }
      if (e.key === 'Escape') {
        if (showKeyboardHelp) return setShowKeyboardHelp(false)
        if (showStatus) return setShowStatus(false)
        setDrawer(null)
        return
      }
      if (gameState.decisionPoint && !gameState.decisionPoint.resolved && !resolveDecisionPending && !decisionGracePeriod) {
        const num = parseInt(e.key, 10)
        if (num >= 1 && num <= gameState.decisionPoint.options.length) {
          e.preventDefault()
          handleResolveDecision(gameState.decisionPoint.options[num - 1].id)
        }
        return
      }
      if (gameState.combatState?.status === 'active' || gameState.shopState?.isOpen) return
      if ((e.key === ' ' || e.key === 'Enter') && !moveForwardPending) {
        e.preventDefault()
        const now = Date.now()
        if (now - lastMoveTimeRef.current >= walkInterval()) {
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
    if (roadBlocked()) return
    const interval = walkInterval()
    autoWalkTimeoutRef.current = setTimeout(() => {
      setIsAutoWalking(true)
      handleMoveForward()
      autoWalkIntervalRef.current = setInterval(() => handleMoveForward(), interval)
    }, 500)
  }
  const handlePointerUpOrLeave = (e: React.PointerEvent) => {
    e.preventDefault()
    clearAutoWalk()
  }

  if (!gameState) return <p className="p-4 text-center">No game found.</p>
  const { selectedCharacterId, storyEvents } = gameState
  if (!selectedCharacterId || !character) return <p className="p-4 text-center">Pick a character first.</p>

  /* ── what is on the stage right now ─────────────────────────────── */
  const distance = character.distance ?? 0
  const regionId = character.currentRegion ?? 'green_meadows'
  const region = getRegion(regionId)
  const day = calculateDay(distance)
  const timeOfDay = getTimeOfDay(distance)
  const weather = (character.currentWeather ?? 'clear') as WeatherId
  const combat = gameState.combatState
  const inCombat = combat?.status === 'active'
  const combatOver = !!combat && combat.status !== 'active'
  const inShop = !!gameState.shopState?.isOpen
  const dp = gameState.decisionPoint
  const asking = !!dp && !dp.resolved
  const isTownHub = !!dp && !dp.resolved && dp.options.some(o => o.id === 'leave-town') && character.landmarkState?.exploring === true
  const isLandmarkArrival = dp?.options?.some(o => o.id === 'explore-landmark' || o.id === 'bypass-landmark') ?? false
  const arrivalLandmark = isLandmarkArrival && character.landmarkState ? character.landmarkState.landmarks[character.landmarkState.nextLandmarkIndex] : null
  const townName = character.landmarkState?.exploringLandmarkName ?? 'Town'
  const ownEvents = storyEvents.filter(e => e.characterId === selectedCharacterId)
  const latest = ownEvents[ownEvents.length - 1]
  const newest = gameState.genericMessage
    ? { text: gameState.genericMessage }
    : latest?.outcomeDescription
      ? { text: latest.outcomeDescription }
      : null
  const caption = (
    <>
      Day {day} · {TIME_LABEL[timeOfDay]} · {Math.round(distance)} km<span className="hidden sm:inline"> · {region.name}</span>
    </>
  )
  const target = describeTarget(character)
  const party = (character.party ?? []).slice(0, 2)

  const npcPanel = (npc: GameNPC, onClose: () => void) => (
    <NPCDialoguePanel
      npc={npc}
      characterName={character.name}
      characterClass={character.class}
      characterLevel={character.level}
      reputation={character.reputation}
      region={regionId}
      characterCharisma={character.charisma ?? 5}
      activeCharismaBonus={character.activeExplorationSpells?.filter(s => s.effectType === 'cha_boost').reduce((sum, s) => sum + (s.value ?? 0), 0) ?? 0}
      disposition={character.npcEncounters?.[npc.id]?.disposition ?? 0}
      hiddenLandmarkName={character.landmarkState?.landmarks.find(lm => lm.hidden)?.name}
      hiddenLandmarkType={character.landmarkState?.landmarks.find(lm => lm.hidden)?.type}
      onEncounterUpdate={(dispositionDelta, reward, revealLandmark) => recordNPCEncounter(npc.id, dispositionDelta, reward, revealLandmark)}
      onClose={onClose}
      onRecruit={() => {
        const member = createPartyMember({
          id: `npc-${npc.id}`,
          name: npc.name,
          description: npc.description,
          icon: npc.icon,
          level: character.level,
          dailyCost: Math.max(1, Math.floor(character.level / 2)),
          rarity: 'uncommon',
          personality: npc.personality,
          relationship: character.npcEncounters?.[npc.id]?.disposition ?? 0,
          role: 'combatant',
        })
        if (addPartyMember(member)) onClose()
      }}
      isRecruited={(character.party ?? []).some(m => m.id === `npc-${npc.id}`)}
    />
  )

  const actors = (
    <>
      {party.map(m => (
        <Cutout key={m.id} role="party" name={m.customName ?? m.name} glyph={m.icon} height={88} dim={m.hp != null && m.hp <= 0} />
      ))}
      {character.activeMount && <Cutout role="mount" name={character.activeMount.customName ?? character.activeMount.name} height={70} />}
      <Cutout role="hero" name={character.name} height={120} rockKey={distance} />
      {inCombat && combat && (
        <>
          <Cutout
            role={combat.isBoss ? 'boss' : 'enemy'}
            name={combat.enemy.name}
            facing="left"
            height={combat.isBoss ? 140 : 110}
            rockKey={combat.enemy.hp}
            meter={combat.enemy.maxHp ? combat.enemy.hp / combat.enemy.maxHp : undefined}
            meterLabel={`${combat.enemy.name} health`}
            dim={combat.enemy.hp <= 0}
          />
          {combat.additionalEnemies?.filter(e => e.hp > 0).slice(0, 2).map(e => (
            <Cutout key={e.id} role="enemy" name={e.name} facing="left" height={90} rockKey={e.hp} meter={e.maxHp ? e.hp / e.maxHp : undefined} />
          ))}
        </>
      )}
      {!inCombat && socialEncounter && dp && !dp.resolved && (
        <Cutout role="npc" name={socialEncounter.npc.name} glyph={socialEncounter.npc.icon} facing="left" height={110} rockKey={showNPCPanel ? 1 : 0} />
      )}
      {!inCombat && townNPC && <Cutout role="npc" name={townNPC.name} glyph={townNPC.icon} facing="left" height={110} rockKey={1} />}
    </>
  )

  const apron = inCombat && combat ? (
    <PlaybillSheet as="section" aria-label="The fight" className="px-4 py-3 sm:px-5">
      <CombatUI combatState={combat} />
    </PlaybillSheet>
  ) : combatOver && combat ? (
    <PlaybillSheet as="section" aria-label="How the fight ended" className="px-4 py-3 sm:px-5">
      <CombatResult
        combatState={combat}
        onContinue={() => {
          if (combat.status === 'victory') {
            const { achievements, newlyCompleted } = checkAchievements(character, gameState, gameState.achievements ?? [], {
              type: 'combat_win',
              hpAfterCombat: combat.playerState.hp,
              maxHp: combat.playerState.maxHp,
              isBoss: combat.isBoss ?? false,
              turnCount: combat.turnNumber,
              partyAlive: (combat.partyMemberStates ?? []).filter(m => !m.isKnockedOut).length,
              partyTotal: (combat.partyMemberStates ?? []).length,
              enemyLevel: combat.enemy.level,
              playerLevel: character.level,
              currentWeather: character.currentWeather,
            })
            updateAchievements(achievements)
            if (newlyCompleted.length > 0) {
              applyAchievementRewards(newlyCompleted)
              setNewlyCompletedIds(newlyCompleted)
            }
          } else if (combat.status === 'defeat') {
            const { achievements, newlyCompleted } = checkAchievements(character, gameState, gameState.achievements ?? [], { type: 'death' })
            updateAchievements(achievements)
            if (newlyCompleted.length > 0) {
              applyAchievementRewards(newlyCompleted)
              setNewlyCompletedIds(newlyCompleted)
            }
          }
          setCombatState(null)
        }}
      />
    </PlaybillSheet>
  ) : inShop ? (
    <PlaybillSheet as="section" aria-label="The shop" className="px-4 py-3 sm:px-5">
      <ShopUI />
    </PlaybillSheet>
  ) : isTownHub && dp ? (
    <PlaybillSheet as="section" aria-label={townName} className="px-4 py-3 sm:px-5">
      <PlaybillTitle size="md">{townName}</PlaybillTitle>
      <PlaybillCaption className="mt-2 text-center">{caption}</PlaybillCaption>
      <div className="mt-4">
        {townNPC ? (
          npcPanel(townNPC, () => setTownNPC(null))
        ) : showNoticeBoard ? (
          <NoticeBoard
            character={character}
            activeQuest={gameState.activeQuest ?? null}
            onAcceptQuest={quest => {
              useGameStore.getState().setActiveQuest(quest)
              setShowNoticeBoard(false)
            }}
            onClose={() => setShowNoticeBoard(false)}
          />
        ) : showTavern ? (
          <TavernPanel
            character={character}
            townName={character.landmarkState?.exploringLandmarkName ?? 'the town'}
            onRest={() => {
              setShowTavern(false)
              restFromTavern.current = true
              handleResolveDecision('rest-at-inn')
            }}
            isResting={resolveDecisionPending}
            onClose={() => setShowTavern(false)}
          />
        ) : showBlacksmith ? (
          <div className="space-y-3">
            <PaperButton variant="outline" size="sm" onClick={() => setShowBlacksmith(false)}>Back to town</PaperButton>
            <CraftingPanel />
          </div>
        ) : showStablePanel ? (
          <StablePanel character={character} onClose={() => setShowStablePanel(false)} regionId={regionId} />
        ) : showMailbox ? (
          <MailboxPanel character={character} onClose={() => setShowMailbox(false)} />
        ) : showWaypoints ? (
          <WaypointPanel
            character={character}
            currentTownName={character.landmarkState?.exploringLandmarkName ?? 'the town'}
            onTravel={(regionId, _landmarkId, cost) => {
              setShowWaypoints(false)
              updateSelectedCharacter({
                gold: Math.max(0, (character.gold ?? 0) - cost),
                currentRegion: regionId,
                currentWeather: rollWeather(regionId),
                landmarkState: undefined,
              })
              setDecisionPoint(null)
            }}
            onClose={() => setShowWaypoints(false)}
          />
        ) : (
          <TownHub
            townName={townName}
            townIcon={character.landmarkState?.landmarks[character.landmarkState?.activeTargetIndex ?? 0]?.icon}
            decisionPoint={dp}
            isResolving={resolveDecisionPending}
            character={character}
            onSelectOption={handleResolveDecision}
            npcDispositions={Object.fromEntries(Object.entries(character.npcEncounters ?? {}).map(([id, enc]) => [id, enc.disposition ?? 0]))}
          />
        )}
      </div>
    </PlaybillSheet>
  ) : (
    <PlaybillStrip
      caption={caption}
      target={target}
      onChangeTarget={() => {
        setDrawerSub(s => ({ ...s, map: 'area' }))
        setDrawer('map')
      }}
      newest={newest}
      decisionPoint={dp ?? null}
      isLandmarkArrival={isLandmarkArrival}
      arrivalLandmark={
        arrivalLandmark
          ? { name: arrivalLandmark.name, icon: arrivalLandmark.icon, description: arrivalLandmark.description ?? '', hasShop: arrivalLandmark.hasShop ?? false }
          : null
      }
      isLegendary={dp?.isLegendary ?? false}
      isResolving={resolveDecisionPending}
      decisionGracePeriod={decisionGracePeriod}
      onSelectOption={handleResolveDecision}
      errorLine={fitToShow(resolveDecisionError) ?? (!dp ? fitToShow(moveForwardError) : null)}
      eventResult={eventResult}
      onDismissResult={() => setEventResult(null)}
      npcPanel={
        showNPCPanel && socialEncounter
          ? npcPanel(socialEncounter.npc, () => {
              setShowNPCPanel(false)
              clearSocialEncounter()
              setDecisionPoint(null)
            })
          : null
      }
    >
      {showStablePanel && <StablePanel character={character} onClose={() => setShowStablePanel(false)} regionId={regionId} />}
      {showMailbox && <MailboxPanel character={character} onClose={() => setShowMailbox(false)} />}
    </PlaybillStrip>
  )

  const tabs = drawerTabs(isTownHub)

  return (
    <>
      <AchievementToastContainer achievementIds={newlyCompletedIds} />
      {gameState.pendingLootCelebration && <RareLootCelebration item={gameState.pendingLootCelebration} onDismiss={dismissLootCelebration} />}
      {showKeyboardHelp && <KeyboardHelp onClose={() => setShowKeyboardHelp(false)} />}
      {showStatus && <PlayerStatusView onClose={() => setShowStatus(false)} />}
      {showDailyReward && (
        <DailyRewardPopup
          streak={gameState.dailyReward?.streak ?? 0}
          reward={getDailyReward(gameState.dailyReward?.streak ?? 0)}
          onClaim={() => claimDailyReward()}
          onDismiss={() => setShowDailyReward(false)}
        />
      )}
      {activeHint && <OnboardingHint title={ONBOARDING_HINTS[activeHint].title} body={ONBOARDING_HINTS[activeHint].body} onDismiss={() => markHintSeen(activeHint)} />}
      {(character.pendingStatPoints ?? 0) > 0 && (
        <StatAllocationScreen character={character} onConfirm={(str, int, lck, cha) => allocateStatPoints(str, int, lck, cha)} />
      )}
      {travelTarget && <TravelConfirmDialog region={getRegion(travelTarget)} onConfirm={handleTravelConfirm} onCancel={() => setTravelTarget(null)} />}

      <Theatre
        regionId={regionId}
        timeOfDay={timeOfDay}
        weather={weather}
        sceneKey={regionId}
        stepKey={distance}
        identity={
          <button
            type="button"
            onClick={() => setShowStatus(true)}
            className="rounded-[3px] text-left focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ds-primary"
            aria-label={`${character.name}: open the full character sheet`}
            title="Open the character sheet"
          >
            <Identity character={character} />
          </button>
        }
        placards={<Placards character={character} />}
        controls={
          <>
            <ControlButton label={soundEnabled ? 'Mute sounds' : 'Turn sounds on'} onClick={toggleSound}>
              {soundEnabled ? <SoundOnIcon /> : <SoundOffIcon />}
            </ControlButton>
            <ControlButton label="Keyboard shortcuts" onClick={() => setShowKeyboardHelp(true)}>
              <HelpIcon />
            </ControlButton>
            <ControlButton label="Characters" href={`${ROUTE_CONSTANTS.TAP_TAP_ADVENTURE}/characters`}>
              <CharactersIcon />
              <span className="hidden sm:inline">Characters</span>
            </ControlButton>
          </>
        }
        log={<StoryLog events={storyEvents} filterCharacterId={selectedCharacterId} />}
        actors={actors}
        apron={apron}
        footlights={
          inCombat || inShop || asking ? (
            <div className="hidden h-[76px] items-center justify-center rounded-full border-4 border-ps-brass-deep font-playbill text-sm uppercase tracking-widest text-ps-brass-light md:flex">
              {inCombat ? 'The road waits' : inShop ? 'Browsing the stall' : isTownHub ? `In ${townName}` : 'Choose on the bill'}
            </div>
          ) : (
            <WalkBar
              distance={distance}
              pending={moveForwardPending}
              autoWalking={isAutoWalking}
              disabled={resolveDecisionPending}
              onClick={handleMoveForward}
              onPointerDown={handlePointerDown}
              onPointerUp={handlePointerUpOrLeave}
              error={fitToShow(moveForwardError)}
              overlay={<FloatingResources events={floatingResources} />}
            />
          )
        }
        plate={<HudPlate character={character} />}
        tabs={tabs}
        activeTab={drawer}
        onTab={id => {
          setMappedPlace(null)
          setDrawer(d => (d === id ? null : (id as DrawerId)))
        }}
        sheetTitle={drawer ? DRAWER_TABS[drawer].label : undefined}
        onCloseSheet={() => {
          setMappedPlace(null)
          setDrawer(null)
        }}
        sheet={
          drawer ? (
            <DrawerContent
              drawer={drawer}
              sub={drawerSub[drawer]}
              onSub={id => setDrawerSub(s => ({ ...s, [drawer]: id }))}
              character={character}
              gameState={gameState}
              onSelectTarget={i => setActiveTarget(i)}
              onRegionClick={handleRegionClick}
              townHub={isTownHub && dp ? { decisionPointId: dp.id, isResolving: resolveDecisionPending, onSelectOption: handleResolveDecision } : null}
              onRevealLandmark={(index, name) => {
                // Show the map with the new place ringed, so the map item is seen to work.
                setMappedPlace({ index, name })
                setDrawerSub(s => ({ ...s, map: 'area' }))
                setDrawer('map')
              }}
              highlightLandmark={drawer === 'map' ? mappedPlace : null}
              onClose={() => setDrawer(null)}
            />
          ) : null
        }
      />
    </>
  )
}
