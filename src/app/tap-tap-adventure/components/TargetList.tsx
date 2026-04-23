'use client'

import { useState } from 'react'
import { euclidean } from '@/app/tap-tap-adventure/lib/movementUtils'

// Minimal landmark shape compatible with both GeneratedLandmark and the character schema
interface LandmarkInfo {
  name: string
  icon: string
  hasShop: boolean
  distanceFromEntry: number
  hidden?: boolean
  explored?: boolean
  position?: { x: number; y: number }
}

interface Target {
  index: number
  name: string
  icon: string
  type: 'landmark' | 'region_exit'
  position: number
  isExplored?: boolean
  hasShop?: boolean
  hidden?: boolean
  position2d?: { x: number; y: number }
}

interface ExitTargetInfo {
  regionId: string
  name: string
  icon: string
  position: { x: number; y: number }
}

interface TargetListProps {
  landmarks: LandmarkInfo[]
  positionInRegion: number
  activeTargetIndex: number
  regionLength: number
  regionName?: string
  onSelectTarget: (index: number) => void
  disabled: boolean
  characterPosition?: { x: number; y: number }
  exitTargets?: ExitTargetInfo[]
}

type DiscoveryTier = 'hidden' | 'distant' | 'unknown' | 'revealed'

function getDiscoveryTier(stepsRemaining: number, isExplored: boolean): DiscoveryTier {
  if (isExplored) return 'revealed'
  if (stepsRemaining > 100) return 'hidden'
  if (stepsRemaining > 50) return 'distant'
  if (stepsRemaining > 20) return 'unknown'
  return 'revealed'
}

function getDiscoveryDisplay(tier: DiscoveryTier, realName: string, realIcon: string) {
  switch (tier) {
    case 'hidden': return { name: 'Distant landmark', icon: '🔍' }
    case 'distant': return { name: 'Distant landmark', icon: '🔍' }
    case 'unknown': return { name: 'Unknown landmark', icon: '❓' }
    case 'revealed': return { name: realName, icon: realIcon }
  }
}

