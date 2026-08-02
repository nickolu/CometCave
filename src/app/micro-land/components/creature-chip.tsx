'use client'

import type { CreatureBlueprint } from '@/app/micro-land/domain/types'

interface Run {
  x: number
  y: number
  width: number
  fill: string
}

/**
 * A creature's own pixels, drawn as SVG.
 *
 * SVG rather than a canvas so portraits need no DOM APIs and no post-mount
 * effect — they render on the server and in the first paint. Horizontal runs of
 * the same color collapse into one rect, which matters more now that a sprite
 * can be 28x24: a dragon is a few dozen nodes this way and 672 without.
 */
function toRuns(blueprint: CreatureBlueprint): Run[] {
  const rows = blueprint.art.frames[0]
  const palette = blueprint.art.palette
  const runs: Run[] = []

  for (let y = 0; y < rows.length; y++) {
    const row = rows[y]
    let x = 0
    while (x < row.length) {
      const ch = row[x]
      const fill = ch === '.' ? undefined : palette[ch]
      if (!fill) {
        x++
        continue
      }
      let width = 1
      while (x + width < row.length && row[x + width] === ch) width++
      runs.push({ x, y, width, fill })
      x += width
    }
  }
  return runs
}

export function CreaturePortrait({
  blueprint,
  size = 40,
}: {
  blueprint: CreatureBlueprint
  size?: number
}) {
  const rows = blueprint.art.frames[0]
  const w = rows[0].length
  const h = rows.length
  const ratio = w / h

  return (
    <svg
      viewBox={`0 0 ${w} ${h}`}
      width={ratio >= 1 ? size : size * ratio}
      height={ratio >= 1 ? size / ratio : size}
      shapeRendering="crispEdges"
      aria-hidden
      focusable="false"
      style={{ display: 'block', overflow: 'visible' }}
    >
      {toRuns(blueprint).map(run => (
        <rect
          key={`${run.y}-${run.x}`}
          x={run.x}
          y={run.y}
          width={run.width}
          height={1}
          fill={run.fill}
        />
      ))}
    </svg>
  )
}
