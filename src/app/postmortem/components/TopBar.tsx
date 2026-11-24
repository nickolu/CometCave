'use client'

import { ChunkyButton } from '@/components/ui/chunky-button'

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="pm-stat">
      <span className="pm-stat__label">{label}</span>
      <span className="pm-stat__value">{value}</span>
    </div>
  )
}

export function TopBar({
  incidentNumber,
  total,
  score,
  best,
  multiplier,
  eliminationsLeft,
  onCollection,
}: {
  incidentNumber: number
  total: number
  score: number
  best: number | null
  multiplier: number
  eliminationsLeft: number
  onCollection: () => void
}) {
  return (
    <header className="pm-topbar">
      <Stat label="Incident" value={`${incidentNumber} of ${total}`} />
      <Stat label="Score" value={String(score)} />
      <Stat label="High score" value={best === null ? 'None yet' : String(best)} />
      <Stat label="Multiplier" value={`×${multiplier}`} />
      <Stat label="Eliminations left" value={String(eliminationsLeft)} />
      <div className="pm-topbar__spacer" />
      <ChunkyButton variant="utility" size="sm" data-pm-native onClick={onCollection}>
        Collection
      </ChunkyButton>
    </header>
  )
}
