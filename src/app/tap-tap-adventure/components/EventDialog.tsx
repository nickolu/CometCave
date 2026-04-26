'use client'

import React from 'react'
import { LoaderCircle } from 'lucide-react'
import { Button } from './ui/button'
import { REGIONS } from '@/app/tap-tap-adventure/config/regions'
import type { RegionDifficulty } from '@/app/tap-tap-adventure/config/regions'
import type { FantasyDecisionPoint } from '@/app/tap-tap-adventure/models/types'

const DIFFICULTY_STYLES: Record<RegionDifficulty, { label: string; color: string }> = {
  easy: { label: 'Easy', color: 'bg-green-900/50 text-green-300 border-green-600/40' },
  medium: { label: 'Medium', color: 'bg-yellow-900/50 text-yellow-300 border-yellow-600/40' },
  hard: { label: 'Hard', color: 'bg-red-900/50 text-red-300 border-red-600/40' },
  very_hard: { label: 'Very Hard', color: 'bg-purple-900/50 text-purple-300 border-purple-600/40' },
  extreme: { label: 'Extreme', color: 'bg-purple-950/70 text-purple-200 border-purple-400/50' },
}

const ELEMENT_STYLES: Record<string, { color: string }> = {
  nature: { color: 'bg-green-900/40 text-green-300' },
  shadow: { color: 'bg-slate-800/60 text-slate-300' },
  arcane: { color: 'bg-violet-900/40 text-violet-300' },
  fire: { color: 'bg-orange-900/40 text-orange-300' },
  ice: { color: 'bg-cyan-900/40 text-cyan-300' },
  none: { color: 'bg-slate-800/40 text-slate-400' },
}

export interface EventResult {
  outcomeDescription: string
  resourceDelta?: { gold?: number; reputation?: number }
  rewardItems?: { name: string; description?: string }[]
  mountDamage?: number
  mountDied?: boolean
}

interface EventDialogProps {
  decisionPoint: FantasyDecisionPoint | null
  isLandmarkArrival: boolean
  arrivalLandmark: { name: string; icon: string; description: string; hasShop: boolean } | null
  isLegendary: boolean
  isResolving: boolean
  decisionGracePeriod: boolean
  onSelectOption: (optionId: string) => void
  // Results step
  eventResult: EventResult | null
  onDismissResult: () => void
  // NPC dialogue
  showNPCPanel: boolean
  npcPanelContent: React.ReactNode | null
}

