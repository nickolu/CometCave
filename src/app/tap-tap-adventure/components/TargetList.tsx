'use client'

// Minimal landmark shape compatible with both GeneratedLandmark and the character schema
interface LandmarkInfo {
  name: string
  icon: string
  hasShop: boolean
  distanceFromEntry: number
}

interface Target {
  index: number
  name: string
  icon: string
  type: 'landmark' | 'region_exit'
  position: number
  isExplored?: boolean
  hasShop?: boolean
}

interface TargetListProps {
  landmarks: LandmarkInfo[]
  positionInRegion: number
  activeTargetIndex: number
  regionLength: number
  regionName?: string
  onSelectTarget: (index: number) => void
  disabled: boolean
}

export function TargetList({
  landmarks,
  positionInRegion,
  activeTargetIndex,
  regionLength,
  regionName,
  onSelectTarget,
  disabled,
}: TargetListProps) {
  // Build target list: landmarks + region exit
  const targets: Target[] = [
    ...landmarks.map((lm, i) => ({
      index: i,
      name: lm.name,
      icon: lm.icon,
      type: 'landmark' as const,
      position: lm.distanceFromEntry,
      isExplored: false,
      hasShop: lm.hasShop,
    })),
    {
      index: landmarks.length,
      name: regionName ? `Leave ${regionName}` : 'Leave Region',
      icon: '🚪',
      type: 'region_exit' as const,
      position: regionLength,
    },
  ]

  return (
    <div className="space-y-1">
      <p className="text-[10px] text-slate-500 uppercase tracking-wide mb-1">Targets</p>
      {targets.map(target => {
        const isPassed = positionInRegion >= target.position
        const isActive = target.index === activeTargetIndex
        const stepsRemaining = Math.max(0, target.position - positionInRegion)

        return (
          <button
            key={target.index}
            onClick={() => !disabled && onSelectTarget(target.index)}
            disabled={disabled}
            className={`w-full text-left flex items-center justify-between px-2.5 py-1.5 rounded text-xs transition-colors border ${
              isActive
                ? 'bg-indigo-900/50 border-indigo-500/60 text-indigo-200'
                : isPassed
                ? 'bg-[#1a1b2e]/40 border-[#2a2b3f]/50 text-slate-500 cursor-default'
                : 'bg-[#1e1f30] border-[#3a3c56] text-slate-300 hover:border-indigo-600/50 hover:text-slate-100'
            } disabled:cursor-not-allowed`}
          >
            <span className="flex items-center gap-1.5 min-w-0">
              <span className="text-sm flex-shrink-0">{target.icon}</span>
              <span className="truncate font-medium">{target.name}</span>
              {target.hasShop && (
                <span className="text-[9px] px-1 py-0.5 rounded bg-yellow-900/40 border border-yellow-600/40 text-yellow-300 flex-shrink-0">
                  Shop
                </span>
              )}
            </span>
            <span className="flex items-center gap-1 flex-shrink-0 ml-2">
              {isPassed ? (
                <span className="text-[10px] text-slate-500">passed</span>
              ) : (
                <span className={`text-[10px] ${isActive ? 'text-indigo-300' : 'text-slate-400'}`}>
                  {stepsRemaining === 0 ? 'here' : `${stepsRemaining} steps`}
                </span>
              )}
              {isActive && !isPassed && (
                <span className="text-[9px] px-1 py-0.5 rounded bg-indigo-700/60 text-indigo-200 border border-indigo-500/40">
                  active
                </span>
              )}
            </span>
          </button>
        )
      })}
    </div>
  )
}