export function TargetList({
  landmarks,
  positionInRegion,
  activeTargetIndex,
  regionLength,
  regionName,
  onSelectTarget,
  disabled,
  characterPosition,
  exitTargets,
}: TargetListProps) {
  const [isExpanded, setIsExpanded] = useState(false)

  // Build target list: landmarks + per-exit targets (hidden landmarks are excluded from display)
  const exitList = exitTargets && exitTargets.length > 0
    ? exitTargets
    : [{ regionId: '', name: regionName ? `Leave ${regionName}` : 'Leave Region', icon: '🚪', position: { x: 490, y: 250 } }]

  const targets: Target[] = [
    ...landmarks
      .map((lm, i) => ({
        index: i,
        name: lm.name,
        icon: lm.icon,
        type: 'landmark' as const,
        position: lm.distanceFromEntry,
        isExplored: lm.explored ?? false,
        hasShop: lm.hasShop,
        hidden: lm.hidden ?? false,
        position2d: lm.position,
      }))
      .filter(t => !t.hidden),
    ...exitList.map((exit, i) => ({
      index: landmarks.length + i,
      name: exit.name,
      icon: exit.icon,
      type: 'region_exit' as const,
      position: regionLength,
      position2d: exit.position,
    })),
  ]

  const activeTarget = targets.find(t => t.index === activeTargetIndex) ?? targets[0]

  return (
    <div className="space-y-1">
      <p className="text-[10px] text-slate-500 uppercase tracking-wide mb-1">Targets</p>

      {/* Mobile collapsed view - only show on small screens when not expanded */}
      {!isExpanded && (
        <div className="md:hidden">
          {activeTarget && (() => {
            const isExplored = activeTarget.isExplored ?? false
            const stepsRemaining = characterPosition && activeTarget.position2d
              ? Math.ceil(euclidean(characterPosition, activeTarget.position2d))
              : Math.max(0, activeTarget.position - positionInRegion)
            const tier = activeTarget.type === 'region_exit' ? 'revealed' : getDiscoveryTier(stepsRemaining, isExplored)
            const display = getDiscoveryDisplay(tier, activeTarget.name, activeTarget.icon)

            return (
              <div className="flex items-center gap-1">
                <div className="flex-1 flex items-center justify-between px-2.5 py-1.5 rounded text-xs bg-indigo-900/50 border border-indigo-500/60 text-indigo-200">
                  <span className="flex items-center gap-1.5 min-w-0">
                    <span className="text-sm flex-shrink-0">{display.icon}</span>
                    <span className="truncate font-medium">{display.name}</span>
                    {tier === 'revealed' && activeTarget.hasShop && (
                      <span className="text-[9px] px-1 py-0.5 rounded bg-yellow-900/40 border border-yellow-600/40 text-yellow-300 flex-shrink-0">
                        Shop
                      </span>
                    )}
                  </span>
                  <span className="flex items-center gap-1 flex-shrink-0 ml-2">
                    {isExplored ? (
                      <span className="text-[10px] text-slate-500">explored</span>
                    ) : (
                      <span className="text-[10px] text-indigo-300">
                        {stepsRemaining === 0 ? 'here' : `${stepsRemaining} km`}
                      </span>
                    )}
                  </span>
                </div>
                <button
                  onClick={() => setIsExpanded(true)}
                  className="px-2 py-1.5 rounded text-[10px] text-slate-400 hover:text-slate-200 border border-[#3a3c56] hover:border-indigo-600/50 bg-[#1e1f30] transition-colors flex-shrink-0"
                >
                  Change &#9660;
                </button>
              </div>
            )
          })()}
        </div>
      )}

      {/* Full list - always visible on md+, toggleable on mobile */}
      <div className={`${isExpanded ? '' : 'hidden'} md:block`}>
        {/* On mobile when expanded, show collapse button */}
        {isExpanded && (
          <button
            onClick={() => setIsExpanded(false)}
            className="md:hidden w-full text-center text-[10px] text-slate-400 hover:text-slate-200 py-1 mb-1"
          >
            &#9650; Collapse
          </button>
        )}
        {targets.map(target => {
          const isExplored = target.isExplored ?? false
          const isActive = target.index === activeTargetIndex
          const stepsRemaining = characterPosition && target.position2d
            ? Math.ceil(euclidean(characterPosition, target.position2d))
            : Math.max(0, target.position - positionInRegion)
          const tier = target.type === 'region_exit' ? 'revealed' : getDiscoveryTier(stepsRemaining, isExplored)
          if (tier === 'hidden') return null
          const display = getDiscoveryDisplay(tier, target.name, target.icon)

          return (
            <button
              key={target.index}
              onClick={() => {
                if (!disabled) {
                  onSelectTarget(target.index)
                  setIsExpanded(false)
                }
              }}
              disabled={disabled}
              className={`w-full text-left flex items-center justify-between px-2.5 py-1.5 rounded text-xs transition-colors border ${
                isActive
                  ? 'bg-indigo-900/50 border-indigo-500/60 text-indigo-200'
                  : isExplored
                  ? 'bg-[#1a1b2e]/40 border-[#2a2b3f]/50 text-slate-500 opacity-60 hover:border-indigo-600/30 hover:text-slate-400'
                  : 'bg-[#1e1f30] border-[#3a3c56] text-slate-300 hover:border-indigo-600/50 hover:text-slate-100'
              } disabled:cursor-not-allowed`}
            >
              <span className="flex items-center gap-1.5 min-w-0">
                <span className="text-sm flex-shrink-0">{display.icon}</span>
                <span className="truncate font-medium">{display.name}</span>
                {tier === 'revealed' && target.hasShop && (
                  <span className="text-[9px] px-1 py-0.5 rounded bg-yellow-900/40 border border-yellow-600/40 text-yellow-300 flex-shrink-0">
                    Shop
                  </span>
                )}
              </span>
              <span className="flex items-center gap-1 flex-shrink-0 ml-2">
                {isExplored ? (
                  <span className="text-[10px] text-slate-500">explored</span>
                ) : (
                  <span className={`text-[10px] ${isActive ? 'text-indigo-300' : 'text-slate-400'}`}>
                    {stepsRemaining === 0 ? 'here' : `${stepsRemaining} km`}
                  </span>
                )}
                {isActive && !isExplored && (
                  <span className="text-[9px] px-1 py-0.5 rounded bg-indigo-700/60 text-indigo-200 border border-indigo-500/40">
                    active
                  </span>
                )}
              </span>
            </button>
          )
        })}
      </div>
    </div>
  )
}
