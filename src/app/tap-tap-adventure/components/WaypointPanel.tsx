'use client'

/**
 * Waypoints: the towns you have been to, printed as lines on the bill, each
 * with its fare on a brass chip.
 */
import { REGIONS, getRegion } from '@/app/tap-tap-adventure/config/regions'
import { FantasyCharacter } from '@/app/tap-tap-adventure/models/types'
import { CloseIcon } from '@/app/tap-tap-adventure/stage/icons'
import { PaperButton, PlaybillLine, PlaybillTitle } from '@/app/tap-tap-adventure/stage/Playbill'
import { cn } from '@/lib/utils'

interface WaypointPanelProps {
  character: FantasyCharacter
  currentTownName: string
  onTravel: (regionId: string, landmarkId: string, cost: number) => void
  onClose: () => void
}

export function WaypointPanel({ character, currentTownName, onTravel, onClose }: WaypointPanelProps) {
  const currentRegion = character.currentRegion ?? 'green_meadows'
  const visitedTowns = (character.visitedTowns ?? []).filter(
    t => !(t.regionId === currentRegion && t.name === currentTownName)
  )

  return (
    <section aria-label="Waypoints">
      <div className="flex items-start gap-2">
        <PlaybillTitle size="sm" className="min-w-0 flex-1">Waypoints</PlaybillTitle>
        <PaperButton variant="outline" size="sm" className="w-8 shrink-0 px-0" onClick={onClose} aria-label="Close waypoints">
          <CloseIcon />
        </PaperButton>
      </div>

      <p className="mt-3 font-body text-sm leading-relaxed text-ps-ink-soft">
        Travel straight to a town you have visited before. The fare depends on the distance.
      </p>

      <div className="ps-scroll mt-3 grid max-h-[250px] gap-2 overflow-y-auto pr-1">
        {visitedTowns.length === 0 ? (
          <p className="py-3 text-center font-body text-sm italic text-ps-ink-soft">
            No other waypoints yet. Visit more towns to open up fast travel.
          </p>
        ) : (
          visitedTowns.map((town, i) => {
            const region = REGIONS[town.regionId]
            const isSameRegion = town.regionId === currentRegion
            const baseCost = isSameRegion ? 15 : 30
            const regionMult = getRegion(town.regionId).difficultyMultiplier
            const cost = Math.round(baseCost * regionMult)
            const canAfford = (character.gold ?? 0) >= cost

            return (
              <PlaybillLine
                key={`${town.landmarkId}-${town.regionId}-${i}`}
                disabled={!canAfford}
                onClick={() => canAfford && onTravel(town.regionId, town.landmarkId, cost)}
                note={
                  <>
                    {region?.icon} {region?.name ?? town.regionId}
                    {isSameRegion && ' (same region)'}
                    {!canAfford && <span className="text-ps-stamp-red"> · Not enough gold</span>}
                  </>
                }
                trailing={
                  <span
                    className={cn(
                      'rounded-[3px] border px-1.5 py-0.5 font-playbill text-sm leading-none tabular-nums',
                      canAfford ? 'border-ps-brass-deep bg-ps-brass text-ps-ink' : 'border-ps-stamp-red text-ps-stamp-red'
                    )}
                  >
                    {cost} g
                  </span>
                }
              >
                <span aria-hidden className="mr-2 inline-block w-6 text-center font-body text-base leading-none">{town.icon}</span>
                {town.name}
              </PlaybillLine>
            )
          })
        )}
      </div>

      <PaperButton variant="outline" className="mt-4 w-full border-ps-ink/50 text-ps-ink-soft" onClick={onClose}>
        Back to town
      </PaperButton>
    </section>
  )
}
