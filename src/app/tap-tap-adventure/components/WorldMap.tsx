'use client'
import { REGIONS, canEnterRegion } from '@/app/tap-tap-adventure/config/regions'
import type { FantasyCharacter } from '@/app/tap-tap-adventure/models/character'

interface WorldMapProps {
  character: FantasyCharacter
}

export function WorldMap({ character }: WorldMapProps) {
  const visitedRegions = new Set(character.visitedRegions ?? [])
  const currentRegion = character.currentRegion ?? 'green_meadows'
  const charLevel = character.level ?? 1

  // Build tree nodes from regions
  const regionIds = Object.keys(REGIONS)

  // Find root
  const root = 'starting_village'

  // BFS to build ordered list with depth
  type TreeNode = { id: string; depth: number; parentId?: string }
  const visited = new Set<string>()
  const nodes: TreeNode[] = []
  const queue: TreeNode[] = [{ id: root, depth: 0 }]

  while (queue.length > 0) {
    const node = queue.shift()!
    if (visited.has(node.id)) continue
    visited.add(node.id)
    nodes.push(node)

    const region = REGIONS[node.id]
    const children = region?.childRegions ?? []
    for (const childId of children) {
      if (!visited.has(childId)) {
        queue.push({ id: childId, depth: node.depth + 1, parentId: node.id })
      }
    }
  }

  return (
    <div className="space-y-1">
      <div className="text-xs text-slate-500 mb-2">
        {visitedRegions.size} / {regionIds.length} regions discovered
      </div>
      {nodes.map(node => {
        const region = REGIONS[node.id]
        if (!region) return null

        const isVisited = visitedRegions.has(node.id)
        const isCurrent = node.id === currentRegion
        const canEnter = canEnterRegion(region, charLevel)
        const isDeadEnd = region.isDeadEnd === true

        let statusColor = 'border-slate-700 text-slate-500' // unknown/locked
        let bgColor = 'bg-[#12131f]'
        if (isCurrent) {
          statusColor = 'border-blue-500 text-white'
          bgColor = 'bg-blue-900/30'
        } else if (isVisited) {
          statusColor = 'border-green-600/50 text-slate-300'
          bgColor = 'bg-green-900/20'
        } else if (canEnter) {
          statusColor = 'border-yellow-600/50 text-slate-400'
          bgColor = 'bg-yellow-900/10'
        }

        return (
          <div
            key={node.id}
            className={`${bgColor} border ${statusColor} rounded-lg px-3 py-2 transition-colors`}
            style={{ marginLeft: `${node.depth * 16}px` }}
          >
            <div className="flex items-center gap-2">
              <span className="text-base">{region.icon}</span>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-1.5">
                  <span className="text-sm font-medium truncate">{region.name}</span>
                  {isCurrent && <span className="text-[9px] bg-blue-600 text-white px-1 rounded">HERE</span>}
                  {isDeadEnd && <span className="text-[9px] bg-amber-700 text-amber-200 px-1 rounded">DEAD END</span>}
                </div>
                <div className="text-[10px] text-slate-500">
                  {region.difficulty} · Lv.{region.minLevel}+
                  {!canEnter && !isVisited && <span className="text-red-400 ml-1">🔒 Lv.{region.minLevel} required</span>}
                </div>
              </div>
              {isVisited && <span className="text-green-500 text-xs">✓</span>}
            </div>
          </div>
        )
      })}
    </div>
  )
}
