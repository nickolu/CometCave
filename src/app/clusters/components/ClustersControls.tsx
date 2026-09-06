'use client'

import { GROUP_SIZE } from '@/app/clusters/models/clusters'
import { ChunkyButton } from '@/components/ui/chunky-button'

interface ClustersControlsProps {
  selectionCount: number
  canSubmit: boolean
  submitting: boolean
  onShuffle: () => void
  onDeselectAll: () => void
  onSubmit: () => void
}

export function ClustersControls({
  selectionCount,
  canSubmit,
  submitting,
  onShuffle,
  onDeselectAll,
  onSubmit,
}: ClustersControlsProps) {
  return (
    <div className="flex flex-wrap items-center justify-center gap-2">
      <ChunkyButton variant="ghost" size="md" onClick={onShuffle}>
        Shuffle
      </ChunkyButton>
      <ChunkyButton
        variant="ghost"
        size="md"
        onClick={onDeselectAll}
        disabled={selectionCount === 0}
      >
        Deselect all
      </ChunkyButton>
      <ChunkyButton variant="primary" size="md" onClick={onSubmit} disabled={!canSubmit}>
        {submitting ? 'Checking…' : 'Submit'}
      </ChunkyButton>
      <p className="w-full text-center text-xs text-on-surface-variant">
        {selectionCount} of {GROUP_SIZE} selected
      </p>
    </div>
  )
}
