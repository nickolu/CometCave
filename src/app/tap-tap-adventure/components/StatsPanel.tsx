'use client'

import { useState } from 'react'

import { useGameStore } from '@/app/tap-tap-adventure/hooks/useGameStore'
import { BrassFigure, BrassPlate, PaperButton, PlaybillCaption, PlaybillTitle } from '@/app/tap-tap-adventure/stage/Playbill'

/** A ruled line of the ledger: a label and a figure. */
function LedgerLine({ label, value, title }: { label: string; value: React.ReactNode; title?: string }) {
  return (
    <li className="flex items-baseline justify-between gap-3 border-b-2 border-dotted border-ps-ink/40 py-1.5 last:border-b-0" title={title}>
      <span className="font-body text-sm text-ps-ink">{label}</span>
      <span className="font-playbill text-base tabular-nums text-ps-ink">{value}</span>
    </li>
  )
}

export function StatsPanel() {
  const { gameState } = useGameStore()
  const [isExpanded, setIsExpanded] = useState(true)

  const characters = gameState.characters ?? []
  const meta = gameState.metaProgression

  // Aggregate Lifetime Stats
  const totalDistance = characters.reduce((sum, c) => sum + (c.distance ?? 0), 0)
  const totalGold = characters.reduce((sum, c) => sum + (c.gold ?? 0), 0)
  const totalCharacters = characters.length
  const totalDeaths =
    characters.reduce((sum, c) => sum + (c.deathCount ?? 0), 0) +
    characters.filter(c => c.status === 'dead').length

  const allRegions = characters.flatMap(c => c.visitedRegions ?? [])
  const uniqueRegions = Array.from(new Set(allRegions))
  const totalRegionsDiscovered = uniqueRegions.length

  // Records
  const highestLevel = characters.length > 0 ? Math.max(...characters.map(c => c.level ?? 1)) : 0
  const longestRun = characters.length > 0 ? Math.max(...characters.map(c => c.distance ?? 0)) : 0
  const mostGold = characters.length > 0 ? Math.max(...characters.map(c => c.gold ?? 0)) : 0
  const mostRegions =
    characters.length > 0
      ? Math.max(...characters.map(c => (c.visitedRegions ?? []).length))
      : 0

  // Class Breakdown
  const classCounts: Record<string, number> = {}
  for (const c of characters) {
    if (c.class) {
      classCounts[c.class] = (classCounts[c.class] ?? 0) + 1
    }
  }
  const classEntries = Object.entries(classCounts).sort((a, b) => b[1] - a[1])
  const maxClassCount = classEntries.length > 0 ? classEntries[0][1] : 1

  return (
    <div className="w-full">
      <div className="flex items-center justify-between gap-2 border-b-2 border-ps-ink pb-2">
        <PlaybillTitle size="sm" rules={false} className="text-left">The figures</PlaybillTitle>
        <PaperButton size="sm" variant="outline" className="h-7 px-2 text-xs" onClick={() => setIsExpanded(!isExpanded)} aria-expanded={isExpanded}>
          {isExpanded ? 'Fold' : 'Unfold'}
        </PaperButton>
      </div>

      {isExpanded && (
        <div className="mt-3 space-y-4">
          {/* Lifetime Stats */}
          <section>
            <PlaybillCaption>Across every run</PlaybillCaption>
            <BrassPlate className="mt-1.5 grid grid-cols-4 divide-x-2 divide-ps-brass-deep/60" aria-label="Lifetime figures">
              <BrassFigure label="Km" value={totalDistance.toLocaleString()} title={`${totalDistance.toLocaleString()} km walked in all`} />
              <BrassFigure label="Gold" value={totalGold.toLocaleString()} title="Gold held across all characters" />
              <BrassFigure label="Heroes" value={totalCharacters.toLocaleString()} title="Characters made" />
              <BrassFigure label="Deaths" value={totalDeaths.toLocaleString()} title="Deaths across all runs" />
            </BrassPlate>
            <p className="mt-2 font-body text-sm text-ps-ink-soft">
              <span className="font-playbill text-ps-ink">{totalRegionsDiscovered.toLocaleString()}</span> region{totalRegionsDiscovered !== 1 ? 's' : ''} discovered
            </p>
          </section>

          {/* Records */}
          <section>
            <PlaybillCaption>Records</PlaybillCaption>
            <ul className="m-0 mt-1 list-none p-0">
              <LedgerLine label="Highest level" value={highestLevel.toLocaleString()} />
              <LedgerLine label="Longest run" value={`${longestRun.toLocaleString()} km`} />
              <LedgerLine label="Most gold" value={mostGold.toLocaleString()} />
              <LedgerLine label="Most regions" value={mostRegions.toLocaleString()} />
            </ul>
          </section>

          {/* Class Breakdown */}
          {classEntries.length > 0 && (
            <section>
              <PlaybillCaption>By class</PlaybillCaption>
              <ul className="m-0 mt-1 list-none space-y-2 p-0">
                {classEntries.map(([cls, count]) => (
                  <li key={cls}>
                    <div className="flex items-baseline justify-between font-body text-sm text-ps-ink">
                      <span>{cls}</span>
                      <span className="font-playbill tabular-nums">{count}</span>
                    </div>
                    <div
                      className="mt-1 h-1.5 w-full overflow-hidden rounded-full bg-ps-ink/20"
                      role="progressbar"
                      aria-valuemin={0}
                      aria-valuemax={maxClassCount}
                      aria-valuenow={count}
                      aria-label={`${cls}: ${count}`}
                    >
                      <div className="h-full rounded-full bg-ps-ink transition-[width]" style={{ width: `${(count / maxClassCount) * 100}%` }} />
                    </div>
                  </li>
                ))}
              </ul>
            </section>
          )}

          {/* Meta Progression */}
          {meta && (
            <section>
              <PlaybillCaption>Carried between runs</PlaybillCaption>
              <ul className="m-0 mt-1 list-none p-0">
                <LedgerLine label="Runs" value={(meta.totalRuns ?? 0).toLocaleString()} />
                <LedgerLine label="Soul essence" value={(meta.totalEssenceEarned ?? 0).toLocaleString()} />
                <LedgerLine label="Best distance" value={(meta.bestDistance ?? 0).toLocaleString()} />
                <LedgerLine label="Best level" value={(meta.bestLevel ?? 0).toLocaleString()} />
              </ul>
            </section>
          )}
        </div>
      )}
    </div>
  )
}
