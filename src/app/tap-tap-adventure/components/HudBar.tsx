'use client'
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'

import { getDifficultyMode } from '@/app/tap-tap-adventure/config/difficultyModes'
import { getRegion } from '@/app/tap-tap-adventure/config/regions'
import { WEATHER_TYPES, WeatherId } from '@/app/tap-tap-adventure/config/weather'
import { Mount } from '@/app/tap-tap-adventure/models/mount'
import { getMountDisplayName } from '@/app/tap-tap-adventure/lib/mountUtils'
import { useGameStore } from '@/app/tap-tap-adventure/hooks/useGameStore'
import { soundEngine } from '@/app/tap-tap-adventure/lib/soundEngine'
import { getReputationTier, ReputationTier } from '@/app/tap-tap-adventure/lib/contextBuilder'
import { levelProgress, stepsToNextLevel, stepsRequiredForLevel, calculateDay } from '@/app/tap-tap-adventure/lib/leveling'
import { FantasyCharacter } from '@/app/tap-tap-adventure/models/character'

type IconType =
  | 'heartIcon'
  | 'sunIcon'
  | 'waterDropIcon'
  | 'leafIcon'
  | 'fireIcon'
  | 'dayIcon'
  | 'purpleCircleIcon'
  | 'blueCircleIcon'
  | 'yellowMoonIcon'

const ICONS: Record<IconType, React.ReactNode> = {
  heartIcon: (
    <svg width="20" height="20" fill="#EF4444" viewBox="0 0 20 20">
      <path d="M10 18l-1.45-1.32C3.4 12.36 0 9.28 0 5.5 0 2.42 2.42 0 5.5 0 7.24 0 8.91.81 10 2.09 11.09.81 12.76 0 14.5 0 17.58 0 20 2.42 20 5.5c0 3.78-3.4 6.86-8.55 11.18L10 18z" />
    </svg>
  ),
  sunIcon: (
    <svg width="20" height="20" fill="#FACC15" viewBox="0 0 20 20">
      <circle cx="10" cy="10" r="8" />
    </svg>
  ),
  waterDropIcon: (
    <svg width="20" height="20" fill="#60A5FA" viewBox="0 0 20 20">
      <path d="M10 2c-4.418 0-8 3.582-8 8 0 2.665 1.323 5.023 3.34 6.497L10 20l4.66-3.503A7.963 7.963 0 0018 10c0-4.418-3.582-8-8-8z" />
    </svg>
  ),
  leafIcon: (
    <svg width="20" height="20" fill="#4ADE80" viewBox="0 0 20 20">
      <path d="M10 2C6.94 .746 4.62.063 2.5 3.5c-1.25 2 0 4.5 0 4.5S4.5 17.5 10 17.5s7.5-9.5 7.5-9.5S13.75.746 10 2z" />
    </svg>
  ),
  fireIcon: (
    <svg width="20" height="20" fill="#F97316" viewBox="0 0 20 20">
      <path d="M10.5 0C7.286.057 4.536 2.018 4.536 5.714 4.536 9.07 7.071 11.25 7.071 12.5c0 .964-1.071 3.75-1.071 3.75s1.071.893 3.5.893c2.679 0 3.5-1.25 3.5-1.25s-1.071-2.679-1.071-3.75C12.429 11.25 15 9.07 15 5.714 15 2.018 12.714.057 10.5 0z" />
    </svg>
  ),
  dayIcon: (
    <svg width="20" height="20" fill="#FB923C" viewBox="0 0 20 20">
      <circle cx="10" cy="10" r="5" />
      <line x1="10" y1="1" x2="10" y2="4" stroke="#FB923C" strokeWidth="2" />
      <line x1="10" y1="16" x2="10" y2="19" stroke="#FB923C" strokeWidth="2" />
      <line x1="1" y1="10" x2="4" y2="10" stroke="#FB923C" strokeWidth="2" />
      <line x1="16" y1="10" x2="19" y2="10" stroke="#FB923C" strokeWidth="2" />
    </svg>
  ),
  purpleCircleIcon: (
    <svg width="20" height="20" fill="#A78BFA" viewBox="0 0 20 20">
      <circle cx="10" cy="10" r="8" />
    </svg>
  ),
  blueCircleIcon: (
    <svg width="20" height="20" fill="#3B82F6" viewBox="0 0 20 20">
      <circle cx="10" cy="10" r="8" />
    </svg>
  ),
  yellowMoonIcon: (
    <svg width="20" height="20" fill="#FACC15" viewBox="0 0 20 20">
      <path d="M10 20C4.477 20 0 15.523 0 10S4.477 0 10 0c.34 0 .674.02 1 .058A8.001 8.001 0 0110 4a8 8 0 01-2.928 6A8.001 8.001 0 011 10c.02.326.04.66.058 1A10.004 10.004 0 0010 20z" />
    </svg>
  ),
} as const

