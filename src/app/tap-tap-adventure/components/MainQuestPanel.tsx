'use client'

/**
 * The main quest, printed at the ruled top of the quests bill: the title,
 * how many countries are taken, and the milestones with the finished ones
 * struck through.
 */
import { getRegion } from '@/app/tap-tap-adventure/config/regions'
import { CONQUERABLE_REGIONS, TOTAL_CONQUERABLE, getConqueredCount } from '@/app/tap-tap-adventure/lib/mainQuestManager'
import { FantasyCharacter } from '@/app/tap-tap-adventure/models/character'
import { PlaybillCaption, PlaybillTitle, Stamp } from '@/app/tap-tap-adventure/stage/Playbill'
import { cn } from '@/lib/utils'

/** The printer's ink for a region's difficulty: a dot beside its name. */
const DIFF_DOT: Record<string, string> = {
  easy: 'bg-ps-stamp-green',
  medium: 'bg-ps-stamp-gold',
  hard: 'bg-ps-stamp-red',
  very_hard: 'bg-ps-stamp-red',
  extreme: 'bg-ps-stamp-violet',
}

export function MainQuestPanel({ character }: { character: FantasyCharacter }) {
  const mainQuest = character.mainQuest
  if (!mainQuest) return null

  const visited = character.visitedRegions ?? ['green_meadows']
  const conquered = getConqueredCount(visited)
  const progress = conquered / TOTAL_CONQUERABLE
  const isComplete = mainQuest.status === 'completed'
  const currentMilestone = mainQuest.milestones.find(m => !m.claimed)

  return (
    <section aria-label="Main quest">
      <PlaybillTitle size="sm">{isComplete ? 'Quest complete' : 'The main quest'}</PlaybillTitle>

      <div className="mt-3 flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="font-body text-base font-semibold leading-snug text-ps-ink">{mainQuest.title}</p>
          <p className="mt-1 font-body text-sm leading-snug text-ps-ink-soft">{mainQuest.description}</p>
        </div>
        {isComplete ? (
          <Stamp tone="gold" animate className="shrink-0">Done</Stamp>
        ) : (
          <span className="shrink-0 font-playbill text-lg leading-none tabular-nums text-ps-ink" title={`${conquered} of ${TOTAL_CONQUERABLE} regions conquered`}>
            {conquered}<span className="text-ps-ink-soft">/{TOTAL_CONQUERABLE}</span>
          </span>
        )}
      </div>

      <div className="mt-3">
        <div className="flex items-center justify-between">
          <PlaybillCaption>Regions conquered</PlaybillCaption>
          <span className="font-label text-xs font-bold tabular-nums text-ps-ink-soft">{Math.round(progress * 100)}%</span>
        </div>
        <div
          className="mt-1 h-1.5 w-full overflow-hidden rounded-full bg-ps-playbill-edge"
          role="progressbar"
          aria-valuemin={0}
          aria-valuemax={100}
          aria-valuenow={Math.round(progress * 100)}
          aria-label="Regions conquered"
        >
          <div className={cn('h-full rounded-full transition-[width] duration-300', isComplete ? 'bg-ps-stamp-gold' : 'bg-ps-ink')} style={{ width: `${progress * 100}%` }} />
        </div>
      </div>

      <ul className="mt-2 grid grid-cols-2 gap-x-3 gap-y-0.5" aria-label="Regions">
        {CONQUERABLE_REGIONS.map(regionId => {
          const region = getRegion(regionId)
          const isVisited = visited.includes(regionId)
          return (
            <li
              key={regionId}
              className={cn('flex min-w-0 items-center gap-1.5 font-body text-xs leading-tight', isVisited ? 'text-ps-ink' : 'text-ps-ink-soft')}
              title={`${region.name} · ${region.difficulty.replace('_', ' ')}${isVisited ? ' · conquered' : ''}`}
            >
              <span aria-hidden className={cn('inline-block h-1.5 w-1.5 shrink-0 rounded-full', DIFF_DOT[region.difficulty] ?? 'bg-ps-ink-faint')} />
              <span aria-hidden className="shrink-0">{region.icon}</span>
              <span className={cn('truncate', isVisited && 'line-through decoration-ps-ink-soft')}>{region.name}</span>
              {isVisited && <span className="sr-only">conquered</span>}
            </li>
          )
        })}
      </ul>

      <PlaybillCaption className="mt-3">Milestones</PlaybillCaption>
      <ol className="mt-1 divide-y border-y border-ps-playbill-edge divide-ps-playbill-edge">
        {mainQuest.milestones.map(m => {
          const isCurrent = !isComplete && currentMilestone?.regionsRequired === m.regionsRequired
          return (
            <li
              key={m.regionsRequired}
              className={cn('flex items-center justify-between gap-2 py-1.5 font-body text-sm leading-snug', m.claimed ? 'text-ps-ink-soft' : 'text-ps-ink')}
            >
              <span className="flex min-w-0 flex-wrap items-center gap-x-2 gap-y-1">
                <span className={cn('min-w-0', m.claimed && 'line-through')}>
                  {m.title} <span className="text-ps-ink-soft">({m.regionsRequired} regions)</span>
                </span>
                {m.claimed && <span className="sr-only">done</span>}
                {isCurrent && <Stamp tone="red">Now</Stamp>}
              </span>
              <span className="shrink-0 font-playbill text-sm tabular-nums">+{m.goldReward} gold</span>
            </li>
          )
        })}
      </ol>
    </section>
  )
}
