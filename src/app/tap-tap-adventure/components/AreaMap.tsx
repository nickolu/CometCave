'use client'

import { euclidean } from '@/app/tap-tap-adventure/lib/movementUtils'

interface AreaMapLandmark {
  index: number
  name: string
  icon: string
  position: { x: number; y: number }
  explored: boolean
  hidden: boolean
  hasShop: boolean
}

interface AreaMapExit {
  index: number
  name: string
  icon: string
  position: { x: number; y: number }
}

interface AreaMapProps {
  playerPosition: { x: number; y: number }
  landmarks: AreaMapLandmark[]
  exits: AreaMapExit[]
  activeTargetIndex: number
  regionBounds: { width: number; height: number }
  regionName: string
  regionIcon: string
  onSelectTarget: (index: number) => void
}

type DiscoveryTier = 'hidden' | 'distant' | 'unknown' | 'revealed'

function getDiscoveryTier(distance: number, explored: boolean, hidden: boolean): DiscoveryTier {
  if (explored) return 'revealed'
  if (hidden) {
    if (distance > 100) return 'hidden'
    if (distance > 20) return 'unknown'
    return 'revealed'
  }
  if (distance > 100) return 'hidden'
  if (distance > 50) return 'distant'
  if (distance > 20) return 'unknown'
  return 'revealed'
}

// Scale a world coordinate to SVG viewBox (500x500)
function toSVG(val: number, worldSize: number): number {
  return (val / worldSize) * 500
}

