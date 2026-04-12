'use client'
import React from 'react'

import { ETERNAL_UPGRADES } from '@/app/tap-tap-adventure/config/eternalUpgrades'
import { useGameStore } from '@/app/tap-tap-adventure/hooks/useGameStore'
import type { GameStore } from '@/app/tap-tap-adventure/hooks/useGameStore'
import { EternalUpgrade } from '@/app/tap-tap-adventure/models/metaProgression'

const selectMetaProgression = (s: GameStore) => s.gameState?.metaProgression
const selectPurchaseUpgrade = (s: GameStore) => s.purchaseUpgrade

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
    <div className="bg-[#1e1f30] border border-[#3a3c56] rounded-lg p-4 flex flex-col gap-3">
      <div className="flex items-start justify-between gap-2">
        <div>
          <h3 className="text-sm font-semibold text-slate-200">{upgrade.name}</h3>
          <p className="text-xs text-slate-400 mt-0.5">{upgrade.description}</p>
        </div>
      </div>

      {/* Level progress */}
      <div className="flex items-center gap-2">
        <div className="flex gap-1">
          {Array.from({ length: upgrade.maxLevel }).map((_, i) => (
            <div
              key={i}
              className={`w-3 h-3 rounded-sm ${
                i < currentLevel
                  ? 'bg-amber-500'
                  : 'bg-gray-700 border border-gray-600'
              }`}
            />
          ))}
        </div>
        <span className="text-xs text-slate-400">
          {currentLevel}/{upgrade.maxLevel}
        </span>
      </div>

      {/* Purchase button */}
      {isMaxed ? (
        <div className="text-xs text-amber-400 font-medium text-center py-1.5">
          MAXED
        </div>
      ) : (
        <button
          type="button"
          disabled={!canAfford}
          onClick={() => onPurchase(upgrade.id)}
          className={`w-full py-2 px-3 rounded text-sm font-medium transition-colors ${
            canAfford
              ? 'bg-purple-600 hover:bg-purple-500 text-white cursor-pointer'
              : 'bg-gray-700 text-gray-500 cursor-not-allowed'
          }`}
        >
          {nextCost !== null ? (
            <>
              Upgrade - {nextCost} <span className="text-amber-400">&#10022;</span>
            </>
          ) : null}
        </button>
      )}
    </div>
  )
}

export default function MetaProgression({ onClose }: { onClose: () => void }) {
  const metaProgression = useGameStore(selectMetaProgression)
  const purchaseUpgrade = useGameStore(selectPurchaseUpgrade)

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
    <div className="fixed inset-0 z-50 bg-gray-900/95 overflow-y-auto">
      <div className="max-w-2xl mx-auto px-4 py-6">
        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <div>
            <h2 className="text-2xl font-bold text-slate-100">Eternal Upgrades</h2>
            <p className="text-sm text-slate-400 mt-1">
              Permanent bonuses for all future characters
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="text-slate-400 hover:text-slate-200 transition-colors text-2xl leading-none font-semibold p-2"
            aria-label="Close"
          >
            &times;
          </button>
        </div>

        {/* Soul Essence balance */}
        <div className="bg-[#1e1f30] border border-purple-600/40 rounded-lg p-4 mb-6">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <span className="text-2xl text-amber-400">&#10022;</span>
              <div>
                <div className="text-2xl font-bold text-amber-400">{soulEssence}</div>
                <div className="text-xs text-slate-400">Soul Essence</div>
              </div>
            </div>
            <div className="text-right text-xs text-slate-500 space-y-0.5">
              <div>Total earned: {totalEssenceEarned}</div>
              <div>Runs completed: {totalRuns}</div>
              <div>Best distance: {bestDistance}</div>
              <div>Best level: {bestLevel}</div>
            </div>
          </div>
        </div>

        {/* Upgrades grid */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {ETERNAL_UPGRADES.map(upgrade => (
            <UpgradeCard
              key={upgrade.id}
              upgrade={upgrade}
              currentLevel={upgradeLevels[upgrade.id] ?? 0}
              soulEssence={soulEssence}
              onPurchase={handlePurchase}
            />
          ))}
        </div>

        {/* Back button */}
        <div className="mt-6 text-center">
          <button
            type="button"
            onClick={onClose}
            className="px-6 py-2 bg-[#1e1f30] border border-[#3a3c56] rounded-lg text-slate-300 hover:text-slate-100 hover:border-slate-500 transition-colors"
          >
            Back to Characters
          </button>
        </div>
      </div>
    </div>
  )
}
