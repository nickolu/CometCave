'use client'

/**
 * The camp: its buildings as ruled rows, each with its level in wood type,
 * the next upgrade's price on brass, and a brass button to pay it.
 */
import { BASE_BUILDINGS } from '@/app/tap-tap-adventure/config/baseBuildings'
import { useGameStore } from '@/app/tap-tap-adventure/hooks/useGameStore'
import { BrassFigure, BrassPlate, PaperButton, PlaybillCaption, PlaybillTitle, Stamp } from '@/app/tap-tap-adventure/stage/Playbill'
import { cn } from '@/lib/utils'

export function BasePanel() {
  const { getSelectedCharacter, upgradeBuilding } = useGameStore()

  const character = getSelectedCharacter()
  const buildingLevels = character?.campState?.buildingLevels ?? {}
  const gold = character?.gold ?? 0

  const totalLevels = Object.values(buildingLevels).reduce((sum, v) => sum + v, 0)
  const maxLevels = BASE_BUILDINGS.reduce((sum, b) => sum + b.maxLevel, 0)

  return (
    <section aria-label="Camp" className="space-y-3">
      <PlaybillTitle size="sm">Camp</PlaybillTitle>

      <div className="flex items-center justify-between gap-3">
        <div className="min-w-0 flex-1">
          <PlaybillCaption>Built</PlaybillCaption>
          <div className="mt-1 flex items-center gap-2">
            <div
              className="h-1.5 flex-1 overflow-hidden rounded-full bg-ps-playbill-edge"
              role="progressbar"
              aria-valuemin={0}
              aria-valuemax={100}
              aria-valuenow={maxLevels > 0 ? Math.round((totalLevels / maxLevels) * 100) : 0}
              aria-label="Camp built"
            >
              <div className="h-full rounded-full bg-ps-ink transition-[width] duration-300" style={{ width: `${maxLevels > 0 ? (totalLevels / maxLevels) * 100 : 0}%` }} />
            </div>
            <span className="shrink-0 font-playbill text-sm tabular-nums text-ps-ink">{totalLevels}<span className="text-ps-ink-soft">/{maxLevels}</span></span>
          </div>
        </div>
        <BrassPlate className="shrink-0">
          <BrassFigure label="Gold" value={gold.toLocaleString()} />
        </BrassPlate>
      </div>

      <ul className="divide-y-2 divide-dotted divide-ps-ink-faint border-y-2 border-ps-ink">
        {BASE_BUILDINGS.map(building => {
          const level = buildingLevels[building.id] ?? 0
          const isMaxed = level >= building.maxLevel
          const cost = isMaxed ? null : building.costPerLevel[level]
          const canAfford = cost !== null && cost !== undefined && gold >= cost

          return (
            <li key={building.id} className="py-3">
              <div className="flex items-start gap-2.5">
                <span aria-hidden className="mt-0.5 w-6 shrink-0 text-center font-body text-lg leading-none">{building.icon}</span>
                <div className="min-w-0 flex-1">
                  <div className="flex items-baseline justify-between gap-2">
                    <span className="truncate font-playbill text-base uppercase leading-none tracking-wide text-ps-ink">{building.name}</span>
                    <span className="shrink-0 font-playbill text-sm tabular-nums text-ps-ink" title={`Level ${level} of ${building.maxLevel}`}>
                      Lv {level}<span className="text-ps-ink-soft">/{building.maxLevel}</span>
                    </span>
                  </div>
                  <p className="mt-1 font-body text-xs leading-snug text-ps-ink-soft">{building.description}</p>
                  <p className="mt-0.5 font-body text-sm leading-snug text-ps-ink">{building.effectDescription}</p>
                </div>
              </div>

              <div className="mt-2 flex items-center justify-end gap-2 pl-[34px]">
                {isMaxed ? (
                  <Stamp tone="gold">Fully built</Stamp>
                ) : (
                  <>
                    <BrassPlate className={cn('px-2 py-1 font-playbill text-sm leading-none tabular-nums', !canAfford && 'opacity-70')} title={canAfford ? `Costs ${cost} gold` : `Costs ${cost} gold; you have ${gold}`}>
                      {cost} gold
                    </BrassPlate>
                    <PaperButton
                      size="sm"
                      variant="brass"
                      disabled={!canAfford}
                      onClick={() => upgradeBuilding(building.id)}
                      title={canAfford ? `Upgrade ${building.name} to level ${level + 1}` : `Need ${cost} gold`}
                    >
                      Upgrade
                    </PaperButton>
                  </>
                )}
              </div>
            </li>
          )
        })}
      </ul>
    </section>
  )
}