const STAT_LABELS: Record<IconType, string> = {
  heartIcon: 'HP',
  sunIcon: 'Gold',
  waterDropIcon: 'Reputation',
  leafIcon: 'km',
  fireIcon: 'Level',
  dayIcon: 'Day',
  purpleCircleIcon: 'STR — Attack power, max HP',
  blueCircleIcon: 'INT — Defense, mana pool',
  yellowMoonIcon: 'LCK — Crit chance, loot, flee',
} as const

const STATS_LEFT: IconType[] = ['heartIcon', 'sunIcon', 'waterDropIcon', 'leafIcon', 'fireIcon', 'dayIcon']
const STATS_RIGHT: IconType[] = ['purpleCircleIcon', 'blueCircleIcon', 'yellowMoonIcon']

interface HudBarProps {
  onOpenStatus?: () => void
}

export function HudBar({ onOpenStatus }: HudBarProps = {}) {
  const { gameState, setMount } = useGameStore()
  const character = gameState?.characters?.find(
    (char: FantasyCharacter) => char.id === gameState?.selectedCharacterId
  )

  const distance = character?.distance ?? 0
  const level = character?.level ?? 1
  const progress = character ? levelProgress(distance) : 0
  const stepsNeeded = stepsToNextLevel(level)
  const stepsIntoLevel = distance - stepsRequiredForLevel(level)
  const day = calculateDay(distance)
  const hp = character?.hp ?? character?.maxHp ?? 100
  const maxHp = character?.maxHp ?? 100
  const hpPct = Math.round((hp / maxHp) * 100)

  const stats = useMemo(
    () => ({
      heartIcon: `${character?.hp ?? character?.maxHp ?? 100}`,
      sunIcon: character?.gold ?? 0,
      waterDropIcon: character?.reputation ?? 0,
      leafIcon: character?.distance ?? 0,
      fireIcon: character?.level ?? 1,
      dayIcon: calculateDay(character?.distance ?? 0),
      purpleCircleIcon: character?.strength ?? 0,
      blueCircleIcon: character?.intelligence ?? 0,
      yellowMoonIcon: character?.luck ?? 0,
    }),
    [character]
  ) as Record<IconType, number | string>

  interface StatDelta { id: string; key: IconType; delta: number }
  const [statDeltas, setStatDeltas] = useState<StatDelta[]>([])
  const prevStatsRef = useRef<Partial<Record<IconType, number>>>({})

  useEffect(() => {
    const trackedKeys: IconType[] = ['heartIcon', 'sunIcon', 'waterDropIcon']
    const newDeltas: StatDelta[] = []
    for (const key of trackedKeys) {
      const rawVal = stats[key]
      const current = typeof rawVal === 'string' ? parseInt(rawVal, 10) : (rawVal as number)
      const prev = prevStatsRef.current[key]
      if (prev !== undefined && !isNaN(current) && current !== prev) {
        newDeltas.push({ id: `${key}-${Date.now()}`, key, delta: current - prev })
      }
      if (!isNaN(current)) {
        prevStatsRef.current[key] = current
      }
    }
    if (newDeltas.length > 0) {
      setStatDeltas(prev => {
        const combined = [...prev, ...newDeltas].slice(-5)
        return combined
      })
      newDeltas.forEach(d => {
        setTimeout(() => {
          setStatDeltas(prev => prev.filter(x => x.id !== d.id))
        }, 1200)
      })
    }
  }, [stats])

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

  const [activeTooltip, setActiveTooltip] = useState<IconType | null>(null)

  const getTooltipText = useCallback((key: IconType): string => {
    switch (key) {
      case 'heartIcon': return `HP: ${hp}/${maxHp}`
      case 'fireIcon': return `Level ${level} — ${stepsIntoLevel}/${stepsNeeded} km to next`
      case 'waterDropIcon': return `Reputation: ${getReputationTier(stats[key] as number)} (${stats[key]})`
      case 'dayIcon': return `Day ${day} (${50 - (distance % 50)} km to next day)`
      default: return STAT_LABELS[key]
    }
  }, [hp, maxHp, level, stepsIntoLevel, stepsNeeded, day, distance, stats])

  const handleStatTap = useCallback((key: IconType) => {
    setActiveTooltip(prev => prev === key ? null : key)
    // Auto-dismiss after 2 seconds
    setTimeout(() => setActiveTooltip(null), 2000)
  }, [])

  const reputationTier = getReputationTier(character?.reputation ?? 0)
  const reputationTierColorMap: Record<ReputationTier, string> = {
    'Wanted Criminal': 'text-red-400',
    Infamous: 'text-red-400',
    Disreputable: 'text-orange-400',
    Unknown: 'text-slate-400',
    Respected: 'text-blue-400',
    Renowned: 'text-purple-400',
    Legendary: 'text-amber-400',
    'Living Legend': 'text-yellow-300',
  }
  const reputationTierColor = reputationTierColorMap[reputationTier]

  const MOBILE_HIDDEN_STATS: IconType[] = ['waterDropIcon', 'leafIcon', 'dayIcon']

  const renderStat = (key: IconType) => (
    <div key={key} className={`relative ${MOBILE_HIDDEN_STATS.includes(key) ? 'hidden sm:block' : ''}`}>
      <button
        className="flex flex-col items-center gap-0.5 text-xs sm:text-sm font-semibold"
        onClick={() => handleStatTap(key)}
        onMouseEnter={() => setActiveTooltip(key)}
        onMouseLeave={() => setActiveTooltip(null)}
      >
        <div className="flex items-center gap-1">
          <span className="inline-block align-middle shrink-0">{ICONS[key]}</span>
          <span>{stats[key]}</span>
        {key === 'waterDropIcon' && (
          <span className={`text-[8px] sm:text-[9px] ${reputationTierColor} ml-0.5`}>{reputationTier}</span>
        )}
        {key === 'heartIcon' && (
          <span className="w-8 sm:w-12 h-1.5 bg-slate-700 rounded-full overflow-hidden ml-1">
            <span
              className={`block h-full rounded-full transition-all duration-300 ${
                hpPct > 50 ? 'bg-green-500' : hpPct > 25 ? 'bg-yellow-500' : 'bg-red-500'
              }`}
              style={{ width: `${hpPct}%` }}
            />
          </span>
        )}
        {key === 'fireIcon' && (
          <span className="w-8 sm:w-12 h-1.5 bg-slate-700 rounded-full overflow-hidden ml-1">
            <span
              className="block h-full bg-orange-400 rounded-full transition-all duration-300"
              style={{ width: `${progress * 100}%` }}
            />
          </span>
        )}
        </div>
        <span className="text-[8px] sm:text-[9px] text-slate-500 leading-none">{STAT_LABELS[key]}</span>
      </button>
      {activeTooltip === key && (
        <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-1 px-2 py-1 bg-slate-800 border border-slate-600 rounded text-[10px] text-slate-200 whitespace-nowrap z-50 shadow-lg">
          {getTooltipText(key)}
        </div>
      )}
      {statDeltas.filter(d => d.key === key).map(d => (
        <span
          key={d.id}
          className={`absolute top-0 left-full ml-1 text-[10px] font-bold pointer-events-none animate-float-up ${d.delta > 0 ? 'text-green-400' : 'text-red-400'}`}
        >
          {d.delta > 0 ? `+${d.delta}` : `${d.delta}`}
        </span>
      ))}
    </div>
  )

  const currentRegion = getRegion(character?.currentRegion ?? 'green_meadows')
  const difficultyMode = getDifficultyMode(character?.difficultyMode ?? 'normal')
  const difficultyColorMap: Record<string, string> = {
    normal: 'border-indigo-400 text-indigo-300',
    hard: 'border-red-400 text-red-300',
    ironman: 'border-orange-400 text-orange-300',
    casual: 'border-green-400 text-green-300',
  }
  const difficultyColor = difficultyColorMap[difficultyMode.id] ?? 'border-slate-400 text-slate-300'

  const activeMount = character?.activeMount

  const getMountTooltip = (mount: Mount): string => {
    const bonusParts: string[] = []
    if (mount.bonuses.strength) bonusParts.push(`+${mount.bonuses.strength} STR`)
    if (mount.bonuses.intelligence) bonusParts.push(`+${mount.bonuses.intelligence} INT`)
    if (mount.bonuses.luck) bonusParts.push(`+${mount.bonuses.luck} LCK`)
    if (mount.bonuses.autoWalkSpeed) bonusParts.push(`${mount.bonuses.autoWalkSpeed}x speed`)
    if (mount.bonuses.healRate) bonusParts.push(`+${mount.bonuses.healRate} heal`)
    const bonusStr = bonusParts.length > 0 ? bonusParts.join(', ') : 'no bonuses'
    return `${getMountDisplayName(mount)} — ${bonusStr} (${mount.dailyCost} gp/day)`
  }

  const mountRarityColor: Record<string, string> = {
    common: 'border-slate-400',
    uncommon: 'border-green-400',
    rare: 'border-blue-400',
    legendary: 'border-yellow-400',
  }

  return (
    <div className="w-full flex flex-wrap justify-between items-center gap-x-1 sm:gap-x-3 gap-y-2 px-2 sm:px-3 py-2 rounded-lg shadow-md bg-[#161723] border border-[#3a3c56] text-white select-none overflow-hidden">
      <div className="flex items-center gap-1 sm:gap-4 flex-wrap">
        {STATS_LEFT.map(renderStat)}
      </div>
      <div className="flex items-center gap-1 sm:gap-4">
        <span
          className="text-[10px] px-1.5 py-0.5 border rounded border-emerald-400 text-emerald-300 bg-[#2a2b3f]"
          title={`${currentRegion.name}: ${currentRegion.description}`}
        >
          {currentRegion.icon} {currentRegion.name}
        </span>
        {/* Region danger indicator */}
        {(() => {
          const levelDiff = (currentRegion.minLevel ?? 0) - level
          const mult = currentRegion.difficultyMultiplier ?? 1
          const danger = levelDiff >= 4 ? { label: 'Deadly', color: 'border-red-500 text-red-400', icon: '☠️' }
            : levelDiff >= 2 ? { label: 'Hard', color: 'border-orange-500 text-orange-400', icon: '⚠️' }
            : mult >= 1.5 ? { label: 'Tough', color: 'border-yellow-500 text-yellow-400', icon: '💪' }
            : null
          return danger ? (
            <span
              className={`text-[10px] px-1.5 py-0.5 border rounded ${danger.color} bg-[#2a2b3f]`}
              title={`Region difficulty: ${currentRegion.difficulty} (${mult}x). Recommended level: ${currentRegion.minLevel}+`}
            >
              {danger.icon} {danger.label}
            </span>
          ) : null
        })()}
        {(() => {
          const weatherType = WEATHER_TYPES[(character?.currentWeather ?? 'clear') as WeatherId] ?? WEATHER_TYPES.clear
          return weatherType.id !== 'clear' ? (
            <span
              className="text-[10px] px-1.5 py-0.5 border rounded border-sky-400 text-sky-300 bg-[#2a2b3f]"
              title={`${weatherType.name}: ${weatherType.description}`}
            >
              {weatherType.icon} {weatherType.name}
            </span>
          ) : null
        })()}
        {difficultyMode.id !== 'normal' && (
          <span
            className={`text-[10px] px-1.5 py-0.5 border rounded ${difficultyColor} bg-[#2a2b3f]`}
            title={`${difficultyMode.name}: ${difficultyMode.description}`}
          >
            {difficultyMode.icon} {difficultyMode.name}
          </span>
        )}
        {activeMount && (
          <div className="relative flex items-center gap-1">
            <button
              className={`flex items-center gap-1 text-xs sm:text-sm font-semibold border rounded px-1.5 py-0.5 ${mountRarityColor[activeMount.rarity] ?? 'border-slate-400'} bg-[#2a2b3f]`}
              title={getMountTooltip(activeMount)}
            >
              <span>{activeMount.icon}</span>
              <span className="hidden sm:inline text-[10px]">{getMountDisplayName(activeMount)}</span>
            </button>
            <button
              className="text-[9px] sm:text-[10px] text-red-400 hover:text-red-300 border border-red-400/30 rounded px-1 py-0.5 bg-[#2a2b3f] hover:bg-[#3a3c56]"
              title="Release mount"
              onClick={() => setMount(null)}
            >
              <span className="sm:hidden">&#10005;</span>
              <span className="hidden sm:inline">Release</span>
            </button>
          </div>
        )}
        <div className="hidden sm:flex items-center gap-1 sm:gap-4">
          {STATS_RIGHT.map(renderStat)}
        </div>
        {onOpenStatus && (
          <button
            className="text-[10px] px-1.5 py-0.5 rounded border border-[#3a3c56] bg-[#2a2b3f] hover:bg-[#3a3c56] transition-colors text-slate-300"
            onClick={onOpenStatus}
            title="View character status"
            aria-label="View character status"
          >
            <span className="sm:hidden">{'\u2139'}</span>
            <span className="hidden sm:inline">Status</span>
          </button>
        )}
        <button
          className="text-sm px-1.5 py-0.5 rounded border border-[#3a3c56] bg-[#2a2b3f] hover:bg-[#3a3c56] transition-colors"
          onClick={toggleSound}
          title={soundEnabled ? 'Mute sounds' : 'Enable sounds'}
          aria-label={soundEnabled ? 'Mute sounds' : 'Enable sounds'}
        >
          <span>{soundEnabled ? '\u{1F50A}' : '\u{1F507}'}</span>
        </button>
      </div>
    </div>
  )
}