export function EventDialog({
  decisionPoint,
  isLandmarkArrival,
  arrivalLandmark,
  isLegendary,
  isResolving,
  decisionGracePeriod,
  onSelectOption,
  eventResult,
  onDismissResult,
  showNPCPanel,
  npcPanelContent,
}: EventDialogProps) {
  return (
    <div
      className="fixed inset-0 z-50 flex items-start justify-center pt-16 px-4"
      style={{ backdropFilter: 'blur(4px)', background: 'rgba(0,0,0,0.6)' }}
    >
      <div
        className="bg-[#1e1f30] border border-[#3a3c56] rounded-lg max-w-md w-full p-5 shadow-xl max-h-[80vh] overflow-y-auto"
        onClick={e => e.stopPropagation()}
      >
        {/* Results step */}
        {eventResult && !isResolving ? (
          <>
            <div className="text-center mb-4 pb-2 border-b border-[#3a3c56]">
              <h4 className="font-semibold uppercase text-emerald-400">Outcome</h4>
            </div>
            <p className="mb-4 break-words">{eventResult.outcomeDescription}</p>

            {/* Resource deltas */}
            {eventResult.resourceDelta && (
              <div className="flex flex-wrap gap-2 justify-center mb-4">
                {eventResult.resourceDelta.gold != null && eventResult.resourceDelta.gold !== 0 && (
                  <span className={`text-sm px-2 py-1 rounded ${eventResult.resourceDelta.gold > 0 ? 'bg-yellow-900/40 text-yellow-300' : 'bg-red-900/40 text-red-300'}`}>
                    {eventResult.resourceDelta.gold > 0 ? '+' : ''}{eventResult.resourceDelta.gold} Gold
                  </span>
                )}
                {eventResult.resourceDelta.reputation != null && eventResult.resourceDelta.reputation !== 0 && (
                  <span className={`text-sm px-2 py-1 rounded ${eventResult.resourceDelta.reputation > 0 ? 'bg-blue-900/40 text-blue-300' : 'bg-red-900/40 text-red-300'}`}>
                    {eventResult.resourceDelta.reputation > 0 ? '+' : ''}{eventResult.resourceDelta.reputation} Rep
                  </span>
                )}
              </div>
            )}

            {/* Reward items */}
            {eventResult.rewardItems && eventResult.rewardItems.length > 0 && (
              <div className="space-y-1 mb-4">
                {eventResult.rewardItems.map((item, i) => (
                  <div key={i} className="text-sm px-2 py-1 rounded bg-purple-900/30 text-purple-300 border border-purple-600/30">
                    🎁 {item.name}
                  </div>
                ))}
              </div>
            )}

            {/* Mount damage/death */}
            {eventResult.mountDied && (
              <div className="text-sm text-red-400 mb-4">💀 Your mount has fallen!</div>
            )}
            {eventResult.mountDamage != null && eventResult.mountDamage > 0 && !eventResult.mountDied && (
              <div className="text-sm text-orange-400 mb-4">🐴 Your mount took {eventResult.mountDamage} damage!</div>
            )}

            <Button
              className="w-full bg-indigo-600 hover:bg-indigo-700 text-white"
              onClick={onDismissResult}
            >
              Continue
            </Button>
          </>
        ) : (
          /* Decision step */
          <>
            {/* Header */}
            {arrivalLandmark ? (
              <div className="text-center mb-4 pb-2 border-b border-indigo-600/40">
                <div className="text-3xl mb-1">{arrivalLandmark.icon}</div>
                <h4 className="font-semibold uppercase text-indigo-300">{arrivalLandmark.name}</h4>
                <p className="text-xs text-slate-400 italic mt-1">{arrivalLandmark.description}</p>
                {arrivalLandmark.hasShop && (
                  <span className="inline-block mt-1 text-[10px] px-1.5 py-0.5 rounded bg-yellow-900/40 border border-yellow-600/40 text-yellow-300">
                    🛒 Shop Available
                  </span>
                )}
              </div>
            ) : (
              <h4 className={`font-semibold w-full text-center uppercase border-b pb-2 mb-4 ${
                isLegendary
                  ? 'text-amber-400 border-amber-500/50'
                  : 'border-[#3a3c56]'
              }`}>
                {isLegendary ? '✨ Legendary Encounter ✨' : 'Event'}
              </h4>
            )}

            {/* NPC dialogue panel replaces options when active */}
            {showNPCPanel ? (
              <div className="mt-2">
                {npcPanelContent}
              </div>
            ) : decisionPoint && !decisionPoint.resolved ? (
              <div>
                <div className="font-semibold mb-6 break-words">{decisionPoint.prompt}</div>
                {isResolving ? (
                  <div className="flex flex-col items-center gap-3 py-6 text-slate-400">
                    <LoaderCircle className="animate-spin h-6 w-6" />
                    <span className="text-sm">Resolving your choice...</span>
                  </div>
                ) : (
                  <div className="space-y-2 mt-2">
                    {decisionPoint.options.map((option: { id: string; text: string; successEffects?: { reputation?: number }; failureEffects?: { reputation?: number }; effects?: { reputation?: number } }, index: number) => {
                      if (!option) return null

                      // Enrich crossroads travel options with region data
                      const isTravelOption = option.id.startsWith('travel-')
                      const travelRegionId = isTravelOption ? option.id.replace('travel-', '') : null
                      const travelRegion = travelRegionId ? REGIONS[travelRegionId] : null
                      const diffStyle = travelRegion ? DIFFICULTY_STYLES[travelRegion.difficulty] : null
                      const elemStyle = travelRegion && travelRegion.element !== 'none' ? ELEMENT_STYLES[travelRegion.element] : null
                      const borderColor = diffStyle
                        ? travelRegion!.difficulty === 'easy' ? 'border-green-600/50'
                          : travelRegion!.difficulty === 'medium' ? 'border-yellow-600/50'
                          : travelRegion!.difficulty === 'hard' ? 'border-orange-600/50'
                          : travelRegion!.difficulty === 'very_hard' ? 'border-red-600/50'
                          : 'border-purple-600/50'
                        : 'border-[#3a3c56]'

                      return (
                        <Button
                          key={option.id}
                          className={`block w-full text-left whitespace-normal h-auto border bg-[#2a2b3f] hover:bg-[#3a3c56] text-white px-3 py-3 text-base mt-2 rounded disabled:opacity-60 ${borderColor}`}
                          disabled={isResolving || decisionGracePeriod}
                          onClick={() => onSelectOption(option.id)}
                        >
                          <span className="hidden sm:inline text-slate-400 mr-2 text-xs font-mono">[{index + 1}]</span>
                          {option.text}
                          {travelRegion && (
                            <span className="flex items-center gap-1.5 mt-1.5">
                              {diffStyle && (
                                <span className={`text-[10px] px-1.5 py-0.5 rounded border ${diffStyle.color}`}>
                                  {diffStyle.label}
                                </span>
                              )}
                              {elemStyle && (
                                <span className={`text-[10px] px-1.5 py-0.5 rounded ${elemStyle.color}`}>
                                  {travelRegion.element}
                                </span>
                              )}
                              {travelRegion.minLevel > 0 && (
                                <span className="text-[10px] text-slate-500">
                                  Lv.{travelRegion.minLevel}+
                                </span>
                              )}
                            </span>
                          )}
                        </Button>
                      )
                    })}
                  </div>
                )}
              </div>
            ) : null}

            {/* Show landmark arrival options even when isLandmarkArrival with no decisionPoint resolved check handled above */}
          </>
        )}
      </div>
    </div>
  )
}
