import { StarRow } from '@/app/meteor-coins/components/StarRow'
import type { BoardView } from '@/app/meteor-coins/lib/scoreboard'
import type { StageDef } from '@/app/meteor-coins/lib/stages'
import { PALETTE } from '@/app/meteor-coins/scene/palette'

/**
 * A stage's listed players, best first. The caller's own row is marked in
 * the shape (a border and a "you" tag), not only in color. With `limit`,
 * only the top rows show, plus the caller's own row after a gap if it
 * sits lower down.
 */
export function ScoreBoard({
  stage,
  view,
  uid,
  limit,
}: {
  stage: StageDef
  view: BoardView
  uid: string | null
  limit?: number
}) {
  if (view.entries.length === 0) {
    return (
      <p className="rounded-lg border border-dashed border-white/15 p-4 text-center text-sm text-white/60">
        No one is listed yet.
      </p>
    )
  }
  const top = limit === undefined ? view.entries : view.entries.slice(0, limit)
  const own = view.entries.find(e => uid !== null && e.uid === uid)
  const below = own !== undefined && !top.includes(own) ? own : null
  const rows = below ? [...top, below] : top
  const padding = limit === undefined ? 'px-3 py-2' : 'px-3 py-1'
  return (
    <ol className="flex flex-col gap-1" aria-label={`${stage.name} scores`}>
      {rows.map(entry => {
        const mine = uid !== null && entry.uid === uid
        return (
          <li
            key={entry.uid}
            className={`flex items-center gap-3 rounded-lg border ${padding} ${
              mine ? 'bg-white/10' : 'border-white/10 bg-white/5'
            } ${entry === below ? 'mt-2' : ''}`}
            style={mine ? { borderColor: PALETTE.puck } : undefined}
          >
            <span
              className="w-7 text-right text-sm font-bold tabular-nums"
              style={{ color: entry.rank === 1 ? PALETTE.puck : undefined }}
            >
              {entry.rank}
            </span>
            <span className="min-w-0 flex-1 truncate text-sm font-semibold">
              {entry.name}
              {mine && <span className="ml-2 text-xs font-normal text-white/60">you</span>}
            </span>
            <StarRow earned={entry.stars} size={14} label={`${entry.stars} of 3 stars`} />
            <span className="w-12 text-right text-base font-bold tabular-nums">{entry.value}</span>
          </li>
        )
      })}
    </ol>
  )
}
