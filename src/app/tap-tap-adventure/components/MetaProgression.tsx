'use client'
import React, { useEffect, useRef } from 'react'

import { ETERNAL_UPGRADES } from '@/app/tap-tap-adventure/config/eternalUpgrades'
import { useGameStore } from '@/app/tap-tap-adventure/hooks/useGameStore'
import type { GameStore } from '@/app/tap-tap-adventure/hooks/useGameStore'
import { useDialogFocus } from '@/app/tap-tap-adventure/lib/useDialogFocus'
import { EternalUpgrade } from '@/app/tap-tap-adventure/models/metaProgression'
import { CloseIcon } from '@/app/tap-tap-adventure/stage/icons'
import { BrassFigure, BrassPlate, PaperButton, PlaybillCaption, PlaybillSheet, PlaybillTitle, Stamp } from '@/app/tap-tap-adventure/stage/Playbill'
import { cn } from '@/lib/utils'

const selectMetaProgression = (s: GameStore) => s.gameState?.metaProgression
const selectPurchaseUpgrade = (s: GameStore) => s.purchaseUpgrade

/** One ruled row on the bill: the upgrade, its level pips, the price on brass, and Buy. */
function UpgradeCard({
  upgrade,
  currentLevel,
  soulEssence,
  onPurchase,
}: {
  upgrade: EternalUpgrade
  currentLevel: number
  soulEssence: number
  onPurchase: (id: string) => void
}) {
  const isMaxed = currentLevel >= upgrade.maxLevel
  const nextCost = isMaxed ? null : upgrade.costPerLevel[currentLevel]
  const canAfford = nextCost !== null && soulEssence >= nextCost

  return (
    <li className="flex flex-wrap items-center gap-x-4 gap-y-2 py-3 sm:flex-nowrap">
      <div className="min-w-0 flex-1 basis-full sm:basis-auto">
        <h3 className="font-playbill text-sm uppercase tracking-wide text-ps-ink">{upgrade.name}</h3>
        <p className="mt-0.5 font-body text-xs leading-snug text-ps-ink-soft">{upgrade.description}</p>
      </div>

      {/* Level pips */}
      <div className="flex items-center gap-2" aria-label={`Level ${currentLevel} of ${upgrade.maxLevel}`}>
        <span className="flex gap-1" aria-hidden>
          {Array.from({ length: upgrade.maxLevel }).map((_, i) => (
            <span
              key={i}
              className={cn('block h-2.5 w-2.5 rounded-[1px] border-2 border-ps-ink', i < currentLevel ? 'bg-ps-ink' : 'bg-transparent')}
            />
          ))}
        </span>
        <span className="font-label text-xs font-bold uppercase tracking-widest tabular-nums text-ps-ink-soft">
          {currentLevel}/{upgrade.maxLevel}
        </span>
      </div>

      {/* Price and purchase */}
      {isMaxed ? (
        <Stamp tone="gold" className="ml-auto">Maxed</Stamp>
      ) : (
        <div className="ml-auto flex items-center gap-2">
          <BrassPlate className="flex h-8 items-center px-2.5" title="Soul essence">
            <span className="font-playbill text-sm leading-none tabular-nums">{nextCost}</span>
          </BrassPlate>
          <PaperButton
            variant="brass"
            size="sm"
            disabled={!canAfford}
            onClick={() => onPurchase(upgrade.id)}
            aria-label={`Buy ${upgrade.name} for ${nextCost} soul essence`}
          >
            Buy
          </PaperButton>
        </div>
      )}
    </li>
  )
}

export default function MetaProgression({ onClose }: { onClose: () => void }) {
  const metaProgression = useGameStore(selectMetaProgression)
  const purchaseUpgrade = useGameStore(selectPurchaseUpgrade)
  const dialogRef = useRef<HTMLDivElement>(null)
  useDialogFocus(dialogRef)

  // Rule 8: Escape closes a dialog.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose])

  const soulEssence = metaProgression?.soulEssence ?? 0
  const totalEssenceEarned = metaProgression?.totalEssenceEarned ?? 0
  const totalRuns = metaProgression?.totalRuns ?? 0
  const bestDistance = metaProgression?.bestDistance ?? 0
  const bestLevel = metaProgression?.bestLevel ?? 0
  const upgradeLevels = metaProgression?.upgradeLevels ?? {}

  const handlePurchase = (upgradeId: string) => {
    purchaseUpgrade(upgradeId)
  }

  return (
    <div
      ref={dialogRef}
      className="ps-scroll fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-ps-house/70 p-3 sm:p-6"
      role="dialog"
      aria-modal="true"
      aria-label="Eternal upgrades"
    >
      <PlaybillSheet className="ps-print-in my-auto w-full max-w-3xl px-4 pb-5 pt-4 sm:px-6">
        <button
          type="button"
          onClick={onClose}
          className="absolute right-3 top-3 z-10 flex h-8 w-8 items-center justify-center rounded-full border-2 border-ps-ink text-ps-ink transition-colors hover:bg-ps-ink hover:text-ps-playbill focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ds-primary"
          aria-label="Close"
        >
          <CloseIcon />
        </button>

        <div className="px-8">
          <PlaybillTitle>Eternal upgrades</PlaybillTitle>
        </div>
        <PlaybillCaption className="mt-2 text-center">Permanent bonuses for all future characters</PlaybillCaption>

        {/* Soul essence on brass */}
        <BrassPlate className="mt-4 grid grid-cols-2 divide-x-2 divide-ps-brass-deep/60 sm:grid-cols-5" aria-label="Your record">
          <BrassFigure label="Soul essence" value={soulEssence} className="col-span-2 border-b-2 border-ps-brass-deep/60 sm:col-span-1 sm:border-b-0" />
          <BrassFigure label="Earned" value={totalEssenceEarned} />
          <BrassFigure label="Runs" value={totalRuns} />
          <BrassFigure label="Best km" value={bestDistance} />
          <BrassFigure label="Best level" value={bestLevel} />
        </BrassPlate>

        {/* Upgrades as ruled rows */}
        <ul className="mt-4 divide-y-2 divide-dotted divide-ps-ink/40 border-y-2 border-dotted border-ps-ink/40">
          {ETERNAL_UPGRADES.map(upgrade => (
            <UpgradeCard
              key={upgrade.id}
              upgrade={upgrade}
              currentLevel={upgradeLevels[upgrade.id] ?? 0}
              soulEssence={soulEssence}
              onPurchase={handlePurchase}
            />
          ))}
        </ul>

        <div className="mt-5 flex justify-center">
          <PaperButton variant="outline" onClick={onClose} className="w-full sm:w-auto">
            Back to characters
          </PaperButton>
        </div>
      </PlaybillSheet>
    </div>
  )
}
