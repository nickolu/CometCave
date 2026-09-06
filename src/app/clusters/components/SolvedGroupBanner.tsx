'use client'

import { TIER_VAR } from '@/app/clusters/lib/tiers'
import { type ClusterGroup, TIER_DIFFICULTY, TIER_LABEL } from '@/app/clusters/models/clusters'
import { cn } from '@/lib/utils'

interface SolvedGroupBannerProps {
  group: ClusterGroup
  /** Purple solved first — the flex. */
  celebrate?: boolean
  /** Revealed by a loss rather than found by the player. */
  revealed?: boolean
}

export function SolvedGroupBanner({ group, celebrate, revealed }: SolvedGroupBannerProps) {
  return (
    <div
      className={cn(
        'cl-land rounded-ds-sm px-4 py-3 text-center',
        celebrate && 'cl-purple-first'
      )}
      style={{ backgroundColor: TIER_VAR[group.tier], color: 'var(--cl-ink)' }}
    >
      {/* Tier is never conveyed by color alone. */}
      <p className="font-label text-[10px] uppercase tracking-[0.16em] opacity-70">
        {TIER_LABEL[group.tier]} · {TIER_DIFFICULTY[group.tier]}
        {revealed && ' · not found'}
        {celebrate && ' · purple first'}
      </p>
      <p className="font-headline text-base font-extrabold tracking-wide">{group.title}</p>
      <p className="font-headline text-sm font-medium opacity-85">{group.words.join(' · ')}</p>
    </div>
  )
}