export function AreaMap({
  playerPosition,
  landmarks,
  exits,
  activeTargetIndex,
  regionBounds,
  regionName,
  regionIcon,
  onSelectTarget,
}: AreaMapProps) {
  const worldW = regionBounds.width || 500
  const worldH = regionBounds.height || 500

  // Scale factors for converting km distances to SVG units
  const scaleX = 500 / worldW
  const scaleY = 500 / worldH
  const avgScale = (scaleX + scaleY) / 2

  const px = toSVG(playerPosition.x, worldW)
  const py = toSVG(playerPosition.y, worldH)

  // Find the active target position in SVG coords
  const allTargets = [
    ...landmarks.map(lm => ({ index: lm.index, position: lm.position })),
    ...exits.map(ex => ({ index: ex.index, position: ex.position })),
  ]
  const activeTarget = allTargets.find(t => t.index === activeTargetIndex)
  const activeTx = activeTarget ? toSVG(activeTarget.position.x, worldW) : null
  const activeTy = activeTarget ? toSVG(activeTarget.position.y, worldH) : null

  // Grid lines every 100 world units
  const gridLinesX: number[] = []
  for (let x = 0; x <= worldW; x += 100) {
    gridLinesX.push(toSVG(x, worldW))
  }
  const gridLinesY: number[] = []
  for (let y = 0; y <= worldH; y += 100) {
    gridLinesY.push(toSVG(y, worldH))
  }

  // Distance circle radii in SVG units
  const r20 = 20 * avgScale
  const r50 = 50 * avgScale
  const r100 = 100 * avgScale

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <p className="text-xs text-slate-400 font-medium">{regionIcon} {regionName} — Area Map</p>
      </div>
      <div className="relative w-full" style={{ paddingBottom: '100%' }}>
        <svg
          className="absolute inset-0 w-full h-full rounded-lg border border-[#2a2b3f]"
          viewBox="0 0 500 500"
        >
          <style>{`
            @keyframes areamap-pulse {
              0%, 100% { opacity: 0.8; r: 8; }
              50% { opacity: 0.3; r: 14; }
            }
            @keyframes areamap-ring-pulse {
              0%, 100% { opacity: 0.7; r: 13; }
              50% { opacity: 0.1; r: 19; }
            }
            .areamap-player-pulse {
              animation: areamap-pulse 2s ease-in-out infinite;
            }
            .areamap-active-ring {
              animation: areamap-ring-pulse 1.5s ease-in-out infinite;
            }
          `}</style>

          {/* Background */}
          <rect width="500" height="500" fill="#161723" />

          {/* Grid lines */}
          {gridLinesX.map((x, i) => (
            <line key={`gx-${i}`} x1={x} y1={0} x2={x} y2={500} stroke="#1e1f30" strokeWidth="0.5" />
          ))}
          {gridLinesY.map((y, i) => (
            <line key={`gy-${i}`} x1={0} y1={y} x2={500} y2={y} stroke="#1e1f30" strokeWidth="0.5" />
          ))}

          {/* Distance circles around player */}
          <circle cx={px} cy={py} r={r100} fill="none" stroke="#818cf8" strokeWidth="1" opacity="0.15" strokeDasharray="4 6" />
          <circle cx={px} cy={py} r={r50} fill="none" stroke="#6366f1" strokeWidth="1" opacity="0.2" strokeDasharray="4 6" />
          <circle cx={px} cy={py} r={r20} fill="none" stroke="#4f46e5" strokeWidth="1" opacity="0.3" strokeDasharray="4 6" />

          {/* Dotted line from player to active target */}
          {activeTx !== null && activeTy !== null && (
            <line
              x1={px}
              y1={py}
              x2={activeTx}
              y2={activeTy}
              stroke="#6366f1"
              strokeWidth="1.5"
              strokeDasharray="4 4"
              opacity="0.6"
            />
          )}

          {/* Exits */}
          {exits.map(exit => {
            const ex = toSVG(exit.position.x, worldW)
            const ey = toSVG(exit.position.y, worldH)
            const isActive = exit.index === activeTargetIndex

            return (
              <g
                key={`exit-${exit.index}`}
                onClick={() => onSelectTarget(exit.index)}
                style={{ cursor: 'pointer' }}
              >
                {isActive && (
                  <circle
                    className="areamap-active-ring"
                    cx={ex}
                    cy={ey}
                    r={13}
                    fill="none"
                    stroke="#6366f1"
                    strokeWidth="2"
                  />
                )}
                <text
                  x={ex}
                  y={ey}
                  textAnchor="middle"
                  dominantBaseline="central"
                  fontSize="16"
                >
                  {exit.icon}
                </text>
              </g>
            )
          })}

          {/* Landmarks */}
          {landmarks.map(lm => {
            const lx = toSVG(lm.position.x, worldW)
            const ly = toSVG(lm.position.y, worldH)
            const distance = euclidean(playerPosition, lm.position)
            const tier = getDiscoveryTier(distance, lm.explored, lm.hidden)
            const isActive = lm.index === activeTargetIndex

            if (tier === 'hidden') return null

            if (tier === 'distant') {
              return (
                <g
                  key={`lm-${lm.index}`}
                  onClick={() => onSelectTarget(lm.index)}
                  style={{ cursor: 'pointer' }}
                  opacity="0.3"
                >
                  <text
                    x={lx}
                    y={ly}
                    textAnchor="middle"
                    dominantBaseline="central"
                    fontSize="10"
                    fill="#94a3b8"
                  >
                    ...
                  </text>
                </g>
              )
            }

            if (tier === 'unknown') {
              return (
                <g
                  key={`lm-${lm.index}`}
                  onClick={() => onSelectTarget(lm.index)}
                  style={{ cursor: 'pointer' }}
                  opacity="0.6"
                >
                  {isActive && (
                    <circle
                      className="areamap-active-ring"
                      cx={lx}
                      cy={ly}
                      r={13}
                      fill="none"
                      stroke="#6366f1"
                      strokeWidth="2"
                    />
                  )}
                  <text
                    x={lx}
                    y={ly}
                    textAnchor="middle"
                    dominantBaseline="central"
                    fontSize="16"
                  >
                    ❓
                  </text>
                </g>
              )
            }

            // revealed
            return (
              <g
                key={`lm-${lm.index}`}
                onClick={() => onSelectTarget(lm.index)}
                style={{ cursor: 'pointer' }}
                opacity={lm.explored ? 0.4 : 1}
              >
                {isActive && (
                  <circle
                    className="areamap-active-ring"
                    cx={lx}
                    cy={ly}
                    r={13}
                    fill="none"
                    stroke="#6366f1"
                    strokeWidth="2"
                  />
                )}
                <text
                  x={lx}
                  y={ly}
                  textAnchor="middle"
                  dominantBaseline="central"
                  fontSize="16"
                >
                  {lm.icon}
                </text>
              </g>
            )
          })}

          {/* Player pulse ring */}
          <circle
            className="areamap-player-pulse"
            cx={px}
            cy={py}
            r={8}
            fill="#6366f1"
            opacity="0.3"
          />
          {/* Player dot */}
          <circle cx={px} cy={py} r={6} fill="#6366f1" />
          <circle cx={px} cy={py} r={3} fill="#a5b4fc" />
        </svg>
      </div>
      <div className="flex items-center gap-3 text-[9px] text-slate-500">
        <span>🔵 You</span>
        <span>❓ Unknown</span>
        <span>... Distant</span>
      </div>
    </div>
  )
}
